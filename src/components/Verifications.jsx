import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, ChevronRight, ChevronDown, X,
  AlertCircle, RotateCcw, RefreshCw,
  UploadCloud, Tag, LayoutTemplate, Save, Trash2, ScanLine, Lock,
} from 'lucide-react';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { BRAND } from '../utils/brandColors';
import { accountMatches } from '../utils/accountSearch';
import { PartySearch, ProjectSearch, AccountSearch } from './shared/SearchInputs';
import ListPageHeader, { ListFilterBar, listSearchInputStyle, listFilterFieldStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { findLockedVatPeriod } from '../utils/vatCalculation';
import { DocumentPane, DocumentLightbox } from './shared/DocumentViewer';
import { uploadFileToStorage, deleteFileFromStorage } from '../utils/fileUpload';
import { confirmDialog, promptDialog } from './shared/ConfirmDialog';
import { ocrFile, parseReceiptText } from '../utils/ocrReceipt';
import { convertToSek } from '../utils/currencyConversion';
import { ToggleSwitch } from './Settings';

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
      <ScanLine size={10} /> OCR
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
  const label = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(new Date(y, (m || 1) - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const MONTH_NAMES = [
  { v: '01', label: 'Januari' }, { v: '02', label: 'Februari' }, { v: '03', label: 'Mars' },
  { v: '04', label: 'April' }, { v: '05', label: 'Maj' }, { v: '06', label: 'Juni' },
  { v: '07', label: 'Juli' }, { v: '08', label: 'Augusti' }, { v: '09', label: 'September' },
  { v: '10', label: 'Oktober' }, { v: '11', label: 'November' }, { v: '12', label: 'December' },
];

// ─── BAS Account reference ────────────────────────────────────────────────────
const BAS_GROUPS = [
  { range: [1000, 1999], label: '1000–1999 Tillgångar', code: '1' },
  { range: [2000, 2999], label: '2000–2999 Eget kapital och skulder', code: '2' },
  { range: [3000, 3999], label: '3000–3999 Intäkter', code: '3' },
  { range: [4000, 4999], label: '4000–4999 Kostnader, varuinköp', code: '4' },
  { range: [5000, 5999], label: '5000–5999 Övriga externa kostnader', code: '5' },
  { range: [6000, 6999], label: '6000–6999 Övriga externa kostnader', code: '6' },
  { range: [7000, 7999], label: '7000–7999 Personalkostnader', code: '7' },
  { range: [8000, 8999], label: '8000–8999 Finansiella poster och skatt', code: '8' },
];

function getGroup(code) {
  const n = parseInt(code, 10);
  return BAS_GROUPS.find(g => n >= g.range[0] && n <= g.range[1]);
}

// ─── De fyra kontoklasserna (verksamt.se) ──────────────────────────────────────
// Tillgångar (1) och Kostnader (4–8) ökar normalt i debet.
// Skulder inkl. eget kapital (2) och Intäkter (3) ökar normalt i kredit.
// Rättelser går giltigt åt andra hållet — därför är detta en varning, aldrig en spärr.
function getAccountClass(code) {
  const n = parseInt(code, 10);
  if (isNaN(n)) return null;
  if (n >= 1000 && n <= 1999) return { key: 'tillgang', label: 'tillgång', normalSide: 'debet' };
  if (n >= 2000 && n <= 2999) return { key: 'skuld_ek', label: 'skuld/eget kapital', normalSide: 'kredit' };
  if (n >= 3000 && n <= 3999) return { key: 'intakt', label: 'intäkt', normalSide: 'kredit' };
  if (n >= 4000 && n <= 8999) return { key: 'kostnad', label: 'kostnad', normalSide: 'debet' };
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
  if (!cls) return null;
  const debit = parseFloat(row.debet) || 0;
  const credit = parseFloat(row.kredit) || 0;
  if (debit <= 0 && credit <= 0) return null;
  const bookedSide = debit > 0 ? 'debet' : 'kredit';
  if (bookedSide === cls.normalSide) return null;
  return `Ovanligt: en ${cls.label} ökar normalt i ${cls.normalSide}. Det här är okej vid en rättelse — annars, dubbelkolla kontot.`;
}

// PartySearch/ProjectSearch/AccountSearch delas nu från ./shared/SearchInputs
// så samma combobox återanvänds i Kontakter (standardkonto för leverantörer).

// ─── Verification Form (inline full-screen) ───────────────────────────────────
const MAX_ATTACHMENT_MB = 10;
const ACCEPTED_ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function VerificationForm({ accounts, contacts, projects = [], balances, templates, onSaveTemplate, onSave, onClose, nextNumber, getNextNumber, initial, vatPeriods, user, uploadFn = uploadFileToStorage }) {
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
  // eller trycka "Läs av igen" innan en pågående läsning är klar (kvitton
  // kan ta allt från någon sekund till flera tior sekunder beroende på
  // storlek), ska bara den SENASTE körningens resultat någonsin skrivas in
  // — annars kan en långsam, föråldrad körning hinna ikapp och skriva över
  // ett nyare, redan klart resultat. Samma id jämförs efter varje await.
  const ocrRunIdRef = useRef(0);
  // Ett kvitto i en annan valuta än kronor — { code, amount, converted } |
  // null. `converted` är { sek, rate, date } från convertToSek (utils/
  // currencyConversion.js) — eller null om kursen inte gick att hämta, och
  // då byggs raderna inte alls (se nedan).
  const [ocrForeignCurrency, setOcrForeignCurrency] = useState(null);

  const runOcr = useCallback(async (input) => {
    if (!input) return;
    const runId = ++ocrRunIdRef.current;
    const isCurrent = () => ocrRunIdRef.current === runId;
    setOcrStatus('scanning');
    setOcrMessage('Startar läsning…');
    setOcrForeignCurrency(null);
    try {
      const text = await ocrFile(input, msg => { if (isCurrent()) setOcrMessage(msg); });
      if (!isCurrent()) return; // en nyare körning har redan tagit över
      const parsed = parseReceiptText(text);
      const filled = new Set();
      if (parsed.date) { setDate(parsed.date); filled.add('date'); }
      // Samma regel som Expenses.jsx: en OCR-badge betyder "vi läste det
      // här", inte "vi gissade". Utan en igenkänd handlare (supplierMatched)
      // är parsed.supplier bara den råa första textraden — värt att fylla
      // i som utkast, inte värt att märka som avläst.
      if (parsed.supplier) { setDesc(parsed.supplier); if (parsed.supplierMatched) filled.add('desc'); }

      // Utländsk valuta — räkna om till kronor med DAGSKURSEN FÖR
      // KÖPDATUMET (Skatteverkets rekommendation) innan raderna byggs.
      // Går omräkningen inte att göra fylls raderna INTE i som om talet
      // redan vore kronor — se convertToSek/ocrForeignCurrency.
      let grossSek = parsed.currency ? null : parsed.amount;
      if (parsed.amount && parsed.currency) {
        if (isCurrent()) setOcrMessage(`Räknar om ${parsed.currency} till kronor…`);
        const converted = await convertToSek(parsed.amount, parsed.currency, parsed.date);
        if (!isCurrent()) return;
        if (converted) grossSek = converted.sek;
        setOcrForeignCurrency({ code: parsed.currency, amount: parsed.amount, converted });
      }

      if (grossSek) {
        const gross = Math.round(grossSek * 100) / 100;
        const vatRate = parsed.vatRate ?? 25;
        const net = vatRate > 0 ? Math.round((gross / (1 + vatRate / 100)) * 100) / 100 : gross;
        const vat = Math.round((gross - net) * 100) / 100;
        const costAccount = parsed.accountCode || '';
        const newRows = [{
          account: costAccount,
          accountName: accounts.find(a => a.code === costAccount)?.name || '',
          debet: net ? net.toFixed(2) : '', kredit: '', desc: parsed.supplier || '',
        }];
        if (vat > 0) {
          newRows.push({ account: '2641', accountName: accounts.find(a => a.code === '2641')?.name || 'Ingående moms', debet: vat.toFixed(2), kredit: '', desc: '' });
        }
        newRows.push({ account: '1930', accountName: accounts.find(a => a.code === '1930')?.name || 'Företagskonto/bank', debet: '', kredit: gross.toFixed(2), desc: '' });
        setRows(newRows);
        filled.add('rows');
      }
      setOcrFields(filled);
      setOcrStatus(filled.size > 0 || parsed.currency ? 'done' : 'error');
      setOcrMessage('');
    } catch (err) {
      if (!isCurrent()) return;
      console.error('OCR misslyckades:', err);
      setOcrStatus('error');
      setOcrMessage('');
    }
  }, [accounts]);

  // Ett formulär räknas som orört om ingen beskrivning och inga rader är
  // ifyllda ännu — bara då fylls raderna i automatiskt vid uppladdning.
  // Redan påbörjad kontering ska aldrig skrivas över utan att användaren
  // bett om det (via "Läs av igen"-knappen).
  const isPristineForm = () => !desc.trim() && rows.every(r => !r.account && !r.debet && !r.kredit && !(r.desc && r.desc.trim()));

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
      setFileError(`"${file.name}" är inte en PDF eller bild och kunde inte läggas till.`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setFileError(`"${file.name}" är för stor (max ${MAX_ATTACHMENT_MB} MB).`);
      return;
    }
    setFileError('');
    setAttachment(file);
    // Automatisk avläsning bara på ett orört formulär (se isPristineForm) —
    // byter man ut underlaget på en redan ifylld verifikation ska det INTE
    // skriva över konteringen i tysthet.
    if (isPristineForm()) runOcr(file);
  };

  // Kör om avläsningen manuellt, oavsett formulärets skick — en medveten
  // handling, till skillnad från den tysta auto-körningen ovan.
  const rerunOcr = () => {
    const src = attachment || existingAttachment?.url;
    if (src) runOcr(src);
  };

  // Mild varning — inte en spärr — om ett reskontrakonto (kundfordringar/
  // leverantörsskulder) används utan att motparten är ifylld.
  const usesReskontraAccount = rows.some(r => isReskontraAccount(r.account));
  const missingCounterparty = usesReskontraAccount && !counterpartyId;

  // Rensar OCR-badgen på raderna så fort användaren rör konteringen själv —
  // samma "försvinner vid redigering"-princip som Datum/Beskrivning nedan.
  const clearRowsOcrBadge = () => setOcrFields(s => { if (!s.has('rows')) return s; const n = new Set(s); n.delete('rows'); return n; });

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
        setAttachmentError('Kunde inte ladda upp underlaget — inte inloggad.');
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
          ? 'Bildlagring är inte konfigurerad i Supabase-projektet ännu (kör storage-delen av supabase-setup.sql).'
          : `Kunde inte ladda upp underlaget (${err.message || 'okänt fel'}).`);
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
  if (validRowCount < 2) validationMessages.push('Minst två rader med konto och belopp krävs');
  const canReview = isBalanced && validationMessages.length === 0;
  const title = initial?.number ? `Verifikation ${initial.number}` : 'Ny verifikation';

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
          ← Tillbaka
        </button>
        {/* En rättelseverifikation (`initial` fylld men `number` medvetet
            tömd, se "Rätta"-knappen nedan) ska visas och beskrivas som en
            NY verifikation — den ärver bara text/rader, aldrig originalets
            nummer eller "redigera befintlig"-språket. */}
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{title}</h1>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Serie {series} · {previewNumber}</span>
        <div style={{ flex: 1, minWidth: '8px' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Avbryt</button>
          <button type="button" onClick={() => handleSave('draft')} disabled={attachmentBusy} style={{ padding: '9px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: attachmentBusy ? 'not-allowed' : 'pointer', opacity: attachmentBusy ? 0.6 : 1 }}>
            {attachmentBusy ? 'Laddar upp…' : 'Spara som utkast'}
          </button>
          <button
            type="button"
            onClick={() => canReview && setShowReview(true)}
            disabled={!canReview}
            title={canReview ? undefined : validationMessages.join(' · ') || 'Debet och kredit måste vara lika'}
            style={{ padding: '9px 18px', background: canReview ? BRAND.green : 'var(--border)', border: 'none', borderRadius: '8px', color: canReview ? 'white' : 'var(--text-muted)', fontSize: '13px', fontWeight: 700, cursor: canReview ? 'pointer' : 'not-allowed' }}
          >
            {initial?.number ? 'Granska & spara' : 'Granska & bokför'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(14px, 2vw, 24px)' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', padding: 'clamp(16px, 2.2vw, 28px)', maxWidth: '1180px', margin: '0 auto', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Datum / Beskrivning / Serie */}
      <div className="ver-form-row" style={{ marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Datum {ocrFields.has('date') && <OcrBadge />}</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setOcrFields(s => { const n = new Set(s); n.delete('date'); return n; }); }} style={inp} />
        </div>
        <div style={{ flex: 3 }}>
          <label style={fieldLabel}>Beskrivning {ocrFields.has('desc') && <OcrBadge />}</label>
          <input data-tour="page-verifications-field" value={desc} onChange={e => { setDesc(e.target.value); setOcrFields(s => { const n = new Set(s); n.delete('desc'); return n; }); }} placeholder="Verifikationstext..." style={inp} autoFocus />
        </div>
        <div style={{ width: '90px' }}>
          <label style={fieldLabel}>Serie</label>
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
            <span>Denna period är redan momsredovisad. Ändringar här påverkar inte den redan inlämnade deklarationen och kräver en separat rättelse hos Skatteverket.</span>
          </div>
        );
      })()}

      {/* Räkenskapsår + nästa nummer + valuta, som en informationsrad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '18px', flexWrap: 'wrap' }}>
        <span>Räkenskapsår: <strong style={{ color: 'var(--text-main)' }}>Räkenskapsår {(date || '').slice(0, 4) || new Date().getFullYear()}</strong> <strong style={{ color: 'var(--text-main)' }}>{previewNumber}</strong></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Valuta
          <select disabled title="Bokix stödjer i dagsläget bara SEK — ingen valutaomräkning görs på andra valutor" style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: '999px', fontSize: '12px', color: 'var(--text-main)', background: 'var(--bg-muted)', fontFamily: 'inherit' }}>
            <option>SEK</option>
          </select>
        </span>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <label style={fieldLabel}>Intern anteckning (valfritt)</label>
        <textarea
          value={internalNote}
          onChange={e => setInternalNote(e.target.value)}
          placeholder="T.ex. anledning till bokning, referens till mejl, etc."
          rows={2}
          style={{ ...inp, resize: 'vertical', minHeight: '54px', fontFamily: 'inherit' }}
        />
      </div>

      <div className="ver-form-row" style={{ marginBottom: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Kostnadsställe</label>
          <input value={costCenter} onChange={e => setCostCenter(e.target.value)} placeholder="Ange kostnadsställe" style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Projekt</label>
          <ProjectSearch value={projectId} onChange={setProjectId} projects={projects} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Motpart</label>
          <PartySearch value={counterpartyId} onChange={setCounterpartyId} contacts={contacts} />
        </div>
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '0', marginBottom: '20px' }}>Gäller alla rader utan egen märkning.</p>

      {missingCounterparty && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '6px', padding: '8px 12px', marginBottom: '20px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          Ett reskontrakonto (kundfordringar/leverantörsskulder) är använt — ange motparten så det syns vem affärshändelsen gäller.
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
              Rader ifyllda automatiskt från kvittot (OCR) — kontrollera konto, moms och betalkonto innan du bokför. Betalkontot är alltid en gissning (1930).
            </div>
          )}
          {/* Utländsk valuta — beloppet ÄR omräknat till kronor med en
              riktig, publicerad kurs (convertToSek, ECB-data för
              köpdatumet), inte ett hittepåtal. Kursen och datumet visas
              öppet så det går att kontrollera — bankens egen
              växlingsavgift kan göra att det faktiskt dragna beloppet
              skiljer sig någon procent. Gick kursen inte att hämta byggs
              raderna inte alls, se convertToSek. */}
          {ocrForeignCurrency && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {ocrForeignCurrency.converted ? (
                <span>
                  Kvittot var i {ocrForeignCurrency.code} ({CURRENCY_SYMBOL[ocrForeignCurrency.code] || ''}{formatForeignAmount(ocrForeignCurrency.code, ocrForeignCurrency.amount)}) — raderna är byggda med {fmt(ocrForeignCurrency.converted.sek)} kr, omräknat med dagskursen {ocrForeignCurrency.converted.rate.toFixed(4)} SEK/{ocrForeignCurrency.code}{ocrForeignCurrency.converted.date ? ` (${ocrForeignCurrency.converted.date})` : ''}. Kontrollera mot kontoutdraget — bankens växlingsavgift kan göra att det skiljer sig något.
                </span>
              ) : (
                <span>
                  Kvittot verkar vara i {ocrForeignCurrency.code} ({CURRENCY_SYMBOL[ocrForeignCurrency.code] || ''}{formatForeignAmount(ocrForeignCurrency.code, ocrForeignCurrency.amount)}) men kursen gick inte att hämta automatiskt — fyll i raderna med beloppet i SEK själv, helst det som faktiskt drogs på kortet.
                </span>
              )}
            </div>
          )}
          <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ padding: '0 8px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', width: 140 }}>KONTO</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>BESKRIVNING</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', width: 110 }}>DEBET</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', width: 110 }}>KREDIT</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', width: 120 }}>
                  SALDO
                  {/* Utan den här raden trodde kunden att beloppet var själva
                      radens/verifikationens belopp — det är kontots HELA
                      historiska saldo före/efter denna rad. Stod tidigare
                      bara i en hover-title, som aldrig syns på mobil/touch. */}
                  <div style={{ fontWeight: 500, letterSpacing: 'normal', textTransform: 'none', fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>hela kontot</div>
                </th>
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
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '6px 8px 6px 0' }}>
                    <AccountSearch
                      value={row.account}
                      accounts={accounts}
                      compact
                      onChange={(code, name) => { updateRow(i, 'account', code); updateRow(i, 'accountName', name); }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-main)', fontSize: '13px' }}>
                    <input
                      value={row.desc || ''}
                      onChange={e => updateRow(i, 'desc', e.target.value)}
                      placeholder="Radtext..."
                      style={{ ...inp, padding: '9px 12px' }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="number" min="0" value={row.debet}
                      onChange={e => updateRow(i, 'debet', e.target.value)}
                      onBlur={() => handleBlurAmount(i)}
                      onKeyDown={e => { if (e.key === 'Enter') handleBlurAmount(i); }}
                      style={{ ...inp, padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-muted)' }}
                      placeholder="0,00"
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="number" min="0" value={row.kredit}
                      onChange={e => updateRow(i, 'kredit', e.target.value)}
                      onBlur={() => handleBlurAmount(i)}
                      onKeyDown={e => { if (e.key === 'Enter') handleBlurAmount(i); }}
                      style={{ ...inp, padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-muted)' }}
                      placeholder="0,00"
                    />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }} title="Kontots hela bokförda saldo — inte bara den här raden — före och efter att raden bokförs">
                    {projectedBalance !== null ? (
                      <div style={{ lineHeight: 1.4 }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmt(currentBalance)} kr idag</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, whiteSpace: 'nowrap' }}>→ {fmt(projectedBalance)} kr</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>–</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {warning && (
                      <span title={warning} style={{ display: 'inline-flex', color: 'var(--status-amber-text)', cursor: 'help', marginRight: '4px' }}>
                        <AlertCircle size={14} />
                      </span>
                    )}
                    <button onClick={() => toggleRowOverride(i)} title="Egen kostnadsställe/projekt för denna rad" style={{ background: 'none', border: 'none', cursor: 'pointer', color: hasOverride || overrideOpen ? 'var(--text-main)' : 'var(--text-muted)', padding: '2px', marginRight: '2px' }}>
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
                    <td colSpan={6} style={{ padding: '2px 8px 12px', background: 'var(--bg-muted)' }}>
                      <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...fieldLabel, marginBottom: '3px' }}>Kostnadsställe (denna rad)</label>
                          <input value={row.costCenter || ''} onChange={e => updateRow(i, 'costCenter', e.target.value)} placeholder={costCenter || 'Ärver från verifikationen'} style={{ ...inp, padding: '6px 10px', fontSize: '12.5px' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...fieldLabel, marginBottom: '3px' }}>Projekt (denna rad)</label>
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
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td colSpan={2} style={{ padding: '12px 8px', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>Summa</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: hasAmounts && !isBalanced ? 'var(--status-red-text)' : 'var(--text-main)' }}>{fmt(totalDebit)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: hasAmounts && !isBalanced ? 'var(--status-red-text)' : 'var(--text-main)' }}>{fmt(totalCredit)}</td>
                <td colSpan={2} />
              </tr>
              <tr>
                <td colSpan={6} style={{ padding: '0 8px 10px' }}>
                  {hasAmounts && !isBalanced ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-red-text)', background: 'var(--status-red-bg)', borderRadius: '999px', padding: '4px 12px' }}>
                      <AlertCircle size={13} /> Debet och kredit skiljer sig med {fmt(diff)} kr — {totalDebit > totalCredit ? 'lägg till kredit' : 'lägg till debet'} för att kunna bokföra
                    </span>
                  ) : hasAmounts ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-green-text)', background: 'var(--status-green-bg)', borderRadius: '999px', padding: '4px 12px' }}>
                      Balanserar — debet = kredit
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fyll i minst två rader: en debet och en kredit på samma belopp.</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '7px 14px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={13} /> Lägg till rad
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
                      if (!(await confirmDialog('Ersätt raderna i formuläret med mallens rader?'))) return;
                    }
                    setDesc(tpl.description || '');
                    setProjectId(tpl.projectId || '');
                    setCostCenter(tpl.costCenter || '');
                    setRows(tpl.rows.map(r => ({ ...r })));
                  }}
                  style={{ padding: '7px 14px 7px 30px', border: 'none', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'inherit', background: 'transparent', appearance: 'none' }}
                >
                  <option value="">Använd mall</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {onSaveTemplate && (
              <button
                onClick={async () => {
                  const name = await promptDialog('Namn på mallen:', { defaultValue: desc || '', placeholder: 'T.ex. Kontorsmaterial' });
                  if (name && name.trim()) onSaveTemplate({ name: name.trim(), description: desc, projectId, costCenter, rows });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Save size={13} /> Spara som mall
              </button>
            )}
          </div>
        </div>

        {/* Right side: Attachment */}
        <div className="ver-form-attachment" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Underlag</div>
            {ocrStatus === 'scanning' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                <ScanLine size={12} style={{ animation: 'spin 1s linear infinite' }} /> {ocrMessage || 'Läser…'}
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
                <DocumentPane
                  className="dv-embed"
                  url={displayAttachmentUrl}
                  type={displayAttachmentType}
                  name={displayAttachmentName}
                />
                <div className="ver-doc-actions">
                  <button type="button" className="ver-doc-btn" disabled={ocrStatus === 'scanning'} onClick={rerunOcr} style={ocrStatus === 'scanning' ? { cursor: 'not-allowed', opacity: 0.6 } : undefined}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ScanLine size={12} style={{ animation: ocrStatus === 'scanning' ? 'spin 1s linear infinite' : 'none' }} /> {ocrStatus === 'scanning' ? 'Läser…' : 'Läs av igen'}</span>
                  </button>
                  <button type="button" className="ver-doc-btn" onClick={() => setShowAttachmentLightbox(true)}>Visa i fullstorlek</button>
                  <button type="button" className="ver-doc-btn" onClick={() => fileInputRef.current?.click()}>Byt fil</button>
                  <button type="button" className="ver-doc-btn ver-doc-btn-muted" onClick={() => { setAttachment(null); setExistingAttachment(null); }}>Ta bort</button>
                </div>
              </>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `1px dashed ${dragOver ? 'var(--text-main)' : 'var(--border)'}`, borderRadius: '12px', background: dragOver ? 'var(--bg-muted)' : 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', height: 'clamp(320px, 44vh, 560px)', boxSizing: 'border-box' }}
              >
                <UploadCloud size={26} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>Dra och släpp kvittot här</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '260px' }}>PDF eller bild (max {MAX_ATTACHMENT_MB} MB) — vi läser av datum, belopp och konto automatiskt, granska bara innan du bokför.</span>
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
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> Kunde inte läsa av kvittot automatiskt — fyll i raderna manuellt.
            </div>
          )}
          {attachmentBusy && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>Laddar upp underlag…</div>
          )}
          {attachmentError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: 'var(--status-red-text)' }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> {attachmentError}
            </div>
          )}
          {!hasAttachment && (
            <div style={{ marginTop: '12px' }} onClick={e => e.stopPropagation()}>
              <label style={labelStyle}>Var förvaras originalet?</label>
              <input
                value={originalLocation}
                onChange={e => setOriginalLocation(e.target.value)}
                placeholder="T.ex. pärm 2026 nr 14, eller e-post 2026-08-12"
                style={inp}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Frivilligt, men bra att fylla i när inget underlag är uppladdat här.</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={async () => {
              if (!(await confirmDialog('Rensa formuläret? Ifylld information försvinner.'))) return;
              setDesc(''); setProjectId(''); setCostCenter(''); setInternalNote('');
              setCounterpartyId(''); setOriginalLocation(''); setAttachment(null); setExistingAttachment(null);
              setRows([
                { account: '', accountName: '', debet: '', kredit: '', desc: '' },
                { account: '', accountName: '', debet: '', kredit: '', desc: '' },
              ]);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 14px', background: 'none', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', marginRight: 'auto' }}
          ><RefreshCw size={13} /> Rensa</button>
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
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>Granska verifikation</h3>
            <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>{date} · Serie {series} · {desc || 'Ingen beskrivning'}</p>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              {rows.filter(r => r.account && (parseFloat(r.debet) > 0 || parseFloat(r.kredit) > 0)).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '13px', borderBottom: '1px solid var(--border-light)' }}>
                  <span><strong style={{ color: 'var(--text-main)' }}>{r.account}</strong> {r.accountName}</span>
                  <span style={{ fontWeight: 600, color: r.debet ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>{r.debet ? `D ${fmt(r.debet)}` : `K ${fmt(r.kredit)}`}</span>
                </div>
              ))}
              {missingCounterparty && (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--status-amber-text)', background: 'var(--status-amber-bg)' }}>Observera: reskontrakonto utan motpart.</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowReview(false)} style={{ padding: '9px 16px', background: 'var(--bg-card)', border: '1px solid var(--text-muted)', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Tillbaka och ändra</button>
              <button onClick={() => { handleSave('booked'); setShowReview(false); }} style={{ padding: '9px 20px', background: '#16a34a', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                {initial?.number ? 'Spara ändringar' : 'Bokför'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Bokföring Component ──────────────────────────────────────────────────
export default function Bokforing({ verifications = [], accounts = [], balances = {}, contacts = [], projects = [], templates = [], onSaveTemplate, onAdd, setVerifications, setAccounts, highlightVerificationId, onClearHighlight, vatPeriods, user, uploadFn = uploadFileToStorage, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'verifications');
  // Samma mönster som Taxes.jsx:s initialSection — App.jsx:s
  // verificationsInitialTab (profilmenyns "Kontoplaner" ska landa på
  // Kontoplan-fliken här, inte Verifikationer, se dess egen kommentar)
  // ändras efter att den här komponenten redan monterats en gång, så
  // bara useState:s förvalsvärde ovan räcker inte.
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVer, setEditingVer] = useState(null);
  const [search, setSearch] = useState('');
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

  // Kontoplan state
  const [accountSearch, setAccountSearch] = useState('');
  // Kundönskemål, uttryckligt: en väg att se BARA de konton man redan har
  // (aktiva) och en väg att se HELA kontoplanen, i stället för att alltid
  // bläddra i alla ~700-1200 på en gång. 'mine' = företagets egna, aktiva
  // konton — samma urval AccountSearch redan defaultar till (shared/
  // SearchInputs.jsx) — 'all' = varje konto, aktivt eller ej, för att
  // hitta och slå på ett nytt (se dammsugar-exemplet).
  const [accountView, setAccountView] = useState('mine');
  // Kundönskemål, uttryckligt: klasserna ska INTE fällas ut automatiskt
  // (stod tidigare öppna på 1-3 direkt vid sidladdning) — man väljer
  // själv vilken man vill se, i båda vyerna. En sökning fäller fortfarande
  // upp matchande klasser åt en (se useEffect nedan) — det är inte samma
  // sak: att SKRIVA en sökning är i sig en begäran om att se resultatet,
  // olikt en tom sida som bara händer att öppna sig själv.
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');

  // Varje serie (A/B/C) har sin egen löpande, oberoende nummerserie.
  const getNextNumber = (seriesLetter = 'A') => {
    const max = verifications.reduce((m, v) => {
      if (!(v.number || '').startsWith(seriesLetter)) return m;
      const n = parseInt((v.number || '').replace(/\D/g, ''), 10);
      return !isNaN(n) && n > m ? n : m;
    }, 0);
    return `${seriesLetter}${String(max + 1).padStart(3, '0')}`;
  };

  const nextNumber = getNextNumber('A');

  // Hoppa direkt till en specifik verifikation — används av Momsdeklarationens
  // Steg 1 för att låta felposter i valideringslistan vara klickbara.
  useEffect(() => {
    if (!highlightVerificationId) return;
    setActiveTab('verifications');
    setSearch(''); setDateFrom(''); setDateTo(''); setSeries('all');
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
    if (!(await confirmDialog(`Ta bort utkastet ${v.number}? Det går inte att ångra.`, { title: 'Ta bort utkast', confirmLabel: 'Ta bort', danger: true }))) return;
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
    return groupByYear ? ((v.date || '').slice(0, 4) || 'okänt') : ((v.date || '').slice(0, 7) || 'okänt');
  };
  const renderVerGroupHeader = (key, rowsInGroup) => {
    const label = key === 'okänt' ? 'Utan datum' : (groupByYear ? key : formatMonthLabel(key));
    const total = rowsInGroup.reduce((s, v) => s + (v.rows?.reduce((rs, r) => rs + getDebet(r), 0) || v.amount || 0), 0);
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-main)' }}>{label}</span>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {rowsInGroup.length} {rowsInGroup.length === 1 ? 'verifikation' : 'verifikationer'} · {fmtSEK(total)}
        </span>
      </div>
    );
  };

  // Kontoplan grouping
  const getGroupAccounts = (groupCode) => {
    return accounts.filter(a => {
      const n = parseInt(a.code, 10);
      const g = BAS_GROUPS.find(g => g.code === groupCode);
      return g && n >= g.range[0] && n <= g.range[1];
    // Samma matchning som kontofälten i formulären (utils/accountSearch.js):
    // sökte man "30" här förut fick man inte 4030, eftersom numret måste
    // BÖRJA med det inskrivna. Nu beter sig kontoplanen likadant överallt.
    }).filter(a => accountMatches(a, accountSearch))
      // "Mina konton" = precis samma urval som kontofältens tomma
      // standardvy (active || system) — visar bara de här utan att göra
      // om urvalslogiken en tredje gång. "Alla konton" visar allt, aktivt
      // eller ej, för att hitta och slå på ett nytt.
      .filter(a => accountView === 'all' || a.active || a.system);
  };

  const getGroupBalance = (groupCode) => {
    const g = BAS_GROUPS.find(g => g.code === groupCode);
    if (!g) return 0;
    return accounts
      .filter(a => { const n = parseInt(a.code, 10); return n >= g.range[0] && n <= g.range[1]; })
      .reduce((sum, a) => sum + (balances[a.code] || 0), 0);
  };

  useEffect(() => {
    if (accountSearch) setExpandedGroups(Object.fromEntries(BAS_GROUPS.map(g => [g.code, true])));
  }, [accountSearch]);

  const handleAddAccount = () => {
    if (!newAccCode || !newAccName) return;
    if (accounts.find(a => a.code === newAccCode)) { alert(`Konto ${newAccCode} finns redan.`); return; }
    // `numeric: true` gör att kontokoder jämförs som TAL, inte tecken för
    // tecken — annars sorteras t.ex. "1000" före "999" (lexikografisk
    // jämförelse), fel så fort en tillagd kod har en annan längd än de
    // befintliga 4-siffriga BAS-koderna.
    setAccounts(prev => [...prev, { code: newAccCode, name: newAccName }].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    setNewAccCode(''); setNewAccName(''); setShowNewAccountForm(false);
  };

  const handleDeactivateAccount = (code) => {
    const used = verifications.filter(v => v.rows?.some(r => r.account === code)).length;
    if (used > 0) { alert(`Kontot används i ${used} verifikationer och kan inte tas bort. Det kan inaktiveras.`); return; }
    setAccounts(prev => prev.filter(a => a.code !== code));
  };

  // Kundönskemål, uttryckligt (skärmdump av ett externt kontoplansverktyg
  // + eget exempel: "ett kvitto på en dammsugare, kunde inte hitta rätt
  // konto"): kontoplanen ska gå att BLÄDDRA i, klass för klass, och man
  // ska själv kunna slå på fler konton än den handfull som är aktiva från
  // start — raden ovan lovade redan "kan inaktiveras" utan att det fanns
  // någon knapp för det. `active` (AccountsData.js) är den knappen: av/på
  // per konto, alltid reversibelt (till skillnad från raderingen ovan,
  // som är permanent och spärrad om kontot redan använts). `system`-
  // konton (moms, bankkonto m.fl. — se AccountsData.js) går inte att
  // stänga av här: bokföringen bokför automatiskt mot dem, och ett
  // avstängt sådant konto skulle bara dyka upp som ett förvirrande fel
  // längre fram i stället för att synas här och nu.
  const handleToggleAccountActive = (code) => {
    setAccounts(prev => prev.map(a => a.code === code ? { ...a, active: !a.active } : a));
  };

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
        uploadFn={uploadFn}
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>

      {/* ── Top section: title + tabs ─────────────────────────── */}
      <ListPageHeader
        title="Bokföring"
        subtitle="Verifikationer, kontoplan och bokföringsposter"
        actions={
          activeTab === 'verifications' ? [
            { key: 'next', type: 'note', label: 'Nästa:', value: nextNumber },
            { key: 'new-ver', label: 'Ny verifikation', icon: Plus, onClick: () => { setEditingVer(null); setShowForm(true); }, variant: 'primary', dataTour: 'page-verifications-cta' },
          ] : activeTab === 'accounts' ? [
            { key: 'new-account', label: 'Nytt konto', icon: Plus, onClick: () => setShowNewAccountForm(v => !v), variant: 'primary' },
          ] : []
        }
        tabs={{
          items: [{ id: 'verifications', label: 'Verifikationer' }, { id: 'accounts', label: 'Kontoplan' }],
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
            onClear={() => { setSearch(''); setDateFrom(''); setDateTo(''); setSeries('all'); setMonthFilter('all'); }}
            count={filteredVers.length}
            countLabel="verifikationer"
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          >
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök verifikation, text, belopp..." style={{ ...listSearchInputStyle, width: '240px' }} />
            </div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={listFilterFieldStyle} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={listFilterFieldStyle} />
            <select value={series} onChange={e => setSeries(e.target.value)} style={listFilterFieldStyle}>
              <option value="all">Alla serier</option>
              <option value="A">Serie A</option>
              <option value="B">Serie B</option>
              <option value="C">Serie C</option>
            </select>
            {/* Kundönskemål ("samma som i Kvitton, jag älskar det"): samma
                månadsväljare + Grupperat/Lista-växel som Expenses.jsx,
                återanvänder samma .rc-segmented-utseende (index.css) så
                kontrollen ser likadan ut var den än dyker upp i appen. */}
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={listFilterFieldStyle}>
              <option value="all">Alla månader</option>
              {MONTH_NAMES.map(m => <option key={m.v} value={m.v}>{m.label} (alla år)</option>)}
            </select>
            <div className="rc-segmented">
              <button type="button" onClick={() => setFlatView(false)} className={!flatView ? 'active' : ''}>Grupperat</button>
              <button type="button" onClick={() => setFlatView(true)} className={flatView ? 'active' : ''}>Lista</button>
            </div>
          </ListFilterBar>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ListTable
              rowKey={v => v.id}
              onRowClick={v => setExpandedId(expandedId === v.id ? null : v.id)}
              isExpanded={v => expandedId === v.id}
              emptyMessage="Inga verifikationer bokförda"
              rows={visibleVers}
              groupBy={verGroupKey}
              renderGroupHeader={renderVerGroupHeader}
              columns={[
                {
                  key: 'number', label: 'Verifikation', fontWeight: 700, color: 'var(--text-main)', render: v => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} id={`ver-row-${v.id}`}>
                      {expandedId === v.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {v.number}
                    </div>
                  ),
                },
                { key: 'date', label: 'Datum', render: v => v.date },
                { key: 'description', label: 'Beskrivning', color: 'var(--text-main)', wrap: true, render: v => v.description },
                {
                  key: 'amount', label: 'Belopp', align: 'right', fontWeight: 600, color: 'var(--text-main)',
                  render: v => fmt(v.rows?.reduce((s, r) => s + getDebet(r), 0) || v.amount || 0),
                },
                {
                  key: 'status', label: 'Status', align: 'center', render: v => {
                    const isDraft = (v.status || 'booked') === 'draft';
                    return isDraft ? (
                      <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)' }}>Utkast</span>
                    ) : (
                      <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'var(--status-green-bg)', color: 'var(--status-green-text)' }}>Bokförd</span>
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
                              title="Fortsätt redigera utkastet"
                              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              Fortsätt
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(v)}
                              title="Ta bort utkastet"
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
                            title="Skapa rättelseverifikation"
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <RotateCcw size={11} /> Rätta
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
                    <span>Motpart: <strong style={{ color: 'var(--text-main)' }}>{contacts.find(c => c.id === v.counterpartyId)?.name || '—'}</strong></span>
                    <span>Upprättad: <strong style={{ color: 'var(--text-main)' }}>{v.createdAt ? new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v.createdAt)) : '—'}</strong></span>
                    {v.originalLocation && <span>Original förvaras: <strong style={{ color: 'var(--text-main)' }}>{v.originalLocation}</strong></span>}
                  </div>
                  {/* overflow-x:auto (mobil): 4 kolumner i 311px (efter
                      32px vänsterindrag) — sidledes skroll på just denna
                      underliggande detaljtabell istället för en kortlist-
                      omgörning, som vore overkill för en sällan uppfälld panel. */}
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
                          <td colSpan={2} style={{ padding: '5px 8px', fontWeight: 700, fontSize: '12px', color: 'var(--status-green-text)', whiteSpace: 'nowrap' }}>Summa</td>
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
                          Fortsätt
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(v)}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '11.5px', color: 'var(--status-red-text)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={11} /> Ta bort
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
                        <RotateCcw size={11} /> Rätta
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
                  primary: v.description || `Verifikation ${v.number}`,
                  amount: total,
                  meta: `${v.number} · ${v.date}`,
                  pill: (
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700, background: isDraft ? 'var(--status-amber-bg)' : 'var(--status-green-bg)', color: isDraft ? 'var(--status-amber-text)' : 'var(--status-green-text)' }}>
                      {isDraft ? 'Utkast' : 'Bokförd'}
                    </span>
                  ),
                };
              }}
            />
          </div>
        </div>
      )}

      {/* ── KONTOPLAN TAB ────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Search + new account form */}
          <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder="Sök kontonummer eller namn..." style={{ padding: '5px 8px 5px 26px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', width: '240px', outline: 'none' }} />
            </div>
            {/* Kundönskemål, uttryckligt: en vy med bara de konton man
                redan har (aktiva) och en vy med HELA kontoplanen, i
                stället för att alltid bläddra i alla samtidigt. */}
            <div className="rc-segmented">
              <button onClick={() => setAccountView('mine')} className={accountView === 'mine' ? 'active' : ''}>Mina konton</button>
              <button onClick={() => setAccountView('all')} className={accountView === 'all' ? 'active' : ''}>Alla konton</button>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {accountView === 'mine' ? `${accounts.filter(a => a.active || a.system).length} av ${accounts.length} konton` : `${accounts.length} konton`}
            </span>
          </div>

          {/* New account form */}
          {showNewAccountForm && (
            <div style={{ background: 'var(--lime-50)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-text)' }}>Nytt konto</span>
              <input value={newAccCode} onChange={e => setNewAccCode(e.target.value)} placeholder="Kontonummer" style={{ padding: '5px 8px', border: '1px solid var(--text-muted)', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', width: '110px' }} />
              <input value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Kontonamn" style={{ padding: '5px 8px', border: '1px solid var(--text-muted)', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', width: '260px' }} />
              <button onClick={handleAddAccount} style={{ padding: '5px 14px', background: 'var(--accent)', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Spara</button>
              <button onClick={() => setShowNewAccountForm(false)} style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--text-muted)', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Avbryt</button>
              {newAccCode && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kontoklass: {getGroup(newAccCode)?.label || '—'}</span>}
            </div>
          )}

          {/* Grouped account list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {BAS_GROUPS.map(g => {
              const groupAccs = getGroupAccounts(g.code);
              const groupBal = getGroupBalance(g.code);
              const isOpen = expandedGroups[g.code];
              const hasMatch = !accountSearch || groupAccs.length > 0;

              if (!hasMatch) return null;

              return (
                <div key={g.code} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Group header */}
                  {/* Sticky: kontoplanen är 90+ rader lång och kontoklassen
                      (1000-tal = tillgångar, 2000-tal = skulder …) är det
                      enda som gör en rad begriplig. Utan den här raden
                      kvar i toppen tappade man vilken klass man scrollat in
                      i — kundfeedback: "gör så att man faktiskt kan läsa
                      allt, nu ligger de bara under varandra". */}
                  <div
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [g.code]: !prev[g.code] }))}
                    style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', background: 'var(--bg-page)', cursor: 'pointer', userSelect: 'none', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-page)'}
                  >
                    {isOpen ? <ChevronDown size={15} style={{ marginRight: 8, color: 'var(--text-secondary)' }} /> : <ChevronRight size={15} style={{ marginRight: 8, color: 'var(--text-secondary)' }} />}
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', flex: 1 }}>{g.label}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 12 }}>{groupAccs.length} konton</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: groupBal >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)', minWidth: 100, textAlign: 'right' }}>
                      {fmt(groupBal)}
                    </span>
                  </div>

                  {/* Account rows */}
                  {isOpen && (
                    <ListTable
                      rowKey={a => a.code}
                      emptyMessage="Inga matchande konton"
                      rows={groupAccs}
                      columns={[
                        { key: 'code', label: 'Konto', fontWeight: 700, color: 'var(--text-main)', render: a => a.code },
                        { key: 'name', label: 'Kontonamn', color: 'var(--text-main)', render: a => a.name },
                        {
                          key: 'balance', label: 'Saldo', align: 'right', render: a => {
                            const bal = balances[a.code] || 0;
                            return <span style={{ fontWeight: bal !== 0 ? 700 : 400, color: bal > 0 ? 'var(--status-green-text)' : bal < 0 ? 'var(--status-red-text)' : 'var(--text-muted)' }}>{bal !== 0 ? fmt(bal) : '—'}</span>;
                          },
                        },
                        {
                          // `system: true` (AccountsData.js) = ett kärnkonto bokföringen
                          // själv bokför mot automatiskt (moms, momsredovisning m.fl.) —
                          // växeln är låst PÅ för dem, annars kan bokföringen sluta
                          // fungera utan att felet syns förrän en verifikation redan gått
                          // snett. Alla andra konton är av som standard tills man själv
                          // slår på dem, eller tills de redan används (se raden nedan).
                          key: 'active', label: 'Aktiv', align: 'center', render: a => (
                            a.system ? (
                              // En avstängd, disabled växel ser vid en snabb
                              // blick likadan ut som en påslagen — en tydlig
                              // låsikon + text är den enda som faktiskt
                              // säger "det här går inte att röra", inte bara
                              // "det råkar inte gå att röra just nu".
                              <span
                                title="Kärnkonto — bokföringen bokför automatiskt mot det här kontot, det går inte att stänga av"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}
                              >
                                <Lock size={11} /> Alltid på
                              </span>
                            ) : (
                              <ToggleSwitch checked={Boolean(a.active)} onChange={() => handleToggleAccountActive(a.code)} />
                            )
                          ),
                        },
                        {
                          key: 'actions', label: '', align: 'center', render: a => {
                            const usedInVers = verifications.filter(v => v.rows?.some(r => r.account === a.code)).length;
                            return (
                              <button
                                onClick={() => handleDeactivateAccount(a.code)}
                                title={usedInVers > 0 ? `Används i ${usedInVers} verifikationer — kan inte tas bort` : 'Ta bort konto'}
                                style={{ background: 'none', border: 'none', cursor: usedInVers > 0 ? 'not-allowed' : 'pointer', color: usedInVers > 0 ? 'var(--border)' : '#ef4444', padding: '2px' }}
                              >
                                <X size={13} />
                              </button>
                            );
                          },
                        },
                      ]}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
