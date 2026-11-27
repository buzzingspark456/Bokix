-- ═══════════════════════════════════════════════════════════════════════
-- Misslyckad betalning: banner, läsläge och lås (2026-11-27).
-- Kör HELA filen i Supabase → SQL Editor. Säker att köra flera gånger.
-- Måste köras INNAN koden pushas (webhooken skriver de nya kolumnerna;
-- koden klarar sig utan dem men läsläget gäller då inte i databasen).
--
-- Regeln (samma som src/utils/paymentAccess.js och api/_auth.js):
--   trialing/active                         -> får skriva
--   past_due, de första 14 dagarna          -> får skriva (banner i appen)
--   past_due/unpaid/avslutad efter 14 dagar -> läsläge: läsa ja, skriva nej
--   efter 30 dagar                          -> betalsidan i appen
-- Läsrätten tas aldrig bort: ägaren ska alltid kunna läsa sin bokföring.
-- ═══════════════════════════════════════════════════════════════════════

-- När den första dragningen misslyckades (nollas när betalningen går igenom).
-- Bara webhooken (service role) skriver den: kunden kan inte flytta fram den.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz;
-- Senast skickade påminnelse (api/_dunning.js), så att inget mejl skickas två gånger.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_reminder_stage integer NOT NULL DEFAULT 0;
-- Kortets utgångsmånad som påminnelsen "kortet går ut snart" redan skickats för (ÅÅÅÅ-MM).
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS card_expiry_reminded_for text;
-- Nattjobbet letar efter abonnemang med misslyckad betalning; bara de raderna indexeras.
CREATE INDEX IF NOT EXISTS subscriptions_payment_failed_idx ON public.subscriptions (payment_failed_at) WHERE payment_failed_at IS NOT NULL;

-- Skrivrätten: past_due räknas bara de första 14 dagarna. Allt annat oförändrat
-- (gratiskonton, UF-period från kontots skapande, app_metadata).
CREATE OR REPLACE FUNCTION public.has_paid_access(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = target_user_id
        AND (
          lower(coalesce(u.email, '')) IN ('alwakiabdullah1@gmail.com', 'abbealwaki08@gmail.com')
          OR (
            (u.raw_app_meta_data ->> 'uf') = 'true'
            AND u.created_at + interval '3 months' > now()
            AND (u.raw_app_meta_data ->> 'uf_closed_at') IS NULL
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = target_user_id
        AND (
          s.status IN ('trialing', 'active')
          OR (
            s.status = 'past_due'
            AND (s.payment_failed_at IS NULL OR s.payment_failed_at > now() - interval '14 days')
          )
        )
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.has_paid_access(uuid) FROM PUBLIC, anon, authenticated;

-- Kunden får läsa sin egen rad (för bannern), aldrig skriva den. Kontroll:
-- inga INSERT/UPDATE/DELETE-policyer för authenticated på subscriptions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND ('authenticated' = ANY (roles) OR 'public' = ANY (roles))
  ) THEN
    RAISE WARNING 'subscriptions har en skrivpolicy för vanliga användare – ta bort den, annars kan en kund ändra sin egen status.';
  END IF;
END $$;
