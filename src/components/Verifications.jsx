import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus, Search, ChevronRight, ChevronDown,
  AlertCircle, RotateCcw, RefreshCw,
  UploadCloud, Tag, LayoutTemplate, Save, Trash2, ScanLine, BookOpen, CheckCircle2, Paperclip,
} from './icons';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { BRAND } from '../utils/brandColors';
import { PartySearch, ProjectSearch, AccountSearch } from './shared/SearchInputs';
import ListPageHeader, { ListFilterBar, listSearchInputStyle, listFilterFieldStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import DateField from './shared/DateField';
import { findLockedVatPeriod } from '../utils/vatCalculation';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { DocumentPane, DocumentLightbox } from './shared/DocumentViewer';
import { uploadFileToStorage, deleteFileFromStorage } from '../utils/fileUpload';
import { confirmDialog, promptDialog } from './shared/ConfirmDialog';
import { parseReceiptText } from '../utils/ocrReceipt';
import { readDocumentText } from '../utils/ocrCache';
import { historyFromVerifications } from '../utils/receiptHistory';
import { decidePayAccount } from '../utils/payAccountChoice';
import { missingReverseChargeRows, withReverseChargeRows } from '../utils/reverseCharge';
import { ScanOverlay, OcrChecklist, OCR_ITEMS, photoHintText, MIN_SCAN_MS, REVEAL_STEP_MS, CACHED_SCAN_MS } from './shared/ScanExperience';
import { convertToSek } from '../utils/currencyConversion';
import { getNextNumber as getNextNumberForSeries } from '../utils/verificationNumbering';
import AccountsPanel from './shared/AccountsPanel';
import SimpleBookingPanel from './shared/SimpleBookingPanel';
import { buildSimpleBooking, describeRow, describeVerification, paymentAccounts, VAT_RATES } from '../utils/plainBooking';
import { t as tr, dateLocale } from '../i18n';

// Bara för att skriva ut valutavarningen lite snyggare — ingen omräkning
// görs här, det är enbart kosmetiskt.
const CURRENCY_SYMBOL = { USD: '$', GBP: '£', EUR: '€', JPY: '¥', CNY: '¥', NOK: 'kr', DKK: 'kr' };
// Yen (och i praktiken oftast yuan på kvitton) skrivs utan decimaler —
// "¥5000,00" ser trasigt ut för en valuta som aldrig har ören/fen.
const formatForeignAmount = (code, amount) => (code === 'JPY' || code === 'CNY') ? String(Math.round(amount)) : amount.toFixed(2);

// Liten badge som visas intill ett fälts label när OCR fyllt i det —
// samma mönster (och samma utseende) som kvittovyn i Utgifter
// (Expenses.jsx). Försvinner så fort användaren redigerar fältet själv.
function OcrBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em',
      padding: '1px 6px', borderRadius: '999px', verticalAlign: 'middle', marginLeft: '5px',
      background: '#e0f2fe', color: '#0369a1',
    }}>
      <ScanLine size={10} /> {tr('ui.ocr')}
    </span>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
// Beloppslös variant (heltal, ingen valuta) — grupprubrikernas summor, se
// renderVerGroupHeader nedan. Samma format som Kvittons formatSEK.
const fmtSEK = (v) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(v || 0);
// Kundönskemål ("samma som i Kvitton, jag älskar det"): kronologisk
// gruppering av listan per månad, med samma väljare (Alla månader/en
// specifik kalendermånad från alla år/Grupperat-Lista) som Expenses.jsx
// redan har. Se den filens kommentarer för hela resonemanget — samma
// mekanik, bara återanvänd här mot ListTable:s nya groupBy-stöd i stället
// för Kvittons egna platta kort.
const formatMonthLabel = (yearMonth) => {
  const [y, m] = yearMonth.split('-').map(Number);
  const label = new Intl.DateTimeFormat(dateLocale(), { month: 'long', year: 'numeric' }).format(new Date(y, (m || 1) - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const MONTH_NAMES = [
  { v: '01', label: tr('ui.januari') }, { v: '02', label: tr('ui.februari') }, { v: '03', label: tr('ui.mars') },
  { v: '04', label: tr('ui.april') }, { v: '05', label: tr('ui.maj') }, { v: '06', label: tr('ui.juni') },
  { v: '07', label: tr('ui.juli') }, { v: '08', label: tr('ui.augusti') }, { v: '09', label: tr('ui.september') },
  { v: '10', label: tr('ui.oktober') }, { v: '11', label: tr('ui.november') }, { v: '12', label: tr('ui.december') },
];

// ─── De fyra kontoklasserna (verksamt.se) ──────────────────────────────────────
// Tillgångar (1) och Kostnader (4–8) ökar normalt i debet.
// Skulder inkl. eget kapital (2) och Intäkter (3) ökar normalt i kredit.
// Rättelser går giltigt åt andra hållet — därför är detta en varning, aldrig en spärr.
// Bara intäkts- och kostnadskonton varnar: på balanskonton är båda sidorna
// vardag (banken krediteras vid varje betalning, ingående moms debiteras vid
// varje inköp), så en varning där gav falsklarm på de vanligaste bokningarna.
function getAccountClass(code) {
  const n = parseInt(code, 10);
  if (isNaN(n)) return null;
  if (n >= 1000 && n <= 1999) return { key: 'tillgang', label: tr('ui.tillgang_2'), normalSide: 'debet' };
  if (n >= 2000 && n <= 2999) return { key: 'skuld_ek', label: tr('ui.skuld_eget_kapital'), normalSide: 'kredit' };
  if (n >= 3000 && n <= 3999) return { key: 'intakt', label: tr('ui.intakt'), normalSide: 'kredit' };
  if (n >= 4000 && n <= 8999) return { key: 'kostnad', label: tr('ui.kostnad'), normalSide: 'debet' };
  return null;
}

// Reskontrakonton — kundfordringar (151x–159x) och leverantörsskulder (24xx) —
// kräver enligt bokföringslagen att motparten framgår.
function isReskontraAccount(code) {
  const n = parseInt(code, 10);
  if (isNaN(n)) return false;
  return (n >= 1510 && n <= 1599) || (n >= 2400 && n <= 2449);
}

function rowSideWarning(row) {
  if (!row.account) return null;
  const cls = getAccountClass(row.account);
  if (!cls || cls.key === 'tillgang' || cls.key === 'skuld_ek') return null;
  const debit = parseFloat(row.debet) || 0;
  const credit = parseFloat(row.kredit) || 0;
  if (debit <= 0 && credit <= 0) return null;
  const bookedSide = debit > 0 ? 'debet' : 'kredit';
  if (bookedSide === cls.normalSide) return null;
  return tr('ui.ovanligt_en_okar_normalt_i_det_har_ar_okej_vid_e', { label: cls.label, normalSide: cls.normalSide });
}

// PartySearch/ProjectSearch/AccountSearch delas nu från ./shared/SearchInputs
// så samma combobox återanvänds i Kontakter (standardkonto för leverantörer).

// ─── Verification Form (inline full-screen) ───────────────────────────────────
const MAX_ATTACHMENT_MB = 10;
const ACCEPTED_ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function VerificationForm({ accounts, contacts, projects = [], verifications = [], balances, templates, onSaveTemplate, onSave, onClose, nextNumber, getNextNumber, initial, vatPeriods, user, orgType, uploadFn = uploadFileToStorage, vatExempt = false }) {
  const [date, setDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [desc, setDesc] = useState(initial?.description || '');
  const [projectId, setProjectId] = useState(initial?.projectId || '');
  const [counterpartyId, setCounterpartyId] = useState(initial?.counterpartyId || '');
  const [originalLocation, setOriginalLocation] = useState(initial?.originalLocation || '');
  const [series, setSeries] = useState(initial?.series || 'A');
  const [costCenter, setCostCenter] = useState(initial?.costCenter || '');
  const [internalNote, setInternalNote] = useState(initial?.internalNote || '');
  const [showReview, setShowReview] = useState(false);
  const [rows, setRows] = useState(
    initial?.rows
      // Läs tolerant — äldre verifikationer kan ha sparats med debit/credit
      // (den gamla, felaktiga fältnamngivningen) innan denna bugg fixades.
      ? initial.rows.map(r => ({
          ...r, accountName: r.accountName || '',
          debet: getDebet(r) ? String(getDebet(r)) : '',
          kredit: getKredit(r) ? String(getKredit(r)) : '',
          desc: r.desc || '',
        }))
      // TVÅ tomma rader, inte en. En verifikation kan per definition aldrig
      // bestå av en enda rad (debet måste möta kredit — formulärets egen
      // validering nedan kräver också minst två), så en ensam rad var ett
      // steg användaren alltid måste ta själv innan något gick att spara.
      // En tom startrad visas — användaren lägger till fler via "Lägg till rad".
      : [
          { account: '', accountName: '', debet: '', kredit: '', desc: '' },
        ]
  );

  // Enkelt läge (standard för en ny verifikation): användaren väljer vad som
  // hänt och fyller i belopp, raderna byggs åt dem (utils/plainBooking.js) —
  // ingen debet eller kredit att kunna. Avancerat läge är den vanliga
  // konteringstabellen. En befintlig verifikation (utkast, rättelse) öppnas
  // alltid i avancerat läge, eftersom dess rader redan finns.
  const readModePreference = () => {
    try { return localStorage.getItem('bokix.verificationMode') === 'advanced' ? 'advanced' : 'simple'; } catch { return 'simple'; }
  };
  const [mode, setMode] = useState(initial?.rows ? 'advanced' : readModePreference());
  const modeRef = useRef(mode);
  const payDefaults = paymentAccounts(accounts);
  const defaultPay = (payDefaults.find(a => a.code === '1930') || payDefaults[0]).code;
  const emptySimple = () => ({ kind: 'expense', amount: '', vatRate: 25, account: '', payAccount: defaultPay, payPrivate: false, fromAccount: defaultPay, toAccount: '' });
  const [simple, setSimple] = useState(emptySimple);
  const simpleBuilt = useMemo(() => buildSimpleBooking(simple, { orgType, vatExempt }), [simple, orgType, vatExempt]);
  useEffect(() => {
    if (mode !== 'simple') return;
    setRows(simpleBuilt.rows.length > 0
      ? simpleBuilt.rows.map(r => ({
          account: r.account,
          accountName: accounts.find(a => a.code === r.account)?.name || '',
          debet: r.debet ? r.debet.toFixed(2) : '',
          kredit: r.kredit ? r.kredit.toFixed(2) : '',
          desc: '',
        }))
      : [{ account: '', accountName: '', debet: '', kredit: '', desc: '' }]);
  }, [mode, simpleBuilt, accounts]);

  const [attachment, setAttachment] = useState(null); // nyvald, ännu ej uppladdad fil
  const [attachmentUrl, setAttachmentUrl] = useState(null); // lokal förhandsvisnings-URL för `attachment`
  // Bugkritiskt: ett underlag laddades tidigare bara upp som en object-URL i
  // webbläsarminnet (URL.createObjectURL) — den försvinner så fort sidan
  // laddas om, och skickades ALDRIG med i onSave-payloaden. Filen såg ut att
  // sparas (förhandsvisningen fungerade) men var i praktiken alltid borta
  // igen efteråt. `existingAttachment` håller en REDAN uppladdad (Supabase
  // Storage) fils riktiga URL — antingen återställd från en sparad
  // verifikation (`initial`) eller satt efter en lyckad uppladdning i
  // handleSave nedan.
  const [existingAttachment, setExistingAttachment] = useState(
    initial?.attachmentUrl ? { url: initial.attachmentUrl, name: initial.attachmentName || 'Underlag', type: initial.attachmentType || '' } : null
  );
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [showAttachmentLightbox, setShowAttachmentLightbox] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRowOverride = (i) => setExpandedRows(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const fileInputRef = useRef(null);

  // ── OCR ──────────────────────────────────────────────────────────────────
  // Samma idé som kvittovyn i Utgifter (Expenses.jsx): släpp in en bild eller
  // PDF och slipp knappa in datum, belopp och konto för hand. Skillnaden här
  // är att en verifikation är dubbel bokföring — OCR fyller alltså inte bara
  // fält, den bygger raderna: kostnadskontot (netto) + ev. ingående moms
  // (2641), båda i debet, mot ett gissat betalkonto (1930, företagskonto) i
  // kredit — samma trepartsmönster som handleSaveReceiptDetails i App.jsx
  // redan använder för kvitton. Det ÄR en gissning (framför allt betalkontot
  // — kvittot säger inte om det begicks med kort eller kontant), så raderna
  // markeras tydligt som OCR och måste granskas innan bokföring, aldrig
  // presenterade som ett facit.
  // ocrStatus: 'idle' | 'scanning' | 'done' | 'error'
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrMessage, setOcrMessage] = useState('');
  // Vilka fält som fylldes i av OCR — styr badgarna, och rensas fält för fält
  // så fort användaren redigerar något av dem själv.
  const [ocrFields, setOcrFields] = useState(new Set());
  // Räknare för att göra körningar avbrytbara: hinner användaren byta fil
  // eller trycka "Läs av igen" innan en pågående läsning är klar, ska bara
  // den SENASTE körningens resultat någonsin skrivas in. Samma id jämförs
  // efter varje await.
  const ocrRunIdRef = useRef(0);
  // Ett kvitto i en annan valuta än kronor — { code, amount, converted } |
  // null. `converted` är { sek, rate, date } från convertToSek (utils/
  // currencyConversion.js) — eller null om kursen inte gick att hämta, och
  // då byggs raderna inte alls (se nedan).
  const [ocrForeignCurrency, setOcrForeignCurrency] = useState(null);
  // Uppvisningen efter läsningen, samma som i kvittovyn (Expenses.jsx): fälten
  // fylls i ett i taget och checklistan visar vad som hittades, gissades
  // eller saknades. Verifikationen har inget nummerfält, så "Nummer" utgår.
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState({});
  const [notReceipt, setNotReceipt] = useState(false);
  // Skiljer på "inte ett kvitto/en faktura" och "bilden gick inte att läsa
  // av" (för suddigt/utzoomat/mörkt) — samma distinktion som kvittovyn, se
  // isUnreadableText/classifyDocument i ocrReceipt.js.
  const [unreadable, setUnreadable] = useState(false);
  // Rådet om fotot ('blurry' | 'dark' | 'far'), satt bara när bilden stod i
  // vägen för avläsningen. Samma regel som i kvittovyn (Expenses.jsx).
  const [photoHint, setPhotoHint] = useState(null);
  const [ocrVat, setOcrVat] = useState(null);
  // Kontoförslag från avläsningen (en regel, inte historik): visas med en knapp, fylls inte i.
  const [accountSuggestion, setAccountSuggestion] = useState(null);
  const timersRef = useRef([]);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);
  const verificationsRef = useRef(verifications);
  verificationsRef.current = verifications;
  const VER_OCR_ITEMS = useMemo(() => [...OCR_ITEMS.filter(i => i.key !== 'receiptNumber'), { key: 'payAccount', label: tr('ui.betalkonto') }], []);
  // Vilket betalkonto som valdes och varför: historik, avläst ur kvittot eller en gissning.
  const [payInfo, setPayInfo] = useState(null);
  // Tjänst från utlandet: { region, evidence } (omvänd skattskyldighet) eller { unclear, evidence } när regionen inte gick att avgöra.
  const [foreignInfo, setForeignInfo] = useState(null);

  const runOcr = useCallback(async (input, { force = false } = {}) => {
    if (!input) return;
    const runId = ++ocrRunIdRef.current;
    const isCurrent = () => ocrRunIdRef.current === runId;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const startedAt = Date.now();
    setOcrStatus('scanning');
    setOcrMessage(tr('ui.startar_lasning'));
    setOcrForeignCurrency(null);
    setNotReceipt(false);
    setUnreadable(false);
    setPhotoHint(null);
    setOcrVat(null);
    setAccountSuggestion(null);
    setPayInfo(null);
    setForeignInfo(null);
    setRevealing(false);
    setRevealed({});
    try {
      const { text, confidence, weakTokens, quality, cached } = await readDocumentText(input, msg => { if (isCurrent()) setOcrMessage(msg); }, { force });
      if (!isCurrent()) return; // en nyare körning har redan tagit över
      const parsed = parseReceiptText(text, { confidence, weakTokens });
      const nr = Boolean(parsed.notReceipt);
      // Rådet om fotot visas bara när avläsningen inte blev bra.
      const hint = (quality?.advice && (nr || !parsed.amount || parsed.amountGuessed || parsed.vatMismatch))
        ? quality.advice : null;

      // Utländsk valuta — räkna om till kronor med DAGSKURSEN FÖR
      // KÖPDATUMET (Skatteverkets rekommendation) innan raderna byggs.
      // Går omräkningen inte att göra fylls raderna INTE i som om talet
      // redan vore kronor — se convertToSek/ocrForeignCurrency.
      let grossSek = parsed.currency ? null : parsed.amount;
      let foreignInfo = null;
      if (!nr && parsed.amount && parsed.currency) {
        if (isCurrent()) setOcrMessage(tr('ui.raknar_om_till_kronor', { currency: parsed.currency }));
        const converted = await convertToSek(parsed.amount, parsed.currency, parsed.date);
        if (!isCurrent()) return;
        if (converted) grossSek = converted.sek;
        foreignInfo = { code: parsed.currency, amount: parsed.amount, converted };
      }

      const remaining = (cached ? CACHED_SCAN_MS : MIN_SCAN_MS) - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise(resolve => { timersRef.current.push(setTimeout(resolve, remaining)); });
        if (!isCurrent()) return;
      }

      // Samma regler som kvittovyn: företagets egen historik för leverantören
      // (tidigare bokförda verifikationer) slår gissningar ur texten. Något
      // som bara gissats visas som "Kontrollera", aldrig som avläst.
      const hist = nr ? null : historyFromVerifications(verificationsRef.current, parsed.supplier);
      const vatFromHistory = Boolean(hist && parsed.vatRateGuessed && hist.vatRate !== null);
      // Tjänst från utlandet (omvänd skattskyldighet): kontot och momssatsen
      // följer av dokumentet, inte av vad som bokförts tidigare. Tidigare
      // bokningar kan ha gjorts utan omvänd moms och ska inte följas här.
      const reverse = parsed.reverseCharge;
      const vatRate = reverse ? 0 : (vatFromHistory ? hist.vatRate : (parsed.vatRate ?? 25));
      const mixedVat = !nr && !reverse && !parsed.currency && Boolean(parsed.vatRates && parsed.vatAmount);
      // Samma regel som kvittovyn (Expenses.jsx): kostnadskontot fylls bara i
      // när det är känt — samma leverantör bokförd förut (historik), eller
      // omvänd skattskyldighet där kontot följer av dokumentet. Ett konto från
      // en regel (leverantören eller ett ord på kvittot) är ett FÖRSLAG som
      // användaren tar med en knapp, aldrig något som skrivs in och ser avläst
      // ut. Kundfeedback, uttryckligt: ett konto som ser säkert ut men är en
      // gissning är värre än ett tomt fält.
      const costAccount = reverse ? parsed.accountCode : (hist?.costAccount || '');
      const suggestion = !nr && !costAccount && parsed.accountCode && !parsed.accountGuessed && accounts.some(a => a.code === parsed.accountCode)
        ? parsed.accountCode : null;
      const gross = grossSek ? Math.round(grossSek * 100) / 100 : 0;
      // Betalkontot är inte en gissning när historiken eller kvittot säger något.
      const pay = decidePayAccount({ history: hist, paymentMethod: parsed.paymentMethod, accounts });
      const plan = [
        { key: 'supplier', found: !nr && Boolean(parsed.supplier), state: parsed.supplierMatched ? 'found' : 'guess', apply: () => setDesc(parsed.supplier) },
        { key: 'date', found: !nr && Boolean(parsed.date), state: parsed.dateGuessed ? 'guess' : 'found', apply: () => setDate(parsed.date) },
        { key: 'amount', found: !nr && gross > 0, state: parsed.amountGuessed ? 'guess' : 'found', apply: () => {} },
        {
          key: 'vatRate', found: !nr && gross > 0 && parsed.vatRate !== null && parsed.vatRate !== undefined,
          state: reverse ? 'found' : (vatFromHistory ? 'history' : (parsed.vatRateGuessed ? 'guess' : 'found')), apply: () => {},
        },
        {
          key: 'costAccount', found: !nr && gross > 0 && Boolean(costAccount),
          state: reverse ? 'found' : 'history', suggest: Boolean(suggestion), apply: () => {},
        },
        { key: 'payAccount', found: !nr && gross > 0, state: pay.state, apply: () => {} },
      ];

      // Raderna byggs när sista fältet visats: kostnadskontot (netto) och
      // ev. ingående moms (2641) i debet mot ett gissat betalkonto (1930).
      const buildRows = () => {
        // Moms i flera satser: momsbeloppet på kvittot bokförs som det står.
        // Inte momsregistrerat: momsen får inte dras av, hela beloppet är kostnad.
        const net = vatExempt ? gross : mixedVat ? Math.round((gross - parsed.vatAmount) * 100) / 100
          : vatRate > 0 ? Math.round((gross / (1 + vatRate / 100)) * 100) / 100 : gross;
        const vat = Math.round((gross - net) * 100) / 100;
        const nameOf = (code, fallback) => accounts.find(a => a.code === code)?.name || fallback;
        // Radernas belopp som tal. Vid omvänd skattskyldighet läggs momsraderna
        // (2645 i debet, 2614 i kredit) till av withReverseChargeRows.
        let numeric = [{ account: costAccount, debet: net, kredit: 0, desc: parsed.supplier || '' }];
        if (vat > 0) numeric.push({ account: '2641', debet: vat, kredit: 0, desc: '' });
        numeric.push({ account: pay.code, debet: 0, kredit: gross, desc: '' });
        if (reverse) numeric = withReverseChargeRows(numeric);
        const newRows = numeric.map(r => ({
          account: r.account,
          accountName: nameOf(r.account, r.account === '2641' ? tr('ui.ingaende_moms') : (r.account === pay.code ? tr('ui.foretagskonto_bank') : '')),
          debet: r.debet ? Number(r.debet).toFixed(2) : '', kredit: r.kredit ? Number(r.kredit).toFixed(2) : '', desc: r.desc || '',
        }));
        if (modeRef.current === 'simple') {
          setSimple(prev => ({
            ...prev, kind: 'expense', amount: gross.toFixed(2),
            ...(mixedVat ? { vatRate: 'mixed', vatAmount: parsed.vatAmount.toFixed(2) } : { vatRate: VAT_RATES.includes(vatRate) ? vatRate : 25 }),
            account: costAccount, payAccount: pay.code, payPrivate: false,
          }));
        } else {
          setRows(newRows);
        }
      };

      const anyFound = plan.some(step => step.found);
      setOcrStatus(anyFound || nr || foreignInfo ? 'done' : 'error');
      setOcrMessage('');
      setRevealing(true);
      const filled = new Set();
      plan.forEach((step, i) => {
        timersRef.current.push(setTimeout(() => {
          if (!isCurrent()) return;
          if (step.found) {
            step.apply();
            if (step.state === 'found' && (step.key === 'date' || step.key === 'supplier')) filled.add(step.key === 'supplier' ? 'desc' : 'date');
          }
          setRevealed(prev => ({ ...prev, [step.key]: step.found ? step.state : (step.suggest ? 'suggest' : 'missing') }));
          if (step.key === 'costAccount') setAccountSuggestion(suggestion);
        }, 250 + i * REVEAL_STEP_MS));
      });
      timersRef.current.push(setTimeout(() => {
        if (!isCurrent()) return;
        if (gross > 0 && !nr) {
          buildRows(); filled.add('rows');
          setPayInfo({ code: pay.code, name: accounts.find(a => a.code === pay.code)?.name || '', state: pay.state, source: pay.source });
        }
        setOcrFields(filled);
        if (foreignInfo) setOcrForeignCurrency(foreignInfo);
        setNotReceipt(nr);
        setUnreadable(Boolean(parsed.unreadable));
        setPhotoHint(hint);
        setForeignInfo(nr ? null : (parsed.reverseCharge
          ? { region: parsed.reverseCharge.region, evidence: parsed.reverseCharge.evidence }
          : (parsed.reverseChargeUnclear ? { unclear: true } : null)));
        setOcrVat(nr ? null : { verified: parsed.vatVerified, mismatch: parsed.vatMismatch, vatAmount: parsed.vatAmount, amountVerified: parsed.amountVerified, rates: parsed.vatRates, creditNote: parsed.creditNote });
        setRevealing(false);
      }, 250 + plan.length * REVEAL_STEP_MS + 150));
    } catch (err) {
      if (!isCurrent()) return;
      console.error('OCR misslyckades:', err);
      setOcrStatus('error');
      setOcrMessage('');
      setRevealing(false);
    }
  }, [accounts]);

  // Ett underlag ska faktiskt kunna ses, inte bara visas som ett filnamn —
  // skapa en object-URL för förhandsvisning och städa upp den när den byts ut.
  useEffect(() => {
    if (!attachment) { setAttachmentUrl(null); return; }
    const url = URL.createObjectURL(attachment);
    setAttachmentUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);
  // Vad som faktiskt visas i förhandsvisningen: en nyvald fil vinner över
  // ett redan uppladdat underlag (man håller på att byta ut det).
  const displayAttachmentName = attachment?.name || existingAttachment?.name;
  const displayAttachmentUrl = attachment ? attachmentUrl : existingAttachment?.url;
  const displayAttachmentType = attachment ? attachment.type : existingAttachment?.type;
  const hasAttachment = Boolean(attachment || existingAttachment);

  // "PDF eller bild (max 10 MB)" är inte bara text i gränssnittet — den
  // regeln kontrolleras faktiskt här, med ett tydligt felmeddelande.
  const acceptFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
      setFileError(tr('ui.ar_inte_en_pdf_eller_bild_och_kunde_inte_laggas', { name: file.name }));
      return;
    }
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setFileError(tr('ui.ar_for_stor_max_mb_2', { name: file.name, MAX_ATTACHMENT_MB }));
      return;
    }
    setFileError('');
    setAttachment(file);
    // Ingen avläsning här: att lägga till ett underlag är att lägga till ett
    // underlag, inte att be om en kontering. Användaren trycker Läs av när
    // den vill ha hjälp med den. Samma regel som i kvittovyn (Expenses.jsx).
  };

  // Avläsningen körs bara härifrån: ett medvetet tryck på Läs av.
  const rerunOcr = () => {
    const src = attachment || existingAttachment?.url;
    if (src) runOcr(src, { force: true });
  };

  // Mild varning — inte en spärr — om ett reskontrakonto (kundfordringar/
  // leverantörsskulder) används utan att motparten är ifylld.
  const usesReskontraAccount = rows.some(r => isReskontraAccount(r.account));
  const missingCounterparty = usesReskontraAccount && !counterpartyId;

  // Rensar OCR-badgen på raderna så fort användaren rör konteringen själv —
  // samma "försvinner vid redigering"-princip som Datum/Beskrivning nedan.
  const clearRowsOcrBadge = () => setOcrFields(s => { if (!s.has('rows')) return s; const n = new Set(s); n.delete('rows'); return n; });

  // Användaren tar kontoförslaget: det hamnar på kostnadsraden (den första
  // raden utan konto som har ett belopp i debet), eller i enkelt läge som köpet.
  const applyAccountSuggestion = () => {
    const code = accountSuggestion;
    if (!code) return;
    if (modeRef.current === 'simple') {
      setSimple(prev => ({ ...prev, account: code }));
    } else {
      const name = accounts.find(a => a.code === code)?.name || '';
      setRows(prev => {
        const i = prev.findIndex(r => !r.account && Number(String(r.debet).replace(',', '.')) > 0);
        return i < 0 ? prev : prev.map((r, j) => (j === i ? { ...r, account: code, accountName: name } : r));
      });
    }
    setAccountSuggestion(null);
  };

  const changeMode = async (next) => {
    if (next === mode) return;
    if (next === 'simple' && rows.some(r => r.account || r.debet || r.kredit)) {
      if (!(await confirmDialog(tr('ui.byta_till_enkelt_lage_raderna_du_har_skrivit_in')))) return;
    }
    if (next === 'simple') setSimple(emptySimple());
    modeRef.current = next;
    setMode(next);
    try { localStorage.setItem('bokix.verificationMode', next); } catch { /* sparas inte i privat läge */ }
  };

  const updateSimple = (updater) => {
    clearRowsOcrBadge();
    if (ocrForeignCurrency) setOcrForeignCurrency(null);
    setSimple(updater);
  };

  const updateRow = (i, field, val) => {
    clearRowsOcrBadge();
    if (ocrForeignCurrency) setOcrForeignCurrency(null);
    setRows(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      if (field === 'debet' && val) next[i].kredit = '';
      if (field === 'kredit' && val) next[i].debet = '';
      return next;
    });
  };

  const addRow = () => { clearRowsOcrBadge(); setRows(prev => [...prev, { account: '', accountName: '', debet: '', kredit: '', desc: '' }]); };

  const handleBlurAmount = (_i) => {
    const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debet) || 0), 0);
    const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.kredit) || 0), 0);
    const diff = totalDebit - totalCredit;

    if (Math.abs(diff) >= 0.01) {
       setRows(prev => {
         const next = [...prev];
         const emptyRowIndex = next.findIndex(r => !r.account && !r.debet && !r.kredit);
         if (emptyRowIndex !== -1 && emptyRowIndex === next.length - 1) {
            if (diff > 0) {
              next[emptyRowIndex].kredit = diff.toFixed(2);
            } else {
              next[emptyRowIndex].debet = Math.abs(diff).toFixed(2);
            }
         }
         return next;
       });
    }
  };

  const removeRow = (i) => {
    if (rows.length > 1) {
      clearRowsOcrBadge();
      setRows(r => r.filter((_, idx) => idx !== i));
    }
  };

  const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debet) || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.kredit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.01 && totalDebit > 0;
  // Har användaren börjat fylla i belopp alls? Skiljer "tomt formulär" från
  // "riktig obalans" i summaraden nedan.
  const hasAmounts = totalDebit > 0 || totalCredit > 0;

  // Ett bokfört utkast måste balansera precis som en färdig verifikation —
  // men ett utkast som fortfarande är under arbete får sparas obalanserat,
  // annars går det inte att spara och fortsätta senare.
  const handleSave = async (status = 'booked') => {
    if (status === 'booked' && !isBalanced) return;
    // Ett bokfört utkast kräver riktiga konteringsrader; ett utkast under
    // arbete får spara vilka påbörjade rader som helst, bara inte tomma.
    const validRows = status === 'draft'
      ? rows.filter(r => r.account || r.debet || r.kredit || r.desc)
      : rows.filter(r => r.account && (parseFloat(r.debet) > 0 || parseFloat(r.kredit) > 0));
    if (status === 'booked' && validRows.length < 2) return;
    if (status === 'draft' && validRows.length === 0 && !desc.trim()) return;

    // Underlaget laddas upp till Supabase Storage HÄR, inte bara hållas kvar
    // som en lokal object-URL — annars ser det ut att vara sparat men är
    // borta igen så fort sidan laddas om (se kommentaren vid `existingAttachment`).
    let attachmentUrlToSave = existingAttachment?.url || null;
    let attachmentNameToSave = existingAttachment?.name || null;
    let attachmentTypeToSave = existingAttachment?.type || null;
    if (attachment) {
      if (!user?.id) {
        setAttachmentError(tr('ui.kunde_inte_ladda_upp_underlaget_inte_inloggad'));
        return;
      }
      setAttachmentBusy(true); setAttachmentError('');
      try {
        attachmentUrlToSave = await uploadFn(user.id, attachment, 'verifications');
        attachmentNameToSave = attachment.name;
        attachmentTypeToSave = attachment.type;
        // Kostnadsgranskning: ett BYTT underlag på ett befintligt utkast
        // laddade tidigare bara upp den nya filen — den gamla
        // (existingAttachment, nu ersatt) blev kvar i Storage för alltid.
        // Best effort, körs efter att den nya uppladdningen redan lyckats.
        if (existingAttachment?.url) deleteFileFromStorage(existingAttachment.url);
      } catch (err) {
        setAttachmentBusy(false);
        const notConfigured = /bucket not found/i.test(err.message || '');
        setAttachmentError(notConfigured
          ? tr('ui.bildlagring_ar_inte_konfigurerad_i_supabase_proj_4')
          : tr('ui.kunde_inte_ladda_upp_underlaget', { v0: err.message || 'okänt fel' }));
        return;
      }
      setAttachmentBusy(false);
    }

    onSave({
      // `id` skickas ENDAST med för en verifikation som redan har ett
      // tilldelat nummer (dvs ett fortsatt utkast) — då ska sparningen
      // uppdatera SAMMA post, inte skapa en dubblett. En rättelse eller en
      // helt ny verifikation har `initial.number` tömd (se ovan) och får
      // därför inget id här, så den alltid skapas som en ny post.
      id: initial?.number ? initial.id : undefined,
      date, description: desc, projectId, counterpartyId, rows: validRows, amount: totalDebit,
      series, costCenter, internalNote, status,
      attachmentUrl: attachmentUrlToSave, attachmentName: attachmentNameToSave, attachmentType: attachmentTypeToSave,
      originalLocation: attachmentUrlToSave ? '' : originalLocation,
      // Upprättandedatum är alltid en systemgenererad tidsstämpel — användaren
      // kan aldrig sätta eller ändra den, annars går spårbarheten att manipulera.
      createdAt: initial?.createdAt || new Date().toISOString(),
    });
  };

  const inp = { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s', color: 'var(--text-main)', background: 'var(--bg-card)' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' };

  // Förhandsvisning av nästa nummer, i den serie som faktiskt är vald —
  // det riktiga numret sätts vid sparande så att det alltid är aktuellt.
  const previewNumber = initial?.number || (getNextNumber ? getNextNumber(series) : nextNumber);

  const fieldLabel = { display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' };

  // Valideringen räknas här (inte inne i knappraden längst ner, där den låg
  // förut) eftersom den nu behövs på TVÅ ställen: i sidhuvudets primärknapp
  // och i meddelanderaden vid knapparna längst ner.
  const validRowCount = rows.filter(r => r.account && (parseFloat(r.debet) > 0 || parseFloat(r.kredit) > 0)).length;
  const validationMessages = [];
  if (!desc.trim()) validationMessages.push('Ange en beskrivning');
  if (mode === 'simple') {
    if (simpleBuilt.errors.length > 0) validationMessages.push(simpleBuilt.errors[0]);
  } else if (validRowCount < 2) validationMessages.push(tr('ui.minst_tva_rader'));
  // Inköp av tjänster från utlandet (4535, 4531 m.fl.) kräver momsraderna för
  // omvänd skattskyldighet. Saknas de blockeras bokföringen, annars blir
  // momsdeklarationen fel.
  const numericRowsForReverse = rows.map(r => ({ account: r.account, debet: parseFloat(r.debet) || 0, kredit: parseFloat(r.kredit) || 0 }));
  const missingReverseRows = missingReverseChargeRows(numericRowsForReverse);
  if (missingReverseRows.length > 0) validationMessages.push(tr('ui.lagg_till_momsrader_omvand'));
  const addReverseRows = () => {
    setRows(prev => {
      const numeric = prev.map(r => ({ account: r.account, debet: parseFloat(r.debet) || 0, kredit: parseFloat(r.kredit) || 0 }));
      const extra = missingReverseChargeRows(numeric);
      return [...prev.filter(r => r.account || r.debet || r.kredit), ...extra.map(r => ({
        account: r.account, accountName: accounts.find(a => a.code === r.account)?.name || '',
        debet: r.debet ? r.debet.toFixed(2) : '', kredit: r.kredit ? r.kredit.toFixed(2) : '', desc: '',
      }))];
    });
  };
  const canReview = isBalanced && validationMessages.length === 0;
  const title = initial?.number ? tr('ui.verifikation_2', { number: initial.number }) : tr('ui.ny_verifikation');

  return (
    // Kundfeedback: "jag vill ha en riktig sida för att göra en
    // verifikation" — formuläret låg tidigare som ett kort INUTI listvyn,
    // med filterraden och hela verifikationslistan kvar under sig medan man
    // konterade. Samma helsidesmönster som fakturaformuläret (Invoices.jsx)
    // redan använder: sticky rubrikrad med Tillbaka + åtgärder, och bara
    // formuläret under. Sidan bakom monteras inte alls så länge den här är
    // öppen (se `if (showForm) return …` i Bokforing nedan).
    <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-muted)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" data-tour="page-verifications-cancel" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {tr('ui.tillbaka')}
        </button>
        {/* En rättelseverifikation (`initial` fylld men `number` medvetet
            tömd, se "Rätta"-knappen nedan) ska visas och beskrivas som en
            NY verifikation — den ärver bara text/rader, aldrig originalets
            nummer eller "redigera befintlig"-språket. */}
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{title}</h1>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{tr('ui.serie')} {series} · {previewNumber}</span>
        <div style={{ flex: 1, minWidth: '8px' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>{tr('ui.avbryt')}</button>
          <button type="button" onClick={() => handleSave('draft')} disabled={attachmentBusy} style={{ padding: '9px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: attachmentBusy ? 'not-allowed' : 'pointer', opacity: attachmentBusy ? 0.6 : 1 }}>
            {attachmentBusy ? tr('ui.laddar_upp_3') : tr('ui.spara_som_utkast')}
          </button>
          <button
            type="button"
            onClick={() => canReview && setShowReview(true)}
            disabled={!canReview}
            title={canReview ? undefined : validationMessages.join(' · ') || tr('ui.beloppen_pa_raderna_gar_inte_ihop')}
            style={{ padding: '9px 18px', background: canReview ? BRAND.green : 'var(--border)', border: 'none', borderRadius: '8px', color: canReview ? 'white' : 'var(--text-muted)', fontSize: '13px', fontWeight: 700, cursor: canReview ? 'pointer' : 'not-allowed' }}
          >
            {initial?.number ? tr('ui.granska_spara') : tr('ui.granska_bokfor')}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(14px, 2vw, 24px)' }}>
      <div className="ver-form-card" style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', padding: 'clamp(16px, 2.2vw, 28px)', maxWidth: '1180px', margin: '0 auto', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Datum / Beskrivning / Serie */}
      <div className="ver-form-row" style={{ marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>{tr('ui.datum')} {ocrFields.has('date') && <OcrBadge />}</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setOcrFields(s => { const n = new Set(s); n.delete('date'); return n; }); }} style={inp} />
        </div>
        <div style={{ flex: 3 }}>
          <label style={fieldLabel}>{tr('ui.beskrivning')} {ocrFields.has('desc') && <OcrBadge />}</label>
          <input data-tour="page-verifications-field" value={desc} onChange={e => { setDesc(e.target.value); setOcrFields(s => { const n = new Set(s); n.delete('desc'); return n; }); }} placeholder={tr('ui.verifikationstext')} style={inp} autoFocus />
        </div>
        <div style={{ width: '90px' }}>
          <label style={fieldLabel}>{tr('ui.serie')}</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={{ ...inp, background: 'var(--bg-card)', textAlign: 'center' }}>
            {['A', 'B', 'C'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {(() => {
        const lockedPeriod = findLockedVatPeriod(date, vatPeriods);
        if (!lockedPeriod) return null;
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', fontSize: '12.5px', color: 'var(--status-amber-text)', lineHeight: 1.5 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{tr('ui.denna_period_ar_redan_momsredovisad_andringar_ha_2')}</span>
          </div>
        );
      })()}

      {/* Räkenskapsår + nästa nummer + valuta, som en informationsrad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '18px', flexWrap: 'wrap' }}>
        <span>{tr('ui.rakenskapsar_2')} <strong style={{ color: 'var(--text-main)' }}>{tr('ui.rakenskapsar')} {(date || '').slice(0, 4) || new Date().getFullYear()}</strong> <strong style={{ color: 'var(--text-main)' }}>{previewNumber}</strong></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {tr('ui.valuta')}
          <select disabled title={tr('ui.bokix_stodjer_i_dagslaget_bara_sek_ingen_valutao')} style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: '999px', fontSize: '12px', color: 'var(--text-main)', background: 'var(--bg-muted)', fontFamily: 'inherit' }}>
            <option>{tr('ui.sek')}</option>
          </select>
        </span>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <label style={fieldLabel}>{tr('ui.intern_anteckning_valfritt')}</label>
        <textarea
          value={internalNote}
          onChange={e => setInternalNote(e.target.value)}
          placeholder={tr('ui.t_ex_anledning_till_bokning_referens_till_mejl_e')}
          rows={2}
          style={{ ...inp, resize: 'vertical', minHeight: '54px', fontFamily: 'inherit' }}
        />
      </div>

      <div className="ver-form-row" style={{ marginBottom: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>{tr('ui.kostnadsstalle')}</label>
          <input value={costCenter} onChange={e => setCostCenter(e.target.value)} placeholder={tr('ui.ange_kostnadsstalle')} style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>{tr('ui.projekt')}</label>
          <ProjectSearch value={projectId} onChange={setProjectId} projects={projects} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>{tr('ui.motpart_2')}</label>
          <PartySearch value={counterpartyId} onChange={setCounterpartyId} contacts={contacts} />
        </div>
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '0', marginBottom: '20px' }}>{tr('ui.galler_alla_rader_utan_egen_markning')}</p>

      {missingCounterparty && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '6px', padding: '8px 12px', marginBottom: '20px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {tr('ui.ett_reskontrakonto_kundfordringar_leverantorssku')}
        </div>
      )}

      {/* Konteringsraderna + underlaget. Klass i stället för inline
          `display:flex` (kundfeedback: "gör det bra i halvskärm också") —
          en inline style kan inte ha en mediafråga, så de två kolumnerna
          satt kvar sida vid sida även i ett fönster där kontorutan blev för
          smal för ett kontonummer. Se .ver-form-grid i index.css. */}
      <div className="ver-form-grid">
        {/* Rows table. Egen vågrät skroll (och en minsta bredd på tabellen)
            i stället för att kolumnerna pressas ihop tills beloppen klipps
            av — kundfeedback om halvskärm: "0,0(" i en 60px bred ruta är
            värre än att behöva skrolla den lilla biten i sidled. Resten av
            sidan skrollar aldrig i sidled, bara den här tabellen. */}
        <div className="ver-form-rows" style={{ minWidth: 0, overflowX: 'auto' }}>
          {ocrFields.has('rows') && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, lineHeight: 1.5 }}>
              <ScanLine size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {tr('ui.rader_ifyllda_automatiskt_fran_underlaget_ocr_ko')}
                {payInfo && (
                  <>
                    {' '}
                    {payInfo.state === 'guess'
                      ? <>{payInfo.source}{tr('ui.sa_betalkonto')} <strong>{payInfo.code} {payInfo.name}</strong> {tr('ui.ar_forvalt_byt_om_det_inte_stammer')}</>
                      : <>{tr('ui.betalkonto')} <strong>{payInfo.code} {payInfo.name}</strong>: {payInfo.source.charAt(0).toLowerCase() + payInfo.source.slice(1)}.</>}
                  </>
                )}
              </span>
            </div>
          )}
          {/* Utländsk valuta — beloppet ÄR omräknat till kronor med en
              riktig, publicerad kurs (convertToSek, ECB-data för
              köpdatumet), inte ett hittepåtal. Kursen och datumet visas
              öppet så det går att kontrollera — bankens egen
              växlingsavgift kan göra att det faktiskt dragna beloppet
              skiljer sig någon procent. Gick kursen inte att hämta byggs
              raderna inte alls, se convertToSek. */}
          {foreignInfo && !foreignInfo.unclear && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {tr('ui.tjanst_fran')} {foreignInfo.region === 'eu' ? tr('ui.ett_annat_eu_land') : tr('ui.ett_land_utanfor_eu')} ({foreignInfo.evidence}{tr('ui.momsen_ska_redovisas_av_dig_omvand_skattskyldigh')} {foreignInfo.region === 'eu' ? '21' : '22'}{tr('ui.n30_och_48_i_momsdeklarationen')}
              </span>
            </div>
          )}
          {foreignInfo && foreignInfo.unclear && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {tr('ui.det_har_ser_ut_som_ett_kop_fran_utlandet_men_vi')}
              </span>
            </div>
          )}
          {mode === 'advanced' && missingReverseRows.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: '200px' }}>{tr('ui.inkop_av_tjanster_fran_utlandet_momsen_ska_redov')} {fmt(missingReverseRows[0].debet)} {tr('ui.kr_2')}</span>
              <button type="button" onClick={addReverseRows} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid currentColor', background: 'transparent', color: 'inherit', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit' }}>{tr('ui.lagg_till_momsraderna')}</button>
            </div>
          )}
          {ocrForeignCurrency && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {ocrForeignCurrency.converted ? (
                <span>
                  {tr('ui.kvittot_var_i')} {ocrForeignCurrency.code} ({CURRENCY_SYMBOL[ocrForeignCurrency.code] || ''}{formatForeignAmount(ocrForeignCurrency.code, ocrForeignCurrency.amount)}{tr('ui.raderna_ar_byggda_med')} {fmt(ocrForeignCurrency.converted.sek)} {tr('ui.kr_omraknat_med_dagskursen')} {ocrForeignCurrency.converted.rate.toFixed(4)} {tr('ui.sek_2')}{ocrForeignCurrency.code}{ocrForeignCurrency.converted.date ? ` (${ocrForeignCurrency.converted.date})` : ''}{tr('ui.kontrollera_mot_kontoutdraget_bankens_vaxlingsav')}
                </span>
              ) : (
                <span>
                  {tr('ui.kvittot_verkar_vara_i')} {ocrForeignCurrency.code} ({CURRENCY_SYMBOL[ocrForeignCurrency.code] || ''}{formatForeignAmount(ocrForeignCurrency.code, ocrForeignCurrency.amount)}{tr('ui.men_kursen_gick_inte_att_hamta_automatiskt_fyll')}
                </span>
              )}
            </div>
          )}
          <div role="tablist" aria-label={tr('ui.satt_att_bokfora')} style={{ display: 'inline-flex', padding: '3px', gap: '2px', border: '1px solid var(--border)', borderRadius: '999px', background: 'var(--bg-muted)', marginBottom: '16px' }}>
            {[['simple', 'Enkelt'], ['advanced', 'Avancerat: debet och kredit']].map(([id, text]) => (
              <button
                key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => changeMode(id)}
                style={{ padding: '6px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, background: mode === id ? 'var(--bg-card)' : 'transparent', color: mode === id ? 'var(--text-main)' : 'var(--text-secondary)', boxShadow: mode === id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}
              >
                {text}
              </button>
            ))}
          </div>
          {mode === 'simple' ? (
            <SimpleBookingPanel fields={simple} setFields={updateSimple} accounts={accounts} orgType={orgType} rows={simpleBuilt.rows} errors={simpleBuilt.errors} vatExempt={vatExempt} />
          ) : (
          <>
          <table className="ver-adv-table" style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ padding: '0 8px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', width: 140 }}>{tr('ui.konto_3')}</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{tr('ui.beskrivning_2')}</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', width: 110 }} title={tr('ui.har_okar_tillgangar_och_kostnader_pengar_in_pa_b')}>{tr('ui.debet_2')}</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', width: 110 }} title={tr('ui.har_okar_skulder_eget_kapital_och_intakter_penga')}>{tr('ui.kredit_2')}</th>
                {/* Ingen SALDO-kolumn. Kontots hela saldo stod tidigare här,
                    i en sifferkolumn intill Debet och Kredit, och lästes
                    därför som radens eget belopp — först trodde en kund att
                    det var verifikationens belopp, och underrubriken "hela
                    kontot" räckte inte. Saldot hör till KONTOT, inte till
                    raden, och står nu under kontonamnet i första kolumnen. */}
                <th style={{ width: 52, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const warning = rowSideWarning(row);
                const currentBalance = row.account ? (balances?.[row.account] || 0) : null;
                const rowSigned = (parseFloat(row.debet) || 0) - (parseFloat(row.kredit) || 0);
                const projectedBalance = currentBalance !== null ? currentBalance + rowSigned : null;
                const hasOverride = row.costCenter || row.projectId;
                const overrideOpen = expandedRows.has(i);
                return (
                <React.Fragment key={i}>
                <tr className="ver-adv-row" style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td className="ver-adv-account" data-label="Konto" style={{ padding: '6px 8px 6px 0' }}>
                    <AccountSearch
                      value={row.account}
                      accounts={accounts}
                      compact
                      onChange={(code, name) => { updateRow(i, 'account', code); updateRow(i, 'accountName', name); }}
                    />
                    {row.account && ((parseFloat(row.debet) || 0) > 0 || (parseFloat(row.kredit) || 0) > 0) && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.35 }}>
                        {describeRow({ account: row.account, accountName: row.accountName, debet: parseFloat(row.debet) || 0, kredit: parseFloat(row.kredit) || 0 }, accounts).text}
                        {/* Vad bokningen gör med KONTOTS saldo. Här, under
                            kontot, går det inte att läsa som radens belopp. */}
                        {projectedBalance !== null && (
                          <div style={{ marginTop: '1px' }}>
                            {tr('ui.kontots_saldo')} {fmt(currentBalance)} {tr('ui.kr_7')} <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmt(projectedBalance)} {tr('ui.kr')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="ver-adv-desc" data-label="Beskrivning" style={{ padding: '6px 8px', color: 'var(--text-main)', fontSize: '13px' }}>
                    <input
                      value={row.desc || ''}
                      onChange={e => updateRow(i, 'desc', e.target.value)}
                      placeholder={tr('ui.radtext')}
                      style={{ ...inp, padding: '9px 12px' }}
                    />
                  </td>
                  <td className="ver-adv-debet" data-label="Debet" style={{ padding: '6px 8px' }}>
                    <input
                      type="number" inputMode="decimal" min="0" value={row.debet}
                      onChange={e => updateRow(i, 'debet', e.target.value)}
                      onBlur={() => handleBlurAmount(i)}
                      onKeyDown={e => { if (e.key === 'Enter') handleBlurAmount(i); }}
                      style={{ ...inp, padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-muted)' }}
                      placeholder="0,00"
                    />
                  </td>
                  <td className="ver-adv-kredit" data-label="Kredit" style={{ padding: '6px 8px' }}>
                    <input
                      type="number" inputMode="decimal" min="0" value={row.kredit}
                      onChange={e => updateRow(i, 'kredit', e.target.value)}
                      onBlur={() => handleBlurAmount(i)}
                      onKeyDown={e => { if (e.key === 'Enter') handleBlurAmount(i); }}
                      style={{ ...inp, padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-muted)' }}
                      placeholder="0,00"
                    />
                  </td>
                  <td className="ver-adv-actions" style={{ padding: '6px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {warning && (
                      <span title={warning} style={{ display: 'inline-flex', color: 'var(--status-amber-text)', cursor: 'help', marginRight: '4px' }}>
                        <AlertCircle size={14} />
                      </span>
                    )}
                    <button onClick={() => toggleRowOverride(i)} title={tr('ui.egen_kostnadsstalle_projekt_for_denna_rad')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: hasOverride || overrideOpen ? 'var(--text-main)' : 'var(--text-muted)', padding: '2px', marginRight: '2px' }}>
                      <Tag size={15} />
                    </button>
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
                {overrideOpen && (
                  <tr>
                    <td colSpan={5} style={{ padding: '2px 8px 12px', background: 'var(--bg-muted)' }}>
                      <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...fieldLabel, marginBottom: '3px' }}>{tr('ui.kostnadsstalle_denna_rad')}</label>
                          <input value={row.costCenter || ''} onChange={e => updateRow(i, 'costCenter', e.target.value)} placeholder={costCenter || tr('ui.arver_fran_verifikationen')} style={{ ...inp, padding: '6px 10px', fontSize: '12.5px' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...fieldLabel, marginBottom: '3px' }}>{tr('ui.projekt_denna_rad')}</label>
                          <ProjectSearch value={row.projectId} onChange={v => updateRow(i, 'projectId', v)} projects={projects} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {/* Summan färgas RÖD bara när det faktiskt finns en obalans att
                  åtgärda. Ett tomt formulär (0 mot 0) är inte ett fel — men
                  visades ändå med två röda nollor, vilket gjorde att varje ny
                  verifikation började med att se trasig ut. */}
              <tr className="ver-adv-sum" style={{ borderTop: '1px solid var(--border)' }}>
                <td colSpan={2} style={{ padding: '12px 8px', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>{tr('ui.summa')}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: hasAmounts && !isBalanced ? 'var(--status-red-text)' : 'var(--text-main)' }}>{fmt(totalDebit)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: hasAmounts && !isBalanced ? 'var(--status-red-text)' : 'var(--text-main)' }}>{fmt(totalCredit)}</td>
                <td colSpan={1} />
              </tr>
              <tr>
                <td colSpan={5} style={{ padding: '0 8px 10px' }}>
                  {hasAmounts && !isBalanced ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-red-text)', background: 'var(--status-red-bg)', borderRadius: '999px', padding: '4px 12px' }}>
                      <AlertCircle size={13} /> {tr('ui.debet_och_kredit_skiljer_sig_med')} {fmt(diff)} {tr('ui.kr_6')} {totalDebit > totalCredit ? tr('ui.lagg_till_kredit') : tr('ui.lagg_till_debet')} {tr('ui.for_att_kunna_bokfora')}
                    </span>
                  ) : hasAmounts ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-green-text)', background: 'var(--status-green-bg)', borderRadius: '999px', padding: '4px 12px' }}>
                      {tr('ui.balanserar_debet_kredit')}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tr('ui.fyll_i_minst_tva_rader_en_debet_och_en_kredit_pa')}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '7px 14px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={13} /> {tr('ui.lagg_till_rad')}
            </button>
            {templates && templates.length > 0 && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '999px', background: 'var(--bg-card)' }}>
                <LayoutTemplate size={13} style={{ position: 'absolute', left: 12, color: 'var(--text-main)', pointerEvents: 'none' }} />
                <select
                  value=""
                  onChange={async e => {
                    const tpl = templates.find(t => t.id === e.target.value);
                    if (!tpl) return;
                    if (rows.some(r => r.account || r.debet || r.kredit)) {
                      if (!(await confirmDialog(tr('ui.ersatt_raderna_i_formularet_med_mallens_rader')))) return;
                    }
                    setDesc(tpl.description || '');
                    setProjectId(tpl.projectId || '');
                    setCostCenter(tpl.costCenter || '');
                    setRows(tpl.rows.map(r => ({ ...r })));
                  }}
                  style={{ padding: '7px 14px 7px 30px', border: 'none', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'inherit', background: 'transparent', appearance: 'none' }}
                >
                  <option value="">{tr('ui.anvand_mall')}</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {onSaveTemplate && (
              <button
                onClick={async () => {
                  const name = await promptDialog('Namn på mallen:', { defaultValue: desc || '', placeholder: tr('ui.t_ex_kontorsmaterial') });
                  if (name && name.trim()) onSaveTemplate({ name: name.trim(), description: desc, projectId, costCenter, rows });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Save size={13} /> {tr('ui.spara_som_mall')}
              </button>
            )}
          </div>
          </>
          )}
        </div>

        {/* Right side: Attachment */}
        <div className="ver-form-attachment" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{tr('ui.underlag')}</div>
            {ocrStatus === 'scanning' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                <ScanLine size={12} style={{ animation: 'spin 1s linear infinite' }} /> {ocrMessage || tr('ui.laser')}
              </span>
            )}
          </div>
          {/* Ett uppladdat underlag visas i SAMMA visare som kvittovyn i
              Utgifter (shared/DocumentViewer.jsx), inte som en tumnagel i
              släppytan. Skillnaden var påtaglig: en 140px hög bild av ett
              kvitto går inte att läsa av, och en PDF fick ingen förhands-
              visning alls. Panelen har samma höjd som den tomma släppytan,
              så spalten är lika hög före och efter en uppladdning — sidan
              hoppar inte när man lägger till eller byter underlag. */}
          <div
            onDragOver={e => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false);
              acceptFile(e.dataTransfer.files?.[0]);
            }}
            style={{ minWidth: 0, borderRadius: '12px', outline: `2px dashed ${dragOver ? 'var(--text-main)' : 'transparent'}`, outlineOffset: '3px', transition: 'outline-color 0.15s' }}
          >
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={e => acceptFile(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg,.webp" />
            {hasAttachment ? (
              <>
                <div style={{ position: 'relative' }}>
                  <DocumentPane
                    className="dv-embed"
                    url={displayAttachmentUrl}
                    type={displayAttachmentType}
                    name={displayAttachmentName}
                  />
                  {ocrStatus === 'scanning' && <ScanOverlay flush detail={ocrMessage} />}
                </div>
                <div className="ver-doc-actions">
                  <button type="button" className="ver-doc-btn" disabled={ocrStatus === 'scanning'} onClick={rerunOcr} style={ocrStatus === 'scanning' ? { cursor: 'not-allowed', opacity: 0.6 } : undefined}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ScanLine size={12} style={{ animation: ocrStatus === 'scanning' ? 'spin 1s linear infinite' : 'none' }} /> {ocrStatus === 'scanning' ? tr('ui.laser') : (Object.keys(revealed).length > 0 ? tr('ui.las_av_igen') : tr('ui.las_av_underlaget'))}</span>
                  </button>
                  <button type="button" className="ver-doc-btn" onClick={() => setShowAttachmentLightbox(true)}>{tr('ui.visa_i_fullstorlek')}</button>
                  <button type="button" className="ver-doc-btn" onClick={() => fileInputRef.current?.click()}>{tr('ui.byt_fil')}</button>
                  <button type="button" className="ver-doc-btn ver-doc-btn-muted" onClick={() => { setAttachment(null); setExistingAttachment(null); }}>{tr('ui.ta_bort')}</button>
                </div>
                {(ocrStatus === 'scanning' || revealing || Object.keys(revealed).length > 0) && (
                  <OcrChecklist scanning={ocrStatus === 'scanning'} revealed={revealed} items={VER_OCR_ITEMS} />
                )}
                {!revealing && accountSuggestion && (
                  <div className="rc-verify rc-verify-suggest">
                    <span>{tr('ui.forslag_pa_konto')} <strong>{accountSuggestion} {accounts.find(a => a.code === accountSuggestion)?.name || ''}</strong></span>
                    <button type="button" className="rc-link" onClick={applyAccountSuggestion}>{tr('ui.anvand')}</button>
                  </div>
                )}
                {!revealing && notReceipt && (
                  <div className="rc-verify rc-verify-warn">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    {unreadable ? (
                      <span>{tr('ui.bilden_gick_inte_att_lasa_av_sa_inget_har_fyllts')} {photoHintText(photoHint) || tr('ui.ta_om_fotot_narmre_rakare_och_med_battre_ljus_el')}</span>
                    ) : (
                      <span>{tr('ui.det_har_ser_inte_ut_som_ett_kvitto_eller_en_fakt_2')}</span>
                    )}
                  </div>
                )}
                {/* Bilden satte gränsen för avläsningen: säg vad som är fel med
                    den. Visas bara när ett fält faktiskt blev osäkert. */}
                {!revealing && !notReceipt && photoHint && (
                  <div className="rc-verify rc-verify-warn">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{photoHintText(photoHint)} {tr('ui.las_av_igen_med_den_nya_bilden_eller_fyll_i_rade')}</span>
                  </div>
                )}
                {!revealing && ocrVat && ocrVat.amountVerified && !ocrVat.verified && (
                  <div className="rc-verify rc-verify-ok">
                    <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                    <span>{tr('ui.beloppet_stammer_netto_plus_moms_pa_fakturan_bli')}</span>
                  </div>
                )}
                {/* Retur eller kreditnota: pengarna går åt andra hållet. */}
                {!revealing && ocrVat && ocrVat.creditNote && (
                  <div className="rc-verify rc-verify-warn">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{tr('ui.underlaget_ser_ut_som_en_retur_eller_en_kreditno')}</span>
                  </div>
                )}
                {/* Flera momssatser på samma underlag: momsen är avläst men är
                    inte EN sats. Här går det att lösa — en rad per sats. */}
                {!revealing && ocrVat && ocrVat.rates && (
                  <div className="rc-verify rc-verify-warn">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{tr('ui.underlaget_har_moms_i_flera_satser')}{ocrVat.rates.map(r => `${r} %`).join(' och ')}{tr('ui.tillsammans')} {fmt(ocrVat.vatAmount)} {tr('ui.kr_momsen_ar_ifylld_med_det_beloppet_sa_den_blir')}</span>
                  </div>
                )}
                {!revealing && ocrVat && ocrVat.verified && (
                  <div className="rc-verify rc-verify-ok">
                    <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                    <span>{tr('ui.momsen_stammer_mot_beloppen_pa_underlaget')}{fmt(ocrVat.vatAmount)} {tr('ui.kr_moms')}</span>
                  </div>
                )}
                {!revealing && ocrVat && ocrVat.mismatch && (
                  <div className="rc-verify rc-verify-warn">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{tr('ui.momsbeloppet_pa_underlaget')}{fmt(ocrVat.vatAmount)} {tr('ui.kr_stammer_inte_mot_nagon_momssats_for_det_belop')}</span>
                  </div>
                )}
              </>
            ) : (
              <div
                className="ver-drop" onClick={() => fileInputRef.current?.click()}
                style={{ border: `1px dashed ${dragOver ? 'var(--text-main)' : 'var(--border)'}`, borderRadius: '12px', background: dragOver ? 'var(--bg-muted)' : 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', height: 'clamp(320px, 44vh, 560px)', boxSizing: 'border-box' }}
              >
                <UploadCloud size={26} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{tr('ui.dra_och_slapp_kvittot_har')}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '260px' }}>{tr('ui.pdf_eller_bild_max')} {MAX_ATTACHMENT_MB} {tr('ui.mb_vi_laser_av_datum_belopp_och_konto_automatisk')}</span>
              </div>
            )}
          </div>
          {fileError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: 'var(--status-red-text)' }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> {fileError}
            </div>
          )}
          {ocrStatus === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: BRAND.amberText, background: BRAND.amberBg, borderRadius: '8px', padding: '6px 10px' }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> {tr('ui.kunde_inte_lasa_av_kvittot_automatiskt_fyll_i_ra')}
            </div>
          )}
          {attachmentBusy && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>{tr('ui.laddar_upp_underlag')}</div>
          )}
          {attachmentError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: 'var(--status-red-text)' }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> {attachmentError}
            </div>
          )}
          {!hasAttachment && (
            <div style={{ marginTop: '12px' }} onClick={e => e.stopPropagation()}>
              <label style={labelStyle}>{tr('ui.var_forvaras_originalet')}</label>
              <input
                value={originalLocation}
                onChange={e => setOriginalLocation(e.target.value)}
                placeholder={tr('ui.t_ex_parm_2026_nr_14_eller_e_post_2026_08_12')}
                style={inp}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>{tr('ui.frivilligt_men_bra_att_fylla_i_nar_inget_underla')}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={async () => {
              if (!(await confirmDialog(tr('ui.rensa_formularet_ifylld_information_forsvinner')))) return;
              setDesc(''); setProjectId(''); setCostCenter(''); setInternalNote('');
              setCounterpartyId(''); setOriginalLocation(''); setAttachment(null); setExistingAttachment(null);
              setSimple(emptySimple());
              setRows([
                { account: '', accountName: '', debet: '', kredit: '', desc: '' },
                { account: '', accountName: '', debet: '', kredit: '', desc: '' },
              ]);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 14px', background: 'none', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', marginRight: 'auto' }}
          ><RefreshCw size={13} /> {tr('ui.rensa')}</button>
          {/* Spara-knapparna satt tidigare BÅDE här och i rubrikraden. Nu
              bara i rubrikraden, som är sticky och därmed alltid nåbar —
              samma sak två gånger på samma sida är precis den sortens
              onödiga täthet kundfeedbacken gällde ("gör det luftigare"). */}
          {validationMessages.length > 0 && (
            <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {validationMessages.map(m => (
                <div key={m}>{m}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
      </div>

      {/* ── Underlag i fullstorlek ──────────────────────────────────
          Samma visare som kvittovyn i Utgifter (shared/DocumentViewer.jsx):
          zoom för fotade underlag och PDF:er renderade inline. Låg tidigare
          som en naken <img> här, vilket betydde att ett PDF-underlag inte
          gick att förhandsvisa alls — det hade bara en "Visa PDF"-länk till
          en ny flik. ── */}
      {showAttachmentLightbox && displayAttachmentUrl && (
        <DocumentLightbox
          url={displayAttachmentUrl}
          type={displayAttachmentType}
          name={displayAttachmentName}
          onClose={() => setShowAttachmentLightbox(false)}
        />
      )}

      {/* ── Granska innan bokföring ─────────────────────────────── */}
      {showReview && (
        <div onClick={() => setShowReview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>{tr('ui.granska_verifikation')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>{date} {tr('ui.serie_2')} {series} · {desc || tr('ui.ingen_beskrivning')}</p>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              {describeVerification(rows.filter(r => r.account).map(r => ({ ...r, debet: parseFloat(r.debet) || 0, kredit: parseFloat(r.kredit) || 0 })), accounts).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '8px 12px', fontSize: '13px', borderBottom: '1px solid var(--border-light)' }}>
                  <span><strong style={{ color: 'var(--text-main)' }}>{p.account}</strong> {p.text}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{fmt(p.amount)} {tr('ui.kr')}</span>
                </div>
              ))}
              {missingCounterparty && (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--status-amber-text)', background: 'var(--status-amber-bg)' }}>{tr('ui.observera_reskontrakonto_utan_motpart')}</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowReview(false)} style={{ padding: '9px 16px', background: 'var(--bg-card)', border: '1px solid var(--text-muted)', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>{tr('ui.tillbaka_och_andra')}</button>
              <button onClick={() => { handleSave('booked'); setShowReview(false); }} style={{ padding: '9px 20px', background: '#16a34a', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                {initial?.number ? tr('ui.spara_andringar') : tr('ui.bokfor_2')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Bokföring Component ──────────────────────────────────────────────────
export default function Bokforing({ verifications = [], accounts = [], balances = {}, contacts = [], projects = [], templates = [], onSaveTemplate, onAdd, setVerifications, setAccounts, highlightVerificationId, onClearHighlight, vatPeriods, user, orgType, uploadFn = uploadFileToStorage, initialTab, vatExempt = false, extraTabs = [] }) {
  const [activeTab, setActiveTab] = useState(() => (initialTab && ['verifications', 'accounts', ...extraTabs.map(tab => tab.id)].includes(initialTab) ? initialTab : 'verifications'));
  // Samma mönster som Taxes.jsx:s initialSection — App.jsx:s
  // verificationsInitialTab (profilmenyns "Kontoplaner" ska landa på
  // Kontoplan-fliken här, inte Verifikationer, se dess egen kommentar)
  // ändras efter att den här komponenten redan monterats en gång, så
  // bara useState:s förvalsvärde ovan räcker inte.
  // En flik som inte finns här (t.ex. Periodiseringar för ett UF-företag,
  // som saknar den) visar Verifikationer i stället för en tom sida.
  const knownTab = (id) => ['verifications', 'accounts', ...extraTabs.map(tab => tab.id)].includes(id);
  useEffect(() => {
    if (initialTab) setActiveTab(knownTab(initialTab) ? initialTab : 'verifications');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  const [expandedId, setExpandedId] = useState(null);
  const [openDocument, setOpenDocument] = useState(null); // underlag i fullstorlek från listan
  const [showForm, setShowForm] = useState(false);
  const [editingVer, setEditingVer] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [series, setSeries] = useState('all');
  // "Visa N"-väljaren (kundönskemål: samma väljare, som faktiskt
  // fungerar, på alla listsidor). ListFilterBar ritar den, sidan äger
  // state:t och skär av sin egen lista — se den komponentens JSDoc.
  const [pageSize, setPageSize] = useState(30);
  // Månadsgruppering (samma mönster/namn som Kvitton, Expenses.jsx): 'all'
  // grupperar kronologiskt (September 2026, Augusti 2026, …), en specifik
  // månad ('01'-'12') visar bara DEN kalendermånaden från alla år,
  // grupperat per år istället. flatView slår av rubrikerna helt.
  const [monthFilter, setMonthFilter] = useState('all');
  const [flatView, setFlatView] = useState(false);

  // Kontoplan-fliken är nu en helt självständig komponent (shared/
  // AccountsPanel.jsx, delad med Inställningar > System > Kontoplan) med
  // sin egen interna state — inget kvar att deklarera här.

  // Varje serie (A/B/C) har sin egen löpande, oberoende nummerserie —
  // src/utils/verificationNumbering.js (delad med Inställningar > System >
  // Verifikationsserier, som visar/validerar samma nummer). Lokal closure
  // med samma (seriesLetter)-signatur som förut, så VerificationForm-propen
  // längre ner inte behöver ändras.
  const getNextNumber = (seriesLetter = 'A') => getNextNumberForSeries(verifications, seriesLetter);
  const nextNumber = getNextNumber('A');

  // Hoppa direkt till en specifik verifikation — används av Momsdeklarationens
  // Steg 1 för att låta felposter i valideringslistan vara klickbara.
  useEffect(() => {
    if (!highlightVerificationId) return;
    setActiveTab('verifications');
    setSearchInput(''); setDateFrom(''); setDateTo(''); setSeries('all');
    setExpandedId(highlightVerificationId);
    const t = setTimeout(() => {
      document.getElementById(`ver-row-${highlightVerificationId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onClearHighlight?.();
    }, 80);
    return () => clearTimeout(t);
  }, [highlightVerificationId]); // eslint-disable-line

  const handleSaveVerification = (data) => {
    // Fortsätter man ett sparat utkast, behåller det sitt redan tilldelade
    // nummer. En ny verifikation eller en rättelse får ett nytt, i rätt serie.
    const number = editingVer?.number || getNextNumber(data.series || 'A');
    onAdd({ number, ...data });
    setShowForm(false);
    setEditingVer(null);
  };

  // Kundönskemål: utkast (status: 'draft') gick bara att fortsätta redigera,
  // aldrig ta bort — till skillnad från t.ex. fakturautkast (Invoices.jsx),
  // som redan har en riktig "Ta bort utkastet"-knapp. Ett utkast har ingen
  // verklig bokföringspåverkan än (till skillnad från en BOKFÖRD
  // verifikation, som aldrig raderas — bara rättas, se Rätta-knappen), så
  // en hård radering är säker här.
  const handleDeleteDraft = async (v) => {
    if (!(await confirmDialog(tr('ui.ta_bort_utkastet_det_gar_inte_att_angra_2', { number: v.number }), { title: tr('ui.ta_bort_utkast'), confirmLabel: tr('ui.ta_bort'), danger: true }))) return;
    setVerifications?.(prev => prev.filter(x => x.id !== v.id));
  };

  // Filter verifications
  const filteredVers = verifications.filter(v => {
    if (search) {
      const s = search.toLowerCase();
      // Sökfältets placeholder lovar "Sök verifikation, text, belopp..." —
      // beloppet måste faktiskt vara med i matchningen, inte bara nummer/text.
      const amountStr = (v.rows?.reduce((sum, r) => sum + getDebet(r), 0) || v.amount || 0).toString();
      const matchesNumber = v.number?.toLowerCase().includes(s);
      const matchesDesc = v.description?.toLowerCase().includes(s);
      const matchesAmount = amountStr.includes(s.replace(',', '.'));
      if (!matchesNumber && !matchesDesc && !matchesAmount) return false;
    }
    if (dateFrom && v.date < dateFrom) return false;
    if (dateTo && v.date > dateTo) return false;
    if (series !== 'all' && !v.number?.startsWith(series)) return false;
    if (monthFilter !== 'all' && (v.date || '').slice(5, 7) !== monthFilter) return false;
    return true;
  })
    // Nyast överst, RIKTIGT datumsorterat (inte bara listans egen
    // lagringsordning omvänd) — krävs för att månadsgrupperingen nedan ska
    // få samma månad i följd. Nummer som andra sorteringsnyckel: två
    // verifikationer med samma datum (vanligt, en rättelse bokförs ofta
    // samma dag som originalet) håller då ändå en stabil, förutsägbar
    // ordning i stället för att hoppa om vid varje omrendering.
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.number || '').localeCompare(a.number || ''));

  const visibleVers = pageSize === 'all' ? filteredVers : filteredVers.slice(0, pageSize);

  // Är ett specifikt kalendermånadsfilter aktivt grupperas det som
  // återstår per ÅR istället (månaden är redan bestämd) — samma resonemang
  // som Kvittons Expenses.jsx. flatView returnerar alltid null: ListTable
  // skjuter då aldrig in någon rubrikrad alls, samma mekanik som "ingen
  // grupp" — inget särskilt specialfall behövs för det.
  const groupByYear = monthFilter !== 'all';
  const verGroupKey = (v) => {
    if (flatView) return null;
    return groupByYear ? ((v.date || '').slice(0, 4) || tr('ui.okant')) : ((v.date || '').slice(0, 7) || tr('ui.okant'));
  };
  const renderVerGroupHeader = (key, rowsInGroup) => {
    const label = key === 'okänt' ? tr('ui.utan_datum') : (groupByYear ? key : formatMonthLabel(key));
    const total = rowsInGroup.reduce((s, v) => s + (v.rows?.reduce((rs, r) => rs + getDebet(r), 0) || v.amount || 0), 0);
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-main)' }}>{label}</span>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {rowsInGroup.length} {rowsInGroup.length === 1 ? tr('ui.verifikation_3') : tr('ui.verifikationer')} · {fmtSEK(total)}
        </span>
      </div>
    );
  };

  // Kontoplan-logiken (gruppering, lägg till/inaktivera/aktivera konto)
  // flyttad till shared/AccountsPanel.jsx — se dess kommentar.

  // Verifikationsformuläret är en EGEN sida, inte ett kort ovanpå listan
  // (kundfeedback, se VerificationForm:s egen kommentar). Tidig retur enligt
  // exakt samma mönster som Invoices.jsx redan använder för fakturor: listan,
  // filterraden och flikarna monteras inte alls medan man konterar.
  if (showForm) {
    return (
      <VerificationForm
        // Samma resonemang som InvoiceForm i Invoices.jsx: utan en key som
        // ändras med VILKEN verifikation som redigeras/rättas, återanvänder
        // React samma instans och dess interna useState (rader, underlag,
        // m.m.) nollställs aldrig om man klickar "Fortsätt"/"Rätta" på en
        // annan rad medan formuläret redan är öppet.
        key={editingVer?.id ?? 'new'}
        accounts={accounts}
        contacts={contacts}
        projects={projects}
        verifications={verifications}
        balances={balances}
        templates={templates}
        onSaveTemplate={onSaveTemplate}
        nextNumber={nextNumber}
        getNextNumber={getNextNumber}
        initial={editingVer}
        onSave={handleSaveVerification}
        onClose={() => { setShowForm(false); setEditingVer(null); }}
        vatPeriods={vatPeriods}
        user={user}
        orgType={orgType}
        uploadFn={uploadFn}
        vatExempt={vatExempt}
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>

      {/* ── Top section: title + tabs ─────────────────────────── */}
      <ListPageHeader
        title={tr('ui.bokforing')}
        subtitle={tr('ui.verifikationer_kontoplan_och_bokforingsposter')}
        actions={
          activeTab === 'verifications' ? [
            { key: 'next', type: 'note', label: tr('ui.nasta'), value: nextNumber },
            { key: 'new-ver', label: tr('ui.ny_verifikation'), icon: Plus, onClick: () => { setEditingVer(null); setShowForm(true); }, variant: 'primary', dataTour: 'page-verifications-cta' },
          ] : []
          // Kontoplan-fliken har sin egen "Nytt konto"-knapp i AccountsPanel
          // (shared/AccountsPanel.jsx) numera, inte längre i sidhuvudet här.
        }
        tabs={{
          items: [{ id: 'verifications', label: tr('ui.verifikationer_2') }, { id: 'accounts', label: tr('ui.kontoplan_2') }, ...extraTabs.map(({ id, label }) => ({ id, label }))],
          activeId: activeTab,
          onChange: setActiveTab,
        }}
      />

      {/* ── VERIFIKATIONER TAB ───────────────────────────────────── */}
      {activeTab === 'verifications' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Filterrad — facit-mönstret (Sida 43, uppföljning): alla fält
              på en rad i samma h-9-höjd, "Rensa" + levande antalsräknare
              på en egen rad direkt under. */}
          <ListFilterBar
            onClear={() => { setSearchInput(''); setDateFrom(''); setDateTo(''); setSeries('all'); setMonthFilter('all'); }}
            count={filteredVers.length}
            countLabel={tr('ui.verifikationer')}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            activeFilters={(dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (series !== 'all' ? 1 : 0) + (monthFilter !== 'all' ? 1 : 0)}
          >
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder={tr('ui.sok_verifikation_text_belopp')} style={{ ...listSearchInputStyle, width: '240px' }} />
            </div>
            <div className="lfb-daterange">
              <DateField value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder={tr('ui.fran_datum')} style={listFilterFieldStyle} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>–</span>
              <DateField value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder={tr('ui.till_datum')} style={listFilterFieldStyle} />
            </div>
            <select value={series} onChange={e => setSeries(e.target.value)} style={listFilterFieldStyle}>
              <option value="all">{tr('ui.alla_serier')}</option>
              <option value="A">{tr('ui.serie_a')}</option>
              <option value="B">{tr('ui.serie_b')}</option>
              <option value="C">{tr('ui.serie_c')}</option>
            </select>
            {/* Kundönskemål ("samma som i Kvitton, jag älskar det"): samma
                månadsväljare + Grupperat/Lista-växel som Expenses.jsx,
                återanvänder samma .rc-segmented-utseende (index.css) så
                kontrollen ser likadan ut var den än dyker upp i appen. */}
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={listFilterFieldStyle}>
              <option value="all">{tr('ui.alla_manader')}</option>
              {MONTH_NAMES.map(m => <option key={m.v} value={m.v}>{m.label} {tr('ui.alla_ar')}</option>)}
            </select>
            <div className="rc-segmented">
              <button type="button" onClick={() => setFlatView(false)} className={!flatView ? 'active' : ''}>{tr('ui.grupperat')}</button>
              <button type="button" onClick={() => setFlatView(true)} className={flatView ? 'active' : ''}>{tr('ui.lista')}</button>
            </div>
          </ListFilterBar>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {visibleVers.length === 0 ? (
              // Samma tomt-läge-mönster som Bank/Offerter/Kontakter (facit):
              // samma kortram som tabellen nedan (flush mot filterraden,
              // rundat bara nedtill), rundad kvadrat-ikon i mörk
              // varumärkesgrön, och en egen "Ny verifikation"-knapp — bara
              // när listan är HELT tom, inte när ett filter bara råkar
              // träffa noll rader.
              <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
                    background: verifications.length === 0 ? 'var(--bg-muted)' : 'var(--gray-100)',
                    color: verifications.length === 0 ? BRAND.green : 'var(--text-muted)',
                  }}>
                    <BookOpen size={30} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-main)' }}>
                    {verifications.length === 0 ? tr('ui.inga_verifikationer_bokforda') : tr('ui.inga_verifikationer_matchar_filtret')}
                  </h3>
                  {verifications.length === 0 ? (
                    <>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px', margin: '0 0 24px' }}>
                        {tr('ui.verifikationer_bokfors_automatiskt_fran_kvitton')}
                      </p>
                      <button
                        onClick={() => { setEditingVer(null); setShowForm(true); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        <Plus size={15} /> {tr('ui.ny_verifikation')}
                      </button>
                    </>
                  ) : (
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px', margin: 0 }}>{tr('ui.prova_att_rensa_sokningen_eller_filtren_ovan')}</p>
                  )}
                </div>
              </div>
            ) : (
            <ListTable
              rowKey={v => v.id}
              onRowClick={v => setExpandedId(expandedId === v.id ? null : v.id)}
              isExpanded={v => expandedId === v.id}
              emptyMessage={tr('ui.inga_verifikationer_bokforda')}
              rows={visibleVers}
              groupBy={verGroupKey}
              renderGroupHeader={renderVerGroupHeader}
              columns={[
                {
                  key: 'number', label: tr('ui.verifikation'), fontWeight: 700, color: 'var(--text-main)', render: v => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} id={`ver-row-${v.id}`}>
                      {expandedId === v.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {v.number}
                    </div>
                  ),
                },
                { key: 'date', label: tr('ui.datum'), render: v => v.date },
                { key: 'description', label: tr('ui.beskrivning'), color: 'var(--text-main)', wrap: true, render: v => v.description },
                {
                  key: 'amount', label: tr('ui.belopp'), align: 'right', fontWeight: 600, color: 'var(--text-main)',
                  render: v => fmt(v.rows?.reduce((s, r) => s + getDebet(r), 0) || v.amount || 0),
                },
                {
                  key: 'status', label: tr('ui.status'), align: 'center', render: v => {
                    const isDraft = (v.status || 'booked') === 'draft';
                    return isDraft ? (
                      <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)' }}>{tr('ui.utkast')}</span>
                    ) : (
                      <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'var(--status-green-bg)', color: 'var(--status-green-text)' }}>{tr('ui.bokford')}</span>
                    );
                  },
                },
                {
                  key: 'actions', label: '', render: v => {
                    const isDraft = (v.status || 'booked') === 'draft';
                    return (
                      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {isDraft ? (
                          <>
                            <button
                              onClick={() => { setEditingVer(v); setShowForm(true); }}
                              title={tr('ui.fortsatt_redigera_utkastet')}
                              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              {tr('ui.fortsatt')}
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(v)}
                              title={tr('ui.ta_bort_utkastet')}
                              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: 'var(--status-red-text)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              const newRows = v.rows ? v.rows.map(r => ({ ...r, accountName: r.accountName || '', debet: getKredit(r) || 0, kredit: getDebet(r) || 0 })) : [];
                              setEditingVer({ ...v, description: `Rätta: ${v.number} – ${v.description}`, rows: newRows, number: undefined, status: 'booked', createdAt: undefined });
                              setShowForm(true);
                            }}
                            title={tr('ui.skapa_rattelseverifikation')}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <RotateCcw size={11} /> {tr('ui.ratta')}
                          </button>
                        )}
                      </div>
                    );
                  },
                },
              ]}
              renderExpanded={v => !v.rows ? null : (
                <div style={{ padding: '10px 8px 12px 32px' }}>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '4px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    <span>{tr('ui.motpart')} <strong style={{ color: 'var(--text-main)' }}>{contacts.find(c => c.id === v.counterpartyId)?.name || '—'}</strong></span>
                    <span>{tr('ui.upprattad')} <strong style={{ color: 'var(--text-main)' }}>{v.createdAt ? new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v.createdAt)) : '—'}</strong></span>
                    {v.originalLocation && <span>{tr('ui.original_forvaras')} <strong style={{ color: 'var(--text-main)' }}>{v.originalLocation}</strong></span>}
                  </div>
                  {/* Underlaget syntes tidigare bara inne i formuläret, så en
                      bokförd verifikation (och underlag kopplade i efterhand
                      till en SIE-import) gick inte att se alls. */}
                  {(v.attachmentUrl || v.extraAttachments?.length > 0) && (
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 2px' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{tr('ui.underlag_2')}</span>
                      {[v.attachmentUrl && { url: v.attachmentUrl, name: v.attachmentName, type: v.attachmentType }, ...(v.extraAttachments || [])].filter(Boolean).map((doc, di) => (
                        <button
                          key={doc.url} type="button" onClick={() => setOpenDocument(doc)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '220px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', padding: '3px 10px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'inherit' }}
                        >
                          <Paperclip size={11} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name || tr('ui.underlag_3', { v0: di + 1 })}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* overflow-x:auto (mobil): 4 kolumner i 311px (efter
                      32px vänsterindrag) — sidledes skroll på just denna
                      underliggande detaljtabell istället för en kortlist-
                      omgörning, som vore overkill för en sällan uppfälld panel. */}
                  <div style={{ margin: '10px 0 4px', maxWidth: '560px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>{tr('ui.sa_har_bokfordes_det')}</div>
                    {describeVerification(v.rows.map(r => ({ ...r, debet: getDebet(r), kredit: getKredit(r) })), accounts).map((p, pi) => (
                      <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12.5px', padding: '2px 0', color: 'var(--text-main)' }}>
                        <span><span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{p.account}</span>{p.text}</span>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.amount)} {tr('ui.kr')}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', margin: '8px 0' }}>
                      <thead>
                        <tr>
                          {['Konto', 'Kontonamn', 'Debet', 'Kredit'].map(h => (
                            <th key={h} style={{ padding: '4px 8px', textAlign: h === 'Debet' || h === 'Kredit' ? 'right' : 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {v.rows.map((r, ri) => {
                          const rd = getDebet(r), rk = getKredit(r);
                          return (
                          <tr key={ri} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '5px 8px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{r.account}</td>
                            <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {accounts.find(a => a.code === r.account)?.name || r.accountName || '—'}
                              {r.desc && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.desc}</div>}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: rd > 0 ? 'var(--status-green-text)' : 'var(--border)', fontWeight: rd > 0 ? 600 : 400, whiteSpace: 'nowrap' }}>
                              {rd > 0 ? fmt(rd) : '—'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: rk > 0 ? 'var(--status-red-text)' : 'var(--border)', fontWeight: rk > 0 ? 600 : 400, whiteSpace: 'nowrap' }}>
                              {rk > 0 ? fmt(rk) : '—'}
                            </td>
                          </tr>
                          );
                        })}
                        <tr style={{ background: 'var(--status-green-bg)', borderTop: '1px solid var(--status-green-bg)' }}>
                          <td colSpan={2} style={{ padding: '5px 8px', fontWeight: 700, fontSize: '12px', color: 'var(--status-green-text)', whiteSpace: 'nowrap' }}>{tr('ui.summa')}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(v.rows.reduce((s, r) => s + getDebet(r), 0))}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(v.rows.reduce((s, r) => s + getKredit(r), 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {/* Samma Fortsätt/Ta bort/Rätta-knappar som radens egen
                      'actions'-kolumn ovan (oförändrad, fortsatt synlig på
                      desktop) — dubblerade hit så de fortfarande går att nå
                      i listradsläget på mobil (ListTable `mobileList`, se
                      dess JSDoc), som inte har en egen åtgärdskolumn.
                      Ofarligt att visa på båda ställena samtidigt: samma
                      handlers, ingen egen state. */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {(v.status || 'booked') === 'draft' ? (
                      <>
                        <button
                          onClick={() => { setEditingVer(v); setShowForm(true); }}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '11.5px', color: 'var(--text-secondary)' }}
                        >
                          {tr('ui.fortsatt')}
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(v)}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '11.5px', color: 'var(--status-red-text)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={11} /> {tr('ui.ta_bort')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          const newRows = v.rows ? v.rows.map(r => ({ ...r, accountName: r.accountName || '', debet: getKredit(r) || 0, kredit: getDebet(r) || 0 })) : [];
                          setEditingVer({ ...v, description: `Rätta: ${v.number} – ${v.description}`, rows: newRows, number: undefined, status: 'booked', createdAt: undefined });
                          setShowForm(true);
                        }}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RotateCcw size={11} /> {tr('ui.ratta')}
                      </button>
                    )}
                  </div>
                </div>
              )}
              mobileList={v => {
                const isDraft = (v.status || 'booked') === 'draft';
                const total = fmt(v.rows?.reduce((s, r) => s + getDebet(r), 0) || v.amount || 0);
                return {
                  dot: isDraft ? 'var(--status-amber-text)' : 'var(--status-green-text)',
                  // Utan beskrivning stod det bara '—' överst på raden på
                  // mobilen; verifikationsnumret bär identiteten i stället.
                  primary: v.description || tr('ui.verifikation_2', { number: v.number }),
                  amount: total,
                  meta: `${v.number} · ${v.date}`,
                  pill: (
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700, background: isDraft ? 'var(--status-amber-bg)' : 'var(--status-green-bg)', color: isDraft ? 'var(--status-amber-text)' : 'var(--status-green-text)' }}>
                      {isDraft ? tr('ui.utkast') : tr('ui.bokford')}
                    </span>
                  ),
                };
              }}
            />
            )}
          </div>
        </div>
      )}

      {openDocument && (
        <DocumentLightbox url={openDocument.url} type={openDocument.type} name={openDocument.name} onClose={() => setOpenDocument(null)} />
      )}

      {/* -- KONTOPLAN TAB -------------------------------------------- */}
      {/* Sjalvstandig, delad komponent (shared/AccountsPanel.jsx) - samma
          vy ateranvands oforandrad i Installningar > System > Kontoplan. */}
      {activeTab === 'accounts' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 20px' }}>
          <AccountsPanel accounts={accounts} balances={balances} verifications={verifications} setAccounts={setAccounts} fmt={fmt} />
        </div>
      )}

      {/* Periodiseringar och Anläggningstillgångar (App.jsx:s extraTabs). Låg
          tidigare under Skatt och bokslut, men hör till den löpande bokföringen. */}
      {extraTabs.map(tab => activeTab === tab.id && (
        <div key={tab.id} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{tab.content}</div>
      ))}
    </div>
  );
}
