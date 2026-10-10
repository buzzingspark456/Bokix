// ─────────────────────────────────────────────────────────────────────────
// Konfiguration för lönemodulen — mappningstabeller, inte hårdkodad logik.
// Skälet är samma som för momsrutorna: procentsatser, kontonummer och
// kategorier kan ändras av Skatteverket/lagstiftaren eller mellan
// verksamheter, och ska då kunna uppdateras här utan att röra
// beräkningskoden i payrollCalculation.js.
// ─────────────────────────────────────────────────────────────────────────

export const EMPLOYMENT_TYPES = [
  { id: 'anstalld', label: 'Anställd' },
  { id: 'foretagsledare', label: 'Företagsledare' },
  { id: 'styrelseledamot', label: 'Styrelseledamot' },
];

// Avgiftskategori per anställningstyp. Standardsatsen (31,42 %) är den
// generella arbetsgivaravgiften. Särregler (unga, pensionärer, visst
// styrelsearvode) varierar och ändras då och då — lägg till/justera här,
// inte i beräkningslogiken.
export const EMPLOYER_FEE_CATEGORIES = {
  anstalld: { key: 'standard', label: 'Standard', rate: 0.3142 },
  foretagsledare: { key: 'standard', label: 'Standard', rate: 0.3142 },
  styrelseledamot: { key: 'standard', label: 'Standard (styrelsearvode)', rate: 0.3142 },
};

// ── Arbetsgivaravgift efter ålder (Skatteverket, kontrollerat 2026-09-24) ──
// Avgiften beror på den anställdas födelseår och på när lönen betalas ut:
//   · född 1937 eller tidigare: ingen avgift alls
//   · fyllt 67 vid årets ingång (2026: född 1938-1958): bara
//     ålderspensionsavgiften, 10,21 %
//   · tillfällig nedsättning för unga, utbetalningar 1 april 2026 till
//     30 september 2027: fyllt 18 men inte 23 vid årets ingång (2026: född
//     2003-2007) betalar 20,81 % på ersättning upp till 25 000 kr per
//     kalendermånad, full avgift på resten
//   · alla andra: 31,42 %
// Skatteverket räknar själv om avgiften utifrån personnumret i AGI:n; stämmer
// Bokix summa blir det ingen avvikelse att förklara.
export const EMPLOYER_FEE_STANDARD = 0.3142;
export const EMPLOYER_FEE_PENSION_ONLY = 0.1021;
export const YOUTH_FEE = { rate: 0.2081, monthlyCap: 25000, from: '2026-04', to: '2027-09' };

/** Födelseår ur ett personnummer (10 eller 12 siffror, med eller utan
 * bindestreck; plustecken betyder fyllda 100). null om det inte går. */
export function birthYearFromSsn(ssn, referenceYear) {
  const raw = String(ssn || '').trim();
  const d = raw.replace(/\D/g, '');
  if (d.length === 12) return Number(d.slice(0, 4));
  if (d.length !== 10) return null;
  const yy = Number(d.slice(0, 2));
  let year = 2000 + yy > referenceYear ? 1900 + yy : 2000 + yy;
  if (raw.includes('+')) year -= 100;
  return year;
}

/**
 * Avgiftskategorin för en anställd en viss utbetalningsmånad (ÅÅÅÅ-MM).
 * Utan läsbart personnummer används standardsatsen, som förut.
 */
export function employerFeeFor({ ssn, period }) {
  const periodStr = /^\d{4}-\d{2}/.test(String(period || '')) ? String(period).slice(0, 7) : new Date().toISOString().slice(0, 7);
  const year = Number(periodStr.slice(0, 4));
  const born = birthYearFromSsn(ssn, year);
  if (born == null) return { key: 'standard', label: 'Standard', rate: EMPLOYER_FEE_STANDARD };
  if (born <= 1937) return { key: 'none', label: `Född ${born}: ingen arbetsgivaravgift`, rate: 0 };
  if (born <= year - 68) return { key: 'pension_only', label: `Född ${born}, 67 år eller äldre: bara ålderspensionsavgift`, rate: EMPLOYER_FEE_PENSION_ONLY };
  const ageAtYearStart = year - born - 1;
  if (ageAtYearStart >= 18 && ageAtYearStart <= 22 && periodStr >= YOUTH_FEE.from && periodStr <= YOUTH_FEE.to) {
    return { key: 'youth', label: `Född ${born}: nedsatt avgift för unga upp till ${YOUTH_FEE.monthlyCap.toLocaleString('sv-SE')} kr`, rate: YOUTH_FEE.rate, cap: YOUTH_FEE.monthlyCap, rateAboveCap: EMPLOYER_FEE_STANDARD };
  }
  return { key: 'standard', label: 'Standard', rate: EMPLOYER_FEE_STANDARD };
}

/** Avgiften på ett underlag, med taket för unga. */
export function employerFeeAmount(base, category) {
  if (category.cap != null) {
    const low = Math.min(Math.max(base, 0), category.cap);
    return low * category.rate + Math.max(0, base - category.cap) * category.rateAboveCap;
  }
  return base * category.rate;
}

export const SALARY_FORMS = [
  { id: 'manadslon', label: 'Månadslön' },
  { id: 'timlon', label: 'Timlön' },
];

export const TAX_FORMS = [
  { id: 'a_skatt', label: 'A-skatt' },
  { id: 'f_skatt', label: 'F-skatt' },
  { id: 'fa_skatt', label: 'FA-skatt' },
  { id: 'ej_verifierad', label: 'Ej verifierad' },
];

// De sex skattetabellkolumnerna, exakt enligt referensen i specen.
export const TAX_TABLE_COLUMNS = [
  { value: 1, label: '1. Anställd under 66 år' },
  { value: 2, label: '2. Pensionär 66+ år' },
  { value: 3, label: '3. Anställd 66+ år' },
  { value: 4, label: '4. Sjuk- eller aktivitetsersättning, under 66 år' },
  { value: 5, label: '5. Kolumn 5 (särskilda fall)' },
  { value: 6, label: '6. Pension före 65 år' },
];

export const VACATION_RULES = [
  { id: 'procentregeln', label: 'Procentregeln (12 %)', rate: 0.12 },
  { id: 'sammaloneregeln', label: 'Sammalöneregeln', rate: null },
  { id: 'ersattning_direkt', label: 'Semesterersättning (betalas ut direkt)', rate: null },
  { id: 'ingen', label: 'Ingen semesteravsättning', rate: null },
];

/** Semesterregeln när ingen är vald, som i semesterlagen: sammalöneregeln
 * (16 a §) för fast månadslön, procentregeln (16 b §) för timlön och rörlig lön. */
export function defaultVacationRule(employee) {
  return employee?.salaryForm === 'timlon' ? 'procentregeln' : 'sammaloneregeln';
}

/** Arbetsdagar per månad för en dags lön vid sammalöneregeln (månadslön / 21). */
export const WORKDAYS_PER_MONTH = 21;
/** Semestertillägg per dag vid sammalöneregeln (16 a §): 0,43 % av månadslönen. */
export const SAMMALON_SUPPLEMENT_RATE = 0.0043;

export const MIN_VACATION_DAYS = 25; // Semesterlagens lagstadgade minimum

// Sidoinkomst — fast 30 % skatteavdrag, en helt separat beräkningsväg
// (inte en modifiering av tabelluppslaget).
export const SECONDARY_INCOME_TAX_RATE = 0.30;

// Kontomappning för lönebokföring (Sida 13, Block 1–3). Konfigurerbar av
// samma skäl som momsrutornas config — BAS-kontoplanen kan skilja sig
// mellan verksamheter (t.ex. andra kostnadskonton per personalkategori).
export const PAYROLL_ACCOUNTS = {
  grossSalary: '7210',        // Block 1: Bruttolön (debet)
  tax: '2710',                 // Block 1: Personalskatt (kredit)
  netSalaryBank: '1930',       // Block 1: Nettolön (kredit)
  employerFeeCost: '7510',     // Block 2: Arbetsgivaravgifter (debet)
  employerFeeLiability: '2731',// Block 2: Arbetsgivaravgifter (kredit)
  vacationProvisionCost: '7290',       // Block 3: Semesteravsättning (debet)
  vacationProvisionLiability: '2920',  // Block 3: Semesteravsättning (kredit)
  vacationSocialFeeCost: '7519',       // Block 3: Sociala avgifter semester (debet)
  vacationSocialFeeLiability: '2940',  // Block 3: Sociala avgifter semester (kredit)
};

export const PAYROLL_RUN_STEPS = [
  { id: 'calculated', label: 'Beräkna' },
  { id: 'approved', label: 'Godkänn' },
  { id: 'paid', label: 'Betala' },
  { id: 'payslips', label: 'Lönebesked' },
  { id: 'booked', label: 'Bokför' },
  { id: 'agi', label: 'AGI och skatt' },
];
