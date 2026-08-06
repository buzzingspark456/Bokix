import React, { useState } from 'react';
import {
  Briefcase, Plus, Search, ChevronDown, ChevronUp, Trash2, Check,
  Clock, FileText, TrendingUp, CheckSquare, Users, Timer
} from 'lucide-react';
import TimeTracking from './TimeTracking';

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '10px 18px', background: 'none', border: 'none',
          borderBottom: active === t.id ? '2px solid #1a3028' : '2px solid transparent',
          fontSize: '13px', fontWeight: active === t.id ? 700 : 500,
          color: active === t.id ? '#111827' : '#6b7280',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: '-1px'
        }}>{t.label}</button>
      ))}
    </div>
  );
}

export default function Projects({ globalAction, clearGlobalAction }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageTab, setPageTab] = useState('projects');

  // New Project Form
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState('');
  const [budget, setBudget] = useState('');

  // Initial mock data
  const [projects, setProjects] = useState([
    {
      id: 'p1', name: 'Webbplats redesign', customer: 'Acme Corp AB', status: 'active',
      budget: 50000, timeSpent: 35, timeCost: 21000, invoiced: 25000, expenses: 5000,
      tasks: [
        { id: 't1', title: 'Designskisser', completed: true },
        { id: 't2', title: 'Frontend utveckling', completed: false },
        { id: 't3', title: 'Testning & QA', completed: false },
      ]
    },
    {
      id: 'p2', name: 'Ny grafisk profil', customer: 'Bokix AB', status: 'completed',
      budget: 25000, timeSpent: 20, timeCost: 12000, invoiced: 25000, expenses: 0,
      tasks: [
        { id: 't4', title: 'Logotyp', completed: true },
        { id: 't5', title: 'Färgpalett', completed: true },
      ]
    }
  ]);

  React.useEffect(() => {
    if (globalAction?.type === 'new_project') {
      setIsModalOpen(true);
      clearGlobalAction();
    }
  }, [globalAction, clearGlobalAction]);

  const filtered = projects.filter(p => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.customer.toLowerCase().includes(s);
  });

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleToggleTask = (projectId, taskId) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
      };
    }));
  };

  const handleAddTask = (projectId) => {
    const title = window.prompt('Ange namn på uppgiften:');
    if (!title) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        tasks: [...p.tasks, { id: `t_${Date.now()}`, title, completed: false }]
      };
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setProjects(prev => [{
      id: `p_${Date.now()}`,
      name, customer: customer || 'Okänd kund',
      status: 'active',
      budget: Number(budget) || 0,
      timeSpent: 0, timeCost: 0, invoiced: 0, expenses: 0,
      tasks: []
    }, ...prev]);
    setIsModalOpen(false);
    setName(''); setCustomer(''); setBudget('');
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Är du säker på att du vill ta bort detta projekt?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
    background: '#1a3028', border: 'none', borderRadius: '9px', fontSize: '13px', 
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '9px',
    fontSize: '14px', color: '#111827', background: 'white', outline: 'none',
    transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '4px' }}>Projekt</h1>
        <p style={{ color: '#9ca3af', fontSize: '13.5px' }}>Projektuppföljning och tidrapportering</p>
      </div>

      <TabBar
        tabs={[{ id: 'projects', label: 'Projekt' }, { id: 'time', label: 'Tidrapportering' }]}
        active={pageTab}
        onChange={setPageTab}
      />

      {pageTab === 'time' && (
        <TimeTracking globalAction={pageTab === 'time' ? globalAction : null} clearGlobalAction={clearGlobalAction} />
      )}

      {pageTab === 'projects' && (<>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>Projekt</h2>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>Följ upp lönsamhet, tid och kostnader per projekt</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} style={buttonStyle}>
          <Plus size={14} /> Nytt projekt
        </button>
      </div>

      {/* ── SEARCH ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Sök projekt eller kund..."
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
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Projektnamn</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Kund</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Budget</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Fakturerat</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <React.Fragment key={p.id}>
                  <tr 
                    onClick={() => toggleExpand(p.id)}
                    style={{ 
                      borderBottom: expandedId === p.id ? 'none' : (idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none'), 
                      transition: 'background 0.1s',
                      cursor: 'pointer',
                      background: expandedId === p.id ? '#f9fafb' : 'white'
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Briefcase size={14} />
                        </div>
                        {p.name}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#4b5563' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={12} style={{ color: '#9ca3af' }} />
                        {p.customer}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        background: p.status === 'active' ? '#dcfce7' : '#f3f4f6', 
                        color: p.status === 'active' ? '#166534' : '#4b5563', 
                        borderRadius: '20px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em' 
                      }}>
                        {p.status === 'active' ? 'Pågående' : 'Avslutat'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>
                      {p.budget > 0 ? `${p.budget.toLocaleString('sv-SE')} kr` : '—'}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>
                      {p.invoiced.toLocaleString('sv-SE')} kr
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={(e) => handleDelete(p.id, e)} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderRadius: '6px' }}>
                          <Trash2 size={16} />
                        </button>
                        {expandedId === p.id ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
                      </div>
                    </td>
                  </tr>

                  {/* EXPANDED PROJECT DETAILS */}
                  {expandedId === p.id && (
                    <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <td colSpan="6" style={{ padding: '0 20px 20px 20px' }}>
                        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                          
                          {/* Financials */}
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <TrendingUp size={14} color="#6b7280" /> Lönsamhet
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Intäkter (Fakturerat):</span>
                                <span style={{ color: '#111827', fontWeight: 500 }}>{p.invoiced.toLocaleString('sv-SE')} kr</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Utgifter/Kostnader:</span>
                                <span style={{ color: '#ef4444', fontWeight: 500 }}>-{p.expenses.toLocaleString('sv-SE')} kr</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Tidskostnad:</span>
                                <span style={{ color: '#ef4444', fontWeight: 500 }}>-{p.timeCost.toLocaleString('sv-SE')} kr</span>
                              </div>
                              <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }}></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px' }}>
                                <span style={{ color: '#111827' }}>Resultat:</span>
                                <span style={{ color: (p.invoiced - p.expenses - p.timeCost) >= 0 ? '#166534' : '#ef4444' }}>
                                  {(p.invoiced - p.expenses - p.timeCost).toLocaleString('sv-SE')} kr
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Time & Documents */}
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={14} color="#6b7280" /> Tid & Underlag
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '6px', background: '#f3f4f6', borderRadius: '6px' }}><Clock size={14} color="#4b5563" /></div>
                                <div>
                                  <div style={{ fontWeight: 500 }}>{p.timeSpent} timmar rapporterat</div>
                                  <a href="#" style={{ color: '#2563eb', fontSize: '12px', textDecoration: 'none' }}>Visa tidrapporter</a>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '6px', background: '#f3f4f6', borderRadius: '6px' }}><FileText size={14} color="#4b5563" /></div>
                                <div>
                                  <div style={{ fontWeight: 500 }}>2 kopplade fakturor</div>
                                  <a href="#" style={{ color: '#2563eb', fontSize: '12px', textDecoration: 'none' }}>Visa fakturor</a>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Tasks */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckSquare size={14} color="#6b7280" /> Uppgifter
                              </h4>
                              <button onClick={() => handleAddTask(p.id)} style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Lägg till</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {p.tasks.map(t => (
                                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={t.completed} 
                                    onChange={() => handleToggleTask(p.id, t.id)}
                                    style={{ accentColor: '#1a3028', width: '16px', height: '16px' }}
                                  />
                                  <span style={{ textDecoration: t.completed ? 'line-through' : 'none', color: t.completed ? '#9ca3af' : '#374151' }}>
                                    {t.title}
                                  </span>
                                </label>
                              ))}
                              {p.tasks.length === 0 && (
                                <div style={{ fontSize: '12px', color: '#9ca3af' }}>Inga uppgifter inlagda.</div>
                              )}
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Briefcase size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                      Inga projekt funna
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
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Nytt projekt</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Projektnamn *</label>
                <input type="text" style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Kund</label>
                <input type="text" style={inputStyle} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="T.ex. Acme Corp AB" />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Budget (kr)</label>
                <input type="number" style={inputStyle} value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Avbryt</button>
                <button type="submit" disabled={!name.trim()} style={{ ...buttonStyle, opacity: !name.trim() ? 0.5 : 1 }}>
                  <Check size={14} /> Spara projekt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
