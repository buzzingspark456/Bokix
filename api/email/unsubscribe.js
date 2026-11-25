// Avregistrering från Kom igång-mejlen (api/cron/_onboardingEmails.js).
// Länken i mejlet bär en signerad token med kontots id; ingen inloggning
// behövs. GET visar en bekräftelsesida, POST är mejlklienternas
// "List-Unsubscribe"-knapp (ett klick). Sätter user_metadata.
// onboarding_emails_off, som nattjobbet läser innan det skickar något.
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { verifySignedToken } from '../_signedToken.js';
import { withSentry } from '../_sentry.js';
import { UNSUBSCRIBE_PURPOSE } from '../cron/_onboardingEmails.js';

// Länken ska fungera så länge mejlet kan ligga kvar i inkorgen.
const MAX_AGE_MS = 180 * 86400000;

const page = (title, text) => `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} | Bokix</title></head>
<body style="margin:0;padding:48px 16px;background:#f4f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #e3ebe5;border-radius:16px;padding:36px 32px;text-align:center;">
<img src="https://www.bokix.se/email-logo.png" width="130" alt="Bokix" style="display:block;margin:0 auto 20px;">
<h1 style="margin:0 0 10px;font-size:21px;color:#1c2420;">${title}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#5b6b62;">${text}</p>
<p style="margin:24px 0 0;"><a href="https://www.bokix.se/" style="color:#3d7a2e;font-weight:700;text-decoration:none;">Till Bokix</a></p>
</div></body></html>`;

async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const sendPage = (status, title, text) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).send(page(title, text));
  };

  const payload = verifySignedToken(String(req.query?.t || ''), MAX_AGE_MS);
  if (!payload || payload.purpose !== UNSUBSCRIBE_PURPOSE || !payload.uid) {
    sendPage(400, 'Länken fungerar inte', 'Länken är ogiltig eller för gammal. Mejla support@bokix.se så hjälper vi dig.');
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    sendPage(503, 'Något gick fel', 'Vi kunde inte spara ditt val just nu. Försök igen om en stund.');
    return;
  }
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.auth.admin.getUserById(payload.uid);
  if (error || !data?.user) {
    // Kontot finns inte längre: då skickas inga mejl heller.
    sendPage(200, 'Du är avregistrerad', 'Du får inga fler tips-mejl från Bokix.');
    return;
  }
  const { error: updateError } = await admin.auth.admin.updateUserById(payload.uid, {
    user_metadata: { ...(data.user.user_metadata || {}), onboarding_emails_off: true },
  });
  if (updateError) {
    sendPage(503, 'Något gick fel', 'Vi kunde inte spara ditt val just nu. Försök igen om en stund, eller mejla support@bokix.se.');
    return;
  }
  sendPage(200, 'Du är avregistrerad', 'Du får inga fler tips-mejl från Bokix. Mejl om ditt konto, till exempel om betalning, skickas som vanligt.');
}

export default withSentry(handler, '/api/email/unsubscribe');
