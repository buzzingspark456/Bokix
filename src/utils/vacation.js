// ─────────────────────────────────────────────────────────────────────────
// Semester — dagarna, inte bara pengarna.
//
// Vad som fanns innan den här filen: en månatlig avsättning på 12 % av
// bruttolönen (procentregeln), bokförd mot 7290/2920 med sociala avgifter
// på 7519/2940. Det är korrekt så långt det räcker — men det är bara
// SKULDEN i kronor. Ingenstans fanns svaret på de frågor en anställd och en
// arbetsgivare faktiskt ställer: hur många dagar har jag tjänat in, hur
// många har jag tagit ut, hur många har jag kvar, och vad är en semesterdag
// värd för just mig? Det är den halvan som ligger här.
//
// Allt bygger på semesterlagen (1977:480). De paragrafer modellen faktiskt
// implementerar står utskrivna vid respektive funktion, så att den som
// granskar kan följa räkningen tillbaka till lagtexten i stället för att
// lita på att siffran är rätt.
//
// MEDVETNA FÖRENKLINGAR (dokumenterade, inte gömda — se `modelNotes` sist i
// filen, som visas i gränssnittet):
//   · Semesterlönegrundande frånvaro (sjukdom, föräldraledighet m.m., §17)
//     räknas inte som anställningstid vid intjänandet. Det gör att en
//     långtidssjukskriven får för få intjänade dagar i modellen.
//   · Förskottssemester och obetalda semesterdagar hanteras inte.
//   · Sparade dagar rullas vidare, men femårsgränsen (§18) bevakas inte —
//     den visas som en varning i stället för att dagar tas bort automatiskt.
// ─────────────────────────────────────────────────────────────────────────

import { computeEmployeePayroll } from './payrollCalculation';

/** Semesterårets längd i dagar, som semesterlagen räknar (§7). Skottår
 * ignoreras med flit: lagen skriver 365, inte "årets längd". */
const YEAR_DAYS = 365;

/** Procentregelns sats per betald semesterdag (§16b): 0,48 % av
 * semesterlöneunderlaget. Med 25 dagar blir det de välkända 12 %. */
export const VACATION_PAY_PER_DAY_RATE = 0.0048;

/** Semestertillägget vid sammalöneregeln (§16a): 0,43 % av månadslönen per
 * betald semesterdag, utöver den lön som ändå fortsätter löpa. */
export const VACATION_SUPPLEMENT_RATE = 0.0043;

/** Dagar över 20 får sparas (§18), i högst fem år. */
export const VACATION_DAYS_BEFORE_SAVING = 20;
export const MAX_SAVED_YEARS = 5;

const toDate = (d) => (d instanceof Date ? d : new Date(d));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Semesteråret ett datum tillhör: 1 april–31 mars (§3). Ett datum i januari
 * hör alltså till semesteråret som började i april FÖREGÅENDE år — den
 * förskjutningen är den vanligaste orsaken till att semestersaldon räknas
 * fel för hand.
 */
export function vacationYearFor(date = new Date()) {
  const d = toDate(date);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const start = new Date(startYear, 3, 1);
  const end = new Date(startYear + 1, 2, 31);
  return { start, end, startIso: iso(start), endIso: iso(end), label: `${startYear}/${startYear + 1}` };
}

/**
 * Intjänandeåret för ett givet semesterår: de tolv månaderna dessförinnan
 * (§3). Det är under DET året lönen betalades som semesterlönen räknas på,
 * och den anställningstiden som avgör hur många betalda dagar man får.
 */
export function earningYearFor(vacationYear) {
  const start = new Date(vacationYear.start.getFullYear() - 1, 3, 1);
  const end = new Date(vacationYear.start.getFullYear(), 2, 31);
  return { start, end, startIso: iso(start), endIso: iso(end), label: `${start.getFullYear()}/${end.getFullYear()}` };
}

/** Antal dagar en anställning överlappar en period. Används för intjänandet:
 * den som anställdes mitt i intjänandeåret tjänar in i proportion. */
export function employedDaysInPeriod(employee, period) {
  if (!employee?.startDate) return 0;
  const empStart = toDate(employee.startDate);
  const empEnd = employee.endDate ? toDate(employee.endDate) : null;
  const from = empStart > period.start ? empStart : period.start;
  const to = empEnd && empEnd < period.end ? empEnd : period.end;
  if (to < from) return 0;
  // +1 eftersom både första och sista dagen räknas som anställningsdagar.
  return Math.round((to - from) / 86400000) + 1;
}

/**
 * Betalda semesterdagar för ett semesterår (§7): anställningstiden under
 * intjänandeåret delat med 365, gånger antalet semesterdagar, ALLTID uppåt
 * till närmaste hel dag. Avrundningen är lagens, inte vår.
 */
export function earnedPaidDays(employee, vacationYear) {
  const earning = earningYearFor(vacationYear);
  const days = employedDaysInPeriod(employee, earning);
  const entitlement = Number(employee?.vacationDays) || 25;
  if (!days) return 0;
  return Math.min(entitlement, Math.ceil((days / YEAR_DAYS) * entitlement));
}

/**
 * Vad en semesterdag är värd.
 *
 * `sammalöneregeln` (månadsavlönade): lönen fortsätter löpa under
 * ledigheten, och ovanpå den betalas ett semestertillägg på 0,43 % av
 * månadslönen per dag. Det är alltså tillägget — inte hela dagslönen — som
 * är beloppet per semesterdag.
 *
 * `procentregeln` (timavlönade och rörlig lön): 0,48 % av
 * semesterlöneunderlaget per dag. Underlaget är den lön som betalades under
 * INTJÄNANDEÅRET, och den siffran måste komma utifrån (lönekörningarna) —
 * därför parametern `earningYearGross`.
 */
export function vacationPayPerDay(employee, earningYearGross = 0) {
  const rule = employee?.vacationRule || 'procentregeln';
  if (rule === 'sammaloneregeln') {
    const monthly = Number(employee?.monthlySalary) || 0;
    return {
      rule,
      perDay: Math.round(monthly * VACATION_SUPPLEMENT_RATE * 100) / 100,
      basis: `Semestertillägg ${(VACATION_SUPPLEMENT_RATE * 100).toFixed(2)} % av månadslönen ${Math.round(monthly)} kr`,
      note: 'Månadslönen fortsätter löpa under ledigheten — beloppet här är tillägget per uttagen dag, inte hela dagslönen.',
    };
  }
  if (rule === 'procentregeln') {
    return {
      rule,
      perDay: Math.round(earningYearGross * VACATION_PAY_PER_DAY_RATE * 100) / 100,
      basis: `${(VACATION_PAY_PER_DAY_RATE * 100).toFixed(2)} % av semesterlöneunderlaget ${Math.round(earningYearGross)} kr`,
      note: 'Underlaget är utbetald lön under intjänandeåret. Semesterlönen ersätter lönen för de dagarna.',
    };
  }
  return { rule, perDay: 0, basis: 'Ingen automatisk semesterlön för den här regeln', note: null };
}

/** Bruttolön utbetald till en anställd inom en period, hämtad ur
 * lönekörningarna. Bara körningar som faktiskt är beräknade räknas — ett
 * utkast är inte utbetald lön. */
export function grossPaidInPeriod(employee, payrollRuns = [], period) {
  return payrollRuns
    .filter(run => run.completedSteps?.includes('calculated'))
    .filter(run => {
      // `period` på en körning är "2026-09". Jämförs mot periodens månad,
      // inte mot ett exakt datum: en lönekörning avser en hel månad.
      const runMonth = `${run.period}-15`;
      const d = new Date(runMonth);
      return d >= period.start && d <= period.end;
    })
    .flatMap(run => run.rows || [])
    .filter(row => row.employeeId === employee.id)
    // Bruttolönen ligger inte sparad på raden — den räknas fram ur samma
    // motor som lönebeskedet, av samma frysta anställningsuppgifter. Att
    // spara en kopia hade varit ett andra svar på samma fråga, som kan
    // hinna bli inaktuellt.
    .reduce((sum, row) => sum + computeEmployeePayroll(row.employeeSnapshot || employee, row).gross, 0);
}

/** Uttagna semesterdagar under en period, räknade ur lönekörningarnas
 * lönearter. Lönekörningen är källan även här: en semesterdag räknas som
 * uttagen när den faktiskt betalats ut, inte när någon skrev in den i en
 * kalender. */
export function takenDaysInPeriod(employee, payrollRuns = [], period) {
  return payrollRuns
    .filter(run => run.completedSteps?.includes('calculated'))
    .filter(run => {
      const d = new Date(`${run.period}-15`);
      return d >= period.start && d <= period.end;
    })
    .flatMap(run => run.rows || [])
    .filter(row => row.employeeId === employee.id)
    .flatMap(row => row.lines || [])
    .filter(line => line.payTypeId === 'vacation_taken')
    .reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
}

/**
 * Hela semesterbilden för en anställd: intjänat, uttaget, kvar, sparat och
 * vad skulden är värd i kronor.
 *
 * `savedDays` kommer från den anställdas egen post (rullas vid årsskiftet)
 * och inte från en beräkning bakåt i tiden — historiken före Bokix finns
 * inte i systemet, och en modell som låtsas räkna fram den skulle ge fel
 * svar för varje företag som flyttat in mitt i ett semesterår.
 */
export function summarizeVacation({ employee, payrollRuns = [], asOf = new Date(), feeRate = 0.3142 }) {
  const vacationYear = vacationYearFor(asOf);
  const earningYear = earningYearFor(vacationYear);
  const earningYearGross = grossPaidInPeriod(employee, payrollRuns, earningYear);

  const earned = earnedPaidDays(employee, vacationYear);
  const taken = takenDaysInPeriod(employee, payrollRuns, vacationYear);
  const saved = Number(employee?.savedVacationDays) || 0;
  const pay = vacationPayPerDay(employee, earningYearGross);

  const remaining = Math.max(earned - taken, 0);
  const totalAvailable = remaining + saved;
  // Skulden: kvarvarande betalda dagar (inklusive sparade) gånger vad en dag
  // är värd, plus arbetsgivaravgifter — det är den summa som ska finnas på
  // 2920 och 2940 när året stängs.
  const liability = Math.round(totalAvailable * pay.perDay);
  const liabilityFee = Math.round(liability * feeRate);

  return {
    vacationYear, earningYear, earningYearGross,
    entitlement: Number(employee?.vacationDays) || 25,
    earned, taken, remaining, saved, totalAvailable,
    payPerDay: pay.perDay, payBasis: pay.basis, payNote: pay.note, rule: pay.rule,
    liability, liabilityFee, liabilityTotal: liability + liabilityFee,
    // Dagar över 20 får sparas till kommande år (§18). Visas som en
    // upplysning vid årsskiftet, inte som något systemet gör automatiskt.
    savableAtYearEnd: Math.max(remaining - VACATION_DAYS_BEFORE_SAVING, 0),
    overEntitlement: taken > earned + saved,
  };
}

/** Summering för hela företaget — semesterskulden är en balanspost och ska
 * kunna stämmas av mot 2920 utan att man öppnar varje anställd. */
export function summarizeVacationLiability({ employees = [], payrollRuns = [], asOf = new Date(), feeRate = 0.3142 }) {
  const rows = employees
    .filter(e => e.active !== false)
    .map(employee => ({ employee, ...summarizeVacation({ employee, payrollRuns, asOf, feeRate }) }));
  return {
    rows,
    totalDays: rows.reduce((s, r) => s + r.totalAvailable, 0),
    totalLiability: rows.reduce((s, r) => s + r.liability, 0),
    totalLiabilityFee: rows.reduce((s, r) => s + r.liabilityFee, 0),
    vacationYear: vacationYearFor(asOf),
  };
}

/** De förenklingar modellen gör, i klartext. Visas i gränssnittet — en
 * uträkning man inte kan lita på blint ska säga var gränserna går. */
export const VACATION_MODEL_NOTES = [
  'Semesterlönegrundande frånvaro (sjukdom, föräldraledighet) räknas inte som anställningstid vid intjänandet — en långtidssjukskriven får därför för få dagar här.',
  'Förskottssemester och obetalda semesterdagar hanteras inte.',
  'Sparade dagar rullas vidare men femårsgränsen bevakas inte automatiskt.',
  'Uttagna dagar räknas ur lönekörningarna, alltså när semestern faktiskt betalats ut.',
];
