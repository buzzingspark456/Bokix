import React, { useState } from 'react';
import {
  Plus, X, Check, Search, Receipt, ArrowUpRight, ArrowDownRight, CreditCard
} from 'lucide-react';

const VAT_RATES = [25, 12, 6, 0];

export default function Expenses({ expenses, accounts, contacts, onAdd }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [vatRate, setVatRate] = useState(25);
  const [costAccount, setCostAccount] = useState('6900');
  const [supplierId, setSupplierId] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const costAccounts = accounts.filter(a => a.type === 'kostnad');
  const suppliers = contacts.filter(c => c.type === 'supplier');

  const formatSEK = (val) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val);

  const getSupplierName = (id) => {
    if (!id) return '—';
    const s = contacts.find(c => c.id === id);
    return s ? s.name : '—';
  };

  const getCostAccountName = (code) => {
    const a = accounts.find(acc => acc.code === code);
    return a ? a.name : code;
  };

  // Calculated
  const gross = parseFloat(grossAmount) || 0;
  const vatFactor = vatRate / (100 + vatRate);
  const vatAmount = gross * vatFactor;
  const netAmount = gross - vatAmount;

  const filtered = expenses.filter(exp => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return exp.description.toLowerCase().includes(s) || exp.date.includes(s) || exp.costAccount.includes(s);
  }).sort((a, b) => b.date.localeCompare(a.date));

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalVat = expenses.reduce((s, e) => s + (e.vatAmount || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gross <= 0 || !description) return;

    onAdd({
      date,
      description,
      amount: Math.round(gross),
      netAmount: Math.round(netAmount),
      vatAmount: Math.round(vatAmount),
      vatRate,
      costAccount,
      supplierId: supplierId || null,
      receiptName: receiptFile ? receiptFile.name : null,
    });

    setDescription(''); setGrossAmount(''); setVatRate(25); setCostAccount('6900'); setSupplierId(''); setReceiptFile(null); setIsModalOpen(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setReceiptFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
    background: '#2563eb', border: 'none', borderRadius: '9px', fontSize: '13px', 
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '9px',
    fontSize: '14px', color: '#111827', background: 'white', outline: 'none',
    transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            Utgifter & Kvitton
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Registrera dina utlägg och inköp. Bokförs automatiskt.
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
        >
          <Plus size={14} /> Ny utgift
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Totala utgifter</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>{formatSEK(totalExpenses)}</div>
          </div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: '#ecfeff', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUpRight size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Moms att dra av</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>{formatSEK(totalVat)}</div>
          </div>
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Sök kvitto eller beskrivning..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '34px', paddingRight: '12px', paddingBottom: '7px', paddingTop: '7px' }}
          />
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', width: '110px' }}>Datum</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Beskrivning</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Leverantör</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Konto</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Netto</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Moms</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Totalt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp, idx) => (
                <tr key={exp.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 20px', color: '#6b7280' }}>{exp.date}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 500, color: '#111827' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '6px', background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Receipt size={13} /></div>
                      {exp.description}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#4b5563', fontSize: '13px' }}>{getSupplierName(exp.supplierId)}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px' }}>
                    <span style={{ color: '#2563eb', fontWeight: 600, marginRight: '6px' }}>{exp.costAccount}</span>
                    <span style={{ color: '#6b7280' }}>{getCostAccountName(exp.costAccount)}</span>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', color: '#374151' }}>{formatSEK(exp.netAmount)}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', color: '#9ca3af' }}>{exp.vatAmount > 0 ? formatSEK(exp.vatAmount) : '—'}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em' }}>{formatSEK(exp.amount)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Receipt size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                      Inga utgifter
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      Registrera ditt första kvitto eller inköp
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL ── */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Registrera utgift</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              
              {/* Receipt Upload Area */}
              <label 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ 
                  display: 'block', marginBottom: '24px', padding: '32px 20px', 
                  border: `2px dashed ${isDragging ? '#2563eb' : (receiptFile ? '#16a34a' : '#d1d5db')}`, 
                  borderRadius: '12px', textAlign: 'center', 
                  background: isDragging ? '#eff6ff' : (receiptFile ? '#f0fdf4' : '#f9fafb'), 
                  cursor: 'pointer', transition: 'all 0.2s' 
                }}
              >
                <input type="file" style={{ display: 'none' }} onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: receiptFile ? '#dcfce7' : '#eff6ff', color: receiptFile ? '#16a34a' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  {receiptFile ? <Check size={24} /> : <Receipt size={24} />}
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
                  {receiptFile ? receiptFile.name : 'Dra och släpp kvitto här'}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {receiptFile ? 'Klicka för att byta fil' : 'eller klicka för att bläddra (PDF, PNG, JPG)'}
                </div>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Datum</label>
                  <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Leverantör</label>
                  <select style={inputStyle} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                    <option value="">Ingen/Okänd</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Beskrivning *</label>
                <input type="text" style={inputStyle} placeholder="T.ex. Kontorsmaterial, Hyra..." value={description} onChange={e => setDescription(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Belopp inkl. moms *</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0" step="0.01" value={grossAmount} onChange={e => setGrossAmount(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Moms</label>
                  <select style={inputStyle} value={vatRate} onChange={e => setVatRate(parseInt(e.target.value))}>
                    {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Kostnadskonto</label>
                  <select style={inputStyle} value={costAccount} onChange={e => setCostAccount(e.target.value)}>
                    {costAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
              </div>

              {gross > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Autogenererad Bokföring</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><span style={{ color: '#2563eb', fontWeight: 600, marginRight: '6px' }}>{costAccount}</span> {getCostAccountName(costAccount)}</span>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>D: {formatSEK(netAmount)}</span>
                    </div>
                    {vatAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span><span style={{ color: '#2563eb', fontWeight: 600, marginRight: '6px' }}>2641</span> Ingående moms</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>D: {formatSEK(vatAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                      <span><span style={{ color: '#2563eb', fontWeight: 600, marginRight: '6px' }}>1930</span> Bank</span>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>K: {formatSEK(gross)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Avbryt</button>
                <button type="submit" disabled={gross <= 0 || !description} style={{ ...buttonStyle, opacity: (gross <= 0 || !description) ? 0.5 : 1 }}>
                  <Check size={14} /> Bokför utgift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
