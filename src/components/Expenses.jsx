import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Receipt, X, Clock, Trash2, RotateCcw, Search, ScanLine,
} from 'lucide-react';
import { AccountSearch } from './shared/SearchInputs';
import { DocumentPane } from './shared/DocumentViewer';
import { TextSuggestInput } from './shared/SearchInputs';
import ListPageHeader from './shared/ListPageHeader';
import { uploadFileToStorage } from '../utils/fileUpload';
import { BRAND } from '../utils/brandColors';
import { confirmDialog } from './shared/ConfirmDialog';
import { ocrFile, parseReceiptText } from '../utils/ocrReceipt';
import { convertToSek } from '../utils/currencyConversion';

// ── Formatting ──
const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
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

function EmptyReceiptsState({ text }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <div style={{ width: 52, height: 52, borderRadius: '999px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--text-muted)' }}>
        <Receipt size={22} />
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>{text || 'Inga kvitton uppladdade ännu. Ladda upp ditt första kvitto ovan för att börja.'}</p>
    </div>
  );
}

// ── Kvittovyn (Sida 34) — fälten till vänster, dokumentet till höger ──
// Kvittot finns redan i listan (det skapas direkt vid uppladdning med tomma
// fält, se uploadReceipt i Expenses); den här vyn är hur man färdigställer
// och bokför det — eller, om det redan är bokfört, bara läser uppgifterna
// i efterhand.
//
// Omgjord efter kundfeedback, och hela omgörningen vilar på en enda
// omständighet: vi tolkar INTE kvittot automatiskt (ingen OCR ännu). Allt
// fylls i för hand, och då är det två saker som avgör hur snabbt det går.
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

// Bara för att skriva ut varningen om utländsk valuta lite snyggare —
// ingen omräkning görs, det här är enbart kosmetiskt.
const CURRENCY_SYMBOL = { USD: '$', GBP: '£', EUR: '€', JPY: '¥', CNY: '¥', NOK: 'kr', DKK: 'kr' };
// Yen (och i praktiken oftast yuan på kvitton) skrivs utan decimaler —
// "¥5000,00" ser trasigt ut för en valuta som aldrig har ören/fen.
const formatForeignAmount = (code, amount) => (code === 'JPY' || code === 'CNY') ? String(Math.round(amount)) : amount.toFixed(2);

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

function ReceiptDetailModal({ receipt, accounts, projects, allReceipts, status, onSave, onDelete, onReverse, onClose }) {
  // "Rättad" är också ett låst tillstånd — samma skäl som "Bokförd": en
  // rättelseverifikation ändrar inte originalet, så fälten som redan
  // bokfördes ska förbli precis vad de var när det begicks, inte gå att
  // smygredigera i efterhand.
  const readOnly = status === 'booked' || status === 'reversed';
  const [form, setForm] = useState({
    date: receipt.date || new Date().toISOString().split('T')[0],
    supplier: receipt.supplier || '',
    amount: receipt.amount ? String(receipt.amount).replace('.', ',') : '',
    vatRate: receipt.vatRate ?? 25,
    costAccount: receipt.costAccount || '',
    projectId: receipt.projectId || '',
    notes: receipt.notes || '',
  });
  const [errors, setErrors] = useState({});

  // ── OCR ────────────────────────────────────────────────────────────────────
  // ocrStatus: 'idle' | 'scanning' | 'done' | 'error'
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrMessage, setOcrMessage] = useState('');
  // Håller reda på vilka fält som fylldes i av OCR så vi kan visa en badge.
  const [ocrFields, setOcrFields] = useState(new Set());
  // Ett kvitto i en annan valuta än kronor — { code, amount, converted } |
  // null. `converted` är resultatet från convertToSek (utils/
  // currencyConversion.js): { sek, rate, date }, eller null om kursen inte
  // gick att hämta (och då fylls beloppet inte i alls — se nedan).
  const [ocrForeignCurrency, setOcrForeignCurrency] = useState(null);
  // Gör körningar avbrytbara: hinner användaren byta fil eller köra om
  // läsningen innan en pågående körning (som nu även väntar in en
  // valutakurs över nätet) är klar, ska bara den SENASTE körningens
  // resultat någonsin skrivas in i formuläret.
  const ocrRunIdRef = useRef(0);

  const runOcr = useCallback(async (input) => {
    if (!input || readOnly) return;
    const runId = ++ocrRunIdRef.current;
    const isCurrent = () => ocrRunIdRef.current === runId;
    setOcrStatus('scanning');
    setOcrMessage('Startar läsning…');
    setOcrForeignCurrency(null);
    try {
      const text = await ocrFile(input, msg => { if (isCurrent()) setOcrMessage(msg); });
      if (!isCurrent()) return;
      console.log('[OCR] raw text:', text ? text.slice(0, 500) : '(empty)');
      const parsed = parseReceiptText(text);
      console.log('[OCR] parsed:', parsed);
      const filled = new Set();

      // Utländsk valuta — räkna om till kronor med DAGSKURSEN FÖR
      // KÖPDATUMET (Skatteverkets rekommendation) innan beloppet fylls i.
      // Går omräkningen inte att göra (okänd valutakod, inget nät) fylls
      // beloppet INTE i som om talet redan vore kronor — se
      // convertToSek/ocrForeignCurrency.
      let amountSek = parsed.currency ? null : parsed.amount;
      let foreignInfo = null;
      if (parsed.amount && parsed.currency) {
        setOcrMessage(`Räknar om ${parsed.currency} till kronor…`);
        const converted = await convertToSek(parsed.amount, parsed.currency, parsed.date);
        if (!isCurrent()) return;
        if (converted) amountSek = converted.sek;
        foreignInfo = { code: parsed.currency, amount: parsed.amount, converted };
      }

      setForm(prev => {
        const next = { ...prev };
        if (parsed.date) { next.date = parsed.date; filled.add('date'); }
        if (amountSek) { next.amount = String(amountSek).replace('.', ','); filled.add('amount'); }
        if (parsed.vatRate !== null && parsed.vatRate !== undefined) { next.vatRate = parsed.vatRate; filled.add('vatRate'); }
        if (parsed.supplier) { next.supplier = parsed.supplier; filled.add('supplier'); }
        if (parsed.accountCode) { next.costAccount = parsed.accountCode; filled.add('costAccount'); }
        return next;
      });
      if (foreignInfo) setOcrForeignCurrency(foreignInfo);
      setOcrFields(filled);
      setOcrStatus('done');
      setOcrMessage('');
    } catch (err) {
      if (!isCurrent()) return;
      console.error('OCR misslyckades:', err);
      setOcrStatus('error');
      setOcrMessage('');
    }
  }, [readOnly]);

  const hasReceiptFile = Boolean(receipt.receiptUrl);
  // Ett kvitto räknas som nytt/obehandlat om varken leverantör, belopp eller konto fyllts i än
  const isUnprocessed = !receipt.supplier && (!receipt.amount || Number(receipt.amount) === 0) && !receipt.costAccount;
  
  useEffect(() => {
    if (hasReceiptFile && isUnprocessed && !readOnly) {
      runOcr(receipt.receiptUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const vatRate = Number(form.vatRate) || 0;
  const vatAmount = hasAmount ? grossAmount - grossAmount / (1 + vatRate / 100) : 0;
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

  const handleSave = async () => {
    const newErrors = {};
    const amount = parseAmount(form.amount);
    if (!form.date) newErrors.date = 'Datum krävs.';
    if (!form.supplier.trim()) newErrors.supplier = 'Inköpsställe krävs.';
    if (isNaN(amount) || amount <= 0) newErrors.amount = 'Ange ett giltigt belopp.';
    if (!form.costAccount) newErrors.costAccount = 'Välj ett konto.';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    // Samma dublettvarning som tidigare fanns i "Spara och bokför"-flödet —
    // jämför mot alla kvitton UTOM sig själv, annars flaggar ett kvitto sig
    // själv som en dublett så fort man öppnar och sparar det en andra gång.
    const dup = allReceipts.find(r => r.id !== receipt.id && r.date === form.date && Math.abs((r.amount || 0) - amount) < 0.01 && (r.supplier || '').trim().toLowerCase() === form.supplier.trim().toLowerCase());
    if (dup) {
      const ok = await confirmDialog(`Det finns redan ett kvitto från "${dup.supplier}" på ${formatSEK(dup.amount)} samma datum. Vill du spara ändå?`);
      if (!ok) return;
    }

    onSave(receipt.id, {
      date: form.date, supplier: form.supplier.trim(), amount, vatRate: Number(form.vatRate),
      costAccount: form.costAccount, projectId: form.projectId || undefined, notes: form.notes.trim() || undefined,
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

        {/* ── Vänster: formuläret ── */}
        <div className="rc-form">
          <div className="rc-form-head">
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Kvittodetaljer</h2>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {readOnly ? 'Bokfört underlag' : ocrStatus === 'scanning' ? (ocrMessage || 'Läser kvittot…') : ocrStatus === 'done' ? 'OCR klar — granska och justera' : 'Fyll i uppgifterna från kvittot'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* OCR-knapp: kör om manuellt, bara när det finns en fil */}
              {!readOnly && hasReceiptFile && (
                <button
                  type="button"
                  title={ocrStatus === 'scanning' ? (ocrMessage || 'Läser…') : 'Läs av kvittot automatiskt med OCR'}
                  disabled={ocrStatus === 'scanning'}
                  onClick={() => runOcr(receipt.receiptUrl)}
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
                  {ocrStatus === 'scanning' ? (ocrMessage || 'Läser…') : 'Läs av'}
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

          <div className="rc-form-body">
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

            {/* Utländsk valuta — beloppet ÄR omräknat till kronor med en
                riktig, publicerad kurs (convertToSek, ECB-data för
                köpdatumet), inte ett hittepåtal. Bandet visar räkningen
                öppet (kurs + datum) så den går att kontrollera, eftersom
                bankens egen växlingsavgift gör att det faktiskt dragna
                beloppet kan skilja någon procent från ECB-kursen. Gick
                kursen inte att hämta (inget nät, okänd valuta) fylls
                beloppet inte i alls — se convertToSek. */}
            {ocrForeignCurrency && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, lineHeight: 1.5 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  {ocrForeignCurrency.converted ? (
                    <>
                      Kvittot var i {ocrForeignCurrency.code} ({CURRENCY_SYMBOL[ocrForeignCurrency.code] || ''}{formatForeignAmount(ocrForeignCurrency.code, ocrForeignCurrency.amount)}) — omräknat till {formatSEK2(ocrForeignCurrency.converted.sek)} med dagskursen {ocrForeignCurrency.converted.rate.toFixed(4)} SEK/{ocrForeignCurrency.code}{ocrForeignCurrency.converted.date ? ` (${ocrForeignCurrency.converted.date})` : ''}. Kontrollera mot kontoutdraget — bankens växlingsavgift kan göra att det faktiska beloppet skiljer sig något.
                    </>
                  ) : (
                    <>
                      Kvittot verkar vara i {ocrForeignCurrency.code} ({CURRENCY_SYMBOL[ocrForeignCurrency.code] || ''}{formatForeignAmount(ocrForeignCurrency.code, ocrForeignCurrency.amount)}) men kursen gick inte att hämta automatiskt — skriv in beloppet i SEK själv, helst det som faktiskt drogs på kortet.
                    </>
                  )}
                </span>
              </div>
            )}

            <div className="rc-grid">
              <div>
                <label style={labelSt}>Datum {ocrFields.has('date') && <OcrBadge />}</label>
                <input type="date" disabled={readOnly} value={form.date} onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setOcrFields(s => { const n = new Set(s); n.delete('date'); return n; }); }} style={inputStErr(errors.date)} />
                {errors.date && <div style={errSt}>{errors.date}</div>}
              </div>
              <div>
                <label style={labelSt}>Belopp ink moms (kr) {ocrFields.has('amount') && <OcrBadge />}</label>
                <AmountInput disabled={readOnly} value={form.amount} onChange={v => { setForm(f => ({ ...f, amount: v })); setOcrFields(s => { const n = new Set(s); n.delete('amount'); return n; }); setOcrForeignCurrency(null); }} style={inputStErr(errors.amount)} />
                {errors.amount && <div style={errSt}>{errors.amount}</div>}
              </div>
              <div className="rc-span">
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
              <div className="rc-span">
                <label style={labelSt}>Momssats {ocrFields.has('vatRate') && <OcrBadge />}</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[25, 12, 6, 0].map(v => {
                    const on = Number(form.vatRate) === v;
                    return (
                      <button
                        key={v} type="button" disabled={readOnly}
                        onClick={() => { setForm(f => ({ ...f, vatRate: v })); setOcrFields(s => { const n = new Set(s); n.delete('vatRate'); return n; }); }}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                          fontFamily: 'inherit', cursor: readOnly ? 'default' : 'pointer',
                          border: `1.5px solid ${on ? BRAND.green : 'var(--border)'}`,
                          background: on ? BRAND.greenLight : 'var(--bg-card)',
                          color: on ? BRAND.greenDark : 'var(--text-secondary)',
                          opacity: readOnly && !on ? 0.5 : 1,
                        }}
                      >
                        {v}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vad som faktiskt bokförs, medan man skriver. */}
              <div className="rc-span rc-split" aria-live="polite">
                <div>
                  <div className="rc-split-k">Netto</div>
                  <div className="rc-split-v">{hasAmount ? formatSEK2(netAmount) : '—'}</div>
                </div>
                <div>
                  <div className="rc-split-k">Moms {vatRate}%</div>
                  <div className="rc-split-v">{hasAmount ? formatSEK2(vatAmount) : '—'}</div>
                </div>
                <div>
                  <div className="rc-split-k">Totalt</div>
                  <div className="rc-split-v">{hasAmount ? formatSEK2(grossAmount) : '—'}</div>
                </div>
              </div>

              <div className="rc-span">
                <label style={labelSt}>Konto {ocrFields.has('costAccount') && <OcrBadge />}</label>
                {readOnly ? (
                  <div style={{ ...inputSt, background: 'var(--bg-muted)', color: 'var(--text-main)' }}>
                    {accountLabel ? `${accountLabel.code} – ${accountLabel.name}` : form.costAccount || '—'}
                  </div>
                ) : (
                  <>
                    <AccountSearch value={form.costAccount} onChange={code => { setForm(f => ({ ...f, costAccount: code })); setOcrFields(s => { const n = new Set(s); n.delete('costAccount'); return n; }); }} accounts={accounts} placeholder="Sök konto, t.ex. 6110 Kontorsmaterial..." />
                    {errors.costAccount && <div style={errSt}>{errors.costAccount}</div>}
                    {frequentAccounts.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Snabbval:</span>
                        {frequentAccounts.map(acc => (
                          <button key={acc.code} type="button" className="rc-chip" onClick={() => setForm(f => ({ ...f, costAccount: acc.code }))} title={acc.name}>
                            {acc.code}{acc.name ? ` ${acc.name}` : ''}
                          </button>
                        ))}
                      </div>
                    )}
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
                <button type="button" onClick={handleSave} style={{ padding: '9px 18px', background: BRAND.green, border: 'none', borderRadius: '9px', fontWeight: 600, color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(11, 99, 41, 0.28)' }}>
                  {readOnly ? 'Spara ändringar' : 'Spara och bokför'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Höger: dokumentet ── */}
        <DocumentPane
          url={receipt.receiptUrl}
          type={receipt.receiptType}
          emptyText="Ingen fil är sparad för det här kvittot. Uppgifterna bredvid går att fylla i ändå."
        />

      </div>
    </div>
  );
}

export default function Expenses({
  expenses = [], accounts = [], verifications = [], projects = [], user,
  onAdd, onFixExpenseAccount, onSaveReceiptDetails, onDeleteExpense, onReverseExpense,
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
  const receiptsList = statusFilter ? monthMatched.filter(r => getReceiptStatus(r, verifications) === statusFilter) : monthMatched;
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
          </div>

        </div>
      </ListPageHeader>

      {/* Mindre padding än övriga sidor (kundfeedback: "mindre mellanrum
          mellan sidhuvudet och kvittona, och de får täcka mer från
          sidorna") — särskilt toppen, där sidhuvudet redan ger egen luft. */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 20px' }}>
        {receiptsList.length === 0 ? (
          <EmptyReceiptsState text={
            q ? `Inga kvitton matchar "${query.trim()}".`
              : allReceipts.length > 0 ? 'Inga kvitton matchar det här filtret.'
                : undefined
          } />
        ) : (() => {
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
                  // Vem som laddade upp är bara intressant när det finns fler
                  // än en person att skilja på (samma resonemang som ovan).
                  const uploaderName = showUploaderTabs && effectiveTab === 'all' ? displayUploaderName(r.uploadedBy) : null;
                  const isImage = r.receiptType?.startsWith('image/') && r.receiptUrl;
                  const isPdf = r.receiptType === 'application/pdf' && r.receiptUrl;
                  return (
                    <div
                      key={r.id}
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
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(r.date)}{categoryName ? ` · ${categoryName}` : ''}</div>
                        {uploaderName && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>Uppladdat av {uploaderName}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-main)' }}>{formatSEK(r.amount)}</div>
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

      {detailReceipt && (
        <ReceiptDetailModal
          receipt={detailReceipt}
          accounts={accounts}
          projects={projects}
          allReceipts={allReceipts}
          status={getReceiptStatus(detailReceipt, verifications)}
          onSave={(id, values) => onSaveReceiptDetails?.(id, values)}
          onDelete={(id) => onDeleteExpense?.(id)}
          onReverse={(id) => onReverseExpense?.(id)}
          onClose={() => setDetailReceiptId(null)}
        />
      )}
    </div>
  );
}
