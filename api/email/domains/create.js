import { parseJsonBody } from '../../stripe/_parseBody.js';

// Speglar POST /api/email/domains/create i server.js. Kräver den
// privilegierade RESEND_ADMIN_API_KEY (full_access) — sending_access-
// nycklar kan inte skapa eller hantera domäner alls (se Sida 33).
const resendAdminApiKey = process.env.RESEND_ADMIN_API_KEY || null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!resendAdminApiKey) {
    res.status(503).json({ error: 'Domänhantering är inte konfigurerat. Sätt RESEND_ADMIN_API_KEY (en Resend-nyckel med Full access) i Vercels miljövariabler.' });
    return;
  }

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
