import React, { useState } from 'react';
import { Plus, Search, ChevronRight, Users, UserCog, CalendarClock } from 'lucide-react';
import EmployeeForm from './EmployeeForm';
import PayrollRunDetail from './PayrollRunDetail';

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
    return (
      <div style={{ padding: '32px 40px', minHeight: '100%' }}>
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
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px 48px', animation: 'fadeIn 0.25s ease', minHeight: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '26px' }}>
        <h1 style={{ fontSize: '27px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Anställda och lön</h1>
        <p className="page-desc-long" style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 22px' }}>Hantera dina anställda och kör löner, från bruttolön till bokförd verifikation.</p>
        <div style={{ display: 'inline-flex', gap: '4px', background: 'var(--border-light)', padding: '4px', borderRadius: '11px' }}>
          {[{ id: 'employees', label: 'Anställda', icon: UserCog }, { id: 'runs', label: 'Lönekörningar', icon: CalendarClock }].map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setViewState('list'); setSelectedEmployee(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: '14px',
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--text-main)' : 'var(--text-secondary)',
                  background: active ? 'var(--bg-card)' : 'transparent',
                  borderRadius: '8px',
                  boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'employees' && viewState === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* .page-header-row (Sida 38, punkt 6): 260px sökfält + knapp
              staplas på mobil istället för att tvinga sidledesskroll. */}
          <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Sök anställd..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSt, paddingLeft: '36px', width: '260px', background: 'var(--bg-card)' }} />
            </div>
            <button onClick={() => { setSelectedEmployee(null); setViewState('new'); }} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.15)' }}>
              <Plus size={16} /> Ny anställd
            </button>
          </div>

          {/* Kundfeedback ("white space"-genomgången): en tom lista visade
              tidigare bara en paddad tabellrad, utan egen höjd att centrera
              sig i — samma fix som Quotes.jsx/Contacts.jsx: tomt-läge som
              ett eget flex:1-block istället för en tabellrad. */}
          {filteredEmployees.length === 0 ? (
            <div style={{ flex: 1, minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', ...panelCard }}>
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
                <button onClick={() => { setSelectedEmployee(null); setViewState('new'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={16} /> Ny anställd
                </button>
              )}
            </div>
          ) : (
          /* Kundfeedback: en populerad (om än kort) lista ska inte
             centreras lodrätt — bara det helt tomma läget ovan. */
          <div style={panelCard}>
            {/* .responsive-table (Sida 38, punkt 1, komplettering) */}
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-muted)' }}>
                  {['Namn', 'Typ', 'Anställningsdatum', 'Lön', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((e, i) => {
                  const isActive = !e.endDate || e.endDate >= new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={e.id} onClick={() => { setSelectedEmployee(e); setViewState('edit'); }} style={{ borderBottom: i < filteredEmployees.length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer' }} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={ev => ev.currentTarget.style.background = 'white'}>
                      <td data-label="Namn" style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>{e.firstName} {e.lastName}</td>
                      <td data-label="Typ" style={{ padding: '14px 16px', color: 'var(--text-main)', fontSize: '14px' }}>{e.employmentType === 'foretagsledare' ? 'Företagsledare' : e.employmentType === 'styrelseledamot' ? 'Styrelseledamot' : 'Anställd'}</td>
                      <td data-label="Anställningsdatum" style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>{e.startDate}</td>
                      <td data-label="Lön" style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>{e.salaryForm === 'timlon' ? `${e.hourlyRate || 0} kr/tim` : formatSEK(e.monthlySalary)}</td>
                      <td data-label="Status" style={{ padding: '14px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: isActive ? 'var(--status-green-bg)' : 'var(--border-light)', color: isActive ? 'var(--status-green-text)' : 'var(--text-secondary)' }}>
                          {isActive ? 'Aktiv' : 'Avslutad'}
                        </span>
                      </td>
                      <td data-label="" className="td-actions" style={{ padding: '14px 16px', textAlign: 'right' }}><ChevronRight size={16} color="var(--text-muted)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {activeTab === 'employees' && viewState !== 'list' && (
        <div>
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
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button
              onClick={() => {
                if (employees.length === 0) { setActiveTab('employees'); setViewState('new'); }
                else setShowNewRun(true);
              }}
              title={employees.length === 0 ? 'Lägg till en anställd först' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.15)' }}
            >
              <Plus size={16} /> Ny lönekörning
            </button>
          </div>

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
                <button onClick={handleCreateRun} disabled={activeEmployeesForPeriod.length === 0} style={{ padding: '9px 18px', background: activeEmployeesForPeriod.length ? '#1a3028' : 'var(--border)', color: activeEmployeesForPeriod.length ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: activeEmployeesForPeriod.length ? 'pointer' : 'not-allowed' }}>Skapa</button>
              </div>
            </div>
          )}

          <div style={panelCard}>
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-muted)' }}>
                  {['Period', 'Anställda', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRuns.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ display: 'block', margin: '0 auto 10px', color: 'var(--border)' }} />
                    Inga tidigare lönekörningar.
                  </td></tr>
                ) : sortedRuns.map((r, i) => {
                  const status = r.completedSteps.includes('booked') ? 'Bokförd' : (r.completedSteps.includes('calculated') ? 'Beräknad' : 'Utkast');
                  const statusColor = status === 'Bokförd' ? { bg: 'var(--status-green-bg)', color: 'var(--status-green-text)' } : status === 'Beräknad' ? { bg: '#e0f2fe', color: '#0369a1' } : { bg: 'var(--border-light)', color: 'var(--text-secondary)' };
                  return (
                    <tr key={r.id} onClick={() => setSelectedRunId(r.id)} style={{ borderBottom: i < sortedRuns.length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer' }} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={ev => ev.currentTarget.style.background = 'white'}>
                      <td data-label="Period" style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-main)', fontSize: '14px' }}>Lönekörning {r.period}</td>
                      <td data-label="Anställda" style={{ padding: '14px 16px', color: 'var(--text-main)', fontSize: '14px' }}>{r.rows.length}</td>
                      <td data-label="Status" style={{ padding: '14px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: statusColor.bg, color: statusColor.color }}>{status}</span>
                      </td>
                      <td data-label="" className="td-actions" style={{ padding: '14px 16px', textAlign: 'right' }}><ChevronRight size={16} color="var(--text-muted)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
