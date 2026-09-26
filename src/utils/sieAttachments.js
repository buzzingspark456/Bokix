/**
 * Underlag till SIE-importerad bokföring. En SIE-fil har bokföringen men
 * inga underlag; många program exporterar underlagen som lösa filer med
 * verifikatnumret i filnamnet. Här kopplas de ihop — enbart på filnamnet,
 * ingen AI-tolkning, och bara inom ETT räkenskapsår eftersom numreringen
 * börjar om varje år i det gamla programmet.
 *
 * Matchningen sker mot verifikatnumret i det GAMLA programmet
 * (verifikationens `series` + `sieNumber`, sparade vid SIE-importen), inte
 * mot numret verifikationen fått i Bokix.
 */
import { fiscalYearBounds } from './reportCalculations';

const CAMERA_PREFIXES = new Set(['IMG', 'DSC', 'PXL', 'PIC', 'SCN', 'MVI', 'VID']);

export const ATTACHMENT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Verifikatnumret ur ett filnamn. Klarar bl.a. "A31_abc123.pdf", "A31.pdf",
 * "A-31 kvitto.pdf", "2024-A-31.pdf" och "a 31.PDF". Returnerar
 * `{ series, number, year }` (year bara om filnamnet börjar med ett årtal),
 * eller null.
 */
export function parseAttachmentFileName(fileName) {
  const base = String(fileName || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '').trim();
  const m = /^(?:(\d{4})[-_ ]+)?([A-Za-zÅÄÖåäö]{1,3})[-_ ]?0*(\d{1,6})(?![0-9])/.exec(base);
  // Kameror och skannrar namnger filer som IMG_2024.jpg — inget verifikat.
  if (!m || CAMERA_PREFIXES.has(m[2].toUpperCase())) return null;
  return { year: m[1] ? Number(m[1]) : null, series: m[2].toUpperCase(), number: Number(m[3]) };
}

export function fileExtension(name) {
  return (String(name || '').split('.').pop() || '').toLowerCase();
}

/** Systemfiler som följer med när man väljer en hel mapp. */
export function isJunkFile(name) {
  const base = String(name || '').split(/[\\/]/).pop();
  return base.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(base);
}

/** Verifikationer som kommit in via SIE-importen och har kvar sitt gamla nummer. */
export function sieImportedVerifications(verifications) {
  return verifications.filter(v => String(v.source || '').startsWith('sie_import') && v.sieNumber !== undefined && v.sieNumber !== '');
}

/**
 * Räkenskapsåret en importerad verifikation hör till. Sparas vid importen
 * (`sieFiscalYearStart`, från filens #RAR); äldre importer saknar det och
 * räknas då fram ur företagets inställda räkenskapsårsstart.
 */
export function verificationFiscalYear(v, companyFiscalYear) {
  if (v.sieFiscalYearStart) {
    return { start: v.sieFiscalYearStart, end: v.sieFiscalYearEnd || null };
  }
  const { start, end } = fiscalYearBounds(companyFiscalYear, new Date(`${v.date}T12:00:00`));
  return { start: toIso(start), end: toIso(end) };
}

export function fiscalYearLabel(start, end) {
  const y1 = start.slice(0, 4);
  const y2 = end ? end.slice(0, 4) : y1;
  return y1 === y2 ? y1 : `${y1}/${y2}`;
}

/** Räkenskapsåren som har SIE-importerade verifikationer, nyast först. */
export function importedFiscalYears(verifications, companyFiscalYear) {
  const years = new Map();
  for (const v of sieImportedVerifications(verifications)) {
    if (!v.date) continue;
    const fy = verificationFiscalYear(v, companyFiscalYear);
    const cur = years.get(fy.start) || { start: fy.start, end: fy.end, count: 0 };
    cur.count += 1;
    if (!cur.end && fy.end) cur.end = fy.end;
    years.set(fy.start, cur);
  }
  return [...years.values()]
    .map(y => ({ ...y, label: fiscalYearLabel(y.start, y.end) }))
    .sort((a, b) => b.start.localeCompare(a.start));
}

const alreadyAttached = (v, name) =>
  v.attachmentName === name || (v.extraAttachments || []).some(a => a.name === name);

/**
 * Kopplar filer till verifikationer i valt räkenskapsår. Returnerar en rad
 * per fil med `status`:
 *   'match'       kopplas till `verification`
 *   'attached'    samma filnamn sitter redan på verifikationen
 *   'no-number'   filnamnet innehåller inget verifikatnummer
 *   'not-found'   inget verifikat med det numret det året
 *   'other-year'  filnamnet börjar med ett årtal som inte hör till valt år
 *   'ambiguous'   flera verifikat med samma nummer (samma fil importerad två gånger)
 *   'unsupported' filtypen går inte att visa som underlag
 */
export function matchAttachments(files, verifications, { fiscalYearStart, companyFiscalYear }) {
  const inYear = sieImportedVerifications(verifications)
    .filter(v => v.date && verificationFiscalYear(v, companyFiscalYear).start === fiscalYearStart);
  const byKey = new Map();
  for (const v of inYear) {
    const key = `${String(v.series || 'A').toUpperCase()}${Number(v.sieNumber)}`;
    byKey.set(key, [...(byKey.get(key) || []), v]);
  }
  const years = inYear.map(v => Number(v.date.slice(0, 4)));
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);

  return files
    .filter(f => !isJunkFile(f.name))
    .map(file => {
      const base = { file, name: file.name };
      if (!ATTACHMENT_EXTENSIONS.includes(fileExtension(file.name))) return { ...base, status: 'unsupported' };
      const parsed = parseAttachmentFileName(file.name);
      if (!parsed) return { ...base, status: 'no-number' };
      const ref = `${parsed.series}${parsed.number}`;
      if (parsed.year && (parsed.year < firstYear || parsed.year > lastYear)) return { ...base, ref, status: 'other-year' };
      const hits = byKey.get(ref) || [];
      if (hits.length === 0) return { ...base, ref, status: 'not-found' };
      if (hits.length > 1) return { ...base, ref, status: 'ambiguous' };
      const verification = hits[0];
      if (alreadyAttached(verification, file.name)) return { ...base, ref, verification, status: 'attached' };
      return { ...base, ref, verification, status: 'match' };
    })
    // Verifikatordning (A31 före A-32 kvitto), sedan filnamn — så första
    // filen per verifikat, som blir huvudunderlaget, är den förväntade.
    .sort((a, b) => {
      const pa = parseAttachmentFileName(a.name);
      const pb = parseAttachmentFileName(b.name);
      if (pa && pb && (pa.series !== pb.series || pa.number !== pb.number)) {
        return pa.series.localeCompare(pb.series) || pa.number - pb.number;
      }
      if (!pa !== !pb) return pa ? -1 : 1;
      return a.name.localeCompare(b.name, 'sv', { numeric: true });
    });
}

/**
 * Uppladdade filer → ändringar per verifikation. Första filen blir
 * huvudunderlaget om verifikationen saknar ett; resten läggs som extra
 * underlag, så ingen sida av ett flersidigt kvitto går förlorad.
 */
export function buildAttachmentUpdates(uploaded, verifications) {
  const byId = new Map(verifications.map(v => [v.id, v]));
  const updates = new Map();
  for (const { verificationId, url, name, type } of uploaded) {
    const current = updates.get(verificationId) || (() => {
      const v = byId.get(verificationId) || {};
      return { id: verificationId, attachmentUrl: v.attachmentUrl || null, attachmentName: v.attachmentName || null, attachmentType: v.attachmentType || null, extraAttachments: [...(v.extraAttachments || [])] };
    })();
    if (!current.attachmentUrl) Object.assign(current, { attachmentUrl: url, attachmentName: name, attachmentType: type });
    else current.extraAttachments.push({ url, name, type });
    updates.set(verificationId, current);
  }
  return [...updates.values()];
}
