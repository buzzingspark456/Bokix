import React, { useState } from 'react';
import { Plus, X, Check, AlertCircle, FolderTree } from 'lucide-react';

export default function Accounts({ accounts, balances, setAccounts }) {
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Account form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('tillgang');
  const [errorMsg, setErrorMsg] = useState('');

  const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val);

  const getSwedishTypeName = (t) => {
    switch (t) {
      case 'tillgang': return 'Tillgång';
      case 'skuld_kapital': return 'Eget kapital & Skulder';
      case 'intakt': return 'Intäkt';
      case 'kostnad': return 'Kostnad';
      default: return '';
    }
  };

  const getAccountColor = (t) => {
    switch (t) {
      case 'tillgang': return { bg: '#eef6fb', text: '#3a8fc1', border: '#b9dcf2' };
      case 'skuld_kapital': return { bg: 'var(--status-red-bg)', text: 'var(--status-red-text)', border: 'var(--status-red-bg)' };
      case 'intakt': return { bg: '#f1f8f1', text: '#5ba85a', border: '#bce4bc' };
      case 'kostnad': return { bg: 'var(--status-amber-bg)', text: '#d97706', border: '#fcd34d' };
      default: return { bg: 'var(--border-light)', text: 'var(--text-secondary)', border: 'var(--border)' };
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    if (filterType === 'all') return true;
    return acc.type === filterType;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!/^\d{4}$/.test(code)) {
      setErrorMsg('Kontokod måste bestå av exakt 4 siffror.');
      return;
    }
    if (accounts.some(acc => acc.code === code)) {
      setErrorMsg(`Kontokod ${code} finns redan.`);
      return;
    }
    setAccounts(prev => {
      const updated = [...prev, { code, name, type }];
      return updated.sort((a, b) => parseInt(a.code) - parseInt(b.code));
    });
    setCode(''); setName(''); setType('tillgang'); setIsModalOpen(false);
  };

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
    background: '#5ba85a', border: 'none', borderRadius: '9px', fontSize: '13px', 
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
    fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
    transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-main)', marginBottom: '5px' }}>
            Kontoplan
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', fontWeight: 400 }}>
            BAS-kontoplan för ditt företag
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.background = '#4a8d49'}
          onMouseLeave={e => e.currentTarget.style.background = '#5ba85a'}
        >
          <Plus size={14} /> Nytt konto
        </button>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'Alla konton' },
          { id: 'tillgang', label: 'Tillgångar (1xxx)' },
          { id: 'skuld_kapital', label: 'Skulder & Eget kapital (2xxx)' },
          { id: 'intakt', label: 'Intäkter (3xxx)' },
          { id: 'kostnad', label: 'Kostnader (4-8xxx)' }
        ].map(f => (
          <button key={f.id} onClick={() => setFilterType(f.id)} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: filterType === f.id ? 600 : 500, cursor: 'pointer',
            background: filterType === f.id ? '#3a8fc1' : 'var(--bg-card)',
            color: filterType === f.id ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${filterType === f.id ? '#3a8fc1' : 'var(--border)'}`,
            transition: 'all 0.15s', fontFamily: 'inherit'
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── TABLE ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-main)' }}>Kontokod</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-main)' }}>Kontonamn</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-main)' }}>Kontotyp</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>Aktuellt saldo</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc, idx) => {
                const bal = balances[acc.code] || 0;
                const acolor = getAccountColor(acc.type);
                return (
                  <tr key={acc.code} style={{ borderBottom: idx < filteredAccounts.length - 1 ? '1px solid var(--border-light)' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td data-label="Kontokod" style={{ padding: '14px 20px', fontWeight: 700, color: '#3a8fc1' }}>{acc.code}</td>
                    <td data-label="Kontonamn" style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--text-main)' }}>{acc.name}</td>
                    <td data-label="Kontotyp" style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '4px 10px', background: acolor.bg, color: acolor.text, border: `1px solid ${acolor.border}`, borderRadius: '20px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em' }}>
                        {getSwedishTypeName(acc.type)}
                      </span>
                    </td>
                    <td data-label="Aktuellt saldo" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: bal === 0 ? 'var(--text-muted)' : 'var(--text-main)', letterSpacing: '-0.02em' }}>
                      {formatSEK(bal)}
                    </td>
                  </tr>
                );
              })}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--border-light)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <FolderTree size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      Inga konton hittades
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Lägg till konto</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Kontokod (4 siffror)</label>
                <input type="text" style={inputStyle} placeholder="T.ex. 1930" required value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Kontonamn</label>
                <input type="text" style={inputStyle} placeholder="T.ex. Företagskonto" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Kontotyp</label>
                <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="tillgang">Tillgång (Klass 1)</option>
                  <option value="skuld_kapital">Eget kapital och skulder (Klass 2)</option>
                  <option value="intakt">Intäkt (Klass 3)</option>
                  <option value="kostnad">Kostnad (Klass 4-8)</option>
                </select>
              </div>

              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontWeight: 600, background: 'var(--status-red-bg)', padding: '8px 12px', borderRadius: '8px' }}>
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '9px', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Avbryt</button>
                <button type="submit" style={buttonStyle}>
                  <Check size={14} /> Spara konto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
