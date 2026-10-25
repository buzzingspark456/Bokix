-- ══════════════════════════════════════════════════════════════════════
-- FÖRETAG OCH POSTER I EGNA TABELLER, STEG 1–2: SKUGGKOPIA (2026-10-25)
-- ══════════════════════════════════════════════════════════════════════
-- Långsiktig lösning på blobben (user_data.state). Målbilden:
--   - public.companies: en rad per företag med eget fast id (uuid).
--   - public.company_records: en rad per post i ALLA företagets listor
--     (verifikationer, fakturor, kvitton, kontakter, lön …), med kind.
--   - Appen laddar bara det aktiva företaget och sparar per post; inbjudna
--     får åtkomst direkt i databasen via company_members.
--   - Kvar i user_data blir bara det personliga (aktivt företag m.m.).
--
-- Den här filen är steg 1–2: tabellerna fylls som SKUGGKOPIA. Blobben är
-- fortfarande sanningen och appen läser och sparar som förut. En trigger
-- på user_data speglar varje ändring hit, och public.companies_mismatch()
-- jämför (nattkopian larmar om något skiljer). Den ersätter steg A
-- (public.verifications, supabase-2026-10-25-verifikationer-steg-a.sql),
-- som tas bort sist i filen.
--
-- Hur ett företag i blobben delas upp:
--   - company (företagsuppgifterna)      → companies.settings
--   - accounts (kontoplanen, nyckel code) → companies.accounts
--   - listorna i private.record_kinds()   → company_records, en rad per post
--   - allt annat (vatPeriods, basVersion, okända fält) → companies.extra
--   companies.list_fields minns vilka listor som fanns, även tomma, så att
--   företaget kan byggas ihop exakt (private.company_from_tables).
--   Finns det inget fält alls saknas nyckeln; ett fält med värdet null
--   sparas som JSON-null. Det är skillnad, och den bevaras.
--
-- Regler för listorna (samma som jämförelsen):
--   - En post utan id, eller som inte är ett objekt, speglas inte (appen
--     skapar alltid id; jämförelsen larmar om det ändå händer).
--   - Samma id två gånger: den sista gäller (som applyRecordPatch).
--   - Ordningen i listan sparas i position (Kunder, Artiklar och Tid visar
--     listan i sparad ordning), och jämförelsen kontrollerar den.
--   - En borttagen post eller ett borttaget företag får deleted_at och
--     finns kvar i 30 dagar som kopia. Kommer det tillbaka blir det aktivt
--     igen. Äldre borttagna rensas vid nästa ändring.
--   - Företag med __shared speglas inte (de ägs av någon annan).
--   - version räknas upp vid varje ändring av en post (för krockkontroll
--     per post när appen sparar direkt hit).
--
-- Kvar till senare steg (inte glömt): listorna som ligger inuti
-- företagsuppgifterna (company.fixedAssets, accruals, stockMovements,
-- bankAccounts) flyttar till egna poster, kontoplanen sparas som
-- avvikelser mot BAS, hemligheter i företagsuppgifterna (nycklar, tokens)
-- flyttar till en tabell bara servern når, och ägarkopplingen går från
-- user_data till auth.users när blobben är tömd.
--
-- Raderna hör till user_data-raden (ON DELETE CASCADE), som blobben:
-- det finns user_data-rader vars konto är raderat i auth.users.
--
-- Säkerhet: ägaren kan bara LÄSA sina egna rader (samma villkor och samma
-- tvåfaktorskrav som user_data). Ingen inloggad skriver direkt; bara
-- triggern (SECURITY DEFINER) och service_role.
--
-- Hur triggern vet vad som ändrats:
--   - Appens vanliga sparning (apply_user_data_delta, omskriven längre ner
--     med en rad till) lämnar sina ändringar i bokix.delta_ops. Då skrivs
--     bara de posterna, utan att kontot packas upp: lika snabbt för ett
--     företag med 50 000 verifikationer som med 50.
--   - Allt annat (hel sparning, servern, inbjudna via set_company_field)
--     jämförs med förra versionen, bara för företag som ändrats.
--
-- Triggern får aldrig stoppa en sparning: fel rullar bara tillbaka
-- speglingen och loggas i system_events (company_sync_failed). Nattkopian
-- kör public.companies_resync(), som speglar om varje företag som inte
-- stämmer, och larmar om något ändå skiljer efteråt.
--
-- Ta bort allt igen:
--   DROP TRIGGER IF EXISTS sync_companies ON public.user_data;
--   DROP TABLE IF EXISTS public.company_records, public.companies;
--
-- Kör hela filen i Supabase → SQL Editor. Den fyller tabellerna från dagens
-- blobbar och kan köras flera gånger.

-- Företagsfälten som är listor med poster. Ny lista i appen = lägg till här
-- (och i COMPANY_WRITABLE_FIELDS, src/utils/companyFields.js).
CREATE OR REPLACE FUNCTION private.record_kinds()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ARRAY[
    'verifications', 'invoices', 'quotes', 'expenses', 'supplierInvoices', 'contacts',
    'articles', 'projects', 'timeEntries', 'timeReportStatuses', 'billableTimeEntries',
    'recurringTemplates', 'verificationTemplates', 'reviewHistory',
    'employees', 'payrollRuns', 'agiReports',
    'bankTransactions', 'stripeLedgerEvents', 'zettleLedgerEvents'
  ]::text[];
$$;

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.user_data (user_id) ON DELETE CASCADE,
  -- Nyckeln i state.companies, och company.id inne i företaget. Äldre konton
  -- har olika värden i de två (se findCompanyEntry i api/_auth.js).
  legacy_key text NOT NULL,
  legacy_company_id text,
  settings jsonb,
  accounts jsonb,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  list_fields text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (owner_user_id, legacy_key)
);
CREATE INDEX IF NOT EXISTS companies_legacy_company_id ON public.companies (legacy_company_id);
-- Krockkontrollen för företagsraden (steg 4a, supabase-2026-10-25-steg-4a.sql).
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.company_records (
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  kind text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  record_date text,
  -- Platsen i listan (blobbens ordning). Bara den inbördes ordningen betyder
  -- något: nya poster sist får max+1, nya först min-1, så att ingen annan
  -- post behöver skrivas om. Hela listan bytt ger 1, 2, 3 …
  position bigint,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (company_id, kind, id),
  -- En post är några kB; 1 MB är ett tak mot skräp, inte en gräns i praktiken.
  CONSTRAINT company_records_data_size CHECK (pg_column_size(data) < 1048576)
);
-- Fanns inte i första versionen av filen (körd 2026-10-25).
ALTER TABLE public.company_records ADD COLUMN IF NOT EXISTS position bigint;

CREATE INDEX IF NOT EXISTS company_records_by_date
  ON public.company_records (company_id, kind, record_date) WHERE deleted_at IS NULL;
-- Rensningen av gamla borttagna poster körs vid varje ändring; utan det här
-- läste den igenom alla företagets poster varje gång.
CREATE INDEX IF NOT EXISTS company_records_deleted
  ON public.company_records (company_id, deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.companies, public.company_records FROM anon, authenticated;
GRANT SELECT ON public.companies, public.company_records TO authenticated;
GRANT ALL ON public.companies, public.company_records TO service_role;

DROP POLICY IF EXISTS "Läs egna företag" ON public.companies;
CREATE POLICY "Läs egna företag" ON public.companies
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_user_id);
DROP POLICY IF EXISTS "Tvåfaktor krävs" ON public.companies;
CREATE POLICY "Tvåfaktor krävs" ON public.companies
  AS RESTRICTIVE TO authenticated
  USING ((SELECT private.mfa_ok()));

DROP POLICY IF EXISTS "Läs egna företags poster" ON public.company_records;
CREATE POLICY "Läs egna företags poster" ON public.company_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_records.company_id AND c.owner_user_id = (SELECT auth.uid())
  ));
DROP POLICY IF EXISTS "Tvåfaktor krävs" ON public.company_records;
CREATE POLICY "Tvåfaktor krävs" ON public.company_records
  AS RESTRICTIVE TO authenticated
  USING ((SELECT private.mfa_ok()));

-- En lista → company_records för ett företag och en kind. Listan packas upp
-- en gång och jämförs mot företagets rader i ett svep (FULL JOIN): nya och
-- ändrade skrivs, saknade får deleted_at. p_list som inte är en lista (eller
-- null) betyder att listan är borta: alla poster får deleted_at.
CREATE OR REPLACE FUNCTION private.sync_company_records(p_company uuid, p_kind text, p_list jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_list jsonb := CASE WHEN jsonb_typeof(p_list) = 'array' THEN p_list ELSE '[]'::jsonb END;
  v_changed bigint;
BEGIN
  WITH n AS (
    SELECT DISTINCT ON ((e ->> 'id') COLLATE "C") (e ->> 'id') COLLATE "C" AS id, e, ord
    FROM jsonb_array_elements(v_list) WITH ORDINALITY AS t(e, ord)
    WHERE jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> ''
    ORDER BY (e ->> 'id') COLLATE "C", ord DESC
  ),
  cur AS (
    SELECT r.id COLLATE "C" AS id, r.data, r.deleted_at, r.position
    FROM public.company_records r
    WHERE r.company_id = p_company AND r.kind = p_kind
  ),
  diff AS (
    SELECT coalesce(n.id, cur.id) AS id, n.e, n.ord
    FROM n FULL JOIN cur ON cur.id = n.id
    WHERE (n.id IS NULL AND cur.deleted_at IS NULL)
       OR (n.id IS NOT NULL AND (cur.id IS NULL OR cur.deleted_at IS NOT NULL
           OR cur.data IS DISTINCT FROM n.e OR cur.position IS DISTINCT FROM n.ord))
  ),
  upserted AS (
    INSERT INTO public.company_records AS r (company_id, kind, id, data, record_date, position)
    SELECT p_company, p_kind, diff.id, diff.e, diff.e ->> 'date', diff.ord
    FROM diff WHERE diff.e IS NOT NULL
    ON CONFLICT (company_id, kind, id) DO UPDATE
      SET data = EXCLUDED.data, record_date = EXCLUDED.record_date, position = EXCLUDED.position,
          -- Bara en ändring av innehållet räknar upp versionen, inte en flytt.
          version = r.version + CASE WHEN r.data IS DISTINCT FROM EXCLUDED.data OR r.deleted_at IS NOT NULL THEN 1 ELSE 0 END,
          deleted_at = NULL, updated_at = now()
    RETURNING 1
  ),
  gone AS (
    UPDATE public.company_records r
    SET deleted_at = now(), updated_at = now(), version = r.version + 1
    FROM diff
    WHERE diff.e IS NULL AND r.company_id = p_company AND r.kind = p_kind AND r.id = diff.id
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM upserted) + (SELECT count(*) FROM gone) INTO v_changed;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_company_records(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Företagsraden (settings, accounts, extra, list_fields) ur ett företag i
-- blobben. Skapar raden eller gör den aktiv igen. Ger företagets id.
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

-- Ett företag ur blobben → companies + company_records, genom att jämföra med
-- förra versionen (p_old, null vid första speglingen). Används när det inte
-- är känt vad som ändrats: hel sparning, servern, inbjudna och rättningen.
-- p_new null (företaget borta ur blobben) ger deleted_at.
CREATE OR REPLACE FUNCTION private.sync_company(p_user uuid, p_key text, p_new jsonb, p_old jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kinds text[] := private.record_kinds();
  v_id uuid;
  v_deleted timestamptz;
  v_full boolean;
  v_changed_kinds text[];
  v_row_changed boolean;
  v_kind text;
BEGIN
  IF p_new IS NULL OR jsonb_typeof(p_new) <> 'object' THEN
    UPDATE public.companies SET deleted_at = now(), updated_at = now()
    WHERE owner_user_id = p_user AND legacy_key = p_key AND deleted_at IS NULL;
    RETURN;
  END IF;

  SELECT id, deleted_at INTO v_id, v_deleted
  FROM public.companies WHERE owner_user_id = p_user AND legacy_key = p_key;
  -- Nytt här, borttaget förut eller ingen förra version: spegla allt.
  v_full := v_id IS NULL OR v_deleted IS NOT NULL OR p_old IS NULL OR jsonb_typeof(p_old) <> 'object';

  -- Vilka fält har ändrats? Företaget gås igenom en gång. En lista som bara
  -- bytt innehåll rör inte företagsraden; allt annat gör det, också en lista
  -- som dykt upp, försvunnit eller bytt typ (list_fields/extra).
  SELECT
    coalesce(array_agg(f.key) FILTER (WHERE f.key = ANY (v_kinds)), '{}'::text[]),
    coalesce(bool_or(NOT (f.key = ANY (v_kinds))
      OR f.nv IS NULL OR f.ov IS NULL
      OR jsonb_typeof(f.nv) <> 'array' OR jsonb_typeof(f.ov) <> 'array'), false)
  INTO v_changed_kinds, v_row_changed
  FROM (
    SELECT coalesce(n.key, o.key) AS key, n.value AS nv, o.value AS ov
    FROM jsonb_each(p_new) n
    FULL JOIN jsonb_each(CASE WHEN v_full THEN '{}'::jsonb ELSE p_old END) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value
  ) f;
  IF v_full THEN
    v_row_changed := true;
    v_changed_kinds := v_kinds; -- även listor som saknas: gamla poster får deleted_at
  END IF;

  IF v_row_changed THEN
    v_id := private.refresh_company_row(p_user, p_key, p_new);
  END IF;

  FOREACH v_kind IN ARRAY v_changed_kinds LOOP
    PERFORM private.sync_company_records(v_id, v_kind,
      CASE WHEN jsonb_typeof(p_new -> v_kind) = 'array' THEN p_new -> v_kind END);
  END LOOP;

  IF cardinality(v_changed_kinds) > 0 THEN
    DELETE FROM public.company_records
    WHERE company_id = v_id AND deleted_at < now() - interval '30 days';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_company(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- Hela kontot genom jämförelse: bara företag som ändrats, i en genomgång.
-- p_keys begränsar till vissa företag (null = alla).
CREATE OR REPLACE FUNCTION private.sync_companies_by_compare(p_user uuid, p_new_state jsonb, p_old_state jsonb, p_keys text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new jsonb := CASE WHEN jsonb_typeof(p_new_state -> 'companies') = 'object' THEN p_new_state -> 'companies' ELSE '{}'::jsonb END;
  v_old jsonb := CASE WHEN jsonb_typeof(p_old_state -> 'companies') = 'object' THEN p_old_state -> 'companies' ELSE '{}'::jsonb END;
  r record;
BEGIN
  FOR r IN
    SELECT coalesce(n.key, o.key) AS key, n.value AS nv, o.value AS ov
    FROM jsonb_each(v_new) n
    FULL JOIN jsonb_each(v_old) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value
      AND (p_keys IS NULL OR coalesce(n.key, o.key) = ANY (p_keys))
  LOOP
    IF jsonb_typeof(r.nv) = 'object' AND r.nv ? '__shared' THEN
      CONTINUE;
    END IF;
    PERFORM private.sync_company(p_user, r.key, r.nv, r.ov);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_companies_by_compare(uuid, jsonb, jsonb, text[]) FROM PUBLIC, anon, authenticated;

-- En patch på en lista (som applyRecordPatch / apply_keyed_patch): poster i
-- p_upsert skrivs om de är nya eller ändrade, id i p_remove får deleted_at.
-- Står ett id i båda gäller samma regel som i apply_keyed_patch: fanns posten
-- redan tas den bort, var den ny läggs den till.
-- Den första versionen saknade p_prepend (ordningen sparades inte då).
DROP FUNCTION IF EXISTS private.patch_company_records(uuid, text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION private.patch_company_records(p_company uuid, p_kind text, p_upsert jsonb, p_remove jsonb, p_prepend boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Bara poster som finns (aktiva) kan tas bort; ordningen spelar roll, så
  -- listan tas fram innan något skrivs.
  v_remove text[] := ARRAY(
    SELECT r.id FROM public.company_records r
    WHERE r.company_id = p_company AND r.kind = p_kind AND r.deleted_at IS NULL
      AND r.id IN (
        SELECT value #>> '{}' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_remove) = 'array' THEN p_remove ELSE '[]'::jsonb END)
      )
  );
BEGIN
  -- Platsen i listan, som i apply_keyed_patch: en post som finns behåller sin
  -- plats; nya läggs sist (max+1 …) eller, med p_prepend, först (… min-1) i
  -- den ordning de står i p_upsert.
  WITH u AS (
    SELECT DISTINCT ON (e ->> 'id') e ->> 'id' AS id, e, ord
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_upsert) = 'array' THEN p_upsert ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, ord)
    WHERE jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> ''
    ORDER BY e ->> 'id', ord DESC
  ),
  act AS (
    SELECT r.id, r.position FROM public.company_records r
    WHERE r.company_id = p_company AND r.kind = p_kind AND r.deleted_at IS NULL
  ),
  bounds AS (
    SELECT coalesce(max(position), 0) AS mx, coalesce(min(position), 1) AS mn FROM act
  ),
  fresh AS (
    SELECT u.id, row_number() OVER (ORDER BY u.ord) AS rn, count(*) OVER () AS cnt
    FROM u WHERE NOT EXISTS (SELECT 1 FROM act WHERE act.id = u.id)
  )
  INSERT INTO public.company_records AS r (company_id, kind, id, data, record_date, position)
  SELECT p_company, p_kind, u.id, u.e, u.e ->> 'date',
    CASE WHEN act.id IS NOT NULL THEN act.position
         WHEN p_prepend THEN b.mn - f.cnt + f.rn - 1
         ELSE b.mx + f.rn END
  FROM u
  LEFT JOIN act ON act.id = u.id
  LEFT JOIN fresh f ON f.id = u.id
  CROSS JOIN bounds b
  WHERE NOT (u.id = ANY (v_remove))
  ON CONFLICT (company_id, kind, id) DO UPDATE
    SET data = EXCLUDED.data, record_date = EXCLUDED.record_date, position = EXCLUDED.position,
        version = r.version + CASE WHEN r.data IS DISTINCT FROM EXCLUDED.data OR r.deleted_at IS NOT NULL THEN 1 ELSE 0 END,
        deleted_at = NULL, updated_at = now()
    WHERE r.data IS DISTINCT FROM EXCLUDED.data OR r.deleted_at IS NOT NULL OR r.position IS DISTINCT FROM EXCLUDED.position;

  IF cardinality(v_remove) > 0 THEN
    UPDATE public.company_records r
    SET deleted_at = now(), updated_at = now(), version = r.version + 1
    WHERE r.company_id = p_company AND r.kind = p_kind AND r.id = ANY (v_remove) AND r.deleted_at IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.patch_company_records(uuid, text, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- Appens vanliga sparning (apply_user_data_delta) vet exakt vad som ändrats.
-- Då speglas bara det, utan att blobben packas upp och jämförs: en ny
-- verifikation kostar lika lite i ett företag med 50 som med 50 000.
-- Det som inte går att uttrycka exakt (ett helt företag bytt, en ändring
-- djupt inne i en lista, ett företag som saknas här) jämförs i stället.
CREATE OR REPLACE FUNCTION private.sync_companies_from_ops(p_user uuid, p_ops jsonb, p_new_state jsonb, p_old_state jsonb)
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
  v_id uuid;
  v_lists text[];
  v_compare text[] := '{}'::text[];
  v_refresh text[] := '{}'::text[];
  v_touched uuid[] := '{}'::uuid[];
BEGIN
  FOR v_op IN SELECT * FROM jsonb_array_elements(p_ops) LOOP
    v_path := ARRAY(SELECT jsonb_array_elements_text(v_op -> 'path'));
    IF v_path[1] IS DISTINCT FROM 'companies' THEN
      CONTINUE; -- aktivt företag m.m. speglas inte
    END IF;
    IF cardinality(v_path) = 1 THEN
      PERFORM private.sync_companies_by_compare(p_user, p_new_state, p_old_state, NULL);
      RETURN;
    END IF;
    v_key := v_path[2];
    IF cardinality(v_path) = 2 OR v_key = ANY (v_compare) THEN
      v_compare := array_append(v_compare, v_key);
      CONTINUE;
    END IF;
    SELECT id, list_fields INTO v_id, v_lists
    FROM public.companies WHERE owner_user_id = p_user AND legacy_key = v_key AND deleted_at IS NULL;
    IF v_id IS NULL THEN
      v_compare := array_append(v_compare, v_key);
      CONTINUE;
    END IF;
    v_field := v_path[3];

    IF v_field = ANY (v_kinds) THEN
      IF cardinality(v_path) > 3 THEN
        v_compare := array_append(v_compare, v_key);
      ELSIF v_op ->> 'op' = 'patch' THEN
        PERFORM private.patch_company_records(v_id, v_field, v_op -> 'upsert', v_op -> 'remove',
          coalesce((v_op ->> 'prepend')::boolean, false));
        v_touched := array_append(v_touched, v_id);
        IF NOT (v_field = ANY (v_lists)) THEN
          v_refresh := array_append(v_refresh, v_key);
        END IF;
      ELSIF v_op ->> 'op' = 'set' AND jsonb_typeof(v_op -> 'value') = 'array' THEN
        PERFORM private.sync_company_records(v_id, v_field, v_op -> 'value');
        v_touched := array_append(v_touched, v_id);
        IF NOT (v_field = ANY (v_lists)) THEN
          v_refresh := array_append(v_refresh, v_key);
        END IF;
      ELSIF v_op ->> 'op' IN ('set', 'unset') THEN
        PERFORM private.sync_company_records(v_id, v_field, NULL);
        v_touched := array_append(v_touched, v_id);
        v_refresh := array_append(v_refresh, v_key);
      ELSE
        v_compare := array_append(v_compare, v_key);
      END IF;
    ELSE
      -- Företagsuppgifter, kontoplanen, vatPeriods …: företagsraden.
      v_refresh := array_append(v_refresh, v_key);
    END IF;
  END LOOP;

  FOR v_key IN SELECT DISTINCT k FROM unnest(v_refresh) k WHERE NOT (k = ANY (v_compare)) LOOP
    IF jsonb_typeof(p_new_state -> 'companies' -> v_key) = 'object'
       AND NOT (p_new_state -> 'companies' -> v_key ? '__shared') THEN
      PERFORM private.refresh_company_row(p_user, v_key, p_new_state -> 'companies' -> v_key);
    ELSE
      v_compare := array_append(v_compare, v_key);
    END IF;
  END LOOP;

  IF cardinality(v_compare) > 0 THEN
    PERFORM private.sync_companies_by_compare(p_user, p_new_state, p_old_state, v_compare);
  END IF;

  DELETE FROM public.company_records
  WHERE company_id = ANY (v_touched) AND deleted_at < now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION private.sync_companies_from_ops(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

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

-- Radering av user_data-raden sköts av ON DELETE CASCADE.
DROP TRIGGER IF EXISTS sync_companies ON public.user_data;
CREATE TRIGGER sync_companies
  AFTER INSERT OR UPDATE OF state ON public.user_data
  FOR EACH ROW EXECUTE FUNCTION private.sync_companies();

-- ── Jämförelsen ─────────────────────────────────────────────────────────
-- Ett företag i jämförbar form: listorna blir objekt med posterna under sina
-- id, plus ett fingeravtryck av ordningen (__ordning). Allt annat lämnas som
-- det är.
-- Poster som speglingen inte kan ta (utan id, inte objekt, samma id två
-- gånger) räknas under __utan_id / __dubbla_id. Tabellerna har aldrig de
-- nycklarna, så sådana poster ger alltid en skillnad i stället för att
-- försvinna tyst.
CREATE OR REPLACE FUNCTION private.canonical_company(p_company jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_object_agg(f.key, CASE
      WHEN f.key = ANY (private.record_kinds()) AND jsonb_typeof(f.value) = 'array' THEN (
        SELECT coalesce((
            SELECT jsonb_object_agg(x.id, x.e)
              || jsonb_build_object('__ordning', md5(string_agg(x.id, chr(31) ORDER BY x.ord)))
            FROM (
              SELECT DISTINCT ON (e ->> 'id') e ->> 'id' AS id, e, ord
              FROM jsonb_array_elements(f.value) WITH ORDINALITY AS t(e, ord)
              WHERE jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> ''
              ORDER BY e ->> 'id', ord DESC
            ) x
          ), '{}'::jsonb)
          || CASE WHEN s.invalid > 0 THEN jsonb_build_object('__utan_id', s.invalid) ELSE '{}'::jsonb END
          || CASE WHEN s.dupes > 0 THEN jsonb_build_object('__dubbla_id', s.dupes) ELSE '{}'::jsonb END
        FROM (
          SELECT
            count(*) FILTER (WHERE NOT (jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> '')) AS invalid,
            count(*) FILTER (WHERE jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> '')
              - count(DISTINCT e ->> 'id') FILTER (WHERE jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> '') AS dupes
          FROM jsonb_array_elements(f.value) e
        ) s)
      ELSE f.value END), '{}'::jsonb)
  FROM jsonb_each(p_company) f;
$$;

-- Samma form byggd ur tabellerna.
CREATE OR REPLACE FUNCTION private.company_from_tables(p_company uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT c.extra
    || CASE WHEN c.settings IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('company', c.settings) END
    || CASE WHEN c.accounts IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('accounts', c.accounts) END
    || coalesce((
      SELECT jsonb_object_agg(k, coalesce((
        SELECT jsonb_object_agg(r.id, r.data)
          || jsonb_build_object('__ordning', md5(string_agg(r.id, chr(31) ORDER BY r.position, r.id)))
        FROM public.company_records r
        WHERE r.company_id = c.id AND r.kind = k AND r.deleted_at IS NULL
      ), '{}'::jsonb))
      FROM unnest(c.list_fields) k
    ), '{}'::jsonb)
  FROM public.companies c
  WHERE c.id = p_company;
$$;

-- Ett företag per rad där tabellerna inte stämmer med blobben. Tom = allt
-- stämmer. reason: saknas_i_tabellerna, saknas_i_blobben, olika, eller
-- poster_kvar (aktiva poster på ett borttaget företag eller i en lista som
-- inte finns).
-- SECURITY DEFINER: hjälpfunktionerna ligger i private, som service_role inte
-- når. Bara service_role får köra den (se GRANT nedan).
CREATE OR REPLACE FUNCTION public.companies_mismatch()
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
    WHERE NOT (jsonb_typeof(c.value) = 'object' AND c.value ? '__shared')
  ),
  tab AS (
    SELECT id, owner_user_id, legacy_key FROM public.companies WHERE deleted_at IS NULL
  )
  SELECT coalesce(b.user_id, t.owner_user_id), coalesce(b.key, t.legacy_key),
    CASE WHEN t.id IS NULL THEN 'saknas_i_tabellerna'
         WHEN b.key IS NULL THEN 'saknas_i_blobben'
         ELSE 'olika' END
  FROM blob b
  FULL JOIN tab t ON t.owner_user_id = b.user_id AND t.legacy_key = b.key
  WHERE t.id IS NULL OR b.key IS NULL
     OR (jsonb_typeof(b.value) = 'object' AND private.canonical_company(b.value) IS DISTINCT FROM private.company_from_tables(t.id))
     OR jsonb_typeof(b.value) <> 'object'
  UNION ALL
  -- Ett borttaget företag behåller sina poster som de var (de raderas med
  -- företaget efter 30 dagar). Ett aktivt företag får bara ha aktiva poster
  -- i listor som finns.
  SELECT c.owner_user_id, c.legacy_key, 'poster_kvar'
  FROM public.companies c
  WHERE c.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM public.company_records r
    WHERE r.company_id = c.id AND r.deleted_at IS NULL AND NOT (r.kind = ANY (c.list_fields))
  );
$$;

REVOKE ALL ON FUNCTION public.companies_mismatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.companies_mismatch() TO service_role;
REVOKE ALL ON FUNCTION private.canonical_company(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.company_from_tables(uuid) FROM PUBLIC, anon, authenticated;

-- ── Appens sparning talar om vad som ändrats ────────────────────────────
-- Samma funktion som i supabase-2026-10-17-delta-sparning.sql, med en rad till
-- (set_config före UPDATE). Rättigheterna är oförändrade.
CREATE OR REPLACE FUNCTION public.apply_user_data_delta(p_expected_updated_at timestamptz, p_ops jsonb)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_state jsonb;
  v_op jsonb;
  v_path text[];
  v_parent text[];
  v_updated timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT state INTO v_state
  FROM public.user_data
  WHERE user_id = v_uid AND updated_at = p_expected_updated_at
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL; -- någon annan har skrivit sedan klienten läste: slå ihop i appen
  END IF;
  v_state := coalesce(v_state, '{}'::jsonb);

  FOR v_op IN SELECT * FROM jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) LOOP
    v_path := ARRAY(SELECT jsonb_array_elements_text(v_op -> 'path'));
    IF coalesce(array_length(v_path, 1), 0) = 0 THEN
      RAISE EXCEPTION 'empty path' USING ERRCODE = '22023';
    END IF;
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

  -- Talar om för speglingen till companies/company_records (private.sync_companies,
  -- supabase-2026-10-25-foretag-och-poster.sql) exakt vad som ändrats, så att
  -- den slipper jämföra hela kontot. Gäller bara den här transaktionen.
  PERFORM set_config('bokix.delta_ops', jsonb_build_object('user', v_uid, 'ops', p_ops)::text, true);

  UPDATE public.user_data
  SET state = v_state
  WHERE user_id = v_uid
  RETURNING updated_at INTO v_updated;
  RETURN v_updated;
END;
$$;

-- ── Rättning ────────────────────────────────────────────────────────────
-- Speglar om varje företag som jämförelsen hittar, helt och hållet. Körs av
-- nattkopian (api/_companyCopy.js) innan den larmar; det som ändå inte
-- stämmer efteråt (t.ex. poster utan id) larmar.
CREATE OR REPLACE FUNCTION public.companies_resync()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  v_n integer := 0;
BEGIN
  FOR r IN SELECT DISTINCT m.owner_user_id, m.legacy_key FROM public.companies_mismatch() m LOOP
    PERFORM private.sync_company(r.owner_user_id, r.legacy_key,
      (SELECT d.state -> 'companies' -> r.legacy_key FROM public.user_data d WHERE d.user_id = r.owner_user_id),
      NULL);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.companies_resync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.companies_resync() TO service_role;

-- ── Fyll tabellerna från dagens blobbar ─────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT d.user_id, c.key, c.value
    FROM public.user_data d
    CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(d.state -> 'companies') = 'object' THEN d.state -> 'companies' ELSE '{}'::jsonb END) c
    WHERE NOT (jsonb_typeof(c.value) = 'object' AND c.value ? '__shared')
  LOOP
    PERFORM private.sync_company(r.user_id, r.key, r.value, NULL);
  END LOOP;
END;
$$;

-- ── Steg A ersätts ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS sync_verifications ON public.user_data;
DROP FUNCTION IF EXISTS private.sync_verifications();
DROP FUNCTION IF EXISTS private.sync_company_verifications(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.verifications_mismatch();
DROP TABLE IF EXISTS public.verifications;
