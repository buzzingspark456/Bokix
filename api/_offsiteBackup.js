import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { AwsClient } from 'aws4fetch';

// Säkerhetskopia UTANFÖR Supabase. Nattkopiorna i _archive.js ligger i
// samma Supabase-projekt som originalet, och gratisplanen har inga egna
// backuper: raderas projektet eller kapas kontot försvinner båda. Den här
// filen kopierar varje natt till en S3-kompatibel lagring hos en annan
// leverantör (Cloudflare R2 med EU-jurisdiktion, Backblaze B2 i Amsterdam
// eller liknande, inom EU):
//
//   db/YYYY-MM-DD/<tabell>-NNNN.json.gz.enc
//                               alla tabeller + användarlistan, en mapp per
//                               natt i bitar, så att minnet räcker även med
//                               många kunder. index.json.gz.enc i mappen
//                               listar bitarna. De senaste DB_KEEP_DAYS
//                               dagarna sparas. (Före 2026-10-08: en enda
//                               db/YYYY-MM-DD.json.gz.enc, läses fortfarande.)
//   files/<bucket>/<sökväg>.enc varje fil i lagringsbuckets, kopieras en
//                               gång och igen när den ändrats
//   manifest.json.gz.enc        vilka filer som kopierats
//
// Allt krypteras med AES-256-GCM innan det lämnar servern, med nyckeln i
// BACKUP_ENCRYPTION_KEY. Lagringsleverantören ser alltså bara brus. Utan
// nyckeln går kopian inte att läsa: spara den även utanför Vercel (t.ex. i
// en lösenordshanterare). Återställning: scripts/restore-offsite-backup.mjs.
//
// En fil som tagits bort i Supabase (konto raderat, sjuårstiden ute) tas
// bort här också, men först efter FILE_GRACE_DAYS dagar, så att en
// oavsiktlig radering fortfarande går att ångra ur kopian.

const DB_KEEP_DAYS = 35;
const FILE_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// En ny tabell med data som inte går att återskapa ska läggas till HÄR, annars
// följer den inte med i nattkopian (inkorgstabellerna och inloggnings-/
// säkerhetsloggarna saknades, upptäckt vid återställningstestet 2026-10-05).
// Testet i _offsiteBackup.test.js jämför listan med tabellerna i SQL-filerna.
// system_events (driftloggar) hoppas medvetet över.
export const TABLES = [
  'user_data', 'user_data_history', 'subscriptions', 'company_members', 'email_senders',
  'stripe_payment_events', 'stripe_ledger_events', 'zettle_ledger_events',
  'audit_log', 'contact_messages', 'cron_progress',
  'inbox_addresses', 'inbox_items', 'login_events', 'security_events',
  // Statussidans meddelanden (skrivna för hand). Kontrollerna och dagssummorna
  // (status_checks, status_daily) är mätdata och hoppas över.
  'status_incidents',
];

// Nattkopiorna (_kopior) hoppas över: de är redan med i databasdumpen.
const BUCKETS = [
  { id: 'bokix-uploads' },
  { id: 'bokix-arkiv', skip: path => path.split('/').includes('_kopior') },
  { id: 'companylogo' },
  { id: 'profile' },
  { id: 'blogimages' },
];

const MAGIC = Buffer.from('BKX1');

export function encrypt(plain, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, body, cipher.getAuthTag()]);
}

export function decrypt(blob, key) {
  if (!blob.subarray(0, 4).equals(MAGIC)) throw new Error('Inte en Bokix-kopia (fel format).');
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(blob.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(16, blob.length - 16)), decipher.final()]);
}

export const packJson = (value, key) => encrypt(gzipSync(Buffer.from(JSON.stringify(value))), key);
export const unpackJson = (blob, key) => JSON.parse(gunzipSync(decrypt(blob, key)).toString('utf8'));

/** Läser inställningarna ur miljövariablerna. `missing` listar det som fattas. */
export function readBackupConfig(env = process.env) {
  const names = ['OFFSITE_S3_ENDPOINT', 'OFFSITE_S3_BUCKET', 'OFFSITE_S3_ACCESS_KEY_ID', 'OFFSITE_S3_SECRET_ACCESS_KEY', 'BACKUP_ENCRYPTION_KEY'];
  const missing = names.filter(n => !env[n]);
  if (missing.length) return { missing };
  const key = Buffer.from(env.BACKUP_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) return { missing: ['BACKUP_ENCRYPTION_KEY (ska vara 32 byte i base64, t.ex. från `openssl rand -base64 32`)'] };
  return {
    missing: [],
    key,
    endpoint: env.OFFSITE_S3_ENDPOINT.replace(/\/+$/, ''),
    bucket: env.OFFSITE_S3_BUCKET,
    accessKeyId: env.OFFSITE_S3_ACCESS_KEY_ID,
    secretAccessKey: env.OFFSITE_S3_SECRET_ACCESS_KEY,
    region: env.OFFSITE_S3_REGION || 'auto',
  };
}

/** Minimal S3-klient (path-style: endpoint/bucket/nyckel). */
export function createOffsiteStore(config) {
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: config.region,
  });
  const url = (path) => `${config.endpoint}/${config.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  return {
    async put(path, body) {
      const res = await aws.fetch(url(path), { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream' } });
      if (!res.ok) throw new Error(`PUT ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    },
    async get(path) {
      const res = await aws.fetch(url(path), { method: 'GET' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
    async del(path) {
      const res = await aws.fetch(url(path), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`DELETE ${path}: ${res.status}`);
    },
  };
}

// user_data-raderna är stora (ett helt företags bokföring var), så de läses
// och sparas färre åt gången.
const pageSizeFor = (table) => (table === 'user_data' ? 50 : 1000);

// Läser en tabell bit för bit och lämnar varje bit till onPage, så att hela
// tabellen aldrig ligger i minnet samtidigt.
async function forEachPage(admin, table, onPage) {
  const PAGE = pageSizeFor(table);
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select('*').order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data?.length) await onPage(data);
    if (!data || data.length < PAGE) break;
  }
}

// Konton (id, e-post, metadata) behövs för att kunna koppla ihop raderna
// med rätt person vid en återställning. Lösenord kan inte läsas ut och
// följer inte med: efter en total återställning får alla välja nytt.
async function readAllUsers(admin) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth.users: ${error.message}`);
    const batch = data?.users || [];
    users.push(...batch.map(u => ({
      id: u.id, email: u.email, phone: u.phone, created_at: u.created_at,
      email_confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at,
      user_metadata: u.user_metadata, app_metadata: u.app_metadata,
    })));
    if (batch.length < 1000) break;
  }
  return users;
}

// Skriver nattens dump bit för bit till db/<datum>/ och returnerar
// { parts, bytes }. parts listar varje sparad bit (för gallringen).
export async function writeDatabaseDump(admin, store, key, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const index = { format: 'bokix-offsite-2', createdAt: now.toISOString(), users: [], tables: {} };
  const parts = [];
  let bytes = 0;
  const putPart = async (name, rows) => {
    const path = `db/${day}/${name}.json.gz.enc`;
    const blob = packJson(rows, key);
    await store.put(path, blob);
    parts.push(path);
    bytes += blob.length;
    return path;
  };
  for (const table of TABLES) {
    index.tables[table] = [];
    let n = 0;
    await forEachPage(admin, table, async (rows) => {
      index.tables[table].push(await putPart(`${table}-${String(n++).padStart(4, '0')}`, rows));
    });
  }
  const users = await readAllUsers(admin);
  for (let i = 0; i < users.length; i += 1000) {
    index.users.push(await putPart(`users-${String(i / 1000).padStart(4, '0')}`, users.slice(i, i + 1000)));
  }
  // Index sist: finns det är dumpen komplett.
  const indexPath = `db/${day}/index.json.gz.enc`;
  const indexBlob = packJson(index, key);
  await store.put(indexPath, indexBlob);
  parts.push(indexPath);
  bytes += indexBlob.length;
  return { parts, bytes };
}

// Läser en natts dump (båda formaten) som { users, tables }. Används vid
// återställning på en dator (scripts/restore-offsite-backup.mjs).
export async function readDatabaseDump(store, key, day) {
  const indexBlob = await store.get(`db/${day}/index.json.gz.enc`);
  if (!indexBlob) {
    const old = await store.get(`db/${day}.json.gz.enc`);
    return old ? unpackJson(old, key) : null;
  }
  const index = unpackJson(indexBlob, key);
  const readParts = async (paths) => {
    const rows = [];
    for (const path of paths) {
      const blob = await store.get(path);
      if (!blob) throw new Error(`Saknad del av dumpen: ${path}`);
      rows.push(...unpackJson(blob, key));
    }
    return rows;
  };
  const tables = {};
  for (const [table, paths] of Object.entries(index.tables)) tables[table] = await readParts(paths);
  return { format: index.format, createdAt: index.createdAt, users: await readParts(index.users), tables };
}

// Alla filer i en bucket, rekursivt. Mappar saknar id i Supabase-listan.
async function listBucket(admin, bucket, prefix = '') {
  const files = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`lista ${bucket}/${prefix}: ${error.message}`);
    for (const item of data || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) files.push(...await listBucket(admin, bucket, path));
      else files.push({ path, version: item.updated_at || item.created_at || String(item.metadata?.size ?? '') });
    }
    if (!data || data.length < PAGE) break;
  }
  return files;
}

/**
 * Hela nattkörningen. Databasdumpen först (den viktigaste), sedan filerna
 * tills tidsbudgeten är slut; resten tas nästa natt eftersom manifestet
 * minns vad som redan är kopierat.
 */
export async function runOffsiteBackup(admin, store, key, { now = new Date(), deadline = Date.now() + 200_000 } = {}) {
  const today = now.toISOString().slice(0, 10);
  const summary = { dbBytes: 0, filesCopied: 0, filesDeleted: 0, filesPending: 0, errors: [] };

  const manifest = (await store.get('manifest.json.gz.enc').then(b => (b ? unpackJson(b, key) : null))) || { dumps: [], files: {} };

  // Körs samma dag igen: dagens gamla bitar bort först, så att inga blir
  // kvar om antalet rader minskat.
  manifest.dumpParts = manifest.dumpParts || {};
  for (const path of manifest.dumpParts[today] || []) {
    try { await store.del(path); } catch (err) { summary.errors.push(err.message); }
  }
  const { parts, bytes } = await writeDatabaseDump(admin, store, key, now);
  manifest.dumpParts[today] = parts;
  summary.dbBytes = bytes;
  manifest.dumps = [...new Set([...(manifest.dumps || []), today])].sort();
  const cutoff = new Date(now.getTime() - DB_KEEP_DAYS * DAY_MS).toISOString().slice(0, 10);
  for (const date of manifest.dumps.filter(d => d < cutoff)) {
    try {
      for (const path of manifest.dumpParts[date] || [`db/${date}.json.gz.enc`]) await store.del(path);
      manifest.dumps = manifest.dumps.filter(d => d !== date);
      delete manifest.dumpParts[date];
    } catch (err) {
      summary.errors.push(err.message);
    }
  }

  const seen = new Set();
  for (const bucket of BUCKETS) {
    let files;
    try {
      files = await listBucket(admin, bucket.id);
    } catch (err) {
      // Bucketen finns inte (ännu): inget att kopiera, men allt annat fortsätter.
      if (!/not.?found/i.test(err.message)) summary.errors.push(err.message);
      // Gick listningen inte att göra räknas bucketens kopior som kvar, så
      // ett tillfälligt fel aldrig leder till att något raderas här.
      for (const id of Object.keys(manifest.files)) if (id.startsWith(`${bucket.id}/`)) seen.add(id);
      continue;
    }
    for (const file of files) {
      if (bucket.skip?.(file.path)) continue;
      const id = `${bucket.id}/${file.path}`;
      seen.add(id);
      const entry = manifest.files[id];
      if (entry && entry.version === file.version) {
        delete entry.missingSince;
        continue;
      }
      if (Date.now() > deadline) {
        summary.filesPending += 1;
        continue;
      }
      try {
        const { data, error } = await admin.storage.from(bucket.id).download(file.path);
        if (error) throw new Error(`hämta ${id}: ${error.message}`);
        await store.put(`files/${id}.enc`, encrypt(Buffer.from(await data.arrayBuffer()), key));
        manifest.files[id] = { version: file.version, copiedAt: now.toISOString() };
        summary.filesCopied += 1;
      } catch (err) {
        summary.errors.push(err.message);
      }
    }
  }

  // Borttagna i Supabase: markera, och radera kopian först efter FILE_GRACE_DAYS.
  for (const [id, entry] of Object.entries(manifest.files)) {
    if (seen.has(id)) continue;
    if (!entry.missingSince) {
      entry.missingSince = now.toISOString();
      continue;
    }
    if (now.getTime() - new Date(entry.missingSince).getTime() < FILE_GRACE_DAYS * DAY_MS) continue;
    try {
      await store.del(`files/${id}.enc`);
      delete manifest.files[id];
      summary.filesDeleted += 1;
    } catch (err) {
      summary.errors.push(err.message);
    }
  }

  manifest.updatedAt = now.toISOString();
  await store.put('manifest.json.gz.enc', packJson(manifest, key));
  summary.filesTotal = Object.keys(manifest.files).length;
  return summary;
}
