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
    <p>Bokföringen och underlagen sparas i sju år även efter att kontot stängts, som Skatteverket kräver för UF-företag. Ni kan begära ut dem via support@bokix.se.</p>
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

/** Kom igång-mejlen (api/cron/_onboardingEmails.js): några tips de första två
 * veckorna, bara till nya konton. Varje mejl har en egen form (2026-11-11), så
 * att de inte ser ut som samma utskick fem gånger:
 *   välkommen (noll)  ett brev + en bild av Kom igång-listan
 *   välkommen (flytt) gamla programmet → Bokix + en tidslinje
 *   kvitto            ett ritat kvitto som blir bokfört
 *   sie               var exporten ligger i de vanligaste programmen
 *   faktura           en ritad faktura som går från Skickad till Betald
 * Bara tabeller och inbäddade stilar (Gmail, Outlook, Apple Mail). Allt som
 * står här finns i appen; exportvägarna är hållna lika allmänna som i
 * src/utils/migrationSources.js. */
const C = { ink: '#14211a', text: '#4a5a51', muted: '#8a968f', green: '#16a34a', greenSoft: '#e9f6ec', line: '#e6ece7', page: '#f2f5f3', amber: '#b45309', amberSoft: '#fdf3e4', blue: '#1d5fbf', blueSoft: '#e8f0fb' };
const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const p = (text, extra = '') => `<p style="margin:0 0 14px;font-size:15.5px;line-height:1.65;color:${C.text};${extra}">${text}</p>`;
const h1 = (text) => `<h1 style="margin:0 0 14px;font-size:28px;line-height:1.18;font-weight:800;letter-spacing:-0.02em;color:${C.ink};">${text}</h1>`;
const button = (href, label, color = C.green) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr>
    <td bgcolor="${color}" style="border-radius:12px;background-color:${color};">
      <a href="${href}" style="display:inline-block;padding:15px 28px;font-family:${F};font-size:15.5px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${label} &rarr;</a>
    </td>
  </tr></table>`;
const ps = (text) => `<p style="margin:24px 0 0;padding:16px 18px;border-radius:14px;background-color:${C.page};font-size:14px;line-height:1.6;color:${C.text};"><strong style="color:${C.ink};">PS.</strong> ${text}</p>`;
const signoff = `<p style="margin:22px 0 0;font-size:15.5px;line-height:1.6;color:${C.ink};">Hälsningar,<br><strong>Bokix</strong></p>`;

function shell({ subject, preheader, accent, body, unsubscribeUrl }) {
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background-color:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};">
  <tr><td align="center" style="padding:30px 14px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:0 6px 16px;"><img src="https://www.bokix.se/email-logo.png" width="100" alt="Bokix" style="display:block;border:0;"></td></tr>
      <tr><td style="background-color:#ffffff;border-radius:22px;border:1px solid ${C.line};border-top:4px solid ${accent};padding:32px 32px 30px;font-family:${F};">
        ${body}
      </td></tr>
      <tr><td style="padding:22px 12px 0;text-align:center;font-family:${F};font-size:12.5px;line-height:1.7;color:${C.muted};">
        Du får det här för att du nyligen startade Bokix. Har du frågor kan du svara på mejlet.<br>
        <a href="${unsubscribeUrl}" style="color:${C.muted};text-decoration:underline;">Inga fler tips</a> &nbsp;·&nbsp; <a href="https://www.bokix.se" style="color:${C.muted};text-decoration:none;">bokix.se</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── 1. Välkommen, från noll: ett brev och en bild av Kom igång-listan ──
function welcomeNew({ hi, href }) {
  const row = (label, done, next) => `
    <tr><td style="padding:9px 14px;border-top:1px solid ${C.line};">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td width="30" valign="middle"><div style="width:20px;height:20px;line-height:20px;border-radius:10px;text-align:center;font-size:12px;font-weight:700;${done ? `background-color:${C.green};color:#fff;` : `border:2px solid ${next ? C.green : C.line};box-sizing:border-box;`}">${done ? '&#10003;' : '&nbsp;'}</div></td>
        <td valign="middle" style="font-size:14px;font-family:${F};color:${done ? C.muted : C.ink};font-weight:${next ? 700 : 500};${done ? 'text-decoration:line-through;' : ''}">${label}</td>
        ${next ? `<td valign="middle" style="padding-left:10px;"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background-color:${C.green};color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.06em;font-family:${F};">NÄSTA</span></td>` : ''}
      </tr></table>
    </td></tr>`;
  return `
    ${p(`${hi},`, 'font-size:17px;color:' + C.ink + ';font-weight:600;')}
    ${p('Välkommen till Bokix. Det här ska kännas enkelt från första dagen.')}
    ${p('När du loggar in väntar en kort lista på startsidan. Den bockas av av sig själv när du gör stegen, så du behöver inte hålla koll:')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:12px 14px;background-color:${C.page};font-family:${F};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:14px;font-weight:800;color:${C.ink};">Kom igång</td>
          <td align="right" style="font-size:13px;font-weight:700;color:${C.muted};">1 av 4</td>
        </tr></table>
        <div style="margin-top:8px;height:6px;border-radius:3px;background-color:${C.line};"><div style="width:25%;height:6px;border-radius:3px;background-color:${C.green};font-size:0;line-height:0;">&nbsp;</div></div>
      </td></tr>
      ${row('Kontot är skapat', true, false)}
      ${row('Lägg till bankgiro', false, true)}
      ${row('Lägg in ditt första kvitto', false, false)}
      ${row('Skicka din första faktura', false, false)}
    </table>
    ${button(href, 'Öppna Bokix')}
    ${signoff}
    ${ps('Undrar du något, stort eller litet? Svara bara på det här mejlet. Det kommer till oss.')}`;
}

// ── 2. Välkommen, flyttar in: gamla programmet → Bokix och en tidslinje ──
function welcomeMove({ hi, href }) {
  const chip = (t) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:6px 11px;border-radius:999px;background-color:#ffffff;border:1px solid ${C.line};font-size:13px;font-weight:600;color:${C.text};font-family:${F};">${t}</span>`;
  const step = (when, title, text, last) => `
    <tr>
      <td width="22" valign="top" style="padding-top:4px;">
        <div style="width:12px;height:12px;border-radius:6px;background-color:${C.green};"></div>
        ${last ? '' : `<div style="width:2px;height:46px;margin:4px 0 0 5px;background-color:${C.line};"></div>`}
      </td>
      <td valign="top" style="padding:0 0 ${last ? 0 : 14}px 8px;font-family:${F};">
        <div style="font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${C.green};">${when}</div>
        <div style="font-size:15px;font-weight:700;color:${C.ink};margin-top:2px;">${title}</div>
        <div style="font-size:14px;color:${C.text};line-height:1.5;margin-top:2px;">${text}</div>
      </td>
    </tr>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-radius:16px;background-color:${C.greenSoft};">
      <tr><td style="padding:18px 18px 12px;font-family:${F};">
        ${chip('Fortnox')}${chip('Visma / Spiris')}${chip('Bokio')}${chip('Björn Lundén')}
        <div style="margin:4px 0 8px;font-size:20px;color:${C.green};">&darr;</div>
        <span style="display:inline-block;padding:8px 14px;border-radius:12px;background-color:${C.ink};color:#ffffff;font-size:15px;font-weight:800;font-family:${F};">Bokix</span>
      </td></tr>
    </table>
    ${h1('Välkommen. Nu flyttar vi in.')}
    ${p(`${hi}, kul att du byter till Bokix. Allt följer med i en fil, och du ser vad som läses in innan något sparas.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
      ${step('I dag', 'Exportera en SIE4-fil', 'Den finns i alla svenska bokföringsprogram.', false)}
      ${step('Samma dag', 'Läs in den under Flytta in', 'Konton och verifikationer visas först. Du bekräftar.', false)}
      ${step('När du vill', 'Kunder, anställda och bank', 'Från CSV- eller Excelfiler. Hoppa över det som inte gäller dig.', true)}
    </table>
    ${button(href, 'Så går flytten till', C.green)}
    ${signoff}
    ${ps('Säg inte upp det gamla programmet förrän du sett att allt kom med. Och hittar du inte exporten, svara med vilket program du har.')}`;
}

// ── 3. Kvitto: ett ritat kvitto som blir bokfört ──
function receipt({ hi, href }) {
  const line = (a, b, bold) => `<tr><td style="padding:3px 0;font-family:${MONO};font-size:13px;color:${C.ink};${bold ? 'font-weight:700;' : ''}">${a}</td><td align="right" style="padding:3px 0;font-family:${MONO};font-size:13px;color:${C.ink};${bold ? 'font-weight:700;' : ''}">${b}</td></tr>`;
  return `
    ${h1('Ett foto. Det är allt.')}
    ${p(`${hi}, du har inte lagt in något kvitto än. Så här lite behöver du göra:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;border-radius:16px;background-color:${C.amberSoft};">
      <tr><td align="center" style="padding:22px 18px;">
        <table role="presentation" width="230" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:6px;border:1px dashed #e2c9a3;">
          <tr><td style="padding:14px 16px 12px;">
            <div style="text-align:center;font-family:${MONO};font-size:13px;font-weight:700;color:${C.ink};">KONTORSHANDELN</div>
            <div style="text-align:center;font-family:${MONO};font-size:11.5px;color:${C.muted};margin:2px 0 10px;">14 nov · kvitto 2231</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${line('Pärmar 5 st', '199,00')}
              ${line('Pennor', '50,00')}
              <tr><td colspan="2" style="border-top:1px dashed #d8cbb6;font-size:0;line-height:0;padding:3px 0;">&nbsp;</td></tr>
              ${line('TOTALT', '249,00', true)}
              ${line('varav moms 25 %', '49,80')}
            </table>
          </td></tr>
        </table>
        <div style="margin:10px 0;font-size:20px;color:${C.amber};">&darr;</div>
        <span style="display:inline-block;padding:9px 14px;border-radius:999px;background-color:${C.green};color:#ffffff;font-size:13.5px;font-weight:700;font-family:${F};">&#10003; Bokfört på 6110 Kontorsmateriel</span>
      </td></tr>
    </table>
    ${p('Öppna <strong style="color:' + C.ink + ';">Kvitton</strong>, fota eller ladda upp. Bokix läser av belopp, datum och moms och föreslår konto. Är det osäkert frågar Bokix dig i stället för att gissa.', 'margin-top:18px;')}
    ${button(href, 'Lägg in ett kvitto', C.amber)}
    ${ps('Lägg Bokix på mobilens hemskärm, så fotar du kvittot i kassan och slipper en hög med papper i slutet av månaden.')}`;
}

// ── 4. SIE: var exporten ligger i de vanligaste programmen ──
function sie({ hi, href }) {
  const prog = (name, where) => `
    <tr><td style="padding:12px 14px;border-top:1px solid ${C.line};font-family:${F};">
      <div style="font-size:14.5px;font-weight:700;color:${C.ink};">${name}</div>
      <div style="font-size:13.5px;color:${C.text};margin-top:2px;line-height:1.5;">${where}</div>
    </td></tr>`;
  return `
    ${h1('Var ligger din SIE-fil?')}
    ${p(`${hi}, din bokföring ligger kvar i det gamla programmet. Det enda du behöver är en SIE4-fil därifrån. Så här brukar du hitta den:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:10px 14px;background-color:${C.blueSoft};font-family:${F};font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${C.blue};">Leta efter Arkiv eller Exportera, välj SIE typ 4</td></tr>
      ${prog('Fortnox', 'Bokföring, sedan Arkiv eller Exportera.')}
      ${prog('Visma / Spiris', 'Bokföring eller Redovisning, sedan Arkiv eller Import/Export.')}
      ${prog('Bokio', 'Bokföring, sedan Inställningar eller Exportera.')}
      ${prog('Björn Lundén', 'Välj räkenskapsåret, sedan Arkiv eller Import/Export.')}
    </table>
    ${p('Sedan öppnar du <strong style="color:' + C.ink + ';">Flytta in</strong> på startsidan i Bokix och väljer filen. Du granskar konton och verifikationer, och inget sparas förrän du bekräftar.', 'margin-top:18px;')}
    ${button(href, 'Så går flytten till', C.blue)}
    ${ps('Menyerna ändras ibland. Hittar du den inte, svara med vilket program du har, så tittar vi på det åt dig.')}`;
}

// ── 5. Faktura: en ritad faktura som går från Skickad till Betald ──
function invoice({ hi, href }) {
  const pill = (t, bg, fg) => `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${bg};color:${fg};font-size:12px;font-weight:700;font-family:${F};">${t}</span>`;
  return `
    ${h1('Din första faktura tar två minuter')}
    ${p(`${hi}, du har inte skickat någon faktura från Bokix än. Så här kan den se ut:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;border-radius:16px;background-color:${C.greenSoft};">
      <tr><td style="padding:20px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;border:1px solid ${C.line};">
          <tr><td style="padding:16px 18px;font-family:${F};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:12px;font-weight:800;letter-spacing:.12em;color:${C.ink};">FAKTURA 1001</td>
              <td align="right">${pill('Skickad', C.blueSoft, C.blue)} ${pill('&#10003; Betald', C.green, '#ffffff')}</td>
            </tr></table>
            <div style="font-size:13px;color:${C.muted};margin:10px 0 12px;">Till: Din kund AB · förfaller om 30 dagar</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13.5px;color:${C.ink};">
              <tr><td style="padding:6px 0;border-top:1px solid ${C.line};">Konsulttimmar, 10 h</td><td align="right" style="padding:6px 0;border-top:1px solid ${C.line};">9 500,00</td></tr>
              <tr><td style="padding:6px 0;color:${C.muted};">Moms 25 %</td><td align="right" style="padding:6px 0;color:${C.muted};">2 375,00</td></tr>
              <tr><td style="padding:8px 0 0;border-top:1px solid ${C.line};font-weight:800;">Att betala</td><td align="right" style="padding:8px 0 0;border-top:1px solid ${C.line};font-weight:800;">11 875,00 kr</td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
    ${p('Välj <strong style="color:' + C.ink + ';">Ny faktura</strong> under Kundfakturor, välj kund och skriv vad du sålt. Moms och summa räknas ut åt dig, fakturan bokförs när du skickar den, och på startsidan ser du när kunden har betalat.', 'margin-top:18px;')}
    ${button(href, 'Skapa en faktura')}
    ${ps('Ladda upp din logotyp under Inställningar, Fakturor, så står den på varje faktura från början.')}`;
}

const ONBOARDING = {
  welcome: {
    new: { subject: 'Välkommen till Bokix', preheader: 'En kort lista, sedan sköter Bokix resten.', accent: C.green, link: '/', build: welcomeNew },
    move: { subject: 'Välkommen till Bokix, nu flyttar vi in', preheader: 'Allt följer med i en fil. Du ser allt innan det sparas.', accent: C.green, link: '/byt-bokforingsprogram', build: welcomeMove },
  },
  receipt: { subject: 'Ett foto. Det är allt.', preheader: 'Ditt första kvitto tar en minut i Bokix.', accent: C.amber, link: '/', build: receipt },
  sie: { subject: 'Var ligger din SIE-fil?', preheader: 'Så hittar du exporten i Fortnox, Visma, Bokio och Björn Lundén.', accent: C.blue, link: '/byt-bokforingsprogram', build: sie },
  invoice: { subject: 'Din första faktura tar två minuter', preheader: 'Moms och summa räknas ut, och den bokförs av sig själv.', accent: C.green, link: '/', build: invoice },
};

export function buildOnboardingEmail({ step, path, firstName, siteUrl, unsubscribeUrl }) {
  const entry = ONBOARDING[step];
  const copy = entry?.build ? entry : entry?.[path === 'move' ? 'move' : 'new'];
  if (!copy) throw new Error(`Okänt Kom igång-steg: ${step}`);
  const name = String(firstName || '').trim();
  const hi = name ? `Hej ${esc(name)}` : 'Hej';
  const href = `${siteUrl || 'https://www.bokix.se'}${copy.link}`;
  const html = shell({ subject: copy.subject, preheader: copy.preheader, accent: copy.accent, unsubscribeUrl, body: copy.build({ hi, href }) });
  return { subject: copy.subject, html };
}
