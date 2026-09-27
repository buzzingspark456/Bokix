import React, { useMemo, useState } from 'react';
import { Download, AlertTriangle, CheckCircle2 } from './icons';
import { computeAnnualReport, previousFiscalYear, annualReportDeadline, averageEmployees } from '../utils/annualReport';
import { formatKr, downloadAnnualReportPdf } from '../utils/annualReportPdf';
import { activeFiscalYear } from '../utils/fiscalYear';
import { t } from '../i18n';

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' };
const hint = { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.45 };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' };
const btn = (primary) => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--accent)' : 'var(--bg-card)', color: primary ? '#fff' : 'var(--text-main)',
});

/**
 * Årsredovisning för aktiebolag (K2) — flik i Skatt och bokslut. Siffrorna
 * räknas i utils/annualReport.js, PDF:en byggs i utils/annualReportPdf.js.
 * Det användaren fyller i sparas per räkenskapsår i company.annualReports.
 */
export default function AnnualReport({ company, verifications = [], accounts = [], payrollRuns = [], setCompanyInfo }) {
  // Förvalt: det senast avslutade räkenskapsåret, det är det som ska ha en
  // årsredovisning. Det pågående året går att välja för en förhandsvisning.
  const current = useMemo(() => activeFiscalYear(company), [company]);
  const previous = useMemo(() => previousFiscalYear(current, company), [current, company]);
  const years = [previous, current];
  const [yearKey, setYearKey] = useState(previous.key);
  const fy = years.find(y => y.key === yearKey) || previous;

  const saved = company?.annualReports?.[fy.key] || {};
  const suggestedEmployees = useMemo(() => averageEmployees(payrollRuns, fy), [payrollRuns, fy]);
  const details = { employeesAverage: suggestedEmployees, ...saved };
  const setField = (field, value) => {
    setCompanyInfo?.(prev => ({
      ...prev,
      annualReports: { ...(prev.annualReports || {}), [fy.key]: { ...(prev.annualReports?.[fy.key] || {}), [field]: value } },
    }));
  };

  const report = useMemo(
    () => computeAnnualReport({ verifications, accounts, company, fy, details, employeesAverage: suggestedEmployees }),
    // details byggs om varje rendering; saved är det som faktiskt ändras.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verifications, accounts, company, fy.key, saved, suggestedEmployees],
  );
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      downloadAnnualReportPdf({ company, report, details }, `Arsredovisning-${(company?.name || 'bolaget').replace(/[^\wåäöÅÄÖ-]+/g, '-')}-${fy.key.replace('/', '-')}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const deadline = annualReportDeadline(fy.end);
  const ended = fy.end < new Date().toISOString().slice(0, 10);
  const locked = Boolean(company?.lockedFiscalYears?.[fy.key]);
  const inc = report.income.keyFigures;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '980px' }}>
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '720px', lineHeight: 1.55 }}>
        {t('ui.aktiebolag_ska_lamna_en_arsredovisning_till_bola')}
      </p>

      <div style={{ ...card, display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '220px' }}>
          <label style={lbl}>{t('ui.rakenskapsar')}</label>
          <select value={fy.key} onChange={e => setYearKey(e.target.value)} style={inp}>
            {years.map(y => <option key={y.key} value={y.key}>{y.label} ({y.start} – {y.end})</option>)}
          </select>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {t('ui.senast_hos_bolagsverket')} <strong style={{ color: 'var(--text-main)' }}>{deadline}</strong>
          <br />
          {!ended ? t('ui.rakenskapsaret_pagar_sa_det_har_ar_en_forhandsvi') : locked ? t('ui.bokslutet_ar_last') : t('ui.gor_klart_och_las_bokslutet_innan_arsredovisning')}
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div style={{ ...card, background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', color: 'var(--status-amber-text)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {report.warnings.map(w => (
            <div key={w} style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: 1.5 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px' }}>
        {[
          [t('ui.nettoomsattning'), report.income.netSales.current],
          [t('ui.resultat_efter_finansiella_poster'), inc['Resultat efter finansiella poster']?.current],
          [t('ui.arets_resultat'), report.yearResult],
          [t('ui.balansomslutning'), report.balance.totalAssets],
          [t('ui.soliditet'), report.overview[0]?.solidity == null ? '-' : `${Math.round(report.overview[0].solidity)} %`],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>{typeof value === 'number' ? `${formatKr(value)} kr` : value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{t('ui.forvaltningsberattelse')}</div>
        <div>
          <label style={lbl}>{t('ui.verksamheten')}</label>
          <textarea rows={3} value={details.business || ''} onChange={e => setField('business', e.target.value)} style={{ ...inp, resize: 'vertical' }} placeholder={t('ui.bolaget_bedriver_konsultverksamhet_inom_it')} />
          <div style={hint}>{t('ui.vad_bolaget_gor_med_en_eller_tva_meningar')}</div>
        </div>
        <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={lbl}>{t('ui.sate')}</label>
            <input value={details.seat || ''} onChange={e => setField('seat', e.target.value)} style={inp} placeholder={t('ui.stockholm')} />
            <div style={hint}>{t('ui.kommunen_som_star_i_bolagsordningen')}</div>
          </div>
          <div>
            <label style={lbl}>{t('ui.medelantal_anstallda')}</label>
            <input type="number" min="0" value={details.employeesAverage ?? ''} onChange={e => setField('employeesAverage', e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
            <div style={hint}>{t('ui.forslag_ur_lonekorningarna')} {suggestedEmployees}{t('ui.agare_utan_lon_raknas_inte')}</div>
          </div>
        </div>
        <div>
          <label style={lbl}>{t('ui.vasentliga_handelser_under_aret_valfritt')}</label>
          <textarea rows={2} value={details.events || ''} onChange={e => setField('events', e.target.value)} style={{ ...inp, resize: 'vertical' }} placeholder={t('ui.till_exempel_nya_kontor_stora_kunder_eller_foran')} />
        </div>
      </div>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{t('ui.resultatdisposition')}</div>
        <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('ui.till_arsstammans_forfogande_star')} {formatKr(report.disposition.available)} {t('ui.kr_balanserat_resultat')} {formatKr(report.disposition.retained)} {t('ui.kr_och_arets_resultat')} {formatKr(report.disposition.yearResult)} {t('ui.kr_2')}
        </div>
        <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={lbl}>{t('ui.foreslagen_utdelning_kr')}</label>
            <input type="number" min="0" value={details.dividend ?? ''} onChange={e => setField('dividend', e.target.value === '' ? '' : Number(e.target.value))} style={inp} placeholder="0" />
            <div style={hint}>{t('ui.resten')} {formatKr(report.disposition.carriedForward)} {t('ui.kr_balanseras_i_ny_rakning')}</div>
          </div>
        </div>
      </div>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{t('ui.underskrifter')}</div>
        <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={lbl}>{t('ui.styrelsens_ledamoter')}</label>
            <textarea rows={3} value={details.boardMembers || ''} onChange={e => setField('boardMembers', e.target.value)} style={{ ...inp, resize: 'vertical' }} placeholder={t('ui.anna_andersson_bo_berg')} />
            <div style={hint}>{t('ui.en_per_rad_alla_ledamoter_och_en_eventuell_vd_sk')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={lbl}>{t('ui.ort_for_underskrift')}</label>
              <input value={details.signPlace || ''} onChange={e => setField('signPlace', e.target.value)} style={inp} placeholder={t('ui.stockholm')} />
            </div>
            <div>
              <label style={lbl}>{t('ui.arsstammans_datum')}</label>
              <input type="date" value={details.agmDate || ''} onChange={e => setField('agmDate', e.target.value)} style={inp} />
              <div style={hint}>{t('ui.star_i_faststallelseintyget_lamna_tomt_for_att_f')}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '560px' }}>
          <CheckCircle2 size={14} style={{ verticalAlign: '-2px', marginRight: '6px', color: 'var(--status-green-text)' }} />
          {t('ui.pdf_en_innehaller_forvaltningsberattelse_resulta')}
        </div>
        <button type="button" onClick={download} disabled={busy} style={btn(true)}>
          <Download size={15} /> {busy ? t('ui.skapar_pdf') : t('ui.ladda_ner_arsredovisningen')}
        </button>
      </div>
    </div>
  );
}
