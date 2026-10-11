import { describe, it, expect } from 'vitest';
import { groupInboxItems, buildInboxDigestHtml, inboxDigestSubject, yesterdayInStockholm } from './_inboxDigest.js';

// 08:00 svensk sommartid den 11 oktober.
const NOW = new Date('2026-10-11T06:00:00Z');
const row = (over) => ({ id: 'i', owner_user_id: 'u1', company_id: 'c1', status: 'new', received_at: '2026-10-10T12:00:00Z', email_id: 'e1', from_email: 'faktura@telia.se', subject: 'Faktura', ...over });

describe('groupInboxItems', () => {
  it('tar bara gårdagens nya rader, i svensk tid', () => {
    expect(yesterdayInStockholm(NOW)).toBe('2026-10-10');
    const groups = groupInboxItems([
      row({ id: 'a' }),
      row({ id: 'b', received_at: '2026-10-09T22:30:00Z' }), // 00:30 den 10:e i Sverige
      row({ id: 'c', received_at: '2026-10-10T22:30:00Z' }), // 00:30 den 11:e: nästa dag
      row({ id: 'd', status: 'imported' }),
      row({ id: 'e', company_id: 'c2' }),
    ], NOW);
    expect(groups.get('u1|c1').map(r => r.id)).toEqual(['a', 'b']);
    expect(groups.get('u1|c2').map(r => r.id)).toEqual(['e']);
  });
});

describe('buildInboxDigestHtml', () => {
  it('slår ihop bilagor från samma mejl och escapar avsändare och ämne', () => {
    const items = [
      row({ id: 'a', email_id: 'e1', file_name: '1.pdf' }),
      row({ id: 'b', email_id: 'e1', file_name: '2.pdf' }),
      row({ id: 'c', email_id: 'e2', from_email: '<script>@x.se', subject: '<b>hej</b>' }),
    ];
    const html = buildInboxDigestHtml({ company: { name: 'Exempel AB' }, items, siteUrl: 'https://www.bokix.se' });
    expect(html).toContain('3 nya kvitton');
    expect(html).toContain('faktura@telia.se: Faktura (2 filer)');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;hej&lt;/b&gt;');
    expect(inboxDigestSubject(items)).toBe('3 nya kvitton i e-postinkorgen');
    expect(inboxDigestSubject([items[0]])).toBe('1 nytt kvitto i e-postinkorgen');
  });
});
