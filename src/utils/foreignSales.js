// Försäljning till kunder utomlands: vilken moms, vilket konto och vilken text
// fakturan ska ha. Kundtypen sätts på kunden (Contacts.jsx).
//
//   EU-företag med momsregistreringsnummer: ingen svensk moms. Tjänster
//     bokförs på 3308 (ruta 39), varor på 3108 (ruta 35). Fakturan ska ha
//     båda parters momsregistreringsnummer och en hänvisning till omvänd
//     betalningsskyldighet, respektive till undantaget för varor inom EU.
//   Företag utanför EU: ingen svensk moms. Tjänster bokförs på 3305
//     (ruta 40), varor på 3105 (ruta 36, export).
//   EU-företag utan momsregistreringsnummer behandlas som en svensk kund,
//     med svensk moms (kundformuläret varnar för det).

const SERVICES = { eu: '3308', nonEu: '3305' };
const GOODS = { eu: '3108', nonEu: '3105' };

/** 'eu' | 'nonEu' | null — om fakturor till kunden ska vara utan svensk moms. */
export function foreignSaleRegion(customer) {
  if (!customer) return null;
  if (customer.customerType === 'eu_company' && String(customer.vatNumber || '').trim()) return 'eu';
  if (customer.customerType === 'non_eu_company') return 'nonEu';
  return null;
}

/** Konton för försäljning utan svensk moms till utlandet. */
export const FOREIGN_SALES_ACCOUNTS = new Set([...Object.values(SERVICES), ...Object.values(GOODS)]);

/** Kontot för en momsfri rad till kunden: radens eget om det redan är ett
 * utlandskonto (varor eller tjänster), annars tjänstekontot för regionen. */
export function foreignSaleAccount(region, rowAccount) {
  if (!region) return null;
  const own = String(rowAccount || '');
  if (own === SERVICES[region] || own === GOODS[region]) return own;
  return SERVICES[region];
}

/**
 * Raderna anpassade till kunden: 0 % moms och utlandskonto för en kund
 * utomlands, och tillbaka till 25 % och 3001 om kunden byts till en svensk
 * kund (bara rader som står på ett utlandskonto rörs då).
 */
export function rowsForCustomer(rows, customer) {
  const region = foreignSaleRegion(customer);
  return (rows || []).map(r => {
    if (region) return { ...r, vatRate: 0, account: foreignSaleAccount(region, r.account) };
    if (FOREIGN_SALES_ACCOUNTS.has(String(r.account))) return { ...r, vatRate: 25, account: '3001' };
    return r;
  });
}

/**
 * Texten fakturan ska ha när den saknar svensk moms för att kunden finns
 * utomlands, eller null. Varor och tjänster på samma faktura får båda texterna.
 */
export function foreignSaleNote(customer, rows) {
  const region = foreignSaleRegion(customer);
  if (!region) return null;
  // En faktura med svensk moms på någon rad (t.ex. en äldre) får ingen sådan text.
  if ((rows || []).some(r => Number(r.vatRate) > 0)) return null;
  const accounts = new Set((rows || []).map(r => String(r.account || '')));
  const goods = accounts.has(GOODS[region]);
  const services = accounts.has(SERVICES[region]) || !goods;
  const parts = [];
  if (region === 'eu') {
    if (services) parts.push('Omvänd betalningsskyldighet / Reverse charge (artikel 196, direktiv 2006/112/EG).');
    if (goods) parts.push('Unionsintern varuleverans, undantagen från moms (artikel 138, direktiv 2006/112/EG).');
  } else {
    if (services) parts.push('Tjänsten omsätts utanför Sverige. Ingen svensk moms / No Swedish VAT.');
    if (goods) parts.push('Export utanför EU, undantagen från moms / Export outside the EU, exempt from VAT.');
  }
  return parts.join(' ');
}
