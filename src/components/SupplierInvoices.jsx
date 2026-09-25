import React, { useState, useEffect, useRef } from 'react';
import DateField from './shared/DateField';
import { isReverseChargePurchaseAccount } from '../utils/reverseCharge';
import {
  Plus, Check, X, AlertCircle, Landmark, CreditCard, UploadCloud, FileText, Inbox, Trash2, Search, RefreshCw, Printer, Eye,
} from './icons';
import { AccountSearch, ProjectSearch } from './shared/SearchInputs';
import ListPageHeader, { listHeaderButtonStyle, listSearchInputStyle, listFilterFieldStyle, PAGE_SIZE_OPTIONS } from './shared/ListPageHeader';
import RowActionMenu from './shared/RowActionMenu';
import { STRONG_PAID, STRONG_UNPAID, STRONG_OVERDUE, getRowBg } from './shared/invoiceStatusStyle';
import ListTable from './shared/ListTable';
import { uploadFileToStorage } from '../utils/fileUpload';
import { useSignedUrl } from '../utils/signedUrls';
import { BRAND } from '../utils/brandColors';
import { confirmDialog } from './shared/ConfirmDialog';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};
// Öre-precision för konteringsradernas belopp/moms (till skillnad från
// formatSEK ovan, som avrundar till hel krona och lägger till "kr" — de
// visar summeringens FÄRDIGA, avrundade totalsumma, inte enskilda rader).
const fmtNum = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function SupplierInvoiceAttachment({ url, name, isImage, isPdf }) {
  const activeUrl = useSignedUrl(url);
  if (!activeUrl) return null;
  return (
    <>
      <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Underlag</h3>
      {isImage ? (
        <img src={activeUrl} alt={name || 'Underlag'} style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '8px', objectFit: 'contain', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
      ) : (
        <a href={activeUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: BRAND.green, fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
          <FileText size={18} /> {isPdf ? 'Öppna PDF-underlag' : (name || 'Öppna underlag')}
        </a>
      )}
    </>
  );
}

const AMOUNT_RE = /^\d*[.,]?\d{0,2}$/;
function AmountInput({ value, onChange, style, placeholder, autoFocus }) {
  return (
    <input
      type="text" inputMode="decimal" autoFocus={autoFocus} value={value}
      onChange={e => { const v = e.target.value; if (v === '' || AMOUNT_RE.test(v)) onChange(v); }}
      placeholder={placeholder || '0,00'} style={style}
    />
  );
}
function parseAmount(str) {
  if (str === '' || str == null) return NaN;
  return parseFloat(String(str).replace(',', '.'));
}

const inputSt = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  background: 'var(--bg-card)', color: 'var(--text-main)',
};
function inputStErr(hasError) { return { ...inputSt, borderColor: hasError ? '#ef4444' : 'var(--border)' }; }
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const errSt = { fontSize: '12px', color: 'var(--status-red-text)', marginTop: '4px' };
const helpSt = { fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 };

// Statusfärgerna kommer från shared/invoiceStatusStyle.js, samma som
// Kundfakturor, så de två sidorna läses som en produkt.
function StatusBadge({ status }) {
  const map = {
    paid: { label: 'Betald', bg: STRONG_PAID.bg, color: STRONG_PAID.text },
    unpaid: { label: 'Obetald', bg: STRONG_UNPAID.bg, color: STRONG_UNPAID.text },
    overdue: { label: 'Förfallen', bg: STRONG_OVERDUE.bg, color: STRONG_OVERDUE.text },
  };
  const st = map[status] || map.unpaid;
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>;
}

// ── Leverantörskombobox med inline "Lägg till ny leverantör" ────────────────
function SupplierCombo({ value, onChange, contacts, setContacts }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const suppliers = contacts.filter(c => c.type === 'supplier');

  if (creating) {
    return (
      <div style={{ border: '1px dashed var(--text-muted)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Leverantörens namn" style={inputSt} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => { setCreating(false); setNewName(''); }} style={{ padding: '6px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Avbryt</button>
          <button
            type="button" disabled={!newName.trim()}
            onClick={() => {
              const id = `contact_${Date.now()}`;
              setContacts(prev => [...prev, {
                id, type: 'supplier', supplierType: 'se_company', name: newName.trim(), orgNr: '',
                contactPerson: '', email: '', phone: '', address: '', postalCode: '', city: '', country: 'Sverige',
                defaultCurrency: 'SEK', notes: '', active: true,
              }]);
              onChange(id);
              setCreating(false); setNewName('');
            }}
            style={{ padding: '6px 14px', background: newName.trim() ? BRAND.green : 'var(--border)', border: 'none', borderRadius: '6px', color: newName.trim() ? 'white' : 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'not-allowed' }}
          >Lägg till</button>
        </div>
      </div>
    );
  }

  return (
    <select value={value} onChange={e => e.target.value === '__new__' ? setCreating(true) : onChange(e.target.value)} style={{ ...inputSt, background: 'var(--bg-card)' }}>
      <option value="">Välj leverantör...</option>
      {suppliers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value="__new__">+ Lägg till ny leverantör...</option>
    </select>
  );
}

// ── Kontering: konstanter + radhjälpare ──────────────────────────────────
const VAT_RATES = [25, 12, 6, 0];
const CURRENCIES = ['SEK', 'NOK', 'EUR', 'USD', 'GBP'];
const MAX_ATTACHMENT_MB = 10;
const ACCEPTED_ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const newRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emptyKonteringRow = () => ({ id: newRowId(), account: '', description: '', netAmount: '', vatRate: 25 });

// ── Toggle-kort (Förval/Omvänd skattskyldighet/Öresavrundning) — en
// kryssruta med rubrik + förklarande text i samma klickbara yta, istället
// för en bar <input type=checkbox> utan sammanhang. ──
function ToggleCard({ checked, onChange, title, description }) {
  return (
    <label style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px',
      border: `1px solid ${checked ? BRAND.green : 'var(--border)'}`,
      background: checked ? BRAND.greenLight : 'var(--bg-card)',
      borderRadius: '10px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
    }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: '2px', cursor: 'pointer', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{title}</div>
        {description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>{description}</div>}
      </div>
    </label>
  );
}

// ── Underlag: bifoga fakturan som PDF/bild ──────────────────────────────
// Ärlig text med flit: appen läser INTE leverantör/datum/belopp automatiskt
// än (ingen OCR-/AI-tolkning byggd) — underlaget sparas som en riktig bild/
// PDF man kan öppna igen senare, uppgifterna nedan fylls i för hand.
function AttachmentField({ file, previewUrl, onSelect, onRemove, error, busy }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const isImage = file?.type?.startsWith('image/');
  const isPdf = file?.type === 'application/pdf';

  const handleFiles = (files) => { if (files?.[0]) onSelect(files[0]); };

  return (
    <div>
      <input
        ref={inputRef} type="file" accept={ACCEPTED_ATTACHMENT_TYPES.join(',')} style={{ display: 'none' }}
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      <div
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `1.5px dashed ${dragOver ? BRAND.green : 'var(--gray-300)'}`,
          background: dragOver ? 'rgba(234,243,222,0.4)' : 'var(--bg-card)',
          borderRadius: '10px', padding: file ? '16px' : '28px 16px', textAlign: 'center',
          cursor: file ? 'default' : 'pointer', transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {file ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {isImage ? (
              <img src={previewUrl} alt={file.name} style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', objectFit: 'contain' }} />
            ) : isPdf ? (
              <FileText size={28} color="var(--text-main)" />
            ) : null}
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-all' }}>{file.name}</span>
            <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '999px', padding: '4px 14px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Ta bort</button>
          </div>
        ) : (
          <>
            <UploadCloud size={22} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>Bifoga fakturan</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Dra hit eller klicka — PDF, JPG, PNG eller WEBP, max {MAX_ATTACHMENT_MB} MB</div>
          </>
        )}
      </div>
      {error && (
        <div style={errSt}><AlertCircle size={12} style={{ verticalAlign: '-1px', marginRight: '4px' }} />{error}</div>
      )}
      {busy && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>Laddar upp underlag…</div>}
      <p style={helpSt}>Sparas tillsammans med registreringen och går att öppna igen från listan senare. Leverantör, datum och belopp fylls i manuellt nedan.</p>
    </div>
  );
}

// ── Fullsidesformulär: registrera en leverantörsfaktura ──────────────────
// Samma mönster som Kundfakturans InvoiceForm (Invoices.jsx): fyller HELA
// sidan (ersätter listan i samma komponent) istället för att öppnas som en
// liten modal, och lämnas via en vanlig "← Tillbaka"-knapp — ingen
// sidnavigering, ingen route-ändring.
function SupplierInvoiceForm({ contacts, setContacts, accounts, projects = [], user, uploadFn, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [ocrNumber, setOcrNumber] = useState('');
  const [rows, setRows] = useState([emptyKonteringRow()]);
  const [paidByOwnerPrivately, setPaidByOwnerPrivately] = useState(false);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [currency, setCurrency] = useState('SEK');
  const [roundToKrona, setRoundToKrona] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState('');
  const [statedTotal, setStatedTotal] = useState('');
  const [errors, setErrors] = useState({});

  const [attachment, setAttachment] = useState(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  useEffect(() => {
    if (!attachment) { setAttachmentPreviewUrl(null); return; }
    const url = URL.createObjectURL(attachment);
    setAttachmentPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const selectAttachment = (file) => {
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) { setAttachmentError(`"${file.name}" är inte en PDF eller bild.`); return; }
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) { setAttachmentError(`"${file.name}" är för stor (max ${MAX_ATTACHMENT_MB} MB).`); return; }
    setAttachmentError('');
    setAttachment(file);
  };

  const addRow = () => setRows(r => [...r, emptyKonteringRow()]);
  const updateRow = (i, field, val) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  const removeRow = (i) => setRows(r => r.length > 1 ? r.filter((_, idx) => idx !== i) : r);

  // Omvänd skattskyldighet: fakturan bokförs utan moms (Sida-kommentaren i
  // App.jsx: handleAddSupplierInvoice nollar momsen helt när reverseCharge
  // är satt) — så momskolumnen visas som "—" och räknas som 0 här, istället
  // för att visa ett tal som ändå aldrig bokförs.
  const calcRow = (row) => {
    const net = parseAmount(row.netAmount);
    const netSafe = isNaN(net) ? 0 : net;
    const vat = reverseCharge ? 0 : netSafe * (row.vatRate / 100);
    return { net: netSafe, vat };
  };
  const totals = rows.reduce((acc, row) => {
    const c = calcRow(row);
    return { net: acc.net + c.net, vat: acc.vat + c.vat };
  }, { net: 0, vat: 0 });
  const gross = totals.net + totals.vat;
  const roundedGross = Math.round(gross);

  const statedTotalNum = parseAmount(statedTotal);
  const showTotalMismatch = statedTotal !== '' && !isNaN(statedTotalNum) && Math.abs(statedTotalNum - gross) > 1;

  const validate = () => {
    const errs = {};
    if (!supplierId) errs.supplierId = 'Välj en leverantör.';
    if (!invoiceNumber.trim()) errs.invoiceNumber = 'Fakturanummer krävs.';
    if (!date) errs.date = 'Fakturadatum krävs.';
    if (dueDate && date && dueDate < date) errs.dueDate = 'Förfallodatum kan inte vara före fakturadatum.';
    const validRows = rows.filter(r => r.account && parseAmount(r.netAmount) > 0);
    if (validRows.length === 0) errs.rows = 'Lägg till minst en konteringsrad med konto och belopp.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    let attachmentUrl, attachmentName, attachmentType;
    if (attachment) {
      if (!user?.id) { setAttachmentError('Kunde inte ladda upp underlaget — inte inloggad.'); return; }
      setAttachmentBusy(true); setAttachmentError('');
      try {
        attachmentUrl = await uploadFn(user.id, attachment, 'supplier-invoices');
        attachmentName = attachment.name;
        attachmentType = attachment.type;
      } catch (err) {
        setAttachmentBusy(false);
        setAttachmentError(/bucket not found/i.test(err.message || '')
          ? 'Bildlagring är inte konfigurerad i Supabase-projektet ännu (se supabase-setup.sql).'
          : `Kunde inte ladda upp underlaget (${err.message || 'okänt fel'}).`);
        return;
      }
      setAttachmentBusy(false);
    }

    const cleanRows = rows
      .filter(r => r.account && parseAmount(r.netAmount) > 0)
      .map(r => {
        const net = parseAmount(r.netAmount);
        const vatRate = reverseCharge ? 0 : r.vatRate;
        return { account: r.account, description: r.description.trim() || undefined, netAmount: net, vatRate, vatAmount: net * (vatRate / 100) };
      });
    const netTotal = cleanRows.reduce((s, r) => s + r.netAmount, 0);
    const vatTotal = cleanRows.reduce((s, r) => s + r.vatAmount, 0);
    const supplierName = contacts.find(c => c.id === supplierId)?.name || '';

    onSave({
      supplierId, supplier: supplierName,
      invoiceNumber: invoiceNumber.trim(), date, dueDate: dueDate || undefined,
      ocrNumber: ocrNumber.trim() || undefined,
      description: `Leverantörsfaktura ${invoiceNumber.trim()}`,
      rows: cleanRows, netAmount: netTotal, vatAmount: vatTotal, amount: Math.round(netTotal + vatTotal),
      reverseCharge, paidByOwnerPrivately, currency,
      // roundingDiff (Sida-kommentaren i App.jsx: bokförs mot 3740 Öres- och
      // kronutjämning) — mellanskillnaden mellan konteringens exakta summa
      // och fakturatotalen avrundad till hel krona, bara när kryssrutan är
      // satt. Backend avrundar ändå alltid själva betalningsraden till hel
      // krona (Math.round) — det här fångar bara ÖRET som annars försvinner
      // tyst mellan de separat avrundade raderna och den avrundade totalen.
      roundToKrona, roundingDiff: roundToKrona ? roundedGross - gross : 0,
      deliveryDate: deliveryDate || undefined,
      costCenter: costCenter.trim() || undefined,
      projectId: projectId || undefined,
      notes: notes.trim() || undefined,
      statedTotal: isNaN(statedTotalNum) ? undefined : statedTotalNum,
      attachmentUrl, attachmentName, attachmentType,
    });
  };

  return (
    <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
      {/* ── Top bar — samma mönster som Kundfakturans InvoiceForm. ── */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Tillbaka
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Ny leverantörsfaktura</h1>
        <div style={{ flex: 1, minWidth: '8px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onClose} style={listHeaderButtonStyle('secondary')}>Avbryt</button>
          <button type="button" onClick={submit} disabled={attachmentBusy} style={{ ...listHeaderButtonStyle('primary'), opacity: attachmentBusy ? 0.6 : 1 }}>
            <Check size={14} /> {attachmentBusy ? 'Laddar upp…' : 'Registrera faktura'}
          </button>
        </div>
      </div>

      <div className="sup-form" style={{ flex: 1, overflowY: 'auto' }}>
        {/* Kundfeedback: kändes smalare/mindre "rymlig" än Kundfakturans
            InvoiceForm, som stretchar hela bredden. 820px var i smalaste
            laget för ett formulär med flera 2-kolumnsrader (varje fält blev
            väldigt smalt) — bredare kolumn (inte hela bredden, medvetet:
            en riktig faktura med rader/mallval/förhandsgranskning är en
            annan sorts sida än den här enklare kvitto-registreringen, se
            kommentaren vid Fler alternativ-borttaget i Invoices.jsx för
            samma resonemang åt andra hållet) — mer luft utan att sträcka ut
            varje enskilt inputfält orimligt brett på en stor skärm. */}
        <div style={{ maxWidth: '1040px', margin: '0 auto' }}>

          {/* Underlag */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>Underlag <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(rekommenderas)</span></h3>
            <AttachmentField file={attachment} previewUrl={attachmentPreviewUrl} onSelect={selectAttachment} onRemove={() => setAttachment(null)} error={attachmentError} busy={attachmentBusy} />
          </div>

          {/* Leverantör */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Leverantör *</h3>
            <SupplierCombo value={supplierId} onChange={setSupplierId} contacts={contacts} setContacts={setContacts} />
            {errors.supplierId && <div style={errSt}>{errors.supplierId}</div>}
          </div>

          {/* Fakturauppgifter */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Fakturauppgifter</h3>
            <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={labelSt}>Leverantörens fakturanummer *</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Fakturanr från leverantören" style={inputStErr(errors.invoiceNumber)} />
                {errors.invoiceNumber && <div style={errSt}>{errors.invoiceNumber}</div>}
              </div>
              <div>
                <label style={labelSt}>OCR / Betalningsreferens</label>
                <input value={ocrNumber} onChange={e => setOcrNumber(e.target.value)} placeholder="OCR-nummer" style={inputSt} />
              </div>
            </div>
            <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelSt}>Fakturadatum *</label>
                <DateField value={date} onChange={e => setDate(e.target.value)} placeholder="Välj datum" style={inputStErr(errors.date)} />
                {errors.date && <div style={errSt}>{errors.date}</div>}
              </div>
              <div>
                <label style={labelSt}>Förfallodatum</label>
                <DateField value={dueDate} onChange={e => setDueDate(e.target.value)} placeholder="Välj datum" style={inputStErr(errors.dueDate)} />
                {errors.dueDate && <div style={errSt}>{errors.dueDate}</div>}
              </div>
            </div>
          </div>

          {/* Kontering */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Kontering *</h3>
            <div className="sup-rows-scroll" style={{ overflowX: 'auto' }}>
              <div className="sup-rows-min" style={{ minWidth: '680px' }}>
                <div className="sup-rows-header" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1fr 0.8fr 0.9fr auto', gap: '10px', marginBottom: '8px', padding: '0 2px' }}>
                  {['Konto', 'Beskrivning', 'Belopp (exkl.)', 'Momssats', 'Moms', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: (i === 2 || i === 3 || i === 4) ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                {rows.map((row, i) => {
                  const { vat } = calcRow(row);
                  return (
                    <div key={row.id} className="sup-row" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1fr 0.8fr 0.9fr auto', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                      <div className="qr-cell sup-acct"><span className="qr-lbl">Konto</span>
                      <AccountSearch value={row.account} onChange={code => updateRow(i, 'account', code)} accounts={accounts} placeholder="Sök konto…" />
                      </div>
                      <div className="qr-cell sup-desc"><span className="qr-lbl">Beskrivning</span>
                      <input value={row.description} onChange={e => updateRow(i, 'description', e.target.value)} placeholder="beskrivning" style={inputSt} />
                      </div>
                      <div className="qr-cell"><span className="qr-lbl">Belopp exkl. moms</span>
                      <AmountInput value={row.netAmount} onChange={v => updateRow(i, 'netAmount', v)} style={{ ...inputSt, textAlign: 'right' }} />
                      </div>
                      <div className="qr-cell"><span className="qr-lbl">Momssats</span>
                      {reverseCharge ? (
                        <div style={{ ...inputSt, textAlign: 'right', color: 'var(--text-muted)' }}>—</div>
                      ) : (
                        <select value={row.vatRate} onChange={e => updateRow(i, 'vatRate', Number(e.target.value))} style={inputSt}>
                          {VAT_RATES.map(v => <option key={v} value={v}>{v} %</option>)}
                        </select>
                      )}
                      </div>
                      <div className="qr-cell"><span className="qr-lbl">Moms</span>
                      <div style={{ ...inputSt, textAlign: 'right', background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>{reverseCharge ? '—' : fmtNum(vat)}</div>
                      </div>
                      <button className="qr-remove" type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} title="Ta bort rad" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: rows.length === 1 ? 'not-allowed' : 'pointer', color: rows.length === 1 ? 'var(--border)' : '#ef4444' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', marginTop: '4px' }}>
              <Plus size={14} /> Lägg till rad
            </button>
            {errors.rows && <div style={{ ...errSt, marginTop: '8px' }}>{errors.rows}</div>}
          </div>

          {/* Förval */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Förval</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>Bokförs vid registrering.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <ToggleCard
                checked={paidByOwnerPrivately} onChange={setPaidByOwnerPrivately}
                title="Jag har betalat detta privat"
                description="Bokförs som skuld från bolaget till dig (2018 Egen insättning). Återbetalas senare manuellt från företagskontot."
              />
              <ToggleCard
                checked={reverseCharge} onChange={setReverseCharge}
                title="Omvänd skattskyldighet"
                description={reverseCharge && !rows.some(r => isReverseChargePurchaseAccount(r.account))
                  ? 'Tjänst från utlandet: välj konto 4535 (EU) eller 4531 (utanför EU) på konteringsraden, så bokförs momsen automatiskt. Utan det bokförs ingen moms. Byggtjänster i Sverige hanteras inte än.'
                  : 'Tjänst från utlandet: momsen redovisas av dig. Fakturan bokförs utan moms, och med konto 4535 (EU) eller 4531 (utanför EU) läggs momsraderna till automatiskt.'}
              />
            </div>
          </div>

          {/* Valuta + Öresavrundning */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
              <div>
                <label style={labelSt}>Valuta</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputSt}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
                {currency !== 'SEK' && <p style={helpSt}>Beloppen ovan bokförs i SEK som de anges — omräkning från annan valuta stöds inte än.</p>}
              </div>
              <div>
                <label className="sup-hidden-label" style={{ ...labelSt, visibility: 'hidden' }}>Öresavrundning</label>
                <ToggleCard checked={roundToKrona} onChange={setRoundToKrona} title="Öresavrundning" description="Avrunda fakturatotal till hel krona." />
              </div>
            </div>
          </div>

          {/* Leveransdatum */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <label style={labelSt}>Leveransdatum <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(ML krav)</span></label>
            <DateField value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} placeholder="Välj leveransdatum" style={{ ...inputSt, maxWidth: '220px' }} />
          </div>

          {/* Kostnadsställe/Projekt */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Kostnadsställe/Projekt</h3>
            <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelSt}>Kostnadsställe</label>
                <input value={costCenter} onChange={e => setCostCenter(e.target.value)} placeholder="Ange kostnadsställe" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Projekt</label>
                <ProjectSearch value={projectId} onChange={setProjectId} projects={projects} />
              </div>
            </div>
          </div>

          {/* Anteckningar */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <label style={labelSt}>Anteckningar</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Interna anteckningar om denna faktura..." style={{ ...inputSt, resize: 'vertical' }} />
          </div>

          {/* Summering */}
          <div style={{ padding: '24px 32px' }}>
            <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '360px', marginLeft: 'auto', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Netto (exkl. moms)</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatSEK(totals.net)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Moms</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatSEK(totals.vat)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '4px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Totalt att betala</span>
                <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>{formatSEK(roundedGross)}</span>
              </div>
            </div>
            <div style={{ maxWidth: '360px', marginLeft: 'auto', marginTop: '14px' }}>
              <label style={labelSt}>Totalt enligt fakturan <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(valfritt)</span></label>
              <AmountInput value={statedTotal} onChange={setStatedTotal} placeholder="0,00" style={inputSt} />
              {showTotalMismatch && (
                <div style={{ ...errSt, color: BRAND.amberText }}>
                  Skiljer sig {formatSEK(Math.abs(statedTotalNum - gross))} från konteringens summa — kontrollera raderna innan du sparar.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Läsläge: en redan registrerad leverantörsfaktura ──────────────────────
// Klick på en rad i listan öppnar den här — i samma komponent, ingen
// sidnavigering — istället för att antingen inte göra något alls eller
// navigera bort. Rent läsläge (samma princip som Kundfakturans "Visa
// faktura"): en redan bokförd faktura ändras inte i efterhand, den rättas
// via ny kontering (Granska/"Välj konto" i listan) om den saknar sådan än.
function SupplierInvoiceViewer({ invoice, contacts, accounts, projects, onClose, onPay, onUnmarkPaid }) {
  const supplier = contacts.find(c => c.id === invoice.supplierId);
  // Bakåtkompatibilitet: äldre poster (innan flerradskontering fanns) har
  // bara ett enda `costAccount`/`netAmount`/`vatAmount` istället för `rows`.
  const displayRows = invoice.rows?.length
    ? invoice.rows
    : (invoice.costAccount ? [{ account: invoice.costAccount, description: invoice.description, netAmount: invoice.netAmount ?? invoice.amount, vatAmount: invoice.vatAmount ?? 0 }] : []);
  const needsReview = displayRows.length === 0;
  const netTotal = displayRows.reduce((s, r) => s + (r.netAmount || 0), 0);
  const vatTotal = invoice.reverseCharge ? 0 : displayRows.reduce((s, r) => s + (r.vatAmount || 0), 0);
  const project = projects.find(p => p.id === invoice.projectId);

  const isOverdue = invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) < new Date();
  const statusLabel = invoice.status === 'paid' ? 'paid' : (isOverdue ? 'overdue' : 'unpaid');

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const attachmentIsImage = invoice.attachmentType?.startsWith('image/');
  const attachmentIsPdf = invoice.attachmentType === 'application/pdf';

  return (
    <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Tillbaka
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Leverantörsfaktura #{invoice.invoiceNumber}</h1>
          <StatusBadge status={statusLabel} />
        </div>
        <div style={{ flex: 1, minWidth: '8px' }} />
        {invoice.status === 'paid' ? (
          <button
            type="button"
            onClick={async () => { if (await confirmDialog('Markera fakturan som obetald igen? Betalningsverifikationen tas bort.')) onUnmarkPaid?.(); }}
            style={listHeaderButtonStyle('secondary')}
          >
            Markera som obetald
          </button>
        ) : !needsReview && (
          <button type="button" onClick={onPay} style={listHeaderButtonStyle('primary')}>
            <Check size={14} /> Betala nu
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Kundfeedback: kändes smalare/mindre "rymlig" än Kundfakturans
            InvoiceForm, som stretchar hela bredden. 820px var i smalaste
            laget för ett formulär med flera 2-kolumnsrader (varje fält blev
            väldigt smalt) — bredare kolumn (inte hela bredden, medvetet:
            en riktig faktura med rader/mallval/förhandsgranskning är en
            annan sorts sida än den här enklare kvitto-registreringen, se
            kommentaren vid Fler alternativ-borttaget i Invoices.jsx för
            samma resonemang åt andra hållet) — mer luft utan att sträcka ut
            varje enskilt inputfält orimligt brett på en stor skärm. */}
        <div style={{ maxWidth: '1040px', margin: '0 auto' }}>

          {needsReview && (
            <div style={{ margin: '24px 32px 0', background: BRAND.amberBg, color: BRAND.amberText, borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} /> Den här fakturan saknar kontering — välj konto i listan för att bokföra den.
            </div>
          )}

          {invoice.attachmentUrl && (
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
              <SupplierInvoiceAttachment url={invoice.attachmentUrl} name={invoice.attachmentName} isImage={attachmentIsImage} isPdf={attachmentIsPdf} />
            </div>
          )}

          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Fakturauppgifter</h3>
            <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13.5px' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Leverantör</span><div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{supplier?.name || invoice.supplier || 'Okänd leverantör'}</div></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Fakturanummer</span><div style={{ fontWeight: 600, color: 'var(--text-main)' }}>#{invoice.invoiceNumber}</div></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Fakturadatum</span><div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatDate(invoice.date)}</div></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Förfallodatum</span><div style={{ fontWeight: 600, color: isOverdue ? '#ef4444' : 'var(--text-main)' }}>{formatDate(invoice.dueDate)}</div></div>
              {invoice.ocrNumber && <div><span style={{ color: 'var(--text-muted)' }}>OCR/Betalningsreferens</span><div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{invoice.ocrNumber}</div></div>}
              {invoice.deliveryDate && <div><span style={{ color: 'var(--text-muted)' }}>Leveransdatum</span><div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatDate(invoice.deliveryDate)}</div></div>}
            </div>
          </div>

          {!needsReview && (
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Kontering</h3>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '520px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px', marginBottom: '8px', padding: '0 2px' }}>
                    {['Konto', 'Beskrivning', 'Belopp (exkl.)', 'Moms'].map((h, i) => (
                      <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
                    ))}
                  </div>
                  {displayRows.map((row, i) => {
                    const accountName = accounts.find(a => a.code === row.account)?.name;
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px', padding: '6px 2px', fontSize: '13px', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{row.account} {accountName}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{row.description || '—'}</span>
                        <span style={{ textAlign: 'right', color: 'var(--text-main)' }}>{fmtNum(row.netAmount)}</span>
                        <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{invoice.reverseCharge ? '—' : fmtNum(row.vatAmount)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {(invoice.paidByOwnerPrivately || invoice.reverseCharge || invoice.roundToKrona) && (
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {invoice.paidByOwnerPrivately && <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: BRAND.grayBg, color: BRAND.grayText }}>Betald privat (2018 Egen insättning)</span>}
              {invoice.reverseCharge && <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: BRAND.grayBg, color: BRAND.grayText }}>Omvänd skattskyldighet</span>}
              {invoice.roundToKrona && <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: BRAND.grayBg, color: BRAND.grayText }}>Öresavrundad</span>}
            </div>
          )}

          {(invoice.costCenter || project) && (
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Kostnadsställe/Projekt</h3>
              <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13.5px' }}>
                {invoice.costCenter && <div><span style={{ color: 'var(--text-muted)' }}>Kostnadsställe</span><div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{invoice.costCenter}</div></div>}
                {project && <div><span style={{ color: 'var(--text-muted)' }}>Projekt</span><div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{project.name}</div></div>}
              </div>
            </div>
          )}

          {invoice.notes && (
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Anteckningar</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{invoice.notes}</p>
            </div>
          )}

          {!needsReview && (
            <div style={{ padding: '24px 32px' }}>
              <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '360px', marginLeft: 'auto', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Netto (exkl. moms)</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatSEK(netTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Moms</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatSEK(vatTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '4px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Totalt att betala</span>
                  <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>{formatSEK(invoice.amount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Betala nu (Sida 35) — val mellan bank (fungerar) och kort (Kommer
// snart). Kort via Stripe skulle kräva en helt annan Stripe-produkt
// (Transfers/Issuing/Treasury, för att BETALA UT pengar) än den Checkout-
// integration som redan finns för att TA EMOT kortbetalningar från kunder
// — den är inte byggd, så alternativet visas ärligt inaktiverat istället
// för att låtsas fungera eller gissa vilket Stripe-konto som skulle betala.
function PaySupplierInvoiceModal({ invoice, contacts, onNavigate, onConfirm, onCancel }) {
  const supplier = contacts.find(c => c.id === invoice.supplierId);
  const reference = invoice.ocrNumber || invoice.invoiceNumber;

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  // Samma prioritering som SupplierForm i Contacts.jsx redan använder:
  // svenska leverantörer har Bankgiro/Plusgiro, utländska IBAN/SWIFT.
  const bankDetails = !supplier ? [] : (supplier.bankgiro || supplier.plusgiro)
    ? [supplier.bankgiro && ['Bankgiro', supplier.bankgiro], supplier.plusgiro && ['Plusgiro', supplier.plusgiro]].filter(Boolean)
    : supplier.iban
      ? [['IBAN', supplier.iban], supplier.swift && ['SWIFT/BIC', supplier.swift]].filter(Boolean)
      : [];
  const hasBankDetails = bankDetails.length > 0;

  return (
    // Sida 38, punkt 3: samma .modal-overlay/.modal-content-mönster som
    // SupplierInvoiceQuickModal ovan — se kommentaren där.
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Ingen .modal-header här — den klassens inbyggda kantlinje/padding
            skulle klämma in en oönskad avdelare mellan titeln och
            underraden direkt under, som är tänkta att höra ihop visuellt. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Betala faktura #{invoice.invoiceNumber}</h2>
          <button className="modal-close" onClick={onCancel}><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>{supplier?.name || invoice.supplier || 'Okänd leverantör'} · {formatSEK(invoice.amount)}</p>

        <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
          {/* Bank — fungerar */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
            <Landmark size={20} color={BRAND.greenDark} />
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)', margin: '10px 0 12px' }}>Bank</div>
            {!hasBankDetails ? (
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                Inga betalningsuppgifter sparade för den här leverantören.{' '}
                <button
                  type="button"
                  onClick={() => { onCancel(); onNavigate?.('contacts'); }}
                  style={{ background: 'none', border: 'none', color: BRAND.green, fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}
                >
                  Lägg till under Kontakter
                </button>
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', fontSize: '13px', flex: 1 }}>
                {bankDetails.map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Referens</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{reference}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Belopp</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatSEK(invoice.amount)}</span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => onConfirm('bank')}
              style={{ width: '100%', padding: '9px 12px', background: BRAND.green, border: 'none', borderRadius: '8px', fontWeight: 600, color: 'white', fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}
            >
              Markera som betald (bank)
            </button>
          </div>

          {/* Kort (Stripe) — Kommer snart, se kommentar ovanför komponenten */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '18px', opacity: 0.6, display: 'flex', flexDirection: 'column' }}>
            <CreditCard size={20} color="var(--text-muted)" />
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)', margin: '10px 0 8px' }}>Kort (Stripe)</div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 16px', flex: 1 }}>
              Kräver en annan Stripe-produkt (utbetalningar till leverantörer) än den som redan tar emot kortbetalningar från era kunder — inte byggt ännu.
            </p>
            <button disabled style={{ width: '100%', padding: '9px 12px', background: 'var(--border-light)', color: 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'not-allowed' }}>
              Kommer snart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leverantörsfakturor — egen fullständig sida (Sida 43-mönstret): en
// hel sida med eget sidhuvud, sökfält och lista, precis som Kundfaktura.
// "Ny leverantörsfaktura" och klick på en rad ersätter listan med formulär
// respektive läsläge i SAMMA komponent — aldrig en route-navigering. ──
export default function SupplierInvoices({
  expenses = [], accounts = [], contacts = [], setContacts, projects = [], user,
  onAddSupplierInvoice, onMarkSupplierInvoicePaid, onUnmarkSupplierInvoicePaid, onFixExpenseAccount,
  globalAction, clearGlobalAction, onNavigate,
  uploadFn = uploadFileToStorage,
}) {
  const [showForm, setShowForm] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [search, setSearch] = useState('');
  const [optimisticPaid, setOptimisticPaid] = useState({});
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [fixingId, setFixingId] = useState(null);
  const [fixAccount, setFixAccount] = useState('');
  // Samma statusfilter, sortering och "Visa N" som Kundfakturor.
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageSize, setPageSize] = useState(30);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // En genväg utifrån ("Ny leverantörsfaktura", en länk till en viss faktura)
  // öppnar formuläret respektive just DEN fakturans läsläge direkt här, i
  // stället för att lämna användaren på listan.
  useEffect(() => {
    if (globalAction?.type === 'new_supplier_invoice') {
      setShowForm(true);
      setViewingInvoice(null);
      clearGlobalAction?.();
    } else if (globalAction?.type === 'view_supplier_invoice') {
      const inv = expenses.find(e => e.id === globalAction.payload?.id && e.type === 'supplier_invoice');
      if (inv) {
        setShowForm(false);
        setViewingInvoice(inv);
      }
      clearGlobalAction?.();
    }
  }, [globalAction, clearGlobalAction, expenses]);

  const list = expenses.filter(e => e.type === 'supplier_invoice');
  const filtered = list.filter(inv => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const supplierName = contacts.find(c => c.id === inv.supplierId)?.name || inv.supplier || '';
    return supplierName.toLowerCase().includes(s) || String(inv.invoiceNumber || '').toLowerCase().includes(s);
  });

  // paymentMethod defaultar till 'bank' — det enda vägen som faktiskt
  // fungerar idag (Sida 35, se PaySupplierInvoiceModal ovan för varför
  // "kort" inte är ett riktigt alternativ än).
  const handleMarkPaid = (id, paymentMethod = 'bank') => {
    setOptimisticPaid(prev => ({ ...prev, [id]: true }));
    try { onMarkSupplierInvoicePaid?.(id, paymentMethod); }
    catch { setOptimisticPaid(prev => { const n = { ...prev }; delete n[id]; return n; }); }
    setPayingInvoiceId(null);
  };

  const handleUnmarkPaid = (id) => {
    setOptimisticPaid(prev => { const n = { ...prev }; delete n[id]; return n; });
    onUnmarkSupplierInvoicePaid?.(id);
    setViewingInvoice(null);
  };

  const applyFix = (id) => {
    if (!fixAccount) return;
    onFixExpenseAccount?.(id, fixAccount);
    setFixingId(null);
    setFixAccount('');
  };

  // Leverantörsfakturor är en egen sida i Försäljning-menyn: att stänga ett
  // formulär eller läsläge lämnar en alltid på den här sidans lista.
  const closeForm = () => { setShowForm(false); };

  const handleSave = (data) => {
    onAddSupplierInvoice?.(data);
    closeForm();
  };

  // ── Listan: samma uppbyggnad som Kundfakturor (Invoices.jsx) ──────────────
  const isPaid = (inv) => inv.status === 'paid' || Boolean(optimisticPaid[inv.id]);
  const needsReviewOf = (inv) => !inv.costAccount && !inv.rows?.length;
  const nameOf = (inv) => contacts.find(c => c.id === inv.supplierId)?.name || inv.supplier || '';
  // 'review' = saknar konto (Granska), annars paid / overdue / sent (obetald).
  const statusOf = (inv) => {
    if (needsReviewOf(inv)) return 'review';
    if (isPaid(inv)) return 'paid';
    if (inv.dueDate && new Date(inv.dueDate) < new Date()) return 'overdue';
    return 'sent';
  };
  const statusCounts = filtered.reduce((acc, inv) => { const k = statusOf(inv); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const byStatus = statusFilter === 'all' ? filtered : filtered.filter(inv => statusOf(inv) === statusFilter);
  const sortValue = (inv) => {
    if (sortKey === 'supplier') return nameOf(inv).toLowerCase();
    if (sortKey === 'invoiceNumber') return String(inv.invoiceNumber || '').toLowerCase();
    if (sortKey === 'amount') return Number(inv.amount) || 0;
    if (sortKey === 'dueDate') return inv.dueDate || '';
    return inv.date || '';
  };
  const sorted = [...byStatus].sort((x, y) => {
    const a = sortValue(x); const b = sortValue(y);
    const c = a < b ? -1 : a > b ? 1 : 0;
    return sortDir === 'asc' ? c : -c;
  });
  const visibleRows = pageSize === 'all' ? sorted : sorted.slice(0, pageSize);
  const sumTotal = sorted.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  const toggleSort = (key) => {
    setSortDir(d => (sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortKey(key);
  };
  const statusOptions = [
    { value: 'all', label: 'Alla' },
    { value: 'review', label: 'Granska', bg: BRAND.amberBg, color: BRAND.amberText },
    { value: 'sent', label: 'Obetald', bg: STRONG_UNPAID.bg, color: STRONG_UNPAID.text, strong: true },
    { value: 'overdue', label: 'Förfallen', bg: STRONG_OVERDUE.bg, color: STRONG_OVERDUE.text, strong: true },
    { value: 'paid', label: 'Betald', bg: STRONG_PAID.bg, color: STRONG_PAID.text, strong: true },
  ];

  const renderList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--bg-page)' }}>
      <ListPageHeader
        title="Leverantörsfakturor"
        subtitle="Fakturor du fått från leverantörer och ska betala"
      />

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="inv-searchrow" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="inv-search" style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Fakturanr eller leverantör" value={search} onChange={e => setSearch(e.target.value)} style={{ ...listSearchInputStyle, width: '220px' }} />
          </div>
          <button onClick={() => { setSearch(''); setStatusFilter('all'); }} title="Rensa sökning" style={{ ...listHeaderButtonStyle('secondary'), padding: '0 10px' }}><RefreshCw size={14} /></button>
          <div style={{ flex: 1 }} />
          <button className="inv-cta" onClick={() => setShowForm(true)} style={listHeaderButtonStyle('primary')}>
            <Plus size={14} /> Ny leverantörsfaktura
          </button>
        </div>
      </div>

      {/* Statuspiller som riktiga filter, som på Kundfakturor. Raden döljs när
          det inte finns någon faktura alls, ett filter utan något att filtrera
          är bara brus på en tom sida. */}
      {list.length > 0 && (
        <div className="inv-pills" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, flexWrap: 'wrap' }}>
          {statusOptions.map(opt => {
            const count = opt.value === 'all' ? filtered.length : (statusCounts[opt.value] || 0);
            // Tomma statusar visas inte, men den valda gömmer sig aldrig så
            // vägen tillbaka finns kvar.
            if (count === 0 && opt.value !== statusFilter && opt.value !== 'all') return null;
            const isActive = statusFilter === opt.value;
            const neutral = opt.value === 'all';
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                aria-pressed={isActive}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
                  background: neutral ? (isActive ? 'var(--bg-muted)' : 'transparent') : opt.bg,
                  border: '1.5px solid transparent',
                  boxShadow: isActive ? '0 0 0 2px var(--bg-card), 0 0 0 3.5px ' + (neutral ? 'var(--text-secondary)' : opt.color) : 'none',
                  borderRadius: '999px', fontSize: '12px', fontWeight: isActive ? 700 : 600,
                  color: neutral ? 'var(--text-secondary)' : opt.color, cursor: 'pointer',
                }}
              >
                {opt.label}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                  background: opt.strong ? 'rgba(255,255,255,0.28)' : 'var(--status-chip-bg)',
                  color: opt.strong ? '#ffffff' : (neutral ? 'var(--text-secondary)' : opt.color),
                }}>{count}</span>
              </button>
            );
          })}
          <div className="inv-pills-spacer" style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Visa
            <select
              value={pageSize}
              onChange={e => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{ ...listFilterFieldStyle, height: '28px', padding: '0 8px', fontSize: '12px' }}
            >
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              <option value="all">Alla</option>
            </select>
          </label>
          <Printer className="inv-pills-extra" size={15} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} />
        </div>
      )}

      {list.length === 0 ? (
        // Samma stora ikon/rubrik/knapp-mönster som Kunder och Offerter i tomt läge.
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '999px', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND.green }}>
            <Inbox size={26} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>Inga leverantörsfakturor än</div>
          <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '320px' }}>Registrera din första leverantörsfaktura för att komma igång.</div>
          <button type="button" onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', marginTop: '8px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={16} /> Ny leverantörsfaktura
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: '13.5px', color: 'var(--text-muted)' }}>Ingen faktura matchar sökningen eller filtret.</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <ListTable
              bordered={false}
              roundedBottom={false}
              rowKey={inv => inv.id}
              onRowClick={inv => setViewingInvoice(inv)}
              rowStyle={inv => ({ background: getRowBg(statusOf(inv) === 'review' ? 'draft' : statusOf(inv)) })}
              sort={{ key: sortKey, dir: sortDir, onSort: toggleSort }}
              rows={visibleRows}
              mobileList={inv => {
                const st = statusOf(inv);
                const dot = st === 'review' ? BRAND.amberText : st === 'overdue' ? STRONG_OVERDUE.bg : st === 'paid' ? STRONG_PAID.bg : STRONG_UNPAID.bg;
                const dueLabel = st === 'paid' ? 'betald' : st === 'overdue' ? 'förföll' : 'förfaller';
                // Numret bär identiteten när leverantören saknas, annars blev
                // raden en anonym "Okänd leverantör". Samma mönster som kundfakturorna.
                const supplierName = nameOf(inv);
                return {
                  dot,
                  primary: supplierName || `Faktura #${inv.invoiceNumber}`,
                  amount: formatSEK(inv.amount),
                  meta: supplierName
                    ? `#${inv.invoiceNumber} · ${dueLabel} ${formatDate(inv.dueDate)}`
                    : `Ingen leverantör vald · ${dueLabel} ${formatDate(inv.dueDate)}`,
                  pill: st === 'review' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 700, background: BRAND.amberBg, color: BRAND.amberText }}><AlertCircle size={11} /> Granska</span>
                  ) : <StatusBadge status={st === 'paid' ? 'paid' : st === 'overdue' ? 'overdue' : 'unpaid'} />,
                };
              }}
              columns={[
                { key: 'supplier', label: 'Leverantör', sortKeyName: 'supplier', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px', wrap: true, render: inv => nameOf(inv) || 'Okänd leverantör' },
                { key: 'invoiceNumber', label: 'Fakturanr', sortKeyName: 'invoiceNumber', color: 'var(--text-main)', render: inv => `#${inv.invoiceNumber}` },
                { key: 'date', label: 'Fakturadatum', sortKeyName: 'date', render: inv => formatDate(inv.date) },
                {
                  key: 'dueDate', label: 'Förfallodatum', sortKeyName: 'dueDate', render: inv => {
                    const overdue = statusOf(inv) === 'overdue';
                    return <span style={{ color: overdue ? 'var(--status-red-text)' : 'var(--text-secondary)', fontWeight: overdue ? 700 : 400 }}>{formatDate(inv.dueDate)}</span>;
                  },
                },
                { key: 'amount', label: 'Belopp', align: 'right', sortKeyName: 'amount', fontWeight: 600, color: 'var(--text-main)', render: inv => formatSEK(inv.amount) },
                {
                  key: 'status', label: 'Status', render: inv => {
                    const st = statusOf(inv);
                    if (st === 'review') {
                      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: BRAND.amberBg, color: BRAND.amberText }}><AlertCircle size={12} /> Granska</span>;
                    }
                    if (st === 'paid') {
                      return (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: STRONG_PAID.bg, color: STRONG_PAID.text }}>
                            <Check size={12} /> Betald
                          </span>
                          {inv.paymentMethod && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>via {inv.paymentMethod === 'bank' ? 'bank' : 'kort'}</div>}
                        </div>
                      );
                    }
                    // Som statuspillret på Kundfakturor: ett tryck på Obetald/Förfallen betalar.
                    return (
                      <button
                        onClick={e => { e.stopPropagation(); setPayingInvoiceId(inv.id); }}
                        title="Klicka för att betala"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px',
                          fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: 'none',
                          background: st === 'overdue' ? STRONG_OVERDUE.bg : STRONG_UNPAID.bg,
                          color: st === 'overdue' ? STRONG_OVERDUE.text : STRONG_UNPAID.text,
                        }}
                      >
                        {st === 'overdue' ? 'Förfallen' : 'Obetald'}
                      </button>
                    );
                  },
                },
                {
                  key: 'actions', label: '', align: 'right', render: inv => {
                    const st = statusOf(inv);
                    if (fixingId === inv.id) {
                      return (
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <div style={{ width: 180 }}>
                            <AccountSearch value={fixAccount} onChange={setFixAccount} accounts={accounts} placeholder="Välj konto..." />
                          </div>
                          <button onClick={() => applyFix(inv.id)} style={{ padding: '5px 10px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Spara</button>
                          <button onClick={() => { setFixingId(null); setFixAccount(''); }} aria-label="Avbryt" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={15} /></button>
                        </div>
                      );
                    }
                    const items = [
                      { key: 'view', label: 'Visa faktura', icon: Eye, onClick: () => setViewingInvoice(inv) },
                      ...(st === 'review' ? [{ key: 'account', label: 'Välj konto', icon: FileText, onClick: () => { setFixingId(inv.id); setFixAccount(''); } }] : []),
                      ...(st === 'sent' || st === 'overdue' ? [{ key: 'pay', label: 'Betala', icon: Check, onClick: () => setPayingInvoiceId(inv.id) }] : []),
                    ];
                    return (
                      <div onClick={e => e.stopPropagation()}>
                        <RowActionMenu ariaLabel={`Fler åtgärder för faktura ${inv.invoiceNumber}`} items={items} />
                      </div>
                    );
                  },
                },
              ]}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 16px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderTop: '2px solid var(--border)', borderRadius: '0 0 12px 12px', fontWeight: 700, fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--text-muted)' }}>
                {visibleRows.length < sorted.length
                  ? 'Visar ' + visibleRows.length + ' av ' + sorted.length
                  : sorted.length + (sorted.length === 1 ? ' faktura' : ' fakturor')}
              </span>
              <span>Summa SEK&nbsp;<span style={{ color: 'var(--text-main)', marginLeft: '6px' }}>{formatSEK(sumTotal).replace(/\s*kr$/, '')}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  let mainContent;
  if (showForm) {
    mainContent = (
      <SupplierInvoiceForm
        contacts={contacts} setContacts={setContacts} accounts={accounts} projects={projects} user={user} uploadFn={uploadFn}
        onSave={handleSave} onClose={closeForm}
      />
    );
  } else if (viewingInvoice) {
    mainContent = (
      <SupplierInvoiceViewer
        invoice={viewingInvoice} contacts={contacts} accounts={accounts} projects={projects}
        onClose={() => { setViewingInvoice(null); }}
        onPay={() => setPayingInvoiceId(viewingInvoice.id)}
        onUnmarkPaid={() => handleUnmarkPaid(viewingInvoice.id)}
      />
    );
  } else {
    mainContent = renderList();
  }

  return (
    <>
      {mainContent}
      {payingInvoiceId && (
        <PaySupplierInvoiceModal
          invoice={list.find(inv => inv.id === payingInvoiceId)}
          contacts={contacts}
          onNavigate={onNavigate}
          onConfirm={(method) => { handleMarkPaid(payingInvoiceId, method); setViewingInvoice(null); }}
          onCancel={() => setPayingInvoiceId(null)}
        />
      )}
    </>
  );
}
