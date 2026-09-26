-- ═══════════════════════════════════════════════════════════════════════
-- UF-avslut, 2026-09-26. Kör HELA filen i Supabase → SQL Editor.
-- Säker att köra flera gånger. Samma innehåll finns i supabase-setup.sql.
--
-- Ett UF-konto som avslutat sitt UF-år (app_metadata.uf_closed_at, satt av
-- api/archive.js action uf_close) räknas inte längre som gratis: kontot
-- blir skrivskyddat men går att läsa och ladda ner i tre månader, sedan
-- stänger nattjobbet kontot (api/_ufAccount.js). Bokföringen och
-- underlagen flyttas först till sjuårsarkivet, som Skatteverket kräver
-- även för UF-företag.
-- ═══════════════════════════════════════════════════════════════════════

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
