// Skattetabell från Skatteverket i stället för att gissa: e-tjänsten "Fråga
// om skatteavdrag" (FOS). Arbetsgivaren laddar upp en frågefil med de
// anställdas personnummer och får efter några dagar en svarsfil med varje
// persons skatteform (A/F/FA), skattetabell och eventuellt jämkningsbeslut
// (en procentsats som gäller i stället för tabellen). Kolumnen följer av
// åldern och står inte i svaret.
//
// Format: Skatteverkets schema CSRUtdrag.xsd version 2 (xmls.skatteverket.se/
// se/skatteverket/askatt/csr/V2/CSRUtdrag.xsd, hämtat 2026-10-07). Samma
// schema för fråga och svar. Filen ska vara ISO-8859-1. Högst 1 000
// personnummer per fråga.
// Felkoder ur "Förklaring till fråge- och svarsuppgifter v.2":
//   felorsak 1 fel person-/orgnr, 2 finns inte i skatteregistret, 3 övrigt,
//   9 jämkning som inte kan redovisas, 10 preliminärskatt kan inte lämnas.

import { toTwelveDigits } from './personnummer';

export const FOS_MAX_PERSONS = 1000;
const NS = 'se/skatteverket/askatt/csr/2.0';
const digits = (s) => String(s || '').replace(/\D/g, '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (s, n) => esc(String(s ?? '').trim().slice(0, n));

/** Organisationsnummer med sekel, som schemat vill ha det: AB 556677-8899 →
 * 165566778899, enskild firma (personnummer) → 12 siffror. */
export function orgNrWithCentury(orgNr) {
  const d = digits(orgNr);
  if (d.length === 12) return d;
  if (d.length !== 10) return '';
  // Tredje siffran ≥ 2 är en juridisk person (månad 20+), annars ett personnummer.
  return Number(d[2]) >= 2 ? `16${d}` : toTwelveDigits(d);
}

/** Vad som saknas för att kunna skapa frågefilen (schemat kräver allt). */
export function fosMissingFields({ company = {}, contact = {} }) {
  const missing = [];
  if (!orgNrWithCentury(company.orgNr)) missing.push('orgNr');
  if (!String(company.name || '').trim()) missing.push('companyName');
  if (!String(contact.name || '').trim()) missing.push('name');
  if (!String(contact.address || '').trim()) missing.push('address');
  const pn = Number(digits(contact.postalCode));
  if (!(pn >= 10000 && pn <= 99999)) missing.push('postalCode');
  if (!String(contact.city || '').trim()) missing.push('city');
  if (!String(contact.phone || '').trim()) missing.push('phone');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email || '').trim())) missing.push('email');
  return missing;
}

/** Frågefilen. `employees` med personnummer; anställda utan giltigt nummer hoppas över. */
export function buildFosQuery({ company, contact, year, employees }) {
  const org = orgNrWithCentury(company.orgNr);
  const persons = employees
    .map(e => ({ pnr: toTwelveDigits(e.ssn), ref: e.id }))
    .filter(p => p.pnr)
    .slice(0, FOS_MAX_PERSONS);
  return [
    '<?xml version="1.0" encoding="iso-8859-1"?>',
    `<Skatteavdrag xmlns="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${NS} http://xmls.skatteverket.se/se/skatteverket/askatt/csr/V2/CSRUtdrag.xsd">`,
    '<Etikett><Frageetikett>',
    `<Fragestallare organisationsNr="${org}">`,
    `<Organisationsnamn>${cut(company.name, 40)}</Organisationsnamn>`,
    '<Kontaktperson>',
    `<Namn>${cut(contact.name, 40)}</Namn>`,
    `<Postadress><Gatuadress>${cut(contact.address, 80)}</Gatuadress><Postnr>${digits(contact.postalCode)}</Postnr><Postort>${cut(contact.city, 30)}</Postort></Postadress>`,
    `<TelefonNr>${cut(contact.phone, 20)}</TelefonNr>`,
    `<E-postadress>${cut(contact.email, 50)}</E-postadress>`,
    '</Kontaktperson>',
    '</Fragestallare>',
    `<Inkomstar>${year}</Inkomstar>`,
    '<Programvara>Bokix</Programvara>',
    '<SKVversion>2.0</SKVversion>',
    '</Frageetikett></Etikett>',
    `<Registerutdrag><Arbetsgivare organisationsNr="${org}">`,
    ...persons.map(p => `<Anstalld personNr="${p.pnr}"><EgenReferens>${cut(p.ref, 20)}</EgenReferens></Anstalld>`),
    '</Arbetsgivare></Registerutdrag>',
    '</Skatteavdrag>',
    '',
  ].join('\n');
}

/** Läser svarsfilen. Returnerar { year, answers: [{ pnr, skatteform, tabell, jamkning, error }] }.
 * Egen enkel tolkning (filen är platt och schemabunden) i stället för
 * DOMParser, så att den fungerar likadant i webbläsaren och i testerna.
 * Namnrymdsprefix (t.ex. <ns1:Tabell>) tillåts. */
export function parseFosAnswer(xmlText) {
  const xml = String(xmlText || '').replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '');
  const tag = (name) => `(?:[\\w-]+:)?${name}`;
  const first = (src, name) => { const m = src.match(new RegExp(`<${tag(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag(name)}>`)); return m ? m[1].trim() : ''; };
  const blocks = (src, name) => [...src.matchAll(new RegExp(`<${tag(name)}(\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</${tag(name)}>)`, 'g'))].map(m => ({ attrs: m[1] || '', body: m[2] || '' }));
  const attr = (attrs, name) => { const m = attrs.match(new RegExp(`${name}="([^"]*)"`)); return m ? m[1] : null; };
  if (!new RegExp(`<${tag('Skatteavdrag')}[\\s>]`).test(xml)) throw new Error('Det här är inte en svarsfil från Fråga om skatteavdrag.');
  const year = Number(first(xml, 'Inkomstar')) || null;
  const answers = [];
  blocks(first(xml, 'Registerutdrag') || xml, 'Arbetsgivare').forEach(ag => {
    const agError = attr(ag.attrs, 'felorsak');
    blocks(ag.body, 'Anstalld').forEach(a => {
      const pre = blocks(a.body, 'Preliminarskatteuppgift')[0] || null;
      const j = pre ? blocks(pre.body, 'Jamkning')[0] : null;
      answers.push({
        pnr: attr(a.attrs, 'personNr'),
        ref: first(a.body, 'EgenReferens'),
        skatteform: pre ? first(pre.body, 'Skatteform') || null : null,
        tabell: pre ? first(pre.body, 'Tabell') || null : null,
        jamkning: j ? { percent: Number(first(j.body, 'Procent')), from: first(j.body, 'Fromdatum'), to: first(j.body, 'Tomdatum') } : null,
        error: agError ? `ag${agError}` : (attr(a.attrs, 'felorsak') || (pre && attr(pre.attrs, 'felorsak')) || null),
      });
    });
  });
  return { year, answers };
}

/** Kolumn för lön: 1 under 66 år vid årets ingång, 3 för den som fyllt 66. */
export function wageColumnFor(ssn, year) {
  const d = toTwelveDigits(ssn);
  if (!d) return 1;
  const by = Number(d.slice(0, 4));
  const bm = Number(d.slice(4, 6));
  let bd = Number(d.slice(6, 8));
  if (bd > 60) bd -= 60; // samordningsnummer
  const ageAtJan1 = year - by - (bm > 1 || bd > 1 ? 1 : 0);
  return ageAtJan1 >= 66 ? 3 : 1;
}

const FORM = { A: 'a_skatt', F: 'f_skatt', FA: 'fa_skatt' };

/**
 * Vad svaret ändrar på de anställda. Returnerar en rad per anställd i svaret:
 * { employeeId, name, patch, changes: [text], problem } där `patch` är det
 * som ska sparas och `problem` en felkod som inte gav några uppgifter.
 */
export function fosChanges(employees, { year, answers }) {
  const byPnr = new Map(employees.map(e => [toTwelveDigits(e.ssn), e]));
  return answers.map(a => {
    const e = byPnr.get(a.pnr) || employees.find(x => x.id === a.ref);
    if (!e) return { employeeId: null, name: a.pnr, patch: null, changes: [], problem: 'unknown' };
    const name = `${e.firstName || ''} ${e.lastName || ''}`.trim();
    if (!a.skatteform && !a.tabell) return { employeeId: e.id, name, patch: null, changes: [], problem: a.error || '10' };
    const patch = { taxTableMode: 'skatteverket', taxFetchedAt: new Date().toISOString().slice(0, 10) };
    const changes = [];
    if (a.skatteform && FORM[a.skatteform] && FORM[a.skatteform] !== e.taxForm) {
      patch.taxForm = FORM[a.skatteform];
      changes.push({ key: 'form', vars: { value: a.skatteform } });
    }
    if (a.tabell) {
      const current = Number(e.taxTable?.kolumn) || 0;
      const kolumn = [1, 3].includes(current) || !current ? wageColumnFor(e.ssn, year) : current;
      const next = { tabellnr: String(Number(a.tabell)), kolumn, year: year || e.taxTable?.year };
      if (String(e.taxTable?.tabellnr || '') !== next.tabellnr || current !== kolumn || Number(e.taxTable?.year) !== Number(next.year)) {
        changes.push({ key: 'table', vars: { table: next.tabellnr, column: kolumn } });
      }
      patch.taxTable = { ...(e.taxTable || {}), ...next };
    }
    const prevJ = e.taxAdjustment || null;
    const nextJ = a.jamkning && Number.isFinite(a.jamkning.percent) ? a.jamkning : null;
    if (JSON.stringify(prevJ) !== JSON.stringify(nextJ)) {
      changes.push(nextJ ? { key: 'adjustment', vars: { percent: nextJ.percent, from: nextJ.from, to: nextJ.to } } : { key: 'adjustmentRemoved' });
    }
    patch.taxAdjustment = nextJ;
    return { employeeId: e.id, name, patch, changes, problem: a.error === '9' ? '9' : null };
  });
}

/** Filen som ISO-8859-1-byte (det Skatteverket kräver). Tecken utanför
 * Latin-1 blir frågetecken. */
export function latin1Bytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[i] = c < 256 ? c : 63;
  }
  return out;
}
