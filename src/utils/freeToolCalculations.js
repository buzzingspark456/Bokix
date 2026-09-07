// ─────────────────────────────────────────────────────────────────────────
// Räknelogiken bakom de fria verktygen på marknadssajten (/verktyg/*) —
// ren matematik, inga React-imports, testad för sig (se
// freeToolCalculations.test.js).
//
// Varför en egen fil och inte inline i sidkomponenterna: exakt samma skäl
// som vatCalculation.js/payrollCalculation.js redan följer i den inloggade
// appen. Ett publikt verktyg som räknar FEL är värre än inget verktyg
// alls — det är det första en presumtiv kund provar, och en felräknad
// arbetsgivaravgift på förstasidan säger mer om produkten än någon
// säljtext. Därför: samma testbarhet som appens egen bokföringslogik.
//
// Satser och belopp som RIKSDAG/SKATTEVERKET kan ändra ligger som
// namngivna konstanter högst upp i sitt eget block, med källa och
// kontrolldatum — samma mönster som rotRutConfig.js. Där appen redan äger
// en siffra (arbetsgivaravgift, ROT/RUT-procent, momskonton) importeras
// DEN, aldrig en egen kopia: verktygen ska aldrig kunna visa en annan
// procentsats än den appen faktiskt bokför med.
// ─────────────────────────────────────────────────────────────────────────
import { EMPLOYER_FEE_CATEGORIES, VACATION_RULES } from './payrollConfig';

/** Öresavrundning till hela kronor — samma `Math.round` som resten av
 * appen använder för presenterade belopp (vatCalculation.roundKr). */
function kr(v) {
  return Math.round(v);
}

/** Två decimaler, för mellansteg där hela kronor skulle bli missvisande
 * (t.ex. dagsränta). Aldrig för slutbelopp som visas som "att betala". */
function kr2(v) {
  return Math.round(v * 100) / 100;
}

// ── Moms ────────────────────────────────────────────────────────────────
// Momssatserna själva är inte "konfiguration som kan ändras när som helst"
// på samma sätt som en avgiftsprocent — de tre svenska satserna (25/12/6)
// har legat fast i decennier och är dessutom redan kodade som nycklar i
// vatConfig.js (OUTPUT_VAT_ACCOUNT_BY_RATE m.fl.). Listan här beskriver
// bara VILKA VAROR/TJÄNSTER varje sats gäller, vilket vatConfig medvetet
// inte gör (den handlar om rutor och konton, inte om vad man säljer).
export const VAT_RATE_GUIDE = [
  { rate: 25, label: '25 %', title: 'Normalskattesatsen', examples: 'De allra flesta varor och tjänster: konsulttimmar, bygg, verkstad, kontorsmaterial, elektronik, kläder.' },
  { rate: 12, label: '12 %', title: 'Livsmedel, hotell, restaurang', examples: 'Mat och dryck i butik, restaurang- och cateringtjänster (dock inte alkohol, som är 25 %), hotellrum, camping, viss konst.' },
  { rate: 6, label: '6 %', title: 'Böcker, kultur, persontransport', examples: 'Böcker, tidningar, e-böcker, inrikes persontransport (taxi, buss, tåg, flyg), entré till konserter och idrottsevenemang.' },
];

/**
 * Räknar om mellan netto (exkl. moms), moms och brutto (inkl. moms).
 *
 * `mode`:
 *  - 'add'     — `amount` är NETTO, momsen läggs på (det vanliga när du
 *                sätter ett pris på en faktura).
 *  - 'extract' — `amount` är BRUTTO, momsen räknas ur (det vanliga när du
 *                har ett kvitto med totalsumma och ska bokföra det).
 *
 * Returnerar ALLTID alla tre beloppen, oavsett riktning — det är hela
 * poängen med verktyget: du ska se hela raden, inte bara det du saknade.
 */
export function calcVat({ amount, rate, mode = 'add' }) {
  const value = Number(amount) || 0;
  const r = Number(rate) || 0;
  if (mode === 'extract') {
    // Brutto → netto: dela med (1 + sats), inte "dra av 25 %" — den
    // vanligaste räknemissen i svensk bokföring (25 % av 1000 är 250, men
    // momsen i 1000 kr inkl. moms är 200 kr).
    const net = value / (1 + r / 100);
    return { net: kr2(net), vat: kr2(value - net), gross: kr2(value), rate: r, mode };
  }
  const vat = value * (r / 100);
  return { net: kr2(value), vat: kr2(vat), gross: kr2(value + vat), rate: r, mode };
}

// ── Arbetsgivaravgift och lönekostnad ───────────────────────────────────
// Procentsatsen importeras från payrollConfig (EMPLOYER_FEE_CATEGORIES) —
// samma 31,42 % som en riktig lönekörning i appen bokför med. Ändras den
// där ändras verktyget automatiskt, aldrig i otakt.
export const STANDARD_EMPLOYER_FEE_RATE = EMPLOYER_FEE_CATEGORIES.anstalld.rate;

// Semesteravsättning enligt procentregeln — samma 12 % som lönemodulen
// (VACATION_RULES) redan räknar med. Hämtad därifrån av samma skäl.
export const VACATION_PROVISION_RATE = VACATION_RULES.find(r => r.id === 'procentregeln').rate;

/**
 * Vad en anställd faktiskt KOSTAR arbetsgivaren, och ungefär vad den
 * anställda får ut, utifrån en bruttolön per månad.
 *
 * Medvetet en UPPSKATTNING på skattedelen, och sidan säger det rakt ut:
 * det exakta skatteavdraget kommer ur Skatteverkets skattetabell (rätt
 * tabellnummer + kolumn per anställd, se skattetabell.js), som beror på
 * kommun, ålder och församling — inte på en enda procentsats. Verktyget
 * använder därför en användarangiven kommunalskattesats och säger att
 * appen gör det exakta uppslaget. Att låtsas om något annat vore precis
 * den sortens tysta gissning produkten annars är byggd för att undvika.
 *
 * `vacation: false` stänger av semesteravsättningen (t.ex. för den som
 * betalar ut semesterersättning löpande i stället).
 */
export function calcEmployerCost({ gross, feeRate = STANDARD_EMPLOYER_FEE_RATE, taxRate = 32, vacation = true }) {
  const grossSalary = Number(gross) || 0;
  const employerFee = grossSalary * feeRate;

  // Semesteravsättningen är en KOSTNAD i månaden den avsätts (konto 7290,
  // se PAYROLL_ACCOUNTS) — och den bär i sin tur egna sociala avgifter
  // (7519), precis som lönemodulen bokför det. Utan den raden underskattas
  // den verkliga kostnaden per anställd med drygt 15 %.
  const vacationProvision = vacation ? grossSalary * VACATION_PROVISION_RATE : 0;
  const vacationFee = vacationProvision * feeRate;

  const tax = grossSalary * ((Number(taxRate) || 0) / 100);

  return {
    gross: kr(grossSalary),
    employerFee: kr(employerFee),
    vacationProvision: kr(vacationProvision),
    vacationFee: kr(vacationFee),
    totalCost: kr(grossSalary + employerFee + vacationProvision + vacationFee),
    tax: kr(tax),
    net: kr(grossSalary - tax),
    // Hur många kronor arbetsgivaren lägger ut per hundralapp den anställda
    // får i handen — den siffra som brukar överraska mest, och därför den
    // som gör verktyget värt att dela.
    costPerNetKrona: grossSalary > 0 ? kr2((grossSalary + employerFee + vacationProvision + vacationFee) / Math.max(grossSalary - tax, 1)) : 0,
    feeRate,
  };
}

// ── Egenavgifter (enskild firma / handelsbolag) ─────────────────────────
// Källa: skatteverket.se, "Egenavgifter" och "Schablonavdrag för
// egenavgifter". Kontrollerat september 2026. Samma sorts konstant-block
// som rotRutConfig.js: ändras satserna räcker det att röra det här.
//
// Två fall täcks, för att de täcker de allra flesta enskilda firmor:
//  - Fulla egenavgifter (28,97 %), schablonavdrag upp till 25 %.
//  - Bara ålderspensionsavgift (10,21 %) — den som är 66+ vid årets
//    ingång eller tar ut hel allmän pension — schablonavdrag upp till
//    20 %.
// Nedsättningen för unga/regionalt stöd och karensvalets påverkan på
// sjukförsäkringsavgiften är MEDVETET utelämnade: de gäller ett fåtal och
// skulle göra resultatet mindre pålitligt för alla andra. Sidan skriver
// ut den begränsningen, den göms inte.
export const SOLE_TRADER_FEE_CATEGORIES = [
  { id: 'full', label: 'Fulla egenavgifter', hint: 'Under 66 år vid årets ingång', feeRate: 0.2897, standardDeduction: 0.25 },
  { id: 'pension', label: 'Endast ålderspensionsavgift', hint: '66+ år, eller tar ut hel allmän pension', feeRate: 0.1021, standardDeduction: 0.20 },
];

/**
 * Från överskott (intäkter minus kostnader, före egenavgifter) till vad
 * som faktiskt blir kvar att skatta för.
 *
 * Ordningen är det som gör beräkningen svår att göra i huvudet, och
 * därmed hela poängen med verktyget: schablonavdraget dras FÖRST, och
 * egenavgifterna räknas på det som återstår — inte på hela överskottet.
 */
export function calcSoleTraderFees({ surplus, categoryId = 'full', municipalTaxRate = 32.41 }) {
  const gross = Math.max(Number(surplus) || 0, 0);
  const category = SOLE_TRADER_FEE_CATEGORIES.find(c => c.id === categoryId) || SOLE_TRADER_FEE_CATEGORIES[0];

  const standardDeduction = gross * category.standardDeduction;
  const feeBase = gross - standardDeduction;
  const fees = feeBase * category.feeRate;

  // Det skattemässiga resultatet: överskottet minus de FAKTISKA
  // egenavgifterna (schablonavdraget är bara en preliminär uppskattning
  // som stäms av året efter, men det är på nettot efter avgifter
  // inkomstskatten i praktiken landar).
  const taxableIncome = Math.max(gross - fees, 0);
  const incomeTax = taxableIncome * ((Number(municipalTaxRate) || 0) / 100);

  return {
    surplus: kr(gross),
    standardDeduction: kr(standardDeduction),
    feeBase: kr(feeBase),
    fees: kr(fees),
    feeRate: category.feeRate,
    taxableIncome: kr(taxableIncome),
    incomeTax: kr(incomeTax),
    net: kr(taxableIncome - incomeTax),
    category,
  };
}

// ── Dröjsmålsränta och förseningsavgifter ───────────────────────────────
// Källa: räntelagen (1975:635) § 6 samt lagen (1981:739) om ersättning för
// inkassokostnader. Kontrollerat september 2026.
//
// Räntesatsen är referensräntan + 8 procentenheter. Referensräntan sätts
// om av Riksbanken två gånger per år (1 januari och 1 juli) — därför är
// den ett INMATNINGSFÄLT i verktyget, inte en hårdkodad sanning som
// tyst blir fel ett halvår senare. Konstanten nedan är bara startvärdet i
// fältet, och sidan länkar till Riksbanken för kontroll.
export const LATE_INTEREST_MARKUP = 8;
export const DEFAULT_REFERENCE_RATE = 2;

// Lagstadgade fasta belopp (ändras sällan, men ligger här av samma skäl).
export const LATE_FEES = {
  reminder: { id: 'reminder', amount: 60, label: 'Påminnelseavgift', note: 'Får tas ut om det avtalats innan skulden uppstod, t.ex. i dina avtalsvillkor.' },
  collection: { id: 'collection', amount: 180, label: 'Inkassokrav', note: 'Kräver att ett formellt inkassokrav skickats enligt inkassolagen.' },
  compensation: { id: 'compensation', amount: 450, label: 'Förseningsersättning', note: 'Vid fakturering till företag eller myndighet. Kräver inget avtal — men kan inte kombineras med påminnelseavgift för samma faktura.' },
};

/** Hela dagar mellan två datum (ISO-strängar eller Date). Negativt om
 * betalningen skedde före förfallodagen — anroparen klampar. */
export function daysBetween(from, to) {
  const a = from instanceof Date ? from : new Date(from);
  const b = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  // UTC-midnatt på båda sidor: annars ger en sommartidsövergång mitt i
  // perioden 23- eller 25-timmarsdygn och därmed ett dygn fel.
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

/**
 * Dröjsmålsränta på en försenad faktura, plus de avgifter man faktiskt
 * har rätt att lägga på.
 *
 * Räntan räknas per KALENDERDAG på 365-dagarsbasis (räntelagens praxis),
 * inte per påbörjad månad — det är den vanligaste missen när man räknar
 * för hand.
 */
export function calcLateInterest({ amount, dueDate, paidDate, referenceRate = DEFAULT_REFERENCE_RATE, fees = [] }) {
  const principal = Math.max(Number(amount) || 0, 0);
  const rate = (Number(referenceRate) || 0) + LATE_INTEREST_MARKUP;
  const days = Math.max(daysBetween(dueDate, paidDate), 0);

  const interest = principal * (rate / 100) * (days / 365);
  const feeRows = fees.map(id => LATE_FEES[id]).filter(Boolean);
  const feeTotal = feeRows.reduce((sum, f) => sum + f.amount, 0);

  return {
    principal: kr2(principal),
    rate: kr2(rate),
    days,
    dailyInterest: kr2(principal * (rate / 100) / 365),
    interest: kr2(interest),
    feeRows,
    feeTotal,
    total: kr2(principal + interest + feeTotal),
  };
}
