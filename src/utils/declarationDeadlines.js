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
function quarterToRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

// Verifierat direkt mot skatteverket.se (två separata sidor, "När ska jag
// deklarera moms" och "När ska jag lämna arbetsgivardeklarationen",
// hämtade 2026-09-01): förfallodagen är den 17:e istället för den 12:e
// när förfallomånaden är AUGUSTI — gäller BÅDA deklarationerna av samma
// bakomliggande skäl (Skatteverkets egen sommaruppehåll-regel), inte två
// separata undantag att hålla reda på. Momsens 2:a-månaden-efter-kvartalet-
// regel råkar träffa augusti för kvartal 2 (apr–jun) → 17 augusti, inte 12.
// AGI:s följande-månaden-regel råkar träffa augusti för juli-lönen → 17
// augusti, inte 12. Ingen annan månad har ett liknande undantag (kollat
// specifikt, inte antaget) — fanns tidigare uppgifter om ett
// januari-undantag också, men det visade sig vara en vanlig
// helg-framflyttning ETT specifikt år (redan täckt av dow-kollen nedan),
// inte en egen strukturell regel.
function dueDayForMonth(month /* 0-indexerad */) {
  return month === 7 ? 17 : 12; // 7 = augusti
}

/** Framflyttning till nästa vardag om förfallodagen landar på en helg —
 * delad av båda deadline-funktionerna nedan. Tar INTE hänsyn till röda
 * dagar (annandag jul m.fl.) som Skatteverket ibland flyttar fram
 * separat utöver helger — bara helg-regeln, som är den del av
 * "framflyttas om det inte är en vardag"-principen som går att räkna ut
 * generellt utan en hårdkodad kalender över rörliga helgdagar år för år. */
function rollForwardPastWeekend(d) {
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}

/** Momsdeklarationens förfallodag enligt Skatteverkets regel för
 * kvartalsvis redovisning (12:e — eller 17:e i augusti, se dueDayForMonth
 * — i andra månaden efter periodens slut), framflyttat till nästa vardag
 * om det landar på en helg. Tar INTE hänsyn till röda dagar (annandag jul
 * m.fl.) som Skatteverket ibland flyttar fram separat utöver helger — se
 * rollForwardPastWeekend. Returnerar null för månads-/årsvis redovisning
 * — det enda flödet som faktiskt är implementerat är kvartalsvis (se
 * VatDeclaration.jsx). */
export function nextVatDeadline(company, vatPeriods) {
  if ((company?.vatPeriod || 'quarterly') !== 'quarterly') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let y = today.getFullYear();
  let q = Math.floor(today.getMonth() / 3) + 1;
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

/** AGI (arbetsgivardeklaration) — förfallodag 12:e (eller 17:e i augusti,
 * se dueDayForMonth) i månaden EFTER den månad lönerna avser, samma
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
