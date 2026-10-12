// Kvittots fil följer med till verifikationen när kvittot bokförs, så att
// underlaget syns i Bokföring (Bokföringslagen: en verifikation ska ha sitt
// underlag). Samma fil i Storage, ingen kopia: ett bokfört kvitto går inte
// att ta bort (handleDeleteExpense), så filen försvinner aldrig under
// verifikationen.

const BOOKED_FROM_EXPENSE = new Set(['expense', 'expense_fix', 'supplier_invoice']);

function fileNameFromUrl(url) {
  const raw = String(url || '').split('?')[0].split('/').pop() || '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/** Underlagsfälten för en verifikation, ur ett kvitto eller en leverantörsfaktura. */
export function receiptAttachmentFields(expense) {
  if (!expense?.receiptUrl) return {};
  return {
    attachmentUrl: expense.receiptUrl,
    attachmentName: expense.inbox?.fileName || fileNameFromUrl(expense.receiptUrl) || 'Kvitto',
    attachmentType: expense.receiptType || '',
  };
}

/**
 * Kopplar kvittots fil till redan bokförda verifikationer som saknar
 * underlag. Rör bara underlagsfälten. Ger samma array tillbaka om inget
 * ändrades.
 */
export function backfillReceiptAttachments(verifications, expenses) {
  if (!Array.isArray(verifications) || !Array.isArray(expenses) || expenses.length === 0) return verifications;
  const byId = new Map(expenses.filter(e => e?.receiptUrl).map(e => [e.id, e]));
  if (byId.size === 0) return verifications;
  let changed = false;
  const next = verifications.map(v => {
    if (v.attachmentUrl || !BOOKED_FROM_EXPENSE.has(v.source) || !byId.has(v.sourceId)) return v;
    changed = true;
    return { ...v, ...receiptAttachmentFields(byId.get(v.sourceId)) };
  });
  return changed ? next : verifications;
}
