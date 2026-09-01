import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, X, Send, Check, FileText,
  Search, ChevronRight, ChevronDown,
  RefreshCw, Printer, Eye, CreditCard, Link2,
  MessageSquare, Tag, Lock, Settings2, Download, Upload, AlertTriangle, Inbox, Trash2,
  ZoomIn, ZoomOut, Pencil, Copy, CheckCircle2, Undo2
} from 'lucide-react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import InvoiceDocument, { DEFAULT_INVOICE_TEMPLATE, INVOICE_TEMPLATES } from './InvoiceDocument';
import { exportInvoicePdf, getInvoicePdfBase64 } from '../utils/exportInvoicePdf';
import { sendInvoiceEmail } from '../emailApi';
import { BRAND } from '../utils/brandColors';
import { getNextInvoiceNumber } from '../utils/invoiceNumbering';
import { articlesToCsv, csvToArticles, downloadCsv } from '../utils/csvRegister';
import { listHeaderButtonStyle, listSearchInputStyle, listFilterFieldStyle } from './shared/ListPageHeader';
import RowActionMenu from './shared/RowActionMenu';
import ListTable from './shared/ListTable';
// Kodgranskning: fanns tidigare som en egen lokal kopia här OCH som
// grossInvoiceAmount i reportCalculations.js (den senare påstod sig i sin
// egen kommentar vara "delad istället för en tredje tyst kopia", men var i
// praktiken en andra oberoende implementation). Importerad härifrån istället
// — reportCalculations.js (en utils-fil) ska inte bero på en sidkomponent,
// så flytten gick åt det hållet, inte tvärtom. Alias till samma namn så
// alla anrop nedan är oförändrade.
import { grossInvoiceAmount as grossOf } from '../utils/reportCalculations';

const newRowId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const withRowIds = (rows) => rows.map(r => ({ id: r.id || newRowId(), ...r }));

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

// Kundfeedback ("starkare färger för obetald och betald"): de vanliga
// BRAND.amberBg/greenLight-tonerna är avsiktligt bleka (samma neutrala
// nyanser som delas av alla andra badges i hela appen, se brandColors.js) —
// för just de HÄR två statusarna, den enda frågan som faktiskt spelar roll
// på hela sidan ("har jag fått betalt eller inte?"), ska svaret synas på
// långt håll, inte gissas fram från en blek pastellton. Egna, mättade
// heltäckande färger lokalt HÄR (inte i BRAND) så bara Fakturor-sidans
// badges/knappar påverkas — Bokförings/lönekörningens statusmärken, som
// delar samma BRAND-tokens, rörs inte.
const STRONG_PAID = { bg: '#16a34a', text: '#ffffff' };
const STRONG_UNPAID = { bg: '#d97706', text: '#ffffff' };

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
    <div style={{ borderBottom: '1px solid var(--border-light)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', background: 'none',
          border: 'none', padding: '16px 32px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', userSelect: 'none'
        }}
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {title}
      </button>
      {/* Bugkritiskt: `title` innehöll tidigare en egen "▾ "-prefix i
          textsträngen (t.ex. "▾ Kunduppgifter") UTÖVER chevron-ikonen ovan
          — två pilar synliga samtidigt. Prefixet är borttaget från
          anropen nedan, ikonen räcker som visuell markör. */}
      {open && <div style={{ padding: '0 32px 24px' }}>{children}</div>}
    </div>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────────────────
// Samma mått som QuoteEditor (Quotes.jsx: inputStyle/label) — fakturans
// redigeringsläge ska kännas som offertens, inte som ett tätt kalkylblad
// (Sida 43-uppföljning). Kaskaderar till varenda fält i formuläret genom
// att bara byta de här delade konstanterna, ingen enskild fält-JSX rörd.
const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' };
// Samma "+ Lägg till rad"-knapp som QuoteEditor:s outlineBtnStyle (Quotes.jsx).
const outlineToolbarBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer',
};

// ─── Invoice Full Form (Fortnox-inspired) ──────────────────────────────────────
function InvoiceForm({ contacts, onSave, onClose, initial, prefill, company, invoiceList, onCreateCreditNote, onRegisterPayment, onUnmarkPaid, onUpdateNote, verifications = [], nav, onGetPaymentLinkUrl, articles = [], setArticles }) {
  // En bokförd faktura (allt utom utkast) får inte längre ändra belopp/rader/kund —
  // korrigeringar sker via kreditfaktura. Datum och kommentar går fortfarande att ändra.
  const isLocked = Boolean(initial) && (initial.status || 'draft') !== 'draft';

  // `prefill` (från t.ex. Tidrapportering → "Skapa faktura") sätter bara
  // startvärden för en NY faktura — aldrig när `initial` redan pekar på en
  // sparad faktura som redigeras.
  const [customerId, setCustomerId] = useState(initial?.customerId || prefill?.customerId || '');
  const [invoiceDate, setInvoiceDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    if (initial?.dueDate) return initial.dueDate;
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [rows, setRows] = useState(() => withRowIds(initial?.rows || prefill?.rows || [
    { description: '', qty: 1, unitPrice: 0, vatRate: 25, discount: 0, account: '3001', articleNumber: '' }
  ]));
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRowAdvanced = (id) => setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [ourRef, setOurRef] = useState(initial?.ourRef || '');
  const [theirRef, setTheirRef] = useState(initial?.theirRef || '');
  const [ourOrderNr, setOurOrderNr] = useState(initial?.ourOrderNr || '');
  const [invoiceType, setInvoiceType] = useState('Faktura');
  const [terms, setTerms] = useState('30 dagar');
  // Bugkritiskt: sparades tidigare aldrig med på fakturan (se handleSave
  // nedan) — valde man EUR i rullistan låg det bara i denna komponentens
  // lokala state och föll tillbaka till SEK igen så fort fakturan sparades
  // och öppnades på nytt, eller när en betalningslänk skapades (som därför
  // alltid hårdkodade 'sek' oavsett vad som stod här).
  const [currency, setCurrency] = useState(initial?.currency || 'SEK');
  const [invoiceText, setInvoiceText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  // Sida 38, punkt 4: explicit +/- zoom som fallback till det äkta
  // tvåfingers-pinchzoom-gest som webbläsaren redan tillåter rakt av (ingen
  // user-scalable=no/maximum-scale i index.html som spärrar den) — en A4-
  // sida i sin riktiga storlek (210mm ≈ 794px) är annars för smal text att
  // läsa på en telefon utan att zooma på något sätt.
  const [previewZoom, setPreviewZoom] = useState(1);
  useEffect(() => { if (showPreview) setPreviewZoom(1); }, [showPreview]);

  const previewRef = useRef(null);
  // Egen, alltid monterad kopia av InvoiceDocument, gömd off-screen med
  // fast bredd (794px ≈ .a4-paper:s riktiga 210mm) — PDF-export/mejl fångar
  // ALLTID denna istället för den synliga förhandsgranskningen. Den synliga
  // modalen kan vara smalare än 210mm (litet fönster, eller mitt i sin
  // öppningsanimation när "Skicka via e-post" trycks direkt) — html2canvas
  // fångar då den FAKTISKT smalare layouten, som sedan skalas upp till en
  // riktig A4-bredd av jsPDF och blir orimligt hög i förhållande till sitt
  // innehåll (satte hela fakturan proportionellt "sträckt", texten hamnade
  // fel, sidbrytningen skar av mitt i en rad och lämnade en tom sista sida).
  // Bugkritiskt: en fast bredd oberoende av webbläsarfönstret eliminerar
  // detta helt, istället för att jaga exakt timing på när modalen hunnit
  // lägga ut sig korrekt.
  const captureRef = useRef(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  // Förifylld från kundkortet om det finns en sparad adress, men alltid
  // redigerbar — man ska kunna skicka till en mottagare utan att först
  // behöva gå och spara en e-post på kunden (t.ex. en engångsmottagare,
  // eller kundkortet saknar helt enkelt en adress ännu).
  const [emailToInput, setEmailToInput] = useState('');

  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentDraft, setCommentDraft] = useState(initial?.internalNote || '');
  const [showPaymentBox, setShowPaymentBox] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentDateInput, setPaymentDateInput] = useState(() => new Date().toISOString().split('T')[0]);

  const customers = contacts.filter(c => c.type === 'customer' || !c.type);
  const customer = customers.find(c => c.id === customerId);

  // Fyller i mottagarfältet från kundkortet varje gång kunden byts — men rör
  // det inte igen efter det, så en manuell ändring/tillägg av mottagare inte
  // tyst skrivs över om något annat på formuläret triggar en omrendering.
  useEffect(() => { setEmailToInput(customer?.email || ''); }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Verifikationsnumret hämtas från den riktiga bokförda verifikationen
  // (skapas automatiskt när fakturan sparas) — inte det hårdkodade "$v"-
  // platshållartecknet som stod här innan och aldrig ersattes med något.
  const linkedVerification = initial?.id ? verifications.find(v => v.source === 'invoice' && v.sourceId === initial.id) : null;

  const nextNum = initial?.invoiceNumber || getNextInvoiceNumber(invoiceList, company);
  const ocr = nextNum.padStart(7, '0');

  const addRow = () => setRows(r => [...r, { id: newRowId(), description: '', qty: 1, unitPrice: 0, vatRate: 25, discount: 0, account: '3001', articleNumber: '' }]);
  const updateRow = (i, field, val) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));

  // Artikelregister — hittar en sparad artikel på exakt artikelnr (skiftlägesokänsligt,
  // trimmat) och fyller i rest av raden åt användaren. Manuellt vald, aldrig automatiskt
  // vid varje knapptryck, så en användare som medvetet ändrat pris/text på raden aldrig
  // blir överskriven i tysthet.
  const findArticleByNumber = (num) => {
    const key = (num || '').trim().toLowerCase();
    if (!key) return null;
    return articles.find(a => (a.articleNumber || '').trim().toLowerCase() === key) || null;
  };
  const applyArticleToRow = (i, article) => {
    setRows(r => r.map((row, idx) => idx === i ? {
      ...row,
      articleNumber: article.articleNumber,
      description: article.description || row.description,
      unitPrice: article.unitPrice ?? row.unitPrice,
      vatRate: article.vatRate ?? row.vatRate,
      account: article.account || row.account,
    } : row));
  };
  // Sparar (eller uppdaterar, om samma artikelnr redan finns) raden som en
  // artikel i registret — samma register som fylls i via `<datalist>` nedan.
  const saveRowAsArticle = (row) => {
    const num = (row.articleNumber || '').trim();
    if (!num || !setArticles) return;
    setArticles(prev => {
      const key = num.toLowerCase();
      const existingIdx = prev.findIndex(a => (a.articleNumber || '').trim().toLowerCase() === key);
      const next = { articleNumber: num, description: row.description, unitPrice: row.unitPrice, vatRate: row.vatRate, account: row.account };
      if (existingIdx === -1) return [...prev, next];
      return prev.map((a, idx) => idx === existingIdx ? next : a);
    });
  };

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
  // State (inte en const) så mallval/accentfärg går att ändra direkt i
  // förhandsgranskningen innan fakturan skickas (se mallväljaren i
  // preview-panelen nedan) — fryses ändå precis som förut i samma ögonblick
  // fakturan lämnar utkast-status, den ändras bara inte tyst i bakgrunden
  // om företagets Inställningar råkar ändras medan detta utkast är öppet.
  const [invoiceTemplateSnapshot, setInvoiceTemplateSnapshot] = useState(() => initial?.invoiceTemplateSnapshot || {
    templateId: company?.invoiceTemplateId || DEFAULT_INVOICE_TEMPLATE,
    accentColor: company?.invoiceAccentColor || '',
    logoUrl: company?.logoUrl || '',
    footerText: company?.invoiceFooterText || '',
  });

  const handleSave = (status = 'draft') => {
    // internalNote skickas alltid med här (inte bara via popoverns egen
    // "Spara"-knapp) så en kommentar man skrivit på en NY, ännu osparad
    // faktura faktiskt följer med — annars gick den förlorad eftersom
    // Kommentar-knappen tidigare var helt avstängd innan första sparningen.
    onSave({ customerId, date: invoiceDate, dueDate, rows, status, type: 'invoice', invoiceNumber: nextNum, ourRef, theirRef, ourOrderNr, internalNote: commentDraft, invoiceTemplateSnapshot, currency });
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true); setPdfError('');
    try {
      await exportInvoicePdf(captureRef.current, `faktura-${nextNum}.pdf`);
    } catch (err) {
      console.error(err);
      setPdfError('Kunde inte skapa PDF. Försök igen.');
    } finally {
      setPdfBusy(false);
    }
  };

  // Skickar fakturan (som riktig PDF-bilaga) till kundens e-post via
  // backendens Resend-integration — till skillnad från betalningspåminnelsens
  // mailto:-länk går det här faktiskt iväg utan att användaren själv behöver
  // öppna och trycka skicka i sitt eget mailprogram.
  const handleSendEmail = async () => {
    const to = emailToInput.trim();
    if (!to) { setEmailError('Ange en mottagaradress.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(to)) { setEmailError('Det där ser inte ut som en giltig e-postadress.'); return; }
    setEmailBusy(true); setEmailError(''); setEmailSent(false);
    try {
      const attachmentBase64 = await getInvoicePdfBase64(captureRef.current);

      // Om Stripe är anslutet, lägg in en riktig betalningslänk i mejlet så
      // kunden kan betala direkt — best effort: misslyckas länken (t.ex.
      // ogiltiga rader) skickas fakturan ändå, bara utan knappen, istället
      // för att hela utskicket stoppas av ett Stripe-fel.
      let paymentLinkUrl = null;
      if (company?.stripeAccountId && onGetPaymentLinkUrl && initial?.id) {
        try {
          paymentLinkUrl = await onGetPaymentLinkUrl(initial.id);
        } catch (linkErr) {
          console.warn('Kunde inte skapa betalningslänk till mejlet, skickar utan:', linkErr);
        }
      }

      const html = `
        <p>Hej${customer?.contactPerson ? ' ' + customer.contactPerson : ''},</p>
        <p>Bifogat finner du faktura <strong>${nextNum}</strong> på <strong>${fmt(totals.total)} kr</strong>, med förfallodatum ${formatDate(dueDate)}.</p>
        ${paymentLinkUrl ? `
        <p style="margin: 20px 0;">
          <a href="${paymentLinkUrl}" style="display:inline-block;padding:12px 26px;background:#3d7a2e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Betala nu</a>
        </p>
        ` : ''}
        <p>Hör av dig om du har några frågor.</p>
        <p>Med vänlig hälsning<br/>${(company?.invoiceDisplayName || company?.name) || ''}</p>
      `;

      await sendInvoiceEmail({
        to,
        subject: `Faktura ${nextNum} från ${(company?.invoiceDisplayName || company?.name) || 'oss'}`,
        html,
        replyTo: company?.email || undefined,
        attachmentBase64,
        attachmentFilename: `faktura-${nextNum}.pdf`,
        // Avsändaradressen avgörs server-side (Sida 33) utifrån den
        // inloggade användarens EGEN sparade företagsdata (säkerhetsfix —
        // se send-invoice.js), inte längre ett client-supplied
        // företagsobjekt. Skickar bara med ID:t.
        company_id: company?.id,
      });

      setEmailSent(true);
      // Precis som "✓ Skapa faktura"-knappen — ett utkast som faktiskt
      // skickas till kunden är per definition inte längre ett utkast.
      if ((initial?.status || 'draft') === 'draft') handleSave('sent');
    } catch (err) {
      console.error(err);
      setEmailError(err.message || 'Kunde inte skicka e-post.');
    } finally {
      setEmailBusy(false);
    }
  };

  // Samma rundade pill-knapp som QuoteEditor:s toolbarBtnStyle (Quotes.jsx)
  // istället för en text/ikon flytande fritt på raden — egen klickyta med
  // luft och kant runt om, inte bara en tunn linje mot grannknappen.
  const topBarBtn = (label, icon, onClick, style = {}, disabled = false, title) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} title={title} style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
      fontSize: '12.5px', fontWeight: 600, color: disabled ? 'var(--text-muted)' : 'var(--text-main)', cursor: disabled ? 'not-allowed' : 'pointer',
      whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s', opacity: disabled ? 0.55 : 1,
      ...style
    }}>
      {icon}{label}
    </button>
  );
  const activeToolbarPillStyle = { background: 'var(--status-blue-bg)', borderColor: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' };

  return (
    <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-muted)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>

      {/* ── Top bar — samma mönster som QuoteEditor (Quotes.jsx): sticky,
          18px titel + statusmärke till vänster, Avbryt/Spara till höger,
          istället för en tät rad med KUNDFAKTURA/OCR/VER.NR i versaler. ── */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Tillbaka
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{initial ? `Faktura ${nextNum}` : 'Ny faktura'}</h1>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>OCR: {ocr}* · VER.NR: {linkedVerification?.number || '—'}</span>
          {isLocked && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--status-amber-text)', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '20px', padding: '4px 10px', fontWeight: 600 }}>
              <Lock size={11} /> Bokförd
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: '8px' }} />

        {/* Navigation — bläddrar genom samma lista man kom ifrån */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {[
            { s: '«', onClick: nav?.first, enabled: nav?.hasPrev, title: 'Första fakturan' },
            { s: '‹', onClick: nav?.prev, enabled: nav?.hasPrev, title: 'Föregående faktura' },
            { s: '›', onClick: nav?.next, enabled: nav?.hasNext, title: 'Nästa faktura' },
            { s: '»', onClick: nav?.last, enabled: nav?.hasNext, title: 'Sista fakturan' },
          ].map(({ s, onClick, enabled, title }) => (
            <button
              key={s} type="button" disabled={!enabled} onClick={onClick} title={title}
              style={{ padding: '4px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '13px', color: enabled ? 'var(--text-main)' : 'var(--border)' }}
            >{s}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" data-tour="page-invoices-cancel" onClick={onClose} style={listHeaderButtonStyle('secondary')}>Avbryt</button>
          <button type="button" onClick={() => handleSave('sent')} style={listHeaderButtonStyle('primary')}>
            <Check size={14} /> {initial ? 'Spara ändringar' : 'Skapa faktura'}
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
      <div className="quote-toolbar" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', flexShrink: 0, overflowX: 'auto', position: 'relative' }}>
        {topBarBtn('Registrera betalning', <CreditCard size={13} />, () => setShowPaymentBox(v => !v), showPaymentBox ? activeToolbarPillStyle : {}, !initial, !initial ? 'Spara fakturan först' : undefined)}
        {topBarBtn(
          'Markera som obetald',
          <Tag size={13} />,
          () => { if (window.confirm(`Markera faktura ${nextNum} som obetald? Den registrerade betalningen tas bort.`)) onUnmarkPaid?.(initial.id); },
          {},
          !initial || initial?.status !== 'paid',
          !initial ? 'Spara fakturan först' : (initial?.status !== 'paid' ? 'Fakturan är inte markerad som betald' : 'Ångrar den registrerade betalningen')
        )}
        {topBarBtn('Kommentar', <MessageSquare size={13} />, () => setShowCommentBox(v => !v), showCommentBox ? activeToolbarPillStyle : (commentDraft ? { color: 'var(--status-amber-text)', borderColor: 'var(--status-amber-bg)' } : {}))}
        <div style={{ flex: 1, minWidth: '8px' }} />
        {emailError && <span style={{ fontSize: '11px', color: '#c00', alignSelf: 'center', marginRight: 8 }}>{emailError}</span>}
        {emailSent && !emailError && <span style={{ fontSize: '11px', color: 'var(--status-green-text)', alignSelf: 'center', marginRight: 8 }}>Skickad ✓</span>}
        <input
          type="email" value={emailToInput} onChange={e => { setEmailToInput(e.target.value); setEmailError(''); }}
          placeholder="mottagarens@epost.se" title="Mottagarens e-postadress — förifylld från kundkortet om det finns en, men går att ändra eller fylla i här"
          disabled={!initial}
          style={{
            padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', width: '190px',
            flexShrink: 0, fontFamily: 'inherit',
            background: !initial ? 'var(--bg-muted)' : 'var(--bg-card)', color: !initial ? 'var(--text-muted)' : 'var(--text-main)',
          }}
        />
        {topBarBtn(
          emailBusy ? 'Skickar…' : 'Skicka via e-post',
          <Send size={13} />,
          handleSendEmail,
          {},
          emailBusy || !initial || !emailToInput.trim(),
          !initial ? 'Spara fakturan först' : (!emailToInput.trim() ? 'Ange en mottagaradress' : `Skicka faktura ${nextNum} till ${emailToInput.trim()}`)
        )}
        {pdfError && <span style={{ fontSize: '11px', color: '#c00', alignSelf: 'center', marginRight: 8 }}>{pdfError}</span>}
        {topBarBtn(pdfBusy ? 'Skapar PDF…' : 'Ladda ner PDF', <Download size={13} />, handleDownloadPdf, {}, pdfBusy)}
        {topBarBtn('Förhandsgranska', <Eye size={13} />, () => setShowPreview(v => !v), showPreview ? activeToolbarPillStyle : {})}
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
                <div style={{ fontSize: '13px', color: 'var(--status-green-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> Betald {initial.paidDate ? formatDate(initial.paidDate) : ''}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Totalt: {fmt(totals.total)} kr</div>
                  {alreadyPaid > 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Redan betalt: {fmt(alreadyPaid)} kr</div>
                  )}
                  <div style={{ fontSize: '13px', color: 'var(--status-amber-text)', fontWeight: 600, marginBottom: '14px' }}>Kvar att betala: {fmt(remainingDue)} kr</div>

                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Belopp (kr)</label>
                  <input
                    type="number" min="0" max={remainingDue} step="0.01"
                    value={paymentAmountInput} onChange={e => setPaymentAmountInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--text-muted)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-main)', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Datum</label>
                  <input
                    type="date"
                    value={paymentDateInput} onChange={e => setPaymentDateInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--text-muted)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-main)', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
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
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '10px' }}>Detta bokförs som en delbetalning — fakturan blir inte markerad som helt betald.</div>
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
                style={{ width: '100%', minHeight: '140px', padding: '10px 12px', border: '1px solid var(--text-muted)', borderRadius: '6px', fontSize: '14px', lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', color: 'var(--text-main)', background: 'var(--bg-card)' }}
              />
              {!initial && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>Sparas tillsammans med fakturan.</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                <button onClick={() => setShowCommentBox(false)} style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Stäng</button>
                <button
                  onClick={() => { if (initial) onUpdateNote?.(initial.id, commentDraft); setShowCommentBox(false); }}
                  style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
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
            <button onClick={() => { if (window.confirm(`Skapa en kreditfaktura som motsvarar faktura ${nextNum}?`)) onCreateCreditNote?.(initial); }} style={{ background: 'none', border: 'none', color: 'var(--status-amber-text)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Skapa en kreditfaktura</button>
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
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', background: 'var(--bg-card)' }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

          {/* Fakturauppgifter — samma sektionsmönster som QuoteEditor:s
              "Kundinformation" (Quotes.jsx): en enda tydligt rubricerad
              yta med generös padding, istället för två-tre tätt staplade
              tunna kortremsor. */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Fakturauppgifter</h3>
            {/* form-row-stack (Sida 38, punkt 2): kolumnbredden är ojämn
                (2fr 1fr 1fr 1fr) så den kan inte återanvända .form-row-2/-3,
                men ska ändå bli en kolumn på mobil. */}
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end', marginBottom: '16px' }}>
              <div>
                <label style={lbl}>Kund</label>
                <select data-tour="page-invoices-field" value={customerId} onChange={e => setCustomerId(e.target.value)} disabled={isLocked} style={{ ...inp, background: isLocked ? 'var(--border-light)' : 'var(--bg-card)' }}>
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
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '9px', overflow: 'hidden', opacity: isLocked ? 0.6 : 1 }}>
                  {['Faktura', 'Kontantfaktura'].map(t => (
                    <button key={t} disabled={isLocked} onClick={() => setInvoiceType(t)} style={{
                      flex: 1, padding: '8px 6px', border: 'none', fontSize: '12.5px', cursor: isLocked ? 'not-allowed' : 'pointer',
                      background: invoiceType === t ? 'var(--accent)' : 'var(--bg-card)',
                      color: invoiceType === t ? 'white' : 'var(--text-main)', fontWeight: invoiceType === t ? 700 : 500
                    }}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
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
            <button
              type="button"
              onClick={() => setShowMoreOptions(v => !v)}
              style={{
                marginTop: '16px', background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)',
              }}
            >
              {showMoreOptions ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Fler alternativ
            </button>
            {showMoreOptions && (
              <div className="form-row-stack" style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-muted)', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
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
                    {['SEK', 'NOK', 'EUR', 'USD', 'GBP'].map(c => <option key={c}>{c}</option>)}
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
            <Section title="Kunduppgifter" defaultOpen={false}>
              <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
                    <input type="checkbox" /> Export
                  </label>
                </div>
              </div>
            </Section>
          )}

          {/* Leveransuppgifter */}
          <Section title="Leveransuppgifter" defaultOpen={false}>
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div><label style={lbl}>Leveransadress</label><input style={inp} /></div>
              <div><label style={lbl}>Leveransort</label><input style={inp} /></div>
              <div><label style={lbl}>Leveransdatum</label><input type="date" style={inp} /></div>
              <div><label style={lbl}>Leveranssätt</label><input style={inp} /></div>
            </div>
          </Section>

          {/* Fakturarader — samma rutnätsmönster som QuoteEditor:s
              "Offertrader" (Quotes.jsx: gridTemplateColumns-rader av riktiga
              inputs) istället för ett tätt kalkylblad (<table>, 12px celler).
              Avancerade fält (artikelnr/momsfri tjänst/rabatt/konto) bakom
              kugghjulet, precis som förut — bara paketeringen är ny. */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Fakturarader</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{rows.length} {rows.length === 1 ? 'rad' : 'rader'}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '760px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.7fr 0.9fr 0.7fr 0.9fr auto auto', gap: '10px', marginBottom: '8px', padding: '0 2px' }}>
                  {['Benämning', 'Antal', 'À-pris', 'Moms', 'Summa', '', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: i >= 1 && i <= 4 ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>

                {rows.map((row, i) => {
                  const { net } = calcRow(row);
                  const advancedOpen = expandedRows.has(row.id);
                  return (
                    <div key={row.id} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.7fr 0.9fr 0.7fr 0.9fr auto auto', gap: '10px', alignItems: 'center' }}>
                        {isLocked ? (
                          <div style={{ ...inp, background: 'var(--bg-muted)', border: '1px solid var(--border-light)' }}>{row.description}</div>
                        ) : (
                          <input
                            value={row.description}
                            onChange={e => updateRow(i, 'description', e.target.value)}
                            style={inp}
                            placeholder="Beskrivning av tjänst eller produkt"
                          />
                        )}
                        {isLocked ? (
                          <div style={{ ...inp, background: 'var(--bg-muted)', border: '1px solid var(--border-light)', textAlign: 'right' }}>{row.qty}</div>
                        ) : (
                          <input type="number" value={row.qty} onChange={e => updateRow(i, 'qty', Number(e.target.value))} style={{ ...inp, textAlign: 'right' }} />
                        )}
                        {isLocked ? (
                          <div style={{ ...inp, background: 'var(--bg-muted)', border: '1px solid var(--border-light)', textAlign: 'right' }}>{fmt(row.unitPrice)}</div>
                        ) : (
                          <input type="number" value={row.unitPrice} onChange={e => updateRow(i, 'unitPrice', Number(e.target.value))} style={{ ...inp, textAlign: 'right' }} />
                        )}
                        {isLocked ? (
                          <div style={{ ...inp, background: 'var(--bg-muted)', border: '1px solid var(--border-light)', textAlign: 'right' }}>{row.vatRate}%</div>
                        ) : (
                          <select value={row.vatRate} onChange={e => updateRow(i, 'vatRate', Number(e.target.value))} style={inp}>
                            {[0, 6, 12, 25].map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        )}
                        <div style={{ ...inp, background: 'var(--bg-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', textAlign: 'right', fontWeight: 600 }}>{fmt(net)}</div>
                        <button type="button" onClick={() => toggleRowAdvanced(row.id)} title="Fler fält för raden" style={{ padding: '6px', background: advancedOpen ? 'var(--status-blue-bg)' : 'transparent', borderRadius: '7px', border: 'none', cursor: 'pointer', color: advancedOpen ? 'var(--status-blue-text)' : 'var(--text-muted)' }}>
                          <Settings2 size={15} />
                        </button>
                        <button type="button" onClick={() => removeRow(i)} disabled={isLocked || rows.length === 1} title="Ta bort rad" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: (isLocked || rows.length === 1) ? 'not-allowed' : 'pointer', color: (isLocked || rows.length === 1) ? 'var(--border)' : '#ef4444' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {advancedOpen && (
                        <div className="form-row-stack" style={{ marginTop: '8px', padding: '14px', background: 'var(--bg-muted)', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                          <div>
                            <label style={lbl}>Artikelnr</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                disabled={isLocked}
                                style={inp}
                                placeholder="Artnr"
                                value={row.articleNumber || ''}
                                list="article-register-list"
                                onChange={e => updateRow(i, 'articleNumber', e.target.value)}
                                // Väljs en BEFINTLIG artikel ur <datalist>-listan (blur = klart att
                                // skriva) fylls resten av raden i automatiskt — men bara då, aldrig
                                // vid varje tecken, så halvskrivna artikelnummer inte triggar en
                                // ofärdig träff mitt i inmatningen.
                                onBlur={e => {
                                  const hit = findArticleByNumber(e.target.value);
                                  if (hit) applyArticleToRow(i, hit);
                                }}
                              />
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() => saveRowAsArticle(row)}
                                  disabled={!(row.articleNumber || '').trim()}
                                  title="Spara radens artikelnr/benämning/pris/moms i artikelregistret för återanvändning"
                                  style={{ flexShrink: 0, padding: '0 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', cursor: (row.articleNumber || '').trim() ? 'pointer' : 'not-allowed', color: 'var(--text-main)', fontSize: '12.5px', fontWeight: 600 }}
                                >
                                  Spara
                                </button>
                              )}
                            </div>
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
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {!isLocked && (
              <button type="button" onClick={addRow} style={{ ...outlineToolbarBtnStyle, marginTop: '4px' }}>
                <Plus size={14} /> Lägg till rad
              </button>
            )}

            {/* Delas av alla radernas Artikelnr-fält ovan (HTML5 <datalist>
                kräver ett enda, delat id) — native webbläsarautocomplete,
                ingen egen dropdown-komponent behövs. */}
            <datalist id="article-register-list">
              {articles.map(a => (
                <option key={a.articleNumber} value={a.articleNumber}>{a.description}</option>
              ))}
            </datalist>
          </div>

          {/* Fakturatext + summering — samma enkla, enkolumns
              sammanställningsbox som QuoteEditor:s Offertsumma (Quotes.jsx),
              istället för två delvis dubblerade "Ex.Moms"/"Total excl.
              moms"-kolumner som visade samma tal två gånger. Frakt/
              fakturaavgiftsfälten hade aldrig egna state-variabler eller
              någon effekt på totalsumman (rena attrapper) — borttagna
              istället för att stå kvar och antyda en uträkning som aldrig
              faktiskt skedde. */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Fakturatext</h3>
            <textarea
              value={invoiceText} onChange={e => setInvoiceText(e.target.value)}
              style={{ ...inp, minHeight: '70px', resize: 'vertical', lineHeight: 1.6, maxWidth: '640px', marginBottom: '20px' }}
              placeholder="Hej! Tack för ditt köp hos oss."
            />

            <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '360px', marginLeft: 'auto', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Netto (exkl. moms)</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmt(totals.net)} {currency}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Moms</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmt(totals.vat)} {currency}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '4px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Att betala</span>
                <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>{fmt(totals.total)} {currency}</span>
              </div>
            </div>
          </div>

          {/* Spara/bokför — sista raden i formuläret, samma placering och
              knappstil som QuoteEditor:s "Avbryt/Spara offert". */}
          <div style={{ padding: '20px 32px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => handleSave('draft')} style={outlineToolbarBtnStyle}>
              Spara som utkast
            </button>
            <button type="button" onClick={() => handleSave('sent')} style={listHeaderButtonStyle('primary')}>
              <Check size={14} /> Bokför
            </button>
          </div>
        </div>
      </div>

      {/* ── Förhandsgranskning — öppnas nu som en fullskärmsmodal med samma
             InvoiceDocument-komponent (och samma .a4-paper-storlek, 210mm)
             som PDF-exporten fångar, istället för en 460px sidopanel skalad
             till 92% — där syntes aldrig "hela" fakturan, bara en hopklämd
             tumnagel av den. Mall/accentfärg-väljaren flyttar med hit upp
             i modalens header, ändras fortfarande direkt på DENNA faktura. ── */}
      {showPreview && (
        <div className="modal-overlay a4-preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-content a4-document-preview" onClick={e => e.stopPropagation()}>
            {/* Mobil: kontrollraden (mall/accentfärg/PDF) skrollar horisontellt
                istället för att radbryta till en hög, trång stapel — och
                headern är sticky så stäng-knappen alltid går att nå utan att
                behöva skrolla tillbaka upp genom en hel A4-sida på en liten
                skärm. */}
            <style>{`
              .invoice-preview-controls { flex-wrap: wrap; }
              @media (max-width: 640px) {
                .invoice-preview-controls { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px; }
                .invoice-preview-controls > * { flex-shrink: 0; }
              }
            `}</style>
            <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px', position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <h2 className="modal-title" style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Förhandsgranskning · Faktura {nextNum}</h2>
                <button className="modal-close" onClick={() => setShowPreview(false)} style={{ flexShrink: 0 }}><X size={18} /></button>
              </div>
              <div className="invoice-preview-controls" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {Object.values(INVOICE_TEMPLATES).map(tpl => {
                    const active = invoiceTemplateSnapshot.templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id} type="button" disabled={isLocked} title={tpl.description}
                        onClick={() => setInvoiceTemplateSnapshot(s => ({ ...s, templateId: tpl.id }))}
                        style={{
                          padding: '5px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap',
                          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent)' : 'var(--bg-card)', color: active ? 'white' : 'var(--text-main)',
                          cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.6 : 1,
                        }}
                      >{tpl.label}</button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Accentfärg</span>
                  <input
                    type="color" disabled={isLocked}
                    value={invoiceTemplateSnapshot.accentColor || INVOICE_TEMPLATES[invoiceTemplateSnapshot.templateId]?.defaultAccent || '#000000'}
                    onChange={e => setInvoiceTemplateSnapshot(s => ({ ...s, accentColor: e.target.value }))}
                    style={{ width: '32px', height: '24px', padding: '1px', border: '1px solid var(--border)', borderRadius: '4px', cursor: isLocked ? 'not-allowed' : 'pointer', background: 'var(--bg-card)', flexShrink: 0 }}
                  />
                  {isLocked && <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Låst — redan skickad</span>}
                </div>
                {/* Sida 38, punkt 4: +/- zoom som fallback till pinch — samma
                    kontrollrad som mall/accentfärg, så den redan skrollar
                    horisontellt istället för att radbryta på smala skärmar. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, border: '1px solid var(--border)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                    disabled={previewZoom <= 0.5} title="Zooma ut"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom <= 0.5 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom <= 0.5 ? 'not-allowed' : 'pointer' }}
                  ><ZoomOut size={14} /></button>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '38px', textAlign: 'center', flexShrink: 0 }}>{Math.round(previewZoom * 100)}%</span>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                    disabled={previewZoom >= 2} title="Zooma in"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom >= 2 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom >= 2 ? 'not-allowed' : 'pointer' }}
                  ><ZoomIn size={14} /></button>
                </div>
                <div style={{ flex: 1, minWidth: '8px' }} />
                <button onClick={handleDownloadPdf} disabled={pdfBusy} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: pdfBusy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Download size={13} /> {pdfBusy ? 'Skapar PDF…' : 'Ladda ner PDF'}
                </button>
              </div>
            </div>
            {pdfError && <div style={{ fontSize: '12px', color: '#c00', marginBottom: '10px' }}>{pdfError}</div>}
            {/* touch-action: pinch-zoom — bekräftar explicit att en
                tvåfingersgest inom den här skrollande ytan får zooma
                sidan (index.html:s viewport-meta sätter redan inte
                user-scalable=no/maximum-scale, så webbläsarens riktiga
                pinch-zoom fungerar oavsett — den här raden är en garanti
                mot att overflow/scroll-hanteringen tyst tar bort det om
                ytan ändras här igen senare). */}
            <div style={{ overflow: 'auto', touchAction: 'pinch-zoom' }}>
              {/* `zoom` (inte transform:scale) eftersom zoom faktiskt ändrar
                  layoutboxens storlek — scale hade lämnat kvar tomt
                  utrymme runt en förminskad sida istället för att krympa
                  ytan den upptar. Brett stöd i alla moderna motorer sedan
                  några år tillbaka (inklusive Firefox). */}
              <div style={{ zoom: previewZoom, transition: 'zoom 0.15s ease' }}>
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
          </div>
        </div>
      )}

      {/* Osynlig, alltid monterad — se kommentaren vid captureRef ovan för
          varför PDF/mejl fångar DENNA istället för förhandsgranskningen. */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '794px', pointerEvents: 'none' }} aria-hidden="true">
        <InvoiceDocument
          ref={captureRef}
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
  );
}

// ─── Main Invoicing Component ─────────────────────────────────────────────────
const SORTABLE_COLUMNS = {
  invoiceNumber: (inv) => Number(inv.invoiceNumber) || 0,
  date: (inv) => inv.date || '',
  dueDate: (inv) => inv.dueDate || '',
  amount: (inv) => grossOf(inv),
};

// Sida 31: tomt läge med en riktig, storskalig linjeillustration av ett
// dokument (i brandgrönt, mot en cremefärgad yta) istället för en liten
// ikon-i-cirkel — det gemensamma illustrationsspråket för "inga X än"-lägen.
// Fortfarande ett genuint tomt läge (inte en enda liten rad i en annars tom
// sida) — fyller den tillgängliga höjden istället för att lämna en stor grå
// yta under en enda liten textrad.
function InvoiceDocIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <rect x="30" y="16" width="60" height="88" rx="8" stroke={BRAND.green} strokeWidth="2.5" />
      <path d="M68 16v18a4 4 0 0 0 4 4h18" stroke={BRAND.green} strokeWidth="2.5" strokeLinejoin="round" fill="none" opacity="0.5" />
      <line x1="42" y1="52" x2="78" y2="52" stroke={BRAND.green} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <line x1="42" y1="64" x2="78" y2="64" stroke={BRAND.green} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <line x1="42" y1="76" x2="62" y2="76" stroke={BRAND.green} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <circle cx="86" cy="86" r="16" fill={BRAND.greenLight} stroke={BRAND.green} strokeWidth="2.5" />
      <path d="M80 86l4 4 8-8" stroke={BRAND.greenDark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function InvoiceEmptyState({ isFilteredEmpty, onCreate }) {
  const { title, body } = isFilteredEmpty
    ? { title: 'Inga fakturor matchar din sökning', body: 'Prova att rensa sökningen eller filtren ovan.' }
    : { title: 'Inga fakturor än', body: 'Skapa din första faktura för att komma igång med fakturering.' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px', background: isFilteredEmpty ? 'var(--bg-card)' : 'var(--bg-cream)', textAlign: 'center' }}>
      {isFilteredEmpty ? (
        <div style={{ width: 56, height: 56, borderRadius: '999px', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <FileText size={26} />
        </div>
      ) : (
        <div style={{ marginBottom: '4px' }}>
          <InvoiceDocIllustration />
        </div>
      )}
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{title}</div>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', margin: 0 }}>{body}</p>
      {!isFilteredEmpty && (
        <button onClick={onCreate} className="btn btn-primary" style={{ marginTop: '8px' }}>
          <Plus size={15} /> Skapa faktura
        </button>
      )}
    </div>
  );
}

// ─── Fakturavisning (läsläge) ───────────────────────────────────────────────
// "Visa faktura" i radmenyn ska faktiskt bara VISA fakturan — samma riktiga
// InvoiceDocument-komponent som PDF-export/mejl/förhandsgranskning redan
// använder, inbäddad rakt på sidan (som QuoteEditor, inget formulär bakom
// en modal) — inte det stora redigeringsformuläret i skrivläge. Ingen egen
// state för fält/rader: allt kommer direkt från den sparade fakturan.
const emptyInvoiceViewerCustomer = { name: 'Okänd kund', email: '', address: '', orgNr: '', contactPerson: '' };

function InvoiceViewer({ invoice, contacts, company, status, onClose, onEdit }) {
  const customer = contacts.find(c => c.id === invoice.customerId)
    || { ...emptyInvoiceViewerCustomer, name: invoice.customerName || emptyInvoiceViewerCustomer.name };

  const rows = invoice.rows || [];
  // Samma beräkning som InvoiceForm/radlistan (calcRow/grossOf) — dupliceras
  // hellre lokalt (litet, rent uttryck) än att dra in hela redigeringsformuläret
  // bara för att komma åt en totalsumma.
  const totals = rows.reduce((acc, r) => {
    const gross = (Number(r.qty) || 0) * (Number(r.unitPrice) || 0) * (1 - (Number(r.discount) || 0) / 100);
    return { net: acc.net + gross, vat: acc.vat + gross * ((Number(r.vatRate) || 0) / 100), total: acc.total + gross * (1 + (Number(r.vatRate) || 0) / 100) };
  }, { net: 0, vat: 0, total: 0 });

  const statusStyle = {
    paid: { bg: BRAND.greenLight, color: BRAND.greenDark, label: 'Betald' },
    overdue: { bg: BRAND.redBg, color: BRAND.redText, label: 'Förfallen' },
    sent: { bg: BRAND.amberBg, color: BRAND.amberText, label: 'Obetald' },
    draft: { bg: BRAND.grayBg, color: BRAND.grayText, label: 'Ej bokförd' },
  }[status] || { bg: BRAND.grayBg, color: BRAND.grayText, label: 'Ej bokförd' };

  const tpl = invoice.invoiceTemplateSnapshot || {};
  const documentProps = {
    invoice: { invoiceNumber: invoice.invoiceNumber, date: invoice.date, dueDate: invoice.dueDate, terms: invoice.terms },
    customer, company, rows, totals,
    currency: invoice.currency || 'SEK',
    invoiceText: invoice.invoiceText || '',
    template: tpl.templateId, accentColor: tpl.accentColor, logoUrl: tpl.logoUrl, footerText: tpl.footerText,
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const captureRef = useRef(null);

  const handleDownloadPdf = async () => {
    setPdfBusy(true); setPdfError('');
    try {
      await exportInvoicePdf(captureRef.current, `Faktura-${invoice.invoiceNumber}.pdf`);
    } catch {
      setPdfError('Kunde inte skapa PDF. Försök igen.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
      {/* ── Top bar — samma mönster som QuoteEditor: sticky, 18px titel +
          statusmärke till vänster, åtgärder till höger. ── */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Tillbaka
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Faktura {invoice.invoiceNumber}</h1>
          <span style={{ padding: '4px 10px', background: statusStyle.bg, color: statusStyle.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{statusStyle.label}</span>
        </div>
        <div style={{ flex: 1, minWidth: '8px' }} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {pdfError && <span style={{ fontSize: '11px', color: 'var(--status-red-text)' }}>{pdfError}</span>}
          <button type="button" onClick={handleDownloadPdf} disabled={pdfBusy} style={{ ...listHeaderButtonStyle('secondary'), opacity: pdfBusy ? 0.6 : 1 }}>
            <Download size={14} /> {pdfBusy ? 'Skapar PDF…' : 'Ladda ner PDF'}
          </button>
          <button type="button" onClick={onEdit} style={listHeaderButtonStyle('primary')}>
            <Pencil size={14} /> Redigera
          </button>
        </div>
      </div>

      {/* ── Dokumentet — full bredd, inbäddat direkt i sidan, ingen modal. ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '900px' }}>
          <InvoiceDocument {...documentProps} />
        </div>
      </div>

      {/* Osynlig, fast 794px-bred kopia för PDF-export — samma mönster (och
          samma skäl) som InvoiceForm redan använder: html2canvas ska alltid
          fånga en garanterat A4-bred nod, oavsett hur brett den synliga
          kopian ovan råkar renderas. */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '794px', pointerEvents: 'none' }} aria-hidden="true">
        <InvoiceDocument ref={captureRef} {...documentProps} />
      </div>
    </div>
  );
}


// ─── Höger sektion på Fakturering: Leverantörsfakturor ─────────────────────
// Riktig data (samma `expenses`-poster som den fristående Leverantörs-
// fakturor-sidan), inte en förenklad attrapp — men kompakt, utan flerrads-
// kontering/filuppladdning. "Ny leverantörsfaktura" och "Visa alla" öppnar
// den fullständiga sidan för det som faktiskt kräver mer plats.
function SupplierInvoicesPanel({ expenses, contacts, onMarkPaid, onOpenFull, onOpenInvoice, onCreateNew }) {
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
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '14px 16px 0', display: 'flex', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Inbox size={16} /> Leverantörsfakturor
        </h1>
        <div style={{ flex: 1 }} />
        <button onClick={onOpenFull} style={{ padding: '4px 10px 12px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>Visa alla</button>
        <button onClick={onCreateNew} style={{ ...listHeaderButtonStyle('primary'), marginBottom: '10px' }}>
          <Plus size={13} /> Ny leverantörsfaktura
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, flexWrap: 'wrap' }}>
        {statusOptions.map(opt => {
          const isActive = statusFilter === opt.value;
          const count = opt.value === 'all' ? list.length : (statusCounts[opt.value] || 0);
          if (opt.value !== 'all' && count === 0) return null;
          const isNeutral = opt.value === 'all';
          return (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value)} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
              background: isNeutral ? (isActive ? 'var(--accent)' : 'var(--bg-card)') : opt.bg,
              border: isNeutral ? `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}` : `1.5px solid ${isActive ? opt.color : 'transparent'}`,
              borderRadius: '999px', fontSize: '12px', fontWeight: isActive ? 700 : 500,
              color: isNeutral ? (isActive ? 'white' : 'var(--text-main)') : opt.color, cursor: 'pointer',
            }}>
              {opt.label}
              {count > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                  background: isNeutral ? (isActive ? 'rgba(255,255,255,0.25)' : 'var(--border)') : 'var(--status-chip-bg)',
                  color: isNeutral ? (isActive ? 'white' : 'var(--text-secondary)') : opt.color,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px', background: 'var(--bg-card)', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Inbox size={28} style={{ color: 'var(--border)' }} />
          <div style={{ fontSize: '13.5px' }}>{list.length === 0 ? 'Inga leverantörsfakturor registrerade än.' : 'Inga fakturor i det här filtret.'}</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr>
                {['LEVERANTÖR', 'FAKTURANR', 'FAKTURADATUM', 'FÖRFALLER', 'BELOPP', ''].map((h, i) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: i === 4 ? 'right' : 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-muted)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(inv => {
                const status = getStatus(inv);
                const supplier = contacts.find(c => c.id === inv.supplierId);
                return (
                  <tr key={inv.id} style={{ background: getRowBg(status === 'sent' ? 'sent' : status), borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onOpenInvoice?.(inv)}>
                    <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text-main)' }}>{supplier?.name || 'Okänd leverantör'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>#{inv.invoiceNumber}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{formatDate(inv.date)}</td>
                    <td style={{ padding: '8px 10px', color: status === 'overdue' ? BRAND.redText : 'var(--text-secondary)', fontWeight: status === 'overdue' ? 700 : 400 }}>{formatDate(inv.dueDate)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>{fmt(inv.amount)}</td>
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

// ─── Artikelregister ───────────────────────────────────────────────────────
// Fristående lista/redigering av det sparade artikelregistret (samma
// `articles` som fylls i via fakturaradernas "Spara"-knapp och <datalist>,
// se InvoiceForm ovan) — så registret går att bygga upp och städa i utan att
// först behöva öppna en faktura.
function ArticleRegisterModal({ articles, setArticles, onClose }) {
  const empty = { articleNumber: '', description: '', unitPrice: 0, vatRate: 25, account: '3001' };
  const [editing, setEditing] = useState(null); // null = ingen redigeras, annars ett utkast (nytt eller befintligt)
  const [importMsg, setImportMsg] = useState(null);
  const importFileRef = useRef(null);

  const startNew = () => setEditing({ ...empty });
  const startEdit = (a) => setEditing({ ...a });

  const handleExportCsv = () => downloadCsv(`artiklar_${new Date().toISOString().split('T')[0]}.csv`, articlesToCsv(articles));
  const handleImportClick = () => importFileRef.current?.click();
  // Uppdaterar (matchar på artikelnr) om artikeln redan finns, annars lägger
  // till en ny — samma upsert-princip som "Spara"-knappen på fakturaraden.
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = csvToArticles(ev.target.result);
        if (imported.length === 0) throw new Error('Inga giltiga rader hittades (kräver minst ett "Artikelnr").');
        let added = 0, updated = 0;
        setArticles(prev => {
          const next = [...prev];
          imported.forEach(item => {
            const key = item.articleNumber.trim().toLowerCase();
            const idx = next.findIndex(a => (a.articleNumber || '').trim().toLowerCase() === key);
            if (idx === -1) { next.push(item); added++; }
            else { next[idx] = item; updated++; }
          });
          return next;
        });
        setImportMsg({ type: 'success', text: `${added} ny${added === 1 ? '' : 'a'}, ${updated} uppdaterad${updated === 1 ? '' : 'e'}.` });
      } catch (err) {
        setImportMsg({ type: 'error', text: `Kunde inte importera: ${err.message}` });
      }
      setTimeout(() => setImportMsg(null), 6000);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const save = () => {
    const num = (editing.articleNumber || '').trim();
    if (!num) return;
    setArticles(prev => {
      const key = num.toLowerCase();
      const idx = prev.findIndex(a => (a.articleNumber || '').trim().toLowerCase() === key);
      const next = { ...editing, articleNumber: num };
      if (idx === -1) return [...prev, next];
      return prev.map((a, i) => i === idx ? next : a);
    });
    setEditing(null);
  };

  const remove = (num) => {
    if (!window.confirm(`Ta bort artikel "${num}" från registret? Redan sparade fakturor påverkas inte.`)) return;
    setArticles(prev => prev.filter(a => a.articleNumber !== num));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', width: '100%', maxWidth: '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>Artikelregister</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handleExportCsv} title="Exportera artiklar som CSV" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              <Download size={13} /> Exportera
            </button>
            <button onClick={handleImportClick} title="Importera artiklar från CSV" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              <Upload size={13} /> Importera
            </button>
            <input type="file" ref={importFileRef} accept=".csv" style={{ display: 'none' }} onChange={handleImportFile} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
        </div>
        {importMsg && (
          <div style={{ margin: '10px 20px 0', padding: '8px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', background: importMsg.type === 'success' ? 'var(--status-green-bg)' : 'var(--status-red-bg)', color: importMsg.type === 'success' ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
            {importMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {importMsg.text}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px' }}>
          {editing ? (
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={lbl}>Artikelnr</label>
                <input style={inp} value={editing.articleNumber} onChange={e => setEditing(s => ({ ...s, articleNumber: e.target.value }))} placeholder="t.ex. 1001" />
              </div>
              <div>
                <label style={lbl}>Konto</label>
                <input style={inp} value={editing.account} onChange={e => setEditing(s => ({ ...s, account: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Benämning</label>
                <input style={inp} value={editing.description} onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} placeholder="Beskrivning av tjänst eller produkt" />
              </div>
              <div>
                <label style={lbl}>Pris (exkl. moms)</label>
                <input type="number" style={inp} value={editing.unitPrice} onChange={e => setEditing(s => ({ ...s, unitPrice: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={lbl}>Moms</label>
                <select style={inp} value={editing.vatRate} onChange={e => setEditing(s => ({ ...s, vatRate: Number(e.target.value) }))}>
                  {[0, 6, 12, 25].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditing(null)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', cursor: 'pointer', fontSize: '13px' }}>Avbryt</button>
                <button onClick={save} disabled={!editing.articleNumber.trim()} style={{ padding: '6px 14px', border: 'none', borderRadius: '5px', background: 'var(--accent)', color: 'white', fontWeight: 700, cursor: editing.articleNumber.trim() ? 'pointer' : 'not-allowed', fontSize: '13px' }}>Spara</button>
              </div>
            </div>
          ) : (
            <button onClick={startNew} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', marginBottom: '12px', background: 'var(--accent)', border: 'none', borderRadius: '5px', fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
              <Plus size={14} /> Ny artikel
            </button>
          )}

          {articles.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Inga artiklar sparade ännu. Lägg till en här, eller tryck "Spara" på en fakturarad.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontSize: '11px' }}>Artikelnr</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontSize: '11px' }}>Benämning</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontSize: '11px' }}>Pris</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontSize: '11px' }}>Moms</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {articles.map(a => (
                  <tr key={a.articleNumber} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '6px 8px' }}>{a.articleNumber}</td>
                    <td style={{ padding: '6px 8px' }}>{a.description}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(a.unitPrice)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{a.vatRate}%</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => startEdit(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1565c0', fontSize: '12px', marginRight: '8px' }}>Ändra</button>
                      <button onClick={() => remove(a.articleNumber)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Kundrapporterad bugg: raden "Skapa betalningslänk" gjorde tidigare
 * window.location.href = url rakt av — navigerade bort BOKFÖRARENS EGEN
 * flik till kundens betalsida, istället för att ge en länk att dela.
 * Visar nu länken i en dialog med en riktig Kopiera-knapp, plus ett
 * valfritt "skicka med e-post"-fält (samma sendInvoiceEmail-relä och
 * "Betala nu"-knappstil som InvoiceForm redan bygger när Stripe är
 * anslutet, se paymentLinkUrl-grenen i handleSendEmail ovan).
 *
 * Betalningsmottagare (kundfråga): pengarna landar direkt hos FÖRETAGETS
 * egna anslutna Stripe-konto, inte hos Bokix — betalningen skapas som en
 * "direct charge" direkt PÅ det anslutna kontot (se create-checkout-
 * session.js:s kommentar). Bokix egen avgift (Stripes verkliga avgift +
 * 1% marginal, dynamisk — se samma fil) transfereras separat till Bokix
 * efter varje betalning, styrt av Stripes Platform Pricing Tool i
 * Dashboard, inte av något värde den här filen räknar ut. Den här
 * komponenten ändrar inget i det flödet, den visar bara den redan
 * skapade länken.
 */
function PaymentLinkModal({ invoice, customer, company, onGetPaymentLinkUrl, onClose, onMarkSent }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState(customer?.email || '');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const generatedUrl = await onGetPaymentLinkUrl(invoice.id);
        if (cancelled) return;
        setUrl(generatedUrl);
        onMarkSent?.(invoice.id);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Kunde inte skapa betalningslänk.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-API:et kan nekas (osäker kontext, behörighet m.m.) — inte
      // kritiskt, länken syns ändå i fältet ovan och går att markera/
      // kopiera för hand.
    }
  };

  const handleSendEmail = async () => {
    const to = emailTo.trim();
    if (!to) { setEmailError('Ange en mottagaradress.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(to)) { setEmailError('Det där ser inte ut som en giltig e-postadress.'); return; }
    setEmailBusy(true); setEmailError(''); setEmailSent(false);
    try {
      const html = `
        <p>Hej${customer?.contactPerson ? ' ' + customer.contactPerson : ''},</p>
        <p>Här är en betalningslänk för faktura <strong>${invoice.invoiceNumber}</strong> på <strong>${fmt(grossOf(invoice))} kr</strong>.</p>
        <p style="margin: 20px 0;">
          <a href="${url}" style="display:inline-block;padding:12px 26px;background:#3d7a2e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Betala nu</a>
        </p>
        <p>Med vänlig hälsning<br/>${(company?.invoiceDisplayName || company?.name) || ''}</p>
      `;
      await sendInvoiceEmail({
        to,
        subject: `Betalningslänk – faktura ${invoice.invoiceNumber}`,
        html,
        replyTo: company?.email || undefined,
        company_id: company?.id,
      });
      setEmailSent(true);
    } catch (err) {
      setEmailError(err.message || 'Kunde inte skicka e-post.');
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Betalningslänk — faktura {invoice.invoiceNumber}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Skapar länk...</div>
          ) : error ? (
            <div style={{ fontSize: '13px', color: 'var(--status-red-text)', fontWeight: 600 }}>{error}</div>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>Länk</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input
                  type="text" readOnly value={url || ''}
                  onFocus={e => e.target.select()}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-muted)', color: 'var(--text-main)' }}
                />
                <button type="button" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: copied ? 'var(--status-green-bg)' : 'var(--accent)', color: copied ? 'var(--status-green-text)' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied ? <><Check size={14} /> Kopierad!</> : <><Copy size={14} /> Kopiera</>}
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Skicka med e-post (valfritt)</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="email" value={emailTo} onChange={e => { setEmailTo(e.target.value); setEmailError(''); }}
                    placeholder="kund@foretag.se"
                    style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                  <button
                    type="button" onClick={handleSendEmail} disabled={emailBusy || !emailTo.trim()}
                    style={{ padding: '9px 16px', background: (emailBusy || !emailTo.trim()) ? 'var(--border)' : 'var(--accent)', color: (emailBusy || !emailTo.trim()) ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: (emailBusy || !emailTo.trim()) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {emailBusy ? 'Skickar...' : 'Skicka'}
                  </button>
                </div>
                {emailError && <div style={{ fontSize: '12px', color: 'var(--status-red-text)', marginTop: '8px' }}>{emailError}</div>}
                {emailSent && !emailError && <div style={{ fontSize: '12px', color: 'var(--status-green-text)', fontWeight: 600, marginTop: '8px' }}>Skickad ✓</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Invoices({ invoices, contacts, onAdd, onMarkPaid, onRegisterPayment, onUnmarkPaid, setInvoices, company, globalAction, clearGlobalAction, onNavigate, verifications = [], expenses = [], onMarkSupplierInvoicePaid, handleGlobalAction, onGetPaymentLinkUrl, articles = [], setArticles }) {
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

  // Vilken faktura PaymentLinkModal (ovan) just nu är öppen för — null när
  // stängd. Håller själva fakturaobjektet (inte bara ett id) så modalen
  // slipper leta rätt på den igen i en lista som kan hinna ändras.
  const [paymentLinkInvoice, setPaymentLinkInvoice] = useState(null);

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
  const [invoicePrefill, setInvoicePrefill] = useState(null); // t.ex. från Tidrapportering → "Skapa faktura"
  // "Visa faktura" (radmenyn) ≠ "Redigera" — ett skilt, rent läsläge som
  // bara renderar den riktiga fakturan (InvoiceViewer/InvoiceDocument),
  // aldrig det stora redigeringsformuläret. Eget state, ömsesidigt
  // uteslutande med showForm (se closeForm/openInvoice/viewInvoice nedan).
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showArticleRegister, setShowArticleRegister] = useState(false);
  // Fakturorna visas i tydligt rubrikerade sektioner per status (Förfallen/
  // Obetald/Ej bokförd/Betald) istället för en enda blandad lista — piller-
  // knapparna ovanför hoppar ner till respektive sektion.
  const sectionRefs = useRef({});

  useEffect(() => {
    if (globalAction?.type === 'new_invoice') {
      setShowForm(true); setEditingInvoice(null);
      setInvoicePrefill(globalAction.payload || null);
      clearGlobalAction?.();
    }
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

  // Bugkritiskt: "Tillbaka"/"Visa lista" kunde se ut att inte göra något
  // alls — stänger man formuläret utan att effekten nedan ("Delade länkar")
  // hinner se den redan rensade ?invoiceId= innan den kör, öppnar den tyst
  // upp SAMMA faktura igen direkt efter att man stängt den. Att rensa
  // parametern i samma händelse som stänger formuläret (som gjordes här
  // tidigare) räcker INTE i sig — setSearchParams gör en riktig
  // routernavigering, och det finns inga garantier för att den hinner slå
  // igenom innan effekten nedan läser `searchParams` på nästa körning.
  // suppressReopenRef är en explicit spärr istället för att lita på exakt
  // batchning mellan lokal React-state och react-router: precis efter en
  // avsiktlig stängning hoppar effekten över EN körning, oavsett om URL:en
  // hunnit uppdateras än eller inte.
  const suppressReopenRef = useRef(false);

  const closeForm = () => {
    suppressReopenRef.current = true;
    setShowForm(false);
    setEditingInvoice(null);
    setInvoicePrefill(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('invoiceId');
      return next;
    }, { replace: true });
  };

  const handleSaveInvoice = (data) => {
    if (editingInvoice) {
      setInvoices(prev => prev.map(i => i.id === editingInvoice.id ? { ...i, ...data } : i));
    } else {
      onAdd({ ...data, invoiceNumber: getNextInvoiceNumber(invoiceList, company) });
    }
    closeForm();
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
    closeForm();
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
    closeForm();
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

  // Bara utkast (aldrig bokförda) kan tas bort — samma princip som
  // isLocked i InvoiceForm: en faktura som är skickad/bokförd har en
  // riktig verifikation och ett fakturanummer som redan kan vara känt
  // hos kunden, den korrigeras med en kreditfaktura, den raderas inte.
  // Ett utkast har ingen sådan koppling än, så det går att bara ta bort.
  const handleDeleteInvoice = (inv, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Ta bort utkastet ${inv.invoiceNumber}? Det går inte att ångra.`)) return;
    setInvoices(prev => prev.filter(i => i.id !== inv.id));
  };

  // Manuell "markera som skickad" för utkast — samma statusövergång som
  // redan sker automatiskt när man faktiskt mejlar fakturan från formuläret
  // (se `handleSave('sent')`-anropet i InvoiceForm), men som en fristående
  // åtgärd för den som skickat fakturan på annat sätt (post, en annan
  // kanal) och bara vill flytta den ur "Ej bokförd" utan att mejla via appen.
  const handleMarkSent = (inv, e) => {
    e?.stopPropagation();
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'sent' } : i));
  };

  // Radens "⋮"-meny — vilka åtgärder som visas beror på fakturans status,
  // samma indelning som konkurrentens fakturalista (utkast/skickad/betald
  // ser olika ut), fast med våra egna färger/komponent (RowActionMenu).
  const openInvoice = (inv) => { setViewingInvoice(null); setEditingInvoice(inv); setInvoicePrefill(null); setShowForm(true); };
  const viewInvoice = (inv) => { setShowForm(false); setEditingInvoice(null); setViewingInvoice(inv); };

  const buildInvoiceRowMenuItems = (inv, status, customer) => {
    const items = [
      { key: 'view', label: 'Visa faktura', icon: Eye, onClick: () => viewInvoice(inv) },
    ];
    if (status !== 'paid') {
      items.push({ key: 'edit', label: 'Redigera', icon: Pencil, onClick: () => openInvoice(inv) });
      items.push({ key: 'mark-paid', label: 'Markera som betald', icon: CheckCircle2, onClick: () => onMarkPaid(inv.id) });
    }
    // "Registrera betalning" (koppling mot en verifikation/inbetalning)
    // sköts redan inne i fakturaformuläret — den här raden öppnar dit
    // istället för att duplicera det flödet i menyn.
    items.push({ key: 'link-transaction', label: 'Koppla till transaktion', icon: Link2, onClick: () => openInvoice(inv) });
    if (status !== 'paid' && onGetPaymentLinkUrl) {
      // Bugfix (kundrapport: "Skapa betalningslänk funkar inte" — knappen
      // grå trots att Stripe var anslutet): krävde tidigare att kunden
      // eller företaget hade en sparad e-post, men en e-postadress är bara
      // valfri förifyllnad i Stripe Checkout (create-checkout-session.js),
      // aldrig ett krav — Stripe frågar payern själv om den saknas. Enda
      // faktiska kravet är att Stripe är anslutet. Se samma borttagna krav
      // i App.jsx:s getInvoicePaymentLinkUrl.
      //
      // Öppnar PaymentLinkModal (ovan) istället för att navigera bort
      // direkt — se den komponentens filkommentar för varför.
      const canCreateLink = Boolean(company?.stripeAccountId);
      items.push({
        key: 'payment-link', label: 'Skapa betalningslänk', icon: CreditCard,
        onClick: () => setPaymentLinkInvoice({ invoice: inv, customer }),
        disabled: !canCreateLink,
        title: !canCreateLink ? 'Anslut Stripe under Inställningar för att låta kunder betala med kort' : undefined,
      });
    }
    items.push({ key: 'duplicate', label: 'Kopiera faktura', icon: Copy, onClick: () => handleDuplicateInvoice(inv) });

    if (status === 'draft') {
      items.push({ divider: true });
      items.push({ key: 'mark-sent', label: 'Markera som skickad', icon: Send, onClick: (e) => handleMarkSent(inv, e) });
    } else if (status !== 'paid') {
      items.push({ divider: true });
      // Bugfix (kodgranskning): tappade isOverdue-kollen som fanns innan
      // listan byggdes om till RowActionMenu — utan den erbjöd menyn en
      // "påminnelse"-knapp även för en nyss skickad faktura som inte ens
      // förfallit än, inte bara faktiskt förfallna.
      if (isOverdue(inv)) {
        items.push({
          key: 'remind', label: 'Skicka påminnelse', icon: Send,
          onClick: () => { window.location.href = buildReminderMailto(inv, customer); },
          disabled: !customer?.email,
          title: !customer?.email ? 'Lägg till kundens e-post under Kunder för att kunna skicka en påminnelse' : undefined,
        });
      }
      items.push({ key: 'credit', label: 'Kreditera faktura', icon: Undo2, onClick: () => handleCreateCreditNote(inv) });
    } else {
      items.push({ divider: true });
      items.push({ key: 'credit', label: 'Kreditera faktura', icon: Undo2, onClick: () => handleCreateCreditNote(inv) });
    }

    if (status === 'draft') {
      items.push({ divider: true });
      items.push({ key: 'delete', label: 'Ta bort', icon: Trash2, variant: 'danger', onClick: (e) => handleDeleteInvoice(inv, e) });
    }
    return items;
  };

  // En tabellrad — bruten ut till en egen funktion eftersom den nu renderas
  // en gång per statussektion istället för i en enda blandad tabell.
  // Kolumner för den delade ListTable-komponenten (samma tabell som
  // Kunder/Anställda/Bokföring m.fl. använder) — en kolumn per synlig
  // rubrik, `sortKeyName` på de tre som redan gick att sortera på.
  const invoiceColumns = [
    { key: 'invoiceNumber', label: 'Fakturanr', sortKeyName: 'invoiceNumber', fontWeight: 700, color: 'var(--text-main)', render: inv => inv.invoiceNumber },
    { key: 'customer', label: 'Kund', fontWeight: 500, color: 'var(--text-main)', render: inv => getCustomerName(inv.customerId) },
    { key: 'date', label: 'Fakturadatum', sortKeyName: 'date', render: inv => formatDate(inv.date) },
    {
      key: 'dueDate', label: 'Förfallodatum', sortKeyName: 'dueDate',
      render: inv => <span style={{ color: isOverdue(inv) ? 'var(--status-red-text)' : 'var(--text-secondary)', fontWeight: isOverdue(inv) ? 700 : 400 }}>{formatDate(inv.dueDate)}</span>,
    },
    { key: 'amount', label: 'Belopp', align: 'right', sortKeyName: 'amount', fontWeight: 600, color: 'var(--text-main)', render: inv => fmt(grossOf(inv)) },
    {
      key: 'status', label: 'Status', render: inv => {
        const status = getStatus(inv);
        return (
          <div onClick={e => e.stopPropagation()}>
            {status === 'paid' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: STRONG_PAID.bg, color: STRONG_PAID.text }}>
                <Check size={12} /> Betald{inv.paidDate ? ` ${formatDate(inv.paidDate)}` : ''}
              </span>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onMarkPaid(inv.id); }}
                title="Klicka för att markera som betald"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: status === 'overdue' ? BRAND.redBg : status === 'draft' ? BRAND.grayBg : STRONG_UNPAID.bg,
                  color: status === 'overdue' ? BRAND.redText : status === 'draft' ? BRAND.grayText : STRONG_UNPAID.text,
                }}
              >
                {status === 'overdue' ? 'Förfallen' : status === 'draft' ? 'Ej bokförd' : 'Obetald'}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions', label: '', align: 'right', render: inv => (
        <div onClick={e => e.stopPropagation()}>
          <RowActionMenu ariaLabel={`Fler åtgärder för faktura ${inv.invoiceNumber}`} items={buildInvoiceRowMenuItems(inv, getStatus(inv), contacts.find(c => c.id === inv.customerId))} />
        </div>
      ),
    },
  ];

  // Delade länkar: fakturans ID hålls i URL:en (?invoiceId=...) så en
  // delad länk alltid öppnar rätt faktura, och byte av faktura/stängning
  // håller URL:en i synk.
  useEffect(() => {
    if (suppressReopenRef.current) { suppressReopenRef.current = false; return; }
    const id = searchParams.get('invoiceId');
    if (id && !showForm) {
      const found = invoices.find(i => i.id === id);
      if (found) { setEditingInvoice(found); setInvoicePrefill(null); setShowForm(true); }
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

  if (viewingInvoice) {
    return (
      <InvoiceViewer
        invoice={viewingInvoice}
        contacts={contacts}
        company={company}
        status={getStatus(viewingInvoice)}
        onClose={() => setViewingInvoice(null)}
        onEdit={() => openInvoice(viewingInvoice)}
      />
    );
  }

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
        // Bugkritiskt: utan en key som ändras när VILKEN faktura som redigeras
        // ändras, återanvänder React samma InvoiceForm-instans — dess interna
        // useState (customerId/rows/datum m.m.) sätts bara EN gång vid första
        // mount och nollställs aldrig om man t.ex. klickar nav-pilen till nästa
        // faktura medan formuläret är öppet. Då sparas den förra fakturans
        // rader/kund tyst över den nya som är öppen (editingInvoice.id är rätt,
        // men fältvärdena är kvar från föregående faktura).
        key={editingInvoice?.id || (invoicePrefill ? `prefill-${invoicePrefill.sourceKey || 'x'}` : 'new')}
        contacts={contacts}
        company={company}
        initial={editingInvoice}
        prefill={invoicePrefill}
        articles={articles}
        setArticles={setArticles}
        onSave={handleSaveInvoice}
        onCreateCreditNote={handleCreateCreditNote}
        onMarkPaid={onMarkPaid}
        onRegisterPayment={onRegisterPayment}
        onUnmarkPaid={onUnmarkPaid}
        onUpdateNote={handleUpdateInvoiceNote}
        verifications={verifications}
        invoiceList={invoiceList}
        nav={nav}
        onGetPaymentLinkUrl={onGetPaymentLinkUrl}
        onClose={closeForm}
      />
    );
  }

  // Fyra verkliga statusar (getStatus() returnerar aldrig något annat) —
  // samma bg/text-färgpar här som på radernas egna statusmärken, och samma
  // mönster som Granskning-sidans badges: räknaren syns bara om > 0.
  const statusOptions = [
    { value: 'all', label: 'Alla' },
    { value: 'draft', label: 'Ej bokförd', bg: BRAND.grayBg, color: BRAND.grayText },
    { value: 'sent', label: 'Obetald', bg: STRONG_UNPAID.bg, color: STRONG_UNPAID.text, strong: true },
    { value: 'overdue', label: 'Förfallen', bg: BRAND.redBg, color: BRAND.redText },
    { value: 'paid', label: 'Betald', bg: STRONG_PAID.bg, color: STRONG_PAID.text, strong: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--bg-page)' }}>
      {/* Två tydligt avgränsade sektioner — varje väljs för sig och fyller
          då hela bredden, inte en sida-vid-sida-klämd vy. Bara dessa två
          flikar; resten av den gamla flikraden (Inbetalningar/Påminnelser/
          Återkommande/Offerter) är fortsatt borttagen. */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        {[{ id: 'kunder', label: 'Kundfakturor' }, { id: 'leverantorer', label: 'Leverantörsfakturor' }].map(t => (
          <button key={t.id} onClick={() => setSection(t.id)} style={{
            padding: '12px 14px', border: 'none',
            borderBottom: section === t.id ? '3px solid var(--accent)' : '3px solid transparent',
            background: 'none', fontSize: '14px', fontWeight: section === t.id ? 700 : 500,
            color: section === t.id ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => onNavigate?.('reports')} style={{ padding: '4px 14px 12px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>Rapporter</button>
        <button onClick={() => setShowArticleRegister(true)} style={{ padding: '4px 14px 12px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>Artiklar</button>
        <button onClick={() => onNavigate?.('contacts')} style={{ padding: '4px 14px 12px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>Kunder ↓</button>
      </div>
      {showArticleRegister && (
        <ArticleRegisterModal articles={articles} setArticles={setArticles} onClose={() => setShowArticleRegister(false)} />
      )}

    {section === 'kunder' && (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Fakturanr eller kundnamn" value={searchInput} onChange={e => setSearchInput(e.target.value)} style={{ ...listSearchInputStyle, width: '220px' }} />
          </div>
          <button onClick={() => setShowExtendedSearch(v => !v)} style={{ ...listHeaderButtonStyle('secondary'), ...(showExtendedSearch ? { background: 'var(--status-blue-bg)', borderColor: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' } : {}) }}>Utökad sökning</button>
          <button onClick={() => { setSearchInput(''); setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax(''); }} title="Rensa sökning" style={{ ...listHeaderButtonStyle('secondary'), padding: '0 10px' }}><RefreshCw size={14} /></button>
          <div style={{ flex: 1 }} />
          <button data-tour="page-invoices-cta" onClick={() => { setShowForm(true); setEditingInvoice(null); setInvoicePrefill(null); }} style={listHeaderButtonStyle('primary')}>
            <Plus size={14} /> Skapa faktura
          </button>
        </div>
        {showExtendedSearch && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'end', background: 'var(--bg-muted)' }}>
            <div>
              <label style={lbl}>Datum från</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...listFilterFieldStyle, width: '150px' }} />
            </div>
            <div>
              <label style={lbl}>Datum till</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...listFilterFieldStyle, width: '150px' }} />
            </div>
            <div>
              <label style={lbl}>Belopp från</label>
              <input type="number" value={amountMin} onChange={e => setAmountMin(e.target.value)} placeholder="0" style={{ ...listFilterFieldStyle, width: '110px' }} />
            </div>
            <div>
              <label style={lbl}>Belopp till</label>
              <input type="number" value={amountMax} onChange={e => setAmountMax(e.target.value)} placeholder="—" style={{ ...listFilterFieldStyle, width: '110px' }} />
            </div>
          </div>
        )}
      </div>

      {/* Statuspiller — hoppar ner till respektive sektion istället för att
          filtrera bort de andra, eftersom fakturorna nu visas indelade i
          sektioner samtidigt (se nedan). */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, flexWrap: 'wrap' }}>
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
              {/* Kraftfulla (obetald/betald) badges har numera en heltäckande,
                  mättad bakgrund — den vanliga --status-chip-bg (en
                  ~55%-vit overlay tänkt för bleka pastellbakgrunder) skulle
                  bli en urblekt fläck ovanpå en mörk grön/orange yta med
                  näst intill osynlig vit text. Egen vit halvtransparent
                  "glas"-variant för just de här istället, samma recept som
                  färgade etiketter med räknare i andra produkter. */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                background: opt.strong ? 'rgba(255,255,255,0.28)' : 'var(--status-chip-bg)',
                color: opt.strong ? '#ffffff' : opt.color,
              }}>{count}</span>
            </button>
          );
        })}
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>{sorted.length} poster</span>
        <div style={{ flex: 1 }} />
        <Printer size={15} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} />
      </div>

      {/* Sektioner — fakturorna delas upp i egna rubrikerade sektioner per
          status (Förfallen/Obetald/Ej bokförd/Betald) istället för en enda
          blandad lista. Tomma sektioner visas inte alls. Status är klickbar
          där det finns en riktig åtgärd att göra (markera betald). */}
      {sorted.length === 0 ? (
        <InvoiceEmptyState isFilteredEmpty={invoiceList.length > 0} onCreate={() => { setShowForm(true); setEditingInvoice(null); setInvoicePrefill(null); }} />
      ) : (
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {/* Kundfeedback ("inga space mellan fakturorna"): varje statussektion
            var tidigare sitt EGET fristående, kantat/rundat kort med 20px
            mellanrum till nästa — såg ut som flera lösryckta tabellfragment
            istället för en sammanhängande lista. Alla sektioner (inkl.
            summeringsraden sist) delar nu EN gemensam yttre kant/skugga/
            rundning (samma "flush"-princip som Kunder/Bokföring), och varje
            enskild ListTable renderas `bordered={false}` så bara EN kantlinje
            syns mellan två sektioner, inte två travade på varandra. */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          {statusOptions.filter(opt => opt.value !== 'all')
            .map(opt => ({ opt, rows: sorted.filter(inv => getStatus(inv) === opt.value) }))
            .filter(g => g.rows.length > 0)
            .map(({ opt, rows }, i) => {
              const allSelected = rows.every(inv => selected.has(inv.id));
              const sectionSum = rows.reduce((sum, inv) => sum + grossOf(inv), 0);
              return (
                <div key={opt.value} ref={el => { sectionRefs.current[opt.value] = el; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 10px', background: 'var(--bg-muted)', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, background: opt.bg, color: opt.color }}>
                      {opt.label}
                      <span style={{
                        borderRadius: '999px', padding: '0 6px', fontSize: '11px',
                        background: opt.strong ? 'rgba(255,255,255,0.28)' : 'var(--status-chip-bg)',
                      }}>{rows.length}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(sectionSum)} SEK</span>
                  </div>
                  <ListTable
                    bordered={false}
                    rowKey={inv => inv.id}
                    onRowClick={inv => { setEditingInvoice(inv); setInvoicePrefill(null); setShowForm(true); }}
                    rowStyle={inv => ({ background: selected.has(inv.id) ? '#e3f2fd' : getRowBg(getStatus(inv)) })}
                    sort={{ key: sortKey, dir: sortDir, onSort: toggleSort }}
                    selectable={{
                      checked: inv => selected.has(inv.id),
                      onToggle: inv => toggleSelect(inv.id),
                      allChecked: allSelected,
                      onToggleAll: () => toggleAllInRows(rows),
                    }}
                    rows={rows}
                    columns={invoiceColumns}
                  />
                </div>
              );
            })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', background: 'var(--bg-muted)', borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
          Summa SEK&nbsp;<span style={{ color: 'var(--text-main)', marginLeft: '6px' }}>{fmt(sumTotal)}</span>
        </div>
        </div>
      </div>
      )}

      {/* Bottom action bar (when rows selected) */}
      {selected.size > 0 && (
        <div style={{ background: 'var(--accent)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>({selected.size} markerade)</span>
          <button onClick={() => { selected.forEach(id => onMarkPaid(id)); setSelected(new Set()); }} style={{ padding: '6px 16px', background: '#22c55e', border: 'none', borderRadius: '5px', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            Markera som betalda
          </button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}><X size={18} /></button>
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
        onOpenInvoice={(inv) => handleGlobalAction?.({ type: 'view_supplier_invoice', payload: { id: inv.id } }, 'supplier_invoices')}
        onCreateNew={() => handleGlobalAction?.({ type: 'new_supplier_invoice' }, 'supplier_invoices')}
      />
    </div>
    )}

    {paymentLinkInvoice && onGetPaymentLinkUrl && (
      <PaymentLinkModal
        invoice={paymentLinkInvoice.invoice}
        customer={paymentLinkInvoice.customer}
        company={company}
        onGetPaymentLinkUrl={onGetPaymentLinkUrl}
        onClose={() => setPaymentLinkInvoice(null)}
        onMarkSent={(id) => setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i))}
      />
    )}
    </div>
  );
}
