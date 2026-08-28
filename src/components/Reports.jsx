import React, { useMemo, useState } from 'react';
import { ChevronRight, FileBarChart } from 'lucide-react';
import ListPageHeader from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import ReportDetail from './reports/ReportDetail';
import { getPeriodBounds } from '../utils/reportCalculations';
import { visibleReportSections } from '../utils/reportDefinitions';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

const inputSt = { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-main)' };

// Sida 14c, uppföljning: "Rapport och analys" byggdes om från en enda
// flikad sida (period + 4 KPI-kort + Resultat/Kassaflöde/Kostnadsfördelning/
// Balansräkning) till en riktig rapportportal — 11 namngivna rapporter
// (av specens 14; Kund-/leverantörsreskontra som egen rapport, Budget,
// Prognostisering och Trendanalys har inget underlag att räkna fram ännu,
// se reportDefinitions.js), grupperade i sektioner, var och en öppningsbar
// som en egen detaljvy (ReportDetail.jsx) istället för bara nedladdningsbar.
//
// "Senast öppnad" sparas per rapport-id i company.reportLastOpened (samma
// mönster som yearEndChecklist/ink2s i Taxes.jsx — en tidsstämpel i
// företagsposten, inte en separat backend-tabell för detta första steg).
function relativeOpenedLabel(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000);
  if (days <= 0) return 'idag';
  if (days === 1) return 'igår';
  if (days < 7) return `${days} dagar sedan`;
  if (days < 31) return `${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'vecka' : 'veckor'} sedan`;
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(then);
}

export default function Reports({
  accounts = [], verifications = [], invoices = [], payrollRuns = [], contacts = [],
  company = {}, setCompanyInfo, onNavigate,
}) {
  const isMobile = useIsMobileViewport();
  const [period, setPeriod] = useState('year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [openReportId, setOpenReportId] = useState(null);

  const bounds = useMemo(() => getPeriodBounds(period, {
    fiscalYearStart: company?.fiscalYear, customStart, customEnd,
  }), [period, customStart, customEnd, company?.fiscalYear]);

  const hasPayrollData = useMemo(() => (payrollRuns || []).some(r => r.completedSteps?.includes('booked')), [payrollRuns]);
  const sections = useMemo(() => visibleReportSections({ hasPayrollData }), [hasPayrollData]);
  const lastOpened = company?.reportLastOpened || {};

  const openReport = (reportId) => {
    setOpenReportId(reportId);
    setCompanyInfo?.(prev => ({
      ...prev,
      reportLastOpened: { ...(prev.reportLastOpened || {}), [reportId]: new Date().toISOString() },
    }));
  };

  if (openReportId) {
    return (
      <ReportDetail
        reportId={openReportId}
        bounds={bounds}
        verifications={verifications} accounts={accounts} invoices={invoices}
        payrollRuns={payrollRuns} contacts={contacts} company={company}
        isMobile={isMobile}
        onBack={() => setOpenReportId(null)}
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title="Rapport och analys"
        // Räknar faktiskt synliga rapporter, inte ett hårdkodat "14" —
        // Lönerapporter (och tills vidare hela Lön & personal-sektionen)
        // döljs t.ex. helt om företaget inte har några bokförda
        // lönekörningar, se visibleReportSections. Ett hårdkodat tal här
        // skulle bli fel så fort en sektion döljs eller läggs till.
        subtitle={`${sections.reduce((n, s) => n + s.reports.length, 0)} rapporter — öppna en för att se den fullständiga, beräknade vyn`}
      >
        <div className="no-print" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={inputSt}>
            <option value="month">Denna månad</option>
            <option value="quarter">Detta kvartal</option>
            <option value="year">Detta räkenskapsår</option>
            <option value="custom">Anpassat...</option>
          </select>
          {period === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputSt} />
              <span style={{ color: 'var(--text-muted)' }}>–</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inputSt} />
            </>
          )}
        </div>
      </ListPageHeader>

      {/* Kundfeedback ("no space"-genomgången, uppföljning): ingen padding
          kvar på ytterraden — första sektionen sitter nu flush direkt under
          sidhuvudet, samma princip som Verifikationers filterrad→tabell.
          Sektionsrubriken (nedan) behåller ett 20px vänsterinset som matchar
          sidhuvudets EGEN titel-inset, medan själva ListTable är full bredd
          utan eget sidoinset — exakt samma förhållande som ListFilterBar
          (20px) → ListTable (0px) redan har på Verifikationer. */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '24px' }}>
          {sections.map((section, i) => (
            <div key={section.id}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 20px', marginTop: i === 0 ? '16px' : 0 }}>
                {section.label}
              </div>
              <ListTable
                rowKey={r => r.id}
                onRowClick={r => openReport(r.id)}
                rows={section.reports}
                columns={[
                  {
                    key: 'name', label: 'Rapport', fontWeight: 700, color: 'var(--text-main)', render: r => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'var(--border-light)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileBarChart size={14} />
                        </div>
                        {r.name}
                      </div>
                    ),
                  },
                  { key: 'description', label: 'Beskrivning', wrap: true },
                  { key: 'lastOpened', label: 'Senast öppnad', width: '140px', render: r => relativeOpenedLabel(lastOpened[r.id]) || '—' },
                  { key: 'chevron', label: '', align: 'right', width: '32px', render: () => <ChevronRight size={16} color="var(--text-muted)" /> },
                ]}
              />
            </div>
          ))}

          {onNavigate && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Underlaget kommer från din bokföring och dina fakturor — bokför mer för att fler rapporter fylls i.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
