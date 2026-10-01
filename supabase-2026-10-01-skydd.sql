-- 2026-10-01: delad rate limit och storleksgräns på user_data.
-- Kör hela filen i Supabase → SQL Editor. Går att köra flera gånger.
-- Samma innehåll finns i slutet av supabase-setup.sql.

-- ── Delad rate limit ─────────────────────────────────────────
-- api/_rateLimit.js räknade tidigare bara i minnet på varje serverinstans,
-- så gränserna nollställdes vid varje kallstart och delades inte mellan
-- instanser. Nu räknas varje anrop här, i en tabell alla instanser delar.
-- Tabellen ligger i schemat private (exponeras inte av PostgREST) och
-- funktionen får bara anropas med service-role-nyckeln (servern).
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

-- Ökar räknaren för p_key och svarar true om anropet får fortsätta.
-- Fönstret börjar om när reset_at passerats. Gamla rader städas bort
-- ibland (ungefär vart hundrade anrop) så tabellen inte växer.
CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO private.rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
    reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window_seconds) ELSE r.reset_at END
  RETURNING r.count INTO v_count;

  IF random() < 0.01 THEN
    DELETE FROM private.rate_limits WHERE reset_at < now() - interval '1 day';
  END IF;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) TO service_role;

-- ── Storleksgräns på user_data.state ─────────────────────────
-- Hela bokföringen per konto ligger som ett JSON-värde. Utan gräns kunde
-- ett gratiskonto (UF) fylla databasen med skräp. Största riktiga kontot
-- var 106 kB den 2026-10-01, så 20 MB är gott om plats. NOT VALID: redan
-- sparade rader kontrolleras inte, bara nya skrivningar.
ALTER TABLE public.user_data DROP CONSTRAINT IF EXISTS user_data_state_size;
ALTER TABLE public.user_data
  ADD CONSTRAINT user_data_state_size CHECK (octet_length(state::text) <= 20971520) NOT VALID;
