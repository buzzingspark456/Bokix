/**
 * Vad företaget själv har bokfört för en leverantör tidigare. En leverantör
 * som redan finns på tidigare kvitton ger samma konto och momssats som
 * oftast förut, eftersom det är så företaget bokför. Det slår de allmänna
 * reglerna som gissar konto ur texten.
 *
 * Leverantören jämförs på exakt namn, utan hänsyn till versaler och
 * mellanslag i kanterna. Kvitton utan konto räknas inte, och inte heller
 * kvittot som håller på att läsas av.
 *
 * Vid lika många förekomster vinner det senast använda.
 */
export function historyForSupplier(receipts, supplier, excludeId) {
  const key = String(supplier || '').trim().toLowerCase();
  if (!key) return null;
  const same = (receipts || [])
    .filter(r => r.id !== excludeId && r.costAccount && String(r.supplier || '').trim().toLowerCase() === key)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  if (same.length === 0) return null;

  const mostCommon = (pick) => {
    const counts = new Map();
    same.forEach(r => counts.set(pick(r), (counts.get(pick(r)) || 0) + 1));
    let best = null;
    // Senaste sist i listan: vid lika antal ska det senaste vinna.
    for (const [value, count] of counts) {
      if (best === null || count >= best.count) best = { value, count };
    }
    return best.value;
  };
  const withRate = same.filter(r => r.vatRate !== undefined && r.vatRate !== null && Number.isFinite(Number(r.vatRate)));
  const vatRate = withRate.length
    ? (() => {
      const counts = new Map();
      withRate.forEach(r => counts.set(Number(r.vatRate), (counts.get(Number(r.vatRate)) || 0) + 1));
      let best = null;
      for (const [value, count] of counts) if (best === null || count >= best.count) best = { value, count };
      return best.value;
    })()
    : null;
  return { costAccount: mostCommon(r => r.costAccount), vatRate };
}

/**
 * Samma sak som historyForSupplier, men ur redan bokförda verifikationer:
 * en verifikation vars text är leverantörens namn visar vilket konto och
 * vilken momssats företaget använde sist. Kostnadskontot är den första
 * debetraden som är ett kostnads- eller tillgångskonto (klass 4-8, inte
 * ingående moms 2641), momssatsen räknas ur momsraden mot nettoraden.
 * Rättelser och utkast hoppas över.
 */
export function historyFromVerifications(verifications, supplier) {
  const key = String(supplier || '').trim().toLowerCase();
  if (!key) return null;
  const found = [];
  for (const v of verifications || []) {
    if (!v || (v.status && v.status !== 'booked')) continue;
    if (v.source === 'expense_reversal' || v.source === 'year_end_close') continue;
    if (String(v.description || '').trim().toLowerCase() !== key) continue;
    const rows = Array.isArray(v.rows) ? v.rows : [];
    const debit = (r) => Number(r.debet ?? r.debit) || 0;
    const costRow = rows.find(r => debit(r) > 0 && /^[4-8]/.test(String(r.account)) && String(r.account) !== '2641');
    if (!costRow) continue;
    const vatRow = rows.find(r => String(r.account) === '2641' && debit(r) > 0);
    let vatRate = 0;
    if (vatRow && debit(costRow) > 0) {
      const ratio = debit(vatRow) / debit(costRow);
      vatRate = [25, 12, 6].reduce((best, rate) => (Math.abs(ratio * 100 - rate) < Math.abs(ratio * 100 - best) ? rate : best), 25);
    }
    // Betalkontot är raden med kredit som inte är kostnaden eller momsen.
    const credit = (r) => Number(r.kredit ?? r.credit) || 0;
    const payRow = rows.find(r => credit(r) > 0 && String(r.account) !== '2641' && String(r.account) !== String(costRow.account));
    found.push({ date: String(v.date || ''), costAccount: String(costRow.account), vatRate, payAccount: payRow ? String(payRow.account) : null });
  }
  if (found.length === 0) return null;
  found.sort((a, b) => a.date.localeCompare(b.date));
  const mostCommon = (pick) => {
    const counts = new Map();
    found.forEach(f => counts.set(pick(f), (counts.get(pick(f)) || 0) + 1));
    let best = null;
    for (const [value, count] of counts) if (best === null || count >= best.count) best = { value, count };
    return best.value;
  };
  const withPay = found.filter(f => f.payAccount);
  const payCounts = new Map();
  withPay.forEach(f => payCounts.set(f.payAccount, (payCounts.get(f.payAccount) || 0) + 1));
  let payBest = null;
  for (const [value, count] of payCounts) if (payBest === null || count >= payBest.count) payBest = { value, count };
  return { costAccount: mostCommon(f => f.costAccount), vatRate: mostCommon(f => f.vatRate), payAccount: payBest ? payBest.value : null };
}
