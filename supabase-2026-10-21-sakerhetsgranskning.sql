-- Säkerhetsgranskningen 2026-10-20: databasdelen av rättningarna.
-- Kör hela filen i Supabase → SQL Editor. Säkert att köra flera gånger.
--
-- 1. Medlemsrader: en medlem kan inte flytta sin rad till ett annat
--    företag eller ändra sina behörigheter, och ägaren kan inte skapa
--    aktiva medlemskap direkt, bara inbjudningar till egna företag.
-- 2. Händelseloggen: medlemmar ser bara loggen för just det företaget hos
--    just den ägaren.
-- 3. Privata filer: bara ägaren läser direkt. Inbjudna får filer via
--    servern (api/company-access.js signed_url), som kollar att filen hör
--    till företaget och en sida de får se.
-- 4. Tvåfaktor: har kontot tvåfaktor påslaget krävs koden (aal2) även mot
--    databasen, inte bara i appen.
-- 5. Stripe-konto och Zettle-nycklar i user_data sätts bara av servern.
--    En inloggad kund kan ta bort dem men aldrig sätta eller byta dem.

CREATE SCHEMA IF NOT EXISTS private;

-- ── 1. company_members ─────────────────────────────────────────────────

-- Finns företaget i ägarens egen data? Samma uppslag som findCompanyEntry
-- i api/_auth.js: nyckeln, eller företagets eget company.id.
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
  );
$$;

REVOKE ALL ON FUNCTION private.owner_has_company(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.owner_has_company(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Ägare skapar inbjudan" ON public.company_members;
CREATE POLICY "Ägare skapar inbjudan"
ON public.company_members FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = (select auth.uid())
  AND status = 'pending'
  AND member_user_id IS NULL
  AND private.can_write_user_data((select auth.uid()))
  AND private.owner_has_company((select auth.uid()), company_id)
  AND private.count_open_invites((select auth.uid()), company_id) < 2
);

-- Kolumnerna en inloggad användare får ändra. Policyn ovan avgör vem som
-- får röra raden; den här avgör vad som får ändras. Servern (service_role)
-- påverkas inte.
CREATE OR REPLACE FUNCTION private.guard_company_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ny inbjudan: alltid väntande, med ny nyckel och sju dagars giltighet.
    NEW.status := 'pending';
    NEW.member_user_id := NULL;
    NEW.redeemed_at := NULL;
    NEW.revoked_at := NULL;
    NEW.invite_token := gen_random_uuid();
    NEW.expires_at := now() + interval '7 days';
    RETURN NEW;
  END IF;

  -- Ingen får flytta en rad till en annan ägare eller ett annat företag,
  -- eller byta mottagare eller inbjudningsnyckel.
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.invited_email IS DISTINCT FROM OLD.invited_email
     OR NEW.invite_token IS DISTINCT FROM OLD.invite_token
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'Den här ändringen av medlemskapet är inte tillåten.' USING ERRCODE = '42501';
  END IF;

  IF OLD.owner_user_id = auth.uid() THEN
    -- Ägaren: roll, sidbehörigheter och återkallande. Aldrig aktivera en
    -- medlem själv eller välja vem den är, det gör bara den inbjudna.
    IF NEW.member_user_id IS DISTINCT FROM OLD.member_user_id
       OR NEW.redeemed_at IS DISTINCT FROM OLD.redeemed_at
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'revoked') THEN
      RAISE EXCEPTION 'Den här ändringen av medlemskapet är inte tillåten.' USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'revoked' AND OLD.status <> 'revoked' THEN
      NEW.revoked_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Den inbjudna: bara att lösa in sin egen väntande inbjudan.
  IF OLD.status <> 'pending'
     OR NEW.status <> 'active'
     OR NEW.member_user_id IS DISTINCT FROM auth.uid()
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.page_access IS DISTINCT FROM OLD.page_access
     OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'Den här ändringen av medlemskapet är inte tillåten.' USING ERRCODE = '42501';
  END IF;
  NEW.redeemed_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_company_members() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_company_members ON public.company_members;
CREATE TRIGGER guard_company_members
BEFORE INSERT OR UPDATE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION private.guard_company_members();

-- ── 2. audit_log ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Se händelselogg för egna/delade företag" ON public.audit_log;
CREATE POLICY "Se händelselogg för egna/delade företag"
ON public.audit_log FOR SELECT TO authenticated
USING (
  (select auth.uid()) = owner_user_id
  OR EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.member_user_id = (select auth.uid())
      AND cm.owner_user_id = audit_log.owner_user_id
      AND cm.company_id = audit_log.company_id
      AND cm.status = 'active'
  )
);

-- ── 3. Privata filer ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Publik läsning av bokix-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Egen läsning av bokix-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Egen läsning i bokix-uploads" ON storage.objects;
CREATE POLICY "Egen läsning i bokix-uploads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bokix-uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- ── 4. Tvåfaktor även mot databasen ────────────────────────────────────

-- Sant om sessionen klarat tvåfaktor, eller om kontot inte har någon.
-- Passkeys (Face ID) är ingen tvåfaktor i auth.mfa_factors och påverkas inte.
CREATE OR REPLACE FUNCTION private.mfa_ok()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
    OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id = auth.uid() AND f.status = 'verified'
    );
$$;

REVOKE ALL ON FUNCTION private.mfa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.mfa_ok() TO authenticated;

-- RESTRICTIVE: gäller utöver de vanliga policyerna, öppnar aldrig något.
DROP POLICY IF EXISTS "Tvåfaktor krävs" ON public.user_data;
CREATE POLICY "Tvåfaktor krävs"
ON public.user_data AS RESTRICTIVE FOR ALL TO authenticated
USING ((select private.mfa_ok()))
WITH CHECK ((select private.mfa_ok()));

DROP POLICY IF EXISTS "Tvåfaktor krävs" ON public.company_members;
CREATE POLICY "Tvåfaktor krävs"
ON public.company_members AS RESTRICTIVE FOR ALL TO authenticated
USING ((select private.mfa_ok()))
WITH CHECK ((select private.mfa_ok()));

DROP POLICY IF EXISTS "Tvåfaktor krävs för bokix-uploads" ON storage.objects;
CREATE POLICY "Tvåfaktor krävs för bokix-uploads"
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id <> 'bokix-uploads' OR (select private.mfa_ok()))
WITH CHECK (bucket_id <> 'bokix-uploads' OR (select private.mfa_ok()));

-- ── 5. Stripe-konto och Zettle-nycklar sätts bara av servern ───────────

-- Servern sparar dem via set_company_stripe_account och
-- set_company_zettle_tokens (service_role). En inloggad kund som sparar sin
-- data kan ta bort dem (koppla från) men inte sätta eller byta dem: ett
-- ändrat värde ersätts med det gamla. Inget fel, så vanlig sparning
-- fortsätter fungera.
CREATE OR REPLACE FUNCTION private.guard_user_data_connections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  company_key text;
  company_val jsonb;
  old_company jsonb;
  field text;
  protected_fields text[] := ARRAY['stripeAccountId', 'zettleAccessToken', 'zettleRefreshToken', 'zettleTokenExpiresAt'];
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NEW.state IS NULL OR jsonb_typeof(NEW.state -> 'companies') IS DISTINCT FROM 'object' THEN
    RETURN NEW;
  END IF;

  FOR company_key, company_val IN SELECT key, value FROM jsonb_each(NEW.state -> 'companies') LOOP
    IF jsonb_typeof(company_val -> 'company') IS DISTINCT FROM 'object' THEN
      CONTINUE;
    END IF;
    old_company := CASE WHEN TG_OP = 'UPDATE' THEN OLD.state -> 'companies' -> company_key -> 'company' END;
    FOREACH field IN ARRAY protected_fields LOOP
      IF coalesce(company_val -> 'company' ->> field, '') <> ''
         AND (company_val -> 'company' -> field) IS DISTINCT FROM (old_company -> field) THEN
        IF old_company ? field THEN
          NEW.state := jsonb_set(NEW.state, ARRAY['companies', company_key, 'company', field], old_company -> field);
        ELSE
          NEW.state := NEW.state #- ARRAY['companies', company_key, 'company', field];
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_user_data_connections() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_user_data_connections ON public.user_data;
CREATE TRIGGER guard_user_data_connections
BEFORE INSERT OR UPDATE ON public.user_data
FOR EACH ROW EXECUTE FUNCTION private.guard_user_data_connections();
