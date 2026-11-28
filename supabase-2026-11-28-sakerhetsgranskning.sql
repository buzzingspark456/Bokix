-- ══════════════════════════════════════════════════════════════════════
-- SÄKERHETSGRANSKNINGEN 2026-11-28 (körning 4): två rättelser i databasen
-- ══════════════════════════════════════════════════════════════════════
-- Körs en gång i produktionen (SQL Editor). Går att köra flera gånger.
--
-- 1. Bokförda verifikationer: skyddet byggde på fälten status och source,
--    som appen själv skickar in.
--    a) En redigerare kunde sätta source till 'sie_import...' (då räknades
--       verifikationen inte längre som skyddad) och sedan ändra eller ta
--       bort den. Nu får en verifikation inte bli SIE-import i efterhand.
--    b) En ny bokförd verifikation kunde läggas in i ett låst år om den
--       märktes som bokslut eller SIE-import. Nu gäller undantaget bara när
--       ett år låstes alldeles nyss (bokslutet sparas tillsammans med låset),
--       och resultatfördelningen bara en gång per år.
--    c) SIE-importerade verifikationer i ett låst år skyddas nu som andra
--       bokförda verifikationer (appen stoppade redan Ta bort SIE-import där).
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

-- Bokförd = allt utom utkast (även SIE-import).
CREATE OR REPLACE FUNCTION private.verification_is_booked(p_data jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_data ->> 'status', 'booked') <> 'draft';
$$;

-- Låstes något räkenskapsår i företaget alldeles nyss (lockedAt inom 30
-- minuter, åt båda hållen för att tåla en klocka som går fel)? Bokslutet
-- sparar verifikationerna och låset samtidigt, så bara då får bokslutets
-- egna verifikationer och en SIE-import hamna i ett låst år.
CREATE OR REPLACE FUNCTION private.fiscal_year_locked_just_now(p_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c,
         jsonb_each(CASE WHEN jsonb_typeof(c.settings -> 'lockedFiscalYears') = 'object' THEN c.settings -> 'lockedFiscalYears' ELSE '{}'::jsonb END) AS l(key, lock)
    WHERE c.id = p_company
      AND jsonb_typeof(l.lock) = 'object'
      AND coalesce(l.lock ->> 'lockedAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}'
      AND (l.lock ->> 'lockedAt')::timestamptz BETWEEN now() - interval '30 minutes' AND now() + interval '30 minutes'
  );
$$;

CREATE OR REPLACE FUNCTION private.guard_verification_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text;
  v_src text := coalesce(NEW.data ->> 'source', '');
  v_exempt boolean;
BEGIN
  -- Befintlig verifikation som inte får ändras: bokförd (ej SIE-import), och
  -- sedan 2026-11-28 även en SIE-importerad verifikation i ett låst år.
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND (
       private.verification_is_protected(OLD.data)
       OR (private.verification_is_booked(OLD.data) AND private.in_locked_fiscal_year(OLD.company_id, OLD.data ->> 'date'))
     ) THEN
    IF NEW.deleted_at IS NOT NULL THEN
      v_reason := 'remove';
    ELSIF (NEW.data -> 'rows') IS DISTINCT FROM (OLD.data -> 'rows')
       OR (NEW.data ->> 'date') IS DISTINCT FROM (OLD.data ->> 'date')
       OR (NEW.data ->> 'series') IS DISTINCT FROM (OLD.data ->> 'series')
       OR (NEW.data ->> 'number') IS DISTINCT FROM (OLD.data ->> 'number')
       OR coalesce(NEW.data ->> 'status', 'booked') IS DISTINCT FROM coalesce(OLD.data ->> 'status', 'booked')
       -- En verifikation blir inte SIE-import i efterhand (då släppte skyddet).
       OR (v_src LIKE 'sie_import%' AND coalesce(OLD.data ->> 'source', '') NOT LIKE 'sie_import%') THEN
      v_reason := 'change';
    END IF;
    IF v_reason IS NOT NULL THEN
      INSERT INTO public.system_events (kind, detail)
      VALUES ('verif_guard', left(format('%s company=%s id=%s', v_reason, OLD.company_id, OLD.id), 500));
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Ny bokförd verifikation (även SIE-import), ett utkast som bokförs eller
  -- en verifikation som flyttas, med datum i ett låst år. Undantag:
  --   - bokslutet och omföringen till nästa år, och en SIE-import, när ett år
  --     låstes alldeles nyss (de sparas tillsammans med låset);
  --   - resultatfördelningen i handels- och kommanditbolag, som bokas efter
  --     låset men bara en gång per år (samma sourceId).
  -- Utdelning, återbäring och flytt av resultat stoppas redan i appen för
  -- låsta år och har inget undantag här.
  IF NEW.deleted_at IS NULL
     AND private.verification_is_booked(NEW.data)
     -- INSERT ... ON CONFLICT kör insert-triggern även när raden redan finns;
     -- då avgör uppdateringen (ovan).
     AND (TG_OP = 'UPDATE' OR NOT EXISTS (
       SELECT 1 FROM public.company_records r
       WHERE r.company_id = NEW.company_id AND r.kind = NEW.kind AND r.id = NEW.id AND r.deleted_at IS NULL))
     AND (TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL OR NOT private.verification_is_booked(OLD.data)
          OR (NEW.data ->> 'date') IS DISTINCT FROM (OLD.data ->> 'date'))
     AND private.in_locked_fiscal_year(NEW.company_id, NEW.data ->> 'date') THEN
    v_exempt := ((v_src IN ('year_end_close', 'year_open_transfer') OR v_src LIKE 'sie_import%')
                 AND private.fiscal_year_locked_just_now(NEW.company_id))
             OR (v_src = 'partner_allocation' AND coalesce(NEW.data ->> 'sourceId', '') <> '' AND NOT EXISTS (
                   SELECT 1 FROM public.company_records r
                   WHERE r.company_id = NEW.company_id AND r.kind = NEW.kind AND r.deleted_at IS NULL
                     AND r.id <> NEW.id AND r.data ->> 'sourceId' = NEW.data ->> 'sourceId'));
    IF NOT v_exempt THEN
      INSERT INTO public.system_events (kind, detail)
      VALUES ('verif_guard', left(format('locked_year company=%s id=%s date=%s source=%s', NEW.company_id, NEW.id, NEW.data ->> 'date', v_src), 500));
      IF TG_OP = 'INSERT' THEN RETURN NULL; END IF;
      RETURN OLD;
    END IF;
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
