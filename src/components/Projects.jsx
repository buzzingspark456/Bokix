import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, ChevronLeft, ChevronRight, X, Send, ClipboardCheck, CheckCircle2, Undo2, Trash2, Pencil,
} from './icons';
import { ProjectSearch, EntitySearch } from './shared/SearchInputs';
import ListPageHeader, { ListFilterBar } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import { Panel, Kpi, KpiGrid, usePalette } from './shared/Workspace';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { BRAND } from '../utils/brandColors';
import { invoiceNetSek } from '../utils/contactTotals';
import { t as tr, dateLocale } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

const formatSEK = (val) => numberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

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
function sumHours(entries) { return entries.reduce((s, t) => s + (Number(t.hours) || 0), 0); }
function formatHours(h) { return (Math.round(h * 4) / 4).toString().replace('.', ','); }
function parseHours(text) {
  const v = Number(String(text).trim().replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function formatWeekRange(weekDates) {
  const start = weekDates[0], end = weekDates[6];
  const monthName = (d) => d.toLocaleDateString(dateLocale(), { month: 'long' });
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${monthName(end)} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${monthName(start)} – ${end.getDate()} ${monthName(end)} ${end.getFullYear()}`;
}
function formatDayLong(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function formatDay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
}

// Färgval per projekt (pricken framför namnet). Bokix grönt är förvalet.
const PROJECT_COLORS = [BRAND.green, '#1e293b', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Projektnummer (P-001, P-002, ...) — tilldelas vid sparande, samma princip
// som offert- och fakturanummer.
const getNextProjectNumber = (list) => {
  const nums = list.map(p => Number(String(p.projectNumber || '').replace('P-', ''))).filter(n => !isNaN(n));
  return `P-${String((nums.length > 0 ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
};

// ══════════════════════════════════════════════════════════════════════
// Tidrapporter — godkännande per person och månad. Personer = "Jag"
// (kontoinnehavaren) plus registrerade anställda.
// ══════════════════════════════════════════════════════════════════════
const SELF_PERSON_ID = '__self__';

function getPersonList(employees) {
  return [
    { id: SELF_PERSON_ID, name: tr('proj.me') },
    ...employees.map(e => ({ id: e.id, name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || tr('ui.namnlos') })),
  ];
}

const TIME_REPORT_STAGES = ['pending', 'submitted', 'attested', 'approved'];
const TIME_REPORT_STATUS = {
  pending: { label: tr('ui.pagaende'), cls: 'mute' },
  submitted: { label: tr('ui.inskickad'), cls: 'warn' },
  attested: { label: tr('ui.attesterad'), cls: 'warn' },
  approved: { label: tr('ui.godkand'), cls: 'ok' },
};

function getMonthKey(dateStr) { return (dateStr || '').slice(0, 7); }
function formatMonthLabel(monthKey) {
  const [y, m] = (monthKey || '').split('-').map(Number);
  if (!y || !m) return monthKey || '—';
  return new Date(y, m - 1, 1).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
}
function reportKey(personId, monthKey, customerId) { return `${personId}|${monthKey}|${customerId || 'none'}`; }
function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getReportStatus(timeReportStatuses, personId, monthKey, customerId) {
  const key = reportKey(personId, monthKey, customerId);
  const found = (timeReportStatuses || []).find(s => reportKey(s.personId, s.monthKey, s.customerId) === key);
  return found?.status || 'pending';
}

const expenseNet = (e) => Number(e.netAmount) || ((Number(e.amount) || 0) - (Number(e.vatAmount) || 0)) || 0;

/** Tid mot budget som stapel; gul från 80 %, röd över 100 %. */
function TimeBar({ spent, budget, wide = false }) {
  if (!budget) return <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{formatHours(spent)} {tr('ui.h')}</span>;
  const pct = (spent / budget) * 100;
  const cls = pct > 100 ? 'over' : pct >= 80 ? 'warn' : '';
  return (
    <div style={{ minWidth: wide ? 0 : '130px' }}>
      <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginBottom: '5px', fontVariantNumeric: 'tabular-nums' }}>
        {formatHours(spent)} {tr('ui.av')} {formatHours(budget)} {tr('ui.h')}
      </div>
      <div className={`ws-bar ${cls}`}><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
    </div>
  );
}

const statusPill = (p) => (p.status === 'finished'
  ? <span className="agi-pill" style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>{tr('ui.avslutat')}</span>
  : <span className="agi-pill ok">{tr('ui.pagar')}</span>);

// ── En timruta i veckorutnätet: man skriver timmarna direkt, som i
// Harvest och Fortnox tidredovisning. Sparas när man lämnar rutan eller
// trycker Enter; en tömd ruta tar bort registreringen. ──
function HourCell({ hours, onCommit, label }) {
  const initial = hours ? formatHours(hours) : '';
  const [text, setText] = useState(initial);
  useEffect(() => { setText(initial); }, [initial]);
  const commit = () => {
    const next = parseHours(text);
    if (next === (hours || 0)) { setText(initial); return; }
    onCommit(next);
  };
  return (
    <input
      className={`tt-cell${hours ? ' has' : ''}`}
      inputMode="decimal"
      aria-label={label}
      value={text}
      placeholder="–"
      onChange={e => setText(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { setText(initial); e.currentTarget.blur(); }
      }}
    />
  );
}

// ── Veckans tidrapport: rader = projekt, kolumner = dagar. På telefon en
// dag i taget med en dagrad överst. ──
function WeekSheet({ projects, timeEntries, setTimeEntries, setProjects, personId, weekStart, onPrevWeek, onNextWeek, onThisWeek, prevWeekTotal }) {
  const [extraProjectIds, setExtraProjectIds] = useState([]);
  const [showAddRow, setShowAddRow] = useState(false);
  const isNarrow = useIsMobileViewport(640);
  const [selectedDayIdx, setSelectedDayIdx] = useState(null);
  useEffect(() => { setExtraProjectIds([]); }, [personId]);

  const weekDates = getDatesOfWeek(weekStart);
  const weekStartStr = getISODate(weekDates[0]);
  const weekEndStr = getISODate(weekDates[6]);
  const todayStr = getISODate(new Date());
  const todayIdx = weekDates.findIndex(d => getISODate(d) === todayStr);
  const activeDayIdx = selectedDayIdx ?? (todayIdx >= 0 ? todayIdx : 0);
  useEffect(() => { setSelectedDayIdx(null); }, [weekStartStr]);
  const visibleDates = isNarrow ? [weekDates[activeDayIdx]] : weekDates;

  const weekEntries = timeEntries.filter(t => (t.personId || SELF_PERSON_ID) === personId && t.date >= weekStartStr && t.date <= weekEndStr);
  const weekTotal = sumHours(weekEntries);

  const rowIds = [];
  weekEntries.forEach(t => { if (t.projectId && !rowIds.includes(t.projectId)) rowIds.push(t.projectId); });
  extraProjectIds.forEach(id => { if (!rowIds.includes(id)) rowIds.push(id); });
  const rows = rowIds.map(id => projects.find(p => p.id === id)).filter(Boolean);
  const addable = projects.filter(p => p.status !== 'finished' && !rowIds.includes(p.id));

  const entriesFor = (projectId, dateStr) => weekEntries.filter(t => t.projectId === projectId && t.date === dateStr);
  const dayTotal = (dateStr) => sumHours(weekEntries.filter(t => t.date === dateStr));

  // En ruta = summan av dagens registreringar på projektet. Ändras den
  // skrivs den första om och eventuella fler slås ihop, så att rutan och
  // det sparade alltid stämmer.
  const commitCell = (projectId, dateStr, hours) => {
    const existing = entriesFor(projectId, dateStr);
    const before = sumHours(existing);
    const ids = new Set(existing.map(e => e.id));
    setTimeEntries(prev => {
      const rest = prev.filter(e => !ids.has(e.id));
      if (!hours) return rest;
      const first = existing[0];
      const description = existing.map(e => e.description).filter(Boolean).join(' · ');
      return [...rest, first
        ? { ...first, hours, description }
        : { id: `time_${Date.now()}`, date: dateStr, projectId, personId, hours, description: '' }];
    });
    setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, timeSpent: Math.max(0, (p.timeSpent || 0) - before + hours) } : p)));
  };

  const diff = weekTotal - prevWeekTotal;
  const weekNo = isoWeekNumber(weekDates[0]);
  const palette = usePalette();
  const dayTotals = weekDates.map(d => dayTotal(getISODate(d)));
  const loggedDays = dayTotals.filter(h => h > 0).length;
  const chartMax = Math.max(8, ...dayTotals);

  return (
    <>
    <Panel title={tr('proj.week', { n: weekNo })} sub={formatWeekRange(weekDates)}
      actions={<>
        <button type="button" className="agi-btn" style={{ padding: '0 8px' }} onClick={onPrevWeek} aria-label={tr('proj.prevWeek')}><ChevronLeft size={16} /></button>
        <button type="button" className="agi-btn" onClick={onThisWeek}>{tr('proj.thisWeek')}</button>
        <button type="button" className="agi-btn" style={{ padding: '0 8px' }} onClick={onNextWeek} aria-label={tr('proj.nextWeek')}><ChevronRight size={16} /></button>
      </>}>
      <div className="tt-overview">
        <KpiGrid>
          <Kpi dot={palette.income} label={tr('ui.denna_vecka')} value={`${formatHours(weekTotal)} ${tr('ui.h')}`}
            sub={(weekTotal > 0 || prevWeekTotal > 0) && diff !== 0 ? tr(diff > 0 ? 'proj.moreThanLast' : 'proj.lessThanLast', { h: formatHours(Math.abs(diff)) }) : tr('proj.sameAsLast')} />
          <Kpi dot={palette.profit} label={tr('ui.snitt_per_arbetsdag')} value={loggedDays ? `${formatHours(weekTotal / loggedDays)} ${tr('ui.h')}` : '–'} sub={tr('proj.loggedDays', { n: loggedDays })} />
        </KpiGrid>
        <div className="tt-days-chart" style={{ '--pj': palette.income }} aria-hidden="true">
          {weekDates.map((d, i) => (
            <div key={i} title={`${formatHours(dayTotals[i])} h`}>
              <i className={dayTotals[i] > 0 ? '' : 'zero'} style={{ height: `${Math.max(4, (dayTotals[i] / chartMax) * 100)}%` }} />
              <span className={getISODate(d) === todayStr ? 'today' : ''}>{d.toLocaleDateString(dateLocale(), { weekday: 'short' }).replace('.', '')}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
    <div className="ws-card">
      <div className="ws-card-head">
        <div>
          <h3 className="ws-card-title">{tr('proj.timesheet')}</h3>
          <p className="ws-card-sub">{tr('proj.typeHint')}</p>
        </div>
      </div>

      {isNarrow && (
        <div className="tt-days">
          {weekDates.map((date, i) => {
            const dateStr = getISODate(date);
            const total = dayTotal(dateStr);
            return (
              <button key={dateStr} type="button" className={i === activeDayIdx ? 'on' : ''} onClick={() => setSelectedDayIdx(i)}>
                <small>{date.toLocaleDateString(dateLocale(), { weekday: 'short' })}</small>
                <b>{date.getDate()}</b>
                <em>{total > 0 ? `${formatHours(total)} h` : '–'}</em>
              </button>
            );
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="ws-empty" style={{ padding: '40px 24px' }}>
          <h3>{tr('ui.ingen_tid_registrerad_annu_denna_vecka')}</h3>
          <p>{addable.length > 0 ? tr('proj.addRowHint') : tr('proj.noProjectsForTime')}</p>
          {addable.length > 0 && (showAddRow ? (
            <div style={{ maxWidth: '300px', margin: '0 auto' }}>
              <ProjectSearch value="" onChange={(id) => { if (id) { setExtraProjectIds(prev => [...prev, id]); setShowAddRow(false); } }} projects={addable} />
            </div>
          ) : (
            <button type="button" className="agi-btn primary" onClick={() => setShowAddRow(true)}><Plus size={14} /> {tr('ui.lagg_till_projekt')}</button>
          ))}
        </div>
      ) : (
        <>
          <div className="tt-wrap">
            <table className="tt-grid">
              <thead>
                <tr>
                  <th className="tt-proj">{tr('ui.projekt')}</th>
                  {visibleDates.map(date => {
                    const dateStr = getISODate(date);
                    const weekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th key={dateStr} className={`${dateStr === todayStr ? 'today' : ''}${weekend ? ' weekend' : ''}`}>
                        <span className="tt-day-name">{date.toLocaleDateString(dateLocale(), { weekday: 'short' })}</span>
                        <span className="tt-day-num">{date.getDate()}</span>
                      </th>
                    );
                  })}
                  <th className="tt-sum">{tr('ui.totalt')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(project => {
                  const rowTotal = sumHours(weekEntries.filter(t => t.projectId === project.id));
                  return (
                    <tr key={project.id}>
                      <td className="tt-proj">
                        <div className="ws-name">
                          <span className="ws-dot" style={{ background: project.color || BRAND.green }} />
                          <div className="ws-name-text">
                            <strong>{project.name}</strong>
                            {project.customerName && <small>{project.customerName}</small>}
                          </div>
                        </div>
                      </td>
                      {visibleDates.map(date => {
                        const dateStr = getISODate(date);
                        const weekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <td key={dateStr} className={weekend ? 'weekend' : ''}>
                            <HourCell
                              hours={sumHours(entriesFor(project.id, dateStr))}
                              label={`${project.name}, ${formatDay(dateStr)}`}
                              onCommit={(h) => commitCell(project.id, dateStr, h)}
                            />
                          </td>
                        );
                      })}
                      <td className="tt-sum" style={{ color: rowTotal > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>{rowTotal > 0 ? `${formatHours(rowTotal)} h` : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="tt-proj">{tr('ui.totalt')}</td>
                  {visibleDates.map(date => {
                    const total = dayTotal(getISODate(date));
                    return <td key={getISODate(date)} style={{ color: total > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>{total > 0 ? formatHours(total) : '–'}</td>;
                  })}
                  <td className="tt-sum">{formatHours(weekTotal)} {tr('ui.h')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {addable.length > 0 && (
            <div className="tt-add" style={{ borderTop: '1px solid var(--border-light)' }}>
              {showAddRow ? (
                <>
                  <div style={{ flex: '0 1 300px' }}>
                    <ProjectSearch value="" onChange={(id) => { if (id) { setExtraProjectIds(prev => [...prev, id]); setShowAddRow(false); } }} projects={addable} />
                  </div>
                  <button type="button" className="ws-icon-btn" onClick={() => setShowAddRow(false)} title={tr('ui.avbryt')}><X size={16} /></button>
                </>
              ) : (
                <button type="button" className="agi-btn" onClick={() => setShowAddRow(true)}><Plus size={14} /> {tr('ui.lagg_till_projekt')}</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}

// ── Månadens tidrapporter: godkännande per person. ──
function TimeReportsView({ timeEntries, employees, projects = [], timeReportStatuses, setTimeReportStatuses, month, onPickMonth, onPrevMonth, onNextMonth, onThisMonth }) {
  const [calPerson, setCalPerson] = useState('');
  const [calDay, setCalDay] = useState(null);
  useEffect(() => { setCalDay(null); }, [month]);
  const palette = usePalette();
  const [openReport, setOpenReport] = useState(null);
  const people = useMemo(() => getPersonList(employees), [employees]);

  const reports = useMemo(() => {
    const monthEntries = timeEntries.filter(t => getMonthKey(t.date) === month);
    return people
      .map(p => {
        const entries = monthEntries.filter(t => (t.personId || SELF_PERSON_ID) === p.id);
        return { person: p, monthKey: month, entries, hours: sumHours(entries), status: getReportStatus(timeReportStatuses, p.id, month) };
      })
      .filter(r => r.hours > 0 || r.status !== 'pending');
  }, [people, timeEntries, month, timeReportStatuses]);

  const setStatus = (personId, monthKey, status) => {
    setTimeReportStatuses(prevList => {
      const prev = prevList || [];
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

  const ACTION_LABEL = { pending: tr('ui.skicka_in'), submitted: tr('ui.attestera'), attested: tr('ui.godkann_slutligt') };
  const ACTION_ICON = { pending: Send, submitted: ClipboardCheck, attested: CheckCircle2 };

  // Flytta alla i samma steg på en gång, i ett enda anrop.
  const bulkAdvance = (fromStatus) => {
    const toStatus = TIME_REPORT_STAGES[TIME_REPORT_STAGES.indexOf(fromStatus) + 1];
    const targets = reports.filter(r => r.status === fromStatus);
    if (targets.length === 0 || !toStatus) return;
    setTimeReportStatuses(prev => {
      let next = [...(prev || [])];
      targets.forEach(r => {
        const key = reportKey(r.person.id, r.monthKey);
        const idx = next.findIndex(s => reportKey(s.personId, s.monthKey, s.customerId) === key);
        if (idx === -1) next = [...next, { id: `trs_${Date.now()}_${r.person.id}`, personId: r.person.id, monthKey: r.monthKey, customerId: null, status: toStatus }];
        else next = next.map((s, i) => (i === idx ? { ...s, status: toStatus } : s));
      });
      return next;
    });
  };

  const submitted = reports.filter(r => r.status === 'submitted');
  const attested = reports.filter(r => r.status === 'attested');

  // Kalendern: månadens dagar måndag–söndag, timmar per dag (alla eller en person).
  const calEntries = timeEntries.filter(t => getMonthKey(t.date) === month && (!calPerson || (t.personId || SELF_PERSON_ID) === calPerson));
  const [cy, cm] = month.split('-').map(Number);
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const lead = (new Date(cy, cm - 1, 1).getDay() + 6) % 7;
  const todayIso = getISODate(new Date());
  const hoursByDay = {};
  calEntries.forEach(t => { hoursByDay[t.date] = (hoursByDay[t.date] || 0) + (Number(t.hours) || 0); });
  const calMax = Math.max(8, ...Object.values(hoursByDay));
  const weekdayNames = getDatesOfWeek(new Date(2026, 9, 12)).map(d => d.toLocaleDateString(dateLocale(), { weekday: 'short' }).replace('.', ''));
  const dayEntries = calDay ? calEntries.filter(t => t.date === calDay) : [];
  const personName = (id) => people.find(x => x.id === (id || SELF_PERSON_ID))?.name || '';
  const projectName = (id) => projects.find(x => x.id === id)?.name || '';
  const calTotal = sumHours(calEntries);
  const calDays = Object.keys(hoursByDay).length;

  return (
    <>
      <Panel
        title={<span style={{ textTransform: 'capitalize' }}>{formatMonthLabel(month)}</span>}
        sub={tr('proj.calendarSub')}
        actions={<>
          <button type="button" className="agi-btn" style={{ padding: '0 8px' }} onClick={onPrevMonth} aria-label={tr('proj.prevMonth')}><ChevronLeft size={16} /></button>
          <input type="month" className="ws-input" style={{ width: 'auto', height: '36px' }} value={month} aria-label={tr('proj.pickMonth')} onChange={e => e.target.value && onPickMonth(e.target.value)} />
          <button type="button" className="agi-btn" style={{ padding: '0 8px' }} onClick={onNextMonth} aria-label={tr('proj.nextMonth')}><ChevronRight size={16} /></button>
          <button type="button" className="agi-btn" onClick={onThisMonth}>{tr('ui.denna_manad')}</button>
        </>}>
        <KpiGrid>
          <Kpi dot={palette.income} label={tr('ui.totalt_loggat')} value={`${formatHours(calTotal)} ${tr('ui.h')}`} sub={tr('proj.loggedDays', { n: calDays })} />
          <Kpi dot={palette.costBar} label={tr('ui.vantar_attest')} value={submitted.length} sub={(reports.length === 1 ? tr('proj.personOne') : tr('proj.people', { n: reports.length }))} />
          <Kpi dot={palette.profit} label={tr('ui.vantar_godkannande')} value={attested.length} sub={tr('proj.approvedCount', { n: reports.filter(r => r.status === 'approved').length })} />
        </KpiGrid>

        {people.length > 1 && (
          <div className="ws-seg" style={{ marginTop: '16px', flexWrap: 'wrap' }}>
            <button type="button" className={!calPerson ? 'on' : ''} onClick={() => setCalPerson('')}>{tr('proj.everyone')}</button>
            {people.map(x => <button key={x.id} type="button" className={calPerson === x.id ? 'on' : ''} onClick={() => setCalPerson(x.id)}>{x.name}</button>)}
          </div>
        )}

        <div className="tr-cal" style={{ '--pj': palette.income }}>
          {weekdayNames.map(n => <div key={n} className="tr-cal-wd">{n}</div>)}
          {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} className="tr-cal-blank" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
            const h = hoursByDay[iso] || 0;
            const weekend = (lead + i) % 7 >= 5;
            return (
              <button key={iso} type="button"
                className={`tr-cal-day${h ? ' has' : ''}${weekend ? ' weekend' : ''}${iso === todayIso ? ' today' : ''}${calDay === iso ? ' on' : ''}`}
                style={h ? { '--fill': `${Math.round(14 + (h / calMax) * 46)}%` } : undefined}
                onClick={() => setCalDay(calDay === iso ? null : iso)}>
                <span className="n">{i + 1}</span>
                {h > 0 && <span className="h">{formatHours(h)} h</span>}
              </button>
            );
          })}
        </div>

        {calDay && (
          <div className="ws-card" style={{ marginTop: '14px' }}>
            <div className="ws-card-head"><h3 className="ws-card-title">{formatDayLong(calDay)}</h3><span className="ws-hint">{formatHours(sumHours(dayEntries))} {tr('ui.h')}</span></div>
            {dayEntries.length === 0 ? <div className="ws-rows-empty">{tr('ui.ingen_tid_registrerad')}</div> : (
              <ul className="ws-rows">
                {dayEntries.map(e => (
                  <li key={e.id}>
                    <span className="grow">{projectName(e.projectId) || '—'}{e.description ? <span className="muted"> · {e.description}</span> : null}</span>
                    {people.length > 1 && <span className="muted">{personName(e.personId)}</span>}
                    <span className="num">{formatHours(e.hours)} {tr('ui.h')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title={tr('proj.approval')}
        sub={tr('proj.reportsSub')}
        actions={<>
          {submitted.length > 0 && <button type="button" className="agi-btn" onClick={() => bulkAdvance('submitted')}><ClipboardCheck size={14} /> {tr('ui.attestera_alla_inskickade')}{submitted.length})</button>}
          {attested.length > 0 && <button type="button" className="agi-btn primary" onClick={() => bulkAdvance('attested')}><CheckCircle2 size={14} /> {tr('ui.godkann_alla_attesterade')}{attested.length})</button>}
        </>}>
        {reports.length === 0 ? (
          <p className="ws-hint">{tr('ui.ingen_tid_loggad_denna_manad_annu')}</p>
        ) : (
          <div className="tr-approvals">
            {reports.map(r => {
              const stage = TIME_REPORT_STAGES.indexOf(r.status);
              const ActionIcon = ACTION_ICON[r.status];
              return (
                <div key={r.person.id} className={`tr-approval${r.status === 'approved' ? ' done' : ''}`}>
                  <button type="button" className="tr-approval-who" onClick={() => setOpenReport(r)}>
                    <span className="lg-avatar" aria-hidden="true">{(r.person.name || '?').charAt(0).toUpperCase()}</span>
                    <span className="ws-name-text">
                      <strong>{r.person.name}</strong>
                      <small>{tr('proj.entries', { n: r.entries.length })} · {formatHours(r.hours)} {tr('ui.h')}</small>
                    </span>
                  </button>
                  <ol className="tr-steps" aria-label={tr('ui.status')}>
                    {TIME_REPORT_STAGES.map((st, i) => (
                      <li key={st} className={`${i < stage ? 'past' : ''}${i === stage ? ' now' : ''}`}>
                        <i aria-hidden="true">{i < stage || st === 'approved' && i === stage ? <CheckCircle2 size={14} /> : null}</i>
                        <span>{TIME_REPORT_STATUS[st].label}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="tr-approval-actions">
                    {r.status !== 'pending' && <button type="button" className="agi-btn" onClick={() => revert(r)} title={tr('ui.skicka_tillbaka_ett_steg')}><Undo2 size={14} /> {tr('proj.back')}</button>}
                    {ActionIcon
                      ? <button type="button" className="agi-btn primary" onClick={() => advance(r)}><ActionIcon size={14} /> {ACTION_LABEL[r.status]}</button>
                      : <span className="agi-pill ok">{tr('proj.allDone')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {openReport && (() => {
        const sorted = [...openReport.entries].sort((a, b) => a.date.localeCompare(b.date));
        const meta = TIME_REPORT_STATUS[openReport.status];
        const ActionIcon = ACTION_ICON[openReport.status];
        return (
          <div className="modal-overlay" onClick={() => setOpenReport(null)}>
            <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{openReport.person.name} · <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{formatMonthLabel(openReport.monthKey)}</span></h2>
                <button type="button" className="modal-close" onClick={() => setOpenReport(null)}><X size={18} /></button>
              </div>
              <div style={{ marginBottom: '12px' }}><span className={`agi-pill ${meta.cls}`}>{meta.label}</span></div>
              {sorted.length === 0 ? <p className="ws-hint">{tr('ui.ingen_tid_registrerad')}</p> : (
                <ul className="ws-rows" style={{ maxHeight: '320px', overflowY: 'auto', margin: '0 -20px' }}>
                  {sorted.map(entry => (
                    <li key={entry.id}>
                      <span className="date">{formatDay(entry.date)}</span>
                      <span className="grow">{entry.description || <span className="muted">—</span>}</span>
                      <span className="num">{formatHours(entry.hours)} {tr('ui.h')}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="modal-footer">
                <span style={{ marginRight: 'auto', fontWeight: 700 }}>{tr('ui.totalt')} {formatHours(openReport.hours)} {tr('ui.h')}</span>
                {openReport.status !== 'pending' && <button type="button" className="agi-btn" onClick={() => { revert(openReport); setOpenReport(null); }}>{tr('ui.skicka_tillbaka')}</button>}
                {ActionIcon && <button type="button" className="agi-btn primary" onClick={() => { advance(openReport); setOpenReport(null); }}><ActionIcon size={14} /> {ACTION_LABEL[openReport.status]}</button>}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Projektets egen sida: siffror överst, tiden till vänster, fakturor
// och kostnader till höger, och knappar för att logga tid, fakturera,
// redigera och avsluta. ──
function ProjectDetail({ project, timeEntries, setTimeEntries, setProjects, invoices, expenses, people, onBack, onEdit, onDelete, onInvoice }) {
  const entries = timeEntries.filter(t => t.projectId === project.id).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  const projInvoices = invoices
    .filter(inv => inv.projectId === project.id && (!inv.type || inv.type === 'invoice'))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const projExpenses = expenses.filter(e => e.projectId === project.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const lastInvoiced = projInvoices.filter(i => i.status !== 'draft').map(i => i.date).filter(Boolean).sort().pop() || '';
  const unbilled = entries.filter(e => !lastInvoiced || e.date > lastInvoiced);
  const unbilledHours = sumHours(unbilled);
  const rate = Number(project.hourlyRate) || 0;
  const profit = project.revenue - project.cost;
  const budgetValue = (Number(project.budgetHours) || 0) * rate;
  const personName = (id) => people.find(p => p.id === (id || SELF_PERSON_ID))?.name || '';

  const [log, setLog] = useState({ date: getISODate(new Date()), hours: '', description: '' });
  const addTime = (e) => {
    e.preventDefault();
    const hours = parseHours(log.hours);
    if (!hours) return;
    setTimeEntries(prev => [...prev, { id: `time_${Date.now()}`, date: log.date, projectId: project.id, personId: SELF_PERSON_ID, hours, description: log.description.trim() }]);
    setProjects(prev => prev.map(p => (p.id === project.id ? { ...p, timeSpent: (p.timeSpent || 0) + hours } : p)));
    setLog(l => ({ ...l, hours: '', description: '' }));
  };
  const removeTime = (entry) => {
    setTimeEntries(prev => prev.filter(t => t.id !== entry.id));
    setProjects(prev => prev.map(p => (p.id === project.id ? { ...p, timeSpent: Math.max(0, (p.timeSpent || 0) - entry.hours) } : p)));
  };
  const toggleFinished = () => setProjects(prev => prev.map(p => (p.id === project.id ? { ...p, status: p.status === 'finished' ? 'active' : 'finished' } : p)));

  const dates = [project.startDate, project.endDate].filter(Boolean).map(formatDay).join(' – ');

  return (
    <div className="ws-page">
      <button type="button" className="pj-back" onClick={onBack}><ChevronLeft size={16} /> {tr('proj.allProjects')}</button>
      <div className="pj-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="pj-title"><span className="ws-dot" style={{ background: project.color || BRAND.green }} />{project.name} {statusPill(project)}</h2>
          <p className="pj-meta">{[project.projectNumber, project.customerName, dates].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="ws-card-actions">
          <button type="button" className="agi-btn" onClick={onEdit}><Pencil size={14} /> {tr('ui.andra')}</button>
          <button type="button" className="agi-btn" onClick={toggleFinished}>{project.status === 'finished' ? tr('proj.reopen') : tr('proj.finish')}</button>
          {onInvoice && project.customerId && unbilledHours > 0 && rate > 0 && (
            <button type="button" className="agi-btn primary" onClick={() => onInvoice(project, unbilledHours)}>{tr('proj.invoiceTime', { h: formatHours(unbilledHours) })}</button>
          )}
        </div>
      </div>

      <div className="ws-stats">
        <div className="ws-stat">
          <div className="ws-stat-label">{tr('ui.nedlagd_tid')}</div>
          <div className="ws-stat-value">{formatHours(project.hours)} {tr('ui.h')}</div>
          {project.budgetHours > 0
            ? <><div className="ws-stat-sub">{tr('proj.ofBudget', { h: formatHours(project.budgetHours) })}</div><div className={`ws-bar ${project.hours > project.budgetHours ? 'over' : project.hours >= project.budgetHours * 0.8 ? 'warn' : ''}`}><span style={{ width: `${Math.min(100, (project.hours / project.budgetHours) * 100)}%` }} /></div></>
            : <div className="ws-stat-sub">{tr('ui.ingen_budget_satt')}</div>}
        </div>
        <div className="ws-stat">
          <div className="ws-stat-label">{tr('ui.fakturerat')}</div>
          <div className="ws-stat-value">{formatSEK(project.revenue)}</div>
          <div className="ws-stat-sub">{unbilledHours > 0 ? tr('proj.unbilled', { h: formatHours(unbilledHours) }) : tr('proj.allBilled')}</div>
        </div>
        <div className="ws-stat">
          <div className="ws-stat-label">{tr('ui.kostnader')}</div>
          <div className="ws-stat-value">{formatSEK(project.cost)}</div>
          <div className="ws-stat-sub">{tr('proj.exVat')}</div>
        </div>
        <div className="ws-stat">
          <div className="ws-stat-label">{tr('proj.result')}</div>
          <div className={`ws-stat-value${profit < 0 ? ' neg' : ''}`}>{formatSEK(profit)}</div>
          <div className="ws-stat-sub">{tr('proj.resultSub')}</div>
        </div>
      </div>

      <div className="ws-cols">
        <div className="ws-card">
          <div className="ws-card-head">
            <div>
              <h3 className="ws-card-title">{tr('ui.tid')}</h3>
              <p className="ws-card-sub">{tr('proj.entries', { n: entries.length })}</p>
            </div>
          </div>
          <form className="pj-log" onSubmit={addTime}>
            <input type="date" className="ws-input" value={log.date} onChange={e => setLog(l => ({ ...l, date: e.target.value }))} aria-label={tr('ui.datum')} />
            <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" placeholder="0" value={log.hours} onChange={e => setLog(l => ({ ...l, hours: e.target.value }))} aria-label={tr('ui.timmar')} /><span>h</span></div>
            <input className="ws-input" placeholder={tr('ui.vad_jobbade_du_med')} value={log.description} onChange={e => setLog(l => ({ ...l, description: e.target.value }))} aria-label={tr('ui.beskrivning')} />
            <button type="submit" className="agi-btn primary" disabled={!parseHours(log.hours)}><Plus size={14} /> {tr('ui.logga_tid')}</button>
          </form>
          {entries.length === 0 ? <div className="ws-rows-empty">{tr('ui.ingen_tid_registrerad_pa_projektet_annu')}</div> : (
            <ul className="ws-rows">
              {entries.slice(0, 60).map(entry => (
                <li key={entry.id}>
                  <span className="date">{formatDay(entry.date)}</span>
                  <span className="grow">{entry.description || <span className="muted">{tr('proj.noNote')}</span>}{people.length > 1 && <span className="muted"> · {personName(entry.personId)}</span>}</span>
                  <span className="num">{formatHours(entry.hours)} {tr('ui.h')}</span>
                  <button type="button" className="ws-icon-btn" title={tr('ui.ta_bort')} onClick={() => removeTime(entry)}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ws-stack">
          <div className="ws-card">
            <div className="ws-card-head"><h3 className="ws-card-title">{tr('proj.invoices')}</h3></div>
            {projInvoices.length === 0 ? <div className="ws-rows-empty">{tr('ui.inget_fakturerat_pa_detta_projekt_annu')}</div> : (
              <ul className="ws-rows">
                {projInvoices.slice(0, 20).map(inv => (
                  <li key={inv.id}>
                    <span className="date">{formatDay(inv.date)}</span>
                    <span className="grow">{inv.invoiceNumber ? `#${inv.invoiceNumber}` : tr('proj.draft')}</span>
                    <span className="num">{formatSEK(invoiceNetSek(inv))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="ws-card">
            <div className="ws-card-head"><h3 className="ws-card-title">{tr('ui.kostnader')}</h3></div>
            {projExpenses.length === 0 ? <div className="ws-rows-empty">{tr('proj.noCosts')}</div> : (
              <ul className="ws-rows">
                {projExpenses.slice(0, 20).map(e => (
                  <li key={e.id}>
                    <span className="date">{formatDay(e.date)}</span>
                    <span className="grow">{e.supplier || e.supplierName || e.description || '—'}</span>
                    <span className="num">{formatSEK(expenseNet(e))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="ws-card">
            <div className="ws-card-head"><h3 className="ws-card-title">{tr('proj.about')}</h3></div>
            <div className="ws-card-body">
              {project.description && <p className="ws-hint" style={{ marginBottom: '14px', color: 'var(--text-main)' }}>{project.description}</p>}
              <dl className="pj-facts">
                <dt>{tr('ui.timpris_kr')}</dt><dd>{rate ? formatSEK(rate) : '—'}</dd>
                <dt>{tr('proj.budgetHours')}</dt><dd>{project.budgetHours ? `${formatHours(project.budgetHours)} h` : '—'}</dd>
                <dt>{tr('ui.budgeterat_varde')}</dt><dd>{budgetValue ? formatSEK(budgetValue) : '—'}</dd>
                {project.department && <><dt>{tr('ui.avdelning')}</dt><dd>{project.department}</dd></>}
              </dl>
              <button type="button" className="agi-btn danger" style={{ marginTop: '16px' }} onClick={onDelete}><Trash2 size={14} /> {tr('proj.delete')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Projects({ projects: storedProjects = [], invoices = [], expenses = [], setProjects, contacts = [], setContacts, timeEntries = [], setTimeEntries, employees = [], timeReportStatuses = [], setTimeReportStatuses, globalAction, clearGlobalAction, onAction }) {
  const [activeTab, setActiveTab] = useState('projects');
  // Intäkt och kostnad räknas ur fakturor och kostnader som är kopplade till
  // projektet (projectId), exklusive moms. Tiden räknas ur tidrapporterna;
  // det sparade timeSpent används bara för gamla projekt utan registreringar.
  const projects = useMemo(() => storedProjects.map(p => {
    const revenue = invoices
      .filter(inv => inv.projectId === p.id && (!inv.type || inv.type === 'invoice') && inv.status !== 'draft')
      .reduce((sum, inv) => sum + invoiceNetSek(inv), 0);
    const cost = expenses.filter(e => e.projectId === p.id).reduce((sum, e) => sum + expenseNet(e), 0);
    const own = timeEntries.filter(t => t.projectId === p.id);
    const hours = own.length ? sumHours(own) : (Number(p.timeSpent) || 0);
    const customerName = contacts.find(c => c.id === p.customerId)?.name || '';
    // Ej fakturerad tid: allt efter senaste (ej utkast) fakturans datum.
    const lastInvoiced = invoices
      .filter(inv => inv.projectId === p.id && (!inv.type || inv.type === 'invoice') && inv.status !== 'draft')
      .map(inv => inv.date).filter(Boolean).sort().pop() || '';
    const unbilledHours = sumHours(own.filter(t => !lastInvoiced || t.date > lastInvoiced));
    return { ...p, revenue: Math.round(revenue), cost: Math.round(cost), hours, budgetHours: Number(p.budgetHours) || 0, customerName, unbilledHours };
  }), [storedProjects, invoices, expenses, timeEntries, contacts]);

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
    setOpenProjectId(null);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${tab}`);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [openProjectId, setOpenProjectId] = useState(null);
  // Kort eller lista. Kort är förvalet; listan passar när projekten är många.
  const [view, setViewState] = useState(() => { try { return localStorage.getItem('bokix_projects_view') || 'cards'; } catch { return 'cards'; } });
  const setView = (v) => { setViewState(v); try { localStorage.setItem('bokix_projects_view', v); } catch { /* privat läge */ } };

  const [timeSubTab, setTimeSubTab] = useState('week');
  const [timePersonId, setTimePersonId] = useState(SELF_PERSON_ID);
  const [timeWeekStart, setTimeWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [timeMonth, setTimeMonth] = useState(() => getMonthKey(getISODate(new Date())));
  const people = useMemo(() => getPersonList(employees), [employees]);
  const prevWeekTotal = useMemo(() => {
    const prev = getDatesOfWeek(new Date(timeWeekStart.getFullYear(), timeWeekStart.getMonth(), timeWeekStart.getDate() - 7));
    const s = getISODate(prev[0]), e = getISODate(prev[6]);
    return sumHours(timeEntries.filter(t => (t.personId || SELF_PERSON_ID) === timePersonId && t.date >= s && t.date <= e));
  }, [timeEntries, timePersonId, timeWeekStart]);

  // ── Projektformuläret (nytt och ändra) ──
  const blankProjectForm = { name: '', customerId: '', department: '', color: PROJECT_COLORS[0], description: '', budgetHours: '', hourlyRate: '', startDate: '', endDate: '', status: 'active' };
  const [projectForm, setProjectForm] = useState(null); // null = stängt
  const [editingId, setEditingId] = useState(null);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);

  const openNewProjectForm = () => { setProjectForm(blankProjectForm); setEditingId(null); setIsAddingDepartment(false); };
  const openEditForm = (p) => {
    const stored = storedProjects.find(x => x.id === p.id) || p;
    setProjectForm({ ...blankProjectForm, ...stored, budgetHours: stored.budgetHours || '', hourlyRate: stored.hourlyRate || '' });
    setEditingId(p.id);
    setIsAddingDepartment(false);
  };

  const handleCreateCustomerInline = (name) => {
    const newContact = { id: `contact_${Date.now()}`, type: 'customer', customerType: 'se_company', name, orgNr: '', balance: 0, lastInvoiceDate: null, totalInvoicedThisYear: 0 };
    setContacts(prev => [...prev, newContact]);
    setProjectForm(f => ({ ...f, customerId: newContact.id }));
  };

  useEffect(() => {
    if (globalAction?.type === 'new_project') {
      handleSetTab('projects');
      openNewProjectForm();
      clearGlobalAction?.();
    }
  }, [globalAction, clearGlobalAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProject = (e) => {
    e.preventDefault();
    const name = (projectForm?.name || '').trim();
    if (!name) return;
    const values = { ...projectForm, name, budgetHours: Number(projectForm.budgetHours) || 0, hourlyRate: Number(projectForm.hourlyRate) || 0 };
    if (editingId) {
      setProjects(prev => prev.map(p => (p.id === editingId ? { ...p, ...values } : p)));
    } else {
      setProjects(prev => [{ id: `proj_${Date.now()}`, projectNumber: getNextProjectNumber(storedProjects), ...values, timeSpent: 0, revenue: 0, cost: 0 }, ...prev]);
    }
    setProjectForm(null);
  };

  const deleteProject = async (p) => {
    const hasTime = timeEntries.some(t => t.projectId === p.id);
    const ok = await confirmDialog(hasTime ? tr('proj.deleteConfirmTime', { name: p.name }) : tr('proj.deleteConfirm', { name: p.name }));
    if (!ok) return;
    setProjects(prev => prev.filter(x => x.id !== p.id));
    if (hasTime) setTimeEntries(prev => prev.filter(t => t.projectId !== p.id));
    setOpenProjectId(null);
  };

  // Fakturan öppnas förifylld med kunden, projektet och tiden sedan förra
  // fakturan (projektets timpris). Inget markeras som fakturerat förrän
  // fakturan finns: "ej fakturerat" räknas från senaste fakturans datum.
  const invoiceTime = (p, hours) => {
    onAction?.({
      type: 'new_invoice',
      payload: {
        sourceKey: `project_${p.id}_${Date.now()}`,
        customerId: p.customerId,
        projectId: p.id,
        rows: [{ description: `${p.name}, ${formatHours(hours)} ${tr('ui.h')}`, qty: hours, unitPrice: Number(p.hourlyRate) || 0, vatRate: 25, discount: 0, account: '3001' }],
      },
    }, 'invoices');
  };

  const activeProjects = projects.filter(p => p.status !== 'finished');
  const departmentNames = Array.from(new Set(projects.map(p => p.department).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv'));
  const visibleProjects = [...activeProjects, ...projects.filter(p => p.status === 'finished')].filter(p => {
    if (statusFilter === 'active' && p.status === 'finished') return false;
    if (statusFilter === 'archived' && p.status !== 'finished') return false;
    if (departmentFilter && p.department !== departmentFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.customerName.toLowerCase().includes(s) && !(p.department || '').toLowerCase().includes(s) && !(p.projectNumber || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });
  const atRisk = activeProjects.filter(p => p.budgetHours && p.hours / p.budgetHours >= 0.8);
  const sum = (list, f) => list.reduce((s, p) => s + f(p), 0);
  const totals = {
    hours: sum(activeProjects, p => p.hours),
    budget: sum(activeProjects, p => p.budgetHours),
    revenue: sum(activeProjects, p => p.revenue),
    cost: sum(activeProjects, p => p.cost),
    unbilledHours: sum(activeProjects, p => p.unbilledHours),
    unbilledValue: sum(activeProjects, p => p.unbilledHours * (Number(p.hourlyRate) || 0)),
  };
  const openProject = openProjectId ? projects.find(p => p.id === openProjectId) : null;
  const palette = usePalette();

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title={tr('ui.projekt')}
        actions={[{ key: 'new', label: tr('ui.nytt_projekt'), icon: Plus, onClick: openNewProjectForm, variant: 'primary', dataTour: 'page-projects-cta' }]}
        tabs={{ items: [{ id: 'projects', label: tr('ui.projekt') }, { id: 'time', label: tr('ui.tidrapportering') }], activeId: activeTab, onChange: handleSetTab }}
      />

      {activeTab === 'projects' && !openProject && projects.length > 0 && (
        <ListFilterBar>
          <div className="ws-seg">
            {[{ id: 'active', label: tr('proj.ongoing') }, { id: 'archived', label: tr('proj.finished') }, { id: 'all', label: tr('ui.alla') }].map(f => (
              <button key={f.id} type="button" className={statusFilter === f.id ? 'on' : ''} onClick={() => setStatusFilter(f.id)}>{f.label}</button>
            ))}
          </div>
          {departmentNames.length > 0 && (
            <select className="ws-input" style={{ width: 'auto', height: '34px' }} value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
              <option value="">{tr('ui.alla_avdelningar')}</option>
              {departmentNames.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px', maxWidth: '320px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="ws-input" style={{ height: '34px', paddingLeft: '32px', fontSize: '13px' }} placeholder={tr('ui.sok_projekt_eller_kund')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </ListFilterBar>
      )}

      {activeTab === 'time' && (
        <ListFilterBar>
          <div className="ws-seg">
            {[{ id: 'week', label: tr('ui.vecka') }, { id: 'reports', label: tr('proj.monthReports') }].map(x => (
              <button key={x.id} type="button" className={timeSubTab === x.id ? 'on' : ''} onClick={() => setTimeSubTab(x.id)}>{x.label}</button>
            ))}
          </div>
          {timeSubTab === 'week' && people.length > 1 && (
            <select className="ws-input" style={{ width: 'auto', height: '34px', fontWeight: 600 }} value={timePersonId} onChange={e => setTimePersonId(e.target.value)} aria-label={tr('ui.person')}>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </ListFilterBar>
      )}

      {activeTab === 'projects' && openProject && (
        <ProjectDetail
          project={openProject} timeEntries={timeEntries} setTimeEntries={setTimeEntries} setProjects={setProjects}
          invoices={invoices} expenses={expenses} people={people}
          onBack={() => setOpenProjectId(null)} onEdit={() => openEditForm(openProject)} onDelete={() => deleteProject(openProject)}
          onInvoice={onAction ? invoiceTime : null}
        />
      )}

      {activeTab === 'projects' && !openProject && (
        projects.length === 0 ? (
          <div className="ws-page">
            <div className="ws-card ws-empty">
              <h3>{tr('ui.skapa_ditt_forsta_projekt')}</h3>
              <p>{tr('ui.folj_upp_tid_och_lonsamhet_genom_att_skapa_ditt')}</p>
              <button type="button" className="agi-btn primary" onClick={openNewProjectForm}><Plus size={14} /> {tr('ui.nytt_projekt')}</button>
            </div>
          </div>
        ) : (
          <div className="ws-page">
            <Panel title={tr('proj.overview')} sub={tr('proj.overviewSub', { n: activeProjects.length })}>
              <KpiGrid>
                <Kpi dot={palette.income} label={tr('proj.toInvoice')} value={formatSEK(totals.unbilledValue)} sub={totals.unbilledHours > 0 ? tr('proj.toInvoiceSub', { h: formatHours(totals.unbilledHours) }) : tr('proj.allBilled')} />
                <Kpi dot={palette.profit} label={tr('ui.nedlagd_tid')} value={`${formatHours(totals.hours)} ${tr('ui.h')}`} sub={totals.budget ? tr('proj.ofBudget', { h: formatHours(totals.budget) }) : tr('ui.ingen_budget_satt')} />
                <Kpi dot={palette.income} label={tr('ui.fakturerat')} value={formatSEK(totals.revenue)} sub={tr('proj.exVat')} />
                <Kpi dot={totals.revenue - totals.cost < 0 ? palette.loss : palette.profit} label={tr('proj.result')} value={formatSEK(totals.revenue - totals.cost)} negative={totals.revenue - totals.cost < 0} sub={tr('proj.costs', { kr: formatSEK(totals.cost) })} />
              </KpiGrid>
            </Panel>

            {atRisk.length > 0 && (
              <div className="ws-notice warn">
                <div><strong>{tr('proj.atRisk', { n: atRisk.length })}</strong><p>{atRisk.map(p => p.name).join(', ')}</p></div>
              </div>
            )}

            <Panel
              title={statusFilter === 'archived' ? tr('proj.finished') : statusFilter === 'all' ? tr('proj.allProjects') : tr('proj.ongoingProjects')}
              actions={<div className="ws-seg">
                <button type="button" className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>{tr('proj.viewCards')}</button>
                <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>{tr('proj.viewList')}</button>
              </div>}
            >
            {view === 'cards' ? (
              <div className="pj-grid">
                {visibleProjects.map(p => {
                  const color = p.status === 'finished' ? 'var(--text-muted)' : (p.color || BRAND.green);
                  const pct = p.budgetHours ? (p.hours / p.budgetHours) * 100 : null;
                  const profit = p.revenue - p.cost;
                  return (
                    <button key={p.id} type="button" className={`pj-card${p.status === 'finished' ? ' done' : ''}`} style={{ '--pj': pct != null && pct > 100 ? 'var(--status-red-text)' : pct != null && pct >= 80 ? 'var(--status-amber-text)' : palette.profit }} onClick={() => setOpenProjectId(p.id)}>
                      <div className="pj-card-top">
                        <span className="pj-card-num">{p.projectNumber}</span>
                        {statusPill(p)}
                      </div>
                      <h3 className="pj-card-name"><i className="dash-kpi-dot" style={{ background: color }} aria-hidden="true" />{p.name}</h3>
                      <p className="pj-card-customer">{p.customerName || tr('proj.internal')}{p.department ? ` · ${p.department}` : ''}</p>
                      <div className="pj-card-hours">
                        <span><b>{formatHours(p.hours)}</b> {pct != null ? `${tr('ui.av')} ${formatHours(p.budgetHours)} ${tr('ui.h')}` : tr('ui.h')}</span>
                        {pct != null && <span className={`pj-card-pct${pct > 100 ? ' over' : pct >= 80 ? ' warn' : ''}`}>{Math.round(pct)} %</span>}
                      </div>
                      <div className="pj-card-track"><span style={{ width: `${pct != null ? Math.min(pct, 100) : 0}%` }} /></div>
                      <div className="pj-card-money">
                        <div><span>{tr('ui.fakturerat')}</span><b>{formatSEK(p.revenue)}</b></div>
                        <div><span>{tr('proj.result')}</span><b className={profit < 0 ? 'neg' : ''}>{formatSEK(profit)}</b></div>
                      </div>
                      {p.unbilledHours > 0 && p.status !== 'finished' && (
                        <div className="pj-card-unbilled">{tr('proj.unbilled', { h: formatHours(p.unbilledHours) })}{Number(p.hourlyRate) > 0 ? ` · ${formatSEK(p.unbilledHours * Number(p.hourlyRate))}` : ''}</div>
                      )}
                    </button>
                  );
                })}
                {statusFilter !== 'archived' && !searchTerm && (
                  <button type="button" className="pj-card pj-card-new" onClick={openNewProjectForm}>
                    <Plus size={20} />
                    <span>{tr('ui.nytt_projekt')}</span>
                  </button>
                )}
                {visibleProjects.length === 0 && (searchTerm || statusFilter === 'archived') && (
                  <p className="ws-hint">{searchTerm || departmentFilter ? tr('ui.inga_projekt_hittades_med_de_filtren') : tr('ui.inga_arkiverade_projekt_annu')}</p>
                )}
              </div>
            ) : (
            <div className="wsp-flush">
              <ListTable
                bordered={false}
                rowKey={p => p.id}
                rows={visibleProjects}
                onRowClick={p => setOpenProjectId(p.id)}
                rowStyle={p => (p.status === 'finished' ? { opacity: 0.65 } : {})}
                emptyMessage={
                  searchTerm || departmentFilter ? tr('ui.inga_projekt_hittades_med_de_filtren')
                    : statusFilter === 'archived' ? tr('ui.inga_arkiverade_projekt_annu')
                      : statusFilter === 'active' ? tr('ui.inga_aktiva_projekt_just_nu')
                        : tr('ui.inga_projekt_annu')
                }
                mobileList={p => ({
                  dot: p.status === 'finished' ? 'var(--text-muted)' : (p.color || BRAND.green),
                  primary: p.name,
                  amount: <span style={{ color: p.revenue - p.cost >= 0 ? 'var(--text-main)' : 'var(--status-red-text)' }}>{formatSEK(p.revenue - p.cost)}</span>,
                  meta: [p.customerName, p.budgetHours ? `${formatHours(p.hours)} ${tr('ui.av')} ${formatHours(p.budgetHours)} h` : `${formatHours(p.hours)} h`].filter(Boolean).join(' · '),
                  pill: statusPill(p),
                })}
                columns={[
                  {
                    key: 'project', label: tr('ui.projekt'), render: p => (
                      <div className="ws-name">
                        <span className="ws-dot" style={{ background: p.status === 'finished' ? 'var(--text-muted)' : (p.color || BRAND.green) }} />
                        <div className="ws-name-text">
                          <strong>{p.name}</strong>
                          <small>{[p.projectNumber, p.customerName || tr('proj.internal'), p.department].filter(Boolean).join(' · ')}</small>
                        </div>
                      </div>
                    ),
                  },
                  { key: 'time', label: tr('ui.tid'), width: 170, render: p => <TimeBar spent={p.hours} budget={p.budgetHours} /> },
                  { key: 'revenue', label: tr('ui.fakturerat'), align: 'right', render: p => formatSEK(p.revenue) },
                  { key: 'cost', label: tr('ui.kostnader'), align: 'right', render: p => formatSEK(p.cost) },
                  { key: 'profit', label: tr('proj.result'), align: 'right', fontWeight: 700, render: p => <span style={{ color: p.revenue - p.cost >= 0 ? 'var(--text-main)' : 'var(--status-red-text)' }}>{formatSEK(p.revenue - p.cost)}</span> },
                  { key: 'status', label: '', align: 'right', render: p => statusPill(p) },
                ]}
              />
            </div>
            )}
            </Panel>
          </div>
        )
      )}

      {activeTab === 'time' && (
        <div className="ws-page">
          {timeSubTab === 'week' ? (
            <WeekSheet
              projects={projects} timeEntries={timeEntries} setTimeEntries={setTimeEntries} setProjects={setProjects}
              personId={timePersonId} weekStart={timeWeekStart} prevWeekTotal={prevWeekTotal}
              onPrevWeek={() => setTimeWeekStart(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
              onNextWeek={() => setTimeWeekStart(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
              onThisWeek={() => setTimeWeekStart(getStartOfWeek(new Date()))}
            />
          ) : (
            <TimeReportsView
              timeEntries={timeEntries} employees={employees} projects={projects} timeReportStatuses={timeReportStatuses} setTimeReportStatuses={setTimeReportStatuses} month={timeMonth}
              onPickMonth={setTimeMonth}
              onPrevMonth={() => setTimeMonth(m => shiftMonthKey(m, -1))}
              onNextMonth={() => setTimeMonth(m => shiftMonthKey(m, 1))}
              onThisMonth={() => setTimeMonth(getMonthKey(getISODate(new Date())))}
            />
          )}
        </div>
      )}

      {projectForm && (
        <div className="modal-overlay" onClick={() => setProjectForm(null)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? tr('proj.editProject') : tr('ui.nytt_projekt')}</h2>
              <button type="button" className="modal-close" data-tour="page-projects-cancel" onClick={() => setProjectForm(null)}><X size={18} /></button>
            </div>
            <form className="ws-form" onSubmit={handleSaveProject}>
              <div>
                <label className="ws-label">{tr('ui.namn_2')}</label>
                <input data-tour="page-projects-field" className="ws-input" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} placeholder={tr('ui.t_ex_kontorsrenovering_2026')} required autoFocus />
              </div>
              <div>
                <label className="ws-label">{tr('ui.kund')}</label>
                <EntitySearch
                  value={projectForm.customerId}
                  onChange={id => setProjectForm(f => ({ ...f, customerId: id }))}
                  items={contacts.filter(c => c.type === 'customer' || !c.type)}
                  placeholder={tr('proj.noCustomer')}
                  onCreateNew={handleCreateCustomerInline}
                  createLabel={tr('proj.createCustomer')}
                />
              </div>
              <div className="ws-grid2">
                <div>
                  <label className="ws-label">{tr('ui.timpris_kr')}</label>
                  <div className="ws-input-suffix"><input type="number" min="0" className="ws-input" value={projectForm.hourlyRate} onChange={e => setProjectForm(f => ({ ...f, hourlyRate: e.target.value }))} /><span>kr</span></div>
                </div>
                <div>
                  <label className="ws-label">{tr('proj.budgetHours')}</label>
                  <div className="ws-input-suffix"><input type="number" min="0" className="ws-input" value={projectForm.budgetHours} onChange={e => setProjectForm(f => ({ ...f, budgetHours: e.target.value }))} /><span>h</span></div>
                </div>
              </div>
              {Number(projectForm.budgetHours) > 0 && Number(projectForm.hourlyRate) > 0 && (
                <p className="ws-hint" style={{ marginTop: '-6px' }}>{tr('ui.budgeterat_varde')}: <strong style={{ color: 'var(--text-main)' }}>{formatSEK(Number(projectForm.budgetHours) * Number(projectForm.hourlyRate))}</strong></p>
              )}
              <div className="ws-grid2">
                <div><label className="ws-label">{tr('ui.startdatum')}</label><input type="date" className="ws-input" value={projectForm.startDate} onChange={e => setProjectForm(f => ({ ...f, startDate: e.target.value }))} /></div>
                <div><label className="ws-label">{tr('ui.slutdatum')}</label><input type="date" className="ws-input" value={projectForm.endDate} onChange={e => setProjectForm(f => ({ ...f, endDate: e.target.value }))} /></div>
              </div>
              <div>
                <label className="ws-label">{tr('ui.beskrivning')}</label>
                <textarea className="ws-input" value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} placeholder={tr('ui.kort_om_vad_projektet_handlar_om_valfritt')} />
              </div>
              <div className="ws-grid2">
                <div>
                  <label className="ws-label">{tr('ui.avdelning')}</label>
                  {isAddingDepartment ? (
                    <input className="ws-input" autoFocus value={projectForm.department} placeholder={tr('ui.namnge_avdelningen')}
                      onChange={e => setProjectForm(f => ({ ...f, department: e.target.value }))}
                      onBlur={() => { if (!projectForm.department) setIsAddingDepartment(false); }} />
                  ) : (
                    <select className="ws-input" value={projectForm.department} onChange={e => {
                      if (e.target.value === '__new__') { setIsAddingDepartment(true); setProjectForm(f => ({ ...f, department: '' })); }
                      else setProjectForm(f => ({ ...f, department: e.target.value }));
                    }}>
                      <option value="">{tr('ui.ingen_2')}</option>
                      {departmentNames.map(d => <option key={d} value={d}>{d}</option>)}
                      <option value="__new__">{tr('ui.ny_avdelning')}</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="ws-label">{tr('ui.farg')}</label>
                  <div className="pj-colors" style={{ paddingTop: '6px' }}>
                    {PROJECT_COLORS.map(c => (
                      <button key={c} type="button" className={projectForm.color === c ? 'on' : ''} style={{ background: c }} aria-label={tr('ui.valj_fargen', { c })} onClick={() => setProjectForm(f => ({ ...f, color: c }))} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: 0 }}>
                <button type="button" className="agi-btn" onClick={() => setProjectForm(null)}>{tr('ui.avbryt')}</button>
                <button type="submit" className="agi-btn primary" disabled={!projectForm.name.trim()}>{editingId ? tr('ui.spara') : tr('ui.skapa_projekt')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
