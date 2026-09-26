import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Download, Lock, FileText, ExternalLink } from './icons';
import {
  computeVatPeriod, roundedVatPeriod, validateVatPeriod, compareToPreviousPeriod, vatRutaValue,
  quarterToRange, previousQuarterRange,
} from '../utils/vatCalculation';
import { VAT_RUTOR, OUTPUT_VAT_ACCOUNT_BY_RATE, INPUT_VAT_ACCOUNT, VAT_SETTLEMENT_ACCOUNT, REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE, REVERSE_INPUT_VAT_ACCOUNT } from '../utils/vatConfig';
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
  { id: 1, label: 'Kontrollera' },
  { id: 2, label: 'Granska' },
  { id: 3, label: 'Bokför' },
  { id: 4, label: 'Lämna in' },
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
  const hasReverseCharge = !REVERSE_CHARGE_ESKD_VERIFIED && (
    (rounded.reversePurchaseEu || 0) !== 0 || (rounded.reversePurchaseNonEu || 0) !== 0 || (rounded.inputVatReverse || 0) !== 0
    || [25, 12, 6].some(r => (rounded.reverseVatByRate?.[r] || 0) !== 0)
  );

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

  const periodLabel = `Kvartal ${quarter} (${periodStart} till ${periodEnd})`;
  // Läsbart datumspann istället för råa ISO-datum (2026-07-01) i sidhuvudet
  // — samma "förklara vad det är, datumet"-feedback som dropdownens
  // månadsintervall ovan löser, bara för den redan valda perioden.
  const fmtPeriodDate = (iso) => new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
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
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Momsdeklaration</h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {periodDateRange} · {transactionCount} {transactionCount === 1 ? 'underliggande transaktion' : 'underliggande transaktioner'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={quarter} onChange={e => { setQuarter(Number(e.target.value)); setStep(1); }} disabled={isBooked} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>Kvartal {q} ({QUARTER_MONTH_LABEL[q]})</option>)}
            </select>
            <select value={year} onChange={e => { setYear(Number(e.target.value)); setStep(1); }} disabled={isBooked} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
              {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {isBooked && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
                <Lock size={12} /> Bokförd
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
                  <AlertCircle size={18} /> {validation.errors.length} {validation.errors.length === 1 ? 'fel måste åtgärdas' : 'fel måste åtgärdas'} innan du kan gå vidare
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
                <CheckCircle2 size={18} /> Inga blockerande fel hittades för perioden.
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
                Gå vidare till Granska <ChevronRight size={16} />
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
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Ruta</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Betydelse</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Belopp</th>
                  </tr>
                </thead>
                <tbody>
                  {rutorForDisplay.map((r) => {
                    const isNet = r.kind === 'net';
                    return (
                      <tr key={r.ruta} style={{ borderTop: '1px solid var(--border-light)', background: isNet ? 'var(--bg-muted)' : 'var(--bg-card)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>{r.ruta}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>
                          {isNet ? (isRefund ? 'Moms att återfå' : 'Moms att betala') : r.label}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: isNet ? 800 : 600, fontSize: isNet ? '16px' : '14px', color: isNet ? (isRefund ? 'var(--status-green-text)' : 'var(--status-red-text)') : 'var(--text-main)' }}>
                          {fmt(Math.abs(r.value))} kr
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Alla belopp är avrundade till hela kronor (standard matematisk avrundning) — samma avrundade belopp används i bokföringen i Steg 3 och i exporten i Steg 4.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{ padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>Tillbaka</button>
              <button onClick={() => setStep(3)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                Gå vidare till Bokför <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Steg 3: Bokför ── */}
        {step === 3 && (
          <div>
            {isBooked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', background: 'var(--status-green-bg)', border: '1px solid var(--status-green-bg)', borderRadius: '8px', color: 'var(--status-green-text)', fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
                <CheckCircle2 size={18} /> Perioden är redan bokförd ({bookedInfo?.bookedAt ? new Date(bookedInfo.bookedAt).toLocaleDateString('sv-SE') : ''}). En ny bokföring skapas inte igen.
              </div>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '16px' }}>
                  Vid bokföring nollställs periodens moms-konton mot <strong>{VAT_SETTLEMENT_ACCOUNT} Redovisningskonto för moms</strong>:
                </p>
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-muted)' }}>
                        <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>KONTO</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>DEBET</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>KREDIT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[25, 12, 6].filter(r => rounded.outputVatByRate[r] !== 0).map(r => (
                        <tr key={r} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '10px 14px' }}>{OUTPUT_VAT_ACCOUNT_BY_RATE[r]} Utgående moms, {r}%</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(rounded.outputVatByRate[r])}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}></td>
                        </tr>
                      ))}
                      {[25, 12, 6].filter(r => (rounded.reverseVatByRate?.[r] || 0) !== 0).map(r => (
                        <tr key={`rev-${r}`} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '10px 14px' }}>{REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE[r]} Utgående moms omvänd skattskyldighet, {r}%</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(rounded.reverseVatByRate[r])}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}></td>
                        </tr>
                      ))}
                      {rounded.inputVatDomestic !== 0 && (
                        <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '10px 14px' }}>{INPUT_VAT_ACCOUNT} Ingående moms</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}></td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(rounded.inputVatDomestic)}</td>
                        </tr>
                      )}
                      {rounded.inputVatReverse !== 0 && (
                        <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '10px 14px' }}>{REVERSE_INPUT_VAT_ACCOUNT} Beräknad ingående moms på förvärv från utlandet</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}></td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(rounded.inputVatReverse)}</td>
                        </tr>
                      )}
                      {rounded.netToPay !== 0 && (
                        <tr style={{ borderTop: '1px solid var(--border-light)', fontWeight: 700 }}>
                          <td style={{ padding: '10px 14px' }}>{VAT_SETTLEMENT_ACCOUNT} Redovisningskonto för moms</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{isRefund ? fmt(Math.abs(rounded.netToPay)) : ''}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{!isRefund ? fmt(rounded.netToPay) : ''}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} style={{ padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>Tillbaka</button>
              {isBooked ? (
                <button onClick={() => setStep(4)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                  Gå vidare till Lämna in <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleBook}
                  disabled={booking}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: booking ? 'var(--text-muted)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: booking ? 'not-allowed' : 'pointer' }}
                >
                  <Lock size={16} /> Bokför
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
                <span>Perioden är inte bokförd än. Beloppen nedan bygger på nuvarande bokföring men kan ändras fram tills du bokför i Steg 3.</span>
              </div>
            )}

            <div className="form-row-2" style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <FileText size={22} color="var(--accent)" />
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>Ladda ner fil för uppladdning (XML)</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Filen du laddar upp under Deklarera via fil hos Skatteverket — innehåller samma avrundade belopp som PDF:en.
                </p>
                <button
                  onClick={handleDownloadXml}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  <Download size={14} /> Ladda ner fil för uppladdning (XML)
                </button>
                {hasReverseCharge && (
                  <p style={{ fontSize: '12px', color: 'var(--status-amber-text, #92400e)', background: 'var(--status-amber-bg, #fef3c7)', borderRadius: '8px', padding: '9px 11px', margin: 0, lineHeight: 1.5 }}>
                    Perioden innehåller omvänd skattskyldighet (ruta 20–24 och 30–32). Filen med de rutorna är ännu inte provad hos Skatteverket. Kontrollera värdena i e-tjänsten efter uppladdningen, eller fyll i de rutorna för hand från PDF:en.
                  </p>
                )}
                {xmlError && (
                  <p style={{ fontSize: '12px', color: 'var(--status-red-text)', margin: 0, lineHeight: 1.4 }}>{xmlError}</p>
                )}
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <Download size={22} color="var(--accent)" />
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>Ladda ner momsdeklaration (PDF)</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Sammanställning med Skatteverkets rutnummer och avrundade belopp, redo att skriva av för hand.
                </p>
                <button
                  onClick={() => downloadVatDeclarationPdf(
                    { company, periodLabel, rounded, rutor: rutorForDisplay },
                    `momsdeklaration-${periodKey}.pdf`
                  )}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  <Download size={14} /> Ladda ner momsdeklaration (PDF)
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', marginBottom: '10px' }}>Så här lämnar du in hos Skatteverket</div>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                <li>Ladda ner XML-filen ovan.</li>
                <li>Logga in på skatteverket.se med BankID.</li>
                <li>Öppna Moms- och arbetsgivardeklarationer och välj Deklarera via fil.</li>
                <li>Ladda upp filen, granska och signera.</li>
              </ol>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '12px 0 16px' }}>
                Vill du hellre fylla i rutorna för hand laddar du ner PDF:en och skriver av beloppen (i hela kronor).
              </p>
              <a
                href="https://www.skatteverket.se/foretag"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
              >
                Öppna skatteverket.se <ExternalLink size={13} />
              </a>
            </div>

            {onToggleFiled && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '16px', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {filings[`vat:${periodKey}`]?.at
                    ? `Markerad som inlämnad ${new Date(filings[`vat:${periodKey}`].at).toLocaleDateString('sv-SE')}.`
                    : 'Har du laddat upp deklarationen hos Skatteverket? Markera den som inlämnad så håller Bokix reda på det.'}
                </div>
                <button type="button" onClick={() => onToggleFiled(`vat:${periodKey}`)} style={{ padding: '8px 16px', background: filings[`vat:${periodKey}`]?.at ? 'var(--bg-card)' : 'var(--accent)', color: filings[`vat:${periodKey}`]?.at ? 'var(--text-main)' : 'white', border: filings[`vat:${periodKey}`]?.at ? '1px solid var(--border)' : 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  {filings[`vat:${periodKey}`]?.at ? 'Ångra' : 'Markera som inlämnad'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px' }}>
              <button onClick={() => setStep(3)} style={{ padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>Tillbaka</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
