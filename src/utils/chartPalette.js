// ─────────────────────────────────────────────────────────────────────────
// Diagramfärger och beloppsenhet som ett VAL, inte en hårdkodning.
//
// Kundönskemål: "jag vill kunna se intäkter i grönt och utgifter i blått"
// och "de ska kunna välja tusental eller vanliga kronor". Båda handlar om
// samma sak — hur siffrorna PRESENTERAS — och båda ska följa med företaget,
// inte sitta i en enskild komponent. Därför en egen fil: rapportsidan,
// startsidan och allt som ritar samma tal kan läsa samma inställning i
// stället för att var och en ha en egen uppfattning.
//
// Rollerna (income/cost/profit) är fasta, färgerna på dem är valbara. Det är
// en viktig skillnad: en användare byter FÄRG på intäkter, aldrig BETYDELSE.
// Diagram, nyckeltalsbrickor och legender läser alltid samma roll och kan
// därför aldrig glida isär, oavsett vilken palett som är vald.
// ─────────────────────────────────────────────────────────────────────────

/** De tre färgfamiljerna. Varje familj har:
 *  - `base`   huvudtonen, för en serie eller en nyckeltalsbricka
 *  - `soft`   en ljusare granne (t.ex. kassaflödets linje mot intäkternas)
 *  - `ramp`   sex toner för kategorier i samma familj (kostnadsringen)
 *  - `wash`   den bleka bakgrundstonen bakom rankningsstaplarna
 *
 * Tonerna är inte plockade fritt: base-värdena är samma hexar som
 * KPI_GRADIENTS i brandColors.js redan använder för intäkter, kostnader och
 * resultat på startsidan, så en användare som inte rör inställningen ser
 * exakt samma färger som förut.
 */
export const CHART_COLOR_FAMILIES = {
  blue: {
    id: 'blue', label: 'Blå',
    base: '#1d6fa5', soft: '#3b93d1',
    ramp: ['#12405f', '#5aa6d8', '#2b7fb8', '#1d6fa5', '#3b93d1', '#aebac2'],
    wash: '#e7eff5',
  },
  red: {
    id: 'red', label: 'Röd',
    base: '#c8305a', soft: '#e0527a',
    ramp: ['#8e1f3c', '#d4607f', '#a8456b', '#b62a4f', '#c8305a', '#b9adb1'],
    wash: '#f4e9ed',
  },
  green: {
    id: 'green', label: 'Grön',
    base: '#2f8a3a', soft: '#54b854',
    ramp: ['#1c5c28', '#6aa87f', '#2f7d4f', '#256e33', '#2f8a3a', '#b3bdb4'],
    wash: '#e8f0eb',
  },
};

export const CHART_COLOR_CHOICES = Object.values(CHART_COLOR_FAMILIES);

/** Rollerna som går att färgsätta, i den ordning de visas i väljaren. */
export const CHART_ROLES = [
  { id: 'income', label: 'Intäkter', help: 'Pengar in, och behållningen på kontot' },
  { id: 'cost', label: 'Kostnader', help: 'Pengar ut, och kostnadsfördelningen' },
  { id: 'profit', label: 'Resultat', help: 'Det som blir kvar, och marginalerna' },
];

// Förvalet är det semantiska: in = blått, ut = rött, kvar = grönt.
export const DEFAULT_CHART_COLORS = { income: 'blue', cost: 'red', profit: 'green' };

/** Beloppsenhet. 'auto' är det gamla beteendet (tusental för stora tal,
 * kronor för små) och förblir förvalet — det är rätt för de allra flesta,
 * och de två andra finns för den som vill ha samma enhet varje gång. */
export const AMOUNT_UNITS = [
  { id: 'auto', label: 'Automatiskt', help: 'Tusental för stora belopp, kronor för små' },
  { id: 'tkr', label: 'Tusental', help: 'Alltid tkr, som i en tryckt årsredovisning' },
  { id: 'kr', label: 'Kronor', help: 'Alltid hela kronor, inget avrundat' },
];
export const DEFAULT_AMOUNT_UNIT = 'auto';

function family(id) {
  return CHART_COLOR_FAMILIES[id] || CHART_COLOR_FAMILIES.blue;
}

/**
 * Bygger den färdiga paletten som komponenterna faktiskt ritar med.
 * `prefs` är företagets sparade val ({ income, cost, profit }) — saknade
 * eller okända värden faller tillbaka på förvalet, så en trasig eller gammal
 * inställning aldrig kan ge en osynlig graf.
 */
export function resolveChartPalette(prefs) {
  const chosen = { ...DEFAULT_CHART_COLORS, ...(prefs || {}) };
  const income = family(chosen.income);
  const cost = family(chosen.cost);
  const profit = family(chosen.profit);
  return {
    roles: chosen,
    income: income.base,
    // Behållningen på kontot hör till samma familj som pengarna som kom in,
    // en ton ljusare — den är samma sorts tal, inte en egen kategori.
    cash: income.soft,
    cost: cost.base,
    costRamp: cost.ramp,
    costWash: cost.wash,
    profit: profit.base,
    // Marginaltrappan: ljusast överst (bruttomarginal, minst avdraget) och
    // mörkast underst (vinstmarginalen, det som faktiskt blir kvar).
    marginTones: [profit.soft, profit.base, profit.ramp[0]],
    // Härledda kvoter utan egen +/- riktning. Skiffer i alla paletter — den
    // ska INTE se ut som ännu en av de tre rollerna.
    neutral: '#4a5568',
    muted: '#c9d2cd',
  };
}

const nf = (min, max) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: min, maximumFractionDigits: max });

/**
 * Formaterare för belopp, givet vald enhet.
 *  - `value` för ett tal som visas för sig (nyckeltalsbricka, rubriktal)
 *  - `axis`  för en axeltick, som alltid måste ha SAMMA enhet på alla streck
 *            (en axel med "0 kr", "150 tkr", "300 tkr" vore oläsbar)
 *  - `exact` för tooltipen, som alltid visar hela kronbeloppet oavsett val
 *
 * `auto` behåller det tidigare beteendet: tusental från 100 000 kr och uppåt,
 * annars kronor. Tröskeln finns för att ett litet bolags kostnad på 295 kr
 * annars skulle visas som "0 tkr", vilket är sämre än den långa varianten.
 */
export function makeAmountFormatters(unit = DEFAULT_AMOUNT_UNIT) {
  const kr = (n) => `${nf(0, 0).format(Math.round(n || 0))} kr`;
  const tkr = (n) => `${nf(0, 0).format(Math.round((n || 0) / 1000))} tkr`;

  // Axelbredden hör ihop med enheten och måste följa med formateraren:
  // "203 400 kr" tar nästan dubbelt så mycket plats som "203 tkr", och en
  // <svg> klipper per spec allt som ritas utanför sitt koordinatsystem —
  // en för smal axel tappar den FÖRSTA siffran tyst ("50 000 kr" blev
  // "0 000 kr"), vilket ser ut som ett datafel och inte som ett layoutfel.
  if (unit === 'kr') {
    return { unit, value: kr, axis: kr, exact: kr, axisWidth: 96 };
  }
  if (unit === 'tkr') {
    return { unit, value: tkr, axis: tkr, exact: kr, axisWidth: 64 };
  }
  return {
    unit: 'auto',
    value: (n) => (Math.abs(Math.round(n || 0)) < 100000 ? kr(n) : tkr(n)),
    axis: tkr,
    exact: kr,
    axisWidth: 64,
  };
}
