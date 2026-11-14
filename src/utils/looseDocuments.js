// Underlag att koppla (2026-11-14). Kvitton och fakturor som sparats utan
// avläsning ligger i company.documents tills de kopplas till en
// verifikation. Lagen kräver att verifikationen visar var underlaget finns
// (BFL 5 kap. 7 §), så en fil som aldrig kopplas räcker inte; därför
// påminner Bokix om filer som legat länge.
//
// Post: { id, url, name, type, uploadedAt, uploadedBy, linkedVerificationId?, linkedAt? }
import { hasUnderlag } from './reportLedgers';

export const STALE_DAYS = 30;

const day = (s) => String(s || '').slice(0, 10);

export function newDocument({ url, name, type }, uploadedBy = null, now = new Date()) {
  return {
    id: `doc_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    url, name: name || 'Underlag', type: type || '',
    uploadedAt: now.toISOString(),
    uploadedBy,
  };
}

export function unlinkedDocuments(documents) {
  return (documents || []).filter(d => d && d.url && !d.linkedVerificationId);
}

/** Okopplade underlag som legat mer än STALE_DAYS dagar. */
export function staleDocuments(documents, now = new Date(), days = STALE_DAYS) {
  const limit = now.getTime() - days * 86400000;
  return unlinkedDocuments(documents).filter(d => new Date(d.uploadedAt).getTime() < limit);
}

/** Ett datum i filnamnet ("2026-03-15", "20260315" eller "15-03-2026"), annars null. */
export function dateFromName(name) {
  const s = String(name || '');
  let m = /(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(0[1-9]|[12]\d|3[01])[-_.](0[1-9]|1[0-2])[-_.](20\d{2})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/**
 * Verifikationer som underlaget troligen hör till: bokförda, utan underlag,
 * närmast datumet i filnamnet (eller uppladdningsdagen). Högst `limit`.
 */
export function suggestVerifications(doc, verifications, limit = 5) {
  const target = dateFromName(doc?.name) || day(doc?.uploadedAt);
  const t = target ? Date.parse(target) : NaN;
  return (verifications || [])
    .filter(v => (v.status || 'booked') !== 'draft' && v.date && !hasUnderlag(v))
    .map(v => ({ v, dist: isNaN(t) ? 0 : Math.abs(Date.parse(day(v.date)) - t) }))
    .sort((a, b) => a.dist - b.dist || String(b.v.date).localeCompare(String(a.v.date)))
    .slice(0, limit)
    .map(x => x.v);
}

/**
 * Kopplar underlaget till verifikationen. Har verifikationen redan en fil
 * läggs den nya i `attachments`. Returnerar { verifications, documents }.
 */
export function linkDocument(verifications, documents, docId, verificationId, now = new Date()) {
  const doc = (documents || []).find(d => d.id === docId);
  if (!doc) return { verifications, documents };
  const file = { url: doc.url, name: doc.name, type: doc.type };
  const nextVers = (verifications || []).map(v => {
    if (v.id !== verificationId) return v;
    if (!v.attachmentUrl) return { ...v, attachmentUrl: doc.url, attachmentName: doc.name, attachmentType: doc.type || '' };
    return { ...v, attachments: [...(Array.isArray(v.attachments) ? v.attachments : []), file] };
  });
  const nextDocs = documents.map(d => (d.id === docId ? { ...d, linkedVerificationId: verificationId, linkedAt: now.toISOString() } : d));
  return { verifications: nextVers, documents: nextDocs };
}
