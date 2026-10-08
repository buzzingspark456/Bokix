// Begäran om utbetalning av ROT- och RUT-avdrag, som fil till Skatteverkets
// e-tjänst "Rot och rut" (Importera fil). Formatet är Skatteverkets XML-
// schema version 6 (Begaran.xsd + BegaranCOMPONENT.xsd, gäller sedan
// 2021-01-01, hämtat från xmls.skatteverket.se 2026-10-07). Exempelfilerna
// exempel_rot_3st.xml och exempel_rut_3st.xml därifrån styr hur beloppen
// fylls i:
//   PrisForArbete  arbetskostnaden inkl. moms (bara rader märkta Arbete)
//   BetaltBelopp   det kunden betalat för arbetet = PrisForArbete − avdraget
//   BegartBelopp   avdraget som begärs från Skatteverket
//   Materialkostnad  övriga rader (material) inkl. moms, under arbetstypen
// Reglerna nedan är Skatteverkets "Regler för att importera fil till Rot &
// rut": max 100 köpare per fil, ROT och RUT aldrig i samma fil, alla
// betalningsdatum inom samma år, köparen minst 18 år, betalningsdatum inte
// i framtiden, begärt belopp inte över betalt, timmar för minst ett
// arbetsområde. Bokix lämnar aldrig in filen, användaren laddar upp den.

import { ROT_RUT_RATES, ROT_CAP, ROT_RUT_COMBINED_CAP, calcRotRutDeduction, rowGross } from './rotRutConfig';
import { validatePersonnummer, toTwelveDigits } from './personnummer';

// Arbetsområden i schemats ordning (xs:sequence, ordningen spelar roll).
export const ROT_WORK_TYPES = ['Bygg', 'El', 'GlasPlatarbete', 'MarkDraneringarbete', 'Murning', 'MalningTapetsering', 'Vvs'];
export const RUT_WORK_TYPES = [
  'Stadning', 'KladOchTextilvard', 'Snoskottning', 'Tradgardsarbete', 'Barnpassning', 'Personligomsorg',
  'Flyttjanster', 'ItTjanster', 'ReparationAvVitvaror', 'Moblering', 'TillsynAvBostad',
  'TransportTillForsaljning', 'TvattVidTvattinrattning',
];
// Schablontjänster: bara "Utfort", inga timmar eller material.
export const RUT_FLAT_RATE_TYPES = ['TransportTillForsaljning', 'TvattVidTvattinrattning'];

export const MAX_BUYERS_PER_FILE = 100;
export const MAX_REQUEST_NAME = 16;

export const workTypesFor = (type) => (type === 'rot' ? ROT_WORK_TYPES : RUT_WORK_TYPES);

const digits = (s) => String(s || '').replace(/\D/g, '');

/** Köparens personnummer som 12 siffror, eller '' om det inte går. */
export const buyerId = toTwelveDigits;

/** Beloppen för en faktura, i hela kronor som Skatteverket vill ha dem. */
export function rotRutAmounts(inv) {
  const rows = inv?.rows || [];
  const { deduction } = calcRotRutDeduction(inv?.rotRutType, rows);
  const labor = Math.round(rows.filter(r => r.rotRutLabor).reduce((s, r) => s + rowGross(r), 0));
  const material = Math.round(rows.filter(r => !r.rotRutLabor).reduce((s, r) => s + rowGross(r), 0));
  return { labor, material, deduction, paid: labor - deduction };
}

// ── Ärenden ─────────────────────────────────────────────────────────────────
// Allt nedan arbetar på ett "ärende" (ett Arenden i filen), oavsett om det
// kommer från en faktura i Bokix eller en rad i en fil från en annan app
// (bookingImport.js). Belopp i hela kronor.
//   { type, buyer (12 siffror eller ''), paidDate, labor, material,
//     deduction, hours, workType, ref, property, brfOrgNr, apartment }

/** Kalenderår för betalningen (avgör vilket års tak den räknas mot). */
const yearOf = (date) => Number(String(date || '').slice(0, 4)) || null;

export function invoiceToCase(inv, customer) {
  const a = rotRutAmounts(inv);
  return {
    type: inv.rotRutType, buyer: buyerId(customer?.orgNr, yearOf(inv.paidDate) || undefined), buyerName: customer?.name,
    paidDate: inv.paidDate, labor: a.labor, material: a.material, deduction: a.deduction,
    hours: inv.rotRutHours, workType: inv.rotRutWorkType, ref: inv.invoiceNumber,
    property: inv.rotRutProperty, brfOrgNr: inv.rotRutBrfOrgNr, apartment: inv.rotRutApartment,
  };
}

/** Fel som stoppar ett ärende, som { key, vars } under rotRut.err. */
export function caseErrors(c, { company, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errs = [];
  const add = (key, vars) => errs.push({ key, vars });
  if (!c.paidDate) add('notPaid');
  else {
    if (c.paidDate > today) add('futureDate');
    if (c.paidDate < '2009-07-01') add('oldDate');
  }
  const year = yearOf(c.paidDate) || Number(today.slice(0, 4));
  const pnr = c.buyer;
  if (!pnr) add('noPnr');
  else if (!validatePersonnummer(pnr).valid) add('badPnr');
  else {
    if (Number(pnr.slice(0, 4)) > year - 18) add('under18');
    const own = digits(company?.orgNr);
    if (own && (own === pnr || own === pnr.slice(2))) add('ownId');
  }
  if (!(c.labor >= 2)) add('noLabor');
  if (!(c.deduction > 0)) add('noDeduction');
  if (c.deduction > c.labor - c.deduction) add('overPaid');
  const work = c.workType;
  if (!work || !workTypesFor(c.type).includes(work)) add('noWorkType');
  else if (!RUT_FLAT_RATE_TYPES.includes(work)) {
    const h = Number(c.hours);
    if (!(h >= 1 && h <= 999 && Number.isInteger(h))) add('noHours');
  }
  if (c.type === 'rot') {
    const hasProperty = String(c.property || '').trim();
    const hasBrf = digits(c.brfOrgNr) && String(c.apartment || '').trim();
    if (!hasProperty && !hasBrf) add('noProperty');
    if (hasProperty && hasProperty.length > 40) add('propertyTooLong');
  }
  if (c.material > 9999999) add('materialTooHigh');
  return errs;
}

/**
 * Fel för ett urval ärenden: blandade år, och taket per person och år
 * räknat tillsammans med tidigare begäranden (`prior`: [{ buyer, year,
 * type, deduction }]). Gränsen 100 per fil hanteras genom att dela upp i
 * flera filer (splitIntoFiles), inte som fel.
 */
export function casesBatchErrors(cases, prior = [], nameOf = (b) => b) {
  const errs = [];
  const years = new Set(cases.map(c => yearOf(c.paidDate)).filter(Boolean));
  if (years.size > 1) errs.push({ key: 'mixedYears' });
  const totals = new Map(); // `${buyer}|${year}` → { rot, all }
  const addTo = (buyer, year, type, d) => {
    if (!buyer || !year) return;
    const k = `${buyer}|${year}`;
    const t = totals.get(k) || { rot: 0, all: 0, buyer, year };
    t.all += d;
    if (type === 'rot') t.rot += d;
    totals.set(k, t);
  };
  cases.forEach(c => addTo(c.buyer, yearOf(c.paidDate), c.type, c.deduction));
  const touched = new Set(totals.keys());
  prior.forEach(p => { if (touched.has(`${p.buyer}|${p.year}`)) addTo(p.buyer, p.year, p.type, p.deduction); });
  totals.forEach(t => {
    const name = nameOf(t.buyer);
    if (t.rot > ROT_CAP) errs.push({ key: 'rotCap', vars: { name, year: t.year, cap: ROT_CAP.toLocaleString('sv-SE') } });
    if (t.all > ROT_RUT_COMBINED_CAP) errs.push({ key: 'combinedCap', vars: { name, year: t.year, cap: ROT_RUT_COMBINED_CAP.toLocaleString('sv-SE') } });
  });
  return errs;
}

/** Tidigare begärda avdrag ur fakturor och importerade filer, för taket. */
export function priorClaims(invoices = [], contacts = [], batches = [], excludeInvoiceIds = new Set()) {
  const out = [];
  invoices.forEach(i => {
    if (excludeInvoiceIds.has(i.id) || !i.rotRutType || !['requested', 'paid'].includes(i.rotRutStatus)) return;
    const c = invoiceToCase(i, contacts.find(x => x.id === i.customerId));
    out.push({ buyer: c.buyer, year: yearOf(c.paidDate), type: c.type, deduction: c.deduction });
  });
  batches.forEach(b => {
    Object.entries(b.buyerTotals || {}).forEach(([buyer, deduction]) => out.push({ buyer, year: b.year, type: b.type, deduction }));
  });
  return out;
}

/** Delar upp ärenden i filer om högst 100. */
export function splitIntoFiles(cases, size = MAX_BUYERS_PER_FILE) {
  const out = [];
  for (let i = 0; i < cases.length; i += size) out.push(cases.slice(i, i + size));
  return out;
}

// ── Fakturor (ROT/RUT-fönstret i Kundfakturor) ──────────────────────────────

export function rotRutInvoiceErrors(inv, customer, opts = {}) {
  const errs = [];
  if ((inv.currency || 'SEK') !== 'SEK') errs.push({ key: 'currency' });
  if (inv.status !== 'paid' || !inv.paidDate) errs.push({ key: 'notPaid' });
  return [...errs, ...caseErrors(invoiceToCase(inv, customer), opts).filter(e => !(e.key === 'notPaid' && errs.some(x => x.key === 'notPaid')))];
}

export function rotRutBatchErrors(selected, allInvoices, contacts, batches = []) {
  const errs = [];
  if (selected.length > MAX_BUYERS_PER_FILE) errs.push({ key: 'tooMany', vars: { n: MAX_BUYERS_PER_FILE } });
  const cases = selected.map(i => invoiceToCase(i, contacts.find(c => c.id === i.customerId)));
  const prior = priorClaims(allInvoices, contacts, batches, new Set(selected.map(i => i.id)));
  const nameOf = (b) => contacts.find(c => digits(c.orgNr) === b || buyerId(c.orgNr) === b)?.name || b;
  return [...errs, ...casesBatchErrors(cases, prior, nameOf)];
}

// ── Filen ───────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Själva filen. `type` är 'rot' eller 'rut', `name` högst 16 tecken.
 * Tar antingen `cases` eller `invoices` + `contacts`. */
export function buildRotRutXml({ type, name, cases, invoices, contacts = [] }) {
  const list = cases || invoices.map(inv => invoiceToCase(inv, contacts.find(c => c.id === inv.customerId)));
  const el = (tag, value) => `<ns2:${tag}>${esc(value)}</ns2:${tag}>`;
  const xmlCases = list.map(c => {
    const work = c.workType;
    const workXml = RUT_FLAT_RATE_TYPES.includes(work)
      ? `<ns2:${work}>${el('Utfort', 'true')}</ns2:${work}>`
      : `<ns2:${work}>${el('AntalTimmar', Math.round(Number(c.hours) || 0))}${el('Materialkostnad', c.material)}</ns2:${work}>`;
    const parts = [
      el('Kopare', c.buyer),
      el('BetalningsDatum', c.paidDate),
      el('PrisForArbete', c.labor),
      el('BetaltBelopp', c.labor - c.deduction),
      el('BegartBelopp', c.deduction),
      el('FakturaNr', String(c.ref || '').slice(0, 20)),
      el('Ovrigkostnad', 0),
    ];
    if (type === 'rot') {
      const property = String(c.property || '').trim();
      if (property) parts.push(el('Fastighetsbeteckning', property));
      else {
        parts.push(el('LagenhetsNr', String(c.apartment || '').trim().slice(0, 25)));
        parts.push(el('BrfOrgNr', digits(c.brfOrgNr).slice(0, 12)));
      }
    }
    parts.push(`<ns2:UtfortArbete>${workXml}</ns2:UtfortArbete>`);
    return `\t\t<ns2:Arenden>\n\t\t\t${parts.join('\n\t\t\t')}\n\t\t</ns2:Arenden>`;
  });
  const wrapper = type === 'rot' ? 'RotBegaran' : 'HushallBegaran';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ns1:Begaran xmlns:ns1="http://xmls.skatteverket.se/se/skatteverket/ht/begaran/6.0" xmlns:ns2="http://xmls.skatteverket.se/se/skatteverket/ht/komponent/begaran/6.0">',
    `\t${el('NamnPaBegaran', String(name || '').slice(0, MAX_REQUEST_NAME))}`,
    `\t<ns2:${wrapper}>`,
    ...xmlCases,
    `\t</ns2:${wrapper}>`,
    '</ns1:Begaran>',
    '',
  ].join('\n');
}

export { ROT_RUT_RATES };

/** Sparar en text som fil i webbläsaren. */
export function downloadText(text, filename, type = 'application/xml;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadRotRutXml(args, filename) {
  downloadText(buildRotRutXml(args), filename);
}
