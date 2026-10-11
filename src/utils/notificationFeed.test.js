import { describe, it, expect } from 'vitest';
import { buildNotificationFeed, isUnread } from './notificationFeed.js';

const t = (key, vars = {}) => `${key}${Object.keys(vars).length ? ' ' + JSON.stringify(vars) : ''}`;
const NOW = new Date('2026-10-11T10:00:00Z');

describe('buildNotificationFeed', () => {
  it('visar bara Betala nu-betalningar, inte egna markeringar', () => {
    const feed = buildNotificationFeed({ t, now: NOW, invoices: [
      { id: 'a', invoiceNumber: '1008', status: 'paid', paidVia: 'stripe', paidDate: '2026-10-10', paidAmount: 72500 },
      { id: 'b', invoiceNumber: '1009', status: 'paid', paidDate: '2026-10-10', paidAmount: 100 },
      { id: 'c', invoiceNumber: '1001', status: 'paid', paidVia: 'stripe', paidDate: '2026-08-01', paidAmount: 100 },
    ] });
    expect(feed.map(n => n.keys[0])).toEqual(['paid:a']);
    expect(feed[0].text.replace(/\s/g, ' ')).toContain('72 500 kr');
  });

  it('slår ihop mejlade kvitton per dag', () => {
    const feed = buildNotificationFeed({ t, now: NOW, expenses: [
      { id: '1', inbox: { from: 'faktura@telia.se', receivedAt: '2026-10-11T07:00:00Z' } },
      { id: '2', inbox: { from: 'kvitto@macken.se', receivedAt: '2026-10-11T08:00:00Z' } },
      { id: '3', inbox: { from: 'faktura@telia.se', receivedAt: '2026-10-09T08:00:00Z' } },
      { id: '4' },
    ] });
    expect(feed).toHaveLength(2);
    expect(feed[0].keys).toEqual(['inbox:1', 'inbox:2']);
    expect(feed[0].text).toContain('"count":2');
  });

  it('momsen en gång per period, ny tills den setts', () => {
    const vat = { key: '2026-Q3', label: 'kvartal 3', dueDate: new Date('2026-10-12'), daysLeft: 1 };
    const feed = buildNotificationFeed({ t, now: NOW, vat });
    expect(feed[0].keys).toEqual(['vat:2026-Q3']);
    expect(isUnread(feed[0], new Set())).toBe(true);
    expect(isUnread(feed[0], new Set(['vat:2026-Q3']))).toBe(false);
    expect(buildNotificationFeed({ t, now: NOW, vat: { ...vat, daysLeft: 20 } })).toHaveLength(0);
  });

  it('en ny bilaga samma dag gör notisen ny igen', () => {
    const feed = buildNotificationFeed({ t, now: NOW, expenses: [
      { id: '1', inbox: { from: 'a@x.se', receivedAt: '2026-10-11T07:00:00Z' } },
      { id: '2', inbox: { from: 'a@x.se', receivedAt: '2026-10-11T09:00:00Z' } },
    ] });
    expect(isUnread(feed[0], new Set(['inbox:1']))).toBe(true);
  });
});
