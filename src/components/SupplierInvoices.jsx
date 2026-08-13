import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Check, X, UploadCloud, FileText, AlertTriangle, Trash2, ChevronLeft,
} from 'lucide-react';
import { AccountSearch, ProjectSearch } from './shared/SearchInputs';
import { supabase } from '../supabaseClient';
import { BRAND } from '../utils/brandColors';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const fmt = (val) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};
const newRowId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const AMOUNT_RE = /^\d*[.,]?\d{0,2}$/;
function AmountInput({ value, onChange, style, placeholder }) {
  return (
    <input
      type="text" inputMode="decimal" value={value}
      onChange={e => { const v = e.target.value; if (v === '' || AMOUNT_RE.test(v)) onChange(v); }}
      placeholder={placeholder || '0,00'} style={style}
    />
  );
}
function parseAmount(str) {
  if (str === '' || str == null) return 0;
  return parseFloat(String(str).replace(',', '.')) || 0;
}

const MAX_FILE_MB = 10;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** Samma Storage-bucket som kvittobilder — se supabase-setup.sql. */
async function uploadAttachment(userId, file) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/supplier-invoices/${key}.${ext}`;
  const { error } = await supabase.storage.from('bokix-uploads').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('bokix-uploads').getPublicUrl(path);
  return data.publicUrl;
}

const inputSt = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
function inputStErr(hasError) { return { ...inputSt, borderColor: hasError ? '#ef4444' : '#d1d5db' }; }
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const helpSt = { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 };
const errSt = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };
const card = { background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' };

function StatusBadge({ status }) {
  const map = {
    paid: { label: 'Betald', bg: BRAND.greenLight, color: BRAND.greenDark },
    unpaid: { label: 'Obetald', bg: BRAND.amberBg, color: BRAND.amberText },
    overdue: { label: 'Förfallen', bg: '#fff1f2', color: '#be123c' },
  };
  const s = map[status] || map.unpaid;
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
}

// ── Leverantörskombobox med inline "Lägg till ny leverantör" ────────────────
function SupplierCombo({ value, onChange, contacts, setContacts }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOrgNr, setNewOrgNr] = useState('');
  const suppliers = contacts.filter(c => c.type === 'supplier');

  if (creating) {
    return (
      <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Leverantörens namn" style={inputSt} />
        <input value={newOrgNr} onChange={e => setNewOrgNr(e.target.value)} placeholder="Organisationsnummer (valfritt nu)" style={inputSt} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => { setCreating(false); setNewName(''); setNewOrgNr(''); }} style={{ padding: '6px 12px', background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>Avbryt</button>
          <button
            type="button" disabled={!newName.trim()}
            onClick={() => {
              const id = `contact_${Date.now()}`;
              setContacts(prev => [...prev, {
                id, type: 'supplier', supplierType: 'se_company', name: newName.trim(), orgNr: newOrgNr.trim(),
                contactPerson: '', email: '', phone: '', address: '', postalCode: '', city: '', country: 'Sverige',
                defaultCurrency: 'SEK', notes: '', active: true,
              }]);
              onChange(id);
              setCreating(false); setNewName(''); setNewOrgNr('');
            }}
            style={{ padding: '6px 14px', background: newName.trim() ? BRAND.green : '#e5e7eb', border: 'none', borderRadius: '6px', color: newName.trim() ? 'white' : '#9ca3af', fontSize: '13px', fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'not-allowed' }}
          >Lägg till</button>
        </div>
      </div>
    );
  }

  return (
    <select value={value} onChange={e => e.target.value === '__new__' ? setCreating(true) : onChange(e.target.value)} style={{ ...inputSt, background: 'white' }}>
      <option value="">Välj leverantör...</option>
      {suppliers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value="__new__">+ Lägg till ny leverantör...</option>
    </select>
  );
}

// ── Konteringstabell — flera rader, precis som verifikationsformuläret ──
function KonteringTable({ rows, setRows, accounts, reverseCharge }) {
  const updateRow = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows(prev => [...prev, { id: newRowId(), account: '', description: '', netAmount: '', vatRate: 25 }]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {['Konto', 'Beskrivning', 'Belopp (exkl.)', 'Momssats', 'Moms', ''].map((h, i) => (
              <th key={h} style={{ padding: '0 8px 6px', textAlign: i >= 2 && i <= 4 ? 'right' : 'left', fontSize: '11px', fontWeight: 700, color: '#9ca3af', borderBottom: '1px solid var(--border)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const net = parseAmount(r.netAmount);
            const vat = reverseCharge ? 0 : net * (Number(r.vatRate) || 0) / 100;
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #f4f5f7' }}>
                <td style={{ padding: '6px 8px 6px 0', width: '160px' }}>
                  <AccountSearch value={r.account} onChange={(code) => updateRow(i, { account: code })} accounts={accounts} placeholder="Sök konto..." />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input value={r.description} onChange={e => updateRow(i, { description: e.target.value })} placeholder="Beskrivning" style={inputSt} />
                </td>
                <td style={{ padding: '6px 8px', width: '130px' }}>
                  <AmountInput value={r.netAmount} onChange={v => updateRow(i, { netAmount: v })} style={{ ...inputSt, textAlign: 'right' }} />
                </td>
                <td style={{ padding: '6px 8px', width: '90px' }}>
                  <select value={r.vatRate} onChange={e => updateRow(i, { vatRate: Number(e.target.value) })} style={{ ...inputSt, background: 'white', textAlign: 'right' }}>
                    {[25, 12, 6, 0].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', width: '90px', color: '#374151' }}>{fmt(vat)}</td>
                <td style={{ padding: '6px 4px', width: '32px' }}>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c7cbd1', padding: '2px' }}><X size={15} /></button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px', background: 'white', border: '1px solid #e4e4e7', borderRadius: '999px', padding: '6px 14px', fontSize: '12.5px', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
        <Plus size={13} /> Lägg till rad
      </button>
    </div>
  );
}

const emptyForm = () => ({
  supplierId: '', invoiceNumber: '', date: new Date().toISOString().split('T')[0], dueDate: '',
  ocrNumber: '', paidByOwnerPrivately: false, reverseCharge: false, roundToKrona: false,
  costCenter: '', projectId: '', deliveryDate: '', internalNote: '',
  rows: [{ id: newRowId(), account: '', description: '', netAmount: '', vatRate: 25 }],
  attachmentFile: null, attachmentPreviewUrl: null,
});

// ── Fullsida: Registrera leverantörsfaktura ──
function SupplierInvoiceForm({ contacts, setContacts, accounts, projects, user, onSave, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => () => { if (form.attachmentPreviewUrl) URL.revokeObjectURL(form.attachmentPreviewUrl); }, []); // eslint-disable-line

  const totals = form.rows.reduce((acc, r) => {
    const net = parseAmount(r.netAmount);
    const vat = form.reverseCharge ? 0 : net * (Number(r.vatRate) || 0) / 100;
    return { net: acc.net + net, vat: acc.vat + vat };
  }, { net: 0, vat: 0 });
  let total = totals.net + totals.vat;
  let roundingDiff = 0;
  if (form.roundToKrona) {
    const rounded = Math.round(total);
    roundingDiff = rounded - total;
    total = rounded;
  }

  const acceptFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) { setErrors(e => ({ ...e, attachment: 'Filen måste vara en PDF eller bild (JPG/PNG/WEBP).' })); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { setErrors(e => ({ ...e, attachment: `Filen är för stor (max ${MAX_FILE_MB} MB).` })); return; }
    setErrors(e => ({ ...e, attachment: undefined }));
    if (form.attachmentPreviewUrl) URL.revokeObjectURL(form.attachmentPreviewUrl);
    set({ attachmentFile: file, attachmentPreviewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
  };

  const validate = () => {
    const errs = {};
    if (!form.supplierId) errs.supplierId = 'Välj en leverantör.';
    if (!form.invoiceNumber.trim()) errs.invoiceNumber = 'Fakturanummer krävs.';
    if (!form.date) errs.date = 'Fakturadatum krävs.';
    if (!form.dueDate) errs.dueDate = 'Förfallodatum krävs.';
    if (form.date && form.dueDate && form.dueDate < form.date) errs.dueDate = 'Förfallodatum kan inte vara före fakturadatum.';
    const validRows = form.rows.filter(r => r.account && parseAmount(r.netAmount) > 0);
    if (validRows.length === 0) errs.rows = 'Lägg till minst en konteringsrad med konto och belopp.';
    setErrors(e => ({ ...e, ...errs }));
    return Object.keys(errs).length === 0;
  };

  const submit = async (status) => {
    if (!validate()) return;
    setSaving(true);
    let attachmentUrl = null, attachmentType = null, uploadWarning = null;
    if (form.attachmentFile && user?.id) {
      try {
        attachmentUrl = await uploadAttachment(user.id, form.attachmentFile);
        attachmentType = form.attachmentFile.type;
      } catch (err) {
        uploadWarning = /bucket not found/i.test(err.message || '')
          ? 'Bildlagring är inte konfigurerad i Supabase-projektet ännu (se supabase-setup.sql) — fakturan registreras ändå, men utan bifogat underlag.'
          : `Kunde inte spara underlaget (${err.message}) — fakturan registreras ändå, men utan bifogat underlag.`;
      }
    }

    const cleanRows = form.rows
      .filter(r => r.account && parseAmount(r.netAmount) > 0)
      .map(r => ({ account: r.account, description: r.description, netAmount: parseAmount(r.netAmount), vatRate: form.reverseCharge ? 0 : Number(r.vatRate), vatAmount: form.reverseCharge ? 0 : parseAmount(r.netAmount) * Number(r.vatRate) / 100 }));

    onSave({
      supplierId: form.supplierId, invoiceNumber: form.invoiceNumber, date: form.date, dueDate: form.dueDate,
      ocrNumber: form.ocrNumber, paidByOwnerPrivately: form.paidByOwnerPrivately, reverseCharge: form.reverseCharge,
      roundToKrona: form.roundToKrona, roundingDiff, costCenter: form.costCenter, projectId: form.projectId,
      deliveryDate: form.deliveryDate, internalNote: form.internalNote,
      rows: cleanRows, netAmount: totals.net, vatAmount: totals.vat, amount: total,
      costAccount: cleanRows[0]?.account, description: cleanRows[0]?.description,
      attachmentUrl, attachmentType, status,
    });
    if (uploadWarning) window.alert(uploadWarning);
    setSaving(false);
  };

  return (
    // Bugkritiskt: rotdiven hade ingen egen bakgrund, bara padding + minHeight:'100%'.
    // Den sträcktes ut till hela sidans höjd (via .main-content-inner > * { flex:1 }),
    // men eftersom den var transparent syntes den gråa sidbakgrunden som ett tomt
    // fält under det sista kortet istället för att formuläret kändes heltäckande.
    <div style={{ padding: '32px 40px', animation: 'fadeIn 0.25s ease', minHeight: '100%', boxSizing: 'border-box', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}><ChevronLeft size={14} /> Tillbaka</button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Registrera leverantörsfaktura</h2>
      </div>

      <div style={card}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.paidByOwnerPrivately} onChange={e => set({ paidByOwnerPrivately: e.target.checked })} style={{ marginTop: '2px' }} />
          <span>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>Jag har betalat detta privat</div>
            <div style={helpSt}>Bokförs som skuld från bolaget till dig (2018 Egen insättning). Återbetalas senare manuellt från företagskontot.</div>
          </span>
        </label>
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={labelSt}>Leverantör *</label>
            <SupplierCombo value={form.supplierId} onChange={id => set({ supplierId: id })} contacts={contacts} setContacts={setContacts} />
            {errors.supplierId && <div style={errSt}>{errors.supplierId}</div>}
          </div>
          <div>
            <label style={labelSt}>Leverantörens fakturanummer *</label>
            <input value={form.invoiceNumber} onChange={e => set({ invoiceNumber: e.target.value })} placeholder="Fakturanr från leverantören" style={inputStErr(errors.invoiceNumber)} />
            {errors.invoiceNumber && <div style={errSt}>{errors.invoiceNumber}</div>}
          </div>
          <div>
            <label style={labelSt}>Fakturadatum *</label>
            <input type="date" value={form.date} onChange={e => set({ date: e.target.value })} style={inputStErr(errors.date)} />
            {errors.date && <div style={errSt}>{errors.date}</div>}
          </div>
          <div>
            <label style={labelSt}>Förfallodatum *</label>
            <input type="date" value={form.dueDate} onChange={e => set({ dueDate: e.target.value })} style={inputStErr(errors.dueDate)} />
            {errors.dueDate && <div style={errSt}>{errors.dueDate}</div>}
          </div>
          <div>
            <label style={labelSt}>OCR / Betalningsreferens</label>
            <input value={form.ocrNumber} onChange={e => set({ ocrNumber: e.target.value })} placeholder="OCR-nummer" style={inputSt} />
          </div>
        </div>

        <label style={labelSt}>Fakturaunderlag</label>
        <p style={helpSt}>Bifoga leverantörens PDF eller en bild. Underlaget sparas med fakturan och kopplas automatiskt till verifikationen.</p>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
          onClick={() => document.getElementById('si-attachment').click()}
          style={{
            border: `1.5px dashed ${dragOver ? BRAND.green : 'var(--gray-300)'}`, background: dragOver ? 'rgba(234,243,222,0.4)' : 'var(--gray-50)',
            borderRadius: '10px', padding: '18px', textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '4px',
          }}
        >
          <input id="si-attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={e => acceptFile(e.target.files?.[0])} />
          {form.attachmentFile ? (
            <>
              {form.attachmentPreviewUrl ? <img src={form.attachmentPreviewUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '6px' }} /> : <FileText size={20} color="var(--text-muted)" />}
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{form.attachmentFile.name}</span>
              <button type="button" onClick={e => { e.stopPropagation(); if (form.attachmentPreviewUrl) URL.revokeObjectURL(form.attachmentPreviewUrl); set({ attachmentFile: null, attachmentPreviewUrl: null }); }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
            </>
          ) : (
            <>
              <UploadCloud size={18} color="var(--text-muted)" />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Dra och släpp eller klicka</span>
            </>
          )}
        </div>
        {errors.attachment && <div style={errSt}>{errors.attachment}</div>}
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelSt}>Kostnadsställe</label>
            <input value={form.costCenter} onChange={e => set({ costCenter: e.target.value })} placeholder="Ange kostnadsställe" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Projekt</label>
            <ProjectSearch value={form.projectId} onChange={v => set({ projectId: v })} projects={projects} />
          </div>
        </div>
        <p style={helpSt}>Kostnadsställe/projekt gäller alla rader i denna faktura.</p>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label style={{ ...labelSt, marginBottom: 0 }}>Kontering</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Valuta
            <select disabled value="SEK" title="Bokix stödjer i dagsläget bara SEK" style={{ padding: '3px 8px', border: '1px solid #e4e4e7', borderRadius: '999px', fontSize: '12px', background: '#f8fafc', fontFamily: 'inherit' }}>
              <option>SEK</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '10px' }}>
          <KonteringTable rows={form.rows} setRows={rows => set({ rows: typeof rows === 'function' ? rows(form.rows) : rows })} accounts={accounts} reverseCharge={form.reverseCharge} />
        </div>
        {errors.rows && <div style={errSt}>{errors.rows}</div>}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
          <input type="checkbox" checked={form.reverseCharge} onChange={e => set({ reverseCharge: e.target.checked })} style={{ marginTop: '2px' }} />
          <span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Omvänd skattskyldighet</div>
            <div style={helpSt}>Köp inom EU eller byggtjänster: momsen redovisas av köparen.</div>
          </span>
        </label>
        {form.reverseCharge && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginTop: '10px', fontSize: '12.5px', color: '#92400e' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Fakturan bokförs utan moms (leverantörens faktura saknar moms vid omvänd skattskyldighet). Den beräknade självdeklarerade momsen ({fmt(form.rows.reduce((s, r) => s + parseAmount(r.netAmount) * Number(r.vatRate) / 100, 0))} kr) bokförs inte automatiskt ännu — lägg till den manuellt i momsredovisningen tills detta stöds fullt ut.</span>
          </div>
        )}

        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '260px', fontSize: '13px', color: 'var(--text-secondary)' }}><span>Netto (exkl. moms)</span><span>{formatSEK(totals.net)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '260px', fontSize: '13px', color: 'var(--text-secondary)' }}><span>Moms</span><span>{formatSEK(totals.vat)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '260px', fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}><span>Totalt</span><span>{formatSEK(total)}</span></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '4px' }}>
            <input type="checkbox" checked={form.roundToKrona} onChange={e => set({ roundToKrona: e.target.checked })} />
            Avrunda fakturatotal till hel krona
          </label>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Övrigt</h3>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelSt}>Leveransdatum (ML krav)</label>
          <input type="date" value={form.deliveryDate} onChange={e => set({ deliveryDate: e.target.value })} style={{ ...inputSt, maxWidth: '220px' }} />
        </div>
        <div>
          <label style={labelSt}>Anteckningar</label>
          <textarea value={form.internalNote} onChange={e => set({ internalNote: e.target.value })} placeholder="Interna anteckningar om denna faktura..." style={{ ...inputSt, minHeight: '70px', resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" onClick={onCancel} disabled={saving} style={{ padding: '9px 18px', background: 'var(--gray-100)', border: 'none', borderRadius: '8px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Avbryt</button>
        <button type="button" onClick={() => submit('paid')} disabled={saving} style={{ padding: '9px 18px', background: 'white', border: `1px solid ${BRAND.green}`, borderRadius: '8px', fontWeight: 600, color: BRAND.green, cursor: 'pointer' }}>Registrera &amp; markera som betald</button>
        <button type="button" onClick={() => submit('unpaid')} disabled={saving} style={{ padding: '9px 18px', background: BRAND.green, border: 'none', borderRadius: '8px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>{saving ? 'Sparar...' : 'Registrera faktura'}</button>
      </div>
    </div>
  );
}

export default function SupplierInvoices({
  expenses = [], accounts = [], contacts = [], setContacts, projects = [], user,
  onAddSupplierInvoice, onMarkSupplierInvoicePaid, onFixExpenseAccount, globalAction, clearGlobalAction,
  onNavigate,
}) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [optimisticPaid, setOptimisticPaid] = useState({});
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (globalAction?.type === 'new_supplier_invoice') {
      setShowForm(true);
      clearGlobalAction?.();
    }
  }, [globalAction, clearGlobalAction]);

  const list = expenses.filter(e => e.type === 'supplier_invoice');
  const filtered = list.filter(inv => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const supplierName = contacts.find(c => c.id === inv.supplierId)?.name || '';
    return supplierName.toLowerCase().includes(s) || String(inv.invoiceNumber || '').toLowerCase().includes(s);
  });

  const handleMarkPaid = (id) => {
    setOptimisticPaid(prev => ({ ...prev, [id]: true }));
    try { onMarkSupplierInvoicePaid?.(id); }
    catch { setOptimisticPaid(prev => { const n = { ...prev }; delete n[id]; return n; }); }
  };

  // Både "Tillbaka"/"Avbryt" och en lyckad registrering ska föra tillbaka
  // till Faktureringens startsida (Kundfakturor-sektionen) — inte till den
  // fristående Leverantörsfakturor-listan.
  const goToInvoicingHome = () => {
    setShowForm(false);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('section', 'kunder');
      return next;
    }, { replace: true });
    onNavigate?.('invoices');
  };

  const handleSave = (data) => {
    onAddSupplierInvoice?.(data);
    goToInvoicingHome();
  };

  if (showForm) {
    return <SupplierInvoiceForm contacts={contacts} setContacts={setContacts} accounts={accounts} projects={projects} user={user} onSave={handleSave} onCancel={goToInvoicingHome} />;
  }

  return (
    <div style={{ padding: '32px 40px', animation: 'fadeIn 0.25s ease', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, color: 'var(--text-main)' }}>Leverantörsfakturor</h1>
          <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>Registrera och håll koll på vad företaget är skyldigt sina leverantörer</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={15} /> Registrera leverantörsfaktura
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0 16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Sök leverantörsfaktura..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSt, paddingLeft: '36px', width: '260px', background: 'white' }} />
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Leverantör', 'Faktura#', 'Fakturadatum', 'Förfallodatum', 'Belopp', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '56px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {list.length === 0 ? 'Inga leverantörsfakturor registrerade än.' : 'Ingen matchade sökningen.'}
                </td>
              </tr>
            ) : filtered.map((inv, i) => {
              const effectivelyPaid = inv.status === 'paid' || optimisticPaid[inv.id];
              const isOverdue = !effectivelyPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
              return (
                <tr key={inv.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#111', fontSize: '14px' }}>
                    {contacts.find(c => c.id === inv.supplierId)?.name || 'Okänd leverantör'}
                    {inv.paidByOwnerPrivately && <span title="Betald privat av ägaren, bokförd som skuld till dig" style={{ marginLeft: '6px', fontSize: '11px', color: '#9ca3af' }}>· privat</span>}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>#{inv.invoiceNumber}</td>
                  <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px' }}>{formatDate(inv.date)}</td>
                  <td style={{ padding: '14px 16px', color: isOverdue ? '#ef4444' : '#6b7280', fontSize: '13px', fontWeight: isOverdue ? 600 : 400 }}>{formatDate(inv.dueDate)}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#111' }}>{formatSEK(inv.amount)}</td>
                  <td style={{ padding: '14px 16px' }}><StatusBadge status={effectivelyPaid ? 'paid' : (isOverdue ? 'overdue' : 'unpaid')} /></td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {!effectivelyPaid && (
                      <button onClick={() => handleMarkPaid(inv.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: BRAND.greenLight, color: BRAND.greenDark, border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
                        <Check size={12} /> Markera betald
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
