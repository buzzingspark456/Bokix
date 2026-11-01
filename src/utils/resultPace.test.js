import { describe, it, expect } from 'vitest';
import { computeWorksheet, groupWorksheetRows } from './worksheet';
import {
  buildResultPace, buildResultWaterfall, computeBalanceReport, computeBalanceStatement, computeBalanceTrend, computeKeyFigures,
  computeInvoiceReport, computeMonthDeviation, computeResultStatement, getPeriodBounds, sumFlowByType,
} from './reportCalculations';

const accounts = [
  { code: '1930', name: 'Bank' },
  { code: '3000', name: 'Försäljning' },
  { code: '5010', name: 'Lokalhyra' },
];
const sale = (date, amount) => ({ id: date, date, rows: [{ account: '1930', debet: amount, kredit: 0 }, { account: '3000', debet: 0, kredit: amount }] });
const rent = (date, amount) => ({ id: date, date, rows: [{ account: '5010', debet: amount, kredit: 0 }, { account: '1930', debet: 0, kredit: amount }] });

const year = {
  start: new Date(2026, 0, 1), end: new Date(2026, 5, 30),
  prevStart: new Date(2025, 0, 1), prevEnd: new Date(2025, 5, 30),
};

describe('balansräkningen före bokslutet', () => {
  const allAccounts = [...accounts, { code: '2081', name: 'Aktiekapital' }, { code: '2440', name: 'Leverantörsskulder' }];
  const capital = { id: 'k', date: '2026-01-01', rows: [{ account: '1930', debet: 500, kredit: 0 }, { account: '2081', debet: 0, kredit: 500 }] };
  const bought = { id: 'l', date: '2026-02-01', rows: [{ account: '5010', debet: 100, kredit: 0 }, { account: '2440', debet: 0, kredit: 100 }] };
  const vers = [capital, bought, sale('2026-03-01', 1000)];
  const end = new Date(2026, 5, 30);

  it('går ihop med årets resultat som egen rad', () => {
    const b = computeBalanceReport(vers, allAccounts, end);
    expect(b.totalAssets).toBe(1500);
    expect(b.totalEquityAndLiabilities).toBe(1500);
    expect(b.equityAndLiabilities.find(r => r.computed).amount).toBe(900);
  });

  it('räknar in resultatet i soliditeten', () => {
    const k = computeKeyFigures(vers, allAccounts, new Date(2026, 0, 1), end);
    expect(k.egetKapital).toBe(1400);
    expect(k.soliditet).toBeCloseTo((1400 / 1500) * 100);
  });

  it('lägger ingen extra rad när bokslutet är bokfört', () => {
    const close = { id: 'b', date: '2026-06-30', source: 'year_end_close', rows: [{ account: '3000', debet: 1000, kredit: 0 }, { account: '5010', debet: 0, kredit: 100 }, { account: '2081', debet: 0, kredit: 900 }] };
    const b = computeBalanceReport([...vers, close], allAccounts, end);
    expect(b.equityAndLiabilities.some(r => r.computed)).toBe(false);
    expect(b.totalEquityAndLiabilities).toBe(1500);
  });
});

describe('uppställningarna', () => {
  const allAccounts = [
    ...accounts,
    { code: '1220', name: 'Inventarier' },
    { code: '2081', name: 'Aktiekapital' },
    { code: '2440', name: 'Leverantörsskulder' },
    { code: '4010', name: 'Varuinköp' },
    { code: '7010', name: 'Löner' },
    { code: '8310', name: 'Ränteintäkter', type: 'intakt' },
  ];
  const ver = (id, date, rows) => ({ id, date, rows });
  const vers = [
    ver('k', '2025-02-01', [{ account: '1930', debet: 500, kredit: 0 }, { account: '2081', debet: 0, kredit: 500 }]),
    ver('f', '2025-03-01', [{ account: '1930', debet: 200, kredit: 0 }, { account: '3000', debet: 0, kredit: 200 }]),
    ver('s', '2026-02-01', [{ account: '1930', debet: 1000, kredit: 0 }, { account: '3000', debet: 0, kredit: 1000 }]),
    ver('v', '2026-02-02', [{ account: '4010', debet: 300, kredit: 0 }, { account: '2440', debet: 0, kredit: 300 }]),
    ver('l', '2026-02-03', [{ account: '7010', debet: 150, kredit: 0 }, { account: '1930', debet: 0, kredit: 150 }]),
    ver('r', '2026-02-04', [{ account: '1930', debet: 20, kredit: 0 }, { account: '8310', debet: 0, kredit: 20 }]),
    ver('i', '2026-02-05', [{ account: '1220', debet: 100, kredit: 0 }, { account: '1930', debet: 0, kredit: 100 }]),
  ];

  it('resultaträkningen delar kontona i grupper och går ihop med fjolåret', () => {
    const s = computeResultStatement(vers, allAccounts, year);
    expect(s.items.map(i => i.key)).toEqual(['income', 'goods', 'staff', 'result']);
    expect(s.items[0].rows.map(r => r.code)).toEqual(['3000', '8310']);
    expect(s.items[0].rows[0]).toMatchObject({ amount: 1000, prev: 200 });
    expect(s.omsattning).toBe(1020);
    expect(s.kostnader).toBe(450);
    expect(s.resultat).toBe(570);
    expect(s.prevResultat).toBe(200);
    expect(s.hasComparison).toBe(true);
  });

  it('räknar ett konto en gång även om kontoplanen har det två gånger, som sumFlowByType', () => {
    const dubbel = [...allAccounts, { code: '4010', name: 'Varuinköp' }];
    const s = computeResultStatement(vers, dubbel, year);
    expect(s.kostnader).toBe(sumFlowByType(vers, dubbel, 'kostnad', year.start, year.end));
    expect(s.omsattning).toBe(sumFlowByType(vers, dubbel, 'intakt', year.start, year.end));
  });

  it('balansräkningen går ihop och räknar in årets resultat i eget kapital', () => {
    const b = computeBalanceStatement(vers, allAccounts, year.end, year.prevEnd);
    expect(b.items.map(i => i.key)).toEqual(['fixed', 'current', 'assets', 'equity', 'debts', 'equityAndLiabilities']);
    expect(b.totalAssets).toBe(1570);
    expect(b.totalEquityAndLiabilities).toBe(1570);
    expect(b.equity).toBe(1270);
    expect(b.debts).toBe(300);
    expect(b.prevTotalAssets).toBe(700);
    expect(b.prevEquity).toBe(700);
    expect(b.hasComparison).toBe(true);
  });

  it('vattenfallet går från intäkterna ner till resultatet', () => {
    const steps = buildResultWaterfall(computeResultStatement(vers, allAccounts, year).items);
    expect(steps.map(s => s.key)).toEqual(['income', 'goods', 'staff', 'result']);
    expect(steps[0].range).toEqual([0, 1020]);
    expect(steps[1].range).toEqual([720, 1020]);
    expect(steps[1].amount).toBe(-300);
    expect(steps[2].range).toEqual([570, 720]);
    expect(steps[3].range).toEqual([0, 570]);
  });

  it('vattenfallet klarar en förlust', () => {
    const steps = buildResultWaterfall([
      { type: 'group', key: 'income', label: 'I', amount: 100 },
      { type: 'group', key: 'external', label: 'K', amount: 250 },
      { type: 'total', key: 'result', label: 'R', amount: -150 },
    ]);
    expect(steps[1].range).toEqual([-150, 100]);
    expect(steps[2].range).toEqual([-150, 0]);
  });

  it('avvikelsen tittar på senaste hela månaden, inte den pågående', () => {
    const month = (i, amount) => sale(`2025-${String(i).padStart(2, '0')}-15`, amount);
    const jämnt = [10, 11, 12].map(i => month(i, 1000));
    const lika = sale('2026-01-15', 1000);
    expect(computeMonthDeviation([...jämnt, lika], accounts, new Date(2026, 1, 10))).toBeNull();
    const hopp = sale('2026-01-15', 9000);
    expect(computeMonthDeviation([...jämnt, hopp], accounts, new Date(2026, 1, 10))).not.toBeNull();
    // För lite historik: ingen varning.
    expect(computeMonthDeviation([hopp], accounts, new Date(2026, 1, 10))).toBeNull();
  });

  it('senaste 12 månaderna börjar på månadens första elva månader tillbaka', () => {
    const b = getPeriodBounds('last12', { referenceDate: new Date(2026, 9, 31) });
    expect(b.start).toEqual(new Date(2025, 10, 1));
    expect(b.end).toEqual(new Date(2026, 9, 31));
  });

  it('utvecklingen har en punkt per månad som går ihop med balansen', () => {
    const trend = computeBalanceTrend(vers, allAccounts, year.start, year.end);
    expect(trend).toHaveLength(6);
    const last = trend[5];
    expect(last.equity + last.debts).toBe(1570);
    expect(trend[0].equity).toBe(700);
    expect(trend[0].debts).toBe(0);
  });
});

describe('arbetsbladets kontroll', () => {
  const omitted = [sale('2025-03-01', 700), rent('2025-04-01', 200)];

  it('stämmer när föregående år inte är bokslutat', () => {
    const ws = computeWorksheet([...omitted, sale('2026-02-01', 1000)], accounts, '2026-01-01', '2026-06-30');
    expect(ws.priorResult).toBe(500);
    expect(ws.rawInBalance).toBe(true);
    expect(ws.balanceInBalance).toBe(true);
  });

  it('summorna går ihop med tidigare års resultat på skärmen', () => {
    const ws = computeWorksheet([...omitted, sale('2026-02-01', 1000)], accounts, '2026-01-01', '2026-06-30');
    expect(ws.rawWithPrior.debet).toBe(ws.rawWithPrior.kredit);
    expect(ws.adjustedWithPrior.debet).toBe(ws.adjustedWithPrior.kredit);
    expect(ws.balanceWithResult.debet).toBe(ws.balanceWithResult.kredit);
  });

  it('delar raderna i grupper med delsummor', () => {
    const ws = computeWorksheet([sale('2026-02-01', 1000), rent('2026-02-02', 300)], accounts, '2026-01-01', '2026-06-30');
    const groups = groupWorksheetRows(ws.rows);
    expect(groups.map(g => g.key)).toEqual(['assets', 'income', 'costs']);
    expect(groups[0].totals.balance).toEqual({ debet: 700, kredit: 0 });
    expect(groups[1].totals.income).toEqual({ debet: 0, kredit: 1000 });
    expect(groups[2].totals.raw).toEqual({ debet: 300, kredit: 0 });
  });

  it('flaggar kundfordringar på kreditsidan, men inte på debetsidan', () => {
    const konton = [...accounts, { code: '1510', name: 'Kundfordringar' }];
    const inbetalning = { id: 'i', date: '2026-02-03', rows: [{ account: '1930', debet: 400, kredit: 0 }, { account: '1510', debet: 0, kredit: 400 }] };
    const kredit = computeWorksheet([inbetalning], konton, '2026-01-01', '2026-06-30');
    expect(kredit.negativeReceivables).toEqual([{ code: '1510', name: 'Kundfordringar', amount: 400 }]);
    const faktura = { id: 'f', date: '2026-02-01', rows: [{ account: '1510', debet: 400, kredit: 0 }, { account: '3000', debet: 0, kredit: 400 }] };
    const ok = computeWorksheet([faktura, inbetalning], konton, '2026-01-01', '2026-06-30');
    expect(ok.negativeReceivables).toEqual([]);
  });

  it('larmar fortfarande för en verifikation som inte balanserar', () => {
    const trasig = { id: 't', date: '2026-02-02', rows: [{ account: '1930', debet: 50, kredit: 0 }] };
    const ws = computeWorksheet([...omitted, sale('2026-02-01', 1000), trasig], accounts, '2026-01-01', '2026-06-30');
    expect(ws.rawInBalance).toBe(false);
  });
});

describe('fakturarapporten med kreditfaktura', () => {
  const contacts = [{ id: 'k1', name: 'Kund Ett' }, { id: 'k2', name: 'Kund Två' }];
  const rad = (unitPrice) => [{ qty: 1, unitPrice, vat: 0 }];
  const invoices = [
    { id: 'a', invoiceNumber: 1, customerId: 'k1', date: '2026-02-01', status: 'sent', paidAmount: 9000, rows: rad(13000) },
    { id: 'b', invoiceNumber: 2, customerId: 'k2', date: '2026-02-02', status: 'paid', paidVia: 'credit', rows: rad(63) },
    { id: 'c', invoiceNumber: 3, creditFor: 2, date: '2026-02-03', status: 'paid', paidVia: 'credit', rows: rad(-63) },
  ];

  it('samlar krediten på originalets kund och räknar den inte som betald', () => {
    const r = computeInvoiceReport(invoices, contacts, year.start, year.end);
    expect(r.rows.map(x => x.name)).toEqual(['Kund Ett', 'Kund Två']);
    expect(r.rows[1]).toMatchObject({ invoiced: 0, paid: 0, outstanding: 0, invoiceCount: 2 });
    expect(r.totals).toMatchObject({ invoiced: 13000, paid: 9000, outstanding: 4000 });
    expect(r.totals.invoiced - r.totals.paid).toBe(r.totals.outstanding);
  });
});

describe('buildResultPace', () => {
  it('summerar resultatet månad för månad', () => {
    const pace = buildResultPace([sale('2026-01-10', 1000), rent('2026-02-01', 300), sale('2026-03-05', 500)], accounts, year);
    expect(pace.points).toHaveLength(6);
    expect(pace.points.map(p => p.resultat)).toEqual([1000, 700, 1200, 1200, 1200, 1200]);
    expect(pace.result).toBe(1200);
    expect(pace.hasActivity).toBe(true);
  });

  it('visar fjolåret bara när det finns bokföring då', () => {
    const utan = buildResultPace([sale('2026-01-10', 1000)], accounts, year);
    expect(utan.hasComparison).toBe(false);
    expect(utan.points[0]).not.toHaveProperty('fjol');

    const med = buildResultPace([sale('2026-01-10', 1000), sale('2025-01-20', 400), rent('2025-03-01', 100)], accounts, year);
    expect(med.hasComparison).toBe(true);
    expect(med.points.map(p => p.fjol)).toEqual([400, 400, 300, 300, 300, 300]);
    expect(med.prevResult).toBe(300);
  });

  it('delar korta perioder per dag', () => {
    const month = {
      start: new Date(2026, 2, 1), end: new Date(2026, 2, 10),
      prevStart: new Date(2025, 2, 1), prevEnd: new Date(2025, 2, 10),
    };
    const pace = buildResultPace([sale('2026-03-05', 200)], accounts, month);
    expect(pace.points).toHaveLength(10);
    expect(pace.points[3].resultat).toBe(0);
    expect(pace.points[4].resultat).toBe(200);
  });

  it('har ingen aktivitet utan bokföring', () => {
    const pace = buildResultPace([], accounts, year);
    expect(pace.hasActivity).toBe(false);
    expect(pace.result).toBe(0);
  });
});
