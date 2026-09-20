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
 */
export function invoiceBookingRows(rows, { revenueAccounts = {}, vatAccounts = {}, receivableAccount = '1510' } = {}) {
  const netByRate = {};
  const vatByRate = {};
  let gross = 0;
  (rows || []).forEach(r => {
    const rate = Number(r.vatRate) || 0;
    const net = invoiceLineNet(r);
    netByRate[rate] = (netByRate[rate] || 0) + net;
    vatByRate[rate] = (vatByRate[rate] || 0) + net * (rate / 100);
    gross += net * (1 + rate / 100);
  });

  const out = [signed(receivableAccount, gross, 'debet')];

  // Intäkter: ett konto per momssats, och satser utan eget konto på 3001 som förr.
  const revenue = new Map();
  Object.entries(netByRate).forEach(([rate, net]) => {
    const account = revenueAccounts[rate] || '3001';
    revenue.set(account, (revenue.get(account) || 0) + round2(net));
  });
  revenue.forEach((amount, account) => { if (round2(amount) !== 0) out.push(signed(account, amount, 'kredit')); });

  Object.entries(vatByRate).forEach(([rate, vat]) => {
    const account = vatAccounts[rate];
    if (account && round2(vat) !== 0) out.push(signed(account, vat, 'kredit'));
  });
  return out;
}
