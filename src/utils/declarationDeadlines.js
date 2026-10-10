// Deadline-uträkningar för Skatteverket-inlämningar — delad mellan
// Dashboard.jsx (den synliga varningswidgeten, "X dagar kvar") och
// api/cron/reminders.js (den faktiska automatiska påminnelsen). Flyttad hit
// FRÅN Dashboard.jsx (som tidigare hade nextVatDeadline lokalt definierad)
// specifikt så de aldrig kan glida isär — en cron som räknade ut deadlines
// på ett annat sätt än det UI:t visar hade kunnat påminna en dag som inte
// stämmer med vad Dashboard säger.
//
// Ren datummatte, inga React-/webbläsar-globaler — säkert att importera
// från en Vercel serverless-funktion (Node-miljö, inget DOM/window).
//
// quarterToRange kopieras hit istället för att importeras från
// vatCalculation.js — verifierat (inte antaget) att Node's egen ESM-
// modulupplösning, till skillnad från Vites, KRÄVER en explicit ".js"-
// ändelse på relativa imports. vatCalculation.js importerar i sin tur
// extensionlöst från verificationAmounts/vatConfig, så att importera HELA
// den kedjan hade kraschat api/cron/reminders.js i produktion (Vercel kör
// api/**-filer med råa Node, aldrig genom Vite) — även om `vite build`
// själv aldrig hade upptäckt det, eftersom Vite tolererar extensionlösa
// imports. En liten, stabil 5-radersfunktion att hålla dubblerad är
// billigare än att lägga till .js-ändelser i hela vatCalculation.js:s
// beroendekedja.
export function quarterToRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

// Verifierat direkt mot skatteverket.se (två separata sidor, "När ska jag
// deklarera moms" och "När ska jag lämna arbetsgivardeklarationen") samt
// omkorsverifierat 2026-09-12 mot flera oberoende datumtabeller
// (foretagsdatum.se m.fl.): förfallodagen är den 17:e istället för den
// 12:e när förfallomånaden är AUGUSTI ELLER JANUARI — gäller BÅDA
// deklarationerna av samma bakomliggande skäl (Skatteverkets egen
// sommar- respektive nyårsuppehåll-regel).
//
// RÄTTELSE 2026-09-12: en tidigare version av den här kommentaren
// påstod att januari INTE hade något eget undantag (att det bara sett
// ut så för att en helg-framflyttning råkade träffa just 2026). Det var
// fel — omkontrollerat mot flera oberoende källor som visar december-
// lönens AGI-förfallodag (deklareras i januari) med bas-dag 17, inte 12
// (t.ex. "19 januari 2026" = 17:e framflyttat förbi lördagen 17/1 2026,
// inte 12:e som redan är en vardag den veckan). Samma mönster gäller
// momsens 2:a-månaden-efter-regel om den någonsin träffar januari (görs
// inte idag, se nextVatDeadline — bara kvartalsvis är implementerat, och
// inget kvartal faller i januari).
// Exporterad (utöver den interna användningen i den här filen) sedan
// /verktyg/momsdatum (freeToolCalculations.js: nextVatDeadlinePublic) —
// det publika verktyget ska räkna med EXAKT samma undantag som den
// inloggade appen, aldrig en egen kopia som kan glida isär.
export function dueDayForMonth(month /* 0-indexerad */) {
  return (month === 7 || month === 0) ? 17 : 12; // 7 = augusti, 0 = januari
}

/** Framflyttning till nästa vardag om förfallodagen landar på en helg —
 * delad av båda deadline-funktionerna nedan. Tar INTE hänsyn till röda
 * dagar (annandag jul m.fl.) som Skatteverket ibland flyttar fram
 * separat utöver helger — bara helg-regeln, som är den del av
 * "framflyttas om det inte är en vardag"-principen som går att räkna ut
 * generellt utan en hårdkodad kalender över rörliga helgdagar år för år. */
export function rollForwardPastWeekend(d) {
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}

/** Momsdeklarationens förfallodag enligt Skatteverkets regel för
 * kvartalsvis redovisning (12:e — eller 17:e i januari/augusti, se
 * dueDayForMonth — i andra månaden efter periodens slut), framflyttat till nästa vardag
 * om det landar på en helg. Tar INTE hänsyn till röda dagar (annandag jul
 * m.fl.) som Skatteverket ibland flyttar fram separat utöver helger — se
 * rollForwardPastWeekend. Returnerar null för månads-/årsvis redovisning
 * — det enda flödet som faktiskt är implementerat är kvartalsvis (se
 * VatDeclaration.jsx). */
export function vatDueDate(year, quarter) {
  const [, periodEnd] = quarterToRange(year, quarter);
  const d = new Date(periodEnd + 'T00:00:00');
  // setDate(1) först: se kommentaren i nextVatDeadline om överspillet för kvartal 4.
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);
  d.setDate(dueDayForMonth(d.getMonth()));
  return rollForwardPastWeekend(d);
}

export function nextVatDeadline(company, vatPeriods) {
  // Inte momsregistrerat (vatRegistered === false): ingen momsdeklaration.
  if (company?.vatRegistered === false) return null;
  if ((company?.vatPeriod || 'quarterly') !== 'quarterly') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Börja i kvartalet som senast tog slut: dess deklaration lämnas under
  // innevarande kvartal (Q3 senast 12 november osv.). Förut började den i
  // innevarande kvartal, vars dag alltid låg månader bort, så den 3 oktober
  // fanns ingen påminnelse om Q3-momsen alls (hittat 2026-10-03). Har förra
  // kvartalets dag redan passerat gäller innevarande kvartal, som förut.
  let y = today.getFullYear();
  let q = Math.floor(today.getMonth() / 3);
  if (q === 0) { q = 4; y -= 1; }
  if (today > vatDueDate(y, q)) {
    q += 1;
    if (q > 4) { q = 1; y += 1; }
  }
  let guard = 0;
  while (vatPeriods?.[`${y}-Q${q}`] && guard < 8) {
    q += 1;
    if (q > 4) { q = 1; y += 1; }
    guard += 1;
  }
  const [, periodEnd] = quarterToRange(y, q);
  const d = new Date(periodEnd + 'T00:00:00');
  // Bugkritiskt (hittades vid en noggrannhetsgranskning, 2026-09-01):
  // periodEnd är kvartalets SISTA dag (t.ex. 31 december för kvartal 4) —
  // att köra setMonth(+2) MEDAN dagen fortfarande står på 31 lät JS:s egen
  // överspills-regel (december har fler dagar än februari) knuffa datumet
  // vidare till MARS istället för februari, ett helt fel förfallomånad för
  // just kvartal 4. setDate(1) FÖRST (en dag som finns i alla månader)
  // eliminerar överspillet helt innan setMonth+setDate(rätt dag) körs.
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);
  d.setDate(dueDayForMonth(d.getMonth()));
  rollForwardPastWeekend(d);
  const daysLeft = Math.round((d - today) / 86400000);
  return { daysLeft, quarter: q, year: y, dueDate: d };
}

/** AGI (arbetsgivardeklaration) — förfallodag 12:e (eller 17:e i
 * januari/augusti, se dueDayForMonth) i månaden EFTER den månad lönerna avser, samma
 * helgframflyttning som momsdeklarationen ovan. Antagande att flagga: den
 * skärpta 26:e-regeln för större arbetsgivare med fler anställda gäller
 * INTE här — 12:e-regeln är rätt för Bokix målgrupp (småföretag), men det
 * är ett medvetet val, inte en verifierad universell regel. periodKey
 * ("YYYY-MM") är månaden lönerna avser, INTE deadline-månaden. */
export function nextAgiDeadline(referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexerad, innevarande månad

  const dueThisMonth = new Date(y, m, dueDayForMonth(m));
  const nextMonth = (m + 1) % 12;
  const dueDate = today > dueThisMonth ? new Date(y, m + 1, dueDayForMonth(nextMonth)) : dueThisMonth;
  rollForwardPastWeekend(dueDate);

  const daysLeft = Math.round((dueDate - today) / 86400000);
  const periodDate = new Date(dueDate.getFullYear(), dueDate.getMonth() - 1, 1);
  const periodKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;
  return { daysLeft, periodKey, dueDate };
}

/** Kontrolluppgifter (KU) — samma fasta datum året runt (31 januari,
 * framflyttat till nästa vardag om det landar på en helg — Taxes.jsx:s
 * egen KU-flik anger redan "senast 31 januari" i sin brödtext, så det här
 * är INTE en ny, ogissad regel, bara samma redan angivna datum uttryckt
 * som en deadline-uträkning). Till skillnad från moms/AGI är KU:s
 * förfallodag INTE beroende av vilken period/månad man befinner sig i —
 * den upprepas en gång per KALENDERÅR, för föregående inkomstår.
 *
 * Kundfeedback ("viktiga datum visar inget när det senaste är avklarat"):
 * moms/AGI-korten (Taxes.jsx: vatDeadlineInfo/agiDeadlineInfo) är de enda
 * två deadline-typerna som fanns tidigare — utanför en snar moms-/löne-
 * deadline (eller om företaget saknar löneunderlag/kvartalsvis moms) blev
 * "Viktiga datum" därför tomt även om KU-deadlinen (31 januari) alltid
 * finns där ute och närmar sig. En tredje, alltid närvarande deadline-typ
 * (för alla företag med bokförda lönekörningar, precis som AGI) gör att
 * sidan sällan står helt tom mellan moms-/lönehändelser. */
export function nextKuDeadline(referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();

  let dueDate = new Date(y, 0, 31); // 31 januari samma år
  rollForwardPastWeekend(dueDate);
  if (today > dueDate) {
    dueDate = new Date(y + 1, 0, 31); // redan passerad i år — nästa är 31 januari nästa år
    rollForwardPastWeekend(dueDate);
  }

  const daysLeft = Math.round((dueDate - today) / 86400000);
  const incomeYear = dueDate.getFullYear() - 1; // KU:n som förfaller avser alltid FÖREGÅENDE inkomstår
  return { daysLeft, incomeYear, dueDate };
}

// ── Fler förfallodagar (2026-10-10) ──
// Så att Översikten har ett riktigt datum för allt, oavsett momsperiod och
// bolagsform. Källa: skatteverket.se, "När ska jag deklarera moms?" och
// "Viktiga datum" för inkomstdeklarationen. Bokix-användare lämnar in
// digitalt (fil eller e-tjänst), så de digitala datumen används.

const dayAfterWeekend = (y, m, d) => rollForwardPastWeekend(new Date(y, m, d));
const daysFromToday = (d, referenceDate = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};

/** Månadsmoms (omsättning upp till 40 mkr): den 12:e i andra månaden efter
 * perioden, den 17:e i januari och augusti. periodKey är "YYYY-MM". */
export function monthlyVatDueDate(periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  const due = new Date(y, m - 1 + 2, 1);
  return dayAfterWeekend(due.getFullYear(), due.getMonth(), dueDayForMonth(due.getMonth()));
}

/** Nästa månadsmoms som inte har passerat. Månaden som tog slut för två
 * månader sedan först, annars förra månaden. */
export function nextMonthlyVatDeadline(referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  for (let back = 2; back >= 0; back--) {
    const p = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const periodKey = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = monthlyVatDueDate(periodKey);
    if (dueDate >= today) return { periodKey, dueDate, daysLeft: daysFromToday(dueDate, today) };
  }
  return null;
}

// Räkenskapsårets sista månad (1–12) styr aktiebolagets datum.
const endMonthOf = (fyEnd) => Number(String(fyEnd).slice(5, 7));
const endYearOf = (fyEnd) => Number(String(fyEnd).slice(0, 4));

/** Helårsmoms. Enskild firma: 12 maj året efter (26 februari vid handel med
 * andra EU-länder). Aktiebolag och ekonomisk förening utan EU-handel: samma
 * dag som inkomstdeklarationen, digitalt. Handelsbolag och alla med
 * EU-handel: den 26:e i andra månaden efter året (27:e i december). */
export function yearlyVatDueDate({ orgType, fyEnd, euTrade = false }) {
  if (!fyEnd) return null;
  const y = endYearOf(fyEnd);
  const m = endMonthOf(fyEnd);
  const isSoleProp = orgType === 'Enskild firma';
  // Aktiebolag (AB), ekonomisk förening och okänd form räknas som bolag.
  const isCompany = !isSoleProp && orgType !== 'Handelsbolag / Kommanditbolag';
  if (isSoleProp && !euTrade) return dayAfterWeekend(y + 1, 4, 12);
  if (isSoleProp && euTrade) return dayAfterWeekend(y + 1, 1, 26);
  if (isCompany && !euTrade) {
    if (m <= 4) return dayAfterWeekend(y, 11, 12);       // 12 december
    if (m <= 6) return dayAfterWeekend(y + 1, 0, 17);    // 17 januari
    if (m <= 8) return dayAfterWeekend(y + 1, 3, 12);    // 12 april
    return dayAfterWeekend(y + 1, 7, 17);                // 17 augusti
  }
  const due = new Date(y, m - 1 + 2, 1);
  return dayAfterWeekend(due.getFullYear(), due.getMonth(), due.getMonth() === 11 ? 27 : 26);
}

/** Inkomstdeklarationen, digitalt. Aktiebolag och ekonomisk förening
 * (INK2) efter räkenskapsårets slut: januari–april 1 december, maj–juni
 * 15 januari, juli–augusti 1 april, september–december 1 augusti. Enskild
 * firma (INK1 med NE): 2 maj året efter. Handelsbolag: null, delägarna
 * deklarerar själva. */
export function incomeDeclarationDueDate({ orgType, fyEnd }) {
  if (!fyEnd) return null;
  const y = endYearOf(fyEnd);
  const m = endMonthOf(fyEnd);
  if (orgType === 'Enskild firma') return dayAfterWeekend(y + 1, 4, 2);
  if (orgType === 'Handelsbolag / Kommanditbolag') return null;
  if (m <= 4) return dayAfterWeekend(y, 11, 1);
  if (m <= 6) return dayAfterWeekend(y + 1, 0, 15);
  if (m <= 8) return dayAfterWeekend(y + 1, 3, 1);
  return dayAfterWeekend(y + 1, 7, 1);
}

/** AGI för en lönemånad: den 12:e månaden efter (17:e i januari och augusti). */
export function agiDueDate(periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  const due = new Date(y, m, 1);
  return dayAfterWeekend(due.getFullYear(), due.getMonth(), dueDayForMonth(due.getMonth()));
}

export { daysFromToday };
