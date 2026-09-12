import React, { useState, useMemo, useEffect } from 'react';
import {
  Upload, UploadCloud, AlertCircle, CheckCircle2, X, ChevronDown, ChevronRight,
  Landmark, ArrowDownCircle, ArrowUpCircle, HelpCircle, Search, Trash2, Undo2,
  Plus, Settings, Pencil, Check,
} from 'lucide-react';
import ListPageHeader, { ListFilterBar, listSearchInputStyle, listFilterFieldStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { AccountSearch } from './shared/SearchInputs';
import { confirmDialog } from './shared/ConfirmDialog';
import { findLockedVatPeriod } from '../utils/vatCalculation';
import { BRAND } from '../utils/brandColors';
import { BankLogo } from './shared/BrandLogos';
import { BANK_SOURCES, OTHER_BANK_HINT, MAX_BANK_FILE_MB, ACCEPTED_BANK_EXTENSIONS, splitBankPath } from '../utils/bankSources';

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
  unmatched: { label: 'Ej hanterad', bg: 'var(--status-amber-bg)', text: 'var(--status-amber-text)' },
  matched: { label: 'Matchad', bg: 'var(--status-green-bg)', text: 'var(--status-green-text)' },
  booked: { label: 'Bokförd', bg: 'var(--status-green-bg)', text: 'var(--status-green-text)' },
  ignored: { label: 'Ignorerad', bg: 'var(--status-gray-bg)', text: 'var(--status-gray-text)' },
};
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.unmatched;
  return <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: m.bg, color: m.text, whiteSpace: 'nowrap' }}>{m.label}</span>;
}

// Samma löpande-nummer-per-serie-logik som Verifications.jsx:709
// (getNextNumber) — en avsiktlig, liten dubblering: "Bokför direkt" är ett
// genuint manuellt bokföringstillfälle (till skillnad från de återanvända
// betalnings-handlarna, som redan får ett fallback-nummer gratis via
// handleAddVerification i App.jsx) och förtjänar samma riktiga A/B/C-
// serienummer som en vanlig manuell verifikation. Om logiken någonsin
// ändras där bör den brytas ut till en delad util istället för att synkas
// för hand på två ställen.
function getNextSeriesNumber(verifications, seriesLetter = 'A') {
  const max = (verifications || []).reduce((m, v) => {
    if (!(v.number || '').startsWith(seriesLetter)) return m;
    const n = parseInt((v.number || '').replace(/\D/g, ''), 10);
    return !isNaN(n) && n > m ? n : m;
  }, 0);
  return `${seriesLetter}${String(max + 1).padStart(3, '0')}`;
}

// ── Matchningskandidater (fullständig lista, inte bara "bästa gissning") ──
function invoiceGross(inv) {
  return (inv.rows || []).reduce((sum, r) => {
    const lineNet = (r.qty || 0) * (r.unitPrice || 0);
    return sum + lineNet + lineNet * ((r.vatRate || 0) / 100);
  }, 0);
}
function invoiceCandidates(invoices, contacts) {
  return (invoices || [])
    .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
    .map(inv => {
      const remaining = Math.max(0, invoiceGross(inv) - (inv.paidAmount || 0));
      const customer = (contacts || []).find(c => c.id === inv.customerId);
      return { id: inv.id, remaining, label: `${inv.invoiceNumber} – ${customer?.name || 'okänd kund'} – ${fmt(remaining)} kr` };
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
      return { id: inv.id, label: `${inv.invoiceNumber} – ${supplier?.name || 'okänd leverantör'} – ${fmt(inv.amount)} kr` };
    });
}

export default function Bank({
  bankTransactions = [],
  bankImportProfiles = {},
  bankAccounts = [],
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
    const used = bankTransactions.filter(t => accountIdOf(t) === account.id).length;
    if (used > 0) { alert(`"${account.name}" har ${used} transaktioner och kan inte tas bort. Ta bort eller vänta med raderna först.`); return; }
    if (!(await confirmDialog(`Ta bort bankkontot "${account.name}"? Det går inte att ångra.`, { danger: true }))) return;
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
      ? 'Ta bort den här raden från bankvyn? Verifikationen eller betalningen den redan skapat ligger kvar i bokföringen och måste rättas där.'
      : 'Ta bort den här raden från bankvyn? Den försvinner bara härifrån — du kan importera kontoutdraget igen.';
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
    if (!(await confirmDialog(`Ångra den senaste importen? ${latestBatch.count} ohanterade rader tas bort från bankvyn. Redan bokförda rader ur samma omgång lämnas kvar.`))) return;
    onSetBankTransactions(prev => prev.filter(t => !(t.importBatchId === latestBatch.id && (t.status === 'unmatched' || t.status === 'ignored'))));
    setExpandedId(null);
  };
  const handleIgnore = async (row) => {
    if (!(await confirmDialog('Ignorera den här transaktionen? Ingen verifikation skapas — använd det t.ex. för överföringar mellan era egna konton.'))) return;
    updateRow(row.id, { status: 'ignored' });
    // Bugfix: utan detta blev den expanderade detaljraden kvar öppen efter
    // Ignorera — status blir inte längre 'unmatched', så onRowClick-vakten
    // (nedan) slutar reagera på klick på raden och panelen gick inte att
    // stänga på något sätt förutom att byta flik.
    setExpandedId(null);
  };

  const handleConfirmInvoiceMatch = (row, invoiceId) => {
    if (!invoiceId) return;
    onRegisterInvoicePayment(invoiceId, Math.abs(row.amount), row.date, accountById(accountIdOf(row)).ledgerAccount);
    updateRow(row.id, { status: 'matched', matchedType: 'invoice', matchedId: invoiceId, verificationSource: 'invoice_payment' });
    setExpandedId(null);
  };

  const handleConfirmSupplierMatch = (row, expenseId) => {
    if (!expenseId) return;
    onMarkSupplierInvoicePaid(expenseId, 'bank', row.date, accountById(accountIdOf(row)).ledgerAccount);
    updateRow(row.id, { status: 'matched', matchedType: 'supplier_invoice', matchedId: expenseId, verificationSource: 'supplier_invoice_payment' });
    setExpandedId(null);
  };

  const handleQuickBook = (row, { date, description, series, counterAccount }) => {
    const number = getNextSeriesNumber(verifications, series);
    const amount = Math.round(Math.abs(row.amount));
    const isInflow = row.amount > 0;
    // Vilket bankkonto raden faktiskt kom ifrån (flera bankkonton,
    // kundönskemål) — inte längre alltid 1930.
    const bankLedgerAccount = accountById(accountIdOf(row)).ledgerAccount;
    onAddVerification({
      number,
      date,
      description,
      source: 'bank_import',
      sourceId: row.id,
      rows: isInflow
        ? [{ account: bankLedgerAccount, debet: amount, kredit: 0 }, { account: counterAccount, debet: 0, kredit: amount }]
        : [{ account: counterAccount, debet: amount, kredit: 0 }, { account: bankLedgerAccount, debet: 0, kredit: amount }],
    });
    updateRow(row.id, { status: 'booked', verificationSource: 'bank_import' });
    setExpandedId(null);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title="Bank"
        subtitle="Importera kontoutdrag (CSV/Excel), matcha mot fakturor och bokför"
        actions={[
          // Kundönskemål: flera bankkonton, namngivna, med egen import och
          // eget bokföringskonto. Knappen ligger kvar även med bara ett
          // (syntetiserat) konto — annars skulle ingen hitta funktionen
          // första gången de faktiskt behöver den.
          { key: 'accounts', label: 'Bankkonton', icon: Settings, onClick: () => setShowAccountsModal(true) },
          // Visas bara när det FINNS en ohanterad importomgång att ångra —
          // en permanent "Ångra"-knapp bredvid "Importera" hade sett ut som
          // en lika stor och lika vanlig handling som importen själv.
          ...(latestBatch ? [{ key: 'undo', label: `Ångra import (${latestBatch.count})`, icon: Undo2, onClick: handleUndoImport }] : []),
          { key: 'import', label: 'Importera transaktioner', icon: Upload, onClick: () => setShowImportModal(true), variant: 'primary' },
        ]}
        tabs={{
          items: [
            { id: 'all', label: 'Alla', badge: tabCounts.all },
            { id: 'unmatched', label: 'Ej hanterade', badge: tabCounts.unmatched },
            { id: 'matched', label: 'Matchade', badge: tabCounts.matched },
            { id: 'booked', label: 'Bokförda', badge: tabCounts.booked },
            { id: 'ignored', label: 'Ignorerade', badge: tabCounts.ignored },
          ],
          activeId: activeTab,
          onChange: setActiveTab,
        }}
      />

      <ListFilterBar
        onClear={() => { setSearch(''); setDateFrom(''); setDateTo(''); setSelectedAccountId('all'); }}
        count={filtered.length}
        countLabel="transaktioner"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      >
        {/* Samma sökfälts-mönster som Bokförings egen ListFilterBar (facit-
            sidan för den här komponenten) — sökikon + listSearchInputStyle
            oförändrad (36px vänsterpadding reserverad åt ikonen), inte en
            egen avvikande variant. */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök text, belopp, referens..." style={{ ...listSearchInputStyle, width: '240px' }} />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={listFilterFieldStyle} />
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>–</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={listFilterFieldStyle} />
        {/* Bara synlig med fler än ETT konto — annars är det ett filter som
            aldrig kan göra något, samma princip som Kvittons uppladdar-
            flikar (Expenses.jsx). */}
        {hasMultipleAccounts && (
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} style={listFilterFieldStyle}>
            <option value="all">Alla konton</option>
            {effectiveAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </ListFilterBar>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {bankTransactions.length === 0 ? (
          // Samma tomt-läge-mönster som Quotes.jsx/Invoices.jsx (facit för
          // en helt tom listsida): centrerat flex-block, kräm/kort-bakgrund,
          // rundad ikoncirkel, fet 16px-rubrik, 13.5px undertext — pekar mot
          // sidhuvudets egen knapp istället för att duplicera en egen CTA.
          <div style={{
            flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '10px', margin: '24px', padding: '40px', textAlign: 'center',
            background: 'var(--bg-cream)', border: '1px solid var(--border)', borderRadius: '14px',
          }}>
            <div style={{ width: 56, height: 56, borderRadius: '999px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND.green, marginBottom: '4px' }}>
              <Landmark size={26} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>Inga banktransaktioner ännu</div>
            <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '320px' }}>
              Klicka på "Importera transaktioner" ovan för att ladda upp ett kontoutdrag (CSV eller Excel) och komma igång.
            </div>
          </div>
        ) : (
          <ListTable
            rowKey={t => t.id}
            emptyMessage="Inga transaktioner matchar filtret"
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
                onConfirmInvoiceMatch={id => handleConfirmInvoiceMatch(t, id)}
                onConfirmSupplierMatch={id => handleConfirmSupplierMatch(t, id)}
                onQuickBook={form => handleQuickBook(t, form)}
                onIgnore={() => handleIgnore(t)}
                onDelete={() => handleDeleteRow(t)}
              />
            )}
            columns={[
              {
                key: 'date', label: 'Datum', render: t => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t.status === 'unmatched' ? (expandedId === t.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14 }} />}
                    {formatDate(t.date)}
                  </div>
                ),
              },
              {
                key: 'description', label: 'Beskrivning', color: 'var(--text-main)', wrap: true, render: t => (
                  <div>
                    {t.description || <span style={{ color: 'var(--text-muted)' }}>–</span>}
                    {/* Kontonamnet — bara när det faktiskt finns mer än ett
                        att skilja på, se hasMultipleAccounts. Det här är
                        SVARET på "vilket konto hör den här ihop med", inte
                        bara en etikett. */}
                    {hasMultipleAccounts && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{accountById(accountIdOf(t)).name}{t.reference ? ` · Ref: ${t.reference}` : ''}</div>
                    )}
                    {!hasMultipleAccounts && t.reference && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Ref: {t.reference}</div>}
                  </div>
                ),
              },
              {
                key: 'amount', label: 'Belopp', align: 'right', fontWeight: 700, render: t => (
                  <span style={{ color: t.amount > 0 ? 'var(--status-green-text)' : 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {t.amount > 0 ? <ArrowDownCircle size={13} /> : <ArrowUpCircle size={13} />}
                    {t.amount > 0 ? '+' : ''}{fmt(t.amount)} kr
                  </span>
                ),
              },
              { key: 'status', label: 'Status', align: 'center', render: t => <StatusBadge status={t.status} /> },
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
              primary: t.description || (t.amount > 0 ? 'Insättning' : 'Uttag'),
              amount: (
                <span style={{ color: t.amount > 0 ? 'var(--status-green-text)' : 'var(--text-main)' }}>
                  {t.amount > 0 ? '+' : ''}{fmt(t.amount)} kr
                </span>
              ),
              meta: [formatDate(t.date), hasMultipleAccounts ? accountById(accountIdOf(t)).name : null, t.reference ? `Ref: ${t.reference}` : null].filter(Boolean).join(' · '),
              pill: <StatusBadge status={t.status} />,
            })}
          />
        )}
      </div>

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
          <span className="modal-title">Bankkonton</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
          Ett konto per riktigt bankkonto ni har — importera till rätt ett, och varje konto bokförs mot sitt eget konto i kontoplanen (t.ex. 1930 eller 1931).
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
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Konto {a.ledgerAccount} · {count} {count === 1 ? 'transaktion' : 'transaktioner'}</div>
                    </>
                  )}
                </div>
                {!isRenaming && (
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => { setRenamingId(a.id); setRenameValue(a.name); }} title="Byt namn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px' }}><Pencil size={14} /></button>
                    {!a.isDefault && (
                      <button onClick={() => onDelete(a)} title="Ta bort kontot" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-red-text)', padding: '6px' }}><Trash2 size={14} /></button>
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
              <label style={fieldLabel}>Namn</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="T.ex. Sparkonto Handelsbanken" style={inp} autoFocus />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={fieldLabel}>Bokförs mot konto</label>
              {/* Vanlig textruta, medvetet INTE AccountSearch — den kräver
                  att koden redan finns i kontoplanen (matchar bara BEFINTLIGA
                  konton, se SearchInputs.jsx), men hela poängen här är att
                  kunna ange ett bankkontos NYA kod (t.ex. 1931) innan den
                  ens är skapad i kontoplanen. */}
              <input value={newLedger} onChange={e => setNewLedger(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="T.ex. 1931" style={inp} inputMode="numeric" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Fyrsiffrig kontokod. Finns den inte redan i kontoplanen läggs den till automatiskt, samma som ett nytt konto under Bokföring → Kontoplan.</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAdd(false); setNewName(''); setNewLedger(''); }} style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Avbryt</button>
              <button
                disabled={!newName.trim() || !newLedger}
                onClick={() => { onAdd(newName, newLedger); setShowAdd(false); setNewName(''); setNewLedger(''); }}
                style={{ padding: '8px 16px', background: (newName.trim() && newLedger) ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: (newName.trim() && newLedger) ? 'pointer' : 'not-allowed' }}
              >
                Lägg till
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            <Plus size={14} /> Nytt bankkonto
          </button>
        )}
      </div>
    </div>
  );
}

// ── Radexpansion: matchningsförslag + "Bokför direkt" + "Ignorera" ───────
function BankRowDetail({ row, invoiceCandidates, supplierCandidates, accounts, vatPeriods, ledgerAccount = '1930', onConfirmInvoiceMatch, onConfirmSupplierMatch, onQuickBook, onIgnore, onDelete }) {
  const isInflow = row.amount > 0;
  const candidates = isInflow ? invoiceCandidates : supplierCandidates;
  const [selectedId, setSelectedId] = useState('');
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [qbDate, setQbDate] = useState(row.date);
  const [qbDesc, setQbDesc] = useState(row.description || '');
  const [qbSeries, setQbSeries] = useState('A');
  const [qbAccount, setQbAccount] = useState('');

  const lockedPeriod = findLockedVatPeriod(qbDate, vatPeriods);

  return (
    <div style={{ padding: '16px 20px', background: 'var(--bg-muted)', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {candidates.length > 0 && (
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            {isInflow ? 'Matcha mot kundfaktura' : 'Matcha mot leverantörsfaktura'}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...inp, width: '360px' }}>
              <option value="">Välj faktura...</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button
              disabled={!selectedId}
              onClick={() => isInflow ? onConfirmInvoiceMatch(selectedId) : onConfirmSupplierMatch(selectedId)}
              style={{ padding: '8px 16px', background: selectedId ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: selectedId ? 'pointer' : 'not-allowed' }}
            >
              <CheckCircle2 size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Bekräfta matchning
            </button>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Fakturan markeras betald med den här transaktionens datum ({formatDate(row.date)}), inte dagens.
          </p>
        </div>
      )}

      {candidates.length === 0 && !showQuickBook && (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>Ingen matchande obetald faktura hittades.</p>
      )}

      <div style={{ display: 'flex', gap: '8px', borderTop: candidates.length > 0 ? '1px solid var(--border-light)' : 'none', paddingTop: candidates.length > 0 ? '12px' : 0 }}>
        <button onClick={() => setShowQuickBook(v => !v)} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {showQuickBook ? 'Dölj bokföringsformulär' : 'Bokför direkt'}
        </button>
        <button onClick={onIgnore} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          Ignorera
        </button>
        {/* Ligger sist och längst till höger (marginLeft: auto) — det är den
            enda oåterkalleliga handlingen i raden, och ska inte sitta
            granne med de två vanliga. */}
        <button onClick={onDelete} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-red-text)', cursor: 'pointer' }}>
          <Trash2 size={13} /> Ta bort raden
        </button>
      </div>

      {showQuickBook && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
          {lockedPeriod && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: 'var(--status-amber-text)', lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Denna period är redan momsredovisad. Ändringar här kräver en separat rättelse hos Skatteverket.</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 70px', gap: '10px', marginBottom: '10px' }}>
            <div><label style={fieldLabel}>Datum</label><input type="date" value={qbDate} onChange={e => setQbDate(e.target.value)} style={inp} /></div>
            <div><label style={fieldLabel}>Beskrivning</label><input value={qbDesc} onChange={e => setQbDesc(e.target.value)} style={inp} /></div>
            <div><label style={fieldLabel}>Serie</label>
              <select value={qbSeries} onChange={e => setQbSeries(e.target.value)} style={{ ...inp, textAlign: 'center' }}>
                {['A', 'B', 'C'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>{isInflow ? 'Motkonto (kredit)' : 'Motkonto (debet)'} — {ledgerAccount} {isInflow ? 'debiteras' : 'krediteras'} automatiskt med {fmt(Math.abs(row.amount))} kr</label>
              <AccountSearch value={qbAccount} onChange={setQbAccount} accounts={accounts} placeholder="Sök konto..." />
            </div>
            <button
              disabled={!qbAccount || !qbDate}
              onClick={() => onQuickBook({ date: qbDate, description: qbDesc || row.description || 'Banktransaktion', series: qbSeries, counterAccount: qbAccount })}
              style={{ padding: '9px 18px', background: qbAccount ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: qbAccount ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
            >
              Bokför
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
// "Skandia" på sajten och sedan inte hittar den i modalen tappar
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
        <span style={{ flex: 1 }}>Så exporterar du från din bank</span>
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Välj din bank</span>
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
            {OTHER_BANK_HINT} Bokix läser filen oavsett vilken bank som skapade den — importen är en generell CSV- och Excel-läsare, inte en integration mot varje enskild bank. Det gäller även utländska konton.
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
              Hittar du inte knappen? Menyplaceringen kan ha ändrats sedan guiden skrevs — sök på "exportera" eller "kontoutdrag" i bankens egen hjälp.
            </p>
          </>
        ) : (
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '12px 0 0' }}>
            Klicka på din bank så visar vi var exportknappen brukar sitta. Har du en annan bank fungerar filen ändå — välj "Annan bank".
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


const STEP_LABELS = ['Fil', 'Kolumner', 'Förhandsgranskning'];

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
      setError(`"${file.name}" är inte en bankfil som kan läsas. Ladda upp CSV, TXT, XLSX eller XLS.`);
      return;
    }
    if (file.size > MAX_BANK_FILE_MB * 1024 * 1024) {
      setError(`"${file.name}" är för stor (max ${MAX_BANK_FILE_MB} MB).`);
      return;
    }
    setBusy(true); setError('');
    try {
      const mod = await loadBankModule();
      const { headers: h, rows, errors } = await mod.parseBankFile(file);
      if (!h.length || !rows.length) throw new Error('Kunde inte hitta några rader i filen. Kontrollera att den innehåller en rubrikrad.');
      setHeaders(h);
      setRawRows(rows);
      const fingerprint = mod.fingerprintHeaders(h);
      const remembered = bankImportProfiles?.[fingerprint];
      setMapping(remembered || mod.guessColumnMapping(h));
      if (errors.length) console.warn('CSV-tolkningsvarningar:', errors);
      setStep(1);
    } catch (e) {
      setError(e.message || 'Kunde inte läsa filen.');
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
      setError(e.message || 'Kunde inte tolka rader med den här mappningen.');
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
          <span className="modal-title">Importera banktransaktioner</span>
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
              <label style={fieldLabel}>Vilket bankkonto gäller importen?</label>
              {!showNewAccount ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inp, flex: 1 }}>
                    {bankAccountsList.map(a => <option key={a.id} value={a.id}>{a.name} (konto {a.ledgerAccount})</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewAccount(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Plus size={13} /> Nytt konto
                  </button>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder="Namn, t.ex. Sparkonto Handelsbanken" style={inp} autoFocus />
                  <input value={newAccountLedger} onChange={e => setNewAccountLedger(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="Bokförs mot konto, t.ex. 1931" style={inp} inputMode="numeric" />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => { setShowNewAccount(false); setNewAccountName(''); setNewAccountLedger(''); }} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Avbryt</button>
                    <button type="button" disabled={!newAccountName.trim() || !newAccountLedger} onClick={handleCreateAccountInline} style={{ padding: '7px 14px', background: (newAccountName.trim() && newAccountLedger) ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: (newAccountName.trim() && newAccountLedger) ? 'pointer' : 'not-allowed' }}>Lägg till och välj</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!hasChoice && (
            <button type="button" onClick={() => setShowNewAccount(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px', padding: 0, background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Plus size={12} /> Fler bankkonton? Lägg till ett innan du importerar
            </button>
          )}
          {!hasChoice && showNewAccount && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder="Namn, t.ex. Sparkonto Handelsbanken" style={inp} autoFocus />
              <input value={newAccountLedger} onChange={e => setNewAccountLedger(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="Bokförs mot konto, t.ex. 1931" style={inp} inputMode="numeric" />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowNewAccount(false); setNewAccountName(''); setNewAccountLedger(''); }} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Avbryt</button>
                <button type="button" disabled={!newAccountName.trim() || !newAccountLedger} onClick={handleCreateAccountInline} style={{ padding: '7px 14px', background: (newAccountName.trim() && newAccountLedger) ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: (newAccountName.trim() && newAccountLedger) ? 'pointer' : 'not-allowed' }}>Lägg till och välj</button>
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
              {busy ? 'Läser filen...' : 'Ladda upp kontoutdrag'}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>Dra och släpp filen här, eller klicka för att välja</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>CSV, TXT, XLSX eller XLS (max {MAX_BANK_FILE_MB} MB) — exporterat från er internetbank</p>
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
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Tillbaka</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Avbryt</button>
          {step === 1 && (
            <button disabled={busy || !mapping.date || !mapping.description} onClick={handleBuildPreview} style={{ padding: '9px 18px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
              Förhandsgranska
            </button>
          )}
          {step === 2 && (
            <button disabled={busy || preview.toImport.length === 0} onClick={handleCommit} style={{ padding: '9px 18px', background: preview.toImport.length ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: (busy || !preview.toImport.length) ? 'not-allowed' : 'pointer' }}>
              Importera {preview.toImport.length} transaktioner
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const MAPPING_FIELDS = [
  { key: 'date', label: 'Datum', required: true },
  { key: 'description', label: 'Beskrivning', required: true },
  { key: 'balanceColumn', label: 'Saldo (valfritt)' },
  { key: 'referenceColumn', label: 'Referens / OCR (valfritt)' },
];

function MappingStep({ headers, mapping, setMapping, sampleRow }) {
  const set = (patch) => setMapping(m => ({ ...m, ...patch }));
  return (
    <div>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        Bokix har försökt gissa vilka kolumner som är vilka — kontrollera och rätta vid behov innan förhandsgranskning.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <label style={fieldLabel}>Datum</label>
          <select value={mapping.date} onChange={e => set({ date: e.target.value })} style={inp}>
            <option value="">Välj kolumn...</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>Beskrivning</label>
          <select value={mapping.description} onChange={e => set({ description: e.target.value })} style={inp}>
            <option value="">Välj kolumn...</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>

        <div>
          <label style={fieldLabel}>Belopp</label>
          <div style={{ display: 'flex', gap: '14px', marginBottom: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="radio" checked={mapping.amountMode === 'single'} onChange={() => set({ amountMode: 'single' })} /> En kolumn (+/-)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="radio" checked={mapping.amountMode === 'split'} onChange={() => set({ amountMode: 'split' })} /> Uttag + Insättning separat
            </label>
          </div>
          {mapping.amountMode === 'single' ? (
            <select value={mapping.amountColumn} onChange={e => set({ amountColumn: e.target.value })} style={inp}>
              <option value="">Välj kolumn...</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={mapping.debitColumn} onChange={e => set({ debitColumn: e.target.value })} style={inp}>
                <option value="">Uttag-kolumn...</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <select value={mapping.creditColumn} onChange={e => set({ creditColumn: e.target.value })} style={inp}>
                <option value="">Insättning-kolumn...</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={mapping.invertSign} onChange={e => set({ invertSign: e.target.checked })} />
            Vänd tecken (om insättningar visas som negativa/uttag som positiva hos er bank)
          </label>
        </div>

        {MAPPING_FIELDS.filter(f => !f.required).map(f => (
          <div key={f.key}>
            <label style={fieldLabel}>{f.label}</label>
            <select value={mapping[f.key] || ''} onChange={e => set({ [f.key]: e.target.value })} style={inp}>
              <option value="">Ingen</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>

      {sampleRow && (
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', background: 'var(--bg-muted)', borderRadius: '6px', padding: '8px 10px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <HelpCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Exempel från första raden: {headers.map(h => `${h}=${sampleRow[h]}`).join(', ')}</span>
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
        <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontWeight: 700 }}>{toImport.length} nya</span>
        {alreadyImported.length > 0 && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-gray-bg)', color: 'var(--status-gray-text)', fontWeight: 700 }}>{alreadyImported.length} redan importerade (hoppas över)</span>}
        {errors.length > 0 && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', fontWeight: 700 }}>{errors.length} rader kunde inte tolkas</span>}
      </div>
      <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)', position: 'sticky', top: 0 }}>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Datum</th>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Beskrivning</th>
              <th style={{ textAlign: 'right', padding: '8px 10px' }}>Belopp</th>
            </tr>
          </thead>
          <tbody>
            {toImport.slice(0, 200).map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: '7px 10px', color: 'var(--text-main)' }}>{formatDate(r.date)}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-main)' }}>{r.description}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: r.amount > 0 ? 'var(--status-green-text)' : 'var(--text-main)', fontWeight: 600 }}>{fmt(r.amount)} kr</td>
              </tr>
            ))}
          </tbody>
        </table>
        {toImport.length > 200 && <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>+ {toImport.length - 200} till...</div>}
      </div>
    </div>
  );
}
