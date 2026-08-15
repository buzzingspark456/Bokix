import React, { useState } from 'react';
import { Clock, Plus, Trash2, Check, X, Briefcase, User, FileText } from 'lucide-react';
import { PartySearch, EntitySearch, ProjectSearch } from './shared/SearchInputs';

const emptyForm = () => ({
  type: 'kund', // 'kund' (fakturerbart) | 'anstalld' (löneunderlag)
  date: new Date().toISOString().split('T')[0],
  customerId: '', employeeId: '', projectId: '',
  task: '', hours: '', hourlyRate: '', startCost: '',
});

export default function TimeTracking({
  timeEntries = [], setTimeEntries, contacts = [], employees = [], projects = [], user,
  globalAction, clearGlobalAction, handleGlobalAction,
}) {
  const customers = contacts.filter(c => c.type === 'customer' || !c.type);
  const employeeItems = employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}`.trim() }));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const [viewScope, setViewScope] = useState('own'); // 'own' | 'team'
  const [viewTime, setViewTime] = useState('week'); // 'week' | 'day'

  React.useEffect(() => {
    if (globalAction?.type === 'new_time') {
      setForm(emptyForm());
      setIsModalOpen(true);
      clearGlobalAction();
    }
  }, [globalAction, clearGlobalAction]);

  const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

  const calcTotal = (f) => {
    const h = parseFloat(f.hours) || 0;
    const rate = parseFloat(f.hourlyRate) || 0;
    const sc = parseFloat(f.startCost) || 0;
    return (h * rate) + sc;
  };
  const total = calcTotal(form);

  const handleSubmit = (e) => {
    e.preventDefault();
    const partyId = form.type === 'kund' ? form.customerId : form.employeeId;
    if (!partyId || !form.task || !(parseFloat(form.hours) > 0)) return;
    if (!setTimeEntries) return;

    setTimeEntries(prev => [{
      id: `bt_${Date.now()}`,
      type: form.type,
      date: form.date,
      customerId: form.type === 'kund' ? form.customerId : null,
      employeeId: form.type === 'anstalld' ? form.employeeId : null,
      projectId: form.type === 'kund' ? (form.projectId || null) : null,
      task: form.task,
      hours: parseFloat(form.hours),
      hourlyRate: parseFloat(form.hourlyRate) || 0,
      startCost: parseFloat(form.startCost) || 0,
      total: calcTotal(form),
      loggedByUserId: user?.id || null,
      loggedByName: [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') || user?.email || 'Du',
    }, ...prev]);

    setForm(emptyForm());
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if (!setTimeEntries) return;
    setTimeEntries(prev => prev.filter(e => e.id !== id));
  };

  // "Min tid" filtrerar mot den faktiskt inloggade användaren (loggedByUserId)
  // istället för ett hårdkodat "Du" — annars visar filtret samma lista för alla.
  const filteredEntries = timeEntries.filter(e => viewScope === 'team' || e.loggedByUserId === user?.id);

  const totalHours = filteredEntries.reduce((s, e) => s + e.hours, 0);
  const totalInvoiced = filteredEntries.filter(e => e.type === 'kund').reduce((s, e) => s + e.total, 0);
  const totalSalary = filteredEntries.filter(e => e.type === 'anstalld').reduce((s, e) => s + e.total, 0);

  // Skapar en faktura med kunden och en förifylld rad direkt från tidposten
  // — inte bara en genväg till en tom fakturasida (se Invoices.jsx `prefill`).
  const handleCreateInvoiceFromEntry = (entry) => {
    if (!handleGlobalAction || !entry.customerId) return;
    handleGlobalAction({
      type: 'new_invoice',
      payload: {
        sourceKey: entry.id,
        customerId: entry.customerId,
        rows: [{ description: entry.task, qty: entry.hours, unitPrice: entry.hourlyRate, vatRate: 25, discount: 0, account: '3001' }],
      },
    }, 'invoices');
  };

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: '#1a3028', border: 'none', borderRadius: '9px', fontSize: '13px',
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s',
    boxShadow: '0 2px 6px rgba(26, 48, 40, 0.25)',
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

  const partyName = (entry) => {
    if (entry.type === 'kund') return customers.find(c => c.id === entry.customerId)?.name || 'Okänd kund';
    return employeeItems.find(e => e.id === entry.employeeId)?.name || 'Okänd anställd';
  };

  // "P-101"-koder — stabila så länge projektlistan inte ändrar ordning,
  // baserade på projektets index i hela listan (inte bara de som har loggad tid).
  const projectCode = (projectId) => `P-${101 + projects.findIndex(p => p.id === projectId)}`;

  // ── Projektkort: grupperar loggad kundtid per projekt och ställer den
  // fakturerbara summan mot projektets budget (timmar × timpris). ──
  const projectGroups = React.useMemo(() => {
    const byProject = new Map();
    filteredEntries.forEach(entry => {
      if (!entry.projectId) return;
      if (!byProject.has(entry.projectId)) byProject.set(entry.projectId, []);
      byProject.get(entry.projectId).push(entry);
    });
    return Array.from(byProject.entries()).map(([projectId, entries]) => {
      const proj = projects.find(p => p.id === projectId);
      if (!proj) return null;
      const spent = entries.reduce((s, e) => s + e.total, 0);
      const hours = entries.reduce((s, e) => s + e.hours, 0);
      const budget = (Number(proj.budgetHours) || 0) * (Number(proj.hourlyRate) || 0);
      const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
      const custName = customers.find(c => c.id === proj.customerId)?.name || 'Okänd kund';
      return { proj, spent, hours, budget, pct, custName };
    }).filter(Boolean);
  }, [filteredEntries, projects, customers]);

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
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
            <button style={toggleBtnStyle(viewScope === 'team')} onClick={() => setViewScope('team')}>Alla</button>
          </div>
          <div style={toggleGroupStyle}>
            <button style={toggleBtnStyle(viewTime === 'day')} onClick={() => setViewTime('day')}>Idag</button>
            <button style={toggleBtnStyle(viewTime === 'week')} onClick={() => setViewTime('week')}>Vecka</button>
          </div>
          <button style={buttonStyle} onClick={() => { setForm(emptyForm()); setIsModalOpen(true); }}>
            <Plus size={14} /> Logga tid
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Totalt antal timmar</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>{totalHours} h</div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Briefcase size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Fakturerbart värde</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>{formatSEK(totalInvoiced)}</div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Personalkostnad (löneunderlag)</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>{formatSEK(totalSalary)}</div>
          </div>
        </div>
      </div>

      {/* ── PROJEKTKORT ── */}
      {projectGroups.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>Projekt</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {projectGroups.map(({ proj, spent, hours, budget, pct, custName }) => {
              const isFinished = proj.status === 'finished';
              let barColor = '#16a34a';
              if (pct >= 100) barColor = '#ef4444';
              else if (pct >= 80) barColor = '#f59e0b';
              return (
                <div key={proj.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.02em' }}>{projectCode(proj.id)}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      background: isFinished ? '#f0fdf4' : '#eff6ff',
                      color: isFinished ? '#16a34a' : '#1d4ed8',
                      border: `1px solid ${isFinished ? '#bbf7d0' : '#bfdbfe'}`,
                    }}>
                      {isFinished ? 'Avslutat' : 'Pågående'}
                    </span>
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>{proj.name}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>{custName}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#6b7280', marginBottom: '6px' }}>
                    <span>Nedlagt {formatSEK(spent)}</span>
                    {budget > 0 && <span>{pct}% av budget</span>}
                  </div>
                  <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ height: '100%', width: `${budget > 0 ? pct : 0}%`, background: barColor, borderRadius: '3px' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingTop: '14px', borderTop: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Budget</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827' }}>{budget > 0 ? formatSEK(budget) : '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Timmar</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827' }}>{hours}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Fakturerat</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827' }}>{formatSEK(spent)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TABLE ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', width: '110px' }}>Datum</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Loggat av</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Typ</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Kund/Anställd</th>
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
                  <td style={{ padding: '14px 20px', color: '#111827', fontWeight: 500 }}>{entry.loggedByName || 'Du'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '4px 10px', background: entry.type === 'kund' ? '#eff6ff' : '#f0fdf4', color: entry.type === 'kund' ? '#1d4ed8' : '#16a34a', border: `1px solid ${entry.type === 'kund' ? '#bfdbfe' : '#bbf7d0'}`, borderRadius: '20px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em' }}>
                      {entry.type === 'kund' ? 'Fakturering' : 'Löneunderlag'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>{partyName(entry)}</td>
                  <td style={{ padding: '14px 20px', color: '#4b5563' }}>{entry.task}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#374151', fontWeight: 500 }}>{entry.hours} h</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em' }}>{formatSEK(entry.total)}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {entry.type === 'kund' && (
                        <button onClick={() => handleCreateInvoiceFromEntry(entry)} title="Skapa faktura med denna rad förifylld" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3d7a2e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
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
                    <div style={{ fontSize: '13px', color: '#9ca3af' }}>Klicka på "Logga tid" för att komma igång</div>
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
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Logga tid manuellt</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f3f4f6', padding: '4px', borderRadius: '10px' }}>
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'kund' }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: form.type === 'kund' ? 'white' : 'transparent', color: form.type === 'kund' ? '#111827' : '#6b7280', boxShadow: form.type === 'kund' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                  Fakturering (Kund)
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'anstalld' }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: form.type === 'anstalld' ? 'white' : 'transparent', color: form.type === 'anstalld' ? '#111827' : '#6b7280', boxShadow: form.type === 'anstalld' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                  Löneunderlag (Anställd)
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Datum</label>
                  <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{form.type === 'kund' ? 'Kund' : 'Anställd'}</label>
                  {form.type === 'kund' ? (
                    customers.length > 0 ? (
                      <PartySearch value={form.customerId} onChange={id => setForm(f => ({ ...f, customerId: id }))} contacts={customers} />
                    ) : (
                      <div style={{ fontSize: '12px', color: '#b45309', paddingTop: '9px' }}>Inga kunder registrerade än (Kontakter).</div>
                    )
                  ) : (
                    employeeItems.length > 0 ? (
                      <EntitySearch value={form.employeeId} onChange={id => setForm(f => ({ ...f, employeeId: id }))} items={employeeItems} placeholder="Sök anställd..." />
                    ) : (
                      <div style={{ fontSize: '12px', color: '#b45309', paddingTop: '9px' }}>Inga anställda registrerade än (Anställda och lön).</div>
                    )
                  )}
                </div>
              </div>

              {form.type === 'kund' && projects.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Projekt (valfritt)</label>
                  <ProjectSearch
                    value={form.projectId}
                    onChange={id => {
                      const proj = projects.find(p => p.id === id);
                      setForm(f => ({ ...f, projectId: id, customerId: proj ? proj.customerId : f.customerId }));
                    }}
                    projects={projects}
                  />
                  <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '5px' }}>Kopplar tiden till projektets budget och sätter kund automatiskt.</div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Beskrivning / Uppgift</label>
                <input type="text" style={inputStyle} placeholder="T.ex. Löpande bokföring" value={form.task} onChange={e => setForm(f => ({ ...f, task: e.target.value }))} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Timmar</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0" step="0.5" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Timpris (kr)</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0" step="1" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Startkostnad</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0" step="1" value={form.startCost} onChange={e => setForm(f => ({ ...f, startCost: e.target.value }))} />
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Beräknat totalvärde:</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>{formatSEK(total)}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Avbryt</button>
                <button type="submit" disabled={!((form.type === 'kund' ? form.customerId : form.employeeId) && form.task && parseFloat(form.hours) > 0)} style={{ ...buttonStyle, opacity: !((form.type === 'kund' ? form.customerId : form.employeeId) && form.task && parseFloat(form.hours) > 0) ? 0.5 : 1 }}>
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
