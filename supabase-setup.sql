-- Supabase setup for Bokix user_data persistence

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the user_data table used by the app
CREATE TABLE IF NOT EXISTS public.user_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  state jsonb,
  onboarding_completed boolean DEFAULT false,
  onboarding_skipped boolean DEFAULT false,
  company_name text,
  company_orgnr text,
  contact_details jsonb,
  company_settings jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add trigger to update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.user_data;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.user_data
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Policy: select only own rows
CREATE POLICY "Select own user data"
ON public.user_data
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: insert only own rows
CREATE POLICY "Insert own user data"
ON public.user_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: update only own rows
CREATE POLICY "Update own user data"
ON public.user_data
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: delete only own rows
CREATE POLICY "Delete own user data"
ON public.user_data
FOR DELETE
USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- Stripe Connect OAuth: server-side skrivning av stripeAccountId
-- ═══════════════════════════════════════════════════════════
-- Stripes OAuth-callback körs helt utan inloggad användarsession (Stripe
-- skickar bara en anonym redirect till Bokix, ingen JWT följer med), så
-- RLS-policyerna ovan (som kräver auth.uid() = user_id) kan inte
-- uppfyllas där. Anropas därför via service-role-nyckeln, som kringgår
-- RLS helt — därför är funktionen så snäv som möjligt (skriver bara ett
-- enda jsonb-fält) istället för att exponera en generell skriv-RPC.
--
-- SECURITY DEFINER + explicit REVOKE/GRANT: bara service_role (som
-- server-koden autentiserar med) får köra den här — anon/authenticated
-- ska aldrig kunna sätta ett godtyckligt Stripe-konto-ID på ett företag.
--
-- jsonb_set med "true" som fjärde argument (create_missing) så anropet
-- fungerar även om `companies.<id>.company` av någon anledning saknar
-- ett stripeAccountId-fält sedan tidigare, utan att först behöva läsa
-- och tolka hela blobben i applikationskod (samma sorts race som redan
-- fanns i klientens gamla updateCompanyField, fast här undviks den redan
-- från start genom att aldrig göra ett läs-ändra-skriv över huvud taget).
CREATE OR REPLACE FUNCTION public.set_company_stripe_account(
  p_user_id uuid,
  p_company_id text,
  p_stripe_account_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_data
  SET state = jsonb_set(
    coalesce(state, '{}'::jsonb),
    ARRAY['companies', p_company_id, 'company', 'stripeAccountId'],
    to_jsonb(p_stripe_account_id),
    true
  )
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_stripe_account(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_company_stripe_account(uuid, text, text) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- Storage: profilbilder och företagslogotyper (Inställningar)
-- ═══════════════════════════════════════════════════════════
-- Två separata buckets — "profile" (profilbild i "Min profil") och
-- "companylogo" (logotyp i "Företag") — istället för en delad bucket med
-- mapp-prefix, ett medvetet val för tydligare separation mellan de två
-- bildtyperna. Publik läsning så att bilderna kan visas direkt i
-- <img>-taggar och på fakturor utan signerade URL:er — precis som
-- avatar_url/logoUrl redan lagras som vanliga textfält i övrigt.
-- Skrivning/radering är begränsad till ägaren: varje fils sökväg måste
-- börja med den inloggade användarens auth.uid() som första mapp-segment
-- (t.ex. "<uid>/avatar.png"), så en användare aldrig kan skriva över en
-- annan användares filer.
--
-- OBS: en tidigare version av det här projektet använde en enda delad
-- bucket "bokix-uploads" med mapp-prefix istället för två separata
-- buckets — den bucketen kan fortfarande finnas kvar i projektet men
-- koden (Settings.jsx) pekar inte längre mot den.
--
-- allowed_mime_types + file_size_limit sätts direkt på bucketen, inte
-- bara kollat i React-komponenten (ImageUploadField) — annars är
-- "JPG eller PNG, max 3 MB" bara UI-text som vem som helst med en giltig
-- inloggning kan gå förbi genom att anropa Storage-API:et direkt, samma
-- sätt som all annan skarp validering i den här filen.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile', 'profile', true, 3145728, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = 3145728, allowed_mime_types = ARRAY['image/jpeg', 'image/png'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('companylogo', 'companylogo', true, 3145728, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = 3145728, allowed_mime_types = ARRAY['image/jpeg', 'image/png'];

-- DROP + CREATE (inte bara CREATE) på varje policy — annars kraschar en
-- andra körning av den här filen på "policy already exists" på den
-- FÖRSTA policyn, vilket beroende på hur den kördes (t.ex. hela filen
-- inklistrad som en enda batch i SQL Editor) kan rulla tillbaka HELA
-- resten av batchen och tyst lämna övriga policyer nedan aldrig
-- skapade — det var den faktiska, verifierade orsaken till att
-- uppladdning gav "new row violates row-level security policy" trots en
-- korrekt inloggad användare som skrev till sin egen mapp, i den
-- tidigare enda-bucket-varianten av den här filen.
DROP POLICY IF EXISTS "Publik läsning av profile" ON storage.objects;
CREATE POLICY "Publik läsning av profile"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile');

DROP POLICY IF EXISTS "Egen uppladdning i profile" ON storage.objects;
CREATE POLICY "Egen uppladdning i profile"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- WITH CHECK upprepar samma villkor som USING här — inte strikt
-- nödvändigt (Postgres återanvänder USING som WITH CHECK automatiskt när
-- den senare utelämnas för en UPDATE-policy), men uttryckt explicit
-- istället för att förlita sig på det implicita förvalet.
DROP POLICY IF EXISTS "Egen uppdatering i profile" ON storage.objects;
CREATE POLICY "Egen uppdatering i profile"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
WITH CHECK (bucket_id = 'profile' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Egen radering i profile" ON storage.objects;
CREATE POLICY "Egen radering i profile"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Publik läsning av companylogo" ON storage.objects;
CREATE POLICY "Publik läsning av companylogo"
ON storage.objects FOR SELECT
USING (bucket_id = 'companylogo');

DROP POLICY IF EXISTS "Egen uppladdning i companylogo" ON storage.objects;
CREATE POLICY "Egen uppladdning i companylogo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'companylogo' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Egen uppdatering i companylogo" ON storage.objects;
CREATE POLICY "Egen uppdatering i companylogo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'companylogo' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
WITH CHECK (bucket_id = 'companylogo' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Egen radering i companylogo" ON storage.objects;
CREATE POLICY "Egen radering i companylogo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'companylogo' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- ═══════════════════════════════════════════════════════════
-- Storage: kvitton och övriga bilagor (Utgifter, Verifikationer)
-- ═══════════════════════════════════════════════════════════
-- Koden (Expenses.jsx för kvitton, Verifications.jsx via fileUpload.js för
-- verifikationsunderlag) har hela tiden pekat mot en bucket "bokix-uploads",
-- men den skapades aldrig av det här scriptet efter migreringen till
-- separata profile/companylogo-buckets ovan — bucketen saknades alltså på
-- alla projekt som bara kört den här filen, vilket gjorde att kvittobilden
-- aldrig sparades (uppladdningen misslyckas med "bucket not found", se
-- felhanteringen i Expenses.jsx) trots att utgiften ändå bokfördes. En delad
-- bucket med mapp-prefix per användare/funktion ("<uid>/receipts/...",
-- "<uid>/files/...") istället för ytterligare separata buckets, eftersom
-- den redan delas mellan två oberoende funktioner i koden. file_size_limit
-- matchar MAX_FILE_MB i Expenses.jsx (10 MB); allowed_mime_types matchar
-- ACCEPTED_TYPES där (bild eller PDF).
--
-- Till skillnad från profile/companylogo ovan finns INGEN öppen
-- SELECT-policy här. Kvitton är riktiga köpuppgifter, inte
-- publika profilbilder — bucketen är fortfarande public:true så att
-- <img src={getPublicUrl}> fungerar rakt av (den rutten kollar bara
-- bucket.public, inte RLS), men utan en egen SELECT-policy kan ingen
-- lista/bläddra i storage.objects och på så vis få fram andra
-- användares filsökvägar. Bara den som redan har URL:en (dvs. den som
-- äger raden i user_data där den sparades) kan alltså se bilden.
-- SELECT-policyn nedan är därför inskränkt till egen mapp, precis som
-- INSERT/UPDATE/DELETE, för den dagen appen faktiskt behöver lista eller
-- ladda ner egna filer via Storage-API:et.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bokix-uploads', 'bokix-uploads', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Tre DROP:ar för samma sak här — "Publik läsning" var namnet i den allra
-- första versionen av den här sektionen, "Egen läsning av bokix-uploads"
-- dök upp separat i det levande projektet (skapad av något annat än det
-- här scriptet, med annan ordföljd: "av" inte "i"), och "Egen läsning i
-- bokix-uploads" är namnet scriptet själv använder. Utan alla tre kan
-- en omkörning lämna en kvarglömd dubblettpolicy med annat namn men
-- samma effekt kvar i databasen.
DROP POLICY IF EXISTS "Publik läsning av bokix-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Egen läsning av bokix-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Egen läsning i bokix-uploads" ON storage.objects;
CREATE POLICY "Egen läsning i bokix-uploads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Egen uppladdning i bokix-uploads" ON storage.objects;
CREATE POLICY "Egen uppladdning i bokix-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Egen uppdatering i bokix-uploads" ON storage.objects;
CREATE POLICY "Egen uppdatering i bokix-uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
WITH CHECK (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Egen radering i bokix-uploads" ON storage.objects;
CREATE POLICY "Egen radering i bokix-uploads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
