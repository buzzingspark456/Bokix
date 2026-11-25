// Riktiga kvitton genom riktiga Google Vision, som appen läser dem (api/_vision.js):
// EU-ändpunkten, DOCUMENT_TEXT_DETECTION, svenska och engelska. Svaren sparas
// per fil i <mapp>/.vision/, så att varje bild bara läses (och betalas) en gång.
// Tolkningen och jämförelsen med facit görs sedan av ocr-google-eval.test.js.
//
// Kör: node scripts/ocr-google-eval.mjs <mapp med bilder/PDF:er> [max antal]
// Kräver GOOGLE_VISION_API_KEY i .env.produktion (en egen nyckel för prov,
// begränsad till Cloud Vision API).
import fs from 'node:fs';
import path from 'node:path';
import { visionLines } from '../api/_visionLayout.js';

const [dir, maxArg] = process.argv.slice(2);
if (!dir) { console.error('Ange en mapp.'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(process.env.ENV_FILE || '.env.produktion', 'utf8').split(/\r?\n/)
  .map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const key = env.GOOGLE_VISION_API_KEY;
if (!key) { console.error('GOOGLE_VISION_API_KEY saknas i .env.produktion.'); process.exit(1); }

const cacheDir = path.join(dir, process.env.VISION_CACHE || '.vision');
fs.mkdirSync(cacheDir, { recursive: true });
const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp|pdf)$/i.test(f)).sort().slice(0, Number(maxArg) || Infinity);

let read = 0; let cached = 0; let failed = 0;
for (const file of files) {
  const out = path.join(cacheDir, `${file}.json`);
  if (fs.existsSync(out)) { cached++; continue; }
  const content = fs.readFileSync(path.join(dir, file)).toString('base64');
  const isPdf = /\.pdf$/i.test(file);
  const features = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
  const imageContext = { languageHints: ['sv', 'en'] };
  const request = isPdf
    ? { inputConfig: { content, mimeType: 'application/pdf' }, features, imageContext, pages: [1] }
    : { image: { content }, features, imageContext };
  const url = `https://eu-vision.googleapis.com/v1/${isPdf ? 'files' : 'images'}:annotate?key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [request] }) });
    const payload = await res.json();
    const result = isPdf ? (payload?.responses?.[0]?.responses?.[0] || payload?.responses?.[0]) : payload?.responses?.[0];
    if (!res.ok || result?.error) { failed++; console.log(`${file}: fel ${res.status} ${(result?.error || payload?.error)?.message || ''}`.slice(0, 160)); continue; }
    fs.writeFileSync(out, JSON.stringify({ text: result?.fullTextAnnotation?.text || '', lines: visionLines(result?.fullTextAnnotation) }));
    read++;
  } catch (err) {
    failed++;
    console.log(`${file}: ${err.message}`);
  }
}
console.log(`lästa nu ${read}, från tidigare ${cached}, fel ${failed}, av ${files.length}`);
