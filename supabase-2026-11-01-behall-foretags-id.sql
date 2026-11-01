-- Företagets id får aldrig försvinna ur public.companies.
--
-- Grundarens företag tappade settings.id och legacy_company_id. Inbjudningar
-- pekar på id:t, så den inbjudna revisorn nekades åtkomst och fick betalsidan,
-- och fakturautskicket gav "to, subject, html och company_id krävs". En
-- rättning med UPDATE skrevs över inom några minuter: appens sparade kopia
-- gällde fortfarande eftersom user_data.updated_at inte ändrats, och en
-- sparning från den kopian tog bort id:t igen.
--
-- Triggern behåller id:t oavsett varifrån skrivningen kommer. Sista raden i
-- transaktionen ändrar updated_at, så att appen hämtar om från databasen.
BEGIN;

CREATE OR REPLACE FUNCTION private.keep_company_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(OLD.settings ->> 'id', '') <> ''
     AND NEW.settings IS NOT NULL
     AND coalesce(NEW.settings ->> 'id', '') = '' THEN
    NEW.settings := jsonb_set(NEW.settings, '{id}', OLD.settings -> 'id');
    NEW.legacy_company_id := OLD.legacy_company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_company_id ON public.companies;
CREATE TRIGGER keep_company_id
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION private.keep_company_id();

-- Grundarens företag: id:t ur den frysta blobben.
UPDATE public.companies
SET settings = jsonb_set(settings, '{id}', '"company_1789941077819_dhzfuc"'),
    legacy_company_id = 'company_1789941077819_dhzfuc',
    version = version + 1,
    updated_at = now()
WHERE owner_user_id = '6545414d-a28e-4f96-8ef6-c098801e6c85'
  AND legacy_key = 'company_1787172785058'
  AND deleted_at IS NULL
  AND coalesce(settings ->> 'id', '') = '';

UPDATE public.user_data
SET updated_at = now()
WHERE user_id = '6545414d-a28e-4f96-8ef6-c098801e6c85';

COMMIT;

SELECT legacy_key, legacy_company_id, settings ->> 'id' AS id,
       public.server_read_company(owner_user_id, legacy_company_id, array[]::text[]) IS NOT NULL AS foretaget_hittas
FROM public.companies
WHERE owner_user_id = '6545414d-a28e-4f96-8ef6-c098801e6c85';

-- Ta bort skyddet:
--   DROP TRIGGER keep_company_id ON public.companies;
--   DROP FUNCTION private.keep_company_id();
