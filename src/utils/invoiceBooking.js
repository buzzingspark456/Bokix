/**
 * Bokföringsrader för en kundfaktura.
 *
 * Fordran (1510) bokas till fakturans totalbelopp, intäkterna per momssats
 * och utgående moms per momssats, alla med ören. Bokföringen ska ange
 * beloppen inklusive ören, så ingenting avrundas till hela kronor här. Totalen
 * räknas som summan av raderna med moms, exakt som fakturan visar den, och en
 * eventuell öresskillnad mot de avrundade intäkts- och momsraderna bokas av
 * appens avrundningsskydd på 3740 (se withRoundingBalance).
 *
 * Radrabatten (`discount`, i procent) räknas med. Den fanns tidigare bara på
 * fakturan som kunden ser, så en rabatterad faktura bokades till fullt pris.
 * En kreditfaktura (negativa belopp) bokas åt andra hållet: fordran på kredit
 * och intäkt och moms på debet.
 */

import { EXEMPT_SALES_RUTA_BY_ACCOUNT } from './vatConfig';

const round2 = (v) => Math.round(v * 100) / 100;

/** En rad med ett belopp: positivt på ursprunglig sida, negativt på motsatt. */
function signed(account, amount, positiveSide) {
  const a = round2(amount);
  const positive = positiveSide === 'debet' ? { debet: a, kredit: 0 } : { debet: 0, kredit: a };
  const negative = positiveSide === 'debet' ? { debet: 0, kredit: -a } : { debet: -a, kredit: 0 };
  return { account, ...(a >= 0 ? positive : negative) };
}

export function invoiceLineNet(row) {
  const qty = Number(row?.qty) || 0;
  const price = Number(row?.unitPrice) || 0;
  const discount = Number(row?.discount) || 0;
  return qty * price * (1 - discount / 100);
}

/**
 * @param rows fakturaraderna ({ qty, unitPrice, vatRate, discount })
 * @param revenueAccounts intäktskonto per momssats, t.ex. { 25: '3001' }
 * @param vatAccounts utgående momskonto per momssats, t.ex. { 25: '2611', 0: null }
 * @param rate växelkurs för en faktura i annan valuta (SEK per enhet); 1 för SEK.
 *   Bokföringen ska vara i kronor, så varje belopp räknas om med kursen.
 * @param rotRutDeduction ROT/RUT-avdraget i kronor. Den delen av fordran är på
 *   Skatteverket, inte på kunden, och bokas på 1513 (Kundfordringar – delad
 *   faktura) i stället för 1510.
 */
export function invoiceBookingRows(rows, { revenueAccounts = {}, vatAccounts = {}, receivableAccount = '1510', rate = 1, rotRutDeduction = 0 } = {}) {
  const fx = Number(rate) > 0 ? Number(rate) : 1;
  const vatByRate = {};
  let gross = 0;
  // Intäkter per konto. En rad utan moms behåller sitt eget konto när det är
  // ett konto för försäljning utan svensk moms (3108, 3308, 3105, 3305, 3231,
  // 3004), så att den hamnar i rätt ruta i momsdeklarationen (35-42). Övriga
  // rader bokas per momssats som förr.
  const revenue = new Map();
  (rows || []).forEach(r => {
    const rate = Number(r.vatRate) || 0;
    const net = invoiceLineNet(r) * fx;
    const account = rate === 0 && EXEMPT_SALES_RUTA_BY_ACCOUNT[String(r.account || '')]
      ? String(r.account)
      : (revenueAccounts[rate] || '3001');
    revenue.set(account, (revenue.get(account) || 0) + net);
    vatByRate[rate] = (vatByRate[rate] || 0) + net * (rate / 100);
    gross += net * (1 + rate / 100);
  });

  const split = round2(Number(rotRutDeduction) || 0);
  const out = split !== 0
    ? [signed(receivableAccount, gross - split, 'debet'), signed('1513', split, 'debet')]
    : [signed(receivableAccount, gross, 'debet')];

  revenue.forEach((amount, account) => { if (round2(amount) !== 0) out.push(signed(account, amount, 'kredit')); });

  Object.entries(vatByRate).forEach(([rate, vat]) => {
    const account = vatAccounts[rate];
    if (account && round2(vat) !== 0) out.push(signed(account, vat, 'kredit'));
  });
  return out;
}
