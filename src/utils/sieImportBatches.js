// SIE-importer som går att ta bort (Inställningar → Importera).
//
// Varje importerad fil får en tagg, `sie_import_<filnamn>_<#GEN-datum>`
// (fingerprintFile i SieImportModal.jsx). Den sparas som `sieImportTag` sedan
// 2026-10-10; äldre importer har den bara som början på `sourceId`
// (`<tagg>_<serie>_<nummer>`, handleBulkImportVerifications i App.jsx).

const TAG_FROM_SOURCE_ID = /^(sie_import_.+_(?:\d{4}-\d{2}-\d{2}|okant-datum))_[^_]*_[^_]*$/;

/** Taggen för den SIE-fil en verifikation kom ifrån, annars null. */
export function sieImportTagOf(v) {
  if (!v) return null;
  if (v.sieImportTag) return v.sieImportTag;
  const m = TAG_FROM_SOURCE_ID.exec(String(v.sourceId || ''));
  return m ? m[1] : null;
}

function describeTag(tag) {
  const m = /^sie_import_(.+)_(\d{4}-\d{2}-\d{2}|okant-datum)$/.exec(tag);
  if (!m) return { fileName: tag, generatedDate: null };
  return { fileName: m[1], generatedDate: m[2] === 'okant-datum' ? null : m[2] };
}

/**
 * En rad per importerad SIE-fil, nyast räkenskapsår först:
 * { tag, fileName, generatedDate, count, from, to, ids }.
 */
export function sieImportBatches(verifications) {
  const byTag = new Map();
  for (const v of verifications || []) {
    const tag = sieImportTagOf(v);
    if (!tag) continue;
    let b = byTag.get(tag);
    if (!b) {
      b = { tag, ...describeTag(tag), count: 0, from: null, to: null, ids: [] };
      byTag.set(tag, b);
    }
    b.count += 1;
    b.ids.push(v.id);
    if (v.date && (!b.from || v.date < b.from)) b.from = v.date;
    if (v.date && (!b.to || v.date > b.to)) b.to = v.date;
  }
  return [...byTag.values()].sort((a, b) => String(b.from || '').localeCompare(String(a.from || '')));
}
