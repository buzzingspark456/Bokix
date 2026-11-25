import { hasUnderlag } from './reportLedgers';
import { getDebet } from './verificationAmounts';
// Underlag och Granska är ett flöde (2026-11-20):
//  - Underlag: dokumentet läses av och fylls i (leverantör och belopp).
//  - Granska: bara kontot återstår, med förslag ur tidigare konteringar.
// Ett underlag syns därför bara på ett ställe åt gången.

/** Förslag ur tidigare konteringar: samma leverantör, samma konto förra
 * gången. Säkert bara om ALLA tidigare poster från leverantören fick samma konto. */
export function suggestAccount(item, allExpenses) {
  const name = (item.supplier || '').trim().toLowerCase();
  if (!name) return { account: null, confident: false };
  const matches = allExpenses.filter(e =>
    e.costAccount && e.type === item.type && (e.supplier || '').trim().toLowerCase() === name
  );
  if (matches.length === 0) return { account: null, confident: false };
  const distinct = [...new Set(matches.map(m => m.costAccount))];
  if (distinct.length === 1) return { account: distinct[0], confident: true };
  const latest = [...matches].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  return { account: latest.costAccount, confident: false };
}

/** Saknar leverantör eller belopp: hanteras i Underlag, inte i Granska. */
export function needsUnderlagWork(e) {
  return !e?.costAccount && (!String(e?.supplier || '').trim() || !Number(e?.amount));
}

/** Nästa steg för ett obokfört underlag:
 *  'read'    ingen avläsning än
 *  'fill'    avläst men leverantör eller belopp är inte sparat
 *  'ready'   säkert kontoförslag, klart att bokföra
 *  'account' konto behöver väljas */
export function underlagStep(e, allExpenses = []) {
  if (e?.costAccount) return null;
  if (needsUnderlagWork(e)) return e?.ocrDraft ? 'fill' : 'read';
  return suggestAccount(e, allExpenses).confident ? 'ready' : 'account';
}

/** Saknar underlag (2026-11-20): bokförda verifikationer utan kvitto eller
 * faktura, nyast först. `since` (ÅÅÅÅ-MM-DD) begränsar till ett datum och framåt. */
export function missingUnderlag(verifications = [], since = '') {
  return (verifications || [])
    .filter(v => (v.status || 'booked') !== 'draft' && v.date && !hasUnderlag(v) && (!since || String(v.date).slice(0, 10) >= since))
    .map(v => ({ v, amount: Math.round((v.rows || []).reduce((s, r) => s + getDebet(r), 0) * 100) / 100 }))
    .sort((a, b) => String(b.v.date).localeCompare(String(a.v.date)) || String(b.v.number || '').localeCompare(String(a.v.number || ''), 'sv', { numeric: true }));
}
