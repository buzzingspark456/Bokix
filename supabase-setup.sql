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
-- Supabase säkerhetslinter ("Function Search Path Mutable"): utan ett
-- fastnaglat search_path kan en användare med skrivrätt i något schema som
-- ligger tidigare i sessionens search_path skapa en egen funktion/typ med
-- samma namn som något funktionen råkar referera oskalifierat, och på så
-- sätt kapa vad funktionen faktiskt kör (relevant för SECURITY DEFINER-
-- funktioner, men Supabase flaggar det på alla funktioner som god praxis).
-- SET search_path = '' tvingar alla referenser att vara fullt kvalificerade
-- — ofarligt här, now() är inbyggt (pg_catalog söks alltid implicit, även
-- med tomt search_path).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

DROP TRIGGER IF EXISTS set_updated_at ON public.user_data;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.user_data
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Policy: select only own rows
-- (select auth.uid()) istället för bara auth.uid() i samtliga policyer
-- nedan (Supabase prestandalinter, "Auth RLS Initialization Plan"): som
-- ett skalärt underuttryck utvärderar Postgres det EN gång per fråga,
-- inte en gång per rad som annars — ren prestandaoptimering, exakt samma
-- åtkomstlogik.
CREATE POLICY "Select own user data"
ON public.user_data
FOR SELECT
USING ((select auth.uid()) = user_id);

-- Policy: insert only own rows
CREATE POLICY "Insert own user data"
ON public.user_data
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- Policy: update only own rows
CREATE POLICY "Update own user data"
ON public.user_data
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Policy: delete only own rows
CREATE POLICY "Delete own user data"
ON public.user_data
FOR DELETE
USING ((select auth.uid()) = user_id);

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

-- Bank-integrationen (Enable Banking) är borttagen ur appen igen — om den
-- här filen redan kördes mot din databas medan den fanns, städar detta bort
-- kvarlämningen (no-op annars, IF EXISTS gör det säkert att köra oavsett).
DROP FUNCTION IF EXISTS public.set_company_bank_connection(uuid, text, text, text, text);

-- ═══════════════════════════════════════════════════════════
-- Stripe-betalningshändelser: pålitlig logg + klient-avstämning
-- ═══════════════════════════════════════════════════════════
-- Bugkritiskt (varför den här tabellen finns alls): app.jsx sparar HELA
-- state-blobben i user_data.state med en enkel upsert (saveUserDataToSupabase)
-- — sist skrivna vinner, ingen delvis/atomär uppdatering. Om Stripes webhook
-- (api/stripe/webhook.js, server.js) skrev "betald" direkt in i den blobben
-- skulle klientens NÄSTA debounce-save (2000 ms efter vilken ändring som
-- helst, med sitt egna, äldre state i minnet) kunna skriva över det igen —
-- och då finns INGEN kvarvarande post om att en riktig betalning faktiskt
-- kommit in. För bokföring är "tyst tappad betalningshändelse" mycket värre
-- än "en stund innan fakturan visas som betald i UI:t".
--
-- Lösningen: webhooken skriver bara en HÅLLBAR, aldrig-skriv-över-bar logg-
-- rad här (service-role, en rad per Stripe-event-id — idempotent mot Stripes
-- "minst en gång"-leverans). Klienten (App.jsx) läser sedan av sina egna
-- oapplicerade händelser vid inloggning/sidladdning och applicerar dem genom
-- den VANLIGA klient-sidans betalningsflödet (handleRegisterInvoicePayment)
-- — som då blir en del av klientens eget state INNAN nästa debounce-save,
-- så den aldrig kan skrivas över. applied_at sätts av klienten själv efteråt
-- (vanlig RLS-skyddad UPDATE, inget service-role krävs för det steget).
CREATE TABLE IF NOT EXISTS public.stripe_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  company_id text NOT NULL,
  invoice_id text NOT NULL,
  amount_total numeric,
  currency text,
  paid_at timestamptz NOT NULL,
  applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.stripe_payment_events ENABLE ROW LEVEL SECURITY;

-- Bara service_role (webhooken) skriver nya rader — se INSERT-avsaknaden
-- för authenticated/anon nedan, ingen policy = ingen åtkomst.
CREATE POLICY "Select own payment events"
ON public.stripe_payment_events
FOR SELECT
USING ((select auth.uid()) = user_id);

-- Enda skrivåtkomsten en inloggad användare har: kvittera sin egen
-- redan-tillämpade händelse (sätta applied_at). Kan inte skapa nya rader
-- (RLS INSERT saknas helt för authenticated/anon) eller ändra andra fält
-- eftersom WITH CHECK kräver att user_id fortfarande är densamma.
CREATE POLICY "Apply own payment events"
ON public.stripe_payment_events
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- ═══════════════════════════════════════════════════════════
-- Prenumerationer: Bokix egen plan (99 kr/mån, 30 dagars gratis provperiod)
-- ═══════════════════════════════════════════════════════════
-- Samma resonemang som stripe_payment_events ovan — "är den här användaren
-- betalande" är exakt den sortens data som ALDRIG får tappas bort av
-- app.jsx:s debounce-save (state-blobben, sist skrivna vinner). En egen
-- tabell, en rad per användare, skriven enbart av webhooken (service-role)
-- utifrån Stripes egna prenumerationshändelser — aldrig av klienten.
--
-- En rad per user_id (UNIQUE), inte per company_id: priset är ett enda
-- konto-pris ("Ett pris. Allt ingår.", se PricingPage.jsx), inte per
-- företag som en användare har kopplat i user_data.state.companies.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  -- Stripes egna Subscription-statusar rakt av: trialing, active, past_due,
  -- canceled, unpaid, incomplete, incomplete_expired — ingen egen tolkning
  -- eller omkodning i databasen, bara i UI vid behov.
  status text NOT NULL,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.subscriptions;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Läsning: bara sin egen rad. Ingen INSERT/UPDATE/DELETE-policy för
-- authenticated/anon alls — precis som stripe_payment_events kan bara
-- webhooken (service-role, kringgår RLS) skriva hit.
CREATE POLICY "Select own subscription"
ON public.subscriptions
FOR SELECT
USING ((select auth.uid()) = user_id);

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
-- Supabase säkerhetslinter ("Public Bucket Allows Listing"): den här
-- policyn gav SELECT på storage.objects för bucket_id='profile' till ALLA
-- roller (ingen TO-klausul) — vilket inte bara tillåter att LÄSA en känd
-- bildfil, det tillåter att LISTA/bläddra i hela bucketens filnamn
-- (t.ex. `select * from storage.objects where bucket_id='profile'` via
-- PostgREST), och därmed skörda varenda registrerad användares uid ur
-- filsökvägarna "<uid>/avatar.png". Onödig dessutom: en PUBLIC bucket
-- (public:true ovan) serverar redan enskilda filer via
-- /storage/v1/object/public/... helt UTAN att RLS på storage.objects
-- konsulteras alls — <img src={getPublicUrl}> (Settings.jsx) slutar
-- alltså inte fungera av att policyn tas bort. Exakt samma resonemang som
-- redan är nedskrivet för bokix-uploads-bucketen längre ner i den här
-- filen (skriven innan denna kommentar, tillämpades bara aldrig
-- retroaktivt på profile/companylogo).
DROP POLICY IF EXISTS "Publik läsning av profile" ON storage.objects;

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

-- Samma fix/resonemang som "Publik läsning av profile" ovan.
DROP POLICY IF EXISTS "Publik läsning av companylogo" ON storage.objects;

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

-- ═══════════════════════════════════════════════════════════
-- Supabase säkerhetslinter: public.rls_auto_enable()
-- ═══════════════════════════════════════════════════════════
-- Den här funktionen finns i den LEVANDE databasen (linterns rapport
-- flaggade den som SECURITY DEFINER, körbar av både anon och
-- authenticated via /rest/v1/rpc/rls_auto_enable) men skapas INGENSTANS
-- i den här filen — den kommer alltså inte från Bokix egen kodbas. Troligt
-- ursprung: en engångshjälpfunktion Supabase Studios eget säkerhetsråd
-- ("Auto fix"-knappen på RLS-varningar) kan installera i projektet.
--
-- Eftersom den inte är vår egen kod GÖR den här filen INGET åt dess
-- definition (vet inte vad den faktiskt utför, och att gissa en ny
-- CREATE OR REPLACE hade kunnat skriva över en Supabase-intern funktion
-- på ett sätt som stör deras egen tooling). Det säkra, minimala steget
-- nedan tar bara bort den publika körrätten — om appen aldrig anropar
-- rls_auto_enable() (den gör inte det, ingen sådan RPC finns i src/eller
-- api/), är det ofarligt: DO-blocket är villkorat på att funktionen
-- faktiskt finns, så det är ofarligt att köra även om den redan är borttagen
-- eller aldrig fanns i första taget.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
