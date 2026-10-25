-- ══════════════════════════════════════════════════════════════════════
-- STEG 4b: SERVERN LÄSER FÖRETAGEN UR TABELLERNA (2026-10-25)
-- ══════════════════════════════════════════════════════════════════════
-- Bygger på supabase-2026-10-25-steg-4a.sql (måste vara körd).
--
-- Servern (fakturamejl, Stripe, Zettle, påminnelser, arkivet, inbjudna …)
-- läser i dag företaget ur blobben. För konton i tabelläget läser den nu ur
-- tabellerna i stället, via api/_companyStore.js, med de här två
-- funktionerna. De går bara att köra med servernyckeln (service_role).
--
-- p_kinds begränsar vilka listor som hämtas (null = alla): fakturamejlet
-- behöver företagsuppgifterna och fakturorna, inte alla verifikationer.
--
-- Ta bort igen:
--   DROP FUNCTION IF EXISTS public.server_read_company(uuid, text, text[]);
--   DROP FUNCTION IF EXISTS public.server_read_companies(uuid, text[]);
--   DROP FUNCTION IF EXISTS private.company_payload(uuid, text[]);
--
-- Kör hela filen i Supabase → SQL Editor. Den kan köras flera gånger.

-- Samma som private.company_payload(uuid) i steg-4a.sql, men bara listorna
-- i p_kinds (null = alla). list_fields visar ändå alla listor som finns, så
-- att man ser vad som inte hämtades.
CREATE OR REPLACE FUNCTION private.company_payload(p_company uuid, p_kinds text[])
RETURNS json
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT json_build_object(
    'id', c.id,
    'version', c.version,
    'extra', c.extra,
    'has_settings', c.settings IS NOT NULL,
    'settings', c.settings,
    'has_accounts', c.accounts IS NOT NULL,
    'accounts', c.accounts,
    'list_fields', CASE WHEN p_kinds IS NULL THEN c.list_fields
                        ELSE ARRAY(SELECT k FROM unnest(c.list_fields) k WHERE k = ANY (p_kinds)) END,
    'all_list_fields', c.list_fields,
    'lists', (
      SELECT json_object_agg(g.kind, g.data) FROM (
        SELECT r.kind, json_agg(r.data ORDER BY r.position, r.id) AS data
        FROM public.company_records r
        WHERE r.company_id = c.id AND r.deleted_at IS NULL AND r.kind = ANY (c.list_fields)
          AND (p_kinds IS NULL OR r.kind = ANY (p_kinds))
        GROUP BY r.kind
      ) g),
    'versions', (
      SELECT json_object_agg(g.kind, g.v) FROM (
        SELECT r.kind, json_agg(r.version ORDER BY r.position, r.id) AS v
        FROM public.company_records r
        WHERE r.company_id = c.id AND r.deleted_at IS NULL AND r.kind = ANY (c.list_fields)
          AND (p_kinds IS NULL OR r.kind = ANY (p_kinds))
        GROUP BY r.kind
      ) g)
  )
  FROM public.companies c
  WHERE c.id = p_company;
$$;

REVOKE ALL ON FUNCTION private.company_payload(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- Ett företag hos en ägare, uppslaget som findCompanyEntry i api/_auth.js:
-- nyckeln först, sedan företagets eget company.id. Ger { key, payload } eller
-- null.
CREATE OR REPLACE FUNCTION public.server_read_company(p_owner uuid, p_company text, p_kinds text[] DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object('key', c.legacy_key, 'payload', private.company_payload(c.id, p_kinds))
  FROM public.companies c
  WHERE c.owner_user_id = p_owner AND c.deleted_at IS NULL
    AND (c.legacy_key = p_company OR c.legacy_company_id = p_company)
  ORDER BY (c.legacy_key = p_company) DESC, c.legacy_key
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.server_read_company(uuid, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_read_company(uuid, text, text[]) TO service_role;

-- Alla företag hos en ägare: { "<nyckel>": payload, … }.
CREATE OR REPLACE FUNCTION public.server_read_companies(p_owner uuid, p_kinds text[] DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(json_object_agg(c.legacy_key, private.company_payload(c.id, p_kinds)), '{}'::json)
  FROM public.companies c
  WHERE c.owner_user_id = p_owner AND c.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.server_read_companies(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_read_companies(uuid, text[]) TO service_role;

-- Är kontot i tabelläget (public.storage_modes, steg 4a)? Tål att tabellen
-- inte finns än (en databas där bara den här filen är körd): då nej.
CREATE OR REPLACE FUNCTION private.in_tables_mode(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_found boolean;
BEGIN
  IF to_regclass('public.storage_modes') IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.storage_modes WHERE user_id = $1 AND mode = ''tables'')' INTO v_found USING p_user;
  RETURN coalesce(v_found, false);
END;
$$;

REVOKE ALL ON FUNCTION private.in_tables_mode(uuid) FROM PUBLIC, anon, authenticated;

-- ── Konton i tabelläget: speglingen får aldrig misslyckas tyst ──────────
-- Samma trigger som i foretag-och-poster.sql, men för ett konto i tabelläget
-- avbryts skrivningen om speglingen misslyckas. Övriga konton som förut.
CREATE OR REPLACE FUNCTION private.sync_companies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hint jsonb;
BEGIN
  BEGIN
    -- Satt av apply_user_data_delta i samma transaktion: exakt vad som
    -- ändrats. Används en gång och bara för rätt konto.
    v_hint := nullif(current_setting('bokix.delta_ops', true), '')::jsonb;
    IF v_hint IS NOT NULL THEN
      PERFORM set_config('bokix.delta_ops', '', true);
    END IF;

    IF TG_OP = 'UPDATE' AND v_hint IS NOT NULL
       AND v_hint ->> 'user' = NEW.user_id::text AND jsonb_typeof(v_hint -> 'ops') = 'array' THEN
      PERFORM private.sync_companies_from_ops(NEW.user_id, v_hint -> 'ops', NEW.state, OLD.state);
    ELSE
      PERFORM private.sync_companies_by_compare(NEW.user_id, NEW.state,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.state END, NULL);
    END IF;

    DELETE FROM public.companies
    WHERE owner_user_id = NEW.user_id AND deleted_at < now() - interval '30 days';
  EXCEPTION WHEN OTHERS THEN
    -- Konto i tabelläget: tabellerna är sanningen, så skrivningen avbryts
    -- hellre än att tabellerna hamnar efter (gäller alla vägar: appen,
    -- inbjudna via servern, påminnelse-cronen).
    IF private.in_tables_mode(NEW.user_id) THEN
      RAISE;
    END IF;
    BEGIN
      INSERT INTO public.system_events (kind, detail)
      VALUES ('company_sync_failed', format('user_data %s: %s (%s)', NEW.user_id, SQLERRM, SQLSTATE));
    EXCEPTION WHEN OTHERS THEN
      NULL; -- inte ens loggen gick: sparningen ska ändå igenom
    END;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_companies() FROM PUBLIC, anon, authenticated;
