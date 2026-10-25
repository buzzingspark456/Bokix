// Läser säkerhetskopian utanför Supabase (api/_offsiteBackup.js) och sparar
// den dekrypterad på den här datorn. Skriver ALDRIG till Supabase: att lägga
// tillbaka data görs medvetet för hand, ett konto i taget.
//
// Kräver samma OFFSITE_S3_* och BACKUP_ENCRYPTION_KEY som i Vercel, i .env.
//
//   node scripts/restore-offsite-backup.mjs status
//       senaste körningen, antal filer och vilka databasdumpar som finns
//   node scripts/restore-offsite-backup.mjs db [YYYY-MM-DD] [ut.json]
//       hela databasdumpen (senaste om inget datum anges)
//   node scripts/restore-offsite-backup.mjs user <user_id> [YYYY-MM-DD]
//       ett kontos user_data-rad, klar att klistra in i Supabase. Är kontot
//       i tabelläget följer dess rader i companies/company_records med, och
//       state_from_tables: kontot byggt ur tabellerna. För 'tables_only' är
//       det den riktiga bokföringen; blobbens företag där är en gammal kopia.
//   node scripts/restore-offsite-backup.mjs files <user_id> [mapp]
//       ett kontos filer (kvitton, underlag, arkiv) till en mapp
import fs from 'fs';
import path from 'path';
import { readBackupConfig, createOffsiteStore, unpackJson, decrypt, readDatabaseDump } from '../api/_offsiteBackup.js';
import { buildCompany } from '../src/utils/companyTables.js';

function loadDotEnv() {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

loadDotEnv();
const config = readBackupConfig();
if (config.missing.length) {
  console.error(`Saknas i .env: ${config.missing.join(', ')}`);
  process.exit(1);
}
const store = createOffsiteStore(config);
const [command, ...args] = process.argv.slice(2);

async function manifest() {
  const blob = await store.get('manifest.json.gz.enc');
  if (!blob) throw new Error('Ingen kopia hittades (manifest.json.gz.enc saknas).');
  return unpackJson(blob, config.key);
}

async function loadDump(date) {
  const day = date || (await manifest()).dumps.at(-1);
  const dump = await readDatabaseDump(store, config.key, day);
  if (!dump) throw new Error(`Ingen databasdump för ${day}.`);
  return { day, dump };
}

if (command === 'status') {
  const m = await manifest();
  const missing = Object.values(m.files).filter(f => f.missingSince).length;
  console.log(`Senast uppdaterad: ${m.updatedAt}`);
  console.log(`Databasdumpar: ${m.dumps.join(', ')}`);
  console.log(`Filer: ${Object.keys(m.files).length} (varav ${missing} borttagna i Supabase, sparas 30 dagar)`);
} else if (command === 'db') {
  const { day, dump } = await loadDump(args[0]);
  const out = args[1] || `bokix-db-${day}.json`;
  fs.writeFileSync(out, JSON.stringify(dump, null, 2));
  const counts = Object.entries(dump.tables).map(([t, rows]) => `${t}: ${rows.length}`).join(', ');
  console.log(`Sparad i ${out}. ${dump.users.length} konton. ${counts}`);
} else if (command === 'user' && args[0]) {
  const { day, dump } = await loadDump(args[1]);
  const row = dump.tables.user_data.find(r => r.user_id === args[0]);
  if (!row) throw new Error(`Kontot ${args[0]} finns inte i dumpen från ${day}.`);
  const mode = (dump.tables.storage_modes || []).find(r => r.user_id === args[0])?.mode || 'blob';
  const companies = (dump.tables.companies || []).filter(c => c.owner_user_id === args[0]);
  const ids = new Set(companies.map(c => c.id));
  const records = (dump.tables.company_records || []).filter(r => ids.has(r.company_id));
  const result = { mode, user_data: row };
  if (mode !== 'blob') {
    const live = companies.filter(c => !c.deleted_at);
    result.state_from_tables = {
      ...row.state,
      companies: Object.fromEntries(live.map(c => [c.legacy_key, buildCompany(c, records.filter(r => r.company_id === c.id && !r.deleted_at))])),
    };
    result.companies = companies;
    result.company_records = records;
  }
  const out = `bokix-user-${args[0]}-${day}.json`;
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`Sparad i ${out} (från ${day}, läge ${mode}${mode === 'tables_only' ? ': använd state_from_tables, blobbens företag är gamla' : ''}).`);
} else if (command === 'files' && args[0]) {
  const dir = args[1] || `bokix-filer-${args[0]}`;
  const ids = Object.keys((await manifest()).files).filter(id => id.split('/')[1] === args[0]);
  for (const id of ids) {
    const blob = await store.get(`files/${id}.enc`);
    if (!blob) { console.warn(`Saknas: ${id}`); continue; }
    const target = path.join(dir, id);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, decrypt(blob, config.key));
  }
  console.log(`${ids.length} filer sparade i ${dir}.`);
} else {
  console.log('Användning: status | db [datum] [ut.json] | user <user_id> [datum] | files <user_id> [mapp]');
  process.exit(command ? 1 : 0);
}
