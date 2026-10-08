-- Ägaren får ta bort en ÅTERKALLAD inbjudan ur listan (Inställningar →
-- Användare, papperskorgen på återkallade rader). Bara återkallade rader:
-- en aktiv eller väntande medlem måste återkallas först, så att ingen
-- åtkomst försvinner av misstag. Läser inte company_members själv, så
-- ingen risk för rekursion. Säkert att köra flera gånger.

DROP POLICY IF EXISTS "Ägare tar bort återkallad inbjudan" ON public.company_members;
CREATE POLICY "Ägare tar bort återkallad inbjudan"
ON public.company_members FOR DELETE TO authenticated
USING (
  owner_user_id = (select auth.uid())
  AND status = 'revoked'
);
