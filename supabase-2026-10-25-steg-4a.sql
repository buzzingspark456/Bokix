-- ══════════════════════════════════════════════════════════════════════
-- STEG 4a: APPEN LÄSER OCH SPARAR VIA TABELLERNA (2026-10-25)
-- ══════════════════════════════════════════════════════════════════════
-- Bygger på supabase-2026-10-25-foretag-och-poster.sql (måste vara körd).
--
-- Ett konto i tabelläge (public.storage_modes.mode = 'tables', sätts bara av
-- servern, först för grundarnas eget konto):
--   - läser sina företag ur tabellerna med public.load_companies(): ett
--     anrop, listorna i rätt ordning (position) och en version per post;
--   - sparar med public.save_company_changes(ops, expected): samma
--     ändringslista som apply_user_data_delta, men krockkontrollen görs per
--     post (version) och per företagsrad i stället för på hela kontot. Två
--     personer som ändrar olika poster krockar aldrig.
-- Sparningen lägger in ändringen i blobben precis som apply_user_data_delta,
-- och triggern sync_companies speglar den till tabellerna i samma
-- transaktion (den beprövade vägen). Blobben är alltså fortfarande aktuell,
-- så servern (fakturamejl, Stripe, Zettle, påminnelser, arkivet, inbjudna)
-- fungerar som förut, och att gå tillbaka är att sätta mode = 'blob'.
--
-- Säkerhet: funktionerna kör med ägarens rättigheter (de skriver i tabeller
-- inloggade inte når) och upprätthåller därför själva samma villkor som
-- user_data-reglerna: bara det egna kontot, betalspärren
-- (private.can_write_user_data) och tvåfaktor (private.mfa_ok). Skyddet för
-- kopplingarna (guard_user_data_connections) läser rollen ur inloggningen och
-- gäller därför här också.
--
-- Ta bort igen (inget annat beror på det):
--   DROP FUNCTION IF EXISTS public.save_company_changes(jsonb, jsonb);
--   DROP FUNCTION IF EXISTS public.load_companies();
--   DROP FUNCTION IF EXISTS private.company_payload(uuid);
--   DROP TABLE IF EXISTS public.storage_modes;
--
-- Kör hela filen i Supabase → SQL Editor. Den kan köras flera gånger.

-- ── Läget per konto ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.storage_modes (
  user_id uuid PRIMARY KEY REFERENCES public.user_data (user_id) ON DELETE CASCADE,
  -- Nattkopian (api/_offsiteBackup.js) läser varje tabell sorterad på id.
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  mode text NOT NULL DEFAULT 'blob' CHECK (mode IN ('blob', 'tables')),
  switched_at timestamptz NOT NULL DEFAULT now(),
  note text
);
ALTER TABLE public.storage_modes ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE public.storage_modes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_modes FROM anon, authenticated;
GRANT SELECT ON public.storage_modes TO authenticated;
GRANT ALL ON public.storage_modes TO service_role;
DROP POLICY IF EXISTS "Läs eget läge" ON public.storage_modes;
CREATE POLICY "Läs eget läge" ON public.storage_modes
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── Version per företagsrad ─────────────────────────────────────────────
-- Krockkontrollen för företagsuppgifter, kontoplan och övriga fält.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

-- Samma som i foretag-och-poster.sql, men räknar upp versionen.
CREATE OR REPLACE FUNCTION private.refresh_company_row(p_user uuid, p_key text, p_new jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kinds text[] := private.record_kinds();
  v_lists text[];
  v_extra jsonb;
  v_id uuid;
BEGIN
  SELECT
    coalesce(array_agg(key ORDER BY key) FILTER (WHERE key = ANY (v_kinds) AND jsonb_typeof(value) = 'array'), '{}'::text[]),
    coalesce(jsonb_object_agg(key, value) FILTER (WHERE key NOT IN ('company', 'accounts')
      AND NOT (key = ANY (v_kinds) AND jsonb_typeof(value) = 'array')), '{}'::jsonb)
  INTO v_lists, v_extra
  FROM jsonb_each(p_new);

  INSERT INTO public.companies AS c (owner_user_id, legacy_key, legacy_company_id, settings, accounts, extra, list_fields)
  VALUES (p_user, p_key, p_new -> 'company' ->> 'id', p_new -> 'company', p_new -> 'accounts', v_extra, v_lists)
  ON CONFLICT (owner_user_id, legacy_key) DO UPDATE
    SET legacy_company_id = EXCLUDED.legacy_company_id, settings = EXCLUDED.settings,
        accounts = EXCLUDED.accounts, extra = EXCLUDED.extra, list_fields = EXCLUDED.list_fields,
        version = c.version + 1, deleted_at = NULL, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_company_row(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ── Inläsning ───────────────────────────────────────────────────────────
-- Posterna i listans ordning direkt ur indexet, utan sortering (en sortering
-- per lista skrevs till disk på gratisplanen: 11 s för 26 719 poster).
CREATE INDEX IF NOT EXISTS company_records_by_position
  ON public.company_records (company_id, kind, position, id) WHERE deleted_at IS NULL;

-- Ett företag som delar, för appen att sätta ihop (src/utils/tableStore.js):
-- extra, settings/accounts (has_* skiljer "saknas" från JSON-null), vilka
-- listor som finns, listorna i positionsordning och versionerna i samma
-- ordning: versions.<lista>[i] hör till lists.<lista>[i].
-- json, inte jsonb: databasen klistrar bara ihop texten. Att bygga ett stort
-- jsonb-objekt kostade 24 s för 26 719 poster, json under en sekund.
DROP FUNCTION IF EXISTS private.company_payload(uuid);
CREATE OR REPLACE FUNCTION private.company_payload(p_company uuid)
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
    'list_fields', c.list_fields,
    'lists', (
      SELECT json_object_agg(g.kind, g.data) FROM (
        SELECT r.kind, json_agg(r.data ORDER BY r.position, r.id) AS data
        FROM public.company_records r
        WHERE r.company_id = c.id AND r.deleted_at IS NULL AND r.kind = ANY (c.list_fields)
        GROUP BY r.kind
      ) g),
    'versions', (
      SELECT json_object_agg(g.kind, g.v) FROM (
        SELECT r.kind, json_agg(r.version ORDER BY r.position, r.id) AS v
        FROM public.company_records r
        WHERE r.company_id = c.id AND r.deleted_at IS NULL AND r.kind = ANY (c.list_fields)
        GROUP BY r.kind
      ) g)
  )
  FROM public.companies c
  WHERE c.id = p_company;
$$;

REVOKE ALL ON FUNCTION private.company_payload(uuid) FROM PUBLIC, anon, authenticated;

-- Alla egna företag i ett anrop, plus kontots övriga state (aktivt företag
-- m.m., som fortfarande ligger i blobben) och updated_at.
DROP FUNCTION IF EXISTS public.load_companies();
CREATE OR REPLACE FUNCTION public.load_companies()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT private.mfa_ok() THEN
    RAISE EXCEPTION 'mfa required' USING ERRCODE = '42501';
  END IF;
  SELECT d.updated_at, coalesce(d.state, '{}'::jsonb) - 'companies' AS top INTO v_row
  FROM public.user_data d WHERE d.user_id = v_uid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN json_build_object(
    'updated_at', v_row.updated_at,
    'top', v_row.top,
    'companies', coalesce((
      SELECT json_object_agg(c.legacy_key, private.company_payload(c.id))
      FROM public.companies c
      WHERE c.owner_user_id = v_uid AND c.deleted_at IS NULL
    ), '{}'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.load_companies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.load_companies() TO authenticated;

-- ── Sparning ────────────────────────────────────────────────────────────
-- p_ops: samma ändringslista som apply_user_data_delta (buildStateDelta i
-- src/utils/stateMerge.js). p_expected: vad appen tror finns, per företag:
--   { "<nyckel>": { "company": <companies.version>,
--                   "records": { "<lista>": { "<id>": <version>, … } } } }
-- Ett id som appen tror är nytt finns inte med. Krockregler:
--   - patch: varje post i upsert och remove ska ha samma version som appen
--     tror (en ny post: inte finnas); en post som redan är borttagen när den
--     ska tas bort är ingen krock.
--   - set/unset av en hel lista: hela listans versioner ska stämma.
--   - allt annat i ett företag (företagsuppgifter, kontoplan, vatPeriods …):
--     företagsradens version ska stämma.
--   - set av ett helt företag: företaget får inte finnas (nytt); unset:
--     radens version ska stämma.
-- Vid krock skrivs ingenting och svaret listar vad som krockade; appen
-- hämtar då det färska med load_companies och slår ihop som förut.
-- Annars: { ok, updated_at, versions } med de nya versionerna för det som
-- ändrades, i samma form som p_expected.
CREATE OR REPLACE FUNCTION public.save_company_changes(p_ops jsonb, p_expected jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
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
  IF coalesce((SELECT mode FROM public.storage_modes WHERE user_id = v_uid), 'blob') <> 'tables' THEN
    RAISE EXCEPTION 'not in tables mode' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_ops) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'ops must be an array' USING ERRCODE = '22023';
  END IF;
  p_expected := CASE WHEN jsonb_typeof(p_expected) = 'object' THEN p_expected ELSE '{}'::jsonb END;

  -- Låser kontot: all skrivning (även inbjudna och servern) går via raden,
  -- så sparningar för samma konto sker en i taget.
  SELECT state INTO v_state FROM public.user_data WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no user_data row' USING ERRCODE = '22023';
  END IF;
  v_state := coalesce(v_state, '{}'::jsonb);

  -- 1. Krockkontroll mot tabellerna.
  FOR v_op IN SELECT * FROM jsonb_array_elements(p_ops) LOOP
    v_path := ARRAY(SELECT jsonb_array_elements_text(v_op -> 'path'));
    IF coalesce(cardinality(v_path), 0) = 0 THEN
      RAISE EXCEPTION 'empty path' USING ERRCODE = '22023';
    END IF;
    IF v_path[1] IS DISTINCT FROM 'companies' THEN
      CONTINUE; -- aktivt företag m.m.: personligt, ingen krockkontroll
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

  -- 2. Samma tillämpning som apply_user_data_delta.
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

  -- 3. Skriv blobben; triggern speglar exakt dessa ändringar till tabellerna.
  PERFORM set_config('bokix.delta_ops', jsonb_build_object('user', v_uid, 'ops', p_ops)::text, true);
  UPDATE public.user_data SET state = v_state WHERE user_id = v_uid
  RETURNING updated_at INTO v_updated;

  -- Speglingen får inte misslyckas tyst här: tabellerna är sanningen för
  -- kontot. Loggade den ett fel i den här transaktionen rullas allt tillbaka.
  IF EXISTS (
    SELECT 1 FROM public.system_events
    WHERE kind = 'company_sync_failed' AND created_at >= now() AND detail LIKE '%' || v_uid::text || '%'
  ) THEN
    RAISE EXCEPTION 'sync to tables failed' USING ERRCODE = 'P0001';
  END IF;

  -- 4. De nya versionerna för det som rördes.
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
