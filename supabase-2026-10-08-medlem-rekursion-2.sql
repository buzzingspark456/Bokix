-- Del 2 av rekursionsfixen (se supabase-2026-10-08-medlem-rekursion.sql).
-- UPDATE-policyn jämförde rollen mot den lagrade raden med en underfråga mot
-- company_members själv, vilket ger samma "infinite recursion" vid inlösen
-- av inbjudan och när ägaren byter roll eller tar bort en medlem. Den
-- lagrade rollen hämtas nu via en SECURITY DEFINER-funktion. Logiken är
-- densamma: den inbjudna kan inte byta sin egen roll vid inlösen.

CREATE OR REPLACE FUNCTION private.stored_member_role(target_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT cm.role FROM public.company_members cm WHERE cm.id = target_id;
$$;

REVOKE ALL ON FUNCTION private.stored_member_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.stored_member_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "Hantera eller lös in medlemskap" ON public.company_members;
CREATE POLICY "Hantera eller lös in medlemskap"
ON public.company_members FOR UPDATE TO authenticated
USING (
  owner_user_id = (select auth.uid())
  OR (
    lower(invited_email) = lower((select auth.jwt()) ->> 'email')
    AND status = 'pending'
    AND expires_at > now()
  )
)
WITH CHECK (
  owner_user_id = (select auth.uid())
  OR (
    lower(invited_email) = lower((select auth.jwt()) ->> 'email')
    AND member_user_id = (select auth.uid())
    AND status = 'active'
    AND role = private.stored_member_role(id)
  )
);
