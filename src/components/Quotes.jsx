import React, { useState } from 'react';
import { FileSpreadsheet, Plus, Search, FileText, Check, X, Download, Mail, Copy } from 'lucide-react';

export default function Quotes({ globalAction, clearGlobalAction, handleGlobalAction }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [quotes, setQuotes] = useState([
    { id: 'q1', number: 'OFF-1001', customer: 'Acme Corp AB', date: '2026-08-01', amount: 25000, status: 'accepterad' },
    { id: 'q2', number: 'OFF-1002', customer: 'Bokix AB', date: '2026-08-05', amount: 12000, status: 'utkast' },
    { id: 'q3', number: 'OFF-1003', customer: 'Testbolaget', date: '2026-07-20', amount: 8500, status: 'avvisad' },
  ]);

  const [form, setForm] = useState({
    customer: '', date: new Date().toISOString().split('T')[0], rows: [{ description: '', price: '', vat: 25, discount: 0 }]
  });

  React.useEffect(() => {
    if (globalAction?.type === 'new_quote') {
      setIsModalOpen(true);
      clearGlobalAction();
    }
  }, [globalAction, clearGlobalAction]);

  const filtered = quotes.filter(q => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return q.customer.toLowerCase().includes(s) || q.number.toLowerCase().includes(s);
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'accepterad': return { bg: '#dcfce7', color: '#166534', label: 'Accepterad' };
      case 'utkast': return { bg: '#f3f4f6', color: '#4b5563', label: 'Utkast' };
      case 'skickad': return { bg: '#eff6ff', color: '#1d4ed8', label: 'Skickad' };
      case 'avvisad': return { bg: '#fee2e2', color: '#991b1b', label: 'Avvisad' };
      case 'förfallen': return { bg: '#fef3c7', color: '#92400e', label: 'Förfallen' };
      default: return { bg: '#f3f4f6', color: '#4b5563', label: status };
    }
  };

  const handleConvert = (id) => {
    if (window.confirm('Vill du konvertera denna offert till en faktura?')) {
      if(handleGlobalAction) handleGlobalAction('new_invoice', 'invoices');
    }
  };

  const handleAddRow = () => setForm(f => ({ ...f, rows: [...f.rows, { description: '', price: '', vat: 25, discount: 0 }] }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = form.rows.reduce((sum, r) => sum + (parseFloat(r.price) || 0) * (1 - (parseFloat(r.discount) || 0)/100) * (1 + (parseFloat(r.vat) || 0)/100), 0);
    setQuotes(prev => [{
      id: `q_${Date.now()}`, number: `OFF-${1004 + prev.length}`, customer: form.customer || 'Ny Kund', date: form.date, amount, status: 'utkast'
    }, ...prev]);
    setIsModalOpen(false);
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
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            Offerter
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Skapa offerter och konvertera till fakturor när kunden accepterat
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={outlineBtnStyle} onClick={() => alert('Offerter -> Hantera mallar (Mock)')}>
            <Copy size={14} /> Mallar
          </button>
          <button onClick={() => setIsModalOpen(true)} style={buttonStyle}>
            <Plus size={14} /> Ny offert
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text" placeholder="Sök offert eller kund..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '34px', paddingRight: '12px', paddingBottom: '7px', paddingTop: '7px' }}
          />
        </div>
      </div>

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
                return (
                  <tr key={q.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileSpreadsheet size={16} color="#9ca3af" /> {q.number}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#4b5563', fontWeight: 500 }}>{q.customer}</td>
                    <td style={{ padding: '14px 20px', color: '#6b7280' }}>{q.date}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '4px 10px', background: s.bg, color: s.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500 }}>{q.amount.toLocaleString('sv-SE')} kr</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button title="Skicka e-post" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#4b5563' }}><Mail size={16} /></button>
                        <button title="Ladda ner PDF" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#4b5563' }}><Download size={16} /></button>
                        {q.status === 'accepterad' && (
                          <button onClick={() => handleConvert(q.id)} title="Skapa faktura" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb' }}><FileText size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <FileSpreadsheet size={24} style={{ color: '#9ca3af', margin: '0 auto 16px' }} />
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Inga offerter funna</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Ny offert</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} color="#9ca3af" /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Kund</label>
                  <input type="text" style={inputStyle} value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Datum</label>
                  <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Offertrader</h3>
                {form.rows.map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="Beskrivning" style={inputStyle} value={row.description} onChange={e => { const r = [...form.rows]; r[i].description = e.target.value; setForm(f => ({ ...f, rows: r })); }} required />
                    <input type="number" placeholder="Pris" style={inputStyle} value={row.price} onChange={e => { const r = [...form.rows]; r[i].price = e.target.value; setForm(f => ({ ...f, rows: r })); }} required />
                    <input type="number" placeholder="Moms %" style={inputStyle} value={row.vat} onChange={e => { const r = [...form.rows]; r[i].vat = e.target.value; setForm(f => ({ ...f, rows: r })); }} />
                    <input type="number" placeholder="Rabatt %" style={inputStyle} value={row.discount} onChange={e => { const r = [...form.rows]; r[i].discount = e.target.value; setForm(f => ({ ...f, rows: r })); }} />
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
