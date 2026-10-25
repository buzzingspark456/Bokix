// Tabelläget (steg 4a, supabase-2026-10-25-steg-4a.sql): kontot läser sina
// företag med load_companies() och sparar med save_company_changes(), med
// krockkontroll per post i stället för på hela kontot.
//
// Den här filen är ren logik utan nätverk, så den går att testa för sig:
//   - assembleCompany sätter ihop ett företag ur databasens delar, i exakt
//     samma form som i blobben;
//   - versionsFromPayload / expectedFor håller reda på vilken version appen
//     har sett av varje post och företagsrad, och vad en ändringslista ska
//     skicka med som "så här såg det ut när jag läste";
//   - mergeVersions lägger in de nya versionerna efter en lyckad sparning.

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Ett företag i blobbens form ur ett company_payload (se SQL-filen). */
export function assembleCompany(payload) {
  const company = { ...(isPlainObject(payload?.extra) ? payload.extra : {}) };
  if (payload?.has_settings) company.company = payload.settings;
  if (payload?.has_accounts) company.accounts = payload.accounts;
  const lists = isPlainObject(payload?.lists) ? payload.lists : {};
  for (const kind of payload?.list_fields || []) company[kind] = Array.isArray(lists[kind]) ? lists[kind] : [];
  return company;
}

/**
 * Versionerna i ett company_payload som en karta:
 * { company: <version>, records: { <lista>: { <id>: <version> } } }.
 */
export function versionsFromPayload(payload) {
  const lists = isPlainObject(payload?.lists) ? payload.lists : {};
  const versions = isPlainObject(payload?.versions) ? payload.versions : {};
  const records = {};
  for (const kind of payload?.list_fields || []) {
    const list = Array.isArray(lists[kind]) ? lists[kind] : [];
    const vs = Array.isArray(versions[kind]) ? versions[kind] : [];
    records[kind] = {};
    list.forEach((rec, i) => { if (rec && rec.id != null) records[kind][String(rec.id)] = vs[i]; });
  }
  return { company: payload?.version ?? null, records };
}

/** Hela load_companies-svaret → { state, versions, updatedAt }. */
export function fromLoadResult(result) {
  const companies = {};
  const versions = {};
  for (const [key, payload] of Object.entries(result?.companies || {})) {
    companies[key] = assembleCompany(payload);
    versions[key] = versionsFromPayload(payload);
  }
  return { state: { ...(isPlainObject(result?.top) ? result.top : {}), companies }, versions, updatedAt: result?.updated_at ?? null };
}

/**
 * Vad save_company_changes ska få som p_expected för en ändringslista (ops
 * från buildStateDelta): för varje post som rörs dess version, för en hel
 * lista som byts alla versioner, och för allt annat företagsradens version.
 * En post appen inte har sett (ny) skickas inte med.
 */
export function expectedFor(ops, versions) {
  const expected = {};
  const entry = (key) => (expected[key] ||= {});
  for (const op of ops || []) {
    const path = op?.path || [];
    if (path[0] !== 'companies' || path.length < 2) continue;
    const key = String(path[1]);
    const known = versions?.[key];
    if (!known) continue; // nytt företag
    if (path.length === 2) { entry(key).company = known.company; continue; }
    const field = String(path[2]);
    const recs = known.records?.[field];
    if (recs && path.length === 3 && op.op === 'patch') {
      const ids = [...(op.upsert || []).map(e => e?.id), ...(op.remove || [])].filter(id => id != null).map(String);
      const target = ((entry(key).records ||= {})[field] ||= {});
      for (const id of ids) if (recs[id] != null) target[id] = recs[id];
    } else if (recs && path.length === 3 && (op.op === 'set' || op.op === 'unset')) {
      (entry(key).records ||= {})[field] = { ...recs };
    } else {
      entry(key).company = known.company;
    }
  }
  return expected;
}

/**
 * Efter en lyckad sparning: nya versioner in (svaret från
 * save_company_changes), borttagna poster och företag ut.
 */
export function mergeVersions(versions, ops, returned) {
  const next = { ...(versions || {}) };
  for (const op of ops || []) {
    const path = op?.path || [];
    if (path[0] !== 'companies' || path.length < 2) continue;
    const key = String(path[1]);
    if (path.length === 2 && op.op === 'unset') { delete next[key]; continue; }
    if (path.length === 3 && op.op === 'patch' && next[key]?.records?.[path[2]]) {
      const recs = { ...next[key].records[path[2]] };
      for (const id of op.remove || []) delete recs[String(id)];
      next[key] = { ...next[key], records: { ...next[key].records, [path[2]]: recs } };
    }
    // En hel lista bytt: bara posterna i den nya listan finns kvar.
    if (path.length === 3 && op.op === 'set' && Array.isArray(op.value) && next[key]?.records?.[path[2]]) {
      const keep = new Set(op.value.filter(e => e && e.id != null).map(e => String(e.id)));
      const recs = Object.fromEntries(Object.entries(next[key].records[path[2]]).filter(([id]) => keep.has(id)));
      next[key] = { ...next[key], records: { ...next[key].records, [path[2]]: recs } };
    }
    if (path.length === 3 && op.op === 'unset' && next[key]?.records) {
      const { [path[2]]: _gone, ...rest } = next[key].records;
      next[key] = { ...next[key], records: rest };
    }
  }
  for (const [key, v] of Object.entries(returned || {})) {
    const prev = next[key] || { company: null, records: {} };
    const records = { ...prev.records };
    for (const [kind, ids] of Object.entries(v?.records || {})) records[kind] = { ...(records[kind] || {}), ...ids };
    next[key] = { company: v?.company ?? prev.company, records };
  }
  return next;
}

/**
 * Läser kontots företag ur tabellerna. Ger { state, versions, updatedAt },
 * eller kastar (anroparen faller då tillbaka på blobben).
 */
export async function loadFromTables(supabase) {
  const { data, error } = await supabase.rpc('load_companies');
  if (error) throw new Error(`load_companies: ${error.message}`);
  if (!data || typeof data !== 'object') throw new Error('load_companies: tomt svar');
  return fromLoadResult(data);
}

/**
 * Sparar en ändringslista (ops från buildStateDelta) med krockkontroll per
 * post. Ger { updatedAt, versions } när det sparats, { conflicts } när någon
 * annan har ändrat samma sak (inget skrevs), eller { error } när det inte
 * gick alls (anroparen sparar då som förut).
 */
export async function saveToTables(supabase, ops, versions) {
  const { data, error } = await supabase.rpc('save_company_changes', { p_ops: ops, p_expected: expectedFor(ops, versions) });
  if (error) return { error };
  if (!data?.ok) return { conflicts: Array.isArray(data?.conflicts) ? data.conflicts : [] };
  return { updatedAt: data.updated_at, versions: mergeVersions(versions, ops, data.versions) };
}
