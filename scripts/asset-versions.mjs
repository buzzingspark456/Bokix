#!/usr/bin/env node
// ── Versionslista för bilderna på webbplatsen (2026-11-24) ─────────────
// Google behåller sin kopia av en bildadress länge, så en skärmbild som byts
// med samma filnamn visades gammal i bildsök. Skriptet räknar ut 8 tecken av
// sha256 för varje bild under public/{product,og,blog,videos,screenshots} och
// skriver src/content/marketing/assetVersions.json. utils/assetUrl.js lägger
// på ?v=<version>, så en ändrad bild får en ny adress och hämtas på nytt.
// Körs först i "npm run build" (och går att köra för hand). Checka in filen.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const out = path.join(root, 'src/content/marketing/assetVersions.json');
const DIRS = ['product', 'og', 'blog', 'videos', 'screenshots'];
const IMAGE = /\.(?:jpe?g|png|webp|avif|gif)$/i;

const versions = {};
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (IMAGE.test(entry.name)) {
      const rel = '/' + path.relative(pub, full).split(path.sep).join('/');
      versions[rel] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 8);
    }
  }
}
DIRS.forEach(d => walk(path.join(pub, d)));
const sorted = Object.fromEntries(Object.keys(versions).sort().map(k => [k, versions[k]]));
const next = JSON.stringify(sorted, null, 0).replace(/,"/g, ',\n"').replace(/^\{/, '{\n').replace(/\}$/, '\n}') + '\n';
const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
if (prev !== next) {
  fs.writeFileSync(out, next);
  console.log(`✓ assetVersions.json (${Object.keys(sorted).length} bilder, uppdaterad)`);
} else {
  console.log(`✓ assetVersions.json (${Object.keys(sorted).length} bilder, oförändrad)`);
}
