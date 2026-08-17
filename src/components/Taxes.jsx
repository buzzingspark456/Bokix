import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, Clock, Circle, Lock, Calculator, ChevronRight, ExternalLink, Info, Download, Users, Loader2,
} from 'lucide-react';
import VatDeclaration from './VatDeclaration';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { detectOrgType } from '../utils/orgType';
import { summarizeAnnualPayrollByEmployee, neededTaxTableKeysForYear, downloadKuPdf } from '../utils/kuExport';
import { preloadSkattetabell } from '../utils/skattetabell';

const fmt = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

export default function Taxes({
  company, verifications = [], invoices = [], expenses = [], accounts = [],
  payrollRuns = [], vatPeriods = {}, onBookVatPeriod, onNavigateToVerification,
  onAddVerification, setCompanyInfo, onNavigateToTab,
}) {
  const currentYear = new Date().getFullYear().toString();
  const orgType = detectOrgType(company?.orgNr);
  const isSoleProp = orgType === 'Enskild firma';

  // Kontrolluppgifter (KU) — förvalt till föregående inkomstår, eftersom
  // det är vad man normalt lämnar in (deadline 31 januari), men innevarande
  // år går också att välja.
  const [kuYear, setKuYear] = useState(String(Number(currentYear) - 1));
  const [kuTablesReady, setKuTablesReady] = useState(false);
  const [kuEmployeeTotals, setKuEmployeeTotals] = useState([]);

  // Bugkritiskt: skattetabellerna för året måste vara inlästa (samma
  // preload-mönster som PayrollRunDetail.jsx) INNAN summeringen räknas —
  // annars faller varje anställds skatteavdrag tyst tillbaka till 0 kr,
  // se kuExport.js. Beräkningen görs därför i en effekt, inte direkt vid
  // render.
  useEffect(() => {
    let cancelled = false;
    setKuTablesReady(false);
    const keys = neededTaxTableKeysForYear(payrollRuns, kuYear);
    Promise.all(keys.map(key => {
      const [year, tabellnr] = key.split(':');
      return preloadSkattetabell(year, tabellnr);
    }))
      .then(() => {
        if (cancelled) return;
        setKuEmployeeTotals(summarizeAnnualPayrollByEmployee(payrollRuns, kuYear));
        setKuTablesReady(true);
      })
      .catch(err => {
        console.error('Kunde inte läsa in skattetabeller för KU-sammanställningen:', err);
        if (!cancelled) { setKuEmployeeTotals([]); setKuTablesReady(true); }
      });
    return () => { cancelled = true; };
  }, [payrollRuns, kuYear]);

  const checklist = company?.yearEndChecklist?.[currentYear] || {};
  const lockedYears = company?.lockedFiscalYears || {};
  const closing = lockedYears[currentYear];
  const isLocked = Boolean(closing);

  // Steg 2/3: fakturor som fortfarande ligger som utkast (inte bokförda) i år.
  const draftCustomerInvoices = invoices.filter(i => (i.type || 'invoice') !== 'quote' && i.status === 'draft' && (i.date || '').startsWith(currentYear));
  const draftSupplierInvoices = expenses.filter(e => e.type === 'supplier_invoice' && e.status === 'draft' && (e.date || '').startsWith(currentYear));

  // Steg 4: har årets sista lönekörning (december) bokförts?
  const runsThisYear = payrollRuns.filter(r => (r.period || '').startsWith(currentYear));
  const decemberRunBooked = runsThisYear.some(r => r.period === `${currentYear}-12` && r.completedSteps?.includes('booked'));
  const anyRunBookedThisYear = runsThisYear.some(r => r.completedSteps?.includes('booked'));

  // Årets resultat — exakt samma beräkning som RÅ Resultat på Startsidan,
  // så siffran som visas här aldrig kan divergera från den man redan sett.
  let yearRevenue = 0, yearCosts = 0;
  verifications.forEach(v => {
    if ((v.status || 'booked') === 'draft') return;
    if (!(v.date || '').startsWith(currentYear)) return;
    v.rows.forEach(r => {
      if (r.account.startsWith('3')) yearRevenue += (getKredit(r) - getDebet(r));
      else if (['4', '5', '6', '7'].some(p => r.account.startsWith(p))) yearCosts += (getDebet(r) - getKredit(r));
    });
  });
  const yearResult = isLocked ? closing.result : (yearRevenue - yearCosts);

  const toggleManualStep = (key) => {
    if (isLocked) return;
    setCompanyInfo(prev => ({
      ...prev,
      yearEndChecklist: {
        ...prev.yearEndChecklist,
        [currentYear]: { ...(prev.yearEndChecklist?.[currentYear] || {}), [key]: !(prev.yearEndChecklist?.[currentYear]?.[key]) },
      },
    }));
  };

  const steps = [
    {
      id: 1, kind: 'manual', key: 'bankRecon', title: 'Avstämning bankkonto',
      status: checklist.bankRecon ? 'Klar' : 'Ej påbörjad',
      hint: 'Stäm av att bankkontots saldo i Bokix matchar kontoutdraget, markera sedan som klar.',
    },
    {
      id: 2, kind: 'auto', title: 'Bokför årets sista kundfakturor',
      status: draftCustomerInvoices.length === 0 ? 'Klar' : 'Pågår',
      hint: draftCustomerInvoices.length > 0 ? `${draftCustomerInvoices.length} obokförd${draftCustomerInvoices.length === 1 ? '' : 'a'} kundfaktura${draftCustomerInvoices.length === 1 ? '' : 'r'} kvar.` : 'Inga obokförda kundfakturor i år.',
      tab: 'invoices',
    },
    {
      id: 3, kind: 'auto', title: 'Bokför årets sista leverantörsfakturor',
      status: draftSupplierInvoices.length === 0 ? 'Klar' : 'Pågår',
      hint: draftSupplierInvoices.length > 0 ? `${draftSupplierInvoices.length} obokförd${draftSupplierInvoices.length === 1 ? '' : 'a'} leverantörsfaktura${draftSupplierInvoices.length === 1 ? '' : 'r'} kvar.` : 'Inga obokförda leverantörsfakturor i år.',
      tab: 'expenses',
    },
    {
      id: 4, kind: 'auto', title: 'Gör årets sista lönekörning',
      status: decemberRunBooked ? 'Klar' : (anyRunBookedThisYear || runsThisYear.length > 0) ? 'Pågår' : 'Ej påbörjad',
      hint: decemberRunBooked ? 'Decemberlönen är bokförd.' : 'Kör och bokför december månads lönekörning innan året stängs.',
      tab: 'payroll',
    },
    {
      id: 5, kind: 'manual', key: 'inventory', title: 'Inventering och lager (om tillämpligt)',
      status: checklist.inventory ? 'Klar' : 'Ej påbörjad',
      hint: 'Räkna och värdera eventuellt varulager per bokslutsdagen, markera sedan som klar. Inte tillämpligt för alla verksamheter.',
    },
    {
      id: 6, kind: 'auto', title: 'Beräkna och bokför årets resultat',
      status: isLocked ? 'Klar' : 'Ej påbörjad',
      hint: 'Bokförs automatiskt som en bokslutstransaktion när räkenskapsåret låses nedan.',
    },
    {
      id: 7, kind: 'auto', title: 'Lås räkenskapsåret',
      status: isLocked ? 'Klar' : 'Ej påbörjad',
      hint: isLocked ? `Låst ${new Date(closing.lockedAt).toLocaleDateString('sv-SE')}.` : 'Blir tillgänglig när alla steg ovan är klara.',
    },
  ];

  // Bara steg 1–5 kan bli klara innan låsning — steg 6 ("bokför årets
  // resultat") och steg 7 ("lås räkenskapsåret") ÄR själva låsningen och
  // blir Klar som en följd av den, inte en förutsättning för den. Att
  // kräva steg 6 här skulle göra knappen evigt inaktiv.
  const stepsBeforeLock = steps.slice(0, 5);
  const canLock = !isLocked && stepsBeforeLock.every(s => s.status === 'Klar');

  const handleLockYear = () => {
    if (!canLock) return;

    // Bokslutstransaktion: nollställ alla resultatkonton (klass 3–7) med
    // aktivitet i år och för nettot (årets resultat) till 2099. Konstruerad
    // ur exakt samma radsummor som `yearResult` ovan, så den är per
    // definition balanserad oavsett avrundningar i enskilda verifikationer.
    const perAccount = {};
    verifications.forEach(v => {
      if ((v.status || 'booked') === 'draft') return;
      if (!(v.date || '').startsWith(currentYear)) return;
      v.rows.forEach(r => {
        if (!['3', '4', '5', '6', '7'].some(p => r.account.startsWith(p))) return;
        perAccount[r.account] = (perAccount[r.account] || 0) + (getDebet(r) - getKredit(r));
      });
    });

    const rows = [];
    Object.entries(perAccount).forEach(([account, netDebet]) => {
      if (!netDebet) return;
      if (netDebet > 0) rows.push({ account, debet: 0, kredit: netDebet });
      else rows.push({ account, debet: -netDebet, kredit: 0 });
    });
    if (yearResult >= 0) rows.push({ account: '2099', debet: 0, kredit: yearResult });
    else rows.push({ account: '2099', debet: -yearResult, kredit: 0 });

    if (rows.length > 0) {
      onAddVerification({
        date: `${currentYear}-12-31`,
        description: `Bokslutstransaktion ${currentYear}: Årets resultat`,
        source: 'year_end_close',
        sourceId: `yearclose_${currentYear}`,
        rows,
      });
    }

    setCompanyInfo(prev => ({
      ...prev,
      lockedFiscalYears: { ...prev.lockedFiscalYears, [currentYear]: { lockedAt: new Date().toISOString(), result: yearResult } },
    }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Klar': return <CheckCircle2 size={18} color="#16a34a" />;
      case 'Pågår': return <Clock size={18} color="#f59e0b" />;
      default: return <Circle size={18} color="#cbd5e1" />;
    }
  };
  const getStatusBg = (status) => (status === 'Klar' ? '#dcfce7' : status === 'Pågår' ? '#fef3c7' : '#f8fafc');
  const getStatusColor = (status) => (status === 'Klar' ? '#15803d' : status === 'Pågår' ? '#b45309' : '#64748b');

  return (
    // page-shell/page-shell-scroll (mobil): sidan hade tidigare en FAST
    // header + en oberoende inre skrollyta (samma monster som fungerar
    // bra pa korta headers som Fakturor/Kontakter) — men den har sidans
    // header ar sa hog (titel + tre rader forklaringstext) att den permanent
    // ater upp en fjardedel av en telefonskarm. Under 768px skrollar hela
    // sidan (header inklusive) tillsammans som en vanlig webbsida istallet,
    // via .main-content-inner:s redan befintliga scroll (index.css).
    <div className="page-shell" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      {/* ── Header ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '24px 32px', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Skatt och bokslut</h1>
        {/* page-desc-long (Fortnox-terugkoppling): den här radar sig till
            tre rader pa en 375px-skarm och lag da fast permanent hogst upp
            — halften av en telefonskarm aten upp av forklarande text, inte
            av nagot man faktiskt kom hit for att gora. Dold pa mobil,
            samma monster i Payroll.jsx. */}
        <p className="page-desc-long" style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b', maxWidth: '600px', lineHeight: '1.5' }}>
          Sammanställning för momsredovisning, checklista för årsbokslut och kommande viktiga datum för skatter och avgifter.
        </p>
      </div>

      {/* ── Content Area ── */}
      <div className="page-shell-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Momsdeklaration */}
          <VatDeclaration
            verifications={verifications}
            invoices={invoices}
            expenses={expenses}
            accounts={accounts}
            company={company}
            vatPeriods={vatPeriods}
            onBookPeriod={onBookVatPeriod}
            onNavigateToVerification={onNavigateToVerification}
          />

          {/* Årsbokslut */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e4e4e7' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Årsbokslut {currentYear}
                {isLocked && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: '#f1f5f9', color: '#334155', fontSize: '12px', fontWeight: 600 }}>
                    <Lock size={12} /> Räkenskapsår låst
                  </span>
                )}
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b' }}>
                Följ stegen nedan för att stänga räkenskapsåret. När alla steg är klara kan du låsa året och generera bokslutet.
              </p>
            </div>

            <div style={{ padding: '0' }}>
              {steps.map((step, index) => {
                const clickable = step.kind === 'manual' && !isLocked;
                return (
                  <div
                    key={step.id}
                    className="checklist-row-stack"
                    onClick={clickable ? () => toggleManualStep(step.key) : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 24px', gap: '16px',
                      borderBottom: index < steps.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: step.status === 'Klar' ? '#fafafa' : 'white',
                      cursor: clickable ? 'pointer' : 'default',
                    }}
                  >
                    {/* Bugkritiskt (mobil): utan flex:1 här startade den här
                        gruppens bredd fran sitt eget max-content (titel +
                        hint helt outbrutna), och när den sen tvingades
                        krympa av .flexShrink:0-statuspillret till höger
                        kollapsade textblocket ner mot sin min-content-bredd
                        — ett ord per rad. flex:1 (flex-basis:0%, inte auto)
                        ger den istallet en förutsägbar andel av radens
                        FAKTISKA bredd direkt, ingen våldsam efterhands-
                        krympning. */}
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: '#f1f5f9', color: '#64748b', fontSize: '13px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {step.id}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14px', fontWeight: 500,
                          color: step.status === 'Klar' ? '#94a3b8' : '#111',
                          textDecoration: step.status === 'Klar' ? 'line-through' : 'none',
                        }}>
                          {step.title}
                        </div>
                        {step.hint && (
                          <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>{step.hint}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {step.tab && step.status !== 'Klar' && onNavigateToTab && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigateToTab(step.tab); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer', color: '#3d7a2e', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', padding: '2px' }}
                        >
                          Åtgärda <ChevronRight size={12} />
                        </button>
                      )}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                        background: getStatusBg(step.status), color: getStatusColor(step.status),
                      }}>
                        {getStatusIcon(step.status)}
                        {step.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
                <Calculator size={16} /> {isLocked ? 'Bokfört resultat' : 'Beräknat resultat'}: <strong style={{ color: yearResult >= 0 ? '#15803d' : '#dc2626' }}>{fmt(yearResult)}</strong>
              </div>
              <button
                onClick={handleLockYear}
                disabled={!canLock}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                  background: isLocked ? '#16a34a' : canLock ? '#3d7a2e' : '#94a3b8',
                  border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600,
                  cursor: canLock ? 'pointer' : 'not-allowed',
                }}
              >
                <Lock size={16} /> {isLocked ? 'Räkenskapsår låst' : 'Lås räkenskapsår och skapa bokslut'}
              </button>
            </div>

            {/* Bolagsformsspecifik hjälptext + källor — enligt Skatteverkets
                regler: bokslutet ska innehålla balans- och resultaträkning,
                förenklat årsbokslut går bra upp till 3 Mkr i nettoomsättning,
                och en enskild firma deklarerar resultatet vidare med en
                NE-bilaga (inte en årsredovisning). */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e4e4e7', background: 'white' }}>
              <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: '#64748b', lineHeight: 1.6 }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: '#94a3b8' }} />
                <div>
                  {isSoleProp ? (
                    <span>Som enskild firma deklarerar du resultatet vidare med en <strong>NE-bilaga</strong> i din inkomstdeklaration, efter att bokslutet är klart.</span>
                  ) : (
                    <span>Bokslutet ska innehålla en balans- och resultaträkning. Förenklat årsbokslut kan användas om nettoomsättningen normalt inte överstiger 3 miljoner kr per år — annars krävs ett fullständigt årsbokslut/årsredovisning enligt bokföringslagen.</span>
                  )}
                  {' '}Bokix hjälper dig strukturera underlaget men ersätter inte rådgivning för din specifika situation.
                  <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {[
                      ['Moms', 'https://www.skatteverket.se/foretag/moms'],
                      ['Bokföring och bokslut', 'https://www.skatteverket.se/foretag/drivaforetag/bokforingochbokslut.4.58d555751259e4d661680006527.html'],
                      ['Enskild näringsverksamhet', 'https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/enskildnaringsverksamhet/bokforingochdeklaration.4.361dc8c15312eff6fd2c99f.html'],
                    ].map(([label, url]) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3d7a2e', fontWeight: 600, textDecoration: 'none' }}>
                        {label} <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kontrolluppgifter (KU) */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111' }}>Kontrolluppgifter (KU)</h2>
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b', maxWidth: '540px' }}>
                  Årssammanställning per anställd — kontant bruttolön och avdragen skatt, summerat över bokförda lönekörningar. Lämnas in på skatteverket.se med BankID, senast 31 januari.
                </p>
              </div>
              <select value={kuYear} onChange={e => setKuYear(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', background: 'white' }}>
                {[Number(currentYear) - 1, Number(currentYear)].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {!kuTablesReady ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af', fontSize: '13.5px', padding: '8px 0' }}>
                  <Loader2 size={16} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} /> Läser in skattetabeller…
                </div>
              ) : kuEmployeeTotals.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af', fontSize: '13.5px', padding: '8px 0' }}>
                  <Users size={16} /> Inga bokförda lönekörningar för {kuYear} ännu.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: '18px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e4e4e7' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Namn</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Personnummer</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Kontant bruttolön</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Avdragen skatt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kuEmployeeTotals.map(emp => (
                        <tr key={emp.employeeId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#111' }}>{emp.firstName} {emp.lastName}</td>
                          <td style={{ padding: '8px 10px', color: '#6b7280' }}>{emp.ssn || '—'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(emp.gross)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(emp.tax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  disabled={!kuTablesReady || kuEmployeeTotals.length === 0}
                  onClick={() => downloadKuPdf({ company, year: kuYear, employeeTotals: kuEmployeeTotals }, `kontrolluppgifter-${kuYear}.pdf`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: (!kuTablesReady || kuEmployeeTotals.length === 0) ? '#94a3b8' : '#1a3028', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: (!kuTablesReady || kuEmployeeTotals.length === 0) ? 'not-allowed' : 'pointer' }}
                >
                  <Download size={14} /> Ladda ner sammanställning (PDF)
                </button>
                <a
                  href="https://www.skatteverket.se/foretag"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: '#374151', textDecoration: 'none' }}
                >
                  Öppna skatteverket.se <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
