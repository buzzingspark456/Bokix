import { describe, it, expect } from 'vitest';
import { bankRowsForReceipt, receiptCandidates } from './bankMatching';
import { ownerPaidAccount } from './paidBy';
import { readInvoiceDetails } from './invoiceDetails';

describe('Matcha mot transaktion', () => {
  const rows = [
    { id: 'a', date: '2026-06-26', amount: -350, description: 'GUSTO&LAGUNEN', status: 'unmatched' },
    { id: 'b', date: '2026-06-24', amount: -396, description: 'GUSTO&LAGUNEN', status: 'unmatched' },
    { id: 'c', date: '2026-06-23', amount: -396, description: 'Redan kopplad', status: 'matched' },
    { id: 'd', date: '2026-06-23', amount: 1000, description: 'Insättning', status: 'unmatched' },
  ];
  it('lägger samma belopp nära i datum först och tar bara ohanterade utgående rader', () => {
    const out = bankRowsForReceipt({ amount: 396, date: '2026-06-23' }, rows);
    expect(out.map(x => x.row.id)).toEqual(['b', 'a']);
    expect(out[0].exact).toBe(true);
    expect(out[1].exact).toBe(false);
  });
  it('söker i text och belopp', () => {
    expect(bankRowsForReceipt({ amount: 396, date: '2026-06-23' }, rows, '350').map(x => x.row.id)).toEqual(['a']);
    expect(bankRowsForReceipt({ amount: 396, date: '2026-06-23' }, rows, 'insättning')).toEqual([]);
  });
  it('ett privat betalt kvitto föreslås inte för en bankrad', () => {
    const row = { id: 'x', date: '2026-06-24', amount: -396 };
    expect(receiptCandidates(row, [{ id: 'r', date: '2026-06-23', amount: 396, paidBy: 'owner' }])).toEqual([]);
  });
});

describe('Vem betalade', () => {
  it('väljer konto efter bolagsform', () => {
    expect(ownerPaidAccount('556794-7535')).toBe('2893');
    expect(ownerPaidAccount('850315-1234')).toBe('2018');
    expect(ownerPaidAccount('969999-1234')).toBe('2018');
    expect(ownerPaidAccount('769999-1234')).toBe('2890');
  });
});

describe('VAT-nr och IBAN ur fakturan', () => {
  it('läser säljarens momsnummer och ett giltigt IBAN', () => {
    const d = readInvoiceDetails('Alwake kapell Kåge\nOrg.nr 559450-5249\nMomsreg.nr SE559450524901\nIBAN SE45 5000 0000 0583 9825 7466\nBankgiro 294-4379');
    expect(d.vatNr).toBe('SE559450524901');
    expect(d.iban).toBe('SE45 5000 0000 0583 9825 7466');
  });
  it('tar inte ett IBAN som inte klarar kontrollen', () => {
    const d = readInvoiceDetails('Org.nr 559450-5249\nIBAN SE45 5000 0000 0583 9825 7467');
    expect(d.iban).toBe(null);
  });
  it('räknar bort företagets eget momsnummer', () => {
    const d = readInvoiceDetails('Köpare SE556794753501', { own: { orgNr: '556794-7535' } });
    expect(d?.vatNr || null).toBe(null);
  });
});

describe('Org.nr när avläsningen förvanskat ordet', () => {
  it('hittar 738200-2850 på "Ors Nr"-raden i Coop-kvittot', () => {
    const d = readInvoiceDetails('Kagerod\nKassör 129-Tindra\nOrs Nr 738200-2850 B SEK\nATT BETALA 198,78');
    expect(d.orgNr).toBe('738200-2850');
    expect(d.orgNrGuessed).toBe(false);
  });
  it('tar inte ett personnummer eller ett nummer som inte klarar kontrollsiffran', () => {
    expect(readInvoiceDetails('Kund 850315-1234')?.orgNr || null).toBe(null);
    expect(readInvoiceDetails('Ref 738200-2851')?.orgNr || null).toBe(null);
  });
});

describe('Faktura med sidfot i kolumner (Gumboda Kapell)', () => {
  const text = 'Kontantfaktura\nFakturadatum 2026-10-12\nFakturanr 462\nOCR 46250\nPatrik Klasson\nStockaryd Björkäng\n576 94 Stockaryd\nMoms 25% 946,43 (3 785,72) IBAN SE04 9660 0000 0966 0632 7484\nAdress Telefon Bankgiro Organisationsnr\nAlwake kapell Kåge 0702-123456 294-4379 559450-5249\nKågevägen 1 info@gumbodakapell.se Momsreg.nr\n934 32 Kåge www.gumbodakapell.se SE559450524901';
  it('läser org.nr, VAT-nr, bankgiro, IBAN och OCR', () => {
    const d = readInvoiceDetails(text);
    expect(d.orgNr).toBe('559450-5249');
    expect(d.vatNr).toBe('SE559450524901');
    expect(d.bankgiro).toBe('294-4379');
    expect(d.iban).toBe('SE04 9660 0000 0966 0632 7484');
    expect(d.ocrNumber).toBe('46250');
  });
});

describe('Underlag från företaget självt', () => {
  const text = 'Kontantfaktura\nAdress Telefon Bankgiro Organisationsnr\nAlwake kapell Kåge 0730313589 294-4379 559450-5249\nMomsreg. nr\nSE559450524901';
  it('säger till när bara företagets eget nummer finns', () => {
    const d = readInvoiceDetails(text, { own: { orgNr: '559450-5249' } });
    expect(d.orgNr).toBe(null);
    expect(d.vatNr).toBe(null);
    expect(d.ownOnly).toBe(true);
  });
  it('inte när säljarens nummer också finns', () => {
    const d = readInvoiceDetails(text, { own: { orgNr: '556794-7535' } });
    expect(d.ownOnly).toBe(false);
  });
});

describe('Utlägg för anställda', () => {
  it('lönearten Utlägg är skattefri och bokförs mot 2820', async () => {
    const { summarizePayLines, getPayType } = await import('./payTypes');
    expect(getPayType('expense_refund')).toMatchObject({ kind: 'taxFree', account: '2820' });
    const s = summarizePayLines([{ payTypeId: 'expense_refund', quantity: 1, rate: 193.75, note: 'Coop' }], {});
    expect(s.taxFree).toBe(194);
    expect(s.additions).toBe(0);
    expect(s.lines[0].amount).toBe(193.75);
  });
  it('ett anställds utlägg föreslås inte för en bankrad', () => {
    const row = { id: 'x', date: '2026-06-24', amount: -396 };
    expect(receiptCandidates(row, [{ id: 'r', date: '2026-06-23', amount: 396, paidBy: 'employee' }])).toEqual([]);
  });
});
