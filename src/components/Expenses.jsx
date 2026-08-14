import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Receipt, X, Clock,
} from 'lucide-react';
import { AccountSearch } from './shared/SearchInputs';
import { supabase } from '../supabaseClient';
import { BRAND } from '../utils/brandColors';

// ── Lightbox för kvittobilder — kärnfunktionen i att faktiskt kunna se ett
// uppladdat kvitto i full storlek, inte bara ett filnamn eller en generisk ikon. ──
function ReceiptLightbox({ url, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'zoom-out' }}>
      <img src={url} alt="Kvitto" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()} />
      <button onClick={onClose} style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '999px', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <X size={18} />
      </button>
    </div>
  );
}

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
function AmountInput({ value, onChange, style, placeholder, autoFocus }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
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
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** Laddar upp en kvittofil till samma Supabase Storage-bucket som profilbild/
 * logotyp använder (se supabase-setup.sql). Utan detta fanns ingen faktisk
 * bild kvar efter att ett kvitto sparats — bara bokföringsfälten — vilket
 * gjorde "se kvitton"-kravet omöjligt att uppfylla oavsett hur listan ritas. */
async function uploadReceiptFile(userId, file) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/receipts/${key}.${ext}`;
  const { error } = await supabase.storage.from('bokix-uploads').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('bokix-uploads').getPublicUrl(path);
  return data.publicUrl;
}

const inputSt = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
};
function inputStErr(hasError) { return { ...inputSt, borderColor: hasError ? '#ef4444' : '#d1d5db' }; }
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' };
const errSt = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };

// ── Status (Sida 27) — härledd, aldrig ett fält man kan sätta fritt ──
// "Ej hanterad": ingen kontering vald ännu (samma som befintlig Granska-
// status). "Pågående": kontering finns men den bokförda verifikationen är
// fortfarande ett utkast (status 'draft' — samma fält Verifikationer-sidans
// egna "Spara som utkast" redan använder). "Bokförd": kopplad verifikation
// är bokförd. Kvitton bokförs idag alltid direkt när ett konto väljs, så
// "Pågående" existerar redan som ett verkligt tillstånd i systemet men
// visar helt riktigt 0 kvitton just nu — det är inte en påhittad status,
// bara en som inget kvitto råkar vara i för tillfället.
function getReceiptStatus(receipt, verifications) {
  if (!receipt.costAccount) return 'unhandled';
  const ver = verifications.find(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === receipt.id);
  if (ver && (ver.status || 'booked') === 'draft') return 'pending';
  return 'booked';
}

const STATUS_META = {
  unhandled: { label: 'Ej hanterade', bg: BRAND.amberBg, color: BRAND.amberText },
  pending: { label: 'Pågående', bg: BRAND.grayBg, color: BRAND.grayText },
  booked: { label: 'Bokförda', bg: BRAND.greenLight, color: BRAND.greenDark },
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

export default function Expenses({
  expenses = [], accounts = [], verifications = [], user,
  onAdd, onFixExpenseAccount,
  pageTitle, pageSubtitle,
}) {
  // -- Receipts State --
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [pendingReceipts, setPendingReceipts] = useState([]); // { id, file, previewUrl, form:{...}, errors, saving }
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const intervalsRef = useRef({});

  // -- Flikar + statusfilter (Sida 27) --
  const [viewTab, setViewTab] = useState('all'); // 'all' | 'mine'
  const [statusFilter, setStatusFilter] = useState(null); // null | 'unhandled' | 'pending' | 'booked'

  useEffect(() => () => {
    // Städa upp alla pågående upload-timers och object URLs om komponenten avmonteras
    Object.values(intervalsRef.current).forEach(clearInterval);
    pendingReceipts.forEach(p => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
  }, []); // eslint-disable-line

  const allReceipts = [...expenses.filter(e => e.type === 'receipt')].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Flikval och statusfilter kombineras, nollställer aldrig varandra —
  // "Mina kvitton" + "Ej hanterade" ska t.ex. gå att visa samtidigt.
  const tabFiltered = viewTab === 'mine' ? allReceipts.filter(r => r.uploadedBy?.id === user?.id) : allReceipts;
  const statusCounts = {
    unhandled: tabFiltered.filter(r => getReceiptStatus(r, verifications) === 'unhandled').length,
    pending: tabFiltered.filter(r => getReceiptStatus(r, verifications) === 'pending').length,
    booked: tabFiltered.filter(r => getReceiptStatus(r, verifications) === 'booked').length,
  };
  const receiptsList = statusFilter ? tabFiltered.filter(r => getReceiptStatus(r, verifications) === statusFilter) : tabFiltered;
  const receiptsTotal = receiptsList.reduce((s, r) => s + (r.amount || 0), 0);

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

  const handleFiles = (files) => {
    const errors = [];
    const valid = [];
    files.forEach(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        errors.push(`${f.name}: filformatet stöds inte (endast JPG, PNG, WEBP och PDF).`);
      } else if (f.size > MAX_FILE_MB * 1024 * 1024) {
        errors.push(`${f.name}: filen är för stor (max ${MAX_FILE_MB} MB).`);
      } else {
        valid.push(f);
      }
    });
    setFileErrors(errors);
    if (valid.length === 0) return;

    const newUploads = valid.map(f => ({ file: f, progress: 0, id: `${Date.now()}_${Math.random()}` }));
    setUploadingFiles(prev => [...prev, ...newUploads]);

    newUploads.forEach(u => {
      let p = 0;
      const interval = setInterval(() => {
        p += 25;
        setUploadingFiles(curr => curr.map(x => x.id === u.id ? { ...x, progress: Math.min(p, 100) } : x));
        if (p >= 100) {
          clearInterval(interval);
          delete intervalsRef.current[u.id];
          setUploadingFiles(curr => curr.filter(x => x.id !== u.id));
          setPendingReceipts(curr => [...curr, {
            id: u.id,
            file: u.file,
            previewUrl: u.file.type.startsWith('image/') ? URL.createObjectURL(u.file) : null,
            form: { date: new Date().toISOString().split('T')[0], supplier: '', amount: '', vatRate: 25, costAccount: '' },
            errors: {},
            saving: false,
          }]);
        }
      }, 150);
      intervalsRef.current[u.id] = interval;
    });
  };

  const updatePendingForm = (id, patch) => {
    setPendingReceipts(curr => curr.map(p => p.id === id ? { ...p, form: { ...p.form, ...patch } } : p));
  };
  const discardPending = (id) => {
    setPendingReceipts(curr => {
      const item = curr.find(p => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return curr.filter(p => p.id !== id);
    });
  };

  const findDuplicateReceipt = (date, amount, supplier) => {
    // Alltid mot ALLA kvitton, oavsett vilken flik/statusfilter som råkar
    // vara aktivt just nu — annars kan en duplett missas bara för att man
    // tittar på "Mina kvitton" eller ett statusfilter.
    return allReceipts.find(r => r.date === date && Math.abs((r.amount || 0) - amount) < 0.01 && (r.supplier || '').trim().toLowerCase() === (supplier || '').trim().toLowerCase());
  };

  const handleSaveReceipt = async (pending) => {
    const { form } = pending;
    const errors = {};
    const amount = parseAmount(form.amount);
    if (!form.date) errors.date = 'Datum krävs.';
    if (!form.supplier.trim()) errors.supplier = 'Inköpsställe krävs.';
    if (isNaN(amount) || amount <= 0) errors.amount = 'Ange ett giltigt belopp.';
    if (!form.costAccount) errors.costAccount = 'Välj ett konto.';
    if (Object.keys(errors).length > 0) {
      setPendingReceipts(curr => curr.map(p => p.id === pending.id ? { ...p, errors } : p));
      return;
    }

    const dup = findDuplicateReceipt(form.date, amount, form.supplier);
    if (dup) {
      const ok = window.confirm(`Det finns redan ett kvitto från "${dup.supplier}" på ${formatSEK(dup.amount)} samma datum. Vill du spara ändå?`);
      if (!ok) return;
    }

    const vatRate = Number(form.vatRate) || 0;
    const netAmount = vatRate > 0 ? Math.round((amount / (1 + vatRate / 100)) * 100) / 100 : amount;
    const vatAmount = Math.round((amount - netAmount) * 100) / 100;

    setPendingReceipts(curr => curr.map(p => p.id === pending.id ? { ...p, saving: true, errors: {} } : p));

    // Kvittobilden laddas upp till Supabase Storage innan posten bokförs, så
    // att listan faktiskt kan visa en riktig thumbnail efteråt — inte bara
    // bokföringsfälten. Om uppladdningen misslyckas (t.ex. bucketen saknas
    // ännu) bokförs utgiften ändå, men användaren informeras ärligt om att
    // bilden saknas istället för att den tyst försvinner.
    let receiptUrl = null, receiptType = null, uploadWarning = null;
    if (user?.id) {
      try {
        receiptUrl = await uploadReceiptFile(user.id, pending.file);
        receiptType = pending.file.type;
      } catch (err) {
        uploadWarning = /bucket not found/i.test(err.message || '')
          ? 'Bildlagring är inte konfigurerad i Supabase-projektet ännu (se supabase-setup.sql) — kvittot bokfördes, men utan bild.'
          : `Kunde inte spara kvittobilden (${err.message}) — kvittot bokfördes, men utan bild.`;
      }
    }

    onAdd?.({
      type: 'receipt', date: form.date, description: form.supplier, supplier: form.supplier,
      amount, netAmount, vatAmount, vatRate, costAccount: form.costAccount, autoBooked: true,
      receiptUrl, receiptType,
      // Sida 27: krävs för att kunna skilja "Alla kvitton" från "Mina
      // kvitton" och visa vem som laddat upp vad i ett flerpersonskonto.
      uploadedBy: user?.id ? {
        id: user.id,
        name: [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' '),
        email: user?.email || '',
      } : null,
    });
    if (uploadWarning) window.alert(uploadWarning);
    discardPending(pending.id);
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
        {pageSubtitle && <p style={{ margin: '2px 0 16px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>{pageSubtitle}</p>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {/* Uppladdningszon */}
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
          <input type="file" id="receipt-upload" style={{ display: 'none' }} multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileInput} />
          <div style={{ width: 44, height: 44, borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <UploadCloud size={20} color={BRAND.greenDark} />
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', margin: '0 0 4px' }}>
            Dra hit ett kvitto eller klicka för att ladda upp
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Stödjer JPG, PNG och PDF (max {MAX_FILE_MB} MB)</p>
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

        {/* Manuell inmatning per uppladdat kvitto — ingen riktig OCR-tjänst är
            kopplad, så vi låtsas aldrig att fälten är automatiskt uttolkade. */}
        {pendingReceipts.map(pending => (
          <div key={pending.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '20px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ width: 96, height: 96, background: 'var(--gray-100)', borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {pending.previewUrl
                ? <img src={pending.previewUrl} alt={pending.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <FileText size={32} color="var(--text-muted)" />}
            </div>
            {/* flex:1 + minWidth 260px istället för fast bredd: på smala
                skärmar tar formuläret hela raden under förhandsvisningen
                istället för att klämmas ihop bredvid den. */}
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{pending.file.name}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>— fyll i uppgifterna nedan (ingen automatisk avläsning ännu)</span>
              </div>
              {/* Flex+wrap istället för ett fast 2-kolumners grid: varje fält
                  har en minsta bredd men får krympa till en enda kolumn på
                  mobil utan en separat @media-regel. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={labelSt}>Datum</label>
                  <input type="date" value={pending.form.date} onChange={e => updatePendingForm(pending.id, { date: e.target.value })} style={inputStErr(pending.errors.date)} />
                  {pending.errors.date && <div style={errSt}>{pending.errors.date}</div>}
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelSt}>Inköpsställe / Leverantör</label>
                  <input type="text" value={pending.form.supplier} onChange={e => updatePendingForm(pending.id, { supplier: e.target.value })} style={inputStErr(pending.errors.supplier)} />
                  {pending.errors.supplier && <div style={errSt}>{pending.errors.supplier}</div>}
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={labelSt}>Belopp ink moms (kr)</label>
                  <AmountInput value={pending.form.amount} onChange={v => updatePendingForm(pending.id, { amount: v })} style={inputStErr(pending.errors.amount)} />
                  {pending.errors.amount && <div style={errSt}>{pending.errors.amount}</div>}
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={labelSt}>Momssats</label>
                  <select value={pending.form.vatRate} onChange={e => updatePendingForm(pending.id, { vatRate: Number(e.target.value) })} style={{ ...inputSt, background: 'white' }}>
                    {[25, 12, 6, 0].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 100%' }}>
                  <label style={labelSt}>Konto</label>
                  <AccountSearch value={pending.form.costAccount} onChange={code => updatePendingForm(pending.id, { costAccount: code })} accounts={accounts} placeholder="Sök konto, t.ex. 6110 Kontorsmaterial..." />
                  {pending.errors.costAccount && <div style={errSt}>{pending.errors.costAccount}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                <button type="button" disabled={pending.saving} onClick={() => discardPending(pending.id)} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: 600, color: '#374151', cursor: pending.saving ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: pending.saving ? 0.5 : 1 }}>Ta bort</button>
                <button type="button" disabled={pending.saving} onClick={() => handleSaveReceipt(pending)} style={{ padding: '8px 16px', background: BRAND.green, border: 'none', borderRadius: '8px', fontWeight: 600, color: 'white', cursor: pending.saving ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: pending.saving ? 0.7 : 1, boxShadow: '0 2px 6px rgba(61, 122, 46, 0.25)' }}>
                  {pending.saving ? 'Sparar...' : 'Spara och bokför'}
                </button>
              </div>
            </div>
          </div>
        ))}

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
            const canOpenReceipt = isImage || isPdf;
            // PDF-kvitton hade tidigare ingen klickyta alls — bara en ikon.
            // Att "kunna se kvittobilder" gäller lika mycket ett PDF-kvitto
            // som ett foto, så båda öppnas nu (bild i lightbox, PDF i en ny
            // flik — webbläsaren renderar PDF:er bättre själv än vi kan här).
            const openReceipt = () => { if (isImage) setLightboxUrl(r.receiptUrl); else if (isPdf) window.open(r.receiptUrl, '_blank', 'noopener'); };
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)' }}>
                <div
                  onClick={openReceipt}
                  title={isImage ? 'Visa kvitto i full storlek' : isPdf ? 'Öppna PDF-kvitto' : undefined}
                  style={{ width: 52, height: 52, borderRadius: '10px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', cursor: canOpenReceipt ? 'pointer' : 'default' }}
                >
                  {isImage ? (
                    <img src={r.receiptUrl} alt="Kvitto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : isPdf ? (
                    <FileText size={20} color={BRAND.greenDark} />
                  ) : (
                    <Receipt size={20} color="var(--text-muted)" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.supplier || r.description}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(r.date)}{categoryName ? ` · ${categoryName}` : ''}</div>
                  {uploaderName && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>Uppladdat av {uploaderName}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-main)' }}>{formatSEK(r.amount)}</div>
                  {status === 'booked' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '11.5px', color: BRAND.greenDark, fontWeight: 600, marginTop: '2px' }}>
                      <CheckCircle2 size={12} /> Bokförd
                    </div>
                  ) : status === 'pending' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '11.5px', color: BRAND.grayText, fontWeight: 600, marginTop: '2px' }}>
                      <Clock size={12} /> Pågående
                    </div>
                  ) : fixingId === r.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <div style={{ width: 180 }}>
                        <AccountSearch value={fixAccount} onChange={setFixAccount} accounts={accounts} placeholder="Välj konto..." />
                      </div>
                      <button onClick={() => applyFix(r.id)} style={{ padding: '5px 10px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Spara</button>
                    </div>
                  ) : (
                    <button onClick={() => { setFixingId(r.id); setFixAccount(''); }} title="Kunde inte bokföras automatiskt — konto saknas" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', background: 'none', border: 'none', color: BRAND.amberText, fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', padding: 0, marginLeft: 'auto', marginTop: '2px' }}>
                      <AlertCircle size={12} /> Granska
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lightboxUrl && <ReceiptLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}
