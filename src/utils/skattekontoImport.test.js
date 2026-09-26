import { describe, it, expect } from 'vitest';
import {
  parseSkattekontoFile, parseSkvAmount, suggestCounterAccount, buildSkattekontoPreview,
  buildSkattekontoVerification, taxAccountBalance, decodeSkattekontoFile,
} from './skattekontoImport';

const CSV = [
  '﻿"Exempel AB";"556677-8899";""',
  '"";"";""',
  '"";"Ingående saldo 2026-01-01";"-626"',
  '"2026-01-10";"Inbetalning bokförd 260110";"4 626"',
  '"2026-01-12";"Debiterad preliminärskatt";"-4 000"',
  '"2026-02-12";"Moms jan 2026";"-1 250"',
  '"2026-02-14";"Kostnadsränta";"-11"',
  '"2026-02-20";"Slutlig skatt";"-200"',
  '"";"Utgående saldo 2026-02-28";"-1 461"',
].join('\r\n');

describe('parseSkattekontoFile', () => {
  it('läser den nya CSV-exporten med rubrik, saldon och händelser', () => {
    const r = parseSkattekontoFile(CSV);
    expect(r.orgNr).toBe('556677-8899');
    expect(r.companyName).toBe('Exempel AB');
    expect(r.openingBalance).toBe(-626);
    expect(r.closingBalance).toBe(-1461);
    expect(r.events).toHaveLength(5);
    expect(r.events[0]).toEqual({ date: '2026-01-10', description: 'Inbetalning bokförd 260110', amount: 4626 });
    expect(r.sumOk).toBe(true);
    expect(r.dateFrom).toBe('2026-01-01');
    expect(r.dateTo).toBe('2026-02-28');
  });

  it('flaggar en fil där saldot inte går ihop', () => {
    const r = parseSkattekontoFile(CSV.replace('"-11"', '"-12"'));
    expect(r.sumOk).toBe(false);
    expect(r.sumDifference).toBe(1);
  });

  it('läser en gammal .skv utan citattecken och med saldokolumn', () => {
    const skv = [
      'Datum;Text;Belopp;Saldo',
      ';Ingående saldo 2025-01-01;;1 000',
      '20250112;Debiterad preliminärskatt;-500;500',
      '20250115;Intäktsränta;2;502',
      ';Utgående saldo 2025-01-31;;502',
    ].join('\n');
    const r = parseSkattekontoFile(skv);
    expect(r.events).toEqual([
      { date: '2025-01-12', description: 'Debiterad preliminärskatt', amount: -500 },
      { date: '2025-01-15', description: 'Intäktsränta', amount: 2 },
    ]);
    expect(r.openingBalance).toBe(1000);
    expect(r.closingBalance).toBe(502);
    expect(r.sumOk).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('avkodar Windows-1252 när filen inte är UTF-8', () => {
    const bytes = new Uint8Array([0x49, 0x6e, 0x67, 0xe5, 0x65, 0x6e, 0x64, 0x65]); // "Ingående" i 1252
    expect(decodeSkattekontoFile(bytes.buffer)).toBe('Ingående');
  });
});

describe('parseSkvAmount', () => {
  it('klarar mellanslag, minus-tecken, kr och komma', () => {
    expect(parseSkvAmount('-4 000')).toBe(-4000);
    expect(parseSkvAmount('−1 250 kr')).toBe(-1250);
    expect(parseSkvAmount('12,50')).toBe(12.5);
    expect(parseSkvAmount('')).toBeNull();
    expect(parseSkvAmount('abc')).toBeNull();
  });
});

describe('suggestCounterAccount', () => {
  const ab = { orgType: 'Aktiebolag (AB)' };
  it('ger säkra konton för entydiga händelser', () => {
    expect(suggestCounterAccount({ description: 'Debiterad preliminärskatt', amount: -4000 }, ab)).toMatchObject({ account: '2518', sure: true });
    expect(suggestCounterAccount({ description: 'Moms jan 2026', amount: -1250 }, ab)).toMatchObject({ account: '2650', sure: true });
    expect(suggestCounterAccount({ description: 'Avdragen skatt', amount: -300 }, ab)).toMatchObject({ account: '2710', sure: true });
    expect(suggestCounterAccount({ description: 'Arbetsgivaravgift', amount: -300 }, ab)).toMatchObject({ account: '2731', sure: true });
    expect(suggestCounterAccount({ description: 'Kostnadsränta', amount: -11 }, ab)).toMatchObject({ account: '8423', sure: true });
    expect(suggestCounterAccount({ description: 'Inbetalning bokförd 260110', amount: 100 }, ab)).toMatchObject({ account: '1930', sure: true });
  });
  it('gissar aldrig på oklara händelser', () => {
    expect(suggestCounterAccount({ description: 'Slutlig skatt', amount: -200 }, ab)).toMatchObject({ account: null, sure: false });
  });
  it('lägger preliminärskatt på 2012 och räntan som Kontrollera i enskild firma', () => {
    const ef = { orgType: 'Enskild firma' };
    expect(suggestCounterAccount({ description: 'Debiterad preliminärskatt', amount: -1000 }, ef)).toMatchObject({ account: '2012', sure: true });
    expect(suggestCounterAccount({ description: 'Kostnadsränta', amount: -11 }, ef)).toMatchObject({ account: null, sure: false });
  });
});

describe('buildSkattekontoPreview', () => {
  const { events } = parseSkattekontoFile(CSV);

  it('känner igen en händelse som redan är bokförd för hand', () => {
    const existing = [{ id: 'v1', number: 'A012', date: '2026-01-09', status: 'booked', rows: [{ account: '1630', debet: 4626, kredit: 0 }, { account: '1930', debet: 0, kredit: 4626 }] }];
    const rows = buildSkattekontoPreview(events, existing, { orgType: 'Aktiebolag (AB)' });
    expect(rows[0]).toMatchObject({ status: 'booked', matchedNumber: 'A012', include: false });
    expect(rows[1]).toMatchObject({ status: 'ready', include: true, account: '2518' });
    expect(rows[4]).toMatchObject({ status: 'check', include: true, account: null });
  });

  it('bokför inte samma fil två gånger', () => {
    const first = buildSkattekontoPreview(events, [], {});
    const booked = first.filter(r => r.account).map(r => ({ ...buildSkattekontoVerification(r), id: r.key }));
    const again = buildSkattekontoPreview(events, booked, {});
    expect(again.filter(r => r.status === 'imported')).toHaveLength(booked.length);
  });
});

describe('buildSkattekontoVerification och saldot', () => {
  it('bokför ett negativt belopp som kredit 1630 och ger rätt saldo', () => {
    const v = buildSkattekontoVerification({ date: '2026-01-12', description: 'Debiterad preliminärskatt', amount: -4000, account: '2518', sourceId: 'x' });
    expect(v.rows).toEqual([
      { account: '1630', accountName: expect.any(String), debet: '0', kredit: '4000.00' },
      { account: '2518', accountName: 'Betald F-skatt', debet: '4000.00', kredit: '0' },
    ]);
    expect(taxAccountBalance([{ ...v, status: 'booked' }], '2026-12-31')).toBe(-4000);
    expect(taxAccountBalance([{ ...v, status: 'booked' }], '2026-01-11')).toBe(0);
  });
});
