import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Briefcase, Plus, Search, ChevronDown, ChevronLeft, ChevronRight,
  Clock, TrendingUp, TrendingDown, FileText, X,
  Zap, Archive, AlertTriangle,
  User, Users, Send, ClipboardCheck, CheckCircle2, Undo2, ListChecks,
} from 'lucide-react';
import { ProjectSearch, EntitySearch } from './shared/SearchInputs';
import ListPageHeader from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
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

const cardBase = { background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px' };

// Färgval per projekt (avatar-cirkeln i listan) — en ren
// projekt-särskiljande egenskap, inte en temafärg. Bokix grönt är
// förvalet (första svatchen), resten är alternativ.
const PROJECT_COLORS = [BRAND.green, '#1e293b', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Projektnummer (P-001, P-002, ...) — tilldelas vid FAKTISKT sparande, inte
// vid formuläröppning, samma princip som offert-/fakturanummer redan följer
// (Quotes.jsx/Invoices.jsx).
const getNextProjectNumber = (list) => {
  const nums = list.map(p => Number(String(p.projectNumber || '').replace('P-', ''))).filter(n => !isNaN(n));
  return `P-${String((nums.length > 0 ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
};

// ══════════════════════════════════════════════════════════════════════
// Tidrapporter — godkännande-flöde per person och månad. Bokix har ingen
// användarroll-modell (vem FÅR attestera/godkänna) och inte heller något
// separat "anställd loggar in själv"-koncept — samma person som loggar tid
// kan här också driva flödet framåt. Personer = "Jag" (kontoinnehavaren,
// alltid tillgänglig) plus registrerade Anställda (Anställda och lön).
// ══════════════════════════════════════════════════════════════════════
const SELF_PERSON_ID = '__self__';

function getPersonList(employees) {
  return [
    { id: SELF_PERSON_ID, name: 'Jag' },
    ...employees.map(e => ({ id: e.id, name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Namnlös' })),
  ];
}

const TIME_REPORT_STAGES = ['pending', 'submitted', 'attested', 'approved'];
const TIME_REPORT_STATUS = {
  pending: { label: 'Pågående', bg: 'var(--gray-200)', color: 'var(--text-main)' },
  submitted: { label: 'Inskickad', bg: 'var(--status-amber-bg)', color: 'var(--status-amber-text)' },
  attested: { label: 'Attesterad', bg: BRAND.blueBg, color: BRAND.blueText },
  approved: { label: 'Godkänd', bg: BRAND.greenLight, color: BRAND.greenDark },
};

function getMonthKey(dateStr) { return (dateStr || '').slice(0, 7); } // 'YYYY-MM'
function formatMonthLabel(monthKey) {
  const [y, m] = (monthKey || '').split('-').map(Number);
  if (!y || !m) return monthKey || '—';
  return new Date(y, m - 1, 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
}
function reportKey(personId, monthKey, customerId) { return `${personId}|${monthKey}|${customerId || 'none'}`; }
function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
// Frånvaro av en post = "Pågående" (se kommentar i App.jsx: createEmptyCompanyData)
// — statusraden skapas först när någon faktiskt flyttar rapporten framåt.
function getReportStatus(timeReportStatuses, personId, monthKey, customerId) {
  const key = reportKey(personId, monthKey, customerId);
  const found = (timeReportStatuses || []).find(s => reportKey(s.personId, s.monthKey, s.customerId) === key);
  return found?.status || 'pending';
}

// ── KPI-ruta för Översikt — ikonbricka, etikett, värde, valfri delrad.
// Samma visuella recept som Dashboard.jsx:s KpiCard (ikon i färgad cirkel,
// versal etikett, stort tal) men fristående markup här, samma konvention
// som resten av sidorna följer (ingen delad komponent mellan sidorna). ──
function ProjectKpiCard({ icon: Icon, label, value, sub, tone = 'neutral' }) {
  const [hover, setHover] = useState(false);
  const badge = tone === 'negative'
    ? { bg: BRAND.redBg, color: BRAND.redText }
    : { bg: BRAND.greenLight, color: BRAND.greenDark };
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...cardBase, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 20px rgba(17,24,39,0.08)' : '0 1px 2px rgba(17,24,39,0.03)',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: '9px', background: badge.bg, color: badge.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
        <div style={{ fontSize: '21px', fontWeight: 700, color: tone === 'negative' ? BRAND.redText : 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>{value}</div>
        {sub && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Litet, vänligt tomläge för en enskild flik/grupp (t.ex. "inga träffar
// vid sökning" eller "inga avdelningar än") — samma ikon-i-cirkel-mönster
// som EmptyProjectsState nedan, bara kompaktare för att användas inuti en
// redan navigerad flik istället för hela sidans förstagångsläge. ──
function SectionEmptyState({ icon: Icon = Search, title }) {
  return (
    <div style={{ padding: '44px 24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <div style={{ width: 38, height: 38, borderRadius: '999px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
        <Icon size={17} color="var(--text-muted)" />
      </div>
      <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</div>
    </div>
  );
}

// ── Sida 16: tomt läge — säljande, inte bara en rubrik och en knapp ──
function EmptyProjectsState({ onCreate }) {
  const valueProps = [
    { icon: Clock, title: 'Tidrapportering', text: 'Logga timmar per projekt' },
    { icon: TrendingUp, title: 'Lönsamhet', text: 'Se intäkt mot kostnad live' },
    { icon: FileText, title: 'Fakturera', text: 'Fakturera direkt från tidrapport' },
  ];
  return (
    <div style={{ flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', borderRadius: '12px', padding: '56px 32px', textAlign: 'center', marginTop: '20px' }}>
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

// ── Kompakt popover för att sätta/redigera timmar i EN cell (ett projekt,
// en dag) — ersätter den gamla dagkort-varianten som bar projekt- OCH
// personval i sig själv. I rutnätet nedan är rad och kolumn redan
// projekt+dag, så popovern behöver bara fråga om timmar/beskrivning.
// Stänger sig själv både på Escape och klick utanför (samma mönster som
// EntitySearch/AccountSearch i shared/SearchInputs.jsx). ──
function TimeCellPopover({ hours: initialHours, description: initialDescription, dayTotal, anchorRect, onSave, onDelete, onClose }) {
  const [hours, setHours] = useState(initialHours != null ? String(initialHours) : '');
  const [description, setDescription] = useState(initialDescription || '');
  const [error, setError] = useState('');
  const ref = useRef();
  const isEditing = initialHours != null;

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const projectedTotal = (dayTotal - (initialHours || 0)) + (Number(hours) || 0);
  const showOverageWarning = projectedTotal > 12;

  const handleSave = () => {
    const h = Number(hours);
    if (!h || h <= 0) { setError('Ange fler än 0 timmar.'); return; }
    onSave({ hours: h, description });
  };

  const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--text-main)', background: 'var(--bg-card)' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' };

  // `position: fixed` beräknat från cellens egen skärmposition (inte
  // `absolute` mot en förälder) — tabellen sitter i en `overflowX: 'auto'`-
  // wrapper för att kunna scrolla sidledes på smala skärmar, och CSS'
  // overflow-kvirk gör att en `overflow-x` som INTE är 'visible' automatiskt
  // tvingar `overflow-y` till 'auto' också även om den aldrig sattes
  // explicit — vilket klippte popoverns nedre del mot wrapperns kant.
  // `fixed` + egen beräknad position kringgår det helt, oavsett vilka
  // förfäder som råkar klippa/scrolla. Clampad mot fönstrets bredd så den
  // aldrig hamnar utanför skärmen för lördag/söndag-kolumnerna.
  const width = 210;
  const left = anchorRect ? Math.min(Math.max(anchorRect.left + anchorRect.width / 2 - width / 2, 8), window.innerWidth - width - 8) : 0;
  const top = anchorRect ? anchorRect.bottom + 4 : 0;

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', zIndex: 50, top, left, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '12px', width: `${width}px`, textAlign: 'left', fontWeight: 400 }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ marginBottom: '8px' }}>
        <label style={labelStyle}>Timmar</label>
        <input
          type="number" step="0.25" min="0" autoFocus value={hours} onChange={e => { setHours(e.target.value); setError(''); }}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={labelStyle}>Beskrivning</label>
        <input
          type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Vad jobbade du med?"
          style={inputStyle}
        />
      </div>
      {showOverageWarning && (
        <div style={{ color: 'var(--status-amber-text)', fontSize: '11px', marginBottom: '8px', lineHeight: 1.4 }}>Ovanligt mycket tid registrerad denna dag, stämmer det?</div>
      )}
      {error && <div style={{ color: 'var(--status-red-text)', fontSize: '11px', marginBottom: '8px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleSave} style={{ flex: 1, padding: '7px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Spara</button>
        {isEditing && (
          <button onClick={onDelete} title="Ta bort" style={{ padding: '7px 9px', background: BRAND.redBg, color: BRAND.redText, border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}>
            <X size={13} />
          </button>
        )}
        <button onClick={onClose} style={{ padding: '7px 10px', background: 'var(--gray-100)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
      </div>
    </div>
  );
}

// ── Sida 17: veckans tidrapportering — ett riktigt tidrapport-RUTNÄT
// (rader = projekt, kolumner = veckans dagar, cell = timmar), samma
// grundmönster som etablerade tidrapporteringsverktyg (Toggl/Harvest/
// Fortnox). Ersätter den tidigare varianten med sju separata dagkort, som
// inte skalade: en person med tre projekt samma vecka fick tre lösryckta
// "kort" per dag istället för en läsbar tabell, och flera personer gick
// bara att skilja åt med en liten namntext under varje post. Rutnätet är nu
// alltid EN persons vecka (växlas med personväljaren till vänster om den
// finns) — det är också vad ett riktigt tidrapportsblad är: din vecka, inte
// allas blandat på en gång. ──
function TimeTrackingTab({ projects, timeEntries, setTimeEntries, setProjects, employees }) {
  const people = getPersonList(employees);
  const [personId, setPersonId] = useState(SELF_PERSON_ID);
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [openCell, setOpenCell] = useState(null); // { projectId, dateStr }
  const [extraProjectIds, setExtraProjectIds] = useState([]);
  const [showAddRow, setShowAddRow] = useState(false);

  const weekDates = getDatesOfWeek(currentWeekStart);
  const weekStartStr = getISODate(weekDates[0]);
  const weekEndStr = getISODate(weekDates[6]);
  const todayStr = getISODate(new Date());

  const personEntries = timeEntries.filter(t => (t.personId || SELF_PERSON_ID) === personId);
  const weekEntries = personEntries.filter(t => t.date >= weekStartStr && t.date <= weekEndStr);
  const weekTotal = sumHours(weekEntries);

  const prevWeekDates = getDatesOfWeek(new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() - 7));
  const prevWeekStartStr = getISODate(prevWeekDates[0]);
  const prevWeekEndStr = getISODate(prevWeekDates[6]);
  const prevWeekTotal = sumHours(personEntries.filter(t => t.date >= prevWeekStartStr && t.date <= prevWeekEndStr));
  const diff = weekTotal - prevWeekTotal;
  const showComparison = weekTotal > 0 || prevWeekTotal > 0;

  // Rader = projekt med minst en registrering denna vecka + projekt som
  // just lagts till manuellt via "+ Lägg till projekt" men ännu saknar
  // timmar. Byte av person/vecka nollställer de manuellt tillagda — annars
  // släpar tomma rader med sig mellan personer man bara tittade på.
  const rowProjectIds = useMemo(() => {
    const ids = [];
    weekEntries.forEach(t => { if (!ids.includes(t.projectId)) ids.push(t.projectId); });
    extraProjectIds.forEach(id => { if (!ids.includes(id)) ids.push(id); });
    return ids;
  }, [weekEntries, extraProjectIds]);

  const rows = rowProjectIds.map(id => projects.find(p => p.id === id)).filter(Boolean);
  const addableProjects = projects.filter(p => p.status !== 'finished' && !rowProjectIds.includes(p.id));

  const getEntry = (projectId, dateStr) => weekEntries.find(t => t.projectId === projectId && t.date === dateStr);
  const dayTotal = (dateStr) => sumHours(weekEntries.filter(t => t.date === dateStr));

  const handleSaveCell = (projectId, dateStr, { hours, description }) => {
    const existing = getEntry(projectId, dateStr);
    if (existing) {
      setTimeEntries(prev => prev.map(t => t.id === existing.id ? { ...t, hours, description } : t));
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, timeSpent: Math.max(0, (p.timeSpent || 0) - existing.hours + hours) } : p));
    } else {
      const newEntry = { id: `time_${Date.now()}`, date: dateStr, projectId, personId, hours, description };
      setTimeEntries(prev => [...prev, newEntry]);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, timeSpent: (p.timeSpent || 0) + hours } : p));
    }
    setOpenCell(null);
  };

  const handleDeleteCell = (projectId, dateStr) => {
    const existing = getEntry(projectId, dateStr);
    if (existing) {
      setTimeEntries(prev => prev.filter(t => t.id !== existing.id));
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, timeSpent: Math.max(0, (p.timeSpent || 0) - existing.hours) } : p));
    }
    setOpenCell(null);
  };

  const navBtnStyle = { background: 'none', border: 'none', padding: '6px', borderRadius: '999px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' };

  return (
    <div>
      {/* Personväljare (bara om fler än en person finns) + veckoväljare +
          KPI-ruta för veckans totalsumma. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {people.length > 1 && (
            <select
              value={personId}
              onChange={e => { setPersonId(e.target.value); setExtraProjectIds([]); }}
              style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'var(--bg-card)', color: 'var(--text-main)' }}
            >
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '4px 6px 4px 4px' }}>
            <button onClick={() => setCurrentWeekStart(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))} style={navBtnStyle}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)', minWidth: '176px', textAlign: 'center' }}>{formatWeekRange(weekDates)}</span>
            <button onClick={() => setCurrentWeekStart(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))} style={navBtnStyle}>
              <ChevronRight size={16} />
            </button>
            <span style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
            <button onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))} style={{ ...navBtnStyle, padding: '6px 10px', fontSize: '12.5px', color: BRAND.green, fontWeight: 700 }}>
              Idag
            </button>
          </div>
        </div>

        <ProjectKpiCard
          icon={Clock} label="Denna vecka" value={`${formatHours(weekTotal)} h`}
          sub={showComparison ? (diff === 0 ? 'Samma som förra veckan' : `${diff > 0 ? '+' : '−'}${formatHours(Math.abs(diff))} h mot förra veckan`) : undefined}
        />
      </div>

      {rows.length === 0 ? (
        <SectionEmptyState icon={Clock} title="Ingen tid registrerad ännu — lägg till ett projekt nedan för att börja." />
      ) : (
        <div style={{ ...cardBase, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '660px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>
                  Projekt
                </th>
                {weekDates.map((date) => {
                  const dateStr = getISODate(date);
                  const isToday = dateStr === todayStr;
                  return (
                    <th key={dateStr} style={{ padding: '10px 4px', textAlign: 'center', width: '64px', borderBottom: `1px solid ${isToday ? BRAND.green : 'var(--border)'}`, borderLeft: '1px solid var(--border-light)', background: isToday ? BRAND.greenLight : 'transparent' }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 600, color: isToday ? BRAND.greenDark : 'var(--text-secondary)', textTransform: 'capitalize' }}>{date.toLocaleDateString('sv-SE', { weekday: 'short' })}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: isToday ? BRAND.greenDark : 'var(--text-main)', marginTop: '2px' }}>{date.getDate()}</div>
                    </th>
                  );
                })}
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border-light)' }}>
                  Totalt
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(project => {
                const rowTotal = sumHours(weekEntries.filter(t => t.projectId === project.id));
                return (
                  <tr key={project.id}>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '999px', background: project.color || BRAND.green, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                      </div>
                    </td>
                    {weekDates.map((date) => {
                      const dateStr = getISODate(date);
                      const isToday = dateStr === todayStr;
                      const entry = getEntry(project.id, dateStr);
                      const isOpen = openCell?.projectId === project.id && openCell?.dateStr === dateStr;
                      return (
                        <td
                          key={dateStr}
                          onClick={(e) => setOpenCell(isOpen ? null : { projectId: project.id, dateStr, rect: e.currentTarget.getBoundingClientRect() })}
                          style={{
                            textAlign: 'center', padding: '10px 4px', cursor: 'pointer',
                            background: isOpen ? BRAND.greenLight : (isToday ? 'var(--gray-50)' : 'transparent'),
                            fontWeight: entry ? 700 : 400,
                            color: entry ? BRAND.greenDark : 'var(--text-muted)',
                            borderBottom: '1px solid var(--border-light)', borderLeft: '1px solid var(--border-light)',
                            transition: 'background 0.12s',
                          }}
                        >
                          {entry ? formatHours(entry.hours) : '–'}
                          {isOpen && (
                            <TimeCellPopover
                              hours={entry?.hours ?? null}
                              description={entry?.description || ''}
                              dayTotal={dayTotal(dateStr)}
                              anchorRect={openCell.rect}
                              onSave={(vals) => handleSaveCell(project.id, dateStr, vals)}
                              onDelete={() => handleDeleteCell(project.id, dateStr)}
                              onClose={() => setOpenCell(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: rowTotal > 0 ? 'var(--text-main)' : 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', borderLeft: '1px solid var(--border-light)' }}>
                      {rowTotal > 0 ? `${formatHours(rowTotal)} h` : '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Totalt</td>
                {weekDates.map(date => {
                  const dateStr = getISODate(date);
                  const total = dayTotal(dateStr);
                  return (
                    <td key={dateStr} style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 700, color: total > 0 ? BRAND.greenDark : 'var(--text-muted)', borderLeft: '1px solid var(--border-light)' }}>
                      {total > 0 ? formatHours(total) : '–'}
                    </td>
                  );
                })}
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: BRAND.greenDark, borderLeft: '1px solid var(--border-light)' }}>
                  {formatHours(weekTotal)} h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Lägg till en projektrad — sökbar combobox (samma ProjectSearch som
          resten av appen), inte en förifylld tom rad, så listan bara växer
          med projekt man faktiskt tänker logga på. */}
      <div style={{ marginTop: '12px' }}>
        {showAddRow ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '280px' }}>
            <div style={{ flex: 1 }}>
              <ProjectSearch
                value=""
                onChange={(id) => { if (id) { setExtraProjectIds(prev => [...prev, id]); setShowAddRow(false); } }}
                projects={addableProjects}
              />
            </div>
            <button onClick={() => setShowAddRow(false)} title="Avbryt" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          addableProjects.length > 0 && (
            <button
              onClick={() => setShowAddRow(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px dashed var(--gray-300)', borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <Plus size={13} /> Lägg till projekt
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Tidrapporter — godkännande-flöde per person och månad. Skild från
// TimeTrackingTab ovan: den fliken handlar om att LOGGA tid, den här om att
// GODKÄNNA redan loggad tid. Delar samma `timeEntries` men ställer en annan
// fråga, så den lever som en egen underflik istället för att klämmas in i
// veckovyn. UX-layouten (status-pill + ett steg-framåt-per-klick) är
// inspirerad av flerpersons-attesteringsflöden (Pågående→Inskickad→
// Attesterad→Godkänd) — Bokix har ingen användarroll-modell (vem FÅR
// attestera) så samma person som loggar tid kan här också driva flödet
// framåt själv. ──
function TimeReportsView({ timeEntries, employees, timeReportStatuses, setTimeReportStatuses }) {
  const [month, setMonth] = useState(() => getMonthKey(getISODate(new Date())));
  const [openReport, setOpenReport] = useState(null);
  const people = useMemo(() => getPersonList(employees), [employees]);

  // Memoiserad: räknas om per (person, timeEntries, månad, statusar) istället
  // för vid varje omritning — listan kan bli stor när flera anställda loggar
  // tid över många månader.
  const reports = useMemo(() => {
    const monthEntries = timeEntries.filter(t => getMonthKey(t.date) === month);
    return people
      .map(p => {
        const entries = monthEntries.filter(t => (t.personId || SELF_PERSON_ID) === p.id);
        return {
          person: p,
          monthKey: month,
          entries,
          hours: sumHours(entries),
          status: getReportStatus(timeReportStatuses, p.id, month),
        };
      })
      // En rapport syns bara om det faktiskt finns något att ta ställning
      // till — antingen loggad tid, eller ett flöde som redan påbörjats
      // (annars skulle t.ex. "Godkänd" från en tidigare, nu tom, månad synas).
      .filter(r => r.hours > 0 || r.status !== 'pending');
  }, [people, timeEntries, month, timeReportStatuses]);

  const setStatus = (personId, monthKey, status) => {
    setTimeReportStatuses(prev => {
      const key = reportKey(personId, monthKey);
      const idx = prev.findIndex(s => reportKey(s.personId, s.monthKey, s.customerId) === key);
      if (idx === -1) return [...prev, { id: `trs_${Date.now()}`, personId, monthKey, customerId: null, status }];
      const next = [...prev];
      next[idx] = { ...next[idx], status };
      return next;
    });
  };

  const advance = (r) => setStatus(r.person.id, r.monthKey, TIME_REPORT_STAGES[Math.min(TIME_REPORT_STAGES.indexOf(r.status) + 1, TIME_REPORT_STAGES.length - 1)]);
  const revert = (r) => setStatus(r.person.id, r.monthKey, TIME_REPORT_STAGES[Math.max(TIME_REPORT_STAGES.indexOf(r.status) - 1, 0)]);

  const ACTION_LABEL = { pending: 'Skicka in', submitted: 'Attestera', attested: 'Godkänn' };
  const ACTION_ICON = { pending: Send, submitted: ClipboardCheck, attested: CheckCircle2 };

  return (
    <div>
      {/* Månadsväljare — samma pill-kapsel-recept som veckoväljaren i
          TimeTrackingTab, så de två underflikarna känns som samma produkt. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '4px 6px 4px 4px', marginBottom: '18px', width: 'fit-content' }}>
        <button onClick={() => setMonth(m => shiftMonthKey(m, -1))} style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '999px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)', minWidth: '150px', textAlign: 'center', textTransform: 'capitalize' }}>{formatMonthLabel(month)}</span>
        <button onClick={() => setMonth(m => shiftMonthKey(m, 1))} style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '999px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
          <ChevronRight size={16} />
        </button>
        <span style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
        <button onClick={() => setMonth(getMonthKey(getISODate(new Date())))} style={{ background: 'none', border: 'none', padding: '6px 10px', fontSize: '12.5px', color: BRAND.green, cursor: 'pointer', fontWeight: 700, borderRadius: '999px' }}>
          Denna månad
        </button>
      </div>

      {reports.length === 0 ? (
        <SectionEmptyState icon={ListChecks} title="Ingen tid loggad denna månad ännu." />
      ) : (
        // Riktig tabell (samma delade ListTable-komponent som Fakturor/
        // Kontakter/Kontoplan) istället för fristående kortrader — en
        // rubrikrad ger flödet en riktig kolumnstruktur att läsa mot, och på
        // mobil kollapsar varje rad automatiskt till ett etikett/värde-kort.
        <ListTable
          rowKey={r => r.person.id}
          onRowClick={r => setOpenReport(r)}
          rows={reports}
          columns={[
            {
              key: 'person', label: 'Person', render: r => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '999px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {r.person.id === SELF_PERSON_ID ? <User size={14} /> : <Users size={14} />}
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{r.person.name}</span>
                </div>
              ),
            },
            { key: 'entries', label: 'Registreringar', align: 'right', render: r => r.entries.length },
            { key: 'hours', label: 'Timmar', align: 'right', fontWeight: 700, color: 'var(--text-main)', render: r => `${formatHours(r.hours)} h` },
            {
              key: 'status', label: 'Status', render: r => {
                const statusMeta = TIME_REPORT_STATUS[r.status];
                return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', fontWeight: 600, background: statusMeta.bg, color: statusMeta.color, whiteSpace: 'nowrap' }}>{statusMeta.label}</span>;
              },
            },
            {
              key: 'actions', label: '', align: 'right', render: r => {
                const ActionIcon = ACTION_ICON[r.status];
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    {r.status !== 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); revert(r); }} title="Skicka tillbaka ett steg"
                        style={{ background: 'none', border: 'none', padding: '7px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
                      >
                        <Undo2 size={14} />
                      </button>
                    )}
                    {ActionIcon && (
                      <button
                        onClick={(e) => { e.stopPropagation(); advance(r); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        <ActionIcon size={13} /> {ACTION_LABEL[r.status]}
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      )}

      {openReport && (
        <TimeReportDetailModal
          report={openReport}
          onClose={() => setOpenReport(null)}
          onAdvance={() => { advance(openReport); setOpenReport(null); }}
          onRevert={() => { revert(openReport); setOpenReport(null); }}
          actionLabel={ACTION_LABEL[openReport.status]}
          ActionIcon={ACTION_ICON[openReport.status]}
        />
      )}
    </div>
  );
}

// ── Detaljmodal för en enskild persons månadsrapport — samma vita
// .modal-overlay/.modal-content som resten av appens modaler (Nytt
// projekt nedan, offertens förhandsgranskning m.fl.). ──
function TimeReportDetailModal({ report, onClose, onAdvance, onRevert, actionLabel, ActionIcon }) {
  const sorted = [...report.entries].sort((a, b) => a.date.localeCompare(b.date));
  const statusMeta = TIME_REPORT_STATUS[report.status];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{report.person.name}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{formatMonthLabel(report.monthKey)}</div>
            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', fontWeight: 600, background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>
          </div>

          {sorted.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ingen tid registrerad.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
              {sorted.map(entry => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--text-main)' }}>{entry.date} {entry.description ? `— ${entry.description}` : ''}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0 }}>{formatHours(entry.hours)} h</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', marginTop: '14px', paddingTop: '14px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>Totalt</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>{formatHours(report.hours)} h</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '0 20px 20px' }}>
          {report.status !== 'pending' && (
            <button onClick={onRevert} style={{ padding: '9px 14px', background: 'var(--gray-100)', color: 'var(--text-secondary)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Skicka tillbaka
            </button>
          )}
          {ActionIcon && (
            <button onClick={onAdvance} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <ActionIcon size={14} /> {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Ett expanderbart projektkort — samma kort återanvänds nu av alla
// list-baserade underflikar (Aktiva/Avdelningar/Arkiverade/Alla samt
// "Behöver uppmärksamhet" i Översikt) istället för att varje flik hade sin
// egen kopia av samma markup. ──
function ProjectCard({ proj, cust, isExpanded, onToggle, detailTab, setDetailTab, timeEntries }) {
  const [hover, setHover] = useState(false);
  const isFinished = proj.status === 'finished';
  const pct = proj.budgetHours ? Math.min((proj.timeSpent / proj.budgetHours) * 100, 100) : 0;
  let barColor = '#16a34a';
  if (pct > 100) barColor = '#ef4444';
  else if (pct >= 80) barColor = '#f59e0b';
  const profit = (proj.revenue || 0) - (proj.cost || 0);

  return (
    <div
      style={{
        ...cardBase, overflow: 'hidden', opacity: isFinished ? 0.7 : 1,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        borderColor: (hover && !isExpanded) ? 'var(--gray-300)' : 'var(--border)',
        boxShadow: (hover && !isExpanded) ? '0 6px 16px rgba(17,24,39,0.06)' : 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        onClick={onToggle}
        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '16px' }}
      >
        {/* Liten avatar-cirkel — projektets EGEN färg (vald i "Nytt
            projekt") om satt, annars Bokix grönt som förval, ger varje rad
            ett fäste för ögat i en annars ren textlista. */}
        <div style={{
          width: 34, height: 34, borderRadius: '9px', flexShrink: 0,
          background: isFinished ? 'var(--gray-100)' : (proj.color || BRAND.green),
          color: isFinished ? 'var(--text-secondary)' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 700,
        }}>
          {proj.name?.[0]?.toUpperCase() || <Briefcase size={15} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {proj.projectNumber && (
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{proj.projectNumber}</span>
            )}
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>{proj.name}</span>
            {isFinished ? (
              <span style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--gray-100)', color: 'var(--text-secondary)', borderRadius: '999px', fontWeight: 600 }}>Avslutat</span>
            ) : (
              <span style={{ fontSize: '11px', padding: '2px 8px', background: BRAND.greenLight, color: BRAND.greenDark, borderRadius: '999px', fontWeight: 600 }}>Pågår</span>
            )}
            {proj.department && (
              <span style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--gray-100)', color: 'var(--text-secondary)', borderRadius: '999px', fontWeight: 500 }}>{proj.department}</span>
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
                  color: detailTab === t.id ? BRAND.greenDark : 'var(--text-secondary)',
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
}

// ── Delad lista med expanderbara projektkort — återanvänds av samtliga
// list-baserade underflikar. `emptyMessage` skiljer sig per flik (t.ex.
// "Inga aktiva projekt" vs "Inga arkiverade projekt") så tomläget alltid
// syftar på RÄTT flik, inte en generisk "inga projekt" som vore missvisande
// när det faktiskt finns projekt, bara inte i just den här vyn. ──
function ProjectListItems({ list, contacts, timeEntries, expandedProjectId, setExpandedProjectId, detailTab, setDetailTab, emptyMessage, emptyIcon }) {
  if (list.length === 0) {
    return <SectionEmptyState icon={emptyIcon || Search} title={emptyMessage} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {list.map(proj => (
        <ProjectCard
          key={proj.id}
          proj={proj}
          cust={contacts.find(c => c.id === proj.customerId)}
          isExpanded={expandedProjectId === proj.id}
          onToggle={() => setExpandedProjectId(expandedProjectId === proj.id ? null : proj.id)}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
          timeEntries={timeEntries}
        />
      ))}
    </div>
  );
}

export default function Projects({ projects = [], setProjects, contacts = [], setContacts, timeEntries = [], setTimeEntries, employees = [], timeReportStatuses = [], setTimeReportStatuses, globalAction, clearGlobalAction }) {
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
  // Underflik inuti "Tidrapportering": Vecka (logga tid) vs Rapporter
  // (godkänn redan loggad tid) — se TimeReportsView-kommentaren för varför
  // de är skilda vyer istället för en gemensam.
  const [timeSubTab, setTimeSubTab] = useState('week');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [showMoreProjectOptions, setShowMoreProjectOptions] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  // Avdelning-dropdownen väljer bland befintliga namn men kan växla om till
  // ett textfält för att skapa den allra första/en ny avdelning inline.
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const blankProjectForm = { name: '', customerId: '', department: '', color: PROJECT_COLORS[0], description: '', budgetHours: '', hourlyRate: '', startDate: '', endDate: '', status: 'active', autoInvoiceFromTime: false };
  const [projectForm, setProjectForm] = useState(blankProjectForm);
  // Enklare navigering: EN sida, EN lista, filtrerad live — istället för att
  // tvinga fram klick mellan fem separata flik-"sidor" för att jämföra
  // aktiva/arkiverade/en viss avdelning. Översikten (KPI:er + "behöver
  // uppmärksamhet") ligger alltid synlig överst; Aktiva/Arkiverade/Alla och
  // Avdelningar är nu filter på samma lista, inte egna destinationer.
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [departmentFilter, setDepartmentFilter] = useState(''); // '' = alla avdelningar

  const openNewProjectForm = () => {
    setProjectForm(blankProjectForm);
    setShowMoreProjectOptions(false);
    setIsSavingProject(false);
    setIsAddingDepartment(false);
    setShowNewProjectForm(true);
  };

  // Snabbskapande av kund direkt från "Kund"-fältet i projektformuläret —
  // samma mönster ska återanvändas för leverantörsfältet i
  // leverantörsfaktura-formuläret. Bara namnet krävs; resten (org.nr m.m.)
  // fylls i senare under Kunder om det behövs.
  const handleCreateCustomerInline = (name) => {
    const newContact = {
      id: `contact_${Date.now()}`, type: 'customer', customerType: 'se_company',
      name, orgNr: '', balance: 0, lastInvoiceDate: null, totalInvoicedThisYear: 0,
    };
    setContacts(prev => [...prev, newContact]);
    setProjectForm(f => ({ ...f, customerId: newContact.id }));
  };

  useEffect(() => {
    if (globalAction?.type === 'new_project') {
      handleSetTab('projects');
      openNewProjectForm();
      clearGlobalAction?.();
    }
  }, [globalAction, clearGlobalAction]);

  const activeProjects = projects.filter(p => p.status !== 'finished');
  const finishedProjects = projects.filter(p => p.status === 'finished');
  const allProjectsOrdered = [...activeProjects, ...finishedProjects];

  // Avdelningar — ett fritt, valfritt taggfält per projekt, inte en egen
  // registeransvarig entitet. Bara namnen behövs här (för filter-dropdownen);
  // grupperingen görs inte längre som en egen vy.
  const departmentNames = Array.from(new Set(projects.map(p => p.department).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv'));

  // EN filtrerad lista, byggd av tre oberoende filter (status, avdelning,
  // fritext) istället för fem separata käll-listor för fem separata flikar.
  const visibleProjects = allProjectsOrdered.filter(p => {
    if (statusFilter === 'active' && p.status === 'finished') return false;
    if (statusFilter === 'archived' && p.status !== 'finished') return false;
    if (departmentFilter && p.department !== departmentFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const custName = contacts.find(c => c.id === p.customerId)?.name || '';
      if (!p.name.toLowerCase().includes(s) && !custName.toLowerCase().includes(s) && !(p.department || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // Alltid synligt överst: vad som faktiskt behöver ett beslut (nära/över
  // budget), oavsett vilket filter som råkar vara valt just nu.
  const atRiskProjects = activeProjects.filter(p => p.budgetHours && (p.timeSpent / p.budgetHours) >= 0.8);
  const totalActiveTimeSpent = activeProjects.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
  const totalActiveBudgetHours = activeProjects.reduce((sum, p) => sum + (p.budgetHours || 0), 0);
  const totalActiveProfit = activeProjects.reduce((sum, p) => sum + ((p.revenue || 0) - (p.cost || 0)), 0);

  const budgetedValue = (Number(projectForm.budgetHours) || 0) * (Number(projectForm.hourlyRate) || 0);

  const handleSaveProject = (e) => {
    e.preventDefault();
    // Kund är inte längre obligatoriskt (skissen har ingen asterisk på
    // Kund, bara på Namn) — ett internt projekt utan extern kund är giltigt.
    if (!projectForm.name || isSavingProject) return;
    // Disablas direkt vid klick så ett dubbelklick inte skapar två projekt —
    // formuläret stängs och avmonteras när det är klart, men skulle
    // sparandet någon gång bli asynkront (t.ex. mot ett API) står knappen
    // redan i "disabled" tills dess.
    setIsSavingProject(true);
    const newProject = {
      id: `proj_${Date.now()}`, projectNumber: getNextProjectNumber(projects), ...projectForm,
      budgetHours: Number(projectForm.budgetHours) || 0,
      hourlyRate: Number(projectForm.hourlyRate) || 0,
      timeSpent: 0, revenue: 0, cost: 0,
    };
    setProjects(prev => [newProject, ...prev]);
    setShowNewProjectForm(false);
    setProjectForm(blankProjectForm);
  };

  const inputSt = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-main)' };
  const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      {/* Header i samma mönster som Kunder/Anställda och lön/Bokföring —
          kort-bakgrund + kantlinje, inte flytande text på sidbakgrunden. */}
      <ListPageHeader
        title="Projekt"
        subtitle="Följs upp lönsamhet, tid och kostnader per projekt"
        actions={[
          { key: 'new', label: 'Nytt projekt', icon: Plus, onClick: () => openNewProjectForm(), variant: 'primary' },
        ]}
        tabs={{
          items: [{ id: 'projects', label: 'Projekt' }, { id: 'time', label: 'Tidrapportering' }],
          activeId: activeTab,
          onChange: handleSetTab,
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>

      {activeTab === 'projects' && (
        <div style={{ marginTop: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {projects.length === 0 ? (
            <EmptyProjectsState onCreate={() => openNewProjectForm()} />
          ) : (
            <>
              {/* EN sida, EN lista — Översikt/Aktiva/Avdelningar/Arkiverade/
                  Alla är nu synliga samtidigt (KPI-remsa + filter) istället
                  för fem flikar man måste klicka sig mellan för att jämföra
                  saker. Enklare mental modell: scrolla och filtrera, inte
                  navigera. */}
              <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
                <ProjectKpiCard icon={Zap} label="Aktiva projekt" value={String(activeProjects.length)} />
                <ProjectKpiCard
                  icon={Clock} label="Nedlagd tid"
                  value={`${formatHours(totalActiveTimeSpent)} h`}
                  sub={totalActiveBudgetHours ? `av ${totalActiveBudgetHours} h budgeterat` : 'Ingen budget satt'}
                />
                <ProjectKpiCard
                  icon={totalActiveProfit >= 0 ? TrendingUp : TrendingDown} label="Lönsamhet"
                  value={formatSEK(totalActiveProfit)} tone={totalActiveProfit < 0 ? 'negative' : 'neutral'}
                />
              </div>

              {/* Kompakt varningsrad istället för en hel inbäddad sektion —
                  syns bara när den faktiskt behövs, försvinner annars helt
                  (ingen "allt bra"-text som bara tar plats). */}
              {atRiskProjects.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: BRAND.redBg, color: BRAND.redText, borderRadius: '8px', fontSize: '13px', marginBottom: '18px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span><strong>{atRiskProjects.length} {atRiskProjects.length === 1 ? 'projekt' : 'projekt'}</strong> nära eller över budgeterad tid: {atRiskProjects.map(p => p.name).join(', ')}</span>
                </div>
              )}

              {/* Filterrad — status som runda piller (det man byter oftast),
                  avdelning och sök bredvid. Allt på en gång, ingen
                  flik-navigering krävs för att gå mellan dem. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px', background: 'var(--bg-card)', flexShrink: 0 }}>
                  {[{ id: 'active', label: 'Aktiva' }, { id: 'all', label: 'Alla' }, { id: 'archived', label: 'Arkiverade' }].map(f => (
                    <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
                      padding: '6px 14px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600,
                      background: statusFilter === f.id ? BRAND.green : 'transparent',
                      color: statusFilter === f.id ? 'white' : 'var(--text-secondary)',
                      transition: 'background 0.15s, color 0.15s',
                    }}>{f.label}</button>
                  ))}
                </div>

                {departmentNames.length > 0 && (
                  <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)', flexShrink: 0 }}>
                    <option value="">Alla avdelningar</option>
                    {departmentNames.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}

                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px', maxWidth: '320px' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text" placeholder="Sök projekt eller kund..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px 7px 32px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'var(--bg-card)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <ProjectListItems
                list={visibleProjects} contacts={contacts} timeEntries={timeEntries}
                expandedProjectId={expandedProjectId} setExpandedProjectId={setExpandedProjectId}
                detailTab={detailTab} setDetailTab={setDetailTab}
                emptyIcon={searchTerm || departmentFilter ? Search : (statusFilter === 'archived' ? Archive : Zap)}
                emptyMessage={
                  searchTerm || departmentFilter ? 'Inga projekt hittades med de filtren.'
                    : statusFilter === 'archived' ? 'Inga arkiverade projekt ännu.'
                      : statusFilter === 'active' ? 'Inga aktiva projekt just nu.'
                        : 'Inga projekt ännu.'
                }
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'time' && (
        <div style={{ marginTop: '20px' }}>
          {/* Vecka/Rapporter — samma underline-flikrecept som ProjectCardens
              Tidrapporter/Kostnader/Fakturerat, en nivå upp. */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '18px' }}>
            {[{ id: 'week', label: 'Vecka' }, { id: 'reports', label: 'Rapporter' }].map(t => (
              <button key={t.id} onClick={() => setTimeSubTab(t.id)} style={{
                padding: '7px 14px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600,
                background: timeSubTab === t.id ? BRAND.greenLight : 'transparent',
                color: timeSubTab === t.id ? BRAND.greenDark : 'var(--text-secondary)',
                transition: 'background 0.15s, color 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {timeSubTab === 'week' ? (
            <TimeTrackingTab projects={projects} timeEntries={timeEntries} setTimeEntries={setTimeEntries} setProjects={setProjects} employees={employees} />
          ) : (
            <TimeReportsView timeEntries={timeEntries} employees={employees} timeReportStatuses={timeReportStatuses} setTimeReportStatuses={setTimeReportStatuses} />
          )}
        </div>
      )}

      {/* ── "Nytt projekt" — modal, appens vanliga vita
             .modal-overlay/.modal-content (index.css) helt utan
             färgöverskrivningar, samma utseende som varje annan modal i
             appen (t.ex. offertens förhandsgranskning). ── */}
      {showNewProjectForm && (
        <div className="modal-overlay" onClick={() => setShowNewProjectForm(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nytt projekt</h2>
              <button className="modal-close" onClick={() => setShowNewProjectForm(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelSt}>Namn *</label>
                <input type="text" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} style={inputSt} placeholder="t.ex. Kontorsrenovering 2026" required autoFocus />
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>Projektnumret tilldelas automatiskt (P-001, P-002 …)</div>
              </div>

              <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <label style={labelSt}>Status</label>
                  <select value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })} style={inputSt}>
                    <option value="active">Aktivt</option>
                    <option value="finished">Avslutat</option>
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Kund</label>
                  <EntitySearch
                    value={projectForm.customerId}
                    onChange={id => setProjectForm({ ...projectForm, customerId: id })}
                    items={contacts.filter(c => c.type === 'customer' || !c.type)}
                    placeholder="— Ingen —"
                    onCreateNew={handleCreateCustomerInline}
                    createLabel="Skapa ny kund"
                    inputStyle={inputSt}
                  />
                </div>
              </div>

              <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <label style={labelSt}>Avdelning</label>
                  {isAddingDepartment ? (
                    <input
                      type="text" autoFocus value={projectForm.department}
                      onChange={e => setProjectForm({ ...projectForm, department: e.target.value })}
                      onBlur={() => { if (!projectForm.department) setIsAddingDepartment(false); }}
                      style={inputSt} placeholder="Namnge avdelningen"
                    />
                  ) : (
                    <select
                      value={projectForm.department}
                      onChange={e => {
                        if (e.target.value === '__new__') { setIsAddingDepartment(true); setProjectForm({ ...projectForm, department: '' }); }
                        else setProjectForm({ ...projectForm, department: e.target.value });
                      }}
                      style={inputSt}
                    >
                      <option value="">— Ingen —</option>
                      {departmentNames.map(d => <option key={d} value={d}>{d}</option>)}
                      <option value="__new__">+ Ny avdelning…</option>
                    </select>
                  )}
                </div>
                <div>
                  <label style={labelSt}>Startdatum</label>
                  <input type="date" value={projectForm.startDate} onChange={e => setProjectForm({ ...projectForm, startDate: e.target.value })} style={inputSt} />
                </div>
              </div>

              <div>
                <label style={labelSt}>Slutdatum</label>
                <input type="date" value={projectForm.endDate} onChange={e => setProjectForm({ ...projectForm, endDate: e.target.value })} style={{ ...inputSt, maxWidth: '220px' }} />
              </div>

              <div>
                <label style={labelSt}>Beskrivning</label>
                <textarea
                  value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                  style={{ ...inputSt, resize: 'vertical', minHeight: '70px', lineHeight: 1.5 }}
                  placeholder="Kort om vad projektet handlar om (valfritt)"
                />
              </div>

              <div>
                <label style={labelSt}>Färg</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {PROJECT_COLORS.map(c => (
                    <button
                      key={c} type="button" onClick={() => setProjectForm({ ...projectForm, color: c })}
                      aria-label={`Välj färgen ${c}`} title={c}
                      style={{
                        width: 28, height: 28, borderRadius: '999px', background: c, cursor: 'pointer', padding: 0,
                        border: projectForm.color === c ? '2px solid white' : '2px solid transparent',
                        boxShadow: projectForm.color === c ? `0 0 0 2px ${BRAND.greenDark}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Fler alternativ — budget/prissättning och fakturering, döljs
                  tills man faktiskt vill ha dem, samma princip som resten av
                  formulären. Inte med i skissen, men budget/lönsamhet är
                  redan en central del av Projekt-sidan (KPI-remsan, "nära
                  budget"-varningen) — att ta bort möjligheten att sätta en
                  budget hade tyst brutit den funktionen. */}
              <button
                type="button"
                onClick={() => setShowMoreProjectOptions(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: BRAND.greenDark, fontSize: '13px', fontWeight: 600, alignSelf: 'flex-start' }}
              >
                <ChevronDown size={14} style={{ transform: showMoreProjectOptions ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                Fler alternativ (budget, fakturering)
              </button>

              {showMoreProjectOptions && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px', background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div className="form-row-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                    <div>
                      <label style={labelSt}>Budgeterad tid (h)</label>
                      <input type="number" min="0" value={projectForm.budgetHours} onChange={e => setProjectForm({ ...projectForm, budgetHours: e.target.value })} style={inputSt} />
                    </div>
                    <div>
                      <label style={labelSt}>Timpris (kr)</label>
                      <input type="number" min="0" value={projectForm.hourlyRate} onChange={e => setProjectForm({ ...projectForm, hourlyRate: e.target.value })} style={inputSt} />
                    </div>
                    <div>
                      <label style={labelSt}>Budgeterat värde</label>
                      <div style={{ ...inputSt, background: 'var(--gray-50)', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {formatSEK(budgetedValue)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button" role="switch" aria-checked={projectForm.autoInvoiceFromTime}
                      onClick={() => setProjectForm(f => ({ ...f, autoInvoiceFromTime: !f.autoInvoiceFromTime }))}
                      style={{
                        width: '38px', height: '22px', borderRadius: '999px', border: 'none', cursor: 'pointer', flexShrink: 0,
                        background: projectForm.autoInvoiceFromTime ? BRAND.green : 'var(--gray-300)', position: 'relative', transition: 'background 0.15s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: '2px', left: projectForm.autoInvoiceFromTime ? '18px' : '2px',
                        width: '18px', height: '18px', borderRadius: '999px', background: 'var(--bg-card)', transition: 'left 0.15s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>Fakturera automatiskt utifrån tidrapporter</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Kopplar projektets tidrapporter direkt till fakturaunderlag.</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '18px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowNewProjectForm(false)} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>Avbryt</button>
                <button type="submit" disabled={isSavingProject} style={{ padding: '10px 22px', background: BRAND.green, border: 'none', borderRadius: '999px', fontWeight: 700, color: 'white', cursor: isSavingProject ? 'default' : 'pointer', opacity: isSavingProject ? 0.6 : 1, fontSize: '14px' }}>
                  {isSavingProject ? 'Sparar…' : 'Skapa projekt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
