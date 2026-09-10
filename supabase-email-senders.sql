-- ══════════════════════════════════════════════════════════════════════
-- KÖR DEN HÄR EN GÅNG I SUPABASE → SQL EDITOR
-- ══════════════════════════════════════════════════════════════════════
-- Det här är bara den NYA delen ur supabase-setup.sql, urklippt så att du
-- slipper klistra in 900 rader för en tabell. Kör hela filen rakt av; den
-- tål att köras om (IF NOT EXISTS) och rör ingenting annat i databasen.
--
-- Vad den skapar: raden som håller kundens kopplade avsändaradress —
-- antingen en Google-token (Logga in med Google) eller ett app-lösenord
-- för en annan leverantör. Utan tabellen går kopplingen inte att spara,
-- och Inställningar svarar att tabellen saknas.
--
-- SÄKERHET: `secret` lagras krypterad med EMAIL_SECRET_KEY (AES-256-GCM),
-- aldrig i klartext. RLS slås på UTAN policyer, precis som cron_progress —
-- det betyder att ingen inloggad klient kan läsa eller skriva raden alls,
-- bara serverfunktionerna med service_role-nyckeln. Lägg aldrig till en
-- policy för `authenticated` här: då kan en användare läsa ut sin egen
-- krypterade token, och i förlängningen alla rader som en bugg råkar
-- exponera.

CREATE TABLE IF NOT EXISTS public.email_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id text NOT NULL,          -- nyckel inuti state.companies
  provider text NOT NULL DEFAULT 'custom',  -- 'google' = OAuth, annars SMTP
  from_email text NOT NULL,
  from_name text,
  host text NOT NULL,
  port integer NOT NULL,
  secure boolean NOT NULL DEFAULT true,
  username text NOT NULL,
  secret text NOT NULL,              -- krypterad token eller app-lösenord
  verified_at timestamptz,           -- satt först när inloggningen testats
  last_error text,                   -- varför senaste utskicket föll
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, company_id)       -- en avsändare per företag
);

ALTER TABLE public.email_senders ENABLE ROW LEVEL SECURITY;

-- Kontroll: ska returnera en rad som säger att tabellen finns och att RLS
-- är påslaget.
SELECT tablename, rowsecurity AS rls_pa
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'email_senders';
