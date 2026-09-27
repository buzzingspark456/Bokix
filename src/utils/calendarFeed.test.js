import { describe, it, expect } from 'vitest';
import { buildCalendarEvents, calendarChoices, toIcs, calendarFeedUrl, newCalendarKey } from './calendarFeed.js';

const today = new Date('2026-09-27T12:00:00');

describe('buildCalendarEvents', () => {
  it('lägger in kommande momsdeklarationer men inte bokförda perioder', () => {
    const events = buildCalendarEvents({
      company: { vatPeriod: 'quarterly' },
      vatPeriods: { '2026-Q2': { verificationId: 'v1' }, '2026-Q3': { remindersSent: ['7d'] } },
    }, { today, invoices: false });
    const uids = events.map(e => e.uid);
    expect(uids).not.toContain('moms-2026-Q2');
    // En påminnelsemarkör ensam gör inte perioden klar.
    expect(uids).toContain('moms-2026-Q3');
    const q3 = events.find(e => e.uid === 'moms-2026-Q3');
    expect(q3.date).toBe('2026-11-12');
  });

  it('har ingen moms för företag som inte är momsregistrerade', () => {
    const events = buildCalendarEvents({ company: { vatRegistered: false } }, { today, invoices: false });
    expect(events.filter(e => e.uid.startsWith('moms-'))).toHaveLength(0);
  });

  it('har AGI och KU bara när företaget kör löner', () => {
    expect(buildCalendarEvents({ company: {} }, { today }).some(e => e.uid.startsWith('agi-'))).toBe(false);
    const events = buildCalendarEvents({ company: {}, payrollRuns: [{ id: 'p1' }] }, { today });
    expect(events.some(e => e.uid === 'agi-2026-09' && e.date === '2026-10-12')).toBe(true);
    expect(events.some(e => e.uid === 'ku-2027' && e.date === '2027-02-01')).toBe(true);
  });

  it('lägger in obetalda fakturor med kund och belopp, men inte betalda, utkast eller offerter', () => {
    const events = buildCalendarEvents({
      company: { vatRegistered: false },
      contacts: [{ id: 'c1', name: 'Kund AB' }],
      invoices: [
        { id: 'i1', invoiceNumber: '1001', customerId: 'c1', status: 'sent', dueDate: '2026-10-22', rows: [{ qty: 2, unitPrice: 500, vatRate: 25 }] },
        { id: 'i2', invoiceNumber: '1002', status: 'paid', dueDate: '2026-10-22' },
        { id: 'i3', invoiceNumber: '1003', status: 'draft', dueDate: '2026-10-22' },
        { id: 'i4', invoiceNumber: '1004', type: 'quote', status: 'sent', dueDate: '2026-10-22' },
      ],
    }, { today, vat: false, agi: false, ku: false, supplierInvoices: false });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ uid: 'faktura-i1', date: '2026-10-22', title: 'Faktura 1001 förfaller (Kund AB)', description: '1 250 kr från Kund AB.' });
  });

  it('respekterar varje val för sig', () => {
    const data = { company: {}, payrollRuns: [{ id: 'p' }], invoices: [{ id: 'i1', invoiceNumber: '1', status: 'sent', dueDate: '2026-10-01' }] };
    const none = { vat: false, agi: false, ku: false, invoices: false, supplierInvoices: false };
    expect(buildCalendarEvents(data, { today, ...none })).toHaveLength(0);
    const onlyAgi = buildCalendarEvents(data, { today, ...none, agi: true });
    expect(onlyAgi.length).toBeGreaterThan(0);
    expect(onlyAgi.every(e => e.uid.startsWith('agi-'))).toBe(true);
  });

  it('lägger in obetalda leverantörsfakturor som något att betala', () => {
    const events = buildCalendarEvents({
      company: { vatRegistered: false },
      contacts: [{ id: 's1', name: 'Leverantör AB' }],
      expenses: [
        { id: 'e1', type: 'supplier_invoice', supplierId: 's1', invoiceNumber: '55', dueDate: '2026-10-15', amount: 2500, ocrNumber: '123' },
        { id: 'e2', type: 'supplier_invoice', status: 'paid', dueDate: '2026-10-15', amount: 1 },
        { id: 'e3', type: 'receipt', dueDate: '2026-10-15', amount: 1 },
      ],
    }, { today, invoices: false });
    expect(events).toEqual([{ uid: 'lev-e1', date: '2026-10-15', title: 'Betala Leverantör AB (faktura 55)', description: '2 500 kr, OCR 123.' }]);
  });
});

describe('calendarChoices', () => {
  it('allt på som standard, och det gamla samlade skattevalet gäller tills delarna valts', () => {
    expect(calendarChoices({})).toEqual({ vat: true, agi: true, ku: true, invoices: true, supplierInvoices: true });
    expect(calendarChoices({ taxDeadlines: false })).toMatchObject({ vat: false, agi: false, ku: false });
    expect(calendarChoices({ taxDeadlines: false, vat: true })).toMatchObject({ vat: true, agi: false });
  });
});

describe('toIcs', () => {
  it('skriver heldagshändelser och skyddar specialtecken', () => {
    const ics = toIcs([{ uid: 'x', date: '2026-10-22', title: 'Faktura 1, Kund; AB', description: 'rad1\nrad2' }], { calendarName: 'Bokix – Test AB', now: new Date('2026-09-27T10:00:00Z') });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261022');
    expect(ics).toContain('DTEND;VALUE=DATE:20261023');
    expect(ics).toContain('SUMMARY:Faktura 1\\, Kund\\; AB');
    expect(ics).toContain('DESCRIPTION:rad1\\nrad2');
    expect(ics).toContain('UID:x@bokix.se');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('viker långa rader till högst 75 byte', () => {
    const ics = toIcs([{ uid: 'y', date: '2026-10-22', title: 'Å'.repeat(80) }]);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('länken', () => {
  it('bygger adressen och en lång slumpad nyckel', () => {
    const key = newCalendarKey();
    expect(key).toMatch(/^[0-9a-f]{48}$/);
    expect(calendarFeedUrl('https://www.bokix.se', 'u1', 'c1', 'k1')).toBe('https://www.bokix.se/api/calendar?u=u1&c=c1&k=k1');
  });
});
