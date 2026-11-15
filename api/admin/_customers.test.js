import { describe, it, expect } from 'vitest';
import { summarizeCompany, summarizeState, hasStarted, buildOverview } from './_customers.js';

const company = (extra = {}, data = {}) => ({
  company: { id: 'c1', name: 'Nagelstudio', orgNr: '920927-3029', vatRegistered: true, vatPeriod: 'quarterly', fSkatt: 'Innehar F-skattsedel', fiscalYear: '2026-01-01', ...extra },
  verifications: [], invoices: [], expenses: [], contacts: [], ...data,
});

describe('summarizeCompany', () => {
  it('bolagsform, inställningar och användning utan belopp eller namn på kunder', () => {
    const s = summarizeCompany(company({}, {
      verifications: [{ date: '2026-03-31' }, { date: '2026-08-31' }],
      invoices: [{ status: 'draft' }, { status: 'sent' }],
      expenses: [{ type: 'receipt', amount: 100 }, { type: 'supplier_invoice' }],
      contacts: [{ type: 'customer', name: 'Anna' }],
    }));
    expect(s.orgType).toBe('Enskild firma');
    expect(s.settings).toMatchObject({ vatPeriod: 'quarterly', vatPeriodConfirmed: false, fSkattConfirmed: false });
    expect(s.usage).toMatchObject({ verifications: 2, invoices: 2, sentInvoices: 1, receipts: 1, supplierInvoices: 1, customers: 1, lastBookedDate: '2026-08-31' });
    expect(JSON.stringify(s)).not.toContain('Anna');
  });

  it('onboardingen räknas som bekräftad momsperiod och F-skatt', () => {
    expect(summarizeCompany(company({ setupConfirmedAt: '2026-10-23' })).settings).toMatchObject({ vatPeriodConfirmed: true, fSkattConfirmed: true, setupDone: true });
  });
});

describe('summarizeState och hasStarted', () => {
  it('hoppar över delade företag och ser om kontot kommit igång', () => {
    const state = { companies: { a: company(), b: { ...company(), __shared: true } } };
    expect(summarizeState(state)).toHaveLength(1);
    expect(hasStarted(summarizeState(state))).toBe(false);
    expect(hasStarted(summarizeState({ companies: { a: company({}, { expenses: [{ type: 'receipt' }] }) } }))).toBe(true);
  });
});

describe('buildOverview', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const users = [
    { id: 'u1', email: 'ny@ex.se', created_at: '2026-10-24T08:00:00Z' },
    { id: 'u2', email: 'tyst@ex.se', created_at: '2026-10-18T08:00:00Z', last_sign_in_at: '2026-10-18T09:00:00Z' },
    { id: 'u3', email: 'aktiv@ex.se', created_at: '2026-09-01T08:00:00Z' },
    { id: 'a1', email: 'grundare@bokix.se', created_at: '2026-01-01T08:00:00Z' },
  ];
  const subs = [
    { user_id: 'u1', company_id: '', status: 'trialing', trial_ends_at: '2026-11-23T08:00:00Z' },
    { user_id: 'u2', company_id: '', status: 'trialing', trial_ends_at: '2026-10-27T08:00:00Z' },
    { user_id: 'u3', company_id: '', status: 'active' },
    { user_id: 'a1', company_id: '', status: 'active' },
  ];
  const states = {
    u1: { companies: { a: company() } },
    u2: { companies: { a: company({ name: 'Tysta AB' }) } },
  };
  const o = buildOverview({ users, subs, states, now, isAdmin: e => e.endsWith('@bokix.se'), messages: [{ handled_at: null }, { handled_at: 'x' }], events: [{ kind: 'ocr_error', created_at: '2026-10-24T10:00:00Z' }, { kind: 'ocr_error', created_at: '2026-10-20T10:00:00Z' }] });

  it('räknar konton och prenumerationer utan grundarna', () => {
    expect(o.accounts).toEqual({ total: 3, today: 1, week: 2, month: 2 });
    expect(o.subscriptions).toMatchObject({ trialing: 2, active: 1, atRisk: 0 });
  });

  it('provperioder som tar slut inom en vecka och konton som inte kommit igång', () => {
    expect(o.trialsEnding.map(x => [x.email, x.daysLeft, x.company, x.started])).toEqual([['tyst@ex.se', 3, 'Tysta AB', false]]);
    expect(o.notStarted.map(x => x.email)).toEqual(['tyst@ex.se']);
  });

  it('obehandlade meddelanden och fel senaste dygnet', () => {
    expect(o.unhandledMessages).toBe(1);
    expect(o.errorsLastDay).toEqual({ total: 1, byKind: { ocr_error: 1 } });
  });
});

describe('avstängda konton i översikten', () => {
  it('räknas inte och syns inte i listorna', async () => {
    const { buildOverview, isSuspended } = await import('./_customers.js');
    const now = new Date('2026-11-15T12:00:00Z');
    const users = [
      { id: 'a', email: 'a@x.se', created_at: '2026-11-10T00:00:00Z' },
      { id: 'b', email: 'b@x.se', created_at: '2026-11-11T00:00:00Z', banned_until: '2126-01-01T00:00:00Z' },
      { id: 'c', email: 'c@x.se', created_at: '2026-11-12T00:00:00Z', banned_until: '2026-01-01T00:00:00Z' },
    ];
    const subs = [
      { user_id: 'a', company_id: '', status: 'trialing', trial_ends_at: '2026-11-17T00:00:00Z' },
      { user_id: 'b', company_id: '', status: 'past_due' },
      { user_id: 'gone', company_id: '', status: 'past_due' },
    ];
    expect(isSuspended(users[1], now)).toBe(true);
    expect(isSuspended(users[2], now)).toBe(false);
    const o = buildOverview({ users, subs, now });
    expect(o.accounts.total).toBe(2);
    expect(o.recentSignups.map(x => x.userId)).toEqual(['c', 'a']);
    expect(o.subscriptions.atRisk).toBe(0);
    expect(o.trialsEnding.map(x => x.userId)).toEqual(['a']);
  });
});
