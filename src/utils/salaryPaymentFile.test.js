import { describe, it, expect } from 'vitest';
import { buildSalaryPaymentFile } from './salaryPaymentFile.js';

const company = { name: 'Test AB', iban: 'SE4550000000058398257466', bic: 'ESSESESS' };
const run = { period: '2026-11', payDate: '2026-11-25' };
const row = (first, net, iban) => ({ row: { employeeSnapshot: { firstName: first, lastName: 'X' } }, computed: { net, iban, bic: 'ESSESESS' } });

describe('betalfilen för löner (pain.001)', () => {
  const { xml, nbOfTxs, ctrlSum } = buildSalaryPaymentFile({ company, run, computedRows: [row('Anna', 25000.5, 'SE1850000000058398257467'), row('Bo', 20000, 'SE8850000000058398257468')] });

  it('märks som löner med en samlad bokning', () => {
    expect(xml).toContain('<CtgyPurp><Cd>SALA</Cd></CtgyPurp>');
    expect(xml).toContain('<BtchBookg>true</BtchBookg>');
  });

  it('har elementen i den ordning pain.001.001.03 kräver i PmtInf', () => {
    const order = ['<PmtInfId>', '<PmtMtd>', '<BtchBookg>', '<NbOfTxs>', '<CtrlSum>', '<PmtTpInf>', '<ReqdExctnDt>', '<Dbtr>', '<DbtrAcct>', '<DbtrAgt>', '<ChrgBr>', '<CdtTrfTxInf>'];
    const pmtInf = xml.slice(xml.indexOf('<PmtInf>'));
    const positions = order.map(tag => pmtInf.indexOf(tag));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('summor, datum och mottagare stämmer', () => {
    expect(nbOfTxs).toBe(2);
    expect(ctrlSum).toBeCloseTo(45000.5);
    expect(xml).toContain('<ReqdExctnDt>2026-11-25</ReqdExctnDt>');
    expect(xml).toContain('<InstdAmt Ccy="SEK">25000.50</InstdAmt>');
    expect(xml).toContain('<IBAN>SE1850000000058398257467</IBAN>');
  });
});
