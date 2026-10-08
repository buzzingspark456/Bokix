// Avstämning av bankrader mot försäljning som redan bokförts via en import
// från en annan app (RotRutBookingImport → en verifikation per betaldag).
// När kunderna betalar med Swish direkt till företagskontot syns varje
// betalning som en egen rad i kontoutdraget, fast försäljningen redan är
// bokförd på dagen. Utan avstämning skulle varje rad behöva ignoreras för
// hand, och ett felklick bokför samma försäljning två gånger.
//
// Regeln är försiktig: en dags inbetalningar markeras som avstämda bara om
// summan av dagens ohanterade inbetalningar på det bankkontot är exakt
// (±0,50 kr) det belopp verifikationen bokade på kontot. Stämmer det inte
// lämnas dagen orörd och visas för användaren. Inget bokförs här.

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * @param bankRows  bankTransactions
 * @param verifications  alla verifikationer
 * @param ledgerOf  (row) => bankkontots bokföringskonto, t.ex. '1930'
 * @returns { updates: [{ id, patch }], matchedDays, unmatchedDays: [{ date, account, expected, found }] }
 */
export function reconcileImportedSales(bankRows, verifications, ledgerOf) {
  const updates = [];
  const unmatchedDays = [];
  let matchedDays = 0;
  const used = new Set();
  const alreadyLinked = new Set(bankRows.filter(r => r.matchedType === 'rotrut_import').map(r => r.matchedId));

  (verifications || [])
    .filter(v => v.source === 'rotrut_import' && !alreadyLinked.has(v.id))
    .forEach(v => {
      // Nettot per konto (en avgift kan ha dragits från samma konto).
      const net = new Map();
      (v.rows || []).forEach(r => net.set(r.account, (net.get(r.account) || 0) + (Number(r.debet) || 0) - (Number(r.kredit) || 0)));
      [...net.entries()].filter(([, amt]) => amt > 0).map(([account, debet]) => ({ account, debet })).forEach(vr => {
        const rows = bankRows.filter(b => !used.has(b.id) && b.status === 'unmatched' && b.amount > 0
          && b.date === v.date && ledgerOf(b) === vr.account);
        if (rows.length === 0) return; // kontot finns inte i något kontoutdrag (t.ex. 1580, 1513)
        const found = round2(rows.reduce((s, b) => s + b.amount, 0));
        const expected = round2(Number(vr.debet));
        if (Math.abs(found - expected) <= 0.5) {
          rows.forEach(b => {
            used.add(b.id);
            updates.push({ id: b.id, patch: { status: 'matched', matchedType: 'rotrut_import', matchedId: v.id, verificationSource: 'rotrut_import' } });
          });
          matchedDays++;
        } else {
          unmatchedDays.push({ date: v.date, account: vr.account, expected, found });
        }
      });
    });
  return { updates, matchedDays, unmatchedDays };
}
