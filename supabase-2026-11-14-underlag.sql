-- Underlag att koppla (2026-11-14)
--
-- Underlag som sparas utan avläsning ligger i en egen lista, `documents`,
-- tills de kopplas till en verifikation. Ägarens sparning klarar redan ett
-- nytt fält (det hamnar på företagsraden, companies.extra). Den här filen
-- behövs för att INBJUDNA (revisor, kollega) ska kunna spara underlag:
-- set_company_field släpper bara igenom fält på listan nedan.
--
-- Samma funktion som i supabase-2026-10-28-kopplingsskydd.sql, med
-- 'documents' tillagt. Kör i Stockholm (och bokix-test) före push.

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
    'bankTransactions',
    -- Underlag att koppla (2026-11-14): kvitton och fakturor sparade utan
    -- avläsning, tills de kopplas till en verifikation.
    'documents'
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

