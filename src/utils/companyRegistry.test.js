import { describe, it, expect } from 'vitest';
import { isFieldLocked, isRegistryCompany, registrySyncDue } from './companyRegistry.js';

const ab = { orgNr: '559450-5249' };
const firma = { orgNr: '900101-1234' };

describe('isRegistryCompany', () => {
  it('bolag ja, enskild firma, UF och tomt org.nr nej', () => {
    expect(isRegistryCompany(ab)).toBe(true);
    expect(isRegistryCompany(firma)).toBe(false);
    expect(isRegistryCompany({ ...ab, isUf: true })).toBe(false);
    expect(isRegistryCompany({ orgNr: '' })).toBe(false);
  });
});

describe('isFieldLocked', () => {
  it('bolag: alltid låst, även tomt', () => {
    expect(isFieldLocked({ ...ab, address: '' }, 'address')).toBe(true);
  });
  it('enskild firma: det ifyllda är låst, det som saknas går att fylla i', () => {
    expect(isFieldLocked({ ...firma, address: 'Storgatan 1' }, 'address')).toBe(true);
    expect(isFieldLocked({ ...firma, address: '' }, 'address')).toBe(false);
  });
  it('momsnumret går alltid att ändra', () => {
    expect(isFieldLocked({ ...ab, vatNr: 'SE559450524901' }, 'vatNr')).toBe(false);
    expect(isFieldLocked({ ...firma, vatNr: 'SE900101123401' }, 'vatNr')).toBe(false);
  });
  it('UF och företag utan nummer låses inte', () => {
    expect(isFieldLocked({ ...ab, isUf: true, address: 'Skolvägen 1' }, 'address')).toBe(false);
    expect(isFieldLocked({ orgNr: '', address: 'Storgatan 1' }, 'address')).toBe(false);
  });
});

describe('registrySyncDue', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  it('aldrig hämtat eller över ett dygn gammalt', () => {
    expect(registrySyncDue({ company: ab }, now)).toBe(true);
    expect(registrySyncDue({ company: { ...ab, registrySyncedAt: '2026-10-30T11:00:00Z' } }, now)).toBe(true);
  });
  it('hämtat inom ett dygn: ingen ny kontroll', () => {
    expect(registrySyncDue({ company: { ...ab, registrySyncedAt: '2026-10-31T01:00:00Z' } }, now)).toBe(false);
  });
  it('inte för delade företag eller enskilda firmor', () => {
    expect(registrySyncDue({ company: ab, __shared: {} }, now)).toBe(false);
    expect(registrySyncDue({ company: firma }, now)).toBe(false);
    expect(registrySyncDue(null, now)).toBe(false);
  });
});
