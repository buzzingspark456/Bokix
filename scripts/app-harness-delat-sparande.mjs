// Kör: npx vite --port 5199, sedan node scripts/app-harness-delat-sparande.mjs
// Riktiga appen mot en fejkad Supabase, som inbjuden revisor utan lönebehörighet.
// En ny inläsning ska inte skicka något, en ändring ska bara skicka det ändrade
// fältet, och utgången inloggning ska ge ett anrop och ett besked, inte en svit.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'revisor@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Revisor' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 36000;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'r', user };

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
const ID = 'kund1';
company.company.id = ID;
// Som memberCompanyView lämnar det: lönen tom, AGI borta.
company.employees = [];
company.payrollRuns = [];
delete company.agiReports;
const PAGE_ACCESS = { dashboard: 'edit', contacts: 'edit', quotes: 'edit', invoices: 'edit', expenses: 'edit', projects: 'edit', review: 'edit', verifications: 'edit', bank: 'edit', payroll: 'none', reports: 'edit', taxes: 'edit' };

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.addInitScript(([key, val]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);

const posts = [];
let answer = 200;
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
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  if (table === 'company_members' && url.searchParams.get('member_user_id')) return reply(route, [{ company_id: ID, owner_user_id: 'owner1', role: 'editor' }], false);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));
await page.route('**/api/company-access**', r => {
  const req = r.request();
  const u = new URL(req.url());
  if (req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '{}');
    if (body.field) { posts.push(body.field); return r.fulfill({ status: answer, json: answer === 200 ? { ok: true } : { error: 'Ogiltig eller utgången inloggning.' } }); }
    return r.fulfill({ json: { ok: true } });
  }
  if (u.searchParams.get('list')) return r.fulfill({ json: { companies: [{ company_id: ID, owner_user_id: 'owner1', company: { id: ID, name: company.company.name, orgNr: company.company.orgNr }, role: 'editor', pageAccess: PAGE_ACCESS, ownerPaid: true }] } });
  if (u.searchParams.get('company_id')) return r.fulfill({ json: { company: JSON.parse(JSON.stringify(company)), role: 'editor', pageAccess: PAGE_ACCESS, ownerPaid: true } });
  return r.fulfill({ json: { ok: true } });
});

let failed = false;
const check = (name, ok, detail = '') => { console.log(ok ? 'OK ' : 'FEL', name, detail); if (!ok) failed = true; };

await page.goto(BASE + '/?app=1');
await page.waitForFunction(() => document.body.innerText.includes('Att göra'), null, { timeout: 25000 });
await page.waitForTimeout(3500);
check('inget skickas vid inloggning', posts.length === 0, JSON.stringify(posts));

// Tillbaka till fliken: Supabase skickar SIGNED_IN igen och allt läses in som
// nya objekt, medan senast sparade läget ligger kvar.
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
await page.waitForTimeout(3500);
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(5000);
const spurious = posts.length;
check('ny inläsning skickar ingenting', spurious === 0, `${spurious} anrop: ${JSON.stringify([...new Set(posts)])}`);
posts.length = 0;

await page.evaluate(() => { location.hash = 'quotes'; });
await page.waitForTimeout(1500);
await page.locator('button[title="Ta bort"]').first().click();
await page.waitForTimeout(800);
const confirm = page.locator('.modal-footer button, .modal-overlay button').filter({ hasText: /Ta bort|Radera/ }).first();
if (await confirm.count()) await confirm.click().catch(() => {});
await page.waitForTimeout(3500);
check('en ändring skickar bara det fältet', JSON.stringify(posts) === '["quotes"]', JSON.stringify(posts));

answer = 401;
posts.length = 0;
await page.locator('button[title="Ta bort"]').first().click();
await page.waitForTimeout(800);
if (await confirm.count()) await confirm.click().catch(() => {});
await page.waitForFunction(() => document.body.innerText.includes('Kunde inte spara ändringarna'), null, { timeout: 8000 }).catch(() => {});
const toast = await page.evaluate(() => document.body.innerText.includes('Kunde inte spara ändringarna'));
check('utgången inloggning ger ett anrop', posts.length === 1, JSON.stringify(posts));
check('och ett besked på skärmen', toast);
check('inga sidfel', errors.length === 0, errors.join(' | '));

await browser.close();
process.exit(failed ? 1 : 0);
