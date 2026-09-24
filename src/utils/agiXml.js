import { validatePersonnummer } from './personnummer';

/**
 * AGI-fil (arbetsgivardeklaration på individnivå) som XML för Skatteverkets
 * e-tjänst "Lämna arbetsgivardeklaration" > "Deklarera via fil".
 *
 * Formatet är byggt efter Skatteverkets tekniska beskrivning version 1.1
 * (schema arbetsgivardeklaration_1.1.xsd och _component_1.1.xsd, exempelfil 1
 * "Vanliga löntagare"). Filen innehåller en huvuduppgift (HU) med summan
 * arbetsgivaravgifter (fältkod 487) och summan avdragen skatt (497), samt en
 * individuppgift (IU) per anställd med kontant ersättning (011), förmåner
 * (012 övriga, 013 bilförmån), avdragen skatt (001) och kryss för skattefri
 * bilersättning (050) och traktamente (051).
 *
 * Bokix skickar aldrig in filen. Arbetsgivaren laddar upp den själv och
 * signerar med BankID i e-tjänsten.
 *
 * Arbetsgivaravgiften räknas efter ålder i lönekörningar skapade från
 * 2026-09-24 (payrollConfig.employerFeeFor): ingen avgift för födda 1937
 * eller tidigare, 10,21 % från 67 år, tillfälligt 20,81 % upp till 25 000 kr
 * för 19-23-åringar april 2026 till september 2027. Äldre körningar har
 * fast 31,42 %, och Skatteverket visar då skillnaden i granskningssteget.
 * Ersättning till någon med F-skatt tas inte med i filen.
 */

const NS_INSTANCE = 'http://xmls.skatteverket.se/se/skatteverket/da/instans/schema/1.1';
const NS_COMPONENT = 'http://xmls.skatteverket.se/se/skatteverket/da/komponent/schema/1.1';
const SCHEMA_LOCATION = 'http://xmls.skatteverket.se/se/skatteverket/da/arbetsgivardeklaration/arbetsgivardeklaration_1.1.xsd';

const EMAIL_RE = /^\w+([-+.'_]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/;
const round = (v) => Math.round(Number(v) || 0);
const digits = (v) => String(v ?? '').replace(/\D/g, '');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const text = (s, max) => esc(String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max));

/**
 * Arbetsgivarens 12-siffriga id för filen. Juridiska personer får 16 före
 * organisationsnumret. En enskild firma anges med ägarens personnummer, med
 * sekelsiffror (ett tiosiffrigt personnummer får 19 eller 20 utifrån att
 * personen ska vara minst 15 år).
 */
export function employerIdentity(orgNr, now = new Date()) {
  const d = digits(orgNr);
  if (d.length === 12) return d;
  if (d.length !== 10) return null;
  const thirdDigit = Number(d[2]);
  if (thirdDigit >= 2) return `16${d}`;
  const yy = Number(d.slice(0, 2));
  const century = 2000 + yy <= now.getFullYear() - 15 ? 20 : 19;
  return `${century}${d}`;
}

const isOrgIdentity = (id) => /^16(1[0-9]|2[0-9]|3[0-9]|5[0-9]|6[0-4]|66|68|7[0-9]|8[0-9]|9[0-9])[2-9]\d{7}$/.test(id);
const isValidEmployerIdentity = (id) => Boolean(id) && (isOrgIdentity(id) || validatePersonnummer(id).valid);

const pad = (n) => String(n).padStart(2, '0');
const timestamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** Förmånerna på en anställd delat på bilförmån (013) och övrigt (012). */
function splitBenefits(computed) {
  const benefits = Math.max(0, round(computed.taxableIncome) - round(computed.gross));
  const car = Math.min(benefits, round((computed.payLines || [])
    .filter(l => l.kind === 'benefit' && l.payTypeId === 'car_benefit')
    .reduce((s, l) => s + (Number(l.amount) || 0), 0)));
  return { car, other: benefits - car };
}

/**
 * Bygger filen. `computedRows` är samma lista som lönekörningen och PDF:en
 * använder: `[{ row, computed }]`. Returnerar `{ xml, errors, warnings,
 * summary }`; `xml` är null så länge `errors` inte är tom.
 */
export function buildAgiXml({ company, period, computedRows, now = new Date() }) {
  const errors = [];
  const warnings = [];

  const periodDigits = digits(period);
  if (!/^20(1[89]|[2-9]\d)(0[1-9]|1[0-2])$/.test(periodDigits) || periodDigits < '201807') {
    errors.push('Perioden har fel format. Den ska vara ÅÅÅÅ-MM, från juli 2018.');
  }

  const employerId = employerIdentity(company?.orgNr, now);
  if (!isValidEmployerIdentity(employerId)) {
    errors.push('Organisationsnumret (eller personnumret för en enskild firma) saknas eller är ogiltigt. Fyll i det under Inställningar.');
  }

  const contactName = String(company?.name || '').trim();
  const phone = String(company?.phone || '').replace(/\s+/g, '').slice(0, 20);
  const email = String(company?.email || '').trim();
  if (!contactName) errors.push('Företagsnamn saknas under Inställningar.');
  if (!phone) errors.push('Telefonnummer saknas under Inställningar. Skatteverket kräver en kontaktperson med telefon.');
  if (!EMAIL_RE.test(email)) errors.push('E-postadress saknas eller är ogiltig under Inställningar. Skatteverket kräver en kontaktperson med e-post.');

  const rows = [];
  (computedRows || []).forEach(({ row, computed }) => {
    const emp = row?.employeeSnapshot || {};
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Okänd anställd';
    if (computed.fTax) {
      warnings.push(`${name} har F-skatt. Ersättningen redovisas inte i arbetsgivardeklarationen och tas inte med i filen.`);
      return;
    }
    const gross = Math.max(0, round(computed.gross));
    const { car, other } = splitBenefits(computed);
    const tax = Math.max(0, round(computed.tax));
    if (gross === 0 && car === 0 && other === 0 && tax === 0) {
      warnings.push(`${name} har ingen lön, förmån eller skatt den här perioden och tas inte med i filen.`);
      return;
    }
    const id = digits(emp.ssn);
    const check = validatePersonnummer(id);
    if (!check.valid) {
      errors.push(`${name}: personnummer saknas eller är ogiltigt (${check.error || 'okänt fel'}) Rätta det under Anställda.`);
      return;
    }
    const lines = computed.payLines || [];
    rows.push({
      id, name, gross, car, other, tax,
      mileage: lines.some(l => l.payTypeId === 'mileage' && (Number(l.amount) || 0) > 0),
      perDiem: lines.some(l => l.payTypeId === 'per_diem' && (Number(l.amount) || 0) > 0),
      employerFee: Math.max(0, round(computed.employerFee)),
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push('Ingen anställd har lön eller skatt den här perioden, så det finns inget att deklarera i en fil.');
  }
  const seen = new Set();
  rows.forEach(r => { if (seen.has(r.id)) errors.push(`${r.name}: samma personnummer finns på flera rader i körningen.`); seen.add(r.id); });

  const summary = {
    employees: rows.length,
    gross: rows.reduce((s, r) => s + r.gross, 0),
    tax: rows.reduce((s, r) => s + r.tax, 0),
    employerFee: rows.reduce((s, r) => s + r.employerFee, 0),
  };
  if (errors.length > 0) return { xml: null, errors, warnings, summary };

  const p = periodDigits;
  const o = [];
  o.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  o.push(`<Skatteverket omrade="Arbetsgivardeklaration" xmlns="${NS_INSTANCE}" xmlns:agd="${NS_COMPONENT}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${NS_INSTANCE} ${SCHEMA_LOCATION}">`);
  o.push('  <agd:Avsandare>');
  o.push('    <agd:Programnamn>Bokix</agd:Programnamn>');
  o.push(`    <agd:Organisationsnummer>${employerId}</agd:Organisationsnummer>`);
  o.push('    <agd:TekniskKontaktperson>');
  o.push(`      <agd:Namn>${text(contactName, 50)}</agd:Namn>`);
  o.push(`      <agd:Telefon>${esc(phone)}</agd:Telefon>`);
  o.push(`      <agd:Epostadress>${esc(email)}</agd:Epostadress>`);
  o.push('    </agd:TekniskKontaktperson>');
  o.push(`    <agd:Skapad>${timestamp(now)}</agd:Skapad>`);
  o.push('  </agd:Avsandare>');
  o.push('  <agd:Blankettgemensamt>');
  o.push('    <agd:Arbetsgivare>');
  o.push(`      <agd:AgRegistreradId>${employerId}</agd:AgRegistreradId>`);
  o.push('      <agd:Kontaktperson>');
  o.push(`        <agd:Namn>${text(contactName, 50)}</agd:Namn>`);
  o.push(`        <agd:Telefon>${esc(phone)}</agd:Telefon>`);
  o.push(`        <agd:Epostadress>${esc(email)}</agd:Epostadress>`);
  o.push('      </agd:Kontaktperson>');
  o.push('    </agd:Arbetsgivare>');
  o.push('  </agd:Blankettgemensamt>');

  const caseInfo = [
    '    <agd:Arendeinformation>',
    `      <agd:Arendeagare>${employerId}</agd:Arendeagare>`,
    `      <agd:Period>${p}</agd:Period>`,
    '    </agd:Arendeinformation>',
  ];

  o.push('  <agd:Blankett>', ...caseInfo);
  o.push('    <agd:Blankettinnehall>');
  o.push('      <agd:HU>');
  o.push('        <agd:ArbetsgivareHUGROUP>');
  o.push(`          <agd:AgRegistreradId faltkod="201">${employerId}</agd:AgRegistreradId>`);
  o.push('        </agd:ArbetsgivareHUGROUP>');
  o.push(`        <agd:RedovisningsPeriod faltkod="006">${p}</agd:RedovisningsPeriod>`);
  o.push(`        <agd:SummaArbAvgSlf faltkod="487">${summary.employerFee}</agd:SummaArbAvgSlf>`);
  o.push(`        <agd:SummaSkatteavdr faltkod="497">${summary.tax}</agd:SummaSkatteavdr>`);
  o.push('      </agd:HU>');
  o.push('    </agd:Blankettinnehall>');
  o.push('  </agd:Blankett>');

  rows.forEach((r) => {
    o.push('  <agd:Blankett>', ...caseInfo);
    o.push('    <agd:Blankettinnehall>');
    o.push('      <agd:IU>');
    o.push('        <agd:ArbetsgivareIUGROUP>');
    o.push(`          <agd:AgRegistreradId faltkod="201">${employerId}</agd:AgRegistreradId>`);
    o.push('        </agd:ArbetsgivareIUGROUP>');
    o.push('        <agd:BetalningsmottagareIUGROUP>');
    o.push('          <agd:BetalningsmottagareIDChoice>');
    o.push(`            <agd:BetalningsmottagarId faltkod="215">${r.id}</agd:BetalningsmottagarId>`);
    o.push('          </agd:BetalningsmottagareIDChoice>');
    o.push('        </agd:BetalningsmottagareIUGROUP>');
    o.push(`        <agd:RedovisningsPeriod faltkod="006">${p}</agd:RedovisningsPeriod>`);
    // Specifikationsnummer ska vara unikt per betalningsmottagare, arbetsgivare
    // och period, och samma nummer används vid en rättelse. Varje anställd har
    // en enda rad per period, så 001 räcker och blir stabilt vid ny fil.
    o.push('        <agd:Specifikationsnummer faltkod="570">001</agd:Specifikationsnummer>');
    if (r.gross > 0) o.push(`        <agd:KontantErsattningUlagAG faltkod="011">${r.gross}</agd:KontantErsattningUlagAG>`);
    if (r.other > 0) o.push(`        <agd:SkatteplOvrigaFormanerUlagAG faltkod="012">${r.other}</agd:SkatteplOvrigaFormanerUlagAG>`);
    if (r.car > 0) o.push(`        <agd:SkatteplBilformanUlagAG faltkod="013">${r.car}</agd:SkatteplBilformanUlagAG>`);
    o.push(`        <agd:AvdrPrelSkatt faltkod="001">${r.tax}</agd:AvdrPrelSkatt>`);
    if (r.mileage) o.push('        <agd:Bilersattning faltkod="050">1</agd:Bilersattning>');
    if (r.perDiem) o.push('        <agd:Traktamente faltkod="051">1</agd:Traktamente>');
    o.push('      </agd:IU>');
    o.push('    </agd:Blankettinnehall>');
    o.push('  </agd:Blankett>');
  });

  o.push('</Skatteverket>');
  return { xml: `${o.join('\n')}\n`, errors, warnings, summary };
}

/** Sparar filen i webbläsaren. */
export function downloadAgiXml(args, filename) {
  const result = buildAgiXml(args);
  if (!result.xml) return result;
  const blob = new Blob([result.xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return result;
}
