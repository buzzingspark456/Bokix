import { describe, it, expect } from 'vitest';
import { missingReverseChargeRows, withReverseChargeRows, reverseChargePurchaseInfo, isReverseChargePurchaseAccount } from './reverseCharge';
import { computeVatPeriod, roundedVatPeriod, validateVatPeriod, vatRutaValue } from './vatCalculation';
import { generateVatDeclarationXml } from './vatDeclarationExport';
import { VAT_RUTOR } from './vatConfig';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

// Google Ads från Irland, 1 000 kr utan svensk moms. Momsen ska redovisas av köparen.
const ver = (over = {}) => ({
  id: 'v1', number: 'A1', date: '2026-08-10', status: 'booked',
  rows: [
    { account: '4535', debet: 1000, kredit: 0 },
    { account: '2645', debet: 250, kredit: 0 },
    { account: '2614', debet: 0, kredit: 250 },
    { account: '1930', debet: 0, kredit: 1000 },
  ],
  ...over,
});

describe('inköpskonton för omvänd skattskyldighet', () => {
  it('känner igen EU och utanför EU per momssats', () => {
    expect(reverseChargePurchaseInfo('4535')).toEqual({ region: 'eu', rate: 25 });
    expect(reverseChargePurchaseInfo('4531')).toEqual({ region: 'nonEu', rate: 25 });
    expect(reverseChargePurchaseInfo('4536')).toEqual({ region: 'eu', rate: 12 });
    expect(isReverseChargePurchaseAccount('6540')).toBe(false);
  });

  it('alla konton som används finns i kontoplanen', () => {
    const codes = new Set(DEFAULT_ACCOUNTS.map(a => a.code));
    for (const code of ['4531', '4532', '4533', '4535', '4536', '4537', '2614', '2624', '2634', '2645']) {
      expect(codes.has(code), code).toBe(true);
    }
  });
});

describe('momsrader för omvänd skattskyldighet', () => {
  it('lägger till 2645 i debet och 2614 i kredit, lika stora, så verifikationen går ihop', () => {
    const rows = [{ account: '4535', debet: 1000, kredit: 0 }, { account: '1930', debet: 0, kredit: 1000 }];
    const out = withReverseChargeRows(rows);
    expect(out.slice(2)).toEqual([
      { account: '2645', debet: 250, kredit: 0 },
      { account: '2614', debet: 0, kredit: 250 },
    ]);
    const debet = out.reduce((s, r) => s + r.debet, 0);
    const kredit = out.reduce((s, r) => s + r.kredit, 0);
    expect(debet).toBe(kredit);
  });

  it('räknar ören rätt och följer momssatsen som kontot anger', () => {
    const out = missingReverseChargeRows([{ account: '4536', debet: 833.33, kredit: 0 }]);
    expect(out).toEqual([{ account: '2645', debet: 100, kredit: 0 }, { account: '2624', debet: 0, kredit: 100 }]);
  });

  it('lägger inte till dem två gånger, och rör inte vanliga kostnader', () => {
    expect(withReverseChargeRows(ver().rows)).toEqual(ver().rows);
    const plain = [{ account: '6540', debet: 1000, kredit: 0 }, { account: '1930', debet: 0, kredit: 1000 }];
    expect(withReverseChargeRows(plain)).toBe(plain);
  });

  it('flera rader med samma sats slås ihop till ett par momsrader', () => {
    const out = missingReverseChargeRows([
      { account: '4535', debet: 400, kredit: 0 }, { account: '4535', debet: 600, kredit: 0 }, { account: '1930', debet: 0, kredit: 1000 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].debet).toBe(250);
  });
});

describe('momsdeklaration med omvänd skattskyldighet', () => {
  const period = { periodStart: '2026-07-01', periodEnd: '2026-09-30' };

  it('fyller ruta 21, 30 och 48, och ruta 49 påverkas inte när momsen är avdragsgill', () => {
    const calc = computeVatPeriod({ verifications: [ver()], ...period });
    expect(calc.reversePurchaseEu).toBe(1000);
    expect(calc.reversePurchaseNonEu).toBe(0);
    expect(calc.reverseVatByRate[25]).toBe(250);
    expect(calc.inputVat).toBe(250);
    expect(calc.netToPay).toBe(0);
    const r = roundedVatPeriod(calc);
    const value = (ruta) => vatRutaValue(VAT_RUTOR.find(x => x.ruta === ruta), r);
    expect(value('21')).toBe(1000);
    expect(value('22')).toBe(0);
    expect(value('30')).toBe(250);
    expect(value('48')).toBe(250);
    expect(value('49')).toBe(0);
  });

  it('tjänster från land utanför EU hamnar i ruta 22', () => {
    const v = ver({ rows: [
      { account: '4531', debet: 2000, kredit: 0 }, { account: '2645', debet: 500, kredit: 0 },
      { account: '2614', debet: 0, kredit: 500 }, { account: '1930', debet: 0, kredit: 2000 },
    ] });
    const r = roundedVatPeriod(computeVatPeriod({ verifications: [v], ...period }));
    expect(r.reversePurchaseNonEu).toBe(2000);
    expect(r.reversePurchaseEu).toBe(0);
  });

  it('blandas med vanlig moms: ruta 49 = utgående (10-12) + omvänd (30-32) minus ingående (48)', () => {
    const sale = { id: 's', date: '2026-08-01', status: 'booked', rows: [
      { account: '1510', debet: 12500, kredit: 0 }, { account: '3001', debet: 0, kredit: 10000 }, { account: '2611', debet: 0, kredit: 2500 },
    ] };
    const buy = { id: 'b', date: '2026-08-02', status: 'booked', rows: [
      { account: '5410', debet: 400, kredit: 0 }, { account: '2641', debet: 100, kredit: 0 }, { account: '1930', debet: 0, kredit: 500 },
    ] };
    const r = roundedVatPeriod(computeVatPeriod({ verifications: [sale, buy, ver()], ...period }));
    expect(r.outputVatTotal).toBe(2500);
    expect(r.reverseVatTotal).toBe(250);
    expect(r.inputVat).toBe(350); // 100 vanlig + 250 beräknad
    expect(r.netToPay).toBe(2400);
  });

  it('den avslutande momsverifikationen går ihop på kronan även vid avrundning', () => {
    const odd = ver({ rows: [
      { account: '4535', debet: 333.33, kredit: 0 }, { account: '2645', debet: 83.33, kredit: 0 },
      { account: '2614', debet: 0, kredit: 83.33 }, { account: '1930', debet: 0, kredit: 333.33 },
    ] });
    const r = roundedVatPeriod(computeVatPeriod({ verifications: [odd], ...period }));
    const debet = r.outputVatTotal + r.reverseVatTotal;
    const kredit = r.inputVat + Math.max(r.netToPay, 0);
    const debetAdj = debet + Math.max(-r.netToPay, 0);
    expect(debetAdj).toBe(kredit);
  });

  it('kräver momsraderna: ett inköp på 4535 utan 2645/2614 stoppar deklarationen', () => {
    const utan = ver({ rows: [{ account: '4535', debet: 1000, kredit: 0 }, { account: '1930', debet: 0, kredit: 1000 }] });
    const res = validateVatPeriod({ verifications: [utan], ...period });
    expect(res.canProceed).toBe(false);
    expect(res.errors[0].type).toBe('missing_reverse_vat');
    expect(res.errors[0].message).toContain('250.00');
    expect(validateVatPeriod({ verifications: [ver()], ...period }).errors).toHaveLength(0);
  });
});

describe('eSKD-filen med omvänd skattskyldighet', () => {
  it('skriver ruta 21, 22 och 30-32 med Skatteverkets taggar, i rutornas ordning', () => {
    const rounded = {
      underlagByRate: { 25: 0, 12: 0, 6: 0 }, outputVatByRate: { 25: 0, 12: 0, 6: 0 },
      reversePurchaseEu: 1000, reversePurchaseNonEu: 2000, reverseVatByRate: { 25: 750, 12: 0, 6: 0 },
      inputVat: 750, netToPay: 0,
    };
    const xml = generateVatDeclarationXml({ company: { orgNr: '556000-0175' }, year: 2026, quarter: 3, rounded });
    const order = ['<InkopTjanstAnnatEg>1000', '<InkopTjanstUtomEg>2000', '<MomsInkopUtgHog>750', '<MomsIngAvdr>750', '<MomsBetala>0'];
    let last = -1;
    for (const tag of order) {
      const at = xml.indexOf(tag);
      expect(at, tag).toBeGreaterThan(last);
      last = at;
    }
  });

  it('utan omvänd skattskyldighet ändras filen inte', () => {
    const rounded = { underlagByRate: { 25: 100000, 12: 0, 6: 0 }, outputVatByRate: { 25: 25000, 12: 0, 6: 0 }, inputVat: 1000, netToPay: 24000 };
    const xml = generateVatDeclarationXml({ company: { orgNr: '556000-0175' }, year: 2026, quarter: 3, rounded });
    expect(xml).not.toContain('InkopTjanst');
    expect(xml).not.toContain('MomsInkopUtg');
  });
});
