import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Check, X, AlertCircle, Landmark, CreditCard,
} from 'lucide-react';
import { AccountSearch } from './shared/SearchInputs';
import { BRAND } from '../utils/brandColors';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

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
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
function inputStErr(hasError) { return { ...inputSt, borderColor: hasError ? '#ef4444' : '#d1d5db' }; }
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const errSt = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };

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
  const suppliers = contacts.filter(c => c.type === 'supplier');

  if (creating) {
    return (
      <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Leverantörens namn" style={inputSt} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => { setCreating(false); setNewName(''); }} style={{ padding: '6px 12px', background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>Avbryt</button>
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

const emptyForm = () => ({ supplierId: '', invoiceNumber: '', date: new Date().toISOString().split('T')[0], dueDate: '', amount: '', description: '', ocrNumber: '' });

// ── Centrerad modal: kort, fokuserad registrering av leverantörsfaktura ──
// Ingen flerrads-kontering/momssplit här — det är en snabb registrering av
// belopp och förfallodatum. Konto väljs sen via "Granska" i listan (samma
// mönster som ett kvitto utan kontering), precis som specat.
function SupplierInvoiceQuickModal({ contacts, setContacts, onSave, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  const validate = () => {
    const errs = {};
    if (!form.supplierId) errs.supplierId = 'Välj en leverantör.';
    if (!form.invoiceNumber.trim()) errs.invoiceNumber = 'Fakturanummer krävs.';
    if (!form.date) errs.date = 'Fakturadatum krävs.';
    if (!form.dueDate) errs.dueDate = 'Förfallodatum krävs.';
    if (form.date && form.dueDate && form.dueDate < form.date) errs.dueDate = 'Förfallodatum kan inte vara före fakturadatum.';
    const amount = parseAmount(form.amount);
    if (isNaN(amount) || amount <= 0) errs.amount = 'Ange ett giltigt belopp.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    const supplierName = contacts.find(c => c.id === form.supplierId)?.name || '';
    onSave({
      supplierId: form.supplierId,
      supplier: supplierName,
      invoiceNumber: form.invoiceNumber.trim(),
      date: form.date,
      dueDate: form.dueDate,
      amount: parseAmount(form.amount),
      description: form.description.trim() || `Leverantörsfaktura ${form.invoiceNumber.trim()}`,
      ocrNumber: form.ocrNumber.trim() || undefined,
    });
  };

  return (
    // Sida 38, punkt 3: .modal-overlay/.modal-content istället för en egen
    // fast-centrerad ruta — samma klasser som fakturans förhandsgranskning
    // redan använder, så modalen automatiskt blir en fullbredd bottensheet
    // på mobil (index.css @media 768px) utan att den här komponenten
    // behöver känna till brytpunkten själv.
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ margin: 0 }}>Ny leverantörsfaktura</h2>
          <button className="modal-close" onClick={onCancel}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelSt}>Leverantör *</label>
            <SupplierCombo value={form.supplierId} onChange={id => set({ supplierId: id })} contacts={contacts} setContacts={setContacts} />
            {errors.supplierId && <div style={errSt}>{errors.supplierId}</div>}
          </div>
          <div>
            <label style={labelSt}>Fakturanummer *</label>
            <input value={form.invoiceNumber} onChange={e => set({ invoiceNumber: e.target.value })} placeholder="Fakturanr från leverantören" style={inputStErr(errors.invoiceNumber)} />
            {errors.invoiceNumber && <div style={errSt}>{errors.invoiceNumber}</div>}
          </div>
          <div className="form-row-2" style={{ display: 'grid', gap: '14px' }}>
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
          </div>
          <div>
            <label style={labelSt}>Belopp (kr) *</label>
            <AmountInput value={form.amount} onChange={v => set({ amount: v })} style={inputStErr(errors.amount)} />
            {errors.amount && <div style={errSt}>{errors.amount}</div>}
          </div>
          <div>
            <label style={labelSt}>Beskrivning</label>
            <input value={form.description} onChange={e => set({ description: e.target.value })} placeholder="Vad avser fakturan?" style={inputSt} />
          </div>
          <div>
            {/* Valfritt — används bara som betalningsreferens i Betala nu-
                vyn om det fylls i (Sida 35). Faller annars tillbaka på
                fakturanumret, aldrig ett påhittat OCR-nummer. */}
            <label style={labelSt}>OCR/betalningsreferens (valfritt)</label>
            <input value={form.ocrNumber} onChange={e => set({ ocrNumber: e.target.value })} placeholder="Från leverantörens faktura, om angivet" style={inputSt} />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onCancel} style={{ padding: '9px 16px', background: 'var(--gray-100)', border: 'none', borderRadius: '8px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Avbryt</button>
          <button type="button" onClick={submit} style={{ padding: '9px 18px', background: BRAND.green, border: 'none', borderRadius: '8px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Registrera faktura</button>
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
            <CreditCard size={20} color="#9ca3af" />
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#374151', margin: '10px 0 8px' }}>Kort (Stripe)</div>
            <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.5, margin: '0 0 16px', flex: 1 }}>
              Kräver en annan Stripe-produkt (utbetalningar till leverantörer) än den som redan tar emot kortbetalningar från era kunder — inte byggt ännu.
            </p>
            <button disabled style={{ width: '100%', padding: '9px 12px', background: '#f1f5f9', color: '#9ca3af', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'not-allowed' }}>
              Kommer snart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leverantörsfakturor-flikens innehåll — inbäddad i Kvitto och utgifter-
// sidan (se Expenses.jsx), inte en egen sida med eget sidhuvud längre. ──
export default function SupplierInvoices({
  expenses = [], accounts = [], contacts = [], setContacts,
  onAddSupplierInvoice, onMarkSupplierInvoicePaid, onFixExpenseAccount,
  globalAction, clearGlobalAction, onNavigate,
}) {
  const [showForm, setShowForm] = useState(false);
  const [openedViaGlobalAction, setOpenedViaGlobalAction] = useState(false);
  const [search, setSearch] = useState('');
  const [optimisticPaid, setOptimisticPaid] = useState({});
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [fixingId, setFixingId] = useState(null);
  const [fixAccount, setFixAccount] = useState('');
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (globalAction?.type === 'new_supplier_invoice') {
      setShowForm(true);
      setOpenedViaGlobalAction(true);
      clearGlobalAction?.();
    }
  }, [globalAction, clearGlobalAction]);

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

  const applyFix = (id) => {
    if (!fixAccount) return;
    onFixExpenseAccount?.(id, fixAccount);
    setFixingId(null);
    setFixAccount('');
  };

  const closeModal = () => { setShowForm(false); setOpenedViaGlobalAction(false); };

  // När formuläret öppnades via Faktureringens "Ny leverantörsfaktura"-
  // genväg för tillbaka dit efter sparning — annars (öppnat härifrån) stannar
  // man kvar på den här fliken.
  const handleSave = (data) => {
    onAddSupplierInvoice?.(data);
    if (openedViaGlobalAction) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('section', 'kunder');
        return next;
      }, { replace: true });
      onNavigate?.('invoices');
    }
    closeModal();
  };

  return (
    <div style={{ padding: '32px 40px', animation: 'fadeIn 0.25s ease', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, color: 'var(--text-main)' }}>Leverantörsfakturor</h1>
          <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>Registrera och håll koll på vad företaget är skyldigt sina leverantörer</p>
        </div>
      </div>

      {/* Sida 38, punkt 6: .page-header-row staplar sökfältet (260px fast
          bredd) och knappen i en kolumn på mobil istället för att tvinga
          in dem på en rad som blir bredare än en telefonskärm. */}
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', margin: '20px 0 16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Sök leverantörsfaktura..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSt, paddingLeft: '36px', width: '260px', background: 'white' }} />
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={15} /> Ny leverantörsfaktura
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Sida 38, punkt 1 (komplettering): den här tabellen missades i den
            tidigare kortlist-omgången — samma responsive-table-mönster som
            Fakturor/Kontoplan/Bokföring nu använder. */}
        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Leverantör', 'Fakturanummer', 'Fakturadatum', 'Förfallodatum', 'Belopp', 'Status', ''].map(h => (
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
              const needsReview = !inv.costAccount;
              const effectivelyPaid = inv.status === 'paid' || optimisticPaid[inv.id];
              const isOverdue = !effectivelyPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
              return (
                <tr key={inv.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td data-label="Leverantör" style={{ padding: '14px 16px', fontWeight: 600, color: '#111', fontSize: '14px' }}>
                    {contacts.find(c => c.id === inv.supplierId)?.name || inv.supplier || 'Okänd leverantör'}
                  </td>
                  <td data-label="Fakturanummer" style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>#{inv.invoiceNumber}</td>
                  <td data-label="Fakturadatum" style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px' }}>{formatDate(inv.date)}</td>
                  <td data-label="Förfallodatum" style={{ padding: '14px 16px', color: isOverdue ? '#ef4444' : '#6b7280', fontSize: '13px', fontWeight: isOverdue ? 600 : 400 }}>{formatDate(inv.dueDate)}</td>
                  <td data-label="Belopp" style={{ padding: '14px 16px', fontWeight: 600, color: '#111' }}>{formatSEK(inv.amount)}</td>
                  <td data-label="Status" style={{ padding: '14px 16px' }}>
                    {needsReview
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: BRAND.amberBg, color: BRAND.amberText }}><AlertCircle size={12} /> Granska</span>
                      : (
                        <>
                          <StatusBadge status={effectivelyPaid ? 'paid' : (isOverdue ? 'overdue' : 'unpaid')} />
                          {effectivelyPaid && inv.paymentMethod && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>via {inv.paymentMethod === 'bank' ? 'bank' : 'kort'}</div>
                          )}
                        </>
                      )}
                  </td>
                  <td data-label="" className="td-actions" style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {needsReview ? (
                      fixingId === inv.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <div style={{ width: 180 }}>
                            <AccountSearch value={fixAccount} onChange={setFixAccount} accounts={accounts} placeholder="Välj konto..." />
                          </div>
                          <button onClick={() => applyFix(inv.id)} style={{ padding: '5px 10px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Spara</button>
                        </div>
                      ) : (
                        <button onClick={() => { setFixingId(inv.id); setFixAccount(''); }} style={{ padding: '5px 10px', background: BRAND.amberBg, color: BRAND.amberText, border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Välj konto
                        </button>
                      )
                    ) : !effectivelyPaid && (
                      <button onClick={() => setPayingInvoiceId(inv.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: BRAND.greenLight, color: BRAND.greenDark, border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
                        <Check size={12} /> Betala nu
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <SupplierInvoiceQuickModal contacts={contacts} setContacts={setContacts} onSave={handleSave} onCancel={closeModal} />
      )}

      {payingInvoiceId && (
        <PaySupplierInvoiceModal
          invoice={list.find(inv => inv.id === payingInvoiceId)}
          contacts={contacts}
          onNavigate={onNavigate}
          onConfirm={(method) => handleMarkPaid(payingInvoiceId, method)}
          onCancel={() => setPayingInvoiceId(null)}
        />
      )}
    </div>
  );
}
