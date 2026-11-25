import { it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt';
import { buildReceiptPlan } from './receiptScan';
const head = 'JACKS IMPORT\n& VARUHUS\nTELNR: 0910-373 75\nKVITTO#855279 23/09/26 13:30\nORG.NR: 5563363893\n*KVITTO*\n1x 15.00 *15.00 A\nFOTORAM SV 13X18CM\n';
const V = {
  'som på kvittot': 'SUMMA: *15.00\nMOMSBRUTTO1 *15.00\nMOMS 1 *3.00\nTOTAL MOMS *3.00\nKONTANT *15.00',
  'etiketter och värden var för sig': 'SUMMA:\n*15.00\nMOMSBRUTTO1\n*15.00\nMOMS 1\n*3.00\nTOTAL MOMS\n*3.00\nKONTANT\n*15.00',
  'kolumn: etiketter först': 'SUMMA:\nMOMSBRUTTO1\nMOMS 1\nTOTAL MOMS\nKONTANT\n*15.00\n*15.00\n*3.00\n*3.00\n*15.00',
  'utan stjärnor, komma': 'Summa 15,00\nMomsbrutto 15,00\nMoms 3,00\nTotal moms 3,00\nKontant 15,00',
  'moms 3 kr hela kronor': 'Totalt 15\nMoms 25% 3\nKontant 15',
  'moms före summa': 'MOMS 1 *3.00\nTOTAL MOMS *3.00\nSUMMA: *15.00\nKONTANT *15.00',
};
// Jacks Import, 15 kr med 3 kr moms (2026-11-03): som Google kan ställa upp texten.
// 'MOMS 1' på egen rad gav momsen 1 kr och beskedet att momsen inte stämmer.
it.each(Object.entries(V))('%s', (_, v) => {
  const r = parseReceiptText(head + v);
  expect(r.amount).toBe(15);
  expect(r.vatAmount).toBe(3);
  expect(r.vatRate).toBe(25);
  expect(r.vatVerified).toBe(true);
  const moms = buildReceiptPlan({ parsed: r, registryName: '', supplierName: r.supplier, amountSek: r.amount }, null).find(s => s.key === 'vatRate');
  expect(moms.state).toBe('found');
});
