import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Download, Lock, FileText, ExternalLink } from './icons';
import {
  computeVatPeriod, roundedVatPeriod, validateVatPeriod, compareToPreviousPeriod, vatRutaValue,
  quarterToRange, previousQuarterRange, vatSettlementRows,
} from '../utils/vatCalculation';
import { VAT_RUTOR, VAT_SETTLEMENT_ACCOUNT } from '../utils/vatConfig';
import { DEFAULT_ACCOUNTS } from './AccountsData';
import { t, dateLocale } from '../i18n';

// Kontonamnen i Steg 3:s bokföringsförslag.
const ACCOUNT_NAME = Object.fromEntries(DEFAULT_ACCOUNTS.map(a => [a.code, a.name]));
// Rutorna som filen alltid har haft och som är provade i e-tjänsten.
const VERIFIED_RUTOR = new Set(['05', '10', '11', '12', '48', '49']);
import { downloadVatDeclarationPdf, downloadVatDeclarationXml } from '../utils/vatDeclarationExport';
import { REVERSE_CHARGE_ESKD_VERIFIED } from '../utils/featureFlags';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(v || 0);

// Kundfeedback ("du ska förklara va det ä, asså datum"): "Kvartal 1/2/3/4"
// själva siffran säger ingenting om man inte redan har kalendern i huvudet
// — vilka månader är kvartal 3? Korta månadsintervall direkt i väljarens
// egna alternativ, inte bara i sidhuvudets löptext ovanför (som man lätt
// missar/glömmer när man väl öppnat dropdownen).
const QUARTER_MONTH_LABEL = { 1: 'jan–mar', 2: 'apr–jun', 3: 'jul–sep', 4: 'okt–dec' };

const STEPS = [
  { id: 1, label: t('ui.kontrollera') },
  { id: 2, label: t('ui.granska') },
  { id: 3, label: t('ui.bokfor_2') },
  { id: 4, label: t('ui.lamna_in') },
];

function Stepper({ current, maxReached, isBooked, onSelect }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
      {STEPS.map((step, i) => {
        // Klart = ett steg man redan passerat, eller (när perioden är bokförd) stegen 1-3.
        // Steg som bara går att nå (maxReached) är inte klara: de får ett vanligt nummer.
        const isDone = step.id !== current && (step.id < current || (isBooked && step.id <= 3));
        const isActive = step.id === current;
        const reachable = step.id <= maxReached;
        return (
          <React.Fragment key={step.id}>
            <button type="button" disabled={!reachable} onClick={() => onSelect?.(step.id)} aria-current={isActive ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', cursor: reachable ? 'pointer' : 'default' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? 'var(--accent)' : (isDone ? 'var(--status-green-bg)' : 'var(--border-light)'),
                color: isActive ? 'white' : (isDone ? 'var(--status-green-text)' : 'var(--text-muted)'),
                fontWeight: 700, fontSize: '13px', border: isActive ? 'none' : '1px solid transparent',
                flexShrink: 0,
              }}>
                {isDone ? <CheckCircle2 size={17} /> : step.id}
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-main)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: step.id < current ? 'var(--status-green-bg)' : 'var(--border)', margin: '0 10px 20px' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function VatDeclaration({
  verifications = [], invoices = [], expenses = [], company = {},
  vatPeriods = {}, onBookPeriod, onNavigateToVerification, filings = {}, onToggleFiled, focusPeriod,
}) {
  const today = new Date();
  const defaultQuarter = Math.floor(today.getMonth() / 3) + 1;
  const [year, setYear] = useState(today.getFullYear());
  const [quarter, setQuarter] = useState(defaultQuarter);
  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState(false);
  const [xmlError, setXmlError] = useState('');
  // Ref, inte state — muteras synkront och skyddar mot dubbelklick även
  // innan React hunnit rendera om (useState-uppdateringar batchas).
  const bookingRef = useRef(false);

  // Översikten (TaxOverview) kan skicka hit ett bestämt kvartal: öppna det, och gå direkt till
  // "Lämna in" om perioden redan är bokförd.
  useEffect(() => {
    if (!focusPeriod) return;
    setYear(focusPeriod.year);
    setQuarter(focusPeriod.quarter);
    setStep(vatPeriods[`${focusPeriod.year}-Q${focusPeriod.quarter}`] ? 4 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPeriod]);

  const [periodStart, periodEnd] = useMemo(() => quarterToRange(year, quarter), [year, quarter]);
  const periodKey = `${year}-Q${quarter}`;
  const bookedInfo = vatPeriods[periodKey];
  const isBooked = Boolean(bookedInfo);

  const calc = useMemo(() => computeVatPeriod({ verifications, periodStart, periodEnd }), [verifications, periodStart, periodEnd]);
  const rounded = useMemo(() => roundedVatPeriod(calc), [calc]);
  const validation = useMemo(() => validateVatPeriod({ verifications, invoices, expenses, periodStart, periodEnd }), [verifications, invoices, expenses, periodStart, periodEnd]);

  const [prevStart, prevEnd] = useMemo(() => previousQuarterRange(year, quarter), [year, quarter]);
  const prevCalc = useMemo(() => computeVatPeriod({ verifications, periodStart: prevStart, periodEnd: prevEnd }), [verifications, prevStart, prevEnd]);
  const periodWarnings = useMemo(() => compareToPreviousPeriod(calc, prevCalc), [calc, prevCalc]);

  const transactionCount = useMemo(() => {
    return [...invoices, ...expenses].filter(d => d.date >= periodStart && d.date <= periodEnd).length;
  }, [invoices, expenses, periodStart, periodEnd]);

  const maxReachedStep = isBooked ? 4 : (validation.canProceed ? 3 : 1);

  const rutorForDisplay = VAT_RUTOR
    .map(r => ({ ...r, value: vatRutaValue(r, rounded) }))
    .filter(r => r.kind === 'net' || (r.value ?? 0) !== 0);

  const isRefund = rounded.netToPay < 0;
  // Rutor utöver 05, 10-12, 48 och 49 (omvänd skattskyldighet, import och
  // försäljning utan svensk moms) är ännu inte provade i Skatteverkets e-tjänst.
  const unverifiedRutor = REVERSE_CHARGE_ESKD_VERIFIED ? [] : rutorForDisplay.filter(r => !VERIFIED_RUTOR.has(r.ruta)).map(r => r.ruta);
  const hasReverseCharge = unverifiedRutor.length > 0 || (!REVERSE_CHARGE_ESKD_VERIFIED && (rounded.inputVatReverse || 0) !== 0);
  const settlementRows = vatSettlementRows(rounded);

  const handleBook = () => {
    if (isBooked || bookingRef.current) return;
    bookingRef.current = true;
    setBooking(true);
    try {
      onBookPeriod?.({
        periodKey, periodStart, periodEnd, quarter, year,
        rounded, outputVatByRate: rounded.outputVatByRate, inputVat: rounded.inputVat, netToPay: rounded.netToPay,
      });
      setStep(4);
    } finally {
      // bookingRef förblir true — perioden är nu bokförd (isBooked tar över
      // som spärr så fort vatPeriods-propen hunnit uppdateras uppåt).
      setBooking(false);
    }
  };

  const handleDownloadXml = () => {
    setXmlError('');
    try {
      downloadVatDeclarationXml({ company, year, quarter, rounded }, `momsdeklaration-${periodKey}.xml`);
    } catch (e) {
      setXmlError(e.message);
    }
  };

  const periodLabel = t('ui.kvartal_till', { quarter, periodStart, periodEnd });
  // Läsbart datumspann istället för råa ISO-datum (2026-07-01) i sidhuvudet
  // — samma "förklara vad det är, datumet"-feedback som dropdownens
  // månadsintervall ovan löser, bara för den redan valda perioden.
  const fmtPeriodDate = (iso) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' });
  const periodDateRange = `${fmtPeriodDate(periodStart)} – ${fmtPeriodDate(periodEnd)} ${year}`;

  // borderRadius top-hörn fyrkantiga (inte 12px runt om): sitter numera
  // flush direkt under Skatt och bokslut → Moms-flikens flikrad
  // (Taxes.jsx, "no space"-genomgången), en rundad topp mot en rak
  // flikrad lämnade en böjd glipa i hörnen.
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* Sidhuvud: period, datespan, antal underlag */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{t('ui.momsdeklaration')}</h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {periodDateRange} · {transactionCount} {transactionCount === 1 ? t('ui.underliggande_transaktion') : t('ui.underliggande_transaktioner')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={quarter} onChange={e => { setQuarter(Number(e.target.value)); setStep(1); }} disabled={isBooked} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>{t('ui.kvartal')} {q} ({QUARTER_MONTH_LABEL[q]})</option>)}
            </select>
            <select value={year} onChange={e => { setYear(Number(e.target.value)); setStep(1); }} disabled={isBooked} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
              {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {isBooked && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
                <Lock size={12} /> {t('ui.bokford')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <Stepper current={step} maxReached={maxReachedStep} isBooked={isBooked} onSelect={setStep} />

        {/* ── Steg 1: Kontrollera ── */}
        {step === 1 && (
          <div>
            {validation.errors.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-red-text)', fontWeight: 700, fontSize: '14px' }}>
                  <AlertCircle size={18} /> {validation.errors.length} {validation.errors.length === 1 ? t('ui.fel_maste_atgardas') : t('ui.fel_maste_atgardas')} {t('ui.innan_du_kan_ga_vidare')}
                </div>
                {validation.errors.map((err, i) => (
                  <button
                    key={i}
                    onClick={() => err.verificationId && onNavigateToVerification?.(err.verificationId)}
                    disabled={!err.verificationId}
                    style={{
                      textAlign: 'left', padding: '12px 14px', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)',
                      borderRadius: '8px', color: 'var(--status-red-text)', fontSize: '13px', cursor: err.verificationId ? 'pointer' : 'default',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontFamily: 'inherit',
                    }}
                  >
                    <span>{err.message}</span>
                    {err.verificationId && <ChevronRight size={15} style={{ flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', background: 'var(--status-green-bg)', border: '1px solid var(--status-green-bg)', borderRadius: '8px', color: 'var(--status-green-text)', fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>
                <CheckCircle2 size={18} /> {t('ui.inga_blockerande_fel_hittades_for_perioden')}
              </div>
            )}

            {periodWarnings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {periodWarnings.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '10px 12px', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', color: 'var(--status-amber-text)', fontSize: '13px' }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep(2)}
                disabled={!validation.canProceed}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px',
                  background: validation.canProceed ? 'var(--accent)' : 'var(--border)', color: validation.canProceed ? 'white' : 'var(--text-muted)',
                  border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: validation.canProceed ? 'pointer' : 'not-allowed',
                }}
              >
                {t('ui.ga_vidare_till_granska')} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Steg 2: Granska ── */}
        {step === 2 && (
          <div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-muted)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('ui.ruta')}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('ui.betydelse')}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('ui.belopp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rutorForDisplay.map((r) => {
                    const isNet = r.kind === 'net';
                    return (
                      <tr key={r.ruta} style={{ borderTop: '1px solid var(--border-light)', background: isNet ? 'var(--bg-muted)' : 'var(--bg-card)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>{r.ruta}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>
                          {isNet ? (isRefund ? t('ui.moms_att_aterfa') : t('ui.moms_att_betala')) : r.label}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: isNet ? 800 : 600, fontSize: isNet ? '16px' : '14px', color: isNet ? (isRefund ? 'var(--status-green-text)' : 'var(--status-red-text)') : 'var(--text-main)' }}>
                          {fmt(Math.abs(r.value))} {t('ui.kr')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {t('ui.alla_belopp_ar_avrundade_till_hela_kronor_standa')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{ padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>{t('ui.tillbaka_2')}</button>
              <button onClick={() => setStep(3)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                {t('ui.ga_vidare_till_bokfor')} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Steg 3: Bokför ── */}
        {step === 3 && (
          <div>
            {isBooked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', background: 'var(--status-green-bg)', border: '1px solid var(--status-green-bg)', borderRadius: '8px', color: 'var(--status-green-text)', fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
                <CheckCircle2 size={18} /> {t('ui.perioden_ar_redan_bokford')}{bookedInfo?.bookedAt ? new Date(bookedInfo.bookedAt).toLocaleDateString('sv-SE') : ''}{t('ui.en_ny_bokforing_skapas_inte_igen')}
              </div>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '16px' }}>
                  {t('ui.vid_bokforing_nollstalls_periodens_moms_konton_m')} <strong>{VAT_SETTLEMENT_ACCOUNT} {t('ui.redovisningskonto_for_moms')}</strong>:
                </p>
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-muted)' }}>
                        <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('ui.konto_3')}</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('ui.debet_2')}</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('ui.kredit_2')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementRows.map(row => (
                        <tr key={row.account} style={{ borderTop: '1px solid var(--border-light)', fontWeight: row.account === VAT_SETTLEMENT_ACCOUNT ? 700 : undefined }}>
                          <td style={{ padding: '10px 14px' }}>{row.account} {ACCOUNT_NAME[row.account] || ''}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.debet ? fmt(row.debet) : ''}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.kredit ? fmt(row.kredit) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} style={{ padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>{t('ui.tillbaka_2')}</button>
              {isBooked ? (
                <button onClick={() => setStep(4)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                  {t('ui.ga_vidare_till_lamna_in')} <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleBook}
                  disabled={booking}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: booking ? 'var(--text-muted)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: booking ? 'not-allowed' : 'pointer' }}
                >
                  <Lock size={16} /> {t('ui.bokfor_2')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Steg 4: Lämna in ── */}
        {step === 4 && (
          <div>
            {!isBooked && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px 14px', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', color: 'var(--status-amber-text)', fontSize: '13px', marginBottom: '20px' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{t('ui.perioden_ar_inte_bokford_an_beloppen_nedan_bygge')}</span>
              </div>
            )}

            <div className="form-row-2" style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <FileText size={22} color="var(--accent)" />
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{t('ui.ladda_ner_fil_for_uppladdning_xml')}</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {t('ui.filen_du_laddar_upp_under_deklarera_via_fil_hos')}
                </p>
                <button
                  onClick={handleDownloadXml}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  <Download size={14} /> {t('ui.ladda_ner_fil_for_uppladdning_xml')}
                </button>
                {hasReverseCharge && (
                  <p style={{ fontSize: '12px', color: 'var(--status-amber-text, #92400e)', background: 'var(--status-amber-bg, #fef3c7)', borderRadius: '8px', padding: '9px 11px', margin: 0, lineHeight: 1.5 }}>
                    {t('ui.perioden_har_belopp_i_ruta')} {unverifiedRutor.join(', ')}{t('ui.filen_med_de_rutorna_ar_annu_inte_provad_hos_ska')}
                  </p>
                )}
                {xmlError && (
                  <p style={{ fontSize: '12px', color: 'var(--status-red-text)', margin: 0, lineHeight: 1.4 }}>{xmlError}</p>
                )}
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <Download size={22} color="var(--accent)" />
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{t('ui.ladda_ner_momsdeklaration_pdf')}</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {t('ui.sammanstallning_med_skatteverkets_rutnummer_och')}
                </p>
                <button
                  onClick={() => downloadVatDeclarationPdf(
                    { company, periodLabel, rounded, rutor: rutorForDisplay },
                    `momsdeklaration-${periodKey}.pdf`
                  )}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  <Download size={14} /> {t('ui.ladda_ner_momsdeklaration_pdf')}
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', marginBottom: '10px' }}>{t('ui.sa_har_lamnar_du_in_hos_skatteverket')}</div>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                <li>{t('ui.ladda_ner_xml_filen_ovan')}</li>
                <li>{t('ui.logga_in_pa_skatteverket_se_med_bankid')}</li>
                <li>{t('ui.oppna_moms_och_arbetsgivardeklarationer_och_valj')}</li>
                <li>{t('ui.ladda_upp_filen_granska_och_signera')}</li>
              </ol>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '12px 0 16px' }}>
                {t('ui.vill_du_hellre_fylla_i_rutorna_for_hand_laddar_d')}
              </p>
              <a
                href="https://www.skatteverket.se/foretag"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
              >
                {t('ui.oppna_skatteverket_se')} <ExternalLink size={13} />
              </a>
            </div>

            {onToggleFiled && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '16px', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {filings[`vat:${periodKey}`]?.at
                    ? t('ui.markerad_som_inlamnad', { v0: new Date(filings[`vat:${periodKey}`].at).toLocaleDateString('sv-SE') })
                    : t('ui.har_du_laddat_upp_deklarationen_hos_skatteverket')}
                </div>
                <button type="button" onClick={() => onToggleFiled(`vat:${periodKey}`)} style={{ padding: '8px 16px', background: filings[`vat:${periodKey}`]?.at ? 'var(--bg-card)' : 'var(--accent)', color: filings[`vat:${periodKey}`]?.at ? 'var(--text-main)' : 'white', border: filings[`vat:${periodKey}`]?.at ? '1px solid var(--border)' : 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  {filings[`vat:${periodKey}`]?.at ? t('ui.angra') : t('ui.markera_som_inlamnad')}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px' }}>
              <button onClick={() => setStep(3)} style={{ padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>{t('ui.tillbaka_2')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
