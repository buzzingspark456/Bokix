#!/usr/bin/env node
// Bloggens bilder ur appen (public/blog/app/<namn>.jpg och <namn>-mork.jpg).
// Inte råa skärmdumpar: vyn ur startsidans demo (exempeldata) tas skarpt,
// läggs som ett helt appfönster med en enkel titelrad på en
// lugn bakgrund, i ljust och mörkt läge. Blogginlägget visar den som hör
// till besökarens tema ({ t: 'image', shot } i blog.js, BlogPostPage.jsx).
//
// Kör med `npm run dev` igång: node scripts/render-blog-shots.mjs [namn]
import { chromium } from 'playwright';
import fs from 'node:fs';

const DEV_URL = process.env.CAPTURE_URL || 'http://localhost:5173/';
const OUT_DIR = 'public/blog/app';
fs.mkdirSync(OUT_DIR, { recursive: true });

// Samma lista som BLOG_SHOTS i src/content/marketing/blogShots.js.
const SHOTS = [
  { name: 'startsida', steps: [['nav', 'Start']] },
  { name: 'stripe', steps: [['nav', 'Granskning'], ['tab', 'Stripe']] },
  { name: 'moms', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Översikt']] },
  { name: 'kvitton', steps: [['nav', 'Kvitton']] },
];

const only = process.argv[2];
const VIEW_W = 1280;
const VIEW_H = 800;
const WIN_W = 1440;
const BAR_H = 40;
const PAD = 80;
const OUT_W = WIN_W + PAD * 2;
const OUT_H = Math.round(VIEW_H * WIN_W / VIEW_W) + BAR_H + PAD * 2;

const THEMES = {
  light: { bar: '#eceee9', dot: '#c9ccc5', bg: 'linear-gradient(160deg, #eef3ee 0%, #f6f7f4 55%, #eef1ec 100%)', border: 'rgba(20,40,28,0.10)', shadow: '0 40px 80px -36px rgba(20,40,28,0.35), 0 8px 24px -12px rgba(20,40,28,0.18)' },
  dark: { bar: '#1d2320', dot: '#3a413d', bg: 'linear-gradient(160deg, #142019 0%, #0f1412 55%, #121815 100%)', border: 'rgba(255,255,255,0.10)', shadow: '0 40px 80px -36px rgba(0,0,0,0.8), 0 8px 24px -12px rgba(0,0,0,0.5)' },
};

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 2, colorScheme: theme });
  await ctx.addInitScript((t) => localStorage.setItem('bokix_theme_pref', t), theme);
  const page = await ctx.newPage();
  await page.goto(DEV_URL, { waitUntil: 'networkidle' });
  try { await page.getByRole('button', { name: /Endast nödvändiga/ }).click({ timeout: 4000 }); } catch { /* ingen cookie-ruta */ }
  await page.getByRole('button', { name: /testa på riktigt|demo/i }).first().click({ timeout: 10000 });
  const panel = page.locator('.lp-demo-overlay-panel');
  const content = page.locator('.lp-demo-body');
  await content.waitFor({ timeout: 10000 });
  await page.waitForTimeout(2000);

  const frame = await browser.newPage({ viewport: { width: OUT_W, height: OUT_H }, deviceScaleFactor: 1 });
  for (const shot of SHOTS.filter(s => !only || s.name === only)) {
    try {
      for (const [kind, text] of shot.steps) {
        if (kind === 'nav') await panel.getByText(text, { exact: true }).first().click({ timeout: 5000 });
        // Flikarna har en räknare efter namnet, t.ex. 'Stripe · 3'.
        else await panel.locator('button, [role=tab]').filter({ hasText: new RegExp('^' + text) }).first().click({ timeout: 5000 });
        await page.waitForTimeout(1400);
      }
      await page.mouse.move(0, 0);
      const png = await content.screenshot({ type: 'png' });
      const t = THEMES[theme];
      await frame.setContent(`<!doctype html><html><body style="margin:0;width:${OUT_W}px;height:${OUT_H}px;background:${t.bg};display:flex;align-items:center;justify-content:center;overflow:hidden">
        <div style="width:${WIN_W}px;border-radius:16px;overflow:hidden;border:1px solid ${t.border};box-shadow:${t.shadow}">
          <div style="height:${BAR_H}px;background:${t.bar};display:flex;align-items:center;gap:8px;padding:0 18px">${('<span style="width:12px;height:12px;border-radius:50%;background:' + t.dot + '"></span>').repeat(3)}</div>
          <img src="data:image/png;base64,${png.toString('base64')}" style="width:100%;height:auto;display:block">
        </div>
      </body></html>`);
      await frame.waitForTimeout(200);
      const file = `${OUT_DIR}/${shot.name}${theme === 'dark' ? '-mork' : ''}.jpg`;
      await frame.screenshot({ path: file, type: 'jpeg', quality: 86 });
      console.log('✓', file, Math.round(fs.statSync(file).size / 1024) + ' kB');
    } catch (err) {
      console.warn('✗', theme, shot.name, err.message.split('\n')[0]);
    }
  }
  await frame.close();
  await ctx.close();
}
await browser.close();
