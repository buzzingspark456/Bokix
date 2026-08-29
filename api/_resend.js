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

/** Bugkritiskt (Sida 33): frågar alltid Resend live om domänens status
 * innan ett utskick — aldrig en cachad flagga. Faller tyst tillbaka till
 * systemadressen om domänen saknas, inte är verifierad, eller om
 * statuskontrollen misslyckas. */
export async function resolveSenderAddress(company) {
  const resendAdminApiKey = getResendAdminApiKey();
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

export async function sendViaResend(payload) {
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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
