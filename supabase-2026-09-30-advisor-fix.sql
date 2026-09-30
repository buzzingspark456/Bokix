-- ══════════════════════════════════════════════════════════════════════
-- Supabase Advisor-varningar, 2026-09-30
-- ══════════════════════════════════════════════════════════════════════
-- Kör hela filen i SQL Editor. Säker att köra om.
--
-- 1. can_write_user_data flyttas ut ur public till ett eget schema
--    (private) som PostgREST inte exponerar. Policyerna på user_data och
--    company_members pekar på funktionen via dess id, så de följer med
--    flytten utan att behöva skrivas om. Den går då inte längre att anropa
--    som /rest/v1/rpc/can_write_user_data.
-- 2. is_admin_uid och de tre blogimages-policyerna tas bort. De användes
--    bara av blogg-CMS:et som togs bort 2026-09-13; bucketen och bilderna
--    ligger kvar orörda.
-- 3. Tre policyer skrivs om med ((select auth.jwt()) ->> 'email') så att
--    JWT:n läses en gång per fråga i stället för en gång per rad.

-- ── 1. can_write_user_data → private ─────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.can_write_user_data(uuid)') IS NOT NULL
     AND to_regprocedure('private.can_write_user_data(uuid)') IS NULL THEN
    ALTER FUNCTION public.can_write_user_data(uuid) SET SCHEMA private;
  END IF;
END $$;

-- Policyer körs som den inloggade användarens roll, så authenticated måste
-- få köra funktionen. anon behöver den aldrig.
REVOKE ALL ON FUNCTION private.can_write_user_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_write_user_data(uuid) TO authenticated;

-- ── 2. is_admin_uid och blogimages-policyerna bort ───────────────────
DROP POLICY IF EXISTS "Admin-uppladdning i blogimages" ON storage.objects;
DROP POLICY IF EXISTS "Admin-uppdatering i blogimages" ON storage.objects;
DROP POLICY IF EXISTS "Admin-radering i blogimages" ON storage.objects;
-- Utan CASCADE: om något annat oväntat fortfarande använder funktionen
-- stoppar Postgres här i stället för att tyst ta bort det.
DROP FUNCTION IF EXISTS public.is_admin_uid(uuid);

-- ── 3. auth.jwt() en gång per fråga ──────────────────────────────────
DROP POLICY IF EXISTS "Se egna medlemskapsrader" ON public.company_members;
CREATE POLICY "Se egna medlemskapsrader"
ON public.company_members FOR SELECT TO authenticated
USING (
  (select auth.uid()) = owner_user_id
  OR (select auth.uid()) = member_user_id
  OR lower(invited_email) = lower((select auth.jwt()) ->> 'email')
);

DROP POLICY IF EXISTS "Hantera eller lös in medlemskap" ON public.company_members;
CREATE POLICY "Hantera eller lös in medlemskap"
ON public.company_members FOR UPDATE TO authenticated
USING (
  owner_user_id = (select auth.uid())
  OR (
    lower(invited_email) = lower((select auth.jwt()) ->> 'email')
    AND status = 'pending'
    AND expires_at > now()
  )
)
WITH CHECK (
  owner_user_id = (select auth.uid())
  OR (
    lower(invited_email) = lower((select auth.jwt()) ->> 'email')
    AND member_user_id = (select auth.uid())
    AND status = 'active'
    AND role = (SELECT cm.role FROM public.company_members cm WHERE cm.id = company_members.id)
  )
);

DROP POLICY IF EXISTS "Logga egen händelse" ON public.audit_log;
CREATE POLICY "Logga egen händelse"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (
  actor_user_id = (select auth.uid())
  AND lower(actor_email) = lower((select auth.jwt()) ->> 'email')
  AND (
    owner_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.member_user_id = (select auth.uid())
        AND cm.owner_user_id = audit_log.owner_user_id
        AND cm.company_id = audit_log.company_id
        AND cm.status = 'active'
    )
  )
);

-- Kontroll: ska visa private | can_write_user_data och inga rader för is_admin_uid.
SELECT n.nspname, p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('can_write_user_data', 'is_admin_uid');
