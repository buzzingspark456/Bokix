import React, { forwardRef } from 'react';
import { formatCompanyAddress } from '../utils/companyAddress';
import { ROT_RUT_RATES } from '../utils/rotRutConfig';
import { isVatExempt } from '../utils/vatRegistration';
import { foreignSaleNote } from '../utils/foreignSales';
import { numberFormat, dateTimeFormat } from '../utils/intlCache';

const fmt = (val) =>
  numberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);

const formatDate = (d) => {
  if (!d) return '';
  try { return dateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

// Ljus ton av accentfärgen som en fast färg. html2canvas (PDF:en) klarar inte
// genomskinlighet i #rrggbbaa och ritar då hela färgen, så rutan blev mörk.
const softTint = (hex) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return '#f3f4f6';
  const [r, g, b] = m.slice(1).map(c => Math.round(parseInt(c, 16) * 0.08 + 255 * 0.92));
  return `rgb(${r}, ${g}, ${b})`;
};

// 0 (svart) till 1 (vit). Avgör om text på accentfärgen ska vara vit eller mörk.
const brightness = (hex) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return 0;
  const [r, g, b] = m.slice(1).map(c => parseInt(c, 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// ── Fakturamallar ────────────────────────────────────────────────────────
// Sex olika utseenden på samma innehåll. Sidhuvud, summa, betalning och
// sidfot har egen form i varje mall, men alla uppgifter en svensk faktura ska
// ha står på alla. Mallen ändrar bara utseendet, aldrig vad som står på
// dokumentet. `id` sparas på företaget och på varje faktura, så det får inte
// bytas. `defaultAccent` gäller bara om företaget inte valt en egen färg.
export const INVOICE_TEMPLATES = {
  classic: { id: 'classic', label: 'Standard', description: 'Den vanliga svenska fakturan: logotyp till vänster, kunden till höger.', defaultAccent: '#1f2937' },
  bold:    { id: 'bold',    label: 'Modern',   description: 'Färgat band över hela sidans topp, stort belopp och mjuka kort.', defaultAccent: '#0f766e' },
  minimal: { id: 'minimal', label: 'Ren',      description: 'Serif, inga rutor och mycket luft. Betalningen står som en mening.', defaultAccent: '#1f2937' },
  grid:    { id: 'grid',    label: 'Blankett', description: 'Ett traditionellt formulär med allt i rutor, ända ned till sidfoten.', defaultAccent: '#1f2937' },
  business: { id: 'business', label: 'Affär',   description: 'Stor logotyp, kunden till höger och summan i en rad längst ned.', defaultAccent: '#111827' },
  compact: { id: 'compact', label: 'Enkel',    description: 'Stor rubrik, kunden i en grå ruta och betalningen samlad längst ned.', defaultAccent: '#111827' },
};
export const DEFAULT_INVOICE_TEMPLATE = 'classic';

/**
 * Den ENDA fakturarenderaren. Används både för skärmens live-förhandsvisning
 * (i InvoiceForm och i Inställningars mallväljare/förhandsvisning) och som
 * den bokstavliga DOM-nod som fångas för PDF-export — de två kan därför
 * aldrig divergera. Alla visuella ändringar (inklusive mallval) hör hemma
 * här, ingen annanstans.
 */
const InvoiceDocument = forwardRef(function InvoiceDocument(
  {
    invoice, customer, company, rows = [], totals, currency = 'SEK', invoiceText, docLabel = 'FAKTURA',
    docType = 'invoice', logoUrl, logoSize = 'small', showCompanyName = true, footerText, template = DEFAULT_INVOICE_TEMPLATE, accentColor, rotRut = null,
  },
  ref
) {
  const tpl = INVOICE_TEMPLATES[template] || INVOICE_TEMPLATES[DEFAULT_INVOICE_TEMPLATE];
  const accent = accentColor || tpl.defaultAccent;
  // Logotypens storlek (Fakturor → Anpassa mallen). Fakturor sparade före
  // inställningen har inget värde och behåller den lilla storleken.
  const logoScale = { small: 1, medium: 1.6, large: 2.4 }[logoSize] || 1;
  const logoStyle = (h, w, mb) => ({ maxHeight: Math.round(h * logoScale), maxWidth: Math.round(w * logoScale), marginBottom: mb, display: 'block', objectFit: 'contain' });
  // Logotypen innehåller ofta redan namnet, så nya fakturor döljer namnet
  // under den (Fakturor → Anpassa mallen). Äldre fakturor saknar värdet och
  // visar namnet som förut.
  const showName = !logoUrl || showCompanyName !== false;
  // Bugkritiskt: filtret var `r.description` ensamt, alltså doldes varje
  // rad utan text — ÄVEN om den hade antal och pris. Summan räknas på alla
  // rader, så resultatet blev en faktura där det stod "Inga rader tillagda
  // än" ovanför ett belopp på 8 325 kr. Kunden som får den kan varken
  // förstå eller kontrollera vad hen ska betala för, och en faktura utan
  // uppgift om varans eller tjänstens art uppfyller inte heller
  // faktureringskraven i mervärdesskattelagen.
  //
  // Nu döljs bara rader som är HELT tomma. Bär raden ett belopp syns den,
  // med en tydlig markering om att beskrivningen saknas.
  const hasAmount = (r) => Number(r.qty) || Number(r.unitPrice) || Number(r.amount);
  const visibleRows = rows.filter(r => r.description || hasAmount(r));
  const foreignNote = isVatExempt(company) ? null : foreignSaleNote(customer, visibleRows);
  // Bara när dokumentet verkligen saknar moms: en äldre faktura med moms,
  // från innan företaget avregistrerades, visas som den skickades.
  const noVat = isVatExempt(company) && !Number(totals?.vat);
  const isGrid = template === 'grid';
  const isBold = template === 'bold';
  const isMinimal = template === 'minimal';
  const isSimple = template === 'compact';
  const isBusiness = template === 'business';
  // En okänd mall (gammalt id) visas som Standard, via tpl ovan.
  const isClassic = !isGrid && !isBold && !isMinimal && !isSimple && !isBusiness;

  // En offert har varken OCR (kopplat till en verklig betalning) eller ett
  // "förfallodatum" — den är giltig till ett visst datum, inte förfallen.
  // Att visa fakturaspecifika fält på en offert vore att fejka en detalj som
  // inte finns, så mallens metafält skiljer sig per docType istället för att
  // återanvända fakturans ordval rakt av.
  // "Att betala" antar att beloppet faktiskt förfaller till betalning —
  // sant för en faktura, men en offert är bara ett prisförslag ännu.
  const totalLabel = docType === 'quote' ? 'Offertbelopp' : 'Att betala';
  const customerLabel = docType === 'quote' ? 'Offereras till' : 'Faktureras till';

  // Betalningsuppgifterna hör bara hemma på fakturan: på en offert ser ett
  // kontonummer ut som ett krav på pengar för något som inte ens är sålt än.
  // Leverans- och betalningsvillkor är däremot förväntat innehåll i en offert
  // (specifikation, pris, moms, leveranstid och villkor). "Giltig till" står
  // redan i metadatan och upprepas inte här.
  const otherTermsList = invoice?.otherTerms ? (
    <ul style={{ margin: '4px 0 0', paddingLeft: 14 }}>
      {invoice.otherTerms.split('\n').map(l => l.trim()).filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  ) : null;

  // Utförande/leverans (Sida 40) — fyra separata formulärfält (Start-/
  // slutdatum, plats, beskrivning) slås ihop till EN footer-rad här, istället
  // för att InvoiceDocument behöver fyra nya villkorliga rader. Faller
  // tillbaka på det gamla fritextfältet `deliveryTerms` för offerter sparade
  // innan fälten fanns, så äldre offerter fortfarande visar vad de en gång
  // hade ifyllt.
  const hasWorkDetails = invoice?.workStartDate || invoice?.workEndDate || invoice?.workLocation || invoice?.deliveryDescription;
  const workDetailsValue = hasWorkDetails ? (
    <>
      {(invoice?.workStartDate || invoice?.workEndDate) && (
        <div>{formatDate(invoice?.workStartDate)}{invoice?.workEndDate ? ` till ${formatDate(invoice.workEndDate)}` : ''}</div>
      )}
      {invoice?.workLocation && <div>{invoice.workLocation}</div>}
      {invoice?.deliveryDescription && <div>{invoice.deliveryDescription}</div>}
    </>
  ) : (invoice?.deliveryTerms || null);

  const quoteTerms = docType === 'quote'
    ? [
        ...(workDetailsValue ? [['Leveransvillkor', workDetailsValue]] : []),
        ['Betalningsvillkor', invoice?.terms || '30 dagar netto'],
        ...(invoice?.notIncluded ? [['Ingår ej', invoice.notIncluded]] : []),
        ...(otherTermsList ? [['Övriga villkor', otherTermsList]] : []),
      ]
    : [];

  const meta = docType === 'quote'
    ? [
        ['Offertnr', invoice?.invoiceNumber || ''],
        ['Offertdatum', formatDate(invoice?.date)],
        ['Giltig till', formatDate(invoice?.dueDate)],
      ]
    : [
        ['Fakturanr', invoice?.invoiceNumber || ''],
        ...(isBusiness ? [['OCR', invoice?.invoiceNumber ? String(invoice.invoiceNumber).padStart(7, '0') : '']] : []),
        ['Fakturadatum', formatDate(invoice?.date)],
        ['Förfallodatum', formatDate(invoice?.dueDate)],
      ];

  const sellerName = (company?.invoiceDisplayName || company?.name) || 'Ditt företag';
  const INK = '#111827';
  const MUTED = '#6b7280';
  const LINE = '#e5e7eb';
  const small = 11;
  const body = 11.5;
  const gridBorder = '1px solid #111827';
  // En mycket ljus egen färg syns inte som text på vitt, och vit text syns inte
  // på den som bakgrund.
  const textAccent = brightness(accent) > 0.75 ? INK : accent;
  const onAccent = brightness(accent) > 0.6 ? INK : 'white';
  const tint = softTint(accent);

  // På färgbandet i Modern får logotypen en vit platta, annars försvinner en
  // mörk logotyp mot bakgrunden.
  const brand = (nameColor = INK, onBand = false) => {
    const logo = logoUrl ? <img src={logoUrl} alt={sellerName} style={logoStyle(44, 170, onBand ? 0 : (showName ? 8 : 0))} /> : null;
    return (
      <div>
        {logo && onBand ? <div style={{ width: 'fit-content', padding: '6px 10px', marginBottom: showName ? 8 : 0, background: 'white', borderRadius: 8 }}>{logo}</div> : logo}
        {showName && <div style={{ fontSize: 16, fontWeight: 700, color: nameColor }}>{sellerName}</div>}
      </div>
    );
  };
  const title = (size) => (
    <h1 style={{ margin: 0, fontSize: size, fontWeight: 700, letterSpacing: '0.02em', color: textAccent }}>{docLabel}</h1>
  );
  const metaBlock = (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 16px', fontSize: body, alignContent: 'start' }}>
      {meta.map(([l, v]) => (
        <React.Fragment key={l}>
          <span style={{ color: MUTED }}>{l}</span>
          <span style={{ color: INK, fontWeight: 600 }}>{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
  // Org.nr och kontaktperson visas bara när kundkortet har dem ifyllda. "Att:
  // NN" är branschbruk för att rikta dokumentet till rätt person hos kunden.
  const sectionLabel = (text) => (
    <div style={{ fontSize: small - 1, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTED, marginBottom: 4 }}>{text}</div>
  );
  const customerDetails = (
    <div style={{ fontSize: body, lineHeight: 1.55, color: '#374151' }}>
      <div style={{ fontSize: body + 1.5, fontWeight: 700, color: INK }}>{customer?.name || 'Kund saknas'}</div>
      {customer?.contactPerson ? <div>Att: {customer.contactPerson}</div> : null}
      {customer?.address ? <div>{customer.address}</div> : null}
      {customer?.orgNr ? <div>Org.nr {customer.orgNr}</div> : null}
      {customer?.vatNumber ? <div>Momsreg.nr {customer.vatNumber}</div> : null}
      {customer?.email ? <div>{customer.email}</div> : null}
    </div>
  );
  const customerBlock = <div>{sectionLabel(customerLabel)}{customerDetails}</div>;

  const headCell = (i) => ({
    textAlign: i > 0 ? 'right' : 'left', padding: '8px 8px', fontSize: small, fontWeight: 700, color: INK,
    ...(isClassic ? { borderBottom: `1.5px solid ${accent}` } : {}),
    ...(isBold ? { borderBottom: `2px solid ${accent}`, color: textAccent, fontSize: small - 1, letterSpacing: '0.06em', textTransform: 'uppercase' } : {}),
    ...(isSimple ? { borderBottom: `1px solid ${LINE}`, color: MUTED, fontSize: small - 1, letterSpacing: '0.05em', textTransform: 'uppercase' } : {}),
    ...(isBusiness ? { borderTop: '1px solid #9ca3af', borderBottom: `1px solid ${INK}`, fontWeight: 400 } : {}),
    ...(isMinimal ? { borderBottom: `1px solid ${INK}`, fontWeight: 400, fontStyle: 'italic', color: '#374151' } : {}),
    ...(isGrid ? { border: gridBorder, background: '#f3f4f6' } : {}),
  });
  const cell = (right, rowIndex = 0) => ({
    textAlign: right ? 'right' : 'left', verticalAlign: 'top', padding: isMinimal ? '12px 8px' : isBold || isSimple ? '10px 8px' : '8px 8px', fontSize: body, color: INK,
    ...(isGrid ? { border: gridBorder }
      : isBold ? { background: rowIndex % 2 ? tint : 'white' }
      : { borderBottom: `1px solid ${isMinimal ? '#ececec' : LINE}` }),
  });

  const payable = (totals?.total || 0) - (rotRut?.deduction || 0);
  // Summaraden i Affär: momsen per momssats med underlaget inom parentes.
  const vatByRate = noVat ? [] : Object.entries(visibleRows.reduce((acc, r) => {
    const net = r.qty * r.unitPrice * (1 - (r.discount || 0) / 100);
    acc[r.vatRate] = (acc[r.vatRate] || 0) + net;
    return acc;
  }, {})).filter(([rate]) => Number(rate) > 0);
  const businessStrip = [
    ['Exkl. moms', fmt(totals?.net)],
    ...(!noVat ? [['Moms', fmt(totals?.vat)]] : []),
    ...(rotRut?.deduction > 0 ? [[ROT_RUT_RATES[rotRut.type]?.label || 'Husavdrag', `−${fmt(rotRut.deduction)}`]] : []),
    ['Totalt', fmt(totals?.total)],
  ];
  const showPayment = company?.showPaymentDetailsOnInvoice !== false;
  const ocr = invoice?.invoiceNumber ? String(invoice.invoiceNumber).padStart(7, '0') : '';
  const amountDue = `${fmt(payable)} ${currency}`;
  const paymentBoxes = docType === 'quote' ? [] : [
    ['Att betala', amountDue],
    ['Förfallodatum', formatDate(invoice?.dueDate)],
    ...(showPayment ? [['Bankgiro', company?.bankgiro || '']] : []),
    ['OCR', ocr],
  ];
  const termsLabel = `Betalningsvillkor: ${invoice?.terms || '30 dagar netto'}`;

  const footerColumns = [
    ['Företag', [sellerName, formatCompanyAddress(company) || 'Adress saknas']],
    ['Kontakt', [company?.phone, company?.email].filter(Boolean)],
    ['Betalning', showPayment && docType !== 'quote' ? [company?.bankgiro ? `Bankgiro ${company.bankgiro}` : null, company?.iban ? `IBAN ${company.iban}` : null].filter(Boolean) : []],
    ['Organisation', [company?.orgNr ? `Org.nr ${company.orgNr}` : null, company?.vatNr ? `Momsreg.nr ${company.vatNr}` : null, company?.fSkatt ?? 'Godkänd för F-skatt'].filter(Boolean)],
  ].filter(([, lines]) => lines.length > 0);

  const sumLines = [
    ['Netto', `${fmt(totals?.net)} ${currency}`],
    ...(!noVat ? [['Moms', `${fmt(totals?.vat)} ${currency}`]] : []),
    ...(rotRut?.deduction > 0 ? [
      ['Fakturerat belopp', `${fmt(totals?.total)} ${currency}`],
      [`${ROT_RUT_RATES[rotRut.type]?.label || 'Husavdrag'} (${rotRut.rate}%)`, `−${fmt(rotRut.deduction)} ${currency}`],
    ] : []),
  ];
  const sumRow = (extra) => ({ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 8px', ...extra });

  // ── Summan: egen form i varje mall, Affär har sin rad längst ned. ──
  const totalsBlock = isBusiness ? null : isGrid ? (
    <div style={{ width: '50%', marginLeft: 'auto', marginBottom: 18, border: gridBorder, borderTop: 'none', fontSize: body }}>
      {sumLines.map(([l, v]) => <div key={l} style={sumRow({ padding: '6px 8px', borderBottom: gridBorder })}><span>{l}</span><span>{v}</span></div>)}
      <div style={sumRow({ padding: '8px', background: '#f3f4f6', fontSize: body + 2, fontWeight: 700 })}><span>{totalLabel}</span><span>{amountDue}</span></div>
    </div>
  ) : isBold ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
      <div style={{ width: 300, padding: 8, background: tint, borderRadius: 12, fontSize: body }}>
        {sumLines.map(([l, v]) => <div key={l} style={sumRow()}><span>{l}</span><span>{v}</span></div>)}
        <div style={sumRow({ marginTop: 6, padding: '10px 12px', background: accent, color: onAccent, borderRadius: 8, fontSize: body + 3, fontWeight: 700 })}><span>{totalLabel}</span><span>{amountDue}</span></div>
      </div>
    </div>
  ) : isMinimal ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 26 }}>
      <div style={{ width: 300, fontSize: body }}>
        {sumLines.map(([l, v]) => <div key={l} style={sumRow()}><span>{l}</span><span>{v}</span></div>)}
        <div style={sumRow({ marginTop: 8, padding: '9px 8px', borderTop: `3px double ${INK}`, fontSize: body + 5 })}><span>{totalLabel}</span><span>{amountDue}</span></div>
      </div>
    </div>
  ) : isSimple ? (
    <div style={{ marginBottom: 24, fontSize: body }}>
      <div style={{ width: 270, marginLeft: 'auto' }}>
        {sumLines.map(([l, v]) => <div key={l} style={sumRow()}><span style={{ color: MUTED }}>{l}</span><span>{v}</span></div>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, marginTop: 8, padding: '10px 8px 0', borderTop: `1px solid ${INK}`, fontSize: 17, fontWeight: 700 }}>
        <span>{totalLabel}</span><span style={{ color: textAccent }}>{amountDue}</span>
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
      <div style={{ width: 270, fontSize: body }}>
        {sumLines.map(([l, v]) => <div key={l} style={sumRow()}><span>{l}</span><span>{v}</span></div>)}
        <div style={sumRow({ marginTop: 5, padding: '7px 8px 0', borderTop: `1.5px solid ${accent}`, fontSize: body + 3, fontWeight: 700 })}><span>{totalLabel}</span><span>{amountDue}</span></div>
      </div>
    </div>
  );

  // ── Betalningen: rutor, kort, en mening eller en samlad ruta. Affär har den
  // i sin summarad. ──
  const paymentCards = paymentBoxes.filter(([l]) => l === 'Bankgiro' || l === 'OCR');
  const simplePayment = [
    ...(showPayment && company?.bankgiro ? [['Bankgiro', company.bankgiro]] : []),
    ...(showPayment && company?.iban ? [['IBAN', company.iban]] : []),
    ['Förfallodatum', formatDate(invoice?.dueDate)],
    ['Fakturanummer', invoice?.invoiceNumber || ''],
    ['OCR', ocr],
    ['Betalningsvillkor', invoice?.terms || '30 dagar netto'],
  ];
  const paymentBlock = paymentBoxes.length === 0 || isBusiness ? null : isSimple ? (
    <div style={{ padding: '14px 18px', marginBottom: 18, background: '#f6f7f9', borderRadius: 8, fontSize: body }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Betalningsinformation</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 28px' }}>
        {simplePayment.map(([l, v]) => (
          <React.Fragment key={l}>
            <span style={{ color: MUTED }}>{l}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  ) : isMinimal ? (
    <div style={{ marginBottom: 18, fontSize: body + 0.5, lineHeight: 1.7, color: '#374151' }}>
      Betala <strong style={{ color: INK }}>{amountDue}</strong>
      {showPayment && company?.bankgiro ? <> till bankgiro <strong style={{ color: INK }}>{company.bankgiro}</strong></> : null}
      {' '}senast <strong style={{ color: INK }}>{formatDate(invoice?.dueDate)}</strong>. Ange OCR <strong style={{ color: INK }}>{ocr}</strong>.
      <div style={{ fontSize: small }}>{termsLabel}</div>
    </div>
  ) : isBold ? (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${paymentCards.length}, 1fr)`, gap: 12, marginBottom: 14 }}>
      {paymentCards.map(([l, v]) => (
        <div key={l} style={{ padding: '11px 16px', background: tint, borderRadius: 12 }}>
          <div style={{ fontSize: small - 1, color: MUTED, marginBottom: 2 }}>{l}</div>
          <div style={{ fontSize: body + 2, fontWeight: 700 }}>{v}</div>
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${paymentBoxes.length}, 1fr)`, border: isGrid ? gridBorder : `1px solid ${LINE}`, borderRadius: isGrid ? 0 : 6, marginBottom: 18 }}>
      {paymentBoxes.map(([l, v], i) => (
        <div key={l} style={{ padding: '9px 12px', borderLeft: i ? (isGrid ? gridBorder : `1px solid ${LINE}`) : 'none' }}>
          <div style={{ fontSize: small - 1, color: MUTED, marginBottom: 2 }}>{l}</div>
          <div style={{ fontSize: body, fontWeight: 700 }}>{v}</div>
        </div>
      ))}
    </div>
  );

  // ── Sidfoten: kolumner, rutor eller löpande rader. Betalningen står redan i
  // rutan ovanför i Enkel. ──
  const footerBlock = isSimple ? (
    <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 9.5, lineHeight: 1.6, color: MUTED, textAlign: 'center' }}>
      {[['Företag', 'Kontakt'], ['Organisation']].map(group => (
        <div key={group[0]}>{footerColumns.filter(([l]) => group.includes(l)).flatMap(([, lines]) => lines).join(' · ')}</div>
      ))}
    </div>
  ) : isMinimal ? (
    <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${INK}`, fontSize: 9.5, lineHeight: 1.7, color: '#4b5563', textAlign: 'center' }}>
      {footerColumns.map(([l, lines]) => <div key={l}>{lines.join(', ')}</div>)}
    </div>
  ) : isGrid ? (
    <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: `repeat(${footerColumns.length}, 1fr)`, border: gridBorder, fontSize: 9.5, lineHeight: 1.5, color: '#374151' }}>
      {footerColumns.map(([l, lines], i) => (
        <div key={l} style={{ minWidth: 0, padding: '7px 9px', overflowWrap: 'anywhere', borderLeft: i ? gridBorder : 'none' }}>
          <strong style={{ display: 'block', color: INK }}>{l}</strong>
          {lines.map(line => <div key={line}>{line}</div>)}
        </div>
      ))}
    </div>
  ) : (
    <div style={{ marginTop: isBusiness ? 0 : 'auto', display: 'grid', gridTemplateColumns: `repeat(${footerColumns.length}, 1fr)`, gap: 16, paddingTop: 10, borderTop: `${isBold ? 2 : 1}px solid ${isBold ? accent : LINE}`, fontSize: 9.5, lineHeight: 1.5, color: '#4b5563' }}>
      {footerColumns.map(([l, lines]) => (
        <div key={l} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <strong style={{ display: 'block', color: INK }}>{l}</strong>
          {lines.map(line => <div key={line}>{line}</div>)}
        </div>
      ))}
    </div>
  );

  // Innehållet under sidhuvudet, i samma ordning i alla mallar.
  const content = (
    <>
      {/* Kund utomlands utan svensk moms: texten lagen kräver på fakturan
          (utils/foreignSales.js). Momsregistreringsnumren står ovan. */}
      {foreignNote && <div style={{ fontSize: body, fontWeight: 600, marginBottom: 16 }}>{foreignNote}</div>}

      {/* Inte momsregistrerat och ingen moms på fakturan: ingen momskolumn
          eller momsrad alls, i stället för en rad nollor. */}
      {isSimple && <div style={{ marginBottom: 2 }}>{sectionLabel('Specifikation')}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: isGrid ? 0 : 14 }}>
        <thead>
          <tr>
            {(noVat ? ['Beskrivning', 'Antal', 'À-pris', 'Belopp'] : ['Beskrivning', 'Antal', 'À-pris', 'Moms', 'Belopp']).map((h, i) => (
              <th key={h} style={headCell(i)}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr><td colSpan={noVat ? 4 : 5} style={{ ...cell(false), textAlign: 'center', color: '#9ca3af' }}>Inga rader tillagda än</td></tr>
          ) : visibleRows.map((r, i) => {
            const net = r.qty * r.unitPrice * (1 - (r.discount || 0) / 100);
            // Avdragsmärkning trycks som en liten tagg efter beskrivningen.
            // Själva skattereduktionen räknas inte här, bara markeringen av
            // vilka rader som avser ROT/RUT/Grönt.
            const deductionLabel = { rot: 'ROT', rut: 'RUT', green: 'Grönt avdrag' }[r.deduction];
            return (
              // Radobjekten har aldrig haft ett `id`-fält, så indexet är
              // reserven. Raderna sorteras inte om här, så det är stabilt.
              <tr key={r.id ?? i}>
                <td style={cell(false, i)}>
                  {r.description || <span style={{ color: '#b91c1c' }}>Beskrivning saknas</span>}
                  {deductionLabel && <span style={{ color: MUTED, fontStyle: 'italic' }}> · {deductionLabel}</span>}
                </td>
                <td style={cell(true, i)}>{r.qty}{r.unit && r.unit !== 'st' ? ` ${r.unit}` : ''}</td>
                <td style={cell(true, i)}>{fmt(r.unitPrice)}</td>
                {!noVat && <td style={cell(true, i)}>{r.vatRate}%</td>}
                <td style={cell(true, i)}>{fmt(net)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalsBlock}

      {invoiceText && <div style={{ fontSize: body, color: '#374151', marginBottom: 18 }}>{invoiceText}</div>}

      {paymentBlock}

      {(isClassic || isBold || isGrid) && docType !== 'quote' && (
        <div style={{ fontSize: small, color: '#374151', marginBottom: 18 }}>{termsLabel}</div>
      )}

      {/* Offerten: villkoren är informativa om vad som skulle gälla vid en
          accept, inte en uppmaning att betala nu. Övriga villkor är en lista
          och får spänna över hela bredden. */}
      {quoteTerms.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: small, color: '#374151', marginBottom: 18 }}>
          {quoteTerms.map(([l, v]) => (
            <div key={l} style={l === 'Övriga villkor' ? { gridColumn: '1 / -1' } : undefined}>
              <strong style={{ display: 'block', color: INK }}>{l}</strong>{v}
            </div>
          ))}
        </div>
      )}

      {/* Avslutande hälsning: vanlig affärssed på en offert, till skillnad
          från en faktura, som inte behöver en artighetsfras. */}
      {docType === 'quote' && (
        <div style={{ marginBottom: 18, fontSize: body, color: '#374151', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 10px' }}>Vi ser fram emot ert svar och hoppas få samarbeta med er.</p>
          <p style={{ margin: 0 }}>Med vänliga hälsningar<br />{sellerName}</p>
        </div>
      )}

      {isBusiness && (
        <div style={{ marginTop: 'auto', fontSize: body }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${businessStrip.length}, auto) 1fr`, gap: 28, alignItems: 'end', padding: '9px 0', borderTop: '1px solid #9ca3af', borderBottom: '1px solid #9ca3af' }}>
            {businessStrip.map(([l, v]) => (
              <div key={l}>
                <div style={{ color: MUTED, marginBottom: 3 }}>{l}</div>
                <div>{v}</div>
              </div>
            ))}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 2 }}>{totalLabel}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: textAccent }}>{currency} {fmt(payable)}</div>
            </div>
          </div>
          {vatByRate.length > 0 && (
            <div style={{ padding: '6px 0 10px', fontSize: small, color: '#374151' }}>
              {vatByRate.map(([rate, net]) => <div key={rate}>Moms {rate} %: {fmt(net * Number(rate) / 100)} ({fmt(net)})</div>)}
            </div>
          )}
        </div>
      )}

      {footerBlock}

      {footerText && <div style={{ marginTop: 10, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>{footerText}</div>}
    </>
  );

  // Modern går ända ut till pappersbrytningen och sköter sina egna marginaler.
  const paperStyle = {
    color: INK,
    ...(isBold ? { padding: 0, borderRadius: 0 } : {}),
    ...(isMinimal ? { fontFamily: 'Cambria, "Times New Roman", Times, serif' } : {}),
  };

  return (
    <div ref={ref} className="a4-paper" style={paperStyle}>

      {/* ── Mottagaren står till höger i Standard, där fönsterkuvertet sitter. ── */}
      {isClassic && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 26 }}>
            {brand()}
            {title(24)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, marginBottom: 26 }}>
            {metaBlock}
            <div style={{ width: '46%', flexShrink: 0 }}>{customerBlock}</div>
          </div>
          {content}
        </>
      )}

      {isBusiness && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 46%', gap: 24, marginBottom: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
              {brand()}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 16px', fontSize: body, alignContent: 'start' }}>
                {[
                  ...(customer?.customerNumber ? [['Kundnr', customer.customerNumber]] : []),
                  ...(customer?.contactPerson ? [['Er referens', customer.contactPerson]] : []),
                  ...(docType !== 'quote' ? [['Betalningsvillkor', invoice?.terms || '30 dagar netto']] : []),
                ].map(([l, v]) => (
                  <React.Fragment key={l}>
                    <span style={{ color: MUTED }}>{l}</span>
                    <span>{v}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div>
              <h1 style={{ margin: '0 0 12px', fontSize: 25, fontWeight: 700, letterSpacing: '0.01em', color: INK }}>{docLabel}</h1>
              <div style={{ marginBottom: 20 }}>{metaBlock}</div>
              {customerBlock}
            </div>
          </div>
          {content}
        </>
      )}

      {/* Modern: färgband över hela arkets topp och beloppet stort under. */}
      {isBold && (
        <>
          <div style={{ padding: '12mm 18mm 9mm', background: accent, color: onAccent }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, marginBottom: 20 }}>
              <h1 style={{ margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: '0.01em', color: onAccent }}>{docLabel}</h1>
              {brand(onAccent, true)}
            </div>
            <div style={{ display: 'flex', gap: 36, fontSize: body }}>
              {meta.map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: small - 1, marginBottom: 2 }}>{l}</div>
                  <div style={{ fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '22px 18mm 18mm' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start', marginBottom: 24 }}>
              {customerBlock}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: small, color: MUTED, marginBottom: 2 }}>{totalLabel}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: textAccent }}>{amountDue}</div>
              </div>
            </div>
            {content}
          </div>
        </>
      )}

      {/* Ren: serif, centrerat och inga rutor. */}
      {isMinimal && (
        <>
          <div style={{ textAlign: 'center', paddingBottom: 18, marginBottom: 26, borderBottom: `1px solid ${INK}` }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>{brand()}</div>
            <h1 style={{ margin: 0, fontSize: 13, fontWeight: 400, letterSpacing: '0.34em', color: textAccent }}>{docLabel}</h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, marginBottom: 30 }}>
            <div style={{ width: '50%' }}>{customerBlock}</div>
            {metaBlock}
          </div>
          {content}
        </>
      )}

      {/* Blankett: varje uppgift i en egen ruta, ända ned till sidfoten. */}
      {isGrid && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', border: gridBorder, marginBottom: -1 }}>
            <div style={{ padding: '10px 12px' }}>{brand()}</div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 18px', background: accent }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '0.08em', color: onAccent }}>{docLabel}</h1>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 38%', border: gridBorder, marginBottom: 18 }}>
            <div style={{ padding: '10px 12px' }}>{customerBlock}</div>
            <div style={{ borderLeft: gridBorder }}>
              {meta.map(([l, v], i) => (
                <div key={l} style={{ padding: '6px 10px', borderTop: i ? gridBorder : 'none' }}>
                  <div style={{ fontSize: small - 1.5, color: MUTED }}>{l}</div>
                  <div style={{ fontSize: body, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {content}
        </>
      )}

      {/* Enkel: stor rubrik till höger och kunden i en grå ruta. */}
      {isSimple && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 34 }}>
            {brand()}
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 700, letterSpacing: '0.01em', color: INK }}>{docLabel}</h1>
              <div style={{ fontSize: body, color: MUTED }}>{meta[0][0]} {meta[0][1]}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 30 }}>
            <div>
              {sectionLabel(docType === 'quote' ? 'Offertinformation' : 'Fakturainformation')}
              {meta.slice(1).map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '2px 0', fontSize: body }}>
                  <span style={{ color: MUTED }}>{l}</span>
                  <span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            <div>
              {sectionLabel(customerLabel)}
              <div style={{ padding: '12px 16px', background: '#f3f4f6', borderRadius: 8 }}>{customerDetails}</div>
            </div>
          </div>
          {content}
        </>
      )}
    </div>
  );
});

export default InvoiceDocument;
