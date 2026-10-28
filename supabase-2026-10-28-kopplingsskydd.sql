-- ══════════════════════════════════════════════════════════════════════
-- KOPPLINGSSKYDD PÅ ALLA SKRIVVÄGAR (2026-10-28)
-- ══════════════════════════════════════════════════════════════════════
-- Kör i SQL Editor efter supabase-2026-10-25-steg-4d.sql. Går att köra om.
--
-- Säkerhetsgranskningen 2026-10-28: Stripe-kontot (stripeAccountId) och
-- Zettle-nycklarna ska bara sättas av servern (sakerhetsgranskning.sql,
-- punkt 5). Skyddet satt bara på user_data och bara för inloggade, så två
-- vägar gick förbi:
--   - set_company_field med service-rollen (ägarens sparning av
--     företagsuppgifterna i api/company-access.js), i alla lägen;
--   - 'tables_only': save_company_changes och set_company_field skriver
--     direkt till public.companies, där inget skydd fanns.
-- En ägare kunde då lägga in ett annat företags Stripe-konto i sitt eget.
--
-- Nu:
--   1. private.pin_connections: samma regel som skyddet på user_data. Ett
--      satt och ändrat värde ersätts med det gamla; att ta bort (koppla
--      från) går fortfarande.
--   2. Ett skydd på public.companies för 'tables_only'-konton. Övriga lägen
--      speglar en blob som redan är skyddad.
--   3. set_company_field använder regeln för 'company' i blobben.
--   4. set_company_stripe_account och set_company_zettle_tokens, de enda som
--      får sätta värdena, sätter en markering för kontot under sin egen
--      transaktion som skyddet släpper förbi.
-- search_path är tom ('') i alla fyra, som i resten av steg 4.

-- ── 1. Regeln ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.pin_connections(p_new jsonb, p_old jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_out jsonb := p_new;
  v_field text;
BEGIN
  IF jsonb_typeof(p_new) IS DISTINCT FROM 'object' THEN
    RETURN p_new;
  END IF;
  FOREACH v_field IN ARRAY ARRAY['stripeAccountId', 'zettleAccessToken', 'zettleRefreshToken', 'zettleTokenExpiresAt'] LOOP
    IF coalesce(p_new ->> v_field, '') <> ''
       AND (p_new -> v_field) IS DISTINCT FROM (p_old -> v_field) THEN
      IF jsonb_typeof(p_old) = 'object' AND p_old ? v_field THEN
        v_out := jsonb_set(v_out, ARRAY[v_field], p_old -> v_field);
      ELSE
        v_out := v_out - v_field;
      END IF;
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION private.pin_connections(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 2. Skyddet på företagstabellen ─────────────────────────────────────
CREATE OR REPLACE FUNCTION private.guard_company_connections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Serverns egna kopplingsfunktioner (punkt 4).
  IF current_setting('bokix.connection_write', true) = NEW.owner_user_id::text THEN
    RETURN NEW;
  END IF;
  IF private.storage_mode(NEW.owner_user_id) IS DISTINCT FROM 'tables_only' THEN
    RETURN NEW;
  END IF;
  NEW.settings := private.pin_connections(NEW.settings, CASE WHEN TG_OP = 'UPDATE' THEN OLD.settings END);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_company_connections() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_company_connections ON public.companies;
CREATE TRIGGER guard_company_connections
BEFORE INSERT OR UPDATE OF settings ON public.companies
FOR EACH ROW EXECUTE FUNCTION private.guard_company_connections();

-- ── 3. set_company_field ───────────────────────────────────────────────
-- Som i steg 4d, plus regeln för 'company' i blobben ('tables_only' går via
-- tabellerna och skyddet ovan).
CREATE OR REPLACE FUNCTION public.set_company_field(p_user_id uuid, p_company_id text, p_field text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_field NOT IN (
    'accounts', 'verifications', 'invoices', 'quotes', 'expenses', 'contacts',
    'articles', 'projects', 'timeEntries', 'timeReportStatuses',
    'billableTimeEntries', 'recurringTemplates', 'verificationTemplates',
    'vatPeriods', 'reviewHistory', 'employees', 'payrollRuns', 'agiReports', 'company',
    'bankTransactions'
  ) THEN
    RAISE EXCEPTION 'Ogiltigt fält för set_company_field: %', p_field;
  END IF;

  IF private.storage_mode(p_user_id) = 'tables_only' THEN
    IF EXISTS (SELECT 1 FROM public.companies WHERE owner_user_id = p_user_id AND legacy_key = p_company_id AND deleted_at IS NULL) THEN
      PERFORM 1 FROM public.user_data WHERE user_id = p_user_id FOR UPDATE;
      PERFORM private.apply_ops_to_tables(p_user_id,
        jsonb_build_array(jsonb_build_object('op', 'set', 'path', jsonb_build_array('companies', p_company_id, p_field), 'value', p_value)));
    END IF;
    RETURN;
  END IF;

  IF p_field = 'company' THEN
    p_value := private.pin_connections(p_value,
      (SELECT state #> ARRAY['companies', p_company_id, 'company'] FROM public.user_data WHERE user_id = p_user_id));
  END IF;

  UPDATE public.user_data
  SET state = jsonb_set(
    coalesce(state, '{}'::jsonb),
    ARRAY['companies', p_company_id, p_field],
    p_value,
    true
  )
  WHERE user_id = p_user_id
    AND state #> ARRAY['companies', p_company_id] IS NOT NULL;
END;
$$;

-- ── 4. De enda som får sätta kopplingarna ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_company_stripe_account(p_user_id uuid, p_company_id text, p_stripe_account_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('bokix.connection_write', p_user_id::text, true);
  IF private.storage_mode(p_user_id) = 'tables_only' THEN
    PERFORM 1 FROM public.user_data WHERE user_id = p_user_id FOR UPDATE;
    PERFORM private.apply_ops_to_tables(p_user_id, jsonb_build_array(jsonb_build_object(
      'op', 'set', 'path', jsonb_build_array('companies', p_company_id, 'company', 'stripeAccountId'), 'value', to_jsonb(p_stripe_account_id))));
  ELSE
    UPDATE public.user_data
    SET state = jsonb_set(
      coalesce(state, '{}'::jsonb),
      ARRAY['companies', p_company_id, 'company', 'stripeAccountId'],
      to_jsonb(p_stripe_account_id),
      true
    )
    WHERE user_id = p_user_id;
  END IF;
  PERFORM set_config('bokix.connection_write', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_company_zettle_tokens(p_user_id uuid, p_company_id text, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('bokix.connection_write', p_user_id::text, true);
  IF private.storage_mode(p_user_id) = 'tables_only' THEN
    PERFORM 1 FROM public.user_data WHERE user_id = p_user_id FOR UPDATE;
    PERFORM private.apply_ops_to_tables(p_user_id, jsonb_build_array(
      jsonb_build_object('op', 'set', 'path', jsonb_build_array('companies', p_company_id, 'company', 'zettleAccessToken'), 'value', to_jsonb(p_access_token)),
      jsonb_build_object('op', 'set', 'path', jsonb_build_array('companies', p_company_id, 'company', 'zettleRefreshToken'), 'value', to_jsonb(p_refresh_token)),
      jsonb_build_object('op', 'set', 'path', jsonb_build_array('companies', p_company_id, 'company', 'zettleTokenExpiresAt'), 'value', to_jsonb(p_expires_at))));
  ELSE
    UPDATE public.user_data
    SET state = jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(state, '{}'::jsonb),
          ARRAY['companies', p_company_id, 'company', 'zettleAccessToken'],
          to_jsonb(p_access_token),
          true
        ),
        ARRAY['companies', p_company_id, 'company', 'zettleRefreshToken'],
        to_jsonb(p_refresh_token),
        true
      ),
      ARRAY['companies', p_company_id, 'company', 'zettleTokenExpiresAt'],
      to_jsonb(p_expires_at),
      true
    )
    WHERE user_id = p_user_id;
  END IF;
  PERFORM set_config('bokix.connection_write', '', true);
END;
$$;

-- Behörigheterna ska vara oförändrade (CREATE OR REPLACE behåller dem),
-- men sägs här igen så att filen står på egna ben.
REVOKE ALL ON FUNCTION public.set_company_field(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_field(uuid, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.set_company_stripe_account(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_stripe_account(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.set_company_zettle_tokens(uuid, text, text, text, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_zettle_tokens(uuid, text, text, text, timestamp with time zone) TO service_role;

-- Kontroll efteråt (ska ge en rad):
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.companies'::regclass AND tgname = 'guard_company_connections';
