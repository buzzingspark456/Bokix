// Försäljning med ROT/RUT från en annan app (t.ex. en bokningsapp för
// städning där kunden betalar i appen). I stället för en faktura i Bokix per
// uppdrag, vilket blir tusentals fakturor i månaden och gör företagets data
// för stor, läser Bokix appens export (CSV) och
//   1. bokför en verifikation per betaldag (kunden betalt, avdrag på 1513,
//      intäkt och moms), med filen som underlag,
//   2. gör begäran till Skatteverket direkt ur samma rader (rotRutRequest.js).
// Per uppdrag sparas ingenting i appens data, bara en sammanfattning per
// import (se App.jsx handleImportRotRutBookings).
//
// Rubrikerna får stå i valfri ordning och heta lite olika (se COLUMNS).
// Belopp är inklusive moms. Avdraget räknas fram (30 % ROT, 50 % RUT av
// arbetskostnaden) om kolumnen saknas.

import { parseCsv, detectDelimiter } from './csvRegister';
import { toTwelveDigits } from './personnummer';
import { ROT_RUT_RATES } from './rotRutConfig';
import { caseErrors, workTypesFor } from './rotRutRequest';

// Fältnyckel → godtagna rubriker (gemener, utan mellanslag i kanterna).
const COLUMNS = {
  paidDate: ['betaldatum', 'betalningsdatum', 'betald', 'datum', 'payment date', 'paid date', 'date'],
  buyer: ['personnummer', 'köparens personnummer', 'kundens personnummer', 'köpare', 'pnr', 'personal number', 'ssn'],
  labor: ['arbetskostnad', 'pris för arbete', 'arbete', 'arbete inkl moms', 'labor', 'labour'],
  material: ['material', 'materialkostnad', 'material inkl moms'],
  deduction: ['avdrag', 'rut-avdrag', 'rot-avdrag', 'rutavdrag', 'rotavdrag', 'begärt belopp', 'begärt', 'deduction'],
  fee: ['avgift', 'avgifter', 'transaktionsavgift', 'kortavgift', 'fee', 'fees'],
  paid: ['betalt', 'betalt belopp', 'kunden betalade', 'kund betalt', 'paid'],
  hours: ['timmar', 'antal timmar', 'arbetade timmar', 'hours'],
  workType: ['typ av arbete', 'tjänst', 'arbetstyp', 'service'],
  ref: ['bokningsnummer', 'bokningsnr', 'bokning', 'ordernummer', 'ordernr', 'fakturanummer', 'fakturanr', 'referens', 'booking id', 'order id', 'id'],
  vatRate: ['moms', 'moms %', 'momssats', 'vat'],
  property: ['fastighetsbeteckning', 'fastighet'],
  brfOrgNr: ['brf org.nr', 'brf orgnr', 'brf', 'föreningens org.nr', 'bostadsrättsförening'],
  apartment: ['lägenhetsnummer', 'lägenhet', 'lgh'],
};

// Vanliga benämningar i andra appar → Skatteverkets arbetstyp. Bara entydiga.
const WORK_ALIASES = {
  'städning': 'Stadning', 'hemstädning': 'Stadning', 'flyttstädning': 'Stadning', 'storstädning': 'Stadning', 'fönsterputs': 'Stadning', 'fönstertvätt': 'Stadning', 'cleaning': 'Stadning',
  'kläd- och textilvård': 'KladOchTextilvard', 'textilvård': 'KladOchTextilvard',
  'snöskottning': 'Snoskottning', 'trädgårdsarbete': 'Tradgardsarbete', 'trädgård': 'Tradgardsarbete',
  'barnpassning': 'Barnpassning', 'personlig omsorg': 'Personligomsorg',
  'flytt': 'Flyttjanster', 'flyttjänster': 'Flyttjanster', 'flytthjälp': 'Flyttjanster',
  'it-tjänster': 'ItTjanster', 'it': 'ItTjanster', 'reparation av vitvaror': 'ReparationAvVitvaror',
  'möblering': 'Moblering', 'tillsyn av bostad': 'TillsynAvBostad',
  'bygg': 'Bygg', 'el': 'El', 'glas- och plåtarbete': 'GlasPlatarbete', 'mark- och dräneringsarbete': 'MarkDraneringarbete',
  'murning': 'Murning', 'målning': 'MalningTapetsering', 'målning och tapetsering': 'MalningTapetsering', 'tapetsering': 'MalningTapetsering', 'vvs': 'Vvs',
};

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');


/** "1 234,50" / "1234.50" / "1,234.50" / "1 234 kr" → tal. Tomt → null. Ogiltigt → NaN. */
export function parseAmount(v) {
  let s = String(v ?? '').replace(/kr|sek|\s| /gi, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** 2026-10-07, 2026-10-07 14:30, 2026-10-07T14:30:00Z, 2026/10/07 → 2026-10-07. */
export function parseDate(v) {
  const m = String(v || '').trim().match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function hashText(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Läser filen. Returnerar { rows, missingColumns, hash } där varje rad är
 * { line, case, customerPaid, vatRate, errors } och `case` är ett ärende
 * för rotRutRequest.js. `defaultWorkType` används när kolumnen saknas.
 */
export function parseBookingCsv(text, { type = 'rut', defaultWorkType = '', company, today } = {}) {
  const table = parseCsv(text, detectDelimiter(text));
  if (table.length === 0) return { rows: [], missingColumns: [], hash: hashText(text) };
  const [header, ...data] = table;
  const index = {};
  Object.entries(COLUMNS).forEach(([key, names]) => {
    const i = header.findIndex(h => names.includes(norm(h)));
    if (i !== -1) index[key] = i;
  });
  const missingColumns = ['paidDate', 'buyer', 'labor'].filter(k => index[k] === undefined);
  if (index.hours === undefined) missingColumns.push('hours');
  const rate = ROT_RUT_RATES[type]?.percent || 0;
  const allowed = workTypesFor(type);

  const rows = data
    .map((r, i) => ({ r, line: i + 2 }))
    .filter(({ r }) => r.some(v => String(v || '').trim() !== ''))
    .map(({ r, line }) => {
      const get = (k) => (index[k] === undefined ? '' : String(r[index[k]] ?? '').trim());
      const errors = [];
      const paidDate = parseDate(get('paidDate'));
      if (get('paidDate') && !paidDate) errors.push({ key: 'badDate', vars: { value: get('paidDate') } });
      const laborRaw = parseAmount(get('labor'));
      const materialRaw = parseAmount(get('material'));
      const dedRaw = parseAmount(get('deduction'));
      const paidRaw = parseAmount(get('paid'));
      const vatRaw = parseAmount(get('vatRate'));
      const feeRaw = parseAmount(get('fee'));
      [['labor', laborRaw], ['material', materialRaw], ['deduction', dedRaw], ['paid', paidRaw], ['vatRate', vatRaw], ['fee', feeRaw]].forEach(([k, v]) => {
        if (Number.isNaN(v)) errors.push({ key: 'badAmount', vars: { value: get(k) } });
      });
      const labor = Math.round(laborRaw || 0);
      const material = Math.round(materialRaw || 0);
      const deduction = dedRaw == null || Number.isNaN(dedRaw) ? Math.floor(labor * rate / 100) : Math.round(dedRaw);
      const vatRate = vatRaw == null || Number.isNaN(vatRaw) ? 25 : vatRaw;
      if (![0, 6, 12, 25].includes(vatRate)) errors.push({ key: 'badVat', vars: { value: get('vatRate') } });
      const customerPaid = labor - deduction + material;
      if (paidRaw != null && !Number.isNaN(paidRaw) && Math.abs(paidRaw - customerPaid) > 1) {
        errors.push({ key: 'paidMismatch', vars: { paid: paidRaw, expected: customerPaid } });
      }
      const workRaw = get('workType');
      const workType = workRaw ? (allowed.includes(workRaw) ? workRaw : WORK_ALIASES[norm(workRaw)]) : defaultWorkType;
      if (workRaw && !allowed.includes(workType)) errors.push({ key: 'unknownWork', vars: { value: workRaw } });
      const hoursRaw = parseAmount(get('hours'));
      // Skatteverket vill ha hela timmar: avrundas till närmaste, minst 1.
      const hours = hoursRaw == null || Number.isNaN(hoursRaw) ? '' : (hoursRaw > 0 ? Math.max(1, Math.round(hoursRaw)) : 0);
      const c = {
        type, buyer: toTwelveDigits(get('buyer'), paidDate ? Number(paidDate.slice(0, 4)) : undefined),
        paidDate: paidDate || '', labor, material, deduction, hours, workType: allowed.includes(workType) ? workType : '',
        ref: get('ref').slice(0, 20), property: get('property'), brfOrgNr: get('brfOrgNr'), apartment: get('apartment'),
      };
      const caseErrs = caseErrors(c, { company, today }).filter(e => !(e.key === 'noWorkType' && errors.some(x => x.key === 'unknownWork')));
      const fee = feeRaw == null || Number.isNaN(feeRaw) ? 0 : Math.round(Math.abs(feeRaw) * 100) / 100;
      return { line, case: c, customerPaid, vatRate, fee, errors: [...errors, ...caseErrs] };
    });
  return { rows, missingColumns, hash: hashText(text) };
}

/**
 * En verifikation per betaldag. Fakturaraderna som invoiceBookingRows vill
 * ha (en per momssats), vad kunderna betalat och avdraget på 1513.
 */
export function groupBookingsByDay(rows) {
  const byDay = new Map();
  rows.forEach(({ case: c, vatRate, customerPaid, fee = 0 }) => {
    const d = byDay.get(c.paidDate) || { date: c.paidDate, count: 0, customerPaid: 0, deduction: 0, fee: 0, grossByVat: {} };
    d.fee = Math.round((d.fee + fee) * 100) / 100;
    d.count += 1;
    d.customerPaid += customerPaid;
    d.deduction += c.deduction;
    d.grossByVat[vatRate] = (d.grossByVat[vatRate] || 0) + c.labor + c.material;
    byDay.set(c.paidDate, d);
  });
  return [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      invoiceRows: Object.entries(d.grossByVat).map(([v, gross]) => ({ qty: 1, unitPrice: gross / (1 + Number(v) / 100), vatRate: Number(v), discount: 0 })),
    }));
}

/** Avdrag per köpare, sparas på importen så att taket kan räknas nästa gång. */
export function buyerTotals(rows) {
  const out = {};
  rows.forEach(({ case: c }) => { if (c.buyer) out[c.buyer] = (out[c.buyer] || 0) + c.deduction; });
  return out;
}

/** Mall att ge till den som gör exporten i den andra appen. */
export function bookingTemplateCsv(type = 'rut') {
  const head = ['Betaldatum', 'Personnummer', 'Arbetskostnad', 'Material', 'Avdrag', 'Timmar', 'Typ av arbete', 'Bokningsnummer'];
  const ex = type === 'rot'
    ? ['2026-10-01', '19900101-0017', '10000', '2500', '3000', '8', 'Bygg', 'B-1001']
    : ['2026-10-01', '19900101-0017', '956', '0', '478', '4', 'Städning', 'B-1001'];
  if (type === 'rot') { head.push('Fastighetsbeteckning', 'BRF org.nr', 'Lägenhetsnummer'); ex.push('Stockholm Exempel 1:2', '', ''); }
  return '﻿' + [head.join(';'), ex.join(';')].join('\r\n');
}
