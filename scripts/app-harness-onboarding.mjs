// Kör: npx vite --port 5199, sedan node scripts/app-harness-onboarding.mjs
// Onboardingen för ett nytt konto (OnboardingFlow.jsx, en fråga per skärm):
// söker fram ett företag, bekräftar räkenskapsåret, momsen och F-skatten i
// ljust och mörkt, och kollar vad som sparas. WIDTH=390 för telefon.
// Företagsuppslaget och EU:s momsregister är låtsade (/api/company-access).
// SCENARIO=firma går vägen för en enskild firma (personnummer i sökfältet).
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const WIDTH = Number(process.env.WIDTH || 1440);
const FIRMA = process.env.SCENARIO === 'firma';
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

const browser = await chromium.launch();
const results = {};
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, ...(WIDTH < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const p0 = await ctx.newPage();
  await p0.goto(`${BASE}/scripts/ocr-harness.html`);
  const company = await p0.evaluate(async () => {
    const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
    return JSON.parse(JSON.stringify(createDemoSeed()));
  });
  await p0.close();
  const id = company.company.id;
  // Som direkt efter registreringen: platshållarföretaget utan org.nr.
  Object.assign(company.company, { name: 'Mitt Företag AB', orgNr: '', vatRegistered: null, vatNr: '', fiscalYear: '', firstFiscalYear: null,
    address: '', postalCode: '', city: '', email: 'test@example.se', needsSetup: true });
  const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: false, onboarding_skipped: false, company_name: company.company.name } };
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 400)); });
  await page.addInitScript(([key, val, th]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_theme_pref', th); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session), theme]);
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
      Object.assign(server.row, Array.isArray(body) ? body[0] : body, { updated_at: newTs() });
      return reply(route, { updated_at: server.row.updated_at }, wantsObject);
    }
    if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
    return reply(route, wantsObject ? null : [], wantsObject);
  });
  await page.route('**/api/**', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (r.request().url().includes('/api/company-access') && body.action === 'lookup') {
      await new Promise(res => setTimeout(res, 300));
      if (body.mode === 'name') return r.fulfill({ json: { companies: [
        { name: 'Abbes Corner AB', orgNumber: '5592518863', city: 'SANDVIKEN' },
        { name: 'Abbes Gourmet AB', orgNumber: '5594672841', city: 'LÅNGSHYTTAN' },
        { name: 'Abbes konsultbolag AB', orgNumber: '5593262370', city: 'ÄLVSJÖ' },
      ] } });
      if (body.mode === 'orgnr') return r.fulfill({ json: { companies: [
        { name: 'Abbes Corner AB', orgNumber: '5592518863', street: 'STORGATAN 1', postalCode: '81130', city: 'SANDVIKEN', legalForm: 'AB', fiscalYearStart: '2024-12-01', fiscalYearEnd: '2025-11-30' },
      ] } });
      // Enskilda firman (personnummer 92…) finns inte i momsregistret, så frågan ställs.
      if (body.mode === 'vat') return r.fulfill({ json: String(body.query).startsWith('92') ? { registered: false } : { registered: true, vatNr: 'SE559251886301' } });
    }
    return r.fulfill({ json: {} });
  });

  const tag = `${FIRMA ? 'firma-' : ''}${theme}${WIDTH < 600 ? '-telefon' : ''}`;
  const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `test-results/onb-${name}-${tag}.png`, fullPage: true }); };
  const q = () => page.locator('.onb-q').innerText();
  const flow = [];

  await page.goto(BASE + '/?app=1');
  await page.waitForSelector('.onb-page', { timeout: 25000 });
  await shot('1-foretaget');
  if (FIRMA) {
  await page.locator('.onb-line').first().pressSequentially('9209273029', { delay: 40 });
  await page.waitForFunction((t) => document.querySelector('.onb-q')?.innerText.includes(t), "firma", { timeout: 8000 });
  flow.push(await q());
  await page.locator('#onb-firma-name').fill('Testfirmans Nagelstudio');
  await shot('1-firma');
  await page.locator('button:has-text("Fortsätt")').click();
  await page.waitForFunction((t) => document.querySelector('.onb-q')?.innerText.includes(t), "adress", { timeout: 8000 });
  flow.push(await q());
  await page.locator('#onb-street').fill('Storgatan 1');
  await page.locator('#onb-postal').fill('553 36');
  await page.locator('#onb-city').fill('Jönköping');
  await shot('1-adress');
  await page.locator('button:has-text("Fortsätt")').click();
  await page.waitForFunction((t) => document.querySelector('.onb-q')?.innerText.includes(t), "Startade", { timeout: 8000 });
  flow.push(await q());
  await page.locator('.onb-opt:has-text("Ja, i år")').click();
  await shot('2-rakenskapsar');
  await page.locator('button:has-text("Fortsätt")').click();
  await page.waitForFunction((t) => document.querySelector('.onb-q')?.innerText.includes(t), "momsregistrerad", { timeout: 8000 });
  flow.push(await q(), await page.locator('.onb-sub').first().innerText());
  await shot('3-momsreg');
  await page.locator('.onb-opt:has-text("Ja")').first().click();
  await page.waitForFunction((t) => document.querySelector('.onb-q')?.innerText.includes(t), "Hur ofta", { timeout: 8000 });
  flow.push(await q());
  await page.locator('.onb-opt:has-text("Varje kvartal")').click();
  await page.waitForFunction((t) => document.querySelector('.onb-q')?.innerText.includes(t), "F-skatt", { timeout: 8000 });
  flow.push(await q());
  await shot('4-fskatt');
  } else {
  await page.locator('.onb-line').first().pressSequentially('Abbes', { delay: 60 });
  await page.waitForSelector('.onb-results', { timeout: 5000 });
  await shot('1-sokning');
  await page.locator('.onb-results button').first().click();
  await page.waitForFunction(() => document.querySelector('.onb-q')?.innerText.includes('räkenskapsår'), null, { timeout: 8000 });
  flow.push(await q(), await page.locator('.onb-sub').first().innerText());
  await shot('2-rakenskapsar');
  await page.locator('.onb-help').click();
  await shot('2-hjalp');
  await page.locator('.onb-opt:has-text("Ja, stämmer")').click();
  await page.waitForFunction(() => document.querySelector('.onb-q')?.innerText.includes('moms'), null, { timeout: 5000 });
  flow.push(await q());
  await shot('3-moms');
  await page.locator('.onb-opt:has-text("En gång om året")').click();
  await page.waitForFunction(() => document.querySelector('.onb-q')?.innerText.includes('F-skatt'), null, { timeout: 5000 });
  flow.push(await q());
  await shot('4-fskatt');
  }
  await page.locator('.onb-opt:has-text("Ja")').first().click();
  await page.waitForSelector('.onb-card', { timeout: 5000 });
  flow.push(await q());
  const steps = await page.locator('.onb-steps').innerText();
  const card = await page.locator('.onb-screen').innerText();
  await shot('5-klart');
  await page.locator('button:has-text("Börja bokföra")').click();
  await page.waitForTimeout(3000); await shot('6-efter'); await page.waitForSelector('.app-container', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const savedCompany = server.row.state.companies[id].company;
  results[theme] = {
    flow,
    steps: steps.split(/\r?\n/).filter(Boolean),
    card: card.split(/\r?\n/).filter(Boolean).slice(0, 24),
    saved: { name: savedCompany.name, orgNr: savedCompany.orgNr, address: savedCompany.address, postalCode: savedCompany.postalCode, city: savedCompany.city, firstFiscalYear: savedCompany.firstFiscalYear, vatRegistered: savedCompany.vatRegistered, vatNr: savedCompany.vatNr, vatPeriod: savedCompany.vatPeriod, fSkatt: savedCompany.fSkatt, needsSetup: savedCompany.needsSetup, fiscalYear: savedCompany.fiscalYear, setupConfirmedAt: Boolean(savedCompany.setupConfirmedAt) },
    errors,
  };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
