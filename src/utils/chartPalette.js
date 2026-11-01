import { numberFormat } from './intlCache';
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
  // Kundönskemål: turkos som ETT valbart alternativ (samma turkos som
  // redan finns i varumärket: ordmärkets gradient, startsidans "Kvitton
  // läser sig själva"-stråle) — men INTE längre förvalet för Resultat,
  // se guld nedan och `teal` kvar orörd i väljaren.
  teal: {
    id: 'teal', label: 'Turkos',
    base: '#0d9488', soft: '#2dd4bf',
    ramp: ['#134e4a', '#5eead4', '#14b8a6', '#0d9488', '#2dd4bf', '#a7bab6'],
    wash: '#e0f2f1',
  },
  // Kundfeedback, uppföljning: turkos "kändes fel" på Resultat — och med
  // rätta. Turkos ligger nästan exakt mitt emellan grönt (~120°) och blått
  // (~205°) på färghjulet, så bredvid just DE HÄR två färgerna smälter det
  // in i stället för att sticka ut som en tredje, egen signal. Guld ligger
  // på motsatt sida av hjulet (~35-40°) från båda — läses direkt som "den
  // andra, viktiga siffran" i stället för att blanda ihop sig, och bär
  // rätt känsla för Resultat (den slutgiltiga behållningen) utan rödas
  // "något är fel"-association när resultatet faktiskt är positivt.
  gold: {
    id: 'gold', label: 'Guld',
    base: '#b45309', soft: '#f59e0b',
    ramp: ['#78350f', '#fcd34d', '#d97706', '#b45309', '#f59e0b', '#c2b49a'],
    wash: '#fbf1de',
  },
  // Förvalen sedan 2026-10-03, kundens eget färgtema: kungsblå för pengar
  // in (trygghet, flöde), skiffergrå för pengar ut (neutralt, ingen stress)
  // och ljus mintgrön för resultatet (belöningen, gränssnittets höjdpunkt).
  // Rött sparas till det som kräver handling, t.ex. förlust (LOSS_COLOR).
  // Mintens egen ton är för ljus för en linje eller text på vitt, så
  // `base` är en djupare grön och själva minten ligger i `card` (med mörk
  // text, `cardText`) och i `darkLine` där den lyser mot mörk botten.
  royal: {
    id: 'royal', label: 'Kungsblå',
    base: '#2563eb', soft: '#3b82f6',
    ramp: ['#1e3a8a', '#93c5fd', '#1d4ed8', '#2563eb', '#3b82f6', '#b4bccb'],
    wash: '#eaf0fd',
    card: ['#2563eb', '#3b82f6'],
    darkLine: '#60a5fa',
  },
  slate: {
    id: 'slate', label: 'Skiffergrå',
    base: '#64748b', soft: '#94a3b8',
    ramp: ['#334155', '#cbd5e1', '#475569', '#64748b', '#94a3b8', '#e2e8f0'],
    wash: '#f1f5f9',
    card: ['#64748b', '#94a3b8'],
  },
  mint: {
    id: 'mint', label: 'Mintgrön',
    base: '#059669', soft: '#34d399',
    ramp: ['#065f46', '#a7f3d0', '#047857', '#059669', '#34d399', '#b3c9bf'],
    wash: '#e7f8f0',
    card: ['#a7f3d0', '#d1fae5'],
    cardText: '#064e3b',
    darkLine: '#a7f3d0',
    darkMargins: ['#d1fae5', '#a7f3d0', '#34d399'],
  },
  // Förvalen sedan andra omgången 2026-10-03: ljusblått in, neutralt grått
  // ut och lime kvar, alla tre som ljusa kort med mörk text så de hör ihop.
  // Samma tänk som Bokio och Fortnox: kostnader är vardag och får ingen
  // signalfärg, rött sparas till förfallet och förlust (LOSS_COLOR).
  // Kortens pasteller är för ljusa för staplar, linjer och text på vitt, så
  // `base` är en mättad ton ur samma familj; pastellen ligger i `card`.
  // Förvalen sedan fjärde omgången 2026-10-03: samma färger som en
  // startsidesskiss användaren gillade. Klar blå in, korall ut, grön kvar,
  // var och en med en egen ljusare ton för mörkt läge (`darkBase`).
  demoBlue: {
    id: 'demoBlue', label: 'Blå',
    base: '#2f76e6', soft: '#6aa1f4', darkBase: '#5797f3',
    ramp: ['#1d4ed8', '#93c5fd', '#2563eb', '#2f76e6', '#6aa1f4', '#b4bccb'],
    wash: '#e9f0fd',
  },
  demoCoral: {
    id: 'demoCoral', label: 'Korallröd',
    base: '#e85a4c', soft: '#f59488', darkBase: '#f5806f',
    ramp: ['#b9382b', '#f9b9b1', '#df4b3c', '#e85a4c', '#f59488', '#c9b3af'],
    wash: '#fdecea',
  },
  demoGreen: {
    id: 'demoGreen', label: 'Grön',
    // Mörkare än skissens #17a56f på användarens begäran; mörkt läge behåller
    // en egen ton, mörkare sedan 2026-10-03 men ljus nog att synas mot mörk botten.
    base: '#0e8357', soft: '#17a56f', darkBase: '#17976a',
    ramp: ['#09573a', '#a7e5cb', '#0b6e49', '#0e8357', '#17a56f', '#b0c4ba'],
    wash: '#e3f6ed',
  },
  // Förvalen under tredje omgången 2026-10-03: exakt loggans två ändar,
  // blå (#0ea5e9) för intäkter och grön (#84cc16) för resultatet. Samma
  // ton på kort, staplar och linje, så det känns igen som Bokix. Båda är
  // ljusa, så korten har mörk text.
  logoBlue: {
    id: 'logoBlue', label: 'Bokix blå',
    base: '#0ea5e9', soft: '#38bdf8',
    ramp: ['#075985', '#7dd3fc', '#0284c7', '#0ea5e9', '#38bdf8', '#b4c4cf'],
    wash: '#e0f2fe',
    card: ['#0ea5e9', '#38bdf8'],
    cardText: '#082f49',
  },
  logoGreen: {
    id: 'logoGreen', label: 'Bokix grön',
    base: '#84cc16', soft: '#a3e635',
    ramp: ['#3f6212', '#d9f99d', '#65a30d', '#84cc16', '#a3e635', '#bdc7ad'],
    wash: '#f2fbe1',
    card: ['#84cc16', '#a3e635'],
    cardText: '#1a2e05',
  },
  lightblue: {
    id: 'lightblue', label: 'Ljusblå',
    base: '#38bdf8', soft: '#7dd3fc',
    ramp: ['#0369a1', '#bae6fd', '#0ea5e9', '#38bdf8', '#7dd3fc', '#b4c4cf'],
    wash: '#e0f2fe',
    card: ['#bae6fd', '#e0f2fe'],
    cardText: '#0c4a6e',
  },
  grey: {
    id: 'grey', label: 'Grå',
    base: '#94a3b8', soft: '#cbd5e1',
    ramp: ['#334155', '#cbd5e1', '#475569', '#64748b', '#94a3b8', '#e2e8f0'],
    wash: '#f1f5f9',
    card: ['#e2e8f0', '#f1f5f9'],
    cardText: '#334155',
    // Staplar i kombidiagrammet: en egen fast ljusgrå (mörkgrå på mörk
    // botten) i stället för huvudtonen genom 28 % opacitet, som blev nästan
    // osynlig för just grått.
    bar: '#cbd5e1',
    darkBar: '#475569',
    // Ett ljusgrått kort bländar på mörk botten; där blir det mörkgrått.
    darkCard: ['#334155', '#475569'],
    darkCardText: '#f1f5f9',
  },
  lime: {
    id: 'lime', label: 'Lime',
    base: '#65a30d', soft: '#a3e635',
    ramp: ['#3f6212', '#d9f99d', '#4d7c0f', '#65a30d', '#a3e635', '#bdc7ad'],
    wash: '#f2fbe1',
    card: ['#bef264', '#d9f99d'],
    cardText: '#365314',
    darkLine: '#bef264',
    darkMargins: ['#ecfccb', '#bef264', '#84cc16'],
  },
  // Loggans färger (#0ea5e9 → #14b8a6 → #84cc16) och sidomenyns mörkgröna,
  // förvalet en kort stund samma dag. `card` är nyckeltalskortets gradient
  // när den ska vara mörkare än stapelns ton, så vit text syns.
  sky: {
    id: 'sky', label: 'Himmelsblå',
    base: '#0284c7', soft: '#0ea5e9',
    ramp: ['#075985', '#7dd3fc', '#0369a1', '#0284c7', '#0ea5e9', '#aab9c3'],
    wash: '#e6f3fa',
    card: ['#0369a1', '#0ea5e9'],
  },
  coral: {
    id: 'coral', label: 'Korall',
    base: '#e0533f', soft: '#f2735f',
    ramp: ['#8f2f1c', '#f4a28c', '#c2482e', '#e0533f', '#f2735f', '#c4b2ad'],
    wash: '#fbece7',
    card: ['#d4493a', '#f2735f'],
  },
  // Sidomenyns gröna till loggans lime. Linjen är mörkgrön i ljust läge och
  // lime i mörkt, där den mörkgröna försvinner.
  brand: {
    id: 'brand', label: 'Bokix grönt',
    base: '#15803d', soft: '#4d8f12',
    ramp: ['#0b6329', '#bef264', '#166534', '#15803d', '#4d8f12', '#b3bdb4'],
    wash: '#e8f2e4',
    card: ['#0b6329', '#4d8f12'],
    darkLine: '#84cc16',
    darkMargins: ['#d9f99d', '#84cc16', '#4ade80'],
  },
  // Indigons huvudton är för mörk för en linje på mörk botten, därför
  // `darkLine` och `darkMargins` (marginaltrappan) för mörkt läge.
  // Kortet har vit text och fungerar som det är i båda lägena.
  indigo: {
    id: 'indigo', label: 'Indigo',
    base: '#3f3ab8', soft: '#6461e0',
    ramp: ['#262277', '#a5b4fc', '#4f46e5', '#3f3ab8', '#6461e0', '#b3b4c9'],
    wash: '#ecebfa',
    darkLine: '#a5b4fc',
    darkMargins: ['#c7d2fe', '#a5b4fc', '#818cf8'],
  },
  // Grafit, som summeringsraden i en tryckt rapport. Var Resultatets förval
  // en kort stund men kändes för tråkig; finns kvar som val. Mörk huvudton,
  // så egna värden för mörkt läge, även för kortet (`darkCard`).
  ink: {
    id: 'ink', label: 'Grafit',
    base: '#27332d', soft: '#4b5751',
    ramp: ['#111814', '#7d8a84', '#3b4842', '#27332d', '#4b5751', '#b7bfbb'],
    wash: '#eceeed',
    darkLine: '#d5ddd8',
    darkMargins: ['#b7bfbb', '#d5ddd8', '#a4ada9'],
    darkCard: ['#3b4842', '#56635c'],
  },
};

export const CHART_COLOR_CHOICES = Object.values(CHART_COLOR_FAMILIES);

/** Rollerna som går att färgsätta, i den ordning de visas i väljaren. */
export const CHART_ROLES = [
  { id: 'income', label: 'Intäkter', help: 'Pengar in, och behållningen på kontot' },
  { id: 'cost', label: 'Kostnader', help: 'Pengar ut, och kostnadsfördelningen' },
  { id: 'profit', label: 'Resultat', help: 'Det som blir kvar, och marginalerna' },
];

// Förvalet: in = blått, ut = korall, kvar = grönt, se `demoBlue` ovan.
// Före det: in = loggans blå, ut = grått, kvar = loggans gröna, se
// `logoBlue` ovan. Grått för kostnader enligt `lightblue`-kommentaren.
// Alla tidigare förval (ljusblå/lime, kungsblå/skiffer/mint, grönt/blått/guld, korall,
// indigo, grafit, loggans färger) finns kvar som val i rapportinställningarna.
export const DEFAULT_CHART_COLORS = { income: 'demoBlue', cost: 'demoCoral', profit: 'demoGreen' };

/** Förlust: rött är reserverat för det som kräver handling, så ett negativt
 * resultat får alltid den här färgen oavsett vald resultatfärg. Mjuk
 * korallröd för kortet, en djupare ton för text och staplar på vitt. */
export const LOSS_COLOR = { base: '#dc2626', card: ['#ef4444', '#f87171'] };

/** Kostnadsfördelningens kategorier: en egen tydlig färg per kategori, inte
 * nyanser av kostnadsfärgen (användaren 2026-10-31: inte en färg och inte
 * rött med närliggande färger). Rött är också reserverat för förlust.
 * Ordningen följer COST_CATEGORIES i reportCalculations.js. Den största
 * posten är nästan alltid Övriga externa kostnader och har blått. Övrigt är
 * restposten och grå. */
export const CATEGORY_RAMP = ['#7c5cd6', '#14a3a3', '#e5a11a', '#3fa34d', '#2f76e6', '#9aa3ad'];

/** Nyckeltalskortets gradient för en familj. En familj med egen `card`
 * använder den, och `darkCard` i mörkt läge. */
export function kpiGradient(id, dark = false) {
  const f = family(id);
  if (dark && f.darkCard) return f.darkCard;
  return f.card || [f.base, f.soft];
}

/** Textfärgen på nyckeltalskortet: vit, utom på ljusa kort. Följer
 * `darkCard` i mörkt läge via `darkCardText`. */
export function kpiInk(id, dark = false) {
  const f = family(id);
  if (dark && f.darkCard) return f.darkCardText || '#fff';
  return f.cardText || '#fff';
}

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
export function resolveChartPalette(prefs, options = {}) {
  const chosen = { ...DEFAULT_CHART_COLORS, ...(prefs || {}) };
  const income = family(chosen.income);
  const cost = family(chosen.cost);
  const profit = family(chosen.profit);
  // Mörkt läge. De VALDA färgerna (income/cost/profit) rörs aldrig — en
  // användare som valt grönt för intäkter ska se grönt i båda lägena. Bara
  // de två tonerna som är valda FÖR ETT LJUST ARK skrivs om, för att de
  // slutar fungera helt på mörk botten:
  //   · `wash`, den nästan vita spårfärgen bakom rankningsstaplarna, blev
  //     ett lysande band tvärs över panelen (kundfeedback: mörkt läge).
  //   · `ramp[0]`, familjens mörkaste ton, används som vinstmarginalens
  //     linje — #1c5c28 mot #0f1a13 är i praktiken osynligt.
  // Färgerna kan inte lösas i CSS: de skickas till Recharts som SVG-
  // attribut, och ett attribut löser aldrig upp var(--x). Se
  // hooks/useIsDarkTheme.js.
  const dark = !!options.dark;
  return {
    roles: chosen,
    // `darkBase`: familjer med en egen ton för mörkt läge.
    income: (dark && income.darkBase) || income.base,
    // Behållningen på kontot hör till samma familj som pengarna som kom in,
    // en ton ljusare — den är samma sorts tal, inte en egen kategori.
    cash: income.soft,
    cost: (dark && cost.darkBase) || cost.base,
    // Kostnadsstapeln bakom intäktsstapeln i kombidiagrammet: familjens
    // egen stapelton om den har en, annars huvudtonen dämpad.
    costBar: (dark ? cost.darkBar : cost.bar) || (dark && cost.darkBase) || cost.base,
    // Korallen är en riktig serie, inte en bakgrund: full styrka.
    costBarOpacity: cost.bar || cost.darkBase ? 1 : 0.28,
    costRamp: cost.ramp,
    categoryRamp: CATEGORY_RAMP,
    costWash: dark ? 'rgba(255,255,255,0.10)' : cost.wash,
    // Resultatlinjen. Familjer med en mörk huvudton (Bokix grönt, indigo,
    // grafit) får sin ljusa motsvarighet på mörk botten.
    profit: dark && (profit.darkLine || profit.darkBase) ? (profit.darkLine || profit.darkBase) : profit.base,
    loss: LOSS_COLOR.base,
    // Marginaltrappan: ljusast överst (bruttomarginal, minst avdraget) och
    // mörkast underst (vinstmarginalen, det som faktiskt blir kvar).
    marginTones: dark && profit.darkMargins
      ? profit.darkMargins
      : [profit.soft, profit.base, dark ? lighten(profit.ramp[0], 0.5) : profit.ramp[0]],
    // Härledda kvoter utan egen +/- riktning. Skiffer i alla paletter — den
    // ska INTE se ut som ännu en av de tre rollerna.
    neutral: dark ? '#94a3b8' : '#4a5568',
    muted: '#c9d2cd',
  };
}

/** Blandar en hexfärg mot vitt. Används bara för mörkt läge ovan: en ton
 * som är vald för att vara den mörkaste i en ljus ramp måste lyftas för att
 * synas mot en mörk botten, och den ska följa med om användaren byter
 * färgfamilj — därför uträknad, inte en handplockad extra hexkod per
 * familj. `amount` 0 = oförändrad, 1 = vit. */
export function lighten(hex, amount = 0.5) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * Math.min(Math.max(amount, 0), 1));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const nf = (min, max) => numberFormat('sv-SE', { minimumFractionDigits: min, maximumFractionDigits: max });

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
    // Ett ensamt tal under 10 000 kr står i hela kronor: "0 tkr" för 295 kr
    // säger ingenting. Axeln behåller tkr på alla streck.
    return { unit, value: (n) => (Math.abs(n || 0) < 10000 ? kr(n) : tkr(n)), axis: tkr, exact: kr, axisWidth: 64 };
  }
  return {
    unit: 'auto',
    value: (n) => (Math.abs(Math.round(n || 0)) < 100000 ? kr(n) : tkr(n)),
    axis: tkr,
    exact: kr,
    axisWidth: 64,
  };
}
