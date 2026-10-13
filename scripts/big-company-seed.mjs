// Stort testföretag för scripts/app-harness-fart.mjs: demons data kopierad M
// gånger (standard 150, ca 5 000 verifikationer), utspridd tre år bakåt.
// Kör: npx esbuild scripts/big-company-seed.mjs --bundle --platform=node
//   --format=esm --loader:.js=jsx --outfile=test-results/seed.mjs
//   && node test-results/seed.mjs test-results/big-company.json 150
import fs from 'fs';
import { createDemoSeed } from '../src/utils/landingDemoData.js';

const M = Number(process.argv[3] || 150);
const base = createDemoSeed();
const c = JSON.parse(JSON.stringify(base));
const REF_KEYS = ['id', 'sourceId', 'customerId', 'supplierId', 'contactId', 'projectId', 'matchedId', 'invoiceId', 'matched_invoice_id', 'employeeId'];
const DATE_KEYS = ['date', 'dueDate', 'paidDate', 'startDate', 'created_at_stripe', 'created_at_zettle'];
const shift = (d, days) => {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
  const t = new Date(d.slice(0, 10) + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - days);
  return t.toISOString().slice(0, 10) + d.slice(10);
};
const cloneRec = (r, k) => {
  const o = JSON.parse(JSON.stringify(r));
  for (const key of REF_KEYS) if (o[key]) o[key] = `${o[key]}_k${k}`;
  // Kopia k flyttas k*7 dagar bakåt, högst tre år.
  const days = (k * 7) % (3 * 365);
  for (const key of DATE_KEYS) if (o[key]) o[key] = shift(o[key], days);
  return o;
};
const lists = ['verifications', 'invoices', 'expenses', 'contacts', 'quotes', 'timeEntries', 'bankTransactions', 'supplierInvoices'];
for (const key of lists) {
  if (!Array.isArray(base[key])) continue;
  const out = [...c[key]];
  for (let k = 1; k < M; k++) for (const r of base[key]) out.push(cloneRec(r, k));
  c[key] = out;
}
// Unika nummer: verifikationer per serie, fakturor och offerter löpande.
const perSeries = {};
c.verifications.sort((a, b) => a.date.localeCompare(b.date));
for (const v of c.verifications) { const s = String(v.number || 'A').replace(/\d+$/, '') || 'A'; perSeries[s] = (perSeries[s] || 0) + 1; v.number = `${s}${perSeries[s]}`; }
let inv = 1001; for (const i of c.invoices.sort((a, b) => a.date.localeCompare(b.date))) i.invoiceNumber = String(inv++);
let q = 1; for (const x of c.quotes) x.invoiceNumber = String(q++);
let cn = 1001; for (const x of c.contacts) if (x.type === 'customer') x.customerNumber = String(cn++);
c.basVersion = 2026;
fs.writeFileSync(process.argv[2], JSON.stringify(c));
console.log(Object.fromEntries(lists.filter(k => c[k]).map(k => [k, c[k].length])), Math.round(fs.statSync(process.argv[2]).size / 1024) + ' kB');
