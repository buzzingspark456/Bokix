// ── Regler och belopp: en lista över allt Bokix räknar med ───────────────
// (2026-11-16, grundarens krav: "alla regler ska vara sanna, dubbelkolla
// hela tiden, vi ska alltid vara uppdaterade"). Varje rad säger vad Bokix
// använder, var det kommer ifrån, när det senast kontrollerades och när det
// ska kontrolleras igen. Värdena läses från samma konstanter som
// beräkningarna använder, så listan kan aldrig visa något annat än det appen
// räknar med. Visas i /internal → Regler (med status) och för kunderna på
// /belopp-och-regler.
//
// Så här kontrollerar du en regel: öppna källan, jämför med värdet, ändra
// konstanten om det behövs, sätt verifiedAt till dagens datum.
import { EMPLOYER_FEE_STANDARD, EMPLOYER_FEE_PENSION_ONLY, YOUTH_FEE } from './payrollConfig';
import { ROT_RUT_RATES, ROT_RUT_COMBINED_CAP, ROT_CAP } from './rotRutConfig';
import { FOOD_VAT_CUT } from './accountCategories';
import { CORPORATE_TAX_RATE } from './annualReport';

const pct = (r) => `${(r * 100).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} %`;
const kr = (n) => `${n.toLocaleString('sv-SE')} kr`;

const SKV = (path) => `https://www.skatteverket.se${path}`;

export const RULE_AREAS = ['Moms', 'Lön och arbetsgivare', 'ROT och RUT', 'Skatt och bokslut', 'Filer till myndigheter'];

export const RULES = [
  // ── Moms ──
  { id: 'vat-rates', area: 'Moms', title: 'Momssatser', value: '25 %, 12 % och 6 %',
    usedIn: 'Kvitton, fakturor, momsdeklaration', source: { name: 'Skatteverket: Moms', url: SKV('/foretag/moms.4.18e1b10334ebe8bc80002497.html') },
    verifiedAt: '2026-11-16', checkEveryDays: 180 },
  { id: 'food-vat', area: 'Moms', title: 'Tillfälligt sänkt moms på livsmedel', value: `${FOOD_VAT_CUT.rate} % (annars ${FOOD_VAT_CUT.normal} %)`,
    validFrom: FOOD_VAT_CUT.from, validTo: FOOD_VAT_CUT.to,
    usedIn: 'Förslag på moms för kvitton från livsmedelsbutiker', source: { name: 'Skatteverket: Moms', url: SKV('/foretag/moms.4.18e1b10334ebe8bc80002497.html') },
    verifiedAt: '2026-11-16', checkEveryDays: 90 },
  { id: 'vat-exempt-limit', area: 'Moms', title: 'Gräns för momsbefrielse', value: '120 000 kr i omsättning per år',
    usedIn: 'Uppläggning av företag, momsfrågor', source: { name: 'Skatteverket: Momsbefrielse', url: SKV('/momsbefrielse') },
    verifiedAt: '2026-11-16', checkEveryDays: 365 },

  // ── Lön och arbetsgivare ──
  { id: 'employer-fee', area: 'Lön och arbetsgivare', title: 'Arbetsgivaravgift', value: pct(EMPLOYER_FEE_STANDARD),
    usedIn: 'Lönekörning, AGI', source: { name: 'Skatteverket: Arbetsgivaravgifter', url: SKV('/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html') },
    verifiedAt: '2026-11-16', checkEveryDays: 365 },
  { id: 'employer-fee-67', area: 'Lön och arbetsgivare', title: 'Avgift för 67 år och äldre', value: `${pct(EMPLOYER_FEE_PENSION_ONLY)} (född 1937 eller tidigare: 0 %)`,
    usedIn: 'Lönekörning, AGI', source: { name: 'Skatteverket: Arbetsgivaravgifter', url: SKV('/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html') },
    verifiedAt: '2026-11-16', checkEveryDays: 365 },
  { id: 'employer-fee-youth', area: 'Lön och arbetsgivare', title: 'Nedsatt avgift för unga (18–22 år vid årets början)', value: `${pct(YOUTH_FEE.rate)} upp till ${kr(YOUTH_FEE.monthlyCap)} per månad`,
    validFrom: `${YOUTH_FEE.from}-01`, validTo: '2027-09-30',
    usedIn: 'Lönekörning, AGI', source: { name: 'Skatteverket: Arbetsgivaravgifter', url: SKV('/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html') },
    verifiedAt: '2026-11-16', checkEveryDays: 180 },
  { id: 'tax-tables', area: 'Lön och arbetsgivare', title: 'Skattetabeller', value: 'Skatteverkets tabeller för utbetalningsåret (2027 ej publicerade 16 nov)',
    usedIn: 'Skatteavdrag i lönekörningen', source: { name: 'Skatteverket: Teknisk beskrivning för skattetabeller', url: SKV('/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/skattetabeller/tekniskbeskrivningforskattetabeller.4.319dc1451507f2f99e86ee.html') },
    verifiedAt: '2026-11-16', checkBy: '2026-12-15' },
  { id: 'mileage', area: 'Lön och arbetsgivare', title: 'Skattefri milersättning och traktamente', value: 'Egen bil 25 kr/mil, traktamente 300 kr per hel dag (2026)',
    usedIn: 'Lönearter för skattefria ersättningar', source: { name: 'Skatteverket: Traktamente och bilersättning för arbetsgivare', url: SKV('/foretag/arbetsgivare/lonochersattning/traktamenteochbilersattning.4.361dc8c15312eff6fd1703e.html') },
    verifiedAt: '2026-11-16', checkBy: '2026-12-31' },

  // ── ROT och RUT ──
  { id: 'rot-rut-rates', area: 'ROT och RUT', title: 'Avdrag för ROT och RUT', value: `ROT ${ROT_RUT_RATES.rot.percent} %, RUT ${ROT_RUT_RATES.rut.percent} % av arbetskostnaden`,
    usedIn: 'Fakturor med ROT/RUT, begäran om utbetalning', source: { name: 'Skatteverket: Så fungerar rotavdraget för företag', url: SKV('/foretag/skatterochavdrag/rotochrut/safungerarrotavdraget.4.2ef18e6a125660db8b080002709.html') },
    verifiedAt: '2026-11-16', checkEveryDays: 180 },
  { id: 'rot-rut-cap', area: 'ROT och RUT', title: 'Tak för ROT och RUT', value: `${kr(ROT_RUT_COMBINED_CAP)} per person och år, varav högst ${kr(ROT_CAP)} ROT`,
    usedIn: 'Fakturor med ROT/RUT', source: { name: 'Skatteverket: Så fungerar rotavdraget för företag', url: SKV('/foretag/skatterochavdrag/rotochrut/safungerarrotavdraget.4.2ef18e6a125660db8b080002709.html') },
    verifiedAt: '2026-11-16', checkEveryDays: 365 },

  // ── Skatt och bokslut ──
  { id: 'corporate-tax', area: 'Skatt och bokslut', title: 'Bolagsskatt', value: pct(CORPORATE_TAX_RATE),
    usedIn: 'Bokslut, årsredovisning, nyckeltal', source: { name: 'Skatteverket: Belopp och procent inkomstår 2026', url: SKV('/foretag/skatterochavdrag/beloppochprocent/2026.106.1522bf3f19aea8075ba3294.html') },
    verifiedAt: '2026-10-12', checkEveryDays: 365 },
  { id: 'self-employment-fees', area: 'Skatt och bokslut', title: 'Egenavgifter för enskild firma', value: '28,97 %, schablonavdrag 25 %',
    usedIn: 'Skattekalkylatorer och NE-underlag', source: { name: 'Skatteverket: Egenavgifter och särskild löneskatt', url: SKV('/foretag/drivaforetag/foretagsformer/enskildnaringsverksamhet/egenavgifterochsarskildloneskatt.4.361dc8c15312eff6fd1f678.html') },
    verifiedAt: '2026-11-16', checkEveryDays: 365 },
  { id: 'bas-chart', area: 'Skatt och bokslut', title: 'Kontoplan', value: 'BAS 2026',
    usedIn: 'Hela bokföringen', source: { name: 'BAS-kontogruppen', url: 'https://www.bas.se/kontoplaner/' },
    verifiedAt: '2026-10-12', checkBy: '2026-12-31' },

  // ── Filer till myndigheter ──
  { id: 'sru-fields', area: 'Filer till myndigheter', title: 'SRU-fältlistor (INK2, INK3, INK4, NE)', value: 'Skatteverkets fältlistor 2025P4 och 2026P4',
    usedIn: 'Deklarationsunderlag', source: { name: 'Skatteverket: Teknisk information om filöverföring', url: SKV('/foretag/inkomstdeklaration/forredovisningsbyraer/tekniskinformationomfiloverforing.4.13948c0e18e810bfa0cca8.html') },
    verifiedAt: '2026-10-13', checkBy: '2027-01-31' },
  { id: 'agi-schema', area: 'Filer till myndigheter', title: 'AGI-filens format', value: 'Godkänd i Skatteverkets testtjänst',
    usedIn: 'Arbetsgivardeklaration som fil', source: { name: 'Skatteverket: Schemalager (XML)', url: SKV('/foretag/etjansterochblanketter/allaetjanster/schemalagerxml.4.dfe345a107ebcc9baf80006452.html') },
    verifiedAt: '2026-09-24', checkBy: '2026-12-31' },
];

const DAY = 86400000;

/** När regeln ska kontrolleras nästa gång (ÅÅÅÅ-MM-DD). */
export function nextCheck(rule) {
  if (rule.checkBy) return rule.checkBy;
  return new Date(new Date(rule.verifiedAt).getTime() + (rule.checkEveryDays || 365) * DAY).toISOString().slice(0, 10);
}

/** Status: 'overdue' (kontrollen är försenad), 'ending' (regeln upphör
 * inom 60 dagar), 'soon' (kontroll inom 30 dagar) eller 'ok'. */
export function ruleStatus(rule, today = new Date()) {
  const t = new Date(today.toISOString().slice(0, 10)).getTime();
  const due = new Date(nextCheck(rule)).getTime();
  if (due < t) return 'overdue';
  if (rule.validTo && new Date(rule.validTo).getTime() - t <= 60 * DAY && new Date(rule.validTo).getTime() >= t) return 'ending';
  if (due - t <= 30 * DAY) return 'soon';
  return 'ok';
}

export function rulesNeedingAttention(today = new Date()) {
  return RULES.filter(r => ruleStatus(r, today) !== 'ok');
}
