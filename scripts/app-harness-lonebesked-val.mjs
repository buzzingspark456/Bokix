// Kör: npx vite --port 5199, sedan node scripts/app-harness-lonebesked-val.mjs (WIDTH=390 för telefon)
// Hembiets fall: nio anställda, sex med lön. Bara de sex får lönebesked, man
// väljer vilka som mejlas med kryssrutor, och import/export/skattetabeller
// ligger i kugghjulspanelen i Anställda och Lön. Skärmbilder i test-results/val-*.png.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const WIDTH = Number(process.env.WIDTH || 1440);
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
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, ...(WIDTH < 600 ? { isMobile: true, hasTouch: true } : {}) });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const p0 = await ctx.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
company.payrollRuns = [];
// Hembiets fall: nio anställda, sex med månadslön (en utan e-post), tre
// timanställda utan timmar den här månaden.
{
  const base = company.employees[0];
  const first = ['Anna', 'Bo', 'Cecilia', 'David', 'Elin', 'Fredrik'];
  company.employees = [
    ...first.map((n, i) => ({ ...base, id: 'emp_m' + i, firstName: n, lastName: 'Månad', salaryForm: 'manadslon', monthlySalary: 30000 + i * 1000, email: i === 5 ? '' : `${n.toLowerCase()}@exempel.se` })),
    ...['Greta', 'Hugo', 'Ida'].map((n, i) => ({ ...base, id: 'emp_t' + i, firstName: n, lastName: 'Tim', salaryForm: 'timlon', hourlyRate: 180, monthlySalary: 0, email: `${n.toLowerCase()}@exempel.se` })),
  ];
}
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
const saved = () => server.row.state.companies[id];

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => { errors.push(String(e).slice(0, 300)); console.log('SIDFEL', String(e).slice(0, 300)); });
page.on('console', m => { if (m.type() === 'error') console.log('KONSOL', m.text().slice(0, 300)); });
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
    Object.assign(server.row, Array.isArray(body) ? body[0] : body, { updated_at: newTs() });
    return reply(route, { updated_at: server.row.updated_at }, wantsObject);
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));

const tag = WIDTH < 600 ? '-telefon' : '';
const shot = async (name, loc) => { await page.waitForTimeout(600); await (loc || page).screenshot({ path: `test-results/val-${name}${tag}.png` }); };
const heading = async () => { await page.waitForSelector('.payroll-stage-head h2', { timeout: 8000 }).catch(() => {}); return page.evaluate(() => document.querySelector('.payroll-stage-head h2')?.innerText || null); };
const click = async (re) => { await page.getByRole('button', { name: re }).first().click(); await page.waitForTimeout(800); };
const fails = [];
const check = (cond, msg) => { console.log((cond ? 'OK   ' : 'FEL  ') + msg); if (!cond) fails.push(msg); };

await page.goto(BASE + '/?app=1#payroll');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1000);

// Anställda: kugghjulet med import, export och skattetabeller.
await page.getByText('Anställda', { exact: true }).first().click();
await page.waitForTimeout(600);
const headBtns = await page.locator('.list-page-header button').allInnerTexts();
check(!headBtns.some(t => /Importera|Exportera|skattetabell/i.test(t)), 'sidhuvudet i Anställda har inte import/export/skattetabeller: ' + JSON.stringify(headBtns.filter(Boolean)));
await shot('anstallda');
await page.locator('.lph-gear').click();
await page.waitForSelector('.ar-set');
const setBtns = await page.locator('.ar-set-btns button').allInnerTexts();
check(['Ny anställd', 'skattetabell', 'Importera', 'Exportera'].every(w => setBtns.some(t => t.toLowerCase().includes(w.toLowerCase()))), 'panelen har Ny anställd, skattetabeller, import, export: ' + JSON.stringify(setBtns));
check(await page.locator('.ar-set .ar-switch').count() === 5, 'fem kolumnval i panelen');
await shot('anstallda-panel');
// Slå på e-postkolumnen och se att den syns.
await page.locator('.ar-set .ar-switch', { hasText: 'E-post' }).locator('i').click();
await page.keyboard.press('Escape');
await page.locator('.ar-set-overlay').click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.waitForTimeout(400);
const ths = await page.locator('table.responsive-table th').allInnerTexts();
check(ths.some(t => /e-post/i.test(t)), 'e-postkolumnen syns efter att den slagits på: ' + JSON.stringify(ths));

// Lönekörningar: kugghjulet i sidhuvudet, bara åtgärder.
await page.getByText('Lönekörningar', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.locator('.lph-gear').click();
await page.waitForSelector('.ar-set');
const runBtns = await page.locator('.ar-set-btns button').allInnerTexts();
check(runBtns.some(t => /Ny lönekörning/.test(t)) && runBtns.some(t => /Importera/.test(t)), 'panelen i Lönekörningar: ' + JSON.stringify(runBtns));
const runPanel = await page.locator('.ar-set').innerText();
check(/Sidbredd/.test(runPanel) && !/Rader per sida/.test(runPanel) && /Semester/.test(runPanel), 'Lönekörningar: sidbredd och Semester i panelen, inga rader per sida');
await shot('korningar-panel');
await page.locator('.ar-set-overlay').click({ position: { x: 5, y: 5 } });
await page.waitForTimeout(300);

// Ny lönekörning genom stegen till Lönebesked.
await click(/Ny lönekörning/);
await shot('ny-korning');
await click(/Skapa lönekörning/);
// Välj vilka som får lön (som Fortnox): timanställda börjar utanför.
check(await heading() === 'Lön och timmar', 'Lön och timmar visas');
const runRows = () => saved().payrollRuns?.[0]?.rows?.map(r => r.employeeSnapshot.firstName) || [];
// Sparningen sker med fördröjning: vänta tills villkoret stämmer (högst 8 s).
const until = async (fn) => { for (let i = 0; i < 40; i++) { try { if (fn()) return true; } catch { /* inte sparat än */ } await page.waitForTimeout(200); } return false; };
check(await until(() => runRows().length === 6) && !runRows().some(n => ['Greta', 'Hugo', 'Ida'].includes(n)), 'sex med från början, timanställda utanför: ' + JSON.stringify(runRows()));
check(await page.locator('.pr-parked').count() === 3, 'tre rader utanför körningen');
check(/6 av 9/.test(await page.locator('.pr-pick-note').innerText()), 'texten säger 6 av 9');
await shot('lon-och-timmar-fore');
// Greta får tio timmar direkt i sin rad och tas med.
const greta = page.locator('.pr-parked', { hasText: 'Greta' });
await greta.locator('.pr-parked-hours input').fill('10');
await greta.locator('.pr-parked-hours input').press('Enter');
await page.waitForTimeout(700);
check(await until(() => runRows().includes('Greta')) && saved().payrollRuns[0].rows.find(r => r.employeeSnapshot.firstName === 'Greta').hoursWorked === '10', 'Greta med i körningen med 10 timmar');
check(runRows().indexOf('Greta') === 6, 'Greta hamnar i rätt ordning (efter de sex månadsanställda)');
// Fredrik kryssas ur.
await page.locator('.payroll-emp-head', { hasText: 'Fredrik' }).locator('.pr-include input').click();
await page.waitForTimeout(700);
check(await until(() => !runRows().includes('Fredrik')) && (saved().payrollRuns[0].parkedRows || []).some(r => r.employeeSnapshot.firstName === 'Fredrik'), 'Fredrik ur körningen, sparad som åtsidosatt');
// Kryssa i Fredrik igen och ur igen: raden kommer tillbaka.
await page.locator('.pr-parked', { hasText: 'Fredrik' }).locator('.pr-include input').click();
await page.waitForTimeout(500);
check(await until(() => runRows().indexOf('Fredrik') === 5), 'Fredrik tillbaka på sin plats');
await page.locator('.payroll-emp-head', { hasText: 'Fredrik' }).locator('.pr-include input').click();
await page.waitForTimeout(500);
check(/6 av 9/.test(await page.locator('.pr-pick-note').innerText()), 'texten säger 6 av 9 efter ändringarna');
await shot('lon-och-timmar-efter');
for (let i = 0; i < 6; i++) {
  const h = await heading();
  if (h === 'Lön och timmar') await click(/Beräkna lönerna/);
  else if (h === 'Granska') {
    check(await page.locator('.pr-review .pr-sum').count() === 1, 'Granska har summeringen bredvid tabellen');
    const sum = await page.locator('.pr-sum-box').innerText();
    check(/Antal anställda\s+6 st/.test(sum) && /Total kostnad/.test(sum), 'summeringen: 6 st och total kostnad');
    check(await page.locator('.pr-review table tbody tr').count() === 6, 'tabellen har sex rader');
    await shot('granska');
    await click(/Godkänn lönerna/);
  }
  else if (h === 'Betala') await click(/^Markera som betald$/);
  else break;
  // Admin får en bekräftelse på vissa steg.
  const ok = page.locator('.modal-footer .btn-primary');
  if (await ok.count()) { await ok.first().click(); await page.waitForTimeout(600); }
}
check(await heading() === 'Lönebesked', 'kom fram till Lönebesked');
const names = await page.locator('.ps-pick li .ps-pick-name').allInnerTexts();
check(names.length === 6 && names.includes('Greta Tim') && !names.includes('Fredrik Månad'), `sex i mejllistan (Greta med, Fredrik inte): ${JSON.stringify(names)}`);
check(!names.some(n => /Hugo|Ida/.test(n)), 'Hugo och Ida (inga timmar) inte i listan');
check(await page.locator('.ps-pick li input:checked').count() === 6, 'alla sex ikryssade från början');
const intro = await page.locator('.pr-panel p').first().innerText();
check(/^6 anställda/.test(intro), 'texten säger 6 anställda: ' + intro);
await shot('lonebesked-panel', page.locator('.ps-pick').locator('..'));
// Kryssa ur en, knappen ska säga 4.
await page.locator('.ps-pick li input').nth(1).uncheck();
const btn = page.getByRole('button', { name: /Mejla till valda/ });
check(/\(5\)/.test(await btn.innerText()), 'knappen visar 5 efter urkryss: ' + await btn.innerText());
check(await page.locator('.ps-pick-all input').evaluate(el => el.indeterminate), 'Välj alla visar delvis vald');
// Välj alla och sedan ingen.
await page.locator('.ps-pick-all input').click();
check(/\(6\)/.test(await btn.innerText()), 'Välj alla ger 6');
await page.locator('.ps-pick-all input').click();
check(await btn.isDisabled(), 'ingen vald: knappen avstängd');
// Välj två och skicka.
await page.locator('.ps-pick li input').nth(0).check();
await page.locator('.ps-pick li input').nth(2).check();
await shot('lonebesked-tva-valda', page.locator('.ps-pick').locator('..'));
const sentReq = [];
const sentCompany = [];
page.on('request', r => { if (r.url().includes('send-payslip')) { const b = JSON.parse(r.postData() || '{}'); sentReq.push(b.employee_id); sentCompany.push(b.company_id); } });
await btn.click();
const ok2 = page.locator('.modal-footer .btn-primary');
await page.waitForTimeout(500);
if (await ok2.count()) await ok2.first().click();
await page.waitForTimeout(6000);
check(sentCompany.length === 2 && sentCompany.every(c => c === id), 'mejlen skickas med företagets id (company_id): ' + JSON.stringify(sentCompany));
check(sentReq.length === 2, `exakt två mejl skickades: ${JSON.stringify(sentReq)}`);
const runNow = saved().payrollRuns?.[0];
await page.waitForTimeout(1500);
const sentNames = (runNow?.rows || []).filter(r => r.payslipSentAt).map(r => r.employeeSnapshot.firstName);
console.log('Markerade som skickade:', JSON.stringify(sentNames));
// Efter utskicket: förvalt är de tre som inte fått något.
check(await page.locator('.ps-pick li input:checked').count() === 4, 'efter utskick är de fyra som inte fått förvalda');
check(await page.locator('.ps-pick-status.is-sent').count() === 2, 'två visar Mejlat');
await shot('lonebesked-efter', page.locator('.ps-pick').locator('..'));
console.log(errors.length ? 'Sidfel: ' + JSON.stringify(errors) : 'Inga sidfel');
console.log(fails.length ? `${fails.length} FEL` : 'ALLT OK');
await browser.close();
process.exit(fails.length ? 1 : 0);
