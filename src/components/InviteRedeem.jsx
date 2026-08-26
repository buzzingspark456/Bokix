import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Samma nyckel som App.jsx (redeemPendingInvite) och Auth.jsx
// (hasPendingInvite) läser — satt EN gång här, konsumeras/rensas där.
const PENDING_INVITE_KEY = 'bokix_pending_invite_token';

/** Länken i inbjudningsmejlet (api/company-access.js/Settings.jsx bygger den
 * som https://www.bokix.se/invite?token=<uuid>) landar här. Gör medvetet
 * INGET RLS-uppslag av inbjudan på den här sidan — en oinloggad besökare
 * (vilket alla som klickar en mejllänk är, per definition) har inget
 * auth.uid()/auth.jwt(), så company_members-policyerna (supabase-setup.sql)
 * nekar en anonym SELECT helt, med rätta. Den här sidan sparar bara
 * tokenet och skickar personen rakt in i den vanliga inloggnings-/
 * registreringsvyn (samma `enterApp`-mekanism som LandingPage/PricingPage
 * redan använder, se AppRouter.jsx: RootRoute) — själva inlösningen sker
 * först i App.jsx, EFTER att en riktig session finns (redeemPendingInvite).
 */
export default function InviteRedeem() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token && typeof window !== 'undefined') {
      sessionStorage.setItem(PENDING_INVITE_KEY, token);
    }
    navigate('/', { replace: true, state: { enterApp: true } });
  }, [searchParams, navigate]);

  return null;
}
