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
 */

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

/**
 * Kör Tesseract OCR på en bild eller canvas i webbläsaren.
 */
async function extractTextFromImage(imageSource, onProgress) {
  onProgress?.('Startar OCR-motor…');
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
    const { data } = await worker.recognize(imageSource);
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
 * Kända leverantörer och deras typiska bokföringskonton & momssatser.
 */
const KNOWN_SUPPLIERS = [
  // Molntjänster & SaaS (utländska = 0% svensk moms, omvänd skattskyldighet)
  { re: /supabase/i, name: 'Supabase', account: '6540', vat: 0 },
  { re: /vercel/i, name: 'Vercel', account: '6540', vat: 0 },
  { re: /github/i, name: 'GitHub', account: '6540', vat: 0 },
  { re: /openai/i, name: 'OpenAI', account: '6540', vat: 0 },
  { re: /aws|amazon web services/i, name: 'AWS', account: '6540', vat: 0 },
  { re: /google(?:\s*cloud|\s*workspace)?/i, name: 'Google', account: '6540', vat: 0 },
  { re: /adobe/i, name: 'Adobe', account: '5420', vat: 0 },
  { re: /microsoft/i, name: 'Microsoft', account: '5420', vat: 0 },
  { re: /apple\b/i, name: 'Apple', account: '5420', vat: 25 },
  { re: /slack/i, name: 'Slack', account: '6540', vat: 0 },
  { re: /zoom\b/i, name: 'Zoom', account: '6540', vat: 0 },
  { re: /figma/i, name: 'Figma', account: '6540', vat: 0 },
  { re: /notion/i, name: 'Notion', account: '6540', vat: 0 },
  { re: /spotify/i, name: 'Spotify', account: '6990', vat: 25 },

  // Matvaror & representation (12% moms). Konto 6071 "Representation,
  // avdragsgill" — RÄTTAT (stod tidigare 5010, som i Bokix egen
  // kontoplan är "Lokalhyra", se AccountsData.js: en riktig felskrivning,
  // inte en avsedd genväg. 6071 fanns inte alls i DEFAULT_ACCOUNTS innan
  // den här rättningen, tillagt i AccountsData.js i samma commit.
  { re: /coop/i, name: 'Coop', account: '6071', vat: 12 },
  { re: /ica\b/i, name: 'ICA', account: '6071', vat: 12 },
  { re: /willys/i, name: 'Willys', account: '6071', vat: 12 },
  { re: /lidl/i, name: 'Lidl', account: '6071', vat: 12 },
  { re: /hemk[öo]p/i, name: 'Hemköp', account: '6071', vat: 12 },
  { re: /espresso house/i, name: 'Espresso House', account: '6071', vat: 12 },
  { re: /pressbyr[åa]n/i, name: 'Pressbyrån', account: '6071', vat: 12 },
  { re: /7-eleven|seven eleven/i, name: '7-Eleven', account: '6071', vat: 12 },
  { re: /mcdonald'?s/i, name: "McDonald's", account: '6071', vat: 12 },
  { re: /burger king/i, name: 'Burger King', account: '6071', vat: 12 },
  { re: /max burger|max restauranger/i, name: 'MAX', account: '6071', vat: 12 },

  // Drivmedel & fordon (25% moms)
  { re: /circle k/i, name: 'Circle K', account: '5611', vat: 25 },
  { re: /okq8|ok q8/i, name: 'OKQ8', account: '5611', vat: 25 },
  { re: /preem/i, name: 'Preem', account: '5611', vat: 25 },
  { re: /st1\b/i, name: 'St1', account: '5611', vat: 25 },
  { re: /shell/i, name: 'Shell', account: '5611', vat: 25 },
  { re: /qstar/i, name: 'Qstar', account: '5611', vat: 25 },
  { re: /ingo\b/i, name: 'INGO', account: '5611', vat: 25 },

  // Kontor, elektronik & verktyg (25% moms)
  { re: /biltema/i, name: 'Biltema', account: '6110', vat: 25 },
  { re: /clas ohlson/i, name: 'Clas Ohlson', account: '6110', vat: 25 },
  { re: /bauhaus/i, name: 'Bauhaus', account: '5400', vat: 25 },
  { re: /hornbach/i, name: 'Hornbach', account: '5400', vat: 25 },
  { re: /jula\b/i, name: 'Jula', account: '5400', vat: 25 },
  { re: /webhallen/i, name: 'Webhallen', account: '5400', vat: 25 },
  { re: /dustin/i, name: 'Dustin', account: '5400', vat: 25 },
  { re: /elgiganten/i, name: 'Elgiganten', account: '5400', vat: 25 },
  { re: /kjell\s*(?:&|och)\s*company/i, name: 'Kjell & Company', account: '5400', vat: 25 },
  { re: /ikea/i, name: 'IKEA', account: '5410', vat: 25 },

  // Frakt & logistik (25% moms)
  { re: /postnord/i, name: 'PostNord', account: '6230', vat: 25 },
  { re: /dhl/i, name: 'DHL', account: '6230', vat: 25 },
  { re: /ups\b/i, name: 'UPS', account: '6230', vat: 25 },
  { re: /fedex/i, name: 'FedEx', account: '6230', vat: 25 },

  // Resor & taxi (6% moms)
  { re: /sj\b/i, name: 'SJ', account: '5810', vat: 6 },
  { re: /sl\b|storstockholms lokaltrafik/i, name: 'SL', account: '5810', vat: 6 },
  { re: /v[äa]sttrafik/i, name: 'Västtrafik', account: '5810', vat: 6 },
  { re: /sk[åa]netrafiken/i, name: 'Skånetrafiken', account: '5810', vat: 6 },
  { re: /uber/i, name: 'Uber', account: '5810', vat: 6 },
  { re: /bolt/i, name: 'Bolt', account: '5810', vat: 6 },
  { re: /taxi kurir|taxi stockholm|taxi g[öo]teborg/i, name: 'Taxi', account: '5810', vat: 6 },
];

/**
 * Parsar rå OCR-text och extraherar kvittodata med smarta heuristiker.
 */
export function parseReceiptText(text) {
  if (!text || typeof text !== 'string') {
    return { date: null, amount: null, vatRate: 25, supplier: null, accountCode: null, currency: null };
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

  for (const s of KNOWN_SUPPLIERS) {
    if (s.re.test(fullText)) {
      supplier = s.name;
      accountCode = s.account;
      if (s.vat !== undefined) vatRate = s.vat;
      break;
    }
  }

  // Om leverantören inte matchade känd lista, använd ren första textrad
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

  if (vatRate === null) {
    vatRate = isForeignService ? 0 : 25;
  }

  // ── 5. Fallback kontoregler ───────────────────────────────────────────────
  if (!accountCode) {
    const accountRules = [
      { re: /bensin|diesel|drivmedel|tankst|fuel/, code: '5611' },
      { re: /parkering|parking|p-hus|p-avgift/, code: '5612' },
      { re: /tåg|flyg|resa|biljett|sas\b|norwegian/, code: '5810' },
      { re: /hotell|hotel|logi|airbnb|booking\.com/, code: '5410' },
      { re: /restaurang|lunch|middag|fika|café|cafe|mat|livsmedel|grocery/, code: '6071' },
      { re: /kontors|papper|penna|bläck|toner|staples/, code: '6110' },
      { re: /porto|frakt|paket|post|fedex|ups/, code: '6230' },
      // OBS: "\b3\b" (fristående siffran 3, operatören "3"/tre.se) — INTE
      // "3\b", som matchade sista siffran i vilket belopp eller referens-
      // nummer som helst så fort det råkade sluta på 3 (t.ex. "88213" i ett
      // ordernummer), och kategoriserade då kvittot fel som telefonkostnad.
      { re: /telefon|mobil|abonnemang|tele2|telia|\b3\b|comviq|telenor/, code: '6212' },
      { re: /internet|bredband|fiber|itux|bahnhof/, code: '6212' },
      { re: /server|hosting|cloud|saas|domän|domain|software|licens/, code: '6540' },
      { re: /facklitteratur|böcker|tidskrift|bok\b/, code: '6980' },
      { re: /representation|gåva|present/, code: '6072' },
      { re: /reklam|annons|marknadsföring|facebook ads|google ads/, code: '6100' },
      { re: /elräkning|elnät|vattenfall|e\.on|fortum/, code: '5000' },
      { re: /verktyg|maskin|utrustning/, code: '5400' },
    ];
    for (const { re, code } of accountRules) {
      if (re.test(fullText)) {
        accountCode = code;
        break;
      }
    }
  }

  return { date, amount, vatRate, supplier, accountCode, currency };
}
