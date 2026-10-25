-- ══════════════════════════════════════════════════════════════════════
-- VERIFIKATIONER I EGEN TABELL, STEG A: SKUGGKOPIA (2026-10-25)
-- ══════════════════════════════════════════════════════════════════════
-- Verifikationerna ligger i dag i user_data.state (blobben), en lista per
-- företag. Det är den del som växer: 10 000 verifikationer är 6–7 MB som
-- laddas och sparas som en klump. Målet är en rad per verifikation.
--
-- Steg A ändrar INGENTING för appen. Blobben är fortfarande sanningen:
-- appen läser och sparar som förut. En trigger på user_data kopierar varje
-- ändring av ett företags verifikationer till public.verifications, så att
-- tabellen kan jämföras mot blobben (public.verifications_mismatch) i
-- veckor innan något läser från den (steg B).
--
-- Triggern får aldrig stoppa en sparning. Allt den gör ligger i ett eget
-- undantagsblock: går något fel rullas bara kopieringen tillbaka, felet
-- loggas i system_events (verif_sync_failed) och sparningen går igenom.
-- Nästa ändring av samma företag kopierar hela listan på nytt, så ett
-- missat steg rättar sig självt.
--
-- Regler, samma som jämförelsen använder:
--   - En post utan id (eller som inte är ett objekt) hoppas över.
--   - Förekommer samma id två gånger gäller den sista (som applyRecordPatch).
--   - Företag med __shared kopieras inte (de ägs av någon annan och ska
--     aldrig ligga i den här raden).
--   - Försvinner en verifikation ur listan sätts deleted_at, raden finns kvar
--     i 30 dagar som kopia och rensas sedan vid nästa ändring av företaget.
--   - Raderas user_data-raden raderas företagets rader här också (blobbens
--     sista version finns i user_data_history, och arkivet görs före
--     radering som förut). Raderas användaren tar ON DELETE CASCADE resten.
--
-- Säkerhet: ägaren kan bara LÄSA sina egna rader (samma villkor och samma
-- tvåfaktorskrav som user_data). Ingen inloggad kan skriva direkt; bara
-- triggern (SECURITY DEFINER) och service_role. Inbjudna läser som förut
-- via api/company-access.js med servernyckeln.
--
-- Ta bort steg A helt (inget annat beror på det än):
--   DROP TRIGGER IF EXISTS sync_verifications ON public.user_data;
--   DROP TABLE IF EXISTS public.verifications;
--
-- Kör hela filen i Supabase → SQL Editor. Den fyller också tabellen från
-- dagens blobbar (sist i filen) och kan köras flera gånger.

CREATE TABLE IF NOT EXISTS public.verifications (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id text NOT NULL,
  id text NOT NULL,
  series text,
  number text,
  ver_date text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, company_id, id),
  -- En enskild verifikation är några kB; 1 MB är ett tak mot skräp, inte en gräns i praktiken.
  CONSTRAINT verifications_data_size CHECK (pg_column_size(data) < 1048576)
);
CREATE INDEX IF NOT EXISTS verifications_company_date
  ON public.verifications (user_id, company_id, ver_date) WHERE deleted_at IS NULL;

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verifications FROM anon, authenticated;
GRANT SELECT ON public.verifications TO authenticated;
GRANT ALL ON public.verifications TO service_role;

DROP POLICY IF EXISTS "Läs egna verifikationer" ON public.verifications;
CREATE POLICY "Läs egna verifikationer" ON public.verifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Tvåfaktor krävs" ON public.verifications;
CREATE POLICY "Tvåfaktor krävs" ON public.verifications
  AS RESTRICTIVE TO authenticated
  USING ((SELECT private.mfa_ok()));

-- Ett företags lista → tabellen. Bara de rader som faktiskt ändrats skrivs.
-- Listan packas upp en gång och jämförs mot företagets rader i ett svep
-- (FULL JOIN): nya och ändrade skrivs, saknade får deleted_at. COLLATE "C"
-- gör sorteringen av id snabb; likhet är densamma som med språkets ordning.
CREATE OR REPLACE FUNCTION private.sync_company_verifications(p_user uuid, p_company text, p_list jsonb)
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
    SELECT DISTINCT ON ((e ->> 'id') COLLATE "C") (e ->> 'id') COLLATE "C" AS id, e
    FROM jsonb_array_elements(v_list) WITH ORDINALITY AS t(e, ord)
    WHERE jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> ''
    ORDER BY (e ->> 'id') COLLATE "C", ord DESC
  ),
  cur AS (
    SELECT v.id COLLATE "C" AS id, v.data, v.deleted_at
    FROM public.verifications v
    WHERE v.user_id = p_user AND v.company_id = p_company
  ),
  diff AS (
    SELECT coalesce(n.id, cur.id) AS id, n.e
    FROM n FULL JOIN cur ON cur.id = n.id
    WHERE (n.id IS NULL AND cur.deleted_at IS NULL)
       OR (n.id IS NOT NULL AND (cur.id IS NULL OR cur.deleted_at IS NOT NULL OR cur.data IS DISTINCT FROM n.e))
  ),
  upserted AS (
    INSERT INTO public.verifications (user_id, company_id, id, series, number, ver_date, data)
    SELECT p_user, p_company, diff.id, diff.e ->> 'series', diff.e ->> 'number', diff.e ->> 'date', diff.e
    FROM diff WHERE diff.e IS NOT NULL
    ON CONFLICT (user_id, company_id, id) DO UPDATE
      SET data = EXCLUDED.data, series = EXCLUDED.series, number = EXCLUDED.number,
          ver_date = EXCLUDED.ver_date, deleted_at = NULL, updated_at = now()
    RETURNING 1
  ),
  gone AS (
    UPDATE public.verifications v
    SET deleted_at = now(), updated_at = now()
    FROM diff
    WHERE diff.e IS NULL AND v.user_id = p_user AND v.company_id = p_company AND v.id = diff.id
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM upserted) + (SELECT count(*) FROM gone) INTO v_changed;

  DELETE FROM public.verifications
  WHERE user_id = p_user AND company_id = p_company AND deleted_at < now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION private.sync_company_verifications(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.sync_verifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_companies jsonb;
  v_old_companies jsonb;
  v_company text;
  v_new jsonb;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.verifications WHERE user_id = OLD.user_id;
      RETURN NULL;
    END IF;

    v_new_companies := CASE WHEN jsonb_typeof(NEW.state -> 'companies') = 'object' THEN NEW.state -> 'companies' ELSE '{}'::jsonb END;
    v_old_companies := CASE WHEN TG_OP = 'UPDATE' AND jsonb_typeof(OLD.state -> 'companies') = 'object' THEN OLD.state -> 'companies' ELSE '{}'::jsonb END;

    FOR v_company IN
      SELECT k FROM jsonb_object_keys(v_new_companies) k
      UNION
      SELECT k FROM jsonb_object_keys(v_old_companies) k
    LOOP
      IF v_new_companies -> v_company ? '__shared' THEN
        CONTINUE;
      END IF;
      v_new := v_new_companies -> v_company -> 'verifications';
      IF TG_OP = 'UPDATE' AND v_new IS NOT DISTINCT FROM (v_old_companies -> v_company -> 'verifications') THEN
        CONTINUE;
      END IF;
      PERFORM private.sync_company_verifications(NEW.user_id, v_company, v_new);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.system_events (kind, detail)
      VALUES ('verif_sync_failed', format('user_data %s: %s (%s)', coalesce(NEW.user_id, OLD.user_id), SQLERRM, SQLSTATE));
    EXCEPTION WHEN OTHERS THEN
      NULL; -- inte ens loggen gick: sparningen ska ändå igenom
    END;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_verifications() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_verifications ON public.user_data;
CREATE TRIGGER sync_verifications
  AFTER INSERT OR DELETE OR UPDATE OF state ON public.user_data
  FOR EACH ROW EXECUTE FUNCTION private.sync_verifications();

-- Jämförelsen: ett företag per rad där tabellen inte stämmer med blobben.
-- Tom = allt stämmer. Samma regler som kopieringen (se överst).
CREATE OR REPLACE FUNCTION public.verifications_mismatch()
RETURNS TABLE (user_id uuid, company_id text, blob_count bigint, table_count bigint)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH blob AS (
    SELECT DISTINCT ON (d.user_id, c.key, e ->> 'id') d.user_id, c.key AS company_id, e ->> 'id' AS id, e AS data
    FROM public.user_data d
    CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(d.state -> 'companies') = 'object' THEN d.state -> 'companies' ELSE '{}'::jsonb END) c
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.value -> 'verifications') = 'array' THEN c.value -> 'verifications' ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, ord)
    WHERE NOT (c.value ? '__shared') AND jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> ''
    ORDER BY d.user_id, c.key, e ->> 'id', ord DESC
  ),
  b AS (
    SELECT user_id, company_id, count(*) AS n, md5(string_agg(id || ':' || md5(data::text), ',' ORDER BY id)) AS h
    FROM blob GROUP BY 1, 2
  ),
  t AS (
    SELECT user_id, company_id, count(*) AS n, md5(string_agg(id || ':' || md5(data::text), ',' ORDER BY id)) AS h
    FROM public.verifications WHERE deleted_at IS NULL GROUP BY 1, 2
  )
  SELECT coalesce(b.user_id, t.user_id), coalesce(b.company_id, t.company_id), coalesce(b.n, 0), coalesce(t.n, 0)
  FROM b FULL JOIN t ON t.user_id = b.user_id AND t.company_id = b.company_id
  WHERE b.h IS DISTINCT FROM t.h;
$$;

REVOKE ALL ON FUNCTION public.verifications_mismatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verifications_mismatch() TO service_role;

-- Fyll tabellen från dagens blobbar.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT d.user_id, c.key AS company_id, c.value -> 'verifications' AS list
    FROM public.user_data d
    CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(d.state -> 'companies') = 'object' THEN d.state -> 'companies' ELSE '{}'::jsonb END) c
    WHERE NOT (c.value ? '__shared')
  LOOP
    PERFORM private.sync_company_verifications(r.user_id, r.company_id, r.list);
  END LOOP;
END;
$$;
