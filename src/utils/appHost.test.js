import { describe, it, expect } from 'vitest';
import { appUrl, readAppIntent } from './appHost';

describe('app.bokix.se', () => {
  it('tar med frågeparametrar och hash', () => {
    expect(appUrl({ search: '?subscription_checkout=success', hash: '#expenses' })).toBe('https://app.bokix.se/?subscription_checkout=success#expenses');
  });
  it('lägger till registrering och abonnemang', () => {
    expect(appUrl({ intent: { authMode: 'signup', plan: 'standard' } })).toBe('https://app.bokix.se/?auth=signup&plan=standard');
  });
  it('tar med inloggningen som token i hashen', () => {
    const url = appUrl({ session: { access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 600, token_type: 'bearer' } });
    expect(url).toMatch(/^https:\/\/app\.bokix\.se\/#access_token=a&refresh_token=r&expires_in=\d+/);
  });
  it('skriver aldrig över en inloggningslänk', () => {
    const url = appUrl({ hash: '#access_token=x&type=recovery', session: { access_token: 'a', refresh_token: 'r' } });
    expect(url).toBe('https://app.bokix.se/#access_token=x&type=recovery');
  });
  it('läser avsikten på app.bokix.se och tar bort den ur adressen', () => {
    expect(readAppIntent('?auth=signup&plan=bas&x=1')).toEqual({ intent: { enterApp: true, authMode: 'signup', plan: 'bas' }, search: '?x=1' });
    expect(readAppIntent('?x=1')).toBe(null);
  });
});
