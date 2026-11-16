// Genererar src/utils/kommunSkattesatser.js ur Skatteverkets öppna data
// "Skattesatser per kommun" (skatteverket.entryscape.net). Kör varje år när
// Skatteverket publicerar nya satser (december):
//   node scripts/generate-kommun-skattesatser.mjs 2027
import fs from 'fs';
import { KOMMUN_SKATTETABELLER } from '../src/utils/kommunSkattetabell.js';

const YEAR = Number(process.argv[2] || new Date().getFullYear());
const BASE = 'https://skatteverket.entryscape.net/rowstore/dataset/c67b320b-ffee-4876-b073-dd9236cd2a99/json';
let url = `${BASE}?${encodeURIComponent('år')}=${YEAR}&_limit=500&_offset=0`;
const rows = [];
while (url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  rows.push(...data.results);
  url = data.next || null;
}
if (!rows.length) throw new Error(`Inga skattesatser för ${YEAR} hos Skatteverket än.`);

// Kommunnamn som i kommunSkattetabell.js (Ale, Upplands Väsby).
const names = new Map(Object.keys(KOMMUN_SKATTETABELLER).map(n => [n.toUpperCase(), n]));
const byKommun = new Map();
for (const r of rows) {
  const name = names.get(r.kommun.toUpperCase()) || r.kommun.charAt(0) + r.kommun.slice(1).toLowerCase();
  const k = byKommun.get(name) || { kommun: Number(r['kommunal-skatt']), region: Number(r['landstings-skatt']), totals: new Map() };
  const total = Number(r['summa, exkl. kyrkoavgift']);
  k.totals.set(total, (k.totals.get(total) || 0) + 1);
  byKommun.set(name, k);
}
const out = {};
for (const [name, k] of [...byKommun].sort((a, b) => a[0].localeCompare(b[0], 'sv'))) {
  // Begravningsavgiften kan skilja mellan församlingar: vanligaste summan.
  const total = [...k.totals].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  out[name] = [k.kommun, k.region, total];
}
const file = `// GENERERAD av scripts/generate-kommun-skattesatser.mjs ur Skatteverkets
// öppna data "Skattesatser per kommun", år ${YEAR}. Ändra inte för hand.
// Per kommun: [kommunalskatt, regionskatt, summa utan kyrkoavgift (med
// begravningsavgift, vanligaste församlingen)], i procent.
export const KOMMUN_SKATTESATSER_ÅR = ${YEAR};
export const KOMMUN_SKATTESATSER = ${JSON.stringify(out, null, 0).replace(/\],"/g, '],\n  "').replace('{"', '{\n  "').replace(/\]\}$/, ']\n}')};

/** Skattesatsen utan kyrkoavgift för en kommun, eller null. */
export function kommunSkattesats(kommun) {
  const key = Object.keys(KOMMUN_SKATTESATSER).find(k => k.toLowerCase() === String(kommun || '').trim().toLowerCase());
  return key ? KOMMUN_SKATTESATSER[key][2] : null;
}
`;
fs.writeFileSync(new URL('../src/utils/kommunSkattesatser.js', import.meta.url), file);
console.log(`${Object.keys(out).length} kommuner för ${YEAR}`);
