// Kör: npx vite --port 5199, sedan node scripts/app-harness-kontrast.mjs
// Mäter kontrasten mellan text och bakgrund på appens sidor i ljust och
// mörkt läge och listar det som är svårläst (under 3:1 för text, WCAG AA
// kräver 4,5:1 för brödtext). Skriver test-results/kontrast.json.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };
const PAGES = ['dashboard', 'contacts', 'quotes', 'invoices', 'expenses', 'supplier_invoices', 'bank', 'verifications', 'review', 'reports', 'taxes', 'payroll', 'settings', 'projects', 'articles'];
const LIMIT = 3;

const browser = await chromium.launch();
const p0 = await browser.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
const id = company.company.id;
const row = { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: '2026-10-10T12:00:00+00:00', onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name };

const findings = [];
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const page = await ctx.newPage();
  await page.addInitScript(([key, val, th]) => {
    sessionStorage.setItem(key, val);
    localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1');
    localStorage.setItem('bokix_theme_pref', th);
  }, [`sb-${REF}-auth-token`, JSON.stringify(session), theme]);
  const reply = (route, data, wantsObject) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? data : (data == null ? [] : Array.isArray(data) ? data : [data])) });
  await page.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
    if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    const table = url.pathname.replace('/rest/v1/', '');
    if (table === 'user_data') return reply(route, row, wantsObject);
    if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
    return reply(route, wantsObject ? null : [], wantsObject);
  });
  await page.route('**/api/**', r => r.fulfill({ json: {} }));
  await page.goto(BASE + '/?app=1');
  await page.waitForSelector('.dash-top', { timeout: 25000 });
  for (const tab of PAGES) {
    await page.evaluate((t) => { window.location.hash = t; }, tab);
    await page.waitForTimeout(1300);
    const bad = await page.evaluate((limit) => {
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(x => parseFloat(x)); return { r, g, b, a }; };
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
      const bgOf = (el) => {
        const layers = [];
        for (let n = el; n; n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
          if (getComputedStyle(n).backgroundImage !== 'none') return null; // bild/gradient: hoppa över
        }
        let base = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
        if (base.a < 1) base = { r: 255, g: 255, b: 255, a: 1 };
        return layers.reverse().reduce((acc, l) => blend(l, acc), base);
      };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const t = walker.currentNode.textContent.trim();
        const el = walker.currentNode.parentElement;
        if (!t || !el || seen.has(el)) continue;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (rect.width === 0 || rect.height === 0 || cs.visibility === 'hidden' || Number(cs.opacity) < 0.6 || el.closest('[aria-hidden="true"], button:disabled, input:disabled, select:disabled')) continue;
        if (el.closest('.sidebar, .mobile-bottom-nav, .mobile-sheet, nav[aria-label="Huvudmeny"]')) continue;
        const fg = parse(cs.color); const bg = bgOf(el);
        if (!fg || !bg) continue;
        const fgB = fg.a < 1 ? blend(fg, bg) : fg;
        const L1 = lum(fgB), L2 = lum(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (ratio < limit) {
          const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '';
          out.push({ text: t.slice(0, 50), ratio: Math.round(ratio * 100) / 100, tag: el.tagName.toLowerCase() + (cls ? '.' + cls : ''), color: cs.color, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})` });
        }
      }
      return out;
    }, LIMIT);
    for (const b of bad) findings.push({ theme, page: tab, ...b });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync('test-results/kontrast.json', JSON.stringify(findings, null, 1));
const byKey = {};
for (const f of findings) { const k = `${f.theme} | ${f.tag} | ${f.color} på ${f.bg}`; (byKey[k] ||= { n: 0, ratio: f.ratio, pages: new Set(), ex: f.text }); byKey[k].n++; byKey[k].pages.add(f.page); }
const rows = Object.entries(byKey).sort((a, b) => a[1].ratio - b[1].ratio);
console.log(`${findings.length} svårlästa texter (under ${LIMIT}:1), ${rows.length} olika sorter:`);
for (const [k, v] of rows.slice(0, 60)) console.log(`${v.ratio}:1  ${k}  ×${v.n}  [${[...v.pages].join(',')}]  t.ex. "${v.ex}"`);
