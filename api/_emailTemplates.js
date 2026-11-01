// Server-sidans HTML-mallar för AUTOMATISKA utskick (api/cron/reminders.js)
// — till skillnad från fakturautskicket (Invoices.jsx) byggs HTML:en här på
// SERVERN, inte klienten, eftersom en cron-körning inte har någon inloggad
// klient som kan bygga den. Mejl från Bokix själv ligger i den gemensamma
// ramen (src/utils/brandedEmail.js); fakturapåminnelsen går till kundens
// kund och har därför ingen Bokix-ram.
import { brandedEmail, emailButton, emailCode } from '../src/utils/brandedEmail.js';

// Uppgifter ur företagets egen data (kundnamn, fakturanummer, företagsnamn)
// escapas innan de hamnar i HTML:en (granskningen 2026-10-28).
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt = (val) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

/** Automatisk betalningspåminnelse till KUNDEN — samma sakinnehåll som den
 * manuella mailto-påminnelsen (Invoices.jsx: buildReminderMailto), men ett
 * riktigt utskick via Resend istället för att öppna avsändarens eget
 * e-postprogram. */
export function buildInvoiceReminderHtml({ invoice, customer, company, grossAmount }) {
  return `
    <p>Hej${customer?.contactPerson ? ' ' + esc(customer.contactPerson) : ''},</p>
    <p>Det här är en automatisk påminnelse om faktura <strong>${esc(invoice.invoiceNumber)}</strong> på <strong>${fmt(grossAmount)} kr</strong>, som förföll ${formatDate(invoice.dueDate)}.</p>
    <p>Hör av dig om du redan betalat eller har frågor.</p>
    <p>Med vänlig hälsning<br/>${esc(company?.invoiceDisplayName || company?.name || '')}</p>
  `;
}

/** Automatisk deadline-påminnelse till FÖRETAGET (inte kunden) om en
 * kommande momsdeklaration. */
export function buildVatDeadlineHtml({ company, deadline, siteUrl }) {
  return brandedEmail({
    title: 'Momsdeklarationen närmar sig',
    body: `
    <p>Hej${company?.name ? ' ' + esc(company.name) : ''},</p>
    <p>Momsdeklarationen för <strong>${deadline.label || `kvartal ${deadline.quarter} ${deadline.year}`}</strong> ska vara inlämnad till Skatteverket senast <strong>${formatDate(deadline.dueDate)}</strong>.</p>
    ${siteUrl ? emailButton(`${siteUrl}/`, 'Öppna Bokix') : ''}
  `,
  });
}

/** Automatisk deadline-påminnelse till FÖRETAGET om en kommande AGI
 * (arbetsgivardeklaration). */
export function buildAgiDeadlineHtml({ company, deadline, siteUrl }) {
  return brandedEmail({
    title: 'Arbetsgivardeklarationen närmar sig',
    body: `
    <p>Hej${company?.name ? ' ' + esc(company.name) : ''},</p>
    <p>Arbetsgivardeklarationen (AGI) för löner utbetalda i <strong>${esc(deadline.periodKey)}</strong> ska vara inlämnad till Skatteverket senast <strong>${formatDate(deadline.dueDate)}</strong>.</p>
    ${siteUrl ? emailButton(`${siteUrl}/`, 'Öppna Bokix') : ''}
  `,
  });
}

/** Automatisk påminnelse till KONTOT innan den kostnadsfria provperioden
 * går ut och kortet dras första gången — kontonivå, inget företagsobjekt
 * att hälsa "Hej [företag]" med (till skillnad från vat/agi ovan), därför
 * bara "Hej". Länken går till startsidan (samma mönster som vat/agi ovan,
 * `${siteUrl}/`) — appen har ingen tillförlitlig djuplänk direkt till en
 * Inställningar-underflik, se Settings.jsx (aktiv underflik hämtas ur
 * SAMMA window.location.hash som App.jsx redan använder för toppnivåfliken,
 * så en länk hit skulle kräva "#subscription" och då aldrig ens nå fram
 * till Inställningar-sidan). Vägen dit står istället i brödtexten. */
export function buildTrialEndingHtml({ trialEndsAt, monthlyPrice = 179, siteUrl }) {
  return brandedEmail({
    title: 'Din provperiod går snart ut',
    body: `
    <p>Hej,</p>
    <p>Din kostnadsfria provperiod av Bokix går ut <strong>${formatDate(trialEndsAt)}</strong>. Därefter dras <strong>${monthlyPrice} kr/mån</strong> automatiskt på kortet du la in.</p>
    <p>Vill du inte fortsätta går det bra att avsluta när som helst innan dess, utan att det kostar något — under Inställningar → Prenumeration.</p>
    ${siteUrl ? emailButton(`${siteUrl}/`, 'Öppna Bokix') : ''}
  `,
  });
}

/** UF-konto vars gratisperiod är slut och som varken betalat eller
 * avslutat (api/_ufAccount.js). Tre utskick: när perioden tar slut, en
 * månad före och en vecka före den automatiska stängningen. Bokföringen
 * sparas i sju år oavsett (Skatteverket kräver det även för UF-företag),
 * det är kontot som stängs. */
export function buildUfClosingHtml({ stage, closeDate, siteUrl }) {
  const date = formatDate(closeDate);
  const intro = stage === 'week'
    ? `<p>Om en vecka, <strong>${date}</strong>, stängs ert UF-konto hos Bokix.</p>`
    : stage === 'month'
      ? `<p>Om en månad, <strong>${date}</strong>, stängs ert UF-konto hos Bokix.</p>`
      : `<p>Gratisperioden för ert UF-konto hos Bokix är slut. Kontot är skrivskyddat, och om ni inte väljer något stängs det <strong>${date}</strong>.</p>`;
  return brandedEmail({
    title: 'Ert UF-konto stängs',
    body: `
    <p>Hej,</p>
    ${intro}
    <p>Vill ni driva företaget vidare fortsätter ni med Bokix. Är ni klara kan ni logga in och ladda ner bokföringen fram till dess, till exempel som underlag för årsredovisningen hos Ung Företagsamhet.</p>
    <p>Bokföringen och underlagen sparas i sju år även efter att kontot stängts, som Skatteverket kräver för UF-företag. Ni kan begära ut dem via bokixab@gmail.com.</p>
    ${siteUrl ? emailButton(`${siteUrl}/`, 'Logga in och välj') : ''}
  `,
  });
}

/** Engångskoden i registreringens "Bekräfta e-post"-steg (Auth.jsx) — se
 * api/auth/request-password-reset.js:s send-signup-code-gren. Koden visas
 * stort och glesspatierat, samma idé som alla andra tjänsters e-post-OTP,
 * så den går snabbt att läsa och skriva av även på en liten mobilskärm. */
export function buildSignupVerificationHtml({ code }) {
  return brandedEmail({
    title: 'Bekräfta din e-postadress',
    body: `
    <p style="text-align:center;">Skriv in koden nedan i Bokix för att bekräfta e-postadressen.</p>
    ${emailCode(code)}
  `,
    footnote: 'Koden gäller i 10 minuter. Bad du inte om den här koden kan du bortse från mejlet.',
  });
}

/** Reauthentication inför en känslig ändring (byt lösenord, spara
 * företagsuppgifter, koppla/koppla från Stripe) — se
 * api/auth/request-password-reset.js:s send-reauth-code-gren. Samma
 * visuella mönster som buildSignupVerificationHtml ovan (stor,
 * glesspatierad kod), bara annan brödtext eftersom mottagaren redan är
 * inloggad, inte mitt i registreringen. */
export function buildReauthCodeHtml({ code }) {
  return brandedEmail({
    title: 'Bekräfta ändringen',
    body: `
    <p style="text-align:center;">Skriv in koden nedan i Bokix för att bekräfta ändringen.</p>
    ${emailCode(code)}
  `,
    footnote: 'Koden gäller i 10 minuter. Bad du inte om den här koden bör du byta lösenord, någon annan kan ha kommit åt ditt konto.',
  });
}
