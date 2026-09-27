/**
 * Periodisk sammanställning: försäljning utan svensk moms till företag i
 * andra EU-länder, per köparens momsregistreringsnummer. Lämnas till
 * Skatteverket (e-tjänst eller fil) senast den 25:e månaden efter perioden.
 *
 * Varor redovisas per månad, eller per kvartal om varuförsäljningen inte
 * överstiger 500 000 kr exklusive moms per kvartal. Tjänster redovisas per
 * kvartal. Tjänster som inte följer huvudregeln ingår inte, inte heller
 * försäljning till kunder utanför EU.
 *
 * Underlaget är kundfakturorna, eftersom köparens momsnummer bara finns där.
 * Raderna på 3108 (varor) och 3308 (tjänster) räknas, omräknade till kronor
 * med fakturans kurs. Filformatet följer Skatteverkets beskrivning av
 * "Lämna periodisk sammanställning med filöverföring" (SKV574008).
 */
import { invoiceLineNet } from './invoiceBooking';
import { t, dateLocale } from '../i18n';

export const EC_GOODS_ACCOUNT = '3108';
export const EC_SERVICES_ACCOUNT = '3308';
export const GOODS_QUARTER_LIMIT = 500000;

const pad = (n) => String(n).padStart(2, '0');

/** { start, end, code, label } för en månad (2026, 9) eller ett kvartal (2026, 'Q3'). */
export function ecPeriod(year, part) {
  const yy = String(year).slice(2);
  if (typeof part === 'string' && part.startsWith('Q')) {
    const q = Number(part.slice(1));
    const startMonth = (q - 1) * 3 + 1;
    const endDay = new Date(year, startMonth + 2, 0).getDate();
    return { start: `${year}-${pad(startMonth)}-01`, end: `${year}-${pad(startMonth + 2)}-${pad(endDay)}`, code: `${yy}-${q}`, label: t('ui.kvartal_ar', { q, year }), kind: 'quarter' };
  }
  const m = Number(part);
  const endDay = new Date(year, m, 0).getDate();
  const name = new Intl.DateTimeFormat(dateLocale(), { month: 'long' }).format(new Date(year, m - 1, 1));
  return { start: `${year}-${pad(m)}-01`, end: `${year}-${pad(m)}-${pad(endDay)}`, code: `${yy}${pad(m)}`, label: `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`, kind: 'month' };
}

/** Sista dag att lämna den elektroniskt: den 25:e månaden efter perioden. */
export function ecDeadline(period) {
  const end = new Date(`${period.end}T12:00:00`);
  const d = new Date(end.getFullYear(), end.getMonth() + 1, 25);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const normalizeVat = (v) => String(v || '').replace(/[\s.-]/g, '').toUpperCase();
const isBookedInvoice = (inv) => (inv.type || 'invoice') === 'invoice' && inv.status !== 'draft';
const fxOf = (inv) => (inv.currency && inv.currency !== 'SEK' && Number(inv.fxRate) > 0 ? Number(inv.fxRate) : 1);

/**
 * Raderna i sammanställningen för perioden: en rad per köpare
 * ({ vatNumber, name, goods, services }) i hela kronor, plus varningar.
 */
export function computeEcSalesList({ invoices = [], contacts = [], period }) {
  const byVat = new Map();
  const warnings = [];
  const contactById = new Map(contacts.map(c => [c.id, c]));
  for (const inv of invoices) {
    if (!isBookedInvoice(inv) || !inv.date || inv.date < period.start || inv.date > period.end) continue;
    const rows = (inv.rows || []).filter(r => [EC_GOODS_ACCOUNT, EC_SERVICES_ACCOUNT].includes(String(r.account)) && !(Number(r.vatRate) > 0));
    if (rows.length === 0) continue;
    const customer = contactById.get(inv.customerId);
    const vat = normalizeVat(customer?.vatNumber);
    if (!/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(vat) || vat.startsWith('SE')) {
      warnings.push(t('ui.faktura_har_forsaljning_till_eu_men_kunden_sakna', { v0: inv.invoiceNumber || inv.id, v1: customer?.name || 'okänd kund' }));
      continue;
    }
    if (inv.currency && inv.currency !== 'SEK' && !(Number(inv.fxRate) > 0)) {
      warnings.push(t('ui.faktura_ar_i_men_saknar_vaxelkurs_sa_beloppet_ra', { v0: inv.invoiceNumber || inv.id, currency: inv.currency }));
    }
    const fx = fxOf(inv);
    const entry = byVat.get(vat) || { vatNumber: vat, name: customer?.name || '', goods: 0, services: 0 };
    for (const r of rows) {
      const sek = invoiceLineNet(r) * fx;
      if (String(r.account) === EC_GOODS_ACCOUNT) entry.goods += sek;
      else entry.services += sek;
    }
    byVat.set(vat, entry);
  }
  const rows = [...byVat.values()]
    .map(e => ({ ...e, goods: Math.round(e.goods), services: Math.round(e.services) }))
    .filter(e => e.goods !== 0 || e.services !== 0)
    .sort((a, b) => a.vatNumber.localeCompare(b.vatNumber));
  const totalGoods = rows.reduce((s, r) => s + r.goods, 0);
  const totalServices = rows.reduce((s, r) => s + r.services, 0);
  if (period.kind === 'quarter' && totalGoods > GOODS_QUARTER_LIMIT) {
    warnings.push(t('ui.varuforsaljningen_till_eu_ar_kr_under_kvartalet', { v0: totalGoods.toLocaleString('sv-SE') }));
  }
  return { rows, totalGoods, totalServices, warnings };
}

/** Säljarens momsregistreringsnummer med 12 siffror, ur momsnumret eller org.numret. */
export function sellerVatNumber(company) {
  const fromVat = String(company?.vatNr || '').replace(/\D/g, '');
  if (fromVat.length === 12) return fromVat;
  const org = String(company?.orgNr || '').replace(/\D/g, '');
  return org.length === 10 ? `${org}01` : null;
}

/**
 * Filen till Skatteverket (SKV574008): semikolonseparerad text, första raden
 * SKV574008, andra raden uppgiftslämnaren, sedan en rad per köpare med
 * varor, trepartshandel (tom) och tjänster i hela kronor.
 */
export function generateEcSalesListFile({ company, period, list, contact = {} }) {
  const vat = sellerVatNumber(company);
  if (!vat) throw new Error(t('ui.foretaget_saknar_momsregistreringsnummer_eller_o'));
  const clean = (s, max) => String(s || '').replace(/[;\r\n]/g, ' ').trim().slice(0, max);
  const phone = String(contact.phone || '').replace(/[^\d+-]/g, '').slice(0, 17);
  const lines = [
    'SKV574008;',
    `${vat};${period.code};${clean(contact.name, 35)};${phone};${clean(contact.email, 50)}`,
    ...list.rows.map(r => `${r.vatNumber};${r.goods || ''};;${r.services || ''};`),
  ];
  return lines.join('\r\n') + '\r\n';
}
