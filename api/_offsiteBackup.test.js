import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { encrypt, decrypt, packJson, unpackJson, readBackupConfig, runOffsiteBackup, readDatabaseDump } from './_offsiteBackup.js'

const KEY = randomBytes(32)
const DAY = 24 * 60 * 60 * 1000

function makeStore() {
  const objects = new Map()
  return {
    objects,
    put: async (path, body) => { objects.set(path, Buffer.from(body)) },
    get: async (path) => objects.get(path) || null,
    del: async (path) => { objects.delete(path) },
  }
}

/** Precis så mycket av Supabase-admin-klienten som kopian använder. */
function makeAdmin({ tables = {}, files = {} } = {}) {
  const buckets = new Map(Object.entries(files).map(([b, f]) => [b, new Map(Object.entries(f))]))
  return {
    buckets,
    from(table) {
      const rows = tables[table] || []
      const q = { select: () => q, order: () => q, range: (a, b) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }) }
      return q
    },
    auth: { admin: { listUsers: async () => ({ data: { users: [{ id: 'u1', email: 'a@b.se', created_at: '2026-01-01' }] }, error: null }) } },
    storage: {
      from(name) {
        const b = buckets.get(name)
        return {
          list: async (prefix) => {
            if (!b) return { data: null, error: { message: 'Bucket not found' } }
            const pre = prefix ? `${prefix}/` : ''
            const names = new Map()
            for (const [key, file] of b) {
              if (!key.startsWith(pre)) continue
              const [first, ...more] = key.slice(pre.length).split('/')
              names.set(first, more.length ? null : file)
            }
            return { data: [...names].map(([n, f]) => (f ? { name: n, id: n, updated_at: f.v } : { name: n, id: null })), error: null }
          },
          download: async (path) => ({ data: { arrayBuffer: async () => Buffer.from(b.get(path).body) }, error: null }),
        }
      },
    },
  }
}

describe('kryptering', () => {
  it('går fram och tillbaka och avslöjar inte innehållet', () => {
    const blob = encrypt(Buffer.from('hemlig bokföring'), KEY)
    expect(blob.toString('latin1')).not.toContain('hemlig')
    expect(decrypt(blob, KEY).toString()).toBe('hemlig bokföring')
    expect(unpackJson(packJson({ a: [1, 2] }, KEY), KEY)).toEqual({ a: [1, 2] })
  })

  it('vägrar fel nyckel och ändrade data', () => {
    const blob = encrypt(Buffer.from('x'), KEY)
    expect(() => decrypt(blob, randomBytes(32))).toThrow()
    blob[blob.length - 20] ^= 1
    expect(() => decrypt(blob, KEY)).toThrow()
  })
})

describe('readBackupConfig', () => {
  it('listar det som saknas och kräver en 32-bytes nyckel', () => {
    expect(readBackupConfig({}).missing).toHaveLength(5)
    const env = { OFFSITE_S3_ENDPOINT: 'https://x', OFFSITE_S3_BUCKET: 'b', OFFSITE_S3_ACCESS_KEY_ID: 'k', OFFSITE_S3_SECRET_ACCESS_KEY: 's', BACKUP_ENCRYPTION_KEY: 'kort' }
    expect(readBackupConfig(env).missing[0]).toMatch(/32 byte/)
    expect(readBackupConfig({ ...env, BACKUP_ENCRYPTION_KEY: KEY.toString('base64') }).missing).toEqual([])
  })
})

describe('runOffsiteBackup', () => {
  const now = new Date('2026-10-01T02:00:00Z')

  it('sparar databasen och alla filer krypterat, men inte nattkopiorna', async () => {
    const admin = makeAdmin({
      tables: { user_data: [{ id: '1', user_id: 'u1', state: { companies: {} } }] },
      files: {
        'bokix-uploads': { 'u1/files/kvitto.jpg': { v: 't1', body: 'JPG' } },
        'bokix-arkiv': { 'u1/_kopior/dag.json.gz': { v: 't1', body: 'K' }, 'u1/foretag.zip': { v: 't1', body: 'ZIP' } },
      },
    })
    const store = makeStore()
    const summary = await runOffsiteBackup(admin, store, KEY, { now })
    expect(summary.errors).toEqual([])
    expect(summary.filesCopied).toBe(2)

    const dump = await readDatabaseDump(store, KEY, '2026-10-01')
    expect(dump.tables.user_data[0].user_id).toBe('u1')
    expect(dump.users[0].email).toBe('a@b.se')
    expect(decrypt(store.objects.get('files/bokix-uploads/u1/files/kvitto.jpg.enc'), KEY).toString()).toBe('JPG')
    expect([...store.objects.keys()].some(k => k.includes('_kopior'))).toBe(false)
  })

  it('kopierar bara nytt eller ändrat nästa natt', async () => {
    const admin = makeAdmin({ files: { 'bokix-uploads': { 'u1/a.jpg': { v: 't1', body: 'A' } } } })
    const store = makeStore()
    await runOffsiteBackup(admin, store, KEY, { now })
    expect((await runOffsiteBackup(admin, store, KEY, { now })).filesCopied).toBe(0)
    admin.buckets.get('bokix-uploads').set('u1/a.jpg', { v: 't2', body: 'A2' })
    expect((await runOffsiteBackup(admin, store, KEY, { now })).filesCopied).toBe(1)
    expect(decrypt(store.objects.get('files/bokix-uploads/u1/a.jpg.enc'), KEY).toString()).toBe('A2')
  })

  it('raderar en borttagen fil först efter 30 dagar', async () => {
    const admin = makeAdmin({ files: { 'bokix-uploads': { 'u1/a.jpg': { v: 't1', body: 'A' } } } })
    const store = makeStore()
    await runOffsiteBackup(admin, store, KEY, { now })
    admin.buckets.get('bokix-uploads').delete('u1/a.jpg')
    await runOffsiteBackup(admin, store, KEY, { now: new Date(now.getTime() + DAY) })
    await runOffsiteBackup(admin, store, KEY, { now: new Date(now.getTime() + 20 * DAY) })
    expect(store.objects.has('files/bokix-uploads/u1/a.jpg.enc')).toBe(true)
    const late = await runOffsiteBackup(admin, store, KEY, { now: new Date(now.getTime() + 32 * DAY) })
    expect(late.filesDeleted).toBe(1)
    expect(store.objects.has('files/bokix-uploads/u1/a.jpg.enc')).toBe(false)
  })

  it('raderar inget när en bucket inte gick att lista', async () => {
    const admin = makeAdmin({ files: { 'bokix-uploads': { 'u1/a.jpg': { v: 't1', body: 'A' } } } })
    const store = makeStore()
    await runOffsiteBackup(admin, store, KEY, { now })
    admin.buckets.delete('bokix-uploads')
    await runOffsiteBackup(admin, store, KEY, { now: new Date(now.getTime() + DAY) })
    await runOffsiteBackup(admin, store, KEY, { now: new Date(now.getTime() + 40 * DAY) })
    expect(store.objects.has('files/bokix-uploads/u1/a.jpg.enc')).toBe(true)
  })

  it('gallrar databasdumpar äldre än 35 dagar', async () => {
    const admin = makeAdmin()
    const store = makeStore()
    await runOffsiteBackup(admin, store, KEY, { now })
    await runOffsiteBackup(admin, store, KEY, { now: new Date(now.getTime() + 40 * DAY) })
    expect([...store.objects.keys()].some(k => k.startsWith('db/2026-10-01/'))).toBe(false)
    expect(store.objects.has('db/2026-11-10/index.json.gz.enc')).toBe(true)
  })

  it('delar upp stora tabeller i bitar och läser tillbaka allt', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ id: String(i).padStart(3, '0'), user_id: 'u' + i, state: {} }))
    const admin = makeAdmin({ tables: { user_data: rows } })
    const store = makeStore()
    await runOffsiteBackup(admin, store, KEY, { now })
    expect([...store.objects.keys()].filter(k => k.startsWith('db/2026-10-01/user_data-'))).toHaveLength(3)
    expect((await readDatabaseDump(store, KEY, '2026-10-01')).tables.user_data).toHaveLength(120)
  })

  it('läser även en dump i det gamla formatet', async () => {
    const store = makeStore()
    await store.put('db/2026-09-01.json.gz.enc', packJson({ users: [], tables: { user_data: [{ id: '1' }] } }, KEY))
    expect((await readDatabaseDump(store, KEY, '2026-09-01')).tables.user_data).toHaveLength(1)
  })

  it('stannar vid tidsgränsen och tar resten nästa natt', async () => {
    const admin = makeAdmin({ files: { 'bokix-uploads': { 'u1/a.jpg': { v: 't1', body: 'A' }, 'u1/b.jpg': { v: 't1', body: 'B' } } } })
    const store = makeStore()
    const first = await runOffsiteBackup(admin, store, KEY, { now, deadline: 0 })
    expect(first).toMatchObject({ filesCopied: 0, filesPending: 2 })
    expect((await runOffsiteBackup(admin, store, KEY, { now })).filesCopied).toBe(2)
  })
})

// Skyddsnät: en ny tabell i någon supabase-*.sql måste antingen säkerhetskopieras
// (TABLES) eller uttryckligen hoppas över här, annars fallerar testet.
describe('TABLES täcker databasen', () => {
  const SKIPPED = new Set([
    'system_events', // driftloggar, återskapas av sig själva
    'blog_posts', // finns kvar i supabase-setup.sql men är borttagen ur databasen (2026-10)
  ])
  it('varje tabell i SQL-filerna finns i nattkopian eller är medvetet överhoppad', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { TABLES } = await import('./_offsiteBackup.js')
    const root = path.resolve(import.meta.dirname, '..')
    const sql = fs.readdirSync(root).filter(f => /^supabase-.*\.sql$/.test(f)).map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')
    const created = new Set([...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)/gi)].map(m => m[1].toLowerCase()))
    expect(created.size).toBeGreaterThan(5)
    const missing = [...created].filter(t => !TABLES.includes(t) && !SKIPPED.has(t))
    expect(missing, `Lägg till i TABLES (api/_offsiteBackup.js) eller i SKIPPED: ${missing.join(', ')}`).toEqual([])
  })
})
