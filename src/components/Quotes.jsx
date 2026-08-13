import React, { useState } from 'react';
import { FileSpreadsheet, Plus, Search, FileText, Check, X, Download, Mail, Copy, Trash2 } from 'lucide-react';

export default function Quotes({ invoices = [], setInvoices, contacts = [], globalAction, clearGlobalAction, handleGlobalAction }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    customer: '',
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    rows: [{ description: '', price: '', qty: 1, vat: 25 }]
  });

  React.useEffect(() => {
    if (globalAction?.type === 'new_quote') {
      setIsModalOpen(true);
      clearGlobalAction();
    }
  }, [globalAction, clearGlobalAction]);

  // All quotes = invoices with type 'quote'
  const quotes = (invoices || []).filter(i => i.type === 'quote');

  const filtered = quotes.filter(q => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const customerName = contacts.find(c => c.id === q.customerId)?.name || q.customerName || '';
    return customerName.toLowerCase().includes(s) || (q.invoiceNumber || '').toLowerCase().includes(s);
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'accepted': return { bg: '#dcfce7', color: '#166534', label: 'Accepterad' };
      case 'sent': return { bg: '#eff6ff', color: '#1d4ed8', label: 'Skickad' };
      case 'rejected': return { bg: '#fee2e2', color: '#991b1b', label: 'Avvisad' };
      case 'expired': return { bg: '#fef3c7', color: '#92400e', label: 'Förfallen' };
      default: return { bg: '#f3f4f6', color: '#4b5563', label: 'Utkast' };
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Vill du ta bort denna offert?')) return;
    if (setInvoices) setInvoices(prev => prev.filter(i => i.id !== id));
  };

  const handleConvert = (quote) => {
    if (!window.confirm('Konvertera denna offert till en faktura?')) return;
    if (!setInvoices) return;
    setInvoices(prev => prev.map(i =>
      i.id === quote.id ? { ...i, type: 'invoice', status: 'draft' } : i
    ));
    if (handleGlobalAction) handleGlobalAction(null, 'invoices');
  };

  const handleAddRow = () => setForm(f => ({ ...f, rows: [...f.rows, { description: '', price: '', qty: 1, vat: 25 }] }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!setInvoices) return;
    const quoteNumber = `OFF-${1000 + quotes.length + 1}`;
    const rows = form.rows.map(r => ({
      description: r.description,
      qty: Number(r.qty) || 1,
      unitPrice: Number(r.price) || 0,
      vatRate: Number(r.vat) || 25,
    }));
    const contact = contacts.find(c => c.id === form.customerId);
    const newQuote = {
      id: `q_${Date.now()}`,
      type: 'quote',
      invoiceNumber: quoteNumber,
      customerId: form.customerId,
      customerName: contact?.name || form.customer,
      date: form.date,
      dueDate: form.dueDate || '',
      status: 'draft',
      rows,
    };
    setInvoices(prev => [newQuote, ...(prev || [])]);
    setIsModalOpen(false);
    setForm({ customer: '', customerId: '', date: new Date().toISOString().split('T')[0], dueDate: '', rows: [{ description: '', price: '', qty: 1, vat: 25 }] });
  };

  const getTotal = (q) => {
    return (q.rows || []).reduce((sum, r) => {
      const net = (r.qty || 1) * (r.unitPrice || 0);
      return sum + net + net * ((r.vatRate || 0) / 100);
    }, 0);
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
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            Offerter
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Skapa offerter och konvertera till fakturor när kunden accepterat
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsModalOpen(true)} style={buttonStyle}>
            <Plus size={14} /> Ny offert
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text" placeholder="Sök offert eller kund..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '34px', paddingRight: '12px', paddingBottom: '7px', paddingTop: '7px' }}
          />
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Offertnr</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Kund</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Datum</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Belopp</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, idx) => {
                const s = getStatusStyle(q.status);
                const customerName = contacts.find(c => c.id === q.customerId)?.name || q.customerName || '—';
                const total = getTotal(q);
                return (
                  <tr key={q.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileSpreadsheet size={16} color="#9ca3af" /> {q.invoiceNumber || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#4b5563', fontWeight: 500 }}>{customerName}</td>
                    <td style={{ padding: '14px 20px', color: '#6b7280' }}>{q.date}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '4px 10px', background: s.bg, color: s.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500 }}>{total.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {(q.status === 'accepted' || q.status === 'draft') && (
                          <button onClick={() => handleConvert(q)} title="Konvertera till faktura" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3d7a2e' }}>
                            <FileText size={16} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(q.id)} title="Ta bort" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <FileSpreadsheet size={24} style={{ color: '#9ca3af', margin: '0 auto 16px', display: 'block' }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Inga offerter skapade</div>
                    <div style={{ fontSize: '13px', color: '#9ca3af' }}>Klicka på "Ny offert" för att komma igång</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Ny offert</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} color="#9ca3af" /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Kund</label>
                  {contacts.length > 0 ? (
                    <select
                      style={inputStyle}
                      value={form.customerId}
                      onChange={e => {
                        const contact = contacts.find(c => c.id === e.target.value);
                        setForm(f => ({ ...f, customerId: e.target.value, customer: contact?.name || '' }));
                      }}
                    >
                      <option value="">Välj kund...</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" style={inputStyle} value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder="Kundnamn" required />
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Datum</label>
                  <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Offertrader</h3>
                {form.rows.map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <input type="text" placeholder="Beskrivning" style={inputStyle} value={row.description}
                      onChange={e => { const r = [...form.rows]; r[i].description = e.target.value; setForm(f => ({ ...f, rows: r })); }} required />
                    <input type="number" placeholder="Á-pris" style={inputStyle} value={row.price}
                      onChange={e => { const r = [...form.rows]; r[i].price = e.target.value; setForm(f => ({ ...f, rows: r })); }} required />
                    <input type="number" placeholder="Antal" style={inputStyle} value={row.qty}
                      onChange={e => { const r = [...form.rows]; r[i].qty = e.target.value; setForm(f => ({ ...f, rows: r })); }} />
                    <input type="number" placeholder="Moms %" style={inputStyle} value={row.vat}
                      onChange={e => { const r = [...form.rows]; r[i].vat = e.target.value; setForm(f => ({ ...f, rows: r })); }} />
                  </div>
                ))}
                <button type="button" onClick={handleAddRow} style={{ ...outlineBtnStyle, padding: '6px 12px', fontSize: '12px', marginTop: '8px' }}>+ Lägg till rad</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={outlineBtnStyle}>Avbryt</button>
                <button type="submit" style={buttonStyle}><Check size={14} /> Spara offert</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
