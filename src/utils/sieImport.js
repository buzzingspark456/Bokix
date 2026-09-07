// ── SIE4-import — läser en SIE4-fil (SIE4I ELLER SIE4E) och bygger de
// poster Bokix faktiskt kan skriva in: kontoplansrader och verifikationer.
// EN generell parser, inte fem hårdkodade Fortnox/Spiris/Bokio-
// integrationer — SIE4 är samma filstandard oavsett vilket program som
// skrev den. #SIETYP 4 är gemensamt för både 4I och 4E; vilken variant en
// fil faktiskt är avgörs inte av ett eget kodat fält utan av VILKA
// valfria taggar som förekommer (#RAR för flera år, #DIM/#OBJEKT för
// dimensioner brukar bara finnas i 4E) — så den här parsern läser alla
// valfria taggar tolerant istället för att grena på en "variant" som inte
// finns i själva formatet. Det är det som gör EN parser tillräcklig för
// båda.
//
// Lazy-importeras bara när en fil faktiskt släpps i wizard-modalen (se
// SieImportModal.jsx) — samma anledning som bankImport.js redan hålls
// utanför huvudbunten (papaparse/xlsx-motsvarigheten här är egen
// parsningslogik, inget tungt bibliotek, men principen — inte belasta
// alla besökare med kod bara import-flödet behöver — gäller ändå).
import { decodeSieBuffer } from './sieCharset';

// ── Radtokenisering ──────────────────────────────────────────────────
// SIE-rader är #TAGG värde1 värde2 "citerad text med mellanslag" ... —
// citattecken skyddar mellanslag, klammerparenteser {…} är en egen
// atomär token (dimensionslistan i #TRANS, oftast tom "{}"). #VER:s
// block-start/slut ("{" / "}" HELA på egen rad) hanteras separat i
// parseLines nedan, inte här — annars vore det omöjligt att skilja en
// tom dimensionslista "{}" i en #TRANS-rad från en flerradig blockstart.
function tokenizeLine(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '"') {
      let j = i + 1;
      let str = '';
      while (j < line.length && line[j] !== '"') { str += line[j]; j++; }
      tokens.push(str);
      i = j + 1;
    } else if (ch === '{') {
      let j = i + 1;
      let depth = 1;
      let content = '';
      while (j < line.length && depth > 0) {
        if (line[j] === '{') depth++;
        else if (line[j] === '}') { depth--; if (depth === 0) { j++; break; } }
        content += line[j];
        j++;
      }
      tokens.push(`{${content}}`);
      i = j;
    } else {
      let j = i;
      while (j < line.length && line[j] !== ' ' && line[j] !== '\t') j++;
      tokens.push(line.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

// Grupperar rå textrader till { tag, tokens, trans? } — #TRANS-rader
// samlas in under sin omslutande #VER via ett enkelt "aktuell verifikation
// pågår"-tillstånd, styrt av fristående "{"/"}"-rader.
function parseLines(text) {
  const rawLines = text.split(/\r\n|\r|\n/);
  const records = [];
  let currentVer = null;
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === '{') continue;
    if (line === '}') {
      if (currentVer) { records.push(currentVer); currentVer = null; }
      continue;
    }
    const tokens = tokenizeLine(line);
    const tag = tokens[0];
    if (!tag || tag[0] !== '#') continue; // strunta i skräprader utan taggmarkör
    if (tag === '#VER') {
      currentVer = { tag: '#VER', tokens: tokens.slice(1), trans: [] };
    } else if (tag === '#TRANS' && currentVer) {
      currentVer.trans.push(tokens.slice(1));
    } else {
      records.push({ tag, tokens: tokens.slice(1) });
    }
  }
  // En fil som glömt sista "}" — bevara ändå den sista verifikationen
  // istället för att tyst tappa den.
  if (currentVer) records.push(currentVer);
  return records;
}

function sieDateToIso(sieDate) {
  if (!sieDate || sieDate.length !== 8) return null;
  return `${sieDate.slice(0, 4)}-${sieDate.slice(4, 6)}-${sieDate.slice(6, 8)}`;
}

// SIE4:s beloppskonvention: debet är positivt, kredit är negativt (samma
// tecken-konvention som sieExport.js redan använder på export-hållet,
// getDebet(row)-getKredit(row)) — importern gör den omvända uppdelningen
// till appens EGNA radform (debet/kredit som TVÅ separata FÄLT, lagrade
// som STRÄNGAR — se verificationAmounts.js:s getDebet/getKredit, som
// läser row.debet/row.kredit, inte ett enda signerat belopp).
function splitSignedAmount(amount) {
  const rounded = Math.round(amount * 100) / 100;
  return rounded >= 0
    ? { debet: rounded.toFixed(2), kredit: '0' }
    : { debet: '0', kredit: (-rounded).toFixed(2) };
}

const BALANCE_EPSILON = 0.01;

// Riktiga SIE4-taggar den här generella importern medvetet INTE sparar
// någonstans (företagsadress, taxeringsår, valutakod, kontotyp/enhet,
// SRU-kodkoppling, dimensioner/objekt, budget m.fl. — ingen av dem har
// en motsvarighet i Bokix datamodell och är inte del av kravspecen).
// Skiljs medvetet från GENUINT okända/felstavade taggar: bara de senare
// ska generera en varning, annars skulle varenda verklig, fullständig
// SIE4-fil dränka förhandsgranskningen i varningar för helt normala rader.
const KNOWN_UNHANDLED_TAGS = new Set([
  '#FLAGGA', '#PROSA', '#FTYP', '#FNR', '#ADRESS', '#TAXAR', '#KPTYP',
  '#VALUTA', '#KTYP', '#ENHET', '#SRU', '#DIM', '#UNDERDIM', '#OBJEKT',
  '#OIB', '#OUB', '#PSALDO', '#PBUDGET', '#RTRANS', '#BTRANS', '#KSUMMA',
]);

/** Läser en uppladdad SIE4-fils rådata (ArrayBuffer) och bygger de
 * poster Bokix behöver. Kastar ALDRIG på ett trasigt/ofullständigt block
 * — okända/felaktiga rader blir warnings, inte en krasch, eftersom
 * verkliga exportfiler från andra program aldrig kan antas vara
 * läroboksrena. */
export function parseSieFile(arrayBuffer) {
  const text = decodeSieBuffer(arrayBuffer);
  const records = parseLines(text);

  const meta = { program: null, format: null, sieType: null, companyName: null, orgNr: null, generatedDate: null };
  const fiscalYears = [];
  const accountsByCode = new Map();
  const verifications = [];
  const openingBalances = [];
  const closingBalances = [];
  const warnings = [];

  for (const rec of records) {
    switch (rec.tag) {
      case '#PROGRAM':
        meta.program = rec.tokens.join(' ').trim();
        break;
      case '#FORMAT':
        meta.format = rec.tokens[0] || null;
        break;
      case '#SIETYP':
        meta.sieType = rec.tokens[0] || null;
        break;
      case '#FNAMN':
        meta.companyName = rec.tokens[0] || null;
        break;
      case '#ORGNR': {
        const raw = rec.tokens[0] || '';
        meta.orgNr = { raw, digitsOnly: raw.replace(/\D/g, '') };
        break;
      }
      case '#GEN':
        meta.generatedDate = sieDateToIso(rec.tokens[0]);
        break;
      case '#RAR': {
        const index = Number.parseInt(rec.tokens[0], 10);
        const start = sieDateToIso(rec.tokens[1]);
        const end = sieDateToIso(rec.tokens[2]);
        if (Number.isFinite(index) && start && end) {
          fiscalYears.push({ index, start, end });
        } else {
          warnings.push(`Kunde inte tolka #RAR-raden: ${rec.tokens.join(' ')}`);
        }
        break;
      }
      case '#KONTO': {
        const code = rec.tokens[0];
        const name = rec.tokens[1] || code;
        if (code) {
          // Senare #KONTO för samma kod (förekommer i verkliga filer,
          // t.ex. om ett program skriver ut kontoplanen två gånger) vinner
          // — inte en dubblett i listan.
          accountsByCode.set(code, { code, name });
        }
        break;
      }
      case '#IB': {
        const fiscalYearIndex = Number.parseInt(rec.tokens[0], 10);
        const account = rec.tokens[1];
        const amount = Number.parseFloat(rec.tokens[2]);
        if (account && Number.isFinite(amount)) {
          openingBalances.push({ fiscalYearIndex, account, amount });
        } else {
          warnings.push(`Kunde inte tolka #IB-raden: ${rec.tokens.join(' ')}`);
        }
        break;
      }
      case '#UB': {
        const fiscalYearIndex = Number.parseInt(rec.tokens[0], 10);
        const account = rec.tokens[1];
        const amount = Number.parseFloat(rec.tokens[2]);
        if (account && Number.isFinite(amount)) {
          closingBalances.push({ fiscalYearIndex, account, amount });
        }
        break;
      }
      case '#RES':
        // Resultatkontobalanser — den här appen har inget eget lagrat
        // "resultatbalans"-fält, resultaträkningen härleds alltid ur
        // verifikationerna (samma princip som IB/UB). Rent informativt,
        // sparas inte.
        break;
      case '#VER': {
        const [series, number, dateRaw, description] = rec.tokens;
        const date = sieDateToIso(dateRaw);
        if (!date) {
          warnings.push(`Verifikation utan giltigt datum hoppades över: ${rec.tokens.join(' ')}`);
          break;
        }
        const rows = [];
        for (const transTokens of rec.trans) {
          const account = transTokens[0];
          // transTokens[1] är dimensionslistan ("{}" oftast) — den här
          // generella importern sparar inte projekt-/kostnadsställe-
          // dimensioner, bara själva kontotransaktionen.
          const amount = Number.parseFloat(transTokens[2]);
          if (!account || !Number.isFinite(amount)) {
            warnings.push(`Kunde inte tolka #TRANS-raden i verifikation ${series || ''}${number || ''}: ${transTokens.join(' ')}`);
            continue;
          }
          rows.push({ account, accountName: accountsByCode.get(account)?.name || account, ...splitSignedAmount(amount) });
        }
        const debetSum = rows.reduce((s, r) => s + Number(r.debet), 0);
        const kreditSum = rows.reduce((s, r) => s + Number(r.kredit), 0);
        if (Math.abs(debetSum - kreditSum) > BALANCE_EPSILON) {
          warnings.push(`Verifikation ${series || ''}${number || ''} (${date}) balanserar inte (debet ${debetSum.toFixed(2)}, kredit ${kreditSum.toFixed(2)}) — kontrolleras manuellt innan import.`);
        }
        verifications.push({
          series: series || 'A',
          sieNumber: number || '',
          date,
          description: description || '',
          rows,
          balanced: Math.abs(debetSum - kreditSum) <= BALANCE_EPSILON,
        });
        break;
      }
      default:
        // Genuint okänd tagg (felstavning, en programspecifik utökning,
        // eller helt korrupt indata) — se KNOWN_UNHANDLED_TAGS ovan för
        // riktiga SIE4-taggar vi medvetet väljer att inte spara, de
        // hamnar aldrig här.
        if (rec.tag && rec.tag.startsWith('#') && !KNOWN_UNHANDLED_TAGS.has(rec.tag)) {
          warnings.push(`Okänd/ej hanterad post ignorerad: ${rec.tag}`);
        }
    }
  }

  // Konton som förekommer i en #TRANS men aldrig deklarerats via #KONTO
  // — vanligt i lite slarviga exporter. Läggs ändå till (kodnamnet blir
  // kontokoden själv) men flaggas, så mappningssteget i wizarden kan visa
  // det tydligt istället för att tyst hitta på ett kontonamn.
  const referencedCodes = new Set();
  verifications.forEach(v => v.rows.forEach(r => referencedCodes.add(r.account)));
  referencedCodes.forEach(code => {
    if (!accountsByCode.has(code)) {
      accountsByCode.set(code, { code, name: code });
      warnings.push(`Konto ${code} används i en verifikation men saknar egen #KONTO-rad i filen — kontrollera kontonamnet.`);
    }
  });

  return {
    meta,
    fiscalYears: fiscalYears.sort((a, b) => b.index - a.index),
    accounts: Array.from(accountsByCode.values()),
    verifications,
    openingBalances,
    closingBalances,
    warnings,
  };
}

/** SIE4:s #IB-rader (ingående balans per konto) har ingen egen
 * motsvarighet i Bokix datamodell — computeLedger() i
 * reportCalculations.js härleder alltid saldon ur bokförda
 * verifikationer, det finns inget separat "IB"-fält att skriva till.
 * Samma mönster som InitialData.js:s "Ägarens insättning" och
 * Taxes.jsx:s bokslutsverifikation: en riktig, daterad, balanserad
 * verifikation som SÄTTER startsaldot genom att bokföra det, istället för
 * en särskild balanspost. */
export function buildOpeningVerification(openingBalances, fiscalYearStart, { series = 'A', accountsByCode } = {}) {
  // Bara innevarande räkenskapsår (index 0) blir en verifikation — äldre
  // års #IB (index -1, -2, …) visas bara som sammanhang i förhandsgranskningen,
  // den här appen har ingen flerårig huvudbok utöver lockedFiscalYears.
  const currentYearBalances = openingBalances.filter(b => b.fiscalYearIndex === 0 && b.amount !== 0);
  if (currentYearBalances.length === 0) return null;

  const rows = currentYearBalances.map(b => ({
    account: b.account,
    accountName: accountsByCode?.get(b.account)?.name || b.account,
    ...splitSignedAmount(b.amount),
  }));
  const debetSum = rows.reduce((s, r) => s + Number(r.debet), 0);
  const kreditSum = rows.reduce((s, r) => s + Number(r.kredit), 0);
  const balanced = Math.abs(debetSum - kreditSum) <= BALANCE_EPSILON;

  return {
    series,
    date: fiscalYearStart,
    description: 'Ingående balanser (SIE4-import)',
    source: 'sie_import',
    status: 'booked',
    rows,
    balanced,
  };
}
