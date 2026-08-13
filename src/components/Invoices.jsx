import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, X, Send, Check, FileText, FileSpreadsheet,
  Search, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  MoreVertical, RefreshCw, Printer, Eye, CreditCard,
  MessageSquare, Tag, Lock, Settings2, Download, AlertTriangle, Inbox
} from 'lucide-react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import InvoiceDocument, { DEFAULT_INVOICE_TEMPLATE } from './InvoiceDocument';
import { exportInvoicePdf } from '../utils/exportInvoicePdf';
import { BRAND } from '../utils/brandColors';

const newRowId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const withRowIds = (rows) => rows.map(r => ({ id: r.id || newRowId(), ...r }));

const grossOf = (inv) => inv.rows?.reduce((a, r) => a + r.qty * r.unitPrice * (1 + r.vatRate / 100), 0) || inv.amount || 0;

/**
 * Nästa fakturanummer i serien. `company.nextInvoiceNumber` (satt under
 * Inställningar → Betalning och faktura) fungerar bara som ett GOLV — det
 * kan höja startnumret (t.ex. vid byte från ett annat system), men aldrig
 * sänka det under vad som redan är använt. Det gör inställningen kollisions-
 * säker på datanivå, inte bara via ett fält som validerar i UI:t och sedan
 * kan kringgås.
 */
function getNextInvoiceNumber(invoiceList, company) {
  const nums = invoiceList.map(i => Number(i.invoiceNumber)).filter(n => !isNaN(n));
  const auto = nums.length > 0 ? Math.max(...nums) + 1 : 1001;
  const floor = Number(company?.nextInvoiceNumber) || 0;
  return String(Math.max(auto, floor));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (val) =>
  new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

const isOverdue = (inv) =>
  inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date();

function getRowBg(status) {
  if (status === 'paid') return BRAND.greenLight;   // betald
  if (status === 'overdue') return BRAND.redBg;     // förfallen
  if (status === 'sent') return BRAND.amberBg;      // obetald, inte förfallen än
  if (status === 'draft') return BRAND.grayBg;      // ej bokförd/skickad än
  return '#ffffff';
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().split('T')[0];
}

/** Öppnar användarens eget e-postprogram med en förifylld påminnelse —
 * appen har ingen egen mejlutskicksfunktion (inget e-posttjänst är kopplat),
 * så det här är den ärliga vägen: vi skickar aldrig något "tyst" å
 * användarens vägnar, bara öppnar ett färdigskrivet utkast att granska och
 * skicka själv. */
function buildReminderMailto(inv, customer) {
  const subject = encodeURIComponent(`Betalningspåminnelse – faktura ${inv.invoiceNumber}`);
  const body = encodeURIComponent(
    `Hej${customer?.contactPerson ? ' ' + customer.contactPerson : ''},\n\n` +
    `Vi vill påminna om faktura ${inv.invoiceNumber} på ${fmt(grossOf(inv))} kr, som förföll ${formatDate(inv.dueDate)}.\n\n` +
    `Hör av dig om du redan betalat eller har frågor.\n\nMed vänlig hälsning`
  );
  return `mailto:${customer?.email || ''}?subject=${subject}&body=${body}`;
}

// ─── Collapsible Section ───────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #ddd' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', background: '#f5f5f5',
          border: 'none', padding: '6px 12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '12px', fontWeight: 700, color: '#333', userSelect: 'none'
        }}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {title}
      </button>
      {open && <div style={{ padding: '12px 16px', background: 'white' }}>{children}</div>}
    </div>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────────────────
const inp = {
  padding: '4px 8px', border: '1px solid #bbb', borderRadius: '3px',
  fontSize: '13px', outline: 'none', fontFamily: 'inherit', width: '100%',
  boxSizing: 'border-box', background: 'white'
};
const lbl = { display: 'block', fontSize: '11px', color: '#666', marginBottom: '2px' };
const cell = (w) => ({ display: 'inline-block', width: w, verticalAlign: 'top', paddingRight: '8px', boxSizing: 'border-box' });

// ─── Invoice Full Form (Fortnox-inspired) ──────────────────────────────────────
function InvoiceForm({ contacts, onSave, onClose, initial, company, invoiceList, onCreateCreditNote, onMarkPaid, onRegisterPayment, onUnmarkPaid, onUpdateNote, verifications = [], nav }) {
  // En bokförd faktura (allt utom utkast) får inte längre ändra belopp/rader/kund —
  // korrigeringar sker via kreditfaktura. Datum och kommentar går fortfarande att ändra.
  const isLocked = Boolean(initial) && (initial.status || 'draft') !== 'draft';

  const [customerId, setCustomerId] = useState(initial?.customerId || '');
  const [invoiceDate, setInvoiceDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    if (initial?.dueDate) return initial.dueDate;
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [rows, setRows] = useState(() => withRowIds(initial?.rows || [
    { description: '', qty: 1, unitPrice: 0, vatRate: 25, discount: 0, account: '3001' }
  ]));
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRowAdvanced = (id) => setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [ourRef, setOurRef] = useState(initial?.ourRef || '');
  const [theirRef, setTheirRef] = useState(initial?.theirRef || '');
  const [ourOrderNr, setOurOrderNr] = useState(initial?.ourOrderNr || '');
  const [invoiceType, setInvoiceType] = useState('Faktura');
  const [terms, setTerms] = useState('30 dagar');
  const [currency, setCurrency] = useState('SEK');
  const [invoiceText, setInvoiceText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const previewRef = useRef(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentDraft, setCommentDraft] = useState(initial?.internalNote || '');
  const [showPaymentBox, setShowPaymentBox] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentDateInput, setPaymentDateInput] = useState(() => new Date().toISOString().split('T')[0]);

  const customers = contacts.filter(c => c.type === 'customer' || !c.type);
  const customer = customers.find(c => c.id === customerId);

  // Verifikationsnumret hämtas från den riktiga bokförda verifikationen
  // (skapas automatiskt när fakturan sparas) — inte det hårdkodade "$v"-
  // platshållartecknet som stod här innan och aldrig ersattes med något.
  const linkedVerification = initial?.id ? verifications.find(v => v.source === 'invoice' && v.sourceId === initial.id) : null;

  const nextNum = initial?.invoiceNumber || getNextInvoiceNumber(invoiceList, company);
  const ocr = nextNum.padStart(7, '0');

  const addRow = () => setRows(r => [...r, { id: newRowId(), description: '', qty: 1, unitPrice: 0, vatRate: 25, discount: 0, account: '3001' }]);
  const updateRow = (i, field, val) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));

  const calcRow = (r) => {
    const gross = r.qty * r.unitPrice * (1 - (r.discount || 0) / 100);
    return { net: gross, vat: gross * (r.vatRate / 100), total: gross * (1 + r.vatRate / 100) };
  };

  const totals = rows.reduce((acc, r) => {
    const c = calcRow(r);
    return { net: acc.net + c.net, vat: acc.vat + c.vat, total: acc.total + c.total };
  }, { net: 0, vat: 0, total: 0 });

  const alreadyPaid = initial?.paidAmount || 0;
  const remainingDue = Math.max(0, totals.total - alreadyPaid);

  // Fylla i betalningsformuläret med rimliga defaults (hela kvarvarande
  // beloppet, dagens datum) varje gång det öppnas.
  useEffect(() => {
    if (showPaymentBox) {
      setPaymentAmountInput(remainingDue > 0 ? String(Math.round(remainingDue)) : '');
      setPaymentDateInput(new Date().toISOString().split('T')[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentBox]);

  // Bugkritiskt (Sida 24): mallval/accentfärg/logotyp/fottext fryses på
  // fakturan första gången den sparas (utkast eller skickad) — annars skulle
  // ett senare mallbyte i Inställningar retroaktivt ändra utseendet på redan
  // skickade fakturor. Finns redan en snapshot (fakturan är sparad sedan
  // tidigare) återanvänds den oförändrad; annars fångas företagets NUVARANDE
  // inställningar en gång.
  const invoiceTemplateSnapshot = initial?.invoiceTemplateSnapshot || {
    templateId: company?.invoiceTemplateId || DEFAULT_INVOICE_TEMPLATE,
    accentColor: company?.invoiceAccentColor || '',
    logoUrl: company?.logoUrl || '',
    footerText: company?.invoiceFooterText || '',
  };

  const handleSave = (status = 'draft') => {
    // internalNote skickas alltid med här (inte bara via popoverns egen
    // "Spara"-knapp) så en kommentar man skrivit på en NY, ännu osparad
    // faktura faktiskt följer med — annars gick den förlorad eftersom
    // Kommentar-knappen tidigare var helt avstängd innan första sparningen.
    onSave({ customerId, date: invoiceDate, dueDate, rows, status, type: 'invoice', invoiceNumber: nextNum, ourRef, theirRef, ourOrderNr, internalNote: commentDraft, invoiceTemplateSnapshot });
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true); setPdfError('');
    try {
      if (!showPreview) setShowPreview(true);
      // Vänta en tick så förhandsgranskningen hinner monteras innan vi fångar den.
      await new Promise(r => setTimeout(r, 50));
      await exportInvoicePdf(previewRef.current, `faktura-${nextNum}.pdf`);
    } catch (err) {
      console.error(err);
      setPdfError('Kunde inte skapa PDF. Försök igen.');
    } finally {
      setPdfBusy(false);
    }
  };

  // Egen klickyta per knapp med luft runt om (padding + avrundning), inte
  // bara en tunn kantlinje mot grannknappen — annars är det för lätt att
  // klicka fel. Mellanrummet mellan knapparna sätts på den omslutande raden.
  const topBarBtn = (label, icon, onClick, style = {}, disabled = false, title) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} title={title} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '7px 10px', background: 'none', border: 'none', borderRadius: '5px',
      fontSize: '12px', fontWeight: 500, color: disabled ? '#bbb' : '#333', cursor: disabled ? 'not-allowed' : 'pointer',
      whiteSpace: 'nowrap', alignSelf: 'center', ...style
    }}>
      {icon}{label}
    </button>
  );

  const thSt = {
    padding: '4px 6px', fontSize: '11px', fontWeight: 700, color: '#555',
    background: '#f5f5f5', borderBottom: '1px solid #ccc', borderRight: '1px solid #e0e0e0',
    whiteSpace: 'nowrap', textAlign: 'left'
  };
  const tdSt = {
    padding: '2px 4px', borderBottom: '1px solid #eee', borderRight: '1px solid #e8e8e8',
    verticalAlign: 'middle'
  };
  const tdInp = {
    ...inp, border: 'none', padding: '3px 4px', borderRadius: 0,
    background: 'transparent', fontSize: '12px'
  };

  return (
    <div style={{
      flex: 1, minHeight: 0, background: '#f0f2f5',
      display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif',
      animation: 'fadeIn 0.15s ease'
    }}>

      {/* ── Top Navigation Bar ───────────────────────────────── */}
      {/* Mer luft i höjd (padding) + en tydlig grupp-gräns (marginLeft på
          höger knappgrupp) mellan "vad det här är" (tillbaka + identifierare)
          och "vad man kan göra med det" (bläddring + spara-knapparna),
          istället för att allt satt på en enda tät rad. */}
      <div style={{ background: '#f5f5f5', borderBottom: '1px solid #ccc', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
          ← Tillbaka
        </button>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#333' }}>
          KUNDFAKTURA {nextNum}*
        </span>
        <span style={{ fontSize: '11px', color: '#888' }}>OCR: {ocr}*</span>
        <span style={{ fontSize: '11px', color: '#888' }}>VER.NR: {linkedVerification?.number || '—'}</span>
        {isLocked && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '4px', padding: '2px 8px' }}>
            <Lock size={11} /> Bokförd
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Navigation — bläddrar genom samma lista man kom ifrån */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {[
            { s: '«', onClick: nav?.first, enabled: nav?.hasPrev, title: 'Första fakturan' },
            { s: '‹', onClick: nav?.prev, enabled: nav?.hasPrev, title: 'Föregående faktura' },
            { s: '›', onClick: nav?.next, enabled: nav?.hasNext, title: 'Nästa faktura' },
            { s: '»', onClick: nav?.last, enabled: nav?.hasNext, title: 'Sista fakturan' },
          ].map(({ s, onClick, enabled, title }) => (
            <button
              key={s} disabled={!enabled} onClick={onClick} title={title}
              style={{ padding: '3px 7px', background: 'white', border: '1px solid #ccc', borderRadius: '3px', cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '13px', color: enabled ? '#333' : '#ccc' }}
            >{s}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginLeft: '10px', paddingLeft: '10px', borderLeft: '1px solid #ddd' }}>
          <button
            onClick={() => handleSave('sent')}
            style={{ padding: '5px 14px', background: '#3d7a2e', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
          >
            ✓ Skapa faktura
          </button>
          <button
            onClick={onClose}
            style={{ padding: '5px 14px', background: '#2e7d32', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
          >
            Visa lista
          </button>
        </div>
      </div>

      {/* ── Action Toolbar ────────────────────────────────────── */}
      {/* Skapa kreditfaktura/Kopiera/Kreditupplysning/Periodering borttagna
          härifrån på användarens begäran — kreditfaktura görs fortfarande
          via länken i den gula bokförd-banderollen nedan när det är relevant,
          resten var antingen sällan använt eller (Kreditupplysning/
          Periodering) permanent inaktiverat utan verklig funktion bakom.
          Knapparna har nu ett tydligt mellanrum (gap) sinsemellan istället
          för att bara skiljas åt av en tunn kantlinje — annars är det för
          lätt att klicka fel på grannknappen. */}
      <div style={{ background: 'white', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'stretch', gap: '10px', padding: '0 10px', flexShrink: 0, overflowX: 'auto', position: 'relative' }}>
        {topBarBtn('Registrera betalning', <CreditCard size={13} />, () => setShowPaymentBox(v => !v), { color: showPaymentBox ? '#1565c0' : '#333' }, !initial, !initial ? 'Spara fakturan först' : undefined)}
        {topBarBtn(
          'Markera som obetald',
          <Tag size={13} />,
          () => { if (window.confirm(`Markera faktura ${nextNum} som obetald? Den registrerade betalningen tas bort.`)) onUnmarkPaid?.(initial.id); },
          { color: '#333' },
          !initial || initial?.status !== 'paid',
          !initial ? 'Spara fakturan först' : (initial?.status !== 'paid' ? 'Fakturan är inte markerad som betald' : 'Ångrar den registrerade betalningen')
        )}
        {topBarBtn('Kommentar', <MessageSquare size={13} />, () => setShowCommentBox(v => !v), { color: showCommentBox ? '#1565c0' : (commentDraft ? '#92400e' : '#333') })}
        <div style={{ flex: 1 }} />
        {pdfError && <span style={{ fontSize: '11px', color: '#c00', alignSelf: 'center', marginRight: 8 }}>{pdfError}</span>}
        {topBarBtn(pdfBusy ? 'Skapar PDF…' : 'Ladda ner PDF', <Download size={13} />, handleDownloadPdf, { borderLeft: '1px solid #ddd', paddingLeft: '14px' }, pdfBusy)}
        {topBarBtn('Förhandsgranska', <Eye size={13} />, () => setShowPreview(v => !v), { color: showPreview ? '#1565c0' : '#333' })}
      </div>

      {/* Betalning och Kommentar renderas som riktiga skärmcentrerade modaler
          (samma .modal-overlay/.modal-content-mönster som resten av appen)
          istället för som en position:absolute-popover inuti åtgärdsraden.
          Åtgärdsraden har overflow-x:auto (för att knapparna ska kunna
          scrolla på smala skärmar), vilket gör att overflow-y implicit också
          klipps — en popover ankrad där syntes därför aldrig, den klipptes
          bort av sin egen förälder. En modal längst ut i trädet kan inte
          klippas av något. */}
      {showPaymentBox && initial && (
        <div className="modal-overlay" onClick={() => setShowPaymentBox(false)}>
          <div className="modal-content" style={{ maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrera betalning</h2>
              <button className="modal-close" onClick={() => setShowPaymentBox(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 4px' }}>
              {(initial.status === 'paid') ? (
                <div style={{ fontSize: '13px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> Betald {initial.paidDate ? formatDate(initial.paidDate) : ''}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>Totalt: {fmt(totals.total)} kr</div>
                  {alreadyPaid > 0 && (
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>Redan betalt: {fmt(alreadyPaid)} kr</div>
                  )}
                  <div style={{ fontSize: '13px', color: '#92400e', fontWeight: 600, marginBottom: '14px' }}>Kvar att betala: {fmt(remainingDue)} kr</div>

                  <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>Belopp (kr)</label>
                  <input
                    type="number" min="0" max={remainingDue} step="0.01"
                    value={paymentAmountInput} onChange={e => setPaymentAmountInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #bbb', borderRadius: '6px', fontSize: '14px', color: '#111827', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>Datum</label>
                  <input
                    type="date"
                    value={paymentDateInput} onChange={e => setPaymentDateInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #bbb', borderRadius: '6px', fontSize: '14px', color: '#111827', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />

                  <button
                    onClick={() => {
                      const amount = parseFloat(paymentAmountInput);
                      if (!amount || amount <= 0) return;
                      onRegisterPayment?.(initial.id, amount, paymentDateInput);
                      setShowPaymentBox(false);
                    }}
                    disabled={!paymentAmountInput || Number(paymentAmountInput) <= 0}
                    style={{
                      width: '100%', padding: '9px 12px', background: (!paymentAmountInput || Number(paymentAmountInput) <= 0) ? '#a7d8a7' : '#22c55e',
                      color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700,
                      cursor: (!paymentAmountInput || Number(paymentAmountInput) <= 0) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Registrera betalning
                  </button>
                  {Number(paymentAmountInput) > 0 && Number(paymentAmountInput) < remainingDue && (
                    <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '10px' }}>Detta bokförs som en delbetalning — fakturan blir inte markerad som helt betald.</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCommentBox && (
        <div className="modal-overlay" onClick={() => setShowCommentBox(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Intern kommentar</h2>
              <button className="modal-close" onClick={() => setShowCommentBox(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 4px' }}>
              {/* Bugkritiskt: textarean saknade explicit textfärg och ärvde den
                  (i vissa sammanhang) från en förälder istället för att alltid
                  garantera synlig, mörk text — skrev man i fältet syntes inget.
                  Placeholder sätts uttryckligen ljusare via CSS-klassen nedan
                  så de två aldrig kan förväxlas. */}
              <textarea
                autoFocus
                className="invoice-comment-textarea"
                value={commentDraft} onChange={e => setCommentDraft(e.target.value)}
                placeholder="Syns bara internt, inte för kunden."
                style={{ width: '100%', minHeight: '140px', padding: '10px 12px', border: '1px solid #bbb', borderRadius: '6px', fontSize: '14px', lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', color: '#111827', background: 'white' }}
              />
              {!initial && <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '6px' }}>Sparas tillsammans med fakturan.</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                <button onClick={() => setShowCommentBox(false)} style={{ padding: '8px 14px', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Stäng</button>
                <button
                  onClick={() => { if (initial) onUpdateNote?.(initial.id, commentDraft); setShowCommentBox(false); }}
                  style={{ padding: '8px 16px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {initial ? 'Spara kommentar' : 'Klart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLocked && (
        <div style={{ background: '#fff8e1', borderBottom: '1px solid #ffe0b2', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: '#7c4a03', flexShrink: 0 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            Den här fakturan är bokförd — kund, belopp och rader kan inte längre ändras. Behöver du korrigera ett fel?{' '}
            <button onClick={() => { if (window.confirm(`Skapa en kreditfaktura som motsvarar faktura ${nextNum}?`)) onCreateCreditNote?.(initial); }} style={{ background: 'none', border: 'none', color: '#92400e', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Skapa en kreditfaktura</button>
            {' '}istället. Datum och kommentar går fortfarande att uppdatera.
          </span>
        </div>
      )}

      {/* ── Main Body ─────────────────────────────────────────── */}
      {/* Formuläret täcker hela sidan (fyller hela höjden och bredden av
          innehållsytan) istället för att vara ett smalt kort med synlig grå
          bakgrund runt om — samma "hela vägen ner"-princip som redan gäller
          för sidans övriga vita ytor, bara konsekvent applicerad på
          formulärkolumnen som helhet, inte bara var och en av dess sektioner
          för sig. */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', background: 'white' }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

          {/* Top fields row — bara de fält som alltid behövs */}
          <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '16px 20px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '18px', alignItems: 'end' }}>
            <div>
              <label style={lbl}>Kund</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} disabled={isLocked} style={{ ...inp, background: isLocked ? '#f3f4f6' : 'white' }}>
                <option value="">Välj kund...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.id?.slice(-3)} – {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Fakturadatum</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Förfallodatum *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Fakturatyp</label>
              <div style={{ display: 'flex', border: '1px solid #bbb', borderRadius: '3px', overflow: 'hidden', opacity: isLocked ? 0.6 : 1 }}>
                {['Faktura', 'Kontantfaktura'].map(t => (
                  <button key={t} disabled={isLocked} onClick={() => setInvoiceType(t)} style={{
                    flex: 1, padding: '4px 6px', border: 'none', fontSize: '12px', cursor: isLocked ? 'not-allowed' : 'pointer',
                    background: invoiceType === t ? '#3d7a2e' : 'white',
                    color: invoiceType === t ? 'white' : '#333', fontWeight: invoiceType === t ? 700 : 400
                  }}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Fakturauppgifter — bara de vanligaste fälten synliga direkt */}
          <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
            <div>
              <label style={lbl}>Betalningsvillkor</label>
              <select value={terms} onChange={e => setTerms(e.target.value)} style={inp}>
                {['0 dagar', '10 dagar', '20 dagar', '30 dagar', '60 dagar'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Vår referens</label>
              <input value={ourRef} onChange={e => setOurRef(e.target.value)} style={inp} placeholder="Emma Johansson" />
            </div>
            <div>
              <label style={lbl}>Er referens</label>
              <input value={theirRef} onChange={e => setTheirRef(e.target.value)} style={inp} placeholder="Johan Svensson" />
            </div>
          </div>

          {/* Fler alternativ — sällan använda fält, dolda tills man behöver dem */}
          <div style={{ borderBottom: '1px solid #ddd' }}>
            <button
              onClick={() => setShowMoreOptions(v => !v)}
              style={{
                width: '100%', textAlign: 'left', background: '#f5f5f5', border: 'none', padding: '6px 12px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#333',
              }}
            >
              {showMoreOptions ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Fler alternativ
            </button>
            {showMoreOptions && (
              <div style={{ padding: '12px 16px', background: 'white', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div>
                  <label style={lbl}>Husavdrag</label>
                  <select style={inp}><option>Inget</option><option>ROT</option><option>RUT</option></select>
                </div>
                <div>
                  <label style={lbl}>Kostnadsställe (Ks)</label>
                  <input style={inp} placeholder="Kost. Beteckning" />
                </div>
                <div>
                  <label style={lbl}>Prislista</label>
                  <select style={inp}><option>Prislista A</option><option>Prislista B</option></select>
                </div>
                <div>
                  <label style={lbl}>Ert ordernummer</label>
                  <input value={ourOrderNr} onChange={e => setOurOrderNr(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Projekt (P)</label>
                  <input style={inp} placeholder="Projekt, Benämning, Projektledare" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={lbl}>Pris inkl. moms</label>
                  <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                    {['Ja', 'Nej'].map(v => (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                        <input type="radio" name="priceInclVat" value={v} defaultChecked={v === 'Nej'} /> {v}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Valuta</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} style={inp}>
                    {['SEK', 'EUR', 'USD', 'GBP'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Kurs</label>
                  <input defaultValue="1" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Enhet</label>
                  <input defaultValue="1" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Etiketter</label>
                  <input style={inp} placeholder="Lägg till etikett..." />
                </div>
              </div>
            )}
          </div>

          {/* Kunduppgifter */}
          {customer && (
            <Section title="▾ Kunduppgifter" defaultOpen={false}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div>
                  <label style={lbl}>Namn</label>
                  <input defaultValue={customer.name} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Fakturaadress</label>
                  <input defaultValue={customer.address || ''} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Postnr</label>
                  <input style={inp} />
                </div>
                <div>
                  <label style={lbl}>Ort</label>
                  <input style={inp} />
                </div>
                <div>
                  <label style={lbl}>Organisationsnummer</label>
                  <input defaultValue={customer.orgNr || ''} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Telefon</label>
                  <input defaultValue={customer.phone || ''} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Land</label>
                  <select style={inp}><option>Sverige</option><option>Norge</option><option>Danmark</option></select>
                </div>
                <div style={{ paddingTop: '18px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" /> Export
                  </label>
                </div>
              </div>
            </Section>
          )}

          {/* Leveransuppgifter */}
          <Section title="▾ Leveransuppgifter" defaultOpen={false}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div><label style={lbl}>Leveransadress</label><input style={inp} /></div>
              <div><label style={lbl}>Leveransort</label><input style={inp} /></div>
              <div><label style={lbl}>Leveransdatum</label><input type="date" style={inp} /></div>
              <div><label style={lbl}>Leveranssätt</label><input style={inp} /></div>
            </div>
          </Section>

          {/* Article Rows Table — 5 kolumner synliga, avancerade fält bakom kugghjulet.
              Egen ram + rundade hörn så tabellen läses som en tydligt
              avgränsad yta, istället för att bara flyta in i fälten runt om. */}
          <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '4px 20px 16px' }}>
            <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={thSt}>BENÄMNING</th>
                    <th style={{ ...thSt, width: 60, textAlign: 'right' }}>ANTAL</th>
                    <th style={{ ...thSt, width: 90, textAlign: 'right' }}>À-PRIS</th>
                    <th style={{ ...thSt, width: 55, textAlign: 'right' }}>MOMS</th>
                    <th style={{ ...thSt, width: 90, textAlign: 'right' }}>SUMMA</th>
                    <th style={{ ...thSt, width: 30 }}></th>
                    <th style={{ ...thSt, width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const { net } = calcRow(row);
                    const advancedOpen = expandedRows.has(row.id);
                    return (
                      <React.Fragment key={row.id}>
                        <tr style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={tdSt}>
                            {isLocked ? (
                              <span style={{ padding: '3px 4px', display: 'block' }}>{row.description}</span>
                            ) : (
                              <input
                                value={row.description}
                                onChange={e => updateRow(i, 'description', e.target.value)}
                                style={{ ...tdInp, width: '100%' }}
                                placeholder="Beskrivning av tjänst eller produkt"
                              />
                            )}
                          </td>
                          <td style={{ ...tdSt, textAlign: 'right' }}>
                            {isLocked ? row.qty : (
                              <input type="number" value={row.qty} onChange={e => updateRow(i, 'qty', Number(e.target.value))} style={{ ...tdInp, textAlign: 'right', width: '100%' }} />
                            )}
                          </td>
                          <td style={{ ...tdSt, textAlign: 'right' }}>
                            {isLocked ? fmt(row.unitPrice) : (
                              <input type="number" value={row.unitPrice} onChange={e => updateRow(i, 'unitPrice', Number(e.target.value))} style={{ ...tdInp, textAlign: 'right', width: '100%' }} />
                            )}
                          </td>
                          <td style={{ ...tdSt, textAlign: 'right' }}>
                            {isLocked ? `${row.vatRate}%` : (
                              <select value={row.vatRate} onChange={e => updateRow(i, 'vatRate', Number(e.target.value))} style={{ ...tdInp, width: '100%' }}>
                                {[0, 6, 12, 25].map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            )}
                          </td>
                          <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmt(net)}</td>
                          <td style={{ ...tdSt, textAlign: 'center' }}>
                            <button onClick={() => toggleRowAdvanced(row.id)} title="Fler fält för raden" style={{ background: 'none', border: 'none', cursor: 'pointer', color: advancedOpen ? '#1565c0' : '#999', padding: '2px' }}>
                              <Settings2 size={13} />
                            </button>
                          </td>
                          <td style={{ ...tdSt, textAlign: 'center' }}>
                            {!isLocked && rows.length > 1 && (
                              <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '2px' }}>
                                <X size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {advancedOpen && (
                          <tr style={{ background: '#f5faff' }}>
                            <td colSpan={7} style={{ padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                <div>
                                  <label style={lbl}>Artikelnr</label>
                                  <input disabled={isLocked} style={inp} placeholder="Artnr" />
                                </div>
                                <div>
                                  <label style={lbl}>Tjänst (momsfri)</label>
                                  <select disabled={isLocked} value={row.vatRate === 0 ? 'Ja' : 'Nej'} onChange={e => updateRow(i, 'vatRate', e.target.value === 'Ja' ? 0 : 25)} style={inp}>
                                    <option>Ja</option><option>Nej</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={lbl}>Rabatt %</label>
                                  <input disabled={isLocked} type="number" min="0" max="100" value={row.discount || 0} onChange={e => updateRow(i, 'discount', Number(e.target.value))} style={inp} />
                                </div>
                                <div>
                                  <label style={lbl}>Konto</label>
                                  <input disabled={isLocked} value={row.account || '3001'} onChange={e => updateRow(i, 'account', e.target.value)} style={inp} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {/* Add row */}
                  {!isLocked && (
                    <tr>
                      <td colSpan={7} style={{ padding: '4px 8px', background: '#fafafa', borderBottom: '1px solid #eee' }}>
                        <button onClick={addRow} style={{ background: 'none', border: 'none', color: '#1565c0', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Plus size={13} /> Lägg till rad
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer fields + totals */}
          <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '16px 20px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 2fr', gap: '18px', alignItems: 'start' }}>
            <div>
              <label style={lbl}>Fakturatext</label>
              <textarea value={invoiceText} onChange={e => setInvoiceText(e.target.value)} style={{ ...inp, minHeight: '60px', resize: 'vertical' }} placeholder="Hej! Tack för ditt köp hos oss." />
            </div>
            <div>
              <label style={lbl}>Frakt/Exp</label>
              <input type="number" defaultValue="0.00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Fakturaavgift</label>
              <input type="number" defaultValue="0.00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Fakturaavgift %</label>
              <input type="number" defaultValue="0.00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Netto</label>
              <div style={{ padding: '4px 0', fontWeight: 600, fontSize: '13px' }}>{fmt(totals.net)}</div>
            </div>
            {/* Sammanställningen är resultatet av allt ovanför — en egen
                lätt bakgrund gör det tydligt att det är en beräkning, inte
                bara ytterligare två lösa fält i sidans hörn. */}
            <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: '8px', padding: '10px 14px', display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Ex.Moms</label>
                <div style={{ padding: '4px 0', fontWeight: 600, fontSize: '13px' }}>{fmt(totals.net)}</div>
                <label style={lbl}>Övervältring</label>
                <div style={{ fontSize: '13px', color: '#666' }}>0,00</div>
                <label style={lbl}>Moms</label>
                <div style={{ fontSize: '13px', color: '#3d7a2e', fontWeight: 700 }}>{fmt(totals.vat)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Total excl. moms</label>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{fmt(totals.net)}</div>
                <label style={lbl}>Moms</label>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{fmt(totals.vat)}</div>
                <label style={{ ...lbl, marginTop: '6px' }}>Att betala</label>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#3d7a2e' }}>{fmt(totals.total)} {currency}</div>
              </div>
            </div>
          </div>

          {/* Distribution row */}
          <div style={{ background: 'white', padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div>
              <label style={lbl}>Utskriftsformat</label>
              <select style={{ ...inp, width: '140px' }}>
                <option>Standardutskrift</option><option>Kompakt</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Språk</label>
              <select style={{ ...inp, width: '100px' }}>
                <option>Svenska</option><option>Engelska</option><option>Norska</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Distributionssätt</label>
              <select style={{ ...inp, width: '140px' }}>
                <option>—</option><option>E-post</option><option>Utskrift</option><option>E-faktura</option>
              </select>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={() => handleSave('draft')} style={{ padding: '7px 18px', background: 'white', border: '1px solid #bbb', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#333' }}>
              Spara
            </button>
            <button onClick={() => handleSave('sent')} style={{ padding: '7px 18px', background: '#3d7a2e', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', color: 'white' }}>
              ✓ Bokför
            </button>
          </div>
        </div>

        {/* ── Preview Panel — samma InvoiceDocument-komponent som PDF-exporten fångar,
               så förhandsgranskningen aldrig kan divergera från vad som laddas ner. ── */}
        {showPreview && (
          <div style={{ width: '420px', borderLeft: '1px solid #ccc', background: '#fafafa', overflowY: 'auto', flexShrink: 0, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '380px', transform: 'scale(0.92)', transformOrigin: 'top center' }}>
              <InvoiceDocument
                ref={previewRef}
                invoice={{ invoiceNumber: nextNum, date: invoiceDate, dueDate, terms }}
                customer={customer}
                company={company}
                rows={rows}
                totals={totals}
                currency={currency}
                invoiceText={invoiceText}
                template={invoiceTemplateSnapshot.templateId}
                accentColor={invoiceTemplateSnapshot.accentColor}
                logoUrl={invoiceTemplateSnapshot.logoUrl}
                footerText={invoiceTemplateSnapshot.footerText}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Invoicing Component ─────────────────────────────────────────────────
const SORTABLE_COLUMNS = {
  invoiceNumber: (inv) => Number(inv.invoiceNumber) || 0,
  date: (inv) => inv.date || '',
  dueDate: (inv) => inv.dueDate || '',
  amount: (inv) => grossOf(inv),
};

// Ett genuint tomt läge (inte en enda liten rad i en annars tom sida) —
// fyller den tillgängliga höjden istället för att lämna en stor grå yta
// under en enda liten textrad.
function InvoiceEmptyState({ isFilteredEmpty, onCreate }) {
  const { title, body } = isFilteredEmpty
    ? { title: 'Inga fakturor matchar din sökning', body: 'Prova att rensa sökningen eller filtren ovan.' }
    : { title: 'Inga fakturor än', body: 'Skapa din första faktura för att komma igång med fakturering.' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px', background: 'white', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '999px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', marginBottom: '4px' }}>
        <FileText size={26} />
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#374151' }}>{title}</div>
      <p style={{ fontSize: '13px', color: '#9ca3af', maxWidth: '340px', margin: 0 }}>{body}</p>
      {!isFilteredEmpty && (
        <button onClick={onCreate} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
          <Plus size={15} /> Skapa faktura
        </button>
      )}
    </div>
  );
}

function SortableTh({ label, sortKeyName, sortKey, sortDir, onSort, style }) {
  const active = sortKey === sortKeyName;
  return (
    <th style={{ ...style, cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort(sortKeyName)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {active && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </span>
    </th>
  );
}

// ─── Höger sektion på Fakturering: Leverantörsfakturor ─────────────────────
// Riktig data (samma `expenses`-poster som den fristående Leverantörs-
// fakturor-sidan), inte en förenklad attrapp — men kompakt, utan flerrads-
// kontering/filuppladdning. "Ny leverantörsfaktura" och "Visa alla" öppnar
// den fullständiga sidan för det som faktiskt kräver mer plats.
function SupplierInvoicesPanel({ expenses, contacts, onMarkPaid, onOpenFull, onCreateNew }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const list = expenses.filter(e => e.type === 'supplier_invoice');

  const getStatus = (inv) => {
    if (inv.status === 'paid') return 'paid';
    if (inv.dueDate && new Date(inv.dueDate) < new Date()) return 'overdue';
    return 'sent'; // "obetald" — leverantörsfakturor har inget eget utkastläge
  };

  const statusOptions = [
    { value: 'all', label: 'Alla' },
    { value: 'sent', label: 'Obetald', bg: BRAND.amberBg, color: BRAND.amberText },
    { value: 'overdue', label: 'Förfallen', bg: BRAND.redBg, color: BRAND.redText },
    { value: 'paid', label: 'Betald', bg: BRAND.greenLight, color: BRAND.greenDark },
  ];

  const statusCounts = {};
  list.forEach(inv => { const s = getStatus(inv); statusCounts[s] = (statusCounts[s] || 0) + 1; });

  const filtered = statusFilter === 'all' ? list : list.filter(inv => getStatus(inv) === statusFilter);
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <>
      <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '14px 16px 0', display: 'flex', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Inbox size={16} /> Leverantörsfakturor
        </h1>
        <div style={{ flex: 1 }} />
        <button onClick={onOpenFull} style={{ padding: '4px 10px 12px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 500, color: '#555', cursor: 'pointer' }}>Visa alla</button>
        <button onClick={onCreateNew} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px', padding: '6px 12px', background: BRAND.green, border: 'none', borderRadius: '5px', fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
          <Plus size={13} /> Ny leverantörsfaktura
        </button>
      </div>

      <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, flexWrap: 'wrap' }}>
        {statusOptions.map(opt => {
          const isActive = statusFilter === opt.value;
          const count = opt.value === 'all' ? list.length : (statusCounts[opt.value] || 0);
          if (opt.value !== 'all' && count === 0) return null;
          const isNeutral = opt.value === 'all';
          return (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value)} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
              background: isNeutral ? (isActive ? '#1a3028' : 'white') : opt.bg,
              border: isNeutral ? `1px solid ${isActive ? '#1a3028' : '#ccc'}` : `1.5px solid ${isActive ? opt.color : 'transparent'}`,
              borderRadius: '999px', fontSize: '12px', fontWeight: isActive ? 700 : 500,
              color: isNeutral ? (isActive ? 'white' : '#333') : opt.color, cursor: 'pointer',
            }}>
              {opt.label}
              {count > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                  background: isNeutral ? (isActive ? 'rgba(255,255,255,0.25)' : '#e5e7eb') : 'rgba(255,255,255,0.55)',
                  color: isNeutral ? (isActive ? 'white' : '#555') : opt.color,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px', background: 'white', textAlign: 'center', color: '#9ca3af' }}>
          <Inbox size={28} style={{ color: '#e4e4e7' }} />
          <div style={{ fontSize: '13.5px' }}>{list.length === 0 ? 'Inga leverantörsfakturor registrerade än.' : 'Inga fakturor i det här filtret.'}</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr>
                {['LEVERANTÖR', 'FAKTURANR', 'FAKTURADATUM', 'FÖRFALLER', 'BELOPP', ''].map((h, i) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: i === 4 ? 'right' : 'left', fontSize: '11px', fontWeight: 700, color: '#555', background: '#f5f5f5', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(inv => {
                const status = getStatus(inv);
                const supplier = contacts.find(c => c.id === inv.supplierId);
                return (
                  <tr key={inv.id} style={{ background: getRowBg(status === 'sent' ? 'sent' : status), borderBottom: '1px solid #e0e0e0', cursor: 'pointer' }} onClick={onOpenFull}>
                    <td style={{ padding: '8px 10px', fontWeight: 500, color: '#222' }}>{supplier?.name || 'Okänd leverantör'}</td>
                    <td style={{ padding: '8px 10px', color: '#555' }}>#{inv.invoiceNumber}</td>
                    <td style={{ padding: '8px 10px', color: '#555' }}>{formatDate(inv.date)}</td>
                    <td style={{ padding: '8px 10px', color: status === 'overdue' ? BRAND.redText : '#555', fontWeight: status === 'overdue' ? 700 : 400 }}>{formatDate(inv.dueDate)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#222' }}>{fmt(inv.amount)}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      {status !== 'paid' ? (
                        <button
                          onClick={() => onMarkPaid?.(inv.id)}
                          title="Klicka för att markera som betald"
                          style={{
                            padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer',
                            background: status === 'overdue' ? BRAND.redBg : BRAND.amberBg,
                            color: status === 'overdue' ? BRAND.redText : BRAND.amberText,
                          }}
                        >
                          {status === 'overdue' ? 'Förfallen' : 'Obetald'}
                        </button>
                      ) : (
                        <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: BRAND.greenLight, color: BRAND.greenDark }}>Betald</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Invoices({ invoices, contacts, onAdd, onMarkPaid, onRegisterPayment, onUnmarkPaid, setInvoices, company, globalAction, clearGlobalAction, onNavigate, verifications = [], expenses = [], onMarkSupplierInvoicePaid, handleGlobalAction }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Två klart avgränsade sektioner, inte en klämd sida-vid-sida-vy — varje
  // sektion tar hela bredden när den är vald, precis som den fristående
  // Leverantörsfakturor-sidan redan gör. Bara två flikar, inte hela den
  // gamla flikraden (Inbetalningar/Påminnelser/Återkommande/Offerter är
  // fortsatt borttagna på användarens uttryckliga begäran).
  const section = searchParams.get('section') === 'leverantorer' ? 'leverantorer' : 'kunder';
  const setSection = (s) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('section', s);
    return next;
  }, { replace: true });

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [showExtendedSearch, setShowExtendedSearch] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [selected, setSelected] = useState(new Set());
  // Fakturorna visas i tydligt rubrikerade sektioner per status (Förfallen/
  // Obetald/Ej bokförd/Betald) istället för en enda blandad lista — piller-
  // knapparna ovanför hoppar ner till respektive sektion.
  const sectionRefs = useRef({});

  useEffect(() => {
    if (globalAction?.type === 'new_invoice') { setShowForm(true); setEditingInvoice(null); clearGlobalAction?.(); }
  }, [globalAction, clearGlobalAction]);

  // Sök-/intervallfilter-ändringar ska nollställa markeringar — annars kan
  // man stå kvar med rader markerade som inte längre syns.
  useEffect(() => { setSelected(new Set()); }, [search, dateFrom, dateTo, amountMin, amountMax]);

  const invoiceList = invoices.filter(i => i.type !== 'quote');

  const getStatus = (inv) => {
    if (inv.status === 'paid') return 'paid';
    if ((inv.status === 'sent' || inv.status === 'unpaid') && isOverdue(inv)) return 'overdue';
    return inv.status || 'draft';
  };

  const getCustomerName = (id) => contacts.find(c => c.id === id)?.name || '—';

  const matchesSearchAndRange = (inv) => {
    if (search) {
      const s = search.toLowerCase();
      const matches = String(inv.invoiceNumber).toLowerCase().includes(s) || getCustomerName(inv.customerId).toLowerCase().includes(s);
      if (!matches) return false;
    }
    if (dateFrom && inv.date && inv.date < dateFrom) return false;
    if (dateTo && inv.date && inv.date > dateTo) return false;
    const gross = grossOf(inv);
    if (amountMin && gross < Number(amountMin)) return false;
    if (amountMax && gross > Number(amountMax)) return false;
    return true;
  };

  // Fritextsökning + datum/beloppsintervall — statusen delar inte längre upp
  // via ett filter utan via egna sektioner (se STATUS_SECTIONS nedan), så
  // den här listan innehåller alla statusar samtidigt.
  const filtered = useMemo(() => invoiceList.filter(matchesSearchAndRange),
    [invoiceList, search, dateFrom, dateTo, amountMin, amountMax, contacts]);

  // Antal poster per status, för sektionsrubrikerna/pillren — räknat på
  // sök/intervall-filtrerad lista så siffrorna uppdateras när man skriver.
  const statusCounts = useMemo(() => {
    const counts = {};
    invoiceList.filter(matchesSearchAndRange).forEach(inv => {
      const st = getStatus(inv);
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [invoiceList, search, dateFrom, dateTo, amountMin, amountMax, contacts]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const keyFn = SORTABLE_COLUMNS[sortKey] || SORTABLE_COLUMNS.date;
    return [...filtered].sort((a, b) => {
      const av = keyFn(a), bv = keyFn(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const sumTotal = filtered.reduce((sum, inv) => sum + grossOf(inv), 0);

  const toggleSort = (key) => {
    setSortDir(d => (sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortKey(key);
  };

  const handleSaveInvoice = (data) => {
    if (editingInvoice) {
      setInvoices(prev => prev.map(i => i.id === editingInvoice.id ? { ...i, ...data } : i));
    } else {
      onAdd({ ...data, invoiceNumber: getNextInvoiceNumber(invoiceList, company) });
    }
    setShowForm(false);
    setEditingInvoice(null);
  };

  // Skapa en kreditfaktura mot en redan bokförd faktura, istället för att
  // låta beloppen på originalet ändras i efterhand.
  const handleCreateCreditNote = (original) => {
    const nextNum = getNextInvoiceNumber(invoiceList, company);
    const creditRows = (original.rows || []).map(r => ({ ...r, id: newRowId(), unitPrice: -Math.abs(r.unitPrice) }));
    onAdd({
      customerId: original.customerId,
      date: new Date().toISOString().split('T')[0],
      dueDate: original.dueDate,
      rows: creditRows,
      status: 'draft',
      type: 'invoice',
      invoiceNumber: nextNum,
      creditFor: original.invoiceNumber,
    });
    setShowForm(false);
    setEditingInvoice(null);
  };

  // Skapar en ny utkastfaktura med samma kund och rader, dagens datum — en
  // riktig kopia, inte bara en knapp som säger "Kopiera" utan att göra det.
  const handleDuplicateInvoice = (source) => {
    if (!source) return;
    const today = new Date().toISOString().split('T')[0];
    onAdd({
      customerId: source.customerId,
      date: today,
      dueDate: addDays(today, 30),
      rows: (source.rows || []).map(r => ({ ...r, id: newRowId() })),
      status: 'draft', type: 'invoice',
      invoiceNumber: getNextInvoiceNumber(invoiceList, company),
    });
    setShowForm(false);
    setEditingInvoice(null);
  };

  const handleUpdateInvoiceNote = (id, internalNote) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, internalNote } : i));
  };

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  // "Markera alla" görs per sektion (se STATUS_SECTIONS-renderingen nedan) —
  // varje sektions rubrikkryssruta markerar/avmarkerar bara sina egna rader.
  const toggleAllInRows = (rows) => {
    const allSelected = rows.length > 0 && rows.every(inv => selected.has(inv.id));
    setSelected(prev => {
      const n = new Set(prev);
      rows.forEach(inv => (allSelected ? n.delete(inv.id) : n.add(inv.id)));
      return n;
    });
  };

  // En tabellrad — bruten ut till en egen funktion eftersom den nu renderas
  // en gång per statussektion istället för i en enda blandad tabell.
  const renderInvoiceRow = (inv) => {
    const status = getStatus(inv);
    const rowBg = getRowBg(status);
    const gross = grossOf(inv);
    const isSelected = selected.has(inv.id);
    const customer = contacts.find(c => c.id === inv.customerId);

    return (
      <tr key={inv.id} style={{ background: isSelected ? '#e3f2fd' : rowBg, borderBottom: '1px solid #e0e0e0', cursor: 'pointer' }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.filter = 'brightness(0.97)'; }}
        onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
        onClick={() => { setEditingInvoice(inv); setShowForm(true); }}>
        <td style={{ padding: '6px 10px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleSelect(inv.id); }}>
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(inv.id)} style={{ cursor: 'pointer' }} />
        </td>
        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#111' }}>
          {inv.invoiceNumber}
        </td>
        <td style={{ padding: '8px 10px', color: '#222', fontWeight: 500 }}>{getCustomerName(inv.customerId)}</td>
        <td style={{ padding: '8px 10px', color: '#555' }}>{formatDate(inv.date)}</td>
        <td style={{ padding: '8px 10px', color: isOverdue(inv) ? '#c00' : '#555', fontWeight: isOverdue(inv) ? 700 : 400 }}>{formatDate(inv.dueDate)}</td>
        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#222' }}>{fmt(gross)}</td>
        <td style={{ padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
          {status === 'paid' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: BRAND.greenLight, color: BRAND.greenDark }}>
              <Check size={12} /> Betald{inv.paidDate ? ` ${formatDate(inv.paidDate)}` : ''}
            </span>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onMarkPaid(inv.id); }}
              title="Klicka för att markera som betald"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                background: status === 'overdue' ? BRAND.redBg : status === 'draft' ? BRAND.grayBg : BRAND.amberBg,
                color: status === 'overdue' ? BRAND.redText : status === 'draft' ? BRAND.grayText : BRAND.amberText,
              }}
            >
              {status === 'overdue' ? 'Förfallen' : status === 'draft' ? 'Ej bokförd' : 'Obetald'}
            </button>
          )}
        </td>
        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
          {status !== 'paid' && isOverdue(inv) && (
            customer?.email ? (
              <a
                href={buildReminderMailto(inv, customer)}
                onClick={e => e.stopPropagation()}
                title={`Skicka betalningspåminnelse till ${customer.email}`}
                style={{ color: '#b45309', display: 'inline-flex', padding: '2px' }}
              >
                <Send size={14} />
              </a>
            ) : (
              <span
                title="Lägg till kundens e-post under Kunder för att kunna skicka en påminnelse"
                style={{ color: '#d1d5db', display: 'inline-flex', padding: '2px', cursor: 'not-allowed' }}
              >
                <Send size={14} />
              </span>
            )
          )}
        </td>
      </tr>
    );
  };

  // Delade länkar: fakturans ID hålls i URL:en (?invoiceId=...) så en
  // delad länk alltid öppnar rätt faktura, och byte av faktura/stängning
  // håller URL:en i synk.
  useEffect(() => {
    const id = searchParams.get('invoiceId');
    if (id && !showForm) {
      const found = invoices.find(i => i.id === id);
      if (found) { setEditingInvoice(found); setShowForm(true); }
    }
  }, [searchParams, invoices, showForm]);

  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (showForm && editingInvoice?.id) next.set('invoiceId', editingInvoice.id);
      else next.delete('invoiceId');
      return next;
    }, { replace: true });
  }, [showForm, editingInvoice]);

  if (showForm) {
    // Bläddring («‹›») navigerar genom exakt samma sorterade/filtrerade
    // lista användaren kom ifrån — inte en fristående ordning — så pilarna
    // matchar det man faktiskt såg i listvyn.
    const navIndex = editingInvoice ? sorted.findIndex(i => i.id === editingInvoice.id) : -1;
    const nav = {
      hasPrev: navIndex > 0,
      hasNext: navIndex >= 0 && navIndex < sorted.length - 1,
      first: () => sorted[0] && setEditingInvoice(sorted[0]),
      prev: () => navIndex > 0 && setEditingInvoice(sorted[navIndex - 1]),
      next: () => navIndex >= 0 && navIndex < sorted.length - 1 && setEditingInvoice(sorted[navIndex + 1]),
      last: () => sorted.length > 0 && setEditingInvoice(sorted[sorted.length - 1]),
    };
    return (
      <InvoiceForm
        contacts={contacts}
        company={company}
        initial={editingInvoice}
        onSave={handleSaveInvoice}
        onCreateCreditNote={handleCreateCreditNote}
        onMarkPaid={onMarkPaid}
        onRegisterPayment={onRegisterPayment}
        onUnmarkPaid={onUnmarkPaid}
        onUpdateNote={handleUpdateInvoiceNote}
        verifications={verifications}
        invoiceList={invoiceList}
        nav={nav}
        onClose={() => { setShowForm(false); setEditingInvoice(null); }}
      />
    );
  }

  // Fyra verkliga statusar (getStatus() returnerar aldrig något annat) —
  // samma bg/text-färgpar här som på radernas egna statusmärken, och samma
  // mönster som Granskning-sidans badges: räknaren syns bara om > 0.
  const statusOptions = [
    { value: 'all', label: 'Alla' },
    { value: 'draft', label: 'Ej bokförd', bg: BRAND.grayBg, color: BRAND.grayText },
    { value: 'sent', label: 'Obetald', bg: BRAND.amberBg, color: BRAND.amberText },
    { value: 'overdue', label: 'Förfallen', bg: BRAND.redBg, color: BRAND.redText },
    { value: 'paid', label: 'Betald', bg: BRAND.greenLight, color: BRAND.greenDark },
  ];

  const thSt = {
    padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
    color: '#555', background: '#f5f5f5', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap', userSelect: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#f0f2f5' }}>
      {/* Två tydligt avgränsade sektioner — varje väljs för sig och fyller
          då hela bredden, inte en sida-vid-sida-klämd vy. Bara dessa två
          flikar; resten av den gamla flikraden (Inbetalningar/Påminnelser/
          Återkommande/Offerter) är fortsatt borttagen. */}
      <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '0 16px', display: 'flex', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        {[{ id: 'kunder', label: 'Kundfakturor' }, { id: 'leverantorer', label: 'Leverantörsfakturor' }].map(t => (
          <button key={t.id} onClick={() => setSection(t.id)} style={{
            padding: '12px 14px', border: 'none',
            borderBottom: section === t.id ? `3px solid ${BRAND.green}` : '3px solid transparent',
            background: 'none', fontSize: '14px', fontWeight: section === t.id ? 700 : 500,
            color: section === t.id ? '#111' : '#555', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => onNavigate?.('reports')} style={{ padding: '4px 14px 12px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 500, color: '#555', cursor: 'pointer' }}>Rapporter</button>
        <button onClick={() => onNavigate?.('contacts')} style={{ padding: '4px 14px 12px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 500, color: '#555', cursor: 'pointer' }}>Kunder ↓</button>
      </div>

    {section === 'kunder' && (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <div style={{ background: 'white', borderBottom: '1px solid #ddd', flexShrink: 0 }}>
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input type="text" placeholder="Fakturanr eller kundnamn" value={searchInput} onChange={e => setSearchInput(e.target.value)} style={{ padding: '5px 8px 5px 26px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', outline: 'none', fontFamily: 'inherit', width: '210px' }} />
          </div>
          <button onClick={() => setShowExtendedSearch(v => !v)} style={{ padding: '5px 8px', background: showExtendedSearch ? '#e3f2fd' : 'none', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', color: '#1565c0', cursor: 'pointer', fontFamily: 'inherit' }}>Utökad sökning</button>
          <button onClick={() => { setSearchInput(''); setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax(''); }} style={{ padding: '5px 8px', background: 'none', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Rensa sökning"><RefreshCw size={13} color="#555" /></button>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setShowForm(true); setEditingInvoice(null); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#2e7d32', border: 'none', borderRadius: '5px', fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
            <Plus size={14} /> Skapa faktura
          </button>
        </div>
        {showExtendedSearch && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #eee', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'end', background: '#fafafa' }}>
            <div>
              <label style={lbl}>Datum från</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, width: '140px' }} />
            </div>
            <div>
              <label style={lbl}>Datum till</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inp, width: '140px' }} />
            </div>
            <div>
              <label style={lbl}>Belopp från</label>
              <input type="number" value={amountMin} onChange={e => setAmountMin(e.target.value)} placeholder="0" style={{ ...inp, width: '110px' }} />
            </div>
            <div>
              <label style={lbl}>Belopp till</label>
              <input type="number" value={amountMax} onChange={e => setAmountMax(e.target.value)} placeholder="—" style={{ ...inp, width: '110px' }} />
            </div>
          </div>
        )}
      </div>

      {/* Statuspiller — hoppar ner till respektive sektion istället för att
          filtrera bort de andra, eftersom fakturorna nu visas indelade i
          sektioner samtidigt (se nedan). */}
      <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, flexWrap: 'wrap' }}>
        {statusOptions.filter(opt => opt.value !== 'all').map(opt => {
          const count = statusCounts[opt.value] || 0;
          if (count === 0) return null; // ingen badge/pill-brus för tomma statusar
          return (
            <button
              key={opt.value}
              onClick={() => sectionRefs.current[opt.value]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
                background: opt.bg, border: '1.5px solid transparent',
                borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                color: opt.color, cursor: 'pointer',
              }}
            >
              {opt.label}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                background: 'rgba(255,255,255,0.55)', color: opt.color,
              }}>{count}</span>
            </button>
          );
        })}
        <span style={{ fontSize: '12px', color: '#555', marginLeft: '4px' }}>{sorted.length} poster</span>
        <div style={{ flex: 1 }} />
        <Printer size={15} style={{ cursor: 'pointer', color: '#555' }} />
      </div>

      {/* Sektioner — fakturorna delas upp i egna rubrikerade sektioner per
          status (Förfallen/Obetald/Ej bokförd/Betald) istället för en enda
          blandad lista. Tomma sektioner visas inte alls. Status är klickbar
          där det finns en riktig åtgärd att göra (markera betald). */}
      {sorted.length === 0 ? (
        <InvoiceEmptyState isFilteredEmpty={invoiceList.length > 0} onCreate={() => { setShowForm(true); setEditingInvoice(null); }} />
      ) : (
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {statusOptions.filter(opt => opt.value !== 'all').map(opt => {
          const rows = sorted.filter(inv => getStatus(inv) === opt.value);
          if (rows.length === 0) return null;
          const allSelected = rows.every(inv => selected.has(inv.id));
          const sectionSum = rows.reduce((sum, inv) => sum + grossOf(inv), 0);
          return (
            <div key={opt.value} ref={el => { sectionRefs.current[opt.value] = el; }} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 10px 6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, background: opt.bg, color: opt.color }}>
                  {opt.label}
                  <span style={{ background: 'rgba(255,255,255,0.55)', borderRadius: '999px', padding: '0 6px', fontSize: '11px' }}>{rows.length}</span>
                </span>
                <span style={{ fontSize: '12px', color: '#888' }}>{fmt(sectionSum)} SEK</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thSt, width: 32, textAlign: 'center' }}>
                      <input type="checkbox" checked={allSelected} onChange={() => toggleAllInRows(rows)} style={{ cursor: 'pointer' }} />
                    </th>
                    <SortableTh label="FAKTURANR" sortKeyName="invoiceNumber" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thSt} />
                    <th style={thSt}>KUND</th>
                    <SortableTh label="FAKTURADATUM" sortKeyName="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thSt} />
                    <SortableTh label="FÖRFALLODATUM" sortKeyName="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thSt} />
                    <SortableTh label="BELOPP" sortKeyName="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={{ ...thSt, textAlign: 'right' }} />
                    <th style={thSt}>STATUS</th>
                    <th style={thSt}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(inv => renderInvoiceRow(inv))}
                </tbody>
              </table>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', background: '#f5f5f5', borderTop: '2px solid #ccc', fontWeight: 700, fontSize: '13px', color: '#333' }}>
          Summa SEK&nbsp;<span style={{ color: '#222', marginLeft: '6px' }}>{fmt(sumTotal)}</span>
        </div>
      </div>
      )}

      {/* Bottom action bar (when rows selected) */}
      {selected.size > 0 && (
        <div style={{ background: '#1a3028', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>({selected.size} markerade)</span>
          <button onClick={() => { selected.forEach(id => onMarkPaid(id)); setSelected(new Set()); }} style={{ padding: '6px 16px', background: '#22c55e', border: 'none', borderRadius: '5px', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            Markera som betalda
          </button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: 'auto' }}><X size={18} /></button>
        </div>
      )}
    </div>
    )}

    {section === 'leverantorer' && (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SupplierInvoicesPanel
        expenses={expenses}
        contacts={contacts}
        onMarkPaid={onMarkSupplierInvoicePaid}
        onOpenFull={() => onNavigate?.('supplier_invoices')}
        onCreateNew={() => handleGlobalAction?.({ type: 'new_supplier_invoice' }, 'supplier_invoices')}
      />
    </div>
    )}
    </div>
  );
}
