# Bokix

Bokix är en webbaserad tjänst för enkel och säker bokföring för svenska företag.

## Utveckling

Projektet använder React, Vite, Supabase för autentisering och datalagring, samt Vercel för produktion.

## Supabase setup

Detta fel betyder att tabellen `public.user_data` saknas i din Supabase-databas.

Kör `supabase-setup.sql` i din Supabase SQL Editor eller via CLI för att skapa tabellen och aktivera RLS.

### SQL Editor
1. Öppna Supabase-projektet.
2. Gå till SQL Editor.
3. Klistra in innehållet i `supabase-setup.sql`.
4. Kör skriptet.

### Supabase CLI
Om du har Supabase CLI installerat kan du köra:

```bash
supabase db query supabase-setup.sql
```

När skriptet har kört ska tabellen `user_data` finnas och appen ska kunna läsa/skapa användardata utan 404.

Om du ser `PGRST205` i felsöket, betyder det fortfarande att tabellen saknas eller att Supabase cache inte uppdaterats.

## Stripe Connect

Det finns en Stripe Connect-integration med serverless endpoints under `api/stripe/`.

Konfiguration i Vercel/produktionen:

- `STRIPE_SECRET_KEY` (ska vara din hemliga Stripe-nyckel, börjar med `sk_`)
- `STRIPE_ONBOARDING_RETURN_URL` (t.ex. `https://din-app.vercel.app`)
- `STRIPE_ONBOARDING_REFRESH_URL` (t.ex. `https://din-app.vercel.app`)
- `STRIPE_SUCCESS_URL` (t.ex. `https://din-app.vercel.app/success`)
- `STRIPE_CANCEL_URL` (t.ex. `https://din-app.vercel.app/cancel`)
- `STRIPE_WEBHOOK_SECRET` (Stripe webhook secret)
- `VITE_STRIPE_PLATFORM_FEE_PERCENT` (en frontendkonfig för plattformsavgift, t.ex. `5`)

Observera: `pk_`-nyckeln är publicerbar och fungerar inte på servern. Använd `sk_`-nyckeln i Vercel/`.env`.

Lokal utveckling i `.env`:

```env
VITE_SUPABASE_URL=https://egfsovtwjzmlvggzpizb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_ONBOARDING_RETURN_URL=http://localhost:5173
STRIPE_ONBOARDING_REFRESH_URL=http://localhost:5173
STRIPE_SUCCESS_URL=http://localhost:5173
STRIPE_CANCEL_URL=http://localhost:5173
VITE_STRIPE_PLATFORM_FEE_PERCENT=5
```

Efter att ha lagt till dessa variabler i `.env` kör du:

```bash
npm install
npm run dev
```

## Supabase Row Level Security (RLS)

För att säkerställa full RLS på Supabase måste tabellen `user_data` ha RLS aktiverat och följande policyer:

1. Aktivera RLS för tabellen `user_data`.
2. Skapa en policy som tillåter åtkomst endast om raden tillhör den inloggade användaren:

```sql
-- Allow selects for signed-in users only on their own rows
CREATE POLICY "Select own user data"
ON public.user_data
FOR SELECT
USING (auth.uid() = user_id);

-- Allow inserts by signed-in users with matching user_id
CREATE POLICY "Insert own user data"
ON public.user_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow updates to own rows only
CREATE POLICY "Update own user data"
ON public.user_data
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow deletes of own rows only
CREATE POLICY "Delete own user data"
ON public.user_data
FOR DELETE
USING (auth.uid() = user_id);
```

3. Se till att frontenden alltid använder `supabase.auth.getSession()` och filtrerar på `user_id` när data läses eller skrivs.

> Notera: `STRIPE_SECRET_KEY` används endast på servern. Använd `VITE_SUPABASE_ANON_KEY` i frontend, men låt Supabase hantera säkerheten via RLS och policies.
