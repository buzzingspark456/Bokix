-- UF-flaggan som ger gratis åtkomst flyttas till app_metadata, som bara servern kan skriva.
--
-- Tidigare räckte user_metadata.uf = true, och den kan varje inloggad användare
-- sätta själv (supabase.auth.updateUser({ data: { uf: true } })). Ett vanligt
-- konto kunde alltså slå om sig till UF och få gratis åtkomst resten av de tre
-- månaderna från registreringen, utan kort.
--
-- Nu: när kontot SKAPAS kopieras user_metadata.uf till app_metadata.uf. Efteråt
-- går flaggan varken att lägga till eller ta bort från klienten. Auth skriver
-- ibland om hela app_metadata (t.ex. providers vid inloggning) med sin egen kopia,
-- därför bevarar samma trigger ett redan satt uf vid uppdateringar.
-- Kör i Supabase (Bokix Stockholm) → SQL Editor.

CREATE OR REPLACE FUNCTION private.protect_uf_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.raw_user_meta_data ->> 'uf') = 'true' THEN
      NEW.raw_app_meta_data := coalesce(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('uf', true);
    END IF;
  ELSIF (OLD.raw_app_meta_data ->> 'uf') = 'true' AND (NEW.raw_app_meta_data ->> 'uf') IS DISTINCT FROM 'true' THEN
    NEW.raw_app_meta_data := coalesce(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('uf', true);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_uf_flag() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.protect_uf_flag() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS protect_uf_flag ON auth.users;
CREATE TRIGGER protect_uf_flag
  BEFORE INSERT OR UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.protect_uf_flag();

-- Betald åtkomst: UF läses nu ur app_metadata i stället för user_metadata.
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
            -- Avslutat UF-år (app_metadata, bara servern skriver) = inte gratis längre.
            AND (u.raw_app_meta_data ->> 'uf_closed_at') IS NULL
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = target_user_id
        AND s.status IN ('trialing', 'active', 'past_due')
    );
$function$;
