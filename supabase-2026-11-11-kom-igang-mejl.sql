-- Kom igång-mejlen (api/cron/_onboardingEmails.js): en rad per konto och steg,
-- så att samma mejl aldrig skickas två gånger. Raden läggs in INNAN mejlet
-- skickas (reservation) och får sent_at när Resend tagit emot det.
-- Bara servern (service_role) läser och skriver: RLS på, inga policyer.
-- Körs i Supabase SQL Editor (Stockholm) före första utskicket. Går att köra om.

CREATE TABLE IF NOT EXISTS public.onboarding_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step)
);

ALTER TABLE public.onboarding_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_emails FROM anon, authenticated;
