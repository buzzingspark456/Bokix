-- ══════════════════════════════════════════════════════════════════════
-- NATTENS JÄMFÖRELSE, ETT KONTO I TAGET (2026-10-25)
-- ══════════════════════════════════════════════════════════════════════
-- public.companies_mismatch() jämförde alla konton i en enda fråga. På
-- bokix-test (30 000 poster) tog det över 8 s och avbröts av databasen; med
-- några hundra kunder hade nattens kontroll slutat fungera. Nu jämförs och
-- rättas ett konto i taget (api/cron/company-copy.js), och bara konton som
-- ändrats sedan förra kontrollen (alla en gång i veckan).
--
-- Bygger på supabase-2026-10-25-foretag-och-poster.sql. Bara service_role.
-- Kör hela filen i Supabase → SQL Editor. Den kan köras flera gånger.

-- ── Fingeravtryck i stället för hela företaget ──────────────────────────
-- Att bygga upp ett stort företag som ett jsonb-objekt för jämförelsen tog
-- över 8 s för 26 719 poster. Ett fingeravtryck per lista räcker och tar en
-- bråkdel: md5 över varje posts id och innehåll (jsonb::text är densamma för
-- samma innehåll, oavsett nyckelordning), i id-ordning, plus listans ordning
-- och antal poster utan id / dubbla id. Allt som inte är listor jämförs som
-- det är.

-- Ett företag ur blobben.
CREATE OR REPLACE FUNCTION private.company_fingerprint_blob(p_company jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH lists AS (
    SELECT f.key AS kind, f.value AS list
    FROM jsonb_each(p_company) f
    WHERE f.key = ANY (private.record_kinds()) AND jsonb_typeof(f.value) = 'array'
  ),
  elems AS (
    SELECT l.kind, e, ord,
      jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> '' AS valid
    FROM lists l, jsonb_array_elements(l.list) WITH ORDINALITY AS t(e, ord)
  ),
  last AS (
    SELECT DISTINCT ON (kind, (e ->> 'id') COLLATE "C") kind, (e ->> 'id') COLLATE "C" AS id, e, ord
    FROM elems WHERE valid
    ORDER BY kind, (e ->> 'id') COLLATE "C", ord DESC
  ),
  per AS (
    SELECT l.kind,
      (SELECT md5(string_agg(x.id || ':' || md5(x.e::text), ',' ORDER BY x.id)) FROM last x WHERE x.kind = l.kind) AS h,
      (SELECT md5(string_agg(x.id, chr(31) ORDER BY x.ord)) FROM last x WHERE x.kind = l.kind) AS o,
      (SELECT count(*) FROM elems y WHERE y.kind = l.kind AND NOT y.valid) AS invalid,
      (SELECT count(*) FROM elems y WHERE y.kind = l.kind AND y.valid) - (SELECT count(*) FROM last x WHERE x.kind = l.kind) AS dupes
    FROM lists l
  )
  SELECT jsonb_build_object(
    'rest', p_company - ARRAY(SELECT kind FROM lists),
    'lists', coalesce((SELECT jsonb_object_agg(kind, jsonb_build_object('h', h, 'o', o, 'invalid', invalid, 'dupes', dupes)) FROM per), '{}'::jsonb)
  );
$$;

-- Samma fingeravtryck ur tabellerna.
CREATE OR REPLACE FUNCTION private.company_fingerprint_tables(p_company uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'rest', c.extra
      || CASE WHEN c.settings IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('company', c.settings) END
      || CASE WHEN c.accounts IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('accounts', c.accounts) END,
    'lists', coalesce((
      SELECT jsonb_object_agg(k, jsonb_build_object(
        'h', (SELECT md5(string_agg((r.id COLLATE "C") || ':' || md5(r.data::text), ',' ORDER BY r.id COLLATE "C"))
              FROM public.company_records r WHERE r.company_id = c.id AND r.kind = k AND r.deleted_at IS NULL),
        'o', (SELECT md5(string_agg(r.id, chr(31) ORDER BY r.position, r.id))
              FROM public.company_records r WHERE r.company_id = c.id AND r.kind = k AND r.deleted_at IS NULL),
        'invalid', 0, 'dupes', 0))
      FROM unnest(c.list_fields) k
    ), '{}'::jsonb)
  )
  FROM public.companies c
  WHERE c.id = p_company;
$$;

REVOKE ALL ON FUNCTION private.company_fingerprint_blob(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.company_fingerprint_tables(uuid) FROM PUBLIC, anon, authenticated;

-- Jämförelsen för ett konto (null = alla, som companies_mismatch()).
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
      AND NOT (jsonb_typeof(c.value) = 'object' AND c.value ? '__shared')
  ),
  tab AS (
    SELECT id, owner_user_id, legacy_key FROM public.companies
    WHERE deleted_at IS NULL AND (p_owner IS NULL OR owner_user_id = p_owner)
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

REVOKE ALL ON FUNCTION public.companies_mismatch_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.companies_mismatch_for(uuid) TO service_role;

-- Den gamla funktionen finns kvar (samma svar), nu via den nya.
CREATE OR REPLACE FUNCTION public.companies_mismatch()
RETURNS TABLE (owner_user_id uuid, legacy_key text, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.companies_mismatch_for(NULL);
$$;

REVOKE ALL ON FUNCTION public.companies_mismatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.companies_mismatch() TO service_role;

-- Rättningen för ett konto: speglar om varje företag som inte stämmer.
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
  FOR r IN SELECT DISTINCT m.owner_user_id, m.legacy_key FROM public.companies_mismatch_for(p_owner) m LOOP
    PERFORM private.sync_company(r.owner_user_id, r.legacy_key,
      (SELECT d.state -> 'companies' -> r.legacy_key FROM public.user_data d WHERE d.user_id = r.owner_user_id),
      NULL);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.companies_resync_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.companies_resync_for(uuid) TO service_role;

-- Konton att kontrollera, i user_id-ordning efter p_after: alla (p_since
-- null) eller bara de vars rad eller företag ändrats sedan p_since.
CREATE INDEX IF NOT EXISTS companies_owner_updated ON public.companies (owner_user_id, updated_at);

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
    AND (
      p_since IS NULL
      OR d.updated_at > p_since
      OR EXISTS (SELECT 1 FROM public.companies c WHERE c.owner_user_id = d.user_id AND c.updated_at > p_since)
    )
  ORDER BY d.user_id
  LIMIT greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

REVOKE ALL ON FUNCTION public.companies_owners_to_check(timestamptz, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.companies_owners_to_check(timestamptz, uuid, integer) TO service_role;
