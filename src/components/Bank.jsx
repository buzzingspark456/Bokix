import { VERIFICATION_SERIES } from '../utils/verificationNumbering';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Upload, UploadCloud, AlertCircle, CheckCircle2, X, ChevronDown, ChevronRight,
  Landmark, ArrowDownCircle, ArrowUpCircle, HelpCircle, Search, Trash2, Undo2,
  Plus, Settings, Pencil, Check,
} from './icons';
import ListPageHeader, { ListFilterBar, listSearchInputStyle, listFilterFieldStyle } from './shared/ListPageHeader';
import DateField from './shared/DateField';
import ListTable from './shared/ListTable';
import { AccountSearch } from './shared/SearchInputs';
import { confirmDialog } from './shared/ConfirmDialog';
import { findLockedVatPeriod } from '../utils/vatCalculation';
import { BRAND } from '../utils/brandColors';
import { BankLogo } from './shared/BrandLogos';
import { BANK_SOURCES, OTHER_BANK_HINT, MAX_BANK_FILE_MB, ACCEPTED_BANK_EXTENSIONS, splitBankPath } from '../utils/bankSources';
import { guessAccountFromText } from '../utils/accountCategories';
import { buildBankHistory, suggestFromHistory } from '../utils/bankLearning';
import { suggestMatch, findSureMatches } from '../utils/bankMatching';
import Reconciliation from './Reconciliation';
import { bankHeaderLabel } from '../utils/bankHeaderLabels';
import { t as tr } from '../i18n';
import { invoiceCustomerRemaining } from '../utils/rotRutConfig';
import { reconcileImportedSales } from '../utils/importedSalesReconcile';

// Bank – CSV/Excel-import. `bankImport.js` (parsning/normalisering/
// matchningsförslag, statisk import av papaparse+xlsx) laddas BARA lazy
// (dynamiskt `import()`), aldrig statiskt härifrån — annars skulle de två
// biblioteken bunta in i huvudladdningen för ALLA sidor, inte bara Bank.
// Se filkommentaren i bankImport.js.

const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  background: 'var(--bg-card)', color: 'var(--text-main)',
};
const fieldLabel = { display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' };

// ── Flera bankkonton (kundönskemål: "byta bank, namnge kontot, importera
// dit, se vilket konto som hör till bokföringen") ──────────────────────────
// `company.bankAccounts` är TOM för alla företag som aldrig rört funktionen
// (se App.jsx createEmptyCompanyData) — det finns alltså inget att migrera.
// I det läget syntetiserar getEffectiveAccounts ETT konto i minnet, aldrig
// sparat, bundet mot 1930 (exakt samma konto varje transaktion redan
// bokfördes mot innan den här funktionen fanns). Den blir bara en riktig,
// sparad lista i company.bankAccounts första gången någon lägger till ett
// ANDRA konto (se handleSaveAccount nedan) — och då följer det
// syntetiserade default-kontot med in i den sparade listan precis som det
// var, så gamla transaktioner (utan accountId alls) fortsätter peka på
// exakt samma bokföringskonto som innan.
const DEFAULT_BANK_ACCOUNT = { id: 'default', name: 'Huvudkonto', ledgerAccount: '1930', isDefault: true };
function getEffectiveAccounts(bankAccounts) {
  return (bankAccounts && bankAccounts.length > 0) ? bankAccounts : [DEFAULT_BANK_ACCOUNT];
}
function accountIdOf(row) { return row.accountId || 'default'; }

const STATUS_META = {
  unmatched: { label: tr('ui.ej_hanterad'), bg: 'var(--status-amber-bg)', text: 'var(--status-amber-text)' },
  matched: { label: tr('ui.matchad'), bg: 'var(--status-green-bg)', text: 'var(--status-green-text)' },
  booked: { label: tr('ui.bokford'), bg: 'var(--status-green-bg)', text: 'var(--status-green-text)' },
  ignored: { label: tr('ui.ignorerad'), bg: 'var(--status-gray-bg)', text: 'var(--status-gray-text)' },
};
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.unmatched;
  return <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: m.bg, color: m.text, whiteSpace: 'nowrap' }}>{m.label}</span>;
}

// ── Matchningskandidater (fullständig lista, inte bara "bästa gissning") ──
function invoiceCandidates(invoices, contacts) {
  return (invoices || [])
    .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
    .map(inv => {
      // Kundens del: vid ROT/RUT betalar kunden fakturan minus avdraget.
      const remaining = invoiceCustomerRemaining(inv);
      const customer = (contacts || []).find(c => c.id === inv.customerId);
      return { id: inv.id, remaining, label: tr('ui.kr_3', { invoiceNumber: inv.invoiceNumber, v1: customer?.name || 'okänd kund', v2: fmt(remaining) }) };
    })
    .filter(c => c.remaining > 0);
}
// paidByOwnerPrivately-fakturor har redan sin skuld bokad mot 2018 (ägaren)
// vid registrering — ingen riktig utgående banktransaktion att matcha mot.
function supplierInvoiceCandidates(expenses, contacts) {
  return (expenses || [])
    .filter(e => e.type === 'supplier_invoice' && e.status !== 'paid' && !e.paidByOwnerPrivately)
    .map(inv => {
      const supplier = (contacts || []).find(c => c.id === inv.supplierId);
      return { id: inv.id, label: tr('ui.kr_3', { invoiceNumber: inv.invoiceNumber, v1: supplier?.name || 'okänd leverantör', v2: fmt(inv.amount) }) };
    });
}

export default function Bank({
  bankTransactions = [],
  bankImportProfiles = {},
  bankAccounts = [],
  reconciliations = [],
  invoices = [],
  expenses = [],
  contacts = [],
  accounts = [],
  verifications = [],
  vatPeriods,
  onSetBankTransactions,
  onUpdateCompany,
  setAccounts,
  onRegisterInvoicePayment,
  onMarkSupplierInvoicePaid,
  onAddVerification,
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(daysAgoIso(90));
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  // "Alla konton" som förval — kontoväljaren nedan (syns bara med fler än
  // ETT konto) filtrerar listan precis som statusflikarna redan gör.
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  // "Visa N"-väljaren, samma som Bokföring/fakturorna (kundönskemål: den
  // ska finnas och fungera likadant på alla listsidor). Kontoutdrag är
  // dessutom den lista som oftast är LÅNG — en importerad månad kan vara
  // hundratals rader.
  const [pageSize, setPageSize] = useState(30);

  const effectiveAccounts = getEffectiveAccounts(bankAccounts);
  const hasMultipleAccounts = effectiveAccounts.length > 1;
  const accountById = (id) => effectiveAccounts.find(a => a.id === id) || DEFAULT_BANK_ACCOUNT;

  // ── Kontohantering: lägg till/döp om/ta bort ────────────────────────────
  // Samma "syntetiserat default blir riktigt först när det behövs"-princip
  // som getEffectiveAccounts: så fort listan sparas för första gången följer
  // default-kontot med, oförändrat, så gamla otaggade transaktioner
  // fortsätter peka på precis samma bokföringskonto (1930) som innan.
  const persistAccounts = (updater) => {
    onUpdateCompany?.(company => ({ ...company, bankAccounts: updater(getEffectiveAccounts(company.bankAccounts)) }));
  };
  const handleAddAccount = (name, ledgerAccount) => {
    if (!name.trim() || !ledgerAccount) return;
    persistAccounts(list => [...list, { id: `bank_${Date.now()}`, name: name.trim(), ledgerAccount }]);
    // Kontokoden måste FINNAS i kontoplanen — annars visas den utan namn
    // överallt en verifikation refererar den (Bokföring, Rapporter m.fl.).
    // Läggs bara till om den faktiskt saknas; en redan existerande kod
    // (t.ex. återanvänder man 1930 självt) rörs aldrig.
    if (setAccounts && !accounts.some(a => a.code === ledgerAccount)) {
      setAccounts(prev => prev.some(a => a.code === ledgerAccount)
        ? prev
        : [...prev, { code: ledgerAccount, name: `Bankkonto ${name.trim()}` }].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    }
  };
  const handleRenameAccount = (id, name) => {
    if (!name.trim()) return;
    persistAccounts(list => list.map(a => a.id === id ? { ...a, name: name.trim() } : a));
  };
  const handleDeleteAccount = async (account) => {
    // Kontot och dess rader tas bort i ett steg. Det som redan bokförts
    // ligger kvar i bokföringen (verifikationerna rörs inte), så man behöver
    // inte först rensa raderna en och en.
    const rows = bankTransactions.filter(t => accountIdOf(t) === account.id);
    const booked = rows.filter(t => t.status === 'booked' || t.status === 'matched').length;
    const message = rows.length === 0
      ? tr('ui.ta_bort_bankkontot', { name: account.name })
      : tr('ui.ta_bort_bankkontot_med_rader', { name: account.name, n: rows.length })
        + (booked ? tr('ui.varav_redan_bokforda', { n: booked }) : '');
    if (!(await confirmDialog(message, { danger: true }))) return;
    if (rows.length) onSetBankTransactions(prev => prev.filter(t => accountIdOf(t) !== account.id));
    persistAccounts(list => list.filter(a => a.id !== account.id));
    if (selectedAccountId === account.id) setSelectedAccountId('all');
  };

  const filtered = useMemo(() => {
    return (bankTransactions || [])
      .filter(t => activeTab === 'all' || t.status === activeTab)
      .filter(t => selectedAccountId === 'all' || accountIdOf(t) === selectedAccountId)
      .filter(t => !dateFrom || t.date >= dateFrom)
      .filter(t => !dateTo || t.date <= dateTo)
      .filter(t => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return t.description?.toLowerCase().includes(q) || String(t.amount).includes(q) || t.reference?.toLowerCase().includes(q);
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [bankTransactions, activeTab, selectedAccountId, dateFrom, dateTo, search]);

  const visibleTransactions = pageSize === 'all' ? filtered : filtered.slice(0, pageSize);

  const tabCounts = useMemo(() => {
    const c = { all: bankTransactions.length, unmatched: 0, matched: 0, booked: 0, ignored: 0 };
    bankTransactions.forEach(t => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [bankTransactions]);

  const updateRow = (id, patch) => {
    onSetBankTransactions(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  // Försäljning som importerats från en annan app (ROT/RUT-importen) är
  // redan bokförd per dag. Kundernas Swish-betalningar på samma dag stäms av
  // mot den i ett svep i stället för att ignoreras rad för rad
  // (utils/importedSalesReconcile.js).
  const hasImportedSales = verifications.some(v => v.source === 'rotrut_import');
  const [reconcileResult, setReconcileResult] = useState(null);
  const handleReconcileImported = () => {
    const r = reconcileImportedSales(bankTransactions, verifications, (row) => accountById(accountIdOf(row)).ledgerAccount);
    const byId = new Map(r.updates.map(u => [u.id, u.patch]));
    if (byId.size) onSetBankTransactions(prev => prev.map(t => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)));
    setReconcileResult(r);
  };

  // Efter en lyckad import: en förvald 90-dagarsfiltrering (se dateFrom
  // ovan, motiveringen finns i planen — ingen paginering finns i appen) kan
  // annars tyst gömma nyss importerade rader om kontoutdraget sträcker sig
  // längre bak än det, vilket ser ut som att importen inte gav något alls.
  // Vidgar filtret till att täcka de nya raderna, och hoppar till "Ej
  // hanterade" — det är där man faktiskt ska jobba direkt efter en import.
  const handleImportCommit = (rows, accountId) => {
    onSetBankTransactions(prev => [...prev, ...rows]);
    if (rows.length) {
      const earliest = rows.reduce((min, r) => (!min || r.date < min) ? r.date : min, null);
      if (earliest && (!dateFrom || earliest < dateFrom)) setDateFrom(earliest);
      setActiveTab('unmatched');
      // Hoppa till DET kontot som just importerades till, annars ser den nya
      // omgången ut att saknas om ett annat konto råkade vara valt sedan
      // tidigare.
      if (accountId && accountId !== 'default') setSelectedAccountId(accountId);
    }
  };

  // Kundönskemål: "om de gjort fel ska de kunna ta bort". Import är det
  // enda stället i appen där en användare med ETT klick kan få in hundratals
  // rader som inte skulle in — fel fil, fel konto, fel period — och utan en
  // väg tillbaka blir enda utvägen att ignorera dem en och en.
  //
  // Viktigt och därför utskrivet i dialogen: raden här är bara BANKENS rad.
  // Har den redan bokförts eller matchats mot en faktura ligger den
  // verifikationen (eller betalningen) kvar i bokföringen — den ska rättas
  // där, inte försvinna tyst för att en importrad togs bort. Att radera
  // verifikationen härifrån vore mycket värre: bokföring rättas med en
  // rättelsepost, aldrig genom att spåren tas bort.
  const handleDeleteRow = async (row) => {
    const booked = row.status === 'booked' || row.status === 'matched';
    const message = booked
      ? tr('ui.ta_bort_den_har_raden_fran_bankvyn_verifikatione')
      : tr('ui.ta_bort_den_har_raden_fran_bankvyn_den_forsvinne');
    if (!(await confirmDialog(message))) return;
    onSetBankTransactions(prev => prev.filter(t => t.id !== row.id));
    setExpandedId(null);
  };

  // Hela den senaste importomgången. Varje importerad rad bär sitt
  // `importBatch` (satt i buildBankTransactionRecords, bankImport.js), så
  // "fel fil" går att backa i ett svep i stället för rad för rad.
  // Bara rader som fortfarande är ORÖRDA (ej hanterade eller ignorerade)
  // räknas in: har man redan bokfört något ur omgången är den inte längre
  // en felimport att ångra, och de raderna lämnas kvar med flit.
  const latestBatch = useMemo(() => {
    const batches = (bankTransactions || []).filter(t => t.importBatchId).map(t => t.importBatchId);
    if (!batches.length) return null;
    const newest = batches.sort().at(-1);
    const rows = bankTransactions.filter(t => t.importBatchId === newest && (t.status === 'unmatched' || t.status === 'ignored'));
    return rows.length ? { id: newest, count: rows.length } : null;
  }, [bankTransactions]);

  const handleUndoImport = async () => {
    if (!latestBatch) return;
    if (!(await confirmDialog(tr('ui.angra_den_senaste_importen_ohanterade_rader_tas', { count: latestBatch.count })))) return;
    onSetBankTransactions(prev => prev.filter(t => !(t.importBatchId === latestBatch.id && (t.status === 'unmatched' || t.status === 'ignored'))));
    setExpandedId(null);
  };
  const handleIgnore = async (row) => {
    if (!(await confirmDialog(tr('ui.ignorera_den_har_transaktionen_ingen_verifikatio')))) return;
    updateRow(row.id, { status: 'ignored' });
    // Bugfix: utan detta blev den expanderade detaljraden kvar öppen efter
    // Ignorera — status blir inte längre 'unmatched', så onRowClick-vakten
    // (nedan) slutar reagera på klick på raden och panelen gick inte att
    // stänga på något sätt förutom att byta flik.
    setExpandedId(null);
  };

  const handleConfirmInvoiceMatch = (row, invoiceId) => {
    if (!invoiceId) return;
    // Bankbeloppet är alltid kronor; för en faktura i annan valuta räknas
    // skillnaden mot fordran som kursvinst eller -förlust (App.jsx).
    onRegisterInvoicePayment(invoiceId, Math.abs(row.amount), row.date, accountById(accountIdOf(row)).ledgerAccount, { amountIsSek: true });
    updateRow(row.id, { status: 'matched', matchedType: 'invoice', matchedId: invoiceId, verificationSource: 'invoice_payment' });
    setExpandedId(null);
  };

  const handleConfirmSupplierMatch = (row, expenseId) => {
    if (!expenseId) return;
    onMarkSupplierInvoicePaid(expenseId, 'bank', row.date, accountById(accountIdOf(row)).ledgerAccount);
    updateRow(row.id, { status: 'matched', matchedType: 'supplier_invoice', matchedId: expenseId, verificationSource: 'supplier_invoice_payment' });
    setExpandedId(null);
  };

  // Det användaren bokfört förut (utils/bankLearning.js).
  const bankHistory = useMemo(
    () => buildBankHistory(bankTransactions, verifications, (row) => accountById(accountIdOf(row)).ledgerAccount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bankTransactions, verifications, effectiveAccounts],
  );
  // Ej hanterade rader där samma motpart bokförts minst två gånger mot samma
  // konto, och kontot finns i kontoplanen. Rader i en redan momsredovisad
  // period tas inte med, de ska man titta på själv.
  const autoBookable = useMemo(() => (bankTransactions || [])
    .filter(t => t.status === 'unmatched')
    .map(t => ({ row: t, s: suggestFromHistory(t, bankHistory) }))
    .filter(({ row, s }) => s?.confident && accounts.some(a => a.code === s.accountCode) && !findLockedVatPeriod(row.date, vatPeriods)
      // En rad som hör till en obetald faktura ska matchas, inte bokföras som kostnad.
      && !suggestMatch(row, { invoices, expenses })?.sure),
  [bankTransactions, bankHistory, accounts, vatPeriods, invoices, expenses]);

  // Inbetalningar och utbetalningar som säkert hör till en obetald faktura
  // (unikt belopp eller fakturanumret i texten, utils/bankMatching.js).
  const sureMatches = useMemo(
    () => findSureMatches(bankTransactions, { invoices, expenses }).filter(({ row }) => !findLockedVatPeriod(row.date, vatPeriods)),
    [bankTransactions, invoices, expenses, vatPeriods],
  );
  const handleMatchAll = async () => {
    if (!sureMatches.length) return;
    if (!(await confirmDialog(tr('bankLearning.matchConfirm', { count: sureMatches.length })))) return;
    sureMatches.forEach(({ row, match }) => (match.type === 'invoice'
      ? handleConfirmInvoiceMatch(row, match.id)
      : handleConfirmSupplierMatch(row, match.id)));
  };

  const handleAutoBook = async () => {
    if (!autoBookable.length) return;
    if (!(await confirmDialog(tr('bankLearning.confirm', { count: autoBookable.length })))) return;
    autoBookable.forEach(({ row, s }) => handleQuickBook(row, { date: row.date, description: row.description || tr('ui.banktransaktion'), series: 'A', counterAccount: s.accountCode }));
  };

  const handleQuickBook = (row, { date, description, series, counterAccount }) => {
    // Med ören: bokföringen ska ha beloppet exakt som på kontoutdraget.
    const amount = Math.round(Math.abs(row.amount) * 100) / 100;
    const isInflow = row.amount > 0;
    // Vilket bankkonto raden faktiskt kom ifrån (flera bankkonton,
    // kundönskemål) — inte längre alltid 1930.
    const bankLedgerAccount = accountById(accountIdOf(row)).ledgerAccount;
    onAddVerification({
      series: series || 'A',
      date,
      description,
      source: 'bank_import',
      sourceId: row.id,
      rows: isInflow
        ? [{ account: bankLedgerAccount, debet: amount, kredit: 0 }, { account: counterAccount, debet: 0, kredit: amount }]
        : [{ account: counterAccount, debet: amount, kredit: 0 }, { account: bankLedgerAccount, debet: 0, kredit: amount }],
    });
    updateRow(row.id, { status: 'booked', verificationSource: 'bank_import', bookedAccount: String(counterAccount) });
    setExpandedId(null);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title={tr('ui.bank')}
        actions={[
          // Kundönskemål: flera bankkonton, namngivna, med egen import och
          // eget bokföringskonto. Knappen ligger kvar även med bara ett
          // (syntetiserat) konto — annars skulle ingen hitta funktionen
          // första gången de faktiskt behöver den.
          { key: 'accounts', label: tr('ui.bankkonton'), icon: Settings, onClick: () => setShowAccountsModal(true) },
          // Visas bara när det FINNS en ohanterad importomgång att ångra —
          // en permanent "Ångra"-knapp bredvid "Importera" hade sett ut som
          // en lika stor och lika vanlig handling som importen själv.
          ...(hasImportedSales ? [{ key: 'reconcile-imported', label: tr('bankReconcile.button'), icon: CheckCircle2, onClick: handleReconcileImported }] : []),
          ...(sureMatches.length ? [{ key: 'match-all', label: tr('bankLearning.matchButton', { count: sureMatches.length }), icon: CheckCircle2, onClick: handleMatchAll }] : []),
          ...(autoBookable.length ? [{ key: 'auto-book', label: tr('bankLearning.button', { count: autoBookable.length }), icon: CheckCircle2, onClick: handleAutoBook }] : []),
          ...(latestBatch ? [{ key: 'undo', label: tr('ui.angra_import', { count: latestBatch.count }), icon: Undo2, onClick: handleUndoImport }] : []),
          { key: 'import', label: tr('ui.importera_transaktioner'), icon: Upload, onClick: () => setShowImportModal(true), variant: 'primary' },
        ]}
        tabs={{
          items: [
            { id: 'all', label: tr('ui.alla'), badge: tabCounts.all },
            { id: 'unmatched', label: tr('ui.ej_hanterade'), badge: tabCounts.unmatched },
            { id: 'matched', label: tr('ui.matchade'), badge: tabCounts.matched },
            { id: 'booked', label: tr('ui.bokforda'), badge: tabCounts.booked },
            { id: 'ignored', label: tr('ui.ignorerade'), badge: tabCounts.ignored },
            { id: 'reconcile', label: tr('ui.avstamning'), shortLabel: tr('bankUi.reconcileShort') },
          ],
          // Radbryts i halvskärm och på telefon i stället för att skrolla i sidled.
          wrap: true,
          activeId: activeTab,
          onChange: setActiveTab,
        }}
      />

      {reconcileResult && (
        <div style={{ margin: '12px 20px 0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.55, background: reconcileResult.unmatchedDays.length ? 'var(--status-amber-bg)' : 'var(--status-green-bg)', color: reconcileResult.unmatchedDays.length ? 'var(--status-amber-text)' : 'var(--status-green-text)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div>{tr('bankReconcile.result', { rows: reconcileResult.updates.length, days: reconcileResult.matchedDays })}</div>
            {reconcileResult.unmatchedDays.length > 0 && (
              <div>{tr('bankReconcile.unmatched', { list: reconcileResult.unmatchedDays.slice(0, 8).map(d => tr('bankReconcile.day', { date: d.date, expected: d.expected.toLocaleString('sv-SE'), found: d.found.toLocaleString('sv-SE') })).join('; ') })}</div>
            )}
          </div>
          <button type="button" onClick={() => setReconcileResult(null)} aria-label={tr('ui.stang')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {activeTab !== 'reconcile' && <ListFilterBar
        onClear={() => { setSearch(''); setDateFrom(''); setDateTo(''); setSelectedAccountId('all'); }}
        count={filtered.length}
        countLabel="transaktioner"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        activeFilters={(dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (selectedAccountId !== 'all' ? 1 : 0)}
      >
        {/* Samma sökfälts-mönster som Bokförings egen ListFilterBar (facit-
            sidan för den här komponenten) — sökikon + listSearchInputStyle
            oförändrad (36px vänsterpadding reserverad åt ikonen), inte en
            egen avvikande variant. */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('ui.sok_text_belopp_referens')} style={{ ...listSearchInputStyle, width: '240px' }} />
        </div>
        <div className="lfb-daterange">
          <DateField value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder={tr('ui.fran_datum')} style={listFilterFieldStyle} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>–</span>
          <DateField value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder={tr('ui.till_datum')} style={listFilterFieldStyle} />
        </div>
        {/* Bara synlig med fler än ETT konto — annars är det ett filter som
            aldrig kan göra något, samma princip som Kvittons uppladdar-
            flikar (Expenses.jsx). */}
        {hasMultipleAccounts && (
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} style={listFilterFieldStyle}>
            <option value="all">{tr('ui.alla_konton')}</option>
            {effectiveAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </ListFilterBar>}

      {activeTab === 'reconcile' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Reconciliation
            bankAccounts={effectiveAccounts}
            bankTransactions={bankTransactions}
            verifications={verifications}
            accounts={accounts}
            reconciliations={reconciliations}
            onSave={(rec) => onUpdateCompany?.(c => ({ ...c, reconciliations: [...(c.reconciliations || []), rec] }))}
            onDelete={(id) => onUpdateCompany?.(c => ({ ...c, reconciliations: (c.reconciliations || []).filter(r => r.id !== id) }))}
          />
        </div>
      )}

      {activeTab !== 'reconcile' && <div style={{ flex: 1, overflowY: 'auto' }}>
        {bankTransactions.length === 0 ? (
          // Samma kortram som ListTable (bordered=true, samma komponent som
          // renderar raderna nedan) i stället för en egen flytande, rundad
          // ruta — rakt upptill, fäst flush mot filterraden ovanför, rundat
          // bara nedtill, med samma kant/skugga. Tomt och fyllt läge ser nu
          // ut som SAMMA kort, bara olika innehåll. Ikonrutan rundad kvadrat
          // (INTE en cirkel) på neutral --bg-muted, med den mörka
          // varumärkesgröna (BRAND.green/--accent) som ikonfärg — inte en
          // ljus pastelltoning.
          <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{
              minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '48px 24px',
            }}>
              <div style={{ width: 72, height: 72, borderRadius: '18px', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', color: BRAND.green }}>
                <Landmark size={30} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-main)' }}>{tr('ui.inga_banktransaktioner_annu')}</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px', margin: '0 0 24px' }}>
                {tr('ui.ladda_upp_ett_kontoutdrag_csv_eller_excel_for_at')}
              </p>
              {/* Inte .btn-primary (index.css: var(--lime-500), en ljusare
                  grön) — samma mörka varumärkesgröna knapp som Kontakters/
                  Offerters tomma-läge-knappar, inte en avvikande nyans. */}
              <button
                onClick={() => setShowImportModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                <Upload size={15} /> {tr('ui.importera_transaktioner')}
              </button>
            </div>
          </div>
        ) : (
          <ListTable
            rowKey={t => t.id}
            emptyMessage={tr('ui.inga_transaktioner_matchar_filtret')}
            rows={visibleTransactions}
            onRowClick={t => t.status === 'unmatched' && setExpandedId(expandedId === t.id ? null : t.id)}
            isExpanded={t => expandedId === t.id}
            renderExpanded={t => (
              <BankRowDetail
                row={t}
                invoiceCandidates={invoiceCandidates(invoices, contacts)}
                supplierCandidates={supplierInvoiceCandidates(expenses, contacts)}
                accounts={accounts}
                vatPeriods={vatPeriods}
                ledgerAccount={accountById(accountIdOf(t)).ledgerAccount}
                historySuggestion={suggestFromHistory(t, bankHistory)}
                matchSuggestion={suggestMatch(t, { invoices, expenses })}
                onConfirmInvoiceMatch={id => handleConfirmInvoiceMatch(t, id)}
                onConfirmSupplierMatch={id => handleConfirmSupplierMatch(t, id)}
                onQuickBook={form => handleQuickBook(t, form)}
                onIgnore={() => handleIgnore(t)}
                onDelete={() => handleDeleteRow(t)}
              />
            )}
            columns={[
              {
                key: 'date', label: tr('ui.datum'), render: t => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t.status === 'unmatched' ? (expandedId === t.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14 }} />}
                    {formatDate(t.date)}
                  </div>
                ),
              },
              {
                key: 'description', label: tr('ui.beskrivning'), color: 'var(--text-main)', wrap: true, render: t => (
                  <div>
                    {t.description || <span style={{ color: 'var(--text-muted)' }}>–</span>}
                    {/* Kontonamnet — bara när det faktiskt finns mer än ett
                        att skilja på, se hasMultipleAccounts. Det här är
                        SVARET på "vilket konto hör den här ihop med", inte
                        bara en etikett. */}
                    {hasMultipleAccounts && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{accountById(accountIdOf(t)).name}{t.reference ? tr('ui.ref_2', { reference: t.reference }) : ''}</div>
                    )}
                    {!hasMultipleAccounts && t.reference && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{tr('ui.ref')} {t.reference}</div>}
                  </div>
                ),
              },
              {
                key: 'amount', label: tr('ui.belopp'), align: 'right', fontWeight: 700, render: t => (
                  <span style={{ color: t.amount > 0 ? 'var(--status-green-text)' : 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {t.amount > 0 ? <ArrowDownCircle size={13} /> : <ArrowUpCircle size={13} />}
                    {t.amount > 0 ? '+' : ''}{fmt(t.amount)} {tr('ui.kr')}
                  </span>
                ),
              },
              { key: 'status', label: tr('ui.status'), align: 'center', render: t => <StatusBadge status={t.status} /> },
            ]}
            // Kundfeedback: "i bank är den stor på mobilen — gör så den blir
            // som Verifikationer, där den ser jättebra ut och inte är så
            // stor". Banklistan saknade en `mobileList`, och föll därför
            // tillbaka på den staplade kortvyn där varje fält får en egen
            // rad med sin etikett ovanför (fyra rader per transaktion). Samma
            // täta listrad som verifikationslistan i stället: text + belopp
            // på rad ett, datum/referens på rad två, status som märke.
            mobileList={t => ({
              dot: STATUS_META[t.status]?.text || 'var(--status-amber-text)',
              primary: t.description || (t.amount > 0 ? tr('ui.insattning') : tr('ui.uttag')),
              amount: (
                <span style={{ color: t.amount > 0 ? 'var(--status-green-text)' : 'var(--text-main)' }}>
                  {t.amount > 0 ? '+' : ''}{fmt(t.amount)} {tr('ui.kr')}
                </span>
              ),
              meta: [formatDate(t.date), hasMultipleAccounts ? accountById(accountIdOf(t)).name : null, t.reference ? `Ref: ${t.reference}` : null].filter(Boolean).join(' · '),
              pill: <StatusBadge status={t.status} />,
            })}
          />
        )}
      </div>}

      {showImportModal && (
        <ImportWizardModal
          bankTransactions={bankTransactions}
          bankImportProfiles={bankImportProfiles}
          bankAccountsList={effectiveAccounts}
          onAddBankAccount={handleAddAccount}
          onUpdateCompany={onUpdateCompany}
          onImport={handleImportCommit}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showAccountsModal && (
        <BankAccountsModal
          accounts={effectiveAccounts}
          bankTransactions={bankTransactions}
          onAdd={handleAddAccount}
          onRename={handleRenameAccount}
          onDelete={handleDeleteAccount}
          onClose={() => setShowAccountsModal(false)}
        />
      )}
    </div>
  );
}

// ── Bankkonton: lägg till/döp om/ta bort ────────────────────────────────
// Kundönskemål: "namnge kontot man har, lägg till ett annat, se vilka
// transaktioner som hör till vilket". Default-kontot (isDefault, alltid
// bundet mot 1930) kan döpas om men aldrig raderas eller flyttas till ett
// annat bokföringskonto — det ÄR redan bokfört mot 1930 i alla tidigare
// transaktioner, att ändra det i efterhand hade gjort gammal bokföring
// missvisande.
function BankAccountsModal({ accounts, bankTransactions, onAdd, onRename, onDelete, onClose }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLedger, setNewLedger] = useState('');

  const countFor = (id) => bankTransactions.filter(t => accountIdOf(t) === id).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{tr('ui.bankkonton')}</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
          {tr('ui.ett_konto_per_riktigt_bankkonto_ni_har_importera')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          {accounts.map(a => {
            const count = countFor(a.id);
            const isRenaming = renamingId === a.id;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)' }}>
                <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'var(--bg-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Landmark size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isRenaming ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input value={renameValue} onChange={e => setRenameValue(e.target.value)} style={{ ...inp, padding: '6px 8px', fontSize: '13px' }} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') { onRename(a.id, renameValue); setRenamingId(null); } if (e.key === 'Escape') setRenamingId(null); }} />
                      <button onClick={() => { onRename(a.id, renameValue); setRenamingId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND.green, padding: '4px' }}><Check size={16} /></button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{a.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{tr('ui.konto_2')} {a.ledgerAccount} · {count} {count === 1 ? 'transaktion' : 'transaktioner'}</div>
                    </>
                  )}
                </div>
                {!isRenaming && (
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => { setRenamingId(a.id); setRenameValue(a.name); }} title={tr('ui.byt_namn')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px' }}><Pencil size={14} /></button>
                    {!a.isDefault && (
                      <button onClick={() => onDelete(a)} title={tr('ui.ta_bort_kontot')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-red-text)', padding: '6px' }}><Trash2 size={14} /></button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showAdd ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={fieldLabel}>{tr('ui.namn')}</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tr('ui.t_ex_sparkonto_handelsbanken')} style={inp} autoFocus />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={fieldLabel}>{tr('ui.bokfors_mot_konto')}</label>
              {/* Vanlig textruta, medvetet INTE AccountSearch — den kräver
                  att koden redan finns i kontoplanen (matchar bara BEFINTLIGA
                  konton, se SearchInputs.jsx), men hela poängen här är att
                  kunna ange ett bankkontos NYA kod (t.ex. 1931) innan den
                  ens är skapad i kontoplanen. */}
              <input value={newLedger} onChange={e => setNewLedger(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder={tr('ui.t_ex_1931')} style={inp} inputMode="numeric" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>{tr('ui.fyrsiffrig_kontokod_finns_den_inte_redan_i_konto')}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAdd(false); setNewName(''); setNewLedger(''); }} style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{tr('ui.avbryt')}</button>
              <button
                disabled={!newName.trim() || !newLedger}
                onClick={() => { onAdd(newName, newLedger); setShowAdd(false); setNewName(''); setNewLedger(''); }}
                style={{ padding: '8px 16px', background: (newName.trim() && newLedger) ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: (newName.trim() && newLedger) ? 'pointer' : 'not-allowed' }}
              >
                {tr('ui.lagg_till')}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            <Plus size={14} /> {tr('ui.nytt_bankkonto')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Radexpansion: matchningsförslag + "Bokför direkt" + "Ignorera" ───────
function BankRowDetail({ row, historySuggestion, matchSuggestion, invoiceCandidates, supplierCandidates, accounts, vatPeriods, ledgerAccount = '1930', onConfirmInvoiceMatch, onConfirmSupplierMatch, onQuickBook, onIgnore, onDelete }) {
  const isInflow = row.amount > 0;
  const candidates = isInflow ? invoiceCandidates : supplierCandidates;
  // Förvald med den faktura som troligast hör till raden (bankMatching.js).
  const [selectedId, setSelectedId] = useState(() => (matchSuggestion && candidates.some(c => c.id === matchSuggestion.id) ? matchSuggestion.id : ''));
  const [showQuickBook, setShowQuickBook] = useState(Boolean(historySuggestion?.accountCode));
  const [qbDate, setQbDate] = useState(row.date);
  const [qbDesc, setQbDesc] = useState(row.description || '');
  const [qbSeries, setQbSeries] = useState('A');
  // Kundönskemål, ordagrant i sak: "bank thing absolutely can be much
  // better" — ett förslag på motkonto ur beskrivningen, samma regler och
  // samma "gissa aldrig om det inte är rimligt"-princip som kvitto-OCR:n
  // (utils/accountCategories.js, delad med ocrReceipt.js). Bara för
  // UTFLÖDEN (leverantörssidan) — reglerna är kostnadskonton, en
  // kundinbetalnings motkonto går inte att gissa ur en beskrivning. Fältet
  // förblir helt redigerbart och bokförs aldrig utan ett uttryckligt klick
  // på "Bokför" — samma bekräftelsekrav som redan gäller för raden.
  // Först det användaren själv bokfört för samma motpart, sedan reglerna.
  const fromHistory = historySuggestion?.accountCode && accounts.some(a => a.code === historySuggestion.accountCode) ? historySuggestion : null;
  const suggestion = !isInflow ? guessAccountFromText(row.description) : null;
  const suggestedCode = fromHistory?.accountCode || (suggestion?.accountCode && accounts.some(a => a.code === suggestion.accountCode) ? suggestion.accountCode : '');
  const [qbAccount, setQbAccount] = useState(suggestedCode);
  const [qbAccountIsSuggestion, setQbAccountIsSuggestion] = useState(Boolean(suggestedCode));

  const lockedPeriod = findLockedVatPeriod(qbDate, vatPeriods);

  return (
    <div style={{ padding: '16px 20px', background: 'var(--bg-muted)', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {candidates.length > 0 && (
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            {isInflow ? tr('ui.matcha_mot_kundfaktura') : tr('ui.matcha_mot_leverantorsfaktura')}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...inp, width: '360px' }}>
              <option value="">{tr('ui.valj_faktura')}</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button
              disabled={!selectedId}
              onClick={() => isInflow ? onConfirmInvoiceMatch(selectedId) : onConfirmSupplierMatch(selectedId)}
              style={{ padding: '8px 16px', background: selectedId ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: selectedId ? 'pointer' : 'not-allowed' }}
            >
              <CheckCircle2 size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> {tr('ui.bekrafta_matchning')}
            </button>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            {tr('ui.fakturan_markeras_betald_med_den_har_transaktion')}{formatDate(row.date)}{tr('ui.inte_dagens')}
          </p>
        </div>
      )}

      {candidates.length === 0 && !showQuickBook && (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>{tr('ui.ingen_matchande_obetald_faktura_hittades')}</p>
      )}

      <div style={{ display: 'flex', gap: '8px', borderTop: candidates.length > 0 ? '1px solid var(--border-light)' : 'none', paddingTop: candidates.length > 0 ? '12px' : 0 }}>
        <button onClick={() => setShowQuickBook(v => !v)} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {showQuickBook ? tr('ui.dolj_bokforingsformular') : tr('ui.bokfor_direkt')}
        </button>
        <button onClick={onIgnore} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {tr('ui.ignorera')}
        </button>
        {/* Ligger sist och längst till höger (marginLeft: auto) — det är den
            enda oåterkalleliga handlingen i raden, och ska inte sitta
            granne med de två vanliga. */}
        <button onClick={onDelete} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-red-text)', cursor: 'pointer' }}>
          <Trash2 size={13} /> {tr('ui.ta_bort_raden')}
        </button>
      </div>

      {showQuickBook && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
          {lockedPeriod && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: 'var(--status-amber-text)', lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{tr('ui.denna_period_ar_redan_momsredovisad_andringar_ha')}</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 70px', gap: '10px', marginBottom: '10px' }}>
            <div><label style={fieldLabel}>{tr('ui.datum')}</label><input type="date" value={qbDate} onChange={e => setQbDate(e.target.value)} style={inp} /></div>
            <div><label style={fieldLabel}>{tr('ui.beskrivning')}</label><input value={qbDesc} onChange={e => setQbDesc(e.target.value)} style={inp} /></div>
            <div><label style={fieldLabel}>{tr('ui.serie')}</label>
              <select value={qbSeries} onChange={e => setQbSeries(e.target.value)} style={{ ...inp, textAlign: 'center' }}>
                {VERIFICATION_SERIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>{isInflow ? tr('ui.vad_var_det_for_pengar') : tr('ui.vad_galler_utgiften')} — {isInflow ? tr('ui.pengar_in_pa') : tr('ui.pengar_ut_fran')} {ledgerAccount} {tr('ui.bokas_automatiskt')} {fmt(Math.abs(row.amount))} {tr('ui.kr')}</label>
              <AccountSearch
                value={qbAccount}
                onChange={v => { setQbAccount(v); setQbAccountIsSuggestion(false); }}
                accounts={accounts}
                placeholder={tr('ui.sok_konto_2')}
              />
              {qbAccountIsSuggestion && qbAccount && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '5px 0 0' }}>
                  {fromHistory && qbAccount === fromHistory.accountCode
                    ? tr('bankLearning.hint', { count: fromHistory.times })
                    : tr('ui.forslag_utifran_beskrivningen_kontrollera_innan')}
                </p>
              )}
            </div>
            <button
              disabled={!qbAccount || !qbDate}
              onClick={() => onQuickBook({ date: qbDate, description: qbDesc || row.description || tr('ui.banktransaktion'), series: qbSeries, counterAccount: qbAccount })}
              style={{ padding: '9px 18px', background: qbAccount ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: qbAccount ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
            >
              {tr('ui.bokfor_2')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Importguide: fil → kolumnmappning → förhandsgranskning → commit ──────
// Banklistan (namn, logotyp, klickväg till exporten) kommer från
// src/utils/bankSources.js — samma källa som den publika sidan
// /koppla-bank och startsidans animation läser. Låg tidigare som en egen
// BANK_EXPORT_PATHS-konstant HÄR; två listor hade garanterat glidit isär
// i samma sekund en bank ändrade sin meny, och en besökare som sett
// "Danske Bank" på sajten och sedan inte hittar den i modalen tappar
// förtroendet direkt (exakt samma resonemang som migrationSources.js
// redan gör för bokföringsprogrammen).
//
// Varför hjälpen behövs alls: importen kan läsa en bankfil, men den kan
// inte hjälpa någon att HITTA exportknappen i sin internetbank — och det
// är precis där en förstagångsanvändare fastnar. "Ladda upp ditt
// kontoutdrag" är värdelöst för den som inte vet att internetbanken ens
// kan exportera ett.

// Loggraden gör TVÅ jobb med en och samma rad, med flit: den svarar på
// frågan man har innan man klickar på något ("funkar det här med MIN
// bank?") och den är väljaren som tar fram klickvägen. En separat
// "funkar med"-remsa ovanför släppytan hade betytt samma nio loggor
// två gånger i samma modal.
//
// Ingen hopfällning: klickvägen visas bara för den bank man faktiskt
// valt, så det som står här hela tiden är två rader loggor. Det var
// nio klickvägar i klartext som gjorde att hjälpen behövde fällas ihop
// för att inte skjuta ner släppytan — de finns inte längre.
// "Annan bank" som en likvärdig bricka i raden, inte som en fotnot under
// den: importen läser filen oavsett bank (se bankSources.js), och den som
// inte ser sin egen bank bland loggorna ska hitta sitt svar i raden i
// stället för att stänga modalen. Samma bricka som väljaren på
// /koppla-bank har.
const OTHER_BANK_TILE = { id: 'other', name: 'Annan bank' };

// Bricka med logotypen STOR och namnet under — samma form som den
// publika väljaren på /koppla-bank. Loggan får ta i stort sett hela
// rutan (kundönskemål: den ska synas ordentligt, inte vara ett litet
// märke i ett hörn); namnet under är det som gör raden läsbar även för
// den som inte känner igen ett märke på formen.
function BankPickerButton({ bank, on, onClick }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={on} aria-label={bank.name}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
        padding: '8px 8px 9px', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'inherit',
        border: `1.5px solid ${on ? BRAND.green : 'var(--border)'}`, borderRadius: '10px',
        boxShadow: on ? `0 0 0 2px ${BRAND.greenLight}` : 'none',
      }}
    >
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 48, padding: '0 8px',
        background: bank.logo ? '#fff' : 'var(--bg-muted)', border: '1px solid var(--border-light)', borderRadius: '8px',
      }}>
        {bank.logo
          ? <BankLogo bank={bank} maxW={86} maxH={68} />
          : <Landmark size={21} color="var(--text-muted)" />}
      </span>
      <span style={{ fontSize: '12px', fontWeight: 700, color: on ? BRAND.greenDark : 'var(--text-secondary)' }}>{bank.name}</span>
    </button>
  );
}

function BankExportHelp() {
  // `null` = ingen bank vald ännu: visa raden, men inte någon vägledning.
  // `'other'` = "Annan bank"-brickan, som har sin egen generella text i
  // stället för en bankspecifik klickväg.
  const [selected, setSelected] = useState(null);
  const active = BANK_SOURCES.find(b => b.id === selected);
  return (
    <div style={{ marginTop: '14px', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', background: 'var(--bg-muted)', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
        <HelpCircle size={15} color={BRAND.greenDark} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{tr('ui.sa_exporterar_du_fran_din_bank')}</span>
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{tr('ui.valj_din_bank')}</span>
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(122px, 1fr))', gap: '8px' }}>
          {BANK_SOURCES.map(b => (
            <BankPickerButton
              key={b.id} bank={b} on={selected === b.id}
              onClick={() => setSelected(selected === b.id ? null : b.id)}
            />
          ))}
          {/* "Annan bank" sist och likvärdig med de nio andra, inte en
              fotnot: importen läser filen oavsett bank, och den som inte
              ser sin egen bank i raden ska hitta sitt svar HÄR i stället
              för att stänga modalen. */}
          <BankPickerButton
            bank={OTHER_BANK_TILE} on={selected === 'other'}
            onClick={() => setSelected(selected === 'other' ? null : 'other')}
          />
        </div>

        {selected === 'other' ? (
          <p style={{ fontSize: '12.5px', color: 'var(--text-main)', lineHeight: 1.7, margin: '14px 0 0' }}>
            {OTHER_BANK_HINT} {tr('ui.bokix_laser_filen_oavsett_vilken_bank_som_skapad')}
          </p>
        ) : active ? (
          <>
            {/* Klickvägen som brickor med pilar emellan — samma sträng som
                /koppla-bank visar, uppdelad med samma delade hjälpfunktion. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
              {splitBankPath(active.path).map((part, i) => (
                <React.Fragment key={part}>
                  {i > 0 && <ChevronRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                  <span style={{ padding: '5px 9px', borderRadius: '7px', background: 'var(--bg-muted)', border: '1px solid var(--border-light)', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{part}</span>
                </React.Fragment>
              ))}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '12px 0 0' }}>
              {tr('ui.hittar_du_inte_knappen_menyplaceringen_kan_ha_an')}
            </p>
          </>
        ) : (
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '12px 0 0' }}>
            {tr('ui.klicka_pa_din_bank_sa_visar_vi_var_exportknappen')}
          </p>
        )}
      </div>
    </div>
  );
}

// "CSV, XLSX, XLS eller TXT (max 10 MB)" är inte bara text i gränssnittet
// — båda reglerna kontrolleras i handleFile nedan, samma mönster som
// underlagsuppladdningen i Verifications.jsx/SupplierInvoices.jsx.
// Konstanterna bor i bankSources.js: /koppla-bank utlovar samma siffror i
// text, och de får inte kunna säga olika saker.


const STEP_LABELS = [tr('ui.steg_fil'), tr('ui.steg_kolumner'), tr('ui.steg_forhandsgranskning')];

function ImportWizardModal({ bankTransactions, bankImportProfiles, bankAccountsList, onAddBankAccount, onUpdateCompany, onImport, onClose }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [bankMod, setBankMod] = useState(null); // lazy-laddad src/utils/bankImport.js
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [preview, setPreview] = useState(null); // { toImport, alreadyImported, errors }

  // Vilket bankkonto importen gäller (flera bankkonton, kundönskemål) —
  // bara relevant att välja när det faktiskt finns fler än ett, annars är
  // det syntetiserade default-kontot redan det enda alternativet och
  // väljaren skulle bara vara ett extra klick utan mening.
  const hasChoice = bankAccountsList.length > 1;
  const [accountId, setAccountId] = useState(bankAccountsList[0]?.id || 'default');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountLedger, setNewAccountLedger] = useState('');
  const handleCreateAccountInline = () => {
    if (!newAccountName.trim() || !newAccountLedger) return;
    onAddBankAccount(newAccountName, newAccountLedger);
    // Nya kontot hamnar sist i listan (Bank.jsx:s persistAccounts) — väljs
    // direkt så man inte behöver hitta det igen i selecten.
    setAccountId(`bank_pending_${newAccountName}`); // ersätts nedan så fort listan hunnit uppdateras
    setShowNewAccount(false);
    setNewAccountName(''); setNewAccountLedger('');
  };
  // bankAccountsList uppdateras asynkront (går via onUpdateCompany → props,
  // en render-omgång bort) — så fort det NYA kontot faktiskt finns i listan
  // (matchar namnet vi just skapade), byt till dess riktiga id. Enklare och
  // säkrare än att gissa ett id i förväg.
  useEffect(() => {
    if (!accountId.startsWith('bank_pending_')) return;
    const pendingName = accountId.replace('bank_pending_', '');
    const created = bankAccountsList.find(a => a.name === pendingName);
    if (created) setAccountId(created.id);
  }, [bankAccountsList, accountId]);

  const loadBankModule = async () => {
    if (bankMod) return bankMod;
    const mod = await import('../utils/bankImport.js');
    setBankMod(mod);
    return mod;
  };

  const handleFile = async (file) => {
    if (!file) return;
    // Kontrolleras HÄR och inte bara via <input accept> — accept gäller
    // filväljaren, men säger ingenting om en fil som släpps med drag and
    // drop. En .pdf eller .zip hade annars gått rakt in i CSV-tolkaren och
    // gett ett obegripligt "hittade inga rader"-fel i stället för att säga
    // vad som faktiskt var fel.
    const name = (file.name || '').toLowerCase();
    if (!ACCEPTED_BANK_EXTENSIONS.some(ext => name.endsWith(ext))) {
      setError(tr('ui.ar_inte_en_bankfil_som_kan_lasas_ladda_upp_csv_t', { name: file.name }));
      return;
    }
    if (file.size > MAX_BANK_FILE_MB * 1024 * 1024) {
      setError(tr('ui.ar_for_stor_max_mb', { name: file.name, MAX_BANK_FILE_MB }));
      return;
    }
    setBusy(true); setError('');
    try {
      const mod = await loadBankModule();
      const { headers: h, rows, errors } = await mod.parseBankFile(file);
      if (!h.length || !rows.length) throw new Error(tr('ui.kunde_inte_hitta_nagra_rader_i_filen_kontrollera'));
      setHeaders(h);
      setRawRows(rows);
      const fingerprint = mod.fingerprintHeaders(h);
      const remembered = bankImportProfiles?.[fingerprint];
      setMapping(remembered || mod.guessColumnMapping(h));
      if (errors.length) console.warn('CSV-tolkningsvarningar:', errors);
      setStep(1);
    } catch (e) {
      setError(e.message || tr('ui.kunde_inte_lasa_filen'));
    } finally {
      setBusy(false);
    }
  };

  const handleBuildPreview = async () => {
    setBusy(true); setError('');
    try {
      const mod = await loadBankModule();
      const { rows, errors } = mod.normalizeRows(rawRows, mapping);
      const { toImport, alreadyImported } = mod.dedupeAgainstExisting(rows, bankTransactions, accountId);
      setPreview({ toImport, alreadyImported, errors });
      // Kom ihåg mappningen för nästa gång samma bank importeras — nästlad
      // under company.bankImportProfiles (se App.jsx createEmptyCompanyData).
      const fingerprint = mod.fingerprintHeaders(headers);
      onUpdateCompany?.(company => ({ ...company, bankImportProfiles: { ...(company.bankImportProfiles || {}), [fingerprint]: mapping } }));
      setStep(2);
    } catch (e) {
      setError(e.message || tr('ui.kunde_inte_tolka_rader_med_den_har_mappningen'));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    setBusy(true);
    try {
      const mod = await loadBankModule();
      const batchId = `batch_${Date.now()}`;
      const records = mod.buildBankTransactionRecords(preview.toImport, batchId, accountId);
      onImport(records, accountId);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '760px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{tr('ui.importera_banktransaktioner')}</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
          {STEP_LABELS.map((label, i) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', fontSize: '11.5px', fontWeight: 700, padding: '6px 0', borderRadius: '999px', background: i <= step ? BRAND.greenLight : 'var(--bg-muted)', color: i <= step ? BRAND.greenDark : 'var(--text-muted)' }}>
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--status-red-text)' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
          </div>
        )}

        {step === 0 && (
          <>
          {/* Kontoväljaren — bara synlig med fler än ETT bankkonto (se
              hasChoice ovan). Med bara det syntetiserade default-kontot
              importeras dit tyst, precis som innan funktionen fanns —
              nollfriktion för alla som aldrig rör den. */}
          {hasChoice && (
            <div style={{ marginBottom: '16px' }}>
              <label style={fieldLabel}>{tr('ui.vilket_bankkonto_galler_importen')}</label>
              {!showNewAccount ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inp, flex: 1 }}>
                    {bankAccountsList.map(a => <option key={a.id} value={a.id}>{a.name} {tr('ui.konto')} {a.ledgerAccount})</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewAccount(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Plus size={13} /> {tr('ui.nytt_konto')}
                  </button>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder={tr('ui.namn_t_ex_sparkonto_handelsbanken')} style={inp} autoFocus />
                  <input value={newAccountLedger} onChange={e => setNewAccountLedger(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder={tr('ui.bokfors_mot_konto_t_ex_1931')} style={inp} inputMode="numeric" />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => { setShowNewAccount(false); setNewAccountName(''); setNewAccountLedger(''); }} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{tr('ui.avbryt')}</button>
                    <button type="button" disabled={!newAccountName.trim() || !newAccountLedger} onClick={handleCreateAccountInline} style={{ padding: '7px 14px', background: (newAccountName.trim() && newAccountLedger) ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: (newAccountName.trim() && newAccountLedger) ? 'pointer' : 'not-allowed' }}>{tr('ui.lagg_till_och_valj')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!hasChoice && (
            <button type="button" onClick={() => setShowNewAccount(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px', padding: 0, background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Plus size={12} /> {tr('ui.fler_bankkonton_lagg_till_ett_innan_du_importera')}
            </button>
          )}
          {!hasChoice && showNewAccount && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder={tr('ui.namn_t_ex_sparkonto_handelsbanken')} style={inp} autoFocus />
              <input value={newAccountLedger} onChange={e => setNewAccountLedger(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder={tr('ui.bokfors_mot_konto_t_ex_1931')} style={inp} inputMode="numeric" />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowNewAccount(false); setNewAccountName(''); setNewAccountLedger(''); }} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{tr('ui.avbryt')}</button>
                <button type="button" disabled={!newAccountName.trim() || !newAccountLedger} onClick={handleCreateAccountInline} style={{ padding: '7px 14px', background: (newAccountName.trim() && newAccountLedger) ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: (newAccountName.trim() && newAccountLedger) ? 'pointer' : 'not-allowed' }}>{tr('ui.lagg_till_och_valj')}</button>
              </div>
            </div>
          )}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => document.getElementById('bank-import-file').click()}
            style={{
              border: `1.5px dashed ${isDragging ? BRAND.green : 'var(--gray-300)'}`,
              background: isDragging ? 'rgba(234,243,222,0.4)' : 'var(--bg-card)',
              borderRadius: '12px', padding: '40px 20px', textAlign: 'center',
              cursor: busy ? 'wait' : 'pointer', transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input type="file" id="bank-import-file" style={{ display: 'none' }} accept=".csv,.txt,.xlsx,.xls" disabled={busy} onChange={e => handleFile(e.target.files?.[0])} />
            <div style={{ width: 44, height: 44, borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <UploadCloud size={20} color={BRAND.greenDark} />
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', margin: '0 0 4px' }}>
              {busy ? tr('ui.laser_filen') : tr('ui.ladda_upp_kontoutdrag')}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{tr('ui.dra_och_slapp_filen_har_eller_klicka_for_att_val')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{tr('ui.csv_txt_xlsx_eller_xls_max')} {MAX_BANK_FILE_MB} {tr('ui.mb_exporterat_fran_er_internetbank')}</p>
          </div>
          <BankExportHelp />
          </>
        )}

        {step === 1 && mapping && (
          <MappingStep headers={headers} mapping={mapping} setMapping={setMapping} sampleRow={rawRows[0]} />
        )}

        {step === 2 && preview && (
          <PreviewStep preview={preview} />
        )}

        <div className="modal-footer">
          {/* Bugfix: gällde tidigare bara steg 1 (kolumnmappning) — en fel
              mappning som ger "0 nya, N kunde inte tolkas" i förhands-
              granskningen (steg 2) gick då inte att rätta utan att stänga
              hela guiden och börja om från filvalet. Tillbaka från
              förhandsgranskningen bygger om samma rawRows med en ändrad
              mappning (handleBuildPreview), ingen ny fil krävs. */}
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{tr('ui.tillbaka_2')}</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{tr('ui.avbryt')}</button>
          {step === 1 && (
            <button disabled={busy || !mapping.date || !mapping.description} onClick={handleBuildPreview} style={{ padding: '9px 18px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
              {tr('ui.forhandsgranska')}
            </button>
          )}
          {step === 2 && (
            <button disabled={busy || preview.toImport.length === 0} onClick={handleCommit} style={{ padding: '9px 18px', background: preview.toImport.length ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: (busy || !preview.toImport.length) ? 'not-allowed' : 'pointer' }}>
              {tr('ui.importera')} {preview.toImport.length} {tr('ui.transaktioner')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const MAPPING_FIELDS = [
  { key: 'date', label: tr('ui.datum'), required: true },
  { key: 'description', label: tr('ui.beskrivning'), required: true },
  { key: 'balanceColumn', label: tr('ui.saldo_valfritt') },
  { key: 'referenceColumn', label: tr('ui.referens_ocr_valfritt') },
];

function MappingStep({ headers, mapping, setMapping, sampleRow }) {
  const set = (patch) => setMapping(m => ({ ...m, ...patch }));
  return (
    <div>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        {tr('ui.bokix_har_forsokt_gissa_vilka_kolumner_som_ar_vi')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <label style={fieldLabel}>{tr('ui.datum')}</label>
          <select value={mapping.date} onChange={e => set({ date: e.target.value })} style={inp}>
            <option value="">{tr('ui.valj_kolumn')}</option>
            {headers.map(h => <option key={h} value={h}>{bankHeaderLabel(h)}</option>)}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>{tr('ui.beskrivning')}</label>
          <select value={mapping.description} onChange={e => set({ description: e.target.value })} style={inp}>
            <option value="">{tr('ui.valj_kolumn')}</option>
            {headers.map(h => <option key={h} value={h}>{bankHeaderLabel(h)}</option>)}
          </select>
        </div>

        <div>
          <label style={fieldLabel}>{tr('ui.belopp')}</label>
          <div style={{ display: 'flex', gap: '14px', marginBottom: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="radio" checked={mapping.amountMode === 'single'} onChange={() => set({ amountMode: 'single' })} /> {tr('ui.en_kolumn')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="radio" checked={mapping.amountMode === 'split'} onChange={() => set({ amountMode: 'split' })} /> {tr('ui.uttag_insattning_separat')}
            </label>
          </div>
          {mapping.amountMode === 'single' ? (
            <select value={mapping.amountColumn} onChange={e => set({ amountColumn: e.target.value })} style={inp}>
              <option value="">{tr('ui.valj_kolumn')}</option>
              {headers.map(h => <option key={h} value={h}>{bankHeaderLabel(h)}</option>)}
            </select>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={mapping.debitColumn} onChange={e => set({ debitColumn: e.target.value })} style={inp}>
                <option value="">{tr('ui.uttag_kolumn')}</option>
                {headers.map(h => <option key={h} value={h}>{bankHeaderLabel(h)}</option>)}
              </select>
              <select value={mapping.creditColumn} onChange={e => set({ creditColumn: e.target.value })} style={inp}>
                <option value="">{tr('ui.insattning_kolumn')}</option>
                {headers.map(h => <option key={h} value={h}>{bankHeaderLabel(h)}</option>)}
              </select>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={mapping.invertSign} onChange={e => set({ invertSign: e.target.checked })} />
            {tr('ui.vand_tecken_om_insattningar_visas_som_negativa_u')}
          </label>
        </div>

        {MAPPING_FIELDS.filter(f => !f.required).map(f => (
          <div key={f.key}>
            <label style={fieldLabel}>{f.label}</label>
            <select value={mapping[f.key] || ''} onChange={e => set({ [f.key]: e.target.value })} style={inp}>
              <option value="">{tr('ui.ingen')}</option>
              {headers.map(h => <option key={h} value={h}>{bankHeaderLabel(h)}</option>)}
            </select>
          </div>
        ))}
      </div>

      {sampleRow && (
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', background: 'var(--bg-muted)', borderRadius: '6px', padding: '8px 10px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <HelpCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {tr('ui.exempel_fran_forsta_raden')}{' '}
            {[
              [tr('ui.datum'), mapping.date],
              [tr('ui.beskrivning'), mapping.description],
              ...(mapping.amountMode === 'split'
                ? [[tr('ui.uttag'), mapping.debitColumn], [tr('ui.insattning'), mapping.creditColumn]]
                : [[tr('ui.belopp'), mapping.amountColumn]]),
              [tr('ui.saldo'), mapping.balanceColumn],
              [tr('ui.referens'), mapping.referenceColumn],
            ].filter(([, col]) => col).map(([label, col]) => `${label}: ${String(sampleRow[col] instanceof Date ? sampleRow[col].toLocaleDateString('sv-SE') : (sampleRow[col] ?? '')).trim().replace(/(\d) (\d)/g,'$1 $2') || '(tom)'}`).join(' · ') || tr('ui.valj_kolumnerna_ovan')}
          </span>
        </div>
      )}
    </div>
  );
}

function PreviewStep({ preview }) {
  const { toImport, alreadyImported, errors } = preview;
  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontWeight: 700 }}>{toImport.length} {tr('ui.nya')}</span>
        {alreadyImported.length > 0 && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-gray-bg)', color: 'var(--status-gray-text)', fontWeight: 700 }}>{alreadyImported.length} {tr('ui.redan_importerade_hoppas_over')}</span>}
        {errors.length > 0 && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', fontWeight: 700 }}>{errors.length} {tr('ui.rader_kunde_inte_tolkas')}</span>}
      </div>
      <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)', position: 'sticky', top: 0 }}>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>{tr('ui.datum')}</th>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>{tr('ui.beskrivning')}</th>
              <th style={{ textAlign: 'right', padding: '8px 10px' }}>{tr('ui.belopp')}</th>
            </tr>
          </thead>
          <tbody>
            {toImport.slice(0, 200).map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: '7px 10px', color: 'var(--text-main)' }}>{formatDate(r.date)}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-main)' }}>{r.description}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: r.amount > 0 ? 'var(--status-green-text)' : 'var(--text-main)', fontWeight: 600 }}>{fmt(r.amount)} {tr('ui.kr')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {toImport.length > 200 && <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>+ {toImport.length - 200} {tr('ui.till')}</div>}
      </div>
    </div>
  );
}
