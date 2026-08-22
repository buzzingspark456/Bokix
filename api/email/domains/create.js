import { applySecurityHeaders } from '../../_security.js';
import { parseJsonBody } from '../../stripe/_parseBody.js';
import { requireAuthedUser } from '../../_auth.js';
import { checkRateLimit } from '../../_rateLimit.js';
import { isRequestFromBot } from '../../_botid.js';

// Speglar POST /api/email/domains/create i server.js. Kräver den
// privilegierade RESEND_ADMIN_API_KEY (full_access) — sending_access-
// nycklar kan inte skapa eller hantera domäner alls (se Sida 33).
//
// Säkerhetsfix (se säkerhetsgranskningen): hade tidigare ingen
// inloggningskontroll — vem som helst på internet kunde registrera
// godtyckliga domäner mot Bokix Resend-konto med den priviligierade
// nyckeln. Kräver nu en verifierad session. Ingen ägarskaps-koll mot ett
// specifikt company_id behövs här (till skillnad från status.js) eftersom
// det här skapar en NY domän, inte läser ut en befintlig.
const resendAdminApiKey = process.env.RESEND_ADMIN_API_KEY || null;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!resendAdminApiKey) {
    res.status(503).json({ error: 'Domänhantering är inte konfigurerat. Sätt RESEND_ADMIN_API_KEY (en Resend-nyckel med Full access) i Vercels miljövariabler.' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'email-domain-create', max: 10 })) return;

  // Vercel BotID — se filkommentaren i main.jsx.
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    const body = await parseJsonBody(req);
    const { domain } = body || {};
    if (!domain || typeof domain !== 'string') {
      res.status(400).json({ error: 'domain krävs.' });
      return;
    }

    const resendRes = await fetch('https://api.resend.com/domains', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendAdminApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });
    const data = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error('Resend domain create error:', data);
      res.status(resendRes.status).json({ error: data?.message || 'Kunde inte skapa domänen hos Resend.' });
      return;
    }

    res.status(200).json({ id: data.id, status: data.status, records: data.records || [] });
  } catch (error) {
    console.error('Domain create error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte skapa domänen.' });
  }
}
