-- ══════════════════════════════════════════════════════════════════════
-- SMALARE NATTJOBB (2026-10-17)
-- ══════════════════════════════════════════════════════════════════════
-- Påminnelsejobbet (api/cron/reminders.js) läste varje natt alla kunders
-- hela konton, 50 åt gången, fast det bara behöver en liten del av varje
-- företag. Med många kunder blir det mycket data i onödan. Den här
-- funktionen skickar en smal version av varje konto:
--
--   company, vatPeriods, invoices, contacts, employees  hela (jobbet skriver
--                                     tillbaka company, invoices och vatPeriods
--                                     med set_company_field, så de får aldrig
--                                     vara avskalade)
--   verifications                     bara de senaste tre åren, och av varje
--                                     verifikation bara datum, status och
--                                     raderna på intäktskonton (3000–3799) och
--                                     EU-konton, det enda momsreglerna läser
--                                     (vatContextFor i declarationDeadlines.js)
--
-- Allt annat (kvitton, tidrapporter, offerter, underlag …) skickas inte.
-- Bara service_role (serverkoden) kan anropa den. Innan den är körd läser
-- jobbet hela konton som förut.

CREATE OR REPLACE FUNCTION public.cron_reminder_page(p_after uuid, p_limit integer)
RETURNS TABLE (user_id uuid, state jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    ud.user_id,
    jsonb_build_object(
      'activeCompanyId', ud.state -> 'activeCompanyId',
      'companies', coalesce((
        SELECT jsonb_object_agg(c.key, jsonb_build_object(
          'company', c.value -> 'company',
          'vatPeriods', c.value -> 'vatPeriods',
          'invoices', c.value -> 'invoices',
          'contacts', c.value -> 'contacts',
          'employees', c.value -> 'employees',
          'verifications', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
              'date', v -> 'date',
              'status', v -> 'status',
              'rows', (
                SELECT coalesce(jsonb_agg(jsonb_build_object('account', r -> 'account', 'debet', r -> 'debet', 'kredit', r -> 'kredit')), '[]'::jsonb)
                FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v -> 'rows') = 'array' THEN v -> 'rows' ELSE '[]'::jsonb END) r
                WHERE left(r ->> 'account', 4) ~ '^3[0-7][0-9]{2}$'
                   OR (r ->> 'account') IN ('2614', '2615', '2645', '3108', '3308', '4515', '4516', '4535', '4536')
              )
            )), '[]'::jsonb)
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.value -> 'verifications') = 'array' THEN c.value -> 'verifications' ELSE '[]'::jsonb END) v
            WHERE (v ->> 'date') >= to_char(now() - interval '3 years', 'YYYY-MM-DD')
          )
        ))
        FROM jsonb_each(CASE WHEN jsonb_typeof(ud.state -> 'companies') = 'object' THEN ud.state -> 'companies' ELSE '{}'::jsonb END) c
      ), '{}'::jsonb)
    ) AS state
  FROM public.user_data ud
  WHERE ud.state IS NOT NULL
    AND (p_after IS NULL OR ud.user_id > p_after)
  ORDER BY ud.user_id
  LIMIT greatest(1, least(p_limit, 500));
$$;

REVOKE ALL ON FUNCTION public.cron_reminder_page(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_reminder_page(uuid, integer) TO service_role;
