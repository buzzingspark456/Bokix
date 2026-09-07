// ─────────────────────────────────────────────────────────────────────────
// Abonnemangen — EN katalog för prissidan, startsidan, appen och Stripe.
//
// Före den här filen fanns priserna på tre ställen som inte kände till
// varandra: prissidan visade två nivåer (129 och 179 kr), checkouten
// debiterade hårdkodat 17900 öre för alla, och vilket abonnemang kunden
// valt sparades ingenstans. En kund som valde "Utan personal" betalade
// alltså 179 kr, och appen kunde omöjligt anpassa sig efter nivån eftersom
// den inte visste vilken det var. Nu läser alla samma lista.
//
// Ren data utan beroenden, med .js-ändelser i tankarna: filen importeras
// både av Vite (klienten) och av rå Node (api/**, där ESM KRÄVER explicit
// ändelse — se kommentaren i declarationDeadlines.js).
//
// ── Om årsplanen ────────────────────────────────────────────────────────
// Årsplanen är INTE förskottsbetald. Kunden debiteras varje månad precis
// som på månadsplanen, bara till ett lägre pris — 109 respektive 149 kr i
// stället för 129 och 179. Det är ett medvetet val: ett förskottsbelopp på
// 1 790 kr är en helt annan tröskel för ett litet företag än 149 kr i
// månaden, och rabatten säljer sig själv utan att kräva en stor betalning
// i förväg.
//
// Motprestationen är en minsta avtalstid på tre månader (inte tolv). Efter
// den kan kunden säga upp precis som på månadsplanen. Det är därför
// prissidans löfte om att det inte finns någon bindningstid fortfarande
// håller för månadsplanen, och beskrivs ärligt som "minst tre månader" för
// årsplanen — aldrig som "ingen bindning".
//
// Priserna är satta som hela kronor på BÅDA planerna. En rak procentrabatt
// hade gett 109,65 och 152,15 kr, tal som varken går att sätta på en
// prissida eller stämmer när kunden räknar efter. 109 och 149 ger i stället
// rena besparingar: exakt 240 respektive 360 kronor per år.
// ─────────────────────────────────────────────────────────────────────────

/** Provperiod innan första betalningen, i dagar. Gäller båda nivåerna och
 * båda planerna. */
export const TRIAL_DAYS = 30;

/**
 * Minsta avtalstid för årsplanen, i månader.
 *
 * Kundbeslut: årsplanen ska inte låsa någon i tolv månader. Den som ångrar
 * sig ska kunna gå — men först efter en rimlig period, annars blir
 * årsrabatten bara en billigare månadsplan.
 */
export const YEARLY_MINIMUM_MONTHS = 3;

/** Nivåerna. `id` är stabilt och sparas på prenumerationsraden — byt det
 * aldrig utan en migrering. */
export const PLAN_TIERS = [
  {
    id: 'solo',
    name: 'Utan personal',
    subtitle: 'För dig utan anställda',
    monthlyPrice: 129,
    /** Månadspriset när kunden valt årsplanen. Ett eget, rent tal — inte en
     * uträknad procentsats, se filkommentaren. */
    yearlyMonthlyPrice: 109,
    /** Lönemodulen ingår inte. Det är den ENDA skillnaden mellan nivåerna,
     * och den ligger som en egenskap här i stället för som ett villkor
     * utspritt i komponenterna. */
    includesPayroll: false,
  },
  {
    id: 'employer',
    name: 'Med personal',
    subtitle: 'För dig med anställda',
    monthlyPrice: 179,
    yearlyMonthlyPrice: 149,
    includesPayroll: true,
  },
];

export const BILLING_INTERVALS = [
  { id: 'monthly', label: 'Månadsvis' },
  { id: 'yearly', label: 'Årsplan' },
];

export function getTier(tierId) {
  return PLAN_TIERS.find(t => t.id === tierId) || null;
}

/**
 * Ett konkret abonnemang: nivå + plan.
 *
 * `amountOre` är det belopp Stripe faktiskt debiterar per månad, beräknat
 * här och ingen annanstans, så checkouten aldrig kan skicka ett annat
 * belopp än det prissidan visade. BÅDA planerna debiteras månadsvis —
 * `stripeInterval` är alltid 'month'.
 */
export function resolvePlan(tierId, intervalId = 'monthly') {
  const tier = getTier(tierId);
  const interval = BILLING_INTERVALS.find(i => i.id === intervalId);
  if (!tier || !interval) return null;

  const isYearly = interval.id === 'yearly';
  const price = isYearly ? tier.yearlyMonthlyPrice : tier.monthlyPrice;

  return {
    // Sparas på prenumerationsraden och är nyckeln appen läser för att veta
    // vad kunden faktiskt betalat för.
    id: `${tier.id}_${interval.id}`,
    tierId: tier.id,
    intervalId: interval.id,
    name: tier.name,
    subtitle: tier.subtitle,
    includesPayroll: tier.includesPayroll,
    // Månadsvis debitering oavsett plan — årsplanen är ett lägre pris och en
    // minsta avtalstid, inte en årsfaktura.
    stripeInterval: 'month',
    /** Vad som dras varje månad, i kronor. */
    price,
    /** Samma belopp i öre — det Stripe tar emot. */
    amountOre: Math.round(price * 100),
    /** Vad kunden sparar per månad respektive på ett år, mot månadsplanen. */
    savingPerMonth: isYearly ? tier.monthlyPrice - price : 0,
    savingPerYear: isYearly ? (tier.monthlyPrice - price) * 12 : 0,
    /** Minsta avtalstid i månader. Månadsplanen har ingen. */
    minimumMonths: isYearly ? YEARLY_MINIMUM_MONTHS : 0,
    /** Vad ett år kostar totalt, för jämförelsen på prissidan. */
    yearTotal: price * 12,
  };
}

/** Alla giltiga plan-id:n — det checkouten validerar mot. En okänd sträng
 * ska aldrig kunna leda till ett debiterat belopp. */
export const ALL_PLAN_IDS = PLAN_TIERS.flatMap(t => BILLING_INTERVALS.map(i => `${t.id}_${i.id}`));

/** Slår upp en plan ur ett sparat id ("employer_yearly"). */
export function planFromId(planId) {
  if (typeof planId !== 'string') return null;
  const [tierId, intervalId] = planId.split('_');
  return resolvePlan(tierId, intervalId);
}

/**
 * Ingår lönemodulen i det kunden betalar för?
 *
 * Saknad eller okänd plan ger `true` med flit: alla konton som skapades
 * innan nivåerna fanns har ingen plan sparad, och de har betalat 179 kr —
 * alltså full funktionalitet. Att låsa ute dem hade varit att ta bort något
 * de redan betalt för.
 */
export function planIncludesPayroll(planId) {
  const plan = planFromId(planId);
  return plan ? plan.includesPayroll : true;
}

/**
 * När en uppsägning tidigast kan träda i kraft.
 *
 * Månadsplanen: vid innevarande betalperiods slut, alltid. Inget att räkna
 * ut, och `cancelAt: null` betyder just "använd Stripes vanliga
 * cancel_at_period_end".
 *
 * Årsplanen: tidigast när den minsta avtalstiden löpt ut. Säger kunden upp
 * i månad ett avslutas abonnemanget alltså efter månad tre — inte direkt,
 * och inte heller efter tolv månader. Efter minimitiden beter den sig som
 * månadsplanen.
 *
 * Ingen återbetalning finns i modellen, och det är hela poängen med att
 * debitera månadsvis: det finns aldrig något förskott att betala tillbaka.
 */
export function resolveCancellation({ planId, startedAt, canceledAt = new Date() }) {
  const plan = planFromId(planId);
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const end = canceledAt instanceof Date ? canceledAt : new Date(canceledAt);

  if (!plan || !plan.minimumMonths || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { atPeriodEnd: true, cancelAt: null, minimumMonths: plan?.minimumMonths || 0, monthsElapsed: null };
  }

  // Hela månader sedan start: en månad räknas som passerad först när samma
  // datum passerats i nästa månad.
  //
  // Allt räknas i UTC. Datumen kommer som ISO-strängar (tolkas som UTC)
  // men lokal tid har en sommartidsförskjutning — blandar man de två
  // hamnar minimitidens slutdatum en dag fel två gånger om året, och
  // värdet går vidare till Stripe som en tidsstämpel där ingen ser felet.
  let monthsElapsed = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) monthsElapsed -= 1;
  monthsElapsed = Math.max(0, monthsElapsed);

  if (monthsElapsed >= plan.minimumMonths) {
    return { atPeriodEnd: true, cancelAt: null, minimumMonths: plan.minimumMonths, monthsElapsed };
  }

  // Minimitidens slutdatum: startdatumet plus tre månader.
  const cancelAt = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth() + plan.minimumMonths,
    start.getUTCDate(),
    start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(),
  ));
  return { atPeriodEnd: false, cancelAt, minimumMonths: plan.minimumMonths, monthsElapsed };
}
