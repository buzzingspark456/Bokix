// ─────────────────────────────────────────────────────────────────────────
// Lönearter — namngivna rader på en lönespecifikation.
//
// Varför det här är den viktigaste pusselbiten i lönemodulen: allt som en
// dyrare löneprogramvara marknadsför som separata funktioner —
// jourtidsregler, beredskapsregler, flextidsberäkning, övertidsregler,
// förmånshantering, löneutmätning — är i grunden SAMMA sak: en rad på
// lönebeskedet med ett namn, ett antal, ett à-pris och en regel för hur den
// får behandlas skattemässigt. Bygger man lönearter ordentligt får man alla
// de "funktionerna" på köpet, i ett system, utan en integration per behov.
//
// Beräkningsmotorn (payrollCalculation.js) tog redan emot `additions`,
// `absenceDeduction`, `benefits` och `netDeduction` som rena siffror, men
// det fanns ingen väg in för dem i gränssnittet och ingen förklaring av vad
// en siffra bestod av. Lönearterna är den vägen — och samtidigt
// dokumentationen: varje rad bär sin egen formel till lönebeskedet.
//
// VIKTIGT om nivåerna: procentsatser och påslag för övertid, OB, jour och
// beredskap kommer från KOLLEKTIVAVTAL eller anställningsavtal, inte ur
// lagen. Defaultvärdena här är därför bara startvärden i ett redigerbart
// fält — aldrig något systemet påstår är "rätt". Det som DÄREMOT är
// lagreglerat (att förmåner är skattepliktiga men inte utbetalas, att
// nettoavdrag sker efter skatt, att skattefri milersättning varken beskattas
// eller ger arbetsgivaravgift) ligger i `kind` nedan och går inte att ändra
// per rad.
// ─────────────────────────────────────────────────────────────────────────

/**
 * De fem sätt en rad kan påverka en lönekörning. Det här är regelverket,
 * och det som skiljer en löneart från en godtycklig siffra:
 *
 *  addition     Bruttolönetillägg. Beskattas, ger arbetsgivaravgifter och
 *               ingår i semesterunderlaget. (Övertid, OB, jour, bonus.)
 *  absence      Bruttoavdrag. Minskar bruttolönen, alltså även skatt,
 *               avgifter och semesterunderlag. (Tjänstledighet, karens.)
 *  benefit      Skattepliktig förmån. Höjer underlaget för skatt och
 *               avgifter men betalas ALDRIG ut i pengar. (Bil, kost.)
 *  netDeduction Avdrag efter skatt. Påverkar varken skatt eller avgifter,
 *               bara det som betalas ut. (Löneutmätning, personallån.)
 *  taxFree      Skattefri ersättning. Betalas ut men beskattas inte och ger
 *               inga avgifter. (Milersättning, traktamente inom schablon.)
 */
export const PAY_LINE_KINDS = {
  addition: { id: 'addition', label: 'Tillägg', sign: 1, taxable: true, employerFee: true, vacationBase: true, paidOut: true },
  absence: { id: 'absence', label: 'Bruttoavdrag', sign: -1, taxable: true, employerFee: true, vacationBase: true, paidOut: true },
  benefit: { id: 'benefit', label: 'Förmån', sign: 1, taxable: true, employerFee: true, vacationBase: false, paidOut: false },
  netDeduction: { id: 'netDeduction', label: 'Nettoavdrag', sign: -1, taxable: false, employerFee: false, vacationBase: false, paidOut: true },
  taxFree: { id: 'taxFree', label: 'Skattefritt', sign: 1, taxable: false, employerFee: false, vacationBase: false, paidOut: true },
};

/**
 * Timlönen en löneart räknar på. För en timavlönad är den given. För en
 * månadsavlönad måste den härledas, och den härledningen är ett VAL:
 * månadslön × 12 / (52 veckor × veckoarbetstid). Med 40-timmarsvecka ger det
 * den vanliga divisorn 173,33. Vissa kollektivavtal använder i stället 175
 * eller ett dagbaserat mått — därför visas formeln alltid ut på raden, och
 * à-priset går att skriva över för hand.
 */
export function derivedHourlyRate(employee) {
  if (!employee) return 0;
  if (employee.salaryForm === 'timlon') return Number(employee.hourlyRate) || 0;
  const monthly = Number(employee.monthlySalary) || 0;
  const hoursPerWeek = Number(employee.hoursPerWeek) || 40;
  if (!monthly || !hoursPerWeek) return 0;
  return (monthly * 12) / (52 * hoursPerWeek);
}

/**
 * Katalogen. `defaultFactor` multiplicerar den härledda timlönen,
 * `defaultRate` är ett fast à-pris i kronor, och saknas båda måste
 * användaren fylla i beloppet själv.
 *
 * `account` är BAS-kontot raden ska kosta på när körningen bokförs. De
 * skattefria ersättningarna har egna konton med flit — de får inte hamna i
 * lönekostnaden, eftersom de varken är lön eller avgiftsgrundande, och en
 * granskare ska kunna se dem för sig.
 */
export const PAY_TYPES = [
  // ── Arbetad tid utöver det vanliga ──
  {
    id: 'overtime_simple', name: 'Övertid, enkel', kind: 'addition', unit: 'timmar',
    basis: 'hourly', defaultFactor: 1.5, account: '7210',
    help: 'Påslaget kommer ur kollektiv- eller anställningsavtalet. 1,5× är vanligast, men kontrollera ert avtal.',
  },
  {
    id: 'overtime_qualified', name: 'Övertid, kvalificerad', kind: 'addition', unit: 'timmar',
    basis: 'hourly', defaultFactor: 2, account: '7210',
    help: 'Gäller typiskt natt, helg och röda dagar. 2× är vanligast — nivån står i ert avtal.',
  },
  {
    id: 'ob_addition', name: 'OB-tillägg', kind: 'addition', unit: 'timmar',
    basis: 'manual', account: '7210',
    help: 'Obekväm arbetstid. Beloppet per timme är avtalat och skiljer sig mellan branscher — därför inget förvalt à-pris.',
  },
  {
    id: 'on_call', name: 'Jourersättning', kind: 'addition', unit: 'timmar',
    basis: 'hourly', defaultFactor: 0.25, account: '7210',
    help: 'Jour = du finns på arbetsplatsen och kan bli inkallad. Ersätts ofta med en andel av timlönen; 25 % är ett vanligt startvärde.',
  },
  {
    id: 'standby', name: 'Beredskapsersättning', kind: 'addition', unit: 'timmar',
    basis: 'hourly', defaultFactor: 0.1, account: '7210',
    help: 'Beredskap = du är nåbar hemifrån. Ersätts lägre än jour eftersom tiden är friare.',
  },
  {
    id: 'flex_payout', name: 'Utbetald flextid', kind: 'addition', unit: 'timmar',
    basis: 'hourly', defaultFactor: 1, account: '7210',
    help: 'Plustid från flexsaldot som betalas ut i stället för att tas ut i ledighet.',
  },

  // ── Rörlig ersättning ──
  {
    id: 'bonus', name: 'Bonus eller provision', kind: 'addition', unit: 'st',
    basis: 'manual', defaultQuantity: 1, account: '7210',
    help: 'Beskattas och ger arbetsgivaravgifter precis som vanlig lön.',
  },
  {
    id: 'holiday_pay_out', name: 'Semesterersättning', kind: 'addition', unit: 'st',
    basis: 'manual', defaultQuantity: 1, account: '7285',
    help: 'Utbetald semesterlön, t.ex. vid slutlön. Ska inte kombineras med löpande semesteravsättning för samma belopp.',
  },
  {
    id: 'sick_pay', name: 'Sjuklön 80 %', kind: 'addition', unit: 'timmar',
    basis: 'hourly', defaultFactor: 0.8, account: '7210',
    help: 'Dag 2–14 i sjukperioden. Registrera frånvaron som ett eget bruttoavdrag och lägg sjuklönen som en egen rad — så syns båda på lönebeskedet.',
  },

  {
    id: 'vacation_taken', name: 'Semesteruttag', kind: 'addition', unit: 'dagar',
    basis: 'vacationDay', account: '7285',
    help: 'Antalet dagar räknas av från semestersaldot. Vid sammalöneregeln är à-priset semestertillägget per dag (lönen löper ändå vidare); vid procentregeln är det hela semesterlönen per dag.',
  },
  // ── Frånvaro ──
  {
    id: 'absence_unpaid', name: 'Frånvaroavdrag', kind: 'absence', unit: 'timmar',
    basis: 'hourly', defaultFactor: 1, account: '7210',
    help: 'Tjänstledighet, sjukfrånvaro eller annan obetald frånvaro, timme för timme.',
  },
  {
    id: 'karensavdrag', name: 'Karensavdrag', kind: 'absence', unit: 'st',
    basis: 'manual', defaultQuantity: 1, account: '7210',
    help: 'Karensavdraget är 20 % av en genomsnittlig veckas sjuklön — ett fast belopp per sjukperiod, inte per dag.',
  },

  // ── Förmåner (beskattas, betalas inte ut) ──
  {
    id: 'car_benefit', name: 'Bilförmån', kind: 'benefit', unit: 'st',
    basis: 'manual', defaultQuantity: 1, account: '7385',
    help: 'Förmånsvärdet räknas fram med Skatteverkets bilförmånsberäkning och skrivs in här.',
  },
  {
    id: 'meal_benefit', name: 'Kostförmån', kind: 'benefit', unit: 'st',
    basis: 'manual', defaultQuantity: 1, account: '7382',
    help: 'Skatteverkets schablonvärde per måltid gäller — kontrollera årets belopp.',
  },
  {
    id: 'other_benefit', name: 'Övrig förmån', kind: 'benefit', unit: 'st',
    basis: 'manual', defaultQuantity: 1, account: '7389',
    help: 'Allt annat skattepliktigt som inte betalas i pengar.',
  },

  // ── Skattefria ersättningar (betalas ut, beskattas inte) ──
  {
    id: 'mileage', name: 'Milersättning', kind: 'taxFree', unit: 'mil',
    basis: 'manual', account: '7331',
    help: 'Skattefri upp till Skatteverkets schablon per mil för egen bil i tjänsten. Kräver körjournal. Belopp därutöver är lön och läggs som ett tillägg i stället.',
  },
  {
    id: 'per_diem', name: 'Traktamente', kind: 'taxFree', unit: 'dagar',
    basis: 'manual', account: '7321',
    help: 'Skattefritt upp till Skatteverkets schablonbelopp vid tjänsteresa med övernattning utanför den vanliga verksamhetsorten.',
  },

  // ── Avdrag efter skatt ──
  {
    id: 'garnishment', name: 'Löneutmätning', kind: 'netDeduction', unit: 'st',
    basis: 'manual', defaultQuantity: 1, account: '2710',
    help: 'Beloppet kommer i beslutet från Kronofogden och dras efter skatt. Betalas vidare till Kronofogden, inte till den anställda.',
  },
  {
    id: 'net_deduction_other', name: 'Övrigt nettoavdrag', kind: 'netDeduction', unit: 'st',
    basis: 'manual', defaultQuantity: 1, account: '1680',
    help: 'Till exempel återbetalning av löneförskott eller personallån.',
  },
];

export function getPayType(id) {
  return PAY_TYPES.find(t => t.id === id) || null;
}

/** Lönearterna grupperade som de ska visas i väljaren. Ordningen följer hur
 * ofta de faktiskt används i ett litet företag, inte bokstavsordning. */
export const PAY_TYPE_GROUPS = [
  { label: 'Tid och tillägg', ids: ['overtime_simple', 'overtime_qualified', 'ob_addition', 'on_call', 'standby', 'flex_payout'] },
  { label: 'Semester', ids: ['vacation_taken', 'holiday_pay_out'] },
  { label: 'Rörlig ersättning', ids: ['bonus', 'sick_pay'] },
  { label: 'Frånvaro', ids: ['absence_unpaid', 'karensavdrag'] },
  { label: 'Förmåner', ids: ['car_benefit', 'meal_benefit', 'other_benefit'] },
  { label: 'Skattefritt', ids: ['mileage', 'per_diem'] },
  { label: 'Avdrag efter skatt', ids: ['garnishment', 'net_deduction_other'] },
];

/** Förvalt à-pris för en löneart och en viss anställd. `null` betyder att
 * användaren måste ange det själv — vilket är rätt svar för allt som är
 * avtalat eller beslutat utanför systemet. */
export function defaultRateFor(payType, employee) {
  if (!payType) return null;
  if (payType.basis === 'vacationDay') {
    if (employee?.vacationRule === 'sammaloneregeln') {
      const monthly = Number(employee.monthlySalary) || 0;
      // Semestertillägg enligt semesterlagen § 16 a: 0,43 % av
      // månadslönen per betald dag.
      return monthly ? Math.round(monthly * 0.0043 * 100) / 100 : null;
    }
    // Procentregeln bygger på intjänandeårets lön, som inte finns i
    // anställningsposten — se utils/vacation.js.
    return null;
  }
  if (payType.basis === 'hourly') {
    const hourly = derivedHourlyRate(employee);
    if (!hourly) return null;
    return Math.round(hourly * (payType.defaultFactor ?? 1) * 100) / 100;
  }
  return payType.defaultRate ?? null;
}

/** En färdig rad: belopp, tecken och en formel som går att läsa efter. */
export function computePayLine(line, employee) {
  const payType = getPayType(line?.payTypeId);
  if (!payType) return null;
  const kind = PAY_LINE_KINDS[payType.kind];
  const quantity = Number(line.quantity) || 0;
  // `rate` kan vara 0 med flit (t.ex. en registrerad frånvarotimme utan
  // avdrag), så `??` och inte `||` — annars skulle nollan tyst ersättas av
  // förvalet.
  const rate = line.rate === '' || line.rate == null ? (defaultRateFor(payType, employee) ?? 0) : Number(line.rate) || 0;
  const amount = Math.round(quantity * rate * 100) / 100;
  return {
    payTypeId: payType.id,
    name: line.note ? `${payType.name} (${line.note})` : payType.name,
    kind: payType.kind,
    unit: payType.unit,
    account: payType.account,
    quantity,
    rate,
    amount,
    signedAmount: amount * kind.sign,
    formula: `${quantity} ${payType.unit} × ${rate} kr`,
  };
}

/**
 * Summerar en rads alla lönearter till de fem hinkar beräkningsmotorn
 * arbetar med. Returnerar också raderna själva, så lönebesked och
 * bokföringsunderlag kan visa dem en och en i stället för en klumpsumma.
 */
export function summarizePayLines(lines = [], employee) {
  const computed = lines.map(l => computePayLine(l, employee)).filter(Boolean);
  const sumOf = (kind) => computed.filter(l => l.kind === kind).reduce((s, l) => s + l.amount, 0);
  return {
    lines: computed,
    additions: Math.round(sumOf('addition')),
    absence: Math.round(sumOf('absence')),
    benefits: Math.round(sumOf('benefit')),
    netDeductions: Math.round(sumOf('netDeduction')),
    taxFree: Math.round(sumOf('taxFree')),
  };
}
