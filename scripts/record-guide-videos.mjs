#!/usr/bin/env node
// ── Spelar in videoguider (public/videos/) av den riktiga appen: startsidans
// produktdemo (DemoOverlay i LandingPage.jsx) med exempeldata, styrd av
// Playwright med en synlig muspekare och en kort textrad per steg. Bildrutorna
// tas med Chromes screencast (skarpare än Playwrights recordVideo, som
// kodar VP8 på 1 Mbit/s) och kodas till H.264 med ffmpeg.
//
// Ljud: en berättarröst (Microsofts svenska neurala röst Mattias, via Edges
// uppläsningstjänst och paketet msedge-tts) säger mer än textraden, och
// musklick, tangenttryck och ett kort "klart"-ljud ritas fram här i skriptet.
// Allt mixas i takt med händelserna under inspelningen.
//
// Körs manuellt, inte del av build:
//   npm run build && npx vite preview --port 4789
//   GUIDE_TOOLS=/tempmapp FFMPEG_PATH=/sökväg/ffmpeg node scripts/record-guide-videos.mjs [namn,namn] [light|dark]
// där tempmappen har `npm i ffmpeg-static msedge-tts`. Utan namn spelas
// alla guider in, i både ljust (namn.mp4) och mörkt läge (namn-dark.mp4).
// Ta om filmerna när appens utseende ändras.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE_URL = process.env.GUIDE_URL || 'http://localhost:4789/';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const OUT_DIR = 'public/videos';
const SCALE = 1.5;
const OUT_WIDTH = 1600;
const VOICE = 'sv-SE-MattiasNeural';
const SR = 48000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = () => Date.now() / 1000;

// ── Berättarrösten ──
// Varje replik syntetiseras en gång och sparas i en cachemapp, så att
// inspelningen inte väntar på nätet och ljust/mörkt läge får samma ljud.
const VOICE_CACHE = path.join(os.tmpdir(), 'bokix-guide-voice');
fs.mkdirSync(VOICE_CACHE, { recursive: true });
let MsEdgeTTS, OUTPUT_FORMAT;
async function loadTts() {
  if (MsEdgeTTS) return;
  let mod;
  try {
    mod = await import('msedge-tts');
  } catch {
    const req = createRequire(path.join(process.env.GUIDE_TOOLS || '.', 'x.js'));
    mod = await import(pathToFileURL(req.resolve('msedge-tts')).href);
  }
  ({ MsEdgeTTS, OUTPUT_FORMAT } = mod);
}

const voiceCache = new Map();
async function voice(text) {
  if (voiceCache.has(text)) return voiceCache.get(text);
  const id = crypto.createHash('sha1').update(VOICE + text).digest('hex').slice(0, 16);
  const mp3 = path.join(VOICE_CACHE, `${id}.mp3`);
  if (!fs.existsSync(mp3)) {
    await loadTts();
    for (let attempt = 1; ; attempt++) {
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(text);
        const chunks = [];
        await new Promise((res, rej) => {
          audioStream.on('data', c => chunks.push(c));
          audioStream.on('close', res);
          audioStream.on('error', rej);
        });
        tts.close();
        if (!chunks.length) throw new Error('tomt svar');
        fs.writeFileSync(mp3, Buffer.concat(chunks));
        break;
      } catch (err) {
        if (attempt >= 3) throw new Error(`Rösten misslyckades för "${text}": ${err.message}`);
        await sleep(1500);
      }
    }
  }
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', mp3, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`Kunde inte avkoda ${mp3}`);
  const buf = r.stdout;
  const pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
  // Edges röst har en liten tystnad i slutet; den räknas inte med i längden.
  let end = pcm.length;
  while (end > 0 && Math.abs(pcm[end - 1]) < 0.004) end--;
  const clip = { pcm, dur: end / SR };
  voiceCache.set(text, clip);
  return clip;
}

// Alla repliker i guiderna, lästa ur källkoden, så att de kan hämtas innan
// inspelningen börjar. Repliken är sista strängen i d.intro/caption/done.
function narrationLines(fn) {
  const lines = [];
  for (const m of fn.toString().matchAll(/d\.(?:intro|caption|done)\(([\s\S]*?)\);/g)) {
    const strings = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(s => s[1]);
    if (strings.length) lines.push(strings.at(-1));
  }
  return lines;
}

// ── Ljudeffekter, ritade som samplingar ──
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Musklick: en kort, torr knäpp med lite kropp. Släppet är tunnare och tystare.
function clickSound(release, seed) {
  const rand = rng(seed);
  const n = Math.round(SR * 0.04);
  const out = new Float32Array(n);
  const tone = release ? 4100 : 3300;
  let lp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noise = rand() * 2 - 1;
    const hp = noise - prev; prev = noise;
    lp += (hp - lp) * 0.55;
    const snap = lp * Math.exp(-t / 0.0012);
    const ring = Math.sin(2 * Math.PI * tone * t) * Math.exp(-t / 0.0022);
    const body = Math.sin(2 * Math.PI * (release ? 260 : 170) * t) * Math.exp(-t / 0.007);
    out[i] = (snap * 0.9 + ring * 0.35 + body * 0.45) * (release ? 0.22 : 0.4);
  }
  return out;
}
// Tangenttryck: mjukt och lågt, med lite variation så att det inte låter maskinellt.
function keySound(seed) {
  const rand = rng(seed);
  const n = Math.round(SR * 0.03);
  const out = new Float32Array(n);
  const tone = 1500 + rand() * 700;
  const gain = 0.07 + rand() * 0.04;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    lp += ((rand() * 2 - 1) - lp) * 0.35;
    const env = Math.exp(-t / 0.0035);
    out[i] = (lp * 0.8 + Math.sin(2 * Math.PI * tone * t) * 0.3 + Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t / 0.006) * 0.4) * env * gain;
  }
  return out;
}
// "Klart": två mjuka toner, en kvint isär.
function doneSound() {
  const n = Math.round(SR * 1.3);
  const out = new Float32Array(n);
  for (const [f, at] of [[1046.5, 0], [1568, 0.1]]) {
    const off = Math.round(at * SR);
    for (let i = 0; i + off < n; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.006) * Math.exp(-t / 0.38);
      out[i + off] += (Math.sin(2 * Math.PI * f * t) + 0.18 * Math.sin(4 * Math.PI * f * t)) * env * 0.09;
    }
  }
  return out;
}

function mix(events, t0, duration) {
  const out = new Float32Array(Math.ceil((duration + 0.2) * SR));
  const add = (pcm, at, gain = 1) => {
    const off = Math.round((at - t0) * SR);
    for (let i = 0; i < pcm.length; i++) {
      const j = off + i;
      if (j >= 0 && j < out.length) out[j] += pcm[i] * gain;
    }
  };
  let seed = 1;
  for (const e of events) {
    if (e.type === 'voice') add(e.clip.pcm, e.t, 0.95);
    else if (e.type === 'down') add(clickSound(false, seed++), e.t);
    else if (e.type === 'up') add(clickSound(true, seed++), e.t);
    else if (e.type === 'key') add(keySound(seed++), e.t);
    else if (e.type === 'done') add(doneSound(), e.t);
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  // Normaliseras alltid till samma topp, annars blir rösten för tyst.
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.89 / peak;
  return out;
}

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
        background: rgba(17, 24, 20, .9); color: #fff; font: 600 18px/1.35 Inter, system-ui, sans-serif;
        padding: 11px 20px; border-radius: 999px; box-shadow: 0 12px 34px -12px rgba(0,0,0,.5);
        display: flex; align-items: center; gap: 11px; white-space: nowrap; }
      #gv-caption.on { opacity: 1; transform: translate(-50%, 0); }
      #gv-caption b { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%;
        background: #16803a; font-size: 14px; }
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

// Pekaren rör sig snabbt, men nästa steg börjar först när rösten har sagt
// klart det förra. Rösten styr alltså tempot, inte pauserna i guiderna.
function director(page, events) {
  let pos = { x: 700, y: 450 };
  let speechEnd = 0;
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
  const untilSilent = async (gap = 0.25) => {
    const left = speechEnd + gap - now();
    if (left > 0) await sleep(left * 1000);
  };
  const speak = async (say) => {
    const clip = await voice(say);
    events.push({ type: 'voice', t: now(), clip });
    speechEnd = now() + clip.dur;
  };
  const keys = async (text, delay) => {
    for (const ch of text) {
      events.push({ type: 'key', t: now() });
      await page.keyboard.type(ch);
      await sleep(delay);
    }
  };
  return {
    // Inledande replik, utan textrad.
    async intro(say) {
      await sleep(300);
      await speak(say);
      await sleep(Math.min(1400, voiceCache.get(say).dur * 1000 * 0.6));
    },
    async caption(n, text, say) {
      await untilSilent();
      await page.evaluate(([n, text]) => {
        const c = document.getElementById('gv-caption');
        c.classList.remove('on');
        setTimeout(() => { c.innerHTML = (n ? `<b>${n}</b>` : '') + text; c.classList.add('on'); }, 180);
      }, [n, text]);
      await sleep(180);
      await speak(say);
      await sleep(370);
    },
    // Sista raden: ett kort klartljud, repliken, och en stund att läsa.
    async done(text, say) {
      await untilSilent(0.35);
      events.push({ type: 'done', t: now() + 0.18 });
      await this.caption(null, text, say);
      await untilSilent(1.4);
    },
    async click(loc, { pause = 170 } = {}) {
      const p = await center(loc);
      await move(p.x, p.y);
      await sleep(pause);
      events.push({ type: 'down', t: now() });
      await page.mouse.down();
      await sleep(70);
      events.push({ type: 'up', t: now() });
      await page.mouse.up();
      await sleep(320);
    },
    async type(loc, text, { delay = 30 } = {}) {
      await this.click(loc, { pause: 120 });
      await keys(text, delay);
      await sleep(160);
    },
    async hover(loc) {
      const p = await center(loc);
      await move(p.x, p.y);
    },
    // Rullar ytan under pekaren mjukt. dy = null rullar hela vägen upp.
    // (Playwrights mouse.wheel väntar in varje steg och blir för långsamt.)
    async scroll(dy) {
      await page.evaluate(([x, y, dy]) => {
        let sc = document.elementFromPoint(x, y);
        while (sc && sc !== document.body) {
          const oy = getComputedStyle(sc).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight) break;
          sc = sc.parentElement;
        }
        if (!sc || sc === document.body) return;
        if (dy === null) sc.scrollTo({ top: 0, behavior: 'smooth' });
        else sc.scrollBy({ top: dy, behavior: 'smooth' });
      }, [pos.x, pos.y, dy]);
      await sleep(750);
    },
    // Pekar en bit från ett element, t.ex. in i en rapport under rubriken.
    async point(loc, dx, dy) {
      const p = await center(loc);
      await move(p.x + dx, p.y + dy);
    },
    // Väntar tills rösten har sagt klart, utan ny textrad.
    settle: () => untilSilent(0.3),
    // Ersätter ett förifyllt värde (t.ex. Antal = 1).
    async replace(loc, text) {
      await this.click(loc, { pause: 120 });
      await loc.press('Control+A');
      await keys(text, 50);
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
      // Hittas inte knappen får väntan inte krascha hela körningen.
      chooser.catch(() => {});
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
// ska ändras i takt med appen. Textraden är kort; rösten (sista strängen)
// förklarar mer, i du-form och vardaglig ton. Undvik apostrofer i replikerna,
// de läses ur källkoden. Varje guide spelas in i ljust och mörkt läge.
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
    const { nav, btn } = helpers(panel);
    await d.intro('Så här lägger du upp en ny kund i Bokix.');
    await d.caption(1, 'Gå till Kunder', 'Börja med att gå till Kunder, i menyn till vänster.');
    await d.click(nav('Kunder'));
    await d.caption(2, 'Tryck på Ny kund', 'Tryck sedan på Ny kund.');
    await d.click(btn('Ny kund'));
    await d.caption(3, 'Fyll i namn och e-post', 'Skriv in företagets namn, och vilken e-postadress fakturorna ska gå till.');
    await d.type(panel.getByPlaceholder('Exempelföretag AB'), 'Exempelkaféet AB');
    await d.type(panel.getByPlaceholder('epost@foretag.se'), 'info@exempelkafeet.se');
    await d.caption(4, 'Lägg till organisationsnummer', 'Lägg till organisationsnumret också. Det behövs på fakturan.');
    await d.type(panel.getByPlaceholder('XXXXXX-XXXX'), '559999-0008');
    await d.caption(5, 'Spara', 'Och sen trycker du på Spara.');
    await d.click(btn('Spara kund'));
    await d.done('Klart! Kunden finns i listan.', 'Klart! Nu finns kunden i listan, och du kan välja den direkt när du gör en faktura.');
  },

  'skapa-faktura': async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    const cell = (label) => panel.locator('.inv-row-card').first().locator(`.inv-cell[data-label="${label}"] input`);
    await d.intro('Nu gör vi en faktura. Det går fortare än du tror.');
    await d.caption(1, 'Gå till Kundfakturor', 'Gå till Kundfakturor i menyn.');
    await d.click(nav('Kundfakturor'));
    await d.caption(2, 'Tryck på Skapa faktura', 'Tryck på Skapa faktura.');
    await d.click(btn('Skapa faktura'));
    await d.caption(3, 'Välj kund', 'Välj vilken kund fakturan ska till.');
    const customer = panel.locator('select[data-inv-tour="form-customer"]');
    await d.select(customer, await customer.locator('option', { hasText: 'Exempelbygg AB' }).getAttribute('value'));
    await d.caption(4, 'Vad har du sålt, antal och pris', 'Skriv vad du har sålt, hur många, och vad det kostar styck.');
    await d.type(cell('Benämning'), 'Konsulttimmar');
    await d.replace(cell('Antal'), '8');
    await d.replace(cell('À-pris'), '950');
    await d.caption(5, 'Moms och summa räknas ut åt dig', 'Du behöver inte räkna något själv. Moms och summa räknas ut åt dig.');
    await d.hover(panel.getByText('Att betala', { exact: true }).first());
    await d.caption(6, 'Tryck på Skapa faktura', 'Ser allt rätt ut? Tryck på Skapa faktura.');
    await d.click(btn('Skapa faktura'));
    await d.done('Klart! Fakturan ligger i listan.', 'Klart! Fakturan ligger nu i listan, redo att skickas.');
  },

  'skicka-faktura': async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    await d.intro('I den här guiden skickar vi en faktura till kunden.');
    await d.caption(1, 'Gå till Kundfakturor', 'Gå till Kundfakturor.');
    await d.click(nav('Kundfakturor'));
    await d.caption(2, 'Öppna fakturan', 'Öppna fakturan du vill skicka.');
    await d.click(panel.getByText('1012', { exact: true }).first());
    await d.caption(3, 'Förhandsgranska', 'Tryck på Förhandsgranska, så ser du hur den kommer att se ut.');
    await d.click(btn('Förhandsgranska'));
    await d.caption(4, 'Välj bland fyra mallar', 'Här kan du välja mellan fyra olika mallar. Ta den du gillar bäst.');
    const preview = panel.locator('.a4-preview-overlay');
    for (const name of ['Kraftfull', 'Minimal', 'Rutnät', 'Klassisk']) {
      await d.click(preview.getByRole('button', { name, exact: true }));
      await d.wait(900);
    }
    await d.click(preview.locator('.modal-close').first());
    await d.caption(5, 'Skicka med e-post', 'Stäng förhandsvisningen och tryck på Skicka via e-post.');
    await d.click(btn(/Skicka via e-post/));
    await d.caption(6, 'Lägg med en Betala nu-knapp via Stripe', 'Vill du få betalt snabbare? Bocka i Betala nu, så kan kunden betala med kort direkt.');
    const pay = panel.getByText(/Betala nu/).first();
    await d.hover(pay);
    const box = panel.locator('input[type="checkbox"]').filter({ visible: true }).last();
    if (!(await box.isChecked())) await d.click(box);
    await d.caption(7, 'Skicka', 'Tryck på Skicka.');
    await d.click(panel.locator('.modal-footer').getByRole('button', { name: 'Skicka', exact: true }));
    await d.wait(1200);
    await d.done('Klart! Kunden får fakturan som PDF och kan betala med kort.', 'Klart! Kunden får fakturan som PDF i sin inkorg, och kan betala med kort.');
  },

  'registrera-betalning': async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    const statusBtn = (nr) => panel.locator('tr', { hasText: nr }).locator('[data-inv-tour="row-status"] button').first();
    await d.intro('Så här håller du koll på vilka fakturor som är betalda.');
    await d.caption(1, 'Gå till Kundfakturor', 'Gå till Kundfakturor.');
    await d.click(nav('Kundfakturor'));
    await d.caption(2, 'Betalt? Tryck på Obetald så markeras den som betald', 'Har kunden betalat allt? Tryck bara på Obetald, så markeras fakturan som betald.');
    await d.click(statusBtn('1010'));
    await d.caption(3, 'Delbetalning? Öppna fakturan', 'Har kunden bara betalat en del? Då öppnar du fakturan.');
    await d.click(panel.getByText('1009', { exact: true }).first());
    await d.caption(4, 'Tryck på Registrera betalning', 'Tryck på Registrera betalning.');
    await d.click(btn('Registrera betalning'));
    await d.caption(5, 'Skriv beloppet och datumet', 'Skriv hur mycket som har kommit in, och vilket datum.');
    const amount = panel.locator('.modal-content input[type="number"]').first();
    await d.replace(amount, '20000');
    await d.click(panel.locator('.modal-content').getByRole('button', { name: 'Registrera betalning' }));
    await d.wait(600);
    await d.done('Betalar kunden med kort via Stripe hamnar betalningen i Granskning.', 'Och betalar kunden med kort, så dyker betalningen upp i Granskning av sig själv.');
  },

  'skapa-offert': async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    await d.intro('Nu gör vi en offert.');
    await d.caption(1, 'Gå till Offerter', 'Gå till Offerter i menyn.');
    await d.click(nav('Offerter'));
    await d.caption(2, 'Tryck på Ny offert', 'Tryck på Ny offert.');
    await d.click(btn('Ny offert'));
    await d.caption(3, 'Skriv kundens namn', 'Skriv in kundens namn.');
    await d.type(panel.getByPlaceholder('Företagsnamn AB'), 'Testdesign AB');
    await d.caption(4, 'Vad offerten gäller och priset', 'Beskriv vad offerten gäller, och sätt ett pris.');
    await d.type(panel.getByPlaceholder('Beskrivning').first(), 'Ny webbplats, fem sidor');
    await d.replace(panel.getByPlaceholder('Á-pris').first(), '24000');
    await d.caption(5, 'Spara offerten', 'Spara offerten.');
    await d.click(btn('Spara offert'));
    await d.done('Klart! Blir det ja gör du om den till en faktura.', 'Klart! Och säger kunden ja, gör du enkelt om offerten till en faktura.');
  },

  'ladda-upp-kvitto': async ({ d, panel }) => {
    const { nav } = helpers(panel);
    await d.intro('Så här bokför du ett kvitto, utan att skriva av det själv.');
    await d.caption(1, 'Gå till Kvitton', 'Gå till Kvitton.');
    await d.click(nav('Kvitton'));
    await d.caption(2, 'Ladda upp ett foto av kvittot', 'Ladda upp ett foto av kvittot. Det går bra att ta det med mobilen.');
    await d.upload(panel.locator('.rc-drop').first(), RECEIPT);
    await d.caption(3, 'Tryck på Läs av kvittot', 'Tryck på Läs av kvittot.');
    await d.click(panel.getByRole('button', { name: /Läs av kvittot/ }).first());
    await d.caption(4, 'Datum, belopp och moms fylls i åt dig', 'Nu läser Bokix av datum, belopp och moms, och fyller i fälten åt dig.');
    await d.wait(6500);
    await d.done('Kontrollera och tryck Spara och bokför.', 'Kolla att allt stämmer, och tryck på Spara och bokför. Klart!');
  },

  'ny-artikel': async ({ d, panel }) => {
    const { nav, btn, field } = helpers(panel);
    await d.intro('Säljer du samma sak ofta? Spara den som en artikel.');
    await d.caption(1, 'Gå till Artiklar', 'Gå till Artiklar.');
    await d.click(nav('Artiklar'));
    await d.caption(2, 'Tryck på Ny artikel', 'Tryck på Ny artikel.');
    await d.click(btn('Ny artikel'));
    await d.caption(3, 'Namn och pris', 'Ge den ett namn och ett pris.');
    await d.type(panel.getByPlaceholder('T.ex. Konsulttimme'), 'Webbsupport, timme');
    await d.replace(field('Pris exkl. moms *'), '850');
    await d.caption(4, 'Spara', 'Och spara.');
    await d.click(btn('Spara artikel'));
    await d.done('Klart! Välj artikeln direkt på nästa faktura.', 'Klart! Nästa gång du gör en faktura väljer du bara artikeln i listan.');
  },

  'ny-verifikation': async ({ d, panel, page }) => {
    const { nav, btn, field } = helpers(panel);
    await d.intro('Nu bokför vi ett köp, helt utan debet och kredit.');
    await d.caption(1, 'Gå till Bokföring', 'Gå till Bokföring.');
    await d.click(nav('Bokföring'));
    await d.caption(2, 'Tryck på Ny verifikation', 'Tryck på Ny verifikation.');
    await d.click(btn('Ny verifikation'));
    await d.caption(3, 'Beskriv köpet och beloppet', 'Skriv vad du har köpt, och vad det kostade med moms.');
    await d.type(panel.getByPlaceholder('Vad gäller verifikationen...'), 'Kontorsmaterial');
    await d.type(field('Belopp inkl. moms (kr)'), '495');
    await d.caption(4, 'Vad har du köpt?', 'Sök sedan fram vad det är för slags köp. Här blir det kontorsmaterial.');
    await d.type(panel.getByPlaceholder('Sök, till exempel kontorsmaterial'), 'kontorsmat');
    await d.click(page.getByText('Kontorsmateriel', { exact: true }).last());
    await d.caption(5, 'Granska och bokför', 'Tryck på Granska och bokför.');
    await d.click(btn('Granska & bokför'));
    await d.wait(1200);
    const confirm = page.getByRole('button', { name: /^Bokför/ }).last();
    if (await confirm.isVisible().catch(() => false)) await d.click(confirm);
    await d.done('Klart! Debet och kredit sköts åt dig.', 'Klart! Bokix väljer rätt konton, och sköter debet och kredit åt dig.');
  },

  'nytt-projekt': async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    await d.intro('Så här startar du ett projekt.');
    await d.caption(1, 'Gå till Projekt', 'Gå till Projekt.');
    await d.click(nav('Projekt'));
    await d.caption(2, 'Tryck på Nytt projekt', 'Tryck på Nytt projekt.');
    await d.click(btn('Nytt projekt'));
    await d.caption(3, 'Ge projektet ett namn', 'Ge projektet ett namn.');
    await d.type(panel.getByPlaceholder('t.ex. Kontorsrenovering 2026'), 'Ny webbplats');
    await d.caption(4, 'Spara', 'Och spara.');
    await d.click(panel.locator('.modal-overlay').getByRole('button', { name: /^(Skapa|Spara)/ }).last());
    await d.done('Klart! Rapportera tid och fakturera projektet.', 'Klart! Nu kan du rapportera tid på projektet, och fakturera det när det är dags.');
  },

  'ny-anstalld': async ({ d, panel, page }) => {
    const { nav, btn, field } = helpers(panel);
    await d.intro('Nu lägger vi till en anställd, så att du kan köra lön.');
    await d.caption(1, 'Gå till Anställda och lön', 'Gå till Anställda och lön.');
    await d.click(nav('Anställda och lön'));
    await d.caption(2, 'Tryck på Ny anställd', 'Tryck på Ny anställd.');
    await d.click(btn('Ny anställd'));
    await d.caption(3, 'Namn och personnummer', 'Fyll i namn och personnummer.');
    await d.type(field('Förnamn *'), 'Alex');
    await d.type(field('Efternamn *'), 'Exempel');
    await d.type(panel.getByPlaceholder('ÅÅÅÅMMDD-XXXX'), '19900101-0017');
    await d.caption(4, 'Anställningsdatum och lön', 'Sedan när personen börjar, och månadslönen.');
    await d.setDate(field('Anställningsdatum *'), '2026-10-01');
    await d.replace(field('Månadslön (brutto)'), '32000');
    await d.caption(5, 'Välj kommun och skattetabell', 'Välj vilken kommun personen bor i, och skattetabell.');
    await d.type(panel.getByPlaceholder('Sök kommun...'), 'Stockholm');
    await d.click(page.getByText('Stockholm', { exact: true }).last());
    await d.click(panel.locator('.tax-table-choice').first());
    await d.caption(6, 'Spara', 'Och spara.');
    await d.click(btn('Spara anställd'));
    await d.done('Klart! Nu kan du köra lön.', 'Klart! Nu är allt på plats för att köra lön.');
  },

  momsdeklaration: async ({ d, panel }) => {
    const { nav, btn } = helpers(panel);
    await d.intro('Så här gör du momsdeklarationen i Bokix.');
    await d.caption(1, 'Gå till Skatt och bokslut', 'Gå till Skatt och bokslut.');
    await d.click(nav('Skatt och bokslut'));
    await d.caption(2, 'Tryck på Gör momsdeklarationen', 'Tryck på Gör momsdeklarationen.');
    await d.click(btn('Gör momsdeklarationen'));
    await d.caption(3, 'Bokix kontrollerar bokföringen', 'Först kontrollerar Bokix att bokföringen ser rätt ut.');
    await d.click(btn(/Gå vidare till Granska/));
    await d.caption(4, 'Rutorna till Skatteverket är uträknade', 'Sen är alla rutor till Skatteverket redan uträknade. Du ser direkt hur mycket moms du ska betala.');
    await d.hover(panel.getByText('Moms att betala', { exact: true }).first());
    await d.wait(1200);
    await d.click(btn(/Gå vidare till Bokför/));
    await d.caption(5, 'Bokför, momskontona nollställs', 'Tryck på Bokför, så nollställs momskontona.');
    await d.hover(panel.getByText(/Redovisningskonto för moms/).last());
    await d.wait(900);
    await d.click(btn(/^Bokför$/));
    await d.caption(6, 'Ladda ner filen till Skatteverket', 'Ladda ner filen till Skatteverket.');
    await d.click(btn(/Ladda ner fil för uppladdning/));
    await d.caption(7, 'Logga in hos Skatteverket med BankID och ladda upp filen', 'Logga in hos Skatteverket med BankID, och ladda upp filen där.');
    await d.caption(8, 'Markera som inlämnad', 'Kom sen tillbaka hit, och markera deklarationen som inlämnad.');
    await d.click(btn('Markera som inlämnad'));
    await d.done('Klart! Bokix håller reda på att momsen är inlämnad.', 'Klart! Bokix håller reda på att momsen är inlämnad.');
  },

  // Går igenom de viktigaste rapporterna en i taget. Nästa replik börjar
  // medan pekaren går tillbaka till listan, så att det inte blir dödtid.
  rapporter: async ({ d, panel }) => {
    const { nav } = helpers(panel);
    const link = panel.getByText('Alla rapporter', { exact: true }).first();
    const list = panel.getByText('Huvudbok', { exact: true }).first();
    const shows = (loc) => loc.waitFor({ timeout: 1500 }).then(() => true, () => false);
    // Listan kan fortfarande rulla när pekaren klickar; missar klicket
    // klickas det en gång till.
    // I rapporten rullar pekaren ner genom diagram och tabeller, en bit i
    // taget (stops = hur långt varje gång).
    const open = async (name, stops = [520]) => {
      for (let i = 0; i < 3; i++) {
        await d.click(panel.getByText(name, { exact: true }).first());
        if (await shows(link)) break;
      }
      await d.point(link, 420, 300);
      await d.wait(500);
      for (const dy of stops) {
        await d.scroll(dy);
        await d.wait(900);
      }
    };
    // Upp till toppen igen innan pekaren klickar på Alla rapporter, annars
    // hamnar klicket där länken var medan sidan rullade.
    const back = async () => {
      await d.scroll(null);
      for (let i = 0; i < 3; i++) {
        await d.click(link);
        if (await shows(list)) return;
      }
      throw new Error('Kom inte tillbaka till rapportlistan');
    };
    await d.intro('Här är rapporterna i Bokix.');
    await d.caption(1, 'Gå till Rapport och analys', 'Gå till Rapport och analys.');
    await d.click(nav('Rapport och analys'));
    await d.caption(2, 'Företagsöversikt', 'Företagsöversikten visar omsättning och resultat. Längre ner ser du vart pengarna går, marginalen och kassaflödet.');
    await open('Företagsöversikt', [480, 520, 520]);
    await d.caption(3, 'Resultaträkning', 'Resultaträkningen visar intäkter minus kostnader, månad för månad.');
    await back();
    await open('Resultaträkning', [480, 520]);
    await d.caption(4, 'Balansräkning', 'Balansräkningen visar vad företaget äger, och vad det är skyldigt.');
    await back();
    await open('Balansräkning');
    await d.caption(5, 'Nyckeltal', 'Nyckeltal visar vinstmarginal, kassalikviditet och soliditet.');
    await back();
    await open('Nyckeltal');
    await d.caption(6, 'Momsrapport', 'Momsrapporten är underlaget till momsdeklarationen, ruta för ruta.');
    await back();
    await open('Momsrapport');
    await d.settle();
    await back();
    await d.hover(list);
    await d.done('Du kan även se resten, som huvudbok och årsrapport.', 'Längre ner finns resten, som huvudbok, fakturarapporter och årsrapport. Allt kan laddas ner som PDF.');
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
  // Utskicket av fakturor går inte iväg från filmen; servern svarar som vid ett lyckat utskick.
  await page.route('**/api/email/**', route => route.fulfill({ json: { id: 'demo', ok: true } }));
  // Själva appkortet, utan overlayens ljusa kant runt om.
  const box = await page.locator('.lp-demo-card').boundingBox();
  await installOverlay(page, box);
  const events = [];
  const d = director(page, events);
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

  // Ljudspåret: händelsernas tider (Node-klockan) mot första bildrutans
  // tid (Chromes klocka, samma dator), lika långt som filmen.
  const t0 = frames[0].ts;
  const duration = frames.at(-1).ts - t0 + 0.5;
  const audio = mix(events, t0, duration);
  const audioFile = path.join(dir, 'audio.f32');
  fs.writeFileSync(audioFile, Buffer.from(audio.buffer));

  // Beskär till appytan (utan overlayens titelrad) och skala till OUT_WIDTH.
  // Relativt bildens storlek (iw/ih), eftersom screencasten kan leverera
  // mindre bilder än viewport × SCALE.
  const rel = (v, of) => (v / of).toFixed(5);
  const out = path.join(OUT_DIR, `${file}.mp4`);
  const poster = path.join(OUT_DIR, `${file}.jpg`);
  const vf = `crop=w=iw*${rel(box.width, 1440)}:h=ih*${rel(box.height, 900)}:x=iw*${rel(box.x, 1440)}:y=ih*${rel(box.y, 900)},scale=${OUT_WIDTH}:-2:flags=lanczos`;
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', audioFile,
    '-vf', `${vf},fps=30`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg misslyckades för ${file}`);
  spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-sseof', '-1.2', '-i', out, '-frames:v', '1', '-q:v', '3', poster], { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`✓ ${out} (${frames.length} bilder, ${duration.toFixed(1)} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
}

// Det rösten säger i varje guide, som text: visas under filmen på /guider
// och som transcript i sidans VideoObject. Skrivs om vid varje körning, och
// ensam med `node scripts/record-guide-videos.mjs --text` (ingen inspelning).
const TRANSCRIPTS = 'src/content/marketing/guideTranscripts.json';
fs.writeFileSync(TRANSCRIPTS, JSON.stringify(Object.fromEntries(Object.entries(GUIDES).map(([name, run]) => [name, narrationLines(run)])), null, 2) + '\n');
if (process.argv[2] === '--text') {
  console.log(`✓ ${TRANSCRIPTS}`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
// node scripts/record-guide-videos.mjs [namn,namn] [light|dark]
const only = process.argv[2] ? process.argv[2].split(',') : null;
const themes = process.argv[3] ? [process.argv[3]] : ['light', 'dark'];
const chosen = Object.entries(GUIDES).filter(([name]) => !only || only.includes(name));

// Hämta all röst först, så att inspelningen går i jämn takt.
for (const [, run] of chosen) {
  for (const line of narrationLines(run)) await voice(line);
}
console.log(`Röst klar (${voiceCache.size} repliker).`);

const browser = await chromium.launch();
let failed = 0;
for (const [name, run] of chosen) {
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
