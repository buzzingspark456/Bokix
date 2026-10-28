import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireActiveSubscription, requireOwnerPaidAccess, isFreeEmail, isFreeUser, isWithinUfFreePeriod } from './_auth.js';

// En liten låtsasdatabas: `db.subscriptions[userId]` = lista med statusar,
// `db.members[userId]` = ägar-id:n där användaren är aktiv medlem,
// `db.users[userId]` = kontot som getUserById returnerar.
const db = { subscriptions: {}, members: {}, users: {} };

function query(table) {
  const filters = {};
  const chain = {
    select: () => chain,
    eq: (col, val) => { filters[col] = val; return chain; },
    then: (resolve) => {
      if (table === 'subscriptions') {
        resolve({ data: (db.subscriptions[filters.user_id] || []).map(status => ({ status })), error: null });
      } else if (table === 'company_members') {
        resolve({ data: (db.members[filters.member_user_id] || []).map(owner_user_id => ({ owner_user_id })), error: null });
      } else {
        resolve({ data: [], error: null });
      }
    },
  };
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => query(table),
    auth: { admin: { getUserById: async (id) => ({ data: { user: db.users[id] || null }, error: null }) } },
  }),
}));

const createMockRes = () => ({
  statusCode: 200,
  jsonData: null,
  status(code) { this.statusCode = code; return this; },
  json(data) { this.jsonData = data; return this; },
});

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

describe('_auth betalningsspärr', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
    db.subscriptions = {};
    db.members = {};
    db.users = {};
  });

  it('släpper igenom gratis-/adminkonton', async () => {
    const res = createMockRes();
    expect(await requireActiveSubscription({ id: 'a', email: 'alwakiabdullah1@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' }, res)).toBe(true);
    expect(isFreeEmail(' AlwakiAbdullah1@gmail.com ')).toBe(true);
  });

  it('gratiskontot kräver bekräftad e-post', () => {
    expect(isFreeUser({ email: 'alwakiabdullah1@gmail.com' })).toBe(false);
    expect(isFreeUser({ email: 'alwakiabdullah1@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' })).toBe(true);
  });

  it('släpper igenom UF-konton inom tre månader från registreringen', async () => {
    const res = createMockRes();
    const user = { id: 'uf1', email: 'elev@skola.se', created_at: daysAgo(20), app_metadata: { uf: true } };
    expect(await requireActiveSubscription(user, res)).toBe(true);
  });

  it('räknar UF-perioden från kontots skapelsedatum, inte ett datum i user_metadata', () => {
    // user_metadata kan användaren skriva om själv — ett framflyttat
    // uf_started_at får inte förlänga gratisperioden.
    const user = { created_at: daysAgo(200), app_metadata: { uf: true }, user_metadata: { uf_started_at: new Date().toISOString() } };
    expect(isWithinUfFreePeriod(user)).toBe(false);
  });

  it('ett avslutat UF-år räknas inte som gratisperiod', () => {
    const user = { created_at: daysAgo(10), app_metadata: { uf: true, uf_closed_at: new Date().toISOString() } };
    expect(isWithinUfFreePeriod(user)).toBe(false);
  });

  it('blockerar konton utan prenumeration med 402', async () => {
    const res = createMockRes();
    db.subscriptions.u1 = ['canceled'];
    const allowed = await requireActiveSubscription({ id: 'u1', email: 'vanlig@anvandare.se', created_at: daysAgo(400) }, res);
    expect(allowed).toBe(false);
    expect(res.statusCode).toBe(402);
    expect(res.jsonData?.error).toContain('Ingen aktiv prenumeration');
  });

  it('släpper igenom aktiv, provperiod och past_due', async () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      db.subscriptions.u2 = [status];
      expect(await requireActiveSubscription({ id: 'u2', email: 'betalar@kund.se' }, createMockRes())).toBe(true);
    }
  });

  it('släpper igenom en medlem vars företagsägare betalar', async () => {
    db.members.m1 = ['owner1'];
    db.users.owner1 = { id: 'owner1', email: 'agare@firma.se', created_at: daysAgo(400) };
    db.subscriptions.owner1 = ['active'];
    expect(await requireActiveSubscription({ id: 'm1', email: 'revisor@byra.se' }, createMockRes())).toBe(true);
  });

  it('stoppar en medlem vars företagsägare slutat betala', async () => {
    // Annars kunde ett obetalt konto bjuda in sin egen andra adress.
    db.members.m2 = ['owner2'];
    db.users.owner2 = { id: 'owner2', email: 'agare2@firma.se', created_at: daysAgo(400) };
    db.subscriptions.owner2 = ['canceled'];
    const res = createMockRes();
    expect(await requireActiveSubscription({ id: 'm2', email: 'andra@adress.se' }, res)).toBe(false);
    expect(res.statusCode).toBe(402);
  });

  it('requireOwnerPaidAccess kontrollerar ägaren, inte medlemmen', async () => {
    db.users.owner3 = { id: 'owner3', email: 'agare3@firma.se', created_at: daysAgo(400) };
    db.subscriptions.owner3 = [];
    const res = createMockRes();
    expect(await requireOwnerPaidAccess('owner3', res)).toBe(false);
    expect(res.statusCode).toBe(402);
    db.subscriptions.owner3 = ['active'];
    expect(await requireOwnerPaidAccess('owner3', createMockRes())).toBe(true);
  });
});
