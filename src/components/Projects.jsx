import React, { useState, useEffect } from 'react';
import {
  Briefcase, Plus, Search, ChevronDown, ChevronLeft, ChevronRight,
  Clock, TrendingUp, FileText, X,
} from 'lucide-react';
import { ProjectSearch } from './shared/SearchInputs';
import { BRAND } from '../utils/brandColors';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

// ── Veckohjälpare (måndag–söndag) ──
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}
function getDatesOfWeek(startDate) {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });
}
function getISODate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function sumHours(entries) { return entries.reduce((s, t) => s + t.hours, 0); }
function formatHours(h) { return (Math.round(h * 4) / 4).toString().replace('.', ','); }

function formatWeekRange(weekDates) {
  const start = weekDates[0], end = weekDates[6];
  const monthName = (d) => d.toLocaleDateString('sv-SE', { month: 'long' });
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${monthName(end)} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${monthName(start)} – ${end.getDate()} ${monthName(end)} ${end.getFullYear()}`;
}

const cardBase = { background: 'white', border: '0.5px solid var(--border)', borderRadius: '12px' };

// ── Sida 16: tomt läge — säljande, inte bara en rubrik och en knapp ──
function EmptyProjectsState({ onCreate }) {
  const valueProps = [
    { icon: Clock, title: 'Tidrapportering', text: 'Logga timmar per projekt' },
    { icon: TrendingUp, title: 'Lönsamhet', text: 'Se intäkt mot kostnad live' },
    { icon: FileText, title: 'Fakturera', text: 'Fakturera direkt från tidrapport' },
  ];
  return (
    <div style={{ background: 'var(--gray-50)', borderRadius: '12px', padding: '56px 32px', textAlign: 'center', marginTop: '20px' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
        <Briefcase size={22} color={BRAND.greenDark} />
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 8px', color: 'var(--text-main)' }}>Skapa ditt första projekt</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 auto 22px', maxWidth: '360px', lineHeight: 1.5 }}>
        Följ upp tid och lönsamhet genom att skapa ditt första projekt och börja tidrapportera.
      </p>
      <button onClick={onCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
        <Plus size={16} /> Nytt projekt
      </button>

      <div style={{ borderTop: '0.5px solid var(--border)', marginTop: '32px', paddingTop: '24px', display: 'flex', justifyContent: 'center', gap: '28px', flexWrap: 'wrap' }}>
        {valueProps.map(v => (
          <div key={v.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '190px', textAlign: 'left' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <v.icon size={14} color={BRAND.greenDark} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{v.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{v.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sida 17: kompakt popover för att registrera tid på en specifik dag ──
function DayEntryPopover({ dateStr, projects, existingDayTotal, onSave, onClose }) {
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const activeProjects = projects.filter(p => p.status !== 'finished');
  const projectedTotal = existingDayTotal + (Number(hours) || 0);
  const showOverageWarning = projectedTotal > 12;

  const handleSave = () => {
    const h = Number(hours);
    if (!projectId) { setError('Välj ett projekt.'); return; }
    if (!h || h <= 0) { setError('Ange fler än 0 timmar.'); return; }
    onSave({ date: dateStr, projectId, hours: h, description });
  };

  return (
    <div
      style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: '4px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '12px', width: '240px' }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Projekt</label>
        <ProjectSearch value={projectId} onChange={setProjectId} projects={activeProjects} />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Timmar</label>
        <input
          type="number" step="0.25" min="0" value={hours} onChange={e => { setHours(e.target.value); setError(''); }}
          style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Beskrivning</label>
        <input
          type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Vad jobbade du med?"
          style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>
      {showOverageWarning && (
        <div style={{ color: '#b45309', fontSize: '11px', marginBottom: '8px', lineHeight: 1.4 }}>Ovanligt mycket tid registrerad denna dag, stämmer det?</div>
      )}
      {error && <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '8px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleSave} style={{ flex: 1, padding: '7px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Spara</button>
        <button onClick={onClose} style={{ padding: '7px 10px', background: 'var(--gray-100)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
      </div>
    </div>
  );
}

// ── Sida 17: en registrerad tidrad, med × som syns vid hover ──
function TimeEntryCard({ entry, projectName, onDelete }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', marginBottom: '6px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>{formatHours(entry.hours)}h</span>
      </div>
      {entry.description && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</div>}
      {hover && (
        <button
          onClick={() => onDelete(entry)} title="Ta bort"
          style={{ position: 'absolute', top: '4px', right: '4px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', color: '#dc2626', padding: 0 }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ── Sida 17: veckans tidrapportering ──
function TimeTrackingTab({ projects, timeEntries, setTimeEntries, setProjects }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [openDay, setOpenDay] = useState(null);

  const weekDates = getDatesOfWeek(currentWeekStart);
  const weekStartStr = getISODate(weekDates[0]);
  const weekEndStr = getISODate(weekDates[6]);
  const weekEntries = timeEntries.filter(t => t.date >= weekStartStr && t.date <= weekEndStr);
  const weekTotal = sumHours(weekEntries);

  const prevWeekDates = getDatesOfWeek(new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() - 7));
  const prevWeekStartStr = getISODate(prevWeekDates[0]);
  const prevWeekEndStr = getISODate(prevWeekDates[6]);
  const prevWeekTotal = sumHours(timeEntries.filter(t => t.date >= prevWeekStartStr && t.date <= prevWeekEndStr));
  const diff = weekTotal - prevWeekTotal;
  const showComparison = weekTotal > 0 || prevWeekTotal > 0;

  const perProjectTotals = projects
    .map(p => ({ project: p, hours: sumHours(weekEntries.filter(t => t.projectId === p.id)) }))
    .filter(x => x.hours > 0);

  const handleSaveEntry = ({ date, projectId, hours, description }) => {
    const newEntry = { id: `time_${Date.now()}`, date, projectId, hours, description };
    setTimeEntries(prev => [...prev, newEntry]);
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, timeSpent: (p.timeSpent || 0) + hours } : p));
    setOpenDay(null);
  };

  const handleDeleteEntry = (entry) => {
    setTimeEntries(prev => prev.filter(t => t.id !== entry.id));
    setProjects(prev => prev.map(p => p.id === entry.projectId ? { ...p, timeSpent: Math.max(0, (p.timeSpent || 0) - entry.hours) } : p));
  };

  const todayStr = getISODate(new Date());

  return (
    <div>
      {/* Sidhuvud för fliken */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button onClick={() => setCurrentWeekStart(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))} style={{ background: 'none', border: 'none', padding: '4px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-main)', minWidth: '190px', textAlign: 'center' }}>{formatWeekRange(weekDates)}</span>
            <button onClick={() => setCurrentWeekStart(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))} style={{ background: 'none', border: 'none', padding: '4px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
              <ChevronRight size={16} />
            </button>
          </div>
          <button onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))} style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', color: BRAND.green, cursor: 'pointer', fontWeight: 500 }}>
            Idag
          </button>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-main)' }}>{formatHours(weekTotal)} h denna vecka</div>
          {showComparison && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {diff === 0 ? 'Samma som förra veckan' : `${diff > 0 ? '+' : '−'}${formatHours(Math.abs(diff))} h mot förra veckan`}
            </div>
          )}
        </div>
      </div>

      {/* Veckorutnät */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {weekDates.map((date, idx) => {
          const dateStr = getISODate(date);
          const isToday = dateStr === todayStr;
          const isWeekend = idx >= 5;
          const dayEntries = timeEntries.filter(t => t.date === dateStr);
          const dayTotal = sumHours(dayEntries);

          return (
            <div key={dateStr} style={{ position: 'relative', background: isWeekend ? 'var(--gray-50)' : 'transparent', borderRadius: '10px', padding: '2px' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{date.toLocaleDateString('sv-SE', { weekday: 'short' })}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '999px', background: isToday ? BRAND.greenLight : 'transparent', fontSize: '13px', fontWeight: isToday ? 700 : 500, color: isToday ? BRAND.greenDark : 'var(--text-main)', marginTop: '2px' }}>
                  {date.getDate()}
                </div>
                {dayTotal > 0 && <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{formatHours(dayTotal)}h</div>}
              </div>

              {dayEntries.map(entry => {
                const proj = projects.find(p => p.id === entry.projectId);
                return <TimeEntryCard key={entry.id} entry={entry} projectName={proj?.name || 'Okänt projekt'} onDelete={handleDeleteEntry} />;
              })}

              <div
                onClick={() => setOpenDay(openDay === dateStr ? null : dateStr)}
                style={{ border: '1px dashed var(--gray-300)', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.green; e.currentTarget.style.color = BRAND.green; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-300)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                + Lägg till
              </div>

              {openDay === dateStr && (
                <DayEntryPopover
                  dateStr={dateStr}
                  projects={projects}
                  existingDayTotal={dayTotal}
                  onSave={handleSaveEntry}
                  onClose={() => setOpenDay(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Veckans summering per projekt */}
      {perProjectTotals.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
          {perProjectTotals.map(({ project, hours }) => (
            <div key={project.id} style={{ display: 'flex', gap: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{project.name}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatHours(hours)} h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Projects({ projects = [], setProjects, contacts = [], timeEntries = [], setTimeEntries, globalAction, clearGlobalAction }) {
  const [activeTab, setActiveTab] = useState('projects');

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (['projects', 'time'].includes(hash)) setActiveTab(hash);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSetTab = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${tab}`);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const [detailTab, setDetailTab] = useState('time');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', customerId: '', budgetHours: '', hourlyRate: '', startDate: '' });

  useEffect(() => {
    if (globalAction?.type === 'new_project') {
      handleSetTab('projects');
      setShowNewProjectForm(true);
      clearGlobalAction?.();
    }
  }, [globalAction, clearGlobalAction]);

  const activeProjects = projects.filter(p => p.status !== 'finished');
  const finishedProjects = projects.filter(p => p.status === 'finished');
  const filteredProjects = [...activeProjects, ...finishedProjects].filter(p => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const custName = contacts.find(c => c.id === p.customerId)?.name || '';
    return p.name.toLowerCase().includes(s) || custName.toLowerCase().includes(s);
  });

  const handleSaveProject = (e) => {
    e.preventDefault();
    if (!projectForm.name || !projectForm.customerId) return;
    const newProject = {
      id: `proj_${Date.now()}`, ...projectForm,
      budgetHours: Number(projectForm.budgetHours) || 0,
      hourlyRate: Number(projectForm.hourlyRate) || 0,
      status: 'active', timeSpent: 0, revenue: 0, cost: 0,
    };
    setProjects(prev => [newProject, ...prev]);
    setShowNewProjectForm(false);
    setProjectForm({ name: '', customerId: '', budgetHours: '', hourlyRate: '', startDate: '' });
  };

  const inputSt = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };

  // "Nytt projekt" tar över hela sidan istället för att öppnas som en
  // sidopanel ovanpå resten av vyn — samma mönster som Anställda-formuläret
  // under Anställda och lön.
  if (showNewProjectForm) {
    return (
      <div style={{ padding: '32px 40px', animation: 'fadeIn 0.25s ease', minHeight: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <button onClick={() => setShowNewProjectForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: 0 }}>← Tillbaka</button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Nytt projekt</h2>
        </div>
        <form onSubmit={handleSaveProject} style={{ ...cardBase, width: '100%', boxSizing: 'border-box', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>Projektnamn *</label>
              <input type="text" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} style={inputSt} required autoFocus />
            </div>
            <div>
              <label style={labelSt}>Kund *</label>
              <select value={projectForm.customerId} onChange={e => setProjectForm({ ...projectForm, customerId: e.target.value })} style={{ ...inputSt, background: 'white' }} required>
                <option value="">Välj kund...</option>
                {contacts.filter(c => c.type === 'customer' || !c.type).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt}>Budgeterad tid (h)</label>
              <input type="number" min="0" value={projectForm.budgetHours} onChange={e => setProjectForm({ ...projectForm, budgetHours: e.target.value })} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Timpris (kr)</label>
              <input type="number" min="0" value={projectForm.hourlyRate} onChange={e => setProjectForm({ ...projectForm, hourlyRate: e.target.value })} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Startdatum</label>
              <input type="date" value={projectForm.startDate} onChange={e => setProjectForm({ ...projectForm, startDate: e.target.value })} style={inputSt} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={() => setShowNewProjectForm(false)} style={{ padding: '9px 18px', background: 'var(--gray-100)', border: 'none', borderRadius: '8px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Avbryt</button>
            <button type="submit" style={{ padding: '9px 18px', background: BRAND.green, border: 'none', borderRadius: '8px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Spara projekt</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', animation: 'fadeIn 0.25s ease', minHeight: '100%', boxSizing: 'border-box' }}>
      {/* Sidhuvud */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, color: 'var(--text-main)' }}>Projekt</h1>
          <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>Följs upp lönsamhet, tid och kostnader per projekt</p>
        </div>
        <button onClick={() => setShowNewProjectForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={15} /> Nytt projekt
        </button>
      </div>

      {/* Flikrad */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginTop: '16px' }}>
        {[{ id: 'projects', label: 'Projekt' }, { id: 'time', label: 'Tidrapportering' }].map(t => (
          <button key={t.id} onClick={() => handleSetTab(t.id)} style={{
            padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: '13.5px',
            fontWeight: activeTab === t.id ? 600 : 500,
            color: activeTab === t.id ? BRAND.green : 'var(--text-secondary)',
            background: 'none',
            borderBottom: activeTab === t.id ? `2px solid ${BRAND.green}` : '2px solid transparent',
            marginBottom: '-1px',
          }}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'projects' && (
        <div style={{ marginTop: '20px' }}>
          {projects.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Sök projekt eller kund..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '9px 12px 9px 36px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '260px', background: 'white' }} />
              </div>
            </div>
          )}

          {projects.length === 0 ? (
            <EmptyProjectsState onCreate={() => setShowNewProjectForm(true)} />
          ) : filteredProjects.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'white', borderRadius: '12px', border: '1px solid var(--border)' }}>Inga projekt hittades vid sökning.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredProjects.map(proj => {
                const cust = contacts.find(c => c.id === proj.customerId);
                const isFinished = proj.status === 'finished';
                const isExpanded = expandedProjectId === proj.id;

                const pct = proj.budgetHours ? Math.min((proj.timeSpent / proj.budgetHours) * 100, 100) : 0;
                let barColor = '#16a34a';
                if (pct > 100) barColor = '#ef4444';
                else if (pct >= 80) barColor = '#f59e0b';

                const profit = (proj.revenue || 0) - (proj.cost || 0);

                return (
                  <div
                    key={proj.id}
                    style={{ ...cardBase, overflow: 'hidden', opacity: isFinished ? 0.7 : 1, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.borderColor = 'var(--gray-300)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div
                      onClick={() => setExpandedProjectId(isExpanded ? null : proj.id)}
                      style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '16px' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>{proj.name}</span>
                          {isFinished ? (
                            <span style={{ fontSize: '11px', padding: '2px 6px', background: 'var(--gray-100)', color: 'var(--text-secondary)', borderRadius: '4px', fontWeight: 600 }}>Avslutat</span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '2px 6px', background: BRAND.greenLight, color: BRAND.greenDark, borderRadius: '4px', fontWeight: 600 }}>Pågår</span>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{cust?.name || 'Okänd kund'}</div>
                      </div>

                      <div style={{ width: '150px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', color: 'var(--text-main)', fontWeight: 500 }}>
                          <span>Tid</span>
                          <span>{formatHours(proj.timeSpent || 0)} av {proj.budgetHours || 0} h</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--gray-200)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: barColor }} />
                        </div>
                      </div>

                      <div style={{ width: '120px', textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Lönsamhet</div>
                        <div style={{ fontWeight: 700, color: profit >= 0 ? 'var(--text-main)' : '#be123c', fontSize: '15px' }}>{formatSEK(profit)}</div>
                      </div>

                      <ChevronDown size={18} color="var(--text-muted)" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--gray-50)' }}>
                        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
                          {[{ id: 'time', label: 'Tidrapporter' }, { id: 'costs', label: 'Kostnader' }, { id: 'invoiced', label: 'Fakturerat' }].map(t => (
                            <button
                              key={t.id}
                              onClick={(e) => { e.stopPropagation(); setDetailTab(t.id); }}
                              style={{
                                padding: '12px 16px', border: 'none', cursor: 'pointer', fontSize: '13px',
                                fontWeight: detailTab === t.id ? 600 : 500,
                                color: detailTab === t.id ? BRAND.green : 'var(--text-secondary)',
                                background: 'none',
                                borderBottom: detailTab === t.id ? `2px solid ${BRAND.green}` : '2px solid transparent',
                                marginBottom: '-1px',
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ padding: '16px 20px' }}>
                          {detailTab === 'time' && (
                            (() => {
                              const projectEntries = timeEntries.filter(t => t.projectId === proj.id).sort((a, b) => b.date.localeCompare(a.date));
                              return projectEntries.length === 0 ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ingen tid registrerad på projektet ännu.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {projectEntries.slice(0, 8).map(entry => (
                                    <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                                      <span style={{ color: 'var(--text-main)' }}>{entry.date} {entry.description ? `— ${entry.description}` : ''}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatHours(entry.hours)} h</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()
                          )}
                          {detailTab === 'costs' && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Inga registrerade kostnader (utlägg/leverantörsfakturor) ännu.</div>}
                          {detailTab === 'invoiced' && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Inget fakturerat på detta projekt ännu.</div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'time' && (
        <div style={{ marginTop: '20px' }}>
          <TimeTrackingTab projects={projects} timeEntries={timeEntries} setTimeEntries={setTimeEntries} setProjects={setProjects} />
        </div>
      )}
    </div>
  );
}
