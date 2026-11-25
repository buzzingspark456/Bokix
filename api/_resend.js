// Delad Resend-sändningslogik — flyttad UT ur api/email/send-invoice.js
// (som fortfarande importerar och använder den, oförändrat beteende) så
// att api/cron/reminders.js kan skicka påminnelser genom EXAKT samma
// avsändaruppslag/fallback-logik istället för en egen, lätt-att-driva-isär
// kopia. Bara ett hjälpmodul (`_`-prefix), räknas inte mot Vercels
// 12-funktionsgräns (Hobby-plan).
//
// Bugkritiskt (lokal utveckling): env-variablerna läses HÄR INNE I
// funktionerna, INTE som toppnivå-konstanter längre. server.js importerar
// numera api/cron/reminders.js (och därmed transitivt den här filen)
// direkt istället för att handkopiera dess logik (se kommentaren vid
// remindersHandler-importen i server.js) — ES-moduler evaluerar HELA
// importgrafen INNAN den importerande filens egen kod körs, så en
// toppnivå-konstant här hade läst process.env INNAN server.js:s egen
// dotenv.config() (som körs i server.js:s kroppstext, efter dess imports)
// hunnit sätta något — resultatet blev "RESEND_API_KEY saknas" trots att
// nyckeln fanns i .env. Vercel-produktionen påverkas inte (env-variabler
// finns redan satta innan någon modul evalueras där), men lokalt måste
// läsningen skjutas upp till anropstillfället.
import crypto from 'crypto';

const getResendApiKey = () => process.env.RESEND_API_KEY || null;
const getResendAdminApiKey = () => process.env.RESEND_ADMIN_API_KEY || null;
const getEmailFrom = () => process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>';
const SENDER_LOCAL_PART = 'faktura';

export function hasResendApiKey() {
  return Boolean(getResendApiKey());
}

export function fallbackSenderAddress(companyName) {
  const emailFrom = getEmailFrom();
  const match = /^(.*)<(.+)>$/.exec(emailFrom);
  if (match && companyName) {
    return `${companyName} via Bokix <${match[2].trim()}>`;
  }
  return emailFrom;
}

// Domän-id:t sparas i kundens egen data och går därför att skriva in för
// hand. Servern signerar id + företag när domänen skapas, och bara ett
// id med giltig signatur används (säkerhetsgranskningen 2026-10-20: ett
// annat företags id godtogs om man kände till det). Fältnamnet innehåller
// "token" så att inbjudna medlemmar varken ser eller skriver det, se
// api/_memberView.js.
function domainTokenFor(domainId, companyId) {
  const secret = process.env.EMAIL_SECRET_KEY;
  if (!secret || !domainId || !companyId) return null;
  return crypto.createHmac('sha256', secret).update(`resend-domain:${domainId}:${companyId}`).digest('base64url');
}

export function signResendDomain(domainId, companyId) {
  const token = domainTokenFor(domainId, companyId);
  if (!token) throw new Error('EMAIL_SECRET_KEY saknas.');
  return token;
}

/** Stämmer företagets sparade resendDomainToken med id:t och företaget? */
export function hasValidResendDomainToken(company, companyId = company?.id) {
  const expected = domainTokenFor(company?.resendDomainId, companyId);
  const given = String(company?.resendDomainToken || '');
  if (!expected || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Bugkritiskt (Sida 33): frågar alltid Resend live om domänens status
 * innan ett utskick — aldrig en cachad flagga. Faller tyst tillbaka till
 * systemadressen om domänen saknas, inte är verifierad, eller om
 * statuskontrollen misslyckas. */
export async function resolveSenderAddress(company) {
  const resendAdminApiKey = getResendAdminApiKey();
  const fallback = fallbackSenderAddress(company?.name);
  if (!company?.resendDomainId || !company?.emailDomain || !resendAdminApiKey || !hasValidResendDomainToken(company)) {
    return { from: fallback, usingCustomDomain: false };
  }
  try {
    const domainRes = await fetch(`https://api.resend.com/domains/${company.resendDomainId}`, {
      headers: { Authorization: `Bearer ${resendAdminApiKey}` },
    });
    if (!domainRes.ok) return { from: fallback, usingCustomDomain: false };
    const domainData = await domainRes.json();
    // Adressen byggs av domänen Resend själv har verifierat, aldrig av
    // emailDomain som kunden sparar själv: annars kunde ett verifierat id
    // kombineras med vilken domän som helst (säkerhetsgranskningen 2026-10-20).
    const verifiedName = String(domainData?.name || '').toLowerCase();
    if (domainData?.status === 'verified' && verifiedName && verifiedName === String(company.emailDomain).trim().toLowerCase()) {
      return { from: `${company.name} <${SENDER_LOCAL_PART}@${verifiedName}>`, usingCustomDomain: true };
    }
  } catch (error) {
    console.error('Resend domain status check failed, falling back:', error);
  }
  return { from: fallback, usingCustomDomain: false };
}

// Mejl från Bokix egna adress: svar ska komma fram även när adressen inte tar
// emot mejl. Företagens egna domäner och angivna svarsadresser rörs inte.
function withBokixReplyTo(payload) {
  if (payload.reply_to || !/@bokix.se>?s*$/i.test(String(payload.from || ''))) return payload;
  return { ...payload, reply_to: process.env.CONTACT_INBOX || 'support@bokix.se' };
}

export async function sendViaResend(payload, { idempotencyKey } = {}) {
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(withBokixReplyTo(payload)),
  });
  const data = await resendRes.json().catch(() => ({}));
  return { ok: resendRes.ok, status: resendRes.status, data };
}

/** Skickar med avsändarens egen domän, provar automatiskt igen med
 * systemadressen om det misslyckas — samma bugkritiska retry-logik som
 * fanns inline i send-invoice.js, nu delad. `company` behövs bara för
 * fallback-avsändarnamnet, inte hela objektet. */
export async function sendWithFallback(basePayload, company) {
  const { from } = await resolveSenderAddress(company);
  let result = await sendViaResend({ ...basePayload, from });
  const fallback = fallbackSenderAddress(company?.name);
  if (!result.ok && from !== fallback) {
    console.warn('Send with custom domain failed, retrying with fallback sender:', result.data);
    result = await sendViaResend({ ...basePayload, from: fallback });
  }
  return result;
}
