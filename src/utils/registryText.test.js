import { describe, it, expect } from 'vitest';
import { niceCase, formatPostalCode } from './registryText';

describe('registryText', () => {
  it('versaler från registret blir vanlig skrivning', () => {
    expect(niceCase('STOCKHOLM')).toBe('Stockholm');
    expect(niceCase('VÄSTERG 5')).toBe('Västerg 5');
    expect(niceCase('UPPLANDS-VÄSBY')).toBe('Upplands-Väsby');
    expect(niceCase('Box 1539, c/o Allm. Adv.byrån')).toBe('Box 1539, c/o Allm. Adv.byrån');
    expect(niceCase('12345')).toBe('12345');
  });
  it('postnummer får mellanslag', () => {
    expect(formatPostalCode('11153')).toBe('111 53');
    expect(formatPostalCode('111 53')).toBe('111 53');
    expect(formatPostalCode('')).toBe('');
  });
});
