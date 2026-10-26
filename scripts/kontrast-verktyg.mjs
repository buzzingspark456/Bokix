// Kör: npx vite --port 5199, sedan node scripts/kontrast-verktyg.mjs [gräns, standard 4.5]
// Kontrast för all synlig text på /verktyg och varje verktygssida, ljust och
// mörkt tema. Färger räknas om via canvas, så oklch/color-mix fungerar också.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const LIMIT = Number(process.argv[2] || 4.5);
const PAGES = ['', '/momskalkylator', '/egenavgifter', '/utdelning', '/rot-rut', '/lonekalkylator', '/drojsmalsranta', '/skanna-kvitto', '/momsdatum', '/arsredovisning'];

const browser = await chromium.launch();
const findings = [];
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  await ctx.addInitScript(t => { try { localStorage.setItem('bokix_theme_pref', t); } catch { /* privat läge */ } }, theme);
  const page = await ctx.newPage();
  for (const p of PAGES) {
    await page.goto(`${BASE}/verktyg${p}`, { waitUntil: 'load' }); await page.waitForTimeout(800);
    for (let y = 0; y < 9000; y += 500) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(40); }
    await page.waitForTimeout(800);
    const bad = await page.evaluate((limit) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const rgba = (c) => {
        if (!c || c === 'transparent') return null;
        cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
        return a === 0 ? null : { r, g, b, a: a / 255 };
      };
      const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const blend = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
      const bgOf = (el) => {
        const layers = [];
        for (let n = el; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.backgroundImage !== 'none') return null;
          const c = rgba(cs.backgroundColor);
          if (c) { layers.push(c); if (c.a >= 1) break; }
        }
        const base = { r: 255, g: 255, b: 255, a: 1 };
        return layers.reverse().reduce((acc, l) => blend(l, acc), base);
      };
      const out = []; const seen = new Set();
      const main = document.querySelector('main') || document.body;
      const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const t = w.currentNode.textContent.trim(); const el = w.currentNode.parentElement;
        if (!t || !el || seen.has(el)) continue; seen.add(el);
        if (el.closest('footer, header, nav, [aria-hidden="true"]')) continue;
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.visibility === 'hidden') continue;
        const fg = rgba(cs.color); const bg = bgOf(el); if (!fg || !bg) continue;
        let op = 1; for (let n = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
        const f = blend({ ...fg, a: fg.a * op }, bg);
        const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
        if (ratio < (big ? 3 : limit)) out.push({ text: t.slice(0, 60), ratio: Math.round(ratio * 100) / 100, size: cs.fontSize, color: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})` });
      }
      return out;
    }, LIMIT);
    for (const b of bad) findings.push({ theme, page: p || '/', ...b });
  }
  await ctx.close();
}
await browser.close();
fs.mkdirSync('test-results', { recursive: true });
fs.writeFileSync('test-results/kontrast-verktyg.json', JSON.stringify(findings, null, 1));
const byKey = {};
for (const f of findings) { const k = `${f.theme} | ${f.color} på ${f.bg}`; (byKey[k] ||= { n: 0, ratio: f.ratio, pages: new Set(), ex: [] }); byKey[k].n++; byKey[k].pages.add(f.page); if (byKey[k].ex.length < 3) byKey[k].ex.push(f.text); }
const rows = Object.entries(byKey).sort((a, b) => a[1].ratio - b[1].ratio);
console.log(`${findings.length} texter under ${LIMIT}:1`);
for (const [k, v] of rows) console.log(`${v.ratio}:1  ${k}  ×${v.n}  [${[...v.pages].join(',')}]  t.ex. ${v.ex.map(e => `"${e}"`).join(' / ')}`);
