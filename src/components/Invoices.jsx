import React, { useState, useEffect } from 'react';
import {
  Plus, X, Check, Send, CreditCard, Eye,
  FileText, Trash2, ArrowRight, Printer, Download
} from 'lucide-react';

const VAT_RATES = [25, 12, 6, 0];

// Allra palette
const LIME = '#5ba85a';
const LIME_DARK = '#4a944a';
const LIME_L = '#f2f9f2';
const BLUE = '#3a8fc1';
const SIDEBAR_DARK = '#1a3028';

export default function Invoices({
  invoices, contacts, onAdd, onMarkPaid,
  setInvoices, onConvertQuote, company,
  globalAction, clearGlobalAction
}) {
  const [activeTab, setActiveTab]   = useState('invoices');
  const [filter, setFilter]         = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);

  // Form state
  const [customerId, setCustomerId]     = useState('');
  const [invoiceDate, setInvoiceDate]   = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate]           = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [rows, setRows] = useState([
    { description: '', qty: 1, unitPrice: 0, vatRate: 25 }
  ]);

  // Handle global action (from + button in topbar)
  useEffect(() => {
    if (globalAction === 'new_invoice') {
      setActiveTab('invoices');
      setIsModalOpen(true);
      clearGlobalAction?.();
    } else if (globalAction === 'new_quote') {
      setActiveTab('quotes');
      setIsModalOpen(true);
      clearGlobalAction?.();
    }
  }, [globalAction]);

  const customers = contacts.filter(c => c.type === 'customer');

  const formatSEK = (val) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

  const getCustomerName = (id) => {
    const c = contacts.find(x => x.id === id);
    return c ? c.name : 'Okänd kund';
  };

  const getCustomer = (id) => contacts.find(x => x.id === id);

  const calcInvoiceTotals = (invRows) => {
    let totalNet = 0, totalVat = 0;
    invRows.forEach(r => {
      const net = r.qty * r.unitPrice;
      totalNet += net;
      totalVat += net * (r.vatRate / 100);
    });
    return {
      totalNet: Math.round(totalNet),
      totalVat: Math.round(totalVat),
      totalGross: Math.round(totalNet + totalVat)
    };
  };

  const currentTabInvoices = invoices.filter(inv => {
    const type = inv.type || 'invoice';
    return activeTab === 'invoices' ? type === 'invoice' : type === 'quote';
  });

  const filtered = currentTabInvoices.filter(inv => {
    if (filter !== 'all' && inv.status !== filter) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const counts = {
    all:   currentTabInvoices.length,
    draft: currentTabInvoices.filter(i => i.status === 'draft').length,
    sent:  currentTabInvoices.filter(i => i.status === 'sent').length,
    paid:  currentTabInvoices.filter(i => i.status === 'paid').length,
  };

  const addRow    = () => setRows([...rows, { description: '', qty: 1, unitPrice: 0, vatRate: 25 }]);
  const removeRow = (i) => rows.length > 1 && setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => {
    const nr = [...rows];
    if (field === 'qty' || field === 'unitPrice') {
      nr[i][field] = parseFloat(val) || 0;
    } else if (field === 'vatRate') {
      nr[i][field] = parseInt(val);
    } else {
      nr[i][field] = val;
    }
    setRows(nr);
  };

  const resetForm = () => {
    setCustomerId('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    const d = new Date(); d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);
    setRows([{ description: '', qty: 1, unitPrice: 0, vatRate: 25 }]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerId) return;
    const invoiceNumbers = invoices
      .filter(i => (i.type || 'invoice') === (activeTab === 'quotes' ? 'quote' : 'invoice'))
      .map(i => Number.parseInt(i.invoiceNumber, 10))
      .filter(Number.isFinite);
    const nextNum = invoiceNumbers.length > 0 ? String(Math.max(...invoiceNumbers) + 1) : '1001';

    onAdd({
      type: activeTab === 'quotes' ? 'quote' : 'invoice',
      invoiceNumber: nextNum,
      customerId,
      date: invoiceDate,
      dueDate,
      status: 'draft',
      paidDate: null,
      rows: rows.filter(r => r.description && r.unitPrice > 0),
    });

    resetForm();
    setIsModalOpen(false);
  };

  const handleSend = (id) =>
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i));

  const handleDelete = (id) => {
    if (window.confirm('Vill du ta bort denna faktura?')) {
      setInvoices(prev => prev.filter(i => i.id !== id));
    }
  };

  const handlePrint = () => window.print();

  const statusLabel = (s) => {
    if (s === 'draft')   return 'Utkast';
    if (s === 'sent')    return 'Skickad';
    if (s === 'paid')    return activeTab === 'quotes' ? 'Accepterad' : 'Betald';
    if (s === 'overdue') return 'Förfallen';
    return s;
  };

  const getStatusStyle = (status) => {
    if (status === 'draft')   return { bg: '#fffbeb', color: '#d97706',  border: '#fcd34d' };
    if (status === 'sent')    return { bg: '#eef5fb', color: BLUE,       border: '#a8d1eb' };
    if (status === 'paid')    return { bg: LIME_L,    color: LIME_DARK,  border: '#b8e2b8' };
    if (status === 'overdue') return { bg: '#fef2f2', color: '#dc2626',  border: '#fca5a5' };
    return { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' };
  };

  const totals = calcInvoiceTotals(rows);

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb',
    borderRadius: '8px', fontSize: '13.5px', color: '#111827',
    background: 'white', outline: 'none', transition: 'all 0.15s',
    fontFamily: 'inherit', boxSizing: 'border-box'
  };

  const btnPrimary = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px',
    background: LIME, border: 'none', borderRadius: '9px',
    fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', color: 'white',
    transition: 'all 0.15s', fontFamily: 'inherit'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            {activeTab === 'quotes' ? 'Offerter' : 'Fakturor'}
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px' }}>
            {activeTab === 'quotes' ? 'Skapa och hantera offerter' : 'Skapa, skicka och hantera dina kundfakturor'}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          style={btnPrimary}
          onMouseEnter={e => e.currentTarget.style.background = LIME_DARK}
          onMouseLeave={e => e.currentTarget.style.background = LIME}
        >
          <Plus size={15} /> {activeTab === 'quotes' ? 'Ny offert' : 'Ny faktura'}
        </button>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f9fafb', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid #e5e7eb' }}>
        {[{ id: 'invoices', label: 'Fakturor' }, { id: 'quotes', label: 'Offerter' }].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setFilter('all'); }} style={{
            padding: '7px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: activeTab === tab.id ? 600 : 500,
            background: activeTab === tab.id ? 'white' : 'transparent',
            color: activeTab === tab.id ? '#111827' : '#6b7280',
            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── FILTER PILLS ── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'draft', 'sent', 'paid'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px',
            fontWeight: filter === f ? 700 : 500, cursor: 'pointer',
            background: filter === f ? LIME : 'white',
            color: filter === f ? 'white' : '#6b7280',
            border: `1px solid ${filter === f ? LIME : '#e5e7eb'}`,
            transition: 'all 0.15s', fontFamily: 'inherit'
          }}>
            {f === 'all' ? 'Alla' : statusLabel(f)}
            <span style={{ opacity: 0.75, marginLeft: '5px', fontSize: '11px' }}>({counts[f] || 0})</span>
          </button>
        ))}
      </div>

      {/* ── TABELL ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px', minWidth: '620px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '13px 20px', fontWeight: 700, color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {activeTab === 'quotes' ? 'Offert' : 'Faktura'}
                </th>
                <th style={{ padding: '13px 20px', fontWeight: 700, color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kund</th>
                <th style={{ padding: '13px 20px', fontWeight: 700, color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datum</th>
                <th style={{ padding: '13px 20px', fontWeight: 700, color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Förfaller</th>
                <th style={{ padding: '13px 20px', fontWeight: 700, color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Belopp</th>
                <th style={{ padding: '13px 20px', fontWeight: 700, color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '13px 20px', fontWeight: 700, color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, idx) => {
                const t  = calcInvoiceTotals(inv.rows);
                const st = getStatusStyle(inv.status);
                return (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = LIME_L}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111827' }}>
                      #{inv.invoiceNumber}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#4b5563' }}>{getCustomerName(inv.customerId)}</td>
                    <td style={{ padding: '14px 20px', color: '#6b7280' }}>{inv.date}</td>
                    <td style={{ padding: '14px 20px', color: '#6b7280' }}>{inv.dueDate}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
                      {formatSEK(t.totalGross)}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        padding: '4px 10px', background: st.bg, color: st.color,
                        border: `1px solid ${st.border}`, borderRadius: '20px',
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em'
                      }}>
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* Visa */}
                        <button
                          onClick={() => setViewInvoice(inv)}
                          title="Visa faktura"
                          style={{ padding: '6px 10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}
                          onMouseEnter={e => { e.currentTarget.style.background = LIME_L; e.currentTarget.style.borderColor = '#b8e2b8'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                        >
                          <Eye size={13} /> Visa
                        </button>

                        {/* Skicka (draft) */}
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleSend(inv.id)}
                            title="Markera som skickad"
                            style={{ padding: '6px 10px', background: 'white', border: `1px solid ${BLUE}`, borderRadius: '7px', fontSize: '12px', cursor: 'pointer', color: BLUE, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit', fontWeight: 600 }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eef5fb'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          >
                            <Send size={12} /> Skicka
                          </button>
                        )}

                        {/* Offert → Faktura */}
                        {inv.status === 'draft' && activeTab === 'quotes' && (
                          <button
                            onClick={() => { onConvertQuote(inv.id); }}
                            title="Gör om till faktura"
                            style={{ padding: '6px 10px', background: 'white', border: `1px solid ${LIME}`, borderRadius: '7px', fontSize: '12px', cursor: 'pointer', color: LIME_DARK, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit', fontWeight: 600 }}
                            onMouseEnter={e => e.currentTarget.style.background = LIME_L}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          >
                            <ArrowRight size={12} /> → Faktura
                          </button>
                        )}

                        {/* Betald (sent, invoice) */}
                        {inv.status === 'sent' && activeTab === 'invoices' && (
                          <button
                            onClick={() => onMarkPaid(inv.id)}
                            title="Markera som betald"
                            style={{ padding: '6px 10px', background: 'white', border: `1px solid #b8e2b8`, borderRadius: '7px', fontSize: '12px', cursor: 'pointer', color: LIME_DARK, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit', fontWeight: 600 }}
                            onMouseEnter={e => e.currentTarget.style.background = LIME_L}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          >
                            <CreditCard size={12} /> Betald
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '14px', background: LIME_L, color: LIME, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <FileText size={26} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
                      {activeTab === 'quotes' ? 'Inga offerter' : 'Inga fakturor'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                      {activeTab === 'quotes' ? 'Skapa din första offert för att komma igång' : 'Skapa din första faktura för att komma igång'}
                    </div>
                    <button
                      onClick={() => { resetForm(); setIsModalOpen(true); }}
                      style={{ ...btnPrimary, margin: '0 auto' }}
                      onMouseEnter={e => e.currentTarget.style.background = LIME_DARK}
                      onMouseLeave={e => e.currentTarget.style.background = LIME}
                    >
                      <Plus size={14} /> {activeTab === 'quotes' ? 'Skapa offert' : 'Skapa faktura'}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SKAPA-MODAL
      ══════════════════════════════════════════ */}
      {isModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{ background: 'white', borderRadius: '18px', width: '100%', maxWidth: '820px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 40px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10, borderRadius: '18px 18px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: LIME_L, color: LIME, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  {activeTab === 'quotes' ? 'Skapa ny offert' : 'Skapa ny faktura'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '28px' }}>
              {/* Kundinformation */}
              <div style={{ background: '#fafcfa', border: '1px solid #e0eee0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: LIME_DARK, marginBottom: '16px' }}>
                  Kundinformation
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Kund *</label>
                    <select style={inputStyle} value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                      <option value="">Välj kund...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Datum</label>
                    <input type="date" style={inputStyle} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Förfallodag</label>
                    <input type="date" style={inputStyle} value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                  </div>
                </div>
              </div>

              {/* Rader */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>Fakturarader</label>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  {/* Kolumnrubriker */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 100px 90px 32px', gap: '8px', padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Beskrivning', 'Antal', 'Á-pris', 'Moms', 'Summa', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {rows.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 100px 90px 32px', gap: '8px', padding: '10px 14px', borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center' }}>
                      <input type="text" placeholder="Beskrivning av tjänst/vara" style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px' }} value={row.description} onChange={e => updateRow(i, 'description', e.target.value)} />
                      <input type="number" placeholder="1" min="1" style={{ ...inputStyle, padding: '7px 8px', fontSize: '13px' }} value={row.qty || ''} onChange={e => updateRow(i, 'qty', e.target.value)} />
                      <input type="number" placeholder="0" min="0" style={{ ...inputStyle, padding: '7px 8px', fontSize: '13px' }} value={row.unitPrice || ''} onChange={e => updateRow(i, 'unitPrice', e.target.value)} />
                      <select style={{ ...inputStyle, padding: '7px 8px', fontSize: '13px' }} value={row.vatRate} onChange={e => updateRow(i, 'vatRate', e.target.value)}>
                        {VAT_RATES.map(r => <option key={r} value={r}>{r}% moms</option>)}
                      </select>
                      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '13px', color: '#111827' }}>
                        {formatSEK(row.qty * row.unitPrice)}
                      </div>
                      <button type="button" onClick={() => removeRow(i)} disabled={rows.length <= 1}
                        style={{ background: 'none', border: 'none', color: rows.length > 1 ? '#ef4444' : '#d1d5db', cursor: rows.length > 1 ? 'pointer' : 'not-allowed', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <div style={{ padding: '10px 14px', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                    <button type="button" onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: `1px solid ${LIME}`, padding: '6px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', color: LIME_DARK, fontFamily: 'inherit' }}>
                      <Plus size={14} /> Lägg till rad
                    </button>
                  </div>
                </div>
              </div>

              {/* Summering */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                <div style={{ width: '260px', background: '#f8faf8', border: '1px solid #e0eee0', padding: '16px 20px', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                    <span>Netto (exkl. moms)</span><span>{formatSEK(totals.totalNet)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                    <span>Moms</span><span>{formatSEK(totals.totalVat)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 700, color: '#111827', borderTop: '2px solid #1a3028', paddingTop: '12px' }}>
                    <span>Totalt att betala</span><span style={{ color: LIME_DARK }}>{formatSEK(totals.totalGross)}</span>
                  </div>
                </div>
              </div>

              {/* Knappar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={!customerId || rows.every(r => !r.description)}
                  style={{ ...btnPrimary, opacity: (!customerId || rows.every(r => !r.description)) ? 0.5 : 1 }}
                  onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = LIME_DARK; }}
                  onMouseLeave={e => e.currentTarget.style.background = LIME}
                >
                  <Check size={15} /> {activeTab === 'quotes' ? 'Skapa offert' : 'Skapa faktura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          FAKTURA-PREVIEW MODAL (Vacker A4)
      ══════════════════════════════════════════ */}
      {viewInvoice && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '32px 20px', overflowY: 'auto' }}
          onClick={() => setViewInvoice(null)}
        >
          <div
            style={{ width: '100%', maxWidth: '800px', animation: 'slideUp 0.25s ease both' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal topbar */}
            <div style={{ background: 'white', borderRadius: '14px', padding: '14px 20px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: LIME_L, color: LIME, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                    {viewInvoice.type === 'quote' ? 'Offert' : 'Faktura'} #{viewInvoice.invoiceNumber}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#9ca3af' }}>{getCustomerName(viewInvoice.customerId)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Skicka (draft) */}
                {viewInvoice.status === 'draft' && viewInvoice.type !== 'quote' && (
                  <button
                    onClick={() => { handleSend(viewInvoice.id); setViewInvoice(prev => ({ ...prev, status: 'sent' })); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'white', border: `1px solid ${BLUE}`, borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: BLUE, fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#eef5fb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <Send size={14} /> Skicka
                  </button>
                )}
                {/* Betald (sent, invoice) */}
                {viewInvoice.status === 'sent' && viewInvoice.type !== 'quote' && (
                  <button
                    onClick={() => { onMarkPaid(viewInvoice.id); setViewInvoice(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: LIME, border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = LIME_DARK}
                    onMouseLeave={e => e.currentTarget.style.background = LIME}
                  >
                    <CreditCard size={14} /> Markera betald
                  </button>
                )}
                {/* Offert → Faktura */}
                {viewInvoice.type === 'quote' && (
                  <button
                    onClick={() => { onConvertQuote(viewInvoice.id); setViewInvoice(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: LIME, border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = LIME_DARK}
                    onMouseLeave={e => e.currentTarget.style.background = LIME}
                  >
                    <ArrowRight size={14} /> Gör om till Faktura
                  </button>
                )}
                {/* Skriv ut */}
                <button
                  onClick={handlePrint}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <Printer size={14} /> Skriv ut
                </button>
                <button onClick={() => setViewInvoice(null)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* ── A4 DOKUMENT ── */}
            <div style={{ background: 'white', borderRadius: '6px', boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>

              {/* Grön header-sektion */}
              <div style={{ background: `linear-gradient(135deg, ${SIDEBAR_DARK}, #2d5a3f)`, padding: '36px 44px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                {/* Företagsinformation */}
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'white', letterSpacing: '-0.03em', marginBottom: '10px' }}>
                    {company?.name || 'Företagsnamn'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
                    {company?.address && <div>{company.address}</div>}
                    {company?.email && <div>{company.email}</div>}
                    {company?.phone && <div>{company.phone}</div>}
                  </div>
                </div>

                {/* Dokumenttyp + metadata */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '30px', fontWeight: 300, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.85)', marginBottom: '16px' }}>
                    {viewInvoice.type === 'quote' ? 'OFFERT' : 'FAKTURA'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 20px', textAlign: 'right' }}>
                    {[
                      ['Nummer',    `#${viewInvoice.invoiceNumber}`],
                      ['Datum',     viewInvoice.date],
                      [viewInvoice.type === 'quote' ? 'Giltig t.o.m' : 'Förfaller', viewInvoice.dueDate],
                    ].map(([label, val]) => (
                      <React.Fragment key={label}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', paddingTop: '2px' }}>{label}</span>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{val}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lime-grön separator stripe */}
              <div style={{ height: '4px', background: `linear-gradient(90deg, ${LIME}, ${BLUE})` }} />

              {/* Innehåll */}
              <div style={{ padding: '36px 44px' }}>

                {/* Kund-block */}
                <div style={{ background: '#f8faf8', border: '1px solid #e0eee0', borderRadius: '10px', padding: '18px 22px', marginBottom: '32px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: LIME_DARK, fontWeight: 700, marginBottom: '8px' }}>
                    {viewInvoice.type === 'quote' ? 'Offert till' : 'Faktureras till'}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>
                    {getCustomerName(viewInvoice.customerId)}
                  </div>
                  {getCustomer(viewInvoice.customerId)?.address && (
                    <div style={{ fontSize: '12.5px', color: '#52525b', lineHeight: 1.6 }}>
                      {getCustomer(viewInvoice.customerId).address}
                    </div>
                  )}
                  {getCustomer(viewInvoice.customerId)?.email && (
                    <div style={{ fontSize: '12.5px', color: '#52525b' }}>
                      {getCustomer(viewInvoice.customerId).email}
                    </div>
                  )}
                </div>

                {/* Artikelrad-tabell */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px' }}>
                  <thead>
                    <tr style={{ background: SIDEBAR_DARK }}>
                      {['Beskrivning', 'Antal', 'Á-pris', 'Moms', 'Summa'].map((h, i) => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right',
                          fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: 'rgba(255,255,255,0.8)', fontWeight: 600,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoice.rows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 1 ? '#fafcfa' : 'white', borderBottom: '1px solid #f0f4f0' }}>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#1a1a1a' }}>{r.description}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151', textAlign: 'right' }}>{r.qty}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151', textAlign: 'right' }}>{formatSEK(r.unitPrice)}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151', textAlign: 'right' }}>{r.vatRate}%</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#111827', textAlign: 'right' }}>{formatSEK(r.qty * r.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totaler */}
                {(() => {
                  const t = calcInvoiceTotals(viewInvoice.rows);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
                      <div style={{ width: '280px', background: '#f8faf8', border: '1px solid #e0eee0', borderRadius: '12px', padding: '18px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px', color: '#52525b' }}>
                          <span>Netto (exkl. moms)</span><span>{formatSEK(t.totalNet)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px', color: '#52525b' }}>
                          <span>Moms</span><span>{formatSEK(t.totalVat)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${SIDEBAR_DARK}`, paddingTop: '14px', marginTop: '10px', fontSize: '18px', fontWeight: 700 }}>
                          <span style={{ color: '#111827' }}>{viewInvoice.type === 'quote' ? 'Total offert' : 'Att betala'}</span>
                          <span style={{ color: LIME_DARK }}>{formatSEK(t.totalGross)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Footer med betalningsinformation */}
                <div style={{ borderTop: `2px solid ${LIME}`, paddingTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', fontSize: '10.5px', color: '#71717a' }}>
                  {[
                    ['Organisationsnr', company?.orgNr || '–'],
                    ['Momsreg.nr',      company?.vatNr || '–'],
                    ['Bankgiro',        company?.bankgiro || '–'],
                    ['F-skattebevis',   company?.fSkatt || 'Godkänd för F-skatt'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontWeight: 700, color: '#374151', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</div>
                      <div>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
