import React, { useState } from 'react';
import { Plus, ChevronRight, UsersRound, UserCog, CalendarClock, Search, Palmtree, Download, Upload, Landmark } from './icons';
import EmployeeImportModal from './EmployeeImportModal';
import FosModal from './FosModal';
import { downloadCsv } from '../utils/csvRegister';
import { employeesToCsv } from '../utils/employeeCsv';
import VacationOverview from './VacationOverview';
import EmployeeForm from './EmployeeForm';
import PayrollRunDetail from './PayrollRunDetail';
import ListPageHeader, { ListFilterBar, listSearchInputStyle, listHeaderButtonStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { BRAND } from '../utils/brandColors';
import { t } from '../i18n';
import { MobileFormMode } from './shared/MobileForm';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const inputSt = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const panelCard = { background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', overflow: 'hidden' };

export default function Payroll({
  company, employees = [], onSaveEmployee, onImportEmployees, onApplyFos, onSyncBeforeServerCall, accounts = [], projects = [],
  payrollRuns = [], onCreateRun, onUpdateRunRow, onAdvanceRunStep, onBookRun, onMarkRunPaid, onRefreshRunSnapshots,
}) {
  const [activeTab, setActiveTab] = useState('employees');
  const [search, setSearch] = useState('');
  const [runSearch, setRunSearch] = useState('');
  const [viewState, setViewState] = useState('list'); // 'list' | 'new' | 'edit'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);

  const [showNewRun, setShowNewRun] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFos, setShowFos] = useState(false);
  // { count, missing } direkt efter en import av anställda: visar nästa steg.
  const [afterImport, setAfterImport] = useState(null);
  const [newRunPeriod, setNewRunPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [newRunPayDate, setNewRunPayDate] = useState('');

  const filteredEmployees = employees.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${e.firstName} ${e.lastName}`.toLowerCase().includes(s);
  });

  const handleSaveEmployee = (data) => {
    onSaveEmployee(viewState === 'edit' ? selectedEmployee.id : null, data);
    setViewState('list');
    setSelectedEmployee(null);
  };

  const sortedRuns = [...payrollRuns].sort((a, b) => b.period.localeCompare(a.period));
  const filteredRuns = sortedRuns.filter(r => !runSearch || r.period.toLowerCase().includes(runSearch.toLowerCase()));
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
    const runId = onCreateRun({ period: newRunPeriod, payDate: newRunPayDate, employees: activeEmployeesForPeriod });
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
        onSyncBeforeServerCall={onSyncBeforeServerCall}
        accounts={accounts}
        company={company}
        onBack={() => setSelectedRunId(null)}
        onAdvanceStep={onAdvanceRunStep}
        onBookRun={onBookRun}
        onMarkPaid={onMarkRunPaid}
        onUpdateRow={(employeeId, patch) => onUpdateRunRow(selectedRun.id, employeeId, patch)}
        onRefreshSnapshots={() => onRefreshRunSnapshots?.(selectedRun.id, employees)}
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      {/* Header i samma mönster som Kunder/Bokföring/Skatt och bokslut
          (kort-bakgrund + kantlinje, inte flytande text på sidbakgrunden)
          — se motsvarande kommentar i Contacts.jsx. */}
      <ListPageHeader
        title={t('ui.anstallda_och_lon')}
        actions={
          activeTab === 'employees' && viewState === 'list'
            ? [
                ...(employees.length > 0 ? [{ key: 'export-employees', label: t('employeeImport.export_button'), icon: Download, onClick: () => downloadCsv(`anstallda_${new Date().toISOString().slice(0, 10)}.csv`, employeesToCsv(employees)) }] : []),
                ...(onApplyFos && employees.length > 0 ? [{ key: 'fos', label: t('fos.button'), icon: Landmark, onClick: () => setShowFos(true) }] : []),
                ...(onImportEmployees ? [{ key: 'import-employees', label: t('employeeImport.import_button'), icon: Upload, onClick: () => setShowImport(true) }] : []),
                { key: 'new-employee', label: t('ui.ny_anstalld'), icon: Plus, onClick: () => { setSelectedEmployee(null); setViewState('new'); }, variant: 'primary' },
              ]
            : activeTab === 'runs'
              ? [{
                  key: 'new-run', label: t('ui.ny_lonekorning'), icon: Plus, variant: 'primary',
                  onClick: () => { if (employees.length === 0) { setActiveTab('employees'); setViewState('new'); } else { if (!newRunPayDate) setNewRunPayDate(`${newRunPeriod}-25`); setShowNewRun(true); } },
                  title: employees.length === 0 ? t('ui.lagg_till_en_anstalld_forst') : undefined,
                }]
              : []
        }
        tabs={{
          items: [
            { id: 'employees', label: t('ui.anstallda'), icon: UserCog },
            { id: 'runs', label: t('ui.lonekorningar'), icon: CalendarClock },
            // Semestersaldon hör hemma bredvid lönekörningarna och inte inne
            // i en enskild anställd: frågan "hur mycket semester ligger vi på"
            // är en företagsfråga (och en balanspost), inte en personalfråga.
            { id: 'vacation', label: t('ui.semester'), icon: Palmtree },
          ],
          activeId: activeTab,
          onChange: (id) => { setActiveTab(id); setViewState('list'); setSelectedEmployee(null); },
        }}
      />
      {/* Sökfältet ligger kvar i samma kort som resten av sidhuvudet
          (ListFilterBar, direkt under flikraden) — precis som Bokförings
          filterrad, istället för att flyta löst på sidbakgrunden under
          kortet. Kundfeedback ("gör lönekörningar mer som anställda"):
          Lönekörningar-fliken saknade den här raden helt, till skillnad
          från Anställda — samma ListFilterBar/sökfält-mönster nu på båda. */}
      {((activeTab === 'employees' && viewState === 'list') || activeTab === 'runs') && (
        <ListFilterBar>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            {activeTab === 'employees' ? (
              <input type="text" placeholder={t('ui.sok_anstalld')} value={search} onChange={e => setSearch(e.target.value)} style={listSearchInputStyle} />
            ) : (
              <input type="text" placeholder={t('ui.sok_period_t_ex_2026_08')} value={runSearch} onChange={e => setRunSearch(e.target.value)} style={listSearchInputStyle} />
            )}
          </div>
        </ListFilterBar>
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
          <ListTable
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
              { key: 'chevron', label: '', align: 'right', render: () => <ChevronRight size={16} color="var(--text-muted)" /> },
            ]}
          />
          )}
        </div>
      )}

      {activeTab === 'employees' && viewState !== 'list' && (
        <div className="mform-page" style={{ padding: '24px' }}>
          <MobileFormMode />
          <div className="mform-head" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <button className="mform-back" onClick={() => { setViewState('list'); setSelectedEmployee(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: 0 }}>
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
            onCancel={() => { setViewState('list'); setSelectedEmployee(null); }}
          />
        </div>
      )}

      {activeTab === 'vacation' && (
        <VacationOverview
          employees={employees}
          payrollRuns={payrollRuns}
          onSelectEmployee={(employee) => { setActiveTab('employees'); setSelectedEmployee(employee); setViewState('edit'); }}
        />
      )}

      {activeTab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Kundfeedback ("samma vy som resten av sidorna, den ska täcka,
              inga spaces"): den här fliken låg tidigare hel i en padded
              24px-box, till skillnad från Anställda-fliken och "facit"-
              sidorna (Bokföring/Verifikationer) där tabellen sitter flush
              direkt under filterraden. Varning/formulär behåller sin egen
              marginal (de är fristående kort, inte tabellen), men
              ListTable nedan är nu flush precis som överallt annars. */}
          {showNewRun && (
            <section className="payroll-newrun" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>{t('ui.ny_lonekorning')}</h3>
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
                    {t('ui.kommer_att_inkluderas_i_denna_korning', { length: activeEmployeesForPeriod.length, v1: activeEmployeesForPeriod.length === 1 ? 'anställd' : 'anställda' })}
                  </div>
                  {activeEmployeesForPeriod.map(e => {
                    const hourly = e.salaryForm === 'timlon';
                    const pay = hourly ? `${new Intl.NumberFormat('sv-SE').format(Number(e.hourlyRate) || 0)} kr/tim` : `${new Intl.NumberFormat('sv-SE').format(Number(e.monthlySalary) || 0)} kr/mån`;
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
          )}

          <ListTable
            rowKey={r => r.id}
            onRowClick={r => setSelectedRunId(r.id)}
            // Kundönskemål (uppföljning): varningen om att lägga till en
            // anställd låg tidigare som en egen ruta OVANFÖR hela fliken —
            // flyttad hit, UNDER "Inga tidigare lönekörningar", i stället
            // för att sväva ovanför/före tomt-läget.
            emptyMessage={sortedRuns.length === 0 ? (
              <div>
                <div>{t('ui.inga_tidigare_lonekorningar')}</div>
                {employees.length === 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
                    {t('ui.du_behover_lagga_till_minst_en_anstalld_innan_du')}
                  </div>
                )}
              </div>
            ) : t('ui.ingen_matchade_sokningen')}
            rows={filteredRuns}
            mobileList={r => {
              const status = r.completedSteps.includes('booked') ? t('ui.bokford') : (r.completedSteps.includes('calculated') ? t('ui.bokforda_status_berakn') : t('ui.utkast'));
              const tone = status === t('ui.bokford') ? { bg: 'var(--status-green-bg)', color: 'var(--status-green-text)' } : status === t('ui.bokforda_status_berakn') ? { bg: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' } : { bg: 'var(--border-light)', color: 'var(--text-secondary)' };
              return {
                dot: tone.color,
                primary: t('ui.lonekorning', { period: r.period }),
                meta: `${r.rows.length} ${r.rows.length === 1 ? t('ui.anstalld_2') : t('ui.anstallda_2')}`,
                pill: <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: tone.bg, color: tone.color }}>{status}</span>,
              };
            }}
            columns={[
              { key: 'period', label: t('ui.period'), fontWeight: 700, color: 'var(--text-main)', fontSize: '14px', render: r => t('ui.lonekorning', { period: r.period }) },
              { key: 'employees', label: t('ui.anstallda'), color: 'var(--text-main)', fontSize: '14px', render: r => r.rows.length },
              {
                key: 'status', label: t('ui.status'), render: r => {
                  const status = r.completedSteps.includes('booked') ? t('ui.bokford') : (r.completedSteps.includes('calculated') ? t('ui.bokforda_status_berakn') : t('ui.utkast'));
                  const statusColor = status === t('ui.bokford') ? { bg: 'var(--status-green-bg)', color: 'var(--status-green-text)' } : status === t('ui.bokforda_status_berakn') ? { bg: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' } : { bg: 'var(--border-light)', color: 'var(--text-secondary)' };
                  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: statusColor.bg, color: statusColor.color }}>{status}</span>;
                },
              },
              { key: 'chevron', label: '', align: 'right', render: () => <ChevronRight size={16} color="var(--text-muted)" /> },
            ]}
          />
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
