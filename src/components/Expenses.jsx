import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Receipt, X, Clock, Trash2, RotateCcw, Search, ScanLine, FolderPlus, Pencil,
} from './icons';
import { AccountSearch } from './shared/SearchInputs';
import AccountInlinePicker from './shared/AccountInlinePicker';
import { DocumentPane } from './shared/DocumentViewer';
import { TextSuggestInput } from './shared/SearchInputs';
import ListPageHeader from './shared/ListPageHeader';
import AnchoredDropdown, { useDismissOnOutsideClick } from './shared/AnchoredDropdown';
import { uploadFileToStorage } from '../utils/fileUpload';
import { BRAND } from '../utils/brandColors';
import { confirmDialog } from './shared/ConfirmDialog';
import { parseReceiptText, OCR_DRAFT_VERSION } from '../utils/ocrReceipt';
import { readDocumentText } from '../utils/ocrCache';
import { ScanOverlay, OcrChecklist, photoHintText, MIN_SCAN_MS, REVEAL_STEP_MS, CACHED_SCAN_MS } from './shared/ScanExperience';
import { convertToSek } from '../utils/currencyConversion';
import { historyForSupplier, historyFromVerifications } from '../utils/receiptHistory';
import { reverseChargePurchaseInfo } from '../utils/reverseCharge';
import { CURRENCIES, parseNumber, sekFrom, impliedRate, rateToInput, amountToInput, foreignForSave } from '../utils/foreignCurrency';

// ── Formatting ──
// Hela kronor utan decimaler, allt annat med ören: 1,50 kr visas som 1,50 kr och
// 199,90 kr som 199,90 kr, aldrig avrundat till 1 eller 200.
const formatSEK = (val) => {
  const n = Number(val) || 0;
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  const digits = whole ? 0 : 2;
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
};
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};
// Månadsrubrik för listgrupperingen nedan ("September 2026") — sv-SE ger
// gemener ("september 2026"), så första bokstaven versaliseras för hand.
const formatMonthLabel = (yearMonth) => {
  const [y, m] = yearMonth.split('-').map(Number);
  const label = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(new Date(y, (m || 1) - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
// Kalendermånaderna för månadsväljaren i verktygsraden ('01'-'12' som
// value, matchar date.slice(5,7)) — väljer man t.ex. Augusti visas alla
// augustikvitton oavsett år, grupperat per år istället för år+månad.
const MONTH_NAMES = [
  { v: '01', label: 'Januari' }, { v: '02', label: 'Februari' }, { v: '03', label: 'Mars' },
  { v: '04', label: 'April' }, { v: '05', label: 'Maj' }, { v: '06', label: 'Juni' },
  { v: '07', label: 'Juli' }, { v: '08', label: 'Augusti' }, { v: '09', label: 'September' },
  { v: '10', label: 'Oktober' }, { v: '11', label: 'November' }, { v: '12', label: 'December' },
];

// SEK-belopp skrivs ofta med komma som decimaltecken i Sverige. type="number"
// avvisar eller kastar bort kommatecken beroende på webbläsare/locale, så
// beloppsfält är textfält med inputMode="decimal" och egen parsning istället.
const AMOUNT_RE = /^\d*[.,]?\d{0,2}$/;
function AmountInput({ value, onChange, style, placeholder, autoFocus, disabled }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      disabled={disabled}
      value={value}
      onChange={e => {
        const v = e.target.value;
        if (v === '' || AMOUNT_RE.test(v)) onChange(v);
      }}
      placeholder={placeholder || '0,00'}
      style={style}
    />
  );
}
function parseAmount(str) {
  if (str === '' || str == null) return NaN;
  return parseFloat(String(str).replace(',', '.'));
}

const MAX_FILE_MB = 10;
const MAX_FILES = 50;
// HEIC/HEIF (iPhone-kamerans standardformat) går att välja och ladda upp,
// men Chrome/Firefox kan inte rendera det i en <img> — det hanteras med en
// onError-fallback till filikonen där bilden faktiskt visas (listan,
// detaljvyn), inte genom att låtsas att alla webbläsare klarar formatet.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

const inputSt = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  background: 'var(--bg-card)', color: 'var(--text-main)'
};
function inputStErr(hasError) { return { ...inputSt, borderColor: hasError ? '#ef4444' : 'var(--border)' }; }
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const errSt = { fontSize: '12px', color: 'var(--status-red-text)', marginTop: '4px' };

// ── Status (Sida 27) — härledd, aldrig ett fält man kan sätta fritt ──
// "Ej hanterad": ingen kontering vald ännu (samma som befintlig Granska-
// status) — det är också det tillstånd ett nyss uppladdat kvitto börjar i
// (Sida 34: det skapas direkt i listan, innan användaren hunnit fylla i
// detaljvyn). "Pågående": kontering finns men den bokförda verifikationen är
// fortfarande ett utkast (status 'draft' — samma fält Verifikationer-sidans
// egna "Spara som utkast" redan använder). "Bokförd": kopplad verifikation
// är bokförd. "Rättad": ett tidigare bokfört kvitto vars bokföring har
// rättats med en motverifikation (handleReverseExpense i App.jsx) —
// originalet ändras eller raderas aldrig (Bokföringslagen), en ny länkad
// verifikation nollar bara ut effekten. Kollas FÖRE de övriga grenarna:
// ett rättat kvitto har fortfarande ett costAccount och en bokförd
// originalverifikation, så utan den här kontrollen skulle det felaktigt
// visas som "Bokförd" igen.
function getReceiptStatus(receipt, verifications) {
  const reversed = verifications.some(v => v.source === 'expense_reversal' && v.sourceId === receipt.id);
  if (reversed) return 'reversed';
  if (!receipt.costAccount) return 'unhandled';
  const ver = verifications.find(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === receipt.id);
  if (ver && (ver.status || 'booked') === 'draft') return 'pending';
  return 'booked';
}

const STATUS_META = {
  unhandled: { label: 'Ej hanterade', bg: BRAND.amberBg, color: BRAND.amberText },
  pending: { label: 'Pågående', bg: BRAND.grayBg, color: BRAND.grayText },
  booked: { label: 'Bokförda', bg: BRAND.greenLight, color: BRAND.greenDark },
  reversed: { label: 'Rättade', bg: BRAND.grayBg, color: BRAND.grayText },
};

/** Bästa tillgängliga visningsnamn för den som laddade upp kvittot. */
function displayUploaderName(uploadedBy) {
  if (!uploadedBy) return null;
  return uploadedBy.name?.trim() || uploadedBy.email || null;
}

// Samma tomt-läge-mönster som Kontakter/Bank (facit): flush mot ytan, ingen
// egen kant/rundning som får den att sväva som ett separat kort. Ikonrutan
// rundad kvadrat på neutral --bg-muted med den mörka varumärkesgröna
// (BRAND.green) som ikonfärg — inte en ljus pastelltoning.
function EmptyReceiptsState({ text, isFilteredEmpty }) {
  return (
    <div style={{ flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', background: 'var(--bg-card)' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
        background: isFilteredEmpty ? 'var(--gray-100)' : 'var(--bg-muted)',
        color: isFilteredEmpty ? 'var(--text-muted)' : BRAND.green,
      }}>
        <Receipt size={30} />
      </div>
      {isFilteredEmpty ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>{text}</p>
      ) : (
        <>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-main)' }}>Inga kvitton uppladdade ännu</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px', margin: '0 0 24px' }}>{text || 'Ladda upp ditt första kvitto för att börja.'}</p>
          {/* Inte .btn-primary (index.css: var(--lime-500), en ljusare
              grön) — samma mörka varumärkesgröna knapp som Kontakters/
              Offerters tomma-läge-knappar. */}
          <button
            type="button"
            onClick={() => document.getElementById('receipt-upload').click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            <UploadCloud size={15} /> Ladda upp kvitto
          </button>
        </>
      )}
    </div>
  );
}

// ── Kvittovyn (Sida 34) — fälten till vänster, dokumentet till höger ──
// Kvittot finns redan i listan (det skapas direkt vid uppladdning med tomma
// fält, se uploadReceipt i Expenses); den här vyn är hur man färdigställer
// och bokför det — eller, om det redan är bokfört, bara läser uppgifterna
// i efterhand.
//
// Omgjord efter kundfeedback. Ursprungligen vilade hela omgörningen på
// att kvittot INTE tolkades automatiskt — det gör det numera (OCR, se
// runOcr/ocrFile nedan: bild eller PDF läses client-side, fälten fylls i
// automatiskt och märks med OcrBadge). OCR-tolkningen är ändå aldrig ett
// tyst facit — allt är fortfarande redigerbart innan bokföring, och två
// saker avgör hur snabbt det går när något behöver rättas eller fyllas i
// för hand (t.ex. ett suddigt kvitto OCR inte kunde läsa):
//
//  1. Man måste kunna LÄSA kvittot medan man skriver. Dokumentet ligger
//     därför i en riktig visare bredvid formuläret, i helskärm
//     (shared/DocumentViewer.jsx, delad med verifikationens underlag).
//     Den gamla vyn visade en filikon och texten "Öppna PDF-kvitto i ny
//     flik" — man fick alltså lämna formuläret för att se beloppet man
//     skulle skriva in.
//  2. Fälten ska svara medan man skriver. Momsuppdelningen (netto/moms/
//     totalt) räknas fram live ur bruttobeloppet och momssatsen, och
//     snabbvalen under kontofältet är de konton man faktiskt använt mest på
//     sina egna kvitton. Ingen gissning presenteras som ett svar från appen
//     — det står "snabbval", för det är vad det är.

// Belopp med ören — momsuppdelningen är det enda stället på sidan där
// decimalerna faktiskt betyder något (25% av 842,50 är inte ett jämnt tal).
const formatSEK2 = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 2 }).format(val || 0);

// Statusetiketterna i STATUS_META är plural (de sitter på filterpillren som
// räknar flera kvitton). Här handlar det om ETT kvitto.
const STATUS_SINGULAR = { unhandled: 'Ej hanterad', pending: 'Pågående', booked: 'Bokförd', reversed: 'Rättad' };

// Liten badge som visas intill fältets label när OCR fyllt i det.
// Försvinner så fort användaren redigerar fältet manuellt.
function OcrBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em',
      padding: '1px 6px', borderRadius: '999px', verticalAlign: 'middle', marginLeft: '5px',
      background: '#e0f2fe', color: '#0369a1',
    }}>
      <ScanLine size={10} /> OCR
    </span>
  );
}

function ReceiptDetailModal({ receipt, accounts, projects, folders = [], allReceipts, verifications = [], status, onSave, onSaveOcrDraft, onDelete, onReverse, onClose }) {
  // "Rättad" är också ett låst tillstånd — samma skäl som "Bokförd": en
  // rättelseverifikation ändrar inte originalet, så fälten som redan
  // bokfördes ska förbli precis vad de var när det begicks, inte gå att
  // smygredigera i efterhand.
  const readOnly = status === 'booked' || status === 'reversed';
  // Ett kvitto som redan lästs av har sitt resultat sparat (ocrDraft), även
  // om man stängde det innan man sparade. Då visas det direkt, utan ny
  // avläsning. "Läs av igen" gör en ny. Bara för kvitton som ännu inte är
  // ifyllda på riktigt: ett sparat kvitto har sina egna värden.
  const isUnprocessedAtOpen = !receipt.supplier && (!receipt.amount || Number(receipt.amount) === 0) && !receipt.costAccount;
  // Ett utkast från en äldre tolkning (utan v, eller med lägre v) används inte: se OCR_DRAFT_VERSION.
  const currentDraft = receipt.ocrDraft && receipt.ocrDraft.v === OCR_DRAFT_VERSION ? receipt.ocrDraft : null;
  const draft = isUnprocessedAtOpen && !readOnly ? currentDraft : null;
  const [form, setForm] = useState({
    date: draft?.form?.date || receipt.date || new Date().toISOString().split('T')[0],
    supplier: receipt.supplier || draft?.form?.supplier || '',
    receiptNumber: receipt.receiptNumber || draft?.form?.receiptNumber || '',
    amount: receipt.amount ? amountToInput(receipt.amount) : (draft?.form?.amount || ''),
    vatRate: receipt.vatRate ?? draft?.form?.vatRate ?? 25,
    // Bara när vatRate är 'mixed': momsen i kronor, summan av kvittots satser.
    vatAmount: receipt.vatRate === 'mixed' ? amountToInput(receipt.vatAmount) : (draft?.form?.vatAmount || ''),
    // Ett utkast från en äldre avläsning kan innehålla ett gissat konto
    // (revealed = 'guess'). Det tas inte med, av samma skäl som i runOcr.
    costAccount: receipt.costAccount || (draft?.revealed?.costAccount === 'guess' ? '' : draft?.form?.costAccount) || '',
    projectId: receipt.projectId || '',
    folderId: receipt.folderId || '',
    notes: receipt.notes || '',
  });
  const [errors, setErrors] = useState({});

  // ── OCR ────────────────────────────────────────────────────────────────────
  // ocrStatus: 'idle' | 'scanning' | 'done' | 'error'
  const [ocrStatus, setOcrStatus] = useState(draft ? 'done' : 'idle');
  const [ocrMessage, setOcrMessage] = useState('');
  // Håller reda på vilka fält som fylldes i av OCR så vi kan visa en badge.
  const [ocrFields, setOcrFields] = useState(new Set(draft?.ocrFields || []));
  // Ett kvitto i en annan valuta än kronor — { code, amount, converted } |
  // null. `converted` är resultatet från convertToSek (utils/
  // currencyConversion.js): { sek, rate, date }, eller null om kursen inte
  // gick att hämta (och då fylls beloppet inte i alls — se nedan).
  // Valutaruta: beloppet i valutan, kursen och var kursen kom ifrån. Sparas på
  // kvittot så att omräkningen går att följa. Se utils/foreignCurrency.js.
  const [fx, setFx] = useState(() => (receipt.foreignCurrency ? {
    code: receipt.foreignCurrency.code,
    amount: amountToInput(receipt.foreignCurrency.amount),
    rate: rateToInput(receipt.foreignCurrency.rate),
    rateDate: receipt.foreignCurrency.rateDate || null,
    source: receipt.foreignCurrency.source || 'manual',
  } : (draft?.fx || null)));
  const [fxBusy, setFxBusy] = useState(false);
  const [fxError, setFxError] = useState('');
  // Vad numret på kvittot var: fakturanummer, kvittonummer, ordernummer m.fl.
  const [numberLabel, setNumberLabel] = useState(receipt.receiptNumberLabel || draft?.numberLabel || '');
  // Kontot avläsningen föreslår men inte fyller i: { code, source } | null.
  const [suggestedAccount, setSuggestedAccount] = useState(draft?.suggestedAccount || null);
  // Gör körningar avbrytbara: hinner användaren byta fil eller köra om
  // läsningen innan en pågående körning (som nu även väntar in en
  // valutakurs över nätet) är klar, ska bara den SENASTE körningens
  // resultat någonsin skrivas in i formuläret.
  const ocrRunIdRef = useRef(0);
  // Uppvisningen efter läsningen: fälten fylls i ett i taget (`revealing`),
  // `revealed` säger per fält om det hittades, gissades eller saknades, och
  // `flashKey` är fältet som just fyllts i (ger en kort ljusning). `ocrVat` är
  // resultatet av momskontrollen mot beloppen på kvittot.
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(draft?.revealed || {});
  const [flashKey, setFlashKey] = useState(null);
  const [ocrVat, setOcrVat] = useState(draft?.ocrVat || null);
  const timersRef = useRef([]);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);
  const onSaveOcrDraftRef = useRef(onSaveOcrDraft);
  onSaveOcrDraftRef.current = onSaveOcrDraft;
  // Dokumentet var inget kvitto eller någon faktura, så inget fylls i.
  const [notReceipt, setNotReceipt] = useState(Boolean(draft?.notReceipt));
  // Skiljer på "det här är inte ett kvitto/en faktura" (ovan) och "det HAR
  // nog ett, men bilden gick inte att läsa" (för suddigt/utzoomat/mörkt) —
  // olika fel, olika råd till användaren. Se isUnreadableText/classifyDocument
  // i ocrReceipt.js.
  const [unreadable, setUnreadable] = useState(Boolean(draft?.unreadable));
  // Rådet om fotot ('blurry' | 'dark' | 'far'), satt bara när bilden faktiskt
  // stod i vägen för avläsningen: inget belopp, ett belopp att kontrollera
  // eller en moms som inte gick ihop. Ett tydligt foto som lästes rätt får
  // aldrig en anmärkning om fotot.
  const [photoHint, setPhotoHint] = useState(draft?.photoHint || null);
  // Företagets egen historik: en leverantör som redan finns på tidigare
  // kvitton ger samma konto och momssats som oftast förut. Det slår de
  // allmänna reglerna, eftersom det är så företaget själv bokför.
  const historyRef = useRef(() => null);
  historyRef.current = (supplier) => historyForSupplier(allReceipts, supplier, receipt.id) || historyFromVerifications(verifications, supplier);
  const busy = ocrStatus === 'scanning' || revealing;
  const flashField = flashKey ? flashKey.split(':')[0] : null;

  const runOcr = useCallback(async (input, { force = false } = {}) => {
    if (!input || readOnly) return;
    const runId = ++ocrRunIdRef.current;
    const isCurrent = () => ocrRunIdRef.current === runId;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const startedAt = Date.now();
    setOcrStatus('scanning');
    setOcrMessage('Startar läsning…');
    setFx(null);
    setFxError('');
    setNumberLabel('');
    setSuggestedAccount(null);
    setNotReceipt(false);
    setUnreadable(false);
    setPhotoHint(null);
    setOcrFields(new Set());
    setRevealing(false);
    setRevealed({});
    setOcrVat(null);
    setFlashKey(null);
    try {
      const { text, confidence, weakTokens, quality, cached } = await readDocumentText(input, msg => { if (isCurrent()) setOcrMessage(msg); }, { force });
      if (!isCurrent()) return;
      const parsed = parseReceiptText(text, { confidence, weakTokens });
      // Rådet om fotot visas bara när avläsningen inte blev bra: blev beloppet
      // avläst och kontrollerat mot momsen spelar det ingen roll att bilden
      // kunde varit skarpare.
      const hint = (quality?.advice && (parsed.notReceipt || !parsed.amount || parsed.amountGuessed || parsed.vatMismatch))
        ? quality.advice : null;

      // Utländsk valuta — räkna om till kronor med DAGSKURSEN FÖR
      // KÖPDATUMET (Skatteverkets rekommendation) innan beloppet fylls i.
      // Går omräkningen inte att göra (okänd valutakod, inget nät) fylls
      // beloppet INTE i som om talet redan vore kronor — se
      // convertToSek.
      let amountSek = parsed.currency ? null : parsed.amount;
      let foreignInfo = null;
      if (parsed.amount && parsed.currency) {
        setOcrMessage(`Räknar om ${parsed.currency} till kronor…`);
        const converted = await convertToSek(parsed.amount, parsed.currency, parsed.date);
        if (!isCurrent()) return;
        if (converted) amountSek = converted.sek;
        foreignInfo = { code: parsed.currency, amount: parsed.amount, converted };
      }

      const remaining = (cached ? CACHED_SCAN_MS : MIN_SCAN_MS) - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise(resolve => { timersRef.current.push(setTimeout(resolve, remaining)); });
        if (!isCurrent()) return;
      }

      // Vad som hittades. `state` säger hur säkert: 'found' = det stod på
      // kvittot, 'guess' = ett förslag att kontrollera (den första textraden
      // som leverantör, en momssats som antagits eftersom kvittot inte sa
      // någon). Ett förslag visas aldrig som en avläsning — kundönskemål,
      // uttryckligt: en gissning som ser säker ut är värre än ingen gissning.
      // Inget kvitto eller ingen faktura (ett CV, ett brev): inget fylls i.
      const nr = Boolean(parsed.notReceipt);
      const hist = nr ? null : historyRef.current(parsed.supplier);
      const reverse = parsed.reverseCharge;
      const vatFromHistory = !reverse && Boolean(hist && parsed.vatRateGuessed && hist.vatRate !== null);
      // Moms i flera satser (mat 12 % och hushåll 25 %): momsbeloppet på
      // kvittot bokförs som det står, i stället för en sats som blir fel.
      const mixedVat = !nr && !reverse && !parsed.currency && Boolean(parsed.vatRates && parsed.vatAmount);
      const plan = [
        { key: 'supplier', found: !nr && Boolean(parsed.supplier), state: parsed.supplierMatched ? 'found' : 'guess', patch: { supplier: parsed.supplier || '' } },
        { key: 'date', found: !nr && Boolean(parsed.date), state: parsed.dateGuessed ? 'guess' : 'found', patch: { date: parsed.date } },
        { key: 'receiptNumber', found: !nr && Boolean(parsed.receiptNumber), state: 'found', patch: { receiptNumber: parsed.receiptNumber || '' } },
        { key: 'amount', found: !nr && Boolean(amountSek), state: parsed.amountGuessed ? 'guess' : 'found', patch: { amount: amountToInput(amountSek) } },
        {
          key: 'vatRate', found: !nr && parsed.vatRate !== null && parsed.vatRate !== undefined,
          state: reverse ? 'found' : (vatFromHistory ? 'history' : (parsed.vatRateGuessed ? 'guess' : 'found')),
          patch: mixedVat
            ? { vatRate: 'mixed', vatAmount: amountToInput(parsed.vatAmount) }
            : { vatRate: vatFromHistory ? hist.vatRate : parsed.vatRate },
        },
        {
          // Tjänst från utlandet: kontot följer av dokumentet (4535 EU, 4531
          // utanför EU), inte av tidigare kvitton som kan vara bokförda utan
          // omvänd moms.
          //
          // Ett konto som avläsningen bara gissat (6990 som reservfall, eller en
          // utländsk tjänst där regionen är oklar) fylls INTE i. Kundfeedback:
          // ett gissat konto såg ut som ett riktigt och bokfördes fel. Fältet
          // lämnas tomt och kontolistan visas i stället, så användaren väljer.
          //
          // Kundfeedback, uttryckligt: inga gissningar, och ett tomt konto är
          // bättre än ett konto avläsningen inte vet. Kontot fylls därför bara i
          // när det är känt: användaren har själv bokfört samma leverantör förut
          // (historik), eller det är en utländsk tjänst där omvänd moms ger
          // kontot. En regel (leverantören eller ett ord på kvittot) är ett
          // FÖRSLAG som visas överst i kontolistan, inte något som skrivs in.
          key: 'costAccount', found: !nr && Boolean(reverse ? parsed.accountCode : hist?.costAccount),
          state: reverse ? 'found' : 'history',
          patch: { costAccount: reverse ? parsed.accountCode : hist?.costAccount },
          suggest: (!nr && !reverse && !hist?.costAccount && parsed.accountCode && !parsed.accountGuessed)
            ? { code: parsed.accountCode, source: parsed.accountSource } : null,
        },
      ];

      // Resultatet sparas på kvittot (som ett utkast, inte som ifyllda fält),
      // så att en ny öppning visar det direkt i stället för att läsa om.
      const draftForm = {};
      const draftRevealed = {};
      const draftFields = [];
      plan.forEach(step => {
        if (step.found) {
          Object.assign(draftForm, step.patch);
          if (step.state === 'found') draftFields.push(step.key);
        }
        draftRevealed[step.key] = step.found ? step.state : (step.suggest ? 'suggest' : 'missing');
      });
      const accountSuggestion = plan.find(step => step.key === 'costAccount')?.suggest || null;
      const draftVat = nr ? null : { verified: parsed.vatVerified, mismatch: parsed.vatMismatch, vatAmount: parsed.vatAmount, amountVerified: parsed.amountVerified, rates: parsed.vatRates, creditNote: parsed.creditNote };
      const draftFx = foreignInfo ? {
        code: foreignInfo.code,
        amount: amountToInput(foreignInfo.amount),
        rate: foreignInfo.converted ? rateToInput(foreignInfo.converted.rate) : '',
        rateDate: foreignInfo.converted?.date || null,
        source: foreignInfo.converted ? 'ecb' : 'manual',
      } : null;
      onSaveOcrDraftRef.current?.(receipt.id, {
        v: OCR_DRAFT_VERSION,
        scannedAt: new Date().toISOString(),
        form: draftForm,
        revealed: draftRevealed,
        suggestedAccount: accountSuggestion,
        ocrFields: draftFields,
        numberLabel: parsed.receiptNumber ? (parsed.receiptNumberLabel || '') : '',
        fx: draftFx,
        notReceipt: nr,
        unreadable: Boolean(parsed.unreadable),
        photoHint: hint,
        ocrVat: draftVat,
      });

      setOcrStatus('done');
      setOcrMessage('');
      setRevealing(true);
      plan.forEach((step, i) => {
        timersRef.current.push(setTimeout(() => {
          if (!isCurrent()) return;
          if (step.found) {
            setForm(prev => ({ ...prev, ...step.patch }));
            if (step.state === 'found') setOcrFields(prev => new Set(prev).add(step.key));
            setFlashKey(`${step.key}:${i}`);
          }
          if (step.suggest) setSuggestedAccount(step.suggest);
          setRevealed(prev => ({ ...prev, [step.key]: step.found ? step.state : (step.suggest ? 'suggest' : 'missing') }));
        }, 250 + i * REVEAL_STEP_MS));
      });
      timersRef.current.push(setTimeout(() => {
        if (!isCurrent()) return;
        if (parsed.receiptNumber) setNumberLabel(parsed.receiptNumberLabel || '');
        if (foreignInfo) {
          setFx({
            code: foreignInfo.code,
            amount: amountToInput(foreignInfo.amount),
            rate: foreignInfo.converted ? rateToInput(foreignInfo.converted.rate) : '',
            rateDate: foreignInfo.converted?.date || null,
            source: foreignInfo.converted ? 'ecb' : 'manual',
          });
          if (!foreignInfo.converted) setFxError('Kursen gick inte att hämta automatiskt. Fyll i kursen eller beloppet i kronor själv, helst det som faktiskt drogs på kortet.');
        }
        setNotReceipt(nr);
        setUnreadable(Boolean(parsed.unreadable));
        setPhotoHint(hint);
        setOcrVat(nr ? null : { verified: parsed.vatVerified, mismatch: parsed.vatMismatch, vatAmount: parsed.vatAmount, amountVerified: parsed.amountVerified, rates: parsed.vatRates, creditNote: parsed.creditNote });
        setFlashKey(null);
        setRevealing(false);
      }, 250 + plan.length * REVEAL_STEP_MS + 150));
    } catch (err) {
      if (!isCurrent()) return;
      console.error('OCR misslyckades:', err);
      setOcrStatus('error');
      setOcrMessage('');
      setRevealing(false);
    }
  }, [readOnly]);

  const hasReceiptFile = Boolean(receipt.receiptUrl);

  // Avläsningen startar INTE av sig själv när kvittot öppnas. Användaren
  // bestämmer: fyll i själv, eller tryck på Läs av. Att öppna ett kvitto och
  // direkt se fält fyllas i av en maskin är inte det man bad om, och en
  // avläsning som körde om varje gång man öppnade kvittot skrev över det man
  // redan rättat. Kundönskemål, uttryckligt: "det ska inte skanna av sig
  // själv, det ska finnas en knapp".
  //
  // Ett redan sparat utkast (ocrDraft) visas däremot direkt — det är resultatet
  // av en avläsning användaren själv startade tidigare, inte en ny.
  const canScan = hasReceiptFile && !readOnly;
  const hasScanned = Boolean(currentDraft) || Object.keys(revealed).length > 0 || ocrStatus !== 'idle';

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const accountLabel = accounts.find(a => a.code === form.costAccount);

  // Momsuppdelning live. Beloppet man skriver in är brutto (ink moms), precis
  // som det står på kvittot — netto och moms är det som faktiskt bokförs, och
  // att visa dem här är skillnaden mellan att skriva en siffra och att se vad
  // den blir. Samma räkning som bokföringen gör efteråt, inte en egen.
  const grossAmount = parseAmount(form.amount);
  const hasAmount = !isNaN(grossAmount) && grossAmount > 0;
  // Tjänst från utlandet (omvänd skattskyldighet): ingen svensk moms på kvittot,
  // hela beloppet är kostnaden. Se utils/reverseCharge.js.
  const reverseInfo = reverseChargePurchaseInfo(form.costAccount);
  // Flera momssatser på samma kvitto: momsen skrivs in i kronor. All ingående
  // moms bokförs på samma konto (2641), så det är beloppet som behövs, inte satsen.
  const mixedVat = !reverseInfo && form.vatRate === 'mixed';
  const vatRate = reverseInfo || mixedVat ? 0 : (Number(form.vatRate) || 0);
  const mixedVatAmount = parseAmount(form.vatAmount);
  const vatAmount = !hasAmount ? 0
    : mixedVat ? (mixedVatAmount > 0 ? mixedVatAmount : 0)
    : grossAmount - grossAmount / (1 + vatRate / 100);
  const netAmount = hasAmount ? grossAmount - vatAmount : 0;

  // Snabbval för konto = de konton som redan använts mest på företagets egna
  // kvitton, inte en generell topplista. Ett företag bokför i praktiken
  // samma handfull konton om och om igen.
  const frequentAccounts = useMemo(() => {
    const counts = new Map();
    (allReceipts || []).forEach(r => {
      if (r.costAccount && r.id !== receipt.id) counts.set(r.costAccount, (counts.get(r.costAccount) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 4)
      .map(([code]) => ({ code, name: accounts.find(acc => acc.code === code)?.name || '' }));
  }, [allReceipts, accounts, receipt.id]);

  // Leverantörer man redan skrivit in en gång — ett vanligt kvittoflöde är
  // samma fem ställen om igen (macken, matbutiken, en webbshop).
  const supplierSuggestions = useMemo(() => (
    [...new Set((allReceipts || []).map(r => (r.supplier || '').trim()).filter(Boolean))].slice(0, 50)
  ), [allReceipts]);

  // Valutarutan: beloppet i valutan, kursen och beloppet i kronor hänger ihop.
  // Ändrar man beloppet eller kursen räknas kronorna om, och skriver man in
  // ett annat belopp i kronor (det banken faktiskt drog) räknas kursen om.
  const setSek = (sek) => setForm(f => ({ ...f, amount: amountToInput(sek) }));
  const onSekEdited = (v) => {
    if (!fx) return;
    const r = impliedRate(v, fx.amount);
    if (r > 0) setFx(prev => ({ ...prev, rate: rateToInput(r), source: 'manual' }));
  };
  const onFxAmount = (v) => {
    setFx(prev => ({ ...prev, amount: v }));
    const sek = sekFrom(v, fx.rate);
    if (sek > 0) setSek(sek);
    setOcrVat(null);
  };
  const onFxRate = (v) => {
    setFx(prev => ({ ...prev, rate: v, source: 'manual' }));
    const sek = sekFrom(fx.amount, v);
    if (sek > 0) setSek(sek);
    setOcrVat(null);
  };
  const addFx = () => { setFx({ code: 'USD', amount: '', rate: '', rateDate: null, source: 'manual' }); setFxError(''); };
  const removeFx = () => { setFx(null); setFxError(''); };
  const refetchRate = async () => {
    const amount = parseNumber(fx.amount);
    if (!(amount > 0)) { setFxError('Fyll i beloppet i valutan först.'); return; }
    setFxBusy(true);
    setFxError('');
    const converted = await convertToSek(amount, fx.code, form.date);
    setFxBusy(false);
    if (!converted) { setFxError('Kursen gick inte att hämta. Fyll i den för hand.'); return; }
    setFx(prev => ({ ...prev, rate: rateToInput(converted.rate), rateDate: converted.date, source: 'ecb' }));
    setSek(converted.sek);
    setOcrVat(null);
  };

  const handleSave = async () => {
    const newErrors = {};
    const amount = parseAmount(form.amount);
    if (!form.date) newErrors.date = 'Datum krävs.';
    if (!form.supplier.trim()) newErrors.supplier = 'Inköpsställe krävs.';
    if (isNaN(amount) || amount <= 0) newErrors.amount = 'Ange ett giltigt belopp.';
    if (!form.costAccount) newErrors.costAccount = 'Välj ett konto.';
    // Moms över 25 % av nettot (20 % av totalen) finns inte i Sverige.
    if (mixedVat && !(mixedVatAmount > 0 && mixedVatAmount <= amount * 0.2 + 0.005)) {
      newErrors.vatAmount = 'Skriv in momsen från kvittot. Den kan inte vara mer än en femtedel av beloppet.';
    }
    if (fx && !foreignForSave(fx)) newErrors.fx = 'Fyll i belopp och kurs, eller ta bort valutan.';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    // Samma dublettvarning som tidigare fanns i "Spara och bokför"-flödet —
    // jämför mot alla kvitton UTOM sig själv, annars flaggar ett kvitto sig
    // själv som en dublett så fort man öppnar och sparar det en andra gång.
    // Samma leverantör och samma kvitto- eller fakturanummer är också en
    // dublett, även om datum eller belopp lästs olika av OCR.
    const number = form.receiptNumber.trim().toLowerCase();
    const sameSupplier = (r) => (r.supplier || '').trim().toLowerCase() === form.supplier.trim().toLowerCase();
    const dup = allReceipts.find(r => r.id !== receipt.id && sameSupplier(r) && (
      (r.date === form.date && Math.abs((r.amount || 0) - amount) < 0.01)
      || (number && (r.receiptNumber || '').trim().toLowerCase() === number)
    ));
    if (dup) {
      const ok = await confirmDialog(`Det finns redan ett kvitto från "${dup.supplier}" på ${formatSEK(dup.amount)} samma datum. Vill du spara ändå?`);
      if (!ok) return;
    }

    onSave(receipt.id, {
      date: form.date, supplier: form.supplier.trim(), receiptNumber: form.receiptNumber.trim() || undefined, receiptNumberLabel: form.receiptNumber.trim() ? (numberLabel || undefined) : undefined,
      foreignCurrency: foreignForSave(fx), amount,
      vatRate: mixedVat ? 'mixed' : Number(form.vatRate) || 0,
      vatAmount: mixedVat ? Math.round(mixedVatAmount * 100) / 100 : undefined,
      costAccount: form.costAccount, projectId: form.projectId || undefined, folderId: form.folderId || undefined,
      notes: form.notes.trim() || undefined,
    });
    onClose();
  };

  const statusMeta = STATUS_META[status];

  return (
    // Helskärm, inte ett kort på en mörk bakgrund: kvittot ÄR sidan medan
    // man håller på med det. Overlayen är därför opak (det finns inget
    // bakom att skymta) och stängs inte längre av ett bakgrundsklick —
    // det finns ingen bakgrund att klicka på. Esc och Stäng gäller.
    <div className="receipt-modal-overlay" role="dialog" aria-modal="true" aria-label="Kvittodetaljer" style={{ position: 'fixed', inset: 0, zIndex: 1150, display: 'flex' }}>
      <div className="receipt-modal-box">

        {/* ── Vänster: kvittot ──
            Dokumentet ligger till vänster och uppgifterna till höger, som i
            de bokföringsprogram där kvittot är själva arbetsytan. Medan
            kvittot läses ligger skannerlinjen ovanpå (ScanOverlay). */}
        <div className="rc-doc">
          <DocumentPane
            url={receipt.receiptUrl}
            type={receipt.receiptType}
            expandable
            emptyText="Ingen fil är sparad för det här kvittot. Uppgifterna bredvid går att fylla i ändå."
          />
          {ocrStatus === 'scanning' && <ScanOverlay detail={ocrMessage} />}
        </div>

        {/* ── Höger: uppgifterna ── */}
        <div className="rc-form">
          <div className="rc-form-head">
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Kvittodetaljer</h2>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {readOnly ? 'Bokfört underlag' : ocrStatus === 'scanning' ? 'Läser kvittot, det tar några sekunder…' : revealing ? 'Fyller i uppgifterna…' : unreadable ? 'Bilden gick inte att läsa av' : notReceipt ? 'Det här verkar inte vara ett kvitto eller en faktura' : ocrStatus === 'done' ? 'Avläsningen är klar. Granska och justera.' : 'Fyll i uppgifterna från kvittot'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Läs av igen. Den första avläsningen startas från kortet i
                  formuläret nedan, så knapparna inte säger samma sak två gånger. */}
              {canScan && hasScanned && (
                <button
                  type="button"
                  title={ocrStatus === 'scanning' ? (ocrMessage || 'Läser…') : 'Läs av kvittot automatiskt med OCR'}
                  disabled={busy}
                  onClick={() => runOcr(receipt.receiptUrl, { force: true })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                    background: ocrStatus === 'scanning' ? 'var(--bg-muted)' : 'var(--bg-card)',
                    color: ocrStatus === 'scanning' ? 'var(--text-muted)' : 'var(--text-main)',
                    fontSize: '12px', fontWeight: 600, cursor: ocrStatus === 'scanning' ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <ScanLine size={14} style={{ animation: ocrStatus === 'scanning' ? 'spin 1s linear infinite' : 'none' }} />
                  {ocrStatus === 'scanning' ? 'Läser…' : (currentDraft || Object.keys(revealed).length > 0 ? 'Läs av igen' : 'Läs av')}
                </button>
              )}
              {statusMeta && (
                <span style={{ padding: '4px 10px', borderRadius: '999px', background: statusMeta.bg, color: statusMeta.color, fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {STATUS_SINGULAR[status] || statusMeta.label}
                </span>
              )}
              <button onClick={onClose} aria-label="Stäng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><X size={18} /></button>
            </div>
          </div>

          <div className={`rc-form-body${ocrStatus === 'scanning' ? ' rc-scanning' : ''}`}>
            {/* Erbjudandet om avläsning, en gång, innan den körts. Kvittot läses
                inte av förrän man trycker här: den som hellre skriver in tre
                fält själv ska slippa vänta på en maskin. */}
            {canScan && !hasScanned && (
              <div className="rc-scan-offer">
                <div className="rc-scan-offer-text">
                  <strong>Läs av kvittot åt mig</strong>
                  <span>Belopp, moms, datum och leverantör fylls i automatiskt. Du granskar innan det bokförs.</span>
                </div>
                <button type="button" className="rc-scan-offer-btn" onClick={() => runOcr(receipt.receiptUrl, { force: true })}>
                  <ScanLine size={15} />
                  Läs av kvittot
                </button>
              </div>
            )}
            {!readOnly && (ocrStatus === 'scanning' || revealing || Object.keys(revealed).length > 0) && (
              <OcrChecklist scanning={ocrStatus === 'scanning'} revealed={revealed} />
            )}

            {!readOnly && !revealing && reverseInfo && (
              <div className="rc-verify rc-verify-warn">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>Tjänst från {reverseInfo.region === 'eu' ? 'ett annat EU-land' : 'ett land utanför EU'}: säljaren tar ingen svensk moms, så hela beloppet är kostnaden. Momsen ska redovisas av dig (omvänd skattskyldighet) och bokförs automatiskt på 2645 och 2614. Den syns i ruta {reverseInfo.region === 'eu' ? '21' : '22'}, 30 och 48 i momsdeklarationen.</span>
              </div>
            )}
            {!readOnly && !revealing && notReceipt && (
              <div className="rc-verify rc-verify-warn">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {unreadable ? (
                  <span>Bilden gick inte att läsa av, så inget har fyllts i. {photoHintText(photoHint) || 'Ta om fotot — närmre, rakare och med bättre ljus — eller läs av igen när du har en tydligare bild.'}</span>
                ) : (
                  <span>Det här ser inte ut som ett kvitto eller en faktura, så inget har fyllts i. Fyll i uppgifterna själv, eller ta bort filen om den hamnade här av misstag.</span>
                )}
              </div>
            )}
            {/* Bilden var det som satte gränsen: säg vad som är fel med den och
                vad som ger en bättre avläsning nästa gång. Visas bara när något
                fält faktiskt blev osäkert, aldrig på en avläsning som gick bra. */}
            {!readOnly && !revealing && !notReceipt && photoHint && (
              <div className="rc-verify rc-verify-warn">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{photoHintText(photoHint)} Läs av igen med den nya bilden — eller fyll i fälten själv från kvittot.</span>
              </div>
            )}
            {!readOnly && !revealing && ocrVat && ocrVat.amountVerified && !ocrVat.verified && (
              <div className="rc-verify rc-verify-ok">
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                <span>Beloppet stämmer: netto plus moms på fakturan blir totalbeloppet.</span>
              </div>
            )}

            {/* Momskontrollen mot beloppen på kvittot. Verifierad bara när
                momsbeloppet på kvittot faktiskt stämmer mot vald sats. */}
            {/* Ett returkvitto ser ut som ett vanligt kvitto men går åt andra
                hållet. Bokförs det som en kostnad blir både kostnaden och
                momsen fel, så det sägs rakt ut. */}
            {!readOnly && !revealing && ocrVat && ocrVat.creditNote && (
              <div className="rc-verify rc-verify-warn">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>Det här ser ut som en retur eller en kreditnota — pengar tillbaka, inte en kostnad. Bokför den som en rättelse av det ursprungliga köpet (en verifikation med beloppen åt andra hållet), inte som ett vanligt kvitto.</span>
              </div>
            )}
            {/* Kvittot har moms i flera satser (mat 12 % och hushåll 25 % i
                samma matbutik). Momsen är avläst och går ihop — den går bara
                inte att uttrycka som EN sats, och då ska det stå, inte döljas
                bakom en procentsats som blir fel. */}
            {!readOnly && !revealing && ocrVat && ocrVat.rates && (
              <div className="rc-verify rc-verify-warn">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>Kvittot har moms i flera satser ({ocrVat.rates.map(r => `${r} %`).join(' och ')}), tillsammans {formatSEK2(ocrVat.vatAmount)}. Momsen bokförs med det beloppet, så det blir rätt utan att du delar upp kvittot. Kontrollera att det stämmer med kvittot.</span>
              </div>
            )}
            {!readOnly && !revealing && ocrVat && ocrVat.verified && (
              <div className="rc-verify rc-verify-ok">
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                <span>Momsen stämmer mot beloppen på kvittot ({formatSEK2(ocrVat.vatAmount)} moms, {Number(form.vatRate)} %).</span>
              </div>
            )}
            {!readOnly && !revealing && ocrVat && ocrVat.mismatch && (
              <div className="rc-verify rc-verify-warn">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>Kvittot säger {formatSEK2(ocrVat.vatAmount)} i moms, men det går inte ihop med beloppet {hasAmount ? formatSEK2(grossAmount) : '(tomt)'} och någon svensk momssats. Ett av de två är felläst — kontrollera båda mot kvittot. Rätta du beloppet följer momsen med.</span>
              </div>
            )}

            {status === 'reversed' ? (
              <div style={{ background: BRAND.grayBg, color: BRAND.grayText, borderRadius: '10px', padding: '10px 13px', fontSize: '12.5px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '7px', lineHeight: 1.5 }}>
                <RotateCcw size={14} style={{ flexShrink: 0, marginTop: 2 }} /> Den här bokföringen har rättats med en motverifikation — originalet ändras aldrig i efterhand
              </div>
            ) : readOnly && (
              <div style={{ background: BRAND.greenLight, color: BRAND.greenDark, borderRadius: '10px', padding: '10px 13px', fontSize: '12.5px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '7px', lineHeight: 1.5 }}>
                <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 2 }} /> Redan bokfört — belopp och konto kan inte ändras här
              </div>
            )}

            {/* OCR-felmeddelande */}
            {ocrStatus === 'error' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600 }}>
                <AlertCircle size={14} />
                Kunde inte läsa av kvittot automatiskt — fyll i uppgifterna manuellt.
              </div>
            )}


            <div className="rc-grid">
              <div className={flashField === 'date' ? 'rc-flash' : undefined}>
                <label style={labelSt}>Datum {ocrFields.has('date') && <OcrBadge />}</label>
                <input type="date" disabled={readOnly} value={form.date} onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setOcrFields(s => { const n = new Set(s); n.delete('date'); return n; }); }} style={inputStErr(errors.date)} />
                {errors.date && <div style={errSt}>{errors.date}</div>}
              </div>
              <div className={flashField === 'amount' ? 'rc-flash' : undefined}>
                <label style={labelSt}>Belopp ink moms (kr) {ocrFields.has('amount') && <OcrBadge />}</label>
                <AmountInput disabled={readOnly} value={form.amount} onChange={v => { setForm(f => ({ ...f, amount: v })); setOcrFields(s => { const n = new Set(s); n.delete('amount'); return n; }); setOcrVat(null); onSekEdited(v); }} style={inputStErr(errors.amount)} />
                {errors.amount && <div style={errSt}>{errors.amount}</div>}
              </div>

              {fx ? (
                <div className="rc-span rc-fx">
                  <div className="rc-fx-head">
                    <span className="rc-fx-title">Kvittot är i utländsk valuta</span>
                    {!readOnly && <button type="button" className="rc-link" onClick={removeFx}>Ta bort</button>}
                  </div>
                  <div className="rc-fx-grid">
                    <div>
                      <label style={labelSt}>Valuta</label>
                      <select disabled={readOnly} value={fx.code} onChange={e => setFx(prev => ({ ...prev, code: e.target.value }))} style={{ ...inputSt, background: 'var(--bg-card)' }}>
                        {(CURRENCIES.includes(fx.code) ? CURRENCIES : [fx.code, ...CURRENCIES]).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelSt}>Belopp i {fx.code}</label>
                      <AmountInput disabled={readOnly} value={fx.amount} onChange={onFxAmount} style={inputSt} />
                    </div>
                    <div>
                      <label style={labelSt}>Kurs (kr per {fx.code})</label>
                      <input
                        disabled={readOnly} type="text" inputMode="decimal" value={fx.rate} placeholder="0,0000" style={inputSt}
                        onChange={e => { const v = e.target.value; if (v === '' || /^\d*[.,]?\d{0,6}$/.test(v)) onFxRate(v); }}
                      />
                    </div>
                  </div>
                  <div className="rc-fx-note">
                    {fx.source === 'ecb' && fx.rateDate
                      ? `Dagskurs från Europeiska centralbanken för ${fx.rateDate}${form.date && fx.rateDate < form.date ? ' (närmast föregående bankdag före köpet)' : ''}.`
                      : 'Kursen är angiven för hand.'}
                    {' '}Beloppet i kronor ovan är {fx.amount || '…'} {fx.code} × {fx.rate || '…'}. Ändra kursen eller beloppet i kronor om banken drog ett annat belopp.
                  </div>
                  {!readOnly && (
                    <button type="button" className="rc-chip" onClick={refetchRate} disabled={fxBusy} style={{ alignSelf: 'flex-start' }}>
                      {fxBusy ? 'Hämtar kursen…' : `Hämta dagskurs för ${form.date || 'köpdatumet'}`}
                    </button>
                  )}
                  {(fxError || errors.fx) && <div style={errSt}>{fxError || errors.fx}</div>}
                </div>
              ) : !readOnly && (
                <div className="rc-span">
                  <button type="button" className="rc-link" onClick={addFx}>Kvittot är i annan valuta än kronor</button>
                </div>
              )}
              <div className={`rc-span${flashField === 'supplier' ? ' rc-flash' : ''}`}>
                <label style={labelSt}>Inköpsställe / Leverantör {ocrFields.has('supplier') && <OcrBadge />}</label>
                <TextSuggestInput
                  disabled={readOnly}
                  value={form.supplier}
                  onChange={v => { setForm(f => ({ ...f, supplier: v })); setOcrFields(s => { const n = new Set(s); n.delete('supplier'); return n; }); }}
                  suggestions={supplierSuggestions}
                  placeholder="T.ex. Circle K, Clas Ohlson…"
                  style={inputStErr(errors.supplier)}
                  emptyHint="Ställen du skriver in här dyker upp som förslag nästa gång."
                />
                {errors.supplier && <div style={errSt}>{errors.supplier}</div>}
              </div>
              <div className={`rc-span${flashField === 'receiptNumber' ? ' rc-flash' : ''}`}>
                <label style={labelSt}>Kvitto-, faktura- eller ordernummer (valfritt) {ocrFields.has('receiptNumber') && <OcrBadge />}</label>
                <input
                  disabled={readOnly}
                  value={form.receiptNumber}
                  onChange={e => { setForm(f => ({ ...f, receiptNumber: e.target.value })); setNumberLabel(''); setOcrFields(s => { const n = new Set(s); n.delete('receiptNumber'); return n; }); }}
                  placeholder="T.ex. 20240123"
                  maxLength={40}
                  style={inputSt}
                />
                {numberLabel && form.receiptNumber && <div className="rc-hint">Avläst som {numberLabel.toLowerCase()}</div>}
              </div>
              <div className={`rc-span${flashField === 'vatRate' ? ' rc-flash' : ''}`}>
                <label style={labelSt}>Momssats {ocrFields.has('vatRate') && <OcrBadge />}</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[25, 12, 6, 0, 'mixed'].map(v => {
                    const on = v === 'mixed' ? form.vatRate === 'mixed' : form.vatRate !== 'mixed' && Number(form.vatRate) === v;
                    return (
                      <button
                        key={v} type="button" disabled={readOnly}
                        onClick={() => {
                          // "Flera" tar momsen från kvittot om den är avläst.
                          setForm(f => ({ ...f, vatRate: v, ...(v === 'mixed' && !f.vatAmount && ocrVat?.vatAmount ? { vatAmount: amountToInput(ocrVat.vatAmount) } : {}) }));
                          setOcrFields(s => { const n = new Set(s); n.delete('vatRate'); return n; });
                          if (v !== 'mixed') setOcrVat(null);
                        }}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                          fontFamily: 'inherit', cursor: readOnly ? 'default' : 'pointer',
                          border: `1.5px solid ${on ? BRAND.green : 'var(--border)'}`,
                          background: on ? BRAND.greenLight : 'var(--bg-card)',
                          color: on ? BRAND.greenDark : 'var(--text-secondary)',
                          opacity: readOnly && !on ? 0.5 : 1,
                        }}
                      >
                        {v === 'mixed' ? 'Flera' : `${v}%`}
                      </button>
                    );
                  })}
                </div>
                {mixedVat && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={labelSt}>Moms i kronor</label>
                    <AmountInput
                      disabled={readOnly} value={form.vatAmount}
                      onChange={v => { setForm(f => ({ ...f, vatAmount: v })); setErrors(e => ({ ...e, vatAmount: undefined })); }}
                      style={inputStErr(errors.vatAmount)}
                    />
                    {errors.vatAmount
                      ? <div style={errSt}>{errors.vatAmount}</div>
                      : <div className="rc-hint">Summan av all moms på kvittot, till exempel 12 % på maten och 25 % på resten.</div>}
                  </div>
                )}
              </div>

              {/* Vad som faktiskt bokförs, medan man skriver. */}
              <div className="rc-span rc-split" aria-live="polite">
                <div>
                  <div className="rc-split-k">Netto</div>
                  <div className="rc-split-v">{hasAmount ? formatSEK2(netAmount) : '—'}</div>
                </div>
                <div>
                  <div className="rc-split-k">{mixedVat ? 'Moms' : `Moms ${vatRate}%`}</div>
                  <div className="rc-split-v">{hasAmount ? formatSEK2(vatAmount) : '—'}</div>
                </div>
                <div>
                  <div className="rc-split-k">Totalt</div>
                  <div className="rc-split-v">{hasAmount ? formatSEK2(grossAmount) : '—'}</div>
                </div>
              </div>

              <div className={`rc-span${flashField === 'costAccount' ? ' rc-flash' : ''}`}>
                <label style={labelSt}>Konto {ocrFields.has('costAccount') && <OcrBadge />}</label>
                {readOnly ? (
                  <div style={{ ...inputSt, background: 'var(--bg-muted)', color: 'var(--text-main)' }}>
                    {accountLabel ? `${accountLabel.code} – ${accountLabel.name}` : form.costAccount || '—'}
                  </div>
                ) : (
                  <>
                    <AccountInlinePicker
                      value={form.costAccount}
                      onChange={code => { setForm(f => ({ ...f, costAccount: code })); setOcrFields(s => { const n = new Set(s); n.delete('costAccount'); return n; }); }}
                      accounts={accounts}
                      quick={frequentAccounts}
                      suggestion={suggestedAccount && accounts.some(a => a.code === suggestedAccount.code) ? suggestedAccount : null}
                      invalid={Boolean(errors.costAccount)}
                    />
                    {errors.costAccount && <div style={errSt}>{errors.costAccount}</div>}
                  </>
                )}
              </div>

              {projects.length > 0 && (
                <div className="rc-span">
                  <label style={labelSt}>Projekt (valfritt)</label>
                  <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={{ ...inputSt, background: 'var(--bg-card)' }}>
                    <option value="">Inget projekt</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Mapp — kundens egna namngivna sätt att dela upp kvittona
                  (skapas/hanteras via mappknappen i verktygsraden, se
                  Expenses-listan nedanför). Fältet visas bara när det
                  faktiskt finns någon mapp att lägga kvittot i. */}
              {folders.length > 0 && (
                <div className="rc-span">
                  <label style={labelSt}>Mapp (valfritt)</label>
                  <select value={form.folderId} onChange={e => setForm(f => ({ ...f, folderId: e.target.value }))} style={{ ...inputSt, background: 'var(--bg-card)' }}>
                    <option value="">Ingen mapp</option>
                    {folders.map(fol => <option key={fol.id} value={fol.id}>{fol.name}</option>)}
                  </select>
                </div>
              )}

              <div className="rc-span">
                <label style={labelSt}>Anteckningar (valfritt)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Vad var det här köpet till?" style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>
          </div>

          <div className="rc-form-foot">
            {status === 'booked' ? (
              // Bokförd — kan inte raderas (Bokföringslagen), men rättas med
              // en ny länkad motverifikation (handleReverseExpense i App.jsx),
              // samma princip som fakturors "Skapa en kreditfaktura".
              <button
                type="button"
                onClick={async () => { if (await confirmDialog('Skapa en rättelseverifikation som nollar ut kontering och belopp för det här kvittot? Originalbokföringen finns kvar i historiken, bara raderas eller ändras aldrig.')) { onReverse(receipt.id); onClose(); } }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: BRAND.amberText, fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '8px 4px' }}
              >
                <RotateCcw size={14} /> Rätta bokföring
              </button>
            ) : status !== 'reversed' ? (
              <button
                type="button"
                onClick={async () => { if (await confirmDialog('Ta bort det här kvittot? Det går inte att ångra.', { danger: true })) { onDelete(receipt.id); onClose(); } }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: BRAND.redText, fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '8px 4px' }}
              >
                <Trash2 size={14} /> Ta bort
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} style={{ padding: '9px 16px', background: 'var(--border-light)', border: 'none', borderRadius: '9px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>Stäng</button>
              {status !== 'reversed' && (
                <button type="button" onClick={handleSave} disabled={busy} title={busy ? 'Vänta tills kvittot är avläst' : undefined} style={{ padding: '9px 18px', background: BRAND.green, border: 'none', borderRadius: '9px', fontWeight: 600, color: 'white', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.55 : 1, fontSize: '13px', fontFamily: 'inherit', boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 28%, transparent)' }}>
                  {readOnly ? 'Spara ändringar' : 'Spara och bokför'}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function Expenses({
  expenses = [], accounts = [], verifications = [], projects = [], user,
  company, onUpdateCompany, onDeleteReceiptFolder,
  onAdd, onFixExpenseAccount, onSaveReceiptDetails, onSaveOcrDraft, onDeleteExpense, onReverseExpense,
  pageTitle, pageSubtitle,
  // Utbytbar uppladdningsfunktion — defaultar till den riktiga Storage-
  // uppladdningen för den inloggade appen (oförändrat beteende). Landnings-
  // sidans interaktiva demo (DemoWorkspace.jsx) skickar in en lokal
  // ersättning (t.ex. URL.createObjectURL) istället, så ett kvitto går att
  // dra in och se fungera utan att någon fil faktiskt når Supabase Storage
  // från en icke-inloggad besökare.
  uploadFn = uploadFileToStorage,
}) {
  // -- Receipts State --
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [detailReceiptId, setDetailReceiptId] = useState(null);
  // URL:en till ett kvitto som just laddats upp och ska öppnas så fort det
  // finns i listan. Se effekten längre ner.
  const [autoOpenUrl, setAutoOpenUrl] = useState(null);
  const intervalsRef = useRef({});

  // -- Flikar, sök + statusfilter (Sida 27) --
  const [viewTab, setViewTab] = useState('all'); // 'all' | 'mine'
  const [statusFilter, setStatusFilter] = useState(null); // null | 'unhandled' | 'pending' | 'booked'
  const [query, setQuery] = useState('');
  // Månadsfilter: 'all' (kronologisk gruppering, September 2026/Augusti
  // 2026/…) eller '01'-'12' — då visas BARA den kalendermånaden, men från
  // ALLA år på en gång (kundönskemål: "show all in August ... from all
  // years"), grupperat per år istället för per år+månad (se groupReceipts
  // nedan).
  const [monthFilter, setMonthFilter] = useState('all');
  // Mappar — kundens EGNA, namngivna sätt att dela upp kvittona (kundönskemål,
  // ordagrant i sak: "de ska kunna välja hur de vill dela in dem, och
  // namnge varje mapp"). Ersätter den tidigare, påtvingade indelningen efter
  // kontokategori (bankimportens/OCR:ns hinkar, utils/accountCategories.js)
  // — den var aldrig menad som en filtreringsvy, bara en gissning om konto,
  // och gick inte att döpa om eller styra själv. Mapparna sparas på
  // företaget (company.receiptFolders), kvittots egen mappkoppling i
  // r.folderId — se App.jsx: handleSaveReceiptDetails/handleDeleteReceiptFolder.
  const folders = company?.receiptFolders || [];
  const [folderFilter, setFolderFilter] = useState(null); // null | mapp-id | '__unfiled__'
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const folderManagerAnchorRef = useRef(null);
  const folderManagerPanelRef = useRef(null);
  useDismissOnOutsideClick(folderManagerOpen, () => setFolderManagerOpen(false), folderManagerAnchorRef, folderManagerPanelRef);

  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    onUpdateCompany?.(c => ({ ...c, receiptFolders: [...(c?.receiptFolders || []), { id, name }] }));
    setNewFolderName('');
  };
  const renameFolder = (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdateCompany?.(c => ({ ...c, receiptFolders: (c?.receiptFolders || []).map(f => f.id === id ? { ...f, name: trimmed } : f) }));
  };
  const removeFolder = async (folder) => {
    const inUse = expenses.some(e => e.folderId === folder.id);
    if (inUse && !(await confirmDialog(`Kvitton i "${folder.name}" läggs tillbaka som osorterade. Ta bort mappen?`, { danger: true }))) return;
    onDeleteReceiptFolder?.(folder.id);
  };
  // Kundönskemål: "en vy där de bara ligger under varandra, inte uppdelat
  // per månad" — grupperingen är fin för en lång historik, men ibland vill
  // man bara se allt i en enda lista. Oberoende av monthFilter (man kan
  // fortfarande vilja se "bara augusti" OCH ha det platt).
  const [flatView, setFlatView] = useState(false);

  useEffect(() => () => {
    // Städa upp alla pågående upload-timers om komponenten avmonteras
    Object.values(intervalsRef.current).forEach(clearInterval);
  }, []); // eslint-disable-line

  // Ett nyss uppladdat kvitto öppnas direkt i detaljvyn. Uppladdningen
  // lämnade förut efter sig en rad utan leverantör, belopp eller konto —
  // "kvitto utan namn" i listan — och det var upp till användaren att förstå
  // att raden måste klickas på. Filen ÄR ju det man håller på med, så vyn
  // där uppgifterna fylls i ska komma av sig själv.
  //
  // Vi kan inte öppna på ett id direkt efter onAdd: id:t sätts av föräldern
  // och posten finns inte i `expenses` förrän nästa render. Vi väntar därför
  // på att kvittot med den uppladdade URL:en faktiskt dyker upp.
  useEffect(() => {
    if (!autoOpenUrl) return;
    const added = expenses.find(e => e.type === 'receipt' && e.receiptUrl === autoOpenUrl);
    if (!added) return;
    setDetailReceiptId(added.id);
    setAutoOpenUrl(null);
  }, [expenses, autoOpenUrl]);

  const allReceipts = [...expenses.filter(e => e.type === 'receipt')].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // "Alla kvitton"/"Mina kvitton" visas BARA när det finns kvitton från fler
  // än en person. Kundens invändning, ordagrant i sak: "jag ser ingen
  // skillnad, det ligger ju samma sak under båda" — och så är det: i ett
  // enmansföretag är flikarna två namn på exakt samma lista, alltså två
  // klick som aldrig kan leda någonstans. De hör hemma i ett delat konto
  // (flera anställda som laddar upp kvitton), inte hos alla.
  const uploaderIds = new Set(allReceipts.map(r => r.uploadedBy?.id).filter(Boolean));
  const showUploaderTabs = uploaderIds.size > 1;
  const effectiveTab = showUploaderTabs ? viewTab : 'all';

  // Flikval, sökning och statusfilter kombineras, nollställer aldrig
  // varandra — "Mina kvitton" + "Ej hanterade" ska t.ex. gå att visa
  // samtidigt.
  const tabFiltered = effectiveTab === 'mine' ? allReceipts.filter(r => r.uploadedBy?.id === user?.id) : allReceipts;

  // Sökningen går på det man faktiskt minns av ett kvitto: var man handlade,
  // vad det gällde, vilket konto det hamnade på eller ungefär vad det kostade.
  const q = query.trim().toLowerCase();
  const searched = q
    ? tabFiltered.filter(r => {
      const accName = accounts.find(a => a.code === r.costAccount)?.name;
      return [r.supplier, r.description, r.notes, r.costAccount, accName, r.date, r.amount]
        .filter(v => v !== undefined && v !== null && v !== '')
        .some(v => String(v).toLowerCase().includes(q));
    })
    : tabFiltered;

  // Månadsfiltrering slår igenom FÖRE statusräkningen, så pillren
  // ("Ej hanterade 3" osv) alltid räknar rätt mot det som faktiskt syns.
  const monthMatched = monthFilter === 'all' ? searched : searched.filter(r => (r.date || '').slice(5, 7) === monthFilter);

  const statusCounts = {
    unhandled: monthMatched.filter(r => getReceiptStatus(r, verifications) === 'unhandled').length,
    pending: monthMatched.filter(r => getReceiptStatus(r, verifications) === 'pending').length,
    booked: monthMatched.filter(r => getReceiptStatus(r, verifications) === 'booked').length,
    reversed: monthMatched.filter(r => getReceiptStatus(r, verifications) === 'reversed').length,
  };
  const statusMatched = statusFilter ? monthMatched.filter(r => getReceiptStatus(r, verifications) === statusFilter) : monthMatched;

  // Mapp-id för ett kvitto, '__unfiled__' om det inte lagts i någon mapp än.
  const folderIdOf = (r) => r.folderId || '__unfiled__';
  const folderCounts = new Map();
  statusMatched.forEach(r => {
    const id = folderIdOf(r);
    folderCounts.set(id, (folderCounts.get(id) || 0) + 1);
  });
  const receiptsList = folderFilter ? statusMatched.filter(r => folderIdOf(r) === folderFilter) : statusMatched;
  const detailReceipt = detailReceiptId ? allReceipts.find(r => r.id === detailReceiptId) : null;

  // ── Drag & drop / filhantering ──
  // Sätt bara state när det FAKTISKT ändras — dragover fyras av
  // kontinuerligt medan filen svävar över ytan.
  const handleDragOver = (e) => { e.preventDefault(); if (!isDragging) setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(Array.from(e.dataTransfer.files));
  };
  const handleFileInput = (e) => {
    if (e.target.files?.length) handleFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const [fileErrors, setFileErrors] = useState([]);

  // Laddar upp en enskild fil direkt till Storage och lägger till kvittot i
  // listan så fort uppladdningen är klar — INTE efter att ett formulär
  // fyllts i (Sida 34). Fälten är tomma till att börja med; kvittot hamnar
  // därför i "Ej hanterade" precis som ett kvitto med saknat konto redan
  // gör idag, tills användaren öppnar detaljvyn och sparar.
  const uploadReceipt = (file, openWhenDone = false) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setUploadingFiles(prev => [...prev, { id, file, progress: 0 }]);

    // Simulerad progress medan den riktiga uppladdningen pågår — Supabase
    // JS-klienten ger ingen tillförlitlig progress-event för Storage-
    // uppladdningar, så indikatorn klättrar mot 90% och hoppar först till
    // 100% när uppladdningen faktiskt är klar, istället för att låtsas
    // vara exakt eller stå still helt under tiden.
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + 12, 90);
      setUploadingFiles(curr => curr.map(x => x.id === id ? { ...x, progress: p } : x));
    }, 150);
    intervalsRef.current[id] = interval;

    const finish = () => {
      clearInterval(interval);
      delete intervalsRef.current[id];
      setUploadingFiles(curr => curr.filter(x => x.id !== id));
    };

    uploadFn(user.id, file, 'receipts')
      .then(receiptUrl => {
        finish();
        onAdd?.({
          type: 'receipt', date: new Date().toISOString().split('T')[0], description: '', supplier: '',
          amount: 0, netAmount: 0, vatAmount: 0, vatRate: 25, costAccount: '',
          receiptUrl, receiptType: file.type,
          // Sida 27: krävs för att kunna skilja "Alla kvitton" från "Mina
          // kvitton" och visa vem som laddat upp vad i ett flerpersonskonto.
          uploadedBy: user?.id ? {
            id: user.id,
            name: [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' '),
            email: user?.email || '',
          } : null,
        });
        if (openWhenDone) setAutoOpenUrl(receiptUrl);
      })
      .catch(err => {
        finish();
        const msg = /bucket not found/i.test(err.message || '')
          ? `${file.name}: bildlagring är inte konfigurerad i Supabase-projektet ännu (se supabase-setup.sql).`
          : `${file.name}: kunde inte laddas upp (${err.message}).`;
        setFileErrors(prev => [...prev, msg]);
      });
  };

  const handleFiles = (files) => {
    const errors = [];
    if (files.length > MAX_FILES) {
      errors.push(`Max ${MAX_FILES} filer åt gången — bara de första ${MAX_FILES} laddas upp.`);
    }
    const toProcess = files.slice(0, MAX_FILES);
    const valid = [];
    toProcess.forEach(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        errors.push(`${f.name}: filformatet stöds inte (endast JPG, PNG, WEBP, HEIC och PDF).`);
      } else if (f.size > MAX_FILE_MB * 1024 * 1024) {
        errors.push(`${f.name}: filen är för stor (max ${MAX_FILE_MB} MB).`);
      } else {
        valid.push(f);
      }
    });
    setFileErrors(errors);
    if (valid.length === 0) return;
    if (!user?.id) { setFileErrors(prev => [...prev, 'Du måste vara inloggad för att ladda upp kvitton.']); return; }
    // En hel mapp med kvitton ska inte kasta upp en modal per fil — då är
    // man i "tömma telefonen"-läget och vill se listan växa. Ett ensamt
    // kvitto är däremot alltid ett kvitto man tänkt fylla i på en gång.
    const openWhenDone = valid.length === 1;
    valid.forEach(f => uploadReceipt(f, openWhenDone));
  };

  // ── Rätta konto manuellt på en post som saknar kontering ──
  const [fixingId, setFixingId] = useState(null);
  const [fixAccount, setFixAccount] = useState('');
  const applyFix = (id) => {
    if (!fixAccount) return;
    onFixExpenseAccount?.(id, fixAccount);
    setFixingId(null);
    setFixAccount('');
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>

      {/* ── Sidhuvud (samma mönster som Kunder/Anställda och lön m.fl., Sida 43) ──
          Uppladdning, sök och filter flyttade IN i sidhuvudet (kundfeedback:
          "mer plats för kvittona, sök och filter mer upp") — sidhuvudet är
          fast (skrollar aldrig bort, samma som på alla listsidor), så allt
          som ligger här är alltid nåbart, och innehållsytan under kan börja
          med listan direkt istället för att kliva genom fyra separata
          block (rubrik, uppladdning, sökrad, filterrad) innan man ens ser
          ett kvitto. */}
      <ListPageHeader title={pageTitle || 'Kvitton'} subtitle={pageSubtitle}>
        <div style={{ marginTop: '14px' }}>
          {/* Uppladdningszonen — en enda yta för både enskilda filer och en
              hel mapp (Sida 34), istället för separata konkurrerande ytor. */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('receipt-upload').click()}
            className={`rc-drop${isDragging ? ' rc-drop-on' : ''}`}
            style={{ marginBottom: 0 }}
          >
            <input type="file" id="receipt-upload" style={{ display: 'none' }} multiple accept={ACCEPT_ATTR} onChange={handleFileInput} />
            {/* Mappval kräver ett eget, separat <input> — webkitdirectory kan
                inte slås på/av dynamiskt på samma inputelement som filval. */}
            <input type="file" id="receipt-upload-folder" style={{ display: 'none' }} multiple webkitdirectory="" directory="" onChange={handleFileInput} />
            <span className="rc-drop-icon"><UploadCloud size={19} color={BRAND.greenDark} /></span>
            <span className="rc-drop-text">
              <span className="rc-drop-title">{isDragging ? 'Släpp filerna här' : 'Ladda upp kvitton'}</span>
              <span className="rc-drop-hint">
                Dra och släpp, eller klicka för att välja. PDF, JPG, PNG eller HEIC — max {MAX_FILE_MB} MB.
              </span>
            </span>
            <button
              type="button"
              className="rc-drop-folder"
              onClick={e => { e.stopPropagation(); document.getElementById('receipt-upload-folder').click(); }}
            >
              Välj en hel mapp
            </button>
          </div>

          {fileErrors.length > 0 && (
            <div style={{ background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', padding: '12px 16px', marginTop: '12px' }}>
              {fileErrors.map((msg, i) => (
                <div key={i} style={{ fontSize: '13px', color: 'var(--status-red-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} /> {msg}
                </div>
              ))}
            </div>
          )}

          {/* Uploading states */}
          {uploadingFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {uploadingFiles.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <FileText size={24} color="var(--text-muted)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                      <span>{f.file.name}</span>
                      <span>{f.progress}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--gray-200)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${f.progress}%`, background: BRAND.green, transition: 'width 0.15s' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Verktygsraden: sök + Alla/Mina + statusfilter + månad, allt i
              samma rad (radbryter på smal skärm). Sökningen är parad med
              filtren istället för med en rubrik, eftersom det ÄR ett
              filter — samma sak som statuspillren gör. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            <div className="rc-search" style={{ flex: '1 1 220px' }}>
              <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Sök leverantör, konto eller belopp…"
                aria-label="Sök bland kvitton"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Rensa sökning" className="rc-search-clear">
                  <X size={13} />
                </button>
              )}
            </div>

            {showUploaderTabs && (
              <div className="rc-segmented">
                {[{ id: 'all', label: 'Alla' }, { id: 'mine', label: 'Mina' }].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setViewTab(t.id)}
                    className={effectiveTab === t.id ? 'active' : ''}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Månadsväljaren: "Alla månader" grupperar kronologiskt
                (September 2026, Augusti 2026, …) — väljer man t.ex. Augusti
                visas ALLA augustikvitton oavsett år, grupperat per år
                istället (kundönskemål: "show all in August ... from all
                years"). */}
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              aria-label="Filtrera på månad"
              style={{ height: '34px', padding: '0 10px', border: '1px solid var(--border)', borderRadius: '9px', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit', flexShrink: 0 }}
            >
              <option value="all">Alla månader</option>
              {MONTH_NAMES.map(m => <option key={m.v} value={m.v}>{m.label} (alla år)</option>)}
            </select>

            {/* Grupperat (rubriker per månad/år) kontra en enda platt lista
                — oberoende av månadsfiltret ovan. */}
            <div className="rc-segmented">
              <button onClick={() => setFlatView(false)} className={!flatView ? 'active' : ''}>Grupperat</button>
              <button onClick={() => setFlatView(true)} className={flatView ? 'active' : ''}>Lista</button>
            </div>

            {Object.values(statusCounts).some(c => c > 0) && (
              <>
                {(showUploaderTabs) && <span className="rc-toolbar-divider" />}
                {Object.entries(STATUS_META).map(([key, meta]) => {
                  const count = statusCounts[key] || 0;
                  if (count === 0) return null;
                  const isActive = statusFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(f => f === key ? null : key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
                        background: meta.bg, border: `1.5px solid ${isActive ? meta.color : 'transparent'}`,
                        borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                        color: meta.color, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {meta.label}
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: 'var(--status-chip-bg)', color: meta.color }}>{count}</span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Mappar — kundens egna, namngivna sätt att dela upp kvittona
                (ersätter den gamla, påtvingade kontokategori-indelningen,
                se kommentaren vid folders ovan). Mappillren syns bara när
                det faktiskt finns en mapp att filtrera på; mapp-knappen är
                alltid synlig men bara EN liten knapp, inte en egen rad —
                den enda platsen som tar plats när ingen mapp finns än. */}
            <span className="rc-toolbar-divider" />
            {folders.map(folder => {
              const count = folderCounts.get(folder.id) || 0;
              if (count === 0 && folderFilter !== folder.id) return null;
              const isActive = folderFilter === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => setFolderFilter(f => f === folder.id ? null : folder.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
                    background: 'var(--bg-muted)', border: `1.5px solid ${isActive ? 'var(--text-main)' : 'transparent'}`,
                    borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                    color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {folder.name}
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: 'var(--status-chip-bg)', color: 'var(--text-secondary)' }}>{count}</span>
                </button>
              );
            })}
            {folders.length > 0 && (folderCounts.get('__unfiled__') || 0) > 0 && (
              <button
                onClick={() => setFolderFilter(f => f === '__unfiled__' ? null : '__unfiled__')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
                  background: 'var(--bg-muted)', border: `1.5px solid ${folderFilter === '__unfiled__' ? 'var(--text-main)' : 'transparent'}`,
                  borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Osorterat
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: 'var(--status-chip-bg)', color: 'var(--text-secondary)' }}>{folderCounts.get('__unfiled__')}</span>
              </button>
            )}
            <button
              ref={folderManagerAnchorRef}
              type="button"
              onClick={() => setFolderManagerOpen(v => !v)}
              title="Skapa och hantera mappar"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
                background: folderManagerOpen ? 'var(--bg-muted)' : 'none',
                border: '1.5px dashed var(--border)', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <FolderPlus size={13} /> {folders.length === 0 ? 'Skapa en mapp' : 'Mappar'}
            </button>
            <AnchoredDropdown anchorRef={folderManagerAnchorRef} panelRef={folderManagerPanelRef} open={folderManagerOpen} minWidth={230} maxHeight={340}>
              <div style={{ padding: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                  Mappar
                </div>
                {folders.length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                    Ingen mapp än. Skapa en nedan och lägg kvitton i den från kvittots detaljvy.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '10px' }}>
                    {folders.map(folder => (
                      <div key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {editingFolderId === folder.id ? (
                          <input
                            autoFocus
                            value={editingFolderName}
                            onChange={e => setEditingFolderName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { renameFolder(folder.id, editingFolderName); setEditingFolderId(null); }
                              if (e.key === 'Escape') setEditingFolderId(null);
                            }}
                            onBlur={() => { renameFolder(folder.id, editingFolderName); setEditingFolderId(null); }}
                            style={{ flex: 1, padding: '5px 7px', border: '1px solid var(--primary)', borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name); }}
                            title="Byt namn"
                            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left', padding: '5px 7px', border: 'none', background: 'none', borderRadius: '6px', fontSize: '12.5px', color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                            <Pencil size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          </button>
                        )}
                        <button type="button" onClick={() => removeFolder(folder)} aria-label={`Ta bort mappen ${folder.name}`} title="Ta bort mapp" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px', display: 'flex', flexShrink: 0 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addFolder(); }}
                    placeholder="Ny mapp, t.ex. Resor"
                    style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                  <button
                    type="button"
                    onClick={addFolder}
                    disabled={!newFolderName.trim()}
                    style={{ padding: '6px 10px', background: BRAND.green, border: 'none', borderRadius: '6px', color: 'white', fontWeight: 600, fontSize: '12.5px', fontFamily: 'inherit', cursor: newFolderName.trim() ? 'pointer' : 'default', opacity: newFolderName.trim() ? 1 : 0.5, flexShrink: 0 }}
                  >
                    Lägg till
                  </button>
                </div>
              </div>
            </AnchoredDropdown>
          </div>

        </div>
      </ListPageHeader>

      {/* Yttre behållaren har ingen padding så tomt-läget (EmptyReceiptsState)
          sitter flush mot sidhuvudet och sidomenyn, precis som Kontakter/Offerter/
          Bokföring (facit). När kvitton finns har listan sin egen padding. */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {receiptsList.length === 0 ? (
          <EmptyReceiptsState
            isFilteredEmpty={q || allReceipts.length > 0}
            text={
              q ? `Inga kvitton matchar "${query.trim()}".`
                : allReceipts.length > 0 ? 'Inga kvitton matchar det här filtret.'
                  : undefined
            }
          />
        ) : (
          <div style={{ padding: '10px 14px 20px' }}>
            {(() => {
              // Gruppera per månad — men bara när listan faktiskt SPÄNNER över
              // fler än en, annars är en ensam "September 2026"-rubrik bara
              // brus ovanför tre kvitton från samma månad. En riktigt lång
              // lista (flera år av kvitton) är exakt där en sån rubrik hjälper
              // mest: man skannar efter månaden, inte efter en enskild rad.
              // Är ett specifikt kalendermånadsfilter aktivt (t.ex. Augusti)
              // grupperas det som återstår per ÅR istället — månaden är redan
              // bestämd, det som skiljer raderna åt är vilket år de är från.
              const groupByYear = monthFilter !== 'all';
              const groups = new Map();
              receiptsList.forEach(r => {
                const key = groupByYear ? ((r.date || '').slice(0, 4) || 'okänt') : ((r.date || '').slice(0, 7) || 'okänt');
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(r);
              });
              // "Lista"-läget (flatView) slår alltid av rubrikerna, oavsett hur
              // många grupper det annars hade blivit — allt ligger under
              // varandra i en enda lista.
              const showGroups = !flatView && groups.size > 1;
              const sections = showGroups ? [...groups.entries()] : [[null, receiptsList]];
              const groupLabel = (key) => key === 'okänt' ? 'Utan datum' : (groupByYear ? key : formatMonthLabel(key));

              return sections.map(([monthKey, items], i) => (
                <div key={monthKey || 'flat'}>
                  {monthKey && (
                    <div className={`rc-month-head${i === 0 ? ' rc-month-head--first' : ''}`}>
                      <span>{groupLabel(monthKey)}</span>
                      <span className="rc-month-total">
                        {items.length} {items.length === 1 ? 'kvitto' : 'kvitton'} · {formatSEK(items.reduce((s, r) => s + (r.amount || 0), 0))}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: showGroups ? '16px' : 0 }}>
                    {items.map(r => {
                      const status = getReceiptStatus(r, verifications);
                      const categoryName = accounts.find(a => a.code === r.costAccount)?.name;
                      const folderName = r.folderId ? folders.find(f => f.id === r.folderId)?.name : null;
                      // Vem som laddade upp är bara intressant när det finns fler
                      // än en person att skilja på (samma resonemang som ovan).
                      const uploaderName = showUploaderTabs && effectiveTab === 'all' ? displayUploaderName(r.uploadedBy) : null;
                      const isImage = r.receiptType?.startsWith('image/') && r.receiptUrl;
                      const isPdf = r.receiptType === 'application/pdf' && r.receiptUrl;
                      return (
                        <div
                          key={r.id}
                          data-receipt-id={r.id}
                          onClick={() => setDetailReceiptId(r.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailReceiptId(r.id); } }}
                          className="rc-row"
                        >
                          <div className="rc-row-thumb">
                            {isImage ? (
                              <img src={r.receiptUrl} alt="Kvitto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                            ) : isPdf ? (
                              <FileText size={20} color={BRAND.greenDark} />
                            ) : (
                              <Receipt size={20} color="var(--text-muted)" />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.supplier || r.description || 'Namnlöst kvitto'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(r.date)}{categoryName ? ` · ${categoryName}` : ''}{folderName ? ` · ${folderName}` : ''}</div>
                            {uploaderName && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>Uppladdat av {uploaderName}</div>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-main)' }}>{formatSEK(r.amount)}</div>
                            {r.foreignCurrency && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{amountToInput(r.foreignCurrency.amount)} {r.foreignCurrency.code}</div>}
                            {status === 'reversed' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '11.5px', color: BRAND.grayText, fontWeight: 600, marginTop: '2px' }}>
                                <RotateCcw size={12} /> Rättad
                              </div>
                            ) : status === 'booked' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '11.5px', color: BRAND.greenDark, fontWeight: 600, marginTop: '2px' }}>
                                <CheckCircle2 size={12} /> Bokförd
                              </div>
                            ) : status === 'pending' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '11.5px', color: BRAND.grayText, fontWeight: 600, marginTop: '2px' }}>
                                <Clock size={12} /> Pågående
                              </div>
                            ) : fixingId === r.id ? (
                              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <div style={{ width: 180 }}>
                                  <AccountSearch value={fixAccount} onChange={setFixAccount} accounts={accounts} placeholder="Välj konto..." />
                                </div>
                                <button onClick={() => applyFix(r.id)} style={{ padding: '5px 10px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Spara</button>
                              </div>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); setFixingId(r.id); setFixAccount(''); }}
                                title="Kunde inte bokföras automatiskt — konto saknas"
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', background: 'none', border: 'none', color: BRAND.amberText, fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', padding: 0, marginLeft: 'auto', marginTop: '2px' }}
                              >
                                <AlertCircle size={12} /> Granska
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {detailReceipt && (
        <ReceiptDetailModal
          receipt={detailReceipt}
          accounts={accounts}
          projects={projects}
          folders={folders}
          allReceipts={allReceipts}
          verifications={verifications}
          status={getReceiptStatus(detailReceipt, verifications)}
          onSave={(id, values) => onSaveReceiptDetails?.(id, values)}
          onSaveOcrDraft={(id, draft) => onSaveOcrDraft?.(id, draft)}
          onDelete={(id) => onDeleteExpense?.(id)}
          onReverse={(id) => onReverseExpense?.(id)}
          onClose={() => setDetailReceiptId(null)}
        />
      )}
    </div>
  );
}
