import { describe, it, expect, vi } from 'vitest';
import { checkCompanyInRegistry } from './_registryGuard.js';

const configured = () => true;

describe('checkCompanyInRegistry', () => {
  it('släpper igenom ett aktivt företag', async () => {
    const lookup = vi.fn(async () => [{ name: 'Riktigt AB', active: true }]);
    expect(await checkCompanyInRegistry('556123-4567', { configured, lookup })).toEqual({ ok: true });
    expect(lookup).toHaveBeenCalledWith('5561234567');
  });

  it('stoppar ett påhittat nummer', async () => {
    const res = await checkCompanyInRegistry('5561234567', { configured, lookup: async () => [] });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Bolagsverket');
  });

  it('stoppar ett avregistrerat företag', async () => {
    const res = await checkCompanyInRegistry('5561234567', { configured, lookup: async () => [{ active: false }] });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('avregistrerat');
  });

  it('skickar aldrig en enskild firmas personnummer till registret', async () => {
    const lookup = vi.fn();
    expect(await checkCompanyInRegistry('900101-1234', { configured, lookup })).toEqual({ ok: true });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('nekar ingen kund när registret inte går att nå', async () => {
    const lookup = async () => { throw new Error('nere'); };
    expect(await checkCompanyInRegistry('5561234567', { configured, lookup })).toEqual({ ok: true });
  });

  it('släpper igenom när registret inte är inställt', async () => {
    const lookup = vi.fn();
    expect(await checkCompanyInRegistry('5561234567', { configured: () => false, lookup })).toEqual({ ok: true });
    expect(lookup).not.toHaveBeenCalled();
  });
});
