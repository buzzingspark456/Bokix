import { describe, it, expect } from 'vitest';
import { emailText, emailBodyPdf, htmlToText } from './_bodyPdf.js';

describe('mejlets text som PDF', () => {
  it('gör HTML till rader och tar bort taggar', () => {
    expect(htmlToText('<p>Hej</p><p>Totalt&nbsp;249 kr</p>').trim()).toBe('Hej\nTotalt 249 kr');
  });
  it('är tom när mejlet nästan saknar text', () => {
    expect(emailText({ text: 'ok' })).toBe('');
  });
  it('skriver en PDF även med emoji och svenska tecken', async () => {
    const buf = await emailBodyPdf({ from: 'a@b.se', subject: 'Kvitto 🎉 åäö', date: '2026-11-18 10:15', text: 'Tack för köpet! Totalt 1 249,00 kr\n'.repeat(80) });
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });
});
