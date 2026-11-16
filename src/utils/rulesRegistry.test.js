import { describe, it, expect } from 'vitest';
import { RULES, RULE_AREAS, nextCheck, ruleStatus } from './rulesRegistry';

describe('regellistan', () => {
  it('varje regel har område, värde, källa och kontrolldatum', () => {
    for (const r of RULES) {
      expect(RULE_AREAS).toContain(r.area);
      expect(r.value).toBeTruthy();
      expect(r.source.url).toMatch(/^https:\/\//);
      expect(r.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.checkBy || r.checkEveryDays).toBeTruthy();
    }
    expect(new Set(RULES.map(r => r.id)).size).toBe(RULES.length);
  });

  it('värdena kommer från samma konstanter som beräkningarna', () => {
    expect(RULES.find(r => r.id === 'employer-fee').value).toBe('31,42 %');
    expect(RULES.find(r => r.id === 'food-vat').value).toContain('6 %');
  });

  it('status: försenad, upphör snart, snart och ok', () => {
    const r = { verifiedAt: '2026-01-01', checkEveryDays: 100 };
    expect(nextCheck(r)).toBe('2026-04-11');
    expect(ruleStatus(r, new Date('2026-05-01'))).toBe('overdue');
    expect(ruleStatus(r, new Date('2026-03-20'))).toBe('soon');
    expect(ruleStatus(r, new Date('2026-01-10'))).toBe('ok');
    expect(ruleStatus({ verifiedAt: '2026-11-16', checkEveryDays: 365, validTo: '2026-12-31' }, new Date('2026-11-16'))).toBe('ending');
  });
});
