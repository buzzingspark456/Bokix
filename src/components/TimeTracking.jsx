import React, { useState } from 'react';
import { Clock, Plus, Trash2, Calendar, Check, X, Briefcase, User, FileText, Filter } from 'lucide-react';

export default function TimeTracking({ globalAction, clearGlobalAction, handleGlobalAction }) {
  const [entries, setEntries] = useState([
    { id: 1, type: 'kund', date: '2026-08-01', name: 'Acme Corp AB', task: 'Designskisser', hours: 4, hourlyRate: 900, startCost: 0, total: 3600, user: 'Du' },
    { id: 2, type: 'anstalld', date: '2026-08-01', name: 'Internt', task: 'Möte', hours: 1, hourlyRate: 0, startCost: 0, total: 0, user: 'Anna' }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState('kund'); // 'kund' | 'anstalld'
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [name, setName] = useState('');
  const [task, setTask] = useState('');
  const [hours, setHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [startCost, setStartCost] = useState('');

  const [viewScope, setViewScope] = useState('own'); // 'own' | 'team'
  const [viewTime, setViewTime] = useState('week'); // 'week' | 'day'

  React.useEffect(() => {
    if (globalAction?.type === 'new_time') {
      setIsModalOpen(true);
      clearGlobalAction();
    }
  }, [globalAction, clearGlobalAction]);

  const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val);

  const calcTotal = () => {
    const h = parseFloat(hours) || 0;
    const rate = parseFloat(hourlyRate) || 0;
    const sc = parseFloat(startCost) || 0;
    return (h * rate) + sc;
  };
  const total = calcTotal();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !task || parseFloat(hours) <= 0) return;

    setEntries(prev => [{
      id: Date.now(),
      type, date, name, task,
      hours: parseFloat(hours),
      hourlyRate: parseFloat(hourlyRate) || 0,
      startCost: parseFloat(startCost) || 0,
      total,
      user: 'Du'
    }, ...prev]);

    setName(''); setTask(''); setHours(''); setHourlyRate(''); setStartCost('');
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const filteredEntries = entries.filter(e => viewScope === 'team' || e.user === 'Du');

  const totalHours = filteredEntries.reduce((s, e) => s + e.hours, 0);
  const totalInvoiced = filteredEntries.filter(e => e.type === 'kund').reduce((s, e) => s + e.total, 0);
  const totalSalary = filteredEntries.filter(e => e.type === 'anstalld').reduce((s, e) => s + e.total, 0);

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

  const toggleGroupStyle = {
    display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '10px'
  };

  const toggleBtnStyle = (isActive) => ({
    padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    background: isActive ? 'white' : 'transparent',
    color: isActive ? '#111827' : '#6b7280',
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.15s'
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            Rapportera timmar
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Spåra tid för fakturering till kunder eller som underlag för löner.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={toggleGroupStyle}>
            <button style={toggleBtnStyle(viewScope === 'own')} onClick={() => setViewScope('own')}>Min tid</button>
            <button style={toggleBtnStyle(viewScope === 'team')} onClick={() => setViewScope('team')}>Teamet</button>
          </div>
          <div style={toggleGroupStyle}>
            <button style={toggleBtnStyle(viewTime === 'day')} onClick={() => setViewTime('day')}>Idag</button>
            <button style={toggleBtnStyle(viewTime === 'week')} onClick={() => setViewTime('week')}>Vecka</button>
          </div>
          <button style={buttonStyle} onClick={() => setIsModalOpen(true)}>
            <Plus size={14} /> Logga tid
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Totalt antal timmar</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>{totalHours} h</div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Fakturerbart Värde</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>{formatSEK(totalInvoiced)}</div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Personalkostnad (Lön)</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>{formatSEK(totalSalary)}</div>
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', width: '110px' }}>Datum</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Användare</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Typ</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Projekt/Kund</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Uppgift</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Timmar</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Totalt värde</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, idx) => (
                <tr key={entry.id} style={{ borderBottom: idx < filteredEntries.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '14px 20px', color: '#6b7280' }}>{entry.date}</td>
                  <td style={{ padding: '14px 20px', color: '#111827', fontWeight: 500 }}>{entry.user}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '4px 10px', background: entry.type === 'kund' ? '#eff6ff' : '#f0fdf4', color: entry.type === 'kund' ? '#1d4ed8' : '#16a34a', border: `1px solid ${entry.type === 'kund' ? '#bfdbfe' : '#bbf7d0'}`, borderRadius: '20px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em' }}>
                      {entry.type === 'kund' ? 'Fakturering' : 'Löneunderlag'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>{entry.name}</td>
                  <td style={{ padding: '14px 20px', color: '#4b5563' }}>{entry.task}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#374151', fontWeight: 500 }}>{entry.hours} h</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em' }}>{formatSEK(entry.total)}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {entry.type === 'kund' && (
                        <button onClick={() => { if(handleGlobalAction) handleGlobalAction('new_invoice', 'invoices'); }} title="Skapa faktura" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
                          <FileText size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(entry.id)} title="Ta bort" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Clock size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                      Inga tider loggade
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
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Logga tid manuellt</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f3f4f6', padding: '4px', borderRadius: '10px' }}>
                <button type="button" onClick={() => setType('kund')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: type === 'kund' ? 'white' : 'transparent', color: type === 'kund' ? '#111827' : '#6b7280', boxShadow: type === 'kund' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                  Fakturering (Kund)
                </button>
                <button type="button" onClick={() => setType('anstalld')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: type === 'anstalld' ? 'white' : 'transparent', color: type === 'anstalld' ? '#111827' : '#6b7280', boxShadow: type === 'anstalld' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                  Löneunderlag (Anställd)
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Datum</label>
                  <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{type === 'kund' ? 'Kund / Projekt' : 'Anställd'}</label>
                  <input type="text" style={inputStyle} placeholder={type === 'kund' ? 'Bokföringskunden AB' : 'Anna Andersson'} value={name} onChange={e => setName(e.target.value)} required />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Beskrivning / Uppgift</label>
                <input type="text" style={inputStyle} placeholder="T.ex. Löpande bokföring" value={task} onChange={e => setTask(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Timmar</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Timpris (kr)</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0" step="1" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Startkostnad</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0" step="1" value={startCost} onChange={e => setStartCost(e.target.value)} />
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Beräknat totalvärde:</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>{formatSEK(total)}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Avbryt</button>
                <button type="submit" disabled={!name || !task || parseFloat(hours) <= 0} style={{ ...buttonStyle, opacity: (!name || !task || parseFloat(hours) <= 0) ? 0.5 : 1 }}>
                  <Check size={14} /> Spara tid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
