import { describe, it, expect } from 'vitest';
import { buildStateDelta, keepCompanyId } from './stateMerge';

describe('företagets id får inte sparas bort', () => {
  const base = { id: 'company_1', name: 'Bolaget', city: 'Kåge' };

  it('keepCompanyId lägger tillbaka id som saknas', () => {
    expect(keepCompanyId(base, { name: 'Bolaget' }).id).toBe('company_1');
    expect(keepCompanyId(base, { id: 'company_2' }).id).toBe('company_2');
    expect(keepCompanyId(undefined, { name: 'Nytt' })).toEqual({ name: 'Nytt' });
  });

  it('delta-sparningen tar inte med en företagspost utan id', () => {
    const baseCompanies = { k1: { company: base, invoices: [] } };
    const companies = { k1: { company: { name: 'Bolaget', city: 'Skellefteå' }, invoices: [] } };
    const ops = buildStateDelta({ activeCompanyId: 'k1' }, baseCompanies, { activeCompanyId: 'k1' }, companies);
    const op = ops.find(o => o.path.join('/') === 'companies/k1/company');
    expect(op.value).toMatchObject({ id: 'company_1', city: 'Skellefteå' });
  });

  it('tar aldrig bort id när bara id saknas', () => {
    const baseCompanies = { k1: { company: base } };
    const companies = { k1: { company: { name: 'Bolaget', city: 'Kåge' } } };
    const ops = buildStateDelta({}, baseCompanies, {}, companies);
    for (const op of ops.filter(o => o.path.includes('company'))) {
      expect(op.op).toBe('set');
      expect(op.value.id).toBe('company_1');
    }
  });
});
