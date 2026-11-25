#!/usr/bin/env node
// Produktsidornas bilder ur appen (public/product/bokix-<namn>.jpg och bokix-<namn>-mork.jpg).
//
// Inte ritade kopior: vyerna tas ur startsidans demo, som kör appens riktiga
// komponenter med exempelföretaget. Dubbel upplösning, ljust och mörkt läge.
// Ramen (fönstret) ritas av sidan (ProductShot i marketing/productKit.jsx), så
// bilden är bara själva appen. Ändras appen: kör skriptet igen.
//
// Kör med `npm run dev` igång:
//   node scripts/capture-product-shots.mjs [namn,namn,prefix*]
import { chromium } from 'playwright';
import fs from 'node:fs';

const DEV_URL = process.env.CAPTURE_URL || 'http://localhost:5173/';
const OUT_DIR = 'public/product';
fs.mkdirSync(OUT_DIR, { recursive: true });

// Varje bild: stegen i demot (nav = sidomenyn, tab = flik, click = text), och
// valfritt `crop` = CSS-väljare för ett utsnitt i stället för hela appen och
// `org` = annan bolagsform än exempelbolaget (se ORGS).
export const SHOTS = [
  { name: 'start', steps: [['nav', 'Start']] },
  { name: 'kundfakturor', steps: [['nav', 'Kundfakturor']] },
  { name: 'kvitton', steps: [['nav', 'Kvitton']] },
  { name: 'bank', steps: [['nav', 'Bank']] },
  { name: 'bokforing', steps: [['nav', 'Bokföring']] },
  { name: 'lon', steps: [['nav', 'Anställda och lön']] },
  { name: 'lonekorningar', steps: [['nav', 'Anställda och lön'], ['tab', 'Lönekörningar']] },
  { name: 'skatt', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Översikt']] },
  { name: 'moms', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Moms']] },
  { name: 'bokslut', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut']] },
  { name: 'rapporter', steps: [['nav', 'Rapporter']] },
  { name: 'resultatrakning', steps: [['nav', 'Rapporter'], ['click', 'Resultaträkning']] },
  { name: 'kunder', steps: [['nav', 'Kunder']] },
  { name: 'offerter', steps: [['nav', 'Offerter']] },
  { name: 'artiklar', steps: [['nav', 'Artiklar och lager']] },
  { name: 'leverantorsfakturor', steps: [['nav', 'Leverantörsfakturor']] },
  { name: 'lonekorning-ny', steps: [['nav', 'Anställda och lön'], ['tab', 'Lönekörningar'], ['click', 'Ny lönekörning']] },
  { name: 'arsredovisning', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '2. Årsredovisning']] },
  { name: 'utdelning', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '3. Utdelning']] },
  { name: 'ink2', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '4. Inkomstdeklaration 2']] },
  { name: 'lager', org: 'butik', steps: [['nav', 'Artiklar och lager'], ['tab', 'Lager']] },
  { name: 'prissattning', org: 'butik', steps: [['nav', 'Artiklar och lager'], ['tab', 'Prissättning']] },
  { name: 'artiklar-butik', org: 'butik', steps: [['nav', 'Artiklar och lager']] },
  { name: 'ny-faktura', steps: [['nav', 'Kundfakturor'], ['click', 'Skapa faktura']] },
  { name: 'faktura', steps: [['nav', 'Kundfakturor'], ['click', '1010'], ['click', 'Förhandsgranska']] },
  { name: 'granska', steps: [['nav', 'Att granska']] },
  { name: 'projekt', steps: [['nav', 'Projekt och tid']] },
  { name: 'anstalld', steps: [['nav', 'Anställda och lön'], ['click', 'Johanna Exempel']] },
  { name: 'semester', steps: [['nav', 'Anställda och lön'], ['tab', 'Semester']] },
  { name: 'ef-ne', org: 'ef', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '2. NE-bilaga']] },
  { name: 'ef-skatt', org: 'ef', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Översikt']] },
  { name: 'hb-delagare', org: 'hb', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '2. Delägare']] },
  { name: 'hb-ink4', org: 'hb', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '3. Inkomstdeklaration 4']] },
  { name: 'hb-skatt', org: 'hb', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Översikt']] },
  { name: 'ek-aterbaring', org: 'ek', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '3. Återbäring']] },
  { name: 'ek-arsredovisning', org: 'ek', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '2. Årsredovisning']] },
  { name: 'ek-skatt', org: 'ek', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Översikt']] },
  { name: 'ideell-ink3', org: 'ideell', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Bokslut'], ['click', '2. Inkomstdeklaration 3']] },
  { name: 'ideell-skatt', org: 'ideell', steps: [['nav', 'Skatt och bokslut'], ['tab', 'Översikt']] },
];

// Dessa sparas också som utsnitt utan sidomenyn (<namn>-c.jpg), till
// funktionsblocken där bilden är mindre och menyn bara tar plats.
const ALSO_CONTENT = new Set(['start', 'granska', 'projekt', 'kunder', 'offerter', 'leverantorsfakturor', 'lon', 'rapporter', 'anstalld', 'semester', 'lager', 'prissattning', 'artiklar-butik', 'ny-faktura', 'faktura', 'ef-ne', 'ef-skatt', 'hb-delagare', 'hb-ink4', 'hb-skatt', 'ek-aterbaring', 'ek-arsredovisning', 'ek-skatt', 'ideell-ink3', 'ideell-skatt', 'lonekorning-ny', 'kundfakturor', 'kvitton', 'lonekorningar', 'moms', 'bokslut', 'arsredovisning', 'utdelning', 'ink2', 'resultatrakning', 'skatt', 'bank', 'bokforing']);

// Andra bolagsformer: demot läser bolagsformen ur org.nr. Uppdiktade nummer.
export const ORGS = {
  ef: { name: 'Exempel Konsult', orgNr: '850315-1234', vatNr: 'SE850315123401' },
  hb: { name: 'Exempel HB', orgNr: '969999-1234', vatNr: 'SE969999123401', partners: [
    { id: 'demo_p1', name: 'Anna Exempel', personnummer: '19850315-1234', sharePct: 50 },
    { id: 'demo_p2', name: 'Erik Exempel', personnummer: '19870621-5678', sharePct: 50 },
  ] },
  ek: { name: 'Exempel ek. för.', orgNr: '769999-1234', vatNr: 'SE769999123401' },
  ideell: { name: 'Exempelföreningen', orgNr: '802999-1234', vatNr: '' },
  // Ett litet lager till sidan om lager (artiklar, inleveranser och försäljning).
  butik: { __articles: [
    { id: 'b1', type: 'vara', articleNumber: 'M-10', description: 'Keramikmugg, grå', descriptionEn: '', unitPrice: 189, purchasePrice: 62, unit: 'st', vatRate: 25, account: '3001', ean: '', rotRut: 'none', notes: '' },
    { id: 'b2', type: 'vara', articleNumber: 'L-20', description: 'Linneduk, natur', descriptionEn: '', unitPrice: 449, purchasePrice: 155, unit: 'st', vatRate: 25, account: '3001', ean: '', rotRut: 'none', notes: '' },
    { id: 'b3', type: 'vara', articleNumber: 'D-30', description: 'Doftljus, fikon', descriptionEn: '', unitPrice: 259, purchasePrice: 88, unit: 'st', vatRate: 25, account: '3001', ean: '', rotRut: 'none', notes: '' },
    { id: 'b4', type: 'vara', articleNumber: 'T-40', description: 'Tekanna, glas', descriptionEn: '', unitPrice: 399, purchasePrice: 171, unit: 'st', vatRate: 25, account: '3001', ean: '', rotRut: 'none', notes: '' },
    { id: 'b5', type: 'vara', articleNumber: 'S-50', description: 'Serveringsfat, ek', descriptionEn: '', unitPrice: 549, purchasePrice: 240, unit: 'st', vatRate: 25, account: '3001', ean: '', rotRut: 'none', notes: '' },
  ], inventorySettings: { method: 'fifo', accountKind: 'handelsvaror', lowestValue: true, reorderPoints: { b3: 20 } }, stockMovements: [
    { id: 'm1', articleId: 'b1', type: 'in', qty: 120, unitCost: 58, date: '2026-03-02', note: '' }, { id: 'm2', articleId: 'b1', type: 'in', qty: 80, unitCost: 62, date: '2026-08-14', note: '' }, { id: 'm3', articleId: 'b1', type: 'out', qty: 96, date: '2026-10-20', note: '' },
    { id: 'm4', articleId: 'b2', type: 'in', qty: 60, unitCost: 155, date: '2026-04-10', note: '' }, { id: 'm5', articleId: 'b2', type: 'out', qty: 22, date: '2026-10-02', note: '' },
    { id: 'm6', articleId: 'b3', type: 'in', qty: 150, unitCost: 88, date: '2026-02-18', note: '' }, { id: 'm7', articleId: 'b3', type: 'out', qty: 138, date: '2026-10-28', note: '' },
    { id: 'm8', articleId: 'b4', type: 'in', qty: 40, unitCost: 171, date: '2026-05-06', note: '' }, { id: 'm9', articleId: 'b4', type: 'out', qty: 11, date: '2026-09-30', note: '' },
    { id: 'm10', articleId: 'b5', type: 'in', qty: 30, unitCost: 240, date: '2026-06-12', note: '' }, { id: 'm11', articleId: 'b5', type: 'out', qty: 9, date: '2026-10-11', note: '' },
  ] },
};

const only = process.argv[2];

// Hela appen tas i ett 1440x900-fönster. Utsnitten (-c) tas i ett smalare
// fönster, så att texten blir större när bilden visas i halv sidbredd, och
// skärs till 16:11 från överkanten.
const MODES = [
  { kind: 'full', viewport: { width: 1440, height: 900 } },
  { kind: 'content', viewport: { width: 1180, height: 860 } },
  // Telefon (<namn>-mobil.jpg), för sidor som visar appen i en telefon.
  { kind: 'phone', viewport: { width: 390, height: 844 }, scale: 3 },
  // Breda rutor på Funktioner (<namn>-t.jpg): smalare fönster, så att texten
  // visas i nästan full storlek.
  { kind: 'tile', viewport: { width: 1000, height: 760 }, scale: 2 },
];
const TILE = new Set(['kundfakturor', 'ink2']);
const PHONE = new Set(['kvitton', 'kundfakturor', 'granska', 'moms', 'lonekorning-ny', 'rapporter']);

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  for (const mode of MODES) {
    const ctx = await browser.newContext({ viewport: mode.viewport, deviceScaleFactor: mode.scale || 2, colorScheme: theme, ...(mode.kind === 'phone' ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.addInitScript((t) => { localStorage.setItem('bokix_theme_pref', t); localStorage.setItem('bokix_mkt_theme', t); }, theme);
    await ctx.addInitScript(() => {
      const m = location.search.match(/demoCompany=([^&]+)/);
      if (m) window.__bokixDemoCompany = JSON.parse(decodeURIComponent(m[1]));
    });
    await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: DEV_URL }]);
    const page = await ctx.newPage();
    const list = SHOTS.filter(s => (!only || only.split(',').some(o => s.name === o || (o.endsWith('*') && s.name.startsWith(o.slice(0, -1))))) && (mode.kind === 'full' || ({ content: ALSO_CONTENT, phone: PHONE, tile: TILE })[mode.kind].has(s.name)));
    for (const shot of list) {
      try {
        // Nytt demo för varje bild, så att inget från förra vyn ligger kvar.
        await page.goto(DEV_URL + (shot.org ? '?demoCompany=' + encodeURIComponent(JSON.stringify(ORGS[shot.org])) : ''), { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: /testa på riktigt|demo/i }).first().click({ timeout: 10000 });
        const panel = page.locator('.lp-demo-overlay-panel');
        const body = page.locator('.lp-demo-body');
        await body.waitFor({ timeout: 10000 });
        await page.waitForTimeout(1500);
        for (const [kind, text] of shot.steps) {
          if (kind === 'nav' && mode.kind === 'phone') {
            // Telefon: nedre menyraden, annars Meny och sedan sidan i arket.
            const bottom = panel.locator('.mobile-bottom-nav .mobile-nav-btn').filter({ hasText: new RegExp('^(' + text + '|' + text.replace(/er$/, '') + ')$') });
            if (await bottom.count()) await bottom.first().click({ timeout: 5000 });
            else {
              await panel.locator('.mobile-bottom-nav .mobile-nav-btn').filter({ hasText: 'Meny' }).first().click({ timeout: 5000 });
              await page.waitForTimeout(500);
              await panel.locator('.mobile-sheet').getByText(text, { exact: true }).first().click({ timeout: 5000 });
            }
          } else if (kind === 'nav') await panel.getByText(text, { exact: true }).first().click({ timeout: 5000 });
          else if (kind === 'tab') await panel.locator('button, [role=tab]').filter({ hasText: new RegExp('^' + text) }).first().click({ timeout: 5000 });
          else await panel.getByText(text, { exact: true }).first().click({ timeout: 5000 });
          await page.waitForTimeout(1500);
        }
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
        const dark = theme === 'dark' ? '-mork' : '';
        if (mode.kind === 'full') {
          const file = `${OUT_DIR}/bokix-${shot.name}${dark}.jpg`;
          await body.screenshot({ path: file, type: 'jpeg', quality: 84 });
          console.log('✓', file, Math.round(fs.statSync(file).size / 1024) + ' kB');
        } else if (mode.kind === 'phone') {
          const file = `${OUT_DIR}/bokix-${shot.name}-mobil${dark}.jpg`;
          const box = await body.boundingBox();
          const vp = page.viewportSize();
          await page.screenshot({ path: file, type: 'jpeg', quality: 84, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, vp.height - box.y) } });
          console.log('✓', file);
        } else {
          const box = await panel.locator('.lp-demo-content').first().boundingBox();
          const height = Math.min(box.height, Math.round(box.width * 11 / 16));
          const file = `${OUT_DIR}/bokix-${shot.name}-${mode.kind === 'tile' ? 't' : 'c'}${dark}.jpg`;
          await page.screenshot({ path: file, type: 'jpeg', quality: 84, clip: { x: box.x, y: box.y, width: box.width, height } });
          console.log('✓', file, Math.round(box.width * 2) + 'x' + height * 2);
        }
      } catch (err) {
        console.warn('✗', theme, mode.kind, shot.name, err.message.split(String.fromCharCode(10))[0]);
      }
    }
    await ctx.close();
  }
}
await browser.close();
