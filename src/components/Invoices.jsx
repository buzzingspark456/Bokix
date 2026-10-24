import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { isVatExempt } from '../utils/vatRegistration';
import { foreignSaleRegion, rowsForCustomer } from '../utils/foreignSales';
import { convertToSek } from '../utils/currencyConversion';
import {
  Plus, X, Send, Check, NavInvoicesIcon,
  Search, ChevronRight, ChevronDown,
  RefreshCw, Printer, Eye, CreditCard, Link2,
  MessageSquare, Tag, Lock, Settings2, Download, AlertTriangle, Trash2,
  ZoomIn, ZoomOut, Pencil, Copy, CheckCircle2, Undo2, Sparkles, SlidersHorizontal,
} from './icons';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import PaperFit from './shared/PaperFit';
import InvoiceDocument, { DEFAULT_INVOICE_TEMPLATE, INVOICE_TEMPLATES } from './InvoiceDocument';
import { exportInvoicePdf, getInvoicePdfBase64 } from '../utils/exportInvoicePdf';
import { sendInvoiceEmail } from '../emailApi';
import { BRAND } from '../utils/brandColors';
import { getNextInvoiceNumber } from '../utils/invoiceNumbering';
import { confirmDialog } from './shared/ConfirmDialog';
import { showUndo, restoreAt } from './shared/undoToast';
import ListPageHeader, { listHeaderButtonStyle, listSearchInputStyle, listFilterFieldStyle, PAGE_SIZE_OPTIONS } from './shared/ListPageHeader';
import RowActionMenu from './shared/RowActionMenu';
import { STRONG_PAID, STRONG_UNPAID, STRONG_OVERDUE, STRONG_DRAFT, STATUS_PILL, getRowBg } from './shared/invoiceStatusStyle';
import { AccountSearch } from './shared/SearchInputs';
import ListTable from './shared/ListTable';
import { useMobileForm, MobileFormBar } from './shared/MobileForm';
// Kodgranskning: fanns tidigare som en egen lokal kopia här OCH som
// grossInvoiceAmount i reportCalculations.js (den senare påstod sig i sin
// egen kommentar vara "delad istället för en tredje tyst kopia", men var i
// praktiken en andra oberoende implementation). Importerad härifrån istället
// — reportCalculations.js (en utils-fil) ska inte bero på en sidkomponent,
// så flytten gick åt det hållet, inte tvärtom. Alias till samma namn så
// alla anrop nedan är oförändrade.
import { grossInvoiceAmount as grossOf } from '../utils/reportCalculations';
import { hasSeenInvoiceTour, startInvoiceTour } from '../utils/invoiceTour';
import { waitForElement } from '../utils/productTour';
import { ROT_RUT_RATES, ROT_RUT_COMBINED_CAP, calcRotRutDeduction, invoiceCustomerRemaining } from '../utils/rotRutConfig';
import { workTypesFor, RUT_FLAT_RATE_TYPES } from '../utils/rotRutRequest';
import RotRutRequestModal from './RotRutRequestModal';
import { t as tr, dateLocale } from '../i18n';
import { numberFormat, dateTimeFormat } from '../utils/intlCache';
import { captureEvent } from '../utils/posthog';

const newRowId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const withRowIds = (rows) => rows.map(r => ({ id: r.id || newRowId(), ...r }));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (val) =>
  numberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);

const formatDate = (d) => {
  if (!d) return '—';
  try { return dateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

const isOverdue = (inv) =>
  inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date();


// Kundfeedback ("starkare färger för obetald och betald"): de vanliga
// BRAND.amberBg/greenLight-tonerna är avsiktligt bleka (samma neutrala
// nyanser som delas av alla andra badges i hela appen, se brandColors.js) —
// för just de HÄR statusarna, den enda frågan som faktiskt spelar roll på
// hela sidan ("har jag fått betalt eller inte, och är det försent?"), ska
// svaret synas på långt håll, inte gissas fram från en blek pastellton.
// Egna, mättade heltäckande färger lokalt HÄR (inte i BRAND) så bara
// Fakturor-sidans badges/knappar påverkas — Bokförings/lönekörningens
// statusmärken, som delar samma BRAND-tokens, rörs inte.
//
// Uppföljning (kundfeedback, skärmdump): STRONG_UNPAID var tidigare en
// orange ton (#d97706) — "obetald" ska läsas som en GUL varning, inte en
// orange/röd en, så den lätt går att skilja från "förfallen" (verkligt
// rött, se STRONG_OVERDUE). En riktigt gul bakgrund behöver mörk text för
// att gå att läsa (vit text på gult är i praktiken alltid för svag kontrast
// — samma skäl som gula varningsskyltar/etiketter i resten av webben
// använder mörk text, inte vit).
// Kundfeedback ("mindre bright, mer mörk"): #16a34a ett steg mörkare
// (#15803d) — vit text ovanpå betyder att kontrasten bara ökar av det,
// samma i båda temana precis som innan.
// STRONG_PAID/STRONG_UNPAID/STRONG_OVERDUE och getRowBg bor i shared/invoiceStatusStyle.js.


// Exempelfaktura — Fakturaguiden (utils/invoiceTour.js) pekar på statusmärket
// och radmenyn, men de flesta konton har inga riktiga fakturor än när de
// klickar igång guiden. Injiceras (bara i listan här på skärmen, se
// sortedWithDemo längre ner) enbart medan guiden är öppen OCH listan
// annars är tom — försvinner automatiskt när guiden stängs, skrivs aldrig
// till invoices/setInvoices, och alla dess radåtgärder är overksamma (se
// buildInvoiceRowMenuItems' isDemo-gren och de isDemo-vakterna nedan) så
// den aldrig av misstag kan sparas som en riktig faktura.
const DEMO_INVOICE_ID = '__demo_invoice__';
const DEMO_CUSTOMER_ID = '__demo_customer__';
function buildDemoInvoice() {
  const today = new Date();
  const due = new Date(); due.setDate(due.getDate() + 30);
  return {
    id: DEMO_INVOICE_ID,
    isDemo: true,
    invoiceNumber: 'DEMO-01',
    customerId: DEMO_CUSTOMER_ID,
    date: today.toISOString().split('T')[0],
    dueDate: due.toISOString().split('T')[0],
    status: 'sent',
    currency: 'SEK',
    rows: [{ description: 'Exempeltjänst', qty: 1, unitPrice: 1000, vatRate: 25, discount: 0, account: '3001' }],
  };
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
function InvoiceForm({ contacts, accounts = [], onSave, onClose, initial, prefill, company, invoiceList, onCreateCreditNote, onRegisterPayment, onUnmarkPaid, onUpdateNote, verifications = [], nav, onGetPaymentLinkUrl, articles = [], setArticles, projects = [], onSyncBeforeServerCall }) {
  // En bokförd faktura (allt utom utkast) får inte längre ändra belopp/rader/kund —
  // korrigeringar sker via kreditfaktura. Datum och kommentar går fortfarande att ändra.
  const isLocked = Boolean(initial) && (initial.status || 'draft') !== 'draft';
  useMobileForm();

  // `prefill` (från t.ex. Tidrapportering → "Skapa faktura") sätter bara
  // startvärden för en NY faktura — aldrig när `initial` redan pekar på en
  // sparad faktura som redigeras.
  const [customerId, setCustomerId] = useState(initial?.customerId || prefill?.customerId || '');
  // Inställningar → Fakturor → Fakturadatum: 'blank' (skriv in för hand)
  // lämnar fältet tomt på en NY faktura i stället för att alltid fylla i
  // dagens datum — 'today' (default) oförändrat beteende.
  const [invoiceDate, setInvoiceDate] = useState(initial?.date || (company?.invoiceDateMode === 'blank' ? '' : new Date().toISOString().split('T')[0]));
  const [dueDate, setDueDate] = useState(() => {
    if (initial?.dueDate) return initial.dueDate;
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  // Inte momsregistrerat: ingen moms på fakturan, försäljningen bokförs på
  // 3004 (momsfri). Momsvalet på raderna är då låst till 0 %.
  const vatExempt = isVatExempt(company);
  const defaultVatRate = vatExempt ? 0 : 25;
  const defaultRevenueAccount = vatExempt ? '3004' : '3001';
  const [rows, setRows] = useState(() => withRowIds(initial?.rows || (prefill?.rows && vatExempt ? prefill.rows.map(r => ({ ...r, vatRate: 0, account: defaultRevenueAccount })) : prefill?.rows) || [
    { description: '', qty: 1, unitPrice: 0, vatRate: defaultVatRate, discount: 0, account: defaultRevenueAccount, articleNumber: '', rotRutLabor: true }
  ]));
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRowAdvanced = (id) => setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [ourRef, setOurRef] = useState(initial?.ourRef || '');
  const [theirRef, setTheirRef] = useState(initial?.theirRef || '');
  const [ourOrderNr, setOurOrderNr] = useState(initial?.ourOrderNr || '');
  const [projectId, setProjectId] = useState(initial?.projectId || prefill?.projectId || '');
  // Pris inkl. moms — ren INMATNINGS-bekvämlighet, rör aldrig vad som
  // faktiskt sparas. row.unitPrice är och förblir alltid nettopriset
  // (exkl. moms), exakt som förut — calcRow (nedan), grossInvoiceAmount
  // (reportCalculations.js), Stripe-betalningslänken
  // (_invoiceLineItems.js) och den utskrivna fakturan (InvoiceDocument.jsx)
  // läser alla unitPrice som netto och behöver därför INTE veta att den
  // här växeln finns. När den är på räknas bara À-pris-fältets VISADE och
  // INSKRIVNA värde om till/från brutto vid varje tangenttryckning (se
  // fältet i Fakturarader nedan) — själva state:t den skriver till är
  // fortfarande nettot.
  const [priceInclVat, setPriceInclVat] = useState(initial?.priceInclVat || false);
  // Husavdrag (ROT/RUT) — bara relevant för privatpersoner (customer.
  // customerType === 'se_individual', se Contacts.jsx), aldrig företag.
  // 'none' | 'rot' | 'rut'. Se utils/rotRutConfig.js för procentsatser/tak
  // och varför avdraget räknas på arbetsradernas BRUTTObelopp (inkl. moms).
  const [rotRutTypeChoice, setRotRutType] = useState(initial?.rotRutType || 'none');
  // Uppgifter som Skatteverket kräver i begäran om utbetalning (se
  // utils/rotRutRequest.js): typ av arbete, timmar och, för ROT, fastigheten
  // eller bostadsrättsföreningen och lägenheten.
  const [rotRutWorkType, setRotRutWorkType] = useState(initial?.rotRutWorkType || '');
  const [rotRutHours, setRotRutHours] = useState(initial?.rotRutHours ?? '');
  const [rotRutProperty, setRotRutProperty] = useState(initial?.rotRutProperty || '');
  const [rotRutBrfOrgNr, setRotRutBrfOrgNr] = useState(initial?.rotRutBrfOrgNr || '');
  const [rotRutApartment, setRotRutApartment] = useState(initial?.rotRutApartment || '');
  const [invoiceType, setInvoiceType] = useState('Faktura');
  const [terms, setTerms] = useState('30 dagar');
  // Bugkritiskt: sparades tidigare aldrig med på fakturan (se handleSave
  // nedan) — valde man EUR i rullistan låg det bara i denna komponentens
  // lokala state och föll tillbaka till SEK igen så fort fakturan sparades
  // och öppnades på nytt, eller när en betalningslänk skapades (som därför
  // alltid hårdkodade 'sek' oavsett vad som stod här).
  const [currency, setCurrency] = useState(initial?.currency || 'SEK');
  // Husavdrag finns bara för fakturor i kronor (Skatteverket betalar ut i kronor).
  const rotRutType = currency === 'SEK' ? rotRutTypeChoice : 'none';
  // Växelkursen (SEK per en enhet av valutan) som fakturan bokförs med.
  // Bokföringen ska vara i kronor, så en faktura i EUR bokförs med beloppet
  // gånger kursen. Hämtas för fakturadatumet (ECB:s referenskurs, se
  // utils/currencyConversion.js) och går att ändra för hand.
  const [fxRate, setFxRate] = useState(initial?.fxRate ? String(initial.fxRate) : '');
  const [fxRateManual, setFxRateManual] = useState(Boolean(initial?.fxRate));
  const [fxStatus, setFxStatus] = useState('');
  useEffect(() => {
    if (initial || currency === 'SEK' || fxRateManual) return undefined;
    let cancelled = false;
    setFxStatus(tr('ui.hamtar_kurs'));
    convertToSek(1, currency, invoiceDate || undefined).then(res => {
      if (cancelled) return;
      if (res?.rate) { setFxRate(String(Math.round(res.rate * 10000) / 10000)); setFxStatus(`ECB:s kurs ${res.date || ''}`.trim()); }
      else setFxStatus(tr('ui.kursen_kunde_inte_hamtas_fyll_i_den_for_hand'));
    });
    return () => { cancelled = true; };
  }, [currency, invoiceDate, fxRateManual, initial]);
  const [invoiceText, setInvoiceText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
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
  // Meddelandefönstret: öppnas i stället för att skicka direkt, så texten
  // går att anpassa per kund.
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailWarnings, setEmailWarnings] = useState([]);
  // Kundönskemål: alla vill inte ha en betalningsknapp i mejlet — vissa
  // fakturerar mot bankgiro och vill inte betala Stripes avgift.
  const [emailWithPaymentLink, setEmailWithPaymentLink] = useState(true);
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
  // Faktura i annan valuta: vad som kom in på kontot i kronor (valfritt).
  const [paymentSekInput, setPaymentSekInput] = useState('');
  const payCurrency = initial?.currency && initial.currency !== 'SEK' ? initial.currency : 'kr';

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

  const addRow = () => setRows(r => [...r, { id: newRowId(), description: '', qty: 1, unitPrice: 0, vatRate: defaultVatRate, discount: 0, account: defaultRevenueAccount, articleNumber: '', rotRutLabor: true }]);
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
  // Artikelnr blev valfritt på registret (Articles.jsx: Benämning är den
  // riktiga identiteten numera) — en artikel utan nummer går alltså inte
  // att hitta via findArticleByNumber ovan. Samma benämnings-matchning som
  // Quotes.jsx (QuoteEditor: findArticleByDescription) på det vanliga
  // Beskrivning-fältet, så registret fortsatt går att välja från fakturan
  // även för artiklar som aldrig fått ett artikelnr.
  const findArticleByDescription = (text) => {
    const key = (text || '').trim().toLowerCase();
    if (!key) return null;
    return articles.find(a => (a.description || '').trim().toLowerCase() === key) || null;
  };
  const applyArticleToRow = (i, article) => {
    setRows(r => r.map((row, idx) => idx === i ? {
      ...row,
      articleNumber: article.articleNumber,
      description: article.description || row.description,
      unitPrice: article.unitPrice ?? row.unitPrice,
      vatRate: vatExempt ? 0 : (article.vatRate ?? row.vatRate),
      account: vatExempt ? defaultRevenueAccount : (article.account || row.account),
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

  // Husavdrag — bara valbart för privatpersoner (se rotRutType-kommentaren
  // ovan). Nollställer INTE rotRutType om en redan sparad faktura råkar ha
  // en kund som bytt typ i efterhand — visar hellre en tydlig varning än
  // att tyst rensa bort ett val som redan sparats på fakturan.
  const customerIsIndividual = customer?.customerType === 'se_individual';
  const rotRut = calcRotRutDeduction(rotRutType, rows);
  const amountAfterRotRut = totals.total - rotRut.deduction;
  const customerHasPersonnummer = Boolean(customer?.orgNr?.trim());

  const alreadyPaid = initial?.paidAmount || 0;
  // Vid ROT/RUT betalar kunden fakturan minus avdraget (resten kommer från
  // Skatteverket), utom när Skatteverket har avslagit begäran.
  const customerDue = rotRutType !== 'none' && initial?.rotRutStatus !== 'rejected' ? amountAfterRotRut : totals.total;
  const remainingDue = Math.max(0, customerDue - alreadyPaid);

  // Fylla i betalningsformuläret med rimliga defaults (hela kvarvarande
  // beloppet, dagens datum) varje gång det öppnas.
  useEffect(() => {
    if (showPaymentBox) {
      // Hela beloppet med ören, som fakturan visar det (373,13 kr fylls i som 373.13).
      setPaymentAmountInput(remainingDue > 0 ? String(Math.round(remainingDue * 100) / 100) : '');
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
    logoSize: company?.invoiceLogoSize || 'medium',
    showCompanyName: company?.invoiceShowCompanyName ?? false,
    footerText: company?.invoiceFooterText || '',
  });

  // ── Fritext i mejlet ──────────────────────────────────────────────────
  // Kundönskemål: man ska kunna skriva vad man vill till kunden, eftersom
  // det skiljer sig från kund till kund — men fakturan och betalningslänken
  // ska följa med ändå. Därför skriver användaren BARA meddelandet; PDF:en,
  // "Betala nu"-knappen och sammanfattningsraden läggs på av systemet och
  // går inte att råka radera.

  /** Användarens text hamnar i ett HTML-mejl. Utan escaping skulle ett
   *  ampersand eller ett mindre-än-tecken kunna bryta uppmärkningen — och
   *  i värsta fall låta någon klistra in taggar som följer med till
   *  mottagaren. */
  const escapeHtml = (text) => String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /** Tomrad blir nytt stycke, enkel radbrytning blir <br/> — så texten ser
   *  ut i mejlet som den gjorde i rutan. */
  const messageToHtml = (text) => escapeHtml(text)
    .split(/\n\s*\n/)
    .map(block => `<p style="margin:0 0 14px;">${block.trim().replace(/\n/g, '<br/>')}</p>`)
    .join('');

  /** Förifylld text. Hälsningen använder kontaktpersonen när den finns,
   *  annars företagsnamnet — samma logik som mejlet hade innan det gick att
   *  redigera. */
  // Ersätter {{kundnamn}}/{{fakturanummer}}/{{belopp}}/{{förfallodatum}} —
  // samma fyra taggar som Inställningar → Fakturor → E-postinställningar
  // dokumenterar. Delad mellan ämnesrad och meddelande nedan.
  const fillEmailTemplate = (template) => template
    .replaceAll('{{kundnamn}}', customer?.contactPerson || customer?.name || '')
    .replaceAll('{{fakturanummer}}', String(nextNum))
    .replaceAll('{{belopp}}', `${fmt(totals.total)} kr`)
    .replaceAll('{{förfallodatum}}', formatDate(dueDate));

  const defaultEmailMessage = () => {
    if (company?.invoiceEmailBody) return fillEmailTemplate(company.invoiceEmailBody);
    const hälsning = customer?.contactPerson || customer?.name || '';
    return [
      `Hej${hälsning ? ' ' + hälsning : ''},`,
      '',
      `Bifogat finner du faktura ${nextNum} på ${fmt(totals.total)} kr, med förfallodatum ${formatDate(dueDate)}.`,
      '',
      'Hör av dig om du har några frågor.',
      '',
      'Med vänlig hälsning',
      (company?.invoiceDisplayName || company?.name) || '',
    ].join('\n');
  };

  // Senast använda text ligger kvar som utgångspunkt nästa gång, per
  // företag. localStorage och inte kontot: det här är en bekvämlighet i
  // just den här webbläsaren, inte en inställning värd att synka.
  const messageStorageKey = `bokix-fakturamejl-${company?.id || 'default'}`;

  // Löften, inte värden: vi vill inte rendera om komponenten när de blir
  // klara, bara kunna vänta in dem vid Skicka.
  const emailPrepRef = useRef({ pdf: null, link: null });

  /** Startar PDF-rendering och betalningslänk i bakgrunden. Fel sväljs här
   *  och tas om hand vid Skicka i stället — ett misslyckat förberedelse-
   *  försök ska inte visa ett felmeddelande medan man skriver. */
  const prepareEmailAttachments = () => {
    // Promise.resolve() runt BÅDA anropen: de kommer utifrån och behöver
    // inte returnera ett löfte. onGetPaymentLinkUrl gör det t.ex. inte i
    // demoläget, och då kraschade hela fakturavyn på .catch of null — en
    // bugg som testet fångade innan den nådde någon kund.
    emailPrepRef.current = {
      pdf: Promise.resolve()
        .then(() => getInvoicePdfBase64(captureRef.current))
        .catch(err => { console.warn('Kunde inte förbereda PDF:en:', err); return null; }),
      link: (company?.stripeAccountId && onGetPaymentLinkUrl && initial?.id)
        ? Promise.resolve()
          .then(() => onGetPaymentLinkUrl(initial.id))
          .catch(err => { console.warn('Kunde inte förbereda betalningslänken:', err); return null; })
        : Promise.resolve(null),
    };
  };

  /** Sådant kunden kommer att sakna i mejlet. Blockerar inte — det är
   *  användarens faktura — men det ska inte gå att missa. */
  const invoiceWarnings = () => {
    const varningar = [];
    if (!customer) varningar.push(tr('ui.ingen_kund_vald_varning'));
    const utanText = rows.filter(r => !r.description && (Number(r.qty) || Number(r.unitPrice)));
    if (utanText.length) varningar.push(utanText.length === 1 ? tr('ui.en_rad_saknar_beskrivning') : tr('ui.rader_saknar_beskrivning', { n: utanText.length }));
    if (!rows.some(r => r.description || Number(r.qty) || Number(r.unitPrice))) varningar.push(tr('ui.fakturan_har_inga_rader'));
    return varningar;
  };

  const openEmailCompose = () => {
    const to = emailToInput.trim();
    if (!to) { setEmailError(tr('ui.ange_en_mottagaradress')); return; }
    if (!/^\S+@\S+\.\S+$/.test(to)) { setEmailError(tr('ui.det_dar_ser_inte_ut_som_en_giltig_e_postadress')); return; }
    let sparad = '';
    try { sparad = window.localStorage.getItem(messageStorageKey) || ''; } catch { /* privat läge */ }
    setEmailMessage(sparad || defaultEmailMessage());
    setEmailSubject(company?.invoiceEmailSubject ? fillEmailTemplate(company.invoiceEmailSubject) : `Faktura ${nextNum} från ${(company?.invoiceDisplayName || company?.name) || 'oss'}`);
    setEmailError(''); setEmailSent(false);
    setEmailWarnings(invoiceWarnings());
    setShowEmailCompose(true);
    // Nästa tick: fönstret ska hinna ritas FÖRE html2canvas börjar arbeta.
    // Startas förberedelsen i samma svep kan den blockera huvudtråden precis
    // när rutan skulle ha dykt upp, och klicket känns trögt.
    setTimeout(prepareEmailAttachments, 0);
  };

  const rotRutFields = () => (rotRutType === 'none'
    ? { rotRutWorkType: undefined, rotRutHours: undefined, rotRutProperty: undefined, rotRutBrfOrgNr: undefined, rotRutApartment: undefined }
    : {
        rotRutWorkType: workTypesFor(rotRutType).includes(rotRutWorkType) ? rotRutWorkType : undefined,
        rotRutHours: rotRutHours === '' ? undefined : Number(rotRutHours),
        rotRutProperty: rotRutType === 'rot' ? rotRutProperty.trim() || undefined : undefined,
        rotRutBrfOrgNr: rotRutType === 'rot' ? rotRutBrfOrgNr.trim() || undefined : undefined,
        rotRutApartment: rotRutType === 'rot' ? rotRutApartment.trim() || undefined : undefined,
      });

  const handleSave = (status = 'draft') => {
    const rate = Number(String(fxRate).replace(',', '.'));
    if (currency !== 'SEK' && !(rate > 0)) {
      setFxStatus(tr('ui.fyll_i_vaxelkursen_for_fakturan_bokfors_i_kronor', { currency }));
      return;
    }
    // internalNote skickas alltid med här (inte bara via popoverns egen
    // "Spara"-knapp) så en kommentar man skrivit på en NY, ännu osparad
    // faktura faktiskt följer med — annars gick den förlorad eftersom
    // Kommentar-knappen tidigare var helt avstängd innan första sparningen.
    onSave({ customerId, date: invoiceDate, dueDate, rows, status, type: 'invoice', invoiceNumber: nextNum, ourRef, theirRef, ourOrderNr, projectId: projectId || undefined, priceInclVat, rotRutType: rotRutType !== 'none' && currency === 'SEK' ? rotRutType : undefined, ...(currency === 'SEK' ? rotRutFields() : {}), internalNote: commentDraft, invoiceTemplateSnapshot, currency, fxRate: currency !== 'SEK' ? rate : undefined });
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true); setPdfError('');
    try {
      await exportInvoicePdf(captureRef.current, `faktura-${nextNum}.pdf`);
    } catch (err) {
      console.error(err);
      setPdfError(tr('ui.kunde_inte_skapa_pdf_forsok_igen'));
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
    if (!to) { setEmailError(tr('ui.ange_en_mottagaradress')); return; }
    if (!/^\S+@\S+\.\S+$/.test(to)) { setEmailError(tr('ui.det_dar_ser_inte_ut_som_en_giltig_e_postadress')); return; }
    setEmailBusy(true); setEmailError(''); setEmailSent(false);
    try {
      // Förberett när fönstret öppnades (se prepareEmailAttachments).
      // Föll förberedelsen görs den om här, så ett tillfälligt fel inte
      // betyder att fakturan går iväg utan bilaga.
      const prep = emailPrepRef.current;
      // Vänta in den förberedda PDF:en, men aldrig längre än 20 sekunder.
      // Hänger renderingen ska användaren få ett fel att agera på, inte en
      // knapp som står och snurrar för alltid.
      const medTidsgräns = (löfte, ms) => Promise.race([
        löfte,
        new Promise((_, avvisa) => setTimeout(() => avvisa(new Error(tr('ui.pdf_tidsgrans'))), ms)),
      ]);

      let attachmentBase64 = null;
      try {
        attachmentBase64 = prep.pdf
          ? await medTidsgräns(prep.pdf, 20000)
          : await medTidsgräns(getInvoicePdfBase64(captureRef.current), 20000);
      } catch (pdfErr) {
        console.error('PDF till mejlet misslyckades:', pdfErr);
        throw new Error(tr('ui.kunde_inte_skapa_pdf_en_till_mejlet_prova_forhan'));
      }

      // Betalningslänken är best effort: misslyckas den (t.ex. ogiltiga
      // rader) skickas fakturan ändå, bara utan knappen, i stället för att
      // hela utskicket stoppas av ett Stripe-fel.
      const paymentLinkUrl = emailWithPaymentLink && prep.link ? await prep.link : null;

      // Användarens egen text först, sedan det som ALLTID ska med:
      // betalningsknappen och en rad som säger vad bilagan är. Den som
      // bara skriver "Hej!" får ändå ett mejl kunden kan betala från.
      const html = `
        ${messageToHtml(emailMessage || defaultEmailMessage())}
        ${paymentLinkUrl ? `
        <p style="margin: 22px 0;">
          <a href="${paymentLinkUrl}" style="display:inline-block;padding:12px 26px;background:#0b6329;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Betala nu</a>
        </p>
        ` : ''}
        <p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;">
          Faktura ${nextNum} · ${fmt(totals.total)} kr · förfaller ${formatDate(dueDate)} · bifogad som PDF
        </p>
      `;

      // Bugkritiskt: servern verifierar ägarskap mot Supabase (App.jsx:s
      // debouncade sparning kan ligga upp till två sekunder efter, och
      // startas om vid varje tangenttryck) — ett nytt eller nyss ändrat
      // företag kan alltså saknas där ännu, vilket gav ett falskt "Du har
      // inte längre åtkomst till det här företaget." Tvingar fram en
      // omedelbar synk (best effort, väntar aldrig längre än ett
      // misslyckande) innan utskicket, så servern ser samma data som
      // skärmen visar.
      await onSyncBeforeServerCall?.();

      await sendInvoiceEmail({
        to,
        subject: emailSubject.trim() || `Faktura ${nextNum} från ${(company?.invoiceDisplayName || company?.name) || 'oss'}`,
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

      // Texten blir utgångspunkt nästa gång — de flesta skriver ungefär
      // samma sak, och den som vill ändra gör det i rutan.
      try { window.localStorage.setItem(messageStorageKey, emailMessage); } catch { /* privat läge */ }
      setEmailSent(true);
      setShowEmailCompose(false);
      captureEvent('faktura_skickad');
      // Precis som "✓ Skapa faktura"-knappen — ett utkast som faktiskt
      // skickas till kunden är per definition inte längre ett utkast.
      if ((initial?.status || 'draft') === 'draft') handleSave('sent');
    } catch (err) {
      console.error(err);
      setEmailError(err.message || tr('ui.kunde_inte_skicka_e_post'));
    } finally {
      setEmailBusy(false);
    }
  };

  // Samma rundade pill-knapp som QuoteEditor:s toolbarBtnStyle (Quotes.jsx)
  // istället för en text/ikon flytande fritt på raden — egen klickyta med
  // luft och kant runt om, inte bara en tunn linje mot grannknappen.
  const topBarBtn = (label, icon, onClick, style = {}, disabled = false, title, cls) => (
    <button className={cls} onClick={disabled ? undefined : onClick} disabled={disabled} title={title} style={{
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
      <div className="mform-head" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" className="mform-back" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="mform-back-desk">{tr('ui.tillbaka')}</span><span className="mform-back-phone">{tr('ui.avbryt')}</span>
        </button>
        <div className="mform-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{initial ? tr('ui.faktura_4', { nextNum }) : tr('ui.ny_faktura')}</h1>
          <span className="mform-meta" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tr('ui.ocr_2')} {ocr}{tr('ui.ver_nr')} {linkedVerification?.number || '—'}</span>
          {isLocked && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--status-amber-text)', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '20px', padding: '4px 10px', fontWeight: 600 }}>
              <Lock size={11} /> {tr('ui.bokford')}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: '8px' }} />

        {/* Navigation — bläddrar genom samma lista man kom ifrån */}
        <div className="record-nav" style={{ display: 'flex', gap: '2px' }}>
          {[
            { s: '«', onClick: nav?.first, enabled: nav?.hasPrev, title: tr('ui.forsta_fakturan') },
            { s: '‹', onClick: nav?.prev, enabled: nav?.hasPrev, title: tr('ui.foregaende_faktura') },
            { s: '›', onClick: nav?.next, enabled: nav?.hasNext, title: tr('ui.nasta_faktura') },
            { s: '»', onClick: nav?.last, enabled: nav?.hasNext, title: tr('ui.sista_fakturan') },
          ].map(({ s, onClick, enabled, title }) => (
            <button
              key={s} type="button" disabled={!enabled} onClick={onClick} title={title}
              style={{ padding: '4px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '13px', color: enabled ? 'var(--text-main)' : 'var(--border)' }}
            >{s}</button>
          ))}
        </div>

        <div className="mform-head-actions" style={{ display: 'flex', gap: '8px' }}>
          <button type="button" data-tour="page-invoices-cancel" data-inv-tour="form-cancel" onClick={onClose} style={listHeaderButtonStyle('secondary')}>{tr('ui.avbryt')}</button>
          <button type="button" onClick={() => handleSave('sent')} style={listHeaderButtonStyle('primary')}>
            <Check size={14} /> {initial ? tr('ui.spara_andringar') : tr('ui.skapa_faktura')}
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
      <div className={`quote-toolbar invoice-toolbar doc-toolbar${initial ? '' : ' is-new'}`} style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', flexShrink: 0, overflowX: 'auto', position: 'relative' }}>
        {topBarBtn(tr('ui.registrera_betalning'), <CreditCard size={13} />, () => setShowPaymentBox(v => !v), showPaymentBox ? activeToolbarPillStyle : {}, !initial, !initial ? tr('ui.spara_fakturan_forst') : undefined, 'tb-pay')}
        {topBarBtn(
          'Markera som obetald',
          <Tag size={13} />,
          async () => { if (await confirmDialog(tr('ui.markera_faktura_som_obetald_den_registrerade_bet', { nextNum }))) onUnmarkPaid?.(initial.id); },
          {},
          !initial || initial?.status !== 'paid',
          !initial ? tr('ui.spara_fakturan_forst') : (initial?.status !== 'paid' ? tr('ui.fakturan_ej_betald') : tr('ui.angrar_betalningen')),
          'tb-unpay'
        )}
        {topBarBtn('Kommentar', <MessageSquare size={13} />, () => setShowCommentBox(v => !v), showCommentBox ? activeToolbarPillStyle : (commentDraft ? { color: 'var(--status-amber-text)', borderColor: 'var(--status-amber-bg)' } : {}), false, undefined, 'tb-comment')}
        {/* Mellanrummet som skjuter e-postgruppen åt höger. Klass, inte bara
            inline style: på smala skärmar ska det FÖRSVINNA (se .quote-toolbar
            i index.css) så knapparna står tillsammans i stället för att
            hamna utanför skärmkanten bakom en sidledsscroll. */}
        <div className="toolbar-spacer" style={{ flex: 1, minWidth: '8px' }} />
        {emailError && <span style={{ fontSize: '11px', color: '#c00', alignSelf: 'center', marginRight: 8 }}>{emailError}</span>}
        {emailSent && !emailError && <span style={{ fontSize: '11px', color: 'var(--status-green-text)', alignSelf: 'center', marginRight: 8 }}>{tr('ui.skickad')}</span>}
        <input
          type="email" value={emailToInput} onChange={e => { setEmailToInput(e.target.value); setEmailError(''); }}
          placeholder={tr('ui.mottagarens_epost_se')} title={tr('ui.mottagarens_e_postadress_forifylld_fran_kundkort')}
          disabled={!initial}
          className="toolbar-email-input"
          style={{
            padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', width: '190px',
            flexShrink: 0, fontFamily: 'inherit',
            background: !initial ? 'var(--bg-muted)' : 'var(--bg-card)', color: !initial ? 'var(--text-muted)' : 'var(--text-main)',
          }}
        />
        {topBarBtn(
          emailBusy ? 'Skickar…' : 'Skicka via e-post',
          <Send size={13} />,
          openEmailCompose,
          {},
          // Bugkritiskt: bara `!initial` (fakturan måste vara sparad) spärrar
          // klicket nu. Tidigare spärrade `!emailToInput.trim()` knappen HELT
          // tyst — ett klick på en tom adress gjorde bokstavligen ingenting,
          // inget felmeddelande, inget nätverksanrop (bekräftat: noll träffar
          // mot /api/email/send-invoice i loggarna trots att kunden testat).
          // openEmailCompose har redan en egen, tydlig felruta för en tom
          // adress (emailError, raden ovanför) — den ska få köras, inte
          // hindras av att knappen aldrig går att trycka på.
          emailBusy || !initial,
          !initial ? tr('ui.spara_fakturan_forst') : (!emailToInput.trim() ? tr('ui.ange_en_mottagaradress') : tr('ui.skicka_faktura_till', { n: nextNum, to: emailToInput.trim() })),
          'tb-send'
        )}
        {pdfError && <span style={{ fontSize: '11px', color: '#c00', alignSelf: 'center', marginRight: 8 }}>{pdfError}</span>}
        {topBarBtn(pdfBusy ? tr('ui.skapar_pdf') : tr('ui.ladda_ner_pdf'), <Download size={13} />, handleDownloadPdf, {}, pdfBusy, undefined, 'tb-pdf')}
        {topBarBtn(tr('ui.forhandsgranska'), <Eye size={13} />, () => setShowPreview(v => !v), showPreview ? activeToolbarPillStyle : {}, false, undefined, 'tb-preview')}
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
              <h2 className="modal-title">{tr('ui.registrera_betalning')}</h2>
              <button className="modal-close" onClick={() => setShowPaymentBox(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 4px' }}>
              {(initial.status === 'paid') ? (
                <div style={{ fontSize: '13px', color: 'var(--status-green-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> {tr('ui.betald')} {initial.paidDate ? formatDate(initial.paidDate) : ''}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{tr('ui.totalt_2')} {fmt(totals.total)} {payCurrency}</div>
                  {alreadyPaid > 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{tr('ui.redan_betalt')} {fmt(alreadyPaid)} {payCurrency}</div>
                  )}
                  <div style={{ fontSize: '13px', color: 'var(--status-amber-text)', fontWeight: 600, marginBottom: '14px' }}>{tr('ui.kvar_att_betala')} {fmt(remainingDue)} {payCurrency}</div>

                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{tr('ui.belopp_2')}{payCurrency})</label>
                  <input
                    type="number" min="0" max={remainingDue} step="0.01"
                    value={paymentAmountInput} onChange={e => setPaymentAmountInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--text-muted)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-main)', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  {payCurrency !== 'kr' && (
                    <>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{tr('ui.insatt_pa_kontot_kr')}</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={paymentSekInput} onChange={e => setPaymentSekInput(e.target.value)}
                        placeholder={initial.fxRate && paymentAmountInput ? String(Math.round(Number(paymentAmountInput) * initial.fxRate * 100) / 100) : ''}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--text-muted)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-main)', marginBottom: '4px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>{tr('ui.skillnaden_mot_fakturans_kurs_bokfors_som_valuta')}</div>
                    </>
                  )}
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{tr('ui.datum')}</label>
                  <input
                    type="date"
                    value={paymentDateInput} onChange={e => setPaymentDateInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--text-muted)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-main)', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />

                  <button
                    onClick={() => {
                      const amount = parseFloat(paymentAmountInput);
                      if (!amount || amount <= 0) return;
                      onRegisterPayment?.(initial.id, amount, paymentDateInput, undefined, { sekReceived: Number(paymentSekInput) || undefined });
                      setShowPaymentBox(false);
                    }}
                    disabled={!paymentAmountInput || Number(paymentAmountInput) <= 0}
                    style={{
                      width: '100%', padding: '9px 12px', background: (!paymentAmountInput || Number(paymentAmountInput) <= 0) ? '#a7d8a7' : '#22c55e',
                      color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700,
                      cursor: (!paymentAmountInput || Number(paymentAmountInput) <= 0) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {tr('ui.registrera_betalning')}
                  </button>
                  {Number(paymentAmountInput) > 0 && Number(paymentAmountInput) < remainingDue && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '10px' }}>{tr('ui.detta_bokfors_som_en_delbetalning_fakturan_blir')}</div>
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
              <h2 className="modal-title">{tr('ui.intern_kommentar')}</h2>
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
                placeholder={tr('ui.syns_bara_internt_inte_for_kunden')}
                style={{ width: '100%', minHeight: '140px', padding: '10px 12px', border: '1px solid var(--text-muted)', borderRadius: '6px', fontSize: '14px', lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', color: 'var(--text-main)', background: 'var(--bg-card)' }}
              />
              {!initial && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>{tr('ui.sparas_tillsammans_med_fakturan')}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                <button onClick={() => setShowCommentBox(false)} style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{tr('ui.stang')}</button>
                <button
                  onClick={() => { if (initial) onUpdateNote?.(initial.id, commentDraft); setShowCommentBox(false); }}
                  style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {initial ? tr('ui.spara_kommentar') : tr('ui.klart')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLocked && (
        <div style={{ background: 'var(--status-amber-bg)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: '#7c4a03', flexShrink: 0 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            {tr('ui.den_har_fakturan_ar_bokford_kund_belopp_och_rade')}{' '}
            <button onClick={async () => { if (await confirmDialog(tr('ui.skapa_en_kreditfaktura_som_motsvarar_faktura', { nextNum }))) onCreateCreditNote?.(initial); }} style={{ background: 'none', border: 'none', color: 'var(--status-amber-text)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>{tr('ui.skapa_en_kreditfaktura')}</button>
            {' '}{tr('ui.istallet_datum_och_kommentar_gar_fortfarande_att')}
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
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', background: 'var(--bg-card)' }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

          {/* Fakturauppgifter — samma sektionsmönster som QuoteEditor:s
              "Kundinformation" (Quotes.jsx): en enda tydligt rubricerad
              yta med generös padding, istället för två-tre tätt staplade
              tunna kortremsor. */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{tr('ui.fakturauppgifter')}</h3>
            {/* form-row-stack (Sida 38, punkt 2): kolumnbredden är ojämn
                (2fr 1fr 1fr 1fr) så den kan inte återanvända .form-row-2/-3,
                men ska ändå bli en kolumn på mobil. */}
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end', marginBottom: '16px' }}>
              <div>
                <label style={lbl}>{tr('ui.kund')}</label>
                <select data-tour="page-invoices-field" data-inv-tour="form-customer" value={customerId} onChange={e => {
                  const id = e.target.value;
                  setCustomerId(id);
                  // Kund utomlands: 0 % moms och rätt intäktskonto på raderna
                  // (utils/foreignSales.js), och tillbaka vid byte till svensk kund.
                  if (!vatExempt) setRows(r => rowsForCustomer(r, customers.find(c => c.id === id)));
                }} disabled={isLocked} style={{ ...inp, background: isLocked ? 'var(--border-light)' : 'var(--bg-card)' }}>
                  <option value="">{tr('ui.valj_kund')}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.id?.slice(-3)} – {c.name}</option>)}
                </select>
                {!vatExempt && foreignSaleRegion(customer) && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.45 }}>
                    {foreignSaleRegion(customer) === 'eu'
                      ? tr('ui.eu_foretag_ingen_svensk_moms_och_fakturan_far_te')
                      : tr('ui.foretag_utanfor_eu_ingen_svensk_moms_tjanster_bo')}
                    {' '}{tr('ui.byt_konto_pa_raden_om_det_ar_varor')}
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>{tr('ui.fakturadatum')}</label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>{tr('ui.forfallodatum_2')}</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>{tr('ui.fakturatyp')}</label>
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
                <label style={lbl}>{tr('ui.betalningsvillkor')}</label>
                <select value={terms} onChange={e => setTerms(e.target.value)} style={inp}>
                  {['0 dagar', '10 dagar', '20 dagar', '30 dagar', '60 dagar'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tr('ui.var_referens')}</label>
                <input value={ourRef} onChange={e => setOurRef(e.target.value)} style={inp} placeholder={tr('ui.emma_johansson')} />
              </div>
              <div>
                <label style={lbl}>{tr('ui.er_referens')}</label>
                <input value={theirRef} onChange={e => setTheirRef(e.target.value)} style={inp} placeholder={tr('ui.johan_svensson')} />
              </div>
            </div>

            {/* "Fler alternativ" (dolt bakom en Fler alternativ-knapp) togs
                bort helt — kundfeedback: sidan såg ut som Fortnox rakt av
                utan att faktiskt göra samma sak. Av de tio fälten som stod
                där var FEM rent dekorativa (Kostnadsställe/Prislista/Kurs/
                Enhet/Etiketter) — ingen value/onChange någonstans, skrev
                man i dem sparades det aldrig. Bara Ert ordernummer och
                Valuta var på riktigt kopplade till state, de visas nu direkt
                utan någon gömd panel att klicka fram för nästan ingenting.
                Projekt och Husavdrag (Pris inkl. moms också, se
                Fakturarader nedan) var likaså dekorativa i sitt gamla skick
                — men till skillnad från de tre ovan FINNS det riktiga
                system bakom dem (projektmodulen som Offert/Leverantörs-
                faktura redan länkar mot, respektive de faktiska ROT/RUT-
                reglerna, se utils/rotRutConfig.js) — kopplade till på
                riktigt istället för att antingen återskapa attrapperna
                eller strunta i dem helt. */}
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
              <div>
                <label style={lbl}>{tr('ui.ert_ordernummer')}</label>
                <input value={ourOrderNr} onChange={e => setOurOrderNr(e.target.value)} style={inp} placeholder={tr('ui.valfritt')} />
              </div>
              <div>
                <label style={lbl}>{tr('ui.valuta')}</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={isLocked} style={inp}>
                  {['SEK', 'NOK', 'EUR', 'USD', 'GBP'].map(c => <option key={c}>{c}</option>)}
                </select>
                {currency !== 'SEK' && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ ...lbl, fontSize: '12px' }}>{tr('ui.kurs_sek_per')} {currency}</label>
                    <input
                      inputMode="decimal" value={fxRate} disabled={isLocked}
                      onChange={e => { setFxRate(e.target.value); setFxRateManual(true); setFxStatus(''); }}
                      style={inp} placeholder="11,50"
                    />
                    {fxStatus && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>{fxStatus}</div>}
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>{tr('ui.projekt')}</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inp}>
                  <option value="">{tr('ui.inget_projekt')}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {/* Husavdrag (ROT/RUT) — bara relevant när kunden är en
                privatperson, aldrig ett företag. Döljs helt annars istället
                för att visas gråad/förklaras varför den inte går att välja. */}
            {customerIsIndividual && currency === 'SEK' && (
              <div style={{ marginTop: '16px' }}>
                <label style={lbl}>{tr('ui.husavdrag')}</label>
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '9px', overflow: 'hidden', maxWidth: '300px' }}>
                  {[{ v: 'none', l: 'Inget' }, { v: 'rot', l: `ROT (${ROT_RUT_RATES.rot.percent}%)` }, { v: 'rut', l: `RUT (${ROT_RUT_RATES.rut.percent}%)` }].map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => setRotRutType(v)} style={{
                      flex: 1, padding: '8px 6px', border: 'none', fontSize: '12.5px', cursor: 'pointer',
                      background: rotRutType === v ? 'var(--accent)' : 'var(--bg-card)',
                      color: rotRutType === v ? 'white' : 'var(--text-main)', fontWeight: rotRutType === v ? 700 : 500,
                    }}>{l}</button>
                  ))}
                </div>
                {rotRutType !== 'none' && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '460px' }}>
                    {!customerHasPersonnummer && (
                      <p style={{ margin: '0 0 4px', color: 'var(--status-red-text)', fontWeight: 600 }}>
                        {tr('ui.kunden_saknar_personnummer_kravs_for_en')} {ROT_RUT_RATES[rotRutType].label}{tr('ui.begaran_hos_skatteverket_lagg_till_det_under_kon')}
                      </p>
                    )}
                    <p style={{ margin: 0 }}>
                      {tr('ui.avdraget_raknas_bara_pa_rader_markta_arbete_neda')} {ROT_RUT_RATES[rotRutType].label} {tr('ui.och_eventuellt_andra_husavdrag_delar_samma_tak_p')} {numberFormat('sv-SE').format(ROT_RUT_COMBINED_CAP)} {tr('rotRut.capNote')}
                    </p>
                  </div>
                )}
                {rotRutType !== 'none' && (
                  <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '12px' }}>
                    <div>
                      <label style={lbl}>{tr('rotRut.workType')}</label>
                      <select value={workTypesFor(rotRutType).includes(rotRutWorkType) ? rotRutWorkType : ''} onChange={e => setRotRutWorkType(e.target.value)} style={inp}>
                        <option value="">{tr('rotRut.chooseWorkType')}</option>
                        {workTypesFor(rotRutType).map(w => <option key={w} value={w}>{tr(`rotRut.work.${w}`)}</option>)}
                      </select>
                    </div>
                    {!RUT_FLAT_RATE_TYPES.includes(rotRutWorkType) && (
                      <div>
                        <label style={lbl}>{tr('rotRut.hours')}</label>
                        <input inputMode="numeric" value={rotRutHours} onChange={e => setRotRutHours(e.target.value.replace(/\D/g, '').slice(0, 3))} style={inp} placeholder="8" />
                      </div>
                    )}
                    {rotRutType === 'rot' && (
                      <>
                        <div>
                          <label style={lbl}>{tr('rotRut.property')}</label>
                          <input value={rotRutProperty} onChange={e => setRotRutProperty(e.target.value.slice(0, 40))} style={inp} placeholder={tr('rotRut.propertyPlaceholder')} />
                        </div>
                        <div>
                          <label style={lbl}>{tr('rotRut.brfOrgNr')}</label>
                          <input inputMode="numeric" value={rotRutBrfOrgNr} onChange={e => setRotRutBrfOrgNr(e.target.value.slice(0, 13))} style={inp} placeholder="769600-0000" />
                        </div>
                        <div>
                          <label style={lbl}>{tr('rotRut.apartment')}</label>
                          <input value={rotRutApartment} onChange={e => setRotRutApartment(e.target.value.slice(0, 25))} style={inp} placeholder="1102" />
                        </div>
                      </>
                    )}
                    <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {tr(rotRutType === 'rot' ? 'rotRut.formHelpRot' : 'rotRut.formHelpRut')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Kunduppgifter */}
          {customer && (
            <Section title={tr('ui.kunduppgifter')} defaultOpen={false}>
              <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div>
                  <label style={lbl}>{tr('ui.namn')}</label>
                  <input defaultValue={customer.name} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{tr('ui.fakturaadress')}</label>
                  <input defaultValue={customer.address || ''} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{tr('ui.postnr')}</label>
                  <input style={inp} />
                </div>
                <div>
                  <label style={lbl}>{tr('ui.ort')}</label>
                  <input style={inp} />
                </div>
                <div>
                  <label style={lbl}>{tr('ui.organisationsnummer')}</label>
                  <input defaultValue={customer.orgNr || ''} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{tr('ui.telefon')}</label>
                  <input defaultValue={customer.phone || ''} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{tr('ui.land')}</label>
                  <select style={inp}><option>{tr('ui.sverige')}</option><option>{tr('ui.norge')}</option><option>{tr('ui.danmark')}</option></select>
                </div>
                <div style={{ paddingTop: '18px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
                    <input type="checkbox" /> {tr('ui.export')}
                  </label>
                </div>
              </div>
            </Section>
          )}

          {/* Leveransuppgifter */}
          <Section title={tr('ui.leveransuppgifter')} defaultOpen={false}>
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div><label style={lbl}>{tr('ui.leveransadress')}</label><input style={inp} /></div>
              <div><label style={lbl}>{tr('ui.leveransort')}</label><input style={inp} /></div>
              <div><label style={lbl}>{tr('ui.leveransdatum')}</label><input type="date" style={inp} /></div>
              <div><label style={lbl}>{tr('ui.leveranssatt')}</label><input style={inp} /></div>
            </div>
          </Section>

          {/* Fakturarader — samma rutnätsmönster som QuoteEditor:s
              "Offertrader" (Quotes.jsx: gridTemplateColumns-rader av riktiga
              inputs) istället för ett tätt kalkylblad (<table>, 12px celler).
              Avancerade fält (artikelnr/momsfri tjänst/rabatt/konto) bakom
              kugghjulet, precis som förut — bara paketeringen är ny. */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{tr('ui.fakturarader')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Pris inkl. moms — påverkar bara hur À-pris-fältet
                    tolkar det du skriver, se priceInclVat-kommentaren
                    ovan. Avstängd som förval eftersom nettopris (dagens
                    beteende) är det gängse i bokföringsprogram. */}
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '7px', overflow: 'hidden' }}>
                  {[{ v: false, l: 'Pris exkl. moms' }, { v: true, l: 'Pris inkl. moms' }].map(({ v, l }) => (
                    <button
                      key={l} type="button" onClick={() => setPriceInclVat(v)}
                      style={{
                        padding: '5px 10px', border: 'none', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                        background: priceInclVat === v ? 'var(--accent)' : 'var(--bg-card)',
                        color: priceInclVat === v ? 'white' : 'var(--text-secondary)',
                      }}
                    >{l}</button>
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{rows.length} {rows.length === 1 ? tr('ui.rad_2') : tr('ui.rader')}</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div className="inv-rows-min" style={{ minWidth: '760px' }}>
                <div className="inv-rows-head" style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.7fr 0.9fr 0.7fr 0.9fr auto auto', gap: '10px', marginBottom: '8px', padding: '0 2px' }}>
                  {[tr('ui.benamning'), tr('ui.antal'), priceInclVat ? tr('ui.a_pris_inkl_moms') : tr('ui.pris_2'), tr('ui.moms'), tr('ui.summa'), '', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: i >= 1 && i <= 4 ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>

                {rows.map((row, i) => {
                  const { net } = calcRow(row);
                  const advancedOpen = expandedRows.has(row.id);
                  return (
                    <div key={row.id} className="inv-row-card" style={{ marginBottom: '10px' }}>
                      <div className="inv-row-grid" style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.7fr 0.9fr 0.7fr 0.9fr auto auto', gap: '10px', alignItems: 'center' }}>
                        <div className="inv-cell" data-label={tr('ui.benamning')}>{isLocked ? (
                          <div style={{ ...inp, background: 'var(--bg-muted)', border: '1px solid var(--border-light)' }}>{row.description}</div>
                        ) : (
                          <input
                            value={row.description}
                            list="article-description-list"
                            onChange={e => updateRow(i, 'description', e.target.value)}
                            onBlur={e => {
                              const hit = findArticleByDescription(e.target.value);
                              if (hit) applyArticleToRow(i, hit);
                            }}
                            style={inp}
                            placeholder={tr('ui.beskrivning_av_tjanst_eller_produkt')}
                          />
                        )}</div>
                        <div className="inv-cell" data-label="Antal">{isLocked ? (
                          <div style={{ ...inp, background: 'var(--bg-muted)', border: '1px solid var(--border-light)', textAlign: 'right' }}>{row.qty}</div>
                        ) : (
                          <input type="number" value={row.qty} onChange={e => updateRow(i, 'qty', Number(e.target.value))} style={{ ...inp, textAlign: 'right' }} />
                        )}</div>
                        <div className="inv-cell" data-label={tr('ui.pris_2')}>{isLocked ? (
                          <div style={{ ...inp, background: 'var(--bg-muted)', border: '1px solid var(--border-light)', textAlign: 'right' }}>{fmt(row.unitPrice)}</div>
                        ) : (
                          <input
                            type="number"
                            // row.unitPrice är alltid nettot (se priceInclVat-
                            // kommentaren ovan) — bara VISNINGEN och det man
                            // skriver in räknas om till/från brutto här.
                            value={priceInclVat ? row.unitPrice * (1 + (row.vatRate || 0) / 100) : row.unitPrice}
                            onChange={e => {
                              const typed = Number(e.target.value);
                              const net = priceInclVat ? typed / (1 + (row.vatRate || 0) / 100) : typed;
                              updateRow(i, 'unitPrice', net);
                            }}
                            style={{ ...inp, textAlign: 'right' }}
                          />
                        )}</div>
                        <div className="inv-cell" data-label="Moms">{(isLocked || vatExempt) ? (
                          <div title={vatExempt ? tr('ui.foretaget_ar_inte_momsregistrerat') : undefined} style={{ ...inp, background: 'var(--bg-muted)', border: '1px solid var(--border-light)', textAlign: 'right' }}>{vatExempt ? 0 : row.vatRate}%</div>
                        ) : (
                          <select value={row.vatRate} onChange={e => updateRow(i, 'vatRate', Number(e.target.value))} style={inp}>
                            {[0, 6, 12, 25].map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        )}</div>
                        <div className="inv-cell" data-label="Summa"><div style={{ ...inp, background: 'var(--bg-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', textAlign: 'right', fontWeight: 600 }}>{fmt(net)}</div></div>
                        <div className="inv-cell-actions" data-label=""><button type="button" onClick={() => toggleRowAdvanced(row.id)} title={tr('ui.fler_falt_for_raden')} style={{ padding: '6px', background: advancedOpen ? 'var(--status-blue-bg)' : 'transparent', borderRadius: '7px', border: 'none', cursor: 'pointer', color: advancedOpen ? 'var(--status-blue-text)' : 'var(--text-muted)' }}>
                          <Settings2 size={15} />
                        </button>
                        <button type="button" onClick={() => removeRow(i)} disabled={isLocked || rows.length === 1} title={tr('ui.ta_bort_rad')} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: (isLocked || rows.length === 1) ? 'not-allowed' : 'pointer', color: (isLocked || rows.length === 1) ? 'var(--border)' : '#ef4444' }}>
                          <Trash2 size={15} />
                        </button></div>
                      </div>

                      {/* Arbete/Material — bara synlig när Husavdrag är
                          valt ovan. Avdraget (utils/rotRutConfig.js) räknas
                          bara på rader märkta "Arbete", aldrig material. */}
                      {rotRutType !== 'none' && !isLocked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tr('ui.rad_avser')}</span>
                          {[{ v: true, l: 'Arbete' }, { v: false, l: 'Material' }].map(({ v, l }) => (
                            <button
                              key={l} type="button" onClick={() => updateRow(i, 'rotRutLabor', v)}
                              style={{
                                padding: '2px 9px', borderRadius: '999px', border: '1px solid transparent', cursor: 'pointer',
                                fontSize: '11px', fontWeight: 600,
                                background: Boolean(row.rotRutLabor) === v ? BRAND.greenLight : 'var(--bg-muted)',
                                color: Boolean(row.rotRutLabor) === v ? BRAND.greenDark : 'var(--text-secondary)',
                              }}
                            >{l}</button>
                          ))}
                        </div>
                      )}

                      {advancedOpen && (
                        <div className="form-row-stack" style={{ marginTop: '8px', padding: '14px', background: 'var(--bg-muted)', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                          <div>
                            <label style={lbl}>{tr('ui.artikelnr')}</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                disabled={isLocked}
                                style={inp}
                                placeholder={tr('ui.artnr')}
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
                                  title={tr('ui.spara_radens_artikelnr_benamning_pris_moms_i_art')}
                                  style={{ flexShrink: 0, padding: '0 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', cursor: (row.articleNumber || '').trim() ? 'pointer' : 'not-allowed', color: 'var(--text-main)', fontSize: '12.5px', fontWeight: 600 }}
                                >
                                  {tr('ui.spara')}
                                </button>
                              )}
                            </div>
                          </div>
                          {!vatExempt && <div>
                            <label style={lbl}>{tr('ui.tjanst_momsfri')}</label>
                            <select disabled={isLocked} value={row.vatRate === 0 ? 'Ja' : 'Nej'} onChange={e => updateRow(i, 'vatRate', e.target.value === 'Ja' ? 0 : 25)} style={inp}>
                              <option>{tr('ui.ja')}</option><option>{tr('ui.nej')}</option>
                            </select>
                          </div>}
                          <div>
                            <label style={lbl}>{tr('ui.rabatt')}</label>
                            <input disabled={isLocked} type="number" min="0" max="100" value={row.discount || 0} onChange={e => updateRow(i, 'discount', Number(e.target.value))} style={inp} />
                          </div>
                          <div>
                            <label style={lbl}>{tr('ui.konto_2')}</label>
                            {/* Var ett tomt textfält där man förväntades kunna
                                fyra siffror utantill. Samma sökbara kontoväljare
                                som resten av appen använder, med hela kontoplanen
                                ett klick bort. Låst faktura: bara kontot, ingen
                                väljare — fältet ska inte gå att ändra då. */}
                            {isLocked
                              ? <input disabled value={row.account || '3001'} style={inp} />
                              : <AccountSearch value={row.account || '3001'} onChange={code => updateRow(i, 'account', code)} accounts={accounts} placeholder={tr('ui.sok_konto')} />}
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
                <Plus size={14} /> {tr('ui.lagg_till_rad')}
              </button>
            )}

            {/* Delas av alla radernas Artikelnr-fält ovan (HTML5 <datalist>
                kräver ett enda, delat id) — native webbläsarautocomplete,
                ingen egen dropdown-komponent behövs. Artikelnr är valfritt
                numera (Articles.jsx) — en artikel utan nummer har inget att
                visa här, hoppas bara över. */}
            <datalist id="article-register-list">
              {articles.filter(a => a.articleNumber).map((a, i) => (
                <option key={a.id || `${a.articleNumber}-${i}`} value={a.articleNumber}>{a.description}</option>
              ))}
            </datalist>
            {/* Samma register, men matchat på Beskrivning (findArticleByDescription
                ovan) — så artiklar UTAN artikelnr också går att välja, delat med
                Beskrivning-fältet på varje rad. */}
            <datalist id="article-description-list">
              {articles.map((a, i) => (
                <option key={a.id || `${a.description}-${i}`} value={a.description}>{a.description}</option>
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
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{tr('ui.fakturatext')}</h3>
            <textarea
              value={invoiceText} onChange={e => setInvoiceText(e.target.value)}
              style={{ ...inp, minHeight: '70px', resize: 'vertical', lineHeight: 1.6, maxWidth: '640px', marginBottom: '20px' }}
              placeholder={tr('ui.hej_tack_for_ditt_kop_hos_oss')}
            />

            <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '360px', marginLeft: 'auto', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{tr('ui.netto_exkl_moms')}</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmt(totals.net)} {currency}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{tr('ui.moms')}</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmt(totals.vat)} {currency}</span>
              </div>
              {rotRutType === 'none' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '4px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tr('ui.att_betala')}</span>
                  <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>{fmt(totals.total)} {currency}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '4px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <span>{tr('ui.fakturerat_belopp')}</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmt(totals.total)} {currency}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-red-text)' }}>
                    <span>{ROT_RUT_RATES[rotRutType].label}{tr('ui.avdrag')}{rotRut.rate}%)</span><span style={{ fontWeight: 600 }}>−{fmt(rotRut.deduction)} {currency}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '4px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tr('ui.att_betala')}</span>
                    <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>{fmt(amountAfterRotRut)} {currency}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Spara/bokför — sista raden i formuläret, samma placering och
              knappstil som QuoteEditor:s "Avbryt/Spara offert". */}
          <div className="mform-foot" style={{ padding: '20px 32px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => handleSave('draft')} style={outlineToolbarBtnStyle}>
              {tr('ui.spara_som_utkast')}
            </button>
            <button type="button" onClick={() => handleSave('sent')} style={listHeaderButtonStyle('primary')}>
              <Check size={14} /> {tr('ui.bokfor_2')}
            </button>
          </div>
          <MobileFormBar>
            {(initial?.status || 'draft') === 'draft' && (
              <button type="button" className="mform-bar-secondary" onClick={() => handleSave('draft')}>{tr('ui.spara_som_utkast')}</button>
            )}
            <button type="button" className="mform-bar-primary" onClick={() => handleSave('sent')}>
              {initial ? tr('ui.spara_andringar') : tr('ui.skapa_faktura')}
            </button>
          </MobileFormBar>
        </div>
      </div>

      {/* ── Förhandsgranskning — öppnas nu som en fullskärmsmodal med samma
             InvoiceDocument-komponent (och samma .a4-paper-storlek, 210mm)
             som PDF-exporten fångar, istället för en 460px sidopanel skalad
             till 92% — där syntes aldrig "hela" fakturan, bara en hopklämd
             tumnagel av den. Mall/accentfärg-väljaren flyttar med hit upp
             i modalens header, ändras fortfarande direkt på DENNA faktura. ── */}
      {/* ── Skriv meddelandet till kunden ────────────────────────────────
          Utskicket gick tidigare iväg direkt när man tryckte "Skicka via
          e-post", med en fast text. Kundönskemål: texten skiljer sig från
          kund till kund och måste gå att skriva om. Det som INTE går att
          skriva bort är PDF:en, betalningsknappen och sammanfattningsraden
          — de läggs på efter meddelandet, så en faktura aldrig kan gå iväg
          utan det kunden behöver för att kunna betala. ── */}
      {showEmailCompose && (
        <div className="modal-overlay" onClick={() => !emailBusy && setShowEmailCompose(false)}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{tr('ui.skicka_faktura')} {nextNum}</h2>
              <button className="modal-close" onClick={() => setShowEmailCompose(false)} disabled={emailBusy}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{tr('ui.till_2')}</label>
                <input
                  className="form-control"
                  value={emailToInput}
                  onChange={e => setEmailToInput(e.target.value)}
                  placeholder={tr('ui.mottagarens_epost_se')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{tr('ui.amne')}</label>
                <input
                  className="form-control"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>{tr('ui.meddelande')}</label>
                  <button
                    type="button"
                    onClick={() => setEmailMessage(defaultEmailMessage())}
                    style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, color: 'var(--accent-text)', cursor: 'pointer' }}
                  >
                    {tr('ui.aterstall_standardtexten')}
                  </button>
                </div>
                <textarea
                  className="form-control"
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  rows={9}
                  style={{ resize: 'vertical', lineHeight: 1.6 }}
                  placeholder={tr('ui.hej_har_kommer_fakturan_for')}
                />
              </div>

              {emailWarnings.length > 0 && (
                <div style={{ background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 700, color: 'var(--status-amber-text)', marginBottom: '6px' }}>
                    <AlertTriangle size={14} /> {tr('ui.kontrollera_fakturan_forst')}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--status-amber-text)', lineHeight: 1.6 }}>
                    {emailWarnings.map(v => <li key={v}>{v}</li>)}
                  </ul>
                </div>
              )}

              {/* Det som alltid följer med, sagt rakt ut så ingen skriver
                  "se bifogad faktura" i tron att den inte finns. */}
              <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {tr('ui.foljer_med_automatiskt_fakturan_som_pdf_och_en_r')}
                {company?.stripeAccountId && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '10px', cursor: 'pointer', color: 'var(--text-main)' }}>
                    <input
                      type="checkbox"
                      checked={emailWithPaymentLink}
                      onChange={e => setEmailWithPaymentLink(e.target.checked)}
                      style={{ marginTop: '2px', cursor: 'pointer' }}
                    />
                    <span>{tr('ui.lagg_med_en')} <strong>{tr('ui.betala_nu')}</strong>{tr('ui.knapp_kortbetalning_via_stripe_avmarkera_om_kund')}</span>
                  </label>
                )}
              </div>

              {emailError && (
                <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', fontWeight: 600 }}>{emailError}</div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEmailCompose(false)} disabled={emailBusy}>{tr('ui.avbryt')}</button>
              {/* Samma fix som toolbar-knappen ovanför (tb-send): bara emailBusy
                  spärrar klicket, en tom adress ska ge felrutan ovan (emailError),
                  inte ett osynligt dött klick. */}
              <button className="btn btn-primary" onClick={handleSendEmail} disabled={emailBusy}>
                {emailBusy ? tr('ui.skickar_2') : tr('ui.skicka')}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <h2 className="modal-title" style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr('ui.forhandsgranskning_faktura')} {nextNum}</h2>
                <button className="modal-close" onClick={() => setShowPreview(false)} style={{ flexShrink: 0 }}><X size={18} /></button>
              </div>
              <div className="invoice-preview-controls" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {/* Samma "grönt i alla, inte bara den valda"-mönster som
                      Quotes.jsx:s motsvarande väljare — grön kant + grön
                      text på de inaktiva pillren också, i stället för ett
                      neutralt grå/svart par, så hela gruppen läses som en
                      sammanhängande grön mallväljare. */}
                  {Object.values(INVOICE_TEMPLATES).map(tpl => {
                    const active = invoiceTemplateSnapshot.templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id} type="button" disabled={isLocked} title={tpl.description}
                        onClick={() => setInvoiceTemplateSnapshot(s => ({ ...s, templateId: tpl.id }))}
                        style={{
                          padding: '5px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap',
                          border: `1.5px solid var(--accent)`,
                          background: active ? 'var(--accent)' : 'var(--bg-card)', color: active ? 'white' : 'var(--accent-text)',
                          cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.6 : 1,
                        }}
                      >{tpl.label}</button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{tr('ui.accentfarg')}</span>
                  <input
                    type="color" disabled={isLocked}
                    value={invoiceTemplateSnapshot.accentColor || INVOICE_TEMPLATES[invoiceTemplateSnapshot.templateId]?.defaultAccent || '#000000'}
                    onChange={e => setInvoiceTemplateSnapshot(s => ({ ...s, accentColor: e.target.value }))}
                    style={{ width: '32px', height: '24px', padding: '1px', border: '1px solid var(--border)', borderRadius: '4px', cursor: isLocked ? 'not-allowed' : 'pointer', background: 'var(--bg-card)', flexShrink: 0 }}
                  />
                  {isLocked && <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{tr('ui.last_redan_skickad')}</span>}
                </div>
                {/* Sida 38, punkt 4: +/- zoom som fallback till pinch — samma
                    kontrollrad som mall/accentfärg, så den redan skrollar
                    horisontellt istället för att radbryta på smala skärmar. */}
                <div className="preview-zoom-ctl" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, border: '1px solid var(--border)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                    disabled={previewZoom <= 0.5} title={tr('ui.zooma_ut')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom <= 0.5 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom <= 0.5 ? 'not-allowed' : 'pointer' }}
                  ><ZoomOut size={14} /></button>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '38px', textAlign: 'center', flexShrink: 0 }}>{Math.round(previewZoom * 100)}%</span>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                    disabled={previewZoom >= 2} title={tr('ui.zooma_in')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom >= 2 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom >= 2 ? 'not-allowed' : 'pointer' }}
                  ><ZoomIn size={14} /></button>
                </div>
                <div style={{ flex: 1, minWidth: '8px' }} />
                <button onClick={handleDownloadPdf} disabled={pdfBusy} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: pdfBusy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Download size={13} /> {pdfBusy ? tr('ui.skapar_pdf') : tr('ui.ladda_ner_pdf')}
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
                <PaperFit>
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
                  logoSize={invoiceTemplateSnapshot.logoSize}
                  showCompanyName={invoiceTemplateSnapshot.showCompanyName}
                  footerText={invoiceTemplateSnapshot.footerText}
                  rotRut={rotRutType !== 'none' ? { type: rotRutType, ...rotRut } : null}
                />
                </PaperFit>
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
          logoSize={invoiceTemplateSnapshot.logoSize}
          showCompanyName={invoiceTemplateSnapshot.showCompanyName}
          footerText={invoiceTemplateSnapshot.footerText}
          rotRut={rotRutType !== 'none' ? { type: rotRutType, ...rotRut } : null}
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
    ? { title: tr('ui.inga_fakturor_matchar_din_sokning'), body: tr('ui.prova_att_rensa_sokningen_eller_filtren_ovan') }
    : { title: tr('ui.inga_fakturor_an'), body: tr('ui.skapa_din_forsta_faktura_for_att_komma_igang_med') };

  return (
    // Kundönskemål: samma gröna kort-bakgrund i båda lägena — inte
    // krämtonen (var(--bg-cream)) som i mörkt tema läste som brunt i
    // stället för grönt, till skillnad från t.ex. Kontakters tomt-läge.
    // Samma kortram som listan (raden 2811 nedan: rakt upptill, flush mot
    // filterraden ovanför, rundat bara nedtill) i stället för en egen
    // flytande ruta — tomt och fyllt läge är nu SAMMA kort.
    <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px', textAlign: 'center' }}>
        {isFilteredEmpty ? (
          <div style={{ width: 56, height: 56, borderRadius: '999px', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <NavInvoicesIcon size={26} />
          </div>
        ) : (
          <div style={{ marginBottom: '4px' }}>
            <InvoiceDocIllustration />
          </div>
        )}
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{title}</div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', margin: 0 }}>{body}</p>
        {!isFilteredEmpty && (
          // Inte .btn-primary (index.css: var(--lime-500), en ljusare grön)
          // — samma mörka varumärkesgröna knapp som Kontakters/Offerters
          // tomma-läge-knappar.
          <button
            onClick={onCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '8px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={15} /> {tr('ui.skapa_faktura')}
          </button>
        )}
      </div>
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
  const rotRut = calcRotRutDeduction(invoice.rotRutType, rows);

  const statusStyle = {
    paid: { bg: BRAND.greenLight, color: BRAND.greenDark, label: tr('ui.betald') },
    overdue: { bg: BRAND.redBg, color: BRAND.redText, label: tr('ui.forfallen') },
    sent: { bg: BRAND.amberBg, color: BRAND.amberText, label: tr('ui.obetald') },
    draft: { bg: BRAND.grayBg, color: BRAND.grayText, label: tr('ui.ej_bokford') },
  }[status] || { bg: BRAND.grayBg, color: BRAND.grayText, label: tr('ui.ej_bokford') };

  const tpl = invoice.invoiceTemplateSnapshot || {};
  const documentProps = {
    invoice: { invoiceNumber: invoice.invoiceNumber, date: invoice.date, dueDate: invoice.dueDate, terms: invoice.terms },
    customer, company, rows, totals,
    currency: invoice.currency || 'SEK',
    invoiceText: invoice.invoiceText || '',
    template: tpl.templateId, accentColor: tpl.accentColor, logoUrl: tpl.logoUrl, logoSize: tpl.logoSize, showCompanyName: tpl.showCompanyName, footerText: tpl.footerText,
    rotRut: invoice.rotRutType ? { type: invoice.rotRutType, ...rotRut } : null,
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const captureRef = useRef(null);

  const handleDownloadPdf = async () => {
    setPdfBusy(true); setPdfError('');
    try {
      await exportInvoicePdf(captureRef.current, `Faktura-${invoice.invoiceNumber}.pdf`);
    } catch {
      setPdfError(tr('ui.kunde_inte_skapa_pdf_forsok_igen'));
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
          {tr('ui.tillbaka')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{tr('ui.faktura_3')} {invoice.invoiceNumber}</h1>
          <span style={{ padding: '4px 10px', background: statusStyle.bg, color: statusStyle.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{statusStyle.label}</span>
        </div>
        <div style={{ flex: 1, minWidth: '8px' }} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {pdfError && <span style={{ fontSize: '11px', color: 'var(--status-red-text)' }}>{pdfError}</span>}
          <button type="button" onClick={handleDownloadPdf} disabled={pdfBusy} style={{ ...listHeaderButtonStyle('secondary'), opacity: pdfBusy ? 0.6 : 1 }}>
            <Download size={14} /> {pdfBusy ? tr('ui.skapar_pdf') : tr('ui.ladda_ner_pdf')}
          </button>
          <button type="button" onClick={onEdit} style={listHeaderButtonStyle('primary')}>
            <Pencil size={14} /> {tr('ui.redigera')}
          </button>
        </div>
      </div>

      {/* ── Dokumentet — full bredd, inbäddat direkt i sidan, ingen modal. ── */}
      <div className="doc-detail-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '900px' }}>
          <PaperFit><InvoiceDocument {...documentProps} /></PaperFit>
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


// Artikelregistret (list/redigering av `articles`) hade tidigare en egen
// modal-komponent här (ArticleRegisterModal). Flyttad till en riktig,
// hittbar sida — se Articles.jsx (nås via profilmenyns "Produkter &
// tjänster" samt "Artiklar"-länken i verktygsraden ovan, båda via
// onNavigate('articles')) — istället för att duplicera samma CRUD-logik
// på två ställen.

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
 * 2% marginal, dynamisk — se samma fil) transfereras separat till Bokix
 * efter varje betalning, styrt av Stripes Platform Pricing Tool i
 * Dashboard, inte av något värde den här filen räknar ut. Den här
 * komponenten ändrar inget i det flödet, den visar bara den redan
 * skapade länken.
 */
function PaymentLinkModal({ invoice, customer, company, onGetPaymentLinkUrl, onSyncBeforeServerCall, onClose, onMarkSent }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState(customer?.email || '');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  // Kundönskemål ("kunna skicka PDF:en tillsammans med betalningslänken")
  // — samma mönster som InvoiceViewer ovan: en osynlig, fast 794px-bred
  // kopia av InvoiceDocument för html2canvas att fånga, oavsett vad den
  // här modalens egen bredd råkar vara.
  const rows = invoice.rows || [];
  const totals = rows.reduce((acc, r) => {
    const gross = (Number(r.qty) || 0) * (Number(r.unitPrice) || 0) * (1 - (Number(r.discount) || 0) / 100);
    return { net: acc.net + gross, vat: acc.vat + gross * ((Number(r.vatRate) || 0) / 100), total: acc.total + gross * (1 + (Number(r.vatRate) || 0) / 100) };
  }, { net: 0, vat: 0, total: 0 });
  const rotRut = calcRotRutDeduction(invoice.rotRutType, rows);
  const tpl = invoice.invoiceTemplateSnapshot || {};
  const documentProps = {
    invoice: { invoiceNumber: invoice.invoiceNumber, date: invoice.date, dueDate: invoice.dueDate, terms: invoice.terms },
    customer, company, rows, totals,
    currency: invoice.currency || 'SEK',
    invoiceText: invoice.invoiceText || '',
    template: tpl.templateId, accentColor: tpl.accentColor, logoUrl: tpl.logoUrl, logoSize: tpl.logoSize, showCompanyName: tpl.showCompanyName, footerText: tpl.footerText,
    rotRut: invoice.rotRutType ? { type: invoice.rotRutType, ...rotRut } : null,
  };
  const captureRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const generatedUrl = await onGetPaymentLinkUrl(invoice.id);
        if (cancelled) return;
        setUrl(generatedUrl);
        onMarkSent?.(invoice.id);
      } catch (err) {
        if (!cancelled) setError(err.message || tr('ui.kunde_inte_skapa_betalningslank'));
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
    if (!to) { setEmailError(tr('ui.ange_en_mottagaradress')); return; }
    if (!/^\S+@\S+\.\S+$/.test(to)) { setEmailError(tr('ui.det_dar_ser_inte_ut_som_en_giltig_e_postadress')); return; }
    setEmailBusy(true); setEmailError(''); setEmailSent(false);
    try {
      // Best effort — misslyckas PDF-genereringen (t.ex. ett konstigt
      // fakturamallsval) skickas betalningslänken ändå, bara utan bilagan,
      // istället för att hela utskicket stoppas.
      let attachmentBase64 = null;
      try {
        attachmentBase64 = await getInvoicePdfBase64(captureRef.current);
      } catch (pdfErr) {
        console.warn('Kunde inte skapa PDF-bilaga till betalningslänken, skickar utan:', pdfErr);
      }

      const html = `
        <p>Hej${customer?.contactPerson ? ' ' + customer.contactPerson : ''},</p>
        <p>Här är en betalningslänk för faktura <strong>${invoice.invoiceNumber}</strong> på <strong>${fmt(invoiceCustomerRemaining(invoice))} kr</strong>${attachmentBase64 ? ', med fakturan bifogad som PDF' : ''}.</p>
        <p style="margin: 20px 0;">
          <a href="${url}" style="display:inline-block;padding:12px 26px;background:#0b6329;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Betala nu</a>
        </p>
        <p>Med vänlig hälsning<br/>${(company?.invoiceDisplayName || company?.name) || ''}</p>
      `;
      // Se motsvarande kommentar i InvoiceForm:s handleSendEmail ovan —
      // samma race mot App.jsx:s debouncade Supabase-sparning.
      await onSyncBeforeServerCall?.();
      await sendInvoiceEmail({
        to,
        subject: `Betalningslänk – faktura ${invoice.invoiceNumber}`,
        html,
        replyTo: company?.email || undefined,
        company_id: company?.id,
        ...(attachmentBase64 ? { attachmentBase64, attachmentFilename: `faktura-${invoice.invoiceNumber}.pdf` } : {}),
      });
      setEmailSent(true);
    } catch (err) {
      setEmailError(err.message || tr('ui.kunde_inte_skicka_e_post'));
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{tr('ui.betalningslank_faktura')} {invoice.invoiceNumber}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>{tr('ui.skapar_lank')}</div>
          ) : error ? (
            <div style={{ fontSize: '13px', color: 'var(--status-red-text)', fontWeight: 600 }}>{error}</div>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{tr('ui.lank')}</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input
                  type="text" readOnly value={url || ''}
                  onFocus={e => e.target.select()}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-muted)', color: 'var(--text-main)' }}
                />
                <button type="button" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: copied ? 'var(--status-green-bg)' : 'var(--accent)', color: copied ? 'var(--status-green-text)' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied ? <><Check size={14} /> {tr('ui.kopierad')}</> : <><Copy size={14} /> {tr('ui.kopiera')}</>}
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>{tr('ui.skicka_med_e_post_valfritt')}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="email" value={emailTo} onChange={e => { setEmailTo(e.target.value); setEmailError(''); }}
                    placeholder={tr('ui.kund_foretag_se')}
                    style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                  {/* Samma fix som fakturans toolbar-knapp (tb-send): en tom
                      adress ska ge felrutan nedan, inte ett dött, osynligt klick. */}
                  <button
                    type="button" onClick={handleSendEmail} disabled={emailBusy}
                    style={{ padding: '9px 16px', background: emailBusy ? 'var(--border)' : 'var(--accent)', color: emailBusy ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: emailBusy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {emailBusy ? tr('ui.skickar') : tr('ui.skicka')}
                  </button>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>{tr('ui.fakturan_bifogas_automatiskt_som_pdf')}</div>
                {emailError && <div style={{ fontSize: '12px', color: 'var(--status-red-text)', marginTop: '8px' }}>{emailError}</div>}
                {emailSent && !emailError && <div style={{ fontSize: '12px', color: 'var(--status-green-text)', fontWeight: 600, marginTop: '8px' }}>{tr('ui.skickad')}</div>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Osynlig, fast 794px-bred kopia för PDF-bilagan — samma mönster som
          InvoiceViewer/InvoiceForm. */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '794px', pointerEvents: 'none' }} aria-hidden="true">
        <InvoiceDocument ref={captureRef} {...documentProps} />
      </div>
    </div>
  );
}

export default function Invoices({ ufQuota = { limited: false }, invoices, contacts, accounts = [], onAdd, onMarkPaid, onRegisterPayment, onUnmarkPaid, onRotRutRequested, onRotRutPayout, onRotRutRejected, onImportRotRutBookings, onRotRutBatchRequested, onRotRutBatchPayout, setInvoices, company, globalAction, clearGlobalAction, verifications = [], onGetPaymentLinkUrl, articles = [], setArticles, uid, projects = [], onSyncBeforeServerCall }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // react-routers setSearchParams navigerar till bara "?…" och tappar
  // adressens #invoices, som säger vilken sida appen står på. Följden var
  // att en omladdning på Kundfakturor (eller dra-ned-för-att-uppdatera i
  // telefonen) alltid hamnade på Hem. Behåller hashen, och navigerar inte
  // alls när inget ändrats.
  const setSearchParams = (update, options) => {
    const current = new URLSearchParams(window.location.search);
    const next = typeof update === 'function' ? update(new URLSearchParams(current)) : new URLSearchParams(update);
    if (next.toString() === current.toString()) return;
    const search = next.toString();
    navigate({ search: search ? `?${search}` : '', hash: window.location.hash }, options);
  };

  // Två klart avgränsade sektioner, inte en klämd sida-vid-sida-vy — varje
  // sektion tar hela bredden när den är vald, precis som den fristående
  // Leverantörsfakturor-sidan redan gör. Bara två flikar, inte hela den
  // gamla flikraden (Inbetalningar/Påminnelser/Återkommande/Offerter är
  // fortsatt borttagna på användarens uttryckliga begäran).
  // Vilken faktura PaymentLinkModal (ovan) just nu är öppen för — null när
  // stängd. Håller själva fakturaobjektet (inte bara ett id) så modalen
  // slipper leta rätt på den igen i en lista som kan hinna ändras.
  const [paymentLinkInvoice, setPaymentLinkInvoice] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [showExtendedSearch, setShowExtendedSearch] = useState(false);
  // ROT/RUT-begäran till Skatteverket (RotRutRequestModal). Knappen visas
  // bara för den som faktiskt har fakturor med husavdrag.
  const [showRotRut, setShowRotRut] = useState(false); // false | 'new' | 'import'
  const rotRutBatches = company?.rotRutBatches || [];
  const hasRotRut = invoices.some(i => i.rotRutType) || rotRutBatches.length > 0;
  const rotRutToRequest = invoices.filter(i => i.rotRutType && !i.rotRutStatus && !i.creditFor && i.status === 'paid').length;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  // Kundönskemål: "en knapp där man kan se femton, trettio, femtio" — visar
  // upp till N fakturor PER statussektion nedan (Förfallen/Obetald/osv),
  // inte N totalt över alla — annars kunde en hel statusgrupp försvinna
  // tyst bara för att en annan grupp råkade fylla hela gränsen.
  const [pageSize, setPageSize] = useState(30);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [invoicePrefill, setInvoicePrefill] = useState(null); // t.ex. från Tidrapportering → "Skapa faktura"
  // "Visa faktura" (radmenyn) ≠ "Redigera" — ett skilt, rent läsläge som
  // bara renderar den riktiga fakturan (InvoiceViewer/InvoiceDocument),
  // aldrig det stora redigeringsformuläret. Eget state, ömsesidigt
  // uteslutande med showForm (se closeForm/openInvoice/viewInvoice nedan).
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [selected, setSelected] = useState(new Set());

  // Fakturaguiden (utils/invoiceTour.js) — genvägsknappen längst upp döljs
  // så fort kontot sett guiden en gång (localStorage, samma "sedd"-mönster
  // som den globala rundturen). Egen React-state utöver den — annars märker
  // sidan aldrig av att guiden precis stängdes, localStorage-läsningen sker
  // ju bara vid första render.
  const [invoiceTourSeen, setInvoiceTourSeen] = useState(() => hasSeenInvoiceTour(uid));
  // Exempelfakturan (buildDemoInvoice ovan) är bara på under tiden guiden är
  // öppen — sätts av handleStartInvoiceTour, nollställs igen så fort guiden
  // stängs (oavsett om den klickats igenom eller avbrutits i förtid), se
  // onDestroyed nedan.
  const [tourDemoActive, setTourDemoActive] = useState(false);
  const handleStartInvoiceTour = async () => {
    setTourDemoActive(true);
    // Väntar in att exempelfakturan (om den behövdes, dvs. listan annars var
    // tom) faktiskt hunnit renderas innan guiden startar — annars hinner
    // dess "valfria" steg (statusmärket/radmenyn) redan filtrerats bort som
    // "elementet finns inte" (samma race som buildSteps' kommentar i
    // invoiceTour.js varnar för), eftersom setTourDemoActive inte flushar
    // DOM:et synkront.
    await waitForElement('[data-inv-tour="row-status"]', 1000);
    startInvoiceTour({ uid, onDestroyed: () => { setInvoiceTourSeen(true); setTourDemoActive(false); } });
  };
  // Statuspillren ovanför tabellen är ett riktigt filter (kundönskemål:
  // "en sektion där man kan se endast ej bokförda eller obetalda"). Tidigare
  // fanns i stället en sektion per status, och pillren skrollade bara ner
  // till rätt sektion — nu finns EN tabell med ETT sidhuvud, som på
  // Bokföring/Verifikationer.
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (globalAction?.type === 'new_invoice') {
      setShowForm(true); setEditingInvoice(null);
      setInvoicePrefill(globalAction.payload || null);
      clearGlobalAction?.();
    }
    // Inställningar → Importera → ROT/RUT-uppdrag från en annan app.
    if (globalAction?.type === 'rotrut_import') {
      setShowRotRut('import');
      clearGlobalAction?.();
      return;
    }
    // Kundönskemål: Granskningskön (ReviewQueue.jsx) visade en Stripe-
    // betalnings ihopmatchade faktura bara som ett rått id-textsträng —
    // ingen väg att faktiskt SE fakturan därifrån. Samma
    // globalAction-mönster som 'new_invoice' ovan, bara att den öppnar en
    // BEFINTLIG faktura i visningsläge istället för ett tomt/förifyllt
    // formulär.
    if (globalAction?.type === 'open_invoice' && globalAction.payload?.id) {
      const found = invoices.find(i => i.id === globalAction.payload.id);
      if (found) { setEditingInvoice(found); setInvoicePrefill(null); setShowForm(true); }
      clearGlobalAction?.();
    }
  }, [globalAction, clearGlobalAction, invoices]);

  // Sök-/intervallfilter-ändringar ska nollställa markeringar — annars kan
  // man stå kvar med rader markerade som inte längre syns.
  useEffect(() => { setSelected(new Set()); }, [search, dateFrom, dateTo, amountMin, amountMax, statusFilter]);

  const invoiceList = invoices.filter(i => i.type !== 'quote');

  const getStatus = (inv) => {
    if (inv.status === 'paid') return 'paid';
    if ((inv.status === 'sent' || inv.status === 'unpaid') && isOverdue(inv)) return 'overdue';
    return inv.status || 'draft';
  };

  const getCustomerName = (id) => id === DEMO_CUSTOMER_ID ? tr('ui.exempelkund_ab') : (contacts.find(c => c.id === id)?.name || '—');

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

  // Fritextsökning + datum/beloppsintervall, ALLA statusar. Statusvalet
  // läggs på separat nedan (statusFiltered) — pillrens räknare ska visa hur
  // många fakturor som finns i varje status med nuvarande sökning, alltså
  // räknade FÖRE statusfiltret, annars skulle den valda statusen alltid
  // vara den enda med en siffra > 0.
  const searchFiltered = useMemo(() => invoiceList.filter(matchesSearchAndRange),
    [invoiceList, search, dateFrom, dateTo, amountMin, amountMax, contacts]);

  const filtered = useMemo(
    () => (statusFilter === 'all' ? searchFiltered : searchFiltered.filter(inv => getStatus(inv) === statusFilter)),
    [searchFiltered, statusFilter],
  );

  // Antal poster per status, för statuspillren — räknat på den
  // sök/intervall-filtrerade listan (se ovan) så siffrorna uppdateras när
  // man skriver, men utan att påverkas av vilket statuspiller som är valt.
  const statusCounts = useMemo(() => {
    const counts = {};
    searchFiltered.forEach(inv => {
      const st = getStatus(inv);
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [searchFiltered]);
  const allStatusCount = searchFiltered.length;

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

  // Bara den grenen som faktiskt renderar listan (InvoiceEmptyState-gaten +
  // tabellen längre ner) använder den här — bläddringen
  // («‹›» i InvoiceForm) använder fortfarande `sorted` orört, en påhittad
  // exempelfaktura ska aldrig gå att bläddra in i redigeringsläge.
  const sortedWithDemo = useMemo(() => {
    if (!tourDemoActive || invoiceList.length > 0) return sorted;
    return [...sorted, buildDemoInvoice()];
  }, [sorted, tourDemoActive, invoiceList.length]);

  // "Visa N" gäller hela listan nu (en tabell i stället för en tabell per
  // status). Markera-alla-rutan ska matcha exakt det som syns — och aldrig
  // försöka markera exempelfakturan, som inte är en riktig post.
  const visibleRows = pageSize === 'all' ? sortedWithDemo : sortedWithDemo.slice(0, pageSize);
  const selectableRows = visibleRows.filter(inv => !inv.isDemo);

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
      // ROT/RUT som inte begärts än: krediten tar även bort avdraget (1513),
      // och originalet ska inte längre dyka upp som att begära. Är avdraget
      // redan begärt eller utbetalt krediteras bara som vanligt.
      ...(original.rotRutType && !original.rotRutStatus ? { rotRutType: original.rotRutType } : {}),
    });
    if (original.rotRutType && !original.rotRutStatus) {
      setInvoices(prev => prev.map(i => (i.id === original.id ? { ...i, rotRutStatus: 'credited' } : i)));
    }
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
    if (id === DEMO_INVOICE_ID) return; // exempelfakturan (Fakturaguiden) ska inte gå att massmarkera/betala
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  // "Markera alla" görs per sektion (se STATUS_SECTIONS-renderingen nedan) —
  // varje sektions rubrikkryssruta markerar/avmarkerar bara sina egna rader.
  const toggleAllInRows = (rows) => {
    const realRows = rows.filter(inv => !inv.isDemo); // exempelfakturan räknas inte med i "Markera alla"
    const allSelected = realRows.length > 0 && realRows.every(inv => selected.has(inv.id));
    setSelected(prev => {
      const n = new Set(prev);
      realRows.forEach(inv => (allSelected ? n.delete(inv.id) : n.add(inv.id)));
      return n;
    });
  };

  // Bara utkast (aldrig bokförda) kan tas bort — samma princip som
  // isLocked i InvoiceForm: en faktura som är skickad/bokförd har en
  // riktig verifikation och ett fakturanummer som redan kan vara känt
  // hos kunden, den korrigeras med en kreditfaktura, den raderas inte.
  // Ett utkast har ingen sådan koppling än, så det går att bara ta bort.
  const handleDeleteInvoice = async (inv, e) => {
    e?.stopPropagation();
    // Ett utkast tas bort direkt, med Ångra i notisen (shared/undoToast.js).
    const index = invoices.findIndex(i => i.id === inv.id);
    setInvoices(prev => prev.filter(i => i.id !== inv.id));
    showUndo({ message: tr('ui.undo_utkast_borttaget'), onUndo: () => setInvoices(prev => restoreAt(prev, inv, index)) });
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
    // Exempelfakturan (buildDemoInvoice, bara synlig under Fakturaguiden) —
    // samma etiketter/ikoner/ordning som en riktig faktura skulle haft, så
    // guiden visar exakt vad menyn innehåller, men varje åtgärd är overksam.
    // Öppnar den varken det riktiga redigeringsformuläret eller skriver till
    // invoices/setInvoices — den ska aldrig av misstag kunna sparas som en
    // riktig faktura.
    if (inv.isDemo) {
      const noop = () => {};
      return [
        { key: 'view', label: tr('ui.visa_faktura'), icon: Eye, onClick: noop },
        { key: 'edit', label: tr('ui.redigera'), icon: Pencil, onClick: noop },
        { key: 'mark-paid', label: tr('ui.markera_som_betald'), icon: CheckCircle2, onClick: noop },
        { key: 'link-transaction', label: tr('ui.koppla_till_transaktion'), icon: Link2, onClick: noop },
        { key: 'payment-link', label: tr('ui.skapa_betalningslank'), icon: CreditCard, onClick: noop },
        { key: 'duplicate', label: tr('ui.kopiera_faktura'), icon: Copy, onClick: noop },
        { divider: true },
        { key: 'mark-sent', label: tr('ui.markera_som_skickad'), icon: Send, onClick: noop },
        { divider: true },
        { key: 'delete', label: tr('ui.ta_bort'), icon: Trash2, variant: 'danger', onClick: noop },
      ];
    }
    const items = [
      { key: 'view', label: tr('ui.visa_faktura'), icon: Eye, onClick: () => viewInvoice(inv) },
    ];
    if (status !== 'paid') {
      items.push({ key: 'edit', label: tr('ui.redigera'), icon: Pencil, onClick: () => openInvoice(inv) });
      items.push({ key: 'mark-paid', label: tr('ui.markera_som_betald'), icon: CheckCircle2, onClick: () => onMarkPaid(inv.id) });
    }
    // "Registrera betalning" (koppling mot en verifikation/inbetalning)
    // sköts redan inne i fakturaformuläret — den här raden öppnar dit
    // istället för att duplicera det flödet i menyn.
    items.push({ key: 'link-transaction', label: tr('ui.koppla_till_transaktion'), icon: Link2, onClick: () => openInvoice(inv) });
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
        key: 'payment-link', label: tr('ui.skapa_betalningslank'), icon: CreditCard,
        onClick: () => setPaymentLinkInvoice({ invoice: inv, customer }),
        disabled: !canCreateLink,
        title: !canCreateLink ? tr('ui.anslut_stripe_under_installningar_for_att_lata_k') : undefined,
      });
    }
    items.push({ key: 'duplicate', label: tr('ui.kopiera_faktura'), icon: Copy, onClick: () => handleDuplicateInvoice(inv) });

    if (status === 'draft') {
      items.push({ divider: true });
      items.push({ key: 'mark-sent', label: tr('ui.markera_som_skickad'), icon: Send, onClick: (e) => handleMarkSent(inv, e) });
    } else if (status !== 'paid') {
      items.push({ divider: true });
      // Bugfix (kodgranskning): tappade isOverdue-kollen som fanns innan
      // listan byggdes om till RowActionMenu — utan den erbjöd menyn en
      // "påminnelse"-knapp även för en nyss skickad faktura som inte ens
      // förfallit än, inte bara faktiskt förfallna.
      if (isOverdue(inv)) {
        items.push({
          key: 'remind', label: tr('ui.skicka_paminnelse'), icon: Send,
          onClick: () => { window.location.href = buildReminderMailto(inv, customer); },
          disabled: !customer?.email,
          title: !customer?.email ? tr('ui.lagg_till_kundens_e_post_under_kunder_for_att_ku') : undefined,
        });
      }
      items.push({ key: 'credit', label: tr('ui.kreditera_faktura'), icon: Undo2, onClick: () => handleCreateCreditNote(inv) });
    } else {
      items.push({ divider: true });
      items.push({ key: 'credit', label: tr('ui.kreditera_faktura'), icon: Undo2, onClick: () => handleCreateCreditNote(inv) });
    }

    if (status === 'draft') {
      items.push({ divider: true });
      items.push({ key: 'delete', label: tr('ui.ta_bort'), icon: Trash2, variant: 'danger', onClick: (e) => handleDeleteInvoice(inv, e) });
    }
    return items;
  };

  // En tabellrad — bruten ut till en egen funktion eftersom den nu renderas
  // en gång per statussektion istället för i en enda blandad tabell.
  // Kolumner för den delade ListTable-komponenten (samma tabell som
  // Kunder/Anställda/Bokföring m.fl. använder) — en kolumn per synlig
  // rubrik, `sortKeyName` på de tre som redan gick att sortera på.
  const invoiceColumns = [
    {
      key: 'invoiceNumber', label: tr('ui.fakturanr'), sortKeyName: 'invoiceNumber', fontWeight: 700, color: 'var(--text-main)',
      render: inv => inv.isDemo ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {inv.invoiceNumber}
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' }}>{tr('ui.exempel')}</span>
        </span>
      ) : inv.invoiceNumber,
    },
    { key: 'customer', label: tr('ui.kund'), fontWeight: 500, color: 'var(--text-main)', wrap: true, render: inv => getCustomerName(inv.customerId) },
    { key: 'date', label: tr('ui.fakturadatum'), sortKeyName: 'date', render: inv => formatDate(inv.date) },
    {
      key: 'dueDate', label: tr('ui.forfallodatum'), sortKeyName: 'dueDate',
      render: inv => <span style={{ color: isOverdue(inv) ? 'var(--status-red-text)' : 'var(--text-secondary)', fontWeight: isOverdue(inv) ? 700 : 400 }}>{formatDate(inv.dueDate)}</span>,
    },
    { key: 'amount', label: tr('ui.belopp'), align: 'right', sortKeyName: 'amount', fontWeight: 600, color: 'var(--text-main)', render: inv => fmt(grossOf(inv)) },
    {
      key: 'status', label: tr('ui.status'), render: inv => {
        const status = getStatus(inv);
        return (
          <div data-inv-tour="row-status" onClick={e => e.stopPropagation()}>
            {status === 'paid' ? (
              <span title={inv.paidDate ? `${tr('ui.betald')} ${formatDate(inv.paidDate)}` : undefined} style={{ ...STATUS_PILL, background: STRONG_PAID.bg, color: STRONG_PAID.text }}>
                <Check size={12} /> {tr('ui.betald')}
              </span>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); if (!inv.isDemo) onMarkPaid(inv.id); }}
                title={inv.isDemo ? tr('ui.exempelfaktura_bara_for_visning') : tr('ui.klicka_for_att_markera_som_betald')}
                style={{
                  ...STATUS_PILL, cursor: 'pointer', border: status === 'draft' ? STRONG_DRAFT.border : STATUS_PILL.border,
                  background: status === 'overdue' ? STRONG_OVERDUE.bg : status === 'draft' ? STRONG_DRAFT.bg : STRONG_UNPAID.bg,
                  color: status === 'overdue' ? STRONG_OVERDUE.text : status === 'draft' ? STRONG_DRAFT.text : STRONG_UNPAID.text,
                }}
              >
                {status === 'overdue' ? tr('ui.forfallen') : status === 'draft' ? tr('ui.ej_bokford') : tr('ui.obetald')}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions', label: '', align: 'right', render: inv => (
        <div onClick={e => e.stopPropagation()}>
          <RowActionMenu ariaLabel={tr('ui.fler_atgarder_faktura', { n: inv.invoiceNumber })} items={buildInvoiceRowMenuItems(inv, getStatus(inv), contacts.find(c => c.id === inv.customerId))} triggerProps={{ 'data-inv-tour': 'row-menu' }} />
        </div>
      ),
    },
  ];

  // Kort dag+månad ("24 sep"), samma Intl-mönster som redan används i
  // Reports.jsx — bara för listradens metatext (rad 2), inte för själva
  // fakturadatafälten (som fortfarande visar hela ISO-datumet på desktop).
  const shortDate = (d) => { try { return dateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' }).format(new Date(d)); } catch { return d; } };

  // Listradsläget (ListTable `mobileList`, se dess JSDoc) för kundfakturor
  // under 900px — kund som identitet, förfallo-/betaldatum och fakturanr
  // som metatext, samma statusfärger som skrivbordskolumnens egen badge.
  const invoiceMobileRow = (inv) => {
    const status = getStatus(inv);
    const dot = status === 'overdue' ? STRONG_OVERDUE.bg : status === 'draft' ? BRAND.grayText : status === 'paid' ? STRONG_PAID.bg : STRONG_UNPAID.bg;
    const metaDate = status === 'paid' ? `betald ${shortDate(inv.paidDate)}` : status === 'overdue' ? tr('ui.forfoll', { v0: shortDate(inv.dueDate) }) : tr('ui.forfaller', { v0: shortDate(inv.dueDate) });
    // Kundfeedback med skärmdump: på mobilen stod det bara "—" överst på
    // raden. Identitetsraden hämtade kundnamnet, och saknas kunden (utkast
    // där ingen valts än, eller en kund som tagits bort) blev hela raden
    // anonym — fakturanumret låg som liten metatext och gick inte att
    // urskilja. Nu tar fakturanumret över som identitet när kunden saknas,
    // och metaraden SÄGER att kunden saknas i stället för att bara utelämna
    // den, så man vet vad som är fel och kan åtgärda det.
    const customerName = getCustomerName(inv.customerId);
    const hasCustomer = Boolean(customerName) && customerName !== '—';
    return {
      dot,
      primary: hasCustomer ? customerName : tr('ui.faktura_2', { invoiceNumber: inv.invoiceNumber }),
      amount: fmt(grossOf(inv)),
      meta: hasCustomer ? `#${inv.invoiceNumber} · ${metaDate}` : tr('ui.ingen_kund_vald', { metaDate }),
      pill: status === 'paid' ? (
        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 700, background: STRONG_PAID.bg, color: STRONG_PAID.text }}>{tr('ui.betald')}</span>
      ) : (
        <span style={{
          padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 700,
          border: status === 'draft' ? STRONG_DRAFT.border : 'none',
          background: status === 'overdue' ? STRONG_OVERDUE.bg : status === 'draft' ? STRONG_DRAFT.bg : STRONG_UNPAID.bg,
          color: status === 'overdue' ? STRONG_OVERDUE.text : status === 'draft' ? STRONG_DRAFT.text : STRONG_UNPAID.text,
        }}>{status === 'overdue' ? tr('ui.forfallen') : status === 'draft' ? tr('ui.ej_bokford') : tr('ui.obetald')}</span>
      ),
    };
  };

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
        accounts={accounts}
        company={company}
        initial={editingInvoice}
        prefill={invoicePrefill}
        articles={articles}
        setArticles={setArticles}
        projects={projects}
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
        onSyncBeforeServerCall={onSyncBeforeServerCall}
        onClose={closeForm}
      />
    );
  }

  // Fyra verkliga statusar (getStatus() returnerar aldrig något annat) —
  // samma bg/text-färgpar här som på radernas egna statusmärken, och samma
  // mönster som Granskning-sidans badges: räknaren syns bara om > 0.
  const statusOptions = [
    { value: 'all', label: tr('ui.alla') },
    { value: 'draft', label: tr('ui.ej_bokford'), bg: STRONG_DRAFT.bg, color: STRONG_DRAFT.text, border: STRONG_DRAFT.border },
    { value: 'sent', label: tr('ui.obetald'), bg: STRONG_UNPAID.bg, color: STRONG_UNPAID.text, strong: true },
    { value: 'overdue', label: tr('ui.forfallen'), bg: STRONG_OVERDUE.bg, color: STRONG_OVERDUE.text, strong: true },
    { value: 'paid', label: tr('ui.betald'), bg: STRONG_PAID.bg, color: STRONG_PAID.text, strong: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--bg-page)' }}>
      {/* Sidhuvud. Kundfakturor, Offerter, Leverantörsfakturor och Artiklar nås
          via Försäljning i sidomenyn, så sidan behöver inga flikar. Fakturaguiden
          (invoiceTour.js) pekar på wrappern via data-inv-tour="tabs". */}
      <div data-inv-tour="tabs">
        <ListPageHeader
          title={tr('ui.kundfakturor')}
          subtitle={tr('ui.fakturor_du_skickar_till_dina_kunder')}
          actions={!invoiceTourSeen ? [
            // Fakturaguiden — döljs så fort den stängts en gång, se invoiceTourSeen
            // ovan. Kvar därefter under Hjälp och support.
            { key: 'tour', label: tr('ui.sa_funkar_fakturering'), icon: Sparkles, onClick: handleStartInvoiceTour, variant: 'secondary' },
          ] : []}
        />
      </div>

    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="inv-searchrow" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="inv-search" style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder={tr('ui.fakturanr_eller_kundnamn')} value={searchInput} onChange={e => setSearchInput(e.target.value)} style={{ ...listSearchInputStyle, width: '220px' }} />
          </div>
          <button onClick={() => setShowExtendedSearch(v => !v)} style={{ ...listHeaderButtonStyle('secondary'), ...(showExtendedSearch ? { background: 'var(--status-blue-bg)', borderColor: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' } : {}) }}>
            <span className="inv-ext-label-desktop">{tr('ui.utokad_sokning')}</span>
            <span className="inv-ext-label-phone"><SlidersHorizontal size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />{tr('shared.filterBar.filter')}</span>
          </button>
          <button className="inv-clear-btn" onClick={() => { setSearchInput(''); setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax(''); }} title={tr('ui.rensa_sokning')} style={{ ...listHeaderButtonStyle('secondary'), padding: '0 10px' }}><RefreshCw size={14} /></button>
          <div style={{ flex: 1 }} />
          {ufQuota.limited && (
            <span
              title={tr('ui.gratiskontot_for_uf_far_skapa_fakturor_per_dygn', { limit: ufQuota.limit })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '999px',
                background: ufQuota.reached ? 'var(--status-amber-bg)' : 'var(--bg-muted)',
                color: ufQuota.reached ? 'var(--status-amber-text)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              {ufQuota.reached
                ? tr('ui.dagens_fakturor_ar_skapade', { limit: ufQuota.limit })
                : tr('ui.av_fakturor_kvar_idag', { remaining: ufQuota.remaining, limit: ufQuota.limit })}
            </span>
          )}
          {hasRotRut && (
            <button onClick={() => setShowRotRut('new')} style={listHeaderButtonStyle('secondary')} title={tr('rotRut.buttonTitle')}>
              {tr('rotRut.button')}{rotRutToRequest > 0 ? ` (${rotRutToRequest})` : ''}
            </button>
          )}
          <button
            className="inv-cta page-fab" data-tour="page-invoices-cta" data-inv-tour="create-cta"
            onClick={() => { setShowForm(true); setEditingInvoice(null); setInvoicePrefill(null); }}
            disabled={ufQuota.reached}
            title={ufQuota.reached ? tr('ui.dygnstaket_ar_natt_fler_fakturor_gar_att_skapa_i') : undefined}
            style={{ ...listHeaderButtonStyle('primary'), ...(ufQuota.reached ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
          >
            <Plus size={14} /> {tr('ui.skapa_faktura')}
          </button>
        </div>
        {showExtendedSearch && (
          <div className="inv-extended" style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'end', background: 'var(--bg-muted)' }}>
            <div>
              <label style={lbl}>{tr('ui.datum_fran')}</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...listFilterFieldStyle, width: '150px' }} />
            </div>
            <div>
              <label style={lbl}>{tr('ui.datum_till')}</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...listFilterFieldStyle, width: '150px' }} />
            </div>
            <div>
              <label style={lbl}>{tr('ui.belopp_fran')}</label>
              <input type="number" value={amountMin} onChange={e => setAmountMin(e.target.value)} placeholder="0" style={{ ...listFilterFieldStyle, width: '110px' }} />
            </div>
            <div>
              <label style={lbl}>{tr('ui.belopp_till')}</label>
              <input type="number" value={amountMax} onChange={e => setAmountMax(e.target.value)} placeholder="—" style={{ ...listFilterFieldStyle, width: '110px' }} />
            </div>
          </div>
        )}
      </div>

      {/* Statuspiller — FILTRERAR listan (kundönskemål: "en sektion där man
          kan se endast ej bokförda eller obetalda"). De hoppade tidigare
          bara ner till en av flera statussektioner; nu finns bara EN tabell,
          så pillren är riktiga filter med "Alla" som utgångsläge.
          Hela raden döljs när företaget inte har någon faktura alls
          (kundönskemål: "har man inga fakturor ska den ej finnas") — en
          filterrad utan något att filtrera är bara brus på en tom sida. */}
      {invoiceList.length > 0 && (
      <div className="inv-pills" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
        {statusOptions.map(opt => {
          const count = opt.value === 'all' ? allStatusCount : (statusCounts[opt.value] || 0);
          // Tomma statusar visas inte — men den valda gömmer sig aldrig,
          // annars försvinner vägen tillbaka när sista fakturan i den
          // statusen byter status medan filtret står kvar på den.
          if (count === 0 && opt.value !== statusFilter && opt.value !== 'all') return null;
          const isActive = statusFilter === opt.value;
          const neutral = opt.value === 'all';
          return (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              aria-pressed={isActive}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 12px', minHeight: '30px', boxSizing: 'border-box', whiteSpace: 'nowrap',
                background: neutral ? (isActive ? 'var(--bg-muted)' : 'transparent') : opt.bg,
                border: opt.border || '1px solid transparent',
                // Vald status: en tydlig ring UTANFÖR pillret i dess egen färg
                // (via en dubbel box-shadow med kortbakgrunden emellan) —
                // en inre kantlinje syntes knappt mot de mättade
                // obetald/betald-pillren, som redan har en färgad yta.
                boxShadow: isActive ? '0 0 0 2px var(--bg-card), 0 0 0 3.5px ' + (neutral ? 'var(--text-secondary)' : opt.color) : 'none',
                borderRadius: '999px', fontSize: '12px', fontWeight: isActive ? 700 : 600,
                color: neutral ? 'var(--text-secondary)' : opt.color, cursor: 'pointer',
              }}
            >
              {opt.label}
              {/* Kraftfulla (obetald/betald) badges har en heltäckande,
                  mättad bakgrund — den vanliga --status-chip-bg (en
                  ~55%-vit overlay tänkt för bleka pastellbakgrunder) skulle
                  bli en urblekt fläck ovanpå en mörk grön/orange yta med
                  näst intill osynlig vit text. Egen vit halvtransparent
                  "glas"-variant för just de här istället. */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                // Siffran i chipets egen textfärg, så den går att läsa även på gult.
                background: opt.color === '#ffffff' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.08)',
                color: neutral ? 'var(--text-secondary)' : opt.color,
              }}>{count}</span>
            </button>
          );
        })}
        <div className="inv-pills-spacer" style={{ flex: 1 }} />
        {/* Kundönskemål: "en knapp där man kan se femton, trettio, femtio"
            — gäller nu HELA listan (en tabell), inte per statussektion, och
            samma väljare/ordning som ListFilterBar ritar på Bokföring och de
            andra listsidorna. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {tr('ui.visa')}
          <select
            value={pageSize}
            onChange={e => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{ ...listFilterFieldStyle, height: '28px', padding: '0 8px', fontSize: '12px' }}
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            <option value="all">{tr('ui.alla')}</option>
          </select>
        </label>
        <Printer className="inv-pills-extra" size={15} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} />
      </div>
      )}

      {/* EN tabell med ETT sidhuvud (Fakturanr/Kund/Fakturadatum/Förfallo-
          datum/Belopp/Status) och alla rader under varandra — kundönskemål,
          uttryckligen med Bokföring/Verifikationer som förebild. Ersätter de
          fyra statusindelade sektionerna (Förfallen/Obetald/Ej bokförd/
          Betald), som gav fyra sidhuvuden och fyra "markera alla"-rutor på
          samma skärm; statusen står i sin egen kolumn per rad och väljs med
          pillren ovanför i stället.
          Kortet är rakt upptill (0 0 12px 12px) och sitter flush mot
          filterraden ovanför — samma "fäst mot det ovanför, avrundad mot
          sidbakgrunden under"-princip som ListTable/ListFilterBar redan
          följer, i stället för ett runt kort som svävade under headern. */}
      {sortedWithDemo.length === 0 ? (
        <InvoiceEmptyState isFilteredEmpty={invoiceList.length > 0} onCreate={() => { setShowForm(true); setEditingInvoice(null); setInvoicePrefill(null); }} />
      ) : (
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <ListTable
            bordered={false}
            rowKey={inv => inv.id}
            onRowClick={inv => { if (inv.isDemo) return; setEditingInvoice(inv); setInvoicePrefill(null); setShowForm(true); }}
            rowStyle={inv => ({ background: selected.has(inv.id) ? 'var(--status-blue-bg)' : getRowBg(getStatus(inv)) })}
            sort={{ key: sortKey, dir: sortDir, onSort: toggleSort }}
            selectable={{
              checked: inv => selected.has(inv.id),
              onToggle: inv => toggleSelect(inv.id),
              allChecked: selectableRows.length > 0 && selectableRows.every(inv => selected.has(inv.id)),
              onToggleAll: () => toggleAllInRows(visibleRows),
            }}
            rows={visibleRows}
            columns={invoiceColumns}
            roundedBottom={false}
            mobileList={invoiceMobileRow}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 16px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderTop: '2px solid var(--border)', borderRadius: '0 0 12px 12px', fontWeight: 700, fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap', boxShadow: 'var(--shadow-sm)' }}>
            {/* Vänster: ärlig avskärningsrad. Utan den ser en "Visa 30" ut
                som om företaget bara HADE 30 fakturor. Summan till höger
                avser hela det filtrerade urvalet, inte bara det som ryms. */}
            <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--text-muted)' }}>
              {visibleRows.length < sortedWithDemo.length
                ? 'Visar ' + visibleRows.length + ' av ' + sortedWithDemo.length
                : sortedWithDemo.length + (sortedWithDemo.length === 1 ? ' faktura' : ' fakturor')}
            </span>
            <span>Summa SEK&nbsp;<span style={{ color: 'var(--text-main)', marginLeft: '6px' }}>{fmt(sumTotal)}</span></span>
          </div>
        </div>
      </div>
      )}

      {/* Bottom action bar (when rows selected) */}
      {selected.size > 0 && (
        <div className="inv-bulk-bar" style={{ background: 'var(--accent)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>({selected.size} {tr('ui.markerade')}</span>
          <button onClick={() => { selected.forEach(id => onMarkPaid(id)); setSelected(new Set()); }} style={{ padding: '6px 16px', background: '#22c55e', border: 'none', borderRadius: '5px', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            {tr('ui.markera_som_betalda')}
          </button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}><X size={18} /></button>
        </div>
      )}
    </div>

    {showRotRut && (
      <RotRutRequestModal
        invoices={invoices}
        contacts={contacts}
        company={company}
        batches={rotRutBatches}
        uid={uid}
        initialTab={showRotRut}
        onImportBookings={onImportRotRutBookings}
        onBatchRequested={onRotRutBatchRequested}
        onBatchPayout={onRotRutBatchPayout}
        onRequested={onRotRutRequested}
        onPayout={onRotRutPayout}
        onRejected={onRotRutRejected}
        onClose={() => setShowRotRut(false)}
      />
    )}

    {paymentLinkInvoice && onGetPaymentLinkUrl && (
      <PaymentLinkModal
        invoice={paymentLinkInvoice.invoice}
        customer={paymentLinkInvoice.customer}
        company={company}
        onGetPaymentLinkUrl={onGetPaymentLinkUrl}
        onSyncBeforeServerCall={onSyncBeforeServerCall}
        onClose={() => setPaymentLinkInvoice(null)}
        onMarkSent={(id) => setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i))}
      />
    )}
    </div>
  );
}
