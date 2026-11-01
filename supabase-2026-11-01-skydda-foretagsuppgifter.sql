-- Företagsuppgifterna får inte kunna försvinna i klump.
--
-- 2026-10-31 skrevs grundarens företagspost över: 51 fält blev 13. Allt tyder
-- på Bolagsverket-koden som kördes lokalt mot produktionen (lokala .env pekar
-- dit) och skrev de hämtade fälten i stället för hela posten.
--
-- Ersätter private.keep_company_id. Försvinner id:t läggs det tillbaka.
-- Försvinner fler än fem fält i samma sparning behålls de gamla värdena och
-- händelsen loggas. Ingen vanlig åtgärd tar bort så många fält på en gång.
CREATE OR REPLACE FUNCTION private.keep_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lost text[];
BEGIN
  IF NEW.settings IS NULL OR jsonb_typeof(NEW.settings) IS DISTINCT FROM 'object'
     OR jsonb_typeof(OLD.settings) IS DISTINCT FROM 'object' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(k) INTO v_lost
  FROM jsonb_object_keys(OLD.settings) k
  WHERE NOT (NEW.settings ? k);

  IF cardinality(v_lost) > 5 THEN
    NEW.settings := OLD.settings || NEW.settings;
    BEGIN
      INSERT INTO public.system_events (kind, detail)
      VALUES ('company_settings_kept', format('Konto %s, företag %s: en sparning hade tagit bort %s fält (%s). De gamla värdena behölls.',
        OLD.owner_user_id, OLD.legacy_key, cardinality(v_lost), array_to_string(v_lost, ', ')));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF coalesce(OLD.settings ->> 'id', '') <> '' AND coalesce(NEW.settings ->> 'id', '') = '' THEN
    NEW.settings := jsonb_set(NEW.settings, '{id}', OLD.settings -> 'id');
    NEW.legacy_company_id := OLD.legacy_company_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.keep_company_id() FROM PUBLIC, anon, authenticated;

-- Provar skyddet. Ett rött fel med "TEST KLART" är rätt svar: inget sparas.
DO $$
DECLARE
  v_kept integer;
BEGIN
  UPDATE public.companies
  SET settings = jsonb_build_object('name', settings -> 'name')
  WHERE owner_user_id = '6545414d-a28e-4f96-8ef6-c098801e6c85' AND deleted_at IS NULL
  RETURNING (SELECT count(*) FROM jsonb_object_keys(settings)) INTO v_kept;
  RAISE EXCEPTION 'TEST KLART: fält kvar efter försök = %', v_kept;
END $$;
