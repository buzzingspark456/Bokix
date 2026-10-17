-- ══════════════════════════════════════════════════════════════════════
-- KOPIA FÖRE STORA BORTTAGNINGAR (2026-10-17)
-- ══════════════════════════════════════════════════════════════════════
-- Nattkopiorna (_archive.js och den externa backupen) skyddar mot förlust,
-- men bara till förra natten. Skulle en bugg eller ett misstag tömma ett
-- konto mitt på dagen försvann det som gjorts sedan dess.
--
-- Den här triggern sparar kontots förra version i user_data_history när en
-- skrivning gör det mycket mindre (under 70 % av storleken) eller raderar
-- raden. Den stoppar ingenting: vanliga borttagningar fungerar som förut,
-- det blir bara en kopia att återställa från. Högst en kopia var femte
-- minut per konto, och kopior äldre än 30 dagar rensas bort.
--
-- Bara service_role (Supabase-panelen, serverkoden) kan läsa tabellen.
-- Raderas användaren raderas kopiorna med (ON DELETE CASCADE).
--
-- Återställa ett konto (Supabase → SQL Editor), välj kopian först:
--   SELECT id, created_at, reason, old_bytes, new_bytes
--   FROM public.user_data_history WHERE user_id = '<uuid>' ORDER BY created_at DESC;
--   UPDATE public.user_data SET state = (SELECT state FROM public.user_data_history WHERE id = <id>)
--   WHERE user_id = '<uuid>';

CREATE TABLE IF NOT EXISTS public.user_data_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state jsonb,
  reason text NOT NULL,
  old_bytes integer,
  new_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_data_history_user_created ON public.user_data_history (user_id, created_at DESC);

-- RLS på utan policyer: ingen inloggad användare kan läsa eller skriva.
ALTER TABLE public.user_data_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_data_history FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.keep_user_data_before_shrink()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Samma mått på båda (text), pg_column_size jämför komprimerat mot okomprimerat.
  v_old integer := coalesce(octet_length(OLD.state::text), 0);
  v_new integer := CASE WHEN TG_OP = 'DELETE' THEN 0 ELSE coalesce(octet_length(NEW.state::text), 0) END;
BEGIN
  -- Små konton (nya, tomma) och skrivningar som inte krymper mycket: inget.
  IF v_old < 20000 OR v_new >= v_old * 0.7 THEN
    RETURN NULL;
  END IF;
  -- Kontot måste finnas kvar i auth.users (annars bryter främmande nyckeln
  -- en radering av användaren).
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN NULL;
  END IF;
  -- Högst en kopia var femte minut per konto, så att en loop inte fyller databasen.
  IF EXISTS (
    SELECT 1 FROM public.user_data_history
    WHERE user_id = OLD.user_id AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_data_history (user_id, state, reason, old_bytes, new_bytes)
  VALUES (OLD.user_id, OLD.state, CASE WHEN TG_OP = 'DELETE' THEN 'raderad' ELSE 'krympte' END, v_old, v_new);

  DELETE FROM public.user_data_history
  WHERE user_id = OLD.user_id AND created_at < now() - interval '30 days';
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.keep_user_data_before_shrink() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS keep_user_data_before_shrink ON public.user_data;
CREATE TRIGGER keep_user_data_before_shrink
AFTER UPDATE OF state OR DELETE ON public.user_data
FOR EACH ROW
EXECUTE FUNCTION private.keep_user_data_before_shrink();
