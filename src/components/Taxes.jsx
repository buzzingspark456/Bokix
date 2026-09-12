import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, Clock, Circle, Lock, Calculator, ChevronRight, ChevronDown, ExternalLink, Info, Download, Users, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, ArrowRight, RotateCcw, ClipboardList,
} from 'lucide-react';
import VatDeclaration from './VatDeclaration';
import ListPageHeader from './shared/ListPageHeader';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { detectOrgType } from '../utils/orgType';
import { isUfCompany, UF_TAX_SECTION_IDS } from '../utils/ufMode';
import { summarizeAnnualPayrollByEmployee, neededTaxTableKeysForYear, downloadKuPdf } from '../utils/kuExport';
import { preloadSkattetabell } from '../utils/skattetabell';
import { computeInk2r } from '../utils/ink2r';
import { computeInk2rResultat } from '../utils/ink2rResultat';
import { computeInk2s } from '../utils/ink2s';
import { computeNeBalance, computeNeResult } from '../utils/ne';
import { downloadInk2rSru } from '../utils/sruExport';
import { nextVatDeadline, nextAgiDeadline, nextKuDeadline } from '../utils/declarationDeadlines';
import { confirmDialog } from './shared/ConfirmDialog';

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

/** Ett steg i INK2R-sidans "så gör du"-lista. Samma visuella språk som
 * momsdeklarationens Stepper (VatDeclaration.jsx) — numrerad cirkel som
 * blir en grön bock när steget är avklarat — men som en LODRÄT checklista
 * i stället för en vågrät guide, eftersom stegen här inte byter vy: allt
 * ligger på samma sida och steg 1 är något appen kontrollerar åt dig. */
function Ink2Step({ n, title, done, last, children }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: last ? 0 : '12px', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: done ? 'var(--status-green-bg)' : 'var(--bg-card)',
        color: done ? 'var(--status-green-text)' : 'var(--text-secondary)',
        border: done ? 'none' : '1px solid var(--border)',
        fontSize: '12.5px', fontWeight: 700,
      }}>
        {done ? <CheckCircle2 size={15} /> : n}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>{title}</div>
        <div style={{ fontSize: '13px', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

// Kundönskemål ("gör det mer som den riktiga blanketten — det ska se ut
// som B1/B2/... precis som Skatteverkets NE-blankett/INK2S, inte som en
// vanlig app-tabell"): INK2R:s balansräkning byggs nu upp som Skatteverkets
// EGEN pappersblankett — två kolumner (Tillgångar vänster, Eget kapital
// och skulder höger, exakt som B1–B9/B10–B16 på NE-blanketten och
// 2.x-fälten på INK2R), och varje rad är en egen liten ruta med radnumret
// (samma "2.1", "2.19" osv som Skatteverkets fältkoder, inte en gissad
// egen numrering) ovanför beloppet — inte en tät tabellrad. Siffrorna och
// beräkningen är OFÖRÄNDRADE (samma ink2r.js), det här är bara hur samma
// data PRESENTERAS.
const INK2R_ASSET_GROUPS = new Set([
  'Immateriella anläggningstillgångar', 'Materiella anläggningstillgångar', 'Finansiella anläggningstillgångar',
  'Varulager m.m.', 'Kortfristiga fordringar', 'Kortfristiga placeringar', 'Kassa och bank',
]);

/** Grupperar redan sorterade INK2R-rader efter `group` (bevarar ordningen
 * de dyker upp i — samma ordning som INK2R_ROWS i ink2r.js) och delar upp
 * grupperna i tillgångssidan/skuldsidan utifrån INK2R_ASSET_GROUPS ovan. */
function splitInk2rColumns(rows) {
  const groups = [];
  rows.forEach(r => {
    const last = groups[groups.length - 1];
    if (last && last.name === r.group) last.rows.push(r);
    else groups.push({ name: r.group, rows: [r] });
  });
  return {
    assets: groups.filter(g => INK2R_ASSET_GROUPS.has(g.name)),
    equityAndLiabilities: groups.filter(g => !INK2R_ASSET_GROUPS.has(g.name)),
  };
}

/** En rad i blankettstil — radnummer + benämning ovanför ett boxat belopp,
 * samma visuella grepp som en pappersblankett ("B2 Byggnader [400 000]"),
 * i stället för en tabellrad. Klickbar precis som tidigare: fäller ut
 * kontona bakom beloppet, för att beloppet ska gå att kontrollera. */
function Ink2FormField({ row, open, onToggle, fmt }) {
  return (
    <div
      onClick={onToggle}
      title={`Fältkod ${row.fieldCode} · klicka för att se kontona bakom beloppet`}
      style={{
        border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px',
        cursor: 'pointer', background: open ? 'var(--bg-muted)' : 'var(--bg-card)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{row.row}</span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(row.amount)}</span>
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{row.label}</div>
      {open && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Konton bakom raden</div>
          {row.accounts.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Inga konton med saldo.</div>
          ) : row.accounts.map(a => (
            <div key={a.code} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', padding: '2px 0', color: 'var(--text-secondary)' }}>
              <span><strong style={{ color: 'var(--text-main)' }}>{a.code}</strong> {a.name}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-main)', fontWeight: 600 }}>{fmt(a.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** En kolumn i blanketten (Tillgångar ELLER Eget kapital och skulder) —
 * grupperna inom kolumnen (t.ex. "Immateriella anläggningstillgångar")
 * som en liten rubrik ovanför sina rutor, samma sektionsindelning som
 * pappersblanketten redan har. */
function Ink2FormColumn({ title, groups, expandedRow, setExpandedRow, fmt }) {
  if (groups.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {groups.map(g => (
          <div key={g.name}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>{g.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {g.rows.map(r => (
                <Ink2FormField
                  key={r.row} row={r} fmt={fmt}
                  open={expandedRow === r.row}
                  onToggle={() => setExpandedRow(expandedRow === r.row ? null : r.row)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Samma "blankettruta"-utseende som Ink2FormField ovan, men EDITERBAR —
 * NE-bilagans fält går inte att räkna fram ur bokföringen (se ne.js), så
 * användaren skriver in beloppet själv i stället för att klicka för att
 * se konton bakom en redan uträknad summa. */
function NeFormField({ row, value, onChange, disabled }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '2px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>{row.row}</span>
        {row.sign && <SignBadge sign={row.sign} />}
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4, minHeight: '32px' }}>{row.label}</div>
      <Ink2sAmountInput value={value ?? ''} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** En kolumn i NE-blanketten — samma gruppindelning (Anläggnings-/
 * Omsättningstillgångar, Skulder osv) som Ink2FormColumn, fast med
 * editerbara NeFormField-rutor i stället för klick-för-att-se-konton. */
function NeFormColumn({ title, groups, values, onChange, disabled, derived }) {
  const visibleGroups = groups.filter(g => g.rows.length > 0);
  if (visibleGroups.length === 0 && !derived) return null;
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {visibleGroups.map(g => (
          <div key={g.group}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>{g.group}</div>
            <div className="form-row-2" style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
              {g.rows.map(r => (
                <NeFormField key={r.key} row={r} value={values?.[r.key]} disabled={disabled} onChange={v => onChange(r.key, v)} />
              ))}
            </div>
          </div>
        ))}
        {derived}
      </div>
    </div>
  );
}

export default function Taxes({
  company, verifications = [], invoices = [], expenses = [], accounts = [],
  payrollRuns = [], vatPeriods = {}, onBookVatPeriod, onNavigateToVerification,
  onAddVerification, setCompanyInfo, onNavigateToTab, initialSection,
}) {
  const currentYear = new Date().getFullYear().toString();
  const orgType = detectOrgType(company?.orgNr);
  const isSoleProp = orgType === 'Enskild firma';
  // Kundönskemål: "om det är ett handelsbolag ska det vara byggt för
  // handelsbolag" — sidan behandlade tidigare ALLT som inte var enskild
  // firma likadant (AB:s INK2-flöde), inklusive handelsbolag/kommandit-
  // bolag. Det är sakligt fel: ett handels-/kommanditbolag betalar ingen
  // egen bolagsskatt och lämnar ingen INK2 — bolagets resultat fördelas på
  // delägarna, som var och en deklarerar sin andel med en N3A-bilaga (eller
  // K10 för fåmansbolagsdelägare) i sin EGEN inkomstdeklaration. INK2-fliken
  // ska alltså döljas för dem precis som för enskild firma, med en egen,
  // korrekt förklaringstext istället för AB:s.
  const isTradingPartnership = orgType === 'Handelsbolag / Kommanditbolag';
  const filesOwnIncomeDeclaration = isSoleProp || isTradingPartnership;

  // Kundfeedback ("för mycket att göra, ingen förstår"): sidan var tidigare
  // FEM tunga kort (Moms/Årsbokslut/Kontrolluppgifter/INK2R/INK2S) staplade
  // rakt under varandra i en enda lång skroll — allt syntes på en gång,
  // oavsett vad man faktiskt kom hit för att göra just idag. Delad i flikar
  // nu (samma ListPageHeader-mönster som Kunder/Anställda/Projekt m.fl.):
  // bara EN del synlig åt gången, mycket mindre att ta in per besök.
  const [activeSection, setActiveSection] = useState(initialSection || 'vat');
  // Vilken INK2R-rad som är utfälld och visar kontona bakom sitt belopp.
  const [expandedInk2rRow, setExpandedInk2rRow] = useState(null);

  // Bugkritiskt (profilmenyn, App.jsx): "Bokslut & årsredovisning" och
  // "Momsredovisning" skickade tidigare bara till den här sidan i
  // ALLMÄNHET (samma 'taxes'-flik som "Viktiga datum") utan att säga VILKEN
  // sektion — activeSection stod alltid kvar på sitt useState-förval ('vat'),
  // så "Bokslut & årsredovisning" öppnade i praktiken Moms-fliken, aldrig
  // Årsbokslut. App.jsx skickar nu ner initialSection per klick (se
  // handleNavTabChange), men eftersom den HÄR komponenten inte remountas
  // mellan två klick på taxes-relaterade profilmenyval (samma `key`, se
  // App.jsx:s render-switch) räcker inte useState-förvalet ensamt — måste
  // synkas explicit varje gång propen faktiskt ändras.
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  // Kodgranskning: "ink2"-fliken skapas aldrig för enskild firma/handels-
  // bolag (sectionTabs nedan) och dess innehåll döljs med
  // `!filesOwnIncomeDeclaration && activeSection === 'ink2'` — men INGET
  // återställde activeSection om filesOwnIncomeDeclaration blev sant EFTER
  // att fliken redan valts (t.ex. org.nr ändras i Inställningar medan sidan
  // är monterad). Fliken försvann då ur headern utan att något blev
  // markerat, och innehållsytan renderade tom istället för att falla
  // tillbaka till en riktig flik. Samma öde kan drabba "ne" om org.nr
  // ändras från enskild firma till något annat medan den fliken är vald.
  useEffect(() => {
    if (filesOwnIncomeDeclaration && activeSection === 'ink2') setActiveSection('vat');
    if (!isSoleProp && activeSection === 'ne') setActiveSection('vat');
  }, [filesOwnIncomeDeclaration, isSoleProp, activeSection]);

  // Kontrolluppgifter (KU) — förvalt till föregående inkomstår FRAM TILL
  // deadline (31 januari), eftersom det är vad man normalt lämnar in då.
  // Kundfeedback (skärmdump, testat i september): standardvalet stod kvar
  // på föregående år ÅRET RUNT, inte bara under januari — i september visade
  // sidan alltså "2025" (tomt, ingen lön bokförd där) i stället för det år
  // man faktiskt håller på att bokföra lön för, och vars KU man ännu inte
  // ska lämna in förrän nästa januari. Efter den 31 januari är föregående
  // års KU redan förfallen (inlämnad eller försenad, i båda fallen inte
  // vad man vill se först) — innevarande år är då rätt förval, inte förra.
  const [kuYear, setKuYear] = useState(() => {
    // Månad 0 = januari — JS-datum har redan 28-31 dagar per månad inbyggt,
    // så "efter januari" räcker som gräns (den 31:a själv räknas fortfarande
    // som "inom fönstret", man kan ju fortfarande lämna in den dagen).
    const pastJanuary = new Date().getMonth() > 0;
    return String(Number(currentYear) - (pastJanuary ? 0 : 1));
  });
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
  const resetInk2sValues = async () => {
    if (isLocked || !hasAnyInk2sValue) return;
    if (!(await confirmDialog(`Nollställa alla ifyllda INK2S-belopp för ${currentYear}? Det går inte att ångra.`, { danger: true }))) return;
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

  // NE-bilaga — bara enskild firma (inte handelsbolag, som deklarerar sin
  // andel via N3A/K10 i stället, se filesOwnIncomeDeclaration ovan). Samma
  // "ren manuell ifyllnad, sparat per år"-mönster som INK2S — se ne.js för
  // varför det INTE räknas fram ur bokföringen.
  const neValues = company?.ne?.[currentYear] || {};
  const neBalance = useMemo(() => computeNeBalance(neValues.balance), [neValues.balance]);
  const neResult = useMemo(() => computeNeResult(neValues.result), [neValues.result]);
  const updateNeValue = (section, key, rawValue) => {
    if (isLocked) return;
    setCompanyInfo(prev => ({
      ...prev,
      ne: {
        ...prev.ne,
        [currentYear]: {
          ...(prev.ne?.[currentYear] || {}),
          [section]: { ...(prev.ne?.[currentYear]?.[section] || {}), [key]: rawValue },
        },
      },
    }));
  };
  const hasAnyNeValue = [...Object.values(neValues.balance || {}), ...Object.values(neValues.result || {})]
    .some(v => v !== '' && v != null && Number(v) !== 0);
  const resetNeValues = async () => {
    if (isLocked || !hasAnyNeValue) return;
    if (!(await confirmDialog(`Nollställa alla ifyllda NE-belopp för ${currentYear}? Det går inte att ångra.`, { danger: true }))) return;
    setCompanyInfo(prev => {
      const next = { ...(prev.ne || {}) };
      delete next[currentYear];
      return { ...prev, ne: next };
    });
  };
  const neBalanceByColumn = {
    assets: [
      { group: 'Anläggningstillgångar', rows: neBalance.rows.filter(r => r.group === 'Anläggningstillgångar') },
      { group: 'Omsättningstillgångar', rows: neBalance.rows.filter(r => r.group === 'Omsättningstillgångar') },
    ],
    liabilities: [
      { group: 'Obeskattade reserver', rows: neBalance.rows.filter(r => r.group === 'Obeskattade reserver') },
      { group: 'Avsättningar', rows: neBalance.rows.filter(r => r.group === 'Avsättningar') },
      { group: 'Skulder', rows: neBalance.rows.filter(r => r.group === 'Skulder') },
    ],
  };
  const neResultByGroup = ['Intäkter', 'Kostnader', 'Avskrivningar'].map(group => ({
    group, rows: neResult.rows.filter(r => r.group === group),
  }));

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

  // UF-läget: bara Viktiga datum, Moms och Årsbokslut (UF_TAX_SECTION_IDS
  // i utils/ufMode.js — se den kommentaren för varför Moms är kvar men
  // Kontrolluppgifter och Inkomstdeklaration inte är det). Filtret ligger
  // sist så en flik aldrig kan smyga in genom att läggas till ovanför.
  const sectionTabs = [
    { id: 'dates', label: 'Viktiga datum' },
    { id: 'vat', label: 'Moms' },
    { id: 'yearend', label: 'Årsbokslut' },
    { id: 'ku', label: 'Kontrolluppgifter' },
    ...(!filesOwnIncomeDeclaration ? [{ id: 'ink2', label: 'Inkomstdeklaration' }] : []),
    // NE-bilaga — bara enskild firma. INTE handelsbolag (som också har
    // filesOwnIncomeDeclaration=true men deklarerar sin andel med en N3A/
    // K10-bilaga i stället, se hjälptexten i Årsbokslut-kortet).
    ...(isSoleProp ? [{ id: 'ne', label: 'NE-bilaga' }] : []),
  ].filter(tab => !isUfCompany(company) || UF_TAX_SECTION_IDS.includes(tab.id));

  // ── Viktiga datum ── Kundfeedback (två omgångar): profilmenyns "Viktiga
  // datum" ledde hit men landade alltid på Moms-fliken utan att visa något
  // datum — sen ett smalt pill-band ovanför flikarna, men kunden ville ha
  // en RIKTIG, egen flik ("den ska se riktigt bra ut"). Samma
  // deadline-uträkningar som redan visas på Startsidan (Dashboard.jsx:s
  // varningswidget, "X dagar kvar") — ALDRIG en egen, ny beräkning här,
  // exakt samma funktioner, så de aldrig kan visa olika datum på två
  // ställen. Bokslutsdeadline visas MEDVETET INTE — ingen befintlig,
  // verifierad uträkning för den finns i declarationDeadlines.js, och
  // kundens uttryckliga krav var att ALDRIG visa ett gissat datum här.
  const vatDeadlineInfo = useMemo(() => nextVatDeadline(company, vatPeriods), [company, vatPeriods]);
  const agiDeadlineInfo = useMemo(() => (payrollRuns.length > 0 ? nextAgiDeadline() : null), [payrollRuns.length]);
  // Kundfeedback ("viktiga datum visar inget när det senaste är avklarat"):
  // moms/AGI var tidigare de ENDA två deadline-typerna — utanför en snar
  // moms-/lönedeadline (eller om momsen inte är kvartalsvis/inget
  // löneunderlag finns) stod "Viktiga datum" tomt trots att KU:s 31
  // januari-deadline (samma datum som redan står i klartext på KU-fliken)
  // alltid ligger där ute. Samma "bara om det finns löneunderlag"-villkor
  // som AGI ovan — ingen anställd, ingen KU att lämna in.
  const kuDeadlineInfo = useMemo(() => (payrollRuns.length > 0 ? nextKuDeadline() : null), [payrollRuns.length]);
  const fmtDeadlineDate = (d) => new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const daysLeftLabel = (daysLeft) => {
    if (daysLeft < 0) return 'försenad';
    if (daysLeft === 0) return 'idag';
    if (daysLeft === 1) return 'imorgon';
    return `om ${daysLeft} dagar`;
  };

  return (
    // Samma "facit"-mönster som Kunder/Anställda/Projekt m.fl. (ListPageHeader
    // med flikar) istället för den gamla egna, höga rubrik+3-radersbeskrivning-
    // headern (som krävde en särskild mobil-undantagsregel, page-shell/
    // page-shell-scroll i index.css, för att inte äta en fjärdedel av
    // telefonskärmen — onödigt nu när headern är lika kompakt som överallt
    // annars i appen).
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title="Skatt och bokslut"
        subtitle="Momsredovisning, årsbokslut och inkomstdeklaration"
        tabs={{ items: sectionTabs, activeId: activeSection, onChange: setActiveSection }}
      />

      {/* ── Content Area — bara den aktiva fliken renderas, inte alla fem
          kort staplade i en lång skroll längre. Ingen padding här längre
          (kundfeedback, "no space"-genomgången, uppföljning) — det aktiva
          kortet sitter nu flush direkt under flikraden, samma princip som
          Verifikationers tabell. Korten nedan har fått sina ÖVRE hörn
          fyrkantiga istället för rundade av samma skäl som ListTable.jsx:
          en rundad topp mot en flush, rak flikrad lämnade en liten böjd
          glipa i hörnen istället för att kännas hopfogat. */}
      <div data-tour="page-taxes-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Viktiga datum — se filkommentaren vid vatDeadlineInfo ovan. */}
          {activeSection === 'dates' && (
            // Kundfeedback: föregående version var en smal, lodrät stapel av
            // 1-2 kort högst upp på en annars tom, full-höjds flik — mycket
            // tomrum under. Ett rutnät (auto-fit) istället för en stapel gör
            // att korten faktiskt FYLLER bredden och känns som en avsiktlig
            // yta, inte en lista som råkar ta slut tidigt. maxWidth borttagen
            // av samma skäl — begränsade bredden i onödan på bredare skärmar.
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '3px' }}>Kommande deadlines</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Automatiskt uträknat utifrån ditt företags momsperiod och lönekörningar.</div>
              </div>

              {!vatDeadlineInfo && !agiDeadlineInfo && !kuDeadlineInfo ? (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '32px 24px', textAlign: 'center' }}>
                  <Clock size={26} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Inga kommande deadlines just nu</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Momsredovisningen är inte kvartalsvis, och inga lönekörningar är bokförda ännu (det är det som styr AGI- och kontrolluppgiftsdeadlines).</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {[
                    vatDeadlineInfo && {
                      key: 'vat', icon: Calculator,
                      title: `Momsdeklaration`,
                      subtitle: `Kvartal ${vatDeadlineInfo.quarter}, ${vatDeadlineInfo.year}`,
                      detail: `Senast ${fmtDeadlineDate(vatDeadlineInfo.dueDate)}`,
                      daysLeft: vatDeadlineInfo.daysLeft,
                      onClick: () => setActiveSection('vat'),
                    },
                    agiDeadlineInfo && {
                      key: 'agi', icon: Users,
                      title: 'Arbetsgivardeklaration',
                      subtitle: 'AGI',
                      detail: `Senast ${fmtDeadlineDate(agiDeadlineInfo.dueDate)}`,
                      daysLeft: agiDeadlineInfo.daysLeft,
                      // AGI hanteras inte på den här sidan alls — Lönekörning
                      // (payroll) är där det faktiska underlaget finns, till
                      // skillnad från momskortet som pekar på en flik HÄR.
                      onClick: () => onNavigateToTab?.('payroll'),
                    },
                    kuDeadlineInfo && {
                      key: 'ku', icon: ClipboardList,
                      title: 'Kontrolluppgifter',
                      subtitle: `Inkomståret ${kuDeadlineInfo.incomeYear}`,
                      detail: `Senast ${fmtDeadlineDate(kuDeadlineInfo.dueDate)}`,
                      daysLeft: kuDeadlineInfo.daysLeft,
                      onClick: () => setActiveSection('ku'),
                    },
                  ]
                    .filter(Boolean)
                    // Närmast förfall först. Ordningen var tidigare fast
                    // (moms, sedan AGI) vilket betydde att en deklaration
                    // som skulle in om två dagar kunde ligga under en som
                    // hade sex veckor kvar. Det man ska göra härnäst ska
                    // stå först — en försenad (negativa dagar) hamnar då
                    // också överst av sig självt.
                    .sort((a, b) => a.daysLeft - b.daysLeft)
                    .map(item => {
                    const sevBg = item.daysLeft < 0 ? 'var(--status-red-bg)' : item.daysLeft <= 7 ? 'var(--status-amber-bg)' : 'var(--status-gray-bg)';
                    const sevText = item.daysLeft < 0 ? 'var(--status-red-text)' : item.daysLeft <= 7 ? 'var(--status-amber-text)' : 'var(--status-gray-text)';
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={item.onClick}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left',
                          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: sevBg, color: sevText }}>
                            <item.icon size={18} />
                          </div>
                          <div style={{ padding: '5px 12px', borderRadius: '999px', background: sevBg, color: sevText, fontSize: '12.5px', fontWeight: 700, flexShrink: 0 }}>
                            {daysLeftLabel(item.daysLeft)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>{item.title}</div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.subtitle} · {item.detail}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Källa/tillförlitlighet — kundkrav: datumen måste vara
                  garanterat korrekta, inte gissade. Uträkningen (samma
                  funktioner som Startsidans varningswidget och de
                  automatiska påminnelsemejlen, aldrig en egen tredje
                  beräkning) verifierades direkt mot skatteverket.se, senast
                  omkontrollerad 2026-09-12, inklusive januari- och augusti-
                  undantaget (17:e istället för 12:e) — se
                  declarationDeadlines.js. */}
              <div style={{ marginTop: '18px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Datumen följer Skatteverkets allmänna regel (12:e i andra månaden efter perioden, med undantag för januari och augusti då det är den 17:e) och flyttas fram till nästa vardag om de landar på en helg. Skatteverket kan i enskilda fall flytta fram ytterligare vid röda dagar.
              </div>
            </div>
          )}

          {/* Momsdeklaration */}
          {activeSection === 'vat' && (
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
          )}

          {/* Årsbokslut */}
          {activeSection === 'yearend' && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
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
                          style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-text)', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', padding: '2px' }}
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
                  background: isLocked ? '#16a34a' : canLock ? 'var(--accent)' : 'var(--text-muted)',
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
                en enskild firma deklarerar resultatet vidare med en
                NE-bilaga (inte en årsredovisning), och ett handelsbolag/
                kommanditbolag betalar ingen egen bolagsskatt alls — resultatet
                fördelas på delägarna, som var och en deklarerar sin andel med
                en N3A-bilaga (eller K10 för en fåmansföretagsdelägare) i sin
                EGEN inkomstdeklaration. Tre olika texter, inte en generisk
                AB-text för "allt som inte är enskild firma" (kundönskemål:
                "om det är ett handelsbolag ska det vara byggt för
                handelsbolag"). */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
                <div>
                  {isSoleProp ? (
                    <span>Som enskild firma deklarerar du resultatet vidare med en <strong>NE-bilaga</strong> i din inkomstdeklaration, efter att bokslutet är klart.</span>
                  ) : isTradingPartnership ? (
                    <span>Som handels-/kommanditbolag betalar bolaget ingen egen bolagsskatt — resultatet fördelas på delägarna, som var och en deklarerar sin andel med en <strong>N3A-bilaga</strong> (eller K10 vid fåmansföretagsförhållanden) i sin egen inkomstdeklaration, efter att bokslutet är klart.</span>
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
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>
                        {label} <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Kontrolluppgifter (KU) */}
          {activeSection === 'ku' && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: (!kuTablesReady || kuEmployeeTotals.length === 0) ? 'var(--text-muted)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: (!kuTablesReady || kuEmployeeTotals.length === 0) ? 'not-allowed' : 'pointer' }}
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
          )}

          {/* Inkomstdeklaration 2 — INK2R (balansräkning). Enskild firma
              deklarerar med NE-bilaga istället (se hjälptexten i
              Årsbokslut-kortet ovan) och får inte se det här kortet — döljs
              nu även via egen flik (`sectionTabs` ovan skapar aldrig en
              "Inkomstdeklaration"-flik för enskild firma/handelsbolag). */}
          {!filesOwnIncomeDeclaration && activeSection === 'ink2' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Inkomstdeklaration 2 — INK2R (balansräkning)</h2>
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '660px' }}>
                  Det här är företagets balans- och resultaträkning i Skatteverkets eget format. Bokix fyller i den åt dig ur
                  bokföringen per {currentYear}-12-31 — du kontrollerar, laddar ner filen och lämnar in den hos Skatteverket.
                </p>
              </div>

              {/* Kundfeedback: "man vet inte riktigt vad man ska göra här".
                  Sidan visade två långa tabeller först och gömde knapparna
                  längst ner — samma innehåll, men ingen ordning att följa.
                  Momsdeklarationens steg-för-steg (samma sida, fliken
                  bredvid) var precis det användaren berömde, så INK2R får
                  samma språk: tre steg, med status på det första och
                  knapparna direkt i steg två och tre. */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'grid', gap: '12px' }}>
                <Ink2Step
                  n={1}
                  done={ink2r.balanced && ink2r.rows.length > 0}
                  title="Kontrollera att balansräkningen stämmer"
                >
                  {ink2r.rows.length === 0 ? (
                    <span style={{ color: 'var(--text-secondary)' }}>Inga bokförda balanskonton ännu för {currentYear} — bokför året först.</span>
                  ) : ink2r.balanced ? (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Tillgångar {fmt(ink2r.totalAssets)} = eget kapital och skulder {fmt(ink2r.totalEquityAndLiabilities)}. Klart att lämna in.
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--status-red-text)' }}>Skillnad {fmt(Math.abs(ink2r.difference))} kr.</strong>{' '}
                      Tillgångarna är {ink2r.difference > 0 ? 'större' : 'mindre'} än eget kapital och skulder. Vanligaste orsaken är att
                      årets resultat inte är omfört till eget kapital i bokslutet, eller att en verifikation ligger kvar som utkast.
                      {onNavigateToTab && (
                        <>
                          {' '}
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('reports')}
                            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Öppna balansräkningen
                          </button>
                          {' '}för att se var differensen sitter.
                        </>
                      )}
                    </span>
                  )}
                </Ink2Step>

                <Ink2Step n={2} title="Ladda ner filerna till Skatteverket">
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      disabled={!ink2r.balanced || ink2r.rows.length === 0}
                      onClick={() => downloadInk2rSru(company, ink2r, ink2rResultat.rows, `${currentYear}-12-31`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: (!ink2r.balanced || ink2r.rows.length === 0) ? 'var(--border)' : 'var(--accent)', color: (!ink2r.balanced || ink2r.rows.length === 0) ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: (!ink2r.balanced || ink2r.rows.length === 0) ? 'not-allowed' : 'pointer' }}
                    >
                      <Download size={14} /> Ladda ner SRU-fil
                    </button>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      Två filer (INFO.SRU och BLANKETTER.SRU) sparas i din nedladdningsmapp.
                      {!ink2r.balanced && ink2r.rows.length > 0 && ' Går att ladda ner först när balansräkningen stämmer.'}
                    </span>
                  </div>
                </Ink2Step>

                <Ink2Step n={3} title="Lämna in hos Skatteverket" last>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <a
                      href="https://sso.skatteverket.se/fv_ext/fv_web/login.do"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
                    >
                      Öppna Skatteverket <ExternalLink size={13} />
                    </a>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '620px' }}>
                      Logga in med BankID som företag → e-tjänsten <em>Filöverföring</em> → filtyp <em>Inkomstdeklaration</em> → ladda upp de två filerna.
                      Bokix skickar aldrig in något åt dig; inloggningen sker alltid direkt hos Skatteverket.
                    </span>
                  </div>
                </Ink2Step>
              </div>

              <div style={{ padding: '20px 24px' }}>
                {ink2r.rows.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px', padding: '8px 0' }}>
                    <Info size={16} /> Inga bokförda balanskonton ännu för {currentYear}.
                  </div>
                ) : (
                  <div
                    className="form-row-2"
                    style={{ display: 'grid', gap: '28px', marginBottom: '20px', gridTemplateColumns: '1fr 1fr' }}
                  >
                    {(() => {
                      const { assets, equityAndLiabilities } = splitInk2rColumns(ink2r.rows);
                      return (
                        <>
                          <Ink2FormColumn title="Tillgångar" groups={assets} expandedRow={expandedInk2rRow} setExpandedRow={setExpandedInk2rRow} fmt={fmt} />
                          <Ink2FormColumn title="Eget kapital och skulder" groups={equityAndLiabilities} expandedRow={expandedInk2rRow} setExpandedRow={setExpandedInk2rRow} fmt={fmt} />
                        </>
                      );
                    })()}
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

                {/* Knapparna satt tidigare HÄR, längst ner efter två långa
                    tabeller — de ligger nu i steg 2 och 3 högst upp, där man
                    faktiskt letar efter dem. Kvar här: bara källhänvisningen
                    för fältkoderna, som hör till tabellerna ovan. */}
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
              in de skattemässiga bedömningarna själv, se ink2s.js. Samma
              "Inkomstdeklaration"-flik som INK2R ovan, inte en egen. */}
          {!filesOwnIncomeDeclaration && activeSection === 'ink2' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
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

          {/* NE-bilaga — bara enskild firma. Manuell ifyllnad, samma
              motivering och mönster som INK2S ovan (se ne.js:s filkommentar
              för varför beloppen inte kan fyllas i automatiskt ur
              bokföringen som INK2R gör för aktiebolag). Etiketterna själva
              ÄR verifierade — direkt mot en skärmdump av den riktiga
              blanketten samt Skatteverkets egen vägledning "Deklarera på
              NE-blanketten" (SKV 306) — bara kontointervallen (VILKA
              bokförda belopp som hör till vilken ruta) saknar en
              verifierad källa här. */}
          {isSoleProp && activeSection === 'ne' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>NE-bilaga — Inkomst av näringsverksamhet</h2>
                  <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '660px' }}>
                    Samma fält och ordning som Skatteverkets egen blankett (B1–B16, R1–R11) — men till skillnad från Inkomstdeklaration 2
                    ovan går de här beloppen inte att räkna fram automatiskt ur bokföringen ännu, så du fyller i dem själv. Eget kapital
                    (B10) och Bokfört resultat (R11) räknas ut åt dig utifrån de andra fälten.
                  </p>
                </div>
                {hasAnyNeValue && !isLocked && (
                  <button
                    type="button"
                    onClick={resetNeValues}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '12.5px', color: 'var(--status-red-text)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    <RotateCcw size={13} /> Nollställ alla
                  </button>
                )}
              </div>

              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px' }}>Balansräkning/räkenskapsschema</div>
                <div className="form-row-2" style={{ display: 'grid', gap: '28px', gridTemplateColumns: '1fr 1fr', marginBottom: '28px' }}>
                  <NeFormColumn
                    title="Tillgångar" groups={neBalanceByColumn.assets}
                    values={neValues.balance} disabled={isLocked}
                    onChange={(key, v) => updateNeValue('balance', key, v)}
                  />
                  <NeFormColumn
                    title="Eget kapital och skulder" groups={neBalanceByColumn.liabilities}
                    values={neValues.balance} disabled={isLocked}
                    onChange={(key, v) => updateNeValue('balance', key, v)}
                    derived={
                      <Ink2sStatTile
                        label="B10 Eget kapital (tillgångar − skulder)"
                        amount={neBalance.equity}
                        tone={neBalance.equity >= 0 ? 'green' : 'red'}
                        Icon={neBalance.equity >= 0 ? TrendingUp : TrendingDown}
                      />
                    }
                  />
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>Resultaträkning/räkenskapsschema</div>
                <div style={{ maxWidth: '620px' }}>
                  <NeFormColumn
                    title="" groups={neResultByGroup}
                    values={neValues.result} disabled={isLocked}
                    onChange={(key, v) => updateNeValue('result', key, v)}
                    derived={
                      <Ink2sStatTile
                        label="R11 Bokfört resultat (förs över till sidan 2, R12)"
                        amount={neResult.total}
                        tone={neResult.total >= 0 ? 'green' : 'red'}
                        Icon={neResult.total >= 0 ? TrendingUp : TrendingDown}
                      />
                    }
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '20px', padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                  <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
                  <div>
                    Fyll bara i de fält som är relevanta för din verksamhet. Beloppen sparas i din bokföring men skrivs inte med i någon
                    SRU-fil ännu (ingen verifierad kontokoppling hittad för NE-bilagan) — ladda ner blanketten direkt hos Skatteverket och
                    för över siffrorna dit, eller fyll i den digitalt i e-tjänsten Inkomstdeklaration 1.
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
