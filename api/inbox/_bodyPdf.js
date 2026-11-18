import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Ett mejl utan bilaga (kvittot står i själva mejlet, som från många
// webbutiker) blir ett underlag ändå: texten skrivs till en PDF med
// avsändare, ämne och datum överst (2026-11-18). Bokföringslagen kräver ett
// underlag; mejlet är underlaget.

const MIN_TEXT = 20;

/** Gör om HTML till läsbar text: radbrytningar vid block, inga taggar. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Mejlets text (text-delen, annars HTML-delen), städad. Tom om för kort. */
export function emailText(mail) {
  const raw = mail?.text && String(mail.text).trim() ? String(mail.text) : htmlToText(mail?.html);
  const text = raw.replace(/\r/g, '').split('\n').map(l => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return text.length >= MIN_TEXT ? text : '';
}

// Standardtypsnittet klarar bara WinAnsi (svenska tecken, €, citattecken).
// Annat (emoji, kinesiska) tas bort i stället för att PDF:en inte blir av.
const ALLOWED = /[\t\n\x20-\x7E -ÿ€–—‘’“”•…]/;
function winAnsi(s) {
  return [...String(s || '')].map(ch => (ALLOWED.test(ch) ? ch : (ch === '−' ? '-' : ''))).join('');
}

function wrap(text, font, size, maxWidth) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) { line = next; continue; }
      if (line) out.push(line);
      // Ett ord längre än raden (en lång länk) delas.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let n = rest.length;
        while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > maxWidth) n--;
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

/** PDF (Buffer) med avsändare, ämne, datum och mejlets text. */
export async function emailBodyPdf({ from = '', subject = '', date = '', text = '' }) {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsi(subject || 'Mejl'));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28; const H = 841.89; const M = 56; const size = 10.5; const lh = 15;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const draw = (str, f = font, s = size, color = rgb(0.1, 0.1, 0.1)) => {
    if (y < M) { page = doc.addPage([W, H]); y = H - M; }
    page.drawText(str, { x: M, y, size: s, font: f, color });
    y -= lh;
  };
  wrap(winAnsi(subject || 'Mejl'), bold, 14, W - 2 * M).forEach(l => { draw(l, bold, 14); y -= 3; });
  y -= 4;
  const muted = rgb(0.4, 0.4, 0.4);
  if (from) draw(winAnsi(`Från: ${from}`), font, 9.5, muted);
  if (date) draw(winAnsi(`Datum: ${date}`), font, 9.5, muted);
  draw('Mejlet sparat som underlag av Bokix.', font, 9.5, muted);
  y -= 6;
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.6, color: rgb(0.82, 0.82, 0.82) });
  y -= 6;
  wrap(winAnsi(text), font, size, W - 2 * M).forEach(l => draw(l));
  return Buffer.from(await doc.save());
}
