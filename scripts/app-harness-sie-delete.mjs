// Kör: npx vite --port 5199, sedan node scripts/app-harness-sie-delete.mjs <fil.se>.
// Riktiga appen mot en fejkad Supabase: importerar en SIE-fil via
// Inställningar → Import och export, tar bort den under "Importerade SIE-filer" och
// kollar att verifikationerna är borta ur det som sparades till servern.
import { chromium } from '@playwright/test';
import fs from 'fs';

const SIE_FILE = process.argv[2];
const BASE = 'http://localhost:5199';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };

let tick = 0;
const newTs = () => new Date(Date.UTC(2026, 9, 10, 12, 0, 0) + (++tick) * 1000).toISOString().replace('Z', '+00:00');
const server = { row: null, writes: 0 };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);

const p0 = await ctx.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
const companyId = company.company.id;
server.row = { id: 'r1', user_id: UID, state: { activeCompanyId: companyId, companies: { [companyId]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name };

// Verifikationerna så som servern har dem just nu.
const savedVerifications = () => {
  const c = server.row?.state?.companies?.[companyId];
  return c?.verifications || [];
};
const imported = () => savedVerifications().filter(v => String(v.sourceId || '').startsWith('sie_import_') || v.sieImportTag);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/GL Driver|OTS/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
await page.addInitScript(([key, val]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);

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
  if (table === 'user_data') {
    if (req.method() === 'GET' || req.method() === 'HEAD') return reply(route, server.row, wantsObject);
    const body = JSON.parse(req.postData() || '{}');
    if (req.method() === 'PATCH') {
      const cond = url.searchParams.get('updated_at');
      if (cond && cond !== `eq.${server.row.updated_at}`) return reply(route, [], false);
      Object.assign(server.row, body, { updated_at: newTs() }); server.writes++;
      return reply(route, { updated_at: server.row.updated_at }, wantsObject);
    }
    if (req.method() === 'POST') {
      server.row = Object.assign(server.row || {}, Array.isArray(body) ? body[0] : body, { updated_at: newTs() }); server.writes++;
      return reply(route, { updated_at: server.row.updated_at }, wantsObject);
    }
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));

const fail = async (msg) => {
  await page.screenshot({ path: 'test-results/harness-sie-delete-fel.png' });
  console.log('FEL:', msg, errors);
  await browser.close();
  process.exit(1);
};
const waitSaved = async (pred, label) => {
  for (let i = 0; i < 40; i++) { if (pred()) return; await page.waitForTimeout(250); }
  await fail('servern fick aldrig ' + label);
};

await page.goto(BASE + '/?app=1');
await page.waitForFunction(() => document.body.innerText.includes('Räkenskapsåret'), null, { timeout: 20000 }).catch(() => fail('startsidan laddade inte'));
const before = savedVerifications().length;
console.log('Verifikationer före import:', before);

const openAdvanced = async () => {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, a, [role="button"], li, div')].reverse()
      .find(e => e.children.length <= 3 && e.innerText?.trim() === 'Inställningar');
    (el?.closest('button, a, [role="button"]') || el)?.click();
  });
  await page.waitForTimeout(800);
  if (!(await page.getByText('Import och export', { exact: true }).count())) {
    await page.screenshot({ path: 'test-results/harness-sie-delete-nav.png' });
    console.log('Sidan efter klick:', (await page.evaluate(() => document.body.innerText)).slice(0, 600));
  }
  await page.getByText('Import och export', { exact: true }).first().click();
  await page.waitForTimeout(800);
};
await openAdvanced();

// Import
await page.getByText('Flytta hit bokföringen').first().click();
await page.getByText('Jag har filen, fortsätt').click();
await page.setInputFiles('#sie-import-file', SIE_FILE);
await page.getByRole('button', { name: 'Förhandsgranska' }).click().catch(() => fail('kom inte till förhandsgranskning'));
await page.waitForTimeout(500);
await page.getByRole('button', { name: /^Importera \d+ verifikationer/ }).click().catch(() => fail('importknappen saknas'));
await waitSaved(() => imported().length > 0, 'importen');
console.log('Efter import: totalt', savedVerifications().length, '| från SIE-filen', imported().length, '| taggar', [...new Set(imported().map(v => v.sieImportTag))]);
await page.waitForTimeout(800);

// Listan
const card = await page.evaluate(() => document.body.innerText.includes('Importerade SIE-filer'));
console.log('Kortet "Importerade SIE-filer" syns:', card);
await page.screenshot({ path: 'test-results/harness-sie-delete-lista.png' });
const row = await page.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf('Importerade SIE-filer');
  return t.slice(i, i + 220);
});
console.log('Kortets text:', JSON.stringify(row));

// Ta bort
await page.getByRole('button', { name: 'Ta bort', exact: true }).first().click();
await page.waitForTimeout(400);
const dialogText = await page.evaluate(() => document.querySelector('[role="dialog"], .modal')?.innerText || '');
console.log('Bekräftelsen:', JSON.stringify(dialogText.slice(0, 300)));
await page.screenshot({ path: 'test-results/harness-sie-delete-fraga.png' });
await page.getByRole('button', { name: 'Ta bort', exact: true }).last().click();
await waitSaved(() => imported().length === 0, 'borttagningen');
await page.waitForTimeout(800);
console.log('Efter borttagning: totalt', savedVerifications().length, '(före import:', before + ') | från SIE-filen', imported().length);
console.log('Kortet borta:', !(await page.evaluate(() => document.body.innerText.includes('Importerade SIE-filer'))));
console.log('Toast:', await page.evaluate(() => document.body.innerText.includes('Importen är borttagen')));

// Syns de på Verifikationer-sidan?
await page.reload();
await page.waitForFunction(() => document.body.innerText.includes('Räkenskapsåret'), null, { timeout: 20000 }).catch(() => {});
const stillThere = await page.evaluate(() => document.body.innerText.includes('Testimport'));
console.log('Efter omladdning, "Testimport" någonstans på sidan:', stillThere);
console.log('Serverskrivningar:', server.writes);
if (errors.length) console.log('Sidfel:', errors);
await browser.close();
