import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, Clock, Circle, Lock, Calculator, ChevronRight, ChevronDown, ExternalLink, Info, Download, Users, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, ArrowRight, RotateCcw,
} from 'lucide-react';
import VatDeclaration from './VatDeclaration';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { detectOrgType } from '../utils/orgType';
import { summarizeAnnualPayrollByEmployee, neededTaxTableKeysForYear, downloadKuPdf } from '../utils/kuExport';
import { preloadSkattetabell } from '../utils/skattetabell';
import { computeInk2r } from '../utils/ink2r';
import { computeInk2rResultat } from '../utils/ink2rResultat';
import { computeInk2s } from '../utils/ink2s';
import { downloadInk2rSru } from '../utils/sruExport';

const fmt = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

// INK2S-belopp: blanketten kräver "hela kronor" (inga ören), så till
// skillnad från belopps­fälten i Expenses.jsx (som tillåter komma-
// decimaler) räcker heltal här. Fortfarande ett textfält och inte
// type="number" — annars kastar vissa webbläsare bort ett inledande
// minustecken medan man skriver, vilket "±"-raderna (4.9/4.10/4.13)
// behöver kunna ta emot.
// Bugkritiskt: `allowNegative` styrde tidigare bara `inputMode` (en
// mjuk-tangentbords-hint, inte en faktisk spärr) medan regexen alltid
// tillät ett minustecken — så en '+'- eller '-'-rad (t.ex. 4.5b Utdelning)
// kunde få tecknet vänt av misstag och ge fel över-/underskott. Nu väljs
// rätt regex utifrån flaggan, så ett minustecken bara går att skriva på
// "±"-rader (4.9/4.10/4.13) där det faktiskt betyder något.
const INK2S_AMOUNT_RE = /^\d*$/;
const INK2S_SIGNED_AMOUNT_RE = /^-?\d*$/;
function Ink2sAmountInput({ value, onChange, allowNegative, disabled }) {
  const re = allowNegative ? INK2S_SIGNED_AMOUNT_RE : INK2S_AMOUNT_RE;
  return (
    <input
      type="text"
      inputMode={allowNegative ? 'text' : 'numeric'}
      value={value ?? ''}
      disabled={disabled}
      onChange={e => {
        const v = e.target.value;
        if (v === '' || (allowNegative && v === '-') || re.test(v)) onChange(v);
      }}
      placeholder="0"
      style={{ width: '116px', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13.5px', textAlign: 'right', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: disabled ? 'var(--bg-muted)' : 'var(--bg-card)', color: disabled ? 'var(--text-muted)' : 'var(--text-main)', cursor: disabled ? 'not-allowed' : 'text', transition: 'border-color 0.12s' }}
      onFocus={e => { e.target.style.borderColor = 'var(--status-blue-text)'; }}
      onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
    />
  );
}

// "+" = ska läggas till resultatet, "-" = ska dras bort, "±" = användaren
// anger själv det signerade beloppet — samma tre lägen som blankettens
// egna kolumner, men som en liten färgkodad bricka istället för text i
// en parentes.
const SIGN_BADGE_STYLE = {
  '+': { bg: 'var(--status-green-bg)', fg: 'var(--status-green-text)' },
  '-': { bg: 'var(--status-red-bg)', fg: 'var(--status-red-text)' },
  '±': { bg: 'var(--status-blue-bg)', fg: 'var(--status-blue-text)' },
};
function SignBadge({ sign }) {
  const { bg, fg } = SIGN_BADGE_STYLE[sign];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '24px', height: '20px', padding: '0 6px', borderRadius: '999px', background: bg, color: fg, fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
      {sign}
    </span>
  );
}

/** Sammanfattningskort för 4.1/4.2 och 4.15/4.16 — samma resultatbelopp
 * som redan visas på sidan, bara upplyft till en tydlig siffra istället
 * för att drunkna bland 30 inmatningsrader. */
function Ink2sStatTile({ label, sublabel, amount, tone, Icon }) {
  // "neutral" (exakt 0 kr — varken vinst/överskott eller förlust/underskott)
  // fick tidigare grönt/rött slumpmässigt beroende på vilken gren som
  // testades sist, vilket målade ett nollresultat rött ("förlust") även
  // när bolaget gick precis jämnt ut.
  const toneColor = tone === 'green' ? 'var(--status-green-text)' : tone === 'red' ? 'var(--status-red-text)' : 'var(--text-muted)';
  const toneBg = tone === 'green' ? 'var(--status-green-bg)' : tone === 'red' ? 'var(--status-red-bg)' : 'var(--border-light)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', borderRadius: '10px', background: 'var(--bg-muted)', border: '1px solid var(--border-light)', flex: 1, minWidth: '220px' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: toneBg, color: toneColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: toneColor, lineHeight: 1.25 }}>{fmt(amount)}</div>
        {sublabel && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>{sublabel}</div>}
      </div>
    </div>
  );
}

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

  // INK2R (balansräkningsdelen av Inkomstdeklaration 2) — bara relevant för
  // aktiebolag/ekonomisk förening m.fl., inte enskild firma. Se ink2r.js
  // för källor/osäkerhet kring fältkoderna.
  const ink2r = useMemo(
    () => computeInk2r(verifications, accounts, new Date(`${currentYear}-12-31T23:59:59`)),
    [verifications, accounts, currentYear]
  );
  const ink2rResultat = useMemo(
    () => computeInk2rResultat(verifications, currentYear),
    [verifications, currentYear]
  );

  // INK2S (skattemässiga justeringar) — till skillnad från INK2R går de
  // här posterna inte att räkna fram ur bokföringen, användaren matar in
  // dem själv. Sparas per år, samma mönster som yearEndChecklist ovan.
  const ink2sValues = company?.ink2s?.[currentYear];
  const ink2s = useMemo(
    () => computeInk2s(ink2sValues, ink2rResultat.total),
    [ink2sValues, ink2rResultat.total]
  );
  const updateInk2sValue = (key, rawValue) => {
    if (isLocked) return; // samma spärr som toggleManualStep — låst år ska inte gå att ändra
    setCompanyInfo(prev => ({
      ...prev,
      ink2s: {
        ...prev.ink2s,
        [currentYear]: { ...(prev.ink2s?.[currentYear] || {}), [key]: rawValue },
      },
    }));
  };
  const hasAnyInk2sValue = Object.values(ink2sValues || {}).some(v => v !== '' && v != null && Number(v) !== 0);
  const resetInk2sValues = () => {
    if (isLocked || !hasAnyInk2sValue) return;
    if (!window.confirm(`Nollställa alla ifyllda INK2S-belopp för ${currentYear}? Det går inte att ångra.`)) return;
    setCompanyInfo(prev => {
      const next = { ...(prev.ink2s || {}) };
      delete next[currentYear];
      return { ...prev, ink2s: next };
    });
  };
  // Vilka av INK2S:s 8 grupper som är utfällda. Förvalt öppna: de två
  // grupperna de allra flesta aktiebolag faktiskt använder (ej avdrags-
  // gilla kostnader, t.ex. representation över gränsen — och utdelning,
  // som bokförs men inte ska tas upp här). Grupper som redan har ett
  // ifyllt belopp fälls också ut, så ingen tidigare inmatning göms bort.
  // useState-initieraren körs bara vid mount, så användarens egen
  // fäll-igen/fäll-ut-val därefter respekteras.
  const [openInk2sGroups, setOpenInk2sGroups] = useState(() => {
    const groups = new Set(['Bokförda kostnader som inte ska dras av', 'Bokförda intäkter som inte ska tas upp']);
    ink2s.rows.forEach(r => { if (r.value) groups.add(r.group); });
    return groups;
  });
  const toggleInk2sGroup = (group) => {
    setOpenInk2sGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };
  const ink2sGrouped = [];
  for (const r of ink2s.rows) {
    const last = ink2sGrouped[ink2sGrouped.length - 1];
    if (last && last.group === r.group) last.rows.push(r);
    else ink2sGrouped.push({ group: r.group, rows: [r] });
  }

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
      default: return <Circle size={18} color="var(--text-muted)" />;
    }
  };
  const getStatusBg = (status) => (status === 'Klar' ? 'var(--status-green-bg)' : status === 'Pågår' ? 'var(--status-amber-bg)' : 'var(--bg-muted)');
  const getStatusColor = (status) => (status === 'Klar' ? 'var(--status-green-text)' : status === 'Pågår' ? 'var(--status-amber-text)' : 'var(--text-secondary)');

  return (
    // page-shell/page-shell-scroll (mobil): sidan hade tidigare en FAST
    // header + en oberoende inre skrollyta (samma monster som fungerar
    // bra pa korta headers som Fakturor/Kontakter) — men den har sidans
    // header ar sa hog (titel + tre rader forklaringstext) att den permanent
    // ater upp en fjardedel av en telefonskarm. Under 768px skrollar hela
    // sidan (header inklusive) tillsammans som en vanlig webbsida istallet,
    // via .main-content-inner:s redan befintliga scroll (index.css).
    <div className="page-shell" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      {/* ── Header ── */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '24px 32px', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>Skatt och bokslut</h1>
        {/* page-desc-long (Fortnox-terugkoppling): den här radar sig till
            tre rader pa en 375px-skarm och lag da fast permanent hogst upp
            — halften av en telefonskarm aten upp av forklarande text, inte
            av nagot man faktiskt kom hit for att gora. Dold pa mobil,
            samma monster i Payroll.jsx. */}
        <p className="page-desc-long" style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: '1.5' }}>
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
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Årsbokslut {currentYear}
                {isLocked && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: 'var(--border-light)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                    <Lock size={12} /> Räkenskapsår låst
                  </span>
                )}
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
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
                      borderBottom: index < steps.length - 1 ? '1px solid var(--border-light)' : 'none',
                      background: step.status === 'Klar' ? 'var(--bg-muted)' : 'var(--bg-card)',
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
                        background: 'var(--border-light)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {step.id}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14px', fontWeight: 500,
                          color: step.status === 'Klar' ? 'var(--text-muted)' : 'var(--text-main)',
                          textDecoration: step.status === 'Klar' ? 'line-through' : 'none',
                        }}>
                          {step.title}
                        </div>
                        {step.hint && (
                          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{step.hint}</div>
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

            <div style={{ padding: '20px 24px', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Calculator size={16} /> {isLocked ? 'Bokfört resultat' : 'Beräknat resultat'}: <strong style={{ color: yearResult >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>{fmt(yearResult)}</strong>
              </div>
              <button
                onClick={handleLockYear}
                disabled={!canLock}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                  background: isLocked ? '#16a34a' : canLock ? '#3d7a2e' : 'var(--text-muted)',
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
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
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
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Kontrolluppgifter (KU)</h2>
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '540px' }}>
                  Årssammanställning per anställd — kontant bruttolön och avdragen skatt, summerat över bokförda lönekörningar. Lämnas in på skatteverket.se med BankID, senast 31 januari.
                </p>
              </div>
              <select value={kuYear} onChange={e => setKuYear(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                {[Number(currentYear) - 1, Number(currentYear)].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {!kuTablesReady ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px', padding: '8px 0' }}>
                  <Loader2 size={16} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} /> Läser in skattetabeller…
                </div>
              ) : kuEmployeeTotals.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px', padding: '8px 0' }}>
                  <Users size={16} /> Inga bokförda lönekörningar för {kuYear} ännu.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: '18px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Namn</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Personnummer</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Kontant bruttolön</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Avdragen skatt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kuEmployeeTotals.map(emp => (
                        <tr key={emp.employeeId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-main)' }}>{emp.firstName} {emp.lastName}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{emp.ssn || '—'}</td>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: (!kuTablesReady || kuEmployeeTotals.length === 0) ? 'var(--text-muted)' : '#1a3028', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: (!kuTablesReady || kuEmployeeTotals.length === 0) ? 'not-allowed' : 'pointer' }}
                >
                  <Download size={14} /> Ladda ner sammanställning (PDF)
                </button>
                <a
                  href="https://www.skatteverket.se/foretag"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
                >
                  Öppna skatteverket.se <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>

          {/* Inkomstdeklaration 2 — INK2R (balansräkning). Enskild firma
              deklarerar med NE-bilaga istället (se hjälptexten i
              Årsbokslut-kortet ovan) och får inte se det här kortet. */}
          {!isSoleProp && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Inkomstdeklaration 2 — INK2R (balansräkning)</h2>
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '620px' }}>
                  Räknas automatiskt fram ur bokförda verifikationer per {currentYear}-12-31, radnumrerat enligt Skatteverkets blankett INK2R.
                </p>
              </div>

              <div style={{ padding: '20px 24px' }}>
                {ink2r.rows.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px', padding: '8px 0' }}>
                    <Info size={16} /> Inga bokförda balanskonton ännu för {currentYear}.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, width: '52px' }}>Rad</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Benämning</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Belopp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ink2r.rows.map(r => (
                          <tr key={r.row} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{r.row}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-main)' }}>{r.label}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>{fmt(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px 0', borderTop: '1px solid var(--border-light)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <div>Summa tillgångar: <strong style={{ color: 'var(--text-main)' }}>{fmt(ink2r.totalAssets)}</strong> · Summa eget kapital och skulder: <strong style={{ color: 'var(--text-main)' }}>{fmt(ink2r.totalEquityAndLiabilities)}</strong></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: ink2r.balanced ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                    {ink2r.balanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    {ink2r.balanced ? 'Balanserar' : 'Balanserar inte — kontrollera bokföringen'}
                  </div>
                </div>

                {/* Resultaträkning (rad 3.1–3.27) — skrivs numera också med
                    i SRU-filen (se ink2rResultat.js och disclaimern nedan). */}
                {ink2rResultat.rows.length > 0 && (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-main)' }}>Resultaträkning (rad 3.1–3.27)</h3>
                    <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, width: '52px' }}>Rad</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Benämning</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Belopp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ink2rResultat.rows.map(r => (
                            <tr key={r.row} style={{ borderBottom: '1px solid var(--border-light)', background: (r.row === '3.26' || r.row === '3.27') ? 'var(--bg-muted)' : 'transparent' }}>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{r.row}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-main)', fontWeight: (r.row === '3.26' || r.row === '3.27') ? 700 : 400 }}>{r.label}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>{fmt(r.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <button
                    disabled={!ink2r.balanced || ink2r.rows.length === 0}
                    onClick={() => downloadInk2rSru(company, ink2r, ink2rResultat.rows, `${currentYear}-12-31`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: (!ink2r.balanced || ink2r.rows.length === 0) ? 'var(--text-muted)' : '#1a3028', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: (!ink2r.balanced || ink2r.rows.length === 0) ? 'not-allowed' : 'pointer' }}
                  >
                    <Download size={14} /> Ladda ner SRU-fil
                  </button>
                  <a
                    href="https://sso.skatteverket.se/fv_ext/fv_web/login.do"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#1a3028', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'white', textDecoration: 'none' }}
                  >
                    Lämna in hos Skatteverket <ExternalLink size={13} />
                  </a>
                  <a
                    href="https://www.bas.se/kontoplaner/sru/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
                  >
                    Kontrollera SRU-koder på bas.se <ExternalLink size={13} />
                  </a>
                </div>

                {/* Bokix kan aldrig skicka in filen automatiskt åt dig —
                    inlämningen kräver BankID-inloggning direkt hos
                    Skatteverket, och den inloggningen ska aldrig gå via
                    en tredjepartsapp. Så steg-för-steg istället för en
                    föreställning om en "en-klicks"-inlämning. */}
                <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: '12px', padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                  <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
                  <div>
                    <strong>Så lämnar du in filerna:</strong> ladda ner SRU-filen ovan (två filer, INFO.SRU och BLANKETTER.SRU, sparas i din nedladdningsmapp) → klicka "Lämna in hos Skatteverket" och logga in med BankID som företag → sök upp e-tjänsten <em>Filöverföring</em> under "Alla e-tjänster" om du inte hamnar där direkt → välj filtyp <em>Inkomstdeklaration</em> → ladda upp de två filerna du sparade. Bokix skickar aldrig in något åt dig — inloggningen sker alltid direkt hos Skatteverket.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '10px', padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                  <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
                  <div>
                    Både balansräkningen och resultaträkningen ovan skrivs med i SRU-filen, med fältkoder hämtade kontonummer-exakt ur BAS-intressenternas Förenings officiella kopplingstabell (<a href="https://www.bas.se/kontoplaner/sru/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>bas.se</a>, utgåva 2024-11-19). Enstaka ovanliga konton kan ändå hamna på en annan rad inom rätt huvudgrupp än den mest precisa — kontrollera gärna själv för din specifika verksamhet innan en skarp inlämning. De skattemässiga justeringarna (INK2S) fyller du i separat i nästa kort nedan — de ingår inte i SRU-filen.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inkomstdeklaration 2 — INK2S (skattemässiga justeringar).
              Går inte att räkna fram ur bokföringen — användaren matar
              in de skattemässiga bedömningarna själv, se ink2s.js. */}
          {!isSoleProp && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Inkomstdeklaration 2 — INK2S (skattemässiga justeringar)</h2>
                  <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '620px' }}>
                    Rad 4.1–4.16. Årets resultat hämtas automatiskt från resultaträkningen ovan — resten matar du in själv, i hela kronor.
                  </p>
                </div>
                {hasAnyInk2sValue && !isLocked && (
                  <button
                    type="button"
                    onClick={resetInk2sValues}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '12.5px', color: 'var(--status-red-text)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    <RotateCcw size={13} /> Nollställ alla
                  </button>
                )}
              </div>

              <div style={{ padding: '20px 24px' }}>
                {/* Rad 4.1/4.2 → 4.15/4.16, som två sammanfattningskort
                    istället för att drunkna bland 30 inmatningsrader. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  <Ink2sStatTile
                    label={ink2s.arsResultatVinst > 0 ? '4.1 Årets resultat, vinst' : ink2s.arsResultatForlust > 0 ? '4.2 Årets resultat, förlust' : 'Årets resultat'}
                    amount={ink2s.arsResultatVinst > 0 ? ink2s.arsResultatVinst : -ink2s.arsResultatForlust}
                    tone={ink2s.arsResultatVinst > 0 ? 'green' : ink2s.arsResultatForlust > 0 ? 'red' : 'neutral'}
                    Icon={ink2s.arsResultatVinst > 0 ? TrendingUp : ink2s.arsResultatForlust > 0 ? TrendingDown : Minus}
                  />
                  <ArrowRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} className="ink2s-arrow" />
                  <Ink2sStatTile
                    label={ink2s.overskott > 0 ? '4.15 Överskott' : ink2s.underskott > 0 ? '4.16 Underskott' : 'Varken över- eller underskott'}
                    sublabel="efter skattemässiga justeringar"
                    amount={ink2s.overskott > 0 ? ink2s.overskott : ink2s.underskott}
                    tone={ink2s.overskott > 0 ? 'green' : ink2s.underskott > 0 ? 'red' : 'neutral'}
                    Icon={ink2s.overskott > 0 ? TrendingUp : ink2s.underskott > 0 ? TrendingDown : Minus}
                  />
                </div>

                {/* Justeringsrader, grupperade och hopfällbara precis som
                    blankettens egna rubriker — de flesta bolag fyller
                    bara i en handfull av de 30 raderna. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ink2sGrouped.map(({ group, rows }) => {
                    const isOpen = openInk2sGroups.has(group);
                    const filledCount = rows.filter(r => r.value).length;
                    return (
                      <div key={group} style={{ border: '1px solid var(--border-light)', borderRadius: '10px', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => toggleInk2sGroup(group)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 14px', background: 'var(--bg-muted)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                            {isOpen ? <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
                            <span style={{ fontSize: '13.5px', fontWeight: 700 }}>{group}</span>
                          </span>
                          {filledCount > 0 && (
                            <span style={{ flexShrink: 0, padding: '2px 9px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontSize: '11.5px', fontWeight: 700 }}>
                              {filledCount} ifyllda
                            </span>
                          )}
                        </button>

                        {isOpen && (
                          <div style={{ padding: '6px 8px 8px' }}>
                            {rows.map(r => (
                              <div
                                key={r.key}
                                style={{
                                  display: 'grid', gridTemplateColumns: '40px 1fr auto', alignItems: 'center', gap: '10px',
                                  padding: '8px 8px', borderRadius: '7px',
                                  background: r.value ? 'var(--status-green-bg)' : 'transparent',
                                }}
                              >
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.row}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-main)', minWidth: 0 }}>
                                  <SignBadge sign={r.sign} />
                                  <span>{r.label}</span>
                                </span>
                                <Ink2sAmountInput
                                  value={ink2sValues?.[r.key] ?? ''}
                                  allowNegative={r.sign === '±'}
                                  disabled={isLocked}
                                  onChange={(v) => updateInk2sValue(r.key, v)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '18px', padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                  <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
                  <div>
                    De här justeringarna kräver en skattemässig bedömning som Bokix inte kan göra åt dig — fyll bara i de rader som är relevanta för ert bolag. Beloppen sparas i din bokföring men ingår inte i SRU-filen ovan (ingen pålitlig fältkodskälla hittad för INK2S ännu). "Övriga uppgifter" (rad 4.17–4.22) och frågorna om revision m.m. finns inte med här — de fylls i direkt hos Skatteverket.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
