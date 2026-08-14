import { lookupSkatteavdrag } from './skattetabell';
import { EMPLOYER_FEE_CATEGORIES, VACATION_RULES, SECONDARY_INCOME_TAX_RATE } from './payrollConfig';

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

  // 2. Bruttolön
  const additions = Number(row.additions) || 0;
  const absence = Number(row.absenceDeduction) || 0;
  const grossDeduction = Number(row.grossDeduction) || 0;
  const gross = baseSalary + additions - absence - grossDeduction;
  steps.push({
    label: 'Bruttolön',
    formula: `${round(baseSalary)} + ${round(additions)} (tillägg) − ${round(absence)} (frånvaro) − ${round(grossDeduction)} (bruttoavdrag)`,
    result: round(gross),
  });

  // 3. Skattegrundande inkomst
  const benefits = Number(row.benefits) || 0;
  const taxableIncome = gross + benefits;
  steps.push({ label: 'Skattegrundande inkomst', formula: `${round(gross)} + ${round(benefits)} (förmåner)`, result: round(taxableIncome) });

  // 4. Skatteavdrag
  let tax, taxNote;
  if (employee.secondaryIncome) {
    tax = round(taxableIncome * SECONDARY_INCOME_TAX_RATE);
    taxNote = `Sidoinkomst: ${(SECONDARY_INCOME_TAX_RATE * 100).toFixed(0)}% fast skatteavdrag (fristående beräkningsväg, inte tabellbaserad)`;
  } else if (employee.taxTable?.tabellnr && employee.taxTable?.kolumn) {
    try {
      const { amount, extrapolated } = lookupSkatteavdrag({
        year: employee.taxTable.year, tabellnr: employee.taxTable.tabellnr,
        kolumn: employee.taxTable.kolumn, inkomst: taxableIncome,
      });
      tax = round(amount);
      taxNote = `Skattetabell ${employee.taxTable.tabellnr}, kolumn ${employee.taxTable.kolumn}, inkomst ${round(taxableIncome)} kr${extrapolated ? ' (utanför tabellens intervall — uppskattat från högsta kända bracket)' : ''}`;
    } catch (err) {
      tax = 0;
      taxNote = `Skattetabell ej inläst (${err.message})`;
    }
  } else {
    tax = 0;
    taxNote = 'Ingen skattetabell/kolumn angiven på den anställda — skatteavdrag kunde inte beräknas.';
  }
  steps.push({ label: 'Skatteavdrag', formula: taxNote, result: round(tax) });

  // 5. Nettolön
  const netDeduction = Number(row.netDeduction) || 0;
  const net = gross - tax - netDeduction;
  steps.push({ label: 'Nettolön', formula: `${round(gross)} − ${round(tax)} (skatt) − ${round(netDeduction)} (nettoavdrag)`, result: round(net) });

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

  // 10. Total arbetsgivarkostnad
  const totalCost = gross + employerFee + vacationProvision + vacationFee;
  steps.push({ label: 'Total arbetsgivarkostnad', formula: `${round(gross)} + ${round(employerFee)} + ${round(vacationProvision)} + ${round(vacationFee)}`, result: round(totalCost) });

  return {
    baseSalary: round(baseSalary), gross: round(gross), taxableIncome: round(taxableIncome),
    tax: round(tax), net: round(net), employerFee: round(employerFee),
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
    totalCost: acc.totalCost + r.totalCost,
  }), { gross: 0, tax: 0, net: 0, employerFee: 0, vacationProvision: 0, vacationFee: 0, totalCost: 0 });
}
