-- Fix: "infinite recursion detected in policy for relation company_members"
-- när en ägare bjuder in en medlem. INSERT-policyn räknade befintliga
-- inbjudningar med en underfråga mot company_members själv, och Postgres
-- vägrar en policy som läser sin egen tabell. Räkningen flyttas till en
-- SECURITY DEFINER-funktion (kringgår RLS), samma mönster som
-- private.can_write_user_data. Gränsen (max 2 inbjudna = 3 användare) är oförändrad.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.count_open_invites(target_owner uuid, target_company text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT count(*) FROM public.company_members cm
  WHERE cm.owner_user_id = target_owner
    AND cm.company_id = target_company
    AND cm.status IN ('pending', 'active');
$$;

REVOKE ALL ON FUNCTION private.count_open_invites(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.count_open_invites(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Ägare skapar inbjudan" ON public.company_members;
CREATE POLICY "Ägare skapar inbjudan"
ON public.company_members FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = (select auth.uid())
  AND private.can_write_user_data((select auth.uid()))
  AND private.count_open_invites((select auth.uid()), company_id) < 2
);
