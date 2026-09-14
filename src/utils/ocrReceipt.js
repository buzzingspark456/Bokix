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

/**
 * Parsar rå OCR-text och extraherar kvittodata med smarta heuristiker.
 */
export function parseReceiptText(text) {
  if (!text || typeof text !== 'string') {
    return { date: null, amount: null, vatRate: 25, vatRateGuessed: true, supplier: null, supplierMatched: false, accountCode: null, currency: null };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

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
    if (primaryAmountKeywords.test(line) && !/subtotal|delbelopp/i.test(line)) {
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
      if (secondaryAmountKeywords.test(line)) {
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
  if (!amount) {
    let max = 0;
    let maxLine = null;
    for (const line of lines) {
      const skipWhole = ID_LIKE_LINE_RE.test(line) || DATE_LIKE_LINE_RE.test(line);
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
    if (max > 0) { amount = max; amountLine = maxLine; }
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
    if (s.re.test(fullText)) {
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
  const isForeignService = /supabase|vercel|stripe|github|aws|amazon web services|google cloud|openai|adobe|digitalocean|heroku|jetbrains|slack|zoom|figma|notion/i.test(fullText);

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
  const vatRateGuessed = vatRate === null;
  if (vatRateGuessed) {
    vatRate = isForeignService ? 0 : 25;
  }

  // ── 5. Fallback kontoregler ───────────────────────────────────────────────
  // Delad lista (utils/accountCategories.js) — samma regler bankimporten
  // (Bank.jsx) föreslår konton med.
  if (!accountCode) {
    for (const { re, code } of ACCOUNT_KEYWORD_RULES) {
      if (re.test(fullText)) {
        accountCode = code;
        break;
      }
    }
  }

  return { date, amount, vatRate, vatRateGuessed, supplier, supplierMatched, accountCode, currency };
}
