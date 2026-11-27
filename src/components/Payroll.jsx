import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, UsersRound, UserCog, CalendarClock, Search, Palmtree, Download, Upload, Landmark, X } from './icons';
import EmployeeImportModal from './EmployeeImportModal';
import FosModal from './FosModal';
import { downloadCsv } from '../utils/csvRegister';
import { employeesToCsv } from '../utils/employeeCsv';
import VacationOverview from './VacationOverview';
import EmployeeForm from './EmployeeForm';
import PayrollRunDetail from './PayrollRunDetail';
import ListPageHeader, { ListFilterBar, listSearchInputStyle, listHeaderButtonStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import ListSettings, { useListPrefs } from './shared/ListSettings';
import { BRAND } from '../utils/brandColors';
import { t, dateLocale } from '../i18n';
import { computeEmployeePayroll, summarizePayrollRun } from '../utils/payrollCalculation';
import { agiDueDate, daysFromToday } from '../utils/declarationDeadlines';
import { MobileFormMode } from './shared/MobileForm';
import { numberFormat, dateTimeFormat } from '../utils/intlCache';

const formatSEK = (val) => numberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const inputSt = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const panelCard = { background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', overflow: 'hidden' };

export default function Payroll({
  company, activeCompanyId, employees = [], onSaveEmployee, onImportEmployees, onApplyFos, onSyncBeforeServerCall, accounts = [], projects = [],
  payrollRuns = [], onCreateRun, onUpdateRunRow, onUpdateRun, onSetRunIncluded, onAdvanceRunStep, onBookRun, onMarkRunPaid, onDeleteRun, onRefreshRunSnapshots, agiReports = [],
  outlays = [],
}) {
  const [activeTab, setActiveTab] = useState(() => (employees.length > 0 ? 'runs' : 'employees'));
  const [search, setSearch] = useState('');
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [viewState, setViewState] = useState('list'); // 'list' | 'new' | 'edit'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  // Öppnad från en lönekörning: Spara och Tillbaka går tillbaka dit.
  const [returnRunId, setReturnRunId] = useState(null);

  const [showNewRun, setShowNewRun] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFos, setShowFos] = useState(false);
  // { count, missing } direkt efter en import av anställda: visar nästa steg.
  const [afterImport, setAfterImport] = useState(null);
  const [newRunPeriod, setNewRunPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [newRunPayDate, setNewRunPayDate] = useState('');
  // Inställningar som i Kunder och Offerter (2026-11-26): import, export och
  // skattetabeller bakom kugghjulet, plus kolumner och radstorlek för listan.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lp, setLp] = useListPrefs('bokix.employees.prefs', { type: true, startDate: true, salary: true, status: true, email: false });

  const filteredEmployees = employees.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${e.firstName} ${e.lastName}`.toLowerCase().includes(s);
  });

  const handleSaveEmployee = (data) => {
    onSaveEmployee(viewState === 'edit' ? selectedEmployee.id : null, data);
    closeEmployeeForm();
  };
  const closeEmployeeForm = () => {
    setViewState('list');
    setSelectedEmployee(null);
    if (returnRunId) { setActiveTab('runs'); setSelectedRunId(returnRunId); setReturnRunId(null); }
  };

  const sortedRuns = [...payrollRuns].sort((a, b) => b.period.localeCompare(a.period));
  // Årsvyn: bara månader som har en lönekörning (gjord eller importerad).
  // Månader utan lön visas inte, utom innevarande månad som en rad för att
  // skapa månadens lönekörning.
  const thisYear = new Date().getFullYear();
  const runYears = [...new Set([thisYear, ...payrollRuns.map(r => Number(String(r.period).slice(0, 4))).filter(Boolean)])].sort((a, b) => b - a);
  const shownYear = runYears.includes(runYear) ? runYear : thisYear;
  const yearRuns = sortedRuns.filter(r => String(r.period).startsWith(`${shownYear}-`));
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const filteredRuns = yearRuns.map(run => ({ key: run.id, period: run.period, run }));
  // Månaden utan lönekörning visas som ett kort ovanför listan, inte som en
  // tom rad i den (2026-11-22: såg ut som en körning som redan fanns).
  const runGross = (run) => {
    try {
      return summarizePayrollRun(run.rows.map(row => computeEmployeePayroll(row.employeeSnapshot || {}, row))).gross;
    } catch { return null; }
  };
  const fmtShortDate = (d) => dateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' }).format(d);
  const agiInfo = (row) => {
    const due = agiDueDate(row.period);
    const report = agiReports.find(r => r.period === row.period);
    // Inlämnad om AGI-rapporten är markerad, eller om steget bockats av i lönekörningen.
    const submitted = report?.status === 'submitted' || Boolean(row.run?.completedSteps?.includes('agi'));
    return { due, submitted, daysLeft: daysFromToday(due) };
  };
  const monthName = (period) => {
    const name = dateTimeFormat(dateLocale(), { month: 'long' }).format(new Date(`${period}-01T12:00:00`));
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const runStatus = (r) => r.completedSteps.includes('booked') ? t('ui.bokford') : (r.completedSteps.includes('calculated') ? t('ui.bokforda_status_berakn') : t('ui.utkast'));
  const runTone = (status) => status === t('ui.bokford') ? { bg: 'var(--status-green-bg)', color: 'var(--status-green-text)' } : status === t('ui.bokforda_status_berakn') ? { bg: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' } : { bg: 'var(--border-light)', color: 'var(--text-secondary)' };
  const agiCell = (row) => {
    if (!row.run) return <span style={{ color: 'var(--text-muted)' }}>–</span>;
    const a = agiInfo(row);
    if (a.submitted) return <span style={{ color: 'var(--status-green-text)', fontWeight: 600 }}>{t('payrollYear.submitted')}</span>;
    const color = a.daysLeft < 0 ? 'var(--status-red-text)' : a.daysLeft <= 7 ? 'var(--status-amber-text)' : 'var(--text-main)';
    return <span style={{ color, fontWeight: a.daysLeft <= 7 ? 600 : 400 }}>{t('payrollYear.due', { date: fmtShortDate(a.due) })}</span>;
  };
  const openRow = (row) => {
    if (row.run) { setSelectedRunId(row.run.id); return; }
    if (employees.length === 0) { setActiveTab('employees'); setViewState('new'); return; }
    setNewRunPeriod(row.period);
    setNewRunPayDate(`${row.period}-25`);
    setShowNewRun(true);
  };
  const selectedRun = payrollRuns.find(r => r.id === selectedRunId);
  const selectedRunIndex = sortedRuns.findIndex(r => r.id === selectedRunId);
  const previousRun = selectedRunIndex >= 0 ? sortedRuns[selectedRunIndex + 1] : null;

  const activeEmployeesForPeriod = employees.filter(e => !e.endDate || e.endDate >= newRunPeriod + '-01');
  // Kundens egen skärmdump visade tre identiska "Lönekörning 2026-08"-
  // utkast — inget skydd mot att av misstag skapa flera körningar för
  // samma period fanns. Varnar (blockerar inte, en avsiktlig andra
  // körning kan vara legitim, t.ex. en rättelse) precis innan man skapar.
  const existingRunForPeriod = payrollRuns.find(r => r.period === newRunPeriod);

  const handleCreateRun = () => {
    if (activeEmployeesForPeriod.length === 0) return; // extra skydd, knappen är redan spärrad
    const runId = onCreateRun({ period: newRunPeriod, payDate: newRunPayDate, employees: activeEmployeesForPeriod, parkHourly: Boolean(onSetRunIncluded) });
    setShowNewRun(false);
    setSelectedRunId(runId);
  };

  if (selectedRun) {
    // Kundfeedback ("täcker inte hela och är inte i toppen"): den här
    // vyn låg tidigare i en paddad, centrerad ö (padding 32px 40px) helt
    // utan sidhuvud — se filkommentaren i PayrollRunDetail.jsx. Den äger nu
    // sitt eget fullbredds-skal (ListPageHeader + scrollande innehåll),
    // samma mönster som listvyn nedan — ingen extra padding-wrapper här.
    return (
      <PayrollRunDetail
        run={selectedRun}
        previousRun={previousRun}
        allRuns={payrollRuns}
        outlays={outlays}
        onSyncBeforeServerCall={onSyncBeforeServerCall}
        accounts={accounts}
        company={company}
        companyId={activeCompanyId || company?.id}
        onBack={() => setSelectedRunId(null)}
        onAdvanceStep={onAdvanceRunStep}
        onBookRun={onBookRun}
        onMarkPaid={onMarkRunPaid}
        onDelete={onDeleteRun ? async () => { if (await onDeleteRun(selectedRun.id)) setSelectedRunId(null); } : undefined}
        onUpdateRow={(employeeId, patch) => onUpdateRunRow(selectedRun.id, employeeId, patch)}
        onUpdateRun={(patch) => onUpdateRun?.(selectedRun.id, patch)}
        employees={employees}
        onSetIncluded={onSetRunIncluded ? (emp, included, opts = {}) => onSetRunIncluded(selectedRun.id, emp, included, { ...opts, orderIds: employees.map(e => e.id) }) : undefined}
        onRefreshSnapshots={() => onRefreshRunSnapshots?.(selectedRun.id, employees)}
        onOpenEmployee={(id) => { const emp = employees.find(e => e.id === id); if (!emp) return; setReturnRunId(selectedRun.id); setSelectedRunId(null); setActiveTab('employees'); setSelectedEmployee(emp); setViewState('edit'); }}
      />
    );
  }

  // 2026-11-22: årsväljaren (‹ 2026 ›) och årets lönesumma står i sidhuvudet
  // bredvid Ny lönekörning, inte på en egen rad med tom yta.
  const yearPicker = (
    <div className="pay-yearbar">
      <div className="pay-year" role="group" aria-label={t('payrollYear.year')}>
        <button type="button" aria-label={String(shownYear - 1)} disabled={!runYears.some(y => y < shownYear)} onClick={() => setRunYear(Math.max(...runYears.filter(y => y < shownYear)))}><ChevronLeft size={16} /></button>
        <strong>{shownYear}</strong>
        <button type="button" aria-label={String(shownYear + 1)} disabled={!runYears.some(y => y > shownYear)} onClick={() => setRunYear(Math.min(...runYears.filter(y => y > shownYear)))}><ChevronRight size={16} /></button>
      </div>
    </div>
  );

  const openNewEmployee = () => { setActiveTab('employees'); setSelectedEmployee(null); setViewState('new'); };
  const openNewRun = () => { if (employees.length === 0) { openNewEmployee(); } else { if (!newRunPayDate) setNewRunPayDate(`${newRunPeriod}-25`); setShowNewRun(true); } };
  const settingsActions = [
    activeTab !== 'employees'
      ? { key: 'new-run', label: t('ui.ny_lonekorning'), icon: Plus, onClick: openNewRun }
      : { key: 'new-employee', label: t('ui.ny_anstalld'), icon: Plus, onClick: openNewEmployee },
    ...(onApplyFos ? [{ key: 'fos', label: t('fos.button'), icon: Landmark, onClick: () => setShowFos(true), disabled: employees.length === 0 }] : []),
    ...(onImportEmployees ? [{ key: 'import-employees', label: t('employeeImport.import_button'), icon: Upload, onClick: () => setShowImport(true) }] : []),
    { key: 'export-employees', label: t('employeeImport.export_button'), icon: Download, onClick: () => downloadCsv(`anstallda_${new Date().toISOString().slice(0, 10)}.csv`, employeesToCsv(employees)), disabled: employees.length === 0 },
    // Semester ligger i panelen i stället för som en egen flik (2026-11-26),
    // så att flikarna får plats på en rad på telefon.
    ...(activeTab !== 'vacation' ? [{ key: 'vacation', label: t('ui.semester'), icon: Palmtree, onClick: () => { setActiveTab('vacation'); setViewState('list'); setSelectedEmployee(null); } }] : []),
  ];
  // Kugghjulet står bredvid rubriken på alla tre flikarna (2026-11-26).
  const showGear = viewState === 'list';
  const compact = lp.density === 'compact';

  return (
    <div className={viewState === 'list' && lp.width === 'narrow' ? 'lt-page-narrow' : undefined} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      {/* Header i samma mönster som Kunder/Bokföring/Skatt och bokslut
          (kort-bakgrund + kantlinje, inte flytande text på sidbakgrunden)
          — se motsvarande kommentar i Contacts.jsx. */}
      <ListPageHeader
        title={t('ui.anstallda_och_lon')}
        onSettings={showGear ? () => setSettingsOpen(true) : null}
        titleExtra={activeTab === 'runs' && viewState === 'list' ? yearPicker : null}
        actions={
          activeTab === 'employees' && viewState === 'list'
            ? [
                { key: 'new-employee', label: t('ui.ny_anstalld'), icon: Plus, onClick: openNewEmployee, variant: 'primary' },
              ]
            : activeTab === 'runs'
              ? [{
                  key: 'new-run', label: t('ui.ny_lonekorning'), icon: Plus, variant: 'primary',
                  onClick: openNewRun,
                  title: employees.length === 0 ? t('ui.lagg_till_en_anstalld_forst') : undefined,
                }]
              : []
        }
        tabs={{
          items: [
            { id: 'runs', label: t('ui.lonekorningar'), icon: CalendarClock },
            { id: 'employees', label: t('ui.anstallda'), icon: UserCog },
            // Semestersaldon hör hemma bredvid lönekörningarna och inte inne
            // i en enskild anställd: frågan "hur mycket semester ligger vi på"
            // är en företagsfråga (och en balanspost), inte en personalfråga.
            // Bara medan man står i Semester (öppnas från kugghjulet).
            ...(activeTab === 'vacation' ? [{ id: 'vacation', label: t('ui.semester'), icon: Palmtree }] : []),
          ],
          activeId: activeTab,
          onChange: (id) => { setActiveTab(id); setViewState('list'); setSelectedEmployee(null); setReturnRunId(null); },
        }}
      />
      {/* Sökfältet ligger kvar i samma kort som resten av sidhuvudet
          (ListFilterBar, direkt under flikraden) — precis som Bokförings
          filterrad, istället för att flyta löst på sidbakgrunden under
          kortet. Kundfeedback ("gör lönekörningar mer som anställda"):
          Lönekörningar-fliken saknade den här raden helt, till skillnad
          från Anställda — samma ListFilterBar/sökfält-mönster nu på båda. */}
      {activeTab === 'employees' && viewState === 'list' && (
        <ListFilterBar>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="search" placeholder={t('ui.sok_anstalld')} value={search} onChange={e => setSearch(e.target.value)} style={listSearchInputStyle} />
          </div>
        </ListFilterBar>
      )}
      {showGear && (
        <ListSettings
          open={settingsOpen} onClose={() => setSettingsOpen(false)} prefs={lp} onChange={setLp}
          actions={settingsActions}
          showPerPage={activeTab === 'employees'}
          columns={activeTab === 'employees' ? [
            { key: 'type', label: t('ui.typ') },
            { key: 'startDate', label: t('ui.anstallningsdatum_2') },
            { key: 'salary', label: t('ui.lon') },
            { key: 'email', label: t('so.email') },
            { key: 'status', label: t('ui.status') },
          ] : []}
        />
      )}

      {/* Ingen padding på den yttre raden längre — matchar "facit"
          (Bokföring/Verifikationer): tabellen (nedan) ska sitta flush
          direkt under filterraden istället för att flyta i ett paddat
          25px-kort. De andra grenarna (tomt-läge/formulär/lönekörningar)
          har sin egen lokala padding, de är fristående kort/paneler. */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {activeTab === 'employees' && viewState === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Nästa steg direkt efter en import: skattetabellerna från
              Skatteverket, så att första lönekörningen drar rätt skatt. */}
          {afterImport && onApplyFos && employees.length > 0 && (
            <div role="status" style={{ margin: '14px 20px 0', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)', display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{t('employeeImport.next_title', { count: afterImport.count })}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.5 }}>
                  {afterImport.missing > 0 ? t('employeeImport.next_text_missing', { missing: afterImport.missing }) : t('employeeImport.next_text')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setAfterImport(null)} style={{ ...listHeaderButtonStyle('secondary') }}>{t('ui.sie_inte_nu')}</button>
                <button type="button" onClick={() => { setAfterImport(null); setShowFos(true); }} style={{ ...listHeaderButtonStyle('primary') }}>{t('fos.button')}</button>
              </div>
            </div>
          )}
          {/* Kundfeedback ("white space"-genomgången): en tom lista visade
              tidigare bara en paddad tabellrad, utan egen höjd att centrera
              sig i — samma fix som Quotes.jsx/Contacts.jsx: tomt-läge som
              ett eget flex:1-block istället för en tabellrad. */}
          {filteredEmployees.length === 0 ? (
            // Kundönskemål ("Fakturor är det som ser bra ut"): ingen egen
            // marginal/kant/skugga längre — fyller ytan flush i stället för
            // att sväva som ett eget litet kort med synligt mellanrum runt om.
            <div style={{ flex: 1, minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', background: 'var(--bg-card)' }}>
              <div style={{ width: 72, height: 72, borderRadius: '20px', background: 'var(--bg-muted)', color: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                <UsersRound size={30} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                {employees.length === 0 ? t('ui.inga_anstallda_registrerade') : t('ui.ingen_matchade_sokningen_2')}
              </div>
              {employees.length === 0 && (
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0 0 18px' }}>
                  {t('ui.lagg_till_din_forsta_anstalld_for_att_kunna_kora')}
                </p>
              )}
              {employees.length === 0 && (
                <button onClick={() => { setSelectedEmployee(null); setViewState('new'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={16} /> {t('ui.ny_anstalld')}
                </button>
              )}
            </div>
          ) : (
          /* Kundfeedback: en populerad (om än kort) lista ska inte
             centreras lodrätt — bara det helt tomma läget ovan. */
          <div className={lp.density === 'compact' ? 'lt-compact' : undefined} style={{ width: '100%' }}>
          <ListTable
            pageSize={lp.pageSize}
            rowKey={e => e.id}
            onRowClick={e => { setSelectedEmployee(e); setViewState('edit'); }}
            rows={filteredEmployees}
            mobileList={e => {
              const isActive = !e.endDate || e.endDate >= new Date().toISOString().slice(0, 10);
              const typeLabel = e.employmentType === 'foretagsledare' ? t('ui.foretagsledare') : e.employmentType === 'styrelseledamot' ? 'Styrelseledamot' : t('ui.anstalld');
              return {
                dot: isActive ? 'var(--status-green-text)' : 'var(--text-muted)',
                primary: `${e.firstName} ${e.lastName}`,
                amount: e.salaryForm === 'timlon' ? `${e.hourlyRate || 0} kr/tim` : formatSEK(e.monthlySalary),
                meta: `${typeLabel}${e.startDate ? ` · sedan ${e.startDate}` : ''}`,
                pill: (
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: isActive ? 'var(--status-green-bg)' : 'var(--border-light)', color: isActive ? 'var(--status-green-text)' : 'var(--text-secondary)' }}>
                    {isActive ? t('ui.aktiv') : t('ui.avslutad')}
                  </span>
                ),
              };
            }}
            columns={[
              { key: 'name', label: t('ui.namn'), fontWeight: 600, color: 'var(--text-main)', fontSize: '14px', render: e => `${e.firstName} ${e.lastName}` },
              { key: 'type', label: t('ui.typ'), color: 'var(--text-main)', fontSize: '14px', render: e => e.employmentType === 'foretagsledare' ? t('ui.foretagsledare') : e.employmentType === 'styrelseledamot' ? 'Styrelseledamot' : t('ui.anstalld') },
              { key: 'startDate', label: t('ui.anstallningsdatum_2'), render: e => e.startDate },
              { key: 'salary', label: t('ui.lon'), fontWeight: 600, color: 'var(--text-main)', render: e => e.salaryForm === 'timlon' ? `${e.hourlyRate || 0} kr/tim` : formatSEK(e.monthlySalary) },
              {
                key: 'status', label: t('ui.status'), render: e => {
                  const isActive = !e.endDate || e.endDate >= new Date().toISOString().slice(0, 10);
                  return (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: isActive ? 'var(--status-green-bg)' : 'var(--border-light)', color: isActive ? 'var(--status-green-text)' : 'var(--text-secondary)' }}>
                      {isActive ? t('ui.aktiv') : t('ui.avslutad')}
                    </span>
                  );
                },
              },
              { key: 'email', label: t('so.email'), render: e => e.email || '—' },
              { key: 'chevron', label: '', align: 'right', render: () => <ChevronRight size={16} color="var(--text-muted)" /> },
            ].filter(col => col.key === 'name' || col.key === 'chevron' || lp.cols[col.key])}
          />
          </div>
          )}
        </div>
      )}

      {activeTab === 'employees' && viewState !== 'list' && (
        <div className="mform-page" style={{ padding: '24px' }}>
          <MobileFormMode />
          <div className="mform-head" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <button className="mform-back" onClick={closeEmployeeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: 0 }}>
              <span className="mform-back-desk">{t('ui.tillbaka')}</span><span className="mform-back-phone">{t('ui.avbryt')}</span>
            </button>
            <span className="mform-sep" style={{ color: 'var(--border)' }}>|</span>
            <h2 className="mform-title" style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{viewState === 'new' ? t('ui.ny_anstalld') : t('ui.redigera_anstalld')}</h2>
          </div>
          <EmployeeForm
            initial={viewState === 'edit' ? selectedEmployee : null}
            projects={projects}
            payrollRuns={payrollRuns}
            onSave={handleSaveEmployee}
            onCancel={closeEmployeeForm}
            wizard
          />
        </div>
      )}

      {activeTab === 'vacation' && (
        <div className={compact ? 'lt-compact' : undefined} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <VacationOverview
          employees={employees}
          payrollRuns={payrollRuns}
          onSelectEmployee={(employee) => { setActiveTab('employees'); setSelectedEmployee(employee); setViewState('edit'); }}
          onOpenRuns={() => setActiveTab('runs')}
        />
        </div>
      )}

      {activeTab === 'runs' && (
        <div className={compact ? 'lt-compact' : undefined} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Kundfeedback ("samma vy som resten av sidorna, den ska täcka,
              inga spaces"): den här fliken låg tidigare hel i en padded
              24px-box, till skillnad från Anställda-fliken och "facit"-
              sidorna (Bokföring/Verifikationer) där tabellen sitter flush
              direkt under filterraden. Varning/formulär behåller sin egen
              marginal (de är fristående kort, inte tabellen), men
              ListTable nedan är nu flush precis som överallt annars. */}
          {showNewRun && (
            <div className="modal-overlay" onClick={() => setShowNewRun(false)}>
            <section className="modal-content payroll-newrun" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">{t('ui.ny_lonekorning')}</span>
                <button type="button" className="modal-close" onClick={() => setShowNewRun(false)} aria-label={t('ui.stang')}><X size={18} /></button>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t('payrollStages.newRunText')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: '0 1 200px', minWidth: '150px' }}>
                  <label style={labelSt}>{t('ui.period')}</label>
                  <input type="month" value={newRunPeriod} onChange={e => { setNewRunPeriod(e.target.value); if (e.target.value) setNewRunPayDate(`${e.target.value}-25`); }} style={{ ...inputSt, width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
                </div>
                <div style={{ flex: '0 1 200px', minWidth: '150px' }}>
                  <label style={labelSt}>{t('ui.utbetalningsdatum')}</label>
                  <input type="date" value={newRunPayDate} onChange={e => setNewRunPayDate(e.target.value)} style={{ ...inputSt, width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
                </div>
              </div>

              {activeEmployeesForPeriod.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--status-red-text)', marginBottom: '14px' }}>{t('ui.ingen_anstalld_ar_aktiv_under_vald_period_kontro')}</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-muted)', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {(() => { const n = onSetRunIncluded ? activeEmployeesForPeriod.filter(e => e.salaryForm !== 'timlon').length : activeEmployeesForPeriod.length; return t('ui.kommer_att_inkluderas_i_denna_korning', { length: n, v1: n === 1 ? 'anställd' : 'anställda' }); })()}
                    {onSetRunIncluded && activeEmployeesForPeriod.some(e => e.salaryForm === 'timlon') && (
                      <div style={{ fontWeight: 500, marginTop: '3px' }}>{t('payrollPick.newRunHint', { n: activeEmployeesForPeriod.filter(e => e.salaryForm === 'timlon').length })}</div>
                    )}
                  </div>
                  {activeEmployeesForPeriod.map(e => {
                    const hourly = e.salaryForm === 'timlon';
                    const pay = hourly ? `${numberFormat('sv-SE').format(Number(e.hourlyRate) || 0)} kr/tim` : `${numberFormat('sv-SE').format(Number(e.monthlySalary) || 0)} kr/mån`;
                    const missingTax = !e.secondaryIncome && !e.taxTable?.tabellnr;
                    return (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', borderTop: '1px solid var(--border-light)', fontSize: '13.5px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{e.firstName} {e.lastName}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                          {missingTax && <span style={{ fontSize: '12px', color: 'var(--status-amber-text)', fontWeight: 600 }}>{t('payrollStages.noTaxTable')}</span>}
                          {pay}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {existingRunForPeriod && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
                  {t('ui.det_finns_redan_en_lonekorning_for')} {newRunPeriod} ({existingRunForPeriod.completedSteps.includes('booked') ? t('ui.bokford_2') : existingRunForPeriod.completedSteps.includes('calculated') ? t('ui.beraknad') : t('ui.utkast_2')}{t('ui.fortsatt_bara_om_du_medvetet_vill_skapa_en_till')}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNewRun(false)} style={{ padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('ui.avbryt')}</button>
                <button onClick={handleCreateRun} disabled={activeEmployeesForPeriod.length === 0} style={{ padding: '10px 20px', background: activeEmployeesForPeriod.length ? 'var(--accent)' : 'var(--border)', color: activeEmployeesForPeriod.length ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: activeEmployeesForPeriod.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{t('payrollStages.createRun')}</button>
              </div>
            </section>
            </div>
          )}

          {/* Lönekörningar är tid, inte ett register (2026-11-27): året i
              korthet överst och en månadsruta per rad, så att fliken inte
              känns som Anställda. */}
          {filteredRuns.length > 0 ? (() => {
            const gross = filteredRuns.reduce((sum, r) => sum + (runGross(r.run) || 0), 0);
            const today = new Date().toISOString().slice(0, 10);
            const next = sortedRuns.filter(r => r.payDate && r.payDate >= today).sort((a, b) => String(a.payDate).localeCompare(String(b.payDate)))[0];
            return (
              <div className="pr-sum">
                <div><span>{t('payrollYear.sumGross', { year: shownYear })}</span><b>{formatSEK(gross)}</b></div>
                <div><span>{t('payrollYear.sumRuns')}</span><b>{filteredRuns.length}</b></div>
                <div><span>{t('payrollYear.sumNext')}</span><b>{next ? fmtShortDate(new Date(`${next.payDate}T12:00:00`)) : '–'}</b></div>
              </div>
            );
          })() : (
            <div className="pr-empty">
              <span className="pr-empty-ico"><CalendarClock size={26} /></span>
              <strong>{t('payrollYear.emptyTitle', { year: shownYear })}</strong>
              <p>{employees.length ? t('payrollYear.emptyText') : t('payrollYear.emptyNoEmp')}</p>
              <button type="button" className="pr-empty-btn" onClick={openNewRun}><Plus size={15} /> {employees.length ? t('ui.ny_lonekorning') : t('payrollYear.addEmployee')}</button>
            </div>
          )}
          {filteredRuns.length > 0 && <ListTable
            rowKey={r => r.key}
            onRowClick={openRow}
            // Utan anställda finns inget att köra: då visas tomt-läget med
            // uppmaningen att lägga till en anställd först.
            emptyMessage={(
              <div>
                <div>{t('ui.inga_tidigare_lonekorningar')}</div>
                {employees.length === 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
                    {t('ui.du_behover_lagga_till_minst_en_anstalld_innan_du')}
                  </div>
                )}
              </div>
            )}
            rows={filteredRuns}
            mobileList={row => {
              if (!row.run) return { dot: 'var(--border)', primary: monthName(row.period), meta: t('payrollYear.create'), amount: '' };
              const status = runStatus(row.run);
              const tone = runTone(status);
              const gross = runGross(row.run);
              const a = agiInfo(row);
              return {
                dot: tone.color,
                primary: monthName(row.period),
                amount: gross != null ? formatSEK(gross) : '',
                meta: [
                  row.run.payDate ? fmtShortDate(new Date(`${row.run.payDate}T12:00:00`)) : null,
                  a.submitted ? `AGI: ${t('payrollYear.submitted').toLowerCase()}` : `AGI ${t('payrollYear.due', { date: fmtShortDate(a.due) })}`,
                ].filter(Boolean).join(' · '),
                pill: <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: tone.bg, color: tone.color }}>{status}</span>,
              };
            }}
            columns={[
              { key: 'period', label: t('payrollYear.month'), fontWeight: 700, color: 'var(--text-main)', fontSize: '14px', render: row => (
                <span className="pr-month">
                  <span className="pr-month-tile" aria-hidden="true">
                    <b>{monthName(row.period).slice(0, 3).toUpperCase()}</b>
                    <small>{String(row.period).slice(0, 4)}</small>
                  </span>
                  <span style={{ color: row.run ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: row.run ? 700 : 500 }}>{monthName(row.period)}</span>
                </span>
              ) },
              { key: 'gross', label: t('payrollYear.gross'), color: 'var(--text-main)', fontSize: '14px', render: row => {
                if (!row.run) return <span style={{ color: 'var(--text-muted)' }}>–</span>;
                const gross = runGross(row.run);
                return <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{gross != null ? formatSEK(gross) : '–'}</span>;
              } },
              { key: 'payout', label: t('payrollYear.payout'), color: 'var(--text-main)', fontSize: '14px', render: row => row.run?.payDate ? fmtShortDate(new Date(`${row.run.payDate}T12:00:00`)) :<span style={{ color: 'var(--text-muted)' }}>–</span> },
              { key: 'agi', label: t('payrollYear.agi'), fontSize: '14px', render: agiCell },
              {
                key: 'status', label: t('payrollYear.status'), render: row => {
                  // Tidigare månader utan lön är bara tomma; innevarande och
                  // kommande månad erbjuder att skapa lönekörningen.
                  if (!row.run) return row.period >= new Date().toISOString().slice(0, 7)
                    ? <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--chip-active-text)' }}>{t('payrollYear.create')}</span>
                    : <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('payrollYear.noRun')}</span>;
                  const status = runStatus(row.run);
                  const tone = runTone(status);
                  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: tone.bg, color: tone.color }}>{status}</span>;
                },
              },
              { key: 'chevron', label: '', align: 'right', render: () => <ChevronRight size={16} color="var(--text-muted)" /> },
            ]}
          />}
        </div>
      )}
      </div>
      {showFos && (
        <FosModal company={company} employees={employees} onApply={onApplyFos} onClose={() => setShowFos(false)} />
      )}
      {showImport && (
        <EmployeeImportModal
          employees={employees}
          onImport={(rows) => {
            onImportEmployees(rows);
            setShowImport(false);
            setAfterImport({ count: rows.length, missing: rows.filter(r => r.needsTaxTable || !r.employee?.taxTable?.tabellnr).length });
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
