// Inkorgens webhook mot påhittade Resend- och Supabase-svar.
import { createHmac } from 'node:crypto';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const db = { addresses: [{ id: 'a1', owner_user_id: 'u1', company_id: 'c1', token: 'bokixab-abcdefg' }], items: [], uploads: [], updates: [] };
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    const q = (table) => {
      const st = { table, filters: [] };
      const api = {
        select() { return api; }, in(c, v) { st.filters.push(['in', c, v]); return api; }, eq() { return api; }, or() { return api; }, limit() { return api; },
        update(v) { db.updates.push([table, v]); return api; },
        insert(row) { db.items.push(row); return Promise.resolve({ error: null }); },
        then(res) {
          if (table === 'inbox_addresses') return res({ data: db.addresses.filter(a => st.filters.every(([, c, v]) => c !== 'token' || v.includes(a.token))) });
          if (table === 'inbox_items') return res({ data: db.items.length ? [{ id: 'x' }] : [] });
          return res({ data: null });
        },
      };
      return api;
    };
    return { from: q, storage: { from: () => ({ upload: (path, buf, opts) => { db.uploads.push({ path, size: buf.length, opts }); return Promise.resolve({ error: null }); }, remove: () => Promise.resolve({}) }) } };
  },
}));
vi.mock('../_systemEvents.js', () => ({ logSystemEvent: async () => {} }));

process.env.RESEND_INBOUND_WEBHOOK_SECRET = 'whsec_' + Buffer.from('testhemlighet').toString('base64');
process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
process.env.RESEND_API_KEY = 're_test';
process.env.INBOX_DOMAIN = 'inbox.bokix.se';

globalThis.fetch = async (url) => {
  if (String(url).endsWith('/attachments')) return { ok: true, json: async () => ({ data: [
    { id: '1', filename: 'Faktura 8841.pdf', content_type: 'application/pdf', size: 1200, download_url: 'https://cdn/1' },
    { id: '2', filename: 'logo.png', content_type: 'image/png', size: 900, content_disposition: 'inline', download_url: 'https://cdn/2' },
  ] }) };
  if (String(url).startsWith('https://cdn/')) return { ok: true, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 test').buffer };
  return { ok: false, status: 404, json: async () => ({}) };
};

const { default: handler } = await import('./email.js');

function call(body, { sign = true } = {}) {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', Buffer.from('testhemlighet')).update(`msg_1.${ts}.${body}`).digest('base64');
  const headers = { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': sign ? `v1,${sig}` : 'v1,fel' };
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.c = c; return this; }, json(d) { resolve([this.c, d]); } };
    handler({ method: 'POST', headers, body: Buffer.from(body), socket: {} }, res);
  });
}

describe('inkorgens webhook', () => {
  it('avvisar fel signatur', async () => {
    expect((await call('{}', { sign: false }))[0]).toBe(401);
  });
  it('sparar PDF:en men inte logotypen', async () => {
    const body = JSON.stringify({ type: 'email.received', data: { email_id: 'e1', from: 'faktura@telia.se', to: ['BokixAB-abcdefg@inbox.bokix.se'], subject: 'Din faktura', attachments: [] } });
    const [code, out] = await call(body);
    expect(code).toBe(200);
    expect(out.saved).toBe(1);
    expect(db.uploads[0].path).toMatch(/^u1\/receipts\/inbox_.*\.pdf$/);
    expect(db.uploads[0].opts.contentType).toBe('application/pdf');
    expect(db.items[0]).toMatchObject({ owner_user_id: 'u1', company_id: 'c1', from_email: 'faktura@telia.se', file_name: 'Faktura 8841.pdf', content_type: 'application/pdf' });
    expect(db.items[0].file_url).toBe(`https://x.supabase.co/storage/v1/object/public/bokix-uploads/${db.uploads[0].path}`);
  });
  it('struntar i okända adresser', async () => {
    const body = JSON.stringify({ type: 'email.received', data: { email_id: 'e2', from: 'a@b.se', to: ['nagon@gmail.com'] } });
    expect((await call(body))[1]).toEqual({ ignored: 'no_inbox' });
  });
});
