// Omslagsbilder till videoguiderna (public/videos/<slug>.jpg och -dark.jpg).
// Förut var omslaget filmens sista bildruta: hårt komprimerad, med muspekare
// och notis, och därför suddig. Nu en egen bild per film: titel, grupp och
// längd i skarp text, och en bildruta ur filmen i ett appfönster bredvid.
// Samma fil används som affisch på /guider/<slug>, som miniatyr på /guider,
// som delningsbild och i sitemapens video:thumbnail_loc.
//
// Kör: npx vite --port 5199 (sajtens typsnitt och ordmärke hämtas därifrån),
// sedan node scripts/render-guide-posters.mjs [slug,slug]. Kräver ffmpeg:
// FFMPEG_PATH, annars GUIDE_TOOLS/node_modules/ffmpeg-static (se videoguider).
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GUIDE_GROUPS } from '../src/content/marketing/guides.js';

const BASE = process.env.BASE || 'http://localhost:5199';
const VIDEO_DIR = path.resolve('public/videos');
const TOOLS = process.env.GUIDE_TOOLS || 'C:/tmp/guide-tools';
const FFMPEG = process.env.FFMPEG_PATH || path.join(TOOLS, 'node_modules/ffmpeg-static/ffmpeg.exe');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const W = 1600, H = 940; // samma format som filmerna, så affischen fyller spelaren

const guides = GUIDE_GROUPS.flatMap(g => g.guides.map(guide => ({ ...guide, group: g.title })))
  .filter(g => !only || only.includes(g.slug));

const seconds = (iso) => {
  const m = iso.match(/^PT(?:(\d+)M)?(?:(\d+)S)?$/);
  return m ? Number(m[1] || 0) * 60 + Number(m[2] || 0) : 0;
};
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// En bildruta mitt i filmen (före Klart-notisen i slutet), i bästa kvalitet.
function frame(file, at) {
  const out = path.join(os.tmpdir(), `poster-${path.basename(file, '.mp4')}.png`);
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(at), '-i', file, '-vf', 'crop=1180:820:236:0', '-frames:v', '1', out]);
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`ffmpeg misslyckades för ${file}`);
  return `data:image/png;base64,${fs.readFileSync(out).toString('base64')}`;
}

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  await ctx.addInitScript((t) => { try { localStorage.setItem('bokix_theme_pref', t); } catch { /* ingen lagring */ } }, theme);
  const page = await ctx.newPage();
  for (const g of guides) {
    const file = theme === 'dark' ? `${g.slug}-dark` : g.slug;
    const mp4 = path.join(VIDEO_DIR, `${file}.mp4`);
    const len = seconds(g.duration);
    // Kundguiden: 62 % hamnar mitt i ett tomt fält, 84 % visar ifylld adress och org.nr.
    const img = frame(mp4, Math.max(1, Math.round(len * (g.slug === 'lagg-upp-kund' ? 0.84 : 0.62))));
    await page.goto(`${BASE}/guider`, { waitUntil: 'networkidle' });
    await page.evaluate(({ g, img, theme, clockText }) => {
      const mark = document.querySelector('svg[aria-label="Bokix"]')?.outerHTML || '';
      const dark = theme === 'dark';
      document.body.innerHTML = `
        <style>
          html, body { margin: 0; }
          .gp { width: 1600px; height: 940px; box-sizing: border-box; position: relative; overflow: hidden; display: grid; grid-template-columns: 560px 1fr; align-items: center; gap: 56px; padding: 0 0 0 96px;
            background: ${dark ? 'radial-gradient(1200px 700px at 85% 10%, #1d3a24 0%, #0f1a13 60%)' : 'radial-gradient(1200px 700px at 85% 10%, #e3f2df 0%, #ffffff 62%)'}; color: ${dark ? '#eef3ea' : '#1c2420'}; }
          .gp-mark svg { height: 54px; width: auto; display: block; }
          .gp-group { margin-top: 64px; font-size: 21px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${dark ? '#8fd67a' : '#0b6329'}; }
          .gp-title { margin: 14px 0 0; font-size: 72px; max-width: 560px; line-height: 1.04; font-weight: 800; letter-spacing: -0.035em; }
          .gp-lead { margin: 22px 0 0; font-size: 28px; line-height: 1.4; color: ${dark ? '#c7d3c4' : '#475049'}; }
          .gp-meta { margin-top: 44px; display: flex; align-items: center; gap: 18px; font-size: 24px; font-weight: 700; }
          .gp-play { width: 76px; height: 76px; border-radius: 50%; background: #0b6329; display: grid; place-items: center; box-shadow: 0 14px 30px -12px rgba(11,99,41,0.7); }
          .gp-play svg { width: 30px; height: 30px; margin-left: 5px; }
          .gp-shot { justify-self: end; width: 888px; border-radius: 18px 0 0 18px; overflow: hidden; border: 1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}; border-right: none;
            box-shadow: 0 40px 90px -30px rgba(0,0,0,${dark ? 0.7 : 0.35}); background: ${dark ? '#101913' : '#fff'}; }
          .gp-bar { height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 16px; background: ${dark ? '#17241b' : '#f3f4f2'}; border-bottom: 1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}; }
          .gp-bar i { width: 11px; height: 11px; border-radius: 50%; background: ${dark ? '#3a4a3e' : '#d6dad5'}; }
          .gp-shot img { display: block; width: 1180px; max-width: none; height: auto; }
        </style>
        <div class="gp">
          <div>
            <div class="gp-mark">${mark}</div>
            <div class="gp-group">Videoguide · ${g.group}</div>
            <h1 class="gp-title">${g.title}</h1>
            <p class="gp-lead">${g.lead}</p>
            <div class="gp-meta">
              <span class="gp-play"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" fill="#fff"/></svg></span>
              <span>${clockText}</span>
            </div>
          </div>
          <div class="gp-shot"><div class="gp-bar"><i></i><i></i><i></i></div><img src="${img}" alt=""></div>
        </div>`;
    }, { g, img, theme, clockText: clock(len) });
    await page.evaluate(() => {
      const t = document.querySelector('.gp-title');
      let size = 72;
      while (size > 44 && (t.scrollWidth > t.clientWidth || t.getBoundingClientRect().height > size * 1.04 * 3 + 2)) { size -= 2; t.style.fontSize = size + 'px'; }
    });
    await page.waitForFunction(() => [...document.images].every(i => i.complete));
    await page.waitForTimeout(150);
    const out = path.join(VIDEO_DIR, `${file}.jpg`);
    await page.locator('.gp').screenshot({ path: out, type: 'jpeg', quality: 88 });
    console.log('✓', path.relative(process.cwd(), out));
  }
  await ctx.close();
}
await browser.close();
