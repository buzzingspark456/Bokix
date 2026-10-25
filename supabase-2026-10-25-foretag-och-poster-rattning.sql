-- ══════════════════════════════════════════════════════════════════════
-- RÄTTNING AV FÖRETAG OCH POSTER (2026-10-25)
-- ══════════════════════════════════════════════════════════════════════
-- public.companies_mismatch() (supabase-2026-10-25-foretag-och-poster.sql)
-- nekades när nattkopian anropade den som service_role: "permission denied
-- for schema private". Funktionen använder hjälpfunktioner i private, som
-- service_role inte når. Den körs nu med ägarens rättigheter (som
-- companies_resync redan gör); bara service_role får fortfarande köra den.
-- Huvudfilen är rättad på samma sätt.
--
-- Kör i Supabase → SQL Editor.

ALTER FUNCTION public.companies_mismatch() SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.companies_mismatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.companies_mismatch() TO service_role;
