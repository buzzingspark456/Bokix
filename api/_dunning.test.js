import { describe, it, expect } from 'vitest';
import { dueStage, buildDunningEmail, amountForRow } from './_dunning.js';

const DAY = 86400000;
const now = Date.parse('2026-12-01T08:00:00Z');
const row = (days, stage = 0, status = 'past_due') => ({ status, payment_failed_at: new Date(now - days * DAY).toISOString(), payment_reminder_stage: stage });

describe('dueStage', () => {
  it('dag 0: första mejlet', () => expect(dueStage(row(0), now)?.stage).toBe(1));
  it('dag 3 och 7: påminnelser', () => {
    expect(dueStage(row(3, 1), now)?.stage).toBe(2);
    expect(dueStage(row(7, 2), now)?.stage).toBe(3);
  });
  it('skickar bara det senaste förfallna steget, aldrig ett gammalt igen', () => {
    expect(dueStage(row(8, 0), now)?.stage).toBe(3);
    expect(dueStage(row(8, 3), now)).toBe(null);
  });
  it('läsläge dag 12/14, lås dag 28/30', () => {
    expect(dueStage(row(12, 3), now)?.key).toBe('readOnlySoon');
    expect(dueStage(row(14, 4), now)?.key).toBe('readOnly');
    expect(dueStage(row(28, 5, 'unpaid'), now)?.key).toBe('lockSoon');
    expect(dueStage(row(30, 6, 'unpaid'), now)?.key).toBe('locked');
  });
  it('inga mejl när betalningen gått igenom eller utan misslyckad dragning', () => {
    expect(dueStage(row(5, 1, 'active'), now)).toBe(null);
    expect(dueStage({ status: 'canceled', payment_reminder_stage: 0 }, now)).toBe(null);
  });
});

describe('buildDunningEmail', () => {
  it('har ämne, belopp och knapp', () => {
    const m = buildDunningEmail({ key: 'failed', amount: 179, readOnlyAt: now, lockAt: now });
    expect(m.subject).toMatch(/gick inte igenom/);
    expect(m.html).toMatch(/179 kr/);
    expect(m.html).toMatch(/betalning=1/);
  });
  it('alla steg finns', () => {
    for (const key of ['failed', 'reminder', 'readOnlySoon', 'readOnly', 'lockSoon', 'locked', 'cardExpiring']) {
      expect(buildDunningEmail({ key, amount: 129 }).subject.length).toBeGreaterThan(5);
    }
  });
});

describe('amountForRow', () => {
  it('belopp ur planen, 179 utan plan', () => {
    expect(amountForRow({ plan: 'solo_monthly' })).toBe(129);
    expect(amountForRow({})).toBe(179);
  });
});
