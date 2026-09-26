/**
 * Företagets räkenskapsår, för allt som ska räknas per räkenskapsår och
 * inte per kalenderår (bokslut, INK2, NE, SRU, låsta år).
 *
 * En "period" är antingen ett kalenderår som sträng ("2026", så som äldre
 * kod och äldre sparade data alltid gjort) eller { start, end } i ISO-datum.
 * Alla funktioner här tar båda, så ett kalenderårsföretag beter sig exakt
 * som förut.
 *
 * Nycklar: ett räkenskapsår som är ett kalenderår har nyckeln "2026" (samma
 * som tidigare, så sparade lås, checklistor och NE-värden hittas). Ett brutet
 * år får "2025/2026" och sparar dessutom start och slut i låset.
 */
import { fiscalYearBounds } from './reportCalculations';

const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function periodStart(period) {
  return typeof period === 'object' && period ? period.start : `${period}-01-01`;
}
export function periodEnd(period) {
  return typeof period === 'object' && period ? period.end : `${period}-12-31`;
}

/** Ligger datumet (ÅÅÅÅ-MM-DD eller ÅÅÅÅ-MM) inom perioden? */
export function inPeriod(date, period) {
  if (!date) return false;
  if (typeof period !== 'object' || !period) return String(date).startsWith(String(period));
  const d = String(date).length === 7 ? `${date}-01` : String(date).slice(0, 10);
  return d >= period.start && d <= period.end;
}

/** "2026" om perioden är ett kalenderår, annars "2025/2026". */
export function periodLabel(period) {
  const start = periodStart(period);
  const end = periodEnd(period);
  const y1 = start.slice(0, 4);
  const y2 = end.slice(0, 4);
  if (start.slice(5) === '01-01' && end.slice(5) === '12-31' && y1 === y2) return y1;
  return y1 === y2 ? `${start} – ${end}` : `${y1}/${y2}`;
}

/**
 * Räkenskapsåret som pågår `now` (eller senast avslutades, om inget pågår).
 * Ett första, avvikande räkenskapsår (company.firstFiscalYear) gäller fram
 * till sitt slut; därefter följer åren company.fiscalYear.
 */
export function activeFiscalYear(company, now = new Date()) {
  const first = company?.firstFiscalYear;
  const today = toIso(now);
  let start;
  let end;
  if (first?.start && first?.end && today <= first.end) {
    ({ start, end } = first);
  } else {
    const b = fiscalYearBounds(company?.fiscalYear, now);
    start = toIso(b.start);
    end = toIso(b.end);
  }
  const label = periodLabel({ start, end });
  return { start, end, label, key: label, isCalendar: /^\d{4}$/.test(label) };
}

/** Är datumet i ett låst räkenskapsår? Returnerar årets namn, annars null. */
export function lockedPeriodFor(date, lockedFiscalYears) {
  if (!date) return null;
  for (const [key, lock] of Object.entries(lockedFiscalYears || {})) {
    if (!lock) continue;
    const period = lock.start && lock.end ? { start: lock.start, end: lock.end } : key;
    if (inPeriod(date, period)) return key;
  }
  return null;
}
