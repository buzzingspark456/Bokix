// Timmar till en lönekörning från en fil (t.ex. en export ur en bokningsapp
// eller ett tidrapportsystem), i stället för att skriva in timmarna för
// varje anställd för hand. Filen behöver personnummer och timmar. Står samma
// person på flera rader (en rad per pass eller uppdrag) läggs timmarna ihop.

import { parseCsv, detectDelimiter } from './csvRegister';
import { toTwelveDigits } from './personnummer';
import { parseAmount } from './bookingImport';

const SSN = ['personnummer', 'pnr', 'anställd personnummer', 'personal number', 'ssn'];
const HOURS = ['timmar', 'antal timmar', 'arbetade timmar', 'tid', 'hours'];
const NAME = ['namn', 'anställd', 'name'];

const norm = (s) => String(s || '').trim().toLowerCase();


/**
 * `runRows` är lönekörningens rader ({ employeeId, employeeSnapshot }).
 * Returnerar { updates: [{ employeeId, name, hours }], unmatched: [{ line, ssn, name }],
 * errors: [{ line, text }], missingColumns }.
 */
export function parsePayrollHours(text, runRows) {
  const table = parseCsv(text, detectDelimiter(text));
  const [header = [], ...data] = table;
  const iSsn = header.findIndex(h => SSN.includes(norm(h)));
  const iHours = header.findIndex(h => HOURS.includes(norm(h)));
  const iName = header.findIndex(h => NAME.includes(norm(h)));
  const missingColumns = [iSsn === -1 && 'Personnummer', iHours === -1 && 'Timmar'].filter(Boolean);
  if (missingColumns.length) return { updates: [], unmatched: [], errors: [], missingColumns };

  // Tomma eller ogiltiga personnummer ('') matchar aldrig någon: annars skulle
  // t.ex. en summarad "Totalt" läggas på en anställd utan personnummer.
  const byKey = new Map(runRows.map(r => [toTwelveDigits(r.employeeSnapshot?.ssn), r]).filter(([k]) => k));
  const sums = new Map();
  const unmatched = [];
  const errors = [];
  data.forEach((r, i) => {
    if (!r.some(v => String(v || '').trim())) return;
    const line = i + 2;
    const ssnRaw = String(r[iSsn] || '').trim();
    const hours = parseAmount(r[iHours]);
    if (hours == null || Number.isNaN(hours) || hours < 0) { errors.push({ line, text: r[iHours] || '' }); return; }
    const key = toTwelveDigits(ssnRaw);
    const row = key ? byKey.get(key) : null;
    if (!row) { unmatched.push({ line, ssn: ssnRaw, name: iName === -1 ? '' : String(r[iName] || '').trim() }); return; }
    sums.set(row.employeeId, (sums.get(row.employeeId) || 0) + hours);
  });
  const updates = [...sums.entries()].map(([employeeId, hours]) => {
    const s = runRows.find(r => r.employeeId === employeeId)?.employeeSnapshot || {};
    return { employeeId, name: `${s.firstName || ''} ${s.lastName || ''}`.trim(), hours: Math.round(hours * 100) / 100, hourly: s.salaryForm === 'timlon' };
  });
  return { updates, unmatched, errors, missingColumns };
}
