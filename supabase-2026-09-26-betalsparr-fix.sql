-- ═══════════════════════════════════════════════════════════════════════
-- Betalspärren, rättelse 2026-09-26. Kör HELA filen i Supabase → SQL Editor.
-- Samma innehåll finns i supabase-setup.sql; den här filen är bara det som
-- ändrats, så den går att köra direkt mot produktion. Säker att köra flera
-- gånger (CREATE OR REPLACE / DROP POLICY IF EXISTS).
--
-- Vad som rättas jämfört med versionen från 2026-09-25:
--  1. UF-perioden räknas från auth.users.created_at, inte från
--     user_metadata.uf_started_at. Metadatan kan varje användare skriva om
--     själv (supabase.auth.updateUser) och fick då gratis åtkomst för evigt.
--  2. Ett medlemskap räcker bara om företagets ÄGARE har betald åtkomst.
--     Förut räckte vilket aktivt medlemskap som helst, så ett obetalt konto
--     kunde bjuda in sin egen andra e-postadress och fortsätta gratis.
--  3. Inbjudningar kräver att den som bjuder in själv får skriva (betalar).
--  4. SECURITY DEFINER-funktionerna får en fast search_path.
-- ═══════════════════════════════════════════════════════════════════════

-- Har kontot betald åtkomst på egen hand? Gratiskonto, UF-period (tre
-- månader från registreringen) eller en prenumeration med giltig status.
-- Samma regler som hasPaidAccess i api/_auth.js.
CREATE OR REPLACE FUNCTION public.has_paid_access(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = target_user_id
        AND (
          lower(coalesce(u.email, '')) IN ('alwakiabdullah1@gmail.com', 'abbealwaki08@gmail.com')
          OR (
            (u.raw_user_meta_data ->> 'uf') = 'true'
            AND u.created_at + interval '3 months' > now()
            -- Avslutat UF-år (app_metadata, bara servern skriver) = inte gratis längre.
            AND (u.raw_app_meta_data ->> 'uf_closed_at') IS NULL
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = target_user_id
        AND s.status IN ('trialing', 'active', 'past_due')
    );
$$;

-- Ingen ska kunna fråga databasen om ett ANNAT kontos betalstatus via
-- RPC. Funktionen används bara inifrån can_write_user_data nedan (som
-- körs som ägaren av funktionerna och därför fortfarande får anropa den).
REVOKE EXECUTE ON FUNCTION public.has_paid_access(uuid) FROM PUBLIC, anon, authenticated;

-- Får den inloggade användaren skriva i sin egen user_data-rad?
-- Egen betald åtkomst, eller aktiv medlem i ett företag vars ägare har det.
CREATE OR REPLACE FUNCTION public.can_write_user_data(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT auth.uid()) = target_user_id
    AND (
      public.has_paid_access(target_user_id)
      OR EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.member_user_id = target_user_id
          AND cm.status = 'active'
          AND public.has_paid_access(cm.owner_user_id)
      )
    );
$$;

-- Skrivpolicyerna på user_data (samma som i går, pekar på funktionen ovan).
-- Läsning (SELECT) är orörd: ägaren får alltid läsa sina böcker i sju år.
DROP POLICY IF EXISTS "Insert own user data" ON public.user_data;
CREATE POLICY "Insert own user data"
ON public.user_data
FOR INSERT
WITH CHECK (public.can_write_user_data(user_id));

DROP POLICY IF EXISTS "Update own user data" ON public.user_data;
CREATE POLICY "Update own user data"
ON public.user_data
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK (public.can_write_user_data(user_id));

DROP POLICY IF EXISTS "Delete own user data" ON public.user_data;
CREATE POLICY "Delete own user data"
ON public.user_data
FOR DELETE
USING (public.can_write_user_data(user_id));

-- Inbjudningar: bara ett konto som själv får skriva kan bjuda in.
DROP POLICY IF EXISTS "Ägare skapar inbjudan" ON public.company_members;
CREATE POLICY "Ägare skapar inbjudan"
ON public.company_members FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = (select auth.uid())
  AND public.can_write_user_data((select auth.uid()))
  AND (
    SELECT count(*) FROM public.company_members cm
    WHERE cm.owner_user_id = (select auth.uid())
      AND cm.company_id = company_members.company_id
      AND cm.status IN ('pending', 'active')
  ) < 2
);
