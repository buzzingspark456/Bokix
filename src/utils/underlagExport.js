// Ladda ner alla underlag (2026-11-13). En zip-fil per räkenskapsår (eller
// hela bokföringen) med varje verifikations underlag, namngivet efter
// verifikationen ("A031.pdf"), och en förteckning i Excel som visar vilken
// fil som hör till vilken verifikation och vilka som saknar underlag. Det är
// vad en revisor behöver, och vad den som flyttar till ett annat program
// behöver ta med sig (SIE-filen innehåller bara siffrorna).
import { hasUnderlag } from './reportLedgers';
import { createZip } from './zipStore';
import { buildWorkbook } from './excelExport';
import { getSignedStorageUrl } from './signedUrls';

const isBooked = (v) => (v?.status || 'booked') !== 'draft';
const day = (s) => String(s || '').slice(0, 10);

function extOf(name, type) {
  const fromName = /\.([a-z0-9]{1,5})(?:\?|$)/i.exec(String(name || ''));
  if (fromName) return fromName[1].toLowerCase();
  if (/pdf/i.test(type || '')) return 'pdf';
  if (/png/i.test(type || '')) return 'png';
  if (/webp/i.test(type || '')) return 'webp';
  return 'jpg';
}

/** Filerna som hör till verifikationerna i intervallet, med filnamn i zip:en. */
export function collectUnderlag(verifications, range) {
  const vers = (verifications || [])
    .filter(v => isBooked(v) && v.date && (!range || (day(v.date) >= range.from && day(v.date) <= range.to)))
    .sort((a, b) => day(a.date).localeCompare(day(b.date)) || String(a.number || '').localeCompare(String(b.number || ''), 'sv', { numeric: true }));
  const used = new Set();
  const files = [];
  const index = [];
  for (const v of vers) {
    const list = [];
    if (v.attachmentUrl) list.push({ url: v.attachmentUrl, name: v.attachmentName, type: v.attachmentType });
    for (const a of Array.isArray(v.attachments) ? v.attachments : []) {
      const url = a?.url || a?.attachmentUrl;
      if (url && url !== v.attachmentUrl) list.push({ url, name: a.name || a.attachmentName, type: a.type || a.attachmentType });
    }
    const base = String(v.number || 'utan-nummer').replace(/[^\wåäöÅÄÖ-]+/g, '_');
    list.forEach((f, i) => {
      let fileName = `${base}${list.length > 1 ? `-${i + 1}` : ''}.${extOf(f.name || f.url, f.type)}`;
      let n = 2;
      while (used.has(fileName)) fileName = `${base}-${n++}.${extOf(f.name || f.url, f.type)}`;
      used.add(fileName);
      files.push({ ...f, fileName, number: v.number || '', date: day(v.date), description: v.description || '' });
    });
    if (list.length === 0) {
      index.push({ number: v.number || '', date: day(v.date), description: v.description || '', file: '', status: hasUnderlag(v) ? (v.originalLocation ? `Finns: ${v.originalLocation}` : 'Skapad av Bokix') : 'Saknar underlag' });
    }
  }
  return { files, index, verificationCount: vers.length };
}

const asDate = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return y ? new Date(Date.UTC(y, m - 1, d)) : ''; };

/**
 * Hämtar filerna och bygger zip:en. `fetchFile(url)` ger filens bytes (går
 * att byta ut i test). Filer som inte går att hämta står i förteckningen.
 * Returnerar { zip: Uint8Array, fileCount, failed }.
 */
export async function buildUnderlagZip(verifications, range, { XLSX, fetchFile, onProgress } = {}) {
  const { files, index } = collectUnderlag(verifications, range);
  const zipFiles = [];
  const rows = [];
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.(i + 1, files.length);
    try {
      const data = await fetchFile(f.url);
      zipFiles.push({ name: f.fileName, data });
      rows.push({ number: f.number, date: f.date, description: f.description, file: f.fileName, status: 'Bifogad' });
    } catch {
      failed += 1;
      rows.push({ number: f.number, date: f.date, description: f.description, file: f.fileName, status: 'Kunde inte hämtas' });
    }
  }
  const all = [...rows, ...index].sort((a, b) => a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number), 'sv', { numeric: true }));
  if (XLSX) {
    const wb = buildWorkbook(XLSX, [{
      name: 'Förteckning',
      columns: [
        { key: 'number', label: 'Verifikation', width: 12 }, { key: 'date', label: 'Datum', width: 11, type: 'date' },
        { key: 'description', label: 'Text', width: 40 }, { key: 'file', label: 'Fil', width: 18 }, { key: 'status', label: 'Underlag', width: 28 },
      ],
      rows: all.map(r => ({ ...r, date: asDate(r.date) })),
    }]);
    zipFiles.unshift({ name: 'Forteckning.xlsx', data: new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })) });
  }
  return { zip: createZip(zipFiles), fileCount: files.length - failed, failed, missing: index.filter(r => r.status === 'Saknar underlag').length };
}

/** Webbläsarversionen: hämtar via signerade länkar och laddar ner zip:en. */
export async function downloadUnderlagZip(verifications, range, fileLabel, onProgress) {
  const XLSX = await import('xlsx');
  const fetchFile = async (url) => {
    const signed = await getSignedStorageUrl(url);
    const res = await fetch(signed);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
  const result = await buildUnderlagZip(verifications, range, { XLSX, fetchFile, onProgress });
  const blob = new Blob([result.zip], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `underlag_${fileLabel}.zip`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return result;
}
