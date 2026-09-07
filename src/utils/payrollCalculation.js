import { lookupSkatteavdrag } from './skattetabell';
import { EMPLOYER_FEE_CATEGORIES, VACATION_RULES, SECONDARY_INCOME_TAX_RATE } from './payrollConfig';
import { summarizePayLines } from './payTypes';

const round = (v) => Math.round(v || 0);

/**
 * Beräknar en anställds lönerad för en period, steg för steg. Returnerar
 * dels de färdiga beloppen (för summeringar), dels en `steps`-lista i
 * samma ordning som referensen, byggd för den generiska CalculationRow-
 * komponenten (label, formula, result) — så samma mönster återanvänds för
 * varje anställd istället för unik hårdkodad HTML per rad.
 *
 * `employee.taxTable` (tabellnr + kolumn) måste redan vara FRYST på
 * anställdens profil vid tidpunkten för lönekörningen — den skickas in
 * här, beräkningsmotorn slår aldrig upp anställdens NUVARANDE
 * skattetabellinställning, bara den som frystes när körningen skapades.
 */
export function computeEmployeePayroll(employee, row) {
  const vatRuleId = employee.vacationRule || 'procentregeln';
  const vacationRule = VACATION_RULES.find(r => r.id === vatRuleId) || VACATION_RULES[0];
  const feeCategory = EMPLOYER_FEE_CATEGORIES[employee.employmentType] || EMPLOYER_FEE_CATEGORIES.anstalld;

  const steps = [];

  // 0. Lönearter (row.lines) — övertid, OB, jour, frånvaro, förmåner,
  // skattefria ersättningar och nettoavdrag. Varje rad blir ett eget steg
  // längre ner, men summorna behövs redan här eftersom de går in i
  // brutto-, skatte- och avgiftsunderlagen.
  //
  // De gamla råa fälten (row.additions m.fl.) läses fortfarande och läggs
  // OVANPÅ lönearternas summor: lönekörningar som sparades innan
  // lönearterna fanns ska räknas likadant som förut.
  const payLines = summarizePayLines(row.lines, employee);

  // 1. Grundlön
  let baseSalary;
  if (employee.salaryForm === 'timlon') {
    const hours = Number(row.hoursWorked) || 0;
    baseSalary = (Number(employee.hourlyRate) || 0) * hours;
    steps.push({ label: 'Grundlön', formula: `${employee.hourlyRate || 0} kr/tim × ${hours} tim`, result: round(baseSalary) });
  } else {
    const rate = (Number(employee.employmentRate) || 100) / 100;
    baseSalary = (Number(employee.monthlySalary) || 0) * rate;
    steps.push({ label: 'Grundlön', formula: `${employee.monthlySalary || 0} kr × ${employee.employmentRate ?? 100}%`, result: round(baseSalary) });
  }

  // 2. Lönearternas egna rader — en per stycke, med sin formel, INNAN
  // bruttolönen summeras. Det är skillnaden mot att bara mata in en
  // klumpsumma: den anställda kan läsa VAD tillägget bestod av.
  payLines.lines.forEach((l) => {
    steps.push({
      label: l.name,
      formula: l.formula,
      result: round(l.signedAmount),
    });
  });

  // 3. Bruttolön
  const additions = (Number(row.additions) || 0) + payLines.additions;
  const absence = (Number(row.absenceDeduction) || 0) + payLines.absence;
  const grossDeduction = Number(row.grossDeduction) || 0;
  const gross = baseSalary + additions - absence - grossDeduction;
  steps.push({
    label: 'Bruttolön',
    formula: `${round(baseSalary)} + ${round(additions)} (tillägg) − ${round(absence)} (frånvaro) − ${round(grossDeduction)} (bruttoavdrag)`,
    result: round(gross),
  });

  // 4. Skattegrundande inkomst. Förmåner höjer underlaget för skatt och
  // avgifter men betalas aldrig ut — därför läggs de till HÄR och inte i
  // bruttolönen ovan.
  const benefits = (Number(row.benefits) || 0) + payLines.benefits;
  const taxableIncome = gross + benefits;
  steps.push({ label: 'Skattegrundande inkomst', formula: `${round(gross)} + ${round(benefits)} (förmåner)`, result: round(taxableIncome) });

  // 4. Skatteavdrag
  let tax, taxNote;
  if (employee.secondaryIncome) {
    tax = round(taxableIncome * SECONDARY_INCOME_TAX_RATE);
    taxNote = `Sidoinkomst: ${(SECONDARY_INCOME_TAX_RATE * 100).toFixed(0)}% fast skatteavdrag (fristående beräkningsväg, inte tabellbaserad)`;
  } else if (employee.taxTable?.tabellnr && employee.taxTable?.kolumn) {
    try {
      const { amount, extrapolated, extrapolatedFrom } = lookupSkatteavdrag({
        year: employee.taxTable.year, tabellnr: employee.taxTable.tabellnr,
        kolumn: employee.taxTable.kolumn, inkomst: taxableIncome,
      });
      tax = round(amount);
      // Bugfix (kundrapport): påstod tidigare ALLTID "högsta kända bracket",
      // även när inkomsten låg UNDER tabellens lägsta rad (t.ex. 0 kr för en
      // timanställd utan registrerade timmar) — se filkommentaren i
      // skattetabell.js för hela felet (25 944 kr skatt på 0 kr bruttolön).
      // Beskriver nu rätt riktning.
      const extrapolationNote = extrapolated
        ? ` (${extrapolatedFrom === 'lowest' ? 'under tabellens lägsta intervall — uppskattat från lägsta kända rad' : 'över tabellens högsta intervall — uppskattat från högsta kända rad'})`
        : '';
      taxNote = `Skattetabell ${employee.taxTable.tabellnr}, kolumn ${employee.taxTable.kolumn}, inkomst ${round(taxableIncome)} kr${extrapolationNote}`;
    } catch (err) {
      tax = 0;
      taxNote = `Skattetabell ej inläst (${err.message})`;
    }
  } else {
    tax = 0;
    taxNote = 'Ingen skattetabell/kolumn angiven på den anställda — skatteavdrag kunde inte beräknas.';
  }
  steps.push({ label: 'Skatteavdrag', formula: taxNote, result: round(tax) });

  // 6. Nettolön. Skattefria ersättningar (milersättning, traktamente)
  // betalas ut men har aldrig passerat skatte- eller avgiftsunderlaget —
  // de läggs därför på först här, efter skatten.
  const netDeduction = (Number(row.netDeduction) || 0) + payLines.netDeductions;
  const taxFree = payLines.taxFree;
  const net = gross - tax - netDeduction + taxFree;
  const netFormula = `${round(gross)} − ${round(tax)} (skatt) − ${round(netDeduction)} (nettoavdrag)`
    + (taxFree ? ` + ${round(taxFree)} (skattefritt)` : '');
  steps.push({ label: 'Nettolön', formula: netFormula, result: round(net) });

  // 6. Avgiftskategori
  steps.push({ label: 'Avgiftskategori', formula: `${feeCategory.label}: ${(feeCategory.rate * 100).toFixed(2)}%`, result: null });

  // 7. Arbetsgivaravgifter
  const employerFee = taxableIncome * feeCategory.rate;
  steps.push({ label: 'Arbetsgivaravgifter', formula: `${round(taxableIncome)} (avgiftsunderlag) × ${(feeCategory.rate * 100).toFixed(2)}%`, result: round(employerFee) });

  // 8. Semesteravsättning
  let vacationProvision = 0;
  let vacationFormula;
  if (vacationRule.id === 'procentregeln') {
    vacationProvision = gross * vacationRule.rate;
    vacationFormula = `Procentregeln ${(vacationRule.rate * 100).toFixed(0)}%: ${round(gross)} (semesterunderlag) × ${(vacationRule.rate * 100).toFixed(0)}%`;
  } else {
    vacationFormula = `${vacationRule.label} — beräknas inte automatiskt i denna version, hanteras manuellt.`;
  }
  steps.push({ label: 'Semesteravsättning', formula: vacationFormula, result: round(vacationProvision) });

  // 9. Arbetsgivaravgifter på semesteravsättningen
  const vacationFee = vacationProvision * feeCategory.rate;
  steps.push({ label: 'Arbetsgivaravgifter på semesteravsättning', formula: `${round(vacationProvision)} × ${(feeCategory.rate * 100).toFixed(2)}%`, result: round(vacationFee) });

  // 11. Total arbetsgivarkostnad. Skattefria ersättningar är ingen lön
  // men är pengar som lämnar företaget, så de hör hemma i kostnaden —
  // annars underskattas vad lönekörningen faktiskt kostar.
  const totalCost = gross + employerFee + vacationProvision + vacationFee + taxFree;
  const costFormula = `${round(gross)} + ${round(employerFee)} + ${round(vacationProvision)} + ${round(vacationFee)}`
    + (taxFree ? ` + ${round(taxFree)} (skattefritt)` : '');
  steps.push({ label: 'Total arbetsgivarkostnad', formula: costFormula, result: round(totalCost) });

  return {
    baseSalary: round(baseSalary), gross: round(gross), taxableIncome: round(taxableIncome),
    tax: round(tax), net: round(net), employerFee: round(employerFee),
    taxFree: round(taxFree), payLines: payLines.lines,
    vacationProvision: round(vacationProvision), vacationFee: round(vacationFee),
    totalCost: round(totalCost), feeCategory, vacationRule, steps,
    hasBankInfo: Boolean(employee.clearingNumber && employee.accountNumber),
    // IBAN/BIC är vad den faktiska betalfilen (ISO 20022 pain.001) kräver —
    // clearing-/kontonummer räcker inte där (se salaryPaymentFile.js).
    iban: employee.iban || '', bic: employee.bic || '',
    hasIbanInfo: Boolean(employee.iban && employee.bic),
    hoursWorked: employee.salaryForm === 'timlon' ? (Number(row.hoursWorked) || 0) : null,
  };
}

/** Summerar samtliga anställdas rader — grunden för den levande
 * sammanfattningsraden (aldrig ett sparat, potentiellt inaktuellt värde). */
export function summarizePayrollRun(computedRows) {
  return computedRows.reduce((acc, r) => ({
    gross: acc.gross + r.gross,
    tax: acc.tax + r.tax,
    net: acc.net + r.net,
    employerFee: acc.employerFee + r.employerFee,
    vacationProvision: acc.vacationProvision + r.vacationProvision,
    vacationFee: acc.vacationFee + r.vacationFee,
    taxFree: acc.taxFree + (r.taxFree || 0),
    totalCost: acc.totalCost + r.totalCost,
  }), { gross: 0, tax: 0, net: 0, employerFee: 0, vacationProvision: 0, vacationFee: 0, taxFree: 0, totalCost: 0 });
}
