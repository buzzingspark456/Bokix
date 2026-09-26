#!/usr/bin/env node
// ── Tar riktiga produktskärmbilder för marknadssidorna (public/screenshots/)
// — inte mockuper, den faktiska appen med exempeldata via startsidans
// klickbara produktdemo (DemoOverlay, se LandingPage.jsx). Bakgrund: Google
// bildsök hade praktiskt taget inget att indexera från bokix.se — sidorna
// visar produkten via handritade SVG-illustrationer (featureDemos.jsx/
// toolMotifs.jsx), aldrig en <img>, så flera högprioriterade sidor
// (/funktioner, /priser) hade tekniskt sett noll bilder. Konkurrenter
// (Fortnox, Bokio) är fulla av skärmdumpar.
//
// Körs manuellt, inte del av build: `node scripts/capture-marketing-screenshots.mjs`
// (kräver att `npm run dev` redan kör på localhost:5173). Skriv över filerna
// i public/screenshots/ och committa på vanligt sätt när appens UI ändras
// tillräckligt för att en skärmbild blir inaktuell.
import { chromium } from 'playwright';
import fs from 'node:fs';

const DEV_URL = 'http://localhost:5173/';
const OUT_DIR = 'public/screenshots';

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
// deviceScaleFactor 2 → skärpa på Retina-förhandsvisningar, samma princip
// som DEFAULT_OG_IMAGE i src/utils/seo.jsx.
const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 });
// Sajten öppnar i mörkt läge för nya besökare; bilderna ska börja i ljust.
await context.addInitScript(() => localStorage.setItem('bokix_theme_pref', 'light'));
const page = await context.newPage();

await page.goto(DEV_URL, { waitUntil: 'networkidle' });

// Cookie-dialogen ligger ovanpå "Se demo"-knappen tills den stängts.
try {
  const cookieDialog = page.getByRole('dialog', { name: /cookie/i });
  await cookieDialog.waitFor({ timeout: 5000 });
  await cookieDialog.getByRole('button', { name: /godkänn|acceptera|tillåt alla/i }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
} catch { /* ingen cookie-dialog denna körning */ }

await page.getByRole('button', { name: /testa på riktigt|demo/i }).first().click({ timeout: 10000 });
await page.waitForTimeout(1500);

// .lp-demo-overlay-body är RIKTIGA appen (App.jsx), utan overlay-chrome
// (titelrad/EXEMPELDATA-badge/stäng-knapp) och utan den suddiga bakgrunden
// — se DemoOverlay i LandingPage.jsx. En elementscreenshot här ger alltså
// en ren produktbild direkt, ingen efterhandsbeskärning behövs.
const body = page.locator('.lp-demo-overlay-body');
await body.waitFor({ timeout: 10000 });

const panel = page.locator('.lp-demo-overlay-panel');

async function nav(navText) {
  await panel.getByText(navText, { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1300);
}

async function shot(navText, filename) {
  if (navText) await nav(navText);
  await body.screenshot({ path: `${OUT_DIR}/${filename}` });
  console.log('✓', filename);
}

// Sidomenyns ordning (App.jsx) — lägg till fler rader här i takt med att
// fler marknadssidor får en skärmbild. Ljust läge (appens standard).
await shot(null, 'bokix-oversikt-dashboard.png');
await shot('Kundfakturor', 'bokix-fakturering-kundfakturor.png');
await shot('Kvitton', 'bokix-kvitton-hantering.png');
await shot('Bokföring', 'bokix-bokforing-verifikationer.png');
// Skatt och bokslut öppnar på Översikt; momsflödet ligger under fliken Moms.
await nav('Skatt och bokslut');
await panel.getByText('Moms', { exact: true }).first().click({ timeout: 5000 });
await page.waitForTimeout(1200);
await shot(null, 'bokix-skatt-momsdeklaration.png');
await shot('Anställda och lön', 'bokix-personal-anstallda.png');

// Bilderna nedan (mörkt läge, UF, Säkerhet) används inte på någon sida i
// dag. Misslyckas de stoppar det inte de viktiga bilderna ovan.
try {
  // Mörkt läge — samma vy, för sidor som ska variera mot en redan
  // ljust-läges-illustrerad sida (t.ex. /uf mot /funktioner). Månikonen i
  // appens egen topbar, inte marknadssidans (den ligger i .lp-demo-overlay-
  // panel, inte overlayens egen bar).
  await panel.locator('button[title*="mörk" i]:visible').first().click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await shot('Kvitton', 'bokix-kvitton-hantering-dark.png');
  await nav('Start'); // tillbaka till dashboarden innan UF-varianten

  // UF-varianten av dashboarden (/uf, "Så ser det ut inifrån") — döljer
  // Offerter/Projekt/Anställda och lön (blockerade för UF-konton, se
  // utils/ufMode.js:s isUfCompany()/UF_NAV_IDS) OCH hälsningsraden ("God
  // eftermiddag, Exempel"), rent visuellt i den redan renderade DOM:en.
  // INTE via en riktig isUf-flagga på demo-företaget: DemoWorkspace.jsx:s
  // sidomeny är en egen hårdkodad lista (inte isUfCompany()-filtrerad som
  // riktiga App.jsx), så en sådan flagga skulle inte ändra vad som visas här.
  await panel.evaluate((root) => {
    const navLabels = ['Offerter', 'Projekt', 'Anställda och lön'];
    for (const el of root.querySelectorAll('button, a')) {
      const span = el.querySelector(':scope > span:first-child, :scope > span');
      const text = (span ? span.textContent : el.textContent || '').trim();
      if (navLabels.includes(text)) el.style.display = 'none';
    }
  });
  const greeting = panel.locator('h1, h2').filter({ hasText: /^God (morgon|förmiddag|eftermiddag|kväll),/ }).first();
  if (await greeting.count() > 0) await greeting.evaluate((el) => { el.style.display = 'none'; });
  await page.waitForTimeout(300);
  await shot(null, 'bokix-oversikt-dashboard-uf-dark.png');

  // Tillbaka till ljust läge + Inställningar → Säkerhet (/sakerhet). Beskuren
  // (page.screenshot+clip, inte body.screenshot som auto-expanderar till hela
  // scrollhöjden) strax efter tvåfaktorsautentisering, FÖRE "Aktiva
  // sessioner" — den sektionen visar just nu ett "kräver ett riktigt konto"-
  // meddelande i demon, inte en funktion att visa upp på en marknadssida.
  await panel.locator('button[title*="ljust" i]:visible').first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await nav('Inställningar');
  await panel.getByText('Säkerhet', { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  {
    const box = await body.boundingBox();
    await page.screenshot({
      path: `${OUT_DIR}/bokix-installningar-sakerhet.png`,
      clip: { x: box.x, y: box.y, width: box.width, height: 740 },
    });
    console.log('✓ bokix-installningar-sakerhet.png');
  }

} catch (err) {
  console.warn('Hoppade över mörkt läge/UF/Säkerhet:', String(err.message).split(/\r?\n/)[0]);
}

await browser.close();
console.log('Klart.');
