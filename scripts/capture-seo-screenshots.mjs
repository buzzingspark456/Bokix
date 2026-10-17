#!/usr/bin/env node
// Tar en riktig skärmbild per del av appen (exempeldata i startsidans demo)
// som JPG i public/screenshots/. Bilderna visas som <img> på marknadssidorna
// (src/content/marketing/screenshots.js) så att Google bildsök har riktiga,
// unika bilder att indexera, en eller flera per sida.
//
// Kör manuellt med `npm run dev` igång: node scripts/capture-seo-screenshots.mjs
// Ta om bilderna när appens utseende ändrats märkbart.
import { chromium } from 'playwright';
import fs from 'node:fs';

const DEV_URL = process.env.CAPTURE_URL || 'http://localhost:5173/';
const OUT_DIR = 'public/screenshots';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript(() => localStorage.setItem('bokix_theme_pref', 'light'));
const page = await context.newPage();
await page.goto(DEV_URL, { waitUntil: 'networkidle' });
try { await page.getByRole('button', { name: /Endast nödvändiga/ }).click({ timeout: 5000 }); } catch { /* ingen cookie-ruta */ }
await page.getByRole('button', { name: /testa på riktigt|demo/i }).first().click({ timeout: 10000 });
const body = page.locator('.lp-demo-overlay-body');
await body.waitFor({ timeout: 10000 });
await page.waitForTimeout(2000);
const panel = page.locator('.lp-demo-overlay-panel');

async function nav(text) {
  await panel.getByText(text, { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
}
async function tab(text) {
  // Flikarna har en räknare efter namnet, t.ex. 'Stripe · 3'.
  await panel.locator('button, [role=tab]').filter({ hasText: new RegExp('^' + text) }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1300);
}
async function shot(file) {
  await body.screenshot({ path: `${OUT_DIR}/${file}`, type: 'jpeg', quality: 80 });
  console.log('✓', file, Math.round(fs.statSync(`${OUT_DIR}/${file}`).size / 1024) + ' kB');
}
async function attempt(label, fn) {
  try { await fn(); } catch (err) { console.warn('✗', label, err.message.split('\n')[0]); }
}

await attempt('start', async () => { await nav('Start'); await shot('bokix-startsida-oversikt.jpg'); });
await attempt('granskning', async () => { await nav('Granskning'); await shot('bokix-granskning-kvitton.jpg'); });
await attempt('stripe', async () => { await nav('Granskning'); await tab('Stripe'); await shot('bokix-granskning-stripe.jpg'); });
await attempt('zettle', async () => { await tab('Zettle'); await shot('bokix-granskning-zettle.jpg'); });
await attempt('kunder', async () => { await nav('Kunder'); await shot('bokix-kunder.jpg'); });
await attempt('artiklar', async () => { await nav('Artiklar'); await shot('bokix-artiklar-lager.jpg'); });
await attempt('offerter', async () => { await nav('Offerter'); await shot('bokix-offerter.jpg'); });
await attempt('kundfakturor', async () => { await nav('Kundfakturor'); await shot('bokix-kundfakturor.jpg'); });
await attempt('kvitton', async () => { await nav('Kvitton'); await shot('bokix-kvitton.jpg'); });
await attempt('leverantorsfakturor', async () => { await nav('Leverantörsfakturor'); await shot('bokix-leverantorsfakturor.jpg'); });
await attempt('bank', async () => { await nav('Bank'); await shot('bokix-bank-kontoutdrag.jpg'); });
await attempt('bokforing', async () => { await nav('Bokföring'); await shot('bokix-bokforing-verifikationer.jpg'); });
await attempt('rapporter', async () => { await nav('Rapport och analys'); await shot('bokix-rapporter-resultat.jpg'); });
await attempt('skatt', async () => { await nav('Skatt och bokslut'); await shot('bokix-skatt-och-bokslut.jpg'); });
await attempt('moms', async () => { await tab('Moms'); await shot('bokix-momsdeklaration.jpg'); });
await attempt('projekt', async () => { await nav('Projekt'); await shot('bokix-projekt.jpg'); });
await attempt('lon', async () => { await nav('Anställda och lön'); await shot('bokix-anstallda-och-lon.jpg'); });
await attempt('sakerhet', async () => { await nav('Inställningar'); await nav('Säkerhet'); await shot('bokix-sakerhet-inloggning.jpg'); });
await attempt('installningar', async () => { await nav('Inställningar'); await nav('Import och export'); await shot('bokix-installningar.jpg'); });

await browser.close();
