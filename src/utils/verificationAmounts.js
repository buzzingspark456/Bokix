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
export function getDebet(row) {
  return row?.debet ?? row?.debit ?? 0;
}

export function getKredit(row) {
  return row?.kredit ?? row?.credit ?? 0;
}
