/**
 * ocrReceipt.js — Snabb och tillförlitlig klient-side OCR och textextrahering.
 *
 * 1. Digitala PDF-fakturor (t.ex. Supabase, Stripe, Google, Telia, Kivra):
 *    Läses av direkt i webbläsaren med pdfjs-dist på ~50ms med 100% precision.
 * 2. Bildkvitton & foton (JPG, PNG, WEBP) samt skannade PDF:er:
 *    Läses av direkt i webbläsaren med Tesseract.js WebAssembly-motor
 *    i en Web Worker med realtidsframsteg (0-100%).
 * 3. Smart fältextrahering (parseReceiptText):
 *    Hittar automatiskt datum, totalbelopp, momssats, leverantör och bokföringskonto.
 *
 * Leverantörslistan och kontoreglerna (KNOWN_SUPPLIERS/ACCOUNT_KEYWORD_RULES)
 * flyttade till utils/accountCategories.js — delas nu med bankimporten
 * (Bank.jsx), som annars hade fått en egen, garanterat framtida-omatchad
 * kopia av samma regler.
 */
import { KNOWN_SUPPLIERS, ACCOUNT_KEYWORD_RULES } from './accountCategories';
import { REVERSE_PURCHASE_ACCOUNTS } from './vatConfig';
import { getSignedStorageUrl } from './signedUrls';

const MONTHS_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', maj: '05', may: '05',
  jun: '06', jul: '07', aug: '08', sep: '09', okt: '10', oct: '10',
  nov: '11', dec: '12',
  januari: '01', februari: '02', mars: '03', april: '04',
  juni: '06', juli: '07', augusti: '08', september: '09', oktober: '10',
  november: '11', december: '12',
  january: '01', february: '02', march: '03',
  june: '06', july: '07', august: '08', october: '10',
  mai: '05', dez: '12', mär: '03', märz: '03',
};

/** Månadsnumret för ett månadsnamn, också när OCR läst "rn" för "m" eller 0 för o. */
export function monthFromWord(raw) {
  const w = String(raw || '').toLowerCase().replace(/rn/g, 'm').replace(/0/g, 'o').replace(/\.$/, '');
  if (MONTHS_MAP[w]) return MONTHS_MAP[w];
  if (w.length >= 3 && MONTHS_MAP[w.slice(0, 3)] && /^[a-zåäö]+$/.test(w)) {
    // Bara när ordet är början på ett riktigt månadsnamn ("septembe", "sept").
    const full = Object.keys(MONTHS_MAP).find(k => k.length > 3 && k.startsWith(w));
    if (full || w.length <= 4) return MONTHS_MAP[w.slice(0, 3)];
  }
  return null;
}

/**
 * Tolkar en enskild siffersträng från ett kvitto — "48,99", "1.234,56"
 * (europeisk), "1,234.56" (amerikansk), "5,000" eller "5000" — till ett
 * tal. Punkt och komma används olika beroende på land, och en tresiffrig
 * grupp efter separatorn (t.ex. "5,000") är en TUSENTALSAVGRÄNSARE, inte
 * decimaler, medan en en- eller tvåsiffrig grupp ("48,99") är decimaler.
 * Bugkritiskt för japanska/kinesiska kvitton: yen skrivs praktiskt taget
 * ALDRIG med decimaler ("¥5,000" är femtusen yen, inte 5 kronor och 00
 * öre) — utan den här skillnaden blev "¥5,000" tidigare feltolkat som
 * 5,00 eftersom den gamla koden bara tog de två SISTA siffrorna efter ett
 * kommatecken, oavsett hur många det faktiskt var.
 */
function parseMoneyToken(raw) {
  const clean = String(raw).trim().replace(/\s/g, '');
  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');
  let normalized = clean;
  if (hasComma && hasDot) {
    // Båda förekommer — den SISTA av dem är decimaltecknet, resten är
    // tusentalsgruppering ("1.234,56" eller "1,234.56").
    const decimalSep = clean.lastIndexOf(',') > clean.lastIndexOf('.') ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalized = clean.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const parts = clean.split(sep);
    const lastPart = parts[parts.length - 1];
    normalized = (parts.length > 2 || lastPart.length === 3)
      // Flera separatorer, eller exakt tre siffror efter den enda — det är
      // tusentalsgruppering ("5,000" = femtusen), inga decimaler.
      ? parts.join('')
      // En separator med 1-2 siffror efter — det ÄR decimaler ("48,99").
      : parts.join('.');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

// Belopp MED decimaler ("48,99", "1.234,56") — i praktiken aldrig ett
// referens- eller ordernummer, så den här formen är alltid en säker
// kandidat, på vilken rad som helst.
// Mellanslag får bara vara tusentalsavgränsare, och då i grupper om exakt tre
// siffror ("1 234,56"). Tidigare dög hur många siffror som helst runt
// mellanslaget, och en kolumnsatt totalrad ("Totalt   4   24,00", där 4 är
// antalet varor) lästes som fyrahundratjugofyra kronor.
// Öretecknen får dessutom ha ETT mellanslag efter decimaltecknet, men bara när
// exakt två siffror följer: OCR delar ofta "15.00" i "15. 00" och "12 500,00"
// i "12 500, 00" på ett fotat kvitto. Ett ensamt decimaltal ("1,5 l") får
// däremot inte delas, annars blir en uppräkning ("12, 50, 90") ett belopp.
const MONEY_GROUPED = '(?:\\d{1,3}(?:[ \\u00A0]\\d{3})+|\\d+)';
const MONEY_DECIMAL_SOURCE = `${MONEY_GROUPED}[,.]\\s?\\d{2}\\b|${MONEY_GROUPED}[,.]\\d\\b`;
const MONEY_DECIMAL_RE = new RegExp(MONEY_DECIMAL_SOURCE, 'g');
// Rena heltalsbelopp på minst 3 siffror, ev. tusentalsgrupperat ("5,000",
// "5000") — krävs för valutor utan decimaler (yen, och ofta yuan på större
// B2B-fakturor). Ett ensamt en/tvåsiffrigt heltal matchas medvetet INTE
// (för lätt att råka plocka upp en momssats eller ett kvantitetstal).
const MONEY_WHOLE_RE = /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{3,6}\b/g;
// Facit för lastAmountOnLine, som bara körs på rader som REDAN matchat ett
// starkt nyckelord (totalt/summa/att betala/…) — där är ett heltal en
// säker kandidat också, till skillnad från fallback-sökningen nedan som
// letar i HELA dokumentet utan någon sån kontext (se idLikeLine där).
const MONEY_TOKEN_RE = new RegExp(`${MONEY_DECIMAL_SOURCE}|\\b\\d{1,3}(?:[.,]\\d{3})+\\b|\\b\\d{3,6}\\b`, 'g');

// Rader där en siffra aldrig är ett belopp: kortnummer och terminalkoder
// ("XXXX 1234", "AID 123456") och antalsrader ("Antal artiklar 3").
const NOT_AMOUNT_LINE_RE = /\*{3,}|x{4,}|korttyp|terminal|\banbud\b|\bmid\b|\bptid\b|\baid\b|auth|\bantal\b|artiklar|\bitems\b|kvantitet|^(?!.*(?:belopp|summa|total|att betala)).*(?:master\s*car|\bvisa\b|\bdebit\b|refnr|kontrollnr|\btvr\b|\btsi\b|medlemskort|po[äa]ngsaldo)/i;

/**
 * Plockar bort det som ser ut som ett belopp men inte är det, innan siffrorna
 * på en rad läses: momssatsen ("25 %"), klockslag ("14:02"), datum och
 * antalsuttryck ("2 st", "3 x"). Bara klockslag med kolon tas bort — "15.00"
 * på ett svenskt kvitto är femton kronor, inte tre på eftermiddagen.
 */
function stripNonAmounts(line) {
  return String(line)
    .replace(/\d{1,2}(?:[.,]\d+)?\s*%/g, ' ')
    // Org.-nummer (738200-2850) och telefonnummer (010-741 67 80): Coop-kvittot
    // 2026-10-04 fick org.-numret som belopp.
    .replace(/\b\d{6}-\d{4}\b/g, ' ')
    // Kortterminalens datum och klockslag ("221114 141911").
    .replace(/\b\d{6}\s+\d{6}\b/g, ' ')
    .replace(/\b0\d{1,3}-\d[\d ]{4,9}\d\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b(?:20|19)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.](?:20|19)\d{2}\b/g, ' ')
    .replace(/\b\d{1,3}\s*(?:st|stk|x|×)\b/gi, ' ');
}

/**
 * Alla belopp på en rad som REDAN har beloppssammanhang (en totalrad, en
 * nettorad eller en momsrad). Där är också ett litet heltal ett belopp:
 * svenska butikskvitton skriver ofta "TOTALT 24" och "Moms 25% 3" utan både
 * decimaler och kr. Utan det blev "TOTALT 24" osynligt (ett heltal måste ha
 * minst tre siffror i MONEY_TOKEN_RE, som letar utan sammanhang) och
 * fallback-sökningen plockade i stället momsbeloppet på raden under som
 * totalbelopp: ett kvitto på 24 kr fylldes i som 4,80 kr. Ett litet heltal
 * används bara när raden inte har något starkare belopp alls.
 */
function amountsOnLine(line) {
  // "ATT BETALA ( 10 ARTIKLAR ) 193,75": antalet tas bort, beloppet är kvar.
  // En ensam ")" läses ofta som "2" ("ARTIKLAR 2 193,78") och tas också bort,
  // men aldrig en siffra som hör till beloppet ("15 varor 261.38").
  line = String(line).replace(/\(?\s*\d{1,4}\s*(?:artiklar|artikel|items?|varor)\b(?:\s*[)\]}2](?=\s))?\)?/gi, ' ');
  if (NOT_AMOUNT_LINE_RE.test(line)) return [];
  const cleaned = stripNonAmounts(line);
  const strong = cleaned.match(MONEY_TOKEN_RE);
  const tokens = (strong && strong.length) ? strong : (cleaned.match(/\b\d{1,2}\b/g) || []);
  return tokens.map(parseMoneyToken).filter(v => v !== null && v > 0);
}

/** Sista (störst rimliga) beloppet på en rad, tolkat med parseMoneyToken. */
function lastAmountOnLine(line) {
  const parsed = amountsOnLine(line);
  return parsed.length ? parsed[parsed.length - 1] : null;
}

/**
 * Alla belopp i hela dokumentet — facit när ett enskilt belopp ska kontrolleras
 * mot texten (se totalFromVatAmount). Rader med referens- eller ordernummer och
 * rader med datum räknas inte.
 */
function allAmountsInText(lines) {
  const out = [];
  for (const line of lines || []) {
    if (ID_LIKE_LINE_RE.test(line) || DATE_LIKE_LINE_RE.test(line)) continue;
    for (const v of amountsOnLine(line)) if (v < 500000) out.push(v);
  }
  return out;
}

// Rader som ser ut att innehålla ett referens-, order- eller telefonnummer
// — ett heltal DÄR ska inte kunna vinna över det riktiga totalbeloppet i
// den okontextuella fallback-sökningen (skedde tidigare: "Ref 88213" slog
// den faktiska summan 169,00 rakt av eftersom 88213 > 169).
const ID_LIKE_LINE_RE = /\bref\b|\bnr\b|\border\b|\bnummer\b|\borg\.?\s*nr\b|\btel(?:efon)?\b|\bphone\b|\bid\b/i;
// Rader med ett fullständigt numeriskt datum ("2024-07-01") — annars
// plockade fallback-sökningen upp ÅRTALET (2024) som ett heltalsbelopp,
// eftersom det numeriskt sett är större än en liten totalsumma.
const DATE_LIKE_LINE_RE = /\b(?:20|19)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.](?:20|19)\d{2}\b/;

/**
 * Gör om pdf.js textdelar till text med radbrytningar. Delarna kommer i
 * läsordning med en y-koordinat (transform[5]); en ny rad börjar när y ändras
 * eller pdf.js markerar radslut. Tidigare slogs allt ihop till EN rad, och då
 * blev hela dokumentet "leverantör" och belopp, nummer och datum fick byta
 * plats i tolkningen, som arbetar rad för rad.
 */
export function pdfItemsToText(items) {
  const lines = [];
  let cur = '';
  let lastY = null;
  for (const item of items || []) {
    if (!item || typeof item.str !== 'string') continue;
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 3 && cur.trim()) {
      lines.push(cur.trim());
      cur = '';
    }
    if (item.str) cur += (cur && !cur.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : '') + item.str;
    if (y !== null) lastY = y;
    if (item.hasEOL && cur.trim()) {
      lines.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.join('\n');
}

/**
 * Extraherar text ur en digital PDF i webbläsaren med pdfjs-dist.
 */
async function extractTextFromPdf(blob, onProgress) {
  try {
    onProgress?.('Läser digital PDF…');
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 5); // Kvitton är oftast 1-2 sidor
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = pdfItemsToText(textContent.items);
      fullText += pageText + '\n';
    }

    const trimmed = fullText.trim();
    if (trimmed.length >= 15) {
      return trimmed;
    }
  } catch (err) {
    console.warn('[OCR] Direkt PDF-textextrahering gav ingen text, provar bild-OCR:', err);
  }
  return '';
}

/**
 * Renderar första sidan av en skannad PDF till en canvas så Tesseract kan läsa den.
 */
async function renderPdfPageToCanvas(blob) {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Tesseracts lästid skalar ungefär med ANTALET PIXLAR i bilden, inte med
// hur skarp/läsbar den är — och en modern mobilkamera fotograferar i
// 12+ megapixel (3000-4000px på långsidan) rakt av. Den råa bilden gick
// tidigare oförminskad rakt in i Tesseract: på en dator hann det knappt
// märkas, men på en telefons mycket svagare CPU (kundfeedback, uttryckligt:
// "tog typ en minut, jag var generad" — samma sida som annars påstår
// "klart på <10 sekunder") blev just DEN skillnaden hela problemet.
// 1800px på långsidan är gott och väl för Tesseracts egen rekommenderade
// upplösning (~300 DPI för normal kvittotext) — att gå högre kostar bara
// tid, det gör aldrig avläsningen säkrare.
const MAX_OCR_DIMENSION = 1800;

/**
 * Gör ett foto lättare för Tesseract att läsa: gråskala, jämnar ut ojämnt ljus
 * (varje punkt delas med medelvärdet runt omkring, så skuggor och en lampas
 * ljuspunkt försvinner) och sträcker ut kontrasten. Ett fotat kvitto har
 * nästan alltid ojämn belysning, och Tesseracts egen tröskling klarar den
 * dåligt: svag text försvinner i skuggan. Rent pixelarbete i JavaScript, inte
 * canvas-filter, eftersom filter saknas i äldre Safari. Hoppas över för
 * mycket stora bilder, och vid minsta fel returneras bilden som den var.
 */
function enhanceCanvasForOcr(canvas) {
  try {
    const w = canvas.width; const h = canvas.height;
    if (!w || !h || w * h > 6000000) return canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, w, h);
    const px = image.data;
    const n = w * h;
    const gray = new Float32Array(n);
    for (let i = 0, j = 0; j < n; i += 4, j++) gray[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    // Lätt brusreducering (3x3-medel) så kamerabrus inte blir hundratals små
    // fläckar som Tesseract lägger tid på: både snabbare och säkrare avläsning.
    const tmp = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = x > 0 ? gray[y * w + x - 1] : gray[y * w + x];
        const c = x < w - 1 ? gray[y * w + x + 1] : gray[y * w + x];
        tmp[y * w + x] = (a + gray[y * w + x] * 2 + c) / 4;
      }
    }
    for (let y = 0; y < h; y++) {
      const up = y > 0 ? y - 1 : y; const down = y < h - 1 ? y + 1 : y;
      for (let x = 0; x < w; x++) gray[y * w + x] = (tmp[up * w + x] + tmp[y * w + x] * 2 + tmp[down * w + x]) / 4;
    }
    // Medelvärde i ett fönster via en integralbild (en kolumn extra/rad extra).
    const iw = w + 1;
    const integral = new Float64Array(iw * (h + 1));
    for (let y = 1; y <= h; y++) {
      let rowSum = 0;
      for (let x = 1; x <= w; x++) {
        rowSum += gray[(y - 1) * w + (x - 1)];
        integral[y * iw + x] = integral[(y - 1) * iw + x] + rowSum;
      }
    }
    const r = Math.max(14, Math.round(Math.min(w, h) / 22));
    const out = new Float32Array(n);
    let lo = 255; let hi = 0;
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r); const y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r); const x1 = Math.min(w, x + r + 1);
        const sum = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
        const mean = sum / ((x1 - x0) * (y1 - y0));
        const v = Math.min(255, (gray[y * w + x] / (mean + 1)) * 200);
        out[y * w + x] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    // Kontraststräckning: de mörkaste och ljusaste procenten sätts till svart/vitt.
    const hist = new Uint32Array(256);
    for (let j = 0; j < n; j++) hist[Math.max(0, Math.min(255, Math.round(out[j])))]++;
    let acc = 0; let black = 0; let white = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.01) { black = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.35) { white = v; break; } }
    if (white - black < 40) { black = lo; white = hi; }
    const span = Math.max(1, white - black);
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const v = Math.max(0, Math.min(255, ((out[j] - black) / span) * 255));
      px[i] = v; px[i + 1] = v; px[i + 2] = v;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  } catch (err) {
    console.warn('[OCR] Bildförbättringen misslyckades, kör på originalet:', err);
    return canvas;
  }
}

// Andra avläsningen läser en större bild som ett enda textblock; båda vägs
// samman fält för fält (mergeReadings).
const CAREFUL_OCR_DIMENSION = 2600;
// Taket innan bilden ens ritas ut en första gång: en 12-megapixelbild som
// canvas är ~50 MB, och en telefon har inte det att slösa med. 3000 räcker med
// marginal — den största bild OCR läser är 2600 px på långsidan.
const MAX_SOURCE_DIMENSION = 3000;
// Text som blivit för liten går inte att förstora fram, men Tesseract läser
// mätbart bättre när x-höjden är runt 20-30 px, så en INZOOMAD del av bilden
// får skalas upp en bit. Mer än så är bara suddig text i större format.
const MAX_UPSCALE = 2;

/** Gråskalan för en canvas som Float32Array (0–255), i läsordning. */
function grayscaleOf(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const n = canvas.width * canvas.height;
  const gray = new Float32Array(n);
  for (let i = 0, j = 0; j < n; i += 4, j++) gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return gray;
}

/** En liten kopia av bilden i gråskala — allt grovarbete görs på den. */
function smallGray(canvas, target = 240) {
  const scale = Math.min(1, target / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  small.getContext('2d').drawImage(canvas, 0, 0, w, h);
  return { gray: grayscaleOf(small), w, h };
}

/** Otsus tröskel: den gräns mellan mörkt och ljust som skiljer bäst. */
function otsuThreshold(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
  const total = gray.length;
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0; let wB = 0; let best = 0; let threshold = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += v * hist[v];
    const between = (wB * wF) * ((sumB / wB) - ((sum - sumB) / wF)) ** 2;
    if (between > best) { best = between; threshold = v; }
  }
  return threshold;
}

/** Längsta sammanhängande sträcka där andelen ljusa punkter når `frac`. */
function longestRun(fractions, frac) {
  let bestStart = -1; let bestLen = 0; let start = -1;
  for (let i = 0; i <= fractions.length; i++) {
    const on = i < fractions.length && fractions[i] >= frac;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start > bestLen) { bestLen = i - start; bestStart = start; }
      start = -1;
    }
  }
  return bestLen > 0 ? { start: bestStart, end: bestStart + bestLen } : null;
}

/**
 * Hittar kvittot i fotot: papperet är den ljusa ytan, bordet runt om är mörkare.
 * Returnerar gränserna som andelar av bilden (0–1), eller null när det inte går
 * att säga — då läses hela bilden som förut.
 *
 * Varför: ett kvitto som ligger på ett bord och fotas rakt ovanifrån fyller
 * kanske en tredjedel av bilden. Hela bilden krymptes förut till 1800 px, så
 * kvittot fick bara ~600 px och texten blev för liten för att läsa. Att först
 * klippa ut kvittot och sedan använda hela upplösningen på DET är att zooma in
 * åt användaren, som frågade efter: "om det är utzoomat, zooma själv".
 *
 * Säkerheten ligger i att en tveksam utklippning hoppas över: täcker den nästan
 * hela bilden finns inget att vinna, är den för liten är det nog inte kvittot,
 * och saknar ytan text (inga mörka punkter) är det bara ett tomt bord.
 */
function documentBounds(canvas) {
  const { gray, w, h } = smallGray(canvas);
  if (w < 40 || h < 40) return null;
  const t = otsuThreshold(gray);
  const rows = new Float32Array(h);
  const cols = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y * w + x] > t) { rows[y] += 1 / w; cols[x] += 1 / h; }
    }
  }
  // Gränsen sätts i förhållande till den ljusaste raden/kolumnen, inte till
  // bildens bredd: ett smalt butikskvitto på ett stort bord täcker bara en
  // fjärdedel av varje rad det ligger på, och en fast gräns (0,35 av bredden)
  // missade då just de foton som behöver klippas mest.
  const runThreshold = (profile) => Math.max(0.03, 0.4 * Math.max(...profile));
  const rowRun = longestRun(rows, runThreshold(rows));
  const colRun = longestRun(cols, runThreshold(cols));
  if (!rowRun || !colRun) return null;
  // Två procents marginal, så inte en bokstav vid kanten klipps bort.
  const mx = Math.round(w * 0.02); const my = Math.round(h * 0.02);
  const x0 = Math.max(0, colRun.start - mx); const x1 = Math.min(w, colRun.end + mx);
  const y0 = Math.max(0, rowRun.start - my); const y1 = Math.min(h, rowRun.end + my);
  const ratio = ((x1 - x0) * (y1 - y0)) / (w * h);
  // Täcker ytan nästan hela bilden finns inget att vinna. Nedre gränsen är låg
  // med flit: ett kvitto som bara är några procent av fotot är precis det fall
  // som behöver klippas ut. Att det verkligen ÄR ett kvitto och inte en ljus
  // fläck avgörs av textkontrollen nedan.
  if (ratio > 0.92 || ratio < 0.03) return null;
  // Finns det text i ytan? En ljus yta helt utan mörka punkter är ett tomt
  // bord eller en vägg, inte ett kvitto.
  let dark = 0; let inside = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) { inside++; if (gray[y * w + x] < t) dark++; }
  }
  if (inside === 0 || dark / inside < 0.02) return null;
  return { x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h, ratio };
}

/**
 * Var i bilden ser det ut som text? Små mörka streck på ljust papper, tätt
 * packade. Används när papperets kant inte gick att hitta, till exempel ett
 * kvitto som hålls i handen över en matkasse (ICA-kvittot 2026-10-04): då
 * tog utklippningen en ljus vägg i stället. Bilden delas i rutor, rutor med
 * textliknande svärta slås ihop, och den största sammanhängande textytan
 * vinner. Returnerar gränserna som andelar (0-1), eller null. Exporterad för
 * testerna.
 */
export function textRegionFromGray(gray, w, h) {
  // Lokalt medelvärde via integralbild.
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += gray[y * w + x]; ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row; }
  }
  const r = Math.max(3, Math.round(Math.min(w, h) / 80));
  const mean = (x, y) => {
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
    const sum = ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
    return sum / ((x1 - x0) * (y1 - y0));
  };
  const cell = Math.max(6, Math.round(Math.min(w, h) / 40));
  const cw = Math.ceil(w / cell), ch = Math.ceil(h / cell);
  const dens = new Float32Array(cw * ch);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = mean(x, y);
      if (m > 140 && gray[y * w + x] < m - 28) dens[((y / cell) | 0) * cw + ((x / cell) | 0)]++;
    }
  }
  const area = cell * cell;
  const on = new Uint8Array(cw * ch);
  for (let i = 0; i < on.length; i++) { const d = dens[i] / area; on[i] = d > 0.03 && d < 0.45 ? 1 : 0; }
  // Rutor med text slås ihop med sina grannar (en rad i taget har luckor).
  const grown = new Uint8Array(on.length);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (!on[y * cw + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cw && ny < ch) grown[ny * cw + nx] = 1;
    }
  }
  const seen = new Uint8Array(on.length);
  let best = null;
  for (let start = 0; start < on.length; start++) {
    if (!grown[start] || seen[start]) continue;
    const stack = [start]; seen[start] = 1;
    let mass = 0, x0 = cw, y0 = ch, x1 = 0, y1 = 0;
    while (stack.length) {
      const i = stack.pop(); const x = i % cw, y = (i / cw) | 0;
      if (on[i]) mass += dens[i];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; const j = ny * cw + nx;
        if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && grown[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (!best || mass > best.mass) best = { mass, x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }
  if (!best) return null;
  const x0 = Math.max(0, best.x0 - 1) * cell / w, y0 = Math.max(0, best.y0 - 1) * cell / h;
  const x1 = Math.min(cw, best.x1 + 1) * cell / w, y1 = Math.min(ch, best.y1 + 1) * cell / h;
  const ratio = (Math.min(1, x1) - x0) * (Math.min(1, y1) - y0);
  if (ratio > 0.85 || ratio < 0.01) return null;
  return { x0, y0, x1: Math.min(1, x1), y1: Math.min(1, y1), ratio, ink: true };
}

function textRegionBounds(canvas) {
  const { gray, w, h } = smallGray(canvas, 480);
  if (w < 60 || h < 60) return null;
  return textRegionFromGray(gray, w, h);
}

/**
 * Reserv när papperet inte syns mot underlaget (vitt kvitto på vitt papper,
 * en inskannad A4 med kvittot mitt på): textens egen yta. Kolumner och rader
 * med svärta letas upp, små luckor slås ihop och den sträcka som har mest
 * text vinner, så att en fläck i kanten inte drar ut rutan. Coop-kvittot
 * 2026-10-04 lästes annars som hela A4-sidan med fem pixlar höga tecken.
 */
export function inkBoundsFromGray(gray, w, h) {
  const t = otsuThreshold(gray);
  // Bara tydligt mörka punkter räknas som svärta.
  const dark = Math.max(60, Math.min(t, 120));
  const cols = new Float32Array(w);
  const rows = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y * w + x] < dark) { cols[x]++; rows[y]++; }
    }
  }
  // Hela textens utsträckning, men de yttersta promillen svärta räknas bort
  // så att en fläck eller ett pennstreck i kanten inte drar ut rutan. Luckor
  // mellan textstycken får aldrig klippa bort ett stycke.
  const span = (profile) => {
    let total = 0;
    for (let i = 0; i < profile.length; i++) total += profile[i];
    if (total === 0) return null;
    const cut = total * 0.003;
    let acc = 0; let start = 0;
    for (; start < profile.length; start++) { acc += profile[start]; if (acc > cut) break; }
    acc = 0; let end = profile.length - 1;
    for (; end > start; end--) { acc += profile[end]; if (acc > cut) break; }
    return { start, end: end + 1 };
  };
  const col = span(cols);
  const row = span(rows);
  if (!col || !row) return null;
  const mx = Math.round(w * 0.025); const my = Math.round(h * 0.025);
  const x0 = Math.max(0, col.start - mx); const x1 = Math.min(w, col.end + mx);
  const y0 = Math.max(0, row.start - my); const y1 = Math.min(h, row.end + my);
  const ratio = ((x1 - x0) * (y1 - y0)) / (w * h);
  if (ratio > 0.75 || ratio < 0.02 || (x1 - x0) < w * 0.08) return null;
  return { x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h, ratio, ink: true };
}

function inkBounds(canvas) {
  const { gray, w, h } = smallGray(canvas, 600);
  if (w < 40 || h < 40) return null;
  return inkBoundsFromGray(gray, w, h);
}

// ── Kvittots form: hitta hörnen och räta ut papperet ─────────────────────
// Ett fotat kvitto ligger snett, med bordet runt omkring och ofta i keystone
// (bredare nedtill än upptill, för att telefonen hölls på lutning). Att bara
// klippa ut en rektangel runt det tar med bordet i hörnen och lämnar texten
// lutande — Tesseract läser rader, och en lutande rad är svårare än en rak.
//
// Det här hittar papperets FYRA HÖRN och räknar om bilden så att kvittot blir
// en rak rektangel som fyller hela bilden: bakgrunden försvinner helt, texten
// blir vågrät och hela upplösningen går åt till kvittot. Det är samma sak som
// skannerappar gör, och det användaren bad om ("ta formen av kvittot").

/** Största sammanhängande ljusa ytan i masken, som en lista med punkter. */
function largestBrightComponent(gray, w, h, threshold) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let best = null;
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || gray[start] <= threshold) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    const points = [];
    while (top > 0) {
      const i = stack[--top];
      points.push(i);
      const x = i % w; const y = (i / w) | 0;
      if (x > 0 && !seen[i - 1] && gray[i - 1] > threshold) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && !seen[i + 1] && gray[i + 1] > threshold) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && !seen[i - w] && gray[i - w] > threshold) { seen[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && !seen[i + w] && gray[i + w] > threshold) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    if (!best || points.length > best.length) best = points;
  }
  return best;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** Ytan av en fyrhörning (skolformeln), alltid positiv. */
function quadArea(q) {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]; const b = q[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Kvittots fyra hörn i bilden, som andelar (0–1), i ordningen övre vänstra,
 * övre högra, nedre högra, nedre vänstra — eller null när formen inte
 * övertygar. Hörnen hittas som ytterpunkterna i x+y och x−y, vilket ger rätt
 * svar för en fyrhörning oavsett hur den är vriden.
 *
 * Kraven finns för att en tveksam form aldrig ska klippas: ytan ska vara stor
 * nog att vara kvittot men inte hela bilden, den ljusa ytan ska FYLLA sin
 * fyrhörning (annars är det två saker på bordet, eller en skugga), sidorna ska
 * vara rimligt långa och motstående sidor ungefär lika långa. Håller det inte
 * faller avläsningen tillbaka på den vanliga rektangulära utklippningen.
 */
function documentQuad(canvas) {
  const { gray, w, h } = smallGray(canvas, 260);
  if (w < 40 || h < 40) return null;
  const t = otsuThreshold(gray);
  const points = largestBrightComponent(gray, w, h, t);
  if (!points || points.length < w * h * 0.04) return null;

  let tl = null; let tr = null; let br = null; let bl = null;
  let minSum = Infinity; let maxSum = -Infinity; let minDiff = Infinity; let maxDiff = -Infinity;
  for (const i of points) {
    const x = i % w; const y = (i / w) | 0;
    const sum = x + y; const diff = x - y;
    if (sum < minSum) { minSum = sum; tl = { x, y }; }
    if (sum > maxSum) { maxSum = sum; br = { x, y }; }
    if (diff > maxDiff) { maxDiff = diff; tr = { x, y }; }
    if (diff < minDiff) { minDiff = diff; bl = { x, y }; }
  }
  const quad = [tl, tr, br, bl];
  if (quad.some(p => !p)) return null;

  const minSide = Math.min(w, h) * 0.12;
  const top = dist(tl, tr); const bottom = dist(bl, br);
  const left = dist(tl, bl); const right = dist(tr, br);
  if (Math.min(top, bottom, left, right) < minSide) return null;
  // Motstående sidor: en telefon på lutning ger keystone, och den kan vara
  // rejäl (nedre kanten halvannan gång den övre) — men inte hur som helst.
  if (Math.min(top, bottom) / Math.max(top, bottom) < 0.45) return null;
  if (Math.min(left, right) / Math.max(left, right) < 0.45) return null;

  const area = quadArea(quad);
  const ratio = area / (w * h);
  if (ratio < 0.04 || ratio > 0.97) return null;
  // Fyller den ljusa ytan sin egen fyrhörning? En rektangulär pappersbit gör
  // det (>85 %); en skugga, ett bord med två papper på eller en ljus fläck med
  // hål i gör det inte.
  if (points.length / area < 0.82) return null;

  // Löper den ljusa ytan ut över bildkanten är det inte ett papper på ett bord
  // utan bakgrunden själv (en ljus bordsskiva, en skärmdump). Ett kvitto som
  // fotats så nära att det går utanför bilden behöver ingen uträtning ändå.
  if (borderShare(points, w, h) > 0.35) return null;

  // Finns det en synlig papperskant? Precis innanför kanten ska det vara
  // papper, precis utanför underlag. Är de lika ljusa är "hörnen" i själva
  // verket bildens egna, och att räta ut efter dem vrider texten på sned i
  // stället för att räta den. Mätt: en bild med ljusgrå bakgrund läste klart
  // SÄMRE efter uträtning — det är det här som stoppar den.
  if (edgeContrast(gray, w, h, quad) < 15) return null;

  return quad.map(p => ({ x: p.x / w, y: p.y / h }));
}

/** Hur stor del av bildens kant den ljusa ytan upptar. */
function borderShare(points, w, h) {
  const onBorder = new Set();
  for (const i of points) {
    const x = i % w; const y = (i / w) | 0;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) onBorder.add(i);
  }
  return onBorder.size / (2 * (w + h));
}

/**
 * Skillnaden i ljus mellan precis innanför och precis utanför fyrhörningens
 * kanter — papperets kant mot underlaget, mätt där den ska finnas.
 */
function edgeContrast(gray, w, h, quad) {
  const step = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  const center = {
    x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
    y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
  };
  const sample = (x, y) => {
    const px = Math.max(0, Math.min(w - 1, Math.round(x)));
    const py = Math.max(0, Math.min(h - 1, Math.round(y)));
    return gray[py * w + px];
  };
  let inside = 0; let outside = 0; let n = 0;
  for (let e = 0; e < 4; e++) {
    const a = quad[e]; const b = quad[(e + 1) % 4];
    for (let t = 0.15; t <= 0.85; t += 0.1) {
      const mx = a.x + (b.x - a.x) * t;
      const my = a.y + (b.y - a.y) * t;
      // Riktningen in mot mitten: innanför kanten åt det hållet, utanför åt
      // motsatt. Normalen behöver inte räknas ut — mitten räcker.
      const dx = center.x - mx; const dy = center.y - my;
      const len = Math.hypot(dx, dy) || 1;
      inside += sample(mx + (dx / len) * step, my + (dy / len) * step);
      outside += sample(mx - (dx / len) * step, my - (dy / len) * step);
      n++;
    }
  }
  return n ? (inside - outside) / n : 0;
}


/**
 * Löser ett linjärt ekvationssystem (Gauss med partiell pivotering). Används
 * för de åtta talen i en perspektivtransform.
 */
function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  const m = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-9) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }
  // Efter eliminationen står lösningen i sista kolumnen, delad med diagonalen.
  const solution = m.map((row, i) => row[n] / row[i]);
  return solution.every(Number.isFinite) ? solution : null;
}

/**
 * Perspektivtransformen från den räta utbilden till kvittots fyrhörning i
 * fotot: för varje punkt i den färdiga, raka bilden säger den var i originalet
 * färgen ska hämtas. Åtta obekanta, fyra hörnpar — precis bestämt.
 */
function inverseProjection(quad, outW, outH) {
  const dst = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }];
  const rows = [];
  const rhs = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dst[i];
    const { x, y } = quad[i];
    rows.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); rhs.push(x);
    rows.push([0, 0, 0, u, v, 1, -u * y, -v * y]); rhs.push(y);
  }
  const s = solveLinearSystem(rows, rhs);
  if (!s) return null;
  const [a, b, c, d, e, f, g, i] = s;
  return (u, v) => {
    const denom = g * u + i * v + 1;
    if (!denom) return null;
    return { x: (a * u + b * v + c) / denom, y: (d * u + e * v + f) / denom };
  };
}

/**
 * Rätar ut kvittot: klipper bort bakgrunden och gör papperet rektangulärt,
 * med bilinjär sampling så texten inte blir taggig. Returnerar en ny canvas,
 * eller null om formen inte gick att räkna om.
 */
function warpQuadToCanvas(base, quadFractions, target) {
  const quad = quadFractions.map(p => ({ x: p.x * base.width, y: p.y * base.height }));
  const [tl, tr, br, bl] = quad;
  const srcW = (dist(tl, tr) + dist(bl, br)) / 2;
  const srcH = (dist(tl, bl) + dist(tr, br)) / 2;
  if (!(srcW > 8 && srcH > 8)) return null;
  const scale = Math.min(MAX_UPSCALE, target / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));
  const project = inverseProjection(quad, outW, outH);
  if (!project) return null;

  const srcCtx = base.getContext('2d', { willReadFrequently: true });
  const src = srcCtx.getImageData(0, 0, base.width, base.height);
  const sd = src.data;
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext('2d');
  const dstImage = outCtx.createImageData(outW, outH);
  const dd = dstImage.data;
  const maxX = base.width - 1;
  const maxY = base.height - 1;
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const p = project(u + 0.5, v + 0.5);
      const di = (v * outW + u) * 4;
      if (!p || p.x < 0 || p.y < 0 || p.x > maxX || p.y > maxY) {
        // Utanför papperet: vitt, så en kant aldrig blir ett svart streck
        // Tesseract tar för text.
        dd[di] = 255; dd[di + 1] = 255; dd[di + 2] = 255; dd[di + 3] = 255;
        continue;
      }
      const x0 = Math.floor(p.x); const y0 = Math.floor(p.y);
      const x1 = Math.min(maxX, x0 + 1); const y1 = Math.min(maxY, y0 + 1);
      const fx = p.x - x0; const fy = p.y - y0;
      const i00 = (y0 * base.width + x0) * 4; const i10 = (y0 * base.width + x1) * 4;
      const i01 = (y1 * base.width + x0) * 4; const i11 = (y1 * base.width + x1) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const topMix = sd[i00 + ch] * (1 - fx) + sd[i10 + ch] * fx;
        const bottomMix = sd[i01 + ch] * (1 - fx) + sd[i11 + ch] * fx;
        dd[di + ch] = topMix * (1 - fy) + bottomMix * fy;
      }
      dd[di + 3] = 255;
    }
  }
  outCtx.putImageData(dstImage, 0, 0);
  // `srcLongEdge`: hur stort kvittot var i originalets pixlar. Det, och inte
  // storleken efter uppskalning, säger om fotot togs för långt ifrån.
  return { canvas: out, srcLongEdge: Math.round(Math.max(srcW, srcH)) };
}

/**
 * Mäter om bilden går att lita på: skärpa, kontrast och ljus.
 *
 * Skärpan mäts på de KRAFTIGASTE kanterna (99:e percentilen av |laplacian|),
 * delat med kontrasten. Ett medelvärde över alla punkter fungerade inte: ett
 * kvitto är mest tomt papper, så medelvärdet blev ungefär detsamma för ett
 * knivskarpt och ett riktigt suddigt foto (mätt: 1,3 mot 1,1 — ingenting att
 * skilja på). De skarpaste kanterna är däremot just det oskärpan tar bort: en
 * skarp bokstavskant går från svart till vitt på en punkt, en suddig över fem.
 * Delningen med kontrasten gör måttet oberoende av exponering, så ett mörkt men
 * skarpt foto inte döms som suddigt.
 *
 * Måtten används bara till två saker: att läsa av en gång till mer noggrant,
 * och att kunna säga VARFÖR en avläsning inte gick bra. Aldrig till att stoppa
 * en avläsning som lyckades.
 */
function measureQuality(gray, w, h) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
  const n = gray.length;
  let sum = 0;
  for (let v = 0; v < 256; v++) { sum += v * hist[v]; }
  const brightness = sum / n;
  // Kontrasten mäts som skillnaden mellan trycksvärtan och papperet: bilden
  // delas i mörkt och ljust med Otsus tröskel, och medelvärdet i varje del
  // jämförs. Percentiler fungerade inte — texten är bara några procent av
  // punkterna på ett kvitto, så den 5:e percentilen låg fortfarande i papperet
  // och en knivskarp skärmdump fick "låg kontrast" (mätt: 37 av 255).
  const t = otsuThreshold(gray);
  let darkSum = 0; let darkN = 0; let lightSum = 0; let lightN = 0;
  for (let v = 0; v < 256; v++) {
    if (v <= t) { darkSum += v * hist[v]; darkN += hist[v]; } else { lightSum += v * hist[v]; lightN += hist[v]; }
  }
  const contrast = (darkN && lightN) ? Math.max(1, (lightSum / lightN) - (darkSum / darkN)) : 1;
  // Histogram över kantstyrkan, så percentilen går att läsa utan att spara
  // varje värde. Över 1020 (fyra gånger full kontrast) kan |laplacian| inte bli.
  const edges = new Uint32Array(1021);
  let count = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const l = Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]);
      edges[Math.min(1020, Math.round(l))]++;
      count++;
    }
  }
  let strongest = 0;
  if (count) {
    let seen = 0;
    for (let v = 1020; v >= 0; v--) { seen += edges[v]; if (seen >= count * 0.01) { strongest = v; break; } }
  }
  const sharpness = (strongest / contrast) * 100;
  return { sharpness: Math.round(sharpness), contrast: Math.round(contrast), brightness: Math.round(brightness) };
}

// Gränser för när bilden ska klagas på. Mätta mot riktiga avläsningar i
// webbläsaren — simulerade telefonfoton med oskärpa, snedställning, brus,
// ojämnt ljus och JPEG-komprimering, se scripts/ocr-photo-check.mjs — inte
// gissade. Skärpan låg på 24-32 på ett skarpt foto och på en skärmdump, 10 med
// en punkts oskärpa (lästes ändå rätt) och 4-5 vid två punkters oskärpa och
// uppåt, där avläsningen till slut gick sönder. Gränsen 6 pekar därför ut de
// foton där oskärpan är den troliga orsaken, utan att klaga på foton som gick
// att läsa.
const BLURRY_SHARPNESS = 6;
// Ljus och kontrast (trycksvärtan mot papperet): ett normalt foto låg på ljus
// 190-230 och kontrast 100-126, ett mörkt men fullt läsbart på 92 och 55, och
// ett riktigt mörkt på 49 och 29 — det sista är det som ska klagas på.
const DARK_BRIGHTNESS = 70;
const LOW_CONTRAST = 45;
// Kvittot tar upp mindre än så av bilden OCH blev ändå litet i pixlar: fotot är
// taget för långt ifrån, och ingen inzoomning i efterhand räddar det.
const FAR_CROP_RATIO = 0.2;
const FAR_LONG_EDGE = 1000;

/**
 * Ett råd om fotot, eller null när bilden är bra nog: 'blurry', 'dark' eller
 * 'far'. Texten till användaren sätts där den visas (Expenses.jsx,
 * ScanReceiptPage.jsx) — här bestäms bara vad som är fel.
 */
export function photoAdvice(quality) {
  if (!quality) return null;
  if (quality.brightness < DARK_BRIGHTNESS || quality.contrast < LOW_CONTRAST) return 'dark';
  if (quality.sharpness < BLURRY_SHARPNESS) return 'blurry';
  if (quality.cropRatio !== null && quality.cropRatio < FAR_CROP_RATIO && quality.longEdge < FAR_LONG_EDGE) return 'far';
  return null;
}

/**
 * Ritar ut bilden en gång, i rimlig storlek, och letar upp kvittot i den.
 * Resultatet återanvänds av båda avläsningsförsöken, så bilden aldrig behöver
 * avkodas två gånger.
 */
async function stageImage(imageSource, { quad: manualQuad = null } = {}) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(imageSource, { imageOrientation: 'from-image' });
  } catch (err) {
    console.warn('[OCR] Kunde inte läsa bilden för förbehandling, kör OCR på originalet:', err);
    return null;
  }
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_SOURCE_DIMENSION / longEdge);
    const base = document.createElement('canvas');
    base.width = Math.max(1, Math.round(bitmap.width * scale));
    base.height = Math.max(1, Math.round(bitmap.height * scale));
    base.getContext('2d').drawImage(bitmap, 0, 0, base.width, base.height);
    // Hörn som användaren själv dragit ut (Justera kanter) gäller före det
    // som hittas automatiskt.
    if (manualQuad) return { base, bounds: null, quad: manualQuad };
    let bounds = null;
    let quad = null;
    try { quad = documentQuad(base); } catch (err) { console.warn('[OCR] Kunde inte hitta kvittots form:', err); }
    try { bounds = documentBounds(base); } catch (err) { console.warn('[OCR] Kunde inte hitta kvittot i bilden:', err); }
    // Papperet syntes inte mot underlaget: klipp efter texten i stället.
    if (!quad && !bounds) {
      try { bounds = inkBounds(base); } catch (err) { console.warn('[OCR] Kunde inte hitta texten i bilden:', err); }
    }
    return { base, bounds, quad };
  } finally {
    bitmap.close?.();
  }
}

/**
 * Klipper ut kvittot, skalar det till `target` på långsidan (uppskalning högst
 * MAX_UPSCALE), mäter bildkvaliteten och förbättrar bilden för Tesseract.
 * Returnerar { source, quality } — `source` är den canvas OCR ska läsa.
 */
/**
 * Fyller texten bara en liten del av det utklippta papperet (ett kvitto på
 * en inskannad A4, där sidans kant togs för papperet) klipps det en gång till
 * efter texten och förstoras, högst tre gånger.
 */
function tightenToInk(canvas, target) {
  let ink = null;
  try { ink = inkBounds(canvas); } catch { return canvas; }
  if (!ink || ink.ratio > 0.35) return canvas;
  const sx = Math.round(ink.x0 * canvas.width); const sy = Math.round(ink.y0 * canvas.height);
  const sw = Math.max(1, Math.round((ink.x1 - ink.x0) * canvas.width)); const sh = Math.max(1, Math.round((ink.y1 - ink.y0) * canvas.height));
  const scale = Math.max(1, Math.min(3, target / Math.max(sw, sh)));
  const out = document.createElement("canvas");
  out.width = Math.round(sw * scale); out.height = Math.round(sh * scale);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

/**
 * Textens lutning i grader. Mörka punkter projiceras på rader för varje
 * vinkel; vid rätt vinkel hamnar varje textrad i några få rader och summan av
 * kvadraterna blir störst. Exporterad för testerna.
 */
export function estimateSkewFromGray(gray, w, h) {
  // Bara textliknande streck räknas: mörkare än sin närmaste omgivning på ljust
  // underlag. Kanter, skuggor och mönster i bakgrunden (en marmorskiva gav
  // annars -30°) får inte styra.
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += gray[y * w + x]; ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row; }
  }
  const r = 4;
  const pts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
      const m = (ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      if (m > 150 && gray[y * w + x] < m - 35) pts.push(x, y);
    }
  }
  if (pts.length < 400) return 0;
  const step = Math.max(1, Math.floor(pts.length / 2 / 6000));
  const score = (deg) => {
    const a = deg * Math.PI / 180; const s = Math.sin(a), c = Math.cos(a);
    const off = w * Math.abs(s) + 2;
    const bins = new Float32Array(Math.ceil(h + 2 * off + w));
    for (let i = 0; i < pts.length; i += 2 * step) bins[Math.round(-pts[i] * s + pts[i + 1] * c + off)]++;
    let sum = 0;
    for (let i = 0; i < bins.length; i++) sum += bins[i] * bins[i];
    return sum;
  };
  const flat = score(0);
  let best = 0; let bestScore = flat;
  for (let deg = -30; deg <= 30; deg += 1) { const v = score(deg); if (v > bestScore) { bestScore = v; best = deg; } }
  for (let deg = best - 0.75; deg <= best + 0.75; deg += 0.25) { const v = score(deg); if (v > bestScore) { bestScore = v; best = deg; } }
  // Ett svar vid sökområdets kant, eller ett som knappt slår rak text, är
  // inte en tydlig lutning: då görs ingenting.
  if (Math.abs(best) >= 28 || bestScore < flat * 1.15) return 0;
  return best;
}

/**
 * Rätar upp en snett fotad text (IKEA-kvittot 2026-10-04 låg 15° på sned).
 * Tesseract läser rader, och en lutande rad läses som brus. Under 1,5° görs
 * ingenting.
 */
function deskew(canvas) {
  let deg = 0;
  try {
    const { gray, w, h } = smallGray(canvas, 400);
    deg = estimateSkewFromGray(gray, w, h);
  } catch { return canvas; }
  if (Math.abs(deg) < 1.5) return canvas;
  const a = deg * Math.PI / 180;
  const W = canvas.width, H = canvas.height;
  const nw = Math.round(W * Math.abs(Math.cos(a)) + H * Math.abs(Math.sin(a)));
  const nh = Math.round(W * Math.abs(Math.sin(a)) + H * Math.abs(Math.cos(a)));
  const out = document.createElement('canvas');
  out.width = nw; out.height = nh;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, nw, nh);
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(-a);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, -W / 2, -H / 2);
  return out;
}

function renderStage(stage, target) {
  const { base, bounds, quad } = stage;
  // Gick kvittots form att hitta rätas papperet ut till en rak rektangel och
  // bakgrunden försvinner helt. Annars klipps en rektangel runt kvittot ut.
  if (quad) {
    try {
      const warped = warpQuadToCanvas(base, quad, target);
      // Skyddsnät: blev den uträtade bilden tom (nästan ingen kontrast alls)
      // har geometrin gått fel, och då läses hellre den vanliga utklippningen
      // än en vit bild. Ett sånt fel ska aldrig kunna nå Tesseract tyst.
      if (warped && measureQuality(grayscaleOf(warped.canvas), warped.canvas.width, warped.canvas.height).contrast < 8) {
        console.warn('[OCR] Uträtningen gav en tom bild, klipper ut i stället.');
      } else if (warped) {
        // Hörnen är andelar av bilden (0–1), så fyrhörningens yta ÄR andelen
        // av fotot som kvittot tar upp.
        const ratio = quadArea(quad);
        let quality = null;
        try {
          quality = {
            ...measureQuality(grayscaleOf(warped.canvas), warped.canvas.width, warped.canvas.height),
            cropped: true,
            deskewed: true,
            cropRatio: ratio,
            longEdge: warped.srcLongEdge,
          };
          quality.advice = photoAdvice(quality);
        } catch (err) {
          console.warn('[OCR] Kunde inte mäta bildkvaliteten:', err);
        }
        return { source: enhanceCanvasForOcr(tightenToInk(warped.canvas, target)), quality };
      }
    } catch (err) {
      console.warn('[OCR] Kunde inte räta ut kvittot, klipper ut i stället:', err);
    }
  }
  const sx = bounds ? Math.round(bounds.x0 * base.width) : 0;
  const sy = bounds ? Math.round(bounds.y0 * base.height) : 0;
  const sw = bounds ? Math.max(1, Math.round((bounds.x1 - bounds.x0) * base.width)) : base.width;
  const sh = bounds ? Math.max(1, Math.round((bounds.y1 - bounds.y0) * base.height)) : base.height;
  const cropLongEdge = Math.max(sw, sh);
  // Utklippt efter texten (inkBounds): bilden var liten från början, så den
  // får förstoras mer för att tecknen ska nå en läsbar höjd.
  const scale = Math.min(bounds?.ink ? 3 : MAX_UPSCALE, target / cropLongEdge);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(base, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  let quality = null;
  try {
    quality = {
      ...measureQuality(grayscaleOf(canvas), canvas.width, canvas.height),
      cropped: Boolean(bounds),
      cropRatio: bounds ? bounds.ratio : null,
      longEdge: cropLongEdge,
    };
    quality.advice = photoAdvice(quality);
  } catch (err) {
    console.warn('[OCR] Kunde inte mäta bildkvaliteten:', err);
  }
  return { source: enhanceCanvasForOcr(tightenToInk(deskew(canvas), target)), quality };
}

/**
 * Kör Tesseract OCR på en bild eller canvas i webbläsaren. Returnerar även
 * Tesseracts EGEN säkerhet på avläsningen (0–100, `data.confidence`) —
 * tidigare kastades den bort och bara texten returnerades, vilket gjorde
 * det omöjligt att skilja en riktig, tydligt läst text som råkar sakna
 * kvitto-ord (ett kontrakt, ett brev) från en genuint dålig avläsning
 * (för suddigt, mörkt eller utzoomat foto) som råkade producera lite
 * sammanhangslöst brus i stället för att bli helt tom. Se classifyDocument/
 * parseReceiptText nedan, som är just den skillnaden byggd för att fånga.
 */
async function recognizeWith(source, onProgress, { psm = null, label = 'Läser av kvitto' } = {}) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['swe', 'eng'], 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onProgress?.(`${label}… ${pct}%`);
      } else if (m.status === 'loading language traineddata') {
        onProgress?.('Laddar språkmodeller…');
      } else if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
        onProgress?.('Förbereder OCR…');
      }
    },
  });

  try {
    if (psm) {
      try { await worker.setParameters({ tessedit_pageseg_mode: psm }); } catch (err) { console.warn('[OCR] Kunde inte sätta sidläge:', err); }
    }
    const { data } = await worker.recognize(source, {}, { text: true, blocks: true });
    return {
      text: data.text || '',
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
      weakTokens: weakDigitWords(data.blocks),
      digitWords: digitWordsOf(data.blocks),
      source,
    };
  } finally {
    await worker.terminate();
  }
}

// Ord med siffror som Tesseract läste med lägre säkerhet än så här. Ett datum
// bland dem märks "Kontrollera" (se pickReceiptDate): siffran kan vara en
// förväxling, och ett fel datum ser precis lika rimligt ut som ett rätt.
const WEAK_DIGIT_CONFIDENCE = 75;

function digitWordsOf(blocks) {
  const out = [];
  (blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => (l.words || []).forEach((w) => {
    if (/\d/.test(w.text || '')) out.push({ text: w.text, confidence: w.confidence, bbox: w.bbox });
  }))));
  return out;
}

function weakDigitWords(blocks) {
  return digitWordsOf(blocks)
    .filter(w => typeof w.confidence === 'number' && w.confidence < WEAK_DIGIT_CONFIDENCE)
    .map(w => w.text);
}

/**
 * Läser datumet en gång till, för sig. Tesseract kan vara helt säker och ändå
 * fel: ett suddigt foto gav "2026-09-16" för 2026-09-14 med 99 i säkerhet på
 * varje siffra. En andra, oberoende läsning av bara datumfältet (förstorat,
 * bara siffror tillåtna) säger emot när siffrorna är tvetydiga, och då märks
 * datumet "Kontrollera". Returnerar ordet som ska räknas som osäkert, eller null.
 */
async function rereadDate(reading) {
  const { source, digitWords } = reading;
  if (!source || typeof document === 'undefined' || !digitWords?.length) return null;
  const { dateText } = parseReceiptText(reading.text, { confidence: reading.confidence });
  if (!dateText) return null;
  const digits = (t) => String(t).replace(/\D/g, '');
  const wanted = digits(dateText);
  const word = digitWords.find(w => digits(w.text).length >= 4 && (wanted.includes(digits(w.text)) || digits(w.text).includes(wanted)));
  if (!word?.bbox) return null;
  const { x0, y0, x1, y1 } = word.bbox;
  const h = y1 - y0;
  const pad = Math.round(h * 0.5);
  const sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad);
  const sw = Math.min(source.width - sx, x1 - x0 + pad * 2), sh = Math.min(source.height - sy, h + pad * 2);
  if (sw <= 0 || sh <= 0) return null;
  // Förstorat till ungefär 48 px teckenhöjd, som Tesseract läser bäst.
  const scale = Math.min(4, Math.max(1, 48 / Math.max(1, h)));
  const crop = document.createElement('canvas');
  crop.width = Math.round(sw * scale);
  crop.height = Math.round(sh * scale);
  const ctx = crop.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789-/.:' });
    const { data } = await worker.recognize(crop);
    const again = digits(data.text);
    return again.length >= 4 && again !== digits(word.text) ? word.text : null;
  } catch (err) {
    console.warn('[OCR] Kunde inte läsa om datumet:', err);
    return null;
  } finally {
    await worker.terminate();
  }
}

/**
 * Logotypens ruta i bilden: en grupp STORA tecken i övre delen. Mörka
 * sammanhängande fläckar letas upp; de som är mycket högre än vanlig text
 * (och inte är tunna streck, som en pennmarkering i kanten) och ligger på
 * samma höjd bildar logotypen. Returnerar { x0, y0, x1, y1 } i bildens
 * punkter, eller null. Exporterad för testerna.
 */
export function logoBox(gray, w, h, dark = 110) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comps = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || gray[start] >= dark) continue;
    let top = 0; stack[top++] = start; seen[start] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    while (top > 0) {
      const i = stack[--top]; n++;
      const x = i % w; const y = (i / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !seen[i - 1] && gray[i - 1] < dark) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && !seen[i + 1] && gray[i + 1] < dark) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && !seen[i - w] && gray[i - w] < dark) { seen[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && !seen[i + w] && gray[i + w] < dark) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    if (n >= 4) comps.push({ x0, y0, x1: x1 + 1, y1: y1 + 1, n });
  }
  // Vanlig texthöjd: medianen av fläckar som ser ut som tecken.
  const glyphs = comps.filter(c => (c.y1 - c.y0) >= 4 && (c.x1 - c.x0) <= (c.y1 - c.y0) * 3);
  if (glyphs.length < 20) return null;
  const hs = glyphs.map(c => c.y1 - c.y0).sort((a, b) => a - b);
  const median = hs[Math.floor(hs.length / 2)];
  const big = glyphs.filter(c => {
    const ch = c.y1 - c.y0; const cw = c.x1 - c.x0;
    return c.y0 < h * 0.3 && ch >= median * 2 && cw >= ch * 0.25 && c.n >= ch * cw * 0.15;
  });
  if (big.length === 0) return null;
  // Den översta gruppen stora tecken på samma höjd.
  big.sort((a, b) => a.y0 - b.y0);
  const first = big[0];
  const row = big.filter(c => c.y0 < first.y1 && c.y1 > first.y0);
  return {
    x0: Math.min(...row.map(c => c.x0)), y0: Math.min(...row.map(c => c.y0)),
    x1: Math.max(...row.map(c => c.x1)), y1: Math.max(...row.map(c => c.y1)),
  };
}

/**
 * Logotypen överst på kvittot. Butikens namn står ofta bara som grafik (Coop,
 * ICA, Lidl) och vanlig avläsning ser den inte som text, så leverantören blev
 * orten på raden under ("Kagerod"). Logotypens stora tecken läses för sig,
 * i lagom storlek och som en enda rad. Ett ord som inte är en känd butik
 * används bara om det är ett rent, säkert läst ord.
 */
async function readLogo(source) {
  if (!source || typeof document === 'undefined') return null;
  const scan = Math.min(1, 900 / source.width);
  const w = Math.max(1, Math.round(source.width * scan));
  const h = Math.max(1, Math.round(source.height * scan));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  small.getContext('2d').drawImage(source, 0, 0, w, h);
  const box = logoBox(grayscaleOf(small), w, h);
  if (!box) return null;
  const logo = { y0: box.y0, y1: box.y1 };
  const x0 = box.x0; const x1 = box.x1;
  // Lite luft runt om, men inte så mycket att raden under kommer med.
  const padX = Math.round((logo.y1 - logo.y0) * 0.3); const padY = Math.round((logo.y1 - logo.y0) * 0.08);
  const sx = Math.max(0, x0 - padX) / scan; const sy = Math.max(0, logo.y0 - padY) / scan;
  const sw = Math.min(w, x1 + padX) / scan - sx; const sh = Math.min(h, logo.y1 + padY) / scan - sy;
  const scale = 90 / Math.max(1, (logo.y1 - logo.y0) / scan);
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.round(sw * scale)); crop.height = Math.max(1, Math.round(sh * scale));
  const ctx = crop.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const { data } = await worker.recognize(crop);

    const word = String(data.text || '').replace(/[^\p{L}\p{N}&' -]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!word || word.length < 2 || word.length > 30 || !/\p{L}{2}/u.test(word)) return null;
    if (matchKnownSupplierFuzzy([word], 1)) return word;
    // Ett okänt ord måste vara säkert läst, minst fyra bokstäver och inte ett
    // vanligt kvittoord (en suddig bild gav annars leverantören "Kort").
    if (/^(?:kort|kvitto|kassa|total\w*|summa|moms|datum|tack|kopia|butik|org|tel|kund\w*)$/i.test(word)) return null;
    return (data.confidence >= 85 && /^[\p{L}&' -]{4,}$/u.test(word)) ? word : null;
  } catch (err) {
    console.warn('[OCR] Kunde inte läsa logotypen:', err);
    return null;
  } finally {
    await worker.terminate();
  }
}

/**
 * Hur mycket en avläsning gav: används för att välja mellan två försök. Ett
 * belopp som är kontrollerat mot momsen väger tyngst — det är det fältet som
 * blir fel bokföring om det är fel. Tesseracts egen säkerhet får vara
 * tungan på vågen när fälten är lika.
 */
function readingScore({ text, confidence }) {
  if (isUnreadableText(text)) return -10;
  const parsed = parseReceiptText(text, { confidence });
  if (parsed.notReceipt) return -5 + (confidence || 0) / 1000;
  let score = 0;
  if (parsed.amount) score += parsed.amountVerified ? 5 : (parsed.amountGuessed ? 1 : 3);
  if (parsed.vatVerified) score += 2;
  if (parsed.date) score += 1;
  if (parsed.receiptNumber) score += 1;
  if (parsed.supplierMatched) score += 1;
  return score + (confidence || 0) / 1000;
}

/**
 * Kör Tesseract OCR på en bild eller canvas i webbläsaren. Returnerar även
 * Tesseracts EGEN säkerhet på avläsningen (0–100, `data.confidence`) —
 * tidigare kastades den bort och bara texten returnerades, vilket gjorde
 * det omöjligt att skilja en riktig, tydligt läst text som råkar sakna
 * kvitto-ord (ett kontrakt, ett brev) från en genuint dålig avläsning
 * (för suddigt, mörkt eller utzoomat foto) som råkade producera lite
 * sammanhangslöst brus i stället för att bli helt tom. Se classifyDocument/
 * parseReceiptText nedan, som är just den skillnaden byggd för att fånga.
 *
 * Dessutom: kvittot klipps ut ur fotot och läses i full upplösning (se
 * stageImage/renderStage), och gav det första försöket inget belopp att lita på
 * görs ett andra försök på en större bild som ETT textblock (sidläge 6, som
 * passar ett smalt kvitto bättre än Tesseracts spaltletande förval). Det bästa
 * av försöken används, och bildens mätvärden följer med tillbaka (`quality`) så
 * att appen kan säga varför det inte gick och vad användaren kan göra åt det.
 */
async function extractTextFromImage(imageSource, onProgress, { quad = null } = {}) {
  onProgress?.('Startar OCR-motor…');
  const stage = await stageImage(imageSource, { quad });
  if (!stage) {
    // Ingen canvas att arbeta med (mycket gammal webbläsare): läs originalet.
    const { source: _source, digitWords: _words, ...only } = await recognizeWith(imageSource, onProgress);
    return { ...only, quality: null };
  }
  // Två oberoende avläsningar: olika storlek och olika sätt att dela upp
  // sidan ger fel på olika ställen, och sammanvägningen (mergeReadings) tar
  // varje fält från den avläsning där det går ihop. Den andra kostar några
  // sekunder; rätt svar är värt dem.
  const first = renderStage(stage, MAX_OCR_DIMENSION);
  const a = await recognizeWith(first.source, onProgress);
  onProgress?.('Läser av en gång till och jämför…');
  const second = renderStage(stage, CAREFUL_OCR_DIMENSION);
  const b = await recognizeWith(second.source, onProgress, { psm: '6', label: 'Läser av noggrant' });
  let readings = [{ r: a, quality: first.quality }, { r: b, quality: second.quality }];
  // Gav ingen av läsningarna ett belopp att lita på kan utklippningen ha tagit
  // fel del av bilden (en ljus vägg i stället för kvittot). Då provas andra
  // utklipp: där bilden ser ut som text, och hela bilden. Den som ger ett
  // kvitto vinner, precis som en människa letar tills hon hittar texten.
  if (!quad && Math.max(readingScore(a), readingScore(b)) < 3) {
    const alternatives = [];
    try { const t = textRegionBounds(stage.base); if (t) alternatives.push({ ...stage, quad: null, bounds: t }); } catch { /* hoppa över */ }
    alternatives.push({ ...stage, quad: null, bounds: null });
    for (const alt of alternatives) {
      onProgress?.('Letar efter kvittot i bilden…');
      const rendered = renderStage(alt, CAREFUL_OCR_DIMENSION);
      readings.push({ r: await recognizeWith(rendered.source, onProgress, { label: 'Letar efter kvittot' }), quality: rendered.quality });
    }
  }
  readings = readings.map(x => ({ ...x, score: readingScore(x.r) })).sort((x, y) => y.score - x.score);
  const best = readings[0].r;
  const other = readings[1].r;
  const quality = readings[0].quality;
  const doubtful = await rereadDate(best);
  let logo = null;
  try { logo = await readLogo(best.source); } catch { logo = null; }
  // Logotypen läggs först i texten, där butikens namn hade stått i text.
  const withLogo = (text) => (logo && !String(text).toLowerCase().startsWith(logo.toLowerCase()) ? `${logo}
${text}` : text);
  const { source: _source, digitWords: _words, ...result } = best;
  if (doubtful) result.weakTokens = [...(result.weakTokens || []), doubtful];
  result.text = isUnreadableText(other.text)
    ? withLogo(result.text)
    : withLogo(result.text) + READING_SEPARATOR + withLogo(other.text);
  return { ...result, quality };
}

/**
 * Bara för felsökning (scripts/ocr-harness.html): bilden som Tesseract faktiskt
 * får se, efter utklippning, uträtning och förbättring. Att kunna titta på DEN
 * är skillnaden mellan att gissa varför en avläsning blev fel och att se det.
 */
export async function __debugPrepareImage(imageSource, target = MAX_OCR_DIMENSION) {
  const stage = await stageImage(imageSource);
  return stage ? renderStage(stage, target).source : null;
}

/**
 * Kör OCR på en kvittofil (URL, Blob eller File) direkt på klienten.
 * @param {File|Blob|string} input — Fil, Blob eller URL till bild/PDF
 * @param {Function} [onProgress] — Callback för statusuppdateringar, t.ex. (msg) => setMsg(msg)
 * @returns {Promise<{text: string, confidence: number|null, quality: object|null}>}
 *   Extraherad text, Tesseracts avläsningssäkerhet (0–100) och bildens
 *   mätvärden (skärpa, kontrast, ljus, hur stor del av fotot kvittot var, samt
 *   `advice`: 'blurry' | 'dark' | 'far' | null). Säkerheten och mätvärdena är
 *   `null` när ingen bild-OCR kördes alls (digital PDF-text — exakt, ingen
 *   osäkerhet att ange).
 * @param {{quad?: Array<{x:number,y:number}>}} [options] — egna hörn från
 *   Justera kanter (andelar 0–1, se prepareCornerEditor). Ersätter den
 *   automatiska utklippningen, och en PDF läses då som bild.
 */
export async function ocrFile(input, onProgress, { quad = null } = {}) {
  const { blob, isPdf } = await loadDocumentBlob(input, onProgress);

  if (isPdf) {
    // 1. Snabb direkt-extrahering för digitala PDF-fakturor — exakt text,
    // ingen OCR-osäkerhet att ange.
    if (!quad) {
      const text = await extractTextFromPdf(blob, onProgress);
      if (text && text.length >= 15) {
        return { text, confidence: null, quality: null };
      }
    }

    // 2. Om PDF:en var ett skannat papperskvitto utan textlager, rendera sida 1 och kör OCR
    if (typeof document !== 'undefined') {
      try {
        onProgress?.('Skannad PDF — kör bild-OCR…');
        const canvas = await renderPdfPageToCanvas(blob);
        return await extractTextFromImage(canvas, onProgress, { quad });
      } catch (err) {
        console.warn('[OCR] Kunde inte rendera PDF till canvas:', err);
      }
    }
  }

  // 3. Bildkvitto (JPG, PNG, WEBP etc.)
  return await extractTextFromImage(blob, onProgress, { quad });
}

/**
 * Bilden och de hörn avläsningen själv skulle ha använt, för Justera kanter.
 * Hörnen är andelar (0–1) av samma bild som avläsningen arbetar på, så det
 * användaren drar ut kan skickas rakt tillbaka till ocrFile(…, { quad }).
 * Hittas ingen form föreslås hela bilden: en skärmdump eller ett foto tätt
 * inpå kvittot ska inte beskäras bara för att rutan öppnades, och den grova
 * rektangeln som avläsningen annars klipper efter kan vara långt fel.
 * Returnerar { imageUrl, width, height, quad }, eller null om bilden inte går
 * att läsa i den här webbläsaren.
 */
export async function prepareCornerEditor(input) {
  const { blob, isPdf } = await loadDocumentBlob(input);
  const source = isPdf ? await renderPdfPageToCanvas(blob) : blob;
  const stage = await stageImage(source);
  if (!stage) return null;
  const { base, quad } = stage;
  // Förhandsbilden behöver inte full upplösning.
  const scale = Math.min(1, 1400 / Math.max(base.width, base.height));
  const preview = document.createElement('canvas');
  preview.width = Math.max(1, Math.round(base.width * scale));
  preview.height = Math.max(1, Math.round(base.height * scale));
  preview.getContext('2d').drawImage(base, 0, 0, preview.width, preview.height);
  return {
    imageUrl: preview.toDataURL('image/jpeg', 0.85),
    width: preview.width,
    height: preview.height,
    quad: quad || [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
  };
}

/** Hämtar dokumentet (fil, data-URL eller lagrad URL) och avgör om det är en PDF. */
async function loadDocumentBlob(input, onProgress) {
  let blob;
  let isPdfHint = false;

  if (input instanceof Blob || input instanceof File) {
    blob = input;
    isPdfHint = blob.type === 'application/pdf' || (input.name && input.name.toLowerCase().endsWith('.pdf'));
  } else if (typeof input === 'string') {
    isPdfHint = input.toLowerCase().includes('.pdf');
    if (input.startsWith('data:')) {
      const res = await fetch(input);
      blob = await res.blob();
    } else {
      // Hämta via URL (t.ex. från Supabase Storage)
      onProgress?.('Hämtar kvittofil…');
      const fetchUrl = await getSignedStorageUrl(input);
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Kunde inte hämta kvittot (${res.status})`);
      blob = await res.blob();
    }
  } else {
    throw new Error('ocrFile: input måste vara en File, Blob eller URL');
  }

  // Detektera PDF antingen via MIME, namn eller magiska PDF-bytes (%PDF)
  let isPdf = isPdfHint || blob.type === 'application/pdf';
  if (!isPdf && blob.size > 5) {
    try {
      const slice = await blob.slice(0, 5).text();
      if (slice.startsWith('%PDF')) isPdf = true;
    } catch {
      // ignorera slice-fel
    }
  }
  return { blob, isPdf };
}

/**
 * Version på hur en avläsning tolkas. Ett sparat utkast (ocrDraft) från en äldre
 * version används inte längre: kvittot tolkas om (av den redan lästa texten om
 * den finns i cachen, annars läses det om) så att förbättringar i tolkningen,
 * till exempel av ordernumret, når kvitton som skannades innan de fanns.
 */
export const OCR_DRAFT_VERSION = 4;

const round2 = (v) => Math.round(v * 100) / 100;
const VAT_RATES = [25, 12, 6];

/**
 * Kontrollerar momsen mot beloppen på kvittot. En momsrad ("Varav moms
 * 12%: 11,29") ger momsbeloppet, och tillsammans med totalbeloppet går det
 * att räkna ut vilken momssats det faktiskt är: 105,40 kr med 11,29 kr moms
 * är 12 %. Stämmer beloppen mot en av Sveriges satser (25, 12, 6) inom några
 * ören är momsen VERIFIERAD, och satsen läses ur siffrorna i stället för att
 * gissas. Säger kvittot en sats men siffrorna en annan vinner siffrorna, och
 * stämmer ingen sats flaggas det som en avvikelse som ska kontrolleras.
 * Utländsk valuta och kvitton utan momsrad kontrolleras inte.
 */
export function crossCheckVat({ lines, amount, vatRate, vatRateGuessed, currency }) {
  const none = { vatRate: null, vatAmount: null, verified: false, mismatch: false, equalsAmount: false };
  // `amount` får vara tomt: då gick totalraden inte att läsa, och momsbeloppet
  // hämtas ändå hem så att totalen kan räknas fram ur det (totalFromVatAmount).
  // Utländsk valuta kontrolleras aldrig — då är momsen inte svensk.
  if (currency || (amount !== null && amount !== undefined && amount <= 0)) return none;
  const hasTotal = Boolean(amount);

  const expected = (rate) => round2(amount - amount / (1 + rate / 100));
  // Vilken svensk momssats ett momsbelopp svarar mot för kvittots totalbelopp,
  // eller undefined. Några ören i tolerans: kvitton avrundar per rad, inte på
  // totalen.
  const rateFor = (vat, lineCount = 1) => {
    const tolerance = Math.max(0.05, 0.005 * lineCount);
    return VAT_RATES.find(r => Math.abs(expected(r) - vat) <= tolerance);
  };

  // ── 1. Momstabellen ───────────────────────────────────────────────────────
  // En rad med siffror som GÅR IHOP mot totalen är det starkaste beviset som
  // finns på ett kvitto, starkare än ordet "moms" på en rad: "6,00 1,36 22,64
  // 24,00" (sats, moms, netto, brutto på Dollarstores kvitton) eller "25%
  // 719,20 179,80 899,00" (sats, netto, moms, totalt). Två av talen summerar
  // till det tredje, och det tredje är kvittots totalbelopp. Momsen är det
  // MINSTA av de två — netto är alltid störst vid svenska satser — och raden
  // godtas bara om momsen den ger faktiskt svarar mot en svensk sats, så en
  // slumpmässig rad som råkar gå ihop inte kan ställa till något.
  // Varje rad i en momstabell, som { vat, gross, rate }: två tal som summerar
  // till ett tredje, där momsen (det minsta) svarar mot en svensk sats för det
  // tredje. Används både för kvitton med EN sats (raden gäller hela kvittot)
  // och för kvitton med FLERA (raderna delar upp kvittot).
  const tableRows = [];
  for (const line of lines || []) {
    const tokens = (stripNonAmounts(line).match(MONEY_DECIMAL_RE) || []).map(parseMoneyToken).filter(v => v !== null);
    for (let i = 0; i + 2 < tokens.length; i++) {
      const [a, b, gross] = [tokens[i], tokens[i + 1], tokens[i + 2]];
      if (a <= 0 || b <= 0 || gross <= 0) continue;
      if (Math.abs(round2(a + b) - gross) > 0.02) continue;
      const vat = Math.min(a, b);
      const rate = VAT_RATES.find(r => Math.abs(round2(gross - gross / (1 + r / 100)) - vat) <= 0.05);
      if (rate !== undefined) { tableRows.push({ vat, gross, rate }); break; }
    }
  }

  if (hasTotal) {
    // En rad som gäller hela kvittot: den är facit.
    const whole = tableRows.find(row => Math.abs(row.gross - amount) <= 0.05);
    if (whole) return { vatRate: whole.rate, vatAmount: whole.vat, verified: true, mismatch: false, equalsAmount: false };

    // Flera satser på samma kvitto (mat 12 % och hushåll 25 % i samma
    // matbutik är det vanligaste kvittot som finns). Går tabellens rader ihop
    // till kvittots totalbelopp är momsen avläst och kontrollerad — den är
    // bara inte EN sats, och det måste sägas rakt ut i stället för att
    // avfärdas som en avvikelse: förut flaggades ett helt korrekt Coop-kvitto
    // som "momsen stämmer inte", vilket är både fel och oroande.
    if (tableRows.length >= 2) {
      const grossSum = round2(tableRows.reduce((s, r) => s + r.gross, 0));
      if (Math.abs(grossSum - amount) <= 0.05) {
        const rates = [...new Set(tableRows.map(r => r.rate))].sort((a, b) => b - a);
        const vatSum = round2(tableRows.reduce((s, r) => s + r.vat, 0));
        if (rates.length > 1) {
          return {
            vatRate: null, vatAmount: vatSum, rates, mixed: true,
            verified: false, mismatch: false, equalsAmount: false,
          };
        }
        return { vatRate: rates[0], vatAmount: vatSum, verified: true, mismatch: false, equalsAmount: false };
      }
    }
  }

  // ── 2. Momsrader ──────────────────────────────────────────────────────────
  const found = [];
  for (const line of lines || []) {
    if (!looksLikeMoms(line) && !/merv.rdes|\bvat\b|\bmva\b/i.test(line)) continue;
    // "Summa exkl. moms 800,00" är underlaget, inte momsen.
    if (/exkl|excl|netto|f[öo]re moms|before tax|subtotal|delsumma|underlag/i.test(line)) continue;
    // "Momsreg.nr SE556…" och "VAT No" är ett registreringsnummer, inte moms.
    if (/momsreg|moms\s*(?:reg\.?)?\s*nr|vat\s*(?:no|nr|number|id|reg)/i.test(line)) continue;
    // "MOMSBRUTTO 15,00" och "Totalt inkl. moms 125,00" är beloppet momsen
    // räknas på respektive hela summan — inte momsen.
    if (/brutto|underlag|inkl\.?\s*moms|incl\.?\s*(?:vat|tax)|att betala/i.test(line)) continue;
    // Beloppen på raden, utan procenttalet ("12%"). Heltal räknas med här:
    // "Moms 25% 3" utan decimaler och utan kr är den vanligaste formen på ett
    // litet butikskvitto, och gav tidigare ingen momskontroll alls. Momsen får
    // vara lika stor som beloppet vi läste — då är det BELOPPET som är felläst
    // (se equalsAmount nedan), inte momsen som är orimlig.
    const money = amountsOnLine(line).filter(v => !hasTotal || v <= amount);
    if (money.length === 0) continue;
    // Sista beloppet på raden är momsbeloppet (först kan underlaget ligga).
    // Raden sparas med vad den säger om sig själv: är den kvittots SUMMERADE
    // moms ("TOTAL MOMS"), och vilken sats den i så fall gäller.
    const rateOnLine = line.match(/(\d{1,2})\s*%/);
    found.push({
      value: money[money.length - 1],
      isTotal: /total|summa/i.test(line),
      rate: rateOnLine ? parseInt(rateOnLine[1], 10) : null,
    });
  }
  if (found.length === 0) return none;

  // ── 3. Vilket av beloppen är momsen? ──────────────────────────────────────
  // Ett kvitto skriver ofta SAMMA moms på flera rader: "MOMS 1 3,00" och
  // "TOTAL MOMS 3,00" är tre kronor, inte sex. Att summera alla momsrader (som
  // tidigare) dubbelräknade dem — precis det gjorde att ett kvitto på 15 kr med
  // 3 kr moms visade 6 kr i appen. Samtidigt SKA ett kvitto med flera satser
  // summeras ("Moms 25% 4,80" + "Moms 12% 1,20" = 6,00). Raderna får därför
  // avgöra själva:
  //   • säger en rad att den är kvittots summerade moms ("TOTAL MOMS") är det
  //     den som gäller, ensam,
  //   • nämner raderna OLIKA satser är det en momstabell som ska summeras,
  //   • annars är det samma moms upprepad: lika belopp räknas en gång.
  const candidates = [];
  const addCandidate = (v) => { if (v > 0 && !candidates.some(c => Math.abs(c - v) < 0.005)) candidates.push(v); };
  const totalLine = found.find(f => f.isTotal);
  const rates = new Set(found.map(f => f.rate).filter(r => r !== null));

  // Flera momssatser utan momstabell: "Moms 25% 25,80" och "Moms 6% 2,21" på
  // var sin rad. Varje rad säger sin sats, och ur sats och momsbelopp följer
  // vad den raden gällde ("25,80 med 25 % moms" betyder 129,00 kr av köpet).
  // Summerar de till kvittots totalbelopp är momsen avläst och stämmer — den
  // är bara uppdelad. Utan det här såg ett helt korrekt apotekskvitto ut som
  // en avvikelse.
  if (hasTotal && rates.size > 1) {
    const perRate = found.filter(f => f.rate && !f.isTotal);
    if (perRate.length >= 2) {
      const grossSum = round2(perRate.reduce((s, f) => s + (f.value * (100 + f.rate)) / f.rate, 0));
      if (Math.abs(grossSum - amount) <= 0.05 * perRate.length) {
        return {
          vatRate: null,
          vatAmount: round2(perRate.reduce((s, f) => s + f.value, 0)),
          rates: [...new Set(perRate.map(f => f.rate))].sort((a, b) => b - a),
          mixed: true, verified: false, mismatch: false, equalsAmount: false,
        };
      }
    }
  }
  if (totalLine) {
    addCandidate(totalLine.value);
  } else if (rates.size > 1) {
    addCandidate(round2(found.reduce((s, f) => s + f.value, 0)));
  } else {
    const unique = [];
    found.forEach(f => { if (!unique.some(v => Math.abs(v - f.value) < 0.005)) unique.push(f.value); });
    addCandidate(round2(unique.reduce((s, v) => s + v, 0)));
    [...unique].sort((a, b) => b - a).forEach(addCandidate);
  }
  if (candidates.length === 0) return none;

  // Ingen total att kontrollera mot: alla kandidater lämnas tillbaka, så att
  // totalen kan räknas fram ur dem (totalFromVatAmount i parseReceiptText).
  if (!hasTotal) return { vatRate: null, vatAmount: candidates[0], candidates, verified: false, mismatch: false, equalsAmount: false };

  for (const candidate of candidates) {
    if (candidate >= amount) continue;
    const rate = rateFor(candidate, found.length);
    if (rate !== undefined) return { vatRate: rate, vatAmount: candidate, candidates, verified: true, mismatch: false, equalsAmount: false };
  }

  // Ingen kandidat går ihop med beloppet. Är momsen till och med lika stor som
  // "totalen" är det momsraden som lästes som totalbelopp: momsen lämnas
  // tillbaka så att den riktiga totalen kan räknas fram ur den.
  const vatAmount = candidates.find(c => c < amount) ?? candidates[0];
  if (vatAmount >= amount) return { vatRate: null, vatAmount, candidates, verified: false, mismatch: false, equalsAmount: true };
  // Ingen sats stämmer. Har kvittot ändå en uttalad sats är det en avvikelse.
  return { vatRate: null, vatAmount, candidates, verified: false, mismatch: !vatRateGuessed || vatRate !== null, equalsAmount: false };
}

/**
 * Räknar fram TOTALBELOPPET ur momsbeloppet på kvittot. Momsraden står oftast
 * tydligt tryckt, och står den rätt går totalen att räkna ut: 3 kr moms med
 * 25 % betyder 15 kr totalt, med 12 % 28 kr och med 6 % 53 kr. Bara den sats
 * vars total FAKTISKT finns som ett belopp i texten godtas, och bara när exakt
 * en sats gör det — annars vore det en gissning, och en gissning fylls inte i
 * (se parseReceiptText).
 *
 * Det här är nätet under en felläst totalrad: "TOTALT 24" som OCR läst som
 * "TOTALT 2h", eller ett kvitto där totalraden hamnat i ett veck. Momsen på
 * kvittot blir då facit, i stället för att appen visar en moms som inte står
 * någonstans på kvittot — kundfeedback, uttryckligt: "kvittot säger 3 kr moms
 * och appen säger 6".
 */
export function totalFromVatAmount(vatAmount, values) {
  if (!vatAmount || vatAmount <= 0 || !Array.isArray(values)) return null;
  const hits = [];
  for (const rate of VAT_RATES) {
    const implied = round2((vatAmount * (100 + rate)) / rate);
    const hit = values.find(v => Math.abs(v - implied) <= 0.05);
    if (hit) hits.push({ rate, amount: hit });
  }
  return hits.length === 1 ? hits[0] : null;
}

// Nyckelord som föregår ett nummer på ett kvitto eller en faktura, i
// prioritetsordning. Ett fakturanummer är mer entydigt än ett kvittonummer,
// som är mer entydigt än ett ordernummer och så vidare. Hittas inget av de
// första används de senare, så ett kvitto som bara har ett ordernummer får
// just det, med rätt benämning, i stället för inget alls.
const NUMBER_KINDS = [
  { kind: 'faktura', label: 'Fakturanummer', re: /faktura\s*-?\s*(?:nr|nummer|no|id)?\.?|invoice\s*-?\s*(?:no|nr|number|id|#)?\.?/i },
  { kind: 'kvitto', label: 'Kvittonummer', re: /kvitto\s*-?\s*(?:nr|nummer|no|id)?\.?|receipt\s*-?\s*(?:no|nr|number|id|#)?\.?/i },
  { kind: 'order', label: 'Ordernummer', re: /order\s*-?\s*(?:nr|nummer|no|number|id|referens|ref|#)?\.?|best[aä]llnings\s*-?\s*(?:nr|nummer|id)\.?|best[aä]llning\s*-?\s*(?:nr|nummer|id)\.?|best\.?\s*nr\.?/i },
  { kind: 'bokning', label: 'Bokningsnummer', re: /boknings\s*-?\s*(?:nr|nummer|id|referens|ref)\.?|booking\s*-?\s*(?:no|nr|number|id|ref|reference)\.?/i },
  { kind: 'transaktion', label: 'Transaktionsnummer', re: /transaktions\s*-?\s*(?:nr|nummer|id|referens|ref)\.?|transaction\s*-?\s*(?:no|nr|number|id|ref|reference)\.?/i },
  { kind: 'bon', label: 'Bonnummer', re: /bon\s*-?\s*(?:nr|nummer)\.?|nota\s*-?\s*(?:nr|nummer)?\.?|k[oö]p\s*-?\s*(?:nr|nummer|id)\.?/i },
  // ICA: 'Kassa: 03 Nr: 5790'. Ett ensamt Nr med kolon är kvittots nummer.
  { kind: 'kvitto', label: 'Kvittonummer', re: /(?<![A-Za-zÅÄÖåäö.])nr(?=\s*:)/ },
  { kind: 'referens', label: 'Referensnummer', re: /referens\s*-?\s*(?:nr|nummer)?\.?|reference\s*-?\s*(?:no|nr|number)\.?|ref\.?\s*-?\s*(?:nr|nummer|no)\.?/i },
];
// Kortterminalens rader (Anbud, referens, MID, TID, Streckkod) innehåller långa
// koder som ser ut som nummer men aldrig är kvittots eget: de hoppas över.
const NOT_A_NUMBER_LINE_RE = /org\.?\s*nr|orgnr|\btel\b|telefon|phone|moms(?:reg)?\.?\s*nr|vat\s*(?:no|nr|number|id)|kund\s*-?\s*(?:nr|nummer)|customer\s*(?:no|nr|number|id)|personnummer|bankgiro|plusgiro|\biban\b|\banbud\b|streckkod|\bmid\b|\bptid\b|\btid\b(?!\s*:?\s*\d{1,2}[:.]\d{2})|terminal|korttyp/i;
const NUMBER_TOKEN = '([A-Za-z0-9#][A-Za-z0-9\\-/]{2,29})';
// Efter numret får inte en valuta, en enhet eller ett procenttecken följa:
// "Order 250 kr" är ett belopp, inte ett ordernummer.
const NOT_FOLLOWED_BY_UNIT = '(?![\\w])(?!\\s*(?:kr\\b|sek\\b|st\\b|:-|%|usd\\b|eur\\b|gbp\\b))';

function acceptableNumber(token) {
  if (!token) return null;
  const t = token.replace(/^#/, '');
  if (t.length < 3 || !/\d/.test(t)) return null;
  if (/^(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(t)) return null;
  if (/^\d{6}-\d{4}$/.test(t)) return null; // org.-/personnummer med bindestreck
  // Datum och klockslag där OCR tappat tecknen emellan: 2026-05-26 18:34 blir 202605261834.
  if (/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:[01]\d|2[0-3])[0-5]\d(?:[0-5]\d)?$/.test(t)) return null;
  // En lång hex-sträng med både siffror och bokstäver är en kortterminalens
  // referens eller en hash, inte ett kvittonummer.
  if (/^(?=.*[a-f])(?=.*\d)[0-9a-f]{16,}$/i.test(t)) return null;
  return t;
}

// ── Felaktigt lästa etiketter ────────────────────────────────────────────
// OCR på ett foto läser ofta "Ordernummer" som "Ordermummer" (n blir m),
// "Orgernummer" eller "0rdernummer", och då hittar inte etikettmönstren
// ovan någonting. Ett ord som ligger högst två tecken från en känd etikett
// rättas därför till etiketten innan numret letas upp. Bara långa ord
// (minst 10 tecken) rättas, så ett vanligt ord aldrig av misstag blir en etikett.
const FUZZY_LABEL_WORDS = ['ordernummer', 'fakturanummer', 'kvittonummer', 'beställningsnummer', 'bestallningsnummer'];
// Tecken som OCR förväxlar: kostar ingenting att byta mot varandra.
const OCR_LOOKALIKES = { '0': 'o', '1': 'l', 'i': 'l', '5': 's', '8': 'b', '6': 'g' };
const fold = (ch) => OCR_LOOKALIKES[ch] || ch;

// Ord som bara en kedja skriver på sina kvitton. Matchas tåligt mot
// felläsning (en bokstav fel per sex tecken).
const CHAIN_FINGERPRINTS = [
  { chain: 'ICA', words: ['bonusgrundande', 'stammiskort', 'ica-kort', 'supermarket', 'kvantum'] },
  { chain: 'Coop', words: ['poänggrundande', 'poanggrundande', 'medmera', 'coop-appen'] },
  { chain: 'Willys', words: ['willys'] },
  { chain: 'Hemköp', words: ['hemköpskortet', 'hemkopskortet'] },
  { chain: 'Lidl', words: ['lidl'] },
];

/** Kedjan som kvittots egna ord pekar på, eller null. Exporterad för testerna. */
export function chainFromFingerprint(text) {
  const words = String(text || '').toLowerCase().split(/[^a-zåäö-]+/).filter(w => w.length >= 5);
  for (const { chain, words: marks } of CHAIN_FINGERPRINTS) {
    for (const mark of marks) {
      const limit = mark.length >= 10 ? 2 : Math.floor(mark.length / 6);
      if (words.some(w => Math.abs(w.length - mark.length) <= limit && labelDistance(w, mark, limit) <= limit)) return chain;
    }
  }
  return null;
}

function labelDistance(word, target, limit) {
  if (Math.abs(word.length - target.length) > limit) return limit + 1;
  const prev = Array.from({ length: target.length + 1 }, (_, j) => j);
  for (let i = 1; i <= word.length; i++) {
    let last = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= target.length; j++) {
      const cost = fold(word[i - 1]) === fold(target[j - 1]) ? 0 : 1;
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + cost);
      last = tmp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > limit) return limit + 1;
  }
  return prev[target.length];
}

/** Rättar felstavade etiketter ("Ordermummer") till den riktiga ("Ordernummer"). */
export function repairNumberLabels(lines) {
  return (lines || []).map(line => String(line)
    // Den korta etiketten "Kvittonr" först på raden, följd av ett långt nummer
    // ("Keittons 100234"): två fel tecken tillåts bara just där.
    .replace(/^(\s*)([A-Za-zÅÄÖåäö]{7,9})(?=[:.]?\s+\d{5,})/, (m, space, word) => (
      labelDistance(word.toLowerCase(), 'kvittonr', 2) <= 2 ? `${space}Kvittonr` : m))
    .replace(/[A-Za-zÅÄÖåäö0-9]{10,}/g, (word) => {
    const lower = word.toLowerCase();
    if (FUZZY_LABEL_WORDS.includes(lower)) return word;
    // Ett ord som är mest siffror är ett nummer, inte en etikett.
    if ((lower.match(/\d/g) || []).length > 2) return word;
    for (const target of FUZZY_LABEL_WORDS) {
      if (labelDistance(lower, target, 2) <= 2) return target.charAt(0).toUpperCase() + target.slice(1);
    }
    return word;
  }));
}

// ── Ett nummer som upprepas ───────────────────────────────────────────────
// Ordernumret står ofta två gånger: högt upp och sedan igen i kortköpets
// referens ("...-2302039269"). När etiketten inte gick att läsa är det ett
// starkt tecken att en lång siffersträng förekommer på minst två rader. Inte
// telefonnummer, datum, giltiga org.-/personnummer (Luhn) eller kortterminalens
// rader räknas.
function luhnValid(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[i]);
    if ((digits.length - i) % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

function findRepeatedIdentifier(lines) {
  const seen = new Map(); // siffersträng -> antal rader
  const order = [];
  lines.forEach((line) => {
    if (NOT_A_NUMBER_LINE_RE.test(line) || /^\s*\+/.test(line)) return;
    const found = new Set();
    for (const m of String(line).matchAll(/(?<![\d+.,])(\d{8,14})(?![\d.,]\d)(?!\d)/g)) found.add(m[1]);
    found.forEach((digits) => {
      if (!seen.has(digits)) { seen.set(digits, 0); order.push(digits); }
      seen.set(digits, seen.get(digits) + 1);
    });
  });
  for (const digits of order) {
    if (seen.get(digits) < 2) continue;
    if (/^(?:07\d{8}|46\d{9,10})$/.test(digits)) continue;              // mobilnummer
    if (acceptableNumber(digits) === null) continue;                       // datum m.m.
    if (digits.length === 10 && luhnValid(digits)) continue;               // org.-/personnummer
    return { number: digits, kind: 'unknown', label: 'Nummer' };
  }
  return null;
}

// Sista utvägen när varken etikett eller upprepning hittades: en rad högt upp
// som bara består av en lång siffersträng (med högst ett kort brusord bredvid),
// som "2302039269" under Kvitto-rubriken. Bara de femton första raderna, och
// aldrig telefonnummer, datum, org.-/personnummer eller kortterminalens rader.
function findLoneHeaderNumber(lines) {
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = String(lines[i]).replace(/^[|~[\]¥\\/\s]+|[|~[\]¥\\/\s]+$/g, '');
    if (!line || NOT_A_NUMBER_LINE_RE.test(line)) continue;
    const m = line.match(/^(?:[^\d\s]{1,3}\s+)?(\d{9,14})(?:\s+[^\d\s]{1,7}){0,2}$/);
    if (!m) continue;
    const digits = m[1];
    if (/^(?:07\d{8}|46\d{9,10})$/.test(digits)) continue;
    if (acceptableNumber(digits) === null) continue;
    if (digits.length === 10 && luhnValid(digits)) continue;
    return { number: digits, kind: 'unknown', label: 'Nummer' };
  }
  return null;
}

/**
 * Kvitto-, faktura- eller ordernumret ur texten, med vilken sorts nummer det
 * var: `{ number, kind, label }`, eller null. Numret måste innehålla minst en
 * siffra och får inte vara ett datum, ett org.-/personnummer eller ett
 * belopp, så "Invoice" ensamt på en rad, "Order 2024-05-12" eller "Order
 * 250 kr" ger inget nummer. Står nyckelordet ensamt på en rad och numret på
 * raden under (som i tabeller och många PDF-fakturor) läses det därifrån.
 */
export function findReceiptNumberDetailed(lines) {
  const list = repairNumberLabels(lines || []);
  const labelled = findLabelledNumber(list);
  // Ett upprepat nummer går före ett svagt märkt (referens/transaktion): det är
  // oftast en kortterminals kod, inte kvittots eget nummer.
  if (!labelled || labelled.kind === 'referens' || labelled.kind === 'transaktion') {
    // Den ensamma siffersträngen används bara när ingen numeretikett alls gick att
    // läsa. Finns en etikett men numret bredvid den underkändes (ett datum, en rad
    // med fler ord emellan) är det ett medvetet nej, inte något att gissa fram.
    const hasLabel = list.some(line => /(?:order|faktura|kvitto|invoice|receipt|best[aä]llnings?)\s*-?\s*(?:nr|nummer|no|number|id)\b/i.test(line));
    return findRepeatedIdentifier(list) || labelled || (hasLabel ? null : findLoneHeaderNumber(list));
  }
  return labelled;
}

function findLabelledNumber(list) {
  for (const { kind, label, re } of NUMBER_KINDS) {
    const inline = new RegExp(`\\b(?:${re.source})[\\s:#.\\-]+${NUMBER_TOKEN}${NOT_FOLLOWED_BY_UNIT}`, 'i');
    const lead = new RegExp(`\\b(?:${re.source})[\\s:#.\\-]*`, 'i');
    for (let i = 0; i < list.length; i++) {
      const line = list[i];
      if (NOT_A_NUMBER_LINE_RE.test(line)) continue;
      // Alla förekomster på raden, med start ett tecken längre fram efter en
      // miss: en digital PDF ger en enda lång rad där "Faktura Fakturanummer
      // 100234" först matchar "Faktura" + "Fakturanummer" (ingen siffra).
      const scan = new RegExp(inline.source, 'gi');
      let m;
      let inlineNumber = null;
      while (!inlineNumber && (m = scan.exec(line))) {
        inlineNumber = acceptableNumber(m[1]);
        // 20260526 följt av ett klockslag (10.34) är datum och tid som OCR tappat
        // bindestrecken i, inte ett nummer. Ett 8-siffrigt fakturanummer som
        // 20240117 utan klockslag efter sig är däremot ett vanligt nummer.
        if (inlineNumber && /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(inlineNumber)
          && /^\s*\d{1,2}[.:]\d{2}/.test(line.slice(m.index + m[0].length))) inlineNumber = null;
        if (!inlineNumber) scan.lastIndex = m.index + 1;
      }
      if (inlineNumber) {
        // Numret delat av ett mellanslag ("Kvitto 21901 384216"): OCR har
        // klyvt ett långt nummer, ofta för att en siffra lästes fel. Bitarna
        // hör ihop, men numret är inte säkert och ska kontrolleras.
        const after = line.slice(m.index + m[0].length);
        const rest = after.match(/^\s+(\d{3,})\s*$/);
        if (rest && /^\d+$/.test(inlineNumber)) {
          return { number: inlineNumber + rest[1], kind, label, uncertain: true };
        }
        // Ett tecken som ¢, € eller § direkt efter ett långt nummer är oftast en
        // felläst sista siffra ("219010088421¢" för …4216): Kontrollera.
        if (/^\d{6,}$/.test(inlineNumber) && /^[¢€£$§©®¥]/.test(after)) {
          return { number: inlineNumber, kind, label, uncertain: true };
        }
        return { number: inlineNumber, kind, label };
      }
      // Numret står på raden under. Så ser det ut när etiketten och numret
      // ligger i olika textrutor på kvittot: "Ordernummer:" till vänster med
      // datum och tid till höger på samma rad, och det stora numret under. Då
      // läser OCR raden som "Ordernummer: 2026-05-26 18:34 SMILLA" och numret
      // som en egen rad. Gäller bara en etikett som säger att ett nummer
      // följer ("nr", "nummer", "number", "id", "#" eller kolon), inte en
      // rubrik som "Kvitto", och numret ska vara minst fem tecken och inget
      // belopp med decimaler.
      const leadMatch = lead.exec(line);
      if (leadMatch && /nr|nummer|\bno\b|number|\bid\b|#|:/i.test(leadMatch[0])) {
        // Upp till tre rader ned. Ett namn eller en kod utan siffror mellan
        // etiketten och numret ("SMILLA", som står till höger om etiketten på
        // kvittot) hoppas över, men en rad med siffror som inte är numret, eller
        // en lång rad, är ett annat fält och stoppar sökningen. Närmaste raden
        // får börja med numret, de två därefter måste bestå av bara numret.
        for (let k = 1; k <= 3 && list[i + k]; k++) {
          // OCR lägger ofta streck, tilde eller hakparenteser från kvittots
          // kanter och ramar runt raderna, och ibland en kort bokstavsbit
          // efter numret ("2302039269 ES"). Kanttecknen tas bort, och ett
          // ensamt kort ord utan siffror efter numret får följa med.
          const candidateLine = list[i + k].trim().replace(/^[|~[\]¥\\/\s]+|[|~[\]¥\\/\s]+$/g, '');
          if (NOT_A_NUMBER_LINE_RE.test(candidateLine)) break;
          const whole = candidateLine.match(new RegExp(`^${NUMBER_TOKEN}${NOT_FOLLOWED_BY_UNIT}(?:\\s+[^\\d\\s]{1,3})?$`));
          const start = k === 1 ? candidateLine.match(new RegExp(`^${NUMBER_TOKEN}(?![,.]\\d)${NOT_FOLLOWED_BY_UNIT}`)) : null;
          const number = acceptableNumber((whole || start)?.[1]);
          if (number && number.length >= 5) return { number, kind, label };
          if (/\d/.test(candidateLine) || candidateLine.split(/\s+/).length > 2) break;
        }
      }
    }
  }
  return null;
}

/**
 * Står säljarens organisationsnummer direkt under namnet (högst tre rader
 * ned)? Då är namnet avläst, inte gissat, även för en butik som inte finns i
 * listan över kända kedjor: "Dollarstore" följt av "Org nr: 556537-1662".
 * OCR tappar ofta bindestrecket, så "556537 1662" räknas också.
 */
export function supplierHasOrgNumber(lines, supplier) {
  if (!supplier) return false;
  const name = String(supplier).toLowerCase();
  const idx = (lines || []).findIndex(l => String(l).toLowerCase().includes(name));
  if (idx < 0) return false;
  return lines.slice(idx + 1, idx + 4).some(l => /org\.?\s*n/i.test(l) && /\b\d{6}\s*[-–]?\s*\d{4}\b/.test(l));
}

/** Bara numret, eller null. Se {@link findReceiptNumberDetailed}. */
export function findReceiptNumber(lines) {
  return findReceiptNumberDetailed(lines)?.number ?? null;
}

// ── Är det här ett kvitto eller en faktura alls? ─────────────────────────
// Avläsningen ska aldrig fylla i ett kvitto åt ett dokument som inte är ett:
// ett CV där ett tidigare jobb "Elgiganten" nämns blev tidigare ett
// Elgiganten-kvitto med konto, belopp och moms. Ett dokument räknas som ett
// kvitto eller en faktura när det har de saker ett sådant har: en totalrad
// med belopp, en momsrad, ord som kvitto, faktura, bankgiro och org.nr, och
// ett datum. Ord som hör till ett CV eller ett personligt brev drar ned.
const TOTAL_LINE_RE = /att betala|total amount|amount paid|amount due|totalt|total\b|summa\b|\bsum\b|belopp att betala/i;
const RECEIPT_WORDS_RE = /\b(?:kvitto|faktura|fakturanummer|fakturadatum|invoice|receipt|bankgiro|plusgiro|organisationsnummer|org\.?\s*nr|f[öo]rfallodatum|betalningsvillkor|ocr|swish|kortk[öo]p|kontokort|moms|vat|iban|bic|swift|betalning|att betala|amount due|order|ordernummer|kundnummer)\b/gi;
const NOT_A_RECEIPT_RE = /curriculum vitae|\bresum[eé]\b|\bcv\b|arbetslivserfarenhet|work experience|professional experience|employment history|utbildning|\beducation\b|kompetenser|\bskills\b|personligt brev|cover letter|k[öo]rkort|referenser|om mig\b|about me|linkedin\.com|spr[åa]k:|languages:/gi;
const ANY_DATE_RE = /\b(?:20|19)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.](?:20|19)\d{2}\b|\b\d{1,2}\s+(?:jan|feb|mar|apr|maj|may|jun|jul|aug|sep|okt|oct|nov|dec)[a-zåäö]*\.?\s+(?:20|19)\d{2}\b/i;
const CURRENCY_MARK_RE = /\b(?:kr|sek|usd|eur|gbp|nok|dkk|jpy|cny|rmb)\b|:-|[$€£¥元円]/i;

/**
 * Bedömer om en text är ett kvitto eller en faktura. `isReceipt` är falskt
 * när det inte finns ett enda penningbelopp, eller när poängen blir för låg.
 * `isInvoice` säger om det snarare är en faktura än ett kvitto. `hasMoney` och
 * `looksLikeOther` (CV/personligt brev-ord hittade) avgör åt anroparen VARFÖR
 * `isReceipt` är falskt — se `parseReceiptText`, som skiljer på "det här är
 * nog inte ett kvitto/en faktura alls" (inget belopp, eller tydliga CV-ord)
 * och "det HAR ett belopp men för lite annat kändes igen" (troligen ett äkta
 * kvitto som OCR läste dåligt: för utzoomat, oskarpt eller mörkt foto).
 */
export function classifyDocument(text, lines) {
  const list = lines || String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const body = String(text || '');
  const decimals = body.match(MONEY_DECIMAL_RE) || [];
  const hasTotalLine = list.some(l => TOTAL_LINE_RE.test(l) && lastAmountOnLine(l) !== null);
  const hasMoney = decimals.length > 0 || hasTotalLine || list.some(l => CURRENCY_MARK_RE.test(l) && /\d{2,}/.test(l));
  let score = 0;
  if (hasTotalLine) score += 3;
  if (list.some(l => /moms|\bvat\b|\bmva\b|merv.rdes/i.test(l) && /\d/.test(l))) score += 2;
  score += Math.min(new Set((body.match(RECEIPT_WORDS_RE) || []).map(w => w.toLowerCase().replace(/\s+/g, ''))).size, 4);
  if (ANY_DATE_RE.test(body)) score += 1;
  if (decimals.length >= 2) score += 1;
  const notWords = new Set((body.match(NOT_A_RECEIPT_RE) || []).map(w => w.toLowerCase()));
  score -= 3 * Math.min(notWords.size, 2);
  return { isReceipt: hasMoney && score >= 2, score, isInvoice: /faktura|invoice/i.test(body), hasMoney, looksLikeOther: notWords.size > 0 };
}

// En läsning med FÖR LITE text för att bedöma alls (nästan ingenting kom ut ur
// OCR-motorn) — ett väldigt suddigt, mörkt eller extremt utzoomat foto, inte
// ett dokument som råkar sakna kvitto-ord. 8 tecken (utan mellanslag) är den
// gräns skanna-kvitto-verktyget (ScanReceiptPage.jsx) redan använt en tid;
// samlad här så båda ställena delar exakt samma gräns i stället för att
// riskera att glida isär.
const MIN_READABLE_CHARS = 8;
export function isUnreadableText(text) {
  return String(text || '').replace(/\s+/g, '').length < MIN_READABLE_CHARS;
}

// ── Leverantörens namn ur dokumentets huvud ──────────────────────────────
// Butikens namn står i en logotyp, och en logotyp är det svåraste OCR läser:
// breda mellanrum, stiliserade tecken och ramar. Dollarstores logotyp
// ("DOLLAR$TORE" med ett dollartecken i mitten) blev "(DOLL ARS TORE ;" — och
// eftersom namnet togs från FÖRSTA rimliga raden hamnade det i leverantörs-
// fältet precis så. Två rader ned stod "Dollarstore", rent utskrivet.
//
// Därför vägs raderna i huvudet mot varandra i stället: sönderdelade ord,
// siffror och skräptecken drar ned, och står samma namn en gång till (logotyp
// + namn under, som på nästan varje butikskvitto) vinner den variant som har
// färst ord — alltså den rätt stavade.
const NAME_SKIP_RE = /^(\d[\d\s/.-]{4,}|\s*|kvitto|receipt|faktura|invoice|org\.?nr|datum|date|order|nr|org)$/i;
const NAME_LABEL_RE = /(?:faktura|kvitto|invoice|receipt)\s*(?:nummer|nr|no\.?|datum|date)|f[öo]rfallo\w*|betalningsvillkor|bankgiro|plusgiro|org\.?\s*nr|organisationsnummer|vat\s*(?:id|no|number)|momsreg\w*|\bdatum\b|\bdate\b|\btotal\w*|att betala|\bsumma\b|\bmoms\b/i;
// Adress- och kontaktrader är inte namnet, hur fint de än står i huvudet.
const NAME_ADDRESS_RE = /\b(?:gatan|gatu|v[äa]gen|gr[äa]nd|torget|\bbox\b|tel(?:efon)?|telnr|\btfn\b|butik|kassa|\bkvitto\b)\b/i;
// Bolagsformer och liknande korta ord är inte sönderdelade ord.
const NAME_SHORT_OK_RE = /^(?:ab|hb|kb|as|a\/s|aps|oy|ltd|inc|llc|co|&|och|the|i|of)$/i;

// Kedjenamn som OCR stavat fel. Prickarna och de klassiska teckenförväxlingarna
// viks ihop innan jämförelsen, så "C00P", "1CA" och "HEMKOP" hittar Coop, ICA
// och Hemköp utan att någon lista över felstavningar behöver underhållas.
// Jämförelsen är avsiktligt snål: korta namn måste stämma exakt efter vikningen
// (annars skulle "MAX" matcha "MAT"), och bara längre namn får skilja sig med
// ett eller två tecken.
const ACCENT_FOLD = { 'ö': 'o', 'ä': 'a', 'å': 'a', 'é': 'e', 'è': 'e', 'ü': 'u', 'ø': 'o', 'æ': 'a' };
const foldSupplier = (s) => String(s || '').toLowerCase()
  .split('').map(c => ACCENT_FOLD[c] || c).join('')
  .replace(/[^a-z0-9]/g, '');

/**
 * Känd leverantör trots felstavning i avläsningen. Prövar varje ord i
 * dokumentets huvud, och även två ord ihop ("Clas Ohlson", "Circle K") samt
 * hela raden utan mellanslag (en logotyp som lästs i bitar).
 */
export function matchKnownSupplierFuzzy(lines, headerLines = 8) {
  const candidates = new Set();
  (lines || []).slice(0, headerLines).forEach((line) => {
    const words = String(line).split(/\s+/).map(foldSupplier).filter(w => w.length >= 3);
    words.forEach((w, i) => {
      candidates.add(w);
      if (words[i + 1]) candidates.add(w + words[i + 1]);
    });
    const whole = foldSupplier(line);
    if (whole.length >= 4 && whole.length <= 24) candidates.add(whole);
  });
  if (candidates.size === 0) return null;

  for (const supplier of KNOWN_SUPPLIERS) {
    const target = foldSupplier(supplier.name);
    if (target.length < 3) continue;
    const limit = target.length >= 8 ? 2 : target.length >= 5 ? 1 : 0;
    for (const candidate of candidates) {
      if (Math.abs(candidate.length - target.length) > limit) continue;
      if (labelDistance(candidate, target, limit) <= limit) return supplier;
    }
  }
  return null;
}

/** Ett namn utan skräptecken: "(DOLLAR$TORE ;" blir "DOLLARSTORE". */
export function cleanSupplierName(raw) {
  return String(raw || '')
    // Stiliserade logotyper skriver S som ett dollartecken.
    .replace(/\$/g, 'S')
    .replace(/[^\p{L}\p{N}\s&.,'’/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,'’/-]+/u, '')
    .replace(/[\s.,:;'’/-]+$/u, '')
    .trim();
}

const despace = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Leverantörens namn ur de första raderna, eller null. Se kommentaren ovan för
 * varför det inte räcker att ta första raden.
 */
export function pickSupplierName(lines, headerLines = 8) {
  const candidates = [];
  (lines || []).slice(0, headerLines).forEach((line, index) => {
    if (!line || line.length < 3 || NAME_SKIP_RE.test(line) || line.includes('http') || line.includes('@')) return;
    let raw = line;
    const label = NAME_LABEL_RE.exec(raw);
    if (label) raw = raw.slice(0, label.index);
    const clean = cleanSupplierName(raw);
    if (clean.length < 2 || ANY_DATE_RE.test(clean) || NAME_ADDRESS_RE.test(clean)) return;
    const letters = (clean.match(/\p{L}/gu) || []).length;
    if (letters < 2 || letters / clean.length < 0.5) return;
    const tokens = clean.split(/\s+/).filter(Boolean);
    let score = index < 3 ? 1 : 0;
    // Siffror i ett butiksnamn är nästan alltid ett organisationsnummer eller
    // en adress som hakat i.
    if (/\d/.test(clean)) score -= 2;
    // Ord på högst tre bokstäver som inte är bolagsformer: ett namn som OCR
    // delat mitt itu ("DOLL ARS TORE").
    score -= tokens.filter(t => t.replace(/[^\p{L}]/gu, '').length <= 3 && !NAME_SHORT_OK_RE.test(t)).length;
    if (tokens.length > 5) score -= 1;
    if (clean.length > 40) score -= 1;
    candidates.push({ clean, tokens: tokens.length, index, score, key: despace(clean) });
  });
  if (candidates.length === 0) return null;

  // Samma namn två gånger i huvudet (logotyp + utskrivet namn): båda vinner på
  // upprepningen, och den med färst ord är den rätt stavade.
  const counts = new Map();
  candidates.forEach(c => counts.set(c.key, (counts.get(c.key) || 0) + 1));
  candidates.forEach(c => { if (counts.get(c.key) > 1) c.score += 2; });

  candidates.sort((a, b) => (b.score - a.score) || (a.tokens - b.tokens) || (a.index - b.index));
  const best = candidates[0];

  // "JACKS IMPORT" följt av "& VARUHUS" är ett namn på två rader.
  const next = (lines || [])[best.index + 1];
  const tail = next ? cleanSupplierName(next) : '';
  if (tail && /^(?:&|och)\s+\p{L}/u.test(tail) && tail.length <= 30) {
    return `${best.clean} ${tail}`.replace(/\s+/g, ' ').trim();
  }
  return best.clean;
}

// Ett leverantörsnamn ska vara ett helt ord: "ICA" är ICA, men "Africa" är det
// inte — och "Lidlvägen 4" är en adress, inte ett kvitto från Lidl. Kravet
// gäller åt båda håll, och varje förekomst prövas, inte bara den första.
function matchesAtWordStart(re, text) {
  const g = new RegExp(re.source, 'gi');
  let m;
  while ((m = g.exec(text))) {
    const before = text[m.index - 1];
    const after = text[m.index + m[0].length];
    const startsWord = !before || !/[\p{L}\d]/u.test(before);
    const endsWord = !after || !/[\p{L}]/u.test(after);
    if (startsWord && endsWord) return true;
    if (g.lastIndex === m.index) g.lastIndex++;
  }
  return false;
}

// Kontoreglerna delas med bankimporten och är skrivna som delsträngar ("mat"
// träffar "matematik"). För kvitton krävs ordbörjan, och för korta nyckelord
// (fyra bokstäver eller färre) ett helt ord.
const strictCache = new Map();
function strictRule(re) {
  if (strictCache.has(re)) return strictCache.get(re);
  const alts = re.source.split('|').map(alt => {
    const letters = alt.replace(/[^\p{L}]/gu, '');
    const hasEscape = alt.includes('\\');
    const whole = letters.length > 0 && letters.length <= 4 && !hasEscape;
    return `(?<![\\p{L}\\d])(?:${alt})${whole ? '(?![\\p{L}\\d])' : ''}`;
  });
  const out = new RegExp(alts.join('|'), 'iu');
  strictCache.set(re, out);
  return out;
}

// Ordet "moms" som OCR faktiskt läser det på ett fotat kassakvitto. Versalt M
// blir ofta N eller H ("TOTAL MONS", "HONS 1", "NONSBRUTTO1") — mätt på ett
// riktigt kvitto, där hela momskontrollen föll bort av just det. Bytena är
// begränsade till de bokstäver som faktiskt förväxlas, och ordet måste börja
// ett ord, så "Simonsson" aldrig blir en momsrad.
const MOMS_RE = /(?<![\p{L}])[mnh][o0][mnh][s5]/iu;
const looksLikeMoms = (line) => MOMS_RE.test(String(line));

// Rader som INTE är totalen: belopp exklusive moms, momsen själv, rabatter,
// växel. "Totalt inkl. moms" är däremot totalen, trots ordet moms.
function isNotTotalLine(line) {
  if (/exkl|excl|ex\.?\s*moms|f[öo]re moms|netto|before tax|\bnet\b|rabatt|discount|avrundning|v[äa]xel|tillbaka|\bchange\b/i.test(line)) return true;
  // En rad med ordet moms är momsen, inte totalen — ÄVEN när den heter "TOTAL
  // MOMS". Det är summan av momsen på kvittot, inte summan att betala, och
  // lästes tidigare som totalbelopp: ett kvitto på 15 kr med 3 kr moms fick
  // beloppet 3 kr. Bara ord som säger att momsen INGÅR i talet ("Totalt inkl.
  // moms 125,00", "brutto") gör raden till en totalrad.
  if ((looksLikeMoms(line) || /\bvat\b|\btax\b|\bmva\b/i.test(line)) && !/inkl|incl|ing[åa]r|brutto|gross|amount due/i.test(line)) return true;
  return false;
}
const NET_LINE_RE = /exkl\.?\s*moms|excl\.?\s*(?:vat|tax)|netto|f[öo]re moms|before tax|subtotal|delsumma/i;

// Rader som står på varje kvitto från butiken oavsett vad som köptes: villkor,
// öppettider, kontrolluppgifter och kontaktvägar. De får inte styra vilket
// konto som föreslås — se keywordText i parseReceiptText.
const BOILERPLATE_LINE_RE = /[öo]ppet k[öo]p|bytesr[äa]tt|reklamat|villkor|garanti|spara kvittot|kundens ex|v[äa]lkommen|[öo]ppettider|www\.|kontrollkod|kontrollenhe|\btel\.?\s*nr\b|telnr|telefon\s*:|org\.?\s*nr|f[öo]rpackning|hygienartiklar/i;

// Hur det betalades, ur texten på kvittot. En uttrycklig rad ("Betalningssätt:
// Swish", "Payment method: Card") väger tyngre än ett lösryckt ord någon
// annanstans. Kort och Swish dras från bankkontot, kontant från kassan, och
// en faktura som inte visar någon betalning är ännu obetald.
const PAYMENT_LABEL_RE = /(?:betalningss[äa]tt|betals[äa]tt|payment\s*(?:method|type)|betalning|betalt\s*med|paid\s*(?:by|with))\s*[:\-]?\s*(.*)/i;
const PAY_SWISH_RE = /\bswish\b/i;
const PAY_CARD_RE = /\b(?:kort(?:betalning|k[öo]p|typ)?|bankkort|card|mastercard|maestro|debit|amex|contactless|kontaktl[öo]s)\b|mastercar|k[oöij0]rtk[oö0]p/i;
// Kortterminalens egna rader står bara på ett kortkvitto: maskerat kortnummer
// (************8903), applikations-id (AID A0000000041010) och TVR/TSI.
const CARD_TERMINAL_RE = /[*x#]{6,}\s?\d{4}\b|\bAID\b[^\n]*\bA0{4,}\d+|\bTVR\b[^\n]*\d{6,}/i;
const PAY_CASH_RE = /\b(?:kontant|kontanter|cash)\b(?!\s*back)/i;

export function detectPaymentMethod(text, { isInvoice = false } = {}) {
  const source = String(text || '');
  const lines = source.split('\n').map(l => l.trim()).filter(Boolean);
  const classify = (s) => {
    if (PAY_SWISH_RE.test(s)) return 'swish';
    if (PAY_CARD_RE.test(s)) return 'card';
    if (PAY_CASH_RE.test(s)) return 'cash';
    return null;
  };
  for (const line of lines) {
    const m = line.match(PAYMENT_LABEL_RE);
    if (m) {
      const method = classify(m[1] || line);
      if (method) return { method, explicit: true };
    }
  }
  // En faktura utan uttrycklig betalrad är ännu obetald. Lösa ord som
  // "kort" i löptexten på en faktura säger inget om hur den betalades.
  // En "Tax invoice" från en kassa som visar kortbetalning eller kontanter
  // med växel är redan betald (IKEA-kvittot: CASH 1.000,00, CHANGE DUE).
  if (isInvoice) {
    if (CARD_TERMINAL_RE.test(source)) return { method: 'card', explicit: false };
    if (/\b(?:cash|kontant)\b[^\n]*\d|change due|v[äa]xel\b/i.test(source)) return { method: 'cash', explicit: false };
    return { method: 'invoice', explicit: false };
  }
  const any = classify(source);
  if (any) return { method: any, explicit: false };
  if (CARD_TERMINAL_RE.test(source)) return { method: 'card', explicit: false };
  return { method: null, explicit: false };
}

// ── Köp av tjänster från utlandet (omvänd skattskyldighet) ──────────────
// Köper ett svenskt momsregistrerat företag en tjänst från utlandet ska
// köparen själv redovisa momsen. Vilket konto (och vilken ruta i
// momsdeklarationen) det blir beror på om säljaren finns i EU eller inte, och
// det avgör vi bara när dokumentet självt säger det, aldrig på ett antagande:
//   EU:         säljaren anger ett momsregistreringsnummer med ett annat EU-lands
//               landskod (IE6388047V, NL123456789B01, DE123456789 ...).
//   Utanför EU: säljaren anger en adress i ett land utanför EU (USA, Storbritannien ...)
//               och ingen EU- eller svenskt momsnummer.
// Är det en vara i stället för en tjänst, eller går det inte att avgöra, lämnas
// beslutet åt användaren (unclear).
const EU_VAT_PREFIXES = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SI', 'SK'];
const OTHER_VAT_PREFIXES = ['GB', 'XI', 'NO', 'CH'];
const VAT_LABEL_RE = /\b(?:vat|moms|momsreg|umsatzsteuer|tva|btw|iva|tax\s*(?:id|reg))/i;
const VAT_ID_RE = /\b([A-Z]{2})\s?([0-9][0-9A-Z]{7,11})\b/g;
const NON_EU_COUNTRY_RE = /\bunited states\b|\bu\.s\.a\b|\busa\b|\bunited kingdom\b|\bengland\b|\bswitzerland\b|\bcanada\b|\baustralia\b|\bsingapore\b|\bjapan\b|\bnew zealand\b|\bisrael\b|\bdelaware\b|\bcalifornia\b|\bsan francisco\b/i;
const REVERSE_CHARGE_TEXT_RE = /reverse\s*charge|omv[äa]nd skattskyldighet|article\s*196|artikel\s*196/i;
const SERVICE_TEXT_RE = /subscription|licen[cs]e|hosting|cloud|software|saas|advertis|\bads\b|api usage|usage|workspace|domain|abonnemang|prenumeration|molntj[äa]nst|\bplan\b/i;
const GOODS_TEXT_RE = /shipping|shipped|tracking number|versand|frakt|leverans/i;

export function detectForeignPurchase(text, { knownService = false } = {}) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let euId = null;
  let swedishVat = false;
  let otherId = null;
  for (let i = 0; i < lines.length; i++) {
    const near = VAT_LABEL_RE.test(lines[i]) || (i > 0 && VAT_LABEL_RE.test(lines[i - 1]));
    if (!near) continue;
    let m;
    VAT_ID_RE.lastIndex = 0;
    while ((m = VAT_ID_RE.exec(lines[i]))) {
      if (m[1] === 'SE') swedishVat = true;
      else if (EU_VAT_PREFIXES.includes(m[1]) && !euId) euId = m[1] + m[2];
      else if (OTHER_VAT_PREFIXES.includes(m[1]) && !otherId) otherId = m[1] + m[2];
    }
  }
  const body = lines.join('\n');
  if (swedishVat) return { foreign: false, region: null, unclear: false, evidence: null };

  const isService = knownService || (SERVICE_TEXT_RE.test(body) && !GOODS_TEXT_RE.test(body));
  const reverseText = REVERSE_CHARGE_TEXT_RE.test(body);

  if (euId) {
    return isService
      ? { foreign: true, region: 'eu', unclear: false, evidence: `momsnummer ${euId}` }
      : { foreign: true, region: null, unclear: true, evidence: `momsnummer ${euId}, men det verkar inte vara en tjänst` };
  }
  if (!otherId && NON_EU_COUNTRY_RE.test(body)) {
    return isService
      ? { foreign: true, region: 'nonEu', unclear: false, evidence: 'säljaren finns utanför EU' }
      : { foreign: true, region: null, unclear: true, evidence: 'säljaren finns utanför EU, men det verkar inte vara en tjänst' };
  }
  if (otherId) {
    return isService
      ? { foreign: true, region: 'nonEu', unclear: false, evidence: `momsnummer ${otherId} (land utanför EU)` }
      : { foreign: true, region: null, unclear: true, evidence: 'säljaren finns utanför EU, men det verkar inte vara en tjänst' };
  }
  if (reverseText || knownService) {
    return { foreign: true, region: null, unclear: true, evidence: reverseText ? 'dokumentet nämner omvänd skattskyldighet' : 'utländsk tjänsteleverantör' };
  }
  return { foreign: false, region: null, unclear: false, evidence: null };
}

// ── Datum: rimlighet ─────────────────────────────────────────────────────────
// En avläst siffra i ett datum är lätt att läsa fel på ett foto: 5 blir 8, 0
// blir 6 eller 9, 1 blir 7. Resultatet ser ut som ett riktigt datum
// (2026-08-26 i stället för 2026-05-26) och syntes inte alls i appen, som
// visade det som avläst. Datumet märks därför "Kontrollera" när något tyder på
// att det kan vara fel, och ett datum i framtiden — som ett kvitto aldrig kan
// ha — rättas om en enda feltolkad siffra förklarar det.

// Rader med förfallodatum och liknande: det är inte köpdatumet.
const DUE_DATE_LINE_RE = /f[öo]rfall|due\b|betalas\s+senast|sista\s+betal|betala\s+senast|betalningsdag|giltig|valid|expires|utg[åa]r/i;

// Siffror som OCR förväxlar med varandra på foton.
const CONFUSABLE_DIGITS = {
  0: '689', 1: '74', 2: '7', 3: '85', 4: '1', 5: '6839', 6: '580', 7: '12', 8: '03569', 9: '805',
};

// Ett kvitto äldre än så här är ovanligt nog att dubbelkolla.
const OLD_DATE_YEARS = 2;

/** "2026-02-30" är inget datum, "2026-02-28" är det. */
export function isRealDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1990 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Två datum som bara skiljer sig i siffror OCR brukar förväxla. */
function confusableDates(a, b) {
  if (a === b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && !(CONFUSABLE_DIGITS[a[i]] || '').includes(b[i])) return false;
  }
  return true;
}

/**
 * Ett datum i framtiden där EN siffra i månad, dag eller årets sista siffra är
 * feltolkad: det senaste datumet som inte ligger i framtiden vinner, eftersom
 * ett kvitto man fotar oftast är nytt.
 */
function repairFutureDate(iso, limit) {
  const positions = [3, 5, 6, 8, 9];
  let best = null;
  positions.forEach((pos) => {
    for (const alt of CONFUSABLE_DIGITS[iso[pos]] || '') {
      const candidate = iso.slice(0, pos) + alt + iso.slice(pos + 1);
      if (isRealDate(candidate) && candidate <= limit && (!best || candidate > best)) best = candidate;
    }
  });
  return best;
}

/**
 * Rättelser av "MMDD" där en enda siffra bytts mot en den ofta förväxlas med.
 * Sorterade med den vanligaste förväxlingen först. Exporterad för testerna.
 */
export function repairDateDigits(mmdd) {
  const out = [];
  for (let i = 0; i < mmdd.length; i++) {
    const alts = CONFUSABLE_DIGITS[mmdd[i]] || '';
    for (let k = 0; k < alts.length; k++) out.push({ mmdd: mmdd.slice(0, i) + alts[k] + mmdd.slice(i + 1), rank: k });
  }
  // Vanligaste förväxlingen först (7 läst för 1 före 7 läst för 2).
  return out.sort((a, b) => a.rank - b.rank);
}

/**
 * Väljer köpdatumet bland datumen som hittades och säger om det bör
 * kontrolleras. `weakTokens` är ord med siffror som OCR själv var osäker på
 * (se recognizeWith); saknas de avgör datumen och `lowConfidence` ensamma.
 */

export function pickReceiptDate(candidates, { today = new Date(), weakTokens = null, lowConfidence = false } = {}) {
  if (!candidates.length) return { date: null, dateGuessed: false };
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  const limit = isoLocal(tomorrow);
  const pool = candidates.some(c => !c.due) ? candidates.filter(c => !c.due) : candidates;
  const primary = pool[0];

  if (primary.date > limit) {
    const pastInDoc = pool.find(c => c.date <= limit);
    if (pastInDoc) return { date: pastInDoc.date, dateGuessed: true };
    const repaired = repairFutureDate(primary.date, limit);
    return { date: repaired || primary.date, dateGuessed: true };
  }

  const date = primary.date;
  const digits = (s) => String(s).replace(/\D/g, '');
  const rawDigits = digits(primary.raw);
  // Minst fyra siffror: ett osäkert "26" i ett belopp ska inte fälla datumet.
  const weak = (weakTokens || []).map(digits).filter(t => t.length >= 4);
  const shaky = weak.some(t => rawDigits.includes(t) || t.includes(rawDigits));
  const disagrees = pool.some(c => c.date !== date && confusableDates(c.date, date));
  const oldLimit = new Date(today);
  oldLimit.setFullYear(oldLimit.getFullYear() - OLD_DATE_YEARS);
  const veryOld = date < isoLocal(oldLimit);
  return { date, dateText: primary.raw, dateGuessed: Boolean(lowConfidence || shaky || disagrees || veryOld) };
}

const EMPTY_PARSE = {
  date: null, dateGuessed: false, dateText: null, amount: null, amountGuessed: false, amountVerified: false,
  vatRate: 25, vatRateGuessed: true, vatAmount: null, vatVerified: false, vatMismatch: false, vatRates: null,
  receiptNumber: null, receiptNumberKind: null, receiptNumberLabel: null, receiptNumberGuessed: false, supplierConfirmed: false,
  supplier: null, supplierMatched: false, accountCode: null, accountGuessed: false, accountSource: null,
  currency: null, notReceipt: false, unreadable: false, documentKind: null, paymentMethod: null, creditNote: false,
  reverseCharge: null, reverseChargeUnclear: false,
};

// Tesseracts egen avläsningssäkerhet (0–100) under den här gränsen räknas
// som opålitlig — ett verkligt suddigt/mörkt/utzoomat foto ger typiskt en
// medelsäkerhet en bra bit under detta, medan ett klart foto (oavsett vad
// det föreställer) brukar ligga en bra bit över. Ingen exakt vetenskap
// (Tesseract ger ingen "detta ÄR fel"-signal), bara en rimlig utgångspunkt
// att justera om felrapporter visar att den träffar fel åt något håll.
//
// Verifierat mot en riktig avläsning (2026-09-22, live-test mot en
// avsiktligt kraftigt suddig/mörk/utzoomad bild): Tesseract gav confidence
// EXAKT 55 för texten "oo\nST\n\n=\n-—\n=E\n- -\n- -\n- oe\n- -\ness\n}" —
// rent brus, inga riktiga ord. Tröskeln låg då på < 55, så 55 föll precis
// UTANFÖR och gav fel meddelande ("inte ett kvitto" i stället för
// "oläsbar"). Höjd till 60 med den datapunkten som facit, inte en gissning.
const LOW_OCR_CONFIDENCE = 60;

/**
 * Parsar rå OCR-text och extraherar kvittodata med smarta heuristiker.
 * `confidence` (0–100, från ocrFile/extractTextFromImage) är valfri —
 * `null`/utelämnad betyder "ingen OCR-osäkerhet att ange" (digital PDF-text,
 * eller en cachad avläsning där siffran inte sparades) och then avgör
 * innehållet ensamt, som förut.
 */
/** Två belopp som skiljer sig i EN siffra som OCR ofta förväxlar (193,78/193,75). */
function confusableAmounts(a, b) {
  const x = a.toFixed(2); const y = b.toFixed(2);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] === y[i]) continue;
    if (!(CONFUSABLE_DIGITS[x[i]] || '').includes(y[i]) && !(CONFUSABLE_DIGITS[y[i]] || '').includes(x[i])) return false;
    diff++;
  }
  return diff === 1;
}

/**
 * Momstabellen som facit, som en människa skulle läsa kvittot: står det på en
 * rad ett nettobelopp och ett momsbelopp som går ihop med en svensk sats
 * (172,99 och 20,76 är 12 %), är netto + moms totalen — även när totalraden
 * lästs fel på en siffra (193,78) eller ett helt annat tal tagits som belopp.
 * Två tal som stämmer mot en momssats är ett mycket starkare bevis än ett
 * enskilt tal på en totalrad. Exporterad för testerna.
 */
export function vatTableTriples(lines) {
  const out = [];
  for (const line of lines) {
    if (!/\d[.,]\d{2}/.test(line)) continue;
    const values = amountsOnLine(line).filter(v => v >= 0.5 && v < 1e7);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < values.length; j++) {
        if (i === j) continue;
        const vat = values[i]; const net = values[j];
        if (vat >= net) continue;
        for (const rate of [25, 12, 6]) {
          if (Math.abs(vat - Math.round(net * rate) / 100) <= Math.max(0.02, net * rate / 100 * 0.002)) {
            out.push({ rate, vat, net, gross: Math.round((net + vat) * 100) / 100, line });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Säger totalraden och kortbetalningen olika belopp, en siffra ifrån varandra
 * (193,78 mot 193,75), går det inte att veta vilken som är rätt utan momsen
 * att räkna mot. Då märks beloppet Kontrollera i stället för att se säkert ut.
 */
function flagConflictingTotals(lines, result) {
  if (!result.amount || result.amountVerified) return result;
  const totalish = lines.filter(l => /att betala|totalt?|summa|kortk[öo]p|k.rtk[öo]p|belopp\s*se[kx]|amount|debit/i.test(l));
  const conflict = totalish.flatMap(l => amountsOnLine(l)).some(v => Math.abs(v - result.amount) >= 0.005 && confusableAmounts(v, result.amount));
  return conflict ? { ...result, amountGuessed: true, amountConflict: true } : result;
}

/**
 * Ett heltal som belopp ("Total … 4") på ett kvitto där alla priser står med
 * ören är troligen ett felläst brottstycke. Det märks Kontrollera.
 */
function flagSuspiciousInteger(lines, result) {
  if (!result.amount || result.amountVerified || result.amountGuessed || !Number.isInteger(result.amount)) return result;
  const decimals = lines.reduce((n, l) => n + (String(l).match(/\d[.,]\d{2}\b/g) || []).length, 0);
  const written = lines.some(l => String(l).includes(String(result.amount) + ',00') || String(l).includes(String(result.amount) + '.00'));
  return decimals >= 3 && !written ? { ...result, amountGuessed: true } : result;
}

function reconcileWithVatTable(lines, result) {
  if (result.currency || result.reverseCharge || result.creditNote) return result;
  const triples = vatTableTriples(lines);
  if (!triples.length) return flagConflictingTotals(lines, result);
  // Flera satser på olika rader (mat 12 % och övrigt 25 %) hanteras redan av
  // momskontrollen; här gäller en tabell med en sats.
  const rates = new Set(triples.map(t => t.rate));
  if (rates.size !== 1) return flagConflictingTotals(lines, result);
  // Momstabellen har rader för flera satser ("12,00 …" och "25,00 …") men bara
  // en av dem gick att läsa: den raden är inte hela totalen.
  const rateRows = new Set(lines.map(l => (l.match(/(?:^|[\s|/>-])(25|12|6)(?:[.,]00)?\s*%?\s+\d+[.,]\d{2}/) || [])[1]).filter(Boolean));
  if (rateRows.size > 1) return flagConflictingTotals(lines, result);
  const t = triples[0];
  const amount = result.amount;
  // En rad ur en momstabell med flera satser (25 %: 6,40 + 1,60 = 8,00) är
  // bara en del av totalen. Står ett större belopp på en totalrad gäller inte
  // raden som facit.
  const totalLineValues = lines.filter(l => /att betala|totalt?|summa|kortk[öo]p|belopp|amount|brutto/i.test(l)).flatMap(l => amountsOnLine(l));
  if (totalLineValues.some(v => v > t.gross * 1.1 + 1)) return flagConflictingTotals(lines, result);
  if (amount && Math.abs(amount - t.gross) < 0.005) {
    if (result.amountVerified && result.vatVerified) return result;
    return { ...result, amountVerified: true, amountGuessed: false, vatRate: t.rate, vatRateGuessed: false, vatAmount: t.vat, vatVerified: true, vatMismatch: false, vatRates: null };
  }
  // Totalen går mot tabellen bara när den saknas, är en siffra fel eller inte
  // går ihop med momsen ändå.
  const replace = !amount || confusableAmounts(amount, t.gross) || !result.amountVerified;
  if (!replace) return flagConflictingTotals(lines, result);
  // Står bruttot (eller ett belopp en siffra ifrån) någonstans i texten?
  const all = lines.flatMap(l => amountsOnLine(l));
  const seen = all.some(v => Math.abs(v - t.gross) < 0.005 || confusableAmounts(v, t.gross));
  if (!seen && amount) return flagConflictingTotals(lines, result);
  return { ...result, amount: t.gross, amountVerified: true, amountGuessed: false, vatRate: t.rate, vatRateGuessed: false, vatAmount: t.vat, vatVerified: true, vatMismatch: false, vatRates: null };
}

// Skiljer flera oberoende avläsningar av samma dokument i en och samma text
// (se extractTextFromImage). Texten cachas som den är, så sammanvägningen görs
// om varje gång tolkningen körs.
export const READING_SEPARATOR = '\n\u001e\n';

/**
 * Väger samman flera avläsningar av samma kvitto fält för fält, som en
 * människa som läser två gånger: varje fält tas från den avläsning där det är
 * säkrast (ett belopp som går ihop med momsen slår ett som inte gör det), och
 * två avläsningar som säger samma sak bekräftar varandra. Exporterad för
 * testerna.
 */
export function mergeReadings(readings) {
  const usable = readings.filter(r => !r.notReceipt);
  if (usable.length === 0) return readings[0];
  if (usable.length === 1) return usable[0];
  const same = (key, value) => usable.filter(r => r[key] && r[key] === value).length;

  // Beloppet och allt som hör ihop med det (moms, valuta, retur) från samma avläsning.
  const amountRank = (r) => (!r.amount ? 0 : r.amountVerified ? 4 : r.vatVerified ? 3 : r.amountGuessed ? 1 : 2);
  const base = [...usable].sort((a, b) => (amountRank(b) - amountRank(a)) || (same('amount', b.amount) - same('amount', a.amount)))[0];
  const out = { ...base };
  // Två läsningar av samma bild som säger samma sak bekräftar beloppet, men
  // inte om kvittot självt säger emot (totalraden mot kortbetalningen).
  if (!out.amountVerified && out.amount && same('amount', out.amount) >= 2 && !usable.some(r => r.amountConflict)) out.amountGuessed = false;

  // Leverantören: en känd butik före ett namn med org.-nummer före resten.
  const supplierRank = (r) => (!r.supplier ? 0 : r.supplierMatched ? 3 : r.supplierConfirmed ? 2 : 1) + same('supplier', r.supplier) * 0.1;
  const sup = [...usable].sort((a, b) => supplierRank(b) - supplierRank(a))[0];
  Object.assign(out, {
    supplier: sup.supplier, supplierMatched: sup.supplierMatched,
    supplierConfirmed: sup.supplierConfirmed || (Boolean(sup.supplier) && same('supplier', sup.supplier) >= 2),
  });
  // Kontot följer leverantören, utom när beloppets avläsning gav omvänd moms.
  if (!out.reverseCharge && sup.accountCode && (!out.accountCode || out.accountGuessed || !sup.accountGuessed)) {
    Object.assign(out, { accountCode: sup.accountCode, accountGuessed: sup.accountGuessed, accountSource: sup.accountSource, accountChoices: sup.accountChoices || null });
  }

  // Datumet: säkra avläsningar först; två som säger samma datum bekräftar det.
  const dated = usable.filter(r => r.date);
  if (dated.length) {
    const agreed = dated.find(r => same('date', r.date) >= 2);
    const sure = dated.filter(r => !r.dateGuessed);
    const pick = agreed || sure[0] || dated[0];
    const conflict = sure.some(r => r.date !== pick.date);
    Object.assign(out, { date: pick.date, dateText: pick.dateText, dateGuessed: agreed ? conflict : (pick.dateGuessed || conflict) });
  }

  // Numret: samma nummer i två avläsningar, annars ett som inte är osäkert.
  const numbered = usable.filter(r => r.receiptNumber);
  if (numbered.length) {
    const agreed = numbered.find(r => same('receiptNumber', r.receiptNumber) >= 2);
    let pick = agreed || numbered.find(r => !r.receiptNumberGuessed) || numbered[0];
    // Ett nummer som tappat sista siffran i den ena läsningen ("6716" mot
    // "67161"): den längre läsningen är den hela.
    const longer = numbered.find(r => r.receiptNumber.length > pick.receiptNumber.length && r.receiptNumber.startsWith(pick.receiptNumber));
    if (longer) pick = longer;
    Object.assign(out, {
      receiptNumber: pick.receiptNumber, receiptNumberKind: pick.receiptNumberKind, receiptNumberLabel: pick.receiptNumberLabel,
      receiptNumberGuessed: agreed ? false : pick.receiptNumberGuessed,
    });
  }
  if (!out.paymentMethod) out.paymentMethod = usable.find(r => r.paymentMethod)?.paymentMethod || null;
  return out;
}

export function parseReceiptText(text, options = {}) {
  if (typeof text === 'string' && text.includes('\u001e')) {
    const parts = text.split(/\r?\n\u001e\r?\n/).filter(p => p.trim());
    return mergeReadings(parts.map((part, i) => parseOneReading(part, i === 0 ? options : { ...options, weakTokens: null })));
  }
  return parseOneReading(text, options);
}

function parseOneReading(text, { confidence = null, weakTokens = null, today = new Date() } = {}) {
  if (!text || typeof text !== 'string') {
    return { ...EMPTY_PARSE };
  }

  // Nästan ingen text alls kom ut ur OCR-motorn — foto för suddigt, mörkt
  // eller för långt bort för att läsa, inte nödvändigtvis "fel sorts
  // dokument". Skiljs från notReceipt nedan så användaren får rätt råd:
  // ta ett bättre foto, i stället för att appen påstår att det inte är ett
  // kvitto eller en faktura.
  if (isUnreadableText(text)) return { ...EMPTY_PARSE, notReceipt: true, unreadable: true, documentKind: 'unreadable' };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Text som kontoreglerna får läsa: kvittots egna rader UTAN finstilt och
  // kontaktuppgifter. Butikens villkorstext ("Inget byte eller öppet köp av
  // livsmedel, hygienartiklar, djurmat…") och telefonnumret i sidhuvudet står
  // på varje kvitto från butiken och säger ingenting om vad som köptes — ändå
  // föreslog de konto: två läskvitton från Dollarstore blev "6071 Mat och
  // representation" av ordet livsmedel i villkoren.
  const keywordText = lines.filter(l => !BOILERPLATE_LINE_RE.test(l)).join('\n').toLowerCase();
  // Tesseract var själv osäker på det den läste: siffror ur en sån text är inte
  // värda att fylla i utan att de kan kontrolleras mot något (se längre ned).
  const lowConfidence = typeof confidence === 'number' && confidence < LOW_OCR_CONFIDENCE;

  // Ett dokument som inte är ett kvitto eller en faktura fylls aldrig i.
  const doc = classifyDocument(text, lines);
  if (!doc.isReceipt) {
    // Ett uttryckligt CV/personligt brev-ord (doc.looksLikeOther) vinner
    // ALLTID, oavsett confidence — orden gick tydligt att läsa, så det är
    // inte en dålig avläsning, bara fel sorts dokument. Saknas det ordet
    // misstänks i stället en DÅLIG AVLÄSNING snarare än ett äkta
    // fel-sorts-dokument: antingen var Tesseract själv osäker (låg
    // confidence — fångar även korta, obegripliga fall som ren
    // bildbrus-text, där hasMoney inte har något att bita i), eller så
    // hittades ett belopp (troligen ändå ett äkta kvitto, bara för
    // utzoomat/skevt/ojämnt ljus för att kännas igen med säkerhet).
    if (!doc.looksLikeOther && (lowConfidence || doc.hasMoney)) {
      return { ...EMPTY_PARSE, notReceipt: true, unreadable: true, documentKind: 'unreadable' };
    }
    return { ...EMPTY_PARSE, notReceipt: true, documentKind: 'other' };
  }
  // Leverantören står i dokumentets huvud. En omnämnd butik längre ned (ett
  // tidigare jobb i ett CV, en annons på ett kvitto) ska inte bli leverantör.
  const headerText = lines.slice(0, 6).join('\n').toLowerCase();

  // ── 1. Datum ──────────────────────────────────────────────────────────────
  // Numeriska datum med / eller - är tvetydiga: "02/15" kan bara vara
  // MM/DD (USA), inget månadsnummer går över 12 — men "03/05" kan vara
  // BÅDE 3:e maj (svensk DD/MM, appens standardkonvention) och 5:e mars
  // (amerikansk MM/DD). Utan den här upplösningen blev ett amerikanskt
  // kvitto som "02/15/2022" tidigare "2022-15-02" — ett ogiltigt datum
  // (månad 15) som gav antingen ingen valutakurs alls eller, värre, en
  // kurs för fel dag om siffrorna råkade vara ≤ 12 båda två (tyst fel
  // datum, tyst fel belopp i kronor — bugkritiskt eftersom hela poängen
  // med valutaomräkningen är att använda RÄTT dags kurs).
  const looksAmerican = /\$|\bUSD\b|\bCAD\b|\bAUD\b/i.test(text);
  function resolveDayMonth(a, b) {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (na > 12 && nb <= 12) return { day: na, month: nb };
    if (nb > 12 && na <= 12) return { day: nb, month: na };
    // Äkta tvetydigt (båda ≤ 12) — amerikanska kvitton (dollartecken/
    // USD/CAD/AUD i texten) skriver MM/DD, annars svensk standard DD/MM.
    return looksAmerican ? { day: nb, month: na } : { day: na, month: nb };
  }

  const dateCandidates = [];
  const repairedDates = [];
  const compactDates = [];
  lines.forEach((rawLine, lineIndex) => {
    // Bokstäver som OCR läser i stället för siffror inne i ett datum
    // ("2O24-O5-26", "26.0S.2024"): bara i ord som ser ut som ett datum.
    const line = String(rawLine).replace(/\b[\dOoIlSBZ|]{1,4}[-./][\dOoIlSBZ|]{1,2}[-./][\dOoIlSBZ|]{2,4}\b/g, (tok) => (
      (tok.match(/\d/g) || []).length >= 4
        ? tok.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2')
        : tok));
    // En rad med en datumetikett väger tyngre än ett datum någon annanstans
    // (en kampanjtext, en garantitid, ett utskriftsdatum).
    const labelled = /\b(?:k[öo]p|faktura|kvitto|transaktions|leverans|invoice|issue|purchase|order)?\s*(?:datum|date)\b|\bdat\b/i.test(line);
    const push = (value, raw) => {
      if (isRealDate(value)) dateCandidates.push({ date: value, raw, lineIndex, due: DUE_DATE_LINE_RE.test(line), labelled });
    };
    // YYYY-MM-DD eller YYYY/MM/DD eller YYYY.MM.DD
    // Det andra skiljetecknet kan ha lästs som ett mellanslag ("2022-09 16").
    const m1 = line.match(/\b(20\d{2})[-/.](\d{1,2})(?:[-/.]|\s)(\d{1,2})\b(?![.,]\d)/);
    if (m1) {
      const iso = `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
      if (isRealDate(iso)) {
        push(iso, m1[0]);
      } else {
        // Ett omöjligt datum ("2022-11-74") är en felläst siffra. De rättelser
        // som ger ett riktigt datum sparas och avgörs mot kvittots andra
        // datum nedan (kortterminalens "221114").
        // Bara när en siffra uppenbart är fel (dag över 31, månad över 12):
        // "2026-02-30" är inget läsfel och lämnas utan datum.
        const clearlyMisread = Number(m1[3]) > 31 || Number(m1[2]) > 12;
        if (clearlyMisread) repairDateDigits(`${m1[2].padStart(2, '0')}${m1[3].padStart(2, '0')}`).forEach(({ mmdd: md, rank }) => {
          const fixed = `${m1[1]}-${md.slice(0, 2)}-${md.slice(2)}`;
          if (isRealDate(fixed)) repairedDates.push({ date: fixed, raw: m1[0], lineIndex, due: DUE_DATE_LINE_RE.test(line), rank });
        });
      }
      return;
    }
    // Kortterminalens datum: ÅÅMMDD följt av klockslaget TTMMSS ("221114 141911").
    const mc = line.match(/\b(\d{2})(\d{2})(\d{2})\s+[0-2]\d[0-5]\d[0-5]\d\b/);
    if (mc) {
      const iso = `20${mc[1]}-${mc[2]}-${mc[3]}`;
      if (isRealDate(iso)) compactDates.push(iso);
    }
    // ÅÅÅÅMMDD efter en datumetikett ("Datum 20240526").
    const mcl = line.match(/(?:datum|date|dat\.?)\s*:?\s*(20\d{2})(\d{2})(\d{2})\b/i);
    if (mcl) { push(`${mcl[1]}-${mcl[2]}-${mcl[3]}`, mcl[0]); return; }
    // DD/MM/YYYY eller MM/DD/YYYY (- eller . fungerar också) — se
    // resolveDayMonth ovan för vilken tolkning som vinner.
    const m2 = line.match(/\b(\d{1,2})\s?[-/.]\s?(\d{1,2})\s?[-/.]\s?(20\d{2})\b/);
    if (m2) {
      const { day, month } = resolveDayMonth(m2[1], m2[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        push(`${m2[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, m2[0]);
        return;
      }
    }
    // Tre tvåsiffriga grupper: DD/MM/YY ("23/09/26", "26/5-24") eller ÅÅ-MM-DD
    // ("24-05-26", vanligt på svenska kassor). Går båda att läsa väljs den som
    // inte ligger i framtiden och är närmast idag.
    const m3 = line.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})\b(?![/.-]\d)/);
    if (m3) {
      const options = [];
      const yr = parseInt(m3[3], 10);
      const { day, month } = resolveDayMonth(m3[1], m3[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) options.push(`${yr < 70 ? 2000 + yr : 1900 + yr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      if (/^\d{2}-\d{1,2}-\d{2}$/.test(m3[0])) options.push(`20${m3[1]}-${m3[2].padStart(2, '0')}-${m3[3]}`);
      const limit = isoLocal(new Date(today.getTime() + 24 * 3600 * 1000));
      // Med bindestreck skriver svenska kassor ÅÅ-MM-DD (svensk standard), så
      // den läsningen gäller om den inte ligger i framtiden.
      const ymd = options[1];
      const best = (ymd && isRealDate(ymd) && ymd <= limit)
        ? ymd
        : options.filter(isRealDate).sort((x, y) => ((x <= limit) === (y <= limit) ? (x < y ? 1 : -1) : (x <= limit ? -1 : 1)))[0];
      if (best) { push(best, m3[0]); return; }
    }
    // Datum med månaden i ord: "26 maj 2024", "26-May-2024", "26. Mai 2024",
    // "May 26th, 2024", "maj 26 2024". Dagen MÅSTE stå: ett "maj 2024" utan dag
    // blev förut den första i månaden (Elgiganten-kvittot fick 1 maj i stället
    // för 26 maj).
    const DMY_RE = /\b(\d{1,2})(?:st|nd|rd|th|:e|:a)?\.?[\s/-]*([A-Za-zÅÄÖåäö]{3,10})\.?[\s/,-]*((?:20)?\d{2})\b/g;
    const MDY_RE = /\b([A-Za-zÅÄÖåäö]{3,10})\.?[\s/-]*(\d{1,2})(?:st|nd|rd|th)?,?[\s/-]+(20\d{2})\b/g;
    const textual = [
      ...[...line.matchAll(DMY_RE)].map(m => ({ m, day: m[1], mon: m[2], year: m[3] })),
      ...[...line.matchAll(MDY_RE)].map(m => ({ m, day: m[2], mon: m[1], year: m[3] })),
    ];
    for (const { m, day, mon, year } of textual) {
      const monthNum = monthFromWord(mon);
      if (!monthNum) continue;
      const fullYear = year.length === 2 ? `20${year}` : year;
      push(`${fullYear}-${monthNum}-${day.padStart(2, '0')}`, m[0]);
      return;
    }
  });
  // Rättade datum: ett som stämmer med kortterminalens datum eller ett annat
  // datum på kvittot räknas som avläst. Utan något att stämma mot används en
  // rättelse bara när den är ensam, och då som något att kontrollera.
  // Etiketterade datum först, annars i dokumentets ordning (sorteringen är stabil).
  dateCandidates.sort((a, b) => Number(Boolean(b.labelled)) - Number(Boolean(a.labelled)));
  let dateRepairedUnconfirmed = false;
  if (repairedDates.length) {
    const others = new Set([...compactDates, ...dateCandidates.map(c => c.date)]);
    const confirmed = repairedDates.find(r => others.has(r.date));
    if (confirmed) dateCandidates.unshift(confirmed);
    else if (!dateCandidates.length && repairedDates.filter(r => r.rank === repairedDates[0].rank).length === 1) {
      // Ensam bästa rättelse: används, men som något att kontrollera.
      dateCandidates.push(repairedDates[0]);
      dateRepairedUnconfirmed = true;
    }
  }
  if (!dateCandidates.length && compactDates.length) dateCandidates.push({ date: compactDates[0], raw: compactDates[0], lineIndex: -1, due: false });
  const pickedDate = pickReceiptDate(dateCandidates, { today, weakTokens, lowConfidence });
  const { date, dateText = null } = pickedDate;
  const dateGuessed = pickedDate.dateGuessed || dateRepairedUnconfirmed;

  // ── 2. Totalbelopp ────────────────────────────────────────────────────────
  let amount = null;
  // Raden där totalbeloppet faktiskt stod — sparas separat för valutakollen
  // längre ner (## Valuta). Kollar bara DEN raden, inte hela kvittot: många
  // utländska SaaS-fakturor (Vercel, GitHub …) visar en delsumma i dollar
  // OVANFÖR en redan SEK-omräknad totalsumma, och en sådan referensrad ska
  // inte trigga en falsklarm om utländsk valuta.
  let amountLine = null;
  const primaryAmountKeywords = /att betala|total amount|amount paid|amount due|totalt|total\b/i;
  const secondaryAmountKeywords = /summa|belopp|sum\b|to pay|kort|card|sek|kronor|subtotal/i;

  // 1. Försök först med primära nyckelord (t.ex. "Totalt: 193,75" eller "Att betala: 900,58")
  for (const line of lines) {
    if (primaryAmountKeywords.test(line) && !/subtotal|delbelopp/i.test(line) && !isNotTotalLine(line)) {
      const parsed = lastAmountOnLine(line);
      if (parsed !== null) {
        amount = parsed;
        amountLine = line;
        break;
      }
    }
  }

  // Avrundning: "Totalt 15 varor 261,38 / Avrundning 0,12 / Totalt 261,50".
  // Det som betalades är totalen EFTER avrundningsraden.
  const roundingIndex = lines.findIndex(l => /avrundning|[öo]resavrundning|rounding/i.test(l));
  if (amount && roundingIndex >= 0) {
    for (const line of lines.slice(roundingIndex + 1)) {
      if (primaryAmountKeywords.test(line) && !isNotTotalLine(line)) {
        const parsed = lastAmountOnLine(line);
        if (parsed !== null) { amount = parsed; amountLine = line; break; }
      }
    }
  }

  // 2. Om inget primärt hittades, prova sekundära nyckelord
  if (!amount) {
    for (const line of lines) {
      if (secondaryAmountKeywords.test(line) && !isNotTotalLine(line)) {
        const parsed = lastAmountOnLine(line);
        if (parsed !== null) {
          amount = parsed;
          amountLine = line;
          break;
        }
      }
    }
  }

  // Fallback: leta efter det största rimliga beloppet i hela dokumentet.
  // Decimalbelopp är alltid kandidater; heltal bara på rader som INTE ser
  // ut att vara ett referens-/ordernummer (se ID_LIKE_LINE_RE) — annars
  // vinner lätt ett kvittonummer över den faktiska totalsumman.
  // Hela tal räknas bara på en rad med en valutamarkering (kr, SEK, $), och
  // beloppet blir bara ett FÖRSLAG att kontrollera (amountGuessed).
  let amountGuessed = false;
  if (!amount) {
    let max = 0;
    let maxLine = null;
    for (const line of lines) {
      if (NOT_AMOUNT_LINE_RE.test(line)) continue;
      const skipWhole = ID_LIKE_LINE_RE.test(line) || DATE_LIKE_LINE_RE.test(line) || !CURRENCY_MARK_RE.test(line);
      const matches = [
        ...(line.match(MONEY_DECIMAL_RE) || []),
        // Ett heltal med en valutamarkering på raden ("15 kr") är ett belopp
        // även när det är litet — utan det hittades inget belopp alls på ett
        // kvitto som skriver hela kronor utan decimaler.
        ...(skipWhole ? [] : (line.match(MONEY_WHOLE_RE) || line.match(/\b\d{1,2}\b/g) || [])),
      ];
      if (matches.length) {
        for (const raw of matches) {
          const v = parseMoneyToken(raw);
          if (v !== null && v > max && v < 500000) {
            max = v;
            maxLine = line;
          }
        }
      }
    }
    if (max > 0) { amount = max; amountLine = maxLine; amountGuessed = true; }
  }

  // ── Valuta ────────────────────────────────────────────────────────────────
  // Bokix bokför bara i svenska kronor (Bokföringslagen 4 kap. 6 §: löpande
  // bokföring ska ske i SEK). Ett kvittobelopp i en annan valuta får ALDRIG
  // tolkas som om det redan vore kronor — det skulle boka fel belopp med en
  // faktor på flera gånger. Hittas ett valutatecken/-kod på totalradens
  // egen text (och inget som uttryckligen säger "SEK"/"kr" på samma rad)
  // returneras valutakoden istället för att gissa ett kronbelopp — anroparen
  // (Expenses.jsx/Verifications.jsx) ska då lämna beloppsfältet tomt och
  // be användaren skriva in det omräknade SEK-beloppet själv.
  // Ett svenskt kassakvitto med org.nr, momsrad och "KONTANT" är i kronor.
  // OCR läser ofta kvittots egna tecken (*, ¤, §) framför beloppen som ett
  // dollartecken — "1x 15.00 $15.00 A" på ett kvitto från Skellefteå — och då
  // tolkades hela kvittot som dollar, beloppet lämnades tomt och appen bad om
  // en valutakurs. Ett ENSAMT dollartecken får därför inte väga tyngre än
  // kvittots svenska kännetecken; står det USD eller US$ gäller det förstås.
  // OCR stavar fel ("Kvitta", "Kassor", "SEX" för SEK), så också vanliga
  // svenska kvittoord, ett org.-nummer och å/ä/ö räknas.
  const swedishReceipt = lines.some(l => looksLikeMoms(l) || /org\.?\s*nr|organisationsnummer|kvitt|kontant|kass[aoö]|bankgiro|plusgiro|swish|kronor|\bkr\b|\bse[kx]\b|att betala|totalt|summa|belopp|kortk[öo]p|tack|\b\d{6}-\d{4}\b/i.test(l))
    || (text.match(/[åäöÅÄÖ]/g) || []).length >= 3;
  let currency = null;
  if (amountLine) {
    const explicitSek = /\bsek\b|\bkr\b|:-/i.test(amountLine);
    // Ett ensamt valutatecken på ett svenskt kassakvitto är OCR-brus, inte
    // en valuta. En uttrycklig kod (USD, EUR …) gäller alltid.
    const symbolCounts = !(swedishReceipt && !/\b(USD|GBP|EUR|NOK|DKK|CHF|JPY|CNY|RMB|CAD|AUD|PLN|CZK|HUF|ISK|TRY|THB|MYR|SGD|HKD|INR|NZD|ZAR)\b/i.test(text));
    if (!explicitSek) {
      if (symbolCounts && /\$/.test(amountLine)) currency = 'USD';
      else if (symbolCounts && /£/.test(amountLine)) currency = 'GBP';
      else if (symbolCounts && /€/.test(amountLine)) currency = 'EUR';
      // 元 är entydigt kinesiska yuan (RMB) — förekommer aldrig på ett
      // japanskt kvitto. ¥ ensamt är tvetydigt mellan yen och yuan;
      // internationellt är yen den vanligare tolkningen av tecknet utan
      // vidare sammanhang, så det är förvalet.
      else if (symbolCounts && /元/.test(amountLine)) currency = 'CNY';
      else if (symbolCounts && /¥/.test(amountLine)) currency = 'JPY';
      else {
        const codeMatch = amountLine.match(/\b(USD|GBP|EUR|NOK|DKK|CHF|JPY|CNY|RMB|CAD|AUD|PLN|CZK|HUF|ISK|TRY|THB|MYR|SGD|HKD|INR|NZD|ZAR)\b/i);
        if (codeMatch) {
          const code = codeMatch[1].toUpperCase();
          // RMB ("renminbi") är det vardagliga namnet, CNY är ISO-koden
          // Frankfurter/ECB faktiskt känner till (utils/currencyConversion.js).
          currency = code === 'RMB' ? 'CNY' : code;
        }
      }
    }
  }

  // Står valutan inte på totalraden (många fakturor skriver "Currency: USD"
  // eller visar bara ett $-tecken vid enhetspriset) men dokumentet inte
  // nämner kronor någonstans, är beloppet ändå i den valutan. Finns "SEK",
  // "kr" eller "kronor" någonstans antas kronor.
  if (!currency && amount && !swedishReceipt && !/\bsek\b|\bkr\b|kronor|:-/i.test(text)) {
    if (/\bUSD\b|US\$|\$/.test(text)) currency = 'USD';
    else if (/\bGBP\b|£/.test(text)) currency = 'GBP';
    else if (/\bEUR\b|€/.test(text)) currency = 'EUR';
    // RM (Malaysia) skrivs ofta "RM 60.00" eller "Amount(RM)".
    else if (/\bMYR\b|\bRM\b|\(RM\)/.test(text)) currency = 'MYR';
    else {
      const codeAnywhere = text.match(/\b(NOK|DKK|CHF|JPY|CNY|RMB|CAD|AUD|PLN|CZK|HUF|ISK|TRY|THB|SGD|HKD|INR|NZD|ZAR)\b/);
      if (codeAnywhere) currency = codeAnywhere[1] === 'RMB' ? 'CNY' : codeAnywhere[1];
    }
  }

  // ── 3. Leverantör & Konto ────────────────────────────────────────────────
  let supplier = null;
  let accountCode = null;
  let vatRate = null;
  // supplierMatched/vatRateGuessed: EXTRA, additiv information utöver
  // själva värdena — skiljer "vi kände igen det här" från "vi gissade
  // eftersom vi var tvungna att fylla i något". Ingen befintlig anropare
  // (Expenses.jsx m.fl.) läser de här fälten, så de kan aldrig gå sönder
  // av det här — de finns för att ScanReceiptPage.jsx ska kunna visa en
  // bock ENDAST vid faktisk avläsning, aldrig vid en gissning som RÅKAR
  // se rätt ut. Kundönskemål, uttryckligt: en gissning som visas som om
  // den vore säker är värre än att lämna fältet tomt.
  let supplierMatched = false;
  // Butiker där kontot beror på syftet: användaren väljer bland dessa.
  let accountChoices = null;

  for (const s of KNOWN_SUPPLIERS) {
    if (matchesAtWordStart(s.re, headerText)) {
      supplier = s.name;
      accountCode = s.account;
      accountChoices = s.choices || null;
      if (s.vat !== undefined) vatRate = s.vat;
      supplierMatched = true;
      break;
    }
  }

  // Samma lista en gång till, men tålig mot felstavning: ett fotat kvitto ger
  // ofta "C00P KONSUM" eller "HEMKOP", och då ska det ändå bli Coop och
  // Hemköp — med kedjans riktiga namn och konto, inte en halvläst rad.
  if (!supplier) {
    const fuzzy = matchKnownSupplierFuzzy(lines, 6);
    if (fuzzy) {
      supplier = fuzzy.name;
      accountCode = fuzzy.account;
      accountChoices = fuzzy.choices || null;
      if (fuzzy.vat !== undefined) vatRate = fuzzy.vat;
      supplierMatched = true;
    }
  }

  // Ingen känd kedja: leta upp den BÄSTA raden i dokumentets huvud, inte den
  // första. Det är en gissning (supplierMatched förblir false med flit), men
  // den ska åtminstone vara rätt stavad.
  // Kedjans kännetecken i texten, när logotypen inte gick att läsa: ord som
  // bara en kedja skriver på sina kvitton ("Bonusgrundande belopp" är ICA,
  // "Poänggrundande" och MedMera är Coop, "Willys Plus" är Willys).
  if (!supplier) {
    const chain = chainFromFingerprint(text);
    if (chain) {
      const known = KNOWN_SUPPLIERS.find(s => s.name === chain);
      supplier = chain;
      supplierMatched = true;
      if (known) {
        accountCode = known.account;
        accountChoices = known.choices || null;
        if (known.vat !== undefined) vatRate = known.vat;
      }
    }
  }

  if (!supplier) supplier = pickSupplierName(lines);

  // ── 4. Momssats ──────────────────────────────────────────────────────────
  const isForeignService = /supabase|vercel|stripe|github|\baws\b|amazon web services|google cloud|openai|adobe|digitalocean|heroku|jetbrains|slack|\bzoom\b|figma|notion/i.test(headerText);

  if (vatRate === null) {
    const vatLineRe = /moms|merv.rdes|vat|tax|mva/i;
    for (const line of lines) {
      const pct = line.match(/(\d{1,2})\s*%/);
      if (pct && vatLineRe.test(line)) {
        const v = parseInt(pct[1], 10);
        if ([25, 12, 6, 0].includes(v)) {
          vatRate = v;
          break;
        }
      }
    }
  }

  // Bara sant om vatRate INTE hittades någonstans ovan (varken hos en känd
  // leverantör eller på en "moms NN%"-rad) och därför föll tillbaka på
  // standardantagandet (25 %, eller 0 % för ett igenkänt utländskt
  // molntjänstabonnemang) — en förvald siffra, inte en avläst.
  let vatRateGuessed = vatRate === null;
  if (vatRateGuessed) {
    vatRate = isForeignService ? 0 : 25;
  }

  // ── 5. Fallback kontoregler ───────────────────────────────────────────────
  // Delad lista (utils/accountCategories.js) — samma regler bankimporten
  // (Bank.jsx) föreslår konton med.
  let accountSource = accountCode ? 'supplier' : null;
  if (!accountCode) {
    for (const { re, code } of ACCOUNT_KEYWORD_RULES) {
      if (strictRule(re).test(keywordText)) {
        accountCode = code;
        accountSource = 'keyword';
        break;
      }
    }
  }
  // Inget matchade, men det ÄR ett kvitto eller en faktura: föreslå 6990
  // Övriga externa kostnader, märkt som en gissning, i stället för inget
  // konto alls. Ett riktigt förslag från leverantörens tidigare kvitton läggs
  // på av anroparen (Expenses.jsx), som har företagets historik.
  let accountGuessed = false;
  if (!accountCode) {
    accountCode = '6990';
    accountGuessed = true;
    accountSource = 'fallback';
  }

  // ── 5b. Tjänst från utlandet: omvänd skattskyldighet ─────────────────────
  // Ett inköp av en tjänst från utlandet får ett eget inköpskonto (4535 EU,
  // 4531 utanför EU) och ingen svensk moms på kvittot. Momsen redovisas av
  // köparen, se utils/reverseCharge.js. Går regionen inte att avgöra markeras
  // kontot som något att kontrollera i stället för att gissa.
  const foreignPurchase = doc.isReceipt ? detectForeignPurchase(text, { knownService: isForeignService }) : { foreign: false };
  let reverseCharge = null;
  let reverseChargeUnclear = false;
  if (foreignPurchase.region) {
    accountCode = REVERSE_PURCHASE_ACCOUNTS[foreignPurchase.region][25];
    accountGuessed = false;
    accountSource = 'reverse-charge';
    vatRate = 0;
    vatRateGuessed = false;
    reverseCharge = { region: foreignPurchase.region, evidence: foreignPurchase.evidence };
  } else if (foreignPurchase.foreign) {
    reverseChargeUnclear = true;
    accountGuessed = true;
  }

  // ── 5c. Retur eller kreditnota ───────────────────────────────────────────
  // Ett returkvitto ser ut precis som ett vanligt kvitto, men pengarna går åt
  // andra hållet: beloppet ska bokföras som en minuspost. Minustecknet tappas
  // lätt i avläsningen, och ett returkvitto som bokförs som en kostnad blir
  // fel åt två håll (kostnaden och momsen). Kvittot märks därför, och
  // användaren får bestämma. "Kreditkort" räknas förstås inte.
  const creditWordRe = /\bretur(?:er|ert|kvitto)?\b|kreditfaktura|kreditnota|credit note|\bmakulerad\b|\breturnerad\b/i;
  const creditNote = lines.some(l => creditWordRe.test(l) && !/kreditkort|credit card/i.test(l))
    || Boolean(amountLine && /-\s*\d|\d\s*-\s*$/.test(amountLine));

  // ── 6. Momskontroll och kvittonummer ─────────────────────────────────────
  let vatCheck = crossCheckVat({ lines, amount, vatRate, vatRateGuessed, currency });
  // Momsbeloppet på kvittot är facit. Går det inte ihop med totalen vi läste
  // (eller blev momsraden läst SOM totalen) är det nästan alltid totalen som
  // är fel: då räknas rätt total fram ur momsen, om den finns i texten.
  if (!currency && vatCheck.vatAmount && !vatCheck.mixed && (!vatCheck.verified || vatCheck.equalsAmount)) {
    // Varje momsbelopp kvittot kan ha menat prövas: det som pekar ut ett
    // totalbelopp som faktiskt står på kvittot är det rätta.
    const values = allAmountsInText(lines);
    let repair = null;
    let repairedVat = null;
    for (const candidate of (vatCheck.candidates || [vatCheck.vatAmount])) {
      repair = totalFromVatAmount(candidate, values);
      if (repair) { repairedVat = candidate; break; }
    }
    if (repair && (!amount || Math.abs(repair.amount - amount) > 0.05)) {
      amount = repair.amount;
      amountGuessed = false;
      vatCheck = { vatRate: repair.rate, vatAmount: repairedVat, verified: true, mismatch: false, equalsAmount: false };
    } else if (vatCheck.equalsAmount) {
      // Momsen är läst, men vilken total den hör till går inte att visa på
      // kvittot. Beloppet är då inget att lita på: det märks som något att
      // kontrollera, och avvikelsen visas för användaren.
      vatCheck = { ...vatCheck, mismatch: true };
    }
  }
  if (vatCheck.vatRate !== null) { vatRate = vatCheck.vatRate; }
  // Netto + moms = totalt. Står både ett belopp exklusive moms och ett
  // momsbelopp på dokumentet ska de summera till totalen. Gör de det är
  // beloppet kontrollerat. Gör de det inte, men summan finns som ett annat
  // belopp i dokumentet, är det summan som är totalen (en delsumma eller ett
  // avrundat tal hade annars kunnat plockas).
  let amountVerified = false;
  if (amount && !currency && vatCheck.vatAmount) {
    const netLine = lines.find(l => NET_LINE_RE.test(l) && lastAmountOnLine(l.replace(/\d{1,2}(?:[.,]\d+)?\s*%/g, ' ')) !== null);
    const net = netLine ? lastAmountOnLine(netLine.replace(/\d{1,2}(?:[.,]\d+)?\s*%/g, ' ')) : null;
    if (net) {
      const expected = round2(net + vatCheck.vatAmount);
      if (Math.abs(expected - amount) <= 0.05) amountVerified = true;
      else if ((text.match(MONEY_DECIMAL_RE) || []).some(t => Math.abs((parseMoneyToken(t) || 0) - expected) <= 0.005)) {
        amount = expected;
        amountVerified = true;
        amountGuessed = false;
      }
    }
  }
  if (!amountVerified && vatCheck.verified) amountVerified = true;
  // Momsen på kvittot stämmer inte mot beloppet: då är minst ett av de två
  // felläst, och båda märks som något att kontrollera i stället för avläst.
  // Hellre två "Kontrollera" än ett belopp och en moms som ser avlästa ut men
  // motsäger kvittot.
  if (!amountVerified && vatCheck.mismatch) amountGuessed = true;
  // Avläsningen var osäker OCH beloppet är bara en gissning: fyll inte i något
  // belopp alls. Ett tal som plockats ur en dåligt läst bild (ett organisations-
  // nummer, en del av ett datum) ser ut som ett belopp i fältet och blir fel
  // bokföring. Tomt fält och ett råd om fotot är ärligare — och beloppet
  // behålls så fort det går att kontrollera mot momsen (amountVerified).
  if (lowConfidence && amountGuessed && !amountVerified) {
    amount = null;
    amountGuessed = false;
  }
  const numberFound = findReceiptNumberDetailed(lines);

  return flagSuspiciousInteger(lines, reconcileWithVatTable(lines, {
    date, dateGuessed, dateText, amount, amountGuessed: amountVerified ? false : amountGuessed, amountVerified, vatRate,
    vatRateGuessed: vatCheck.verified ? false : (vatRateGuessed || vatCheck.mismatch),
    vatAmount: vatCheck.vatAmount, vatVerified: vatCheck.verified, vatMismatch: vatCheck.mismatch,
    // Kvittot har moms i flera satser: momsen ÄR avläst och går ihop, men den
    // kan inte uttryckas som en sats. Anroparen säger det till användaren.
    vatRates: vatCheck.mixed ? vatCheck.rates : null,
    creditNote,
    receiptNumber: numberFound?.number ?? null, receiptNumberKind: numberFound?.kind ?? null, receiptNumberLabel: numberFound?.label ?? null,
    receiptNumberGuessed: Boolean(numberFound?.uncertain),
    supplier, supplierMatched, supplierConfirmed: supplierMatched || supplierHasOrgNumber(lines, supplier), accountCode, accountGuessed, accountSource, currency,
    accountChoices: accountSource === 'supplier' ? accountChoices : null,
    notReceipt: false, documentKind: doc.isInvoice ? 'invoice' : 'receipt',
    paymentMethod: detectPaymentMethod(text, { isInvoice: doc.isInvoice }).method,
    reverseCharge, reverseChargeUnclear,
  }));
}
