import React, { useState, useMemo } from 'react';
import {
  Upload, UploadCloud, AlertCircle, CheckCircle2, X, ChevronDown, ChevronRight,
  Landmark, ArrowDownCircle, ArrowUpCircle, HelpCircle, Search,
} from 'lucide-react';
import ListPageHeader, { ListFilterBar, listSearchInputStyle, listFilterFieldStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { AccountSearch } from './shared/SearchInputs';
import { confirmDialog } from './shared/ConfirmDialog';
import { findLockedVatPeriod } from '../utils/vatCalculation';
import { BRAND } from '../utils/brandColors';

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
  invoices = [],
  expenses = [],
  contacts = [],
  accounts = [],
  verifications = [],
  vatPeriods,
  onSetBankTransactions,
  onUpdateCompany,
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

  const filtered = useMemo(() => {
    return (bankTransactions || [])
      .filter(t => activeTab === 'all' || t.status === activeTab)
      .filter(t => !dateFrom || t.date >= dateFrom)
      .filter(t => !dateTo || t.date <= dateTo)
      .filter(t => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return t.description?.toLowerCase().includes(q) || String(t.amount).includes(q) || t.reference?.toLowerCase().includes(q);
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [bankTransactions, activeTab, dateFrom, dateTo, search]);

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
  const handleImportCommit = (rows) => {
    onSetBankTransactions(prev => [...prev, ...rows]);
    if (rows.length) {
      const earliest = rows.reduce((min, r) => (!min || r.date < min) ? r.date : min, null);
      if (earliest && (!dateFrom || earliest < dateFrom)) setDateFrom(earliest);
      setActiveTab('unmatched');
    }
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
    onRegisterInvoicePayment(invoiceId, Math.abs(row.amount), row.date);
    updateRow(row.id, { status: 'matched', matchedType: 'invoice', matchedId: invoiceId, verificationSource: 'invoice_payment' });
    setExpandedId(null);
  };

  const handleConfirmSupplierMatch = (row, expenseId) => {
    if (!expenseId) return;
    onMarkSupplierInvoicePaid(expenseId, 'bank', row.date);
    updateRow(row.id, { status: 'matched', matchedType: 'supplier_invoice', matchedId: expenseId, verificationSource: 'supplier_invoice_payment' });
    setExpandedId(null);
  };

  const handleQuickBook = (row, { date, description, series, counterAccount }) => {
    const number = getNextSeriesNumber(verifications, series);
    const amount = Math.round(Math.abs(row.amount));
    const isInflow = row.amount > 0;
    onAddVerification({
      number,
      date,
      description,
      source: 'bank_import',
      sourceId: row.id,
      rows: isInflow
        ? [{ account: '1930', debet: amount, kredit: 0 }, { account: counterAccount, debet: 0, kredit: amount }]
        : [{ account: counterAccount, debet: amount, kredit: 0 }, { account: '1930', debet: 0, kredit: amount }],
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
        onClear={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
        count={filtered.length}
        countLabel="transaktioner"
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
            rows={filtered}
            onRowClick={t => t.status === 'unmatched' && setExpandedId(expandedId === t.id ? null : t.id)}
            isExpanded={t => expandedId === t.id}
            renderExpanded={t => (
              <BankRowDetail
                row={t}
                invoiceCandidates={invoiceCandidates(invoices, contacts)}
                supplierCandidates={supplierInvoiceCandidates(expenses, contacts)}
                accounts={accounts}
                vatPeriods={vatPeriods}
                onConfirmInvoiceMatch={id => handleConfirmInvoiceMatch(t, id)}
                onConfirmSupplierMatch={id => handleConfirmSupplierMatch(t, id)}
                onQuickBook={form => handleQuickBook(t, form)}
                onIgnore={() => handleIgnore(t)}
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
                    {t.reference && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Ref: {t.reference}</div>}
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
          />
        )}
      </div>

      {showImportModal && (
        <ImportWizardModal
          bankTransactions={bankTransactions}
          bankImportProfiles={bankImportProfiles}
          onUpdateCompany={onUpdateCompany}
          onImport={handleImportCommit}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}

// ── Radexpansion: matchningsförslag + "Bokför direkt" + "Ignorera" ───────
function BankRowDetail({ row, invoiceCandidates, supplierCandidates, accounts, vatPeriods, onConfirmInvoiceMatch, onConfirmSupplierMatch, onQuickBook, onIgnore }) {
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
              <label style={fieldLabel}>{isInflow ? 'Motkonto (kredit)' : 'Motkonto (debet)'} — 1930 {isInflow ? 'debiteras' : 'krediteras'} automatiskt med {fmt(Math.abs(row.amount))} kr</label>
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
const STEP_LABELS = ['Fil', 'Kolumner', 'Förhandsgranskning'];

function ImportWizardModal({ bankTransactions, bankImportProfiles, onUpdateCompany, onImport, onClose }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [bankMod, setBankMod] = useState(null); // lazy-laddad src/utils/bankImport.js
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [preview, setPreview] = useState(null); // { toImport, alreadyImported, errors }

  const loadBankModule = async () => {
    if (bankMod) return bankMod;
    const mod = await import('../utils/bankImport.js');
    setBankMod(mod);
    return mod;
  };

  const handleFile = async (file) => {
    if (!file) return;
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
      const { toImport, alreadyImported } = mod.dedupeAgainstExisting(rows, bankTransactions);
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
      const records = mod.buildBankTransactionRecords(preview.toImport, batchId);
      onImport(records);
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
            <input type="file" id="bank-import-file" style={{ display: 'none' }} accept=".csv,.xlsx,.xls" disabled={busy} onChange={e => handleFile(e.target.files?.[0])} />
            <div style={{ width: 44, height: 44, borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <UploadCloud size={20} color={BRAND.greenDark} />
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', margin: '0 0 4px' }}>
              {busy ? 'Läser filen...' : 'Ladda upp kontoutdrag'}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>Dra och släpp filen här, eller klicka för att välja</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>CSV, XLSX eller XLS — exporterat från er internetbank</p>
          </div>
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
