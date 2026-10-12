import { describe, it, expect } from 'vitest';
import { bookableDays, isValidSlot, stockholmToUtc, formatSlot, bookingMessage, slotFromMessage, bookingIcs, stockholmToday } from './demoBooking';

// Lördag 4 oktober 2026, 12:00 svensk tid.
const NOW = new Date('2026-10-04T10:00:00Z');

describe('demoBooking', () => {
  it('ger bara vardagar från i morgon', () => {
    const days = bookableDays(NOW);
    expect(days[0]).toBe('2026-10-05');
    expect(days).not.toContain('2026-10-04');
    expect(days).not.toContain('2026-10-10');
    expect(days.length).toBe(15);
  });

  it('räknar dagen i svensk tid, inte UTC', () => {
    expect(stockholmToday(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05');
  });

  it('godtar bara tider i listan', () => {
    expect(isValidSlot('2026-10-05 10:00', NOW)).toBe(true);
    expect(isValidSlot('2026-10-05 12:00', NOW)).toBe(false);
    expect(isValidSlot('2026-10-04 10:00', NOW)).toBe(false);
    expect(isValidSlot('2026-10-10 10:00', NOW)).toBe(false);
    expect(isValidSlot('2027-01-05 10:00', NOW)).toBe(false);
    expect(isValidSlot('nonsens', NOW)).toBe(false);
  });

  it('räknar om till UTC med sommar- och vintertid', () => {
    expect(stockholmToUtc('2026-10-05 10:00').toISOString()).toBe('2026-10-05T08:00:00.000Z');
    expect(stockholmToUtc('2026-11-02 10:00').toISOString()).toBe('2026-11-02T09:00:00.000Z');
  });

  it('formaterar på svenska', () => {
    expect(formatSlot('2026-10-06 13:30')).toBe('tisdag 6 oktober kl. 13:30');
  });

  it('läser tillbaka tiden ur meddelandet', () => {
    const msg = bookingMessage({ slot: '2026-10-06 13:30', mode: 'phone', company: 'Ab', phone: '070', note: 'Hej' });
    expect(msg.startsWith('Tid: 2026-10-06 13:30\nForm: Telefonsamtal')).toBe(true);
    expect(slotFromMessage(msg)).toBe('2026-10-06 13:30');
    expect(slotFromMessage('Hej')).toBe(null);
  });

  it('bygger en kalenderfil', () => {
    const ics = bookingIcs({ slot: '2026-10-05 10:00', mode: 'video', now: NOW });
    expect(ics).toContain('DTSTART:20261005T080000Z');
    expect(ics).toContain('DTEND:20261005T082500Z');
  });
});
