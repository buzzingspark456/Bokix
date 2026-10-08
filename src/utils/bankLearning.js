// Bankimporten lär sig av vad användaren själv bokfört tidigare: har
// "TELIA SVERIGE AB 2026-09-28" bokförts mot 6212 förut föreslås 6212 nästa
// gång samma motpart dyker upp. Två eller fler bokningar mot samma konto, och
// inga mot något annat, räknas som säkert nog att bokföra i ett svep.

// Bankernas texter bär datum, referens- och kortnummer som skiljer sig varje
// gång. Kvar blir motpartens namn.
export function counterpartyKey(description) {
  const words = String(description || '')
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-zåäöéü&]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 2 && !['kortköp', 'kortkop', 'köp', 'kop', 'betalning', 'bg', 'pg', 'autogiro', 'swish', 'överföring', 'overforing', 'ab', 'ref', 'sek'].includes(w));
  return words.slice(0, 3).join(' ');
}

// Vilket motkonto en bokförd bankrad fick: sparas på raden sedan
// 2026-10-08 (bookedAccount), äldre rader läses ur verifikationen.
function bookedCounterAccount(row, verificationsBySource, ledgerAccountOf) {
  if (row.bookedAccount) return row.bookedAccount;
  const ver = verificationsBySource.get(row.id);
  if (!ver?.rows?.length) return null;
  const bank = ledgerAccountOf(row);
  const others = ver.rows.filter(r => String(r.account) !== String(bank));
  return others.length === 1 ? String(others[0].account) : null;
}

export function buildBankHistory(bankTransactions = [], verifications = [], ledgerAccountOf = () => '1930') {
  const verificationsBySource = new Map();
  for (const v of verifications) {
    if (v.source === 'bank_import' && v.sourceId) verificationsBySource.set(v.sourceId, v);
  }
  const history = new Map(); // "in|telia sverige" -> Map(account -> count)
  for (const row of bankTransactions) {
    if (row.status !== 'booked') continue;
    const key = counterpartyKey(row.description);
    if (!key) continue;
    const account = bookedCounterAccount(row, verificationsBySource, ledgerAccountOf);
    if (!account) continue;
    const fullKey = `${row.amount > 0 ? 'in' : 'out'}|${key}`;
    if (!history.has(fullKey)) history.set(fullKey, new Map());
    const counts = history.get(fullKey);
    counts.set(account, (counts.get(account) || 0) + 1);
  }
  return history;
}

// { accountCode, times, confident } eller null.
export function suggestFromHistory(row, history) {
  const key = counterpartyKey(row?.description);
  if (!key) return null;
  const counts = history.get(`${row.amount > 0 ? 'in' : 'out'}|${key}`);
  if (!counts?.size) return null;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [accountCode, times] = sorted[0];
  return { accountCode, times, confident: counts.size === 1 && times >= 2 };
}
