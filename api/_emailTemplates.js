// Server-sidans HTML-mallar för AUTOMATISKA utskick (api/cron/reminders.js)
// — till skillnad från fakturautskicket (Invoices.jsx) byggs HTML:en här på
// SERVERN, inte klienten, eftersom en cron-körning inte har någon inloggad
// klient som kan bygga den. Samma ton/formatering som fakturamejlet i
// Invoices.jsx (~rad 310-320): "Hej ... Med vänlig hälsning", samma gröna
// CTA-knapp (#0b6329, Bokix märkesfärg) — bara ett annat innehåll.
const fmt = (val) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

function ctaButton(url, label) {
  return `<p style="margin: 20px 0;"><a href="${url}" style="display:inline-block;padding:12px 26px;background:#0b6329;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a></p>`;
}

/** Automatisk betalningspåminnelse till KUNDEN — samma sakinnehåll som den
 * manuella mailto-påminnelsen (Invoices.jsx: buildReminderMailto), men ett
 * riktigt utskick via Resend istället för att öppna avsändarens eget
 * e-postprogram. */
export function buildInvoiceReminderHtml({ invoice, customer, company, grossAmount }) {
  return `
    <p>Hej${customer?.contactPerson ? ' ' + customer.contactPerson : ''},</p>
    <p>Det här är en automatisk påminnelse om faktura <strong>${invoice.invoiceNumber}</strong> på <strong>${fmt(grossAmount)} kr</strong>, som förföll ${formatDate(invoice.dueDate)}.</p>
    <p>Hör av dig om du redan betalat eller har frågor.</p>
    <p>Med vänlig hälsning<br/>${company?.invoiceDisplayName || company?.name || ''}</p>
  `;
}

/** Automatisk deadline-påminnelse till FÖRETAGET (inte kunden) om en
 * kommande momsdeklaration. */
export function buildVatDeadlineHtml({ company, deadline, siteUrl }) {
  return `
    <p>Hej${company?.name ? ' ' + company.name : ''},</p>
    <p>Momsdeklarationen för <strong>kvartal ${deadline.quarter}, ${deadline.year}</strong> ska vara inlämnad till Skatteverket senast <strong>${formatDate(deadline.dueDate)}</strong>.</p>
    ${siteUrl ? ctaButton(`${siteUrl}/`, 'Öppna Bokix') : ''}
    <p>Med vänlig hälsning<br/>Bokix</p>
  `;
}

/** Automatisk deadline-påminnelse till FÖRETAGET om en kommande AGI
 * (arbetsgivardeklaration). */
export function buildAgiDeadlineHtml({ company, deadline, siteUrl }) {
  return `
    <p>Hej${company?.name ? ' ' + company.name : ''},</p>
    <p>Arbetsgivardeklarationen (AGI) för löner utbetalda i <strong>${deadline.periodKey}</strong> ska vara inlämnad till Skatteverket senast <strong>${formatDate(deadline.dueDate)}</strong>.</p>
    ${siteUrl ? ctaButton(`${siteUrl}/`, 'Öppna Bokix') : ''}
    <p>Med vänlig hälsning<br/>Bokix</p>
  `;
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
export function buildTrialEndingHtml({ trialEndsAt, siteUrl }) {
  return `
    <p>Hej,</p>
    <p>Din kostnadsfria provperiod av Bokix går ut <strong>${formatDate(trialEndsAt)}</strong>. Därefter dras <strong>179 kr/mån</strong> automatiskt på kortet du la in.</p>
    <p>Vill du inte fortsätta går det bra att avsluta när som helst innan dess, utan att det kostar något — under Inställningar → Prenumeration.</p>
    ${siteUrl ? ctaButton(`${siteUrl}/`, 'Öppna Bokix') : ''}
    <p>Med vänlig hälsning<br/>Bokix</p>
  `;
}

/** Engångskoden i registreringens "Bekräfta e-post"-steg (Auth.jsx) — se
 * api/auth/request-password-reset.js:s send-signup-code-gren. Koden visas
 * stort och glesspatierat, samma idé som alla andra tjänsters e-post-OTP,
 * så den går snabbt att läsa och skriva av även på en liten mobilskärm. */
export function buildSignupVerificationHtml({ code }) {
  return `
    <p>Hej,</p>
    <p>Din kod för att bekräfta e-postadressen hos Bokix är:</p>
    <p style="margin: 24px 0; text-align: center;">
      <span style="display:inline-block;padding:14px 22px;background:#f4f4f5;border-radius:10px;font-size:32px;font-weight:700;letter-spacing:10px;color:#111827;">${code}</span>
    </p>
    <p>Koden gäller i 10 minuter. Bad du inte om den här koden kan du bortse från mejlet.</p>
    <p>Med vänlig hälsning<br/>Bokix</p>
  `;
}

/** Reauthentication inför en känslig ändring (byt lösenord, spara
 * företagsuppgifter, koppla/koppla från Stripe) — se
 * api/auth/request-password-reset.js:s send-reauth-code-gren. Samma
 * visuella mönster som buildSignupVerificationHtml ovan (stor,
 * glesspatierad kod), bara annan brödtext eftersom mottagaren redan är
 * inloggad, inte mitt i registreringen. */
export function buildReauthCodeHtml({ code }) {
  return `
    <p>Hej,</p>
    <p>Din kod för att bekräfta ändringen i Bokix är:</p>
    <p style="margin: 24px 0; text-align: center;">
      <span style="display:inline-block;padding:14px 22px;background:#f4f4f5;border-radius:10px;font-size:32px;font-weight:700;letter-spacing:10px;color:#111827;">${code}</span>
    </p>
    <p>Koden gäller i 10 minuter. Bad du inte om den här koden bör du byta lösenord — någon annan kan ha kommit åt ditt konto.</p>
    <p>Med vänlig hälsning<br/>Bokix</p>
  `;
}
