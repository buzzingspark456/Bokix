import React, { useState } from 'react';
import {
  Plus, X, Check, Search, ChevronDown, ChevronUp, BookOpen, Trash2, AlertCircle, RotateCcw
} from 'lucide-react';

export default function Verifications({ verifications, setVerifications, accounts, onAdd }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedVer, setExpandedVer] = useState({});

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState([
    { account: '1930', debet: 0, kredit: 0 },
    { account: '3001', debet: 0, kredit: 0 }
  ]);

  const toggleExpand = (id) => {
    setExpandedVer(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddRow = () => {
    setRows([...rows, { account: '1930', debet: 0, kredit: 0 }]);
  };

  const handleRemoveRow = (index) => {
    if (rows.length > 2) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    if (field === 'account') {
      newRows[index][field] = value;
    } else {
      const val = parseFloat(value) || 0;
      newRows[index][field] = val;
      // En rad kan inte ha både debet och kredit
      if (val > 0) {
        newRows[index][field === 'debet' ? 'kredit' : 'debet'] = 0;
      }
    }
    setRows(newRows);
  };

  const applyTemplate = (type) => {
    let newRows = [];
    if (type === 'office') {
      newRows = [
        { account: '6110', debet: 1000, kredit: 0 },
        { account: '2641', debet: 250, kredit: 0 },
        { account: '1930', debet: 0, kredit: 1250 }
      ];
      setDescription('Kontorsmaterial');
    } else if (type === 'representation') {
      newRows = [
        { account: '6071', debet: 1000, kredit: 0 },
        { account: '2641', debet: 120, kredit: 0 },
        { account: '1930', debet: 0, kredit: 1120 }
      ];
      setDescription('Representation (intern)');
    } else if (type === 'sales') {
      newRows = [
        { account: '1930', debet: 12500, kredit: 0 },
        { account: '2611', debet: 0, kredit: 2500 },
        { account: '3001', debet: 0, kredit: 10000 }
      ];
      setDescription('Försäljning varor');
    }
    setRows(newRows);
  };

  const handleAutoVAT = () => {
    if (rows.length < 1) return;
    const amount = rows[0].debet > 0 ? rows[0].debet : rows[0].kredit;
    if (amount <= 0) return;

    const isSales = rows[0].account.startsWith('3');
    const vatAmount = Math.round(amount * 0.2);
    const netAmount = amount - vatAmount;

    const newRows = [...rows];
    if (newRows[0].debet > 0) newRows[0].debet = netAmount;
    else if (newRows[0].kredit > 0) newRows[0].kredit = netAmount;

    const vatAccount = isSales ? '2611' : '2641';
    
    newRows.push({
      account: vatAccount,
      debet: isSales ? 0 : vatAmount,
      kredit: isSales ? vatAmount : 0
    });

    const totalDiff = newRows.reduce((sum, r) => sum + (r.debet - r.kredit), 0);
    if (totalDiff !== 0) {
      newRows.push({
        account: '1930',
        debet: totalDiff < 0 ? Math.abs(totalDiff) : 0,
        kredit: totalDiff > 0 ? totalDiff : 0
      });
    }

    setRows(newRows);
  };

  const totalDebet = rows.reduce((sum, r) => sum + r.debet, 0);
  const totalKredit = rows.reduce((sum, r) => sum + r.kredit, 0);
  const isBalanced = Math.abs(totalDebet - totalKredit) < 0.01 && totalDebet > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isBalanced) return;

    onAdd({
      date,
      description,
      rows: rows.filter(r => r.debet > 0 || r.kredit > 0)
    });

    setDescription('');
    setRows([
      { account: '1930', debet: 0, kredit: 0 },
      { account: '3001', debet: 0, kredit: 0 }
    ]);
    setIsModalOpen(false);
  };

  const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val);

  const filteredVerifications = verifications.filter(ver => {
    const searchLower = searchTerm.toLowerCase();
    return (
      ver.description.toLowerCase().includes(searchLower) ||
      ver.number.toLowerCase().includes(searchLower) ||
      ver.rows.some(r => r.account.includes(searchLower))
    );
  }).sort((a, b) => b.date.localeCompare(a.date));

  const handleVoidVerification = (ver) => {
    if (window.confirm("Är du säker på att du vill makulera denna verifikation? En rättelseverifikation (vändning) kommer att skapas.")) {
      const reversedRows = ver.rows.map(r => ({
        account: r.account,
        debet: r.kredit > 0 ? r.kredit : 0,
        kredit: r.debet > 0 ? r.debet : 0
      }));
      onAdd({
        date: new Date().toISOString().split('T')[0],
        description: `Rättelse av verifikation ${ver.number}`,
        rows: reversedRows
      });
    }
  };

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
    background: '#2563eb', border: 'none', borderRadius: '9px', fontSize: '13px', 
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
  };

  const secondaryButtonStyle = {
    ...buttonStyle, background: 'white', border: '1px solid #e5e7eb', color: '#374151'
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
            Verifikationer
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Huvudbok med dubbel bokföring
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
        >
          <Plus size={14} /> Ny verifikation
        </button>
      </div>

      {/* ── SEARCH ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Sök verifikation, datum eller konto..."
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
                <th style={{ width: '40px', padding: '14px 10px' }}></th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Nummer</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Datum</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Beskrivning</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Total debet</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right', width: '100px' }}>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filteredVerifications.map((ver, idx) => {
                const isExpanded = !!expandedVer[ver.id];
                const totalVal = ver.rows.reduce((sum, r) => sum + (r.debet || 0), 0);
                
                return (
                  <React.Fragment key={ver.id}>
                    <tr style={{ cursor: 'pointer', background: isExpanded ? '#f8fafc' : 'transparent', borderBottom: (isExpanded || idx === filteredVerifications.length - 1) ? 'none' : '1px solid #f3f4f6', transition: 'background 0.1s' }} 
                        onClick={() => toggleExpand(ver.id)}
                        onMouseEnter={e => !isExpanded && (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={e => !isExpanded && (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 10px', color: '#9ca3af', textAlign: 'center' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111827' }}>{ver.number}</td>
                      <td style={{ padding: '14px 20px', color: '#6b7280' }}>{ver.date}</td>
                      <td style={{ padding: '14px 20px', fontWeight: 500, color: '#374151' }}>
                        {ver.description}
                        {(ver.source === 'invoice' || ver.source === 'expense') && (
                          <span style={{ marginLeft: '8px', padding: '2px 8px', background: ver.source === 'invoice' ? '#eff6ff' : '#f3f4f6', color: ver.source === 'invoice' ? '#2563eb' : '#4b5563', borderRadius: '12px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Auto</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em' }}>{formatSEK(totalVal)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleVoidVerification(ver)} title="Makulera (Skapa rättelse)" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <RotateCcw size={16} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: idx < filteredVerifications.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td colSpan="6" style={{ background: '#f8fafc', padding: '0 24px 24px 44px' }}>
                          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                                  <th style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Konto</th>
                                  <th style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b', textAlign: 'right', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Debet</th>
                                  <th style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b', textAlign: 'right', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kredit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ver.rows.map((row, rIdx) => {
                                  const acc = accounts.find(a => a.code === row.account);
                                  return (
                                    <tr key={rIdx} style={{ borderBottom: rIdx === ver.rows.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#334155' }}>
                                        <strong style={{ color: '#2563eb', marginRight: '8px' }}>{row.account}</strong> {acc ? acc.name : ''}
                                      </td>
                                      <td style={{ padding: '10px 16px', fontSize: '13px', textAlign: 'right', color: row.debet > 0 ? '#16a34a' : 'inherit', fontWeight: row.debet > 0 ? 600 : 400, letterSpacing: '-0.02em' }}>
                                        {row.debet > 0 ? formatSEK(row.debet) : ''}
                                      </td>
                                      <td style={{ padding: '10px 16px', fontSize: '13px', textAlign: 'right', color: row.kredit > 0 ? '#dc2626' : 'inherit', fontWeight: row.kredit > 0 ? 600 : 400, letterSpacing: '-0.02em' }}>
                                        {row.kredit > 0 ? formatSEK(row.kredit) : ''}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredVerifications.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <BookOpen size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                      Inga verifikationer funna
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
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Registrera ny verifikation</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Datum</label>
                  <input type="date" style={inputStyle} required value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Beskrivning</label>
                  <input type="text" style={inputStyle} placeholder="T.ex. Överföring egen insättning" required value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', marginBottom: '24px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bokföringsmallar</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => applyTemplate('office')} style={{ padding: '6px 12px', background: 'white', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#1d4ed8', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#60a5fa'} onMouseLeave={e => e.currentTarget.style.borderColor = '#bfdbfe'}>Kontorsmaterial</button>
                  <button type="button" onClick={() => applyTemplate('representation')} style={{ padding: '6px 12px', background: 'white', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#1d4ed8', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#60a5fa'} onMouseLeave={e => e.currentTarget.style.borderColor = '#bfdbfe'}>Representation</button>
                  <button type="button" onClick={() => applyTemplate('sales')} style={{ padding: '6px 12px', background: 'white', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#1d4ed8', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#60a5fa'} onMouseLeave={e => e.currentTarget.style.borderColor = '#bfdbfe'}>Försäljning (25% moms)</button>
                </div>
              </div>

              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Kontering</label>
                <button type="button" onClick={handleAutoVAT} style={{ padding: '5px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'} onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}>
                  Automatisera moms på rad 1
                </button>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                {rows.map((row, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px', gap: '8px', padding: '12px', borderBottom: index < rows.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center' }}>
                    <select style={{ ...inputStyle, padding: '7px 10px' }} value={row.account} onChange={(e) => handleRowChange(index, 'account', e.target.value)}>
                      {accounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                    </select>
                    <input type="number" style={{ ...inputStyle, padding: '7px 10px' }} min="0" placeholder="Debet" value={row.debet || ''} onChange={(e) => handleRowChange(index, 'debet', e.target.value)} />
                    <input type="number" style={{ ...inputStyle, padding: '7px 10px' }} min="0" placeholder="Kredit" value={row.kredit || ''} onChange={(e) => handleRowChange(index, 'kredit', e.target.value)} />
                    <button type="button" disabled={rows.length <= 2} onClick={() => handleRemoveRow(index)} style={{ background: 'transparent', border: 'none', color: rows.length > 2 ? '#ef4444' : '#d1d5db', cursor: rows.length > 2 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <div style={{ padding: '12px', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                  <button type="button" onClick={handleAddRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #e5e7eb', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    <Plus size={14} /> Lägg till rad
                  </button>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '32px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Summa Debet</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a', letterSpacing: '-0.02em' }}>{formatSEK(totalDebet)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Summa Kredit</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', letterSpacing: '-0.02em' }}>{formatSEK(totalKredit)}</div>
                  </div>
                </div>
                <div>
                  {!isBalanced && totalDebet > 0 && (
                    <div style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, background: '#fef2f2', padding: '6px 12px', borderRadius: '20px' }}>
                      <AlertCircle size={16} /> Differens: {formatSEK(Math.abs(totalDebet - totalKredit))}
                    </div>
                  )}
                  {isBalanced && totalDebet > 0 && (
                    <div style={{ color: '#16a34a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, background: '#f0fdf4', padding: '6px 12px', borderRadius: '20px' }}>
                      <Check size={16} /> Balanserad
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Avbryt</button>
                <button type="submit" disabled={!isBalanced} style={{ ...buttonStyle, opacity: !isBalanced ? 0.5 : 1 }}>
                  <Check size={14} /> Bokför
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
