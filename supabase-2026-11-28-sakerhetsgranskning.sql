-- ══════════════════════════════════════════════════════════════════════
-- SÄKERHETSGRANSKNINGEN 2026-11-28 (körning 4): två rättelser i databasen
-- ══════════════════════════════════════════════════════════════════════
-- Körs en gång i produktionen (SQL Editor). Går att köra flera gånger.
--
-- 1. Bokförda verifikationer: skyddet byggde på fälten status och source,
--    som appen själv skickar in. Status var redan låst, men source inte: en
--    redigerare kunde först sätta source till 'sie_import...' (då räknas
--    verifikationen inte längre som skyddad) och sedan ändra eller ta bort
--    den. Nu räknas varje ändring som gör en skyddad verifikation oskyddad
--    som en otillåten ändring, precis som att ändra raderna.
--
-- 2. Inkommande kvitton (inbox_items): läs- och hämtreglerna tittade bara på
--    rollen, inte på sidbehörigheten. En medlem utan Kvitton kunde läsa
--    kvittona direkt från databasen, och en redigerare utan behörighet kunde
--    markera dem som hämtade så att de aldrig nådde Underlag. Nu gäller samma
--    regel som appen och servern (src/utils/pageAccess.js, accessForPage):
--    kvittona hör till sidorna Kvitton (expenses) och Granskning (review).
--
-- Ta bort (återgå till 2026-11-22 respektive 2026-10-04): kör om
-- supabase-2026-11-22-bokforda-verifikationer.sql och policyerna i
-- supabase-2026-10-04-inkorg.sql.

-- ── 1. Bokförda verifikationer ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.guard_verification_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Verifikationer som bokas när året stängs (samma spara som låset).
  v_closing text[] := ARRAY['year_end_close', 'year_open_transfer', 'equity_reclass', 'partner_allocation', 'dividend', 'patronage_refund'];
  v_reason text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND private.verification_is_protected(OLD.data) THEN
    IF NEW.deleted_at IS NOT NULL THEN
      v_reason := 'remove';
    ELSIF (NEW.data -> 'rows') IS DISTINCT FROM (OLD.data -> 'rows')
       OR (NEW.data ->> 'date') IS DISTINCT FROM (OLD.data ->> 'date')
       OR (NEW.data ->> 'series') IS DISTINCT FROM (OLD.data ->> 'series')
       OR (NEW.data ->> 'number') IS DISTINCT FROM (OLD.data ->> 'number')
       OR coalesce(NEW.data ->> 'status', 'booked') IS DISTINCT FROM coalesce(OLD.data ->> 'status', 'booked')
       -- Nytt 2026-11-28: en skyddad verifikation får inte bli oskyddad
       -- (t.ex. source ändrad till 'sie_import...').
       OR NOT private.verification_is_protected(NEW.data) THEN
      v_reason := 'change';
    END IF;
    IF v_reason IS NOT NULL THEN
      INSERT INTO public.system_events (kind, detail)
      VALUES ('verif_guard', left(format('%s company=%s id=%s', v_reason, OLD.company_id, OLD.id), 500));
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Ny bokförd verifikation, eller ett utkast som bokförs, i ett låst år.
  IF NEW.deleted_at IS NULL
     AND private.verification_is_protected(NEW.data)
     AND NOT (coalesce(NEW.data ->> 'source', '') = ANY (v_closing))
     -- INSERT ... ON CONFLICT kör insert-triggern även när raden redan finns;
     -- då avgör uppdateringen (ovan), annars hade underlag i ett låst år
     -- inte gått att lägga till.
     AND (TG_OP = 'UPDATE' OR NOT EXISTS (
       SELECT 1 FROM public.company_records r
       WHERE r.company_id = NEW.company_id AND r.kind = NEW.kind AND r.id = NEW.id AND r.deleted_at IS NULL))
     AND (TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL OR NOT private.verification_is_protected(OLD.data))
     AND private.in_locked_fiscal_year(NEW.company_id, NEW.data ->> 'date') THEN
    INSERT INTO public.system_events (kind, detail)
    VALUES ('verif_guard', left(format('locked_year company=%s id=%s date=%s', NEW.company_id, NEW.id, NEW.data ->> 'date'), 500));
    IF TG_OP = 'INSERT' THEN RETURN NULL; END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_verification_records() FROM PUBLIC, anon, authenticated;

-- ── 2. Inkommande kvitton ──────────────────────────────────────────────

-- Samma som accessForPage i src/utils/pageAccess.js: saknas listan, eller
-- sidan i listan, bestämmer rollen; en läsare får aldrig 'edit'.
CREATE OR REPLACE FUNCTION private.member_page_level(p_access jsonb, p_page text, p_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_access IS NULL OR jsonb_typeof(p_access) <> 'object'
         OR coalesce(p_access ->> p_page, '') NOT IN ('none', 'view', 'edit')
      THEN CASE WHEN p_role = 'editor' THEN 'edit' ELSE 'view' END
    WHEN p_access ->> p_page = 'edit' AND p_role IS DISTINCT FROM 'editor' THEN 'view'
    ELSE p_access ->> p_page
  END;
$$;

REVOKE ALL ON FUNCTION private.member_page_level(jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.member_page_level(jsonb, text, text) TO authenticated;

DROP POLICY IF EXISTS "Läs företagets inkorg" ON public.inbox_items;
CREATE POLICY "Läs företagets inkorg"
ON public.inbox_items FOR SELECT TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.member_user_id = (SELECT auth.uid())
      AND m.owner_user_id = inbox_items.owner_user_id
      AND m.company_id = inbox_items.company_id
      AND m.status = 'active'
      AND (private.member_page_level(m.page_access, 'expenses', m.role) <> 'none'
           OR private.member_page_level(m.page_access, 'review', m.role) <> 'none')
  )
);

DROP POLICY IF EXISTS "Hämta från företagets inkorg" ON public.inbox_items;
CREATE POLICY "Hämta från företagets inkorg"
ON public.inbox_items FOR UPDATE TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.member_user_id = (SELECT auth.uid())
      AND m.owner_user_id = inbox_items.owner_user_id
      AND m.company_id = inbox_items.company_id
      AND m.status = 'active'
      AND m.role = 'editor'
      AND (private.member_page_level(m.page_access, 'expenses', m.role) = 'edit'
           OR private.member_page_level(m.page_access, 'review', m.role) = 'edit')
  )
)
WITH CHECK (
  owner_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.member_user_id = (SELECT auth.uid())
      AND m.owner_user_id = inbox_items.owner_user_id
      AND m.company_id = inbox_items.company_id
      AND m.status = 'active'
      AND m.role = 'editor'
      AND (private.member_page_level(m.page_access, 'expenses', m.role) = 'edit'
           OR private.member_page_level(m.page_access, 'review', m.role) = 'edit')
  )
);

-- Kontroll efteråt (ska ge tre rader):
-- SELECT policyname FROM pg_policies WHERE tablename = 'inbox_items'
-- UNION ALL SELECT 'trigger: ' || tgname FROM pg_trigger WHERE tgname = 'guard_verification_records';
