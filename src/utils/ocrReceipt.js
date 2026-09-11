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
  june: '06', july: '07', august: '08', september: '09', october: '10',
  december: '12',
};

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

  // Matvaror & representation (12% moms)
  { re: /coop/i, name: 'Coop', account: '5010', vat: 12 },
  { re: /ica\b/i, name: 'ICA', account: '5010', vat: 12 },
  { re: /willys/i, name: 'Willys', account: '5010', vat: 12 },
  { re: /lidl/i, name: 'Lidl', account: '5010', vat: 12 },
  { re: /hemk[öo]p/i, name: 'Hemköp', account: '5010', vat: 12 },
  { re: /espresso house/i, name: 'Espresso House', account: '5010', vat: 12 },
  { re: /pressbyr[åa]n/i, name: 'Pressbyrån', account: '5010', vat: 12 },
  { re: /7-eleven|seven eleven/i, name: '7-Eleven', account: '5010', vat: 12 },
  { re: /mcdonald'?s/i, name: "McDonald's", account: '5010', vat: 12 },
  { re: /burger king/i, name: 'Burger King', account: '5010', vat: 12 },
  { re: /max burger|max restauranger/i, name: 'MAX', account: '5010', vat: 12 },

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
    return { date: null, amount: null, vatRate: 25, supplier: null, accountCode: null };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  // ── 1. Datum ──────────────────────────────────────────────────────────────
  let date = null;
  for (const line of lines) {
    // YYYY-MM-DD eller YYYY/MM/DD eller YYYY.MM.DD
    const m1 = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m1) {
      date = `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
      break;
    }
    // DD-MM-YYYY eller DD/MM/YYYY eller DD.MM.YYYY
    const m2 = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m2) {
      date = `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
      break;
    }
    // DD/MM-YY (t.ex. "01/06-22" eller "01-06-22")
    const m3 = line.match(/\b(\d{1,2})[/.-](\d{1,2})[-]([12]\d)\b/);
    if (m3) {
      const yr = parseInt(m3[3], 10);
      const fullYear = yr < 70 ? 2000 + yr : 1900 + yr;
      date = `${fullYear}-${m3[2].padStart(2, '0')}-${m3[1].padStart(2, '0')}`;
      break;
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
  const primaryAmountKeywords = /att betala|total amount|amount paid|amount due|totalt|total\b/i;
  const secondaryAmountKeywords = /summa|belopp|sum\b|to pay|kort|card|sek|kronor|subtotal/i;

  // 1. Försök först med primära nyckelord (t.ex. "Totalt: 193,75" eller "Att betala: 900,58")
  for (const line of lines) {
    if (primaryAmountKeywords.test(line) && !/subtotal|delbelopp/i.test(line)) {
      const matches = line.match(/(\d[\d\s]*[,.]\d{2})/g);
      if (matches) {
        const last = matches[matches.length - 1];
        const parsed = parseFloat(last.replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }
  }

  // 2. Om inget primärt hittades, prova sekundära nyckelord
  if (!amount) {
    for (const line of lines) {
      if (secondaryAmountKeywords.test(line)) {
        const matches = line.match(/(\d[\d\s]*[,.]\d{2})/g);
        if (matches) {
          const last = matches[matches.length - 1];
          const parsed = parseFloat(last.replace(/\s/g, '').replace(',', '.'));
          if (!isNaN(parsed) && parsed > 0) {
            amount = parsed;
            break;
          }
        }
      }
    }
  }

  // Fallback: leta efter det största rimliga beloppet med decimaler i hela dokumentet
  if (!amount) {
    let max = 0;
    for (const line of lines) {
      const matches = line.match(/(\d{1,6}[,.]\d{2})/g);
      if (matches) {
        for (const raw of matches) {
          const v = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
          if (!isNaN(v) && v > max && v < 500000) {
            max = v;
          }
        }
      }
    }
    if (max > 0) amount = max;
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
      { re: /restaurang|lunch|middag|fika|café|cafe|mat|livsmedel|grocery/, code: '5010' },
      { re: /kontors|papper|penna|bläck|toner|staples/, code: '6110' },
      { re: /porto|frakt|paket|post|fedex|ups/, code: '6230' },
      { re: /telefon|mobil|abonnemang|tele2|telia|3\b|comviq|telenor/, code: '6212' },
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

  return { date, amount, vatRate, supplier, accountCode };
}
