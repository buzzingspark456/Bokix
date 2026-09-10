import { describe, it, expect } from 'vitest'
import {
  calcVat,
  calcEmployerCost,
  calcSoleTraderFees,
  calcLateInterest,
  daysBetween,
  calcDividendAllowance,
  DIVIDEND_RULES,
  DIVIDEND_BASE_AMOUNT,
  DIVIDEND_WAGE_DEDUCTION,
  STANDARD_EMPLOYER_FEE_RATE,
  VACATION_PROVISION_RATE,
  LATE_INTEREST_MARKUP,
} from './freeToolCalculations'

// De publika verktygen (/verktyg/*) är det första en presumtiv kund
// faktiskt provar — en felräkning där är dyrare än en felräkning inne i
// appen, eftersom den syns för alla utan inloggning. Därför testas de med
// samma allvar som bokföringslogiken, inte som "marknadsföringskod".

describe('calcVat', () => {
  it('lägger på moms på ett nettobelopp', () => {
    expect(calcVat({ amount: 1000, rate: 25, mode: 'add' })).toMatchObject({ net: 1000, vat: 250, gross: 1250 })
  })

  // Den klassiska räknemissen: momsen i 1000 kr inkl. moms är 200 kr, inte
  // 250 kr. Går det här testet sönder visar verktyget fel siffra för varje
  // kvitto en besökare slår in.
  it('räknar UR momsen ur ett bruttobelopp (inte 25 % av bruttot)', () => {
    const r = calcVat({ amount: 1000, rate: 25, mode: 'extract' })
    expect(r.vat).toBe(200)
    expect(r.net).toBe(800)
    expect(r.gross).toBe(1000)
  })

  it('hanterar 12 % och 6 % med samma formel', () => {
    expect(calcVat({ amount: 1000, rate: 12, mode: 'add' }).gross).toBe(1120)
    expect(calcVat({ amount: 1060, rate: 6, mode: 'extract' }).net).toBe(1000)
  })

  it('tomt/ogiltigt belopp ger nollor, inte NaN', () => {
    expect(calcVat({ amount: '', rate: 25, mode: 'add' })).toMatchObject({ net: 0, vat: 0, gross: 0 })
  })
})

describe('calcEmployerCost', () => {
  const r = calcEmployerCost({ gross: 30000, taxRate: 30 })

  it('arbetsgivaravgiften använder appens EGEN sats, inte en egen kopia', () => {
    expect(r.employerFee).toBe(Math.round(30000 * STANDARD_EMPLOYER_FEE_RATE))
  })

  it('semesteravsättning enligt procentregeln, med sociala avgifter ovanpå', () => {
    expect(r.vacationProvision).toBe(Math.round(30000 * VACATION_PROVISION_RATE))
    expect(r.vacationFee).toBe(Math.round(30000 * VACATION_PROVISION_RATE * STANDARD_EMPLOYER_FEE_RATE))
  })

  it('total kostnad är lön + avgift + semester + semesteravgift', () => {
    expect(r.totalCost).toBe(r.gross + r.employerFee + r.vacationProvision + r.vacationFee)
  })

  it('utan semesteravsättning försvinner både avsättningen och dess avgift', () => {
    const utan = calcEmployerCost({ gross: 30000, taxRate: 30, vacation: false })
    expect(utan.vacationProvision).toBe(0)
    expect(utan.vacationFee).toBe(0)
    expect(utan.totalCost).toBe(30000 + utan.employerFee)
  })

  it('nettolön är bruttolön minus skatt', () => {
    expect(r.tax).toBe(9000)
    expect(r.net).toBe(21000)
  })
})

describe('calcSoleTraderFees', () => {
  // Ordningen är hela poängen: schablonavdraget först, egenavgifterna på
  // det som återstår. Räknar man avgifterna på hela överskottet blir de
  // ~33 % för höga.
  it('drar schablonavdraget FÖRE egenavgifterna', () => {
    const r = calcSoleTraderFees({ surplus: 400000, categoryId: 'full', municipalTaxRate: 32 })
    expect(r.standardDeduction).toBe(100000)   // 25 % av 400 000
    expect(r.feeBase).toBe(300000)             // underlaget efter schablon
    expect(r.fees).toBe(Math.round(300000 * 0.2897))
  })

  it('pensionärskategorin har lägre avgift och lägre schablonavdrag', () => {
    const r = calcSoleTraderFees({ surplus: 400000, categoryId: 'pension', municipalTaxRate: 32 })
    expect(r.standardDeduction).toBe(80000)    // 20 %
    expect(r.fees).toBe(Math.round(320000 * 0.1021))
  })

  it('inkomstskatten räknas på överskottet efter faktiska egenavgifter', () => {
    const r = calcSoleTraderFees({ surplus: 400000, categoryId: 'full', municipalTaxRate: 32 })
    expect(r.taxableIncome).toBe(400000 - r.fees)
    expect(r.incomeTax).toBe(Math.round(r.taxableIncome * 0.32))
    expect(r.net).toBe(r.taxableIncome - r.incomeTax)
  })

  it('negativt överskott klampas till noll i stället för att ge negativa avgifter', () => {
    const r = calcSoleTraderFees({ surplus: -50000 })
    expect(r.fees).toBe(0)
    expect(r.net).toBe(0)
  })
})

describe('daysBetween', () => {
  it('räknar hela kalenderdygn', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30)
  })

  // Utan UTC-normaliseringen ger sommartidsövergången i mars ett dygn fel.
  it('påverkas inte av sommartidsövergången', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
  })

  it('ogiltigt datum ger 0, inte NaN', () => {
    expect(daysBetween('inte-ett-datum', '2026-01-01')).toBe(0)
  })
})

describe('calcLateInterest', () => {
  it('räntesatsen är referensränta + 8 procentenheter', () => {
    const r = calcLateInterest({ amount: 10000, dueDate: '2026-01-01', paidDate: '2026-01-01', referenceRate: 2 })
    expect(r.rate).toBe(2 + LATE_INTEREST_MARKUP)
  })

  it('räknar per kalenderdag på 365-dagarsbasis', () => {
    const r = calcLateInterest({ amount: 10000, dueDate: '2026-01-01', paidDate: '2026-02-01', referenceRate: 2 })
    expect(r.days).toBe(31)
    expect(r.interest).toBe(Math.round(10000 * 0.10 * (31 / 365) * 100) / 100)
  })

  it('betalning före förfallodagen ger noll dagar, aldrig negativ ränta', () => {
    const r = calcLateInterest({ amount: 10000, dueDate: '2026-02-01', paidDate: '2026-01-01' })
    expect(r.days).toBe(0)
    expect(r.interest).toBe(0)
    expect(r.total).toBe(10000)
  })

  it('lägger på de lagstadgade avgifter som valts', () => {
    const r = calcLateInterest({ amount: 10000, dueDate: '2026-01-01', paidDate: '2026-01-01', fees: ['compensation', 'collection'] })
    expect(r.feeTotal).toBe(450 + 180)
    expect(r.total).toBe(10630)
  })

  it('okända avgifts-id:n ignoreras i stället för att krascha', () => {
    const r = calcLateInterest({ amount: 1000, dueDate: '2026-01-01', paidDate: '2026-01-01', fees: ['finns-inte'] })
    expect(r.feeTotal).toBe(0)
  })
})

describe('calcDividendAllowance (3:12)', () => {
  // Grundbeloppet är 4 IBB från och med 2026 — går den här sönder visar
  // verktyget den GAMLA förenklingsregelns 2,75 IBB, vilket ger ett
  // gränsbelopp som är drygt 100 000 kr för lågt.
  it('grundbeloppet är 4 inkomstbasbelopp', () => {
    expect(DIVIDEND_BASE_AMOUNT).toBe(4 * DIVIDEND_RULES.incomeBaseAmount)
    const r = calcDividendAllowance({ ownershipPercent: 100, payroll: 0, ownSalary: 0 })
    expect(r.baseAmount).toBe(DIVIDEND_BASE_AMOUNT)
    expect(r.allowance).toBe(DIVIDEND_BASE_AMOUNT)
  })

  // Den vanligaste missen när två makar äger bolaget tillsammans: båda
  // räknar med HELA grundbeloppet. Det fördelas efter ägarandel.
  it('grundbeloppet fördelas efter ägarandel', () => {
    const r = calcDividendAllowance({ ownershipPercent: 50, payroll: 0, ownSalary: 0 })
    expect(r.baseAmount).toBe(DIVIDEND_BASE_AMOUNT / 2)
  })

  it('lönebaserat utrymme är 50 % av andelen av löneunderlaget efter 8 IBB', () => {
    const payroll = 2000000
    const r = calcDividendAllowance({ ownershipPercent: 100, payroll, ownSalary: 600000 })
    expect(r.wageBased).toBe(Math.round((payroll - DIVIDEND_WAGE_DEDUCTION) * 0.5))
    expect(r.allowance).toBe(r.baseAmount + r.wageBased)
  })

  it('avdraget på 8 IBB kan aldrig ge ett negativt lönebaserat utrymme', () => {
    const r = calcDividendAllowance({ ownershipPercent: 100, payroll: 300000, ownSalary: 300000 })
    expect(r.wageBased).toBe(0)
    expect(r.allowance).toBe(DIVIDEND_BASE_AMOUNT)
  })

  it('taket på 50 gånger egen lön slår till och flaggas', () => {
    // 5 mkr i löneunderlag ger ett råutrymme på 2 177 600 kr, men en egen
    // lön på 30 000 kr sätter taket vid 1 500 000 kr.
    const r = calcDividendAllowance({ ownershipPercent: 100, payroll: 5000000, ownSalary: 30000 })
    expect(r.wageCap).toBe(30000 * 50)
    expect(r.wageCapApplied).toBe(true)
    expect(r.wageBased).toBe(r.wageCap)
  })

  it('sparat utdelningsutrymme läggs till utan uppräkning', () => {
    const r = calcDividendAllowance({ ownershipPercent: 100, savedAllowance: 100000 })
    expect(r.allowance).toBe(DIVIDEND_BASE_AMOUNT + 100000)
  })

  it('utdelning inom gränsbeloppet beskattas med 20 %', () => {
    const r = calcDividendAllowance({ ownershipPercent: 100, dividend: 200000 })
    expect(r.withinAllowance).toBe(200000)
    expect(r.aboveAllowance).toBe(0)
    expect(r.totalTax).toBe(40000)
    expect(r.net).toBe(160000)
  })

  it('överskjutande del beskattas som tjänst', () => {
    const r = calcDividendAllowance({ ownershipPercent: 100, dividend: 400000, serviceTaxRate: 52 })
    expect(r.withinAllowance).toBe(DIVIDEND_BASE_AMOUNT)
    expect(r.aboveAllowance).toBe(400000 - DIVIDEND_BASE_AMOUNT)
    expect(r.taxAbove).toBe(Math.round((400000 - DIVIDEND_BASE_AMOUNT) * 0.52))
    expect(r.carriedForward).toBe(0)
  })

  it('outnyttjat utrymme sparas till nästa år', () => {
    const r = calcDividendAllowance({ ownershipPercent: 100, dividend: 100000 })
    expect(r.carriedForward).toBe(DIVIDEND_BASE_AMOUNT - 100000)
  })

  it('tomma fält ger nollor, inte NaN', () => {
    const r = calcDividendAllowance({ ownershipPercent: '', payroll: '', ownSalary: '', dividend: '' })
    expect(r.allowance).toBe(0)
    expect(r.totalTax).toBe(0)
    expect(r.effectiveTaxRate).toBe(0)
  })
})
