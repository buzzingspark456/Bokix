/**
 * SRU-filer för Inkomstdeklaration 2 (INFO.SRU + BLANKETTER.SRU), enligt
 * Skatteverkets tekniska beskrivning för filöverföring (tidigare SKV 269)
 * och fältlistorna i "Ändringar från och med 2025P4":
 *
 * INFO.SRU: #DATABESKRIVNING med #PRODUKT och #FILNAMN, och #MEDIELEV med
 * #ORGNR, #NAMN, #POSTNR och #POSTORT, som alla är obligatoriska. Saknas
 * någon avvisas HELA leveransen, därför kontrollerar sruMissingFields det
 * innan något laddas ner.
 *
 * BLANKETTER.SRU: tre blankettblock, vart och ett med
 * #BLANKETT <block>-<ÅÅÅÅPn> och #IDENTITET <16+orgnr> <ÅÅÅÅMMDD> <TTMMSS>
 * (framställningsdatum och -tid, inte periodens slut):
 *   INK2   räkenskapsårets början och slut (7011/7012)
 *   INK2R  balans- och resultaträkningen (7201–7370, 7410–7550)
 *   INK2S  bara årets resultat (7650/7750). Resten av de skattemässiga
 *          justeringarna fyller användaren i hos Skatteverket.
 *
 * Fältkoderna i INK2R är kontrollerade mot INK2R_SKV2002-33-01-24-04.xls.
 * Belopp är heltal. Numeriskt_A får vara negativt, Numeriskt_B inte; där
 * en rad har en plus- och en minuskod (t.ex. 3.2) skrivs beloppet alltid
 * positivt på den kod som tecknet pekar ut.
 */
import { createZip } from './zipStore';

const pad = (n, len = 2) => String(n).padStart(len, '0');
const ymd = (iso) => String(iso || '').replace(/-/g, '');

/** Beskattningsperiod enligt räkenskapsårets slutmånad: P1 jan–apr,
 * P2 maj–jun, P3 jul–aug, P4 sep–dec. "2026-12-31" → "2026P4". */
export function sruPeriod(endISO) {
  const [y, m] = String(endISO).split('-').map(Number);
  const p = m <= 4 ? 1 : m <= 6 ? 2 : m <= 8 ? 3 : 4;
  return `${y}P${p}`;
}

/** Organisationsnummer som tolv siffror, "16" före för juridiska personer. */
export function sruOrgId(orgNr) {
  const digits = String(orgNr || '').replace(/\D/g, '');
  if (digits.length === 12) return digits;
  if (digits.length === 10) return `16${digits}`;
  return '';
}

/** Uppgifter som saknas i företagsinställningarna för att filen ska tas emot. */
export function sruMissingFields(company) {
  const missing = [];
  if (!sruOrgId(company?.orgNr)) missing.push('organisationsnummer');
  if (!String(company?.name || '').trim()) missing.push('företagsnamn');
  if (String(company?.postalCode || '').replace(/\D/g, '').length !== 5) missing.push('postnummer');
  if (!String(company?.city || '').trim()) missing.push('ort');
  return missing;
}

// SRU-filer är radorienterade; en radbrytning i ett namn skulle bryta posten.
const clean = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

/**
 * @param company  { orgNr, name, address, postalCode, city }
 * @param ink2r    computeInk2r-resultatet (balansräkningen)
 * @param resultRows computeInk2rResultat().rows (resultaträkningen)
 * @param period   { start: 'ÅÅÅÅ-MM-DD', end: 'ÅÅÅÅ-MM-DD' } eller bara slutdatumet
 * @param now      framställningstidpunkt (för tester)
 */
export function generateInk2rSru(company, ink2r, resultRows, period, now = new Date()) {
  const end = typeof period === 'string' ? period : period?.end;
  const start = typeof period === 'string' || !period?.start
    ? (() => { const d = new Date(`${end}T12:00:00`); d.setFullYear(d.getFullYear() - 1); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })()
    : period.start;
  const orgId = sruOrgId(company?.orgNr);
  const name = clean(company?.name) || 'Okänt företag';
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const sruP = sruPeriod(end);
  const L = '\r\n';

  let infoSru = '';
  infoSru += `#DATABESKRIVNING_START${L}`;
  infoSru += `#PRODUKT SRU${L}`;
  infoSru += `#SKAPAD ${date} ${time}${L}`;
  infoSru += `#PROGRAM Bokix${L}`;
  infoSru += `#FILNAMN BLANKETTER.SRU${L}`;
  infoSru += `#DATABESKRIVNING_SLUT${L}`;
  infoSru += `#MEDIELEV_START${L}`;
  infoSru += `#ORGNR ${orgId}${L}`;
  infoSru += `#NAMN ${name}${L}`;
  if (clean(company?.address)) infoSru += `#ADRESS ${clean(company.address)}${L}`;
  infoSru += `#POSTNR ${String(company?.postalCode || '').replace(/\D/g, '')}${L}`;
  infoSru += `#POSTORT ${clean(company?.city)}${L}`;
  infoSru += `#MEDIELEV_SLUT${L}`;

  const block = (form, uppgifter) => {
    let s = `#BLANKETT ${form}-${sruP}${L}`;
    s += `#IDENTITET ${orgId} ${date} ${time}${L}`;
    s += `#NAMN ${name}${L}`;
    for (const [code, value] of uppgifter) s += `#UPPGIFT ${code} ${value}${L}`;
    s += `#BLANKETTSLUT${L}`;
    return s;
  };
  const period7011 = [['7011', ymd(start)], ['7012', ymd(end)]];

  const amountRows = [...(ink2r?.rows || []), ...(resultRows || [])]
    .filter(r => r.fieldCode && Math.round(r.amount) !== 0)
    .map(r => [r.fieldCode, Math.round(r.fieldCodePlus || r.fieldCodeMinus ? Math.abs(r.amount) : r.amount)]);

  const result = (resultRows || []).find(r => r.row === '3.26' || r.row === '3.27');
  const ink2s = result ? [[result.row === '3.26' ? '7650' : '7750', Math.round(Math.abs(result.amount))]] : [];

  let blankettSru = '';
  blankettSru += block('INK2', period7011);
  blankettSru += block('INK2R', [...period7011, ...amountRows]);
  blankettSru += block('INK2S', [...period7011, ...ink2s]);
  blankettSru += `#FIL_SLUT${L}`;

  return { infoSru, blankettSru };
}

// Bugkritiskt: `new Blob([sträng], {type: '...charset=windows-1252'})`
// kodar INTE själva bytesen som windows-1252 bara för att `type` säger
// det — Blob-konstruktorn kodar alltid JS-strängar som UTF-8. Skatteverket
// läser SRU-filer som ISO 8859-1, som delar kodpunkter med windows-1252
// för allt som kan stå i ett företagsnamn. Tecken utanför Latin-1 blir "?"
// hellre än att tyst korrumpera resten av filen.
export function encodeWindows1252(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i] = code <= 0xFF ? code : 0x3F;
  }
  return bytes;
}

/** Laddar ner INFO.SRU och BLANKETTER.SRU i EN zip-fil. Två nedladdningar i
 * rad stoppas ofta av webbläsaren; packa upp och ladda upp båda filerna
 * hos Skatteverket. */
export function downloadInk2rSru(company, ink2r, resultRows, period) {
  const { infoSru, blankettSru } = generateInk2rSru(company, ink2r, resultRows, period);
  const end = typeof period === 'string' ? period : period?.end;
  const zip = createZip([
    { name: 'INFO.SRU', data: encodeWindows1252(infoSru) },
    { name: 'BLANKETTER.SRU', data: encodeWindows1252(blankettSru) },
  ]);
  const blob = new Blob([zip], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `INK2-SRU-${String(end || '').slice(0, 4)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
