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
