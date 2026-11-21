-- Användargräns per nivå (2026-11-21)
--
-- Utan personal (solo_*): ägaren + 1 inbjuden. Med personal (employer_*):
-- ägaren + 2 inbjudna. Redovisningskonsult och revisor räknas inte, de har
-- egna två platser (is_accountant). Konton vars abonnemang skapades före
-- 2026-11-22 behåller två inbjudna oavsett nivå, det var vad prissidan lovade
-- när de köpte ("Upp till 3"). Saknad plan (konton från före nivåerna) = två.
--
-- Samma regel finns i src/utils/plans.js (invitedUserLimit) för att kunna
-- visa knappen rätt. Databasen är den som faktiskt stoppar.
--
-- Körs i SQL Editor. Går att köra flera gånger.

ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS is_accountant boolean NOT NULL DEFAULT false;

-- Öppna platser (väntande eller aktiva) av ett slag: vanliga användare eller
-- konsult/revisor. SECURITY DEFINER av samma skäl som count_open_invites: en
-- underfråga mot company_members i policyn ger "infinite recursion".
CREATE OR REPLACE FUNCTION private.count_open_seats(target_owner uuid, target_company text, accountant boolean)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT count(*) FROM public.company_members cm
  WHERE cm.owner_user_id = target_owner
    AND cm.company_id = target_company
    AND cm.status IN ('pending', 'active')
    AND cm.is_accountant = accountant;
$$;

REVOKE ALL ON FUNCTION private.count_open_seats(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.count_open_seats(uuid, text, boolean) TO authenticated;

-- Hur många vanliga användare ägaren får bjuda in till företaget. Företagets
-- egen abonnemangsrad gäller före kontots ursprungliga (company_id '').
CREATE OR REPLACE FUNCTION private.invite_limit(target_owner uuid, target_company text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN s.plan LIKE 'solo\_%' AND s.created_at >= '2026-11-22T00:00:00Z'::timestamptz THEN 1
    ELSE 2
  END
  FROM (
    SELECT NULL::text AS plan, NULL::timestamptz AS created_at, 2 AS ord
    UNION ALL
    SELECT sub.plan, sub.created_at, CASE WHEN sub.company_id = target_company THEN 0 ELSE 1 END
    FROM public.subscriptions sub
    WHERE sub.user_id = target_owner AND sub.company_id IN (target_company, '')
  ) s
  ORDER BY s.ord
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.invite_limit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.invite_limit(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Ägare skapar inbjudan" ON public.company_members;
CREATE POLICY "Ägare skapar inbjudan"
ON public.company_members FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = (select auth.uid())
  AND status = 'pending'
  AND member_user_id IS NULL
  AND private.can_write_user_data((select auth.uid()))
  AND private.owner_has_company((select auth.uid()), company_id)
  AND CASE
    WHEN is_accountant THEN private.count_open_seats((select auth.uid()), company_id, true) < 2
    ELSE private.count_open_seats((select auth.uid()), company_id, false) < private.invite_limit((select auth.uid()), company_id)
  END
);

-- Vakten: samma som 2026-10-21, plus att is_accountant inte går att ändra
-- efteråt. Annars kunde en vanlig användare göras om till konsult för att
-- frigöra en plats.
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
    NEW.status := 'pending';
    NEW.member_user_id := NULL;
    NEW.redeemed_at := NULL;
    NEW.revoked_at := NULL;
    NEW.invite_token := gen_random_uuid();
    NEW.expires_at := now() + interval '7 days';
    RETURN NEW;
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.invited_email IS DISTINCT FROM OLD.invited_email
     OR NEW.invite_token IS DISTINCT FROM OLD.invite_token
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.is_accountant IS DISTINCT FROM OLD.is_accountant THEN
    RAISE EXCEPTION 'Den här ändringen av medlemskapet är inte tillåten.' USING ERRCODE = '42501';
  END IF;

  IF OLD.owner_user_id = auth.uid() THEN
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
