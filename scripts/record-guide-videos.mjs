#!/usr/bin/env node
// ── Spelar in videoguider (public/videos/) av den riktiga appen: startsidans
// produktdemo (DemoOverlay i LandingPage.jsx) med exempeldata, styrd av
// Playwright med en synlig muspekare och en textrad per steg. Bildrutorna
// tas med Chromes screencast (skarpare än Playwrights recordVideo, som
// kodar VP8 på 1 Mbit/s) och kodas till H.264 med ffmpeg.
//
// Körs manuellt, inte del av build:
//   npm run build && npx vite preview --port 4789
//   FFMPEG_PATH=/sökväg/ffmpeg node scripts/record-guide-videos.mjs [namn,namn] [light|dark]
// (ffmpeg: t.ex. `npm i ffmpeg-static` i en tempmapp.) Utan namn spelas
// alla guider in, i både ljust (namn.mp4) och mörkt läge (namn-dark.mp4).
// Ta om filmerna när appens utseende ändras.
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

// Tempot är medvetet snabbt (kundönskemål: "gör de snabbare"): kort
// muspekarfärd, kort paus före klick och snabb men läsbar inskrivning.
function director(page) {
  let pos = { x: 700, y: 450 };
  const move = async (x, y) => {
    const steps = 18;
    const from = { ...pos };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      await sleep(11);
    }
    pos = { x, y };
  };
  // Rullar bara appens egen scrollyta. scrollIntoView rullar även
  // overlayen och sidan bakom, och då hamnar beskärningen fel.
  const center = async (loc) => {
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    const scrolled = await loc.evaluate(el => {
      let sc = el.parentElement;
      while (sc && sc !== document.body) {
        const oy = getComputedStyle(sc).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight) break;
        sc = sc.parentElement;
      }
      if (!sc || sc === document.body) return false;
      const r = el.getBoundingClientRect(), c = sc.getBoundingClientRect();
      const mid = r.top + r.height / 2, cmid = c.top + c.height / 2;
      if (Math.abs(mid - cmid) <= c.height * 0.3) return false;
      sc.scrollBy({ top: mid - cmid, behavior: 'smooth' });
      return true;
    });
    // Vänta tills en mjuk rullning har stannat, annars klickar pekaren där
    // elementet var, inte där det hamnar.
    let b = await loc.boundingBox();
    if (scrolled) {
      await sleep(220);
      b = await loc.boundingBox();
      for (let i = 0, still = 0; i < 25 && still < 2; i++) {
        await sleep(70);
        const nb = await loc.boundingBox();
        still = nb && b && Math.abs(nb.y - b.y) < 1 ? still + 1 : 0;
        b = nb;
      }
    }
    if (!b) throw new Error('Elementet syns inte');
    return { x: b.x + Math.min(b.width / 2, 140), y: b.y + b.height / 2 };
  };
  return {
    async caption(n, text) {
      await page.evaluate(([n, text]) => {
        const c = document.getElementById('gv-caption');
        c.classList.remove('on');
        setTimeout(() => { c.innerHTML = (n ? `<b>${n}</b>` : '') + text; c.classList.add('on'); }, 180);
      }, [n, text]);
      await sleep(550);
    },
    async click(loc, { pause = 170 } = {}) {
      const p = await center(loc);
      await move(p.x, p.y);
      await sleep(pause);
      await page.mouse.down();
      await sleep(70);
      await page.mouse.up();
      await sleep(320);
    },
    async type(loc, text, { delay = 24 } = {}) {
      await this.click(loc, { pause: 120 });
      await loc.pressSequentially(text, { delay });
      await sleep(160);
    },
    async hover(loc) {
      const p = await center(loc);
      await move(p.x, p.y);
    },
    // Ersätter ett förifyllt värde (t.ex. Antal = 1).
    async replace(loc, text) {
      await this.click(loc, { pause: 120 });
      await loc.press('Control+A');
      await loc.pressSequentially(text, { delay: 45 });
      await sleep(160);
    },
    // Datumfält: skrivs inte tecken för tecken i Chromium.
    async setDate(loc, value) {
      await this.click(loc, { pause: 120 });
      await loc.fill(value);
      await sleep(250);
    },
    async select(loc, option) {
      await this.click(loc, { pause: 120 });
      await loc.selectOption(option);
      await sleep(350);
    },
    // Klick som öppnar filväljaren; filen väljs som en användare skulle.
    async upload(loc, file) {
      const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
      await this.click(loc);
      await (await chooser).setFiles(file);
      await sleep(400);
    },
    wait: sleep,
  };
}

// ── Guiderna ──
// Varje guide börjar på demons startsida, med påhittade exempelföretag
// (kundönskemål: inga namn som ser ut som riktiga företag). Fälten hittas via
// texten i deras <label> (formulären saknar for/id), så en omdöpt etikett här
// ska ändras i takt med appen. Varje guide spelas in i ljust och mörkt läge.
const RECEIPT = path.resolve('scripts/guide-assets/exempelkvitto.png');

function helpers(panel) {
  return {
    nav: (label) => panel.getByText(label, { exact: true }).first(),
    // Bara synliga knappar: vissa formulär har en dold dubblett för mobil.
    btn: (name) => panel.getByRole('button', { name }).filter({ visible: true }).first(),
    field: (label) => panel.locator(`xpath=.//label[normalize-space()="${label}"]/following::*[self::input or self::select or self::textarea][1]`).first(),
  };
}

const GUIDES = {
  'lagg-upp-kund': async ({ d, panel }) => {
    const { nav, btn, field } = helpers(panel);
    await d.caption(1, 'Gå till Kunder');
    await d.click(nav('Kunder'));
    await d.caption(2, 'Tryck på Ny kund');
    await d.click(btn('Ny kund'));
    await d.caption(3, 'Fyll i namn och e-post');
    await d.type(panel.getByPlaceholder('Exempelföretag AB'), 'Exempelkaféet AB');
    await d.type(panel.getByPlaceholder('epost@foretag.se'), 'info@exempelkafeet.se');
    await d.caption(4, 'Lägg till organisationsnummer');
    await d.type(panel.getByPlaceholder('XXXXXX-XXXX'), '559999-0008');
    await d.caption(5, 'Spara');
    await d.click(btn('Spara kund'));
    await d.caption(null, 'Klart! Kunden finns i listan.');
    await d.wait(2000);
  },

  'skapa-faktura': async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    const cell = (label) => panel.locator('.inv-row-card').first().locator(`.inv-cell[data-label="${label}"] input`);
    await d.caption(1, 'Gå till Kundfakturor');
    await d.click(nav('Kundfakturor'));
    await d.caption(2, 'Tryck på Skapa faktura');
    await d.click(btn('Skapa faktura'));
    await d.caption(3, 'Välj kund');
    const customer = panel.locator('select[data-inv-tour="form-customer"]');
    await d.select(customer, await customer.locator('option', { hasText: 'Exempelbygg AB' }).getAttribute('value'));
    await d.caption(4, 'Vad har du sålt, antal och pris');
    await d.type(cell('Benämning'), 'Konsulttimmar');
    await d.replace(cell('Antal'), '8');
    await d.replace(cell('À-pris'), '950');
    await d.caption(5, 'Moms och summa räknas ut åt dig');
    await d.hover(panel.getByText('Att betala', { exact: true }).first());
    await d.wait(1100);
    await d.caption(6, 'Tryck på Skapa faktura');
    await d.click(btn('Skapa faktura'));
    await d.caption(null, 'Klart! Fakturan ligger i listan.');
    await d.wait(2000);
  },

  'skapa-offert': async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    await d.caption(1, 'Gå till Offerter');
    await d.click(nav('Offerter'));
    await d.caption(2, 'Tryck på Ny offert');
    await d.click(btn('Ny offert'));
    await d.caption(3, 'Skriv kundens namn');
    await d.type(panel.getByPlaceholder('Företagsnamn AB'), 'Testdesign AB');
    await d.caption(4, 'Vad offerten gäller och priset');
    await d.type(panel.getByPlaceholder('Beskrivning').first(), 'Ny webbplats, fem sidor');
    await d.replace(panel.getByPlaceholder('Á-pris').first(), '24000');
    await d.caption(5, 'Spara offerten');
    await d.click(btn('Spara offert'));
    await d.caption(null, 'Klart! Blir det ja gör du om den till en faktura.');
    await d.wait(2000);
  },

  'ladda-upp-kvitto': async ({ d, panel }) => {
    const { nav } = helpers(panel);
    await d.caption(1, 'Gå till Kvitton');
    await d.click(nav('Kvitton'));
    await d.caption(2, 'Ladda upp ett foto av kvittot');
    await d.upload(panel.getByText(/Ladda upp|Välj fil|Dra och släpp/).first(), RECEIPT);
    await d.caption(3, 'Tryck på Läs av kvittot');
    await d.click(panel.getByRole('button', { name: /Läs av kvittot/ }).first());
    await d.caption(4, 'Datum, belopp och moms fylls i åt dig');
    await panel.getByPlaceholder(/Circle K|Exempelmacken|T.ex./).first().waitFor({ timeout: 1000 }).catch(() => {});
    await d.wait(6500);
    await d.caption(null, 'Kontrollera och tryck Spara och bokför.');
    await d.wait(2200);
  },

  'ny-artikel': async ({ d, panel }) => {
    const { nav, btn, field } = helpers(panel);
    await d.caption(1, 'Gå till Artiklar');
    await d.click(nav('Artiklar'));
    await d.caption(2, 'Tryck på Ny artikel');
    await d.click(btn('Ny artikel'));
    await d.caption(3, 'Namn och pris');
    await d.type(panel.getByPlaceholder('T.ex. Konsulttimme'), 'Webbsupport, timme');
    await d.replace(field('Pris exkl. moms *'), '850');
    await d.caption(4, 'Spara');
    await d.click(btn('Spara artikel'));
    await d.caption(null, 'Klart! Välj artikeln direkt på nästa faktura.');
    await d.wait(2000);
  },

  'ny-verifikation': async ({ d, panel, page }) => {
    const { nav, btn, field } = helpers(panel);
    await d.caption(1, 'Gå till Bokföring');
    await d.click(nav('Bokföring'));
    await d.caption(2, 'Tryck på Ny verifikation');
    await d.click(btn('Ny verifikation'));
    await d.caption(3, 'Beskriv köpet och beloppet');
    await d.type(panel.getByPlaceholder('Verifikationstext...'), 'Kontorsmaterial');
    await d.type(field('Belopp inkl. moms (kr)'), '495');
    await d.caption(4, 'Vad har du köpt?');
    await d.type(panel.getByPlaceholder('Sök, till exempel kontorsmaterial'), 'kontorsmat');
    await d.click(page.getByText('Kontorsmateriel', { exact: true }).last());
    await d.caption(5, 'Granska och bokför');
    await d.click(btn('Granska & bokför'));
    await d.wait(1200);
    const confirm = page.getByRole('button', { name: /^Bokför/ }).last();
    if (await confirm.isVisible().catch(() => false)) await d.click(confirm);
    await d.caption(null, 'Klart! Debet och kredit sköts åt dig.');
    await d.wait(2000);
  },

  'nytt-projekt': async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    await d.caption(1, 'Gå till Projekt');
    await d.click(nav('Projekt'));
    await d.caption(2, 'Tryck på Nytt projekt');
    await d.click(btn('Nytt projekt'));
    await d.caption(3, 'Ge projektet ett namn');
    await d.type(panel.getByPlaceholder('t.ex. Kontorsrenovering 2026'), 'Ny webbplats');
    await d.caption(4, 'Spara');
    await d.click(panel.locator('.modal-overlay').getByRole('button', { name: /^(Skapa|Spara)/ }).last());
    await d.caption(null, 'Klart! Rapportera tid och fakturera projektet.');
    await d.wait(2000);
  },

  'ny-anstalld': async ({ d, panel, page }) => {
    const { nav, btn, field } = helpers(panel);
    await d.caption(1, 'Gå till Anställda och lön');
    await d.click(nav('Anställda och lön'));
    await d.caption(2, 'Tryck på Ny anställd');
    await d.click(btn('Ny anställd'));
    await d.caption(3, 'Namn och personnummer');
    await d.type(field('Förnamn *'), 'Alex');
    await d.type(field('Efternamn *'), 'Exempel');
    await d.type(panel.getByPlaceholder('ÅÅÅÅMMDD-XXXX'), '19900101-0017');
    await d.caption(4, 'Anställningsdatum och lön');
    await d.setDate(field('Anställningsdatum *'), '2026-10-01');
    await d.replace(field('Månadslön (brutto)'), '32000');
    await d.caption(5, 'Välj kommun och skattetabell');
    await d.type(panel.getByPlaceholder('Sök kommun...'), 'Stockholm');
    await d.click(page.getByText('Stockholm', { exact: true }).last());
    await d.click(panel.locator('.tax-table-choice').first());
    await d.caption(6, 'Spara');
    await d.click(btn('Spara anställd'));
    await d.caption(null, 'Klart! Nu kan du köra lön.');
    await d.wait(2000);
  },

  momsdeklaration: async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    await d.caption(1, 'Gå till Skatt och bokslut');
    await d.click(nav('Skatt och bokslut'));
    await d.caption(2, 'Tryck på Gör momsdeklarationen');
    await d.click(btn('Gör momsdeklarationen'));
    await d.caption(3, 'Bokix kontrollerar bokföringen');
    await d.click(btn(/Gå vidare till Granska/));
    await d.caption(4, 'Rutorna till Skatteverket är uträknade');
    await d.hover(panel.getByText('Moms att betala', { exact: true }).first());
    await d.wait(1500);
    await d.click(btn(/Gå vidare till Bokför/));
    await d.caption(5, 'Bokför, momskontona nollställs');
    await d.hover(panel.getByText(/Redovisningskonto för moms/).last());
    await d.wait(1300);
    await d.click(btn(/^Bokför$/));
    await d.caption(6, 'Ladda ner filen till Skatteverket');
    await d.click(btn(/Ladda ner fil för uppladdning/));
    await d.wait(700);
    await d.caption(7, 'Logga in hos Skatteverket med BankID och ladda upp filen');
    await d.wait(2200);
    await d.caption(8, 'Markera som inlämnad');
    await d.click(btn('Markera som inlämnad'));
    await d.caption(null, 'Klart! Bokix håller reda på att momsen är inlämnad.');
    await d.wait(2200);
  },

  rapporter: async ({ d, panel }) => {
    const { nav } = helpers(panel);
    await d.caption(1, 'Gå till Rapport och analys');
    await d.click(nav('Rapport och analys'));
    await d.caption(2, 'Öppna Resultaträkning');
    await d.click(panel.getByText('Resultaträkning', { exact: true }).first());
    await d.caption(3, 'Intäkter och kostnader, alltid uppdaterat');
    await d.wait(2600);
    await d.caption(null, 'Välj period eller ladda ner som PDF.');
    await d.wait(2200);
  },
};

async function record(browser, name, run, theme) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE });
  await context.addInitScript(t => localStorage.setItem('bokix_theme_pref', t), theme);
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
  // Demon varnar med alert() för det som inte går att göra i den.
  page.on('dialog', dlg => dlg.dismiss().catch(() => {}));
  try {
    await run({ page, panel, d });
  } catch (err) {
    await page.screenshot({ path: path.join(os.tmpdir(), `guide-fel-${name}-${theme}.png`) });
    await context.close();
    throw err;
  }
  await cdp.send('Page.stopScreencast');
  await context.close();

  const file = theme === 'dark' ? `${name}-dark` : name;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `guide-${file}-`));
  let list = '';
  frames.forEach((f, i) => {
    const img = path.join(dir, `f${String(i).padStart(5, '0')}.jpg`);
    fs.writeFileSync(img, Buffer.from(f.data, 'base64'));
    const dur = i < frames.length - 1 ? frames[i + 1].ts - f.ts : 0.5;
    list += `file '${img.replace(/\\/g, '/')}'\nduration ${Math.max(dur, 0.001).toFixed(4)}\n`;
  });
  list += `file '${path.join(dir, `f${String(frames.length - 1).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);

  // Beskär till appytan (utan overlayens titelrad) och skala till OUT_WIDTH.
  // Relativt bildens storlek (iw/ih), eftersom screencasten kan leverera
  // mindre bilder än viewport × SCALE.
  const rel = (v, of) => (v / of).toFixed(5);
  const out = path.join(OUT_DIR, `${file}.mp4`);
  const poster = path.join(OUT_DIR, `${file}.jpg`);
  const vf = `crop=w=iw*${rel(box.width, 1440)}:h=ih*${rel(box.height, 900)}:x=iw*${rel(box.x, 1440)}:y=ih*${rel(box.y, 900)},scale=${OUT_WIDTH}:-2:flags=lanczos`;
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-vf', `${vf},fps=30`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg misslyckades för ${file}`);
  spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-sseof', '-1.2', '-i', out, '-frames:v', '1', '-q:v', '3', poster], { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
  const secs = frames.length ? (frames.at(-1).ts - frames[0].ts).toFixed(1) : 0;
  console.log(`✓ ${out} (${frames.length} bilder, ${secs} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
// node scripts/record-guide-videos.mjs [namn,namn] [light|dark]
const only = process.argv[2] ? process.argv[2].split(',') : null;
const themes = process.argv[3] ? [process.argv[3]] : ['light', 'dark'];
const browser = await chromium.launch();
let failed = 0;
for (const [name, run] of Object.entries(GUIDES)) {
  if (only && !only.includes(name)) continue;
  for (const theme of themes) {
    try {
      await record(browser, name, run, theme);
    } catch (err) {
      failed++;
      console.error(`✗ ${name} (${theme}): ${String(err.message).split(/\r?\n/)[0]}`);
    }
  }
}
await browser.close();
if (failed) process.exitCode = 1;
