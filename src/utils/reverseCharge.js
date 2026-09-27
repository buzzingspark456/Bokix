import { REVERSE_PURCHASE_KINDS, REVERSE_VAT_KINDS } from './vatConfig';

// Omvänd skattskyldighet (se vatConfig.js). Den här filen är den enda platsen
// som vet hur momsraderna ser ut, så att alla vägar som bokför ett sådant
// inköp (verifikation, kvitto, faktura, enkelt läge) får samma, riktiga rader.

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const PURCHASE_ACCOUNT_INFO = new Map();
for (const [region, kind] of Object.entries(REVERSE_PURCHASE_KINDS)) {
  for (const [rate, code] of Object.entries(kind.accounts)) {
    PURCHASE_ACCOUNT_INFO.set(code, { region, rate: Number(rate) });
  }
}

const REVERSE_VAT_ACCOUNTS = new Set(Object.values(REVERSE_VAT_KINDS).flatMap(k => [k.input, ...Object.values(k.output)]));

/**
 * { region, rate } om kontot är ett inköpskonto för omvänd moms, annars null.
 * region är en nyckel i REVERSE_PURCHASE_KINDS: 'eu' och 'nonEu' (tjänster
 * från utlandet), 'euGoods', 'seGoods', 'seServices' eller 'import'.
 */
export function reverseChargePurchaseInfo(account) {
  return PURCHASE_ACCOUNT_INFO.get(String(account)) || null;
}

export function isReverseChargePurchaseAccount(account) {
  return PURCHASE_ACCOUNT_INFO.has(String(account));
}

/** Är kontot ett av momskontona för omvänd skattskyldighet eller import? */
export function isReverseVatAccount(account) {
  return REVERSE_VAT_ACCOUNTS.has(String(account));
}

/** Har verifikationens rader redan momsraderna för omvänd skattskyldighet? */
export function hasReverseVatRows(rows) {
  return (rows || []).some(r => isReverseVatAccount(r.account));
}

const amountOf = (r) => (Number(r.debet ?? r.debit) || 0) - (Number(r.kredit ?? r.credit) || 0);

/**
 * Vilka momsrader som saknas för inköpen med omvänd skattskyldighet i en
 * verifikation. Returnerar en lista med rader ({ account, debet, kredit }):
 * beräknad ingående moms (debet 2645 eller 2647) och utgående moms (kredit
 * 2614/2617/2615 med 12- och 6-procentskontona), lika stora, så att
 * verifikationen fortfarande går ihop. Tom lista om inget sådant inköp finns
 * eller om momsraderna redan är med.
 */
export function missingReverseChargeRows(rows) {
  if (hasReverseVatRows(rows)) return [];
  // Per momstyp (utlandet, Sverige, import) och sats, i den ordning de dyker upp.
  const groups = new Map();
  for (const r of rows || []) {
    const info = reverseChargePurchaseInfo(r.account);
    if (!info) continue;
    const vatKind = REVERSE_PURCHASE_KINDS[info.region].vat;
    const key = `${vatKind}:${info.rate}`;
    const g = groups.get(key) || { vatKind, rate: info.rate, net: 0 };
    g.net = round2(g.net + amountOf(r));
    groups.set(key, g);
  }
  const out = [];
  for (const { vatKind, rate, net } of groups.values()) {
    const vat = round2(Math.abs(net) * rate / 100);
    if (vat <= 0) continue;
    const accounts = REVERSE_VAT_KINDS[vatKind];
    // En retur (inköpet i kredit) vänder momsraderna också.
    const back = net < 0;
    out.push({ account: accounts.input, debet: back ? 0 : vat, kredit: back ? vat : 0 });
    out.push({ account: accounts.output[rate], debet: back ? vat : 0, kredit: back ? 0 : vat });
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

/**
 * Förklaringen som visas när ett inköpskonto med omvänd skattskyldighet är
 * valt: vad det betyder, vilka konton momsen bokförs på och vilka rutor den
 * syns i. info kommer från reverseChargePurchaseInfo.
 */
export function describeReverseCharge(info) {
  if (!info) return '';
  const kind = REVERSE_PURCHASE_KINDS[info.region];
  const vat = REVERSE_VAT_KINDS[kind.vat];
  const outputAccount = vat.output[info.rate];
  const outputRuta = vat.outputRuta[info.rate];
  if (info.region === 'import') {
    return `Import av varor: momsen betalas inte till säljaren eller Tullverket utan redovisas av dig i momsdeklarationen. Bokför beskattningsunderlaget (varuvärdet med tull och frakt) på det här kontot; momsen bokförs automatiskt på ${vat.input} och ${outputAccount} och syns i ruta ${kind.ruta}, ${outputRuta} och 48.`;
  }
  const what = {
    euGoods: 'Varor från ett annat EU-land',
    eu: 'Tjänst från ett annat EU-land',
    nonEu: 'Tjänst från ett land utanför EU',
    seGoods: 'Varor med omvänd skattskyldighet i Sverige',
    seServices: 'Tjänst med omvänd skattskyldighet i Sverige, till exempel byggtjänster',
  }[info.region];
  return `${what}: säljaren tar ingen svensk moms, så hela beloppet är kostnaden. Momsen ska redovisas av dig (omvänd skattskyldighet) och bokförs automatiskt på ${vat.input} och ${outputAccount}. Den syns i ruta ${kind.ruta}, ${outputRuta} och 48 i momsdeklarationen.`;
}
