// Kör: npx vite --port 5199, sedan node scripts/app-harness-status.mjs (ALLOK=1 utan störningar).
// Statussidan (/status) med påhittad data från api/_status.js buildStatus, i tre storlekar/teman.
import { chromium } from '@playwright/test';
import { buildStatus } from '../api/_status.js';
const now = new Date();
const day = (n) => new Date(now.getTime() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const daily = [];
for (const c of ['app', 'login', 'data', 'ocr', 'email', 'payments']) for (let i = 0; i < 40; i++) daily.push({ day: day(i), component: c, ok: 288, degraded: 0, down: 0 });
daily.find(r => r.component === 'ocr' && r.day === day(3)).degraded = 12;
daily.find(r => r.component === 'email' && r.day === day(12)).down = 9;
const iso = (m) => new Date(now.getTime() + m * 60000).toISOString();
const latest = Object.fromEntries(['app', 'login', 'data', 'ocr', 'email', 'payments'].map(c => [c, { status: 'ok', checked_at: iso(-2) }]));
const data = process.env.ALLOK ? buildStatus({ latest, daily, incidents: [], now }) : buildStatus({ latest, daily, now, incidents: [
  { id: '1', title: 'Kvittoläsningen är långsammare än vanligt', body: 'Google svarar långsamt just nu. Kvitton läses fortfarande, men det kan ta upp till en halv minut. Nästa besked senast 15.00.', components: ['ocr'], status: 'identified', impact: 'degraded', starts_at: iso(-40) },
  { id: '2', title: 'Planerat underhåll av databasen', body: 'Bokix kan vara otillgängligt i upp till 10 minuter.', components: ['data', 'login'], status: 'maintenance', impact: 'maintenance', starts_at: iso(60 * 24 * 3) },
  { id: '3', title: 'Fakturamejl skickades inte', body: 'E-posttjänsten svarade inte. Alla mejl skickades om när den var tillbaka.', components: ['email'], status: 'resolved', impact: 'down', starts_at: new Date(now.getTime() - 12 * 86400000).toISOString(), resolved_at: new Date(now.getTime() - 12 * 86400000 + 3600000).toISOString() },
] });
const b = await chromium.launch();
for (const [w, theme] of [[1280, 'light'], [390, 'light'], [390, 'dark']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: 'http://localhost:5199' }]);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(t => localStorage.setItem('bokix_theme_pref', t), theme);
  await p.route('**/api/status', r => r.fulfill({ json: data }));
  await p.goto('http://localhost:5199/status');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `test-results/status-${w}-${theme}${process.env.ALLOK ? '-ok' : ''}.png`, fullPage: true });
  console.log(w, theme, errs);
  await ctx.close();
}
await b.close();
