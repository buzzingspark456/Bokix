-- ══════════════════════════════════════════════════════════════════════
-- STEG 4d: KONTON SOM BARA SPARAR I TABELLERNA (2026-10-25)
-- ══════════════════════════════════════════════════════════════════════
-- Bygger på foretag-och-poster, steg-4a, steg-4b och jamforelse-per-konto.
--
-- Ett nytt läge per konto: storage_modes.mode = 'tables_only'. Då är
-- tabellerna den enda sanningen för kontots företag:
--   - all skrivning av företagsdata går direkt till tabellerna, via
--     private.apply_ops_to_tables (samma ändringslista som appen skickar):
--     appens sparning (save_company_changes), set_company_field (inbjudna,
--     påminnelser), Stripe- och Zettle-kopplingarna;
--   - blobben (user_data.state) behåller bara det personliga (aktivt
--     företag); företagen där fryses och får inte ändras (skyddet
--     guard_tables_only nekar det, så att en gammal flik aldrig kan skriva
--     över tabellerna via triggern);
--   - speglingen, jämförelsen och rättningen hoppar över kontot (blobben är
--     inte längre en kopia att jämföra med).
-- Gå tillbaka: public.rebuild_blob_from_tables(konto) skriver tabellerna till
-- blobben igen, sedan mode = 'tables'.
--
-- Kör hela filen i Supabase → SQL Editor. Den kan köras flera gånger.

-- ── Läget ───────────────────────────────────────────────────────────────
ALTER TABLE public.storage_modes DROP CONSTRAINT IF EXISTS storage_modes_mode_check;
ALTER TABLE public.storage_modes ADD CONSTRAINT storage_modes_mode_check CHECK (mode IN ('blob', 'tables', 'tables_only'));

-- Kontots läge; 'blob' när tabellen eller raden saknas.
CREATE OR REPLACE FUNCTION private.storage_mode(p_user uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mode text;
BEGIN
  IF to_regclass('public.storage_modes') IS NULL THEN
    RETURN 'blob';
  END IF;
  EXECUTE 'SELECT mode FROM public.storage_modes WHERE user_id = $1' INTO v_mode USING p_user;
  RETURN coalesce(v_mode, 'blob');
END;
$$;

REVOKE ALL ON FUNCTION private.storage_mode(uuid) FROM PUBLIC, anon, authenticated;

-- Tabelläget i båda formerna (används av triggern i steg 4b).
CREATE OR REPLACE FUNCTION private.in_tables_mode(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.storage_mode(p_user) IN ('tables', 'tables_only');
$$;

REVOKE ALL ON FUNCTION private.in_tables_mode(uuid) FROM PUBLIC, anon, authenticated;

-- ── Kärnan: en ändringslista direkt på tabellerna ───────────────────────
-- Samma operationer som apply_user_data_delta (set, unset, patch, patch_by),
-- men på companies/company_records i stället för blobben. Personliga fält
-- (utanför companies) skrivs i blobben som förut. En ändring djupt inne i en
-- post (sökväg längre än lista) stöds inte: buildStateDelta skickar aldrig
-- sådana, och hellre ett fel än en gissning.
CREATE OR REPLACE FUNCTION private.apply_ops_to_tables(p_user uuid, p_ops jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kinds text[] := private.record_kinds();
  v_op jsonb;
  v_path text[];
  v_key text;
  v_field text;
  v_c record;
  v_row jsonb;
  v_sub text[];
  v_val jsonb;
  v_top jsonb;
BEGIN
  FOR v_op IN SELECT * FROM jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) LOOP
    v_path := ARRAY(SELECT jsonb_array_elements_text(v_op -> 'path'));
    IF coalesce(cardinality(v_path), 0) = 0 THEN
      RAISE EXCEPTION 'empty path' USING ERRCODE = '22023';
    END IF;

    -- Personligt (aktivt företag m.m.): i blobben, utanför companies.
    IF v_path[1] IS DISTINCT FROM 'companies' THEN
      SELECT coalesce(state, '{}'::jsonb) INTO v_top FROM public.user_data WHERE user_id = p_user FOR UPDATE;
      v_top := CASE v_op ->> 'op'
        WHEN 'set' THEN jsonb_set(v_top, v_path, coalesce(v_op -> 'value', 'null'::jsonb), true)
        WHEN 'unset' THEN v_top #- v_path
        ELSE NULL END;
      IF v_top IS NULL THEN
        RAISE EXCEPTION 'unsupported op % outside companies', v_op ->> 'op' USING ERRCODE = '22023';
      END IF;
      UPDATE public.user_data SET state = v_top WHERE user_id = p_user;
      CONTINUE;
    END IF;
    IF cardinality(v_path) = 1 THEN
      RAISE EXCEPTION 'whole companies object cannot be set in tables mode' USING ERRCODE = '22023';
    END IF;
    v_key := v_path[2];

    -- Ett helt företag: nytt (alla listor ur värdet) eller borttaget.
    IF cardinality(v_path) = 2 THEN
      IF v_op ->> 'op' = 'set' THEN
        PERFORM private.sync_company(p_user, v_key, v_op -> 'value', NULL);
      ELSIF v_op ->> 'op' = 'unset' THEN
        UPDATE public.companies SET deleted_at = now(), updated_at = now(), version = version + 1
        WHERE owner_user_id = p_user AND legacy_key = v_key AND deleted_at IS NULL;
      ELSE
        RAISE EXCEPTION 'unsupported op % on a whole company', v_op ->> 'op' USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;

    SELECT * INTO v_c FROM public.companies
    WHERE owner_user_id = p_user AND legacy_key = v_key AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing company %', v_key USING ERRCODE = '22023';
    END IF;
    v_field := v_path[3];

    IF v_field = ANY (v_kinds) THEN
      IF cardinality(v_path) > 3 THEN
        RAISE EXCEPTION 'path inside a record is not supported: %', v_path USING ERRCODE = '22023';
      END IF;
      IF v_op ->> 'op' = 'patch' THEN
        PERFORM private.patch_company_records(v_c.id, v_field, v_op -> 'upsert', v_op -> 'remove',
          coalesce((v_op ->> 'prepend')::boolean, false));
        UPDATE public.companies SET list_fields = (SELECT array_agg(DISTINCT k ORDER BY k) FROM unnest(list_fields || v_field) k),
          extra = extra - v_field, updated_at = now()
        WHERE id = v_c.id;
      ELSIF v_op ->> 'op' = 'set' AND jsonb_typeof(v_op -> 'value') = 'array' THEN
        PERFORM private.sync_company_records(v_c.id, v_field, v_op -> 'value');
        UPDATE public.companies SET list_fields = (SELECT array_agg(DISTINCT k ORDER BY k) FROM unnest(list_fields || v_field) k),
          extra = extra - v_field, updated_at = now()
        WHERE id = v_c.id;
      ELSIF v_op ->> 'op' IN ('set', 'unset') THEN
        -- Listan borta, eller ersatt av något som inte är en lista (då sparas
        -- värdet bland övriga fält, som speglingen gör).
        PERFORM private.sync_company_records(v_c.id, v_field, NULL);
        UPDATE public.companies SET list_fields = array_remove(list_fields, v_field),
          extra = CASE WHEN v_op ->> 'op' = 'set' THEN extra || jsonb_build_object(v_field, coalesce(v_op -> 'value', 'null'::jsonb)) ELSE extra - v_field END,
          version = version + 1, updated_at = now()
        WHERE id = v_c.id;
      ELSE
        RAISE EXCEPTION 'unsupported op % on list %', v_op ->> 'op', v_field USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;

    -- Allt annat (företagsuppgifter, kontoplan, vatPeriods …) ligger på
    -- företagsraden. Byggs ihop, ändras som i blobben och delas upp igen.
    v_row := v_c.extra
      || CASE WHEN v_c.settings IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('company', v_c.settings) END
      || CASE WHEN v_c.accounts IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('accounts', v_c.accounts) END;
    v_sub := v_path[3:cardinality(v_path)];
    IF cardinality(v_sub) > 1 AND jsonb_typeof(v_row #> v_sub[1:cardinality(v_sub) - 1]) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'missing parent %', v_path[1:cardinality(v_path) - 1] USING ERRCODE = '22023';
    END IF;
    v_row := CASE v_op ->> 'op'
      WHEN 'set' THEN jsonb_set(v_row, v_sub, coalesce(v_op -> 'value', 'null'::jsonb), true)
      WHEN 'unset' THEN v_row #- v_sub
      WHEN 'patch' THEN jsonb_set(v_row, v_sub, private.apply_keyed_patch(v_row #> v_sub, v_op -> 'upsert', v_op -> 'remove',
                          coalesce((v_op ->> 'prepend')::boolean, false), 'id'), true)
      WHEN 'patch_by' THEN jsonb_set(v_row, v_sub, private.apply_keyed_patch(v_row #> v_sub, v_op -> 'upsert', v_op -> 'remove',
                          coalesce((v_op ->> 'prepend')::boolean, false), coalesce(v_op ->> 'key', 'id')), true)
      ELSE NULL END;
    IF v_row IS NULL THEN
      RAISE EXCEPTION 'unknown op %', v_op ->> 'op' USING ERRCODE = '22023';
    END IF;
    UPDATE public.companies
    SET settings = v_row -> 'company',
        accounts = v_row -> 'accounts',
        extra = v_row - 'company' - 'accounts',
        legacy_company_id = v_row -> 'company' ->> 'id',
        version = version + 1, updated_at = now()
    WHERE id = v_c.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.apply_ops_to_tables(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ── Skyddet: företagsdata i blobben får inte ändras i 'tables_only' ─────
-- Bara personliga fält får ändras. En gammal flik (eller vad som helst) som
-- försöker spara företag i blobben nekas, i stället för att triggern skriver
-- över tabellerna med gammal data.
CREATE OR REPLACE FUNCTION private.guard_tables_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.storage_mode(NEW.user_id) = 'tables_only'
     AND (NEW.state -> 'companies') IS DISTINCT FROM (OLD.state -> 'companies')
     AND current_setting('bokix.rebuild_blob', true) IS DISTINCT FROM NEW.user_id::text THEN
    RAISE EXCEPTION 'Kontot sparar sina företag i tabellerna. Ladda om sidan.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_tables_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_tables_only ON public.user_data;
CREATE TRIGGER guard_tables_only
  BEFORE UPDATE OF state ON public.user_data
  FOR EACH ROW EXECUTE FUNCTION private.guard_tables_only();

-- ── Speglingen hoppar över 'tables_only' ────────────────────────────────
-- Samma trigger som i steg-4b.sql, med en rad till överst.
CREATE OR REPLACE FUNCTION private.sync_companies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hint jsonb;
BEGIN
  -- Konto som bara sparar i tabellerna: blobben är ingen källa längre.
  IF private.storage_mode(NEW.user_id) = 'tables_only' THEN
    RETURN NULL;
  END IF;
  BEGIN
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
    IF private.in_tables_mode(NEW.user_id) THEN
      RAISE;
    END IF;
    BEGIN
      INSERT INTO public.system_events (kind, detail)
      VALUES ('company_sync_failed', format('user_data %s: %s (%s)', NEW.user_id, SQLERRM, SQLSTATE));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_companies() FROM PUBLIC, anon, authenticated;

-- ── Appens sparning ─────────────────────────────────────────────────────
-- Samma som i steg-4a.sql (krockkontrollen oförändrad), men i 'tables_only'
-- tillämpas ändringen direkt på tabellerna i stället för via blobben.
CREATE OR REPLACE FUNCTION public.save_company_changes(p_ops jsonb, p_expected jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_mode text;
  v_kinds text[] := private.record_kinds();
  v_state jsonb;
  v_op jsonb;
  v_path text[];
  v_parent text[];
  v_key text;
  v_field text;
  v_company record;
  v_exp jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_touched jsonb := '{}'::jsonb;
  v_updated timestamptz;
  v_versions jsonb := '{}'::jsonb;
  v_rec record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT private.mfa_ok() THEN
    RAISE EXCEPTION 'mfa required' USING ERRCODE = '42501';
  END IF;
  IF NOT private.can_write_user_data(v_uid) THEN
    RAISE EXCEPTION 'payment required' USING ERRCODE = '42501';
  END IF;
  v_mode := private.storage_mode(v_uid);
  IF v_mode NOT IN ('tables', 'tables_only') THEN
    RAISE EXCEPTION 'not in tables mode' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_ops) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'ops must be an array' USING ERRCODE = '22023';
  END IF;
  p_expected := CASE WHEN jsonb_typeof(p_expected) = 'object' THEN p_expected ELSE '{}'::jsonb END;

  -- Låser kontot: sparningar för samma konto sker en i taget.
  SELECT state INTO v_state FROM public.user_data WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no user_data row' USING ERRCODE = '22023';
  END IF;
  v_state := coalesce(v_state, '{}'::jsonb);

  -- 1. Krockkontroll mot tabellerna (samma som steg 4a).
  FOR v_op IN SELECT * FROM jsonb_array_elements(p_ops) LOOP
    v_path := ARRAY(SELECT jsonb_array_elements_text(v_op -> 'path'));
    IF coalesce(cardinality(v_path), 0) = 0 THEN
      RAISE EXCEPTION 'empty path' USING ERRCODE = '22023';
    END IF;
    IF v_path[1] IS DISTINCT FROM 'companies' THEN
      CONTINUE;
    END IF;
    IF cardinality(v_path) = 1 THEN
      RAISE EXCEPTION 'whole companies object cannot be set in tables mode' USING ERRCODE = '22023';
    END IF;
    v_key := v_path[2];
    v_exp := p_expected -> v_key;
    SELECT id, version INTO v_company
    FROM public.companies WHERE owner_user_id = v_uid AND legacy_key = v_key AND deleted_at IS NULL;
    v_touched := v_touched || jsonb_build_object(v_key, true);

    IF cardinality(v_path) = 2 THEN
      IF v_op ->> 'op' = 'set' AND v_company.id IS NOT NULL THEN
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('key', v_key, 'what', 'företaget finns redan'));
      ELSIF v_op ->> 'op' = 'unset' AND v_company.id IS NOT NULL
            AND (v_exp ->> 'company')::bigint IS DISTINCT FROM v_company.version THEN
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('key', v_key, 'what', 'company'));
      END IF;
      CONTINUE;
    END IF;

    IF v_company.id IS NULL THEN
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('key', v_key, 'what', 'saknas'));
      CONTINUE;
    END IF;
    v_field := v_path[3];

    IF v_field = ANY (v_kinds) AND cardinality(v_path) = 3 AND v_op ->> 'op' = 'patch' THEN
      FOR v_rec IN
        WITH ids AS (
          SELECT e ->> 'id' AS id FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_op -> 'upsert') = 'array' THEN v_op -> 'upsert' ELSE '[]'::jsonb END) e
          WHERE jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> ''
          UNION
          SELECT value #>> '{}' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_op -> 'remove') = 'array' THEN v_op -> 'remove' ELSE '[]'::jsonb END)
        )
        SELECT ids.id, cur.version AS cur, (v_exp -> 'records' -> v_field ->> ids.id)::bigint AS exp,
               EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_op -> 'remove') = 'array' THEN v_op -> 'remove' ELSE '[]'::jsonb END) x WHERE x #>> '{}' = ids.id) AS removing
        FROM ids
        LEFT JOIN public.company_records cur
          ON cur.company_id = v_company.id AND cur.kind = v_field AND cur.id = ids.id AND cur.deleted_at IS NULL
      LOOP
        IF v_rec.cur IS DISTINCT FROM v_rec.exp AND NOT (v_rec.removing AND v_rec.cur IS NULL) THEN
          v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('key', v_key, 'what', v_field, 'id', v_rec.id));
        END IF;
      END LOOP;
    ELSIF v_field = ANY (v_kinds) AND cardinality(v_path) = 3 AND v_op ->> 'op' IN ('set', 'unset') THEN
      IF coalesce((
          SELECT jsonb_object_agg(cur.id, cur.version) FROM public.company_records cur
          WHERE cur.company_id = v_company.id AND cur.kind = v_field AND cur.deleted_at IS NULL
        ), '{}'::jsonb) IS DISTINCT FROM coalesce(v_exp -> 'records' -> v_field, '{}'::jsonb) THEN
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('key', v_key, 'what', v_field));
      END IF;
    ELSIF (v_exp ->> 'company')::bigint IS DISTINCT FROM v_company.version THEN
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('key', v_key, 'what', 'company'));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'conflicts', v_conflicts);
  END IF;

  IF v_mode = 'tables_only' THEN
    -- 2. Direkt på tabellerna.
    PERFORM private.apply_ops_to_tables(v_uid, p_ops);
    SELECT updated_at INTO v_updated FROM public.user_data WHERE user_id = v_uid;
  ELSE
    -- 2. Som i steg 4a: via blobben, triggern speglar.
    FOR v_op IN SELECT * FROM jsonb_array_elements(p_ops) LOOP
      v_path := ARRAY(SELECT jsonb_array_elements_text(v_op -> 'path'));
      v_parent := v_path[1:array_length(v_path, 1) - 1];
      IF array_length(v_parent, 1) > 0 AND jsonb_typeof(v_state #> v_parent) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'missing parent %', v_parent USING ERRCODE = '22023';
      END IF;
      CASE v_op ->> 'op'
        WHEN 'set' THEN
          v_state := jsonb_set(v_state, v_path, coalesce(v_op -> 'value', 'null'::jsonb), true);
        WHEN 'unset' THEN
          v_state := v_state #- v_path;
        WHEN 'patch', 'patch_by' THEN
          v_state := jsonb_set(
            v_state, v_path,
            private.apply_keyed_patch(
              v_state #> v_path, v_op -> 'upsert', v_op -> 'remove',
              coalesce((v_op ->> 'prepend')::boolean, false),
              CASE WHEN v_op ->> 'op' = 'patch_by' THEN coalesce(v_op ->> 'key', 'id') ELSE 'id' END
            ),
            true
          );
        ELSE
          RAISE EXCEPTION 'unknown op %', v_op ->> 'op' USING ERRCODE = '22023';
      END CASE;
    END LOOP;
    PERFORM set_config('bokix.delta_ops', jsonb_build_object('user', v_uid, 'ops', p_ops)::text, true);
    UPDATE public.user_data SET state = v_state WHERE user_id = v_uid
    RETURNING updated_at INTO v_updated;
    IF EXISTS (
      SELECT 1 FROM public.system_events
      WHERE kind = 'company_sync_failed' AND created_at >= now() AND detail LIKE '%' || v_uid::text || '%'
    ) THEN
      RAISE EXCEPTION 'sync to tables failed' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 3. De nya versionerna för det som rördes.
  SELECT coalesce(jsonb_object_agg(c.legacy_key, jsonb_build_object(
      'company', c.version,
      'records', coalesce((
        SELECT jsonb_object_agg(k.kind, k.m) FROM (
          SELECT r.kind, jsonb_object_agg(r.id, r.version) AS m
          FROM public.company_records r
          WHERE r.company_id = c.id AND r.deleted_at IS NULL AND r.updated_at >= now()
          GROUP BY r.kind
        ) k
      ), '{}'::jsonb))), '{}'::jsonb)
  INTO v_versions
  FROM public.companies c
  WHERE c.owner_user_id = v_uid AND c.deleted_at IS NULL AND v_touched ? c.legacy_key;

  RETURN jsonb_build_object('ok', true, 'updated_at', v_updated, 'versions', v_versions);
END;
$$;

REVOKE ALL ON FUNCTION public.save_company_changes(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_company_changes(jsonb, jsonb) TO authenticated;

-- ── Servern: samma kärna ────────────────────────────────────────────────
-- För api/company-access.js (inbjudnas skrivningar) när ägaren är i
-- 'tables_only'. Behörigheten kontrolleras i servern innan anropet.
CREATE OR REPLACE FUNCTION public.server_apply_company_ops(p_owner uuid, p_ops jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.storage_mode(p_owner) <> 'tables_only' THEN
    RAISE EXCEPTION 'owner is not tables_only' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.user_data WHERE user_id = p_owner FOR UPDATE;
  PERFORM private.apply_ops_to_tables(p_owner, p_ops);
END;
$$;

REVOKE ALL ON FUNCTION public.server_apply_company_ops(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_apply_company_ops(uuid, jsonb) TO service_role;

-- set_company_field, set_company_stripe_account och set_company_zettle_tokens
-- (servern: påminnelser, inbjudna, kopplingar): för 'tables_only' samma kärna,
-- annars som förut i blobben. Fältlistan är densamma som innan.
CREATE OR REPLACE FUNCTION public.set_company_field(p_user_id uuid, p_company_id text, p_field text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.set_company_stripe_account(p_user_id uuid, p_company_id text, p_stripe_account_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF private.storage_mode(p_user_id) = 'tables_only' THEN
    PERFORM 1 FROM public.user_data WHERE user_id = p_user_id FOR UPDATE;
    PERFORM private.apply_ops_to_tables(p_user_id, jsonb_build_array(jsonb_build_object(
      'op', 'set', 'path', jsonb_build_array('companies', p_company_id, 'company', 'stripeAccountId'), 'value', to_jsonb(p_stripe_account_id))));
    RETURN;
  END IF;
  UPDATE public.user_data
  SET state = jsonb_set(
    coalesce(state, '{}'::jsonb),
    ARRAY['companies', p_company_id, 'company', 'stripeAccountId'],
    to_jsonb(p_stripe_account_id),
    true
  )
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_company_zettle_tokens(p_user_id uuid, p_company_id text, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF private.storage_mode(p_user_id) = 'tables_only' THEN
    PERFORM 1 FROM public.user_data WHERE user_id = p_user_id FOR UPDATE;
    PERFORM private.apply_ops_to_tables(p_user_id, jsonb_build_array(
      jsonb_build_object('op', 'set', 'path', jsonb_build_array('companies', p_company_id, 'company', 'zettleAccessToken'), 'value', to_jsonb(p_access_token)),
      jsonb_build_object('op', 'set', 'path', jsonb_build_array('companies', p_company_id, 'company', 'zettleRefreshToken'), 'value', to_jsonb(p_refresh_token)),
      jsonb_build_object('op', 'set', 'path', jsonb_build_array('companies', p_company_id, 'company', 'zettleTokenExpiresAt'), 'value', to_jsonb(p_expires_at))));
    RETURN;
  END IF;
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
END;
$$;

-- ── Jämförelsen hoppar över 'tables_only' ───────────────────────────────
-- Blobben är fryst för de kontona; att jämföra (och värre: rätta tabellerna
-- efter den) vore fel. Bara kontroller inom tabellerna görs (poster_kvar).
CREATE OR REPLACE FUNCTION public.companies_owners_to_check(p_since timestamptz, p_after uuid, p_limit integer)
RETURNS TABLE (owner_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.user_id
  FROM public.user_data d
  WHERE (p_after IS NULL OR d.user_id > p_after)
    AND private.storage_mode(d.user_id) <> 'tables_only'
    AND (
      p_since IS NULL
      OR d.updated_at > p_since
      OR EXISTS (SELECT 1 FROM public.companies c WHERE c.owner_user_id = d.user_id AND c.updated_at > p_since)
    )
  ORDER BY d.user_id
  LIMIT greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

CREATE OR REPLACE FUNCTION public.companies_resync_for(p_owner uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  v_n integer := 0;
BEGIN
  -- Aldrig tabellerna efter en fryst blob.
  IF p_owner IS NOT NULL AND private.storage_mode(p_owner) = 'tables_only' THEN
    RETURN 0;
  END IF;
  FOR r IN SELECT DISTINCT m.owner_user_id, m.legacy_key FROM public.companies_mismatch_for(p_owner) m LOOP
    IF private.storage_mode(r.owner_user_id) = 'tables_only' THEN
      CONTINUE;
    END IF;
    PERFORM private.sync_company(r.owner_user_id, r.legacy_key,
      (SELECT d.state -> 'companies' -> r.legacy_key FROM public.user_data d WHERE d.user_id = r.owner_user_id),
      NULL);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- Samma som i jamforelse-per-konto.sql, men utan blob-jämförelse för
-- 'tables_only' (bara poster_kvar).
CREATE OR REPLACE FUNCTION public.companies_mismatch_for(p_owner uuid)
RETURNS TABLE (owner_user_id uuid, legacy_key text, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH blob AS (
    SELECT d.user_id, c.key, c.value
    FROM public.user_data d
    CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(d.state -> 'companies') = 'object' THEN d.state -> 'companies' ELSE '{}'::jsonb END) c
    WHERE (p_owner IS NULL OR d.user_id = p_owner)
      AND private.storage_mode(d.user_id) <> 'tables_only'
      AND NOT (jsonb_typeof(c.value) = 'object' AND c.value ? '__shared')
  ),
  tab AS (
    SELECT id, owner_user_id, legacy_key FROM public.companies
    WHERE deleted_at IS NULL AND (p_owner IS NULL OR owner_user_id = p_owner)
      AND private.storage_mode(owner_user_id) <> 'tables_only'
  )
  SELECT coalesce(b.user_id, t.owner_user_id), coalesce(b.key, t.legacy_key),
    CASE WHEN t.id IS NULL THEN 'saknas_i_tabellerna'
         WHEN b.key IS NULL THEN 'saknas_i_blobben'
         ELSE 'olika' END
  FROM blob b
  FULL JOIN tab t ON t.owner_user_id = b.user_id AND t.legacy_key = b.key
  WHERE t.id IS NULL OR b.key IS NULL
     OR (jsonb_typeof(b.value) = 'object' AND private.company_fingerprint_blob(b.value) IS DISTINCT FROM private.company_fingerprint_tables(t.id))
     OR jsonb_typeof(b.value) <> 'object'
  UNION ALL
  SELECT c.owner_user_id, c.legacy_key, 'poster_kvar'
  FROM public.companies c
  WHERE c.deleted_at IS NULL AND (p_owner IS NULL OR c.owner_user_id = p_owner) AND EXISTS (
    SELECT 1 FROM public.company_records r
    WHERE r.company_id = c.id AND r.deleted_at IS NULL AND NOT (r.kind = ANY (c.list_fields))
  );
$$;

-- ── Tillbaka till blobben ───────────────────────────────────────────────
-- Skriver kontots företag ur tabellerna till blobben (listorna i rätt
-- ordning), så att kontot kan sättas till 'tables' eller 'blob' igen. Ger
-- antalet företag.
CREATE OR REPLACE FUNCTION public.rebuild_blob_from_tables(p_owner uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_companies jsonb;
  v_n integer;
BEGIN
  SELECT coalesce(jsonb_object_agg(c.legacy_key,
      c.extra
      || CASE WHEN c.settings IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('company', c.settings) END
      || CASE WHEN c.accounts IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('accounts', c.accounts) END
      || coalesce((
        SELECT jsonb_object_agg(k, coalesce((
          SELECT jsonb_agg(r.data ORDER BY r.position, r.id)
          FROM public.company_records r
          WHERE r.company_id = c.id AND r.kind = k AND r.deleted_at IS NULL
        ), '[]'::jsonb))
        FROM unnest(c.list_fields) k
      ), '{}'::jsonb)), '{}'::jsonb), count(*)
  INTO v_companies, v_n
  FROM public.companies c
  WHERE c.owner_user_id = p_owner AND c.deleted_at IS NULL;

  PERFORM set_config('bokix.rebuild_blob', p_owner::text, true);
  UPDATE public.user_data SET state = jsonb_set(coalesce(state, '{}'::jsonb), '{companies}', v_companies, true)
  WHERE user_id = p_owner;
  PERFORM set_config('bokix.rebuild_blob', '', true);
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_blob_from_tables(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_blob_from_tables(uuid) TO service_role;

-- ── Inbjudnas skrivningar: villkorade på att företaget inte ändrats ─────
-- api/company-access.js läser företaget, räknar fram det nya värdet
-- (sammanslagning, omnumrering av verifikationer) och skriver. Skrev någon
-- annan emellan ska det inte gå förlorat: skrivningen görs bara om
-- företagets updated_at är det servern läste (alla ändringar i
-- tables_only rör updated_at, se apply_ops_to_tables). Ger true om det
-- skrevs, false vid krock (servern läser då om och försöker igen).
DROP FUNCTION IF EXISTS public.server_apply_company_ops(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.server_apply_company_ops(p_owner uuid, p_key text, p_expected_updated_at timestamptz, p_ops jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.storage_mode(p_owner) <> 'tables_only' THEN
    RAISE EXCEPTION 'owner is not tables_only' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.user_data WHERE user_id = p_owner FOR UPDATE;
  IF p_expected_updated_at IS NOT NULL AND (
    SELECT updated_at FROM public.companies WHERE owner_user_id = p_owner AND legacy_key = p_key AND deleted_at IS NULL
  ) IS DISTINCT FROM p_expected_updated_at THEN
    RETURN false;
  END IF;
  PERFORM private.apply_ops_to_tables(p_owner, p_ops);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.server_apply_company_ops(uuid, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_apply_company_ops(uuid, text, timestamptz, jsonb) TO service_role;

-- Servern behöver företagets updated_at för villkoret ovan: samma som
-- private.company_payload(uuid, text[]) i steg-4b.sql, plus updated_at.
CREATE OR REPLACE FUNCTION private.company_payload(p_company uuid, p_kinds text[])
RETURNS json
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT json_build_object(
    'id', c.id,
    'version', c.version,
    'updated_at', c.updated_at,
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

-- ── Nattkopian (api/_offsiteBackup.js) ─────────────────────────────────
-- För konton i 'tables_only' är tabellerna sanningen och måste med i
-- kopian. company_records har ingen egen id-ordning (id är unikt per
-- företag och lista) och blir stor, så den läses med nyckelsida på
-- primärnyckeln i stället för OFFSET: varje sida är ett indexuppslag, lika
-- snabbt på sida 10 000 som på sida 1. Borttagna rader (deleted_at) följer med.
CREATE OR REPLACE FUNCTION public.backup_company_records_page(
  p_after_company uuid, p_after_kind text, p_after_id text, p_limit integer)
RETURNS SETOF public.company_records
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.*
  FROM public.company_records r
  WHERE p_after_company IS NULL
     OR (r.company_id, r.kind, r.id) > (p_after_company, p_after_kind, p_after_id)
  ORDER BY r.company_id, r.kind, r.id
  LIMIT least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.backup_company_records_page(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_company_records_page(uuid, text, text, integer) TO service_role;
