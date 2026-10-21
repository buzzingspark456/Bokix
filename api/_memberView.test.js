import { describe, it, expect } from 'vitest';
import { memberCompanyView, redactCompany, mergeMemberCompanyWrite } from './_memberView.js';

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
