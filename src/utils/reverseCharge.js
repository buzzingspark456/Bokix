import {
  REVERSE_PURCHASE_ACCOUNTS, REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE, REVERSE_INPUT_VAT_ACCOUNT,
} from './vatConfig';

// Omvänd skattskyldighet för tjänster från utlandet (se vatConfig.js). Den här
// filen är den enda platsen som vet hur momsraderna ser ut, så att alla vägar
// som bokför ett sådant inköp (verifikation, kvitto, faktura, enkelt läge)
// får samma, riktiga rader.

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const PURCHASE_ACCOUNT_INFO = new Map();
for (const [region, byRate] of Object.entries(REVERSE_PURCHASE_ACCOUNTS)) {
  for (const [rate, code] of Object.entries(byRate)) PURCHASE_ACCOUNT_INFO.set(code, { region, rate: Number(rate) });
}

/** { region: 'eu' | 'nonEu', rate } om kontot är ett inköpskonto för omvänd moms, annars null. */
export function reverseChargePurchaseInfo(account) {
  return PURCHASE_ACCOUNT_INFO.get(String(account)) || null;
}

export function isReverseChargePurchaseAccount(account) {
  return PURCHASE_ACCOUNT_INFO.has(String(account));
}

const isReverseVatAccount = (code) => (
  String(code) === REVERSE_INPUT_VAT_ACCOUNT || Object.values(REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE).includes(String(code))
);

/** Har verifikationens rader redan momsraderna för omvänd skattskyldighet? */
export function hasReverseVatRows(rows) {
  return (rows || []).some(r => isReverseVatAccount(r.account));
}

const amountOf = (r) => (Number(r.debet ?? r.debit) || 0) - (Number(r.kredit ?? r.credit) || 0);

/**
 * Vilka momsrader som saknas för inköpen av tjänster från utlandet i en
 * verifikation. Returnerar en lista med rader ({ account, debet, kredit }):
 * beräknad ingående moms (debet 2645) och utgående moms (kredit 2614/2624/
 * 2634), lika stora, så att verifikationen fortfarande går ihop. Tom lista om
 * inget inköp av det slaget finns eller om momsraderna redan är med.
 */
export function missingReverseChargeRows(rows) {
  if (hasReverseVatRows(rows)) return [];
  const byRate = new Map();
  for (const r of rows || []) {
    const info = reverseChargePurchaseInfo(r.account);
    if (!info) continue;
    byRate.set(info.rate, round2((byRate.get(info.rate) || 0) + amountOf(r)));
  }
  const out = [];
  for (const [rate, net] of byRate) {
    if (net <= 0) continue;
    const vat = round2(net * rate / 100);
    if (vat <= 0) continue;
    out.push({ account: REVERSE_INPUT_VAT_ACCOUNT, debet: vat, kredit: 0 });
    out.push({ account: REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE[rate], debet: 0, kredit: vat });
  }
  return out;
}

/**
 * Raderna med momsraderna för omvänd skattskyldighet tillagda direkt efter
 * inköpsraden. Rör inget annat, och lägger inte till dem två gånger.
 */
export function withReverseChargeRows(rows) {
  const extra = missingReverseChargeRows(rows);
  if (extra.length === 0) return rows;
  return [...rows, ...extra];
}
