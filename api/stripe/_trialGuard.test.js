import { describe, it, expect, vi } from 'vitest';
import { normalizeEmail, normalizeOrgNr, hashIp, trialMetadata, trialDecision, enforceCardTrialLimit, IP_TRIAL_LIMIT } from './_trialGuard.js';

// En påhittad Stripe med prenumerationer som söks på metadata, som Stripe Search.
function fakeStripe(subs) {
  return {
    subscriptions: {
      search: vi.fn(async ({ query }) => {
        const m = query.match(/metadata\['(.+?)'\]:'(.*)'/);
        return { data: subs.filter(s => s.metadata?.[m[1]] === m[2]) };
      }),
      retrieve: vi.fn(async (id) => subs.find(s => s.id === id)),
      update: vi.fn(async (id, patch) => ({ id, ...patch })),
    },
  };
}
const now = Math.floor(Date.now() / 1000);

describe('normalisering', () => {
  it('gmail-tricken är samma adress', () => {
    expect(normalizeEmail('Anna.Svensson+bokix2@Gmail.com')).toBe('annasvensson@gmail.com');
    expect(normalizeEmail('anna.svensson@googlemail.com')).toBe('annasvensson@gmail.com');
    expect(normalizeEmail('anna.svensson+x@foretag.se')).toBe('anna.svensson@foretag.se');
  });
  it('org.-nummer som tio siffror', () => {
    expect(normalizeOrgNr('556123-4567')).toBe('5561234567');
    expect(normalizeOrgNr('16556123-4567')).toBe('5561234567');
    expect(normalizeOrgNr('')).toBe('');
  });
  it('IP-adressen sparas aldrig i klartext', () => {
    expect(hashIp('81.230.1.2')).not.toContain('81.230');
    expect(hashIp('81.230.1.2')).toBe(hashIp('81.230.1.2'));
    expect(trialMetadata({ email: 'a@b.se', orgNr: '556123-4567', ip: '1.2.3.4' })).toEqual({ bokix_email_norm: 'a@b.se', bokix_orgnr: '5561234567', bokix_ip: hashIp('1.2.3.4') });
  });
});

describe('provperiod eller inte', () => {
  it('samma företag igen på samma konto, med ny företagspost: ingen ny provperiod', async () => {
    const stripe = fakeStripe([{ id: 's1', trial_start: now, metadata: { user_id: 'u1', company_id: 'gammalt', bokix_orgnr: '5561234567' } }]);
    const d = await trialDecision(stripe, { email: 'a@b.se', orgNr: '5561234567', excludeUserId: 'u1', companyId: 'nytt' });
    expect(d.allowTrial).toBe(false);
    expect(d.reasons).toEqual(['orgnr']);
  });
  it('samma företagspost på samma konto räknas inte mot sig själv', async () => {
    const stripe = fakeStripe([{ id: 's1', trial_start: now, metadata: { user_id: 'u1', company_id: 'c1', bokix_orgnr: '5561234567' } }]);
    expect((await trialDecision(stripe, { email: 'a@b.se', orgNr: '5561234567', excludeUserId: 'u1', companyId: 'c1' })).allowTrial).toBe(true);
  });
  it('ny person, nytt företag: provperiod', async () => {
    expect((await trialDecision(fakeStripe([]), { email: 'ny@firma.se', orgNr: '5561234567', ip: '1.1.1.1' })).allowTrial).toBe(true);
  });
  it('samma organisationsnummer: ingen provperiod', async () => {
    const stripe = fakeStripe([{ id: 'sub1', trial_start: now - 100, created: now - 100, metadata: { bokix_orgnr: '5561234567', user_id: 'u1' } }]);
    const d = await trialDecision(stripe, { email: 'annan@firma.se', orgNr: '556123-4567', ip: '2.2.2.2', excludeUserId: 'u2' });
    expect(d.allowTrial).toBe(false);
    expect(d.reasons).toContain('orgnr');
  });
  it('samma person med gmail-trick: ingen provperiod', async () => {
    const stripe = fakeStripe([{ id: 'sub1', trial_start: now, created: now, metadata: { bokix_email_norm: 'annasvensson@gmail.com', user_id: 'u1' } }]);
    expect((await trialDecision(stripe, { email: 'a.nna.svensson+2@gmail.com', ip: '3.3.3.3', excludeUserId: 'u2' })).allowTrial).toBe(false);
  });
  it('fyra personer i samma hem får provperiod, den femte från samma IP inte', async () => {
    const ip = '9.9.9.9';
    const earlier = Array.from({ length: IP_TRIAL_LIMIT }, (_, i) => ({ id: `s${i}`, trial_start: now, created: now - 3600, metadata: { bokix_ip: hashIp(ip), user_id: `u${i}` } }));
    expect((await trialDecision(fakeStripe(earlier.slice(0, IP_TRIAL_LIMIT - 1)), { email: 'x@y.se', ip })).allowTrial).toBe(true);
    expect((await trialDecision(fakeStripe(earlier), { email: 'x@y.se', ip })).reasons).toEqual(['ip']);
  });
  it('kontots egen avbrutna checkout räknas inte', async () => {
    const stripe = fakeStripe([{ id: 'sub1', trial_start: now, created: now, metadata: { bokix_email_norm: 'a@b.se', user_id: 'u1' } }]);
    expect((await trialDecision(stripe, { email: 'a@b.se', excludeUserId: 'u1' })).allowTrial).toBe(true);
  });
  it('Stripe svarar inte: kunden släpps igenom', async () => {
    const stripe = { subscriptions: { search: async () => { throw new Error('nere'); } } };
    expect((await trialDecision(stripe, { email: 'a@b.se', orgNr: '5561234567' })).allowTrial).toBe(true);
  });
});

describe('samma kort', () => {
  it('kort som redan haft en provperiod: provperioden avslutas direkt', async () => {
    const card = { card: { fingerprint: 'fpX' } };
    const stripe = fakeStripe([
      { id: 'old', trial_start: now - 9999, metadata: { bokix_card_fp: 'fpX' } },
      { id: 'new', status: 'trialing', trial_start: now, metadata: {}, default_payment_method: card },
    ]);
    expect(await enforceCardTrialLimit(stripe, { id: 'new', status: 'trialing', metadata: {} })).toBe('ended');
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('new', expect.objectContaining({ trial_end: 'now' }));
  });
  it('nytt kort: fingeravtrycket sparas, provperioden står kvar', async () => {
    const stripe = fakeStripe([{ id: 'new', status: 'trialing', trial_start: now, metadata: {}, default_payment_method: { card: { fingerprint: 'fpY' } } }]);
    expect(await enforceCardTrialLimit(stripe, { id: 'new', status: 'trialing', metadata: {} })).toBe('recorded');
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('new', { metadata: { bokix_card_fp: 'fpY' } });
  });
});
