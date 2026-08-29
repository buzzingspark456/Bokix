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
DROP POLICY IF EXISTS "Select own user data" ON public.user_data;
CREATE POLICY "Select own user data"
ON public.user_data
FOR SELECT
USING ((select auth.uid()) = user_id);

-- Policy: insert only own rows
DROP POLICY IF EXISTS "Insert own user data" ON public.user_data;
CREATE POLICY "Insert own user data"
ON public.user_data
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- Policy: update only own rows
DROP POLICY IF EXISTS "Update own user data" ON public.user_data;
CREATE POLICY "Update own user data"
ON public.user_data
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Policy: delete only own rows
DROP POLICY IF EXISTS "Delete own user data" ON public.user_data;
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

-- FROM PUBLIC, anon, authenticated — inte bara PUBLIC (säkerhetsgranskningen,
-- linterfynd "Public/Signed-In Users Can Execute SECURITY DEFINER Function"
-- på set_company_field nedan, samma bugg gällde tyst här också). Supabase-
-- projekt ger by default EXECUTE på nya funktioner i public-schemat direkt
-- till anon/authenticated (ALTER DEFAULT PRIVILEGES), inte bara via PUBLIC-
-- pseudorollen — REVOKE ... FROM PUBLIC ensam rör alltså ALDRIG de separata
-- grantsen till anon/authenticated, de måste återkallas explicit. Samma
-- mönster som redan användes längre ner i den här filen för
-- rls_auto_enable() (REVOKE ... FROM PUBLIC, anon, authenticated), bara
-- inte tillämpat konsekvent här förrän nu.
REVOKE ALL ON FUNCTION public.set_company_stripe_account(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_stripe_account(uuid, text, text) TO service_role;

-- Samma SECURITY DEFINER-mönster som set_company_stripe_account ovan, för
-- Zettles OAuth-tokens (api/zettle/callback.js) — den callbacken körs
-- precis som Stripes helt utan inloggad session, bara service-role kan
-- skriva. Tre fält i EN funktion (istället för tre anrop av
-- set_company_field, som ändå inte får skriva stripeAccountId-liknande
-- känsliga fält, se whitelisten där) så att access/refresh-token och
-- utgångstid alltid sparas tillsammans, atomärt.
CREATE OR REPLACE FUNCTION public.set_company_zettle_tokens(
  p_user_id uuid,
  p_company_id text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_data
  SET state = jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(state, '{}'::jsonb),
        ARRAY['companies', p_company_id, 'company', 'zettleAccessToken'],
        to_jsonb(p_access_token),
        true
      ),
      ARRAY['companies', p_company_id, 'company', 'zettleRefreshToken'],
      to_jsonb(p_refresh_token),
      true
    ),
    ARRAY['companies', p_company_id, 'company', 'zettleTokenExpiresAt'],
    to_jsonb(p_expires_at),
    true
  )
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_zettle_tokens(uuid, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_zettle_tokens(uuid, text, text, text, timestamptz) TO service_role;

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

-- Prestandaindex (kostnadsgranskning, samma resonemang som company_members
-- ovan): user_id filtrerar BÅDE App.jsx:s direkta fråga (.eq('user_id',
-- user.id).eq('company_id', ...).is('applied_at', null), en gång per
-- aktivt företag) OCH RLS-policyn nedan ((select auth.uid()) = user_id) —
-- den senare körs implicit på VARJE fråga mot tabellen, oavsett vem som
-- frågar. Utan index sekventiell genomsökning i båda fallen.
CREATE INDEX IF NOT EXISTS stripe_payment_events_user_id_idx
ON public.stripe_payment_events (user_id);

ALTER TABLE public.stripe_payment_events ENABLE ROW LEVEL SECURITY;

-- Bara service_role (webhooken) skriver nya rader — se INSERT-avsaknaden
-- för authenticated/anon nedan, ingen policy = ingen åtkomst.
DROP POLICY IF EXISTS "Select own payment events" ON public.stripe_payment_events;
CREATE POLICY "Select own payment events"
ON public.stripe_payment_events
FOR SELECT
USING ((select auth.uid()) = user_id);

-- Enda skrivåtkomsten en inloggad användare har: kvittera sin egen
-- redan-tillämpade händelse (sätta applied_at). Kan inte skapa nya rader
-- (RLS INSERT saknas helt för authenticated/anon) eller ändra andra fält
-- eftersom WITH CHECK kräver att user_id fortfarande är densamma.
DROP POLICY IF EXISTS "Apply own payment events" ON public.stripe_payment_events;
CREATE POLICY "Apply own payment events"
ON public.stripe_payment_events
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- ═══════════════════════════════════════════════════════════
-- Stripe-bokföringsunderlag: betalningar, utbetalningar och avgifter från
-- kundens ANSLUTNA Stripe-konto (till skillnad från stripe_payment_events
-- ovan, som bara loggar BOKIX EGNA fakturabetalningar)
-- ═══════════════════════════════════════════════════════════
-- Samma "aldrig skriv rakt in i user_data.state"-resonemang som
-- stripe_payment_events/subscriptions ovan: cronen (api/cron/reminders.js)
-- läser kundens ANSLUTNA kontos Balance Transactions (Stripe Connect,
-- destination-charges — se create-checkout-session.js) och loggar dem HÄR,
-- service-role, en rad per Stripe balance-transaction-id (idempotent mot
-- Stripes "minst en gång"-semantik/omkörning). Klienten (ReviewQueue.jsx)
-- läser sedan sina egna ogranskade rader och föreslår en bokföring genom
-- den VANLIGA klient-sidans verifikationsflödet, precis som
-- stripe_payment_events redan gör för fakturabetalningar — aldrig
-- auto-bokfört rakt av, alltid granskat av användaren först.
--
-- VIKTIGT om vad "avgift" betyder här: Bokix använder Stripe Connect med
-- destination-charges (transfer_data.destination + application_fee_amount,
-- se create-checkout-session.js) — själva korttransaktionen och Stripes
-- egen korttjänstavgift sker på BOKIX PLATTFORMSKONTO, inte på kundens
-- anslutna konto. Vad som landar på KUNDENS konto är en TRANSFER (typ
-- 'transfer'), redan netto Stripes avgift OCH Bokix egen plattformsavgift.
-- Den plattformsavgiften är däremot en riktig, hittills obokförd kostnad
-- för kunden — mellanskillnaden mellan vad fakturan bokfördes till
-- (1930/1510 vid betalning, se handleRegisterInvoicePayment i App.jsx) och
-- vad som faktiskt landade i Stripe-saldot beräknas av cronen (bästa-
-- försök-matchning mot stripe_payment_events inom ett litet tidsfönster,
-- inte en garanterad metadata-koppling) och sparas i platform_fee_amount.
CREATE TABLE IF NOT EXISTS public.stripe_ledger_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id text NOT NULL,
  stripe_account_id text NOT NULL,
  stripe_balance_transaction_id text NOT NULL UNIQUE,
  -- Stripes egna balance-transaction-typer rakt av: transfer, payout,
  -- charge, payment, refund, adjustment, stripe_fee m.fl. — ingen egen
  -- omkodning i databasen, bara i UI vid behov (samma princip som
  -- subscriptions.status ovan).
  type text NOT NULL,
  amount numeric NOT NULL,
  fee numeric NOT NULL DEFAULT 0,
  currency text NOT NULL,
  description text,
  source_id text,
  created_at_stripe timestamptz NOT NULL,
  matched_invoice_id text,
  platform_fee_amount numeric,
  reviewed_at timestamptz,
  verification_id text,
  created_at timestamptz DEFAULT now()
);

-- Prestandaindex: ReviewQueue.jsx frågar alltid "mina ogranskade rader för
-- det här företaget" — utan index en sekventiell genomsökning av hela
-- tabellen för varje sidladdning, likadant resonemang som övriga
-- prestandaindex i den här filen.
CREATE INDEX IF NOT EXISTS stripe_ledger_events_company_pending_idx
ON public.stripe_ledger_events (company_id)
WHERE reviewed_at IS NULL;

ALTER TABLE public.stripe_ledger_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select own stripe ledger events" ON public.stripe_ledger_events;
CREATE POLICY "Select own stripe ledger events"
ON public.stripe_ledger_events
FOR SELECT
USING ((select auth.uid()) = user_id);

-- Enda skrivåtkomsten en inloggad användare har: kvittera sin egen post
-- (reviewed_at/verification_id) efter att ha granskat/bokfört den i
-- ReviewQueue.jsx — samma mönster som "Apply own payment events" ovan.
-- Kan inte skapa nya rader (ingen INSERT-policy) eller ändra belopp/typ.
DROP POLICY IF EXISTS "Apply own stripe ledger events" ON public.stripe_ledger_events;
CREATE POLICY "Apply own stripe ledger events"
ON public.stripe_ledger_events
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

-- Dedup-markör för trial-slut-påminnelsen (api/cron/reminders.js) — utan
-- den skulle ett "<=" (robust mot ett missat cron-pass, samma resonemang
-- som moms-/AGI-påminnelserna i samma fil) skicka om mejlet varje dag fram
-- till att provperioden faktiskt tar slut, inte bara en gång.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz;

DROP TRIGGER IF EXISTS set_updated_at ON public.subscriptions;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Läsning: bara sin egen rad. Ingen INSERT/UPDATE/DELETE-policy för
-- authenticated/anon alls — precis som stripe_payment_events kan bara
-- webhooken (service-role, kringgår RLS) skriva hit.
DROP POLICY IF EXISTS "Select own subscription" ON public.subscriptions;
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
-- company_members: dela ett företag med upp till 2 extra inloggningar
-- (ägare + max 2 inbjudna = max 3 användare per företag)
-- ═══════════════════════════════════════════════════════════
-- Ägarens rad i user_data (hela state-blobben) rörs INTE av detta — en
-- inbjuden användare får ALDRIG direkt Supabase-åtkomst till ägarens rad
-- (RLS ovan tillåter fortfarande bara auth.uid() = user_id där). Den här
-- tabellen är enbart ett medlemskaps-/behörighetsregister. All faktisk
-- läsning/skrivning av ägarens data ÅT en inbjuden användare sker uteslutande
-- via api/company-access.js (service-role-nyckeln), som slår upp medlemskap
-- här FÖRST och bara därefter läser/skriver in i user_data — precis samma
-- indirekta mönster som set_company_stripe_account ovan redan använder för
-- Stripes callback, fast nu för en mänsklig andraanvändare istället för en
-- webhook. Se App.jsx (fetchUserData/persistCompanyField) för klientsidan.
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,        -- vems user_data-rad blobben ligger i
  company_id text NOT NULL,           -- nyckel inuti state.companies
  invited_email text NOT NULL,
  member_user_id uuid,                -- sätts först när inbjudan löses in
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Samma person kan inte bjudas in två gånger till samma företag SAMTIDIGT
-- (en ny rad per omdirigering skulle annars smyga förbi 2-gränsen ovan) —
-- men en 'revoked' rad ska INTE blockera en framtida återinbjudan, så det
-- här är ett partiellt unikt index (bara pending/active), inte en vanlig
-- UNIQUE-constraint på hela tabellen. Utan WHERE-villkoret skulle en ägare
-- som återkallar en medlem aldrig kunna bjuda in samma e-post igen —
-- INSERT hade träffat unique-violation för alltid, trots att UI:t (Settings
-- atCap-logiken) räknar en revoked rad som en ledig plats.
--
-- Om ett tidigare utkast av den här filen (med UNIQUE(...) som en vanlig
-- kolumn-constraint i CREATE TABLE ovan istället för det partiella indexet
-- nedan) redan kördes mot en levande databas skapade Postgres automatiskt
-- en constraint med namnet nedan — CREATE TABLE IF NOT EXISTS är då en
-- no-op och den gamla, striktare constrainten hade blivit kvar parallellt
-- med det nya indexet och fortsatt blockera återinbjudan. Ofarligt att
-- köra även om den aldrig fanns (IF EXISTS).
ALTER TABLE public.company_members DROP CONSTRAINT IF EXISTS company_members_owner_user_id_company_id_invited_email_key;
DROP INDEX IF EXISTS company_members_active_invite_unique;
CREATE UNIQUE INDEX company_members_active_invite_unique
ON public.company_members (owner_user_id, company_id, invited_email)
WHERE status IN ('pending', 'active');

-- Prestandaindex, inte constraints (kostnadsgranskning): utan dessa var
-- company_members tabellen helt oindexerad förutom det partiella unikindexet
-- ovan (som inte täcker någon av sökningarna nedan). Två frågemönster som
-- körs OFTA — inte bara vid inbjudan — träffade en sekventiell genomsökning
-- av HELA tabellen, ofarligt idag med en handfull rader men linjärt värre
-- för varje inbjudan som någonsin skickats (ingenting städar bort gamla
-- revoked/expired rader):
--   1) loadMemberCompany (api/_auth.js) — VARJE läsning/skrivning en
--      inbjuden användare gör av ett delat företag, .eq('member_user_id',
--      ...).eq('status','active') (+ .eq('company_id', ...), täcks ändå av
--      samma index eftersom member_user_id+status redan smalnar av till en
--      handfull rader per användare).
--   2) App.jsx (fetchUserData) — samma .eq('member_user_id', ...).eq(
--      'status','active') EN gång per inloggning/sessionskontroll, för att
--      lista vilka delade företag jag har åtkomst till.
CREATE INDEX IF NOT EXISTS company_members_member_user_id_status_idx
ON public.company_members (member_user_id, status);

-- Invite-inlösen (App.jsx: InviteRedeem-flödet) slår upp raden via bara
-- token — utan index samma sekventiella genomsökning som ovan.
CREATE INDEX IF NOT EXISTS company_members_invite_token_idx
ON public.company_members (invite_token);

DROP TRIGGER IF EXISTS set_updated_at ON public.company_members;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- SELECT: ägaren ser alla sina inbjudningar (oavsett status). Den inbjudna
-- ser sin egen rad — dels via e-postmatchning MOT DEN INLOGGADES JWT (så en
-- inbjudan syns redan innan den är inlöst, t.ex. i en "Du är inbjuden"-vy),
-- dels via member_user_id efter inlösen. `lower()` på båda sidor så en
-- inbjudan skapad med annan skiftläge (t.ex. Namn@Firma.se) ändå matchar.
DROP POLICY IF EXISTS "Se egna medlemskapsrader" ON public.company_members;
CREATE POLICY "Se egna medlemskapsrader"
ON public.company_members FOR SELECT TO authenticated
USING (
  (select auth.uid()) = owner_user_id
  OR (select auth.uid()) = member_user_id
  OR lower(invited_email) = lower((select auth.jwt() ->> 'email'))
);

-- INSERT: bara ägaren kan skapa en inbjudan, bara till sig själv som
-- owner_user_id, och bara om företaget redan har färre än 2
-- aktiva/väntande inbjudningar (= "max 3 användare" hårdkodat i databasen,
-- inte bara i UI:t). Kollar INTE att company_id faktiskt finns i ägarens
-- egen state.companies — det vore dyrt att uttrycka i en RLS-policy och
-- är ofarligt att hoppa över här: värsta fallet är en övergiven rad som
-- aldrig kan lösas in (api/company-access.js verifierar äkta ägarskap på
-- riktigt, se loadMemberCompany, innan någon data någonsin lämnas ut).
-- Race-notis: två samtidiga inbjudningar i exakt samma ögonblick skulle
-- teoretiskt kunna klara <2-kollen båda två (klassisk TOCTOU) — accepterat
-- här, en ägare som klickar "bjud in" två gånger på millisekunden är inget
-- verkligt hot, och värsta utfallet är en tredje rad, inte en säkerhetslucka.
DROP POLICY IF EXISTS "Ägare skapar inbjudan" ON public.company_members;
CREATE POLICY "Ägare skapar inbjudan"
ON public.company_members FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = (select auth.uid())
  AND (
    SELECT count(*) FROM public.company_members cm
    WHERE cm.owner_user_id = (select auth.uid())
      AND cm.company_id = company_members.company_id
      AND cm.status IN ('pending', 'active')
  ) < 2
);

-- UPDATE: två helt olika användare av samma policy.
--  (a) Ägaren får ändra vad som helst på sina egna rader (byta roll,
--      återkalla via status='revoked').
--  (b) Den inbjudna får bara röra sin EGEN väntande, icke-utgångna rad, och
--      WITH CHECK tvingar resultatet av den uppdateringen till EXAKT
--      { member_user_id = mitt eget uid, status = 'active' } — dvs. en
--      inbjuden person kan bara "lösa in" inbjudan, aldrig sätta sig själv
--      till 'editor' eller återaktivera en redan återkallad rad.
-- Ingen DELETE-policy: återkallelse är en statusändring, inte en radering
-- — lämnar ett revisionsspår istället för att tysta ta bort historiken.
DROP POLICY IF EXISTS "Hantera eller lös in medlemskap" ON public.company_members;
CREATE POLICY "Hantera eller lös in medlemskap"
ON public.company_members FOR UPDATE TO authenticated
USING (
  owner_user_id = (select auth.uid())
  OR (
    lower(invited_email) = lower((select auth.jwt() ->> 'email'))
    AND status = 'pending'
    AND expires_at > now()
  )
)
WITH CHECK (
  owner_user_id = (select auth.uid())
  OR (
    lower(invited_email) = lower((select auth.jwt() ->> 'email'))
    AND member_user_id = (select auth.uid())
    AND status = 'active'
    -- role måste vara oförändrad — utan detta kollar WITH CHECK bara de tre
    -- fälten ovan, så en inbjuden 'viewer' kunde annars skicka med role:
    -- 'editor' i samma UPDATE och lösa in sig själv med skrivrätt de aldrig
    -- blivit beviljade. Jämför mot raden som redan ligger lagrad (self-join
    -- på primärnyckeln) istället för att lita på vad klienten skickar.
    AND role = (SELECT cm.role FROM public.company_members cm WHERE cm.id = company_members.id)
  )
);

-- set_company_field: samma SECURITY DEFINER-mönster som
-- set_company_stripe_account ovan, men generell över VILKET fält som
-- skrivs — används av api/company-access.js (en inbjuden editor sparar en
-- ändring i ägarens blob) OCH av den kommande automatiska påminnelse-cronen
-- (markerar en faktura/momsperiod som "påminnelse skickad"). Skriver bara
-- ETT namngivet fält under companies.<id> istället för klientens vanliga
-- helblobs-upsert (saveUserDataToSupabase) — minskar blast radius från
-- "hela användarens alla företag" till "ett fält på ett företag", men
-- eliminerar INTE kapplöpningen mot en samtidig helblobs-sparning från
-- ägarens egen webbläsare (se App.jsx: persistCompanyField läser om det
-- delade företagets gren precis innan varje debounce-sparning, just för
-- att undvika att den här skrivningen tyst skrivs över några sekunder
-- senare).
--
-- p_field är en vitlista, inte fritext — annars hade vem som helst med
-- körrätt kunnat skriva in i t.ex. companies.<id>.company.stripeAccountId
-- via den här funktionen och kringgå set_company_stripe_account helt.
--
-- create_missing = FALSE (till skillnad från set_company_stripe_account):
-- hittar jsonb_set ingen befintlig companies.<id>-gren blir anropet en
-- no-op istället för att hitta på en ny, halvfärdig företagsstruktur —
-- en trasig/saknad gren ska upptäckas, inte tystas.
CREATE OR REPLACE FUNCTION public.set_company_field(
  p_user_id uuid,
  p_company_id text,
  p_field text,
  p_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field NOT IN (
    'accounts', 'verifications', 'invoices', 'quotes', 'expenses', 'contacts',
    'articles', 'projects', 'timeEntries', 'timeReportStatuses',
    'billableTimeEntries', 'recurringTemplates', 'verificationTemplates',
    'vatPeriods', 'reviewHistory', 'employees', 'payrollRuns', 'company'
  ) THEN
    RAISE EXCEPTION 'Ogiltigt fält för set_company_field: %', p_field;
  END IF;

  UPDATE public.user_data
  SET state = jsonb_set(
    coalesce(state, '{}'::jsonb),
    ARRAY['companies', p_company_id, p_field],
    p_value,
    false
  )
  WHERE user_id = p_user_id
    AND state #> ARRAY['companies', p_company_id] IS NOT NULL;
END;
$$;

-- FROM PUBLIC, anon, authenticated — se kommentaren vid
-- set_company_stripe_account-grantsen ovan för varför bara "FROM PUBLIC"
-- INTE stänger anon/authenticateds egna, separata default-privilegier.
-- Säkerhetsgranskningens faktiska fynd (Supabase-lintern flaggade just
-- den här funktionen, körbar av både anon och authenticated via
-- /rest/v1/rpc/set_company_field) — den avsedda åtkomstkontrollen sitter
-- i api/company-access.js (loadMemberCompany, roll-kollen) och i
-- api/cron/reminders.js (CRON_SECRET), INTE i databasen; funktionen ska
-- alltså aldrig vara anropsbar direkt av en inloggad klient.
REVOKE ALL ON FUNCTION public.set_company_field(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_field(uuid, text, text, jsonb) TO service_role;

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
