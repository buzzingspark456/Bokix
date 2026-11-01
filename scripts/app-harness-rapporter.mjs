// Kör: npx vite --port 5199, sedan node scripts/app-harness-rapporter.mjs <mapp>
// Rapportlistan, Resultaträkningen och Balansräkningen på dator, halvskärm och
// telefon, ljust och mörkt. Periodvalet ska gå att byta inne i rapporten, och
// inget får rulla i sidled.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:5199';
const OUT = process.argv[2] || 'test-results/rapporter';
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };

const browser = await chromium.launch();
const first = await browser.newContext();
await first.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const p0 = await first.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  const seed = JSON.parse(JSON.stringify(createDemoSeed()));
  // Fjolåret, så att jämförelsen syns: samma verifikationer ett år tidigare med lägre belopp.
  const earlier = seed.verifications.map((v, i) => ({
    ...v,
    id: `fjol-${i}`,
    date: `${Number(v.date.slice(0, 4)) - 1}${v.date.slice(4)}`,
    rows: v.rows.map(r => ({ ...r, debet: r.debet ? Math.round(r.debet * 0.8) : r.debet, kredit: r.kredit ? Math.round(r.kredit * 0.8) : r.kredit })),
  }));
  seed.verifications = [...earlier, ...seed.verifications];
  return seed;
});
await first.close();
// TOMT=1: ett nytt företag utan bokföring. Inget får krascha.
if (process.env.TOMT) { company.verifications = []; company.invoices = []; company.expenses = []; }
const id = company.company.id;
const row = { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: '2026-10-10T12:00:00+00:00', onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name };

const problems = [];
const text = async (page) => (await page.locator('.report-scroll').innerText()).replace(/\s+/g, ' ');

async function run(name, viewport, theme) {
  const ctx = await browser.newContext({ viewport, colorScheme: theme });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: ${String(e).slice(0, 200)}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR|CORS|Content Security/.test(m.text())) problems.push(`${name}: konsol: ${m.text().slice(0, 220)}`); });
  await page.addInitScript(([key, val, mode]) => {
    sessionStorage.setItem(key, val);
    localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1');
    localStorage.setItem('bokix_theme', mode);
  }, [`sb-${REF}-auth-token`, JSON.stringify(session), theme]);
  const reply = (route, data, one) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(one ? data : (data == null ? [] : Array.isArray(data) ? data : [data])) });
  await page.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const one = (req.headers().accept || '').includes('vnd.pgrst.object');
    if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
    if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    const table = url.pathname.replace('/rest/v1/', '');
    if (table === 'user_data') return reply(route, row, one);
    if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, one);
    return reply(route, one ? null : [], one);
  });
  await page.route('**/api/**', r => r.fulfill({ json: {} }));

  await page.goto(`${BASE}/?app=1`);
  await page.waitForSelector('.app-container', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const overlay = page.locator('.modal-overlay');
  if (await overlay.count()) {
    const later = overlay.first().getByRole('button', { name: /senare|stäng|avbryt|hoppa/i }).first();
    if (await later.count()) await later.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  if (viewport.width < 700) {
    await page.evaluate(() => [...document.querySelectorAll('button, a')].find(b => /^Rapport(er)?$/.test(b.textContent.trim()) && b.getBoundingClientRect().bottom > innerHeight - 120).click());
  } else {
    await page.getByText('Rapporter', { exact: true }).first().evaluate(el => el.click());
  }
  await page.waitForSelector('[data-tour="page-reports-list"]', { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}-lista.png`) });

  const open = async (report) => {
    await page.getByText(report, { exact: true }).first().evaluate(el => el.click());
    if (!process.env.TOMT) await page.waitForSelector('.stm', { timeout: 10000 });
    await page.waitForSelector('.report-scroll', { timeout: 10000 });
    await page.waitForTimeout(600);
  };
  const back = async () => {
    await page.getByText('Alla rapporter').first().evaluate(el => el.click());
    await page.waitForSelector('[data-tour="page-reports-list"]');
  };
  const sideways = async (label) => {
    const o = await page.evaluate(() => { const el = document.querySelector('.report-scroll'); return { scroll: el.scrollWidth, client: el.clientWidth }; });
    if (o.scroll > o.client + 1) problems.push(`${name} ${label}: rullar i sidled ${JSON.stringify(o)}`);
  };

  if (process.env.TOMT) {
    for (const report of ['Företagsöversikt', 'Resultaträkning', 'Balansräkning', 'Kassaflödesanalys', 'Fakturarapporter', 'Huvudbok', 'Bokslutsunderlag']) {
      await page.getByText(report, { exact: true }).first().evaluate(el => el.click());
      await page.waitForSelector('.report-scroll', { timeout: 10000 });
      await page.waitForTimeout(250);
      console.log(name, report, '→', (await text(page)).slice(0, 70));
      await back();
    }
    await ctx.close();
    return;
  }

  await open('Resultaträkning');
  // Alla periodval, i Resultaträkningen och alla vyer.
  for (const period of ['month', 'quarter', 'last12', 'year']) {
    await page.locator('select[aria-label="Period"]').selectOption(period);
    await page.waitForTimeout(200);
    // En period utan bokföring har inga graf-knappar, bara ett tomt läge.
    if (!(await page.getByRole('button', { name: 'Tabell' }).count())) { console.log(name, 'period', period, 'tom'); continue; }
    console.log(name, 'period', period, (await text(page)).slice(0, 60));
    for (const vy of ['Ackumulerat', 'Steg för steg', 'Tabell', /^Per (månad|dag)$/]) {
      await page.getByRole('button', { name: vy }).first().click();
      await page.waitForTimeout(100);
    }
    await sideways(`period ${period}`);
  }
  await page.screenshot({ path: path.join(OUT, `${name}-resultat.png`) });
  await sideways('resultat');
  console.log(name, (await text(page)).slice(0, 190));
  await page.getByRole('button', { name: 'Ackumulerat' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-resultat-ack.png`) });
  await page.getByRole('button', { name: 'Steg för steg' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-resultat-steg.png`) });
  // Ett klick på ett konto ska visa transaktionerna.
  const konto = page.locator('.stm-open').first();
  await konto.click();
  await page.waitForTimeout(200);
  const moves = await page.locator('.stm-move').count();
  if (!moves) problems.push(`${name}: inga transaktioner vid klick på konto`);
  await page.locator('.stm').screenshot({ path: path.join(OUT, `${name}-resultat-konton.png`) });
  await page.getByRole('button', { name: 'Sammanfattning' }).click();
  await page.waitForTimeout(200);
  await sideways('sammanfattning');

  // Byter period inne i rapporten: siffrorna ska ändras utan att man lämnar den.
  const before = (await text(page)).slice(0, 60);
  await page.locator('select[aria-label="Period"]').selectOption('quarter');
  await page.waitForTimeout(400);
  const after = (await text(page)).slice(0, 60);
  if (before === after) problems.push(`${name}: perioden ändrade ingenting`);
  await page.locator('select[aria-label="Period"]').selectOption('year');
  await back();

  // Rapporter utan uppställning: de ska också gå att öppna.
  await page.screenshot({ path: path.join(OUT, `${name}-lista2.png`) });
  const count = await page.locator('[data-tour="page-reports-list"]').getByText(/översikt|räkning|analys|rapporter|Huvudbok|Bokslutsunderlag/).count();
  console.log(name, 'rader i listan', count);
  for (const report of ['Företagsöversikt', 'Kassaflödesanalys', 'Fakturarapporter', 'Bokslutsunderlag', 'Huvudbok']) {
    await page.getByText(report, { exact: true }).first().evaluate(el => el.click());
    await page.waitForSelector('.report-scroll', { timeout: 10000 });
    await page.waitForTimeout(250);
    if (!(await text(page)).length) problems.push(`${name}: ${report} är tom`);
    await page.waitForTimeout(350);
    if (report === 'Fakturarapporter') await page.screenshot({ path: path.join(OUT, `${name}-${report}.png`) });
    if (report === 'Bokslutsunderlag') {
      await page.screenshot({ path: path.join(OUT, `${name}-arbetsblad.png`) });
      await page.locator('.ws-group').nth(2).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUT, `${name}-arbetsblad-mitt.png`) });
      await page.locator('.ws-total').scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT, `${name}-arbetsblad-slut.png`) });
      console.log(name, 'summa:', (await page.locator('.ws-total').innerText()).replace(/\s+/g, ' '));
      if (/Stämmer inte/.test(await text(page))) problems.push(`${name}: arbetsbladet stämmer inte`);
      await page.getByRole('button', { name: 'Förändring av eget kapital' }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${name}-eget-kapital.png`) });
    }
    if (report === 'Företagsöversikt') await page.locator('.sheet-panel', { hasText: 'Kostnadsfördelning' }).first().screenshot({ path: path.join(OUT, `${name}-kostnader.png`) });
    await back();
  }

  await open('Balansräkning');
  await page.screenshot({ path: path.join(OUT, `${name}-balans.png`) });
  await sideways('balans');
  console.log(name, (await text(page)).slice(0, 190));
  await page.locator('.stm').screenshot({ path: path.join(OUT, `${name}-balans-konton.png`) });
  await ctx.close();
}

await run('dator-ljus', { width: 1440, height: 900 }, 'light');
await run('dator-mork', { width: 1440, height: 900 }, 'dark');
await run('halv', { width: 760, height: 900 }, 'light');
await run('telefon', { width: 390, height: 844 }, 'light');
await browser.close();
console.log(problems.length ? `FEL:\n${problems.join('\n')}` : 'Inga fel');
