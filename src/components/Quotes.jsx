import React, { useState, useRef, useEffect } from 'react';
import { isVatExempt } from '../utils/vatRegistration';
import { NavQuotesIcon, Plus, FileText, Check, X, Download, Trash2, Send, Eye, ZoomIn, ZoomOut, Paperclip, Loader2, Search, ChevronDown, ChevronRight } from './icons';
import PaperFit from './shared/PaperFit';
import InvoiceDocument, { DEFAULT_INVOICE_TEMPLATE, INVOICE_TEMPLATES } from './InvoiceDocument';
import { exportInvoicePdf, getInvoicePdfBase64 } from '../utils/exportInvoicePdf';
import { sendInvoiceEmail } from '../emailApi';
import { uploadFileToStorage } from '../utils/fileUpload';
import { BRAND } from '../utils/brandColors';
import ListPageHeader, { ListFilterBar, listSearchInputStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import { showUndo, restoreAt } from './shared/undoToast';
import { useMobileForm, MobileFormBar } from './shared/MobileForm';
import { t } from '../i18n';
import { numberFormat, dateTimeFormat } from '../utils/intlCache';

const fmtSEK = (val) => numberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);
const fmtDateSv = (d) => { if (!d) return '—'; try { return dateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; } };
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const emptyRow = (vat = 25) => ({ description: '', price: '', qty: 1, unit: 'st', vat, discount: 0, deduction: 'none' });
// Momssats ur en rad. Bugkritiskt: tidigare "Number(r.vat) || 25", som gjorde
// en momsfri rad (0 %) till 25 %.
const rowVatRate = (vat) => (vat === '' || vat == null || !Number.isFinite(Number(vat)) ? 25 : Number(vat));

// Sida 40: Enhet-dropdown på offertrader — vanligast förekommande enheter i
// svensk fakturering/offerering, "st" som förval.
const ROW_UNITS = ['st', 'tim', 'kr', 'm', 'm²', 'kg', 'dag'];
const VAT_RATES = [25, 12, 6, 0];
const DEDUCTION_OPTIONS = [
  { value: 'none', label: t('ui.inget_avdrag') },
  { value: 'rot', label: 'ROT' },
  { value: 'rut', label: 'RUT' },
  { value: 'green', label: t('ui.gront_avdrag') },
];

// Bilagor i mejlet (Sida 40) — samma godkända filtyper som redan etablerat
// för uppladdning i appen (Expenses.jsx: kvitton), men en TOTAL storleksgräns
// istället för en per-fil-gräns, eftersom det är den totala mejlstorleken som
// spelar roll. Filerna laddas upp direkt till Supabase Storage och skickas
// som LÄNKAR i mejlet (inte riktiga MIME-bilagor) — det är vad som faktiskt
// gör 15 MB möjligt: Vercels serverless-funktioner har ett hårt tak på
// ~4.5 MB per request, så riktiga base64-bilagor av den storleken skulle
// aldrig gå att skicka i produktion (se emailApi.js).
const ATTACHMENT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const ATTACHMENT_ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const MAX_ATTACHMENTS_TOTAL_MB = 15;

// Standardpunkter för "Övriga villkor" — vanlig branschsed på en offert
// (ansvarsbegränsning, giltighetstid, vad som ingår). Bara ett startförslag,
// fritt att redigera eller radera per offert.
const DEFAULT_OTHER_TERMS = [
  'Offerten gäller i 30 dagar',
  'Ändringar utöver offert kan påverka priset',
  'Endast arbete enligt offert ingår',
  'Ansvarsbegränsning: Ansvar begränsas till offertens totala belopp.',
].join('\n');

const getNextQuoteNumber = (quotesList) => {
  const nums = quotesList.map(q => Number(String(q.invoiceNumber || '').replace('OFF-', ''))).filter(n => !isNaN(n));
  return `OFF-${(nums.length > 0 ? Math.max(...nums) : 1000) + 1}`;
};

/** "Förfallen" är inget en människa sätter — den räknas fram (skickad men
 * giltighetstiden har passerat) precis som förfallna fakturor i
 * Invoices.jsx, istället för att stå kvar som "Skickad" för evigt. */
const getDisplayStatus = (q) => {
  if (q.status === 'sent' && q.dueDate && new Date(q.dueDate) < new Date()) return 'expired';
  return q.status || 'draft';
};

const getStatusStyle = (status) => {
  switch (status) {
    case 'accepted': return { bg: 'var(--status-green-bg)', color: 'var(--status-green-text)', label: t('ui.accepterad') };
    case 'sent': return { bg: 'var(--status-blue-bg)', color: 'var(--status-blue-text)', label: t('ui.skickad_2') };
    case 'rejected': return { bg: 'var(--status-red-bg)', color: 'var(--status-red-text)', label: t('ui.avvisad') };
    case 'expired': return { bg: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', label: t('ui.forfallen') };
    default: return { bg: 'var(--border-light)', color: 'var(--text-secondary)', label: t('ui.utkast') };
  }
};

const buttonStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
  background: 'var(--accent)', border: 'none', borderRadius: '9px', fontSize: '13px',
  fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
};

const outlineBtnStyle = {
  ...buttonStyle, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)'
};

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box'
};

const toolbarBtnStyle = (active) => ({
  display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 16px',
  background: active ? 'var(--status-blue-bg)' : 'var(--bg-card)', border: `1px solid ${active ? 'var(--status-blue-bg)' : 'var(--border)'}`,
  borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, color: active ? 'var(--status-blue-text)' : 'var(--text-main)',
  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
});

/**
 * Offertens redigerare — EGEN SIDA (ersätter hela listvyn, precis som
 * InvoiceForm i Invoices.jsx), inte en modal längre. Den gamla modalen hade
 * en liten sidopanel-förhandsvisning (360px, `transform: scale(0.88)`) som
 * i praktiken tvingade .a4-paper — normalt ~794px bred med 18mm padding —
 * ner till en absurt smal yta. Resultatet var en hopklämd tumnagel där text
 * radbröts konstigt, exakt samma symptom Invoices.jsx redan dokumenterat
 * löste för fakturor (se `.a4-document-preview`-kommentaren där): byt en
 * evigt-för-liten inline-tumnagel mot en riktig, full A4-bred, zoombar
 * förhandsgranskning som öppnas på begäran. Samma lösning återanvänds här
 * rakt av — samma CSS-klass, samma mönster, samma mobilanpassning.
 */
function QuoteEditor({ quote, quotes, contacts, projects = [], company, user, articles = [], onSave, onClose, onConvert, onSyncBeforeServerCall }) {
  useMobileForm();
  const [customerId, setCustomerId] = useState(quote?.customerId || '');
  const [customerName, setCustomerName] = useState(quote?.customerName || '');
  const [date, setDate] = useState(quote?.date || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    if (quote?.dueDate) return quote.dueDate;
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  // Inte momsregistrerat: offerten har ingen moms (se utils/vatRegistration.js).
  const vatExempt = isVatExempt(company);
  const [rows, setRows] = useState(() => (quote?.rows && quote.rows.length > 0)
    ? quote.rows.map(r => ({
        description: r.description || '', price: r.unitPrice ?? '', qty: r.qty ?? 1, unit: r.unit || 'st',
        vat: r.vatRate ?? 25, discount: r.discount ?? 0, deduction: r.deduction || 'none',
      }))
    : [emptyRow(vatExempt ? 0 : 25)]);
  const [status, setStatus] = useState(quote?.status || 'draft');
  const [currency, setCurrency] = useState(quote?.currency || 'SEK');
  // Engångskund — en offert till någon som inte (ännu) är en sparad kund,
  // utan att tvinga fram ett kundkort först. Startläget speglar vad offerten
  // redan har: en sparad offert med kundId var uppenbarligen kopplad till en
  // riktig kund, en ny offert utan kontakter alls kan bara vara engångskund.
  const [isOneTimeCustomer, setIsOneTimeCustomer] = useState(!quote?.customerId);
  // Kundens uppgifter som EGNA fält på offerten (inte bara en referens till
  // kundkortet) — dels för engångskunder som saknar kort, dels för att en
  // enskild offert ska kunna avvika från kundkortet (t.ex. en tillfällig
  // leveransadress) utan att det ändrar kundens sparade uppgifter. Fylls i
  // automatiskt från kundkortet när en sparad kund väljs (se useEffect
  // nedan), men rörs inte igen efter det — samma "fyll i en gång, sluta
  // sedan lägga sig i" som emailToInput redan gör.
  const [customerEmail, setCustomerEmail] = useState(quote?.customerEmail || '');
  const [customerAddress, setCustomerAddress] = useState(quote?.customerAddress || '');
  const [customerOrgNr, setCustomerOrgNr] = useState(quote?.customerOrgNr || '');
  const [customerContactPerson, setCustomerContactPerson] = useState(quote?.customerContactPerson || '');
  // Rent intern metadata — visas aldrig på själva dokumentet, bara i
  // formuläret. Samma princip som Vår referens/Er referens i Invoices.jsx
  // (InvoiceForm), som inte heller trycks på fakturan.
  // Referens/Projekt (Sida 40) är nu en KOPPLING mot det riktiga
  // projektregistret (Sida 16, Projects.jsx) istället för fri text.
  // `projectRef` (gammal fritext) läses ändå kvar en sista gång som
  // fallback-visning för offerter sparade innan kopplingen fanns.
  const [projectId, setProjectId] = useState(quote?.projectId || '');
  const legacyProjectRef = !quote?.projectId ? (quote?.projectRef || '') : '';
  const [ourRef, setOurRef] = useState(quote?.ourRef || '');
  // Meddelande i mejlet (Sida 40) — eget fält, medvetet skilt från PDF:en.
  const [emailMessage, setEmailMessage] = useState(quote?.emailMessage || '');
  // Bilagor i mejlet (Sida 40) — se konstanterna ovan för varför de laddas
  // upp till lagring och skickas som länkar istället för riktiga
  // MIME-bilagor. Varje post: { id, name, size, type, url, uploading, error }.
  const [attachments, setAttachments] = useState(() => (quote?.emailAttachments || []).map(a => ({ ...a, uploading: false, error: '' })));
  const [attachmentsError, setAttachmentsError] = useState('');
  const attachmentsFileInputRef = useRef(null);
  // Konsumentverkets/juridiskt förväntade offertinnehåll (leveranstid,
  // leverans- och betalningsvillkor) — skilt från Bankgiro/IBAN, som
  // medvetet UTELÄMNAS från offerten (se InvoiceDocument.jsx: en offert är
  // inget betalningskrav). Det här är bara VILLKOREN som skulle gälla om
  // kunden accepterar, inte en uppmaning att betala nu.
  // Leveransvillkor/Utförande (Sida 40) — fyra strukturerade fält istället
  // för ett enda fritextfält, så en offert faktiskt anger VAR och NÄR
  // arbetet utförs, inte bara en lös mening om leveranstid.
  const [workStartDate, setWorkStartDate] = useState(quote?.workStartDate || '');
  const [workEndDate, setWorkEndDate] = useState(quote?.workEndDate || '');
  const [workLocation, setWorkLocation] = useState(quote?.workLocation || '');
  const [deliveryDescription, setDeliveryDescription] = useState(quote?.deliveryDescription ?? quote?.deliveryTerms ?? '');
  // Betalningsvillkor (Sida 40) — betalningstid som ett RIKTIGT antal dagar
  // (förval 30, samma standard som Sida 5) istället för en fri textsträng,
  // och dröjsmålsränta som ett rent procenttal. Formaterade till läsbara
  // strängar för InvoiceDocument (`terms`/`lateInterest`) vid spara/förhandsgranska.
  const [paymentTermsDays, setPaymentTermsDays] = useState(quote?.paymentTermsDays ?? company?.paymentTermsDays ?? 30);
  const [lateInterestPercent, setLateInterestPercent] = useState(quote?.lateInterestPercent ?? 10);
  // Vad som inte ingår (Sida 40) — valfritt, skilt från "Övriga villkor"
  // (som är generella juridiska standardpunkter, inte projektspecifika
  // avgränsningar).
  const [notIncluded, setNotIncluded] = useState(quote?.notIncluded || '');
  // Fri text, en rad per punkt — renderas som punktlista på dokumentet
  // (InvoiceDocument.jsx: otherTerms.split('\n')). `??` (inte `||`) så att
  // ett medvetet tomt fält (användaren har raderat all text) inte tyst
  // återställs till standardtexten igen.
  const [otherTerms, setOtherTerms] = useState(quote?.otherTerms ?? DEFAULT_OTHER_TERMS);

  // Kundfeedback: "så mycket grejer, gör det enklare" — de sex sektionerna
  // nedan (mejlmeddelande, bilagor, ej ingår, betalningsvillkor,
  // leveransvillkor, övriga villkor) är alla VALFRIA och gjorde en NY offert
  // till en skrämmande lång sida direkt. Fällda som förval för en ny offert;
  // öppnas automatiskt om en sparad offert redan har något ifyllt i dem, så
  // att redigering aldrig gömmer data som faktiskt finns.
  const [detailsOpen, setDetailsOpen] = useState(() => !!(
    quote?.emailMessage || (quote?.emailAttachments || []).length > 0 || quote?.notIncluded ||
    quote?.workStartDate || quote?.workEndDate || quote?.workLocation || quote?.deliveryDescription ||
    quote?.paymentTermsDays != null || quote?.lateInterestPercent != null ||
    (quote?.otherTerms != null && quote.otherTerms !== DEFAULT_OTHER_TERMS)
  ));

  // Mallval/accentfärg fryses vid FÖRSTA sparningen (samma regel som
  // fakturor) — men går nu, till skillnad från tidigare, att faktiskt ändra
  // innan dess via förhandsgranskningens mallväljare istället för att bara
  // tyst ärva vad som råkar stå under Inställningar just nu.
  const [templateSnapshot, setTemplateSnapshot] = useState(() => quote?.invoiceTemplateSnapshot || {
    templateId: company?.invoiceTemplateId || DEFAULT_INVOICE_TEMPLATE,
    accentColor: company?.invoiceAccentColor || '',
    logoUrl: company?.logoUrl || '',
    logoSize: company?.invoiceLogoSize || 'medium',
    showCompanyName: company?.invoiceShowCompanyName ?? false,
    footerText: company?.invoiceFooterText || '',
  });

  const [showPreview, setShowPreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  useEffect(() => { if (showPreview) setPreviewZoom(1); }, [showPreview]);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailToInput, setEmailToInput] = useState('');

  const previewRef = useRef(null);
  // Osynlig, alltid monterad kopia med fast 794px-bredd — PDF/mejl fångar
  // ALLTID denna, aldrig den synliga (ev. zoomade) förhandsgranskningen. Se
  // samma resonemang i Invoices.jsx (InvoiceForm) för varför.
  const captureRef = useRef(null);

  // Den valda kontaktens namn (om någon), annars engångskundens fritextnamn
  // — men allt annat (e-post/adress/org.nr/kontaktperson) kommer alltid från
  // fälten ovan, inte direkt från kontaktposten, så en override på DEN HÄR
  // offerten aldrig råkar skriva över kundkortet eller tvärtom.
  const selectedContact = contacts.find(c => c.id === customerId);
  const customer = {
    name: selectedContact?.name || customerName,
    email: customerEmail,
    address: customerAddress,
    orgNr: customerOrgNr,
    contactPerson: customerContactPerson,
  };
  // Fyller i alla fyra fälten (+ mejlmottagaren) från kundkortet varje gång
  // en annan sparad kund väljs — men rör dem inte igen efter det, så en
  // manuell ändring för just den här offerten inte tyst skrivs över.
  useEffect(() => {
    if (!selectedContact) return;
    setEmailToInput(selectedContact.email || '');
    setCustomerEmail(selectedContact.email || '');
    setCustomerAddress(selectedContact.address || '');
    setCustomerOrgNr(selectedContact.orgNr || '');
    setCustomerContactPerson(selectedContact.contactPerson || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const previewNumber = quote?.invoiceNumber || getNextQuoteNumber(quotes);
  const previewRows = rows.map(r => ({
    description: r.description, qty: Number(r.qty) || 1, unit: r.unit || 'st', unitPrice: Number(r.price) || 0,
    vatRate: vatExempt ? 0 : rowVatRate(r.vat), discount: Number(r.discount) || 0, deduction: r.deduction && r.deduction !== 'none' ? r.deduction : undefined,
  }));
  const totals = previewRows.reduce((acc, r) => {
    const net = r.qty * r.unitPrice * (1 - (r.discount || 0) / 100);
    return { net: acc.net + net, vat: acc.vat + net * (r.vatRate / 100), total: acc.total + net * (1 + r.vatRate / 100) };
  }, { net: 0, vat: 0, total: 0 });
  // Momsen bryts ner per momssats (rader kan blanda 25/12/6/0%) istället för
  // att alltid rubriceras "Moms 25%" — annars blir sammanställningen
  // missvisande så fort en enda rad använder en annan sats.
  const vatBreakdown = Object.entries(previewRows.reduce((acc, r) => {
    const net = r.qty * r.unitPrice * (1 - (r.discount || 0) / 100);
    if (!net) return acc;
    acc[r.vatRate] = (acc[r.vatRate] || 0) + net * (r.vatRate / 100);
    return acc;
  }, {})).sort((a, b) => Number(b[0]) - Number(a[0]));

  const addRow = () => setRows(r => [...r, emptyRow(vatExempt ? 0 : 25)]);
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  // Produktregistret (Articles.jsx, samma `articles` som Invoices.jsx redan
  // använder) — offertraderna har inget eget articleNumber-fält (annan
  // radform än fakturans, se emptyRow() ovan), så matchningen sker på
  // BESKRIVNING istället för artikelnr. Väljs en exakt träff (blur = klart
  // att skriva, samma "aldrig mitt i inmatningen"-princip som InvoiceForm)
  // fylls pris/moms i automatiskt.
  const findArticleByDescription = (text) => {
    const key = (text || '').trim().toLowerCase();
    if (!key) return null;
    return articles.find(a => (a.description || '').trim().toLowerCase() === key) || null;
  };
  const applyArticleToRow = (i, article) => {
    setRows(r => r.map((row, idx) => idx === i ? {
      ...row,
      description: article.description || row.description,
      price: article.unitPrice ?? row.price,
      vat: vatExempt ? 0 : (article.vatRate ?? row.vat),
    } : row));
  };

  // Formaterade strängar för InvoiceDocument — samma generiska `terms`/
  // `lateInterest`-fält som fakturans mall redan läser, byggda av de
  // strukturerade formulärfälten istället för att formuläret matar in
  // färdig text direkt.
  const formattedTerms = t('ui.dagar_netto', { v0: paymentTermsDays || 0 });
  const formattedLateInterest = t('ui.enligt_rantelagen', { v0: lateInterestPercent || 0 });

  // Delas av "Spara offert"-knappen och auto-spara-vid-utskick nedan
  // (handleSendEmail) — samma fält, bara olika `status`-override.
  const buildSaveData = (overrides = {}) => ({
    customerId: isOneTimeCustomer ? '' : customerId,
    customerName: customer?.name || customerName, date, dueDate: dueDate || '',
    customerEmail, customerAddress, customerOrgNr, customerContactPerson,
    projectId, ourRef, emailMessage,
    emailAttachments: attachments.filter(a => a.url && !a.error).map(({ id, name, size, type, url }) => ({ id, name, size, type, url })),
    rows: previewRows, status, invoiceTemplateSnapshot: templateSnapshot,
    workStartDate, workEndDate, workLocation, deliveryDescription,
    paymentTermsDays: Number(paymentTermsDays) || 0, lateInterestPercent: Number(lateInterestPercent) || 0,
    terms: formattedTerms, lateInterest: formattedLateInterest,
    notIncluded, otherTerms, currency,
    ...overrides,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(buildSaveData());
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true); setPdfError('');
    try {
      await exportInvoicePdf(captureRef.current, `offert-${previewNumber}.pdf`);
    } catch (err) {
      console.error(err);
      setPdfError(t('ui.kunde_inte_skapa_pdf_forsok_igen'));
    } finally {
      setPdfBusy(false);
    }
  };

  // Samma delade backend-rutt som fakturor (se Quotes.jsx-historiken) — den
  // bryr sig aldrig om vilket dokument som skickas.
  const handleSendEmail = async () => {
    const to = emailToInput.trim();
    if (!to) { setEmailError(t('ui.ange_en_mottagaradress')); return; }
    if (!/^\S+@\S+\.\S+$/.test(to)) { setEmailError(t('ui.det_dar_ser_inte_ut_som_en_giltig_e_postadress')); return; }
    setEmailBusy(true); setEmailError(''); setEmailSent(false);
    try {
      const attachmentBase64 = await getInvoicePdfBase64(captureRef.current);
      // Meddelande i mejlet (Sida 40) ersätter standardstycket när
      // användaren skrivit något eget — annars samma standardtext som
      // tidigare, så ett tomt fält inte gör mejlet konstigt kort.
      const messageHtml = emailMessage.trim()
        ? `<p>${escapeHtml(emailMessage).replace(/\n/g, '<br/>')}</p>`
        : `<p>Bifogat finner du offert <strong>${previewNumber}</strong> på <strong>${fmtSEK(totals.total)} ${currency}</strong>, giltig till ${fmtDateSv(dueDate)}.</p>`;
      // Bilagor i mejlet (Sida 40) — riktiga MIME-bilagor bär bara PDF:en
      // (se konstanten ATTACHMENT_ACCEPTED_TYPES ovan för varför); egna
      // uppladdade filer skickas som länkar till Supabase Storage istället.
      const readyAttachments = attachments.filter(a => a.url && !a.error && !a.uploading);
      const attachmentsHtml = readyAttachments.length > 0
        ? `<p>Bilagor:</p><ul>${readyAttachments.map(a => `<li><a href="${a.url}">${escapeHtml(a.name)}</a></li>`).join('')}</ul>`
        : '';
      const html = `
        <p>Hej${customer?.contactPerson ? ' ' + customer.contactPerson : ''},</p>
        ${messageHtml}
        ${attachmentsHtml}
        <p>Hör av dig om du har några frågor.</p>
        <p>Med vänlig hälsning<br/>${(company?.invoiceDisplayName || company?.name) || ''}</p>
      `;
      // Bugkritiskt: servern verifierar ägarskap mot Supabase, men App.jsx:s
      // debouncade sparning (2 s, startas om vid varje ändring) kan ligga
      // efter — ett nytt eller nyss ändrat företag kan då saknas där ännu,
      // vilket gav ett falskt "Du har inte längre åtkomst till det här
      // företaget." Tvingar fram en omedelbar synk (best effort) innan
      // utskicket, så servern ser samma data som skärmen visar.
      await onSyncBeforeServerCall?.();
      await sendInvoiceEmail({
        to,
        subject: `Offert ${previewNumber} från ${(company?.invoiceDisplayName || company?.name) || 'oss'}`,
        html,
        replyTo: company?.email || undefined,
        attachmentBase64,
        attachmentFilename: `offert-${previewNumber}.pdf`,
        // Avsändaradressen avgörs server-side (Sida 33) utifrån den
        // inloggade användarens EGEN sparade företagsdata (säkerhetsfix —
        // se send-invoice.js), inte längre ett client-supplied
        // företagsobjekt. Skickar bara med ID:t.
        company_id: company?.id,
      });
      setEmailSent(true);
      // Ett utkast som faktiskt skickas till kunden är per definition inte
      // längre ett utkast.
      setStatus('sent');
      // Kundfeedback: "skicka via post ska funka" — en helt ny, ännu
      // osparad offert krävde tidigare ett separat "Spara offert"-klick
      // FÖRST (knappen var disabled med bara en tooltip som förklaring),
      // annars hände synligt ingenting alls när man klickade Skicka.
      // Ett lyckat utskick sparar nu offerten automatiskt åt användaren —
      // men bara om den aldrig sparats än (`!quote`); en redan sparad
      // offert stannar kvar öppen som förut istället för att stängas.
      if (!quote) onSave(buildSaveData({ status: 'sent' }));
    } catch (err) {
      console.error(err);
      setEmailError(err.message || t('ui.kunde_inte_skicka_e_post'));
    } finally {
      setEmailBusy(false);
    }
  };

  // Bilagor i mejlet — samma "typ + total storleksgräns kontrollerad innan
  // uppladdning godkänns"-princip som redan etablerat i Expenses.jsx, men
  // mot en TOTAL gräns (15 MB) istället för per fil, eftersom det är hela
  // utskickets storlek som spelar roll (se konstanten ovan).
  const attachmentsTotalBytes = attachments.filter(a => !a.error).reduce((sum, a) => sum + (a.size || 0), 0);
  const handleAddFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const errors = [];
    let runningTotal = attachmentsTotalBytes;
    const toUpload = [];
    files.forEach(f => {
      if (!ATTACHMENT_ACCEPTED_TYPES.includes(f.type)) {
        errors.push(t('ui.filformatet_stods_inte_endast_jpg_png_webp_heic', { name: f.name }));
        return;
      }
      if (runningTotal + f.size > MAX_ATTACHMENTS_TOTAL_MB * 1024 * 1024) {
        errors.push(t('ui.skulle_gora_bilagorna_storre_an_totalt_mb', { name: f.name, MAX_ATTACHMENTS_TOTAL_MB }));
        return;
      }
      runningTotal += f.size;
      toUpload.push(f);
    });
    setAttachmentsError(errors.join(' '));
    if (toUpload.length === 0) return;
    if (!user?.id) { setAttachmentsError(t('ui.du_maste_vara_inloggad_for_att_lagga_till_bilago')); return; }
    toUpload.forEach(file => {
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setAttachments(prev => [...prev, { id, name: file.name, size: file.size, type: file.type, url: '', uploading: true, error: '' }]);
      uploadFileToStorage(user.id, file, 'quote-attachments')
        .then(url => setAttachments(prev => prev.map(a => a.id === id ? { ...a, url, uploading: false } : a)))
        .catch(err => {
          const msg = /bucket not found/i.test(err.message || '')
            ? t('ui.bildlagring_ar_inte_konfigurerad_i_supabase_proj_2')
            : t('ui.kunde_inte_laddas_upp_2', { message: err.message });
          setAttachments(prev => prev.map(a => a.id === id ? { ...a, uploading: false, error: msg } : a));
        });
    });
  };
  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));

  const displayStatus = quote ? getDisplayStatus({ ...quote, status }) : 'draft';
  const statusStyle = getStatusStyle(displayStatus);

  return (
    <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-muted)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
      {/* Mobil: verktygsraden skrollar horisontellt istället för att
          radbryta till en hög, trång stapel. */}
      <style>{`
        .quote-toolbar { flex-wrap: wrap; }
        @media (max-width: 720px) {
          .quote-toolbar { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .quote-toolbar > * { flex-shrink: 0; }
        }
        .quote-preview-controls { flex-wrap: wrap; }
        @media (max-width: 640px) {
          .quote-preview-controls { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px; }
          .quote-preview-controls > * { flex-shrink: 0; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="mform-head" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" className="mform-back" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="mform-back-desk">{t('ui.tillbaka')}</span><span className="mform-back-phone">{t('ui.avbryt')}</span>
        </button>
        <div className="mform-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{quote ? t('ui.offert', { previewNumber }) : t('ui.ny_offert')}</h1>
          <span style={{ padding: '4px 10px', background: statusStyle.bg, color: statusStyle.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{statusStyle.label}</span>
        </div>
        <div style={{ flex: 1, minWidth: '8px' }} />
        <div className="mform-head-actions" style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onClose} style={outlineBtnStyle}>{t('ui.avbryt')}</button>
          <button type="button" onClick={handleSubmit} style={buttonStyle}><Check size={14} /> {quote ? t('ui.spara_andringar') : t('ui.spara_offert')}</button>
        </div>
      </div>
      <MobileFormBar>
        <button type="button" className="mform-bar-primary" onClick={handleSubmit}>{quote ? t('ui.spara_andringar') : t('ui.spara_offert')}</button>
      </MobileFormBar>

      {/* ── Åtgärdsrad: statusflöde, konvertering, e-post, PDF, förhandsgranska ── */}
      <div className={`quote-toolbar doc-toolbar${quote ? '' : ' is-new'}`} style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {quote && (!quote.status || quote.status === 'draft') && (
          <button type="button" className="tb-status" onClick={() => setStatus('sent')} style={toolbarBtnStyle(status === 'sent')}>{t('ui.markera_som_skickad')}</button>
        )}
        {quote && status === 'sent' && (
          <>
            <button type="button" className="tb-status" onClick={() => setStatus('accepted')} style={{ ...toolbarBtnStyle(false), color: 'var(--status-green-text)', borderColor: 'var(--status-green-bg)' }}>{t('ui.markera_som_accepterad')}</button>
            <button type="button" className="tb-status" onClick={() => setStatus('rejected')} style={{ ...toolbarBtnStyle(false), color: 'var(--status-red-text)', borderColor: 'var(--status-red-bg)' }}>{t('ui.markera_som_avvisad')}</button>
          </>
        )}
        {quote && (status === 'accepted' || status === 'rejected') && (
          <button type="button" className="tb-status" onClick={() => setStatus('draft')} style={toolbarBtnStyle(false)}>{t('ui.aterstall_till_utkast')}</button>
        )}
        {/* Konvertering är alltid tillgänglig oavsett status — se motiveringen
            i Quotes-listan: det är ägarens eget omdöme, inte något appen ska
            gate:a bakom ett visst statusläge. */}
        {quote && onConvert && (
          <button type="button" className="tb-status" onClick={onConvert} style={{ ...toolbarBtnStyle(false), color: 'var(--accent-text)', borderColor: 'var(--status-green-bg)' }}><FileText size={13} /> {t('ui.konvertera_till_faktura')}</button>
        )}
        <div style={{ flex: 1, minWidth: '8px' }} />
        {emailError && <span style={{ fontSize: '11px', color: 'var(--status-red-text)', flexShrink: 0 }}>{emailError}</span>}
        {emailSent && !emailError && <span style={{ fontSize: '11px', color: 'var(--status-green-text)', fontWeight: 600, flexShrink: 0 }}>{t('ui.skickad')}</span>}
        <input
          type="email" className="toolbar-email-input" value={emailToInput} onChange={e => { setEmailToInput(e.target.value); setEmailError(''); }}
          placeholder={t('ui.mottagarens_epost_se')} title={t('ui.mottagarens_e_postadress')}
          // Bugkritiskt: `background: 'white'` var hårdkodat här och
          // krockade med `color: 'var(--text-main)'` — i mörkt läge är
          // --text-main nästan vit (#eef3ea, till för mörka bakgrunder),
          // så texten blev vit på vitt och osynlig. inputStyle sätter redan
          // rätt temamedvetna bakgrund (var(--bg-card)); den ska inte
          // skrivas över här.
          style={{ ...inputStyle, width: '210px', padding: '9px 12px', fontSize: '13.5px', flexShrink: 0 }}
        />
        {/* Bugkritiskt, samma fel som fakturans motsvarande knapp
            (Invoices.jsx, tb-send): disabled på !emailToInput.trim() gjorde
            knappen ett HELT tyst dött klick på en tom adress — inget
            felmeddelande, inget nätverksanrop alls (bekräftat i Vercels
            runtime-loggar: noll träffar mot /api/email/send-invoice trots
            att kunden testat). handleSendEmail har redan sin egen tydliga
            felruta (emailError, raden ovanför) för en tom adress — bara
            emailBusy ska spärra klicket, resten sköts av den. */}
        <button
          type="button" className="tb-send" onClick={handleSendEmail}
          disabled={emailBusy}
          title={!emailToInput.trim() ? t('ui.ange_en_mottagaradress_2') : t('ui.skicka_offert_till', { previewNumber, v1: emailToInput.trim() })}
          style={{ ...toolbarBtnStyle(false), opacity: emailBusy ? 0.5 : 1, cursor: emailBusy ? 'not-allowed' : 'pointer' }}
        >
          <Send size={15} /> {emailBusy ? t('ui.skickar_2') : t('ui.skicka_via_e_post')}
        </button>
        {pdfError && <span style={{ fontSize: '11px', color: 'var(--status-red-text)', flexShrink: 0 }}>{pdfError}</span>}
        <button type="button" className="tb-pdf" onClick={handleDownloadPdf} disabled={pdfBusy} style={{ ...toolbarBtnStyle(false), opacity: pdfBusy ? 0.6 : 1 }}>
          <Download size={15} /> {pdfBusy ? t('ui.skapar_pdf') : t('ui.ladda_ner_pdf')}
        </button>
        <button type="button" className="tb-preview" onClick={() => setShowPreview(true)} style={toolbarBtnStyle(showPreview)}>
          <Eye size={15} /> {t('ui.forhandsgranska')}
        </button>
      </div>

      {/* ── Formulär — täcker HELA sidan (bredd och höjd), inte ett smalt
             centrerat kort med tom grå/kräm bakgrund runt om. Exakt samma
             princip som Invoices.jsx (InvoiceForm) redan använder och
             dokumenterar uttryckligen — se kommentaren där: en centrerad
             maxWidth-låda mitt i en full-bredd sida lämnar enorma tomma fält
             på båda sidor, särskilt på breda skärmar. Sektioner separeras nu
             med en tunn linje istället för att vara ihopklämda i ett kort. ── */}
      <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', background: 'var(--bg-card)' }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* .form-row-stack (inte .form-row-2): dess mobilregel har
              !important och vinner faktiskt över den inline satta
              gridTemplateColumns — .form-row-2 saknar det och skulle klämma
              in alla fyra fälten på en rad även på en telefonskärm. */}
          {/* ── Kundinformation ── */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{t('ui.kundinformation')}</h3>

            {contacts.length > 0 && (
              <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                {[{ id: false, label: t('ui.valj_kund_2') }, { id: true, label: t('ui.engangskund') }].map(opt => (
                  <button
                    key={String(opt.id)} type="button"
                    onClick={() => setIsOneTimeCustomer(opt.id)}
                    style={{
                      padding: '7px 14px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                      background: isOneTimeCustomer === opt.id ? 'var(--accent)' : 'var(--bg-card)',
                      color: isOneTimeCustomer === opt.id ? 'white' : 'var(--text-main)',
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            )}

            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                {(!isOneTimeCustomer && contacts.length > 0) ? (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.valj_kund_2')}</label>
                    <select
                      style={inputStyle}
                      value={customerId}
                      onChange={e => setCustomerId(e.target.value)}
                    >
                      <option value="">{t('ui.valj_kund')}</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.kundnamn')}</label>
                    <input type="text" style={inputStyle} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t('ui.foretagsnamn_ab')} required />
                  </>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.e_postadress')}</label>
                <input type="email" style={inputStyle} value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder={t('ui.kund_foretag_se')} />
              </div>
            </div>

            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.adress_2')}</label>
                <input type="text" style={inputStyle} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder={t('ui.gatuadress_postnummer_ort')} />
              </div>
              <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.organisationsnummer')}</label>
                  <input type="text" style={inputStyle} value={customerOrgNr} onChange={e => setCustomerOrgNr(e.target.value)} placeholder="556123-4567" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.kundens_kontaktperson')}</label>
                  <input type="text" style={inputStyle} value={customerContactPerson} onChange={e => setCustomerContactPerson(e.target.value)} placeholder={t('ui.anna_andersson')} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Offertinformation ── */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{t('ui.offertinformation')}</h3>
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.offertnummer')}</label>
                <div style={{ ...inputStyle, background: 'var(--bg-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{previewNumber}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.referens_projekt')}</label>
                <select style={inputStyle} value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">{t('ui.inget_projekt')}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {legacyProjectRef && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('ui.tidigare_varde_fritext')} {legacyProjectRef}</div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.var_kontaktperson_referens')}</label>
                <input type="text" style={inputStyle} value={ourRef} onChange={e => setOurRef(e.target.value)} placeholder={t('ui.erik_eriksson')} />
              </div>
            </div>
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.offertdatum')}</label>
                <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.giltig_till')}</label>
                <input type="date" style={inputStyle} value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.valuta')}</label>
                <select style={inputStyle} value={currency} onChange={e => setCurrency(e.target.value)}>
                  {['SEK', 'NOK', 'EUR', 'USD', 'GBP'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{t('ui.offertrader')}</h3>
              {/* Radräknare — uppdateras dynamiskt i takt med Lägg till/Ta bort rad. */}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{rows.length} {rows.length === 1 ? t('ui.rad_2') : t('ui.rader')}</span>
            </div>
            {/* Tabellen har fått fler kolumner (enhet, avdrag, beräknad summa)
                — en egen horisontellt skrollbar yta istället för att klämma
                ihop kolumnerna eller staplas till en orimligt hög lista på
                smala skärmar, samma princip som listvyns tabell använder. */}
            <div className="quote-rows-scroll" style={{ overflowX: 'auto' }}>
              <div className="quote-rows-min" style={{ minWidth: '980px' }}>
                <div className="quote-rows-header" style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.8fr 0.8fr 1fr 0.8fr 0.9fr 1.1fr 1fr auto', gap: '10px', marginBottom: '6px', padding: '0 2px' }}>
                  {[t('ui.beskrivning'), t('ui.antal'), t('ui.enhet'), t('ui.pris_5'), t('ui.rabatt'), t('ui.moms_procent'), t('ui.avdrag_2'), t('ui.summa'), ''].map(h => (
                    <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</span>
                  ))}
                </div>
                {rows.map((row, i) => {
                  const rowSum = (Number(row.qty) || 0) * (Number(row.price) || 0) * (1 - (Number(row.discount) || 0) / 100);
                  return (
                    <div key={i} className="quote-row" style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.8fr 0.8fr 1fr 0.8fr 0.9fr 1.1fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                      <label className="qr-cell qr-desc"><span className="qr-lbl">{t('ui.beskrivning')}</span>
                      <input type="text" placeholder={t('ui.beskrivning')} style={inputStyle} value={row.description}
                        list="quote-article-register-list"
                        onChange={e => updateRow(i, 'description', e.target.value)}
                        // Väljs en BEFINTLIG artikel ur <datalist>-listan (blur = klart
                        // att skriva) fylls pris/moms i automatiskt — samma mönster som
                        // fakturaradens Artikelnr-fält (Invoices.jsx).
                        onBlur={e => {
                          const hit = findArticleByDescription(e.target.value);
                          if (hit) applyArticleToRow(i, hit);
                        }}
                        required />
                      </label>
                      <label className="qr-cell"><span className="qr-lbl">{t('ui.antal')}</span>
                      <input type="number" inputMode="decimal" placeholder={t('ui.antal')} style={inputStyle} value={row.qty}
                        onChange={e => updateRow(i, 'qty', e.target.value)} />
                      </label>
                      <label className="qr-cell"><span className="qr-lbl">{t('ui.enhet')}</span>
                      <select style={inputStyle} value={row.unit} onChange={e => updateRow(i, 'unit', e.target.value)}>
                        {ROW_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      </label>
                      <label className="qr-cell"><span className="qr-lbl">{t('ui.pris_2')}</span>
                      <input type="number" inputMode="decimal" placeholder={t('ui.pris_5')} style={inputStyle} value={row.price}
                        onChange={e => updateRow(i, 'price', e.target.value)} required />
                      </label>
                      <label className="qr-cell"><span className="qr-lbl">{t('ui.rabatt')}</span>
                      <input type="number" inputMode="decimal" placeholder={t('ui.rabatt')} style={inputStyle} value={row.discount}
                        onChange={e => updateRow(i, 'discount', e.target.value)} />
                      </label>
                      <label className="qr-cell"><span className="qr-lbl">{t('ui.moms')}</span>
                      {vatExempt ? (
                        <div style={{ ...inputStyle, background: 'var(--bg-muted)', color: 'var(--text-muted)' }} title={t('ui.foretaget_ar_inte_momsregistrerat')}>{t('ui.ingen_moms')}</div>
                      ) : (
                      <select style={inputStyle} value={row.vat} onChange={e => updateRow(i, 'vat', e.target.value)}>
                        {VAT_RATES.map(v => <option key={v} value={v}>{v}%</option>)}
                      </select>
                      )}
                      </label>
                      <label className="qr-cell"><span className="qr-lbl">{t('ui.avdrag_2')}</span>
                      <select style={inputStyle} value={row.deduction} onChange={e => updateRow(i, 'deduction', e.target.value)}>
                        {DEDUCTION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      </label>
                      <div className="qr-cell qr-sum"><span className="qr-lbl">{t('ui.summa')}</span>
                      <div style={{ ...inputStyle, background: 'var(--bg-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{fmtSEK(rowSum)}</div>
                      </div>
                      <button className="qr-remove" type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} title={t('ui.ta_bort_rad')} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: rows.length === 1 ? 'not-allowed' : 'pointer', color: rows.length === 1 ? 'var(--border)' : '#ef4444' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={addRow} style={{ ...outlineBtnStyle, padding: '6px 12px', fontSize: '12px', marginTop: '4px', marginBottom: '16px' }}>{t('ui.lagg_till_rad_2')}</button>

            {/* Delas av alla radernas Beskrivning-fält ovan (HTML5 <datalist>
                kräver ett enda, delat id) — samma produktregister som
                Invoices.jsx, native webbläsarautocomplete. */}
            <datalist id="quote-article-register-list">
              {articles.map((a, i) => (
                <option key={a.id || `${a.description}-${i}`} value={a.description}>{a.description}</option>
              ))}
            </datalist>

            {/* Summeringsblock — samma "egen lätt bakgrund"-mönster som redan
                etablerat för fakturans sammanställningsbox (Invoices.jsx). */}
            <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '360px', marginLeft: 'auto', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{t('ui.netto_exkl_moms')}</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmtSEK(totals.net)} {currency}</span>
              </div>
              {vatBreakdown.map(([rate, amount]) => (
                <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{t('ui.moms')} {rate}%</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmtSEK(amount)} {currency}</span>
                </div>
              ))}
              {!vatExempt && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{t('ui.total_moms')}</span><span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{fmtSEK(totals.vat)} {currency}</span>
              </div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '4px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t('ui.offertsumma')}</span>
                <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>{fmtSEK(totals.total)} {currency}</span>
              </div>
            </div>
          </div>

          {/* ── Fler detaljer — samlar de sex VALFRIA sektionerna (mejl,
                 bilagor, ej ingår, betalning, leverans, övriga villkor)
                 bakom en hopfällbar toggle istället för att alltid visa dem,
                 se detailsOpen ovan. ── */}
          <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <button
              type="button" onClick={() => setDetailsOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px', fontWeight: 600, color: 'var(--accent-text)' }}
            >
              {detailsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              {detailsOpen ? t('ui.dolj_fler_detaljer') : t('ui.fler_detaljer_meddelande_bilagor_villkor')}
            </button>
          </div>

          {detailsOpen && (
          <>
          {/* ── Meddelande i mejlet — eget fält, INTE en del av PDF:en. Den
                 distinktionen måste synas i hjälptexten, annars är det
                 otydligt för användaren var texten faktiskt hamnar. ── */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{t('ui.meddelande_i_mejlet')}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>{t('ui.visas_i_foljemejlet_inte_i_pdf_en')}</p>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: '86px', lineHeight: 1.6, fontFamily: 'inherit', maxWidth: '640px' }}
              value={emailMessage} onChange={e => setEmailMessage(e.target.value)}
              placeholder={t('ui.hej_bifogat_finner_du_var_offert')}
            />
          </div>

          {/* ── Bilagor i mejlet — laddas upp direkt till lagring och skickas
                 som länkar (se konstanten ATTACHMENT_ACCEPTED_TYPES/kommentaren
                 vid handleAddFiles för varför). ── */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{t('ui.bilagor_i_mejlet')}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>{t('ui.filerna_foljer_med_som_bilagor_i_mejlet_tillsamm')} {MAX_ATTACHMENTS_TOTAL_MB} {t('ui.mb')}</p>
            <input type="file" ref={attachmentsFileInputRef} style={{ display: 'none' }} multiple accept={ATTACHMENT_ACCEPT_ATTR} onChange={e => { handleAddFiles(e.target.files); e.target.value = ''; }} />
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', maxWidth: '480px' }}>
                {attachments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--bg-muted)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '12.5px' }}>
                    <Paperclip size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: a.error ? 'var(--status-red-text)' : 'var(--text-main)' }}>
                      {a.name} <span style={{ color: 'var(--text-muted)' }}>({((a.size || 0) / (1024 * 1024)).toFixed(1)} {t('ui.mb_2')}</span>
                      {a.error && <> — {a.error}</>}
                    </span>
                    {a.uploading && <Loader2 size={13} className="spin" color="var(--text-muted)" style={{ animation: 'spin 0.8s linear infinite' }} />}
                    <button type="button" onClick={() => removeAttachment(a.id)} title={t('ui.ta_bort')} style={{ padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachmentsError && <div style={{ fontSize: '12px', color: 'var(--status-red-text)', marginBottom: '10px' }}>{attachmentsError}</div>}
            <button type="button" onClick={() => attachmentsFileInputRef.current?.click()} style={{ ...outlineBtnStyle, padding: '6px 12px', fontSize: '12px' }}>
              <Paperclip size={13} /> {t('ui.lagg_till_fil')}
            </button>
          </div>

          {/* ── Vad som inte ingår (valfritt) — skilt från Övriga villkor:
                 det här är projektspecifika avgränsningar, inte generella
                 juridiska standardpunkter. ── */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.vad_som_inte_ingar_valfritt')}</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: '70px', lineHeight: 1.6, fontFamily: 'inherit', maxWidth: '640px' }}
              value={notIncluded} onChange={e => setNotIncluded(e.target.value)}
              placeholder={t('ui.t_ex_haltagning_malning_bortforsling_av_material')}
            />
          </div>

          {/* ── Betalningsvillkor — betalningstid som ett riktigt antal dagar
                 (förval 30, Sida 5) och dröjsmålsränta som rent procenttal,
                 inte längre fri text. ── */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{t('ui.betalningsvillkor')}</h3>
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.betalningstid_dagar')}</label>
                <input type="number" min="0" style={inputStyle} value={paymentTermsDays} onChange={e => setPaymentTermsDays(e.target.value)} placeholder="30" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.drojsmalsranta')}</label>
                <input type="number" min="0" step="0.1" style={inputStyle} value={lateInterestPercent} onChange={e => setLateInterestPercent(e.target.value)} placeholder="10" />
              </div>
            </div>
          </div>

          {/* ── Leveransvillkor / Utförande — VAR och NÄR arbetet utförs,
                 skilt från betalningsvillkoren ovan. ── */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{t('ui.leveransvillkor_utforande')}</h3>
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.startdatum')}</label>
                <input type="date" style={inputStyle} value={workStartDate} onChange={e => setWorkStartDate(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.slutdatum')}</label>
                <input type="date" style={inputStyle} value={workEndDate} onChange={e => setWorkEndDate(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.plats_for_arbete')}</label>
                <input type="text" style={inputStyle} value={workLocation} onChange={e => setWorkLocation(e.target.value)} placeholder={t('ui.gatuadress_ort')} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.leveransbeskrivning')}</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: '70px', lineHeight: 1.6, fontFamily: 'inherit', maxWidth: '640px' }}
                value={deliveryDescription} onChange={e => setDeliveryDescription(e.target.value)}
                placeholder={t('ui.t_ex_leverans_inom_2_3_veckor_fran_accepterad_of')}
              />
            </div>
          </div>

          <div style={{ padding: '24px 32px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>{t('ui.ovriga_villkor')}</label>
            {/* Kundfeedback: "man ser knappt vad som står i Övriga villkor"
                — DEFAULT_OTHER_TERMS fyller fältet med FYRA rader text
                (giltighetstid, ansvarsbegränsning m.m.) redan från start,
                men rutans minHeight (86px) rymde bara ~3 rader — den fjärde
                skars av mitt i texten istället för att synas i sin helhet.
                120px rymmer alla fyra raderna direkt, ingen skrollning
                krävs för att läsa/redigera standardtexten. */}
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: '120px', lineHeight: 1.6, fontFamily: 'inherit', maxWidth: '640px' }}
              value={otherTerms} onChange={e => setOtherTerms(e.target.value)}
              placeholder={t('ui.en_rad_per_punkt_visas_som_punktlista_pa_offerte')}
            />
          </div>
          </>
          )}
        </div>
      </form>

      {/* ── Förhandsgranskning — fullskärmsmodal med riktig A4-bredd (samma
             InvoiceDocument-komponent PDF-exporten fångar) och zoom, istället
             för en evigt hopklämd sidopanel. Samma mönster som Invoices.jsx
             (InvoiceForm), samma CSS-klass (.a4-document-preview i
             index.css) — mobilanpassningen är redan löst där. ── */}
      {showPreview && (
        <div className="modal-overlay a4-preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-content a4-document-preview" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px', position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <h2 className="modal-title" style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('ui.forhandsgranskning_offert')} {previewNumber}</h2>
                <button className="modal-close" onClick={() => setShowPreview(false)} style={{ flexShrink: 0 }}><X size={18} /></button>
              </div>
              <div className="quote-preview-controls" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {/* Kundfeedback (skärmdump, mörkt läge): den inaktiva pillrens
                      bakgrund var hårdkodad 'white' (inte en tema-medveten
                      var(--bg-card)) — en ljus, malplacerad fläck mot den
                      mörka rubrikraden i stället för att smälta in. Samma
                      bugg fanns INTE i Invoices.jsx:s motsvarande väljare
                      (redan var(--bg-card)) — rättat till samma mönster här.
                      "Grönt i alla, inte bara den valda": inaktiva pillar
                      fick dessutom en grön kant + grön text i stället för
                      det neutrala grå/svarta paret, så HELA gruppen läses
                      som en sammanhängande grön mallväljare. */}
                  {Object.values(INVOICE_TEMPLATES).map(tpl => {
                    const active = templateSnapshot.templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id} type="button" title={tpl.description}
                        onClick={() => setTemplateSnapshot(s => ({ ...s, templateId: tpl.id }))}
                        style={{
                          padding: '5px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap',
                          border: `1.5px solid var(--accent)`,
                          background: active ? 'var(--accent)' : 'var(--bg-card)', color: active ? 'white' : 'var(--accent-text)', cursor: 'pointer',
                        }}
                      >{tpl.label}</button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('ui.accentfarg')}</span>
                  <input
                    type="color"
                    value={templateSnapshot.accentColor || INVOICE_TEMPLATES[templateSnapshot.templateId]?.defaultAccent || '#000000'}
                    onChange={e => setTemplateSnapshot(s => ({ ...s, accentColor: e.target.value }))}
                    style={{ width: '32px', height: '24px', padding: '1px', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', background: 'var(--bg-card)', flexShrink: 0 }}
                  />
                </div>
                <div className="preview-zoom-ctl" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, border: '1px solid var(--border)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                    disabled={previewZoom <= 0.5} title={t('ui.zooma_ut')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom <= 0.5 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom <= 0.5 ? 'not-allowed' : 'pointer' }}
                  ><ZoomOut size={14} /></button>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '38px', textAlign: 'center', flexShrink: 0 }}>{Math.round(previewZoom * 100)}%</span>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                    disabled={previewZoom >= 2} title={t('ui.zooma_in')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom >= 2 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom >= 2 ? 'not-allowed' : 'pointer' }}
                  ><ZoomIn size={14} /></button>
                </div>
                <div style={{ flex: 1, minWidth: '8px' }} />
                <button onClick={handleDownloadPdf} disabled={pdfBusy} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: pdfBusy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Download size={13} /> {pdfBusy ? t('ui.skapar_pdf') : t('ui.ladda_ner_pdf')}
                </button>
              </div>
            </div>
            {pdfError && <div style={{ fontSize: '12px', color: 'var(--status-red-text)', marginBottom: '10px' }}>{pdfError}</div>}
            <div style={{ overflow: 'auto', touchAction: 'pinch-zoom' }}>
              <div style={{ zoom: previewZoom, transition: 'zoom 0.15s ease' }}>
                <PaperFit>
                <InvoiceDocument
                  ref={previewRef}
                  invoice={{ invoiceNumber: previewNumber, date, dueDate, workStartDate, workEndDate, workLocation, deliveryDescription, terms: formattedTerms, lateInterest: formattedLateInterest, notIncluded, otherTerms }}
                  customer={customer}
                  company={company}
                  rows={previewRows}
                  totals={totals}
                  currency={currency}
                  docLabel="OFFERT"
                  docType="quote"
                  template={templateSnapshot.templateId}
                  accentColor={templateSnapshot.accentColor}
                  logoUrl={templateSnapshot.logoUrl}
                  logoSize={templateSnapshot.logoSize}
                  showCompanyName={templateSnapshot.showCompanyName}
                  footerText={templateSnapshot.footerText}
                />
                </PaperFit>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Osynlig, alltid monterad, oskalad — PDF/mejl fångar ALLTID denna. */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '794px', pointerEvents: 'none' }} aria-hidden="true">
        <InvoiceDocument
          ref={captureRef}
          invoice={{ invoiceNumber: previewNumber, date, dueDate, workStartDate, workEndDate, workLocation, deliveryDescription, terms: formattedTerms, lateInterest: formattedLateInterest, notIncluded, otherTerms }}
          customer={customer}
          company={company}
          rows={previewRows}
          totals={totals}
          currency={currency}
          docLabel="OFFERT"
          docType="quote"
          template={templateSnapshot.templateId}
          accentColor={templateSnapshot.accentColor}
          logoUrl={templateSnapshot.logoUrl}
          logoSize={templateSnapshot.logoSize}
          showCompanyName={templateSnapshot.showCompanyName}
          footerText={templateSnapshot.footerText}
        />
      </div>
    </div>
  );
}

export default function Quotes({ quotes = [], setQuotes, onConvert, contacts = [], projects = [], company, user, globalAction, clearGlobalAction, handleGlobalAction, articles = [], onSyncBeforeServerCall }) {
  const [searchTerm, setSearchTerm] = useState('');
  // Kundönskemål: "en knapp där man kan se femton, trettio, femtio" — samma
  // visa-N-åt-gången-väljare som Kunder/Fakturering (ListFilterBar).
  const [pageSize, setPageSize] = useState(30);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = ny offert, annars id på offerten som redigeras

  useEffect(() => {
    if (globalAction?.type === 'new_quote') {
      openNew();
      clearGlobalAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalAction, clearGlobalAction]);

  const filtered = quotes.filter(q => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const customerName = contacts.find(c => c.id === q.customerId)?.name || q.customerName || '';
    return customerName.toLowerCase().includes(s) || (q.invoiceNumber || '').toLowerCase().includes(s);
  });
  const visible = pageSize === 'all' ? filtered : filtered.slice(0, pageSize);

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    // Tas bort direkt, med Ångra i notisen (shared/undoToast.js).
    if (!setQuotes) return;
    const index = quotes.findIndex(q => q.id === id);
    const removed = quotes[index];
    setQuotes(prev => prev.filter(q => q.id !== id));
    if (removed) showUndo({ message: t('ui.undo_offert_borttagen'), onUndo: () => setQuotes(prev => restoreAt(prev, removed, index)) });
  };

  // Offerter och fakturor är separata listor (se App.jsx: normalizeStore/
  // handleConvertQuoteToInvoice) — precis som i Fortnox/Bokio, så att en
  // offert aldrig kan räknas som bokföringsunderlag av misstag. Konvertering
  // är därför inte längre "byt type-fält på samma post" utan en riktig flytt:
  // App.jsx tar bort offerten ur `quotes`, skapar en ny post i `invoices`
  // med ett RIKTIGT nästa fakturanummer ur samma serie som Invoices.jsx
  // använder, och bokför den (precis som en direkt-skapad faktura). Alltid
  // tillgänglig oavsett status — ägarens eget omdöme, inte appens.
  const handleConvert = async (quote, e) => {
    e?.stopPropagation();
    if (!(await confirmDialog(t('ui.konvertera_denna_offert_till_en_faktura'), { title: t('ui.konvertera_till_faktura'), confirmLabel: t('ui.konvertera') }))) return;
    if (!onConvert) return;
    onConvert(quote.id);
    setIsFormOpen(false);
    setEditingId(null);
    if (handleGlobalAction) handleGlobalAction(null, 'invoices');
  };

  const openNew = () => {
    setEditingId(null);
    setIsFormOpen(true);
  };

  const openEdit = (quote) => {
    setEditingId(quote.id);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const editingQuote = editingId ? quotes.find(q => q.id === editingId) : null;

  const handleSaveQuote = (data) => {
    if (!setQuotes) return;
    if (editingId) {
      setQuotes(prev => prev.map(q => q.id === editingId ? { ...q, ...data } : q));
    } else {
      const newQuote = {
        id: `q_${Date.now()}`,
        type: 'quote',
        invoiceNumber: getNextQuoteNumber(quotes),
        status: 'draft',
        ...data,
      };
      setQuotes(prev => [newQuote, ...(prev || [])]);
    }
    closeForm();
  };

  const getTotal = (q) => {
    return (q.rows || []).reduce((sum, r) => {
      const net = (r.qty || 1) * (r.unitPrice || 0) * (1 - (r.discount || 0) / 100);
      return sum + net + net * ((r.vatRate || 0) / 100);
    }, 0);
  };

  if (isFormOpen) {
    return (
      <QuoteEditor
        // Ny instans per offert som öppnas — annars återanvänder React samma
        // state (kund/rader/datum) mellan olika offerter, precis som
        // motsvarande bugkritiska kommentar i Invoices.jsx (InvoiceForm)
        // beskriver.
        key={editingId || 'new'}
        quote={editingQuote}
        quotes={quotes}
        contacts={contacts}
        projects={projects}
        company={company}
        user={user}
        articles={articles}
        onSave={handleSaveQuote}
        onClose={closeForm}
        onConvert={editingQuote ? (e) => handleConvert(editingQuote, e) : null}
        onSyncBeforeServerCall={onSyncBeforeServerCall}
      />
    );
  }

  /* Header i samma mönster som Kunder/Anställda och lön/Projekt/Granskning/
     Bokföring (Sida 43) — egen bg-card-header som stannar kvar medan bara
     tabellen/tomt-läget scrollar under, istället för den tidigare platta
     kolumnen där hela sidan (inklusive titel och knapp) scrollade bort i ett. */
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title={t('ui.offerter')}
        subtitle={t('ui.skapa_offerter_med_samma_mall_som_dina_fakturor')}
        actions={[
          { key: 'new', label: t('ui.ny_offert'), icon: Plus, onClick: openNew, variant: 'primary' },
        ]}
      />
      {/* Sökfältet ligger kvar i sidhuvudets kort (ListFilterBar, samma
          mönster som Bokförings filterrad) istället för att flyta löst
          ovanför tabellen på sidbakgrunden. */}
      <ListFilterBar
        count={filtered.length}
        countLabel={filtered.length === 1 ? t('ui.offert_2') : t('ui.offerter_2')}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      >
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder={t('ui.sok_offert_eller_kund')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={listSearchInputStyle} />
        </div>
      </ListFilterBar>

      {/* Ingen padding längre — matchar "facit" (Bokföring/Verifikationer):
          tabellen sitter flush direkt under filterraden. Tomt-läget nedan
          behåller sin egen marginal (`margin`) eftersom det är ett
          fristående kort, inte en full-bredd-tabell. */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* TABLE — bugkritiskt (kundfeedback, "white space"-genomgången): en
            tom lista visade tidigare bara EN paddad tabellrad ("Inga offerter
            skapade") längst upp i sidan, med hela resten av sidhöjden kvar som
            ren sidbakgrund under — den ensamma raden hade ingen egen flex-höjd
            att centrera sig i (den satt inuti tabellskalet, som i sig bara är
            lika hög som sitt innehåll). Precis samma mönster som Invoices.jsx
            redan löste rätt med `InvoiceEmptyState` (flex:1 + centrerat) —
            tomt tillstånd renderas nu som ett eget flex:1-block istället för
            att tvingas in i en tabellrad, så det centreras i den lediga ytan
            i stället för att kännas som ett trasigt, för glest ifyllt kort. */}
        {filtered.length === 0 ? (
          // Kundönskemål ("Fakturor är det som ser bra ut"): ingen egen
          // marginal/kant längre — fyller ytan flush mot filterraden och
          // sidorna, samma mönster som Fakturors tomma läge. Har nu även en
          // egen "Ny offert"-knapp (som Kontakters tomma läge) i stället
          // för att bara peka på knappen i headern ovanför.
          <div style={{
            flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '10px', padding: '40px', textAlign: 'center',
            background: 'var(--bg-card)',
          }}>
            <div style={{ width: 56, height: 56, borderRadius: '999px', background: searchTerm ? 'var(--border-light)' : 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: searchTerm ? 'var(--text-muted)' : BRAND.green, marginBottom: '4px' }}>
              <NavQuotesIcon size={26} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              {searchTerm ? t('ui.inga_offerter_matchar_din_sokning') : t('ui.inga_offerter_skapade')}
            </div>
            <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '320px' }}>
              {searchTerm ? t('ui.prova_att_rensa_sokningen_ovan') : t('ui.skapa_din_forsta_offert_for_att_komma_igang')}
            </div>
            {!searchTerm && (
              <button type="button" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', marginTop: '8px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={16} /> {t('ui.ny_offert')}
              </button>
            )}
          </div>
        ) : (
        /* Kundfeedback: en populerad (om än kort) lista ska inte centreras
           lodrätt — bara det helt tomma läget ovan. */
        <ListTable
          rowKey={q => q.id}
          onRowClick={openEdit}
          rows={visible}
          mobileList={q => {
            const s = getStatusStyle(getDisplayStatus(q));
            // Kundfeedback (skärmdump): raden inleddes med "—" så fort ingen
            // kund var vald — och en offert utan kund är just den man behöver
            // hitta igen. Offertnumret bär identiteten i stället, och att
            // kunden saknas står i klartext på metaraden.
            const customerName = contacts.find(c => c.id === q.customerId)?.name || q.customerName;
            const metaRest = `${q.date || ''}${q.dueDate ? ` · giltig t.o.m. ${q.dueDate}` : ''}`;
            return {
              dot: s.color,
              primary: customerName || `Offert ${q.invoiceNumber || ''}`.trim(),
              amount: `${getTotal(q).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr`,
              meta: customerName
                ? `${q.invoiceNumber || '—'} · ${metaRest}`
                : t('ui.ingen_kund_vald_2', { metaRest }),
              pill: <span style={{ padding: '2px 8px', background: s.bg, color: s.color, borderRadius: '999px', fontSize: '10.5px', fontWeight: 700 }}>{s.label}</span>,
              // Åtgärdskolumnen (skapa faktura / ta bort) fanns bara i
              // desktoptabellen — på telefonen gick en offert därför att läsa
              // men inte att göra något med. Kundfeedback: "man får ej info …
              // ska vara bra som fakturering". Samma två handlers som
              // kolumnen använder, ingen egen logik. Ligger bakom ett svep åt
              // vänster (SwipeRow) i stället för som knappar på varje rad;
              // Skapa faktura finns också inne i offerten.
              swipeActions: [
                { key: 'convert', label: t('ui.skapa_faktura'), icon: FileText, tone: 'accent', onClick: (e) => handleConvert(q, e) },
                { key: 'delete', label: t('ui.ta_bort'), icon: Trash2, tone: 'danger', onClick: (e) => handleDelete(q.id, e) },
              ],
            };
          }}
          columns={[
            {
              key: 'invoiceNumber', label: t('ui.offertnr'), fontWeight: 600, color: 'var(--text-main)', render: q => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <NavQuotesIcon size={16} color="var(--text-muted)" /> {q.invoiceNumber || '—'}
                </div>
              ),
            },
            { key: 'customer', label: t('ui.kund'), fontWeight: 500, wrap: true, render: q => contacts.find(c => c.id === q.customerId)?.name || q.customerName || '—' },
            { key: 'date', label: t('ui.datum'), render: q => q.date },
            {
              key: 'status', label: t('ui.status'), render: q => {
                const s = getStatusStyle(getDisplayStatus(q));
                return <span style={{ padding: '4px 10px', background: s.bg, color: s.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.label}</span>;
              },
            },
            { key: 'total', label: t('ui.belopp'), align: 'right', fontWeight: 500, render: q => `${getTotal(q).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr` },
            {
              key: 'actions', label: t('ui.atgarder'), align: 'right', render: q => (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  {/* Alltid tillgänglig oavsett status (utkast/skickad/accepterad/
                      avvisad/förfallen) — det är ägarens eget omdöme om en kund
                      faktiskt vill ha en faktura, inte något appen ska hindra
                      baserat på var i statusflödet offerten råkar stå. Se samma
                      resonemang vid motsvarande knapp i QuoteEditor ovan. */}
                  <button onClick={(e) => handleConvert(q, e)} title={t('ui.konvertera_till_faktura')} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-text)' }}>
                    <FileText size={16} />
                  </button>
                  <button onClick={(e) => handleDelete(q.id, e)} title={t('ui.ta_bort')} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
        />
        )}
      </div>
    </div>
  );
}
