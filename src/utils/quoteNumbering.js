// Nästa offertnummer (2026-11-15). Fortsätter från det högsta numret bland
// befintliga offerter, med samma prefix som den offerten, så att en serie
// som O-1004 eller offerter som flyttats från ett annat program inte börjar
// om på OFF-1001 (förut räknades bara nummer som började med "OFF-").
export function getNextQuoteNumber(quotesList, defaultPrefix = 'OFF-') {
  let best = null;
  for (const q of quotesList || []) {
    const m = /^(.*?)(\d+)\s*$/.exec(String(q?.invoiceNumber ?? '').trim());
    if (!m) continue;
    const n = Number(m[2]);
    if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length };
  }
  if (!best) return `${defaultPrefix}1001`;
  return `${best.prefix}${String(best.n + 1).padStart(best.width, '0')}`;
}
