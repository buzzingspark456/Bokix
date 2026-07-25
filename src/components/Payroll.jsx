import React, { useState } from 'react';
import { Users, Plus, CheckCircle, FileText, Clock, X, Check, Calculator, Trash2, ChevronRight, TrendingUp } from 'lucide-react';

export default function Payroll() {
  const [activeTab, setActiveTab] = useState('payrolls');
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

  const [employees, setEmployees] = useState([
    { id: 1, name: 'Anna Andersson', role: 'Konsult', salaryType: 'timlon', rate: 200, taxRate: 30 },
    { id: 2, name: 'Erik Karlsson', role: 'Projektledare', salaryType: 'manadslon', rate: 45000, taxRate: 32 },
  ]);

  const [payrolls, setPayrolls] = useState([
    { id: 1, period: 'Juni 2026', employees: 2, totalGross: 85000, tax: 25500, net: 59500, social: 26690, status: 'paid' },
    { id: 2, period: 'Juli 2026', employees: 2, totalGross: 85000, tax: 25500, net: 59500, social: 26690, status: 'draft' },
  ]);

  // Employee form state
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empSalaryType, setEmpSalaryType] = useState('manadslon');
  const [empRate, setEmpRate] = useState('');
  const [empTaxRate, setEmpTaxRate] = useState(30);

  // Payroll run form state
  const [prPeriod, setPrPeriod] = useState('');
  const [prLines, setPrLines] = useState(
    [
      { empId: 1, name: 'Anna Andersson', hours: '', rate: 200, type: 'timlon', taxRate: 30 },
      { empId: 2, name: 'Erik Karlsson', hours: '', rate: 45000, type: 'manadslon', taxRate: 32 },
    ]
  );

  const fmt = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

  const getLineGross = (line) => line.type === 'manadslon' ? (parseFloat(line.rate) || 0) : (parseFloat(line.hours) || 0) * (parseFloat(line.rate) || 0);

  const calcTotals = () => {
    let totalGross = 0, totalTax = 0;
    prLines.forEach(l => {
      const gross = getLineGross(l);
      totalGross += gross;
      totalTax += gross * ((parseFloat(l.taxRate) || 0) / 100);
    });
    const social = totalGross * 0.3142;
    const net = totalGross - totalTax;
    return { totalGross, totalTax, social, net };
  };

  const totals = calcTotals();

  const handleAddEmployee = (e) => {
    e.preventDefault();
    const newEmp = {
      id: Date.now(),
      name: empName,
      role: empRole,
      salaryType: empSalaryType,
      rate: parseFloat(empRate) || 0,
      taxRate: parseFloat(empTaxRate) || 30
    };
    setEmployees(prev => [...prev, newEmp]);
    setPrLines(prev => [...prev, { empId: newEmp.id, name: newEmp.name, hours: '', rate: newEmp.rate, type: newEmp.salaryType, taxRate: newEmp.taxRate }]);
    setEmpName(''); setEmpRole(''); setEmpRate(''); setEmpTaxRate(30); setEmpSalaryType('manadslon');
    setIsEmployeeModalOpen(false);
  };

  const handleDeleteEmployee = (id) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    setPrLines(prev => prev.filter(l => l.empId !== id));
  };

  const handlePrLineChange = (empId, field, value) => {
    setPrLines(lines => lines.map(l => l.empId === empId ? { ...l, [field]: value } : l));
  };

  const handleAddPayroll = (e) => {
    e.preventDefault();
    if (!prPeriod || totals.totalGross <= 0) return;
    const t = calcTotals();
    setPayrolls(prev => [{
      id: Date.now(),
      period: prPeriod,
      employees: prLines.filter(l => getLineGross(l) > 0).length,
      totalGross: t.totalGross,
      tax: t.totalTax,
      net: t.net,
      social: t.social,
      status: 'draft'
    }, ...prev]);
    setPrPeriod('');
    setIsPayrollModalOpen(false);
  };

  const handleMarkPaid = (id) => {
    setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: 'paid' } : p));
  };

  // Styles
  const btnPrimary = {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px',
    background: '#5ba85a', border: 'none', borderRadius: '9px', fontSize: '13px',
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s', fontFamily: 'inherit'
  };
  const btnSecondary = {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
    background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px',
    fontWeight: 500, cursor: 'pointer', color: '#374151', transition: 'all 0.15s', fontFamily: 'inherit'
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '9px',
    fontSize: '14px', color: '#111827', background: 'white', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box'
  };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' };

  const totalCost = payrolls.reduce((s, p) => s + p.totalGross + p.social, 0) / Math.max(payrolls.length, 1);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '4px' }}>
            Löner
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px' }}>Hantera anställda, lönekörningar och arbetsgivaravgifter</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Tab toggles */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '4px', gap: '2px' }}>
            <button onClick={() => setActiveTab('payrolls')} style={{ padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', background: activeTab === 'payrolls' ? 'white' : 'transparent', color: activeTab === 'payrolls' ? '#111827' : '#6b7280', boxShadow: activeTab === 'payrolls' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              <FileText size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />Körningar
            </button>
            <button onClick={() => setActiveTab('employees')} style={{ padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', background: activeTab === 'employees' ? 'white' : 'transparent', color: activeTab === 'employees' ? '#111827' : '#6b7280', boxShadow: activeTab === 'employees' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              <Users size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />Anställda ({employees.length})
            </button>
          </div>
          {activeTab === 'payrolls' ? (
            <button style={btnPrimary} onClick={() => setIsPayrollModalOpen(true)}
              onMouseEnter={e => e.currentTarget.style.background = '#4a8d49'}
              onMouseLeave={e => e.currentTarget.style.background = '#5ba85a'}
            >
              <Plus size={14} /> Ny lönekörning
            </button>
          ) : (
            <button style={btnPrimary} onClick={() => setIsEmployeeModalOpen(true)}
              onMouseEnter={e => e.currentTarget.style.background = '#4a8d49'}
              onMouseLeave={e => e.currentTarget.style.background = '#5ba85a'}
            >
              <Plus size={14} /> Lägg till anställd
            </button>
          )}
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Anställda', value: employees.length + ' st', sub: 'Aktiva anställda', color: '#3a8fc1', bg: '#eef6fb' },
          { label: 'Senaste bruttolön', value: fmt(payrolls[0]?.totalGross || 0), sub: payrolls[0]?.period || '–', color: '#5ba85a', bg: '#f1f8f1' },
          { label: 'Arbetsgivaravgifter', value: fmt(payrolls[0]?.social || 0), sub: '31.42% på bruttolön', color: '#d97706', bg: '#fffbeb' },
          { label: 'Total kostnad/körning', value: fmt(totalCost), sub: 'Brutto + avg. (snitt)', color: '#6b7280', bg: '#f3f4f6' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: kpi.color }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', marginBottom: '4px' }}>{kpi.value}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── PAYROLLS TAB ── */}
      {activeTab === 'payrolls' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} style={{ color: '#5ba85a' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Lönekörningar</span>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>{payrolls.length} körningar totalt</span>
          </div>
          {payrolls.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>
              <FileText size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ fontWeight: 600 }}>Inga lönekörningar ännu</p>
              <p style={{ fontSize: '13px' }}>Klicka på "Ny lönekörning" för att komma igång</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Period</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Anställda</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Bruttolön</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Avdragen Skatt</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Arb.avg (31.42%)</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Nettolön</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Status</th>
                    <th style={{ padding: '12px 20px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((pr, idx) => (
                    <tr key={pr.id}
                      style={{ borderBottom: idx < payrolls.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111827' }}>{pr.period}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', color: '#6b7280' }}>{pr.employees} st</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt(pr.totalGross)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', color: '#dc2626' }}>-{fmt(pr.tax)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', color: '#d97706' }}>-{fmt(pr.social)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#5ba85a', fontSize: '14px' }}>{fmt(pr.net)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        {pr.status === 'paid' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#f1f8f1', color: '#5ba85a', borderRadius: '20px', fontSize: '11px', fontWeight: 600, border: '1px solid #bce4bc' }}>
                            <CheckCircle size={11} /> Bokförd
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#fefce8', color: '#ca8a04', borderRadius: '20px', fontSize: '11px', fontWeight: 600, border: '1px solid #fde68a' }}>
                            <Clock size={11} /> Utkast
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {pr.status === 'draft' && (
                          <button onClick={() => handleMarkPaid(pr.id)} style={{ padding: '5px 12px', background: '#f1f8f1', border: '1px solid #bce4bc', borderRadius: '7px', color: '#5ba85a', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Markera bokförd
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === 'employees' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} style={{ color: '#3a8fc1' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Anställda</span>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>{employees.length} anställda</span>
          </div>
          {employees.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>
              <Users size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ fontWeight: 600 }}>Inga anställda än</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Namn</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Roll</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Lönetyp</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Lön / Timpris</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Skattesats</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Arb.kostnad/mån</th>
                    <th style={{ padding: '12px 20px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => {
                    const monthlyCost = emp.salaryType === 'manadslon' ? emp.rate * (1 + 0.3142) : null;
                    return (
                      <tr key={emp.id}
                        style={{ borderBottom: idx < employees.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3a8fc1, #5ba85a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                              {emp.name.charAt(0)}
                            </div>
                            <span style={{ fontWeight: 600, color: '#111827' }}>{emp.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', color: '#6b7280' }}>{emp.role || '—'}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ padding: '4px 10px', background: emp.salaryType === 'timlon' ? '#eef6fb' : '#f1f8f1', color: emp.salaryType === 'timlon' ? '#3a8fc1' : '#5ba85a', border: `1px solid ${emp.salaryType === 'timlon' ? '#b9dcf2' : '#bce4bc'}`, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                            {emp.salaryType === 'timlon' ? 'Timlön' : 'Månadslön'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>
                          {fmt(emp.rate)} {emp.salaryType === 'timlon' ? '/ h' : '/ mån'}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>{emp.taxRate}%</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                          {monthlyCost ? fmt(monthlyCost) : '—'}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <button onClick={() => handleDeleteEmployee(emp.id)} style={{ background: 'transparent', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                            onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ ADD EMPLOYEE MODAL ══ */}
      {isEmployeeModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setIsEmployeeModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#eef6fb', color: '#3a8fc1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} />
                </div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>Lägg till anställd</h2>
              </div>
              <button onClick={() => setIsEmployeeModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEmployee} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Namn *</label>
                <input type="text" style={inputStyle} value={empName} onChange={e => setEmpName(e.target.value)} placeholder="För- och efternamn" required />
              </div>
              <div>
                <label style={labelStyle}>Roll / Tjänst</label>
                <input type="text" style={inputStyle} value={empRole} onChange={e => setEmpRole(e.target.value)} placeholder="T.ex. Konsult, Projektledare" />
              </div>
              <div>
                <label style={labelStyle}>Lönetyp *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[{ id: 'manadslon', label: 'Månadslön' }, { id: 'timlon', label: 'Timlön' }].map(opt => (
                    <button type="button" key={opt.id} onClick={() => setEmpSalaryType(opt.id)}
                      style={{ padding: '10px', borderRadius: '10px', border: `2px solid ${empSalaryType === opt.id ? '#5ba85a' : '#e5e7eb'}`, background: empSalaryType === opt.id ? '#f1f8f1' : 'white', color: empSalaryType === opt.id ? '#5ba85a' : '#374151', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{empSalaryType === 'timlon' ? 'Timlön (kr/h) *' : 'Månadslön (kr) *'}</label>
                  <input type="number" style={inputStyle} value={empRate} onChange={e => setEmpRate(e.target.value)} placeholder={empSalaryType === 'timlon' ? '250' : '45000'} required />
                </div>
                <div>
                  <label style={labelStyle}>Skattesats (%) *</label>
                  <input type="number" style={inputStyle} value={empTaxRate} onChange={e => setEmpTaxRate(e.target.value)} min={0} max={60} required />
                </div>
              </div>
              {empRate && (
                <div style={{ padding: '12px', background: '#f1f8f1', borderRadius: '10px', border: '1px solid #bce4bc' }}>
                  <div style={{ fontSize: '12px', color: '#5ba85a', fontWeight: 600, marginBottom: '4px' }}>Arbetsgivarkostnad</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                    {empSalaryType === 'manadslon' ? fmt((parseFloat(empRate) || 0) * 1.3142) + ' / mån' : fmt((parseFloat(empRate) || 0) * 1.3142) + ' / h'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Inkl. 31.42% arbetsgivaravgift</div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
                <button type="button" onClick={() => setIsEmployeeModalOpen(false)} style={btnSecondary}>Avbryt</button>
                <button type="submit" disabled={!empName || !empRate} style={{ ...btnPrimary, opacity: (!empName || !empRate) ? 0.5 : 1 }}>
                  <Check size={14} /> Spara anställd
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ NEW PAYROLL MODAL ══ */}
      {isPayrollModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setIsPayrollModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '620px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#f1f8f1', color: '#5ba85a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calculator size={18} />
                </div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>Ny lönekörning</h2>
              </div>
              <button onClick={() => setIsPayrollModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddPayroll} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Löneperiod *</label>
                <input type="text" style={inputStyle} value={prPeriod} onChange={e => setPrPeriod(e.target.value)} placeholder="T.ex. Augusti 2026" required />
              </div>

              <div>
                <label style={labelStyle}>Anställdas tid & lön</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {prLines.map(line => {
                    const gross = getLineGross(line);
                    const tax = gross * (line.taxRate / 100);
                    const net = gross - tax;
                    return (
                      <div key={line.empId} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3a8fc1, #5ba85a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                            {line.name.charAt(0)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{line.name}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{line.type === 'timlon' ? `${line.rate} kr/h · Skatt ${line.taxRate}%` : `Månadslön · Skatt ${line.taxRate}%`}</div>
                          </div>
                          {line.type === 'timlon' && (
                            <div>
                              <input
                                type="number"
                                style={{ ...inputStyle, width: '120px', padding: '7px 10px', textAlign: 'center' }}
                                placeholder="Timmar"
                                value={line.hours}
                                onChange={e => handlePrLineChange(line.empId, 'hours', e.target.value)}
                              />
                            </div>
                          )}
                          <div style={{ textAlign: 'right', minWidth: '90px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{fmt(gross)}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>Brutto</div>
                          </div>
                        </div>
                        {gross > 0 && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '16px', fontSize: '12px' }}>
                            <span style={{ color: '#dc2626' }}>Skatt: -{fmt(tax)}</span>
                            <span style={{ color: '#5ba85a', fontWeight: 600 }}>Nettolön: {fmt(net)}</span>
                            <span style={{ color: '#d97706' }}>Arb.avg: {fmt(gross * 0.3142)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Box */}
              <div style={{ background: 'linear-gradient(135deg, #f1f8f1, #eef6fb)', border: '1px solid #bce4bc', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#5ba85a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Bruttolön</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>{fmt(totals.totalGross)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Skatt & Avg.</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>{fmt(totals.totalTax + totals.social)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#3a8fc1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Nettolön</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>{fmt(totals.net)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsPayrollModalOpen(false)} style={btnSecondary}>Avbryt</button>
                <button type="submit" disabled={!prPeriod || totals.totalGross <= 0} style={{ ...btnPrimary, opacity: (!prPeriod || totals.totalGross <= 0) ? 0.5 : 1 }}>
                  <Check size={14} /> Bokför lönekörning
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
