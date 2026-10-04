import { describe, it, expect } from 'vitest';
import { locateFieldBoxes } from './ocrFieldBoxes';

const line = (text, y) => ({ text, box: { x: 0.1, y, w: 0.8, h: 0.03 } });

const LAYOUT = [
  line('CIRCLE K SVERIGE AB', 0.05),
  line('Kvitto 4471', 0.12),
  line('2026-08-18 09:12 Kassa 3', 0.15),
  line('Miles 95 E10 810,00', 0.3),
  line('Kaffe stor 32,00', 0.34),
  line('TOTALT SEK 842,00', 0.5),
  line('Moms 25% 168,40', 0.55),
  line('Kort 842,00', 0.7),
];

describe('locateFieldBoxes', () => {
  it('hittar raderna för huvuduppgifterna', () => {
    const b = locateFieldBoxes(LAYOUT, { supplier: 'Circle K', date: '2026-08-18', amount: 842, vatAmount: 168.4, receiptNumber: '4471' });
    expect(b.supplier.y).toBe(0.05);
    expect(b.date.y).toBe(0.15);
    expect(b.amount.y).toBe(0.5);
    expect(b.vatAmount.y).toBe(0.55);
    expect(b.receiptNumber.y).toBe(0.12);
  });

  it('beloppet på totalraden före en annan rad med samma tal', () => {
    expect(locateFieldBoxes(LAYOUT, { amount: 842 }).amount.y).toBe(0.5);
  });

  it('tål tusentalsavgränsare och andra datumformat', () => {
    const layout = [line('Att betala 1 284,00 kr', 0.8), line('Datum 18/08/2026', 0.2), line('17 aug. 2026', 0.25)];
    const b = locateFieldBoxes(layout, { amount: 1284, date: '2026-08-18' });
    expect(b.amount.y).toBe(0.8);
    expect(b.date.y).toBe(0.2);
    expect(locateFieldBoxes(layout, { date: '2026-08-17' }).date.y).toBe(0.25);
  });

  it('markerar inget som inte står på kvittot', () => {
    const b = locateFieldBoxes(LAYOUT, { supplier: 'Stripe', amount: 999, date: '2026-01-01' });
    expect(b).toEqual({});
  });

  it('leverantören via e-postadressen', () => {
    const layout = [line('~~ %', 0.02), line('Questions? support@stripe.com', 0.9)];
    expect(locateFieldBoxes(layout, { supplier: 'Stripe' }).supplier.y).toBe(0.9);
  });
});
