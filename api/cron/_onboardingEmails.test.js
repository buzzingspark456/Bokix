import { describe, expect, it, vi } from 'vitest';
import { candidateSteps, isEligible, processOnboardingEmails } from './_onboardingEmails.js';
import { buildOnboardingEmail } from '../_emailTemplates.js';

vi.mock('../_signedToken.js', () => ({ createSignedToken: () => 'tok' }));

const START = new Date('2026-11-12T00:00:00Z');
const user = (over = {}) => ({
  id: 'u1', email: 'a@b.se', created_at: '2026-11-13T10:00:00Z',
  user_metadata: { start_path: 'new', first_name: 'Anna' }, ...over,
});

describe('isEligible', () => {
  it('nytt konto med svar i registreringen får mejl', () => {
    expect(isEligible(user(), START)).toBe(true);
  });
  it('befintliga konton (skapade före start) får aldrig mejl', () => {
    expect(isEligible(user({ created_at: '2026-11-01T10:00:00Z' }), START)).toBe(false);
  });
  it('konton utan svar på Start-steget får inga mejl', () => {
    expect(isEligible(user({ user_metadata: {} }), START)).toBe(false);
  });
  it('avregistrerade får inga mejl', () => {
    expect(isEligible(user({ user_metadata: { start_path: 'new', onboarding_emails_off: true } }), START)).toBe(false);
  });
  it('utan startdatum skickas ingenting', () => {
    expect(isEligible(user(), null)).toBe(false);
  });
});

describe('candidateSteps', () => {
  it('välkomstmejlet de första dagarna', () => {
    expect(candidateSteps({ days: 0, path: 'new' }).map(s => s.id)).toEqual(['welcome']);
  });
  it('kvitto för den som börjar från noll, SIE för den som flyttar', () => {
    expect(candidateSteps({ days: 4, path: 'new' }).map(s => s.id)).toEqual(['receipt']);
    expect(candidateSteps({ days: 4, path: 'move' }).map(s => s.id)).toEqual(['sie']);
  });
  it('redan skickade steg kommer inte igen', () => {
    expect(candidateSteps({ days: 1, path: 'new', sent: ['welcome'] })).toEqual([]);
  });
  it('inget efter dag 13', () => {
    expect(candidateSteps({ days: 14, path: 'new' })).toEqual([]);
  });
});

describe('buildOnboardingEmail', () => {
  it('har rubrik, knapp och avregistreringslänk', () => {
    const { subject, html } = buildOnboardingEmail({ step: 'receipt', path: 'new', firstName: 'Anna', siteUrl: 'https://www.bokix.se', unsubscribeUrl: 'https://x/u' });
    expect(subject).toMatch(/foto/i);
    expect(html).toContain('Hej Anna');
    expect(html).toContain('https://x/u');
  });
  it('välkomstmejlet skiljer på från noll och flytt', () => {
    expect(buildOnboardingEmail({ step: 'welcome', path: 'move', siteUrl: 's', unsubscribeUrl: 'u' }).html).toContain('SIE4');
    expect(buildOnboardingEmail({ step: 'welcome', path: 'new', siteUrl: 's', unsubscribeUrl: 'u' }).html).toContain('kvitto');
  });
});

// Enkel fejkad Supabase-klient som svarar per tabell.
function fakeAdmin({ subs = [], sent = [], users = {}, records = 0 } = {}) {
  const inserts = [];
  const query = (table) => {
    const q = { table, op: 'select' };
    const chain = () => q;
    Object.assign(q, {
      select: (_c, opts) => { q.head = opts?.head; return q; },
      insert: (row) => { q.op = 'insert'; inserts.push({ table, row }); return q; },
      update: () => { q.op = 'update'; return q; },
      delete: () => { q.op = 'delete'; return q; },
      eq: chain, in: chain, gte: chain, is: chain, order: chain, limit: chain,
      then: (resolve) => {
        if (q.op !== 'select') return resolve({ error: null });
        if (table === 'subscriptions') return resolve({ data: subs, error: null });
        if (table === 'onboarding_emails') return resolve({ data: sent, error: null });
        if (table === 'companies') return resolve({ data: [{ id: 'c1' }], error: null });
        if (table === 'company_records') return resolve({ count: records, error: null });
        return resolve({ data: [], error: null });
      },
    });
    return q;
  };
  return {
    inserts,
    from: vi.fn(query),
    auth: { admin: { getUserById: vi.fn(async (id) => ({ data: { user: users[id] }, error: null })) } },
  };
}

describe('processOnboardingEmails', () => {
  it('skickar ingenting utan ONBOARDING_EMAILS_START', async () => {
    const admin = fakeAdmin();
    const res = await processOnboardingEmails(admin, { startDateEnv: '' });
    expect(res.disabled).toBeTruthy();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it('skickar kvittomejlet dag 4 när inget kvitto finns', async () => {
    const admin = fakeAdmin({ subs: [{ user_id: 'u1' }], users: { u1: user() }, records: 0 });
    const send = vi.fn(async () => ({ ok: true }));
    const res = await processOnboardingEmails(admin, { startDateEnv: '2026-11-12', now: new Date('2026-11-17T08:00:00Z'), send });
    expect(res.sent).toBe(1);
    expect(send.mock.calls[0][0].subject).toMatch(/foto/i);
  });

  it('hoppar över kvittomejlet när kunden redan lagt in ett kvitto', async () => {
    const admin = fakeAdmin({ subs: [{ user_id: 'u1' }], users: { u1: user() }, records: 3 });
    const send = vi.fn(async () => ({ ok: true }));
    const res = await processOnboardingEmails(admin, { startDateEnv: '2026-11-12', now: new Date('2026-11-17T08:00:00Z'), send });
    expect(res.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('befintligt konto får aldrig något', async () => {
    const admin = fakeAdmin({ subs: [{ user_id: 'u1' }], users: { u1: user({ created_at: '2026-10-01T00:00:00Z' }) } });
    const send = vi.fn(async () => ({ ok: true }));
    const res = await processOnboardingEmails(admin, { startDateEnv: '2026-11-12', now: new Date('2026-11-13T12:00:00Z'), send });
    expect(send).not.toHaveBeenCalled();
    expect(res.skipped).toBe(1);
  });

  it('provkörning skickar inget men visar vad som skulle skickas', async () => {
    const admin = fakeAdmin({ subs: [{ user_id: 'u1' }], users: { u1: user() } });
    const send = vi.fn();
    const res = await processOnboardingEmails(admin, { startDateEnv: '2026-11-12', now: new Date('2026-11-13T12:00:00Z'), send, dryRun: true });
    expect(send).not.toHaveBeenCalled();
    expect(res.wouldSend).toEqual([{ userId: 'u1', step: 'welcome', days: 0 }]);
  });
});
