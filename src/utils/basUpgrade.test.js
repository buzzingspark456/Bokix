import { describe, it, expect } from 'vitest';
import { upgradeAccountsToBas, PREVIOUS_DEFAULT_NAMES } from './basUpgrade';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

const defaults = [
  { code: '1930', name: 'Företagskonto/checkkonto/affärskonto', type: 'tillgang', active: true },
  { code: '2611', name: 'Utgående moms på försäljning inom Sverige, 25 %', type: 'skuld_kapital', active: true },
  { code: '2850', name: 'Avräkning för skatter och avgifter (skattekonto)', type: 'skuld_kapital' },
];

describe('upgradeAccountsToBas', () => {
  it('lägger till saknade konton och sorterar på kontonummer', () => {
    const out = upgradeAccountsToBas([{ code: '2611', name: 'Utgående moms, 25%', type: 'skuld_kapital' }, { code: '1930', name: 'Företagskonto/checkkonto/affärskonto', type: 'tillgang' }], defaults);
    expect(out.map(a => a.code)).toEqual(['1930', '2611', '2850']);
  });

  it('byter bara namn som fortfarande är appens gamla standardnamn', () => {
    const untouched = upgradeAccountsToBas([{ code: '2611', name: PREVIOUS_DEFAULT_NAMES['2611'], type: 'skuld_kapital' }], defaults);
    expect(untouched.find(a => a.code === '2611').name).toBe('Utgående moms på försäljning inom Sverige, 25 %');
    const custom = upgradeAccountsToBas([{ code: '2611', name: 'Min egen moms', type: 'skuld_kapital' }], defaults);
    expect(custom.find(a => a.code === '2611').name).toBe('Min egen moms');
  });

  it('tar aldrig bort egna konton och behåller användarens flaggor', () => {
    const out = upgradeAccountsToBas([{ code: '1931', name: 'Sparkonto', type: 'tillgang' }, { code: '1930', name: 'Företagskonto/checkkonto/affärskonto', type: 'tillgang', active: false }], defaults);
    expect(out.find(a => a.code === '1931')).toBeTruthy();
    expect(out.find(a => a.code === '1930').active).toBe(false);
  });

  it('ett gammalt företag med appens gamla standardlista får hela BAS 2026', () => {
    const oldCompany = DEFAULT_ACCOUNTS.filter(a => !a.code.startsWith('28')).map(a => ({ ...a, name: PREVIOUS_DEFAULT_NAMES[a.code] || a.name }));
    const out = upgradeAccountsToBas(oldCompany, DEFAULT_ACCOUNTS);
    expect(out.length).toBe(DEFAULT_ACCOUNTS.length);
    const defaultName = new Map(DEFAULT_ACCOUNTS.map(a => [a.code, a.name]));
    for (const a of out) expect(a.name).toBe(defaultName.get(a.code));
    const codes = out.map(a => Number(a.code));
    expect(codes).toEqual([...codes].sort((x, y) => x - y));
  });
});
