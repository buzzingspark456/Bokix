/**
 * ocrReceipt.js — klient-side hjälpfunktioner för OCR.
 *
 * OCR körs server-side via /api/ocr (Node + pdfjs + tesseract.js).
 * Den här filen skickar bara URL:en till servern och parsar
 * den returnerade texten.
 */

/**
 * Kör OCR på en kvittofil via server-API:et.
 * @param {File|Blob|string} input — antingen en URL (sträng) eller ett File/Blob-objekt
 * @returns {Promise<string>} Extraherad text
 */
export async function ocrFile(input) {
  let url;

  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof File || input instanceof Blob) {
    // Säkert sätt att göra data-URL utan stack-overflow
    url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  } else {
    throw new Error('ocrFile: input must be a URL string or File');
  }

  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `OCR misslyckades (${res.status})`);
  }

  const data = await res.json();
  return data.text || '';
}

const MONTHS_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', maj: '05', may: '05',
  jun: '06', jul: '07', aug: '08', sep: '09', okt: '10', oct: '10',
  nov: '11', dec: '12',
  januari: '01', februari: '02', mars: '03', april: '04',
  juni: '06', juli: '07', augusti: '08', september: '09', oktober: '10',
  november: '11', december: '12',
};

/**
 * Parsar rå OCR-text och försöker extrahera kvittodata.
 */
export function parseReceiptText(text) {
  if (!text) return { date: null, amount: null, vatRate: 25, supplier: null, accountCode: null };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  // ── 1. Datum ──
  let date = null;
  for (const line of lines) {
    // YYYY-MM-DD eller YYYY/MM/DD
    const m1 = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m1) {
      date = `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
      break;
    }
    // DD-MM-YYYY eller DD/MM/YYYY
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
    // "May 12, 2024" eller "12 May 2024" eller "12 juni 2023"
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

  // ── 2. Totalbelopp ──
  let amount = null;
  const amountKeywords = /totalt|att betala|summa|total|belopp|sum|to pay|amount paid|amount due|total amount/i;

  for (const line of lines) {
    if (amountKeywords.test(line)) {
      // Hitta belopp i stil med 193,75 eller 193.75 eller 1 250,00 eller $25.00
      const matches = line.match(/(\d[\d\s]*[,.]\d{2})/g);
      if (matches) {
        // Ta sista matchen på raden (ofta står "Totalt 25% 193,75")
        const last = matches[matches.length - 1];
        const parsed = parseFloat(last.replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
          break;
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

  // ── 3. Momssats & Leverantör & Konto ──
  let vatRate = null;
  const isForeignService = /supabase|vercel|stripe|github|aws|amazon web services|google cloud|openai|adobe|digitalocean|heroku|jetbrains/i.test(fullText);

  // Kända leverantörer
  let supplier = null;
  const knownSuppliers = [
    { re: /supabase/i, name: 'Supabase', account: '6540', vat: 0 },
    { re: /vercel/i, name: 'Vercel', account: '6540', vat: 0 },
    { re: /github/i, name: 'GitHub', account: '6540', vat: 0 },
    { re: /openai/i, name: 'OpenAI', account: '6540', vat: 0 },
    { re: /aws|amazon web services/i, name: 'AWS', account: '6540', vat: 0 },
    { re: /google/i, name: 'Google', account: '6540', vat: 0 },
    { re: /adobe/i, name: 'Adobe', account: '5420', vat: 0 },
    { re: /microsoft/i, name: 'Microsoft', account: '5420', vat: 0 },
    { re: /spotify/i, name: 'Spotify', account: '6990', vat: 25 },
    { re: /coop/i, name: 'Coop', account: '5010', vat: 12 },
    { re: /ica\b/i, name: 'ICA', account: '5010', vat: 12 },
    { re: /willys/i, name: 'Willys', account: '5010', vat: 12 },
    { re: /lidl/i, name: 'Lidl', account: '5010', vat: 12 },
    { re: /hemköp/i, name: 'Hemköp', account: '5010', vat: 12 },
    { re: /circle k/i, name: 'Circle K', account: '5611', vat: 25 },
    { re: /okq8|ok q8/i, name: 'OKQ8', account: '5611', vat: 25 },
    { re: /preem/i, name: 'Preem', account: '5611', vat: 25 },
    { re: /st1\b/i, name: 'St1', account: '5611', vat: 25 },
    { re: /shell/i, name: 'Shell', account: '5611', vat: 25 },
    { re: /biltema/i, name: 'Biltema', account: '6110', vat: 25 },
    { re: /clas ohlson/i, name: 'Clas Ohlson', account: '6110', vat: 25 },
    { re: /bauhaus/i, name: 'Bauhaus', account: '5400', vat: 25 },
    { re: /postnord/i, name: 'PostNord', account: '6230', vat: 25 },
    { re: /dhl/i, name: 'DHL', account: '6230', vat: 25 },
    { re: /sj\b/i, name: 'SJ', account: '5810', vat: 6 },
    { re: /sl\b|storstockholms lokaltrafik/i, name: 'SL', account: '5810', vat: 6 },
    { re: /uber/i, name: 'Uber', account: '5810', vat: 6 },
    { re: /bolt/i, name: 'Bolt', account: '5810', vat: 6 },
    { re: /taxi/i, name: 'Taxi', account: '5810', vat: 6 },
  ];

  let accountCode = null;
  for (const s of knownSuppliers) {
    if (s.re.test(fullText)) {
      supplier = s.name;
      accountCode = s.account;
      if (s.vat !== undefined) vatRate = s.vat;
      break;
    }
  }

  // Om leverantör inte matchade känd lista, ta ren första rad
  if (!supplier) {
    const skipRe = /^(\d[\d\s/.-]{4,}|\s*|kvitto|receipt|faktura|invoice|org\.?nr|datum|date)$/i;
    for (const line of lines) {
      if (line.length >= 3 && !skipRe.test(line) && !line.includes('http')) {
        const clean = line.replace(/[^\w\s&åäöÅÄÖ.,-]/g, '').trim();
        if (clean.length >= 2 && !/^\d+$/.test(clean)) {
          supplier = clean;
          break;
        }
      }
    }
  }

  // Leta explicit efter momssats om inte redan satt
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

  // Fallback konto-regler om konto inte redan valts
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
      if (re.test(fullText)) { accountCode = code; break; }
    }
  }

  return { date, amount, vatRate, supplier, accountCode };
}
