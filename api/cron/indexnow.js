// IndexNow varje morgon (vercel.json crons, 2026-11-24). Läser den skarpa
// sitemapen och anmäler sidorna vars lastmod är från i går eller i dag till
// IndexNow, som delar dem med Bing (och därmed ChatGPT och Copilot), Yandex,
// Seznam och Naver. lastmod ändras bara när sidans innehåll eller bilder
// ändras (scripts/prerender.mjs, page-dates.json), så bara nya och ändrade
// sidor skickas. Google använder inte IndexNow: där gäller sitemapen, som
// Google läser själv. Manuellt: npm run indexnow (scripts/indexnow.mjs).
import crypto from 'crypto';
import { applySecurityHeaders } from '../_security.js';
import { withSentry } from '../_sentry.js';

const HOST = 'www.bokix.se';
const KEY = 'dcc50bb016a64035aa799624206220a6';
const SITE = `https://${HOST}`;

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(String(req.headers['authorization'] || ''));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Sidorna i sitemapen med lastmod på eller efter `since` (YYYY-MM-DD). */
export function changedSince(xml, since) {
  const out = [];
  for (const [, block] of String(xml || '').matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (loc && lastmod && lastmod.slice(0, 10) >= since && loc.startsWith(SITE)) out.push(loc);
  }
  return [...new Set(out)];
}

async function handler(req, res) {
  applySecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const urls = changedSince(xml, since);
  if (!urls.length) {
    res.status(200).json({ sent: 0, since });
    return;
  }
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
  });
  console.log(`[indexnow] ${r.status} ${urls.length} adresser sedan ${since}`);
  res.status(200).json({ sent: urls.length, status: r.status, since });
}

export default withSentry(handler);
