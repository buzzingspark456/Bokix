// Uppgifterna som står på en faktura utöver det som bokförs: säljarens
// org.nr, förfallodatum, OCR-nummer, bankgiro och plusgiro. Delas av
// kvittovyn, leverantörsfakturan och gratisverktyget via analyzeReceipt.
// Svenska kontrollsiffror avgör hur säkert ett nummer är: stämmer de är
// numret avläst, annars ska användaren kontrollera det (*Guessed).
import { isRealDate, pairLabelColumns, splitBankDetails } from './ocrReceipt';

const digitsOf = (s) => String(s || '').replace(/\D/g, '');

/** Mod 10 (Luhn), som bankgiro, plusgiro, OCR och org.nr använder. */
export function luhnOk(value) {
  const digits = digitsOf(value);
  if (!digits) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

const DUE_LABEL_RE = /f[öo]rfallo?(?:\s*-?\s*datum|dag)?|f[öo]rf\.?\s*datum|sista\s+betalnings(?:dag|datum)|betalas\s+senast|betala\s+senast|due\s+date|payment\s+due/i;
const ISSUE_LABEL_RE = /faktura\s*-?\s*datum|invoice\s+date/i;
const DATE_RE = /\b(20\d{2})[-./]?(\d{2})[-./]?(\d{2})\b|\b(\d{1,2})[-./](\d{1,2})[-./](20\d{2})\b/g;

function datesIn(line) {
  const out = [];
  for (const m of String(line).matchAll(DATE_RE)) {
    const iso = m[1]
      ? `${m[1]}-${m[2]}-${m[3]}`
      : `${m[6]}-${m[5].padStart(2, '0')}-${m[4].padStart(2, '0')}`;
    if (isRealDate(iso)) out.push(iso);
  }
  return out;
}

function findDueDate(lines, invoiceDate) {
  for (let i = 0; i < lines.length; i++) {
    const match = DUE_LABEL_RE.exec(lines[i]);
    if (!match) continue;
    let found = datesIn(lines[i].slice(match.index))[0];
    if (!found) {
      // Rubriker på en rad och värden under: "Fakturadatum  Förfallodatum".
      const issueFirst = ISSUE_LABEL_RE.test(lines[i].slice(0, match.index));
      for (const next of lines.slice(i + 1, i + 3)) {
        const dates = datesIn(next);
        if (dates.length) { found = dates[issueFirst && dates.length > 1 ? 1 : 0]; break; }
      }
    }
    if (found && (!invoiceDate || found >= invoiceDate)) return found;
  }
  return null;
}

const OCR_LABEL = '(?:ocr(?:\\s*-?\\s*(?:nummer|nr|no))?(?:\\s*/\\s*referens)?|betalningsreferens|referensnummer|payment\\s+reference)';
const OCR_SAME_LINE_RE = new RegExp(`\\b${OCR_LABEL}\\b\\.?[\\s:#.-]*(\\d[\\d ]{2,29}\\d)(?![\\d-])`, 'i');
const OCR_LABEL_ONLY_RE = new RegExp(`\\b${OCR_LABEL}\\b\\.?\\s*:?\\s*$`, 'i');
const ONLY_DIGITS_RE = /^\s*(\d[\d ]{2,29}\d)\s*$/;

function findOcrNumber(lines) {
  for (let i = 0; i < lines.length; i++) {
    const same = OCR_SAME_LINE_RE.exec(lines[i]);
    if (same) return digitsOf(same[1]);
    if (OCR_LABEL_ONLY_RE.test(lines[i])) {
      const next = ONLY_DIGITS_RE.exec(lines[i + 1] || '');
      if (next) return digitsOf(next[1]);
    }
  }
  return null;
}

const BANKGIRO_RE = /(?:bank\s?giro(?:nummer|nr|t)?|\bBG\b)\.?[\s:#.]*(\d{3,4}[-\s]?\d{4})(?!\d)/i;
const BANKGIRO_LABEL_RE = /(?:bank\s?giro(?:nummer|nr|t)?|\bBG\b)\.?\s*:?\s*$/i;
const BANKGIRO_ALONE_RE = /^\s*(\d{3,4}-\d{4})\s*$/;
const PLUSGIRO_RE = /(?:plus\s?giro(?:nummer|nr|t)?|post\s?giro|\bPG\b)\.?[\s:#.]*(\d{1,7}[-\s]?\d)(?!\d)/i;
const PLUSGIRO_LABEL_RE = /(?:plus\s?giro(?:nummer|nr|t)?|post\s?giro|\bPG\b)\.?\s*:?\s*$/i;
const PLUSGIRO_ALONE_RE = /^\s*(\d{1,7}-\d)\s*$/;

function findLabelled(lines, sameLine, labelOnly, alone) {
  for (let i = 0; i < lines.length; i++) {
    const same = sameLine.exec(lines[i]);
    if (same) return same[1];
    if (labelOnly.test(lines[i])) {
      const next = alone.exec(lines[i + 1] || '');
      if (next) return next[1];
    }
  }
  return null;
}

const formatBankgiro = (raw) => { const d = digitsOf(raw); return `${d.slice(0, -4)}-${d.slice(-4)}`; };
const formatPlusgiro = (raw) => { const d = digitsOf(raw); return `${d.slice(0, -1)}-${d.slice(-1)}`; };

const ORG_NUMBER_RE = /(?:org(?:anisations)?\.?\s*-?\s*n(?:umme)?r\.?|orgnr\.?|org\.?\s*no\.?|reg\.?\s*no\.?)\s*:?\s*((?:19|20)?\d{6}[-\s]?\d{4})(?!\d)/i;
const SE_VAT_RE = /\bSE\s?(\d{10})\s?01\b/i;
// Köparens block: raderna under de här rubrikerna handlar om köparen.
const BUYER_HEAD_RE = /fakturera[s]?\s+till|faktura(?:tions|rings)?adress|faktureringsadress|bill(?:ed)?\s+to|invoice\s+to|sold\s+to|leveransadress|\bk[öo]pare\b|\bkund\s*:/i;
// Säljaren står med dessa i sidfoten eller i huvudet.
const SELLER_MARK_RE = /f-?skatt|momsreg|vat\s*(?:no|nr|reg)|\bs[äa]te\b|bankgiro|plusgiro|·/i;
const BUYER_BLOCK_LINES = 8;

// Tolv siffror är ett personnummer med sekel (enskild firma): skrivs som tio.
const tenDigits = (s) => digitsOf(s).slice(-10);

/**
 * Säljarens org.nr. Köparens nummer står oftast också på fakturan, så en
 * rad i köparens block räknas bort och en rad med F-skatt eller momsregnummer
 * går först. Hellre inget nummer än köparens.
 */
function findSellerOrgNr(lines, own) {
  const ownDigits = [tenDigits(own?.orgNr), tenDigits(String(own?.vatNr || '').replace(/01$/, ''))].filter(d => d.length === 10);
  const candidates = [];
  lines.forEach((line, i) => {
    const raw = ORG_NUMBER_RE.exec(line)?.[1] || SE_VAT_RE.exec(line)?.[1];
    if (!raw) return;
    const digits = tenDigits(raw);
    if (ownDigits.includes(digits)) return;
    const marked = SELLER_MARK_RE.test(line);
    const inBuyerBlock = lines.slice(Math.max(0, i - BUYER_BLOCK_LINES), i + 1).some(l => BUYER_HEAD_RE.test(l));
    if (inBuyerBlock && !marked) return;
    candidates.push({ digits, score: marked ? 1 : 0 });
  });
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  return `${best.digits.slice(0, 6)}-${best.digits.slice(6)}`;
}

/**
 * Läser ut fakturauppgifterna ur texten. `own` = { orgNr, vatNr } för
 * företaget självt, `invoiceDate` hindrar att ett tidigare datum blir
 * förfallodatum. Svarar null när inget hittades.
 */
export function readInvoiceDetails(text, { own = {}, invoiceDate = null } = {}) {
  const lines = pairLabelColumns(splitBankDetails(String(text || '').split('\n').map(l => l.trim()).filter(Boolean)));
  const orgNr = findSellerOrgNr(lines, own);
  const dueDate = findDueDate(lines, invoiceDate);
  const bankgiroRaw = findLabelled(lines, BANKGIRO_RE, BANKGIRO_LABEL_RE, BANKGIRO_ALONE_RE);
  const plusgiroRaw = findLabelled(lines, PLUSGIRO_RE, PLUSGIRO_LABEL_RE, PLUSGIRO_ALONE_RE);
  const bankgiro = bankgiroRaw ? formatBankgiro(bankgiroRaw) : null;
  const plusgiro = plusgiroRaw ? formatPlusgiro(plusgiroRaw) : null;
  const found = findOcrNumber(lines);
  // Ett bankgiro bredvid ordet referens är inte ett OCR-nummer.
  const ocrNumber = found && found !== digitsOf(bankgiro) ? found : null;
  if (!orgNr && !dueDate && !bankgiro && !plusgiro && !ocrNumber) return null;
  return {
    orgNr, orgNrGuessed: Boolean(orgNr) && !luhnOk(orgNr),
    dueDate,
    ocrNumber, ocrNumberGuessed: Boolean(ocrNumber) && !luhnOk(ocrNumber),
    bankgiro, bankgiroGuessed: Boolean(bankgiro) && !luhnOk(bankgiro),
    plusgiro, plusgiroGuessed: Boolean(plusgiro) && !luhnOk(plusgiro),
  };
}
