import React, { useMemo, useState } from 'react';
import { ChevronRight } from './icons';
import ListPageHeader from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import ReportDetail from './reports/ReportDetail';
import { getPeriodBounds, companyFiscalYearSetting } from '../utils/reportCalculations';
import { visibleReportSections } from '../utils/reportDefinitions';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { t, dateLocale } from '../i18n';
import { dateTimeFormat } from '../utils/intlCache';

// Stabil referens som förval: en ny [] per render hade gjort useMemo:n
// nedan meningslös (nytt beroende varje gång).
const NO_HIDDEN_REPORTS = [];

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
  if (days <= 0) return t('ui.idag_2');
  if (days === 1) return t('ui.igar');
  if (days < 7) return t('ui.dagar_sedan', { days });
  if (days < 31) return `${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'vecka' : 'veckor'} sedan`;
  return dateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' }).format(then);
}

export default function Reports({
  accounts = [], verifications = [], invoices = [], expenses = [], payrollRuns = [], contacts = [],
  company = {}, setCompanyInfo, onNavigate, hiddenReportIds = NO_HIDDEN_REPORTS,
}) {
  const isMobile = useIsMobileViewport();
  const [period, setPeriod] = useState('year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [openReportId, setOpenReportId] = useState(null);

  const bounds = useMemo(() => getPeriodBounds(period, {
    fiscalYearStart: companyFiscalYearSetting(company), customStart, customEnd,
  }), [period, customStart, customEnd, company?.fiscalYear]);

  const hasPayrollData = useMemo(() => (payrollRuns || []).some(r => r.completedSteps?.includes('booked')), [payrollRuns]);
  const sections = useMemo(
    () => visibleReportSections({ hasPayrollData, hiddenReportIds }),
    [hasPayrollData, hiddenReportIds]
  );
  const lastOpened = company?.reportLastOpened || {};

  const openReport = (reportId) => {
    const meta = sections.flatMap(sec => sec.reports).find(r => r.id === reportId);
    if (meta?.navigate) { onNavigate?.(meta.navigate); return; }
    setOpenReportId(reportId);
    setCompanyInfo?.(prev => ({
      ...prev,
      reportLastOpened: { ...(prev.reportLastOpened || {}), [reportId]: new Date().toISOString() },
    }));
  };

  // Samma val på listan och inne i rapporten: man ska kunna byta period utan
  // att gå tillbaka till listan.
  const periodControl = (
    <div className="no-print" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={period} onChange={e => setPeriod(e.target.value)} style={inputSt} aria-label={t('ui.period')}>
        <option value="month">{t('ui.denna_manad')}</option>
        <option value="quarter">{t('ui.detta_kvartal')}</option>
        <option value="year">{t('ui.detta_rakenskapsar')}</option>
        <option value="last12">{t('ui.senaste_12_manaderna')}</option>
        <option value="custom">{t('ui.anpassat')}</option>
      </select>
      {period === 'custom' && (
        <>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputSt} />
          <span style={{ color: 'var(--text-muted)' }}>–</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inputSt} />
        </>
      )}
    </div>
  );

  if (openReportId) {
    return (
      <ReportDetail
        reportId={openReportId}
        bounds={bounds}
        periodControl={periodControl}
        verifications={verifications} accounts={accounts} invoices={invoices} expenses={expenses}
        payrollRuns={payrollRuns} contacts={contacts} company={company}
        isMobile={isMobile}
        // Presentationsvalen (diagramfärger + beloppsenhet) sparas på
        // FÖRETAGET, inte per rapport: en användare som valt grönt för
        // intäkter menar det i hela appen, inte bara i den rapport hen råkade
        // stå i när valet gjordes. Samma mönster som reportLastOpened ovan.
        display={company?.reportDisplay}
        onDisplayChange={(patch) => setCompanyInfo?.(prev => ({
          ...prev,
          reportDisplay: { ...(prev.reportDisplay || {}), ...patch },
        }))}
        onBack={() => setOpenReportId(null)}
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title={t('nav.reports')}
      >
        <div style={{ marginTop: '10px' }}>{periodControl}</div>
      </ListPageHeader>

      {/* Kundfeedback ("no space"-genomgången, uppföljning): ingen padding
          kvar på ytterraden — första sektionen sitter nu flush direkt under
          sidhuvudet, samma princip som Verifikationers filterrad→tabell.
          Sektionsrubriken (nedan) behåller ett 20px vänsterinset som matchar
          sidhuvudets EGEN titel-inset, medan själva ListTable är full bredd
          utan eget sidoinset — exakt samma förhållande som ListFilterBar
          (20px) → ListTable (0px) redan har på Verifikationer. */}
      <div data-tour="page-reports-list" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '24px' }}>
          {/* En tabell med grupprubriker (2026-11-13): kolumnrubrikerna en gång,
              ingen likadan ikon på varje rad. */}
          <ListTable
            rowKey={r => r.id}
            onRowClick={r => openReport(r.id)}
            rows={sections.flatMap(section => section.reports.map(r => ({ ...r, sectionId: section.id, sectionLabel: section.label })))}
            groupBy={r => r.sectionId}
            renderGroupHeader={(key, rows) => <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{rows[0]?.sectionLabel}</span>}
            // Telefon: namnet, en rad om vad rapporten visar och när den
            // senast öppnades, i stället för tabellens rubriker per kort.
            mobileList={r => ({
              primary: r.name,
              meta: r.description,
              amount: relativeOpenedLabel(lastOpened[r.id]) || null,
            })}
            columns={[
              { key: 'name', label: t('ui.rapport'), width: '260px', fontWeight: 700, color: 'var(--text-main)' },
              { key: 'description', label: t('ui.beskrivning'), wrap: true },
              { key: 'lastOpened', label: t('ui.senast_oppnad'), width: '140px', render: r => relativeOpenedLabel(lastOpened[r.id]) || '—' },
              { key: 'chevron', label: '', align: 'right', width: '32px', render: () => <ChevronRight size={16} color="var(--text-muted)" /> },
            ]}
          />

        </div>
      </div>
    </div>
  );
}
