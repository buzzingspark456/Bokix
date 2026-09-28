#!/usr/bin/env node
// ── Skickar bokix.se:s sidor till IndexNow ──────────────────────────────
// IndexNow meddelar Bing (som ChatGPT och Copilot söker via), Yandex, Seznam
// m.fl. att sidor är nya eller ändrade, så att de läses in direkt i stället
// för vid nästa genomsökning. Nyckeln ligger i public/<nyckel>.txt och måste
// vara live innan skriptet körs, annars svarar IndexNow 403.
//
// Körs manuellt efter att en ändring är live på www.bokix.se:
//   npm run indexnow              alla sidor i den skarpa sitemapen
//   npm run indexnow -- /priser /nyheter/ny-nyhet   bara de sidorna
// Skicka inte samma sidor om och om igen utan ändring (429 = för ofta).

const HOST = 'www.bokix.se';
const KEY = 'dcc50bb016a64035aa799624206220a6';
const SITE = `https://${HOST}`;

const args = process.argv.slice(2);
let urls;
if (args.length) {
  urls = args.map(a => (a.startsWith('http') ? a : SITE + a));
} else {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}
if (!urls.length) {
  console.error('Inga adresser att skicka.');
  process.exit(1);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
});
const reason = { 200: 'mottaget', 202: 'mottaget, nyckeln kontrolleras', 400: 'fel format', 403: 'nyckeln hittades inte på sajten', 422: 'adresserna hör inte till värden', 429: 'för många anrop, vänta' }[res.status] || '';
console.log(`IndexNow: ${res.status} ${reason} (${urls.length} adresser)`);
if (res.status >= 300) process.exitCode = 1;
