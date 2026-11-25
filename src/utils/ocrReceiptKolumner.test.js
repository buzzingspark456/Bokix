import { it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt';
const top = 'ELGIGANTEN\nKvitto\nElgiganten Skellefteå\nVarugatan 6\n93176 Skellefteå\n';
const rest = '\nKund Kundsson\nKundvägen 1\n111 22 Stockholm\n+46700000000\nTake now\n26th May 2026\n220282\n25%\n899.00\nPlayStation 5 (PS5) DualSense trådlös kontroll\n(vit)\nTotalt inkl.\nmoms\n899.00\nCard\n899.00\nMoms\nBelopp\nMoms\nTotalt\n25%\n719.20\n179.80\n899.00\nDatum: 2026-05-26 Tid: 18:33:40 Korttyp:\nStreckkod MID: 1236629562 TID:\nP400Plus-803569782 PTID: 62053830\nb055ac6-2302039269 Typ:\nVAROR_TJÄNSTER Totalt: SEK 899,00';
const V = {
  'etikett, sedan nummer': 'Ordernummer:\n2302039269\n2026-05-26 18:34\nSMILLA',
  'datum först': '2026-05-26 18:34\nSMILLA\nOrdernummer:\n2302039269',
  'etikett, datum, nummer': 'Ordernummer:\n2026-05-26 18:34\nSMILLA\n2302039269',
  'kolumner efter varandra': 'Ordernummer:\n2026-05-26 18:34\n2302039269\nSMILLA',
  'nummer före etikett': '2302039269\nOrdernummer:\n2026-05-26 18:34\nSMILLA',
};
// Google läser Elgiganten-kvittot kolumnvis (2026-11-03): ordernumret och
// momstabellen hamnar i olika ordning, en cell per rad.
it.each(Object.entries(V))('%s', (_, v) => {
  const r = parseReceiptText(top + v + rest);
  expect(r.receiptNumber).toBe('2302039269');
  expect(r.amount).toBe(899);
  expect(r.vatAmount).toBe(179.8);
  expect(r.vatRate).toBe(25);
  expect(r.date).toBe('2026-05-26');
  expect(r.privateItem).toBe(true);
});
