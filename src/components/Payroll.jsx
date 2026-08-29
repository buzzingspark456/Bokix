import React, { useState } from 'react';
import { Plus, ChevronRight, Users, UserCog, CalendarClock, Search } from 'lucide-react';
import EmployeeForm from './EmployeeForm';
import PayrollRunDetail from './PayrollRunDetail';
import ListPageHeader, { ListFilterBar, listSearchInputStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const inputSt = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
const labelSt = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const panelCard = { background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid #ececef', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)', overflow: 'hidden' };

export default function Payroll({
  company, employees = [], onSaveEmployee, accounts = [], projects = [],
  payrollRuns = [], onCreateRun, onUpdateRunRow, onAdvanceRunStep, onBookRun, onMarkRunPaid, onRefreshRunSnapshots,
}) {
  const [activeTab, setActiveTab] = useState('employees');
  const [search, setSearch] = useState('');
  const [viewState, setViewState] = useState('list'); // 'list' | 'new' | 'edit'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);

  const [showNewRun, setShowNewRun] = useState(false);
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
  const selectedRun = payrollRuns.find(r => r.id === selectedRunId);
  const selectedRunIndex = sortedRuns.findIndex(r => r.id === selectedRunId);
  const previousRun = selectedRunIndex >= 0 ? sortedRuns[selectedRunIndex + 1] : null;

  const activeEmployeesForPeriod = employees.filter(e => !e.endDate || e.endDate >= newRunPeriod + '-01');

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
        title="Anställda och lön"
        subtitle="Hantera dina anställda och kör löner, från bruttolön till bokförd verifikation."
        actions={
          activeTab === 'employees' && viewState === 'list'
            ? [{ key: 'new-employee', label: 'Ny anställd', icon: Plus, onClick: () => { setSelectedEmployee(null); setViewState('new'); }, variant: 'primary' }]
            : activeTab === 'runs'
              ? [{
                  key: 'new-run', label: 'Ny lönekörning', icon: Plus, variant: 'primary',
                  onClick: () => { if (employees.length === 0) { setActiveTab('employees'); setViewState('new'); } else setShowNewRun(true); },
                  title: employees.length === 0 ? 'Lägg till en anställd först' : undefined,
                }]
              : []
        }
        tabs={{
          items: [{ id: 'employees', label: 'Anställda', icon: UserCog }, { id: 'runs', label: 'Lönekörningar', icon: CalendarClock }],
          activeId: activeTab,
          onChange: (id) => { setActiveTab(id); setViewState('list'); setSelectedEmployee(null); },
        }}
      />
      {/* Sökfältet ligger kvar i samma kort som resten av sidhuvudet
          (ListFilterBar, direkt under flikraden) — bara på "Anställda"-
          fliken, precis som Bokförings filterrad, istället för att flyta
          löst på sidbakgrunden under kortet. */}
      {activeTab === 'employees' && viewState === 'list' && (
        <ListFilterBar>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Sök anställd..." value={search} onChange={e => setSearch(e.target.value)} style={listSearchInputStyle} />
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
          {/* Kundfeedback ("white space"-genomgången): en tom lista visade
              tidigare bara en paddad tabellrad, utan egen höjd att centrera
              sig i — samma fix som Quotes.jsx/Contacts.jsx: tomt-läge som
              ett eget flex:1-block istället för en tabellrad. */}
          {filteredEmployees.length === 0 ? (
            <div style={{ flex: 1, minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', margin: '24px', padding: '48px 24px', ...panelCard }}>
              <div style={{ width: 72, height: 72, borderRadius: '20px', background: 'var(--border-light)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                <Users size={30} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                {employees.length === 0 ? 'Inga anställda registrerade' : 'Ingen matchade sökningen'}
              </div>
              {employees.length === 0 && (
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0 0 18px' }}>
                  Lägg till din första anställd för att kunna köra löner.
                </p>
              )}
              {employees.length === 0 && (
                <button onClick={() => { setSelectedEmployee(null); setViewState('new'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={16} /> Ny anställd
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
            columns={[
              { key: 'name', label: 'Namn', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px', render: e => `${e.firstName} ${e.lastName}` },
              { key: 'type', label: 'Typ', color: 'var(--text-main)', fontSize: '14px', render: e => e.employmentType === 'foretagsledare' ? 'Företagsledare' : e.employmentType === 'styrelseledamot' ? 'Styrelseledamot' : 'Anställd' },
              { key: 'startDate', label: 'Anställningsdatum', render: e => e.startDate },
              { key: 'salary', label: 'Lön', fontWeight: 600, color: 'var(--text-main)', render: e => e.salaryForm === 'timlon' ? `${e.hourlyRate || 0} kr/tim` : formatSEK(e.monthlySalary) },
              {
                key: 'status', label: 'Status', render: e => {
                  const isActive = !e.endDate || e.endDate >= new Date().toISOString().slice(0, 10);
                  return (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: isActive ? 'var(--status-green-bg)' : 'var(--border-light)', color: isActive ? 'var(--status-green-text)' : 'var(--text-secondary)' }}>
                      {isActive ? 'Aktiv' : 'Avslutad'}
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
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => { setViewState('list'); setSelectedEmployee(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: 0 }}>← Tillbaka</button>
            <span style={{ color: 'var(--border)' }}>|</span>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{viewState === 'new' ? 'Ny anställd' : 'Redigera anställd'}</h2>
          </div>
          <EmployeeForm
            initial={viewState === 'edit' ? selectedEmployee : null}
            projects={projects}
            onSave={handleSaveEmployee}
            onCancel={() => { setViewState('list'); setSelectedEmployee(null); }}
          />
        </div>
      )}

      {activeTab === 'runs' && (
        <div style={{ padding: '24px' }}>
          {employees.length === 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: 'var(--status-amber-text)' }}>
              Du behöver lägga till minst en anställd innan du kan skapa en lönekörning. Klicka på "Ny lönekörning" för att komma till formuläret under fliken Anställda.
            </div>
          )}

          {showNewRun && (
            <div style={{ ...panelCard, padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>Ny lönekörning</h3>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelSt}>Period</label>
                  <input type="month" value={newRunPeriod} onChange={e => setNewRunPeriod(e.target.value)} style={{ ...inputSt, width: '180px' }} />
                </div>
                <div>
                  <label style={labelSt}>Utbetalningsdatum</label>
                  <input type="date" value={newRunPayDate} onChange={e => setNewRunPayDate(e.target.value)} style={{ ...inputSt, width: '180px' }} />
                </div>
              </div>
              <div style={{ fontSize: '13px', color: activeEmployeesForPeriod.length === 0 ? 'var(--status-red-text)' : 'var(--text-secondary)', marginBottom: '14px' }}>
                {activeEmployeesForPeriod.length === 0
                  ? 'Ingen anställd är aktiv under vald period (kontrollera anställnings-/slutdatum under Anställda). Körningen kan inte skapas förrän minst en anställd matchar perioden.'
                  : `${activeEmployeesForPeriod.length} ${activeEmployeesForPeriod.length === 1 ? 'anställd' : 'anställda'} kommer att inkluderas i denna körning.`}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNewRun(false)} style={{ padding: '9px 18px', background: 'var(--border-light)', border: 'none', borderRadius: '8px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Avbryt</button>
                <button onClick={handleCreateRun} disabled={activeEmployeesForPeriod.length === 0} style={{ padding: '9px 18px', background: activeEmployeesForPeriod.length ? 'var(--accent)' : 'var(--border)', color: activeEmployeesForPeriod.length ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: activeEmployeesForPeriod.length ? 'pointer' : 'not-allowed' }}>Skapa</button>
              </div>
            </div>
          )}

          <ListTable
            rowKey={r => r.id}
            onRowClick={r => setSelectedRunId(r.id)}
            emptyMessage="Inga tidigare lönekörningar."
            rows={sortedRuns}
            columns={[
              { key: 'period', label: 'Period', fontWeight: 700, color: 'var(--text-main)', fontSize: '14px', render: r => `Lönekörning ${r.period}` },
              { key: 'employees', label: 'Anställda', color: 'var(--text-main)', fontSize: '14px', render: r => r.rows.length },
              {
                key: 'status', label: 'Status', render: r => {
                  const status = r.completedSteps.includes('booked') ? 'Bokförd' : (r.completedSteps.includes('calculated') ? 'Beräknad' : 'Utkast');
                  const statusColor = status === 'Bokförd' ? { bg: 'var(--status-green-bg)', color: 'var(--status-green-text)' } : status === 'Beräknad' ? { bg: '#e0f2fe', color: '#0369a1' } : { bg: 'var(--border-light)', color: 'var(--text-secondary)' };
                  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: statusColor.bg, color: statusColor.color }}>{status}</span>;
                },
              },
              { key: 'chevron', label: '', align: 'right', render: () => <ChevronRight size={16} color="var(--text-muted)" /> },
            ]}
          />
        </div>
      )}
      </div>
    </div>
  );
}
