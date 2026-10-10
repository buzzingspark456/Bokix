// Fyller i Skatteverkets egen ifyllnadsbara Inkomstdeklaration 2 (SKV 2002)
// med siffrorna från Bokix. Blanketten hämtas för rätt period via
// /api/skv-blankett. Fälten heter efter blankettens rader, t.ex.
// "...subRad43[0].subHoger[0].txt7653[0]" för 4.3 c, så raden läses ur
// namnet (subRad43 = 4.3) och delraden ur ordningen inom raden (a, b, c).
// Rader med plus- och minusfält (3.2, 4.9, 4.13 m.fl.) har plusfältet först.

/** "subRad219" → "2.19", "subRad41" → "4.1", "subRAd417" → "4.17". */
export function rowFromFieldName(name) {
  const m = /subRad(\d)(\d+)\[/i.exec(name);
  return m ? `${m[1]}.${m[2]}` : null;
}

/**
 * Bygger { fältnamn: text } ur fältlistan och värdena.
 * @param fieldNames  alla fältnamn i blanketten, i ordning
 * @param data  { orgNr, name, address, postalLine, date, rows }
 *   rows: [{ row: '4.3', index: 2 }|{ row: '3.2', sign: -1 }|{ row: '2.19' }, value]
 */
export function buildSkvFieldValues(fieldNames, data) {
  const byRow = new Map();
  for (const n of fieldNames) {
    const row = rowFromFieldName(n);
    if (!row) continue;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(n);
  }
  const out = {};
  const num = (v) => String(Math.round(v));
  for (const { row, index, value, split } of data.rows) {
    const fields = byRow.get(row);
    if (!fields || !Math.round(value)) continue;
    let i = index ?? 0;
    let v = value;
    // Plus- och minusfält: plus först, beloppet skrivs utan tecken.
    if (split && fields.length >= 2) { i = value >= 0 ? 0 : 1; v = Math.abs(value); }
    if (fields[i]) out[fields[i]] = num(v);
  }
  for (const n of fieldNames) {
    if (/txtPersOrgNr\[0\]$/.test(n)) out[n] = data.orgNr || '';
    else if (/txtDatFramst\[0\]$/.test(n)) out[n] = data.date || '';
    else if (/adressrad1\[0\]$/.test(n)) out[n] = data.name || '';
    else if (/adressrad3\[0\]$/.test(n)) out[n] = data.address || '';
    else if (/adressrad5\[0\]$/.test(n)) out[n] = data.postalLine || '';
  }
  return out;
}

const LETTER = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
// Rader på blanketten som har ett plus- och ett minusfält.
const SPLIT_ROWS = new Set(['3.2', '3.12', '3.13', '3.14', '3.15', '3.23', '3.24', '4.9', '4.10', '4.13']);

/** Raderna att fylla i, ur räkenskapsschemat och de skattemässiga justeringarna. */
export function skvRowsFromBokix({ ink2r, resultRows, ink2s }) {
  const rows = [];
  for (const r of ink2r?.rows || []) rows.push({ row: r.row, value: r.amount });
  for (const r of resultRows || []) {
    rows.push(SPLIT_ROWS.has(r.row)
      ? { row: r.row, value: r.polarity === 'revenue' ? r.amount : -r.amount, split: true }
      : { row: r.row, value: Math.abs(r.amount) });
  }
  if (ink2s) {
    if (ink2s.arsResultatVinst) rows.push({ row: '4.1', value: ink2s.arsResultatVinst });
    if (ink2s.arsResultatForlust) rows.push({ row: '4.2', value: ink2s.arsResultatForlust });
    for (const r of ink2s.rows) {
      if (!r.value) continue;
      const m = /^(\d\.\d+)([a-f])?$/.exec(r.key);
      if (!m) continue;
      if (SPLIT_ROWS.has(m[1])) rows.push({ row: m[1], value: r.value, split: true });
      else rows.push({ row: m[1], index: m[2] ? LETTER[m[2]] : 0, value: r.value });
    }
    if (ink2s.overskott) { rows.push({ row: '4.15', value: ink2s.overskott }); rows.push({ row: '1.1', value: ink2s.overskott }); }
    if (ink2s.underskott) { rows.push({ row: '4.16', value: ink2s.underskott }); rows.push({ row: '1.2', value: ink2s.underskott }); }
  }
  return rows;
}

// [sidindex, x, y] för fr.o.m.-datumet, uppmätt i SKV 2002 (2026P4).
const FROM_DATE_POSITIONS = [[0, 402.2, 749.6], [2, 121.4, 743.6], [3, 121.4, 779.6], [4, 121.4, 743.6]];

/** Hämtar blanketten, fyller i den och laddar ner den. */
export async function downloadFilledSkv2002({ company, fy, ink2r, resultRows, ink2s }) {
  const res = await fetch(`/api/skv-blankett?dattom=${fy.end}`);
  if (!res.ok) {
    let msg = 'Kunde inte hämta blanketten från Skatteverket just nu.';
    try { msg = (await res.json()).error || msg; } catch { /* inget */ }
    throw new Error(msg);
  }
  const bytes = await res.arrayBuffer();
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  // Blanketten är också en XFA-blankett. Utan att ta bort XFA-delen visar
  // Adobe Reader den tomma XFA-versionen i stället för de ifyllda fälten.
  form.deleteXFA();
  const fields = form.getFields();
  const names = fields.map(f => f.getName());
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const values = buildSkvFieldValues(names, {
    orgNr: company?.orgNr || '',
    name: company?.name || '',
    address: company?.address || '',
    postalLine: [company?.postalCode, company?.city].filter(Boolean).join(' '),
    date: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    rows: skvRowsFromBokix({ ink2r, resultRows, ink2s }),
  });
  for (const f of fields) {
    const v = values[f.getName()];
    if (v == null || typeof f.setText !== 'function') continue;
    try {
      // Fältens längdgräns får inte stoppa ett långt namn eller en adress.
      if (typeof f.getMaxLength === 'function' && f.getMaxLength() && v.length > f.getMaxLength()) f.setMaxLength(undefined);
      f.setText(v);
    } catch { /* fält som inte går att fylla hoppas över */ }
  }
  // Räkenskapsårets första dag. Skatteverket trycker bara slutdagen
  // (T.o.m.) och fr.o.m.-rutan är inget fält, så den skrivs på samma höjd
  // och i samma stil, under rubriken Fr.o.m. (sida 1, 3, 4 och 5).
  const { StandardFonts } = await import('pdf-lib');
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const pages = pdf.getPages();
  for (const [index, x, y] of FROM_DATE_POSITIONS) {
    if (pages[index] && fy.start) pages[index].drawText(fy.start, { x, y, size: 11, font: mono });
  }
  const out = await pdf.save();
  const blob = new Blob([out], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `INK2-${(company?.name || 'bolaget').replace(/[^\wåäöÅÄÖ-]+/g, '-')}-${String(fy.label).replace('/', '-')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
