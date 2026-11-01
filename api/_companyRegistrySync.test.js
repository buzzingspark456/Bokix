import { describe, it, expect, vi } from 'vitest';
import { registryPatch, companyWriteError, pinRegistryFields } from './_companyRegistrySync.js';

const configured = () => true;
const now = () => new Date('2026-10-31T12:00:00Z');
const company = { orgNr: '559450-5249', name: 'Alwake Kapell i Kåge AB', address: 'Gamla Kågevägen 2', postalCode: '934 32', city: 'Kåge', vatNr: 'SE559450524901' };
const hit = { name: 'Alwake Kapell i Kåge AB', street: 'NYGATAN 5', postalCode: '93431', city: 'KÅGE' };

describe('registryPatch', () => {
  it('hämtar adressen i vanlig skrivning och säger vad som ändrats', async () => {
    const res = await registryPatch(company, { configured, now, lookup: async () => [hit] });
    expect(res.fields).toMatchObject({ address: 'Nygatan 5', postalCode: '934 31', city: 'Kåge', registrySyncedAt: '2026-10-31T12:00:00.000Z' });
    expect(res.changed).toEqual(['address', 'postalCode']);
  });

  it('samma uppgifter: inget ändrat, men tiden sparas', async () => {
    const res = await registryPatch(company, { configured, now, lookup: async () => [{ ...hit, street: 'Gamla Kågevägen 2', postalCode: '93432' }] });
    expect(res.changed).toEqual([]);
    expect(res.fields.registrySyncedAt).toBeTruthy();
  });

  it('ett tomt fält i registret skriver inte över', async () => {
    const res = await registryPatch(company, { configured, now, lookup: async () => [{ name: '', street: '', postalCode: '', city: '' }] });
    expect(res.fields).toMatchObject({ name: company.name, address: company.address, city: company.city });
    expect(res.changed).toEqual([]);
  });

  it('fyller i ett saknat momsnummer, men aldrig över ett befintligt eller för ett företag utan moms', async () => {
    const empty = { ...company, vatNr: '' };
    expect((await registryPatch(empty, { configured, now, lookup: async () => [hit] })).fields.vatNr).toBe('SE559450524901');
    expect((await registryPatch({ ...company, vatNr: 'SE559999999901' }, { configured, now, lookup: async () => [hit] })).fields.vatNr).toBeUndefined();
    expect((await registryPatch({ ...empty, vatRegistered: false }, { configured, now, lookup: async () => [hit] })).fields.vatNr).toBeUndefined();
  });

  it('hämtar aldrig för en enskild firma', async () => {
    const lookup = vi.fn();
    expect(await registryPatch({ orgNr: '900101-1234' }, { configured, lookup })).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('inget svar från registret: inget skrivs', async () => {
    expect(await registryPatch(company, { configured, lookup: async () => [] })).toBeNull();
  });
});

describe('companyWriteError', () => {
  it('stoppar ändrat namn och org.nr på ett bolag', () => {
    expect(companyWriteError(company, { ...company, name: 'Annat AB' })).toContain('Företagsnamnet');
    expect(companyWriteError(company, { ...company, orgNr: '556016-0680' })).toContain('Organisationsnumret');
    expect(companyWriteError(company, { ...company })).toBeNull();
  });

  it('enskild firma kan inte heller byta namn eller personnummer', () => {
    const firma = { orgNr: '900101-1234', name: 'Annas Städ' };
    expect(companyWriteError(firma, { ...firma, name: 'Stora Bolaget AB' })).toContain('Företagsnamnet');
    expect(companyWriteError(firma, { ...firma, orgNr: '900101-9999' })).toContain('Organisationsnumret');
    expect(companyWriteError(firma, { ...firma })).toBeNull();
  });

  it('oavslutad registrering: namnet får sättas', () => {
    expect(companyWriteError({ orgNr: '', name: 'Mitt Företag AB' }, { orgNr: '559450-5249', name: 'Riktigt AB' })).toBeNull();
  });
});

describe('pinRegistryFields', () => {
  const synced = { ...company, registrySyncedAt: '2026-10-31T12:00:00Z' };

  it('låsta fält behåller sitt värde medan visningsnamnet går igenom', () => {
    const out = pinRegistryFields(synced, { ...synced, address: 'Påhittad väg 1', vatNr: 'SE000', invoiceDisplayName: 'Bokix' });
    expect(out).toMatchObject({ address: company.address, vatNr: 'SE000', invoiceDisplayName: 'Bokix' });
  });

  it('låst från början, även innan något har hämtats', () => {
    expect(pinRegistryFields(company, { ...company, address: 'Påhittad väg 1' }).address).toBe(company.address);
  });

  it('F-skatten är låst för bolag', () => {
    const current = { ...company, fSkatt: 'Godkänd för F-skatt' };
    expect(pinRegistryFields(current, { ...current, fSkatt: '' }).fSkatt).toBe('Godkänd för F-skatt');
  });

  it('enskild firma: sparad adress är låst, saknad adress går att fylla i', () => {
    const firma = { orgNr: '900101-1234', address: 'Gamla', city: '' };
    const out = pinRegistryFields(firma, { ...firma, address: 'Nya', city: 'Kåge' });
    expect(out.address).toBe('Gamla');
    expect(out.city).toBe('Kåge');
  });

  it('tiden går inte att förfalska för att låsa upp eller låsa', () => {
    expect(pinRegistryFields(synced, { ...synced, registrySyncedAt: '' }).registrySyncedAt).toBe(synced.registrySyncedAt);
    expect(pinRegistryFields(company, { ...company, registrySyncedAt: '2030-01-01' })).not.toHaveProperty('registrySyncedAt');
  });
});
