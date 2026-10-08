import { describe, it, expect } from 'vitest';
import { counterpartyKey, buildBankHistory, suggestFromHistory } from './bankLearning.js';

describe('counterpartyKey', () => {
  it('tar bort datum, referenser och kortköp-ord', () => {
    expect(counterpartyKey('KORTKÖP 260928 TELIA SVERIGE AB')).toBe('telia sverige');
    expect(counterpartyKey('Telia Sverige AB ref 88231')).toBe('telia sverige');
  });
  it('tom text ger tom nyckel', () => {
    expect(counterpartyKey('2026-09-28 12345')).toBe('');
  });
});

describe('suggestFromHistory', () => {
  const booked = (id, description, amount, bookedAccount) => ({ id, description, amount, status: 'booked', bookedAccount });

  it('föreslår kontot från tidigare bokningar och är säker efter två', () => {
    const history = buildBankHistory([
      booked('1', 'KORTKÖP 260801 TELIA SVERIGE AB', -499, '6212'),
      booked('2', 'KORTKÖP 260901 TELIA SVERIGE AB', -499, '6212'),
    ]);
    expect(suggestFromHistory({ description: 'KORTKÖP 261001 TELIA SVERIGE AB', amount: -499 }, history))
      .toEqual({ accountCode: '6212', times: 2, confident: true });
  });

  it('är inte säker när samma motpart bokförts mot olika konton', () => {
    const history = buildBankHistory([
      booked('1', 'Clas Ohlson', -100, '5410'),
      booked('2', 'Clas Ohlson', -100, '5410'),
      booked('3', 'Clas Ohlson', -100, '5460'),
    ]);
    const s = suggestFromHistory({ description: 'CLAS OHLSON', amount: -50 }, history);
    expect(s.accountCode).toBe('5410');
    expect(s.confident).toBe(false);
  });

  it('skiljer på in- och utbetalningar', () => {
    const history = buildBankHistory([booked('1', 'Kund AB', 1000, '3001'), booked('2', 'Kund AB', 1000, '3001')]);
    expect(suggestFromHistory({ description: 'Kund AB', amount: -1000 }, history)).toBeNull();
  });

  it('läser äldre rader ur verifikationen', () => {
    const rows = [{ id: 'b1', description: 'Spotify', amount: -119, status: 'booked' }];
    const verifications = [{ source: 'bank_import', sourceId: 'b1', rows: [{ account: '6990', debet: 119, kredit: 0 }, { account: '1930', debet: 0, kredit: 119 }] }];
    const history = buildBankHistory(rows, verifications);
    expect(suggestFromHistory({ description: 'SPOTIFY P1234', amount: -119 }, history).accountCode).toBe('6990');
  });
});
