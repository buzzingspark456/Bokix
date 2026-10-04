import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { makeInboxToken, tokenFromAddress, verifySvixSignature, pickAttachments, attachmentType, safeFileName, gmailConfirmationCode } from './_inbox.js';

describe('inkorgens adress', () => {
  it('bygger en läsbar adress av företagsnamnet', () => {
    const t = makeInboxToken('Bokix Åkeri & Söner AB', Buffer.from([0, 1, 2, 3, 4, 5, 6]));
    expect(t).toMatch(/^bokixakerisone-[a-z2-9]{7}$/);
  });

  it('läser token ur mottagaren bara på rätt domän', () => {
    expect(tokenFromAddress('Bokix <BokixAB-k29fq7m@inbox.bokix.se>', 'inbox.bokix.se')).toBe('bokixab-k29fq7m');
    expect(tokenFromAddress('bokixab-k29fq7m@inbox.bokix.se', 'inbox.bokix.se')).toBe('bokixab-k29fq7m');
    expect(tokenFromAddress('someone@gmail.com', 'inbox.bokix.se')).toBe(null);
  });
});

describe('webhookens signatur', () => {
  const secret = 'whsec_' + Buffer.from('hemlig-nyckel-for-test').toString('base64');
  const body = '{"type":"email.received"}';
  const sign = (id, ts) => createHmac('sha256', Buffer.from('hemlig-nyckel-for-test')).update(`${id}.${ts}.${body}`).digest('base64');

  it('godtar en riktig signatur', () => {
    expect(verifySvixSignature({ id: 'msg_1', timestamp: '1000', signature: `v1,${sign('msg_1', 1000)}` }, body, secret, 1010)).toBe(true);
    expect(verifySvixSignature({ id: 'msg_1', timestamp: '1000', signature: `v1,fel v1,${sign('msg_1', 1000)}` }, body, secret, 1010)).toBe(true);
  });

  it('avvisar fel signatur, ändrad kropp och gammal tidpunkt', () => {
    expect(verifySvixSignature({ id: 'msg_1', timestamp: '1000', signature: 'v1,AAAA' }, body, secret, 1010)).toBe(false);
    expect(verifySvixSignature({ id: 'msg_1', timestamp: '1000', signature: `v1,${sign('msg_1', 1000)}` }, body + ' ', secret, 1010)).toBe(false);
    expect(verifySvixSignature({ id: 'msg_1', timestamp: '1000', signature: `v1,${sign('msg_1', 1000)}` }, body, secret, 2000)).toBe(false);
  });
});

describe('bilagor', () => {
  it('tar PDF och bilder men inte signaturens logotyp', () => {
    const picked = pickAttachments([
      { filename: 'faktura.pdf', content_type: 'application/pdf', size: 80000 },
      { filename: 'logo.png', content_type: 'image/png', size: 9000, content_disposition: 'inline' },
      { filename: 'kvitto.jpg', content_type: 'image/jpeg', size: 900000, content_disposition: 'inline' },
      { filename: 'avtal.docx', content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 },
      { filename: 'stor.pdf', content_type: 'application/pdf', size: 50 * 1024 * 1024 },
    ]);
    expect(picked.map(a => a.filename)).toEqual(['faktura.pdf', 'kvitto.jpg']);
  });

  it('känner igen en PDF som skickats som octet-stream', () => {
    expect(attachmentType({ filename: 'Faktura 8841.PDF', content_type: 'application/octet-stream' })).toBe('application/pdf');
  });

  it('gör ett säkert filnamn', () => {
    expect(safeFileName('../../Faktura 8841.pdf', 'application/pdf')).toBe('Faktura 8841.pdf');
    expect(safeFileName('', 'image/png')).toBe('underlag.png');
  });
});

describe('Gmails bekräftelse', () => {
  it('hittar koden', () => {
    expect(gmailConfirmationCode('forwarding-noreply@google.com', '(#123456789) Gmail Forwarding Confirmation', '')).toBe('123456789');
    expect(gmailConfirmationCode('forwarding-noreply@google.com', 'Bekräftelse', 'Bekräftelsekod: 987654321')).toBe('987654321');
    expect(gmailConfirmationCode('someone@example.com', '(#123456789)', '')).toBe(null);
  });
});
