-- Nya konton läses ur tabellerna från början (2026-11-06).
--
-- Tidigare fick bara konton som flyttats för hand ett läge i
-- public.storage_modes; ett nytt konto saknade raden och var därmed 'blob'.
-- Nu får varje konto som får sitt första egna företag i public.companies
-- läget 'tables' direkt, samma läge som alla andra ägare har sedan
-- 2026-10-29. Senare flyttas alla, gamla som nya, till 'tables_only' i ett
-- steg (se blob-planen).
--
-- Varför på companies och inte på user_data: en inbjuden revisor utan eget
-- företag ska inte få något läge. Ett företag i companies betyder att kontot
-- äger bokföring.
--
-- Ett konto som redan har ett läge (blob, tables eller tables_only) ändras
-- aldrig: ON CONFLICT DO NOTHING.
--
-- Raden skrivs bara när companies-raden skapas i samma transaktion som
-- user_data-raden (speglingen private.sync_companies), så storage_modes
-- främmande nyckel mot user_data håller alltid.
--
-- Tillbaka:
--   DROP TRIGGER IF EXISTS new_owner_tables_mode ON public.companies;
--   DROP FUNCTION IF EXISTS private.new_owner_tables_mode();
--
-- Kör hela filen i Supabase → SQL Editor. Den kan köras flera gånger.

CREATE OR REPLACE FUNCTION private.new_owner_tables_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.owner_user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_data WHERE user_id = NEW.owner_user_id) THEN
    INSERT INTO public.storage_modes (user_id, mode, note)
    VALUES (NEW.owner_user_id, 'tables', 'Nytt konto, tabelläge från början (2026-11-06)')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Läget får aldrig stoppa att företaget sparas: utan rad är kontot 'blob'
  -- som förut, och det går att rätta i efterhand.
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.new_owner_tables_mode() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS new_owner_tables_mode ON public.companies;
CREATE TRIGGER new_owner_tables_mode
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION private.new_owner_tables_mode();
