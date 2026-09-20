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

const MONTHS_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', maj: '05', may: '05',
  jun: '06', jul: '07', aug: '08', sep: '09', okt: '10', oct: '10',
  nov: '11', dec: '12',
  januari: '01', februari: '02', mars: '03', april: '04',
  juni: '06', juli: '07', augusti: '08', september: '09', oktober: '10',
  november: '11', december: '12',
  january: '01', february: '02', march: '03',
  june: '06', july: '07', august: '08', october: '10',
};

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
const MONEY_DECIMAL_RE = /\d[\d\s]*[,.]\d{1,2}\b/g;
// Rena heltalsbelopp på minst 3 siffror, ev. tusentalsgrupperat ("5,000",
// "5000") — krävs för valutor utan decimaler (yen, och ofta yuan på större
// B2B-fakturor). Ett ensamt en/tvåsiffrigt heltal matchas medvetet INTE
// (för lätt att råka plocka upp en momssats eller ett kvantitetstal).
const MONEY_WHOLE_RE = /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{3,6}\b/g;
// Facit för lastAmountOnLine, som bara körs på rader som REDAN matchat ett
// starkt nyckelord (totalt/summa/att betala/…) — där är ett heltal en
// säker kandidat också, till skillnad från fallback-sökningen nedan som
// letar i HELA dokumentet utan någon sån kontext (se idLikeLine där).
const MONEY_TOKEN_RE = /\d[\d\s]*[,.]\d{1,2}\b|\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{3,6}\b/g;

/** Sista (störst rimliga) beloppet på en rad, tolkat med parseMoneyToken. */
function lastAmountOnLine(line) {
  const matches = line.match(MONEY_TOKEN_RE);
  if (!matches) return null;
  const parsed = matches.map(parseMoneyToken).filter(v => v !== null && v > 0);
  return parsed.length ? parsed[parsed.length - 1] : null;
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
      const pageText = textContent.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ');
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
 * Förminskar en bild (Blob/File) eller canvas till max MAX_OCR_DIMENSION på
 * långsidan innan den går till Tesseract — no-op om den redan är mindre.
 * `imageOrientation: 'from-image'` läser av EXIF-rotationen på riktiga
 * kameraforton (annars ritas en stående bild ut liggande på canvasen).
 * Om createImageBitmap saknas (mycket gamla webbläsare) körs OCR på
 * originalet precis som innan — aldrig ett hårt fel för det här.
 */
async function downscaleForOcr(imageSource) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return imageSource;
  let bitmap;
  try {
    bitmap = await createImageBitmap(imageSource, { imageOrientation: 'from-image' });
  } catch (err) {
    console.warn('[OCR] Kunde inte läsa bilden för förminskning, kör OCR på originalet:', err);
    return imageSource;
  }
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge <= MAX_OCR_DIMENSION) return imageSource;
    const scale = MAX_OCR_DIMENSION / longEdge;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close?.();
  }
}

/**
 * Kör Tesseract OCR på en bild eller canvas i webbläsaren.
 */
async function extractTextFromImage(imageSource, onProgress) {
  onProgress?.('Startar OCR-motor…');
  const scaled = await downscaleForOcr(imageSource);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['swe', 'eng'], 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onProgress?.(`Läser av kvitto… ${pct}%`);
      } else if (m.status === 'loading language traineddata') {
        onProgress?.('Laddar språkmodeller…');
      } else if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
        onProgress?.('Förbereder OCR…');
      }
    },
  });

  try {
    const { data } = await worker.recognize(scaled);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

/**
 * Kör OCR på en kvittofil (URL, Blob eller File) direkt på klienten.
 * @param {File|Blob|string} input — Fil, Blob eller URL till bild/PDF
 * @param {Function} [onProgress] — Callback för statusuppdateringar, t.ex. (msg) => setMsg(msg)
 * @returns {Promise<string>} Extraherad text
 */
export async function ocrFile(input, onProgress) {
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
      const res = await fetch(input);
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

  if (isPdf) {
    // 1. Snabb direkt-extrahering för digitala PDF-fakturor
    const text = await extractTextFromPdf(blob, onProgress);
    if (text && text.length >= 15) {
      return text;
    }

    // 2. Om PDF:en var ett skannat papperskvitto utan textlager, rendera sida 1 och kör OCR
    if (typeof document !== 'undefined') {
      try {
        onProgress?.('Skannad PDF — kör bild-OCR…');
        const canvas = await renderPdfPageToCanvas(blob);
        return await extractTextFromImage(canvas, onProgress);
      } catch (err) {
        console.warn('[OCR] Kunde inte rendera PDF till canvas:', err);
      }
    }
  }

  // 3. Bildkvitto (JPG, PNG, WEBP etc.)
  return await extractTextFromImage(blob, onProgress);
}

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
  const none = { vatRate: null, vatAmount: null, verified: false, mismatch: false };
  if (!amount || amount <= 0 || currency) return none;

  const vatLineRe = /moms|merv.rdes|\bvat\b|\bmva\b/i;
  const found = [];
  for (const line of lines || []) {
    if (!vatLineRe.test(line)) continue;
    // "Summa exkl. moms 800,00" är underlaget, inte momsen.
    if (/exkl|excl|netto|f[öo]re moms|before tax|subtotal|delsumma|underlag/i.test(line)) continue;
    // Beloppen på raden, utan procenttalet ("12%").
    const withoutPct = line.replace(/\d{1,2}(?:[.,]\d+)?\s*%/g, ' ');
    const money = (withoutPct.match(MONEY_DECIMAL_RE) || [])
      .map(parseMoneyToken)
      .filter(v => v !== null && v > 0 && v < amount);
    if (money.length === 0) continue;
    // Sista beloppet på raden är momsbeloppet (först kan underlaget ligga).
    found.push(money[money.length - 1]);
  }
  // Momstabell utan ordet "moms" på raden: "25% 719.20 179.80 899.00" är
  // sats, belopp, moms och totalt. Går raden ihop (belopp + moms = totalt) och
  // totalen är kvittots belopp är den raden facit för momsen.
  for (const line of lines || []) {
    if (!/%/.test(line)) continue;
    const tokens = (line.replace(/\d{1,2}(?:[.,]\d+)?\s*%/g, ' ').match(MONEY_DECIMAL_RE) || []).map(parseMoneyToken).filter(v => v !== null);
    let tableVat = null;
    for (let i = 0; i + 2 < tokens.length && !tableVat; i++) {
      const [n, v, g] = [tokens[i], tokens[i + 1], tokens[i + 2]];
      if (v > 0 && Math.abs(round2(n + v) - g) <= 0.02 && Math.abs(g - amount) <= 0.05) tableVat = v;
    }
    if (tableVat) { found.length = 0; found.push(tableVat); break; }
  }
  if (found.length === 0) return none;
  const vatAmount = round2(found.reduce((s, v) => s + v, 0));
  if (vatAmount <= 0 || vatAmount >= amount) return none;

  const expected = (rate) => round2(amount - amount / (1 + rate / 100));
  // Några ören i tolerans: kvitton avrundar per rad, inte på totalen.
  const tolerance = Math.max(0.05, 0.005 * found.length);
  const match = VAT_RATES.find(r => Math.abs(expected(r) - vatAmount) <= tolerance);
  if (match !== undefined) return { vatRate: match, vatAmount, verified: true, mismatch: false };
  // Ingen sats stämmer. Har kvittot ändå en uttalad sats är det en avvikelse.
  return { vatRate: null, vatAmount, verified: false, mismatch: !vatRateGuessed || vatRate !== null };
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
  { kind: 'referens', label: 'Referensnummer', re: /referens\s*-?\s*(?:nr|nummer)?\.?|reference\s*-?\s*(?:no|nr|number)\.?|ref\.?\s*-?\s*(?:nr|nummer|no)\.?/i },
];
const NOT_A_NUMBER_LINE_RE = /org\.?\s*nr|orgnr|\btel\b|telefon|phone|moms(?:reg)?\.?\s*nr|vat\s*(?:no|nr|number|id)|kund\s*-?\s*(?:nr|nummer)|customer\s*(?:no|nr|number|id)|personnummer|bankgiro|plusgiro|\biban\b/i;
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
  // En lång hex-sträng med både siffror och bokstäver är en kortterminalens
  // referens eller en hash, inte ett kvittonummer.
  if (/^(?=.*[a-f])(?=.*\d)[0-9a-f]{16,}$/i.test(t)) return null;
  return t;
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
  const list = lines || [];
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
        scan.lastIndex = m.index + 1;
      }
      if (inlineNumber) return { number: inlineNumber, kind, label };
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
          const candidateLine = list[i + k].trim();
          if (NOT_A_NUMBER_LINE_RE.test(candidateLine)) break;
          const whole = candidateLine.match(new RegExp(`^${NUMBER_TOKEN}$`));
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
 * `isInvoice` säger om det snarare är en faktura än ett kvitto.
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
  return { isReceipt: hasMoney && score >= 2, score, isInvoice: /faktura|invoice/i.test(body) };
}

// Ett leverantörsnamn ska börja vid ett ordbörjan: "ICA" är ICA, men "Africa"
// är inte det. Testar varje förekomst, inte bara den första.
function matchesAtWordStart(re, text) {
  const g = new RegExp(re.source, 'gi');
  let m;
  while ((m = g.exec(text))) {
    const before = text[m.index - 1];
    if (!before || !/[\p{L}\d]/u.test(before)) return true;
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

// Rader som INTE är totalen: belopp exklusive moms, momsen själv, rabatter,
// växel. "Totalt inkl. moms" är däremot totalen, trots ordet moms.
function isNotTotalLine(line) {
  if (/exkl|excl|ex\.?\s*moms|f[öo]re moms|netto|before tax|\bnet\b|rabatt|discount|avrundning|v[äa]xel|tillbaka|\bchange\b/i.test(line)) return true;
  if (/\bmoms\b|\bvat\b|\btax\b|\bmva\b/i.test(line) && !/inkl|incl|totalt|total|att betala|amount due|brutto|gross/i.test(line)) return true;
  return false;
}
const NET_LINE_RE = /exkl\.?\s*moms|excl\.?\s*(?:vat|tax)|netto|f[öo]re moms|before tax|subtotal|delsumma/i;

// Hur det betalades, ur texten på kvittot. En uttrycklig rad ("Betalningssätt:
// Swish", "Payment method: Card") väger tyngre än ett lösryckt ord någon
// annanstans. Kort och Swish dras från bankkontot, kontant från kassan, och
// en faktura som inte visar någon betalning är ännu obetald.
const PAYMENT_LABEL_RE = /(?:betalningss[äa]tt|betals[äa]tt|payment\s*(?:method|type)|betalning|betalt\s*med|paid\s*(?:by|with))\s*[:\-]?\s*(.*)/i;
const PAY_SWISH_RE = /\bswish\b/i;
const PAY_CARD_RE = /\b(?:kort(?:betalning|k[öo]p|typ)?|bankkort|card|mastercard|maestro|debit|amex|contactless|kontaktl[öo]s)\b/i;
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
  if (isInvoice) return { method: 'invoice', explicit: false };
  const any = classify(source);
  if (any) return { method: any, explicit: false };
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

const EMPTY_PARSE = {
  date: null, amount: null, amountGuessed: false, amountVerified: false,
  vatRate: 25, vatRateGuessed: true, vatAmount: null, vatVerified: false, vatMismatch: false,
  receiptNumber: null, receiptNumberKind: null, receiptNumberLabel: null,
  supplier: null, supplierMatched: false, accountCode: null, accountGuessed: false, accountSource: null,
  currency: null, notReceipt: false, documentKind: null, paymentMethod: null,
  reverseCharge: null, reverseChargeUnclear: false,
};

/**
 * Parsar rå OCR-text och extraherar kvittodata med smarta heuristiker.
 */
export function parseReceiptText(text) {
  if (!text || typeof text !== 'string') {
    return { ...EMPTY_PARSE };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  // Ett dokument som inte är ett kvitto eller en faktura fylls aldrig i.
  const doc = classifyDocument(text, lines);
  if (!doc.isReceipt) return { ...EMPTY_PARSE, notReceipt: true, documentKind: 'other' };
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

  let date = null;
  for (const line of lines) {
    // YYYY-MM-DD eller YYYY/MM/DD eller YYYY.MM.DD
    const m1 = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m1) {
      date = `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
      break;
    }
    // DD/MM/YYYY eller MM/DD/YYYY (- eller . fungerar också) — se
    // resolveDayMonth ovan för vilken tolkning som vinner.
    const m2 = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m2) {
      const { day, month } = resolveDayMonth(m2[1], m2[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        date = `${m2[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        break;
      }
    }
    // DD/MM-YY eller MM/DD-YY (t.ex. "01/06-22" eller "06/01-22")
    const m3 = line.match(/\b(\d{1,2})[/.-](\d{1,2})[-]([12]\d)\b/);
    if (m3) {
      const yr = parseInt(m3[3], 10);
      const fullYear = yr < 70 ? 2000 + yr : 1900 + yr;
      const { day, month } = resolveDayMonth(m3[1], m3[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        date = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        break;
      }
    }
    // Textdatum: "May 12, 2024" eller "12 maj 2024" eller "12 juni 2023"
    const m4 = line.match(/\b(\d{1,2})?\s*([a-zA-ZåäöÅÄÖ]{3,10})\s+(\d{1,2})?,?\s*(20\d{2})\b/);
    if (m4) {
      const monthStr = m4[2].toLowerCase();
      const monthNum = MONTHS_MAP[monthStr];
      const day = (m4[1] || m4[3] || '1').padStart(2, '0');
      const year = m4[4];
      if (monthNum) {
        date = `${year}-${monthNum}-${day}`;
        break;
      }
    }
  }

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
      const skipWhole = ID_LIKE_LINE_RE.test(line) || DATE_LIKE_LINE_RE.test(line) || !CURRENCY_MARK_RE.test(line);
      const matches = [
        ...(line.match(MONEY_DECIMAL_RE) || []),
        ...(skipWhole ? [] : (line.match(MONEY_WHOLE_RE) || [])),
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
  let currency = null;
  if (amountLine) {
    const explicitSek = /\bsek\b|\bkr\b|:-/i.test(amountLine);
    if (!explicitSek) {
      if (/\$/.test(amountLine)) currency = 'USD';
      else if (/£/.test(amountLine)) currency = 'GBP';
      else if (/€/.test(amountLine)) currency = 'EUR';
      // 元 är entydigt kinesiska yuan (RMB) — förekommer aldrig på ett
      // japanskt kvitto. ¥ ensamt är tvetydigt mellan yen och yuan;
      // internationellt är yen den vanligare tolkningen av tecknet utan
      // vidare sammanhang, så det är förvalet.
      else if (/元/.test(amountLine)) currency = 'CNY';
      else if (/¥/.test(amountLine)) currency = 'JPY';
      else {
        const codeMatch = amountLine.match(/\b(USD|GBP|EUR|NOK|DKK|CHF|JPY|CNY|RMB|CAD|AUD)\b/i);
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
  if (!currency && amount && !/\bsek\b|\bkr\b|kronor|:-/i.test(text)) {
    if (/\bUSD\b|US\$|\$/.test(text)) currency = 'USD';
    else if (/\bGBP\b|£/.test(text)) currency = 'GBP';
    else if (/\bEUR\b|€/.test(text)) currency = 'EUR';
    else {
      const codeAnywhere = text.match(/\b(NOK|DKK|CHF|JPY|CNY|RMB|CAD|AUD)\b/);
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

  for (const s of KNOWN_SUPPLIERS) {
    if (matchesAtWordStart(s.re, headerText)) {
      supplier = s.name;
      accountCode = s.account;
      if (s.vat !== undefined) vatRate = s.vat;
      supplierMatched = true;
      break;
    }
  }

  // Om leverantören inte matchade känd lista, använd ren första textrad —
  // en RÅ gissning (den första rimliga textraden på kvittot, oftast
  // butiksnamnet men inte alltid), INTE en igenkänd leverantör.
  // supplierMatched förblir false här med flit.
  if (!supplier) {
    const skipRe = /^(\d[\d\s/.-]{4,}|\s*|kvitto|receipt|faktura|invoice|org\.?nr|datum|date|order|nr|org)$/i;
    for (const line of lines) {
      if (line.length >= 3 && !skipRe.test(line) && !line.includes('http') && !line.includes('@')) {
        const clean = line.replace(/[^\w\s&åäöÅÄÖ.,-]/g, '').trim();
        if (clean.length >= 2 && !/^\d+$/.test(clean)) {
          supplier = clean;
          break;
        }
      }
    }
  }

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
      if (strictRule(re).test(fullText)) {
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

  // ── 6. Momskontroll och kvittonummer ─────────────────────────────────────
  const vatCheck = crossCheckVat({ lines, amount, vatRate, vatRateGuessed, currency });
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
  const numberFound = findReceiptNumberDetailed(lines);

  return {
    date, amount, amountGuessed: amountVerified ? false : amountGuessed, amountVerified, vatRate,
    vatRateGuessed: vatCheck.verified ? false : vatRateGuessed,
    vatAmount: vatCheck.vatAmount, vatVerified: vatCheck.verified, vatMismatch: vatCheck.mismatch,
    receiptNumber: numberFound?.number ?? null, receiptNumberKind: numberFound?.kind ?? null, receiptNumberLabel: numberFound?.label ?? null,
    supplier, supplierMatched, accountCode, accountGuessed, accountSource, currency,
    notReceipt: false, documentKind: doc.isInvoice ? 'invoice' : 'receipt',
    paymentMethod: detectPaymentMethod(text, { isInvoice: doc.isInvoice }).method,
    reverseCharge, reverseChargeUnclear,
  };
}
