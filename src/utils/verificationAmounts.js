/**
 * Verification rows are booked using the Swedish field names `debet`/`kredit`
 * everywhere in this app EXCEPT the manual "Ny verifikation" form, which used
 * to write `debit`/`credit` instead — a real bug: every manually booked
 * verification was invisible to account balances, Dashboard KPIs, and the
 * SIE export, because those all read `row.debet`/`row.kredit`.
 *
 * The form now writes `debet`/`kredit` like everything else. These two
 * helpers read a row tolerantly (`debet` first, `debit` as a fallback) so
 * any verification a user already saved under the old field names is read
 * correctly too, with no data migration needed.
 */
// Bugkritiskt: manuellt inmatade verifikationsrader lagrar debet/kredit som
// STRÄNGAR (rakt från ett textfälts e.target.value, aldrig parseFloat:ade —
// se VerificationForm). Utan Number(...) här adderar `rows.reduce((s, r) =>
// s + getDebet(r), 0)` strängar istället för tal ("0" + "500.00" blir
// "0500.00", inte 500), vilket rakt av gav "NaN kr" i summeringar så fort en
// verifikation hade fler än en rad på samma sida.
export function getDebet(row) {
  return Number(row?.debet ?? row?.debit ?? 0) || 0;
}

export function getKredit(row) {
  return Number(row?.kredit ?? row?.credit ?? 0) || 0;
}
