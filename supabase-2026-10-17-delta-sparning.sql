-- ══════════════════════════════════════════════════════════════════════
-- SPARA BARA DET SOM ÄNDRATS (2026-10-17)
-- ══════════════════════════════════════════════════════════════════════
-- Förut skickade appen hela kontot (user_data.state) vid varje sparning,
-- 3,6 MB för ett företag med 5 000 verifikationer. Nu skickar den bara
-- ändringarna: nya, ändrade och borttagna poster i varje lista
-- (verifikationer, fakturor, kvitton …) och de fält som bytts ut. Den här
-- funktionen lägger in dem direkt i raden.
--
-- Säkerhet: SECURITY INVOKER, så samma RLS som vid en vanlig sparning
-- gäller (bara den egna raden, private.can_write_user_data = betalspärren),
-- och samma CHECK user_data_state_size. Skrivningen görs bara om raden är
-- oförändrad sedan klienten senast läste den (p_expected_updated_at);
-- annars returneras null och appen hämtar raden och slår ihop som förut.
--
-- Operationer i p_ops (en jsonb-array), där path är en textarray:
--   {"op":"set",   "path":[...], "value": ...}   byt ut värdet
--   {"op":"unset", "path":[...]}                  ta bort nyckeln
--   {"op":"patch", "path":[...], "upsert":[...], "remove":[...], "prepend":bool}
--       lista med poster som har id: ersätt ändrade på plats, ta bort,
--       lägg nya sist (eller först med prepend), som applyRecordPatch i
--       src/utils/stateMerge.js.
-- Saknas föräldern till en path avbryts allt (exception) och appen sparar
-- hela kontot i stället, så att inget tyst försvinner.
--
-- Kör hela filen i Supabase → SQL Editor. Appen fungerar som förut tills
-- den är körd (den sparar då hela kontot).

-- Lista med poster: samma resultat som applyRecordPatch i stateMerge.js.
CREATE OR REPLACE FUNCTION private.apply_record_patch(p_current jsonb, p_upsert jsonb, p_remove jsonb, p_prepend boolean)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH cur AS (
    SELECT elem, ord FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_current) = 'array' THEN p_current ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS t(elem, ord)
  ),
  up AS (
    SELECT elem, ord FROM jsonb_array_elements(coalesce(p_upsert, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
  ),
  removed AS (
    SELECT value #>> '{}' AS id FROM jsonb_array_elements(coalesce(p_remove, '[]'::jsonb))
  ),
  kept AS (
    SELECT coalesce(u.elem, c.elem) AS elem, 1 AS grp, c.ord AS ord
    FROM cur c
    LEFT JOIN up u ON u.elem ->> 'id' = c.elem ->> 'id'
    WHERE NOT EXISTS (SELECT 1 FROM removed r WHERE r.id = c.elem ->> 'id')
  ),
  added AS (
    SELECT u.elem, CASE WHEN p_prepend THEN 0 ELSE 2 END AS grp, u.ord
    FROM up u
    WHERE NOT EXISTS (SELECT 1 FROM cur c WHERE c.elem ->> 'id' = u.elem ->> 'id')
  )
  SELECT coalesce(jsonb_agg(elem ORDER BY grp, ord), '[]'::jsonb)
  FROM (SELECT * FROM kept UNION ALL SELECT * FROM added) s;
$$;

REVOKE ALL ON FUNCTION private.apply_record_patch(jsonb, jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.apply_record_patch(jsonb, jsonb, jsonb, boolean) TO authenticated;

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
      WHEN 'patch' THEN
        v_state := jsonb_set(
          v_state, v_path,
          private.apply_record_patch(v_state #> v_path, v_op -> 'upsert', v_op -> 'remove', coalesce((v_op ->> 'prepend')::boolean, false)),
          true
        );
      ELSE
        RAISE EXCEPTION 'unknown op %', v_op ->> 'op' USING ERRCODE = '22023';
    END CASE;
  END LOOP;

  UPDATE public.user_data
  SET state = v_state
  WHERE user_id = v_uid
  RETURNING updated_at INTO v_updated;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_user_data_delta(timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_user_data_delta(timestamptz, jsonb) TO authenticated;
