/**
 * Kvitton i utländsk valuta. Bokföringen sker i kronor, men det ursprungliga
 * beloppet, valutan och kursen sparas på kvittot så att omräkningen går att
 * följa i efterhand. Tre värden hänger ihop: beloppet i valutan, kursen
 * (kronor per enhet) och beloppet i kronor. Ändrar man ett av dem räknas det
 * som beror på det om, och ändrar man kronbeloppet räknas kursen om, så att
 * man kan ange det belopp banken faktiskt drog.
 */

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'NOK', 'DKK', 'CHF', 'JPY', 'CNY', 'CAD', 'AUD'];

const round2 = (v) => Math.round(v * 100) / 100;

/** Tal ur ett textfält, med komma eller punkt och mellanslag som tusentalsavgränsare. NaN om det inte går. */
export function parseNumber(value) {
  if (value === '' || value == null) return NaN;
  const n = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Kronor för ett belopp i valuta och en kurs, avrundat till hela ören. NaN om något saknas. */
export function sekFrom(amount, rate) {
  const a = typeof amount === 'number' ? amount : parseNumber(amount);
  const r = typeof rate === 'number' ? rate : parseNumber(rate);
  if (!(a > 0) || !(r > 0)) return NaN;
  return round2(a * r);
}

/** Kursen som ger ett visst kronbelopp för ett belopp i valuta, med sex decimaler. NaN om något saknas. */
export function impliedRate(sek, amount) {
  const s = typeof sek === 'number' ? sek : parseNumber(sek);
  const a = typeof amount === 'number' ? amount : parseNumber(amount);
  if (!(s > 0) || !(a > 0)) return NaN;
  return Math.round((s / a) * 1e6) / 1e6;
}

/** En kurs som text i ett fält: högst sex decimaler, utan onödiga nollor, med komma. */
export function rateToInput(rate) {
  const r = typeof rate === 'number' ? rate : parseNumber(rate);
  if (!(r > 0)) return '';
  return String(Math.round(r * 1e6) / 1e6).replace('.', ',');
}

/** Ett belopp i valuta som text med två decimaler och komma ("25,00"). */
export function amountToInput(value) {
  const n = typeof value === 'number' ? value : parseNumber(value);
  return Number.isFinite(n) && n >= 0 ? round2(n).toFixed(2).replace('.', ',') : '';
}

const fmtAmount = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

/** "25,00 USD × kurs 10,4123", till en verifikationsrad. Tom sträng om något saknas. */
export function describeForeign(fx) {
  if (!fx || !(fx.amount > 0) || !(fx.rate > 0) || !fx.code) return '';
  const rate = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(fx.rate);
  return `${fmtAmount(fx.amount)} ${fx.code} × kurs ${rate}`;
}

/**
 * Formulärets valutaruta som ett sparbart objekt, eller undefined om den
 * inte är komplett (belopp och kurs måste vara större än noll).
 */
export function foreignForSave(fx) {
  if (!fx) return undefined;
  const amount = parseNumber(fx.amount);
  const rate = parseNumber(fx.rate);
  if (!(amount > 0) || !(rate > 0) || !fx.code) return undefined;
  return { code: fx.code, amount: round2(amount), rate: Math.round(rate * 1e6) / 1e6, rateDate: fx.rateDate || undefined, source: fx.source === 'ecb' ? 'ecb' : 'manual' };
}
