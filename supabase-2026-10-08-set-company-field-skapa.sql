-- set_company_field skrev bara över fält som redan fanns (jsonb_set med
-- create_missing = false). Ett företag som aldrig haft t.ex. offerter eller
-- AGI-rapporter fick då en inbjuden konsults eller påminnelse-cronens första
-- skrivning tyst bortslängd. Nu skapas fältet om det saknas. Företaget självt
-- måste fortfarande finnas (WHERE-villkoret är oförändrat).
CREATE OR REPLACE FUNCTION public.set_company_field(
  p_user_id uuid,
  p_company_id text,
  p_field text,
  p_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.set_company_field(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_field(uuid, text, text, jsonb) TO service_role;
