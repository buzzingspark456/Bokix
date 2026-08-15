import { parseJsonBody } from '../stripe/parseBody.js';

// Speglar POST /api/email/send-invoice i server.js (lokal dev via
// `npm run dev`) — Vercel kör aldrig server.js i produktion, bara filer
// under api/**, så den routen måste finnas här också eller så 404:ar
// "Skicka via e-post" tyst på den riktiga domänen även om nycklarna är
// satta i Vercels miljövariabler.
//
// Sida 33 — två nycklar med olika behörighet: RESEND_API_KEY (sending_access)
// skickar mejlet, RESEND_ADMIN_API_KEY (full_access) används bara för att
// LÄSA en domäns live-status härifrån (sending_access-nycklar kan inte
// hantera/läsa domäner alls).
const resendApiKey = process.env.RESEND_API_KEY || null;
const resendAdminApiKey = process.env.RESEND_ADMIN_API_KEY || null;
const emailFrom = process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>';
const SENDER_LOCAL_PART = 'faktura';

function fallbackSenderAddress(companyName) {
  const match = /^(.*)<(.+)>$/.exec(emailFrom);
  if (match && companyName) {
    return `${companyName} via Bokix <${match[2].trim()}>`;
  }
  return emailFrom;
}

/** Bugkritiskt (Sida 33): frågar alltid Resend live om domänens status
 * innan ett utskick — aldrig en cachad flagga. Faller tyst tillbaka till
 * systemadressen om domänen saknas, inte är verifierad, eller om
 * statuskontrollen misslyckas. */
async function resolveSenderAddress(company) {
  const fallback = fallbackSenderAddress(company?.name);
  if (!company?.resendDomainId || !company?.emailDomain || !resendAdminApiKey) {
    return { from: fallback, usingCustomDomain: false };
  }
  try {
    const domainRes = await fetch(`https://api.resend.com/domains/${company.resendDomainId}`, {
      headers: { Authorization: `Bearer ${resendAdminApiKey}` },
    });
    if (!domainRes.ok) return { from: fallback, usingCustomDomain: false };
    const domainData = await domainRes.json();
    if (domainData?.status === 'verified') {
      return { from: `${company.name} <${SENDER_LOCAL_PART}@${company.emailDomain}>`, usingCustomDomain: true };
    }
  } catch (error) {
    console.error('Resend domain status check failed, falling back:', error);
  }
  return { from: fallback, usingCustomDomain: false };
}

async function sendViaResend(payload) {
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await resendRes.json().catch(() => ({}));
  return { ok: resendRes.ok, status: resendRes.status, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!resendApiKey) {
    res.status(503).json({ error: 'E-post är inte konfigurerat. Sätt RESEND_API_KEY (och valfritt EMAIL_FROM) i Vercels miljövariabler för att kunna skicka fakturor via e-post.' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const { to, subject, html, replyTo, attachmentBase64, attachmentFilename, company } = body || {};

    if (!to || !subject || !html) {
      res.status(400).json({ error: 'to, subject och html krävs.' });
      return;
    }

    const { from } = await resolveSenderAddress(company);

    const basePayload = {
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachmentBase64 ? { attachments: [{ filename: attachmentFilename || 'faktura.pdf', content: attachmentBase64 }] } : {}),
    };

    let result = await sendViaResend({ ...basePayload, from });

    // Bugkritiskt: ett misslyckat utskick med kundens egen domän försöker
    // automatiskt igen med systemadressen istället för att hela utskicket
    // bara faller.
    if (!result.ok && from !== fallbackSenderAddress(company?.name)) {
      console.warn('Send with custom domain failed, retrying with fallback sender:', result.data);
      result = await sendViaResend({ ...basePayload, from: fallbackSenderAddress(company?.name) });
    }

    if (!result.ok) {
      console.error('Resend API error:', result.data);
      res.status(result.status).json({ error: result.data?.message || 'Resend kunde inte skicka e-posten.' });
      return;
    }

    res.status(200).json({ id: result.data.id });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte skicka e-post.' });
  }
}
