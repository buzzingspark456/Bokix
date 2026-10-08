// Trevägssammanslagning av ett företags state när servern ändrats sedan vi
// senast synkade (annan enhet, en inbjuden redovisningskonsult via
// set_company_field, eller påminnelse-cronen). base = det servern hade vid
// förra synken, local = det som visas här nu, server = det som ligger där nu.
// Det som ändrats här vinner, annars gäller servern. Listor av poster med id
// (verifikationer, fakturor, kvitton …) slås ihop post för post, så att två
// personer som lägger till var sin verifikation båda får behålla sin.

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

const isRecordList = (v) => Array.isArray(v) && v.every(x => x && typeof x === 'object' && !Array.isArray(x) && x.id != null);

function mergeRecordLists(base, local, server) {
  const byId = (list) => new Map((Array.isArray(list) ? list : []).map(x => [String(x.id), x]));
  const b = byId(base);
  const l = byId(local);
  const s = byId(server);
  const pick = (id) => {
    const inB = b.has(id); const inL = l.has(id); const inS = s.has(id);
    if (inL && inS) return same(l.get(id), b.get(id)) ? s.get(id) : l.get(id);
    if (inL) return inB && same(l.get(id), b.get(id)) ? undefined : l.get(id); // borttagen på servern, om inte ändrad här
    if (inS) return inB ? undefined : s.get(id); // borttagen här, eller ny på servern
    return undefined;
  };
  // Serverns ordning först, sedan det som bara finns här (nya poster).
  const out = [];
  const seen = new Set();
  for (const id of [...s.keys(), ...l.keys()]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const v = pick(id);
    if (v !== undefined) out.push(v);
  }
  return out;
}

export function mergeField(base, local, server) {
  if (same(local, base)) return server;
  if (same(server, base)) return local;
  if (isRecordList(local) && isRecordList(server) && (base == null || isRecordList(base))) {
    return mergeRecordLists(base, local, server);
  }
  return local;
}

export function mergeCompany(base, local, server) {
  if (!server) return local;
  if (!base) return local;
  const out = { ...server };
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(server), ...Object.keys(base)]);
  for (const key of keys) {
    if (key.startsWith('__')) {
      if (local && key in local) out[key] = local[key];
      continue;
    }
    const v = mergeField(base[key], local?.[key], server[key]);
    if (v === undefined) delete out[key]; else out[key] = v;
  }
  return out;
}

// Hela företagslistan: nya företag på servern tas med, företag som tagits
// bort här (fanns vid förra synken men inte nu) tas inte tillbaka.
export function mergeCompanies(baseCompanies = {}, localCompanies = {}, serverCompanies = {}) {
  const out = {};
  for (const [id, local] of Object.entries(localCompanies)) {
    out[id] = mergeCompany(baseCompanies[id], local, serverCompanies[id]);
  }
  for (const [id, server] of Object.entries(serverCompanies)) {
    if (id in out || id in baseCompanies) continue;
    out[id] = server;
  }
  return out;
}

// En inbjuden medlems sparning skickar bara de poster som ändrats i en lista
// (api/company-access.js), inte hela listan: med åren blir t.ex. alla
// verifikationer för stora för ett anrop. Jämförelsen är på referens, eftersom
// appen alltid byter ut en ändrad post i stället för att ändra den på plats.
export function makeRecordPatch(before, after) {
  if (!isRecordList(before) || !isRecordList(after)) return null;
  const old = new Map(before.map(x => [String(x.id), x]));
  const upsert = after.filter(x => old.get(String(x.id)) !== x);
  const keep = new Set(after.map(x => String(x.id)));
  const remove = before.filter(x => !keep.has(String(x.id))).map(x => x.id);
  return { upsert, remove };
}

export function applyRecordPatch(current, { upsert = [], remove = [] }) {
  const list = Array.isArray(current) ? current : [];
  const removed = new Set(remove.map(String));
  const changed = new Map(upsert.map(x => [String(x.id), x]));
  const out = [];
  for (const x of list) {
    const id = String(x?.id);
    if (removed.has(id)) continue;
    if (changed.has(id)) { out.push(changed.get(id)); changed.delete(id); } else out.push(x);
  }
  return [...out, ...changed.values()];
}
