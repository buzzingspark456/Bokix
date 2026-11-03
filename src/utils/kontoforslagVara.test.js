import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt';
import { buildReceiptPlan } from './receiptScan';
import { historyForSupplier, historyFromVerifications } from './receiptHistory';
import { isGroupAccount } from './accountGroups';

// Användarens riktiga kvitto 2026-11-03: en spelkontroll från Elgiganten fick
// gruppkontot 5400 som "Som tidigare". Butiken säger inte vad som köptes.
const ELGIGANTEN = (vara) => `ELGIGANTEN
Kvitto
Elgiganten Skellefteå
2026-05-26 18:34
Ordernummer: 2302039269
220282 25% 899.00
${vara}
Totalt inkl. moms 899.00
Moms Belopp Moms Totalt
25% 719.20 179.80 899.00`;

const plan = (parsed, hist) => {
  const step = buildReceiptPlan({ parsed, registryName: '', supplierName: parsed.supplier, amountSek: parsed.amount }, hist)
    .find(s => s.key === 'costAccount');
  return { ifyllt: step.found ? step.patch.costAccount : null, förslag: step.suggest?.code || null };
};

describe('kontot efter vad som köptes', () => {
  it('ett tv-spel ger inget förslag, eftersom det oftast är privat', () => {
    const r = parseReceiptText(ELGIGANTEN('PlayStation 5 (PS5) DualSense trådlös kontroll (vit)'));
    expect(r.accountGuessed).toBe(true);
    expect(plan(r)).toEqual({ ifyllt: null, förslag: null });
  });

  it('en dator blir 5410 Förbrukningsinventarier', () => {
    const r = parseReceiptText(ELGIGANTEN('Lenovo bärbar dator 15,6"'));
    expect(r.accountCode).toBe('5410');
    expect(plan(r).förslag).toBeNull();
  });

  it('batterier på Clas Ohlson blir 5460 Förbrukningsmaterial', () => {
    const r = parseReceiptText('Clas Ohlson\n2026-05-26\nBatterier AA 8-pack 89,00\nTotalt 89,00\nMoms 25% 17,80');
    expect(r.accountCode).toBe('5460');
    expect(plan(r).förslag).toBeNull();
  });

  it('kopieringspapper blir 6110 Kontorsmaterial', () => {
    const r = parseReceiptText('Clas Ohlson\n2026-05-26\nKopieringspapper A4 500 ark 79,00\nTotalt 79,00\nMoms 25% 15,80');
    expect(r.accountCode).toBe('6110');
    expect(plan(r).förslag).toBeNull();
  });

  it('utan känd vara får man välja bland butikens vanliga konton', () => {
    const r = parseReceiptText(ELGIGANTEN('Artikel 220282'));
    expect(r.accountChoices).not.toBeNull();
    expect(r.accountCode).toBe('5410');
  });

  it('varan går före förra kvittot från samma butik', () => {
    const r = parseReceiptText(ELGIGANTEN('Lenovo bärbar dator'));
    expect(plan(r, { costAccount: '6110', vatRate: 25 })).toEqual({ ifyllt: null, förslag: null });
  });

  it('matbutik med mat behåller företagets egen historik', () => {
    const r = parseReceiptText('ICA Nära\n2026-05-26\nMjölk 22,40\nTotalt 22,40\nMoms 12% 2,40');
    expect(plan(r, { costAccount: '7690', vatRate: 12 }).ifyllt).toBe('7690');
  });
});

describe('gruppkonton', () => {
  it('5400 är ett gruppkonto, 5410 och 4000 inte', () => {
    expect(isGroupAccount('5400')).toBe(true);
    expect(isGroupAccount('5410')).toBe(false);
    expect(isGroupAccount('4000')).toBe(false);
  });

  it('ett kvitto bokfört på gruppkontot blir aldrig "Som tidigare"', () => {
    const receipts = [{ id: 'a', supplier: 'Elgiganten', costAccount: '5400', date: '2026-10-03', vatRate: 25 }];
    expect(historyForSupplier(receipts, 'Elgiganten')).toBeNull();
    const vers = [{ status: 'booked', description: 'Elgiganten', date: '2026-10-03', rows: [{ account: '5400', debit: 719.2 }, { account: '2641', debit: 179.8 }, { account: '1930', credit: 899 }] }];
    expect(historyFromVerifications(vers, 'Elgiganten')).toBeNull();
  });

  it('ingen regel pekar på ett gruppkonto', async () => {
    const { ACCOUNT_KEYWORD_RULES, ITEM_ACCOUNT_RULES, KNOWN_SUPPLIERS } = await import('./accountCategories');
    const codes = [...ACCOUNT_KEYWORD_RULES, ...ITEM_ACCOUNT_RULES, ...KNOWN_SUPPLIERS].map(r => r.code || r.account).filter(Boolean);
    expect(codes.filter(isGroupAccount)).toEqual([]);
  });
});
