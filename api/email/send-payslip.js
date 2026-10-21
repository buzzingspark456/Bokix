import { logSystemEvent } from '../_systemEvents.js';
import { applySecurityHeaders } from '../_security.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { requireAuthedUser, loadOwnedOrMemberCompany, requireActiveSubscription } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { hasResendApiKey, sendWithFallback } from '../_resend.js';
import { trySendFromOwnAddress } from '../_smtp.js';

// Mejlar ett lönebesked till en anställd. Egen rutt i stället för
// send-invoice.js av två skäl:
//   1. Ett företag med 50 eller 200 timanställda skickar lika många mejl på
//      en gång. send-invoice.js tillåter 30 per kvart, vilket är rätt för
//      fakturor men stoppar ett lönebeskedsutskick halvvägs.
//   2. Mottagaren tas från den anställdas SPARADE e-post på servern, aldrig
//      från klienten. Den högre gränsen kan därför inte användas för att
//      skicka mejl till godtyckliga adresser.
// Avsändarvägen är densamma som för fakturor: företagets egen adress om den
// är kopplad, annars Bokix.

const MAX_PDF_BASE64 = 2_000_000;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await checkRateLimit(req, res, { key: 'send-payslip', max: 600 }))) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;
  if (!await requireActiveSubscription(user, res)) return;
  // Den anställdas e-post skrivs av företaget självt, så den höga gränsen
  // ovan får inte bli ett sätt att mejla vem som helst: per konto räcker
  // 300 i timmen för en stor lönekörning (säkerhetsgranskningen 2026-10-20).
  if (!(await checkRateLimit(req, res, { key: 'send-payslip-user', windowMs: 60 * 60 * 1000, max: 300, identifier: user.id }))) return;

  try {
    const body = await parseJsonBody(req);
    const { company_id: companyId, employee_id: employeeId, period, attachmentBase64, passwordProtected } = body || {};
    if (!companyId || !employeeId || !/^\d{4}-\d{2}$/.test(String(period || '')) || !attachmentBase64) {
      res.status(400).json({ error: 'company_id, employee_id, period och attachmentBase64 krävs.' });
      return;
    }
    // Bara en PDF får bifogas ("%PDF" blir "JVBER" i base64).
    if (typeof attachmentBase64 !== 'string' || !attachmentBase64.startsWith('JVBER')) {
      res.status(400).json({ error: 'Lönebeskedet måste vara en PDF.' });
      return;
    }
    if (attachmentBase64.length > MAX_PDF_BASE64) {
      res.status(413).json({ error: 'Lönebeskedet är för stort.' });
      return;
    }

    const owned = await loadOwnedOrMemberCompany(user.id, companyId, res, { requireEditor: true });
    if (!owned) return;
    const { companyData, ownerUserId } = owned;
    const employee = (companyData.employees || []).find(e => e.id === employeeId);
    const to = String(employee?.email || '').trim();
    if (!employee || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      res.status(400).json({ error: 'Den anställda saknar en giltig e-postadress.' });
      return;
    }

    // Samma lönebesked till samma person högst tre gånger per dygn.
    if (!(await checkRateLimit(req, res, { key: 'send-payslip-once', windowMs: 24 * 60 * 60 * 1000, max: 3, identifier: `${ownerUserId}:${companyId}:${employeeId}:${period}` }))) return;

    const companyName = companyData.company?.name || 'Din arbetsgivare';
    const subject = `Lönebesked ${period} från ${companyName}`;
    const html = `
      <p style="margin:0 0 14px;">Hej ${esc(employee.firstName || '')}!</p>
      <p style="margin:0 0 14px;">Här är ditt lönebesked för ${esc(period)} från ${esc(companyName)}. Det ligger som PDF i mejlet.</p>
      ${passwordProtected ? '<p style="margin:0 0 14px;">PDF:en är skyddad med lösenord. Lösenordet är de fyra sista siffrorna i ditt personnummer.</p>' : ''}
      <p style="margin:0 0 14px;">Har du frågor om lönen, svara på det här mejlet eller kontakta din arbetsgivare.</p>
    `;
    const attachmentFilename = `lonebesked-${period}.pdf`;
    const replyTo = companyData.company?.email || undefined;

    const own = await trySendFromOwnAddress(ownerUserId, companyId, { to, subject, html, replyTo, attachmentBase64, attachmentFilename });
    if (own.used && own.ok) {
      res.status(200).json({ id: own.id, sentFrom: 'own' });
      return;
    }
    if (!hasResendApiKey()) {
      res.status(503).json({ error: own.used ? `Utskicket från din egen adress misslyckades: ${own.error}` : 'E-post är inte konfigurerat.' });
      return;
    }
    const result = await sendWithFallback({
      to: [to], subject, html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      attachments: [{ filename: attachmentFilename, content: attachmentBase64 }],
    }, companyData.company);
    if (!result.ok) {
      await logSystemEvent('email_failed', `Lönebesked: ${result.data?.message || `Resend svarade ${result.status}`}`);
      res.status(result.status).json({ error: result.data?.message || 'Kunde inte skicka lönebeskedet.' });
      return;
    }
    res.status(200).json({ id: result.data.id, sentFrom: 'bokix' });
  } catch (error) {
    await logSystemEvent('email_failed', `Lönebesked: ${error?.message || error}`);
    res.status(500).json({ error: error?.message || 'Kunde inte skicka lönebeskedet.' });
  }
}
