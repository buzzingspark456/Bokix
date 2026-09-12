// ─────────────────────────────────────────────────────────────────────────
// En egen, liten Markdown-till-HTML-omvandlare för blogginläggen — inget
// npm-beroende (marked/react-markdown m.fl.) för ett innehållsformat som
// bara behöver täcka det admin faktiskt skriver: rubriker, fet/kursiv
// text, länkar, bilder, listor, citat och kodblock. Samma "skriv det
// själva i stället för att dra in ett helt bibliotek för en liten sak"-
// linje som ConfirmDialog.jsx (ersätter window.confirm) och Toast redan
// följer i den här kodbasen.
//
// SÄKERHET: innehållet kommer bara från admin-panelen (api/admin/index.js
// kräver en hårdkodad admin-e-post, se den filens ADMIN_EMAILS) — inte
// från allmänheten. Trots det escapas all rå text INNAN Markdown-
// syntaxen tolkas, så en oavsiktligt inklistrad "<script>" i ett
// blogginlägg aldrig kan exekvera på den publika sidan. Det enda som
// släpps igenom orenat är href/src-attributen på länkar/bilder admin
// själv skrivit in, och bara efter en protokoll-vitlista (http/https/
// mailto) — aldrig javascript:-URL:er.
// ─────────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(url) {
  const trimmed = String(url || '').trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return escapeHtml(trimmed);
  if (/^\//.test(trimmed)) return escapeHtml(trimmed); // relativ länk, t.ex. /priser
  return '#';
}

/** Inline-syntax: **fet**, *kursiv*, `kod`, [text](url), ![alt](url) —
 * körs på redan HTML-escapad text, så syntaxtecknen själva är säkra att
 * matcha rakt av. */
function renderInline(text) {
  let html = text;
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => `<img src="${safeUrl(url)}" alt="${escapeHtml(alt)}" loading="lazy" />`);
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `<a href="${safeUrl(url)}" target="${/^https?:/i.test(url) ? '_blank' : '_self'}" rel="noopener noreferrer">${label}</a>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return html;
}

/**
 * Markdown → HTML. Blocknivå: #/##/### rubriker, > citat, ```kodblock```,
 * - / 1. listor, --- horisontell linje, tomrad = nytt stycke.
 */
export function markdownToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let listBuffer = null; // { type: 'ul'|'ol', items: [] }

  const flushList = () => {
    if (!listBuffer) return;
    const tag = listBuffer.type;
    blocks.push(`<${tag}>${listBuffer.items.map(item => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`);
    listBuffer = null;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { codeLines.push(lines[i]); i++; }
      i++; // stäng ```
      flushList();
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length + 1; // # → h2, ## → h3, ### → h4 (h1 är sidans egen titel)
      blocks.push(`<h${level}>${renderInline(escapeHtml(heading[2]))}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushList();
      blocks.push('<hr />');
      i++;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushList();
      const quoteLines = [quote[1]];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(`<blockquote>${renderInline(escapeHtml(quoteLines.join(' ')))}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (unordered || ordered) {
      const type = unordered ? 'ul' : 'ol';
      const item = escapeHtml((unordered || ordered)[1]);
      if (listBuffer && listBuffer.type !== type) flushList();
      if (!listBuffer) listBuffer = { type, items: [] };
      listBuffer.items.push(item);
      i++;
      continue;
    }

    if (line === '') {
      flushList();
      i++;
      continue;
    }

    // Vanligt stycke — samla ihop följande rader tills nästa tomrad/block,
    // så en enda mening som radbrutits i redigeraren inte blir flera
    // separata <p>-taggar.
    flushList();
    const paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|>|[-*]\s|\d+\.\s|```|(-{3,}|\*{3,})$)/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(`<p>${renderInline(escapeHtml(paraLines.join(' ')))}</p>`);
  }
  flushList();

  return blocks.join('\n');
}

/** Grov uppskattning av lästid — samma sorts "bra nog, inte exakt"-tal
 * som andra bloggar visar (~200 ord/minut på svenska). */
export function estimateReadingMinutes(markdown) {
  const words = String(markdown || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
