// Ritar en delningsbild (og:image, 1200×630) per marknadssida till
// public/og/<namn>.jpg, utifrån src/content/marketing/ogImages.js.
// Samma stil på alla: mörkgrön bakgrund, Bokix-loggan, sidans rubrik till
// vänster och ett kort med sidans viktigaste punkter till höger.
// Kör: node scripts/render-og-images.mjs [sökväg] (utan argument ritas alla om)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'og');
fs.mkdirSync(outDir, { recursive: true });
const { OG_PAGES } = await import(pathToFileURL(path.join(root, 'src/content/marketing/ogImages.js')).href);

const wordmarkSrc = fs.readFileSync(path.join(root, 'src/components/shared/BokixWordmark.jsx'), 'utf8');
const wordmarkPath = wordmarkSrc.match(/const PATH_D = "([^"]+)"/)?.[1];
if (!wordmarkPath) throw new Error('Hittade inte PATH_D i BokixWordmark.jsx');

const motifStyle = (a) => `
.left { width: 520px; }
.chips { margin-top: 28px; display: flex; flex-direction: column; gap: 12px; }
.chips span { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 600; color: #e6ede2; }
.chips i { flex: none; width: 26px; height: 26px; border-radius: 50%; background: ${a}40 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.5 12.5l3.6 3.6 7.4-8' fill='none' stroke='white' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/70% no-repeat; }
.eyebrow { color: ${a}; }
.b2 { background: ${a}; opacity: 0.28; }
.b3 { background: ${a}; opacity: 0.2; }
`;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ── Egna motiv ─────────────────────────────────────────────────────────
// Sidor med `motif` i ogImages.js får en egen ritad bild till höger i
// stället för punktlistan, och `accent` färgar ljusfläckarna och raden
// ovanför rubriken. Då ser delningsbilderna olika ut och visar vad just
// den sidan handlar om. Punkterna visas som en kort lista under rubriken.
const MOTIF_CSS = `
.m { position: absolute; right: 60px; top: 50%; transform: translateY(-50%); width: 480px; height: 470px; }
.m .paper { position: absolute; background: #fbf8f1; border-radius: 14px; box-shadow: 0 2px 0 rgba(0,0,0,0.05), 0 40px 60px -28px rgba(0,0,0,0.75); color: #1d2b23; }
.m .serif { font-family: Georgia, 'Times New Roman', serif; }
.m .pill { position: absolute; display: inline-flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 800; color: #fff; border-radius: 999px; padding: 9px 18px 9px 13px; border: 4px solid #fbf8f1; box-shadow: 0 14px 24px -10px rgba(0,0,0,0.6); }
.m .row2 { display: flex; justify-content: space-between; font-size: 17px; padding: 10px 0; border-top: 1.5px solid #ece5d6; }
`;
const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const box = (l, t, w, c) => `<div style="position:absolute;left:${l}px;top:${t}px;width:${w}px;height:158px;border-radius:10px;background:${c};box-shadow:0 30px 40px -24px rgba(0,0,0,0.75)"><div style="position:absolute;left:50%;top:0;bottom:0;width:34px;margin-left:-17px;background:rgba(255,255,255,0.28)"></div><div style="position:absolute;left:18px;bottom:18px;width:64px;height:40px;border-radius:5px;background:#fbf8f1"></div></div>`;
const MOTIFS = {
  faktura: `<div class="m">
    <div class="paper" style="left:80px;top:10px;width:330px;height:420px;padding:34px 32px;transform:rotate(-4deg)">
      <div class="serif" style="font-size:34px;font-weight:700">Faktura 1012</div>
      <div style="font-size:15px;color:#6b7f74;margin:6px 0 24px">Testdesign AB</div>
      <div class="row2"><span>Konsulttimmar, 8 h</span><b>7 600</b></div>
      <div class="row2"><span>Moms 25 %</span><b>1 900</b></div>
      <div class="row2" style="font-size:21px;font-weight:800;border-top:2px solid #1d2b23"><span>Att betala</span><span>9 500 kr</span></div>
      <div style="margin-top:22px;height:54px;border-radius:12px;background:#1d2b23;color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center">Betala med kort</div>
    </div>
    <div style="position:absolute;left:0;top:310px;width:230px;height:144px;border-radius:18px;background:linear-gradient(135deg,#1e40af,#0ea5e9);transform:rotate(8deg);box-shadow:0 30px 40px -20px rgba(0,0,0,0.7);padding:22px">
      <div style="width:44px;height:32px;border-radius:7px;background:#e8c46a"></div>
      <div style="color:#fff;font-size:18px;letter-spacing:0.14em;margin-top:26px;font-family:Consolas,monospace">•••• 4242</div>
    </div>
    <div class="pill" style="right:20px;top:0;background:#1f7a4a;transform:rotate(6deg)">${CHECK}Betald</div>
  </div>`,
  lager: `<div class="m">
    ${box(30, 270, 200, "#c99a5e")}${box(245, 270, 200, "#bd8f55")}${box(130, 106, 200, "#d3a76b")}
    <div class="paper" style="right:0;top:10px;width:220px;padding:20px 22px;transform:rotate(5deg)">
      <div style="font-size:13px;font-weight:800;letter-spacing:0.08em;color:#6b7f74">LAGERVÄRDE</div>
      <div class="serif" style="font-size:34px;font-weight:700;margin-top:4px">22 400 kr</div>
      <div style="display:inline-block;margin-top:10px;font-size:13px;font-weight:800;color:#1f7a4a;background:#e3f2e8;border-radius:999px;padding:4px 10px">FIFO</div>
    </div>
  </div>`,
  anlaggning: `<div class="m">
    <div style="position:absolute;left:40px;top:30px;width:400px;height:260px;border-radius:18px 18px 6px 6px;background:#1c2a24;border:12px solid #2c3b34;box-shadow:0 30px 50px -24px rgba(0,0,0,0.8)">
      <svg viewBox="0 0 376 236" style="position:absolute;inset:0;width:100%;height:100%">
        <g stroke="rgba(255,255,255,0.08)" stroke-width="1.5"><line x1="24" x2="352" y1="50" y2="50"/><line x1="24" x2="352" y1="100" y2="100"/><line x1="24" x2="352" y1="150" y2="150"/><line x1="24" x2="352" y1="200" y2="200"/></g>
        <defs><linearGradient id="dg" x1="0" x2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#84cc16"/></linearGradient></defs>
        <path d="M34 40 L340 200" stroke="url(#dg)" stroke-width="7" stroke-linecap="round" fill="none"/>
        <circle cx="34" cy="40" r="9" fill="#2dd4bf"/><circle cx="136" cy="93" r="9" fill="#5fd3a0"/><circle cx="340" cy="200" r="9" fill="#84cc16"/>
      </svg>
    </div>
    <div style="position:absolute;left:0;top:290px;width:480px;height:22px;border-radius:4px 4px 18px 18px;background:#3a4a42;box-shadow:0 24px 30px -16px rgba(0,0,0,0.7)"></div>
    <div class="paper" style="left:130px;top:345px;width:320px;padding:18px 22px;transform:rotate(-3deg)">
      <div style="display:flex;justify-content:space-between;font-size:16px;color:#6b7f74;font-weight:600"><span>Dator, 36 mån</span><span>667 kr/mån</span></div>
      <div class="serif" style="font-size:26px;font-weight:700;margin-top:6px">24 000 → 16 000 kr</div>
    </div>
  </div>`,
  billigt: `<div class="m">
    <div class="paper" style="left:50px;top:70px;width:390px;height:290px;border-radius:26px;transform:rotate(-8deg);padding:44px 44px">
      <div style="position:absolute;left:26px;top:26px;width:26px;height:26px;border-radius:50%;background:#0d1d16;box-shadow:inset 0 2px 4px rgba(0,0,0,0.6)"></div>
      <div style="font-size:16px;font-weight:800;letter-spacing:0.08em;color:#6b7f74;margin-left:40px">ALLT INGÅR</div>
      <div class="serif" style="font-size:118px;font-weight:700;line-height:1;margin-top:18px;letter-spacing:-0.03em">129<span style="font-size:42px"> kr</span></div>
      <div style="font-size:20px;font-weight:600;color:#6b7f74;margin-top:10px">i månaden, utan moms</div>
    </div>
    <div class="pill" style="right:10px;bottom:40px;background:#1f7a4a;transform:rotate(-4deg)">${CHECK}Inga tillägg</div>
  </div>`,
  flytt: `<div class="m">
    <div class="paper" style="left:0;top:60px;width:200px;height:250px;padding:26px 22px;transform:rotate(-6deg)">
      <div style="display:inline-block;font-size:18px;font-weight:800;color:#fff;background:#7c3aed;border-radius:7px;padding:5px 11px">SIE4</div>
      <div style="height:11px;border-radius:6px;background:#1d2b23;opacity:.12;margin-top:26px;width:130px"></div>
      <div style="height:11px;border-radius:6px;background:#1d2b23;opacity:.12;margin-top:14px;width:100px"></div>
      <div style="height:11px;border-radius:6px;background:#1d2b23;opacity:.12;margin-top:14px;width:120px"></div>
    </div>
    <svg viewBox="0 0 120 60" style="position:absolute;left:190px;top:150px;width:110px"><path d="M6 40 C 40 4, 80 4, 110 30" stroke="#e9e3ff" stroke-width="5" stroke-dasharray="10 9" stroke-linecap="round" fill="none"/><path d="M98 18 L112 31 L95 38" stroke="#e9e3ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
    <div class="paper" style="left:290px;top:110px;width:190px;height:170px;border-radius:38px;display:flex;align-items:center;justify-content:center;transform:rotate(5deg)"><svg viewBox="0 0 125 40" style="width:140px"><defs><linearGradient id="wf" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0ea5e9"/><stop offset="50%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#84cc16"/></linearGradient></defs><path d="${wordmarkPath}" fill="url(#wf)"/></svg></div>
    <div class="pill" style="left:150px;top:350px;background:#1f7a4a;transform:rotate(-4deg)">${CHECK}Allt följer med</div>
  </div>`,
  nystartat: `<div class="m">
    <div class="paper" style="left:10px;top:20px;width:300px;padding:22px 26px;transform:rotate(-5deg)">
      <div style="font-size:13px;font-weight:800;letter-spacing:0.08em;color:#6b7f74">ORGANISATIONSNUMMER</div>
      <div style="font-size:30px;font-weight:800;margin-top:6px;letter-spacing:0.02em">559123-4567</div>
    </div>
    <div class="paper" style="left:110px;top:150px;width:350px;padding:26px 28px;transform:rotate(3deg)">
      <div class="serif" style="font-size:28px;font-weight:700">Exempelbygg AB</div>
      <div class="row2" style="margin-top:14px"><span>Bolagsform</span><b>Aktiebolag</b></div>
      <div class="row2"><span>Räkenskapsår</span><b>Kalenderår</b></div>
      <div class="row2"><span>Momsperiod</span><b>Kvartal</b></div>
    </div>
    <div class="pill" style="left:70px;top:372px;background:#e2553f;transform:rotate(-6deg)">Dag 1</div>
    <div class="pill" style="right:0;top:116px;background:#1f7a4a;transform:rotate(7deg)">${CHECK}Hämtat</div>
  </div>`,
};

function html({ eyebrow, title, items, motif, accent }) {
  // Lång rubrik: mindre text, så att den alltid får plats på tre rader.
  const size = title.length > 44 ? 50 : title.length > 30 ? 58 : 66;
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body { font-family: 'Inter', 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
.art { position: relative; width: 1200px; height: 630px; overflow: hidden; background: linear-gradient(135deg, #0a1912 0%, #0e2018 55%, #0c1c2a 100%); }
.blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.22; }
.b1 { width: 520px; height: 520px; left: -160px; top: -200px; background: #0ea5e9; }
.b2 { width: 560px; height: 560px; right: -180px; bottom: -260px; background: #84cc16; }
.b3 { width: 380px; height: 380px; right: 260px; top: -180px; background: #14b8a6; opacity: 0.16; }
.wm { position: absolute; left: 72px; top: 64px; height: 50px; width: auto; }
.left { position: absolute; left: 72px; top: 168px; width: 560px; }
.eyebrow { font-size: 17px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8fd99a; margin-bottom: 18px; }
h1 { font-family: Georgia, 'Times New Roman', serif; font-size: ${size}px; line-height: 1.08; font-weight: 700; color: #f2f6ef; letter-spacing: -0.01em; }
.site { position: absolute; left: 72px; bottom: 58px; font-size: 19px; font-weight: 600; color: rgba(242, 246, 239, 0.62); }
.card { position: absolute; right: 72px; top: 50%; transform: translateY(-50%); width: 430px; padding: 30px 30px 24px; border-radius: 26px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.13); box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.6); }
.row { display: flex; align-items: center; gap: 15px; padding: 15px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 21px; font-weight: 600; color: #eef3ea; line-height: 1.25; }
.row:first-child { border-top: 0; padding-top: 4px; }
${motif ? MOTIF_CSS + motifStyle(accent) : ''}
.row i { flex: none; width: 30px; height: 30px; border-radius: 50%; background: rgba(132, 204, 22, 0.18) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.5 12.5l3.6 3.6 7.4-8' fill='none' stroke='%239be37a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/70% no-repeat; }
</style></head><body><div class="art">
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<svg class="wm" viewBox="0 0 125 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0ea5e9"/><stop offset="50%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#84cc16"/></linearGradient></defs><path d="${wordmarkPath}" fill="url(#g)"/></svg>
<div class="left"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${motif ? `<div class="chips">${items.map(it => `<span><i></i>${esc(it)}</span>`).join('')}</div>` : ''}</div>
<div class="site">www.bokix.se</div>
${motif ? MOTIFS[motif] : `<div class="card">${items.map(it => `<div class="row"><i></i>${esc(it)}</div>`).join('')}</div>`}
</div></body></html>`;
}

const only = process.argv[2];
const entries = Object.entries(OG_PAGES).filter(([p]) => !only || p === only);
if (!entries.length) throw new Error(`Ingen sida i ogImages.js matchar ${only}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const tmp = path.join(outDir, '.tmp-og.html');
for (const [p, cfg] of entries) {
  fs.writeFileSync(tmp, html(cfg));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Rubriken får inte gå utanför sin yta: krymp tills den ryms.
  await page.evaluate(() => {
    const h = document.querySelector('h1');
    let size = parseFloat(getComputedStyle(h).fontSize);
    const chips = document.querySelector('.chips');
    const limit = chips ? 540 - chips.getBoundingClientRect().height - 26 : 520;
    while (h.getBoundingClientRect().bottom > limit && size > 34) { size -= 2; h.style.fontSize = size + 'px'; }
  });
  const out = path.join(outDir, `${cfg.file}.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
  console.log('OK', p, '->', path.relative(root, out), Math.round(fs.statSync(out).size / 1024) + ' kB');
}
fs.unlinkSync(tmp);
await browser.close();
