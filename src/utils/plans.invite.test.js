import { describe, it, expect } from 'vitest';
import { invitedUserLimit } from './plans';

describe('invitedUserLimit', () => {
  it('Utan personal får bjuda in en', () => {
    expect(invitedUserLimit('solo_monthly', '2026-12-01T10:00:00Z')).toBe(1);
    expect(invitedUserLimit('solo_yearly', '2026-11-22T00:00:00Z')).toBe(1);
  });
  it('Med personal får bjuda in två', () => {
    expect(invitedUserLimit('employer_monthly', '2026-12-01T10:00:00Z')).toBe(2);
  });
  it('befintliga abonnemang behåller två', () => {
    expect(invitedUserLimit('solo_monthly', '2026-11-21T23:59:00Z')).toBe(2);
  });
  it('saknad plan ger två', () => {
    expect(invitedUserLimit(null, null)).toBe(2);
  });
});
