import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, Clock, Circle, Lock, Calculator, ChevronRight, ExternalLink, Info, Download, Users, Loader2, AlertTriangle, TrendingUp, TrendingDown, ArrowRight, RotateCcw, ClipboardList, Plus, Trash2,
} from './icons';
import VatDeclaration from './VatDeclaration';
import TaxOverview from './TaxOverview';
import Partners from './Partners';
import Dividend from './Dividend';
import AnnualReport from './AnnualReport';
import EcSalesList from './EcSalesList';
import { computeEcSalesList, ecPeriod, ecDeadline } from '../utils/ecSalesList';
import { previousFiscalYear, annualReportDeadline } from '../utils/annualReport';
import { pendingDepreciation } from '../utils/fixedAssets';
import { isReconciledThrough } from '../utils/reconciliation';
import ListPageHeader from './shared/ListPageHeader';
import { computeYearResult, buildYearEndClosing, buildResultReclassification, legacyLockedYears } from '../utils/yearEnd';
import { validatePartners } from '../utils/partners';
import { detectOrgType } from '../utils/orgType';
import { isUfCompany, UF_TAX_SECTION_IDS } from '../utils/ufMode';
import { summarizeAnnualPayrollByEmployee, neededTaxTableKeysForYear, downloadKuPdf } from '../utils/kuExport';
import { downloadAgiPdf } from '../utils/agiExport';
import AgiReportDetails from './AgiReportDetails';
import { downloadNePdf } from '../utils/neExport';
import { computeEmployeePayroll } from '../utils/payrollCalculation';
import { preloadSkattetabell } from '../utils/skattetabell';
import { computeInk2r } from '../utils/ink2r';
import { computeInk2rResultat } from '../utils/ink2rResultat';
import { computeNeBalance, computeNeResult, computeNeBalanceSuggestions, computeNeResultSuggestions } from '../utils/ne';
import { downloadInk2rSru, sruMissingFields } from '../utils/sruExport';
import { nextVatDeadline, nextAgiDeadline, nextKuDeadline, vatDueDate } from '../utils/declarationDeadlines';
import { confirmDialog } from './shared/ConfirmDialog';
import { activeFiscalYear, inPeriod } from '../utils/fiscalYear';
import { t as tr, dateLocale } from '../i18n';

const fmt = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

// 'YYYY-MM' → "September 2026"/"September" — Intl i stället för en egen
// hårdkodad månadslista, så den alltid böjs och stavas exakt som resten
// av sv-SE-webben (inklusive versalen först, som toLocaleDateString ger
// gratis här till skillnad från vissa Intl-vägar som ger gemener).
function monthLabel(period, { withYear = true } = {}) {
  const [year, month] = period.split('-').map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString(dateLocale(), { month: 'long' });
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return withYear ? `${capitalized} ${year}` : capitalized;
}

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
/* Kundönskemål ("boring, vibe coded — gör den levande"): en riktig
 * stegvisare har en sammanhållande LINJE mellan cirklarna (samma sak som
 * ett kvitto-spårningsflöde eller en beställningsstatus) — inte bara en
 * lös lista med siffror. Linjen ritas med en pseudo-kant på själva
 * cirkel-kolumnen (::before via inline `position:relative` + en absolut
 * positionerad stapel), så den fungerar lika bra staplat i en smal mobil-
 * bredd som i två kolumner på desktop — ingen egen bredd att bryta sönder.
 * Ej avklarat steg får en svagt tonad (inte platt vit/grå) cirkel, så hela
 * raden känns som en aktiv del av sidan snarare än en overksam etikett. */
function Ink2Step({ n, title, done, last, children }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', paddingBottom: last ? 0 : '14px' }}>
      <div style={{ position: 'relative', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: done ? 'var(--status-green-bg)' : 'var(--status-blue-bg)',
          color: done ? 'var(--status-green-text)' : 'var(--status-blue-text)',
          fontSize: '12.5px', fontWeight: 700,
          boxShadow: done ? '0 0 0 3px var(--status-green-bg)' : '0 0 0 3px var(--bg-muted)',
          zIndex: 1,
        }}>
          {done ? <CheckCircle2 size={15} /> : n}
        </div>
        {!last && <div aria-hidden="true" style={{ width: 2, flex: 1, minHeight: '18px', background: 'var(--border)', marginTop: '2px' }} />}
      </div>
      <div style={{ minWidth: 0, flex: 1, paddingBottom: last ? 0 : '4px' }}>
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
      title={tr('ui.faltkod_klicka_for_att_se_kontona_bakom_beloppet', { fieldCode: row.fieldCode })}
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
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{tr('ui.konton_bakom_raden')}</div>
          {row.accounts.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tr('ui.inga_konton_med_saldo')}</div>
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

/** En rad i NE-blanketten — samma täta radlayout som INK2S numera
 * använder (radkod, tecken, etikett, belopp, en rad), i stället för en
 * egen boxad ruta per fält. `isSuggested` (dimmad "Förslag"-etikett)
 * skiljer på "det här är ett levande förslag ur bokföringen" och "det här
 * är något du själv skrivit in", utan att låsa fältet som INK2R:s
 * klick-för-att-se-konton-rutor gör. */
function NeFormField({ row, value, onChange, disabled, isSuggested, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: last ? 'none' : '1px solid var(--border-light)' }}>
      <span style={{ width: '38px', flexShrink: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{row.row}</span>
      {row.sign && <SignBadge sign={row.sign} />}
      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4, minWidth: 0 }}>{row.label}</span>
      {isSuggested && value && (
        <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, color: 'var(--status-blue-text)', background: 'var(--status-blue-bg)', padding: '1px 6px', borderRadius: '999px' }}>{tr('ui.forslag')}</span>
      )}
      <Ink2sAmountInput value={value ?? ''} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** En kolumn i NE-blanketten — samma gruppindelning (Anläggnings-/
 * Omsättningstillgångar, Skulder osv) som Ink2FormColumn, fast med
 * editerbara NeFormField-rader i stället för klick-för-att-se-konton.
 *
 * Kundönskemål (skärmdumpar av Skatteverkets egen blankett och andra
 * bokföringsprogram, "gör det som de stora"): grupperna var hopfällbara
 * — en riktig blankett döljer aldrig ett fält. Alla rader alltid synliga
 * nu, som en tät lista, samma mönster som INK2S ovan fick i samma
 * uppföljning. */
function NeFormColumn({ title, groups, values, onChange, disabled, derived, suggestedKeys }) {
  const visibleGroups = groups.filter(g => g.rows.length > 0);
  if (visibleGroups.length === 0 && !derived) return null;
  return (
    <div>
      {title && <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>{title}</div>}
      <div>
        {visibleGroups.map(g => (
          <div key={g.group} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{g.group}</div>
            {g.rows.map((r, i) => (
              <NeFormField
                key={r.key} row={r} value={values?.[r.key]} disabled={disabled}
                onChange={v => onChange(r.key, v)} isSuggested={suggestedKeys?.has(r.key)}
                last={i === g.rows.length - 1}
              />
            ))}
          </div>
        ))}
        {derived}
      </div>
    </div>
  );
}

export default function Taxes({
  company, verifications = [], invoices = [], expenses = [], accounts = [], contacts = [],
  employees = [], payrollRuns = [], agiReports = [],
  onCreateAgiReport, onMarkAgiSubmitted, onDeleteAgiReport,
  vatPeriods = {}, onBookVatPeriod, onNavigateToVerification,
  onAddVerification, setCompanyInfo, setAccounts, onNavigateToTab, initialSection, showInventoryStep = true,
}) {
  // Kalenderåret styr bara AGI och kontrolluppgifter, som alltid följer
  // kalenderåret. Bokslut, INK2, NE och SRU följer företagets räkenskapsår
  // (fy), som kan vara brutet eller ett förlängt första år.
  const currentYear = new Date().getFullYear().toString();
  const fy = activeFiscalYear(company);
  // Nyckeln är "2026" för ett kalenderår (samma som äldre sparade data) och
  // "2025/2026" för ett brutet år. Perioden skickas till beräkningarna.
  const fyKey = fy.key;
  const fyPeriod = fy.isCalendar ? fy.key : { start: fy.start, end: fy.end };
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
  const [activeSection, setActiveSection] = useState(initialSection || 'dates');
  // Vilket momskvartal översikten vill öppna (se openFromOverview).
  const [vatFocus, setVatFocus] = useState(null);
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
    // Momsfliken finns inte för ett företag utan momsregistrering; Översikt är då reserven.
    const fallback = company?.vatRegistered === false ? 'dates' : 'vat';
    if (filesOwnIncomeDeclaration && activeSection === 'ink2') setActiveSection(fallback);
    if (!isSoleProp && activeSection === 'ne') setActiveSection(fallback);
    if (company?.vatRegistered === false && activeSection === 'vat') setActiveSection('dates');
  }, [filesOwnIncomeDeclaration, isSoleProp, activeSection, company?.vatRegistered]);

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

  // ── AGI (Arbetsgivardeklaration) ──
  const [agiYear, setAgiYear] = useState(currentYear);
  // Vilken AGI-månad som visas i detalj (AgiReportDetails).
  const [openAgiId, setOpenAgiId] = useState(null);
  const [agiMonth, setAgiMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [agiBulkBusy, setAgiBulkBusy] = useState(false);

  // Vilka månader som borde ha en AGI-rapport men inte har det — räknat
  // från den FÖRSTA anställningen (aldrig från årets januari rakt av: ett
  // företag som nyanställde i juni "saknar" inte AGI för januari–maj, det
  // fanns ingen arbetsgivarskyldighet då) till och med innevarande månad
  // (eller december för ett tidigare år). Kräver Skatteverkets
  // "nolldeklaration" precis som för månader MED löneutbetalning — se
  // bannern som använder listan.
  const earliestEmploymentMonth = useMemo(() => {
    const dates = employees.map(e => e.startDate).filter(Boolean);
    if (!dates.length) return null;
    return dates.reduce((min, d) => (d < min ? d : min)).slice(0, 7); // 'YYYY-MM'
  }, [employees]);
  const missingAgiMonths = useMemo(() => {
    if (!earliestEmploymentMonth) return [];
    const year = Number(agiYear);
    const [earliestYear, earliestMonth] = earliestEmploymentMonth.split('-').map(Number);
    if (year < earliestYear) return [];
    const now = new Date();
    const startMonth = year === earliestYear ? earliestMonth : 1;
    const endMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const existing = new Set(agiReports.map(r => r.period));
    const months = [];
    for (let m = startMonth; m <= endMonth; m++) {
      const period = `${year}-${String(m).padStart(2, '0')}`;
      if (!existing.has(period)) months.push(period);
    }
    return months;
  }, [earliestEmploymentMonth, agiYear, agiReports]);

  const handleCreateAllMissingAgi = async () => {
    if (!onCreateAgiReport || missingAgiMonths.length === 0) return;
    setAgiBulkBusy(true);
    try {
      for (const period of missingAgiMonths) onCreateAgiReport(period);
    } finally {
      setAgiBulkBusy(false);
    }
  };

  const checklist = company?.yearEndChecklist?.[fyKey] || {};
  const lockedYears = company?.lockedFiscalYears || {};
  const closing = lockedYears[fyKey];
  const isLocked = Boolean(closing);
  // Avskrivningar t.o.m. årets sista månad — steg 5 i årsbokslutet och samma
  // beräkning som fliken Anläggningstillgångar visar.
  const depreciationPending = pendingDepreciation(company?.fixedAssets || [], verifications, fy.end.slice(0, 7), lockedYears);

  // Steg 2/3: fakturor som fortfarande ligger som utkast (inte bokförda) i år.
  const draftCustomerInvoices = invoices.filter(i => (i.type || 'invoice') !== 'quote' && i.status === 'draft' && inPeriod(i.date, fyPeriod));
  const draftSupplierInvoices = expenses.filter(e => e.type === 'supplier_invoice' && e.status === 'draft' && inPeriod(e.date, fyPeriod));

  // Steg 4: har årets sista lönekörning (december) bokförts?
  const runsThisYear = payrollRuns.filter(r => inPeriod(r.period, fyPeriod));
  // Räkenskapsårets sista månad (december för ett kalenderår).
  const decemberRunBooked = runsThisYear.some(r => r.period === fy.end.slice(0, 7) && r.completedSteps?.includes('booked'));
  const anyRunBookedThisYear = runsThisYear.some(r => r.completedSteps?.includes('booked'));

  // Årets resultat: intäkter minus kostnader, klass 3–8 (inklusive finansiella
  // poster och skatt), samma underlag som bokslutstransaktionen bokar.
  const yearResult = isLocked ? closing.result : computeYearResult(verifications, fyPeriod);
  const partnersReady = !isTradingPartnership || validatePartners(company?.partners).length === 0;

  // INK2R (balansräkningsdelen av Inkomstdeklaration 2) — bara relevant för
  // aktiebolag/ekonomisk förening m.fl., inte enskild firma. Se ink2r.js
  // för källor/osäkerhet kring fältkoderna.
  const ink2r = useMemo(
    () => computeInk2r(verifications, accounts, new Date(`${fy.end}T23:59:59`)),
    [verifications, accounts, fy.end]
  );
  const ink2rResultat = useMemo(
    () => computeInk2rResultat(verifications, fyPeriod),
    [verifications, fy.start, fy.end] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Rörelseresultat = rad 3.1–3.11 (intäkter minus rörelsekostnader, före
  // finansiella poster), samma tecken som ink2rResultat.total använder.
  const ink2OperatingResult = ink2rResultat.rows.reduce((sum, r) => {
    const n = Number(r.row.split('.')[1]);
    if (n > 11) return sum;
    return sum + (r.polarity === 'revenue' ? r.amount : -r.amount);
  }, 0);
  const hasBookingsThisYear = verifications.some(v => inPeriod(v.date, fyPeriod));
  // SRU-filen avvisas helt utan organisationsnummer, namn, postnummer och
  // ort (INFO.SRU), så knappen kräver dem i stället för att ge en fil som
  // Skatteverket inte tar emot.
  const sruMissing = sruMissingFields(company);
  const canDownloadSru = ink2r.balanced && sruMissing.length === 0;
  const ink2Warnings = [
    !isLocked && tr('ui.rakenskapsaret_ar_inte_last_siffrorna_kan_andras'),
    !hasBookingsThisYear && tr('ui.inga_bokforda_transaktioner_for_rakenskapsaret', { label: fy.label }),
  ].filter(Boolean);

  // NE-bilaga — bara enskild firma (inte handelsbolag, som deklarerar sin
  // andel via N3A/K10 i stället, se filesOwnIncomeDeclaration ovan).
  //
  // Kundönskemål ("gör det som Bokio — det måste funka"): beloppen är nu
  // FÖRIFYLLDA ur bokföringen (computeNeBalanceSuggestions/
  // computeNeResultSuggestions, se ne.js för källan och de kvarvarande
  // medvetna undantagen), inte längre helt manuell ifyllnad. Fortfarande
  // fritt redigerbara — ett fält man själv skrivit i (även till 0, ett
  // explicit tomt '' räknas som "rensat", inte "aldrig ifyllt") vinner
  // ALLTID över förslaget, och uppdateras aldrig tyst i efterhand. Rör man
  // aldrig ett fält alls följer det bokföringen live (bokför man mer i
  // efterhand uppdateras det automatiskt) — precis som INK2R redan gör.
  const neAsOfDate = useMemo(() => new Date(`${fy.end}T23:59:59`), [fy.end]);
  const neBalanceSuggestions = useMemo(
    () => computeNeBalanceSuggestions(verifications, accounts, neAsOfDate),
    [verifications, accounts, neAsOfDate]
  );
  const neResultSuggestions = useMemo(
    () => computeNeResultSuggestions(verifications, fyPeriod),
    [verifications, fy.start, fy.end] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const neStoredValues = company?.ne?.[fyKey] || {};
  // Sammanslagning: ett SPARAT fält (även '') vinner alltid över förslaget.
  // `undefined` (aldrig rört) faller igenom till förslaget.
  const mergeNeValues = (suggested, stored) => {
    const merged = { ...suggested };
    Object.entries(stored || {}).forEach(([key, v]) => { merged[key] = v; });
    return merged;
  };
  const neValues = {
    balance: mergeNeValues(neBalanceSuggestions.values, neStoredValues.balance),
    result: mergeNeValues(neResultSuggestions.values, neStoredValues.result),
  };
  // Vilka nycklar som visar ett OREDIGERAT förslag just nu (för den lilla
  // "Föreslaget"-etiketten i NeFormField) — skiljer sig från neValues,
  // som redan har slagit ihop dem, så UI:t vet VILKET av de två som visas.
  const neSuggestedKeys = new Set([
    ...Object.keys(neBalanceSuggestions.values).filter(k => neStoredValues.balance?.[k] === undefined),
    ...Object.keys(neResultSuggestions.values).filter(k => neStoredValues.result?.[k] === undefined),
  ]);
  const neBalance = useMemo(() => computeNeBalance(neValues.balance), [neValues.balance]);
  const neResult = useMemo(() => computeNeResult(neValues.result), [neValues.result]);
  const updateNeValue = (section, key, rawValue) => {
    if (isLocked) return;
    setCompanyInfo(prev => ({
      ...prev,
      ne: {
        ...prev.ne,
        [fyKey]: {
          ...(prev.ne?.[fyKey] || {}),
          [section]: { ...(prev.ne?.[fyKey]?.[section] || {}), [key]: rawValue },
        },
      },
    }));
  };
  const hasAnyNeValue = [...Object.values(neStoredValues.balance || {}), ...Object.values(neStoredValues.result || {})]
    .some(v => v !== '' && v != null);
  const resetNeValues = async () => {
    if (isLocked || !hasAnyNeValue) return;
    if (!(await confirmDialog(tr('ui.rensa_alla_egna_andringar_av_ne_beloppen_for_och', { label: fy.label }), { danger: true }))) return;
    setCompanyInfo(prev => {
      const next = { ...(prev.ne || {}) };
      delete next[fyKey];
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
  const neFilledCount = [...neBalance.rows, ...neResult.rows].filter(r => r.amount).length;
  const neTotalFields = neBalance.rows.length + neResult.rows.length;

  const toggleManualStep = (key) => {
    if (isLocked) return;
    setCompanyInfo(prev => ({
      ...prev,
      yearEndChecklist: {
        ...prev.yearEndChecklist,
        [fyKey]: { ...(prev.yearEndChecklist?.[fyKey] || {}), [key]: !(prev.yearEndChecklist?.[fyKey]?.[key]) },
      },
    }));
  };

  const allSteps = [
    {
      id: 1, kind: 'manual', key: 'bankRecon', title: tr('ui.avstamning_bankkonto'),
      // Klar antingen manuellt, eller automatiskt när en avstämning utan
      // differens är sparad per bokslutsdagen (Bank > Avstämning).
      status: (checklist.bankRecon || isReconciledThrough(company?.reconciliations, fy.end)) ? 'Klar' : tr('ui.ej_paborjad'),
      hint: tr('ui.stam_av_bankkontot_och_kassan_under_bank_avstamn'),
      tab: 'bank',
    },
    {
      id: 2, kind: 'auto', title: tr('ui.bokfor_arets_sista_kundfakturor'),
      status: draftCustomerInvoices.length === 0 ? 'Klar' : 'Pågår',
      hint: draftCustomerInvoices.length > 0 ? tr('ui.obokford_kundfaktura_kvar', { length: draftCustomerInvoices.length, v1: draftCustomerInvoices.length === 1 ? '' : 'a', v2: draftCustomerInvoices.length === 1 ? '' : 'r' }) : tr('ui.inga_obokforda_kundfakturor_i_ar'),
      tab: 'invoices',
    },
    {
      id: 3, kind: 'auto', title: tr('ui.bokfor_arets_sista_leverantorsfakturor'),
      status: draftSupplierInvoices.length === 0 ? 'Klar' : 'Pågår',
      hint: draftSupplierInvoices.length > 0 ? tr('ui.obokford_leverantorsfaktura_kvar', { length: draftSupplierInvoices.length, v1: draftSupplierInvoices.length === 1 ? '' : 'a', v2: draftSupplierInvoices.length === 1 ? '' : 'r' }) : tr('ui.inga_obokforda_leverantorsfakturor_i_ar'),
      tab: 'expenses',
    },
    {
      id: 4, kind: 'auto', title: tr('ui.gor_arets_sista_lonekorning'),
      status: decemberRunBooked ? 'Klar' : (anyRunBookedThisYear || runsThisYear.length > 0) ? 'Pågår' : tr('ui.ej_paborjad'),
      hint: decemberRunBooked ? tr('ui.lonen_ar_bokford', { v0: monthLabel(fy.end.slice(0, 7), { withYear: false }) }) : tr('ui.kor_och_bokfor_lonekorningen_for_rakenskapsarets', { v0: monthLabel(fy.end.slice(0, 7), { withYear: false }).toLowerCase() }),
      tab: 'payroll',
    },
    {
      id: 5, kind: 'auto', title: tr('ui.bokfor_arets_avskrivningar'),
      status: depreciationPending.months.length === 0 ? 'Klar' : 'Pågår',
      hint: depreciationPending.months.length === 0
        ? ((company?.fixedAssets || []).length === 0 ? tr('ui.inga_anlaggningstillgangar_i_registret') : tr('ui.alla_avskrivningar_for_aret_ar_bokforda'))
        : tr('ui.manad_kvar_att_bokfora', { length: depreciationPending.months.length, v1: depreciationPending.months.length === 1 ? '' : 'er', v2: fmt(depreciationPending.total) }),
      tab: 'fixed_assets',
    },
    {
      id: 6, kind: 'manual', key: 'accruals', title: tr('ui.periodisera_upplupna_och_forutbetalda_poster'),
      status: checklist.accruals ? 'Klar' : tr('ui.ej_paborjad'),
      hint: tr('ui.hyra_forsakringar_el_och_annat_som_hor_till_en_a'),
      tab: 'accruals',
    },
    {
      id: 7, kind: 'manual', key: 'inventory', title: tr('ui.inventering_och_lager_om_tillampligt'),
      status: checklist.inventory ? 'Klar' : tr('ui.ej_paborjad'),
      hint: tr('ui.rakna_och_vardera_varulagret_per_bokslutsdagen_u'),
      tab: 'articles',
    },
    {
      id: 8, kind: 'auto', title: tr('ui.berakna_och_bokfor_arets_resultat'),
      status: isLocked ? 'Klar' : tr('ui.ej_paborjad'),
      hint: tr('ui.bokfors_automatiskt_som_en_bokslutstransaktion_n'),
    },
    {
      id: 9, kind: 'auto', title: tr('ui.las_rakenskapsaret'),
      status: isLocked ? 'Klar' : tr('ui.ej_paborjad'),
      hint: isLocked ? tr('ui.last', { v0: new Date(closing.lockedAt).toLocaleDateString('sv-SE') }) : tr('ui.blir_tillganglig_nar_alla_steg_ovan_ar_klara'),
    },
  ];

  // Bara de steg som gäller för företaget: lönesteget kräver lön,
  // avskrivningar anläggningstillgångar och inventering att artiklar och
  // lager används. Förut stod de där ändå, och ett steg som aldrig kan bli
  // klart stoppade låsningen (en enskild firma utan anställda kunde inte
  // låsa året). Numreringen följer de steg som visas.
  const stepApplies = (s) => (s.id !== 4 || employees.length > 0 || payrollRuns.length > 0)
    && (s.id !== 5 || (company?.fixedAssets || []).length > 0)
    && (s.id !== 7 || showInventoryStep);
  const steps = allSteps.filter(stepApplies).map((s, i) => ({ ...s, n: i + 1 }));

  // Bara steg 1–7 kan bli klara innan låsning — steg 8 ("bokför årets
  // resultat") och steg 9 ("lås räkenskapsåret") ÄR själva låsningen och
  // blir Klar som en följd av den, inte en förutsättning för den. Att
  // kräva steg 8 här skulle göra knappen evigt inaktiv.
  const stepsBeforeLock = steps.filter(s => s.id < 8);
  // Ett handels-/kommanditbolag måste ha delägarna inlagda innan året kan
  // låsas — bokslutet fördelar resultatet direkt på dem.
  // Statusen jämförs i koden på svenska ('Klar', 'Pågår'); bara visningen översätts.
  const stepStatusLabel = (status) => ({ Klar: tr('ui.klar'), 'Pågår': tr('ui.pagar') }[status] || status);
  const canLock = !isLocked && partnersReady && stepsBeforeLock.every(s => s.status === 'Klar');

  // År som låstes innan bokslutet kände till bolagsformen har resultatet på
  // 2099. För en enskild firma ska det ligga på 2019, så det flyttas med en ny
  // verifikation (en bokförd verifikation rättas aldrig genom att skrivas om).
  const legacyYears = isSoleProp ? legacyLockedYears(company?.lockedFiscalYears) : [];
  const handleReclassifyYear = ({ year, result }) => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const verification = buildResultReclassification({ year, result, date });
    if (verification) onAddVerification(verification);
    setCompanyInfo(prev => ({
      ...prev,
      lockedFiscalYears: { ...prev.lockedFiscalYears, [year]: { ...prev.lockedFiscalYears?.[year], resultAccount: '2019' } },
    }));
  };

  const handleLockYear = () => {
    if (!canLock) return;

    // Bokslutstransaktion: nollställer alla resultatkonton (klass 3–8) med
    // aktivitet i år och bokar årets resultat på eget kapital — 2099 för
    // aktiebolag m.fl., 2019 för enskild firma, delägarnas konton för
    // handels-/kommanditbolag. Balanserad per konstruktion, se utils/yearEnd.js.
    const { verification, result, destination } = buildYearEndClosing({
      verifications, year: fyPeriod, orgType, partners: company?.partners,
    });
    if (verification) onAddVerification(verification);

    setCompanyInfo(prev => ({
      ...prev,
      lockedFiscalYears: { ...prev.lockedFiscalYears, [fyKey]: { lockedAt: new Date().toISOString(), result, resultAccount: destination, start: fy.start, end: fy.end } },
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
  const hasPayroll = employees.length > 0 || payrollRuns.length > 0;
  const hasEuCustomers = contacts.some(c => c.customerType === 'eu_company' && String(c.vatNumber || '').trim());
  const sectionTabs = [
    { id: 'dates', label: tr('ui.oversikt') },
    // Inte momsregistrerat: ingen momsdeklaration att lämna.
    ...(company?.vatRegistered === false ? [] : [{ id: 'vat', label: tr('ui.moms') }]),
    // AGI och kontrolluppgifter — bara relevant för företag som någon gång haft en anställd
    // (annars finns inget att deklarera, samma "ingen anställd, ingen AGI-deadline"-princip
    // som agiDeadlineInfo nedan redan använder).
    ...(hasPayroll ? [{ id: 'agi', label: tr('ui.arbetsgivardeklaration') }] : []),
    // Årsöversikt per anställd (hette Kontrolluppgifter). Ingen kontrolluppgift
    // lämnas för lön sedan 2019, lönen redovisas i AGI varje månad.
    ...(hasPayroll ? [{ id: 'ku', label: tr('ui.arsoversikt_lon') }] : []),
    // Periodisk sammanställning, när företaget har kunder i andra EU-länder.
    ...(company?.vatRegistered !== false && hasEuCustomers ? [{ id: 'ecsales', label: tr('ui.periodisk_sammanstallning') }] : []),
    { id: 'yearend', label: tr('ui.arsbokslut') },
    // Årsredovisning till Bolagsverket, bara aktiebolag.
    ...(orgType === 'Aktiebolag (AB)' ? [{ id: 'annual', label: tr('ui.arsredovisning') }] : []),
    // INK2 för aktiebolag och ekonomisk förening. Inte ideell förening eller
    // stiftelse, som lämnar en annan blankett (INK3) som Bokix inte fyller i.
    ...(!filesOwnIncomeDeclaration && orgType !== 'Ideell förening / stiftelse' ? [{ id: 'ink2', label: tr('ui.inkomstdeklaration') }] : []),
    // NE-bilaga — bara enskild firma. INTE handelsbolag (som också har
    // filesOwnIncomeDeclaration=true men deklarerar sin andel med en N3A/
    // K10-bilaga i stället, se hjälptexten i Årsbokslut-kortet).
    ...(isSoleProp ? [{ id: 'ne', label: tr('ui.ne_bilaga') }] : []),
    // Bolagsformsspecifika flikar: delägare/resultatfördelning för HB/KB,
    // utdelning för AB. Enskild firma har varken eller.
    ...(isTradingPartnership ? [{ id: 'partners', label: tr('ui.delagare') }] : []),
    ...(orgType === 'Aktiebolag (AB)' ? [{ id: 'dividend', label: tr('ui.utdelning') }] : []),
  ].filter(tab => !isUfCompany(company) || UF_TAX_SECTION_IDS.includes(tab.id));

  // Fyra flikar i stället för upp till åtta (2026-10-10): det som hör ihop
  // ligger under samma flik, med en rad steg under när fliken har flera
  // delar. Årsavslut visar stegen i den ordning de görs, och bara de som
  // gäller för bolagsformen (sectionTabs ovan avgör det).
  const TAX_GROUPS = [
    { id: 'g_overview', label: tr('ui.oversikt'), sections: ['dates'] },
    { id: 'g_vat', label: tr('ui.moms'), sections: ['vat', 'ecsales'] },
    { id: 'g_payroll', label: tr('ui.skatt_lon'), sections: ['agi', 'ku'] },
    { id: 'g_yearend', label: tr('ui.arsavslut'), sections: ['yearend', 'annual', 'ink2', 'ne', 'partners', 'dividend'], numbered: true },
  ];
  const groupTabs = TAX_GROUPS
    .map(g => ({ ...g, sections: g.sections.filter(id => sectionTabs.some(t => t.id === id)) }))
    .filter(g => g.sections.length > 0);
  const activeGroup = groupTabs.find(g => g.sections.includes(activeSection)) || groupTabs[0];
  const sectionLabel = (id) => sectionTabs.find(t => t.id === id)?.label || id;

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
  const fmtDeadlineDate = (d) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const daysLeftLabel = (daysLeft) => {
    if (daysLeft < 0) return tr('ui.forsenad');
    if (daysLeft === 0) return tr('ui.idag_2');
    if (daysLeft === 1) return tr('ui.imorgon');
    return tr('ui.om_dagar', { daysLeft });
  };

  // ── Översikt: vad ska göras, i vilken ordning ──
  // Bokix kan inte se om något har lämnats in hos Skatteverket, så man markerar det själv
  // (company.taxFilings, nyckel per uppgift och period). AGI har redan egen status per månad.
  const filings = company?.taxFilings || {};
  const filedDate = (key) => (filings[key]?.at ? new Date(filings[key].at).toLocaleDateString('sv-SE') : null);
  const toggleFiled = (key) => {
    if (!setCompanyInfo) return;
    setCompanyInfo(prev => {
      const next = { ...(prev.taxFilings || {}) };
      if (next[key]) delete next[key]; else next[key] = { at: new Date().toISOString() };
      return { ...prev, taxFilings: next };
    });
  };
  const overviewItems = (() => {
    const hasTab = (id) => sectionTabs.some(t => t.id === id);
    const list = [];

    if (hasTab('vat')) {
      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);
      const quarterly = (company?.vatPeriod || 'quarterly') === 'quarterly';
      const vatRow = (year, quarter) => {
        const periodKey = `${year}-Q${quarter}`;
        const filedKey = `vat:${periodKey}`;
        const filedAt = filedDate(filedKey);
        const booked = Boolean(vatPeriods[periodKey]);
        const dueDate = vatDueDate(year, quarter);
        const daysLeft = Math.round((dueDate - today0) / 86400000);
        return {
          key: `vat-${periodKey}`, section: 'vat', title: tr('ui.momsdeklaration'),
          subtitle: tr('ui.kvartal_3', { quarter, year }),
          dueDate, daysLeft, vatPeriod: { year, quarter },
          done: Boolean(filedAt),
          status: filedAt ? tr('ui.inlamnad_datum', { filedAt }) : booked ? tr('ui.perioden_ar_bokford_ladda_ner_filen_och_lamna_in') : tr('ui.inte_paborjad_bokix_kontrollerar_och_raknar_ut_r'),
          cta: filedAt ? tr('ui.visa') : booked ? tr('ui.lamna_in') : tr('ui.gor_momsdeklarationen'),
          filedKey, canMark: booked,
        };
      };
      if (!quarterly) {
        list.push({ key: 'vat', section: 'vat', title: tr('ui.momsdeklaration'), subtitle: tr('ui.moms'), dueDate: null, daysLeft: null, done: false, status: tr('ui.oppna_for_att_forbereda_momsdeklarationen'), cta: tr('ui.oppna_moms') });
      } else {
        // Bokförda kvartal som ännu inte är markerade som inlämnade får inte försvinna ur listan
        // (nextVatDeadline hoppar direkt till nästa kvartal när ett är bokfört). Bara de som
        // förfaller inom 90 dagar bakåt eller framåt, så gamla kvartal inte fyller listan.
        const bookedRows = Object.keys(vatPeriods)
          .filter(k => vatPeriods[k] && /^\d{4}-Q[1-4]$/.test(k))
          .map(k => { const [y, q] = k.split('-Q').map(Number); return vatRow(y, q); })
          .filter(r => r.daysLeft >= -90);
        bookedRows.forEach(r => list.push(r));
        if (vatDeadlineInfo) {
          const r = vatRow(vatDeadlineInfo.year, vatDeadlineInfo.quarter);
          const periodEnded = new Date(vatDeadlineInfo.year, vatDeadlineInfo.quarter * 3, 0) <= today0;
          // Nästa kvartal visas när det är dags (perioden är slut eller deadline inom 60 dagar),
          // eller när det inte finns något annat momsärende att visa.
          if (periodEnded || r.daysLeft <= 60 || bookedRows.length === 0) list.push(r);
        }
      }
    }

    if (hasTab('agi')) {
      const ad = agiDeadlineInfo;
      const report = ad ? agiReports.find(r => r.period === ad.periodKey) : null;
      const submitted = report?.status === 'submitted';
      const n = missingAgiMonths.length;
      list.push({
        key: 'agi', section: 'agi', title: tr('ui.arbetsgivardeklaration'),
        subtitle: ad ? tr('ui.agi_for', { v0: monthLabel(ad.periodKey) }) : 'AGI',
        dueDate: ad?.dueDate, daysLeft: ad ? ad.daysLeft : null,
        done: submitted,
        status: submitted ? tr('ui.inlamnad_2') : report ? tr('ui.ett_utkast_finns_granska_det_och_lamna_in') : n > 0 ? tr('ui.manad_saknar_agi_underlag', { n, v1: n === 1 ? '' : 'er' }) : tr('ui.inte_paborjad'),
        cta: report ? tr('ui.oppna_agi') : tr('ui.skapa_agi'),
      });
    }

    // Ingen deadline för lönens kontrolluppgifter: de lämnas inte sedan 2019,
    // lönen redovisas per person i AGI varje månad.
    if (false && hasTab('ku') && kuDeadlineInfo) {
      const filedKey = `ku:${kuDeadlineInfo.incomeYear}`;
      const filedAt = filedDate(filedKey);
      list.push({
        key: 'ku', section: 'ku', title: tr('ui.kontrolluppgifter'),
        subtitle: tr('ui.inkomstaret', { incomeYear: kuDeadlineInfo.incomeYear }),
        dueDate: kuDeadlineInfo.dueDate, daysLeft: kuDeadlineInfo.daysLeft,
        done: Boolean(filedAt),
        status: filedAt ? tr('ui.inlamnad_datum', { filedAt }) : tr('ui.inte_lamnade_bokix_summerar_arets_loner_per_anst'),
        cta: tr('ui.oppna_kontrolluppgifter'),
        filedKey, canMark: true,
      });
    }

    if (hasTab('yearend')) {
      const doneCount = stepsBeforeLock.filter(s => s.status === 'Klar').length;
      list.push({
        key: 'yearend', section: 'yearend', title: tr('ui.arsbokslut'),
        subtitle: tr('ui.rakenskapsar_3', { label: fy.label }),
        dueDate: null, daysLeft: null,
        done: isLocked,
        status: isLocked ? tr('ui.bokslutet_ar_last_datum', { v0: new Date(closing.lockedAt).toLocaleDateString('sv-SE') }) : tr('ui.av_steg_ar_klara', { doneCount, length: stepsBeforeLock.length }),
        cta: isLocked ? tr('ui.visa_bokslutet') : tr('ui.fortsatt_bokslutet'),
      });
    }

    // Periodisk sammanställning för det senaste avslutade kvartalet, när det
    // fanns försäljning till EU-företag.
    if (hasTab('ecsales')) {
      const now = new Date();
      let q = Math.floor(now.getMonth() / 3);
      let y = now.getFullYear();
      if (q === 0) { q = 4; y -= 1; }
      const period = ecPeriod(y, `Q${q}`);
      const ec = computeEcSalesList({ invoices, contacts, period });
      if (ec.rows.length > 0) {
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const dueDate = new Date(`${ecDeadline(period)}T00:00:00`);
        const filedKey = `ps:${period.code}`;
        const filedAt = filedDate(filedKey);
        list.push({
          key: 'ecsales', section: 'ecsales', title: tr('ui.periodisk_sammanstallning'),
          subtitle: period.label,
          dueDate, daysLeft: Math.round((dueDate - today0) / 86400000),
          done: Boolean(filedAt),
          status: filedAt ? tr('ui.inlamnad_datum', { filedAt }) : tr('ui.kopare_i_eu_ladda_ner_filen_och_lamna_den_hos_sk', { length: ec.rows.length }),
          cta: filedAt ? tr('ui.visa') : tr('ui.oppna'),
          filedKey, canMark: true,
        });
      }
    }

    // Årsredovisningen för det senast avslutade räkenskapsåret, med
    // Bolagsverkets frist (sju månader). Visas från årets slut tills den
    // markerats inlämnad eller fristen passerat med mer än 90 dagar.
    if (hasTab('annual')) {
      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);
      const prevFy = previousFiscalYear(fy, company);
      const dueDate = new Date(`${annualReportDeadline(prevFy.end)}T00:00:00`);
      const daysLeft = Math.round((dueDate - today0) / 86400000);
      const hasPrevBookings = verifications.some(v => v.date >= prevFy.start && v.date <= prevFy.end);
      if (hasPrevBookings && daysLeft >= -90) {
        const filedKey = `ar:${prevFy.key}`;
        const filedAt = filedDate(filedKey);
        list.push({
          key: 'annual', section: 'annual', title: tr('ui.arsredovisning'),
          subtitle: tr('ui.rakenskapsar_till_bolagsverket', { label: prevFy.label }),
          dueDate, daysLeft,
          done: Boolean(filedAt),
          status: filedAt ? tr('ui.inlamnad_datum', { filedAt }) : tr('ui.ladda_ner_skriv_under_efter_arsstamman_och_skick'),
          cta: filedAt ? tr('ui.visa') : tr('ui.gor_arsredovisningen'),
          filedKey, canMark: true,
        });
      }
    }

    const filingSection = isSoleProp ? 'ne' : (!filesOwnIncomeDeclaration ? 'ink2' : null);
    if (filingSection && hasTab(filingSection)) {
      const filedKey = `ink:${fyKey}`;
      const filedAt = filedDate(filedKey);
      list.push({
        key: 'filing', section: filingSection,
        title: isSoleProp ? tr('ui.ne_bilaga') : tr('ui.inkomstdeklaration_ink2'),
        subtitle: tr('ui.rakenskapsar_3', { label: fy.label }),
        dueDate: null, daysLeft: null,
        done: Boolean(filedAt),
        status: filedAt ? tr('ui.inlamnad_datum', { filedAt }) : isLocked ? tr('ui.bokslutet_ar_klart_forbered_filerna_och_lamna_in') : tr('ui.vantar_pa_att_bokslutet_blir_klart'),
        cta: isLocked ? tr('ui.forbered_deklarationen') : tr('ui.se_forhandsvisning'),
        filedKey, canMark: isLocked,
      });
    }

    // Det som brådskar mest först, sedan det utan datum, och det som är klart sist.
    const rank = (i) => (i.done ? 2 : i.daysLeft != null ? 0 : 1);
    list.sort((a, b) => rank(a) - rank(b) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
    return list.map(i => ({
      ...i,
      dueLabel: i.dueDate ? fmtDeadlineDate(i.dueDate) : null,
      daysLabel: i.daysLeft != null ? daysLeftLabel(i.daysLeft) : null,
      urgency: i.daysLeft == null ? '' : i.daysLeft < 0 ? 'late' : i.daysLeft <= 7 ? 'soon' : '',
    }));
  })();
  const openFromOverview = (section, item) => {
    if (item?.vatPeriod) setVatFocus({ ...item.vatPeriod, at: Date.now() });
    setActiveSection(section);
  };
  const nextOverviewItem = overviewItems.find(i => !i.done && i.daysLeft != null);
  const overviewSummary = nextOverviewItem
    ? tr('ui.nasta_senast', { v0: nextOverviewItem.title.toLowerCase(), daysLabel: nextOverviewItem.daysLabel, dueLabel: nextOverviewItem.dueLabel })
    : overviewItems.every(i => i.done) ? tr('ui.allt_ar_inlamnat') : tr('ui.inget_har_en_deadline_just_nu');
  // Efter ett låst bokslut är nästa steg deklarationen (för de bolagsformer som har en).
  const nextFilingSection = isSoleProp ? 'ne' : (!filesOwnIncomeDeclaration ? 'ink2' : null);

  return (
    // Samma "facit"-mönster som Kunder/Anställda/Projekt m.fl. (ListPageHeader
    // med flikar) istället för den gamla egna, höga rubrik+3-radersbeskrivning-
    // headern (som krävde en särskild mobil-undantagsregel, page-shell/
    // page-shell-scroll i index.css, för att inte äta en fjärdedel av
    // telefonskärmen — onödigt nu när headern är lika kompakt som överallt
    // annars i appen).
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title={tr('ui.skatt_och_bokslut')}
        tabs={{
          items: groupTabs.map(g => ({ id: g.id, label: g.label })),
          activeId: activeGroup?.id,
          onChange: (id) => setActiveSection(groupTabs.find(g => g.id === id)?.sections[0] || 'dates'),
        }}
      />
      {activeGroup && activeGroup.sections.length > 1 && (
        <div className="filter-pills tax-steps" role="tablist" style={{ padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {activeGroup.sections.map((id, i) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeSection === id}
              className={'filter-pill' + (activeSection === id ? ' active' : '')}
              onClick={() => setActiveSection(id)}
            >
              {activeGroup.numbered ? `${i + 1}. ${sectionLabel(id)}` : sectionLabel(id)}
            </button>
          ))}
        </div>
      )}

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

          {/* Översikt: vad som ska göras och när (se overviewItems ovan). */}
          {activeSection === 'dates' && (
            <TaxOverview items={overviewItems} summary={overviewSummary} onOpen={openFromOverview} onToggleFiled={toggleFiled} vatExempt={company?.vatRegistered === false} />
          )}

          {/* Momsdeklaration */}
          {activeSection === 'vat' && company?.vatRegistered !== false && (
          <VatDeclaration
            verifications={verifications}
            invoices={invoices}
            expenses={expenses}
            accounts={accounts}
            company={company}
            vatPeriods={vatPeriods}
            onBookPeriod={onBookVatPeriod}
            onNavigateToVerification={onNavigateToVerification}
            filings={filings}
            onToggleFiled={toggleFiled}
            focusPeriod={vatFocus}
          />
          )}

          {/* Årsbokslut */}
          {activeSection === 'yearend' && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {tr('ui.arsbokslut')} {fy.label}
                {isLocked && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: 'var(--border-light)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                    <Lock size={12} /> {tr('ui.rakenskapsar_last')}
                  </span>
                )}
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                {tr('ui.folj_stegen_nedan_for_att_stanga_rakenskapsaret')}
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
                        {step.n}
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
                      {(step.section || step.tab) && step.status !== 'Klar' && (step.section || onNavigateToTab) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (step.section) setActiveSection(step.section); else onNavigateToTab(step.tab); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-text)', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', padding: '2px' }}
                        >
                          {tr('ui.atgarda')} <ChevronRight size={12} />
                        </button>
                      )}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                        background: getStatusBg(step.status), color: getStatusColor(step.status),
                      }}>
                        {getStatusIcon(step.status)}
                        {stepStatusLabel(step.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '20px 24px', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Calculator size={16} /> {isLocked ? tr('ui.bokfort_resultat') : tr('ui.beraknat_resultat')}: <strong style={{ color: yearResult >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>{fmt(yearResult)}</strong>
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
                <Lock size={16} /> {isLocked ? tr('ui.rakenskapsar_last') : tr('ui.las_rakenskapsar_och_skapa_bokslut')}
              </button>
            </div>
            {isLocked && nextFilingSection && sectionTabs.some(t => t.id === nextFilingSection) && (
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontSize: '13.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span><strong>{tr('ui.bokslutet_ar_klart')}</strong> {tr('ui.nasta_steg_ar')} {isSoleProp ? tr('ui.ne_bilagan') : 'inkomstdeklarationen'}{tr('ui.bokix_forbereder_filerna_at_dig')}</span>
                <button type="button" onClick={() => setActiveSection(nextFilingSection)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  {tr('ui.forbered_deklarationen')} <ChevronRight size={15} />
                </button>
              </div>
            )}
            {legacyYears.map(y => (
              <div key={y.year} style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span>{tr('ui.resultatet_for')} {y.year} ({fmt(y.result)} {tr('ui.kr_ligger_pa_2099_som_ar_aktiebolagets_konto_for')}</span>
                <button type="button" onClick={() => handleReclassifyYear(y)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, fontSize: '13px', textDecoration: 'underline', padding: 0 }}>{tr('ui.flytta_till_2019')}</button>
              </div>
            ))}
            {!isLocked && !partnersReady && (
              <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span>{tr('ui.lagg_in_delagarna_och_deras_andelar_innan_du_las')}</span>
                <button type="button" onClick={() => setActiveSection('partners')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, fontSize: '13px', textDecoration: 'underline', padding: 0 }}>{tr('ui.ga_till_delagare')}</button>
              </div>
            )}

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
                    <span>{tr('ui.som_enskild_firma_deklarerar_du_resultatet_vidar')} <strong>{tr('ui.ne_bilaga')}</strong> {tr('ui.i_din_inkomstdeklaration_efter_att_bokslutet_ar')}</span>
                  ) : isTradingPartnership ? (
                    <span>{tr('ui.som_handels_kommanditbolag_betalar_bolaget_ingen')} <strong>{tr('ui.n3a_bilaga')}</strong> {tr('ui.eller_k10_vid_famansforetagsforhallanden_i_sin_e')}</span>
                  ) : (
                    <span>{tr('ui.bokslutet_ska_innehalla_en_balans_och_resultatra')}</span>
                  )}
                  {' '}{tr('ui.bokix_hjalper_dig_strukturera_underlaget_men_ers')}
                  <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {[
                      [tr('ui.moms'), 'https://www.skatteverket.se/foretag/moms'],
                      [tr('ui.bokforing_och_bokslut'), 'https://www.skatteverket.se/foretag/drivaforetag/bokforingochbokslut.4.58d555751259e4d661680006527.html'],
                      [tr('ui.enskild_naringsverksamhet'), 'https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/enskildnaringsverksamhet/bokforingochdeklaration.4.361dc8c15312eff6fd2c99f.html'],
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
          {activeSection === 'partners' && isTradingPartnership && (
            <Partners company={company} verifications={verifications} year={fyKey} period={{ start: fy.start, end: fy.end }} yearResult={yearResult} onAddVerification={onAddVerification} setCompanyInfo={setCompanyInfo} />
          )}

          {activeSection === 'ecsales' && (
            <EcSalesList company={company} invoices={invoices} contacts={contacts} setCompanyInfo={setCompanyInfo} />
          )}

          {activeSection === 'annual' && orgType === 'Aktiebolag (AB)' && (
            <AnnualReport company={company} verifications={verifications} accounts={accounts} payrollRuns={payrollRuns} setCompanyInfo={setCompanyInfo} />
          )}

          {activeSection === 'dividend' && orgType === 'Aktiebolag (AB)' && (
            <Dividend company={company} accounts={accounts} verifications={verifications} onAddVerification={onAddVerification} setAccounts={setAccounts} setCompanyInfo={setCompanyInfo} />
          )}

          {activeSection === 'ku' && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{tr('ui.arsoversikt_lon_titel')}</h2>
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '540px' }}>
                  {tr('ui.arsoversikt_lon_text')}
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
                  <Loader2 size={16} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} /> {tr('ui.laser_in_skattetabeller')}
                </div>
              ) : kuEmployeeTotals.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px', padding: '8px 0' }}>
                  <Users size={16} /> {tr('ui.inga_bokforda_lonekorningar_for')} {kuYear} {tr('ui.annu')}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: '18px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{tr('ui.namn')}</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{tr('ui.personnummer_2')}</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{tr('ui.kontant_bruttolon')}</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{tr('ui.avdragen_skatt')}</th>
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
                  <Download size={14} /> {tr('ui.arsoversikt_lon_ladda_ner')}
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Arbetsgivardeklaration (AGI) — kundönskemål: "mycket text,
              lite riktning" var problemet på hela sidan, så den här
              sektionen har medvetet nästan ingen brödtext — bara siffror,
              knappar och en 5-stegs arbetsgångsrad i stället för stycken
              som förklarar samma sak i ord. */}
          {activeSection === 'agi' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{tr('ui.arbetsgivardeklaration_agi')}</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{tr('ui.manadsvis_pa_individniva')}</p>
              </div>

              <div style={{ padding: '20px 24px' }}>
                {missingAgiMonths.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
                    <AlertTriangle size={16} color="var(--status-amber-text)" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--status-amber-text)', marginBottom: '2px' }}>
                        {tr('ui.saknar_deklaration')} {missingAgiMonths.map(p => monthLabel(p, { withYear: false })).join(', ')}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
                        {tr('ui.aven_manader_utan_loneutbetalning_kraver_en_noll')}
                      </div>
                    </div>
                    <button
                      onClick={handleCreateAllMissingAgi}
                      disabled={agiBulkBusy}
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: agiBulkBusy ? 'default' : 'pointer', opacity: agiBulkBusy ? 0.7 : 1 }}
                    >
                      {agiBulkBusy ? <Loader2 size={14} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={14} />}
                      {tr('ui.skapa_agi_underlag')}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tr('ui.ar')}</label>
                    <select value={agiYear} onChange={e => setAgiYear(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                      {[Number(currentYear) - 1, Number(currentYear)].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tr('ui.manad')}</label>
                    <select value={agiMonth} onChange={e => setAgiMonth(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                        <option key={m} value={m}>{monthLabel(`${agiYear}-${m}`, { withYear: false })}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    disabled={agiReports.some(r => r.period === `${agiYear}-${agiMonth}`)}
                    onClick={() => onCreateAgiReport?.(`${agiYear}-${agiMonth}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', border: 'none',
                      background: agiReports.some(r => r.period === `${agiYear}-${agiMonth}`) ? 'var(--border-light)' : 'var(--accent)',
                      color: agiReports.some(r => r.period === `${agiYear}-${agiMonth}`) ? 'var(--text-muted)' : 'white',
                      cursor: agiReports.some(r => r.period === `${agiYear}-${agiMonth}`) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Plus size={14} /> {tr('ui.skapa_agi')}
                  </button>
                </div>

                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 10px' }}>{tr('ui.agi_per_manad')}</h3>
                {agiReports.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px', padding: '8px 0 20px' }}>
                    <Users size={16} /> {tr('ui.inga_agi_rapporter_annu')}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '8px', marginBottom: '24px' }}>
                    {[...agiReports].sort((a, b) => b.period.localeCompare(a.period)).map(report => {
                      const run = payrollRuns.find(r => r.id === report.payrollRunId);
                      return (
                        <div key={report.id} style={{ border: '1px solid var(--border-light)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', padding: '12px 14px', background: 'var(--bg-muted)' }}>
                          <div style={{ minWidth: '140px', fontWeight: 700, fontSize: '13.5px', color: 'var(--text-main)' }}>{monthLabel(report.period)}</div>
                          <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: report.isZero ? 'var(--border-light)' : 'var(--status-blue-bg)', color: report.isZero ? 'var(--text-secondary)' : 'var(--status-blue-text)' }}>
                            {report.isZero ? tr('ui.nolldeklaration') : tr('ui.fran_lonekorning')}
                          </span>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: '160px' }}>
                            {fmt(report.totals.tax)} {tr('ui.skatt_2')} {fmt(report.totals.employerFee)} {tr('ui.avgifter_2')}
                          </div>
                          <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: report.status === 'submitted' ? 'var(--status-green-bg)' : 'var(--status-amber-bg)', color: report.status === 'submitted' ? 'var(--status-green-text)' : 'var(--status-amber-text)' }}>
                            {report.status === 'submitted' ? tr('ui.inlamnad') : tr('ui.utkast')}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {/* Detaljerna (huvuduppgift, individuppgifter, fil, PDF och
                                länk till Skatteverket) i AgiReportDetails.jsx. */}
                            <button
                              type="button"
                              aria-expanded={openAgiId === report.id}
                              onClick={() => setOpenAgiId(id => (id === report.id ? null : report.id))}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '32px', padding: '0 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text-main)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              {openAgiId === report.id ? tr('agiDetails.hide') : tr('agiDetails.show')}
                            </button>
                            {report.status !== 'submitted' && (
                              <button
                                title={tr('ui.markera_inlamnad')}
                                onClick={() => onMarkAgiSubmitted?.(report.id)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--status-green-text)', cursor: 'pointer' }}
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            {onDeleteAgiReport && (
                              <button
                                title={tr('ui.ta_bort')}
                                onClick={async () => { if (await confirmDialog(tr('ui.ta_bort_agi_rapporten_for', { v0: monthLabel(report.period) }), { danger: true })) onDeleteAgiReport(report.id); }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--status-red-text)', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        {openAgiId === report.id && <AgiReportDetails report={report} run={run} company={company} />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Arbetsflödet — fem korta ord i stället för fem stycken
                    text. Ren orientering ("var är jag i processen"), ingen
                    förklaring av VARFÖR varje steg finns — den bor redan i
                    Lönekörningens egna steg.
                    Kundönskemål ("boring, vibe coded — gör den levande"):
                    en egen ikon och en svagt tonad (inte platt grå) cirkel
                    per steg i stället för identiska gråa nummer-bubblor,
                    plus radbrytning per steg (inte bara per chip) på smal
                    skärm — annars kunde en ensam pil hamna kvar ensam på
                    en egen rad när chippen bröts av under den. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
                  {[
                    { n: 1, label: tr('ui.lonekorning_2'), icon: Users },
                    { n: 2, label: tr('ui.skapa_agi'), icon: Plus },
                    { n: 3, label: tr('ui.granska'), icon: ClipboardList },
                    { n: 4, label: tr('ui.ladda_upp_pa_skv'), icon: Download },
                    { n: 5, label: tr('ui.markera_inlamnad'), icon: CheckCircle2 },
                  ].map((step, i, arr) => (
                    <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 10px 4px 4px', borderRadius: '999px', background: 'var(--status-blue-bg)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '999px', background: 'var(--bg-card)', color: 'var(--status-blue-text)', flexShrink: 0 }}>
                          <step.icon size={12} />
                        </span>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--status-blue-text)' }}>{step.label}</span>
                      </div>
                      {i < arr.length - 1 && <ArrowRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                    </div>
                  ))}
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
              <div style={{ padding: '22px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{tr('ui.inkomstdeklaration_2')}</h2>
                  <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {[company?.name, tr('ui.rakenskapsar_label', { label: fy.label }), company?.orgNr && tr('ui.org_nr_value', { orgNr: company.orgNr })].filter(Boolean).map((part, i) => (
                      <React.Fragment key={part}>{i > 0 && ' · '}<span style={{ whiteSpace: 'nowrap' }}>{part}</span></React.Fragment>
                    ))}
                  </p>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: isLocked ? 'var(--status-green-bg)' : 'var(--bg-muted)', color: isLocked ? 'var(--status-green-text)' : 'var(--text-secondary)', border: isLocked ? 'none' : '1px solid var(--border)', flexShrink: 0 }}>
                  {isLocked ? <><CheckCircle2 size={13} /> {tr('ui.bokslutet_ar_last_2')}</> : <><Clock size={13} /> {tr('ui.forhandsvisning')}</>}
                </span>
              </div>

              {/* Kundfeedback: "man vet inte riktigt vad man ska göra här".
                  Sidan visade två långa tabeller först och gömde knapparna
                  längst ner — samma innehåll, men ingen ordning att följa.
                  Momsdeklarationens steg-för-steg (samma sida, fliken
                  bredvid) var precis det användaren berömde, så INK2R får
                  samma språk: tre steg, med status på det första och
                  knapparna direkt i steg två och tre. */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'grid', gap: 0 }}>
                <Ink2Step
                  n={1}
                  done={ink2r.balanced && ink2r.rows.length > 0}
                  title={tr('ui.kontrollera_att_balansrakningen_stammer')}
                >
                  {ink2r.rows.length === 0 ? (
                    <span style={{ color: 'var(--text-secondary)' }}>{tr('ui.inga_bokforda_balanskonton_annu_for_rakenskapsar')} {fy.label}{tr('ui.bokfor_aret_forst')}</span>
                  ) : ink2r.balanced ? (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {tr('ui.tillgangar')} {fmt(ink2r.totalAssets)} {tr('ui.eget_kapital_och_skulder_2')} {fmt(ink2r.totalEquityAndLiabilities)}{tr('ui.klart_att_lamna_in')}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--status-red-text)' }}>{tr('ui.skillnad_2')} {fmt(Math.abs(ink2r.difference))} {tr('ui.kr_2')}</strong>{' '}
                      {tr('ui.tillgangarna_ar')} {ink2r.difference > 0 ? tr('ui.storre') : 'mindre'} {tr('ui.an_eget_kapital_och_skulder_arets_resultat_ar_re')}
                      {onNavigateToTab && (
                        <>
                          {' '}
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('reports')}
                            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            {tr('ui.oppna_balansrakningen')}
                          </button>
                          {' '}{tr('ui.for_att_se_var_differensen_sitter')}
                        </>
                      )}
                    </span>
                  )}
                </Ink2Step>

                <Ink2Step n={2} title={tr('ui.ladda_ner_sru_filerna')}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      disabled={!canDownloadSru}
                      onClick={() => downloadInk2rSru(company, ink2r, ink2rResultat.rows, { start: fy.start, end: fy.end })}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: canDownloadSru ? 'var(--accent)' : 'var(--border)', color: canDownloadSru ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: canDownloadSru ? 'pointer' : 'not-allowed' }}
                    >
                      <Download size={14} /> {tr('ui.ladda_ner_sru_filerna')}
                    </button>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {sruMissing.length > 0 ? (
                        <>
                          {tr('ui.skatteverket_kraver')} {sruMissing.join(', ').replace(/, ([^,]*)$/, ' och $1')} {tr('ui.i_filen_fyll_i_det_under_installningar_foretag')}
                          {onNavigateToTab && (
                            <>
                              {' '}
                              <button type="button" onClick={() => onNavigateToTab('settings')} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                                {tr('ui.oppna_installningar')}
                              </button>
                            </>
                          )}
                        </>
                      ) : !ink2r.balanced ? (
                        tr('ui.gar_att_ladda_ner_nar_balansrakningen_stammer')
                      ) : (
                        tr('ui.en_zip_fil_med_info_sru_och_blanketter_sru_packa')
                      )}
                    </span>
                  </div>
                </Ink2Step>

                <Ink2Step n={3} title={tr('ui.lamna_in_hos_skatteverket')} last>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <a
                      href="https://sso.skatteverket.se/fv_ext/fv_web/login.do"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
                    >
                      {tr('ui.oppna_skatteverket')} <ExternalLink size={13} />
                    </a>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '620px' }}>
                      {tr('ui.logga_in_med_bankid_som_foretag_e_tjansten')} <em>{tr('ui.filoverforing')}</em> {tr('ui.filtyp')} <em>{tr('ui.inkomstdeklaration')}</em> {tr('ui.ladda_upp_info_sru_och_blanketter_sru_dar_fyller')}
                    </span>
                  </div>
                </Ink2Step>
              </div>

              <div style={{ padding: '20px 24px' }}>
                {ink2Warnings.length > 0 && (
                  <div style={{ marginBottom: '20px', padding: '14px 16px', borderRadius: '10px', background: 'var(--status-amber-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--status-amber-text)', marginBottom: '6px' }}>
                      <AlertTriangle size={15} /> {ink2Warnings.length === 1 ? tr('ui.n1_sak_att_kanna_till') : tr('ui.saker_att_kanna_till', { length: ink2Warnings.length })}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '23px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-main)' }}>
                      {ink2Warnings.map(w => <li key={w}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Nyckeltalen överst, så sidan går att läsa på fem sekunder:
                    balansräkningens två summor och resultatet. Detaljerna
                    (varje rad, klickbar till kontona) ligger under. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1px', background: 'var(--border-light)', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
                  {[
                    { label: tr('ui.summa_tillgangar'), amount: ink2r.totalAssets },
                    { label: tr('ui.eget_kapital_och_skulder'), amount: ink2r.totalEquityAndLiabilities, note: ink2r.rows.length === 0 ? null : ink2r.balanced ? tr('ui.balanserar') : tr('ui.skillnad', { v0: fmt(Math.abs(ink2r.difference)) }), ok: ink2r.balanced },
                    { label: tr('ui.rorelseresultat'), amount: ink2OperatingResult },
                    { label: tr('ui.arets_resultat'), amount: ink2rResultat.total, strong: true },
                  ].map(t => (
                    <div key={t.label} style={{ background: 'var(--bg-card)', padding: '14px 16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{t.label}</div>
                      <div style={{ fontSize: '19px', fontWeight: t.strong ? 800 : 700, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', marginTop: '3px', whiteSpace: 'nowrap' }}>{fmt(t.amount)}</div>
                      {t.note && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600, marginTop: '3px', color: t.ok ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                          {t.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {t.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-main)' }}>{tr('ui.balansrakning_rad_2_1_2_50')}</h3>
                {ink2r.rows.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13px', padding: '14px 16px', background: 'var(--bg-muted)', borderRadius: '10px' }}>
                    <Info size={15} /> {tr('ui.inga_bokforda_balanskonton_annu_for_rakenskapsar')} {fy.label}{tr('ui.raderna_fylls_i_automatiskt_nar_du_bokfor')}
                  </div>
                ) : (
                  <div
                    className="form-row-2"
                    style={{ display: 'grid', gap: '28px', marginBottom: '20px' }}
                  >
                    {(() => {
                      const { assets, equityAndLiabilities } = splitInk2rColumns(ink2r.rows);
                      return (
                        <>
                          <Ink2FormColumn title={tr('ui.tillgangar')} groups={assets} expandedRow={expandedInk2rRow} setExpandedRow={setExpandedInk2rRow} fmt={fmt} />
                          <Ink2FormColumn title={tr('ui.eget_kapital_och_skulder')} groups={equityAndLiabilities} expandedRow={expandedInk2rRow} setExpandedRow={setExpandedInk2rRow} fmt={fmt} />
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Resultaträkning (rad 3.1–3.27) — skrivs numera också med
                    i SRU-filen (se ink2rResultat.js och disclaimern nedan). */}
                {ink2rResultat.rows.length > 0 && (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-main)' }}>{tr('ui.resultatrakning_rad_3_1_3_27')}</h3>
                    <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, width: '52px' }}>{tr('ui.rad')}</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{tr('ui.benamning')}</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{tr('ui.belopp')}</th>
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
                    {tr('ui.faltkoder_fran')} <a href="https://www.bas.se/kontoplaner/sru/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>{tr('ui.bas_se')}</a>{tr('ui.s_officiella_kopplingstabell_skattemassiga_juste')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inkomstdeklaration 2 — INK2S (skattemässiga justeringar).
              Fanns tidigare som 27 inmatningsfält här, men beloppen kom
              aldrig med i SRU-filen, så de fick ändå skrivas in en gång till
              hos Skatteverket. Nu visar kortet bara det Bokix vet säkert,
              årets resultat för 4.1/4.2, och att resten fylls i där. Sparade
              värden (company.ink2s) ligger kvar orörda. */}
          {!filesOwnIncomeDeclaration && activeSection === 'ink2' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', marginTop: '16px' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{tr('ui.skattemassiga_justeringar_ink2s')}</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '620px', lineHeight: 1.6 }}>
                  {tr('ui.fylls_i_direkt_hos_skatteverket_nar_du_lamnar_in')}
                </p>
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {ink2rResultat.total < 0 ? tr('ui.n4_2_arets_resultat_forlust') : tr('ui.n4_1_arets_resultat_vinst')}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>{fmt(Math.abs(ink2rResultat.total))}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{tr('ui.samma_belopp_som_rad')} {ink2rResultat.total < 0 ? '3.27' : '3.26'} {tr('ui.i_resultatrakningen_ovan')}</div>
                </div>
                <a
                  href="https://sso.skatteverket.se/fv_ext/fv_web/login.do"
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
                >
                  {tr('ui.oppna_skatteverket')} <ExternalLink size={13} />
                </a>
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 24px 20px', padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
                <div>
                  {tr('ui.vanliga_justeringar_ar_ej_avdragsgilla_kostnader')}
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
          {/* Kundönskemål, två omgångar: (1) "mycket text, förstår inget" —
              inledningstexten kortad till en rad och en tydlig 3-stegsrad
              (kontrollera → ladda ner → lämna in) tillagd, samma idé som
              INK2R:s "så gör du"-uppstädning. (2) Uppföljning, skärmdumpar
              av Skatteverkets egen blankett och andra bokföringsprogram
              ("gör det som de stora"): beloppen är nu FÖRIFYLLDA ur
              bokföringen (se ne.js/computeNeBalanceSuggestions) i stället
              för alltid tomma, och grupperna är alltid synliga (inte
              hopfällbara längre) — samma "aldrig gömma ett fält"-princip
              som INK2S fick i samma uppföljning. */}
          {isSoleProp && activeSection === 'ne' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{tr('ui.ne_bilaga_inkomst_av_naringsverksamhet')}</h2>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{tr('ui.forifyllt_ur_bokforingen_kontrollera_och_andra_v')}</p>
                </div>
                {hasAnyNeValue && !isLocked && (
                  <button
                    type="button"
                    onClick={resetNeValues}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '12.5px', color: 'var(--status-red-text)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    <RotateCcw size={13} /> {tr('ui.nollstall_alla')}
                  </button>
                )}
              </div>

              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'grid', gap: 0 }}>
                <Ink2Step n={1} done={neFilledCount > 0} title={tr('ui.kontrollera_uppgifterna_nedan')}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {neFilledCount === 0
                      ? tr('ui.falt_fyll_bara_i_det_som_galler_din_verksamhet', { neTotalFields, v1: verifications.length === 0 ? 'inget bokfört ännu' : 'inget att fylla i ur bokföringen ännu' })
                      : tr('ui.av_falt_ifyllda_mestadels_foreslagna_ur_bokforin', { neFilledCount, neTotalFields })}
                  </span>
                </Ink2Step>
                <Ink2Step n={2} title={tr('ui.ladda_ner_en_sammanstallning')}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      disabled={neFilledCount === 0}
                      onClick={() => downloadNePdf({ company, year: fy.label, balanceRows: neBalance.rows, resultRows: neResult.rows, equity: neBalance.equity, result: neResult.total }, `ne-bilaga-${fyKey.replace('/', '-')}.pdf`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: neFilledCount === 0 ? 'var(--border)' : 'var(--accent)', color: neFilledCount === 0 ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: neFilledCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      <Download size={14} /> {tr('ui.ladda_ner_pdf')}
                    </button>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{tr('ui.bara_en_renskrift_av_det_du_fyllt_i_har_inte_sja')}</span>
                  </div>
                </Ink2Step>
                <Ink2Step n={3} title={tr('ui.fyll_i_ne_bilagan_hos_skatteverket')} last>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <a
                      href="https://www.skatteverket.se/privat"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
                    >
                      {tr('ui.oppna_skatteverket')} <ExternalLink size={13} />
                    </a>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {tr('ui.logga_in_privat_med_bankid_inte_som_foretag_inko')}
                    </span>
                  </div>
                </Ink2Step>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 12px' }}>{tr('ui.balansrakning_rakenskapsschema')}</div>
                <div className="form-row-2" style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr 1fr', marginBottom: '24px' }}>
                  <NeFormColumn
                    title={tr('ui.tillgangar')} groups={neBalanceByColumn.assets}
                    values={neValues.balance} disabled={isLocked}
                    onChange={(key, v) => updateNeValue('balance', key, v)}
                    suggestedKeys={neSuggestedKeys}
                  />
                  <NeFormColumn
                    title={tr('ui.eget_kapital_och_skulder')} groups={neBalanceByColumn.liabilities}
                    values={neValues.balance} disabled={isLocked}
                    onChange={(key, v) => updateNeValue('balance', key, v)}
                    suggestedKeys={neSuggestedKeys}
                    derived={
                      <Ink2sStatTile
                        label={tr('ui.b10_eget_kapital_tillgangar_skulder')}
                        amount={neBalance.equity}
                        tone={neBalance.equity >= 0 ? 'green' : 'red'}
                        Icon={neBalance.equity >= 0 ? TrendingUp : TrendingDown}
                      />
                    }
                  />
                </div>

                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 12px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>{tr('ui.resultatrakning_rakenskapsschema')}</div>
                <div style={{ maxWidth: '620px' }}>
                  <NeFormColumn
                    groups={neResultByGroup}
                    values={neValues.result} disabled={isLocked}
                    onChange={(key, v) => updateNeValue('result', key, v)}
                    suggestedKeys={neSuggestedKeys}
                    derived={
                      <Ink2sStatTile
                        label={tr('ui.r11_bokfort_resultat_fors_over_till_sidan_2_r12')}
                        amount={neResult.total}
                        tone={neResult.total >= 0 ? 'green' : 'red'}
                        Icon={neResult.total >= 0 ? TrendingUp : TrendingDown}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
