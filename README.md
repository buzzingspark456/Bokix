# Bokix

Bokix är en webbaserad tjänst för enkel och säker bokföring för svenska företag.

## Utveckling

Projektet använder React, Vite, Supabase för autentisering och datalagring, samt Vercel för produktion.

## Stripe Connect

Det finns en Stripe Connect-integration med serverless endpoints under `api/stripe/`.

Konfiguration:

- `STRIPE_SECRET_KEY` (ska vara din hemliga Stripe-nyckel, börjar med `sk_`)
- `STRIPE_ONBOARDING_RETURN_URL`
- `STRIPE_ONBOARDING_REFRESH_URL`
- `STRIPE_PLATFORM_URL`
- `STRIPE_PLATFORM_FEE_PERCENT`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `STRIPE_WEBHOOK_SECRET`

Observera: `pk_`-nyckeln är publicerbar och fungerar inte på servern. Använd `sk_`-nyckeln i `.env`.

Exempel:

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_ONBOARDING_RETURN_URL=http://localhost:5173
STRIPE_ONBOARDING_REFRESH_URL=http://localhost:5173
STRIPE_SUCCESS_URL=http://localhost:5173
STRIPE_CANCEL_URL=http://localhost:5173
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
