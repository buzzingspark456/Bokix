-- Statussidan (bokix.se/status), 2026-10-24.
--
-- api/cron/status-check.js kollar var 5:e minut att varje del av Bokix
-- fungerar och sparar resultatet med public.status_record. Statussidan
-- (api/status.js) läser den senaste kollen per del och dagssummorna för de
-- senaste 90 dagarna. Meddelanden om störningar och planerat underhåll
-- skrivs i /internal (api/admin, resource 'status').
--
-- Bara servern (service role) läser och skriver. RLS är på utan policyer,
-- så anon och inloggade kunder kommer inte åt tabellerna direkt.

CREATE TABLE IF NOT EXISTS public.status_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  component text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'degraded', 'down')),
  ms integer,
  note text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS status_checks_component_time ON public.status_checks (component, checked_at DESC);
ALTER TABLE public.status_checks ENABLE ROW LEVEL SECURITY;

-- En rad per del och dag (svensk tid): hur många kollar som gick bra,
-- hade störningar eller var nere. Ger staplarna utan att läsa alla kollar.
CREATE TABLE IF NOT EXISTS public.status_daily (
  day date NOT NULL,
  component text NOT NULL,
  ok integer NOT NULL DEFAULT 0,
  degraded integer NOT NULL DEFAULT 0,
  down integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, component)
);
ALTER TABLE public.status_daily ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.status_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  components text[] NOT NULL DEFAULT '{}',
  -- investigating | identified | monitoring | resolved | maintenance
  status text NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved', 'maintenance')),
  -- Hur allvarligt: påverkar färgen på sidan medan det pågår.
  impact text NOT NULL DEFAULT 'degraded' CHECK (impact IN ('degraded', 'down', 'maintenance')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);
CREATE INDEX IF NOT EXISTS status_incidents_time ON public.status_incidents (starts_at DESC);
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;

-- Sparar en kontroll och räknar upp dagens summa i samma anrop.
CREATE OR REPLACE FUNCTION public.status_record(p_component text, p_status text, p_ms integer, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Europe/Stockholm')::date;
BEGIN
  INSERT INTO public.status_checks (component, status, ms, note) VALUES (p_component, p_status, p_ms, p_note);
  INSERT INTO public.status_daily (day, component, ok, degraded, down)
  VALUES (v_day, p_component, (p_status = 'ok')::int, (p_status = 'degraded')::int, (p_status = 'down')::int)
  ON CONFLICT (day, component) DO UPDATE SET
    ok = public.status_daily.ok + EXCLUDED.ok,
    degraded = public.status_daily.degraded + EXCLUDED.degraded,
    down = public.status_daily.down + EXCLUDED.down;
  -- Enskilda kollar behövs bara en vecka (felsökning); summorna räcker sedan.
  DELETE FROM public.status_checks WHERE checked_at < now() - interval '7 days' AND random() < 0.01;
END;
$$;

REVOKE ALL ON FUNCTION public.status_record(text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.status_record(text, text, integer, text) TO service_role;
