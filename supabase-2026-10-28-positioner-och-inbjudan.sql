-- ══════════════════════════════════════════════════════════════════════
-- POSITIONER UTAN OMSKRIVNING, OCH INBJUDAN TILL FÖRETAG I TABELLERNA
-- (2026-10-28)
-- ══════════════════════════════════════════════════════════════════════
-- Kör i SQL Editor efter supabase-2026-10-25-steg-4d.sql. Går att köra om.
-- Två saker som måste vara på plats innan fler konton går till tabellerna
-- (se sparlavinen 2026-10-27).
--
-- 1. private.sync_company_records gav varje post position = platsen i listan
--    (1, 2, 3 …). En ny post först i en lista flyttade då alla andra ett
--    steg, och varje rad skrevs om: 700 rader för en ny verifikation hos
--    Hembiet. Nu behåller en post sin position så länge ordningen mot de
--    andra stämmer, och nya poster får en plats mellan sina grannar. Bara
--    om det inte finns plats numreras listan om (med mellanrum på 1024, så
--    att det sedan dröjer länge till nästa gång). Ordningen blir densamma
--    som förut; bara talen skiljer sig.
--
-- 2. private.owner_has_company letade bara i blobben. Ett företag som bara
--    finns i tabellerna (konton i 'tables_only') gick då inte att bjuda in
--    till. Nu räcker det att företaget finns på något av ställena.

-- ── 1. Positionerna ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.sync_company_records(p_company uuid, p_kind text, p_list jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
-- Planeraren tror att en jsonb-lista har 100 poster och väljer då gärna att
-- slå upp varje post för sig mot alla företagets rader (26 000 × 26 000).
-- Utan nested loop blir det hash-join, och tiden växer i takt med listan.
SET enable_nestloop = off
AS $$
DECLARE
  v_list jsonb := CASE WHEN jsonb_typeof(p_list) = 'array' THEN p_list ELSE '[]'::jsonb END;
BEGIN
  -- Allt i ett svep (inga loopar: en stor lista ska kosta som en liten).
  WITH cur AS MATERIALIZED (
    SELECT r.id COLLATE "C" AS id, r.data, r.deleted_at, r.position
    FROM public.company_records r
    WHERE r.company_id = p_company AND r.kind = p_kind
  ),
  n0 AS (
    -- Listan, en post per id (sista förekomsten gäller, som förut).
    SELECT DISTINCT ON ((e ->> 'id') COLLATE "C") (e ->> 'id') COLLATE "C" AS id, e, ord
    FROM jsonb_array_elements(v_list) WITH ORDINALITY AS t(e, ord)
    WHERE jsonb_typeof(e) = 'object' AND coalesce(e ->> 'id', '') <> ''
    ORDER BY (e ->> 'id') COLLATE "C", ord DESC
  ),
  n1 AS (
    -- Med postens nuvarande position, om den finns och är aktiv.
    SELECT n0.id, n0.e, n0.ord, cur.position AS old
    FROM n0
    LEFT JOIN cur ON cur.id = n0.id AND cur.deleted_at IS NULL
  ),
  n2 AS (
    -- Ankare: en befintlig post vars position är högre än alla före den i
    -- listan. Ankarna behåller sin plats.
    SELECT n1.*, n1.old IS NOT NULL
      AND n1.old > coalesce(max(n1.old) OVER (ORDER BY n1.ord ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), -9223372036854775807) AS anchor
    FROM n1
  ),
  n3 AS (
    -- För övriga: närmaste ankare före och efter, och vilken lucka de står i.
    SELECT n2.*,
      max(CASE WHEN n2.anchor THEN n2.old END) OVER (ORDER BY n2.ord ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev,
      -- Baklänges så att fönstret växer från början (räknas löpande, inte om per rad).
      min(CASE WHEN n2.anchor THEN n2.old END) OVER (ORDER BY n2.ord DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS nxt,
      count(*) FILTER (WHERE n2.anchor) OVER (ORDER BY n2.ord ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS grp,
      row_number() OVER (ORDER BY n2.ord) AS rn
    FROM n2
  ),
  n4 AS (
    SELECT n3.*,
      row_number() OVER (PARTITION BY n3.grp, n3.anchor ORDER BY n3.ord) AS t,
      count(*) OVER (PARTITION BY n3.grp, n3.anchor) AS k
    FROM n3
  ),
  n5 AS (
    -- Ryms inte en lucka mellan två ankare numreras hela listan om. Ett
    -- fönster över hela listan (räknas en gång, inte en gång per rad).
    SELECT n4.*, coalesce(bool_or(NOT n4.anchor AND n4.prev IS NOT NULL AND n4.nxt IS NOT NULL AND n4.nxt - n4.prev - 1 < n4.k) OVER (), false) AS renumber
    FROM n4
  ),
  n AS (
    SELECT n4.id, n4.e,
      CASE
        WHEN n4.renumber THEN n4.rn * 1024
        WHEN n4.anchor THEN n4.old
        WHEN n4.prev IS NOT NULL AND n4.nxt IS NOT NULL THEN n4.prev + n4.t * ((n4.nxt - n4.prev) / (n4.k + 1))
        WHEN n4.prev IS NOT NULL THEN n4.prev + n4.t * 1024
        WHEN n4.nxt IS NOT NULL THEN n4.nxt - (n4.k - n4.t + 1) * 1024
        ELSE n4.t * 1024
      END AS pos
    FROM n5 AS n4
  ),
  diff AS (
    -- Bara det som ändrats: nytt innehåll, ny plats, ny eller återuppstånden
    -- post, och poster som inte längre finns i listan.
    SELECT coalesce(n.id, cur.id) AS id, n.e, n.pos
    FROM n FULL JOIN cur ON cur.id = n.id
    WHERE (n.id IS NULL AND cur.deleted_at IS NULL)
       OR (n.id IS NOT NULL AND (cur.id IS NULL OR cur.deleted_at IS NOT NULL
           OR cur.data IS DISTINCT FROM n.e OR cur.position IS DISTINCT FROM n.pos))
  ),
  upserted AS (
    INSERT INTO public.company_records AS r (company_id, kind, id, data, record_date, position)
    SELECT p_company, p_kind, diff.id, diff.e, diff.e ->> 'date', diff.pos
    FROM diff WHERE diff.e IS NOT NULL
    ON CONFLICT (company_id, kind, id) DO UPDATE
      SET data = EXCLUDED.data, record_date = EXCLUDED.record_date, position = EXCLUDED.position,
          -- Bara en ändring av innehållet räknar upp versionen, inte en flytt.
          version = r.version + CASE WHEN r.data IS DISTINCT FROM EXCLUDED.data OR r.deleted_at IS NOT NULL THEN 1 ELSE 0 END,
          deleted_at = NULL, updated_at = now()
    RETURNING 1
  )
  -- (upserted körs ändå: en skrivande WITH-del körs alltid, även om den inte läses.)
  UPDATE public.company_records r
  SET deleted_at = now(), updated_at = now(), version = r.version + 1
  FROM diff
  WHERE diff.e IS NULL AND r.company_id = p_company AND r.kind = p_kind AND r.id = diff.id;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_company_records(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 2. Inbjudan till företag som bara finns i tabellerna ───────────────
-- Samma uppslag som findCompanyEntry i api/_auth.js (nyckeln eller
-- företagets eget company.id), i blobben eller i public.companies.
CREATE OR REPLACE FUNCTION private.owner_has_company(target_owner uuid, target_company text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_data u, jsonb_each(coalesce(u.state -> 'companies', '{}'::jsonb)) e
    WHERE u.user_id = target_owner
      AND jsonb_typeof(u.state -> 'companies') = 'object'
      AND (e.key = target_company OR e.value -> 'company' ->> 'id' = target_company)
  ) OR EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.owner_user_id = target_owner
      AND c.deleted_at IS NULL
      AND (c.legacy_key = target_company OR c.legacy_company_id = target_company)
  );
$$;

REVOKE ALL ON FUNCTION private.owner_has_company(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.owner_has_company(uuid, text) TO authenticated;
