#!/usr/bin/env node
// ── Spelar in videoguider (public/videos/) av den riktiga appen: startsidans
// produktdemo (DemoOverlay i LandingPage.jsx) med exempeldata, styrd av
// Playwright med en synlig muspekare och en textrad per steg. Bildrutorna
// tas med Chromes screencast (skarpare än Playwrights recordVideo, som
// kodar VP8 på 1 Mbit/s) och kodas till H.264 med ffmpeg.
//
// Körs manuellt, inte del av build:
//   npm run build && npx vite preview --port 4789
//   FFMPEG_PATH=/sökväg/ffmpeg node scripts/record-guide-videos.mjs [namn]
// (ffmpeg: t.ex. `npm i ffmpeg-static` i en tempmapp.) Utan namn spelas
// alla guider in. Ta om filmerna när appens utseende ändras.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE_URL = process.env.GUIDE_URL || 'http://localhost:4789/';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const OUT_DIR = 'public/videos';
const SCALE = 1.5;
const OUT_WIDTH = 1600;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Muspekare, klickring och textrad, ritade i sidan ──
async function installOverlay(page, box) {
  await page.evaluate((box) => {
    const css = document.createElement('style');
    css.textContent = `
      #gv-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
        width: 26px; height: 26px; transform: translate(-3px, -2px); transition: transform .08s; }
      #gv-cursor.down { transform: translate(-3px, -2px) scale(.86); }
      .gv-ring { position: fixed; z-index: 2147483646; pointer-events: none; width: 44px; height: 44px;
        margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid rgba(22,128,58,.75);
        animation: gv-ring .55s ease-out forwards; }
      @keyframes gv-ring { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.25); opacity: 0 } }
      #gv-caption { position: fixed; z-index: 2147483645; pointer-events: none; left: 50%; bottom: 64px;
        transform: translate(-50%, 12px); opacity: 0; transition: opacity .35s, transform .35s;
        background: rgba(17, 24, 20, .92); color: #fff; font: 600 19px/1.35 Inter, system-ui, sans-serif;
        padding: 13px 22px; border-radius: 14px; box-shadow: 0 12px 34px -12px rgba(0,0,0,.5);
        display: flex; align-items: center; gap: 12px; white-space: nowrap; }
      #gv-caption.on { opacity: 1; transform: translate(-50%, 0); }
      #gv-caption b { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
        background: #16803a; font-size: 15px; }
    `;
    document.head.appendChild(css);
    const cur = document.createElement('div');
    cur.id = 'gv-cursor';
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2.5l15.5 9.2-6.6 1.5 3.9 7.2-2.9 1.5-3.9-7.3L4 19.5z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const cap = document.createElement('div');
    cap.id = 'gv-caption';
    document.body.appendChild(cap);
    window.addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    window.addEventListener('mousedown', e => {
      cur.classList.add('down');
      const r = document.createElement('div');
      r.className = 'gv-ring';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
    }, true);
    window.addEventListener('mouseup', () => cur.classList.remove('down'), true);
    // Textraden centreras i appytan, inte i fönstret.
    cap.style.left = (box.x + box.width / 2) + 'px';
    cap.style.bottom = (innerHeight - box.y - box.height + 36) + 'px';
  }, box);
}

function director(page) {
  let pos = { x: 700, y: 450 };
  const move = async (x, y) => {
    const steps = 32;
    const from = { ...pos };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      await sleep(14);
    }
    pos = { x, y };
  };
  // Rullar bara appens egen scrollyta. scrollIntoView rullar även
  // overlayen och sidan bakom, och då hamnar beskärningen fel.
  const center = async (loc) => {
    await loc.evaluate(el => {
      let sc = el.parentElement;
      while (sc && sc !== document.body) {
        const oy = getComputedStyle(sc).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight) break;
        sc = sc.parentElement;
      }
      if (!sc || sc === document.body) return;
      const r = el.getBoundingClientRect(), c = sc.getBoundingClientRect();
      const mid = r.top + r.height / 2, cmid = c.top + c.height / 2;
      if (Math.abs(mid - cmid) > c.height * 0.3) sc.scrollBy({ top: mid - cmid, behavior: 'smooth' });
    });
    await sleep(650);
    const b = await loc.boundingBox();
    if (!b) throw new Error('Elementet syns inte');
    return { x: b.x + Math.min(b.width / 2, 140), y: b.y + b.height / 2 };
  };
  return {
    async caption(n, text) {
      await page.evaluate(([n, text]) => {
        const c = document.getElementById('gv-caption');
        c.classList.remove('on');
        setTimeout(() => { c.innerHTML = (n ? `<b>${n}</b>` : '') + text; c.classList.add('on'); }, n === null ? 0 : 250);
      }, [n, text]);
      await sleep(900);
    },
    async hideCaption() {
      await page.evaluate(() => document.getElementById('gv-caption').classList.remove('on'));
    },
    async click(loc, { pause = 350 } = {}) {
      const p = await center(loc);
      await move(p.x, p.y);
      await sleep(pause);
      await page.mouse.down();
      await sleep(90);
      await page.mouse.up();
      await sleep(500);
    },
    async type(loc, text, { delay = 55 } = {}) {
      await this.click(loc, { pause: 200 });
      await loc.pressSequentially(text, { delay });
      await sleep(300);
    },
    async hover(loc) {
      const p = await center(loc);
      await move(p.x, p.y);
    },
    // Ersätter ett förifyllt värde (t.ex. Antal = 1).
    async replace(loc, text) {
      await this.click(loc, { pause: 200 });
      await loc.press('Control+A');
      await loc.pressSequentially(text, { delay: 90 });
      await sleep(300);
    },
    async select(loc, option) {
      await this.click(loc, { pause: 200 });
      await loc.selectOption(option);
      await sleep(600);
    },
    async scrollBy(sel, dy) {
      await page.locator(sel).first().evaluate((el, dy) => el.scrollBy({ top: dy, behavior: 'smooth' }), dy);
      await sleep(800);
    },
    wait: sleep,
  };
}

// ── Guiderna ──
// Varje guide börjar på demons startsida. `label` hittar fält via texten i
// deras <label> (formulären saknar for/id), så en omdöpt etikett här ska
// ändras i takt med appen.
const GUIDES = {
  'lagg-upp-kund': async ({ d, panel }) => {
    const field = (label) => panel.locator(`xpath=.//label[normalize-space()="${label}"]/following::input[1]`).first();
    await d.caption(1, 'Gå till Kunder i menyn');
    await d.click(panel.getByText('Kunder', { exact: true }).first());
    await d.caption(2, 'Tryck på Ny kund');
    await d.click(panel.getByRole('button', { name: 'Ny kund' }));
    await d.caption(3, 'Fyll i namn och kontaktuppgifter');
    await d.type(panel.getByPlaceholder('Exempelföretag AB'), 'Solberg Café AB');
    await d.type(field('Kontaktperson'), 'Maria Solberg');
    await d.type(panel.getByPlaceholder('epost@foretag.se'), 'maria@solbergcafe.se');
    await d.type(panel.getByPlaceholder('070-123 45 67'), '070-412 88 31');
    await d.caption(4, 'Lägg till adress och organisationsnummer');
    await d.type(field('Gatuadress'), 'Storgatan 14');
    await d.type(field('Postnummer'), '252 23');
    await d.type(field('Ort'), 'Helsingborg');
    await d.type(panel.getByPlaceholder('XXXXXX-XXXX'), '559123-4561');
    await d.caption(5, 'Spara kunden');
    await d.click(panel.getByRole('button', { name: 'Spara kund' }));
    await d.wait(600);
    await d.caption(null, 'Klart! Kunden finns nu i listan och kan faktureras.');
    await d.wait(2600);
  },

  'skapa-faktura': async ({ d, panel }) => {
    const cell = (label, n = 0) => panel.locator(`.inv-row-card >> nth=${n}`).locator(`.inv-cell[data-label="${label}"] input`);
    await d.caption(1, 'Gå till Kundfakturor i menyn');
    await d.click(panel.getByText('Kundfakturor', { exact: true }).first());
    await d.caption(2, 'Tryck på Skapa faktura');
    await d.click(panel.getByRole('button', { name: 'Skapa faktura' }).first());
    await d.caption(3, 'Välj kund');
    const customer = panel.locator('select[data-inv-tour="form-customer"]');
    await d.select(customer, await customer.locator('option', { hasText: 'Almbring Bygg AB' }).getAttribute('value'));
    await d.caption(4, 'Skriv vad du har sålt, antal och pris');
    await d.type(cell('Benämning'), 'Konsulttimmar, september');
    await d.replace(cell('Antal'), '8');
    await d.replace(cell('À-pris'), '950');
    await d.caption(5, 'Fler saker? Lägg till en rad');
    await d.click(panel.getByRole('button', { name: 'Lägg till rad' }));
    await d.type(cell('Benämning', 1), 'Resa till kund');
    await d.replace(cell('À-pris', 1), '450');
    await d.wait(700);
    await d.caption(6, 'Momsen och summan räknas ut åt dig');
    await d.hover(panel.getByText('Att betala', { exact: true }).first());
    await d.wait(1800);
    await d.caption(7, 'Tryck på Skapa faktura');
    await d.click(panel.getByRole('button', { name: 'Skapa faktura' }).first());
    await d.wait(700);
    await d.caption(null, 'Klart! Fakturan ligger i listan, redo att skickas.');
    await d.wait(2800);
  },
};

async function record(browser, name, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE });
  await context.addInitScript(() => localStorage.setItem('bokix_theme_pref', 'light'));
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Endast nödvändiga' }).click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: /Se demo/ }).first().click();
  const panel = page.locator('.lp-demo-overlay-panel');
  const body = page.locator('.lp-demo-overlay-body');
  await body.waitFor();
  await sleep(1800);
  // Uppslaget mot FöretagsAPI kräver inloggning; i filmen svarar det tomt.
  await page.route('**/api/company-access', route => route.fulfill({ json: { companies: [] } }));
  // Själva appkortet, utan overlayens ljusa kant runt om.
  const box = await page.locator('.lp-demo-card').boundingBox();
  await installOverlay(page, box);
  const d = director(page);
  await page.mouse.move(700, 450);

  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ data: f.data, ts: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1440 * SCALE, maxHeight: 900 * SCALE, everyNthFrame: 1 });
  await sleep(800);
  await run({ page, panel, d });
  await cdp.send('Page.stopScreencast');
  await context.close();

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `guide-${name}-`));
  let list = '';
  frames.forEach((f, i) => {
    const file = path.join(dir, `f${String(i).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    const dur = i < frames.length - 1 ? frames[i + 1].ts - f.ts : 0.5;
    list += `file '${file.replace(/\\/g, '/')}'\nduration ${Math.max(dur, 0.001).toFixed(4)}\n`;
  });
  list += `file '${path.join(dir, `f${String(frames.length - 1).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);

  // Beskär till appytan (utan overlayens titelrad) och skala till OUT_WIDTH.
  // Relativt bildens storlek (iw/ih), eftersom screencasten kan leverera
  // mindre bilder än viewport × SCALE.
  const rel = (v, of) => (v / of).toFixed(5);
  const out = path.join(OUT_DIR, `${name}.mp4`);
  const poster = path.join(OUT_DIR, `${name}.jpg`);
  const vf = `crop=w=iw*${rel(box.width, 1440)}:h=ih*${rel(box.height, 900)}:x=iw*${rel(box.x, 1440)}:y=ih*${rel(box.y, 900)},scale=${OUT_WIDTH}:-2:flags=lanczos`;
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-vf', `${vf},fps=30`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg misslyckades för ${name}`);
  spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-sseof', '-1.2', '-i', out, '-frames:v', '1', '-q:v', '3', poster], { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
  const secs = frames.length ? (frames.at(-1).ts - frames[0].ts).toFixed(1) : 0;
  console.log(`✓ ${out} (${frames.length} bilder, ${secs} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const only = process.argv[2];
const browser = await chromium.launch();
for (const [name, run] of Object.entries(GUIDES)) {
  if (only && only !== name) continue;
  await record(browser, name, run);
}
await browser.close();
