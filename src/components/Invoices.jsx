import React, { useState, useEffect } from 'react';
import {
  Plus, X, Check, Send, CreditCard, Eye,
  FileText, Trash2, ArrowRight, Printer, Download, Mail, RefreshCw, AlertCircle
} from 'lucide-react';

export default function Invoices({ invoices, contacts, onAdd, onMarkPaid, onCreatePaymentLink, stripeAccountId, setInvoices, company, globalAction, clearGlobalAction }) {
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [rows, setRows] = useState([
    { description: '', qty: 1, unitPrice: 0, vatRate: 25 }
  ]);

  useEffect(() => {
    if (globalAction?.type === 'new_invoice') {
      setIsModalOpen(true);
      clearGlobalAction?.();
    }
  }, [globalAction, clearGlobalAction]);

  const customers = contacts.filter(c => c.type === 'customer');

  const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

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

  const currentTabInvoices = invoices.filter(inv => (inv.type || 'invoice') === 'invoice');

  const filtered = currentTabInvoices.filter(inv => {
    if (filter !== 'all' && inv.status !== filter) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const counts = {
    all: currentTabInvoices.length,
    draft: currentTabInvoices.filter(i => i.status === 'draft').length,
    sent: currentTabInvoices.filter(i => i.status === 'sent').length,
    paid: currentTabInvoices.filter(i => i.status === 'paid').length,
  };

  const addRow = () => setRows([...rows, { description: '', qty: 1, unitPrice: 0, vatRate: 25 }]);
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
      .filter(i => (i.type || 'invoice') === 'invoice')
      .map(i => Number.parseInt(i.invoiceNumber, 10))
      .filter(Number.isFinite);
    const nextNum = invoiceNumbers.length > 0 ? String(Math.max(...invoiceNumbers) + 1) : '1001';

    onAdd({
      type: 'invoice',
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

  const handleSend = (id, method) => {
    alert(`Skickar faktura via ${method}...`);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i));
  };

  const handleDelete = (id) => {
    if (window.confirm('Vill du ta bort denna faktura?')) {
      setInvoices(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleCredit = (id) => {
    if (window.confirm('Vill du skapa en kreditfaktura?')) {
      alert('Kreditfaktura skapad.');
    }
  };

  const handleRemind = (id) => {
    alert('Påminnelse skickad till kund.');
  };

  const handleAutoReconcile = () => {
    alert('Söker efter inbetalningar på bankkontot...');
    setTimeout(() => alert('2 fakturor har prickats av och markerats som betalda!'), 1000);
  };

  const statusLabel = (s) => {
    switch (s) {
      case 'draft': return { t: 'Utkast', bg: '#f3f4f6', c: '#4b5563' };
      case 'sent':  return { t: 'Skickad', bg: '#eff6ff', c: '#1d4ed8' };
      case 'paid':  return { t: 'Betald', bg: '#dcfce7', c: '#16a34a' };
      default: return { t: s, bg: '#f3f4f6', c: '#4b5563' };
    }
  };

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
    background: '#1a3028', border: 'none', borderRadius: '9px', fontSize: '13px', 
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
  };

  const outlineBtnStyle = {
    ...buttonStyle, background: 'white', border: '1px solid #d1d5db', color: '#374151'
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '9px',
    fontSize: '14px', color: '#111827', background: 'white', outline: 'none',
    transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>Fakturor</h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>Hantera dina fakturor och betalningar</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={outlineBtnStyle} onClick={handleAutoReconcile}>
            <RefreshCw size={14} /> Pricka av mot bank
          </button>
          <button onClick={() => setIsModalOpen(true)} style={buttonStyle}>
            <Plus size={14} /> Ny faktura
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['all', 'draft', 'sent', 'paid'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: filter === f ? 600 : 500, cursor: 'pointer',
            background: filter === f ? '#1a3028' : 'white',
            color: filter === f ? 'white' : '#6b7280',
            border: `1px solid ${filter === f ? '#1a3028' : '#e5e7eb'}`
          }}>
            {f === 'all' ? 'Alla' : f === 'draft' ? 'Utkast' : f === 'sent' ? 'Skickade' : 'Betalda'} ({counts[f] || 0})
          </button>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Faktura</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Kund</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Belopp</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Status</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, idx) => {
              const st = statusLabel(inv.status);
              const { totalGross } = calcInvoiceTotals(inv.rows);
              return (
                <tr key={inv.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color="#9ca3af" />
                      <div>
                        <div>{inv.invoiceNumber}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 400 }}>{inv.date}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#4b5563' }}>{getCustomerName(inv.customerId)}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 600 }}>{formatSEK(totalGross)}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '4px 10px', background: st.bg, color: st.c, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{st.t}</span>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {inv.status === 'draft' && (
                        <>
                          <button onClick={() => handleSend(inv.id, 'Peppol')} title="Skicka via Peppol" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb' }}><Send size={16} /></button>
                          <button onClick={() => handleSend(inv.id, 'E-post')} title="Skicka E-post" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#4b5563' }}><Mail size={16} /></button>
                          <button onClick={() => handleSend(inv.id, 'PDF')} title="Ladda ner PDF" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#4b5563' }}><Download size={16} /></button>
                        </>
                      )}
                      {inv.status === 'sent' && (
                        <>
                          <button onClick={() => onMarkPaid(inv.id)} title="Markera som betald" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#16a34a' }}><Check size={16} /></button>
                          <button onClick={() => onCreatePaymentLink(inv.id)} title="Skapa betalningslänk" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#0f766e' }}><CreditCard size={16} /></button>
                          <button onClick={() => handleRemind(inv.id)} title="Skicka påminnelse" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#d97706' }}><AlertCircle size={16} /></button>
                          <button onClick={() => handleCredit(inv.id)} title="Kreditera" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><RefreshCw size={16} /></button>
                        </>
                      )}
                      <button onClick={() => handleDelete(inv.id)} title="Ta bort" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <FileText size={24} style={{ color: '#9ca3af', margin: '0 auto 16px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>Inga fakturor funna</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Ny Faktura</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} color="#9ca3af" /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Kund</label>
                  <select style={inputStyle} value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                    <option value="">Välj kund...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Fakturadatum</label>
                    <input type="date" style={inputStyle} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Förfallodatum</label>
                    <input type="date" style={inputStyle} value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Fakturarader</h3>
                {rows.map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                    <input type="text" placeholder="Beskrivning" style={inputStyle} value={row.description} onChange={e => updateRow(i, 'description', e.target.value)} required />
                    <input type="number" placeholder="Antal" min="1" step="0.5" style={inputStyle} value={row.qty} onChange={e => updateRow(i, 'qty', e.target.value)} required />
                    <input type="number" placeholder="Pris" min="0" step="1" style={inputStyle} value={row.unitPrice} onChange={e => updateRow(i, 'unitPrice', e.target.value)} required />
                    <select style={inputStyle} value={row.vatRate} onChange={e => updateRow(i, 'vatRate', e.target.value)}>
                      {[25, 12, 6, 0].map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(i)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addRow} style={{ ...outlineBtnStyle, padding: '6px 12px', fontSize: '12px', marginTop: '8px' }}>+ Lägg till rad</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={outlineBtnStyle}>Avbryt</button>
                <button type="submit" style={buttonStyle}><Check size={14} /> Spara som utkast</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
