import { describe, it, expect } from 'vitest';
import { accountMatches, groupAccountsByClass, ACCOUNT_CLASSES } from './accountSearch';

const acc = (code, name) => ({ code, name });

describe('accountMatches', () => {
  it('matchar allt när sökningen är tom — ett tomt fält ska visa hela kontoplanen', () => {
    expect(accountMatches(acc('1930', 'Företagskonto'), '')).toBe(true);
    expect(accountMatches(acc('1930', 'Företagskonto'), '   ')).toBe(true);
    expect(accountMatches(acc('1930', 'Företagskonto'), undefined)).toBe(true);
  });

  it('hittar kontonummer var som helst i numret, inte bara i början', () => {
    // Regressionen som gjorde halva kontoplanen osökbar: "30" gav förut
    // bara konton som BÖRJADE på 30.
    expect(accountMatches(acc('4030', 'Inköp av varor'), '30')).toBe(true);
    expect(accountMatches(acc('3001', 'Försäljning'), '30')).toBe(true);
    expect(accountMatches(acc('1930', 'Företagskonto'), '1930')).toBe(true);
  });

  it('matchar på ord ur kontonamnet, oberoende av skiftläge', () => {
    expect(accountMatches(acc('6110', 'Kontorsmaterial'), 'kontors')).toBe(true);
    expect(accountMatches(acc('6110', 'Kontorsmaterial'), 'MATERIAL')).toBe(true);
  });

  it('kräver att alla ord finns, men i valfri ordning', () => {
    const a = acc('5410', 'Förbrukningsinventarier');
    expect(accountMatches(a, 'förbruknings inventarier')).toBe(true);
    expect(accountMatches(a, 'inventarier förbruknings')).toBe(true);
    expect(accountMatches(a, 'förbruknings bil')).toBe(false);
  });

  it('kan blanda nummer och namn i samma sökning', () => {
    expect(accountMatches(acc('1930', 'Företagskonto'), '19 företag')).toBe(true);
    expect(accountMatches(acc('1910', 'Kassa'), '19 företag')).toBe(false);
  });

  it('ger false för ett konto som saknas, i stället för att kasta', () => {
    expect(accountMatches(null, '1930')).toBe(false);
  });
});

describe('groupAccountsByClass', () => {
  const accounts = [
    acc('1930', 'Företagskonto'),
    acc('3001', 'Försäljning'),
    acc('5410', 'Förbrukningsinventarier'),
    acc('6110', 'Kontorsmaterial'),
  ];

  it('grupperar per klass och hoppar över tomma grupper', () => {
    const groups = groupAccountsByClass(accounts);
    expect(groups.map(g => g.key)).toEqual(['1', '3', '5-6']);
    expect(groups.find(g => g.key === '5-6').rows).toHaveLength(2);
  });

  it('behåller ordningen från ACCOUNT_CLASSES', () => {
    const keys = groupAccountsByClass(accounts).map(g => g.key);
    const expectedOrder = ACCOUNT_CLASSES.map(c => c.key).filter(k => keys.includes(k));
    expect(keys).toEqual(expectedOrder);
  });

  it('tappar aldrig ett konto utanför 1–8 — det hamnar sist i stället', () => {
    const groups = groupAccountsByClass([...accounts, acc('9100', 'Egen rad ur SIE-import')]);
    const last = groups[groups.length - 1];
    expect(last.key).toBe('other');
    expect(last.rows.map(r => r.code)).toEqual(['9100']);
  });

  it('klarar en tom kontoplan', () => {
    expect(groupAccountsByClass([])).toEqual([]);
    expect(groupAccountsByClass()).toEqual([]);
  });
});
