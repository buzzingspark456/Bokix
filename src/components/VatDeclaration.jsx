import React, { useState, useMemo, useRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Download, Lock, FileText } from 'lucide-react';
import {
  computeVatPeriod, roundedVatPeriod, validateVatPeriod, compareToPreviousPeriod,
  quarterToRange, previousQuarterRange,
} from '../utils/vatCalculation';
import { VAT_RUTOR, OUTPUT_VAT_ACCOUNT_BY_RATE, INPUT_VAT_ACCOUNT, VAT_SETTLEMENT_ACCOUNT } from '../utils/vatConfig';
import { downloadVatDeclarationPdf } from '../utils/vatDeclarationExport';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(v || 0);

const STEPS = [
  { id: 1, label: 'Kontrollera' },
  { id: 2, label: 'Granska' },
  { id: 3, label: 'Bokför' },
  { id: 4, label: 'Lämna in' },
];

function Stepper({ current, maxReached }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
      {STEPS.map((step, i) => {
        const isDone = step.id < current || (step.id <= maxReached && step.id !== current);
        const isActive = step.id === current;
        return (
          <React.Fragment key={step.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? '#1a3028' : (isDone ? '#dcfce7' : '#f1f5f9'),
                color: isActive ? 'white' : (isDone ? '#15803d' : '#94a3b8'),
                fontWeight: 700, fontSize: '13px', border: isActive ? 'none' : '1px solid transparent',
                flexShrink: 0,
              }}>
                {isDone ? <CheckCircle2 size={17} /> : step.id}
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: isActive ? 700 : 500, color: isActive ? '#111' : '#6b7280', whiteSpace: 'nowrap' }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: step.id < current ? '#bbf7d0' : '#e4e4e7', margin: '0 10px 20px' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function VatDeclaration({
  verifications = [], invoices = [], expenses = [], accounts = [], company = {},
  vatPeriods = {}, onBookPeriod, onNavigateToVerification,
}) {
  const today = new Date();
  const defaultQuarter = Math.floor(today.getMonth() / 3) + 1;
  const [year, setYear] = useState(today.getFullYear());
  const [quarter, setQuarter] = useState(defaultQuarter);
  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState(false);
  // Ref, inte state — muteras synkront och skyddar mot dubbelklick även
  // innan React hunnit rendera om (useState-uppdateringar batchas).
  const bookingRef = useRef(false);

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

  const rutorForDisplay = VAT_RUTOR.map(r => {
    let value = null;
    if (r.kind === 'sales') value = rounded.underlagByRate[r.rate];
    else if (r.kind === 'output') value = rounded.outputVatByRate[r.rate];
    else if (r.kind === 'input') value = rounded.inputVat;
    else if (r.kind === 'net') value = rounded.netToPay;
    return { ...r, value };
  }).filter(r => r.kind === 'net' || (r.value ?? 0) !== 0);

  const isRefund = rounded.netToPay < 0;

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

  const periodLabel = `Kvartal ${quarter} (${periodStart} till ${periodEnd})`;

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
      {/* Sidhuvud: period, datespan, antal underlag */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #e4e4e7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111' }}>Momsdeklaration</h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              {periodStart} till {periodEnd} · {transactionCount} {transactionCount === 1 ? 'underliggande transaktion' : 'underliggande transaktioner'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={quarter} onChange={e => { setQuarter(Number(e.target.value)); setStep(1); }} disabled={isBooked} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', background: 'white' }}>
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>Kvartal {q}</option>)}
            </select>
            <select value={year} onChange={e => { setYear(Number(e.target.value)); setStep(1); }} disabled={isBooked} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', background: 'white' }}>
              {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {isBooked && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
                <Lock size={12} /> Bokförd
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <Stepper current={step} maxReached={maxReachedStep} />

        {/* ── Steg 1: Kontrollera ── */}
        {step === 1 && (
          <div>
            {validation.errors.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 700, fontSize: '14px' }}>
                  <AlertCircle size={18} /> {validation.errors.length} {validation.errors.length === 1 ? 'fel måste åtgärdas' : 'fel måste åtgärdas'} innan du kan gå vidare
                </div>
                {validation.errors.map((err, i) => (
                  <button
                    key={i}
                    onClick={() => err.verificationId && onNavigateToVerification?.(err.verificationId)}
                    disabled={!err.verificationId}
                    style={{
                      textAlign: 'left', padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: '8px', color: '#991b1b', fontSize: '13px', cursor: err.verificationId ? 'pointer' : 'default',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontFamily: 'inherit',
                    }}
                  >
                    <span>{err.message}</span>
                    {err.verificationId && <ChevronRight size={15} style={{ flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>
                <CheckCircle2 size={18} /> Inga blockerande fel hittades för perioden.
              </div>
            )}

            {periodWarnings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {periodWarnings.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '13px' }}>
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
                  background: validation.canProceed ? '#1a3028' : '#e5e7eb', color: validation.canProceed ? 'white' : '#9ca3af',
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
            <div style={{ border: '1px solid #e4e4e7', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Ruta</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Betydelse</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Belopp</th>
                  </tr>
                </thead>
                <tbody>
                  {rutorForDisplay.map((r, i) => {
                    const isNet = r.kind === 'net';
                    return (
                      <tr key={r.ruta} style={{ borderTop: '1px solid #f1f5f9', background: isNet ? '#fafafa' : 'white' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111' }}>{r.ruta}</td>
                        <td style={{ padding: '12px 16px', color: '#374151' }}>
                          {isNet ? (isRefund ? 'Moms att återfå' : 'Moms att betala') : r.label}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: isNet ? 800 : 600, fontSize: isNet ? '16px' : '14px', color: isNet ? (isRefund ? '#15803d' : '#dc2626') : '#111' }}>
                          {fmt(Math.abs(r.value))} kr
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>
              Alla belopp är avrundade till hela kronor (standard matematisk avrundning) — samma avrundade belopp används i bokföringen i Steg 3 och i exporten i Steg 4.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{ padding: '10px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: '#374151' }}>Tillbaka</button>
              <button onClick={() => setStep(3)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                Gå vidare till Bokför <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Steg 3: Bokför ── */}
        {step === 3 && (
          <div>
            {isBooked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
                <CheckCircle2 size={18} /> Perioden är redan bokförd ({bookedInfo?.bookedAt ? new Date(bookedInfo.bookedAt).toLocaleDateString('sv-SE') : ''}). En ny bokföring skapas inte igen.
              </div>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: '#374151', marginBottom: '16px' }}>
                  Vid bokföring nollställs periodens moms-konton mot <strong>{VAT_SETTLEMENT_ACCOUNT} Redovisningskonto för moms</strong>:
                </p>
                <div style={{ border: '1px solid #e4e4e7', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '11px', color: '#64748b', fontWeight: 700 }}>KONTO</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: '11px', color: '#64748b', fontWeight: 700 }}>DEBET</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: '11px', color: '#64748b', fontWeight: 700 }}>KREDIT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[25, 12, 6].filter(r => rounded.outputVatByRate[r] !== 0).map(r => (
                        <tr key={r} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px' }}>{OUTPUT_VAT_ACCOUNT_BY_RATE[r]} Utgående moms, {r}%</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(rounded.outputVatByRate[r])}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}></td>
                        </tr>
                      ))}
                      {rounded.inputVat !== 0 && (
                        <tr style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px' }}>{INPUT_VAT_ACCOUNT} Ingående moms</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}></td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(rounded.inputVat)}</td>
                        </tr>
                      )}
                      {rounded.netToPay !== 0 && (
                        <tr style={{ borderTop: '1px solid #f1f5f9', fontWeight: 700 }}>
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
              <button onClick={() => setStep(2)} style={{ padding: '10px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: '#374151' }}>Tillbaka</button>
              {isBooked ? (
                <button onClick={() => setStep(4)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                  Gå vidare till Lämna in <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleBook}
                  disabled={booking}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: booking ? '#94a3b8' : '#1a3028', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: booking ? 'not-allowed' : 'pointer' }}
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '13px', marginBottom: '20px' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Perioden är inte bokförd än. Beloppen nedan bygger på nuvarande bokföring men kan ändras fram tills du bokför i Steg 3.</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ border: '1px solid #e4e4e7', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', opacity: 0.6 }}>
                <FileText size={22} color="#9ca3af" />
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#374151' }}>Ladda ner XML-fil</div>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                  Inte tillgänglig än — filformatet kunde inte verifieras med full säkerhet mot Skatteverkets specifikation. Använd PDF-vägen nedan tills vidare.
                </p>
                <button disabled style={{ padding: '8px 16px', background: '#f1f5f9', color: '#9ca3af', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'not-allowed' }}>
                  Kommer snart
                </button>
              </div>

              <div style={{ border: '1px solid #e4e4e7', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <Download size={22} color="#1a3028" />
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#111' }}>Ladda ner PDF</div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  Sammanställning med Skatteverkets rutnummer och avrundade belopp, redo att skriva av för hand.
                </p>
                <button
                  onClick={() => downloadVatDeclarationPdf(
                    { company, periodLabel, rounded, rutor: rutorForDisplay },
                    `momsdeklaration-${periodKey}.pdf`
                  )}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  <Download size={14} /> Ladda ner PDF
                </button>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e4e4e7', borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#111', marginBottom: '10px' }}>Så här lämnar du in hos Skatteverket</div>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px', color: '#374151', lineHeight: 1.5 }}>
                <li>Logga in på skatteverket.se med BankID.</li>
                <li>Öppna Moms- och arbetsgivardeklarationer och välj Deklarera via fil, eller fyll i uppgifterna manuellt.</li>
                <li>Fyll i rutorna med beloppen från PDF:en ovan (i hela kronor).</li>
                <li>Granska och signera.</li>
              </ol>
              <p style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '12px', marginBottom: 0 }}>
                Vill du hellre fylla i rutorna för hand laddar du ner PDF:en och skriver av beloppen (i hela kronor).
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px' }}>
              <button onClick={() => setStep(3)} style={{ padding: '10px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: '#374151' }}>Tillbaka</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
