import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Receipt, X, Clock, Trash2, RotateCcw,
} from 'lucide-react';
import { AccountSearch } from './shared/SearchInputs';
import { uploadFileToStorage } from '../utils/fileUpload';
import { BRAND } from '../utils/brandColors';

// ── Formatting ──
const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

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
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
};
function inputStErr(hasError) { return { ...inputSt, borderColor: hasError ? '#ef4444' : '#d1d5db' }; }
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' };
const errSt = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };

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
    <div style={{ padding: '40px 24px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <div style={{ width: 52, height: 52, borderRadius: '999px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--text-muted)' }}>
        <Receipt size={22} />
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>{text || 'Inga kvitton uppladdade ännu. Ladda upp ditt första kvitto ovan för att börja.'}</p>
    </div>
  );
}

// ── Detaljvy per kvitto (Sida 34) — bild i full storlek till vänster,
// redigerbart formulär till höger. Kvittot finns redan i listan (skapades
// direkt vid uppladdning med tomma fält, se uploadReceipt i Expenses),
// den här modalen är hur man färdigställer/bokför det — eller, om det
// redan är bokfört, bara tittar på uppgifterna i efterhand. ──
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
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const isImage = receipt.receiptType?.startsWith('image/') && receipt.receiptUrl;
  const isPdf = receipt.receiptType === 'application/pdf' && receipt.receiptUrl;
  const accountLabel = accounts.find(a => a.code === form.costAccount);

  const handleSave = () => {
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
      const ok = window.confirm(`Det finns redan ett kvitto från "${dup.supplier}" på ${formatSEK(dup.amount)} samma datum. Vill du spara ändå?`);
      if (!ok) return;
    }

    onSave(receipt.id, {
      date: form.date, supplier: form.supplier.trim(), amount, vatRate: Number(form.vatRate),
      costAccount: form.costAccount, projectId: form.projectId || undefined, notes: form.notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: 920, maxHeight: '90vh', display: 'flex', flexWrap: 'wrap', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>

        {/* Vänster: bilden i full storlek */}
        <div style={{ flex: '1 1 340px', minWidth: 280, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '16px', maxHeight: '90vh' }}>
          {isImage && !imgFailed ? (
            <img src={receipt.receiptUrl} alt="Kvitto" onError={() => setImgFailed(true)} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }} />
          ) : isPdf ? (
            <a href={receipt.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'white', textDecoration: 'none' }}>
              <FileText size={48} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Öppna PDF-kvitto i ny flik</span>
            </a>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '0 20px' }}>
              <Receipt size={48} />
              <span style={{ fontSize: '13px' }}>{imgFailed ? 'Bilden kunde inte visas i den här webbläsaren (t.ex. HEIC).' : 'Ingen bild sparad för det här kvittot.'}</span>
            </div>
          )}
        </div>

        {/* Höger: formulär */}
        <div style={{ flex: '1 1 380px', minWidth: 300, padding: '24px', overflowY: 'auto', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>Kvittodetaljer</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
          </div>

          {status === 'reversed' ? (
            <div style={{ background: BRAND.grayBg, color: BRAND.grayText, borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RotateCcw size={14} /> Den här bokföringen har rättats med en motverifikation — originalet ändras aldrig i efterhand
            </div>
          ) : readOnly && (
            <div style={{ background: BRAND.greenLight, color: BRAND.greenDark, borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} /> Redan bokfört — belopp och konto kan inte ändras här
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={labelSt}>Datum</label>
              <input type="date" disabled={readOnly} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStErr(errors.date)} />
              {errors.date && <div style={errSt}>{errors.date}</div>}
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelSt}>Inköpsställe / Leverantör</label>
              <input type="text" disabled={readOnly} value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} style={inputStErr(errors.supplier)} />
              {errors.supplier && <div style={errSt}>{errors.supplier}</div>}
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={labelSt}>Belopp ink moms (kr)</label>
              <AmountInput disabled={readOnly} value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} style={inputStErr(errors.amount)} />
              {errors.amount && <div style={errSt}>{errors.amount}</div>}
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={labelSt}>Momssats</label>
              <select disabled={readOnly} value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: Number(e.target.value) }))} style={{ ...inputSt, background: 'white' }}>
                {[25, 12, 6, 0].map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 100%' }}>
              <label style={labelSt}>Konto</label>
              {readOnly ? (
                <div style={{ ...inputSt, background: '#f9fafb', color: '#111' }}>
                  {accountLabel ? `${accountLabel.code} – ${accountLabel.name}` : form.costAccount || '—'}
                </div>
              ) : (
                <>
                  <AccountSearch value={form.costAccount} onChange={code => setForm(f => ({ ...f, costAccount: code }))} accounts={accounts} placeholder="Sök konto, t.ex. 6110 Kontorsmaterial..." />
                  {errors.costAccount && <div style={errSt}>{errors.costAccount}</div>}
                </>
              )}
            </div>
            {projects.length > 0 && (
              <div style={{ flex: '1 1 100%' }}>
                <label style={labelSt}>Projekt (valfritt)</label>
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={{ ...inputSt, background: 'white' }}>
                  <option value="">Inget projekt</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ flex: '1 1 100%' }}>
              <label style={labelSt}>Anteckningar (valfritt)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            {status === 'booked' ? (
              // Bokförd — kan inte raderas (Bokföringslagen), men rättas med
              // en ny länkad motverifikation (handleReverseExpense i App.jsx),
              // samma princip som fakturors "Skapa en kreditfaktura".
              <button
                type="button"
                onClick={() => { if (window.confirm('Skapa en rättelseverifikation som nollar ut kontering och belopp för det här kvittot? Originalbokföringen finns kvar i historiken, bara raderas eller ändras aldrig.')) { onReverse(receipt.id); onClose(); } }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: BRAND.amberText, fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '8px 4px' }}
              >
                <RotateCcw size={14} /> Rätta bokföring
              </button>
            ) : status !== 'reversed' ? (
              <button
                type="button"
                onClick={() => { if (window.confirm('Ta bort det här kvittot? Det går inte att ångra.')) { onDelete(receipt.id); onClose(); } }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: BRAND.redText, fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '8px 4px' }}
              >
                <Trash2 size={14} /> Ta bort
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: 600, color: '#374151', cursor: 'pointer', fontSize: '13px' }}>Stäng</button>
              {status !== 'reversed' && (
                <button type="button" onClick={handleSave} style={{ padding: '8px 18px', background: BRAND.green, border: 'none', borderRadius: '8px', fontWeight: 600, color: 'white', cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 6px rgba(61, 122, 46, 0.25)' }}>
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
  const intervalsRef = useRef({});

  // -- Flikar + statusfilter (Sida 27) --
  const [viewTab, setViewTab] = useState('all'); // 'all' | 'mine'
  const [statusFilter, setStatusFilter] = useState(null); // null | 'unhandled' | 'pending' | 'booked'

  useEffect(() => () => {
    // Städa upp alla pågående upload-timers om komponenten avmonteras
    Object.values(intervalsRef.current).forEach(clearInterval);
  }, []); // eslint-disable-line

  const allReceipts = [...expenses.filter(e => e.type === 'receipt')].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Flikval och statusfilter kombineras, nollställer aldrig varandra —
  // "Mina kvitton" + "Ej hanterade" ska t.ex. gå att visa samtidigt.
  const tabFiltered = viewTab === 'mine' ? allReceipts.filter(r => r.uploadedBy?.id === user?.id) : allReceipts;
  const statusCounts = {
    unhandled: tabFiltered.filter(r => getReceiptStatus(r, verifications) === 'unhandled').length,
    pending: tabFiltered.filter(r => getReceiptStatus(r, verifications) === 'pending').length,
    booked: tabFiltered.filter(r => getReceiptStatus(r, verifications) === 'booked').length,
    reversed: tabFiltered.filter(r => getReceiptStatus(r, verifications) === 'reversed').length,
  };
  const receiptsList = statusFilter ? tabFiltered.filter(r => getReceiptStatus(r, verifications) === statusFilter) : tabFiltered;
  const receiptsTotal = receiptsList.reduce((s, r) => s + (r.amount || 0), 0);
  const detailReceipt = detailReceiptId ? allReceipts.find(r => r.id === detailReceiptId) : null;

  // ── Drag & drop / filhantering ──
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
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
  const uploadReceipt = (file) => {
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
    valid.forEach(uploadReceipt);
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
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>

      {/* ── Sidhuvud ─────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '16px 20px 0', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, color: 'var(--text-main)' }}>{pageTitle || 'Utgifter'}</h1>
        {pageSubtitle && <p style={{ margin: '2px 0 4px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>{pageSubtitle}</p>}
        {/* Kort förklaring av vad sidan faktiskt gör — kvittot sparas som en
            riktig bild (inte bara bokföringsfälten), och den bilden går att
            öppna igen när som helst från listan nedan. */}
        <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Ladda upp ett kvitto så syns det direkt i listan nedan — klicka på raden för att fylla i uppgifterna, se bilden i full storlek och bokföra.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {/* Uppladdningszon — en enda yta för både enskilda filer och en hel
            mapp (Sida 34), istället för separata konkurrerande ytor. */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('receipt-upload').click()}
          style={{
            border: `1.5px dashed ${isDragging ? BRAND.green : 'var(--gray-300)'}`,
            background: isDragging ? 'rgba(234,243,222,0.4)' : 'white',
            borderRadius: '12px', padding: '36px 20px', textAlign: 'center',
            cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', marginBottom: '24px',
          }}
        >
          <input type="file" id="receipt-upload" style={{ display: 'none' }} multiple accept={ACCEPT_ATTR} onChange={handleFileInput} />
          {/* Mappval kräver ett eget, separat <input> — webkitdirectory kan
              inte slås på/av dynamiskt på samma inputelement som filval. */}
          <input type="file" id="receipt-upload-folder" style={{ display: 'none' }} multiple webkitdirectory="" directory="" onChange={handleFileInput} />
          <div style={{ width: 44, height: 44, borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <UploadCloud size={20} color={BRAND.greenDark} />
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', margin: '0 0 4px' }}>
            Ladda upp kvitton
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
            Dra och släpp filer här, eller klicka för att välja — eller{' '}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); document.getElementById('receipt-upload-folder').click(); }}
              style={{ background: 'none', border: 'none', padding: 0, color: BRAND.green, fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', textDecoration: 'underline' }}
            >
              välj en hel mapp
            </button>
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>PDF, JPG, PNG eller HEIC. Max {MAX_FILE_MB} MB per fil, upp till {MAX_FILES} filer åt gången.</p>
        </div>

        {fileErrors.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
            {fileErrors.map((msg, i) => (
              <div key={i} style={{ fontSize: '13px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} /> {msg}
              </div>
            ))}
          </div>
        )}

        {/* Uploading states */}
        {uploadingFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {uploadingFiles.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
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

        {/* Tidigare utgifter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Tidigare utgifter</h3>
          {receiptsList.length > 0 && (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {receiptsList.length} {receiptsList.length === 1 ? 'utgift' : 'utgifter'} · {formatSEK(receiptsTotal)} totalt
            </span>
          )}
        </div>

        {/* Flikar: Alla kvitton / Mina kvitton (Sida 27) */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
          {[{ id: 'all', label: 'Alla kvitton' }, { id: 'mine', label: 'Mina kvitton' }].map(t => (
            <button
              key={t.id}
              onClick={() => setViewTab(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px',
                fontSize: '13.5px', fontWeight: viewTab === t.id ? 600 : 500,
                color: viewTab === t.id ? BRAND.green : 'var(--text-secondary)',
                borderBottom: `2px solid ${viewTab === t.id ? BRAND.green : 'transparent'}`,
                fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Statusfilter — klicka igen på en aktiv pill för att rensa den. */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: 'rgba(255,255,255,0.55)', color: meta.color }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {receiptsList.length === 0 ? (
            <EmptyReceiptsState text={allReceipts.length > 0 ? 'Inga kvitton matchar det här filtret.' : undefined} />
          ) : receiptsList.map(r => {
            const status = getReceiptStatus(r, verifications);
            const categoryName = accounts.find(a => a.code === r.costAccount)?.name;
            const uploaderName = viewTab === 'all' ? displayUploaderName(r.uploadedBy) : null;
            const isImage = r.receiptType?.startsWith('image/') && r.receiptUrl;
            const isPdf = r.receiptType === 'application/pdf' && r.receiptUrl;
            return (
              <div
                key={r.id}
                onClick={() => setDetailReceiptId(r.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)', cursor: 'pointer' }}
              >
                <div style={{ width: 52, height: 52, borderRadius: '10px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
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
