import { describe, it, expect } from 'vitest';
import { memberCompanyView, redactCompany, mergeMemberCompanyWrite, pinServerConnections, foreignStoragePaths } from './_memberView.js';

const company = {
  name: 'Ab', orgNr: '556000-0000', stripeAccountId: 'acct_1', emailDomain: 'ab.se', resendDomainId: 'd1',
  zettleAccessToken: 'zat', zettleRefreshToken: 'zrt', smtpPassword: 'pw', calendar: { key: 'hemlig', invoices: true },
};

describe('redactCompany', () => {
  it('tar bort nycklar men behåller vad appen visar', () => {
    const r = redactCompany(company);
    expect(r.zettleAccessToken).toBe('connected');
    expect(r.zettleRefreshToken).toBeUndefined();
    expect(r.smtpPassword).toBeUndefined();
    expect(r.calendar).toEqual({ invoices: true });
    expect(r.stripeAccountId).toBe('acct_1');
  });
});

describe('memberCompanyView', () => {
  const data = { company, employees: [{ id: 'e' }], payrollRuns: [1], agiReports: [1], verifications: [1], invoices: [1] };
  it('döljer lönerna när lön är Ingen åtkomst', () => {
    const v = memberCompanyView(data, { payroll: 'none', verifications: 'view', invoices: 'edit' }, 'editor');
    expect(v.employees).toEqual([]);
    expect(v.payrollRuns).toEqual([]);
    expect(v.agiReports).toEqual([]);
    expect(v.verifications).toEqual([1]);
    expect(v.company.zettleRefreshToken).toBeUndefined();
  });
  it('visar allt utan behörighetslista (gamla inbjudningar)', () => {
    expect(memberCompanyView(data, null, 'viewer').employees).toEqual([{ id: 'e' }]);
  });
});

describe('mergeMemberCompanyWrite', () => {
  it('behåller nycklar, kopplingar och låst namn', () => {
    const out = mergeMemberCompanyWrite(company, {
      ...redactCompany(company), name: 'Annat', orgNr: '1', stripeAccountId: 'acct_x', zettleRefreshToken: 'x',
      calendar: { key: 'ny', invoices: false }, address: 'Gatan 1',
    });
    expect(out.name).toBe('Ab');
    expect(out.orgNr).toBe('556000-0000');
    expect(out.stripeAccountId).toBe('acct_1');
    expect(out.zettleAccessToken).toBe('zat');
    expect(out.zettleRefreshToken).toBe('zrt');
    expect(out.calendar).toEqual({ invoices: false, key: 'hemlig' });
    expect(out.address).toBe('Gatan 1');
  });
});

describe('pinServerConnections (ägarens sparning)', () => {
  it('byter aldrig Stripe-konto eller Zettle-nycklar, men låter ägaren koppla från', () => {
    const changed = pinServerConnections(company, { ...company, stripeAccountId: 'acct_annan', zettleAccessToken: 'stulen', name: 'Nytt' });
    expect(changed.stripeAccountId).toBe('acct_1');
    expect(changed.zettleAccessToken).toBe('zat');
    expect(changed.name).toBe('Nytt');
    const cleared = pinServerConnections(company, { ...company, stripeAccountId: null, zettleAccessToken: '' });
    expect(cleared.stripeAccountId).toBe(null);
    expect(cleared.zettleAccessToken).toBe('');
  });

  it('kan inte lägga till en koppling som inte fanns', () => {
    const out = pinServerConnections({ name: 'Ab' }, { name: 'Ab', stripeAccountId: 'acct_annan' });
    expect('stripeAccountId' in out).toBe(false);
  });
});

describe('foreignStoragePaths (medlemmens sparning)', () => {
  const ME = '22222222-2222-4222-8222-222222222222';
  const OWNER = '11111111-1111-4111-8111-111111111111';
  const ownerFile = `${OWNER}/receipts/1700000000000_abc123.pdf`;
  const url = (p) => `https://x.supabase.co/storage/v1/object/public/bokix-uploads/${p}`;

  it('egna uppladdningar och redan synliga länkar går bra', () => {
    const visible = { expenses: [{ id: 'e1', receiptUrl: url(ownerFile) }] };
    expect(foreignStoragePaths([{ id: 'e1', receiptUrl: url(ownerFile) }, { id: 'e2', receiptUrl: url(`${ME}/receipts/2_b.pdf`) }], visible, ME)).toEqual([]);
  });

  it('en ny länk till någon annans fil fångas', () => {
    expect(foreignStoragePaths({ note: ownerFile }, { expenses: [] }, ME)).toEqual([ownerFile]);
  });
});
