import { describe, it, expect } from 'vitest';
import { missingReverseChargeRows, reverseChargePurchaseInfo, describeReverseCharge } from './reverseCharge';
import { computeVatPeriod, roundedVatPeriod, validateVatPeriod, vatRutaValue, vatSettlementRows } from './vatCalculation';
import { generateVatDeclarationXml } from './vatDeclarationExport';
import { VAT_RUTOR, REVERSE_PURCHASE_KINDS, REVERSE_VAT_KINDS, EXEMPT_SALES_RUTA_BY_ACCOUNT } from './vatConfig';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

const period = { periodStart: '2026-07-01', periodEnd: '2026-09-30' };
const ver = (id, rows) => ({ id, number: id, date: '2026-08-10', status: 'booked', rows });
const value = (r, ruta) => vatRutaValue(VAT_RUTOR.find(x => x.ruta === ruta), r);
const rounded = (vers) => roundedVatPeriod(computeVatPeriod({ verifications: vers, ...period }));
const balanced = (rows) => {
  const d = rows.reduce((s, r) => s + (r.debet || 0), 0);
  const k = rows.reduce((s, r) => s + (r.kredit || 0), 0);
  return Math.abs(d - k) < 0.005;
};

describe('alla konton för omvänd skattskyldighet finns i kontoplanen', () => {
  it('inköpskonton, momskonton och försäljningskonton', () => {
    const codes = new Set(DEFAULT_ACCOUNTS.map(a => a.code));
    const all = [
      ...Object.values(REVERSE_PURCHASE_KINDS).flatMap(k => Object.values(k.accounts)),
      ...Object.values(REVERSE_VAT_KINDS).flatMap(k => [k.input, ...Object.values(k.output)]),
      ...Object.keys(EXEMPT_SALES_RUTA_BY_ACCOUNT),
      '4549',
    ];
    for (const code of all) expect(codes.has(code), code).toBe(true);
  });
});

describe('varor från annat EU-land (ruta 20)', () => {
  it('får 2645 och 2614, och hamnar i ruta 20, 30 och 48', () => {
    const extra = missingReverseChargeRows([{ account: '4515', debet: 4000, kredit: 0 }]);
    expect(extra).toEqual([{ account: '2645', debet: 1000, kredit: 0 }, { account: '2614', debet: 0, kredit: 1000 }]);
    const r = rounded([ver('A1', [{ account: '4515', debet: 4000, kredit: 0 }, { account: '2440', debet: 0, kredit: 4000 }, ...extra])]);
    expect(value(r, '20')).toBe(4000);
    expect(value(r, '21')).toBe(0);
    expect(value(r, '30')).toBe(1000);
    expect(value(r, '48')).toBe(1000);
    expect(value(r, '49')).toBe(0);
  });
});

describe('byggtjänster och andra tjänster i Sverige (ruta 24)', () => {
  it('får 2647 och 2617, och hamnar i ruta 24, 30 och 48', () => {
    expect(reverseChargePurchaseInfo('4425')).toEqual({ region: 'seServices', rate: 25 });
    const extra = missingReverseChargeRows([{ account: '4425', debet: 20000, kredit: 0 }]);
    expect(extra).toEqual([{ account: '2647', debet: 5000, kredit: 0 }, { account: '2617', debet: 0, kredit: 5000 }]);
    const r = rounded([ver('A1', [{ account: '4425', debet: 20000, kredit: 0 }, { account: '2440', debet: 0, kredit: 20000 }, ...extra])]);
    expect(value(r, '24')).toBe(20000);
    expect(value(r, '30')).toBe(5000);
    expect(value(r, '48')).toBe(5000);
    expect(value(r, '49')).toBe(0);
  });

  it('varor med omvänd skattskyldighet i Sverige går till ruta 23', () => {
    const extra = missingReverseChargeRows([{ account: '4415', debet: 1000, kredit: 0 }]);
    const r = rounded([ver('A1', [{ account: '4415', debet: 1000, kredit: 0 }, { account: '2440', debet: 0, kredit: 1000 }, ...extra])]);
    expect(value(r, '23')).toBe(1000);
    expect(value(r, '30')).toBe(250);
  });
});

describe('import av varor (ruta 50 och 60)', () => {
  it('underlaget på 4545 mot 4549 ger 2645 och 2615, ruta 50, 60 och 48', () => {
    const base = [{ account: '4545', debet: 10000, kredit: 0 }, { account: '4549', debet: 0, kredit: 10000 }];
    const extra = missingReverseChargeRows(base);
    expect(extra).toEqual([{ account: '2645', debet: 2500, kredit: 0 }, { account: '2615', debet: 0, kredit: 2500 }]);
    const r = rounded([ver('A1', [...base, ...extra])]);
    expect(value(r, '50')).toBe(10000);
    expect(value(r, '60')).toBe(2500);
    expect(value(r, '30')).toBe(0);
    expect(value(r, '48')).toBe(2500);
    expect(value(r, '49')).toBe(0);
  });

  it('förklaringen nämner underlaget och rätt rutor', () => {
    expect(describeReverseCharge({ region: 'import', rate: 25 })).toMatch(/ruta 50, 60 och 48/);
    expect(describeReverseCharge({ region: 'seServices', rate: 25 })).toMatch(/2647 och 2617.*ruta 24, 30 och 48/);
  });
});

describe('försäljning utan svensk moms (ruta 35-42)', () => {
  it('varje konto hamnar i sin ruta och påverkar inte ruta 05', () => {
    const r = rounded([ver('F1', [
      { account: '1510', debet: 6100, kredit: 0 },
      { account: '3108', debet: 0, kredit: 1000 },
      { account: '3105', debet: 0, kredit: 2000 },
      { account: '3308', debet: 0, kredit: 1500 },
      { account: '3305', debet: 0, kredit: 500 },
      { account: '3231', debet: 0, kredit: 800 },
      { account: '3004', debet: 0, kredit: 300 },
    ])]);
    expect(value(r, '05')).toBe(0);
    expect(value(r, '35')).toBe(1000);
    expect(value(r, '36')).toBe(2000);
    expect(value(r, '39')).toBe(1500);
    expect(value(r, '40')).toBe(500);
    expect(value(r, '41')).toBe(800);
    expect(value(r, '42')).toBe(300);
    expect(value(r, '49')).toBe(0);
  });
});

describe('den avslutande momsverifikationen', () => {
  it('nollställer varje momskonto och går ihop, även med alla typer och ören', () => {
    const vers = [
      ver('S', [{ account: '1510', debet: 12500.4, kredit: 0 }, { account: '3001', debet: 0, kredit: 10000.32 }, { account: '2611', debet: 0, kredit: 2500.08 }]),
      ver('K', [{ account: '5410', debet: 400.4, kredit: 0 }, { account: '2641', debet: 100.1, kredit: 0 }, { account: '1930', debet: 0, kredit: 500.5 }]),
      ver('E', [{ account: '4535', debet: 333.33, kredit: 0 }, { account: '2440', debet: 0, kredit: 333.33 }, ...missingReverseChargeRows([{ account: '4535', debet: 333.33 }])]),
      ver('B', [{ account: '4425', debet: 1234.5, kredit: 0 }, { account: '2440', debet: 0, kredit: 1234.5 }, ...missingReverseChargeRows([{ account: '4425', debet: 1234.5 }])]),
      ver('I', [{ account: '4545', debet: 777.7, kredit: 0 }, { account: '4549', debet: 0, kredit: 777.7 }, ...missingReverseChargeRows([{ account: '4545', debet: 777.7 }])]),
    ];
    const r = rounded(vers);
    const rows = vatSettlementRows(r);
    expect(balanced(rows)).toBe(true);
    const accounts = rows.map(x => x.account);
    for (const acc of ['2611', '2614', '2617', '2615', '2641', '2645', '2647', '2650']) expect(accounts, acc).toContain(acc);
    // Ruta 49 = det som bokförs mot 2650.
    const on2650 = rows.find(x => x.account === '2650');
    expect(on2650.kredit - on2650.debet).toBe(r.netToPay);
  });
});

describe('momsdeklarationen stoppar inköp utan momsrader', () => {
  it('nämner typen, kontona och rutan', () => {
    const res = validateVatPeriod({ verifications: [ver('A7', [{ account: '4425', debet: 1000, kredit: 0 }, { account: '2440', debet: 0, kredit: 1000 }])], ...period });
    expect(res.canProceed).toBe(false);
    expect(res.errors[0].message).toMatch(/konto 2647 i debet och 2617 i kredit/);
    expect(res.errors[0].message).toMatch(/ruta 24/);
  });
});

describe('eSKD-filen', () => {
  it('skriver alla nya rutor med Skatteverkets taggar, i Skatteverkets ordning', () => {
    const vers = [
      ver('G', [{ account: '4515', debet: 1000, kredit: 0 }, { account: '2440', debet: 0, kredit: 1000 }, ...missingReverseChargeRows([{ account: '4515', debet: 1000 }])]),
      ver('B', [{ account: '4425', debet: 2000, kredit: 0 }, { account: '2440', debet: 0, kredit: 2000 }, ...missingReverseChargeRows([{ account: '4425', debet: 2000 }])]),
      ver('I', [{ account: '4545', debet: 4000, kredit: 0 }, { account: '4549', debet: 0, kredit: 4000 }, ...missingReverseChargeRows([{ account: '4545', debet: 4000 }])]),
      ver('F', [{ account: '1510', debet: 3000, kredit: 0 }, { account: '3308', debet: 0, kredit: 3000 }]),
    ];
    const xml = generateVatDeclarationXml({ company: { orgNr: '556000-0175' }, year: 2026, quarter: 3, rounded: rounded(vers) });
    const order = [
      '<InkopVaruAnnatEg>1000</InkopVaruAnnatEg>',
      '<InkopTjanstSverige>2000</InkopTjanstSverige>',
      '<MomsInkopUtgHog>750</MomsInkopUtgHog>',
      '<ForsTjSkskAnnatEg>3000</ForsTjSkskAnnatEg>',
      '<MomsUlagImport>4000</MomsUlagImport>',
      '<MomsImportUtgHog>1000</MomsImportUtgHog>',
      '<MomsIngAvdr>1750</MomsIngAvdr>',
      '<MomsBetala>0</MomsBetala>',
    ];
    let last = -1;
    for (const tag of order) {
      const at = xml.indexOf(tag);
      expect(at, tag).toBeGreaterThan(last);
      last = at;
    }
    expect(xml).not.toContain('<ForsMomsEjAnnan>');
  });
});
