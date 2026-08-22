import { applySecurityHeaders } from '../../_security.js';
import { requireAuthedUser, loadOwnedCompany } from '../../_auth.js';
import { checkRateLimit } from '../../_rateLimit.js';

// Speglar GET /api/email/domains/status i server.js. Pollas från
// Inställningar-sidan, och är samma live-kontroll send-invoice.js gör vid
// varje utskick — aldrig en cachad flagga (se Sida 33, bugkritisk-noten).
// Kräver RESEND_ADMIN_API_KEY (full_access), samma skäl som create.js.
//
// Säkerhetsfix (se säkerhetsgranskningen): hade tidigare ingen
// inloggningskontroll och läste ut STATUS/DNS-poster för ett godtyckligt
// domän-id utan att kolla vem som frågade eller om domänen ens tillhörde
// den frågande. Kräver nu inloggning OCH att id:t matchar den inloggade
// användarens EGET sparade resendDomainId för angivet company_id.
const resendAdminApiKey = process.env.RESEND_ADMIN_API_KEY || null;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!resendAdminApiKey) {
    res.status(503).json({ error: 'Domänhantering är inte konfigurerat. Sätt RESEND_ADMIN_API_KEY (en Resend-nyckel med Full access) i Vercels miljövariabler.' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'email-domain-status', max: 60 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    const id = req.query?.id;
    const companyId = req.query?.company_id;
    if (!id || !companyId) {
      res.status(400).json({ error: 'id och company_id krävs.' });
      return;
    }

    const companyData = await loadOwnedCompany(user.id, companyId, res);
    if (!companyData) return;
    if (companyData.company?.resendDomainId !== id) {
      res.status(403).json({ error: 'Domänen tillhör inte det här företaget.' });
      return;
    }

    const resendRes = await fetch(`https://api.resend.com/domains/${id}`, {
      headers: { Authorization: `Bearer ${resendAdminApiKey}` },
    });
    const data = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error('Resend domain status error:', data);
      res.status(resendRes.status).json({ error: data?.message || 'Kunde inte hämta domänstatus.' });
      return;
    }

    res.status(200).json({ status: data.status, records: data.records || [] });
  } catch (error) {
    console.error('Domain status error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte hämta domänstatus.' });
  }
}
