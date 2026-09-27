-- ═══════════════════════════════════════════════════════════════════════
-- Admin-panelen (/internal), 2026-09-27. Kör HELA filen i Supabase → SQL Editor.
-- Säker att köra flera gånger. Samma innehåll finns i supabase-setup.sql.
--
-- contact_messages: kontaktformulären sparas här, så de syns i admin-
--   panelens Inkorg och inte bara finns i en mejlkorg.
-- system_events: misslyckade mejlutskick m.m., som visas under Systemstatus.
-- admin_db_stats(): databasens och fillagringens storlek, för Systemstatus.
--
-- Alla tre nås bara med service role (api/admin/index.js, api/contact.js).
-- RLS är på utan policyer, så inloggade användare kommer inte åt dem.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  topic text NOT NULL,
  message text NOT NULL,
  email_sent boolean NOT NULL DEFAULT false,
  handled_at timestamptz,
  handled_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON public.contact_messages (created_at DESC);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- 'email_failed' | 'email_fallback' | 'contact_email_failed'
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_events_created_at_idx ON public.system_events (created_at DESC);
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_db_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', (SELECT coalesce(sum((metadata ->> 'size')::bigint), 0) FROM storage.objects),
    'storage_objects', (SELECT count(*) FROM storage.objects),
    'user_data_rows', (SELECT count(*) FROM public.user_data)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_db_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_db_stats() TO service_role;
