-- Alla ägarkonton till 'tables_only' (2026-11-06), steg 4d för alla.
--
-- Före: grundaren i 'tables_only' sedan 2026-10-25, övriga ägare i 'tables'
-- sedan 2026-10-29 (0 läs-/sparfel, nattkopian 9/9, companies_mismatch() = 0
-- kontrollerat 2026-11-06). Konton med företag men utan rad (nya konton före
-- 2026-11-06) får också 'tables_only'.
--
-- Nya konton får fortfarande 'tables' av triggern new_owner_tables_mode: deras
-- första session sparar via blobben, och i 'tables_only' är blobben fryst.
-- De flyttas till 'tables_only' med samma fil senare.
--
-- Säkerhetsspärr: om tabellerna och blobben skiljer sig för något konto
-- avbryts allt och inget ändras.
--
-- Tillbaka för ett konto (bygger blobben ur tabellerna, sedan tables):
--   SELECT public.rebuild_blob_from_tables('<user_id>');
--   UPDATE public.storage_modes SET mode = 'tables' WHERE user_id = '<user_id>';
--
-- Kör hela filen i Supabase → SQL Editor. Den kan köras flera gånger.

DO $$
DECLARE
  v_diff int;
  v_updated int;
  v_inserted int;
BEGIN
  SELECT count(*) INTO v_diff FROM public.companies_mismatch() m
  WHERE m.owner_user_id IN (SELECT user_id FROM public.storage_modes WHERE mode = 'tables')
     OR m.owner_user_id NOT IN (SELECT user_id FROM public.storage_modes);
  IF v_diff > 0 THEN
    RAISE EXCEPTION 'Avbrutet: % skillnader mellan blobben och tabellerna. Inget ändrat.', v_diff;
  END IF;

  UPDATE public.storage_modes
     SET mode = 'tables_only', switched_at = now(),
         note = coalesce(note || ' · ', '') || 'tables_only 2026-11-06'
   WHERE mode = 'tables';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.storage_modes (user_id, mode, note)
  SELECT DISTINCT c.owner_user_id, 'tables_only', 'tables_only 2026-11-06 (saknade läge)'
    FROM public.companies c
    JOIN public.user_data u ON u.user_id = c.owner_user_id
   WHERE c.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.storage_modes s WHERE s.user_id = c.owner_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE 'Klart: % konton från tables, % utan läge, nu tables_only.', v_updated, v_inserted;
END;
$$;

-- Läget efteråt (en rad per konto):
SELECT left(user_id::text, 8) AS konto, mode, switched_at FROM public.storage_modes ORDER BY switched_at;
