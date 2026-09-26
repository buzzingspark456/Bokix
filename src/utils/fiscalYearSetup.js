/**
 * Räkenskapsåret när ett företag läggs upp ("Vilket räkenskapsår har ni?"):
 *   calendar  kalenderår, 1 januari–31 december
 *   other     brutet räkenskapsår som börjar den 1:a i en annan månad
 *   first     företagets första räkenskapsår, som får vara kortare eller
 *             längre än tolv månader (högst 18, bokföringslagen 3 kap. 3 §)
 *             och ska sluta vid ett månadsskifte
 *
 * company.fiscalYear är som tidigare ett startdatum där bara månad och dag
 * används (se fiscalYearBounds i reportCalculations.js). För ett första år
 * sparas där när de vanliga åren börjar, alltså dagen efter första årets
 * slut, och själva första året i company.firstFiscalYear.
 */

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const parse = (s) => { const [y, m, d] = String(s || '').split('-').map(Number); return { y, m, d }; };

export const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

export function todayIso(now = new Date()) {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Tillåtna slutdatum för ett första räkenskapsår som börjar `startIso`:
 * sista dagen i varje månad, från startmånaden till och med 18 månader. */
export function firstYearEndOptions(startIso) {
  const { y, m } = parse(startIso);
  if (!y || !m) return [];
  const out = [];
  for (let i = 0; i < 18; i++) {
    const mm = ((m - 1 + i) % 12) + 1;
    const yy = y + Math.floor((m - 1 + i) / 12);
    out.push(iso(yy, mm, lastDay(yy, mm)));
  }
  return out;
}

/** Förval för första årets slut: 31 december samma år. */
export function defaultFirstYearEnd(startIso) {
  const { y } = parse(startIso);
  return y ? `${y}-12-31` : '';
}

/** "2026-07-01" → "1 juli", "2027-06-30" → "30 juni 2027". */
export function formatSvDate(isoDate, { withYear = true } = {}) {
  const { y, m, d } = parse(isoDate);
  if (!y) return '';
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/**
 * Val → fälten som sparas på företaget. Returnerar `{ error }` om valet
 * inte går ihop, annars `{ fiscalYear, firstFiscalYear }`.
 */
export function fiscalYearFields(choice, now = new Date()) {
  const year = now.getFullYear();
  if (!choice?.mode) return { error: 'Välj räkenskapsår.' };
  if (choice.mode === 'calendar') return { fiscalYear: iso(year, 1, 1), firstFiscalYear: null };
  if (choice.mode === 'other') {
    const m = Number(choice.startMonth);
    if (!(m >= 1 && m <= 12)) return { error: 'Välj vilken månad räkenskapsåret börjar.' };
    // Innevarande räkenskapsårs start: i år om månaden redan börjat, annars i fjol.
    const startYear = now.getMonth() + 1 >= m ? year : year - 1;
    return { fiscalYear: iso(startYear, m, 1), firstFiscalYear: null };
  }
  if (choice.mode === 'first') {
    const { firstStart, firstEnd } = choice;
    if (!firstStart || !firstEnd) return { error: 'Fyll i när första räkenskapsåret börjar och slutar.' };
    if (!firstYearEndOptions(firstStart).includes(firstEnd)) {
      return { error: 'Första räkenskapsåret ska sluta vid ett månadsskifte och får vara högst 18 månader.' };
    }
    const e = parse(firstEnd);
    const next = new Date(e.y, e.m - 1, e.d + 1);
    return {
      fiscalYear: iso(next.getFullYear(), next.getMonth() + 1, next.getDate()),
      firstFiscalYear: { start: firstStart, end: firstEnd },
    };
  }
  return { error: 'Välj räkenskapsår.' };
}

/** Kort beskrivning av valet, för sammanfattningar och inställningar. */
export function describeFiscalYear(choice, now = new Date()) {
  const f = fiscalYearFields(choice, now);
  if (f.error) return '';
  if (choice.mode === 'calendar') return 'Kalenderår, 1 januari – 31 december';
  if (choice.mode === 'other') {
    const m = Number(choice.startMonth);
    const endM = m === 1 ? 12 : m - 1;
    return `1 ${MONTHS[m - 1]} – ${lastDay(2001, endM)} ${MONTHS[endM - 1]}`;
  }
  return `Första året ${formatSvDate(choice.firstStart)} – ${formatSvDate(choice.firstEnd)}`;
}

/**
 * Förslag på räkenskapsår ur företagsregistret (FöretagsAPI-träffen i
 * useCompanyLookup): senaste årsredovisningens slutdatum avgör när åren
 * börjar (dagen efter). Utan årsredovisning men registrerat under de
 * senaste 18 månaderna föreslås ett första år från registreringen.
 * Returnerar { choice, note } eller null när registret inte vet.
 */
export function suggestFiscalYear(registry, now = new Date()) {
  const end = parse(registry?.fiscalYearEnd);
  if (end.y && end.m && end.d === lastDay(end.y, end.m)) {
    const startMonth = end.m === 12 ? 1 : end.m + 1;
    const note = `Enligt senaste årsredovisningen (${formatSvDate(registry.fiscalYearStart)} – ${formatSvDate(registry.fiscalYearEnd)}).`;
    return startMonth === 1
      ? { choice: { mode: 'calendar' }, note }
      : { choice: { mode: 'other', startMonth }, note };
  }
  const reg = parse(registry?.registrationDate);
  if (reg.y && reg.m && reg.d) {
    const regDate = new Date(reg.y, reg.m - 1, reg.d);
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 18, now.getDate());
    if (regDate >= cutoff && regDate <= now) {
      const start = iso(reg.y, reg.m, reg.d);
      return {
        choice: { mode: 'first', firstStart: start, firstEnd: defaultFirstYearEnd(start) },
        note: `Registrerat ${formatSvDate(start)} och ingen årsredovisning än. Kontrollera när första året slutar.`,
      };
    }
  }
  return null;
}
