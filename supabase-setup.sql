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
-- En bucket för de bilder användare laddar upp under Inställningar
-- (profilbild i "Min profil", logotyp i "Företag"). Publik läsning så att
-- bilderna kan visas direkt i <img>-taggar och på fakturor utan signerade
-- URL:er — precis som avatar_url/logoUrl redan lagras som vanliga
-- textfält i övrigt. Skrivning/radering är begränsad till ägaren: varje
-- fils sökväg måste börja med den inloggade användarens auth.uid() som
-- första mapp-segment (t.ex. "<uid>/avatar.png"), så en användare kan
-- aldrig skriva över en annan användares filer.
INSERT INTO storage.buckets (id, name, public)
VALUES ('bokix-uploads', 'bokix-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Publik läsning av bokix-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'bokix-uploads');

CREATE POLICY "Egen uppladdning i bokix-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Egen uppdatering i bokix-uploads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Egen radering i bokix-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
