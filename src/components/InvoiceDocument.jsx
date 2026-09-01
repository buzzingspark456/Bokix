import React, { forwardRef } from 'react';

const fmt = (val) =>
  new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

// ── Fakturamallar (Sida 24) ──────────────────────────────────────────────
// Fyra fördefinierade utseenden. `defaultAccent` används bara om företaget
// inte själv valt en accentfärg — headerns/tabellens färg på en kunds egen
// faktura är kundens varumärke, inte Bokix grönt (det är en medveten
// avvikelse från "Bokix ska alltid vara grönt", se Sida 24).
// Mörkare, mättade juveltoner istället för de tidigare ganska tunna/kalla
// standardfärgerna (blek blå, stopljusröd, orange) — fyra distinkta,
// mörkare och gladare nyanser som fortfarande går att skilja åt parvis.
export const INVOICE_TEMPLATES = {
  classic: { id: 'classic', label: 'Klassisk', description: 'Vit bakgrund, djupblå rubrik, rund logotyp uppe till höger.', defaultAccent: '#3730a3' },
  bold:    { id: 'bold',    label: 'Kraftfull', description: 'Helfärgad header i din accentfärg, vitt i övrigt.', defaultAccent: '#9d174d' },
  minimal: { id: 'minimal', label: 'Minimal',   description: 'Vänsterställd rubrik, ingen färgad header-yta.', defaultAccent: '#0f766e' },
  grid:    { id: 'grid',    label: 'Rutnät',    description: 'Konturerad tabellstruktur, traditionellt formulär.', defaultAccent: '#b45309' },
};
export const DEFAULT_INVOICE_TEMPLATE = 'bold';

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
    docType = 'invoice', logoUrl, footerText, template = DEFAULT_INVOICE_TEMPLATE, accentColor,
  },
  ref
) {
  const tpl = INVOICE_TEMPLATES[template] || INVOICE_TEMPLATES[DEFAULT_INVOICE_TEMPLATE];
  const accent = accentColor || tpl.defaultAccent;
  const visibleRows = rows.filter(r => r.description);
  const isGrid = template === 'grid';
  const isBold = template === 'bold';
  const isClassic = template === 'classic';
  const isMinimal = template === 'minimal';

  const cellBorder = isGrid ? { border: '1px solid #18181b' } : undefined;
  const tableHeaderStyle = isMinimal
    ? { background: 'white', color: '#111', borderBottom: `2px solid ${accent}` }
    : { background: accent, color: 'white', ...(isGrid ? cellBorder : undefined) };

  // En offert har varken OCR (kopplat till en verklig betalning) eller ett
  // "förfallodatum" — den är giltig till ett visst datum, inte förfallen.
  // Att visa fakturaspecifika fält på en offert vore att fejka en detalj som
  // inte finns, så mallens metafält skiljer sig per docType istället för att
  // återanvända fakturans ordval rakt av.
  // "Att betala" antar att beloppet faktiskt förfaller till betalning —
  // sant för en faktura, men en offert är bara ett prisförslag ännu.
  const totalLabel = docType === 'quote' ? 'Offertbelopp' : 'Att betala';
  const customerLabel = docType === 'quote' ? 'Offereras till' : 'Faktureras till';

  // Fotern på en faktura är en betalningsuppmaning (bankgiro/IBAN) — visad
  // rakt av på en offert ser den ut som ett krav på pengar för något som
  // inte ens är sålt än, så kontonummer hör INTE hemma här. Leverans- och
  // betalningsvillkor är däremot juridiskt förväntat innehåll i en offert
  // (Konsumentverket/gängse affärssed: specifikation, pris, rabatt, moms,
  // leveranstid samt leverans- och betalningsvillkor) — men rent
  // INFORMATIVA villkor om vad som SKULLE gälla vid en accept, inte en
  // uppmaning att betala nu. "Giltig till" står redan i metadatan ovanför
  // (se `meta`), upprepas inte här.
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
        <div>{formatDate(invoice?.workStartDate)} – {invoice?.workEndDate ? formatDate(invoice.workEndDate) : '—'}</div>
      )}
      {invoice?.workLocation && <div>{invoice.workLocation}</div>}
      {invoice?.deliveryDescription && <div>{invoice.deliveryDescription}</div>}
    </>
  ) : (invoice?.deliveryTerms || null);

  const footerItems = docType === 'quote'
    ? [
        ...(workDetailsValue ? [['Leveransvillkor', workDetailsValue]] : []),
        ['Betalningsvillkor', invoice?.terms || '30 dagar netto'],
        ['Dröjsmålsränta', invoice?.lateInterest || '10% enligt räntelagen'],
        ['Kontakt', company?.email || company?.phone || '—'],
        ...(invoice?.notIncluded ? [['Ingår ej', invoice.notIncluded]] : []),
        ...(otherTermsList ? [['Övriga villkor', otherTermsList]] : []),
        ['OBS', 'Detta är ett prisförslag, inte en faktura eller betalningsuppmaning.'],
      ]
    : [
        ['Bankgiro', company?.bankgiro || '—'],
        ['IBAN', company?.iban || '—'],
        ['Betalningsvillkor', invoice?.terms || '30 dagar netto'],
        ['Kontakt', company?.email || company?.phone || '—'],
      ];

  const meta = docType === 'quote'
    ? [
        ['Offertnr', invoice?.invoiceNumber || '—'],
        ['Offertdatum', formatDate(invoice?.date)],
        ['Giltig till', formatDate(invoice?.dueDate)],
      ]
    : [
        ['Fakturanr', invoice?.invoiceNumber || '—'],
        ['OCR', invoice?.invoiceNumber ? String(invoice.invoiceNumber).padStart(7, '0') : '—'],
        ['Fakturadatum', formatDate(invoice?.date)],
        ['Förfallodatum', formatDate(invoice?.dueDate)],
      ];

  return (
    <div ref={ref} className="a4-paper" style={isGrid ? { border: '2px solid #18181b' } : undefined}>

      {/* ── Header — utseendet skiljer sig helt mellan mallarna ── */}
      {isBold && (
        <div className="a4-header-stripe" style={{ background: accent }}>
          <div className="a4-company-on-stripe">
            {logoUrl ? <img src={logoUrl} alt={(company?.invoiceDisplayName || company?.name) || 'Logotyp'} style={{ maxHeight: 40, maxWidth: 160, marginBottom: 10, display: 'block' }} /> : null}
            <div className="a4-company-name">{(company?.invoiceDisplayName || company?.name) || 'Ditt företag'}</div>
            <div className="a4-company-detail">
              {company?.address || 'Adress saknas'}<br />
              {company?.orgNr ? `Org.nr ${company.orgNr}` : ''}{company?.vatNr ? ` · VAT ${company.vatNr}` : ''}<br />
              {company?.fSkatt || 'Innehar F-skattsedel'}
            </div>
          </div>
          <div className="a4-doc-type-badge">
            <h1>{docLabel}</h1>
            <div className="a4-meta-grid">
              {meta.map(([l, v]) => (
                <React.Fragment key={l}><span className="a4-meta-label">{l}</span><span className="a4-meta-value">{v}</span></React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {isClassic && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 6 }}>{(company?.invoiceDisplayName || company?.name) || 'Ditt företag'}</div>
            <div style={{ fontSize: 11.5, color: '#52525b', lineHeight: 1.7 }}>
              {company?.address || 'Adress saknas'}<br />
              {company?.orgNr ? `Org.nr ${company.orgNr}` : ''}{company?.vatNr ? ` · VAT ${company.vatNr}` : ''}<br />
              {company?.fSkatt || 'Innehar F-skattsedel'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', border: `1.5px solid ${accent}`, marginLeft: 'auto', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8fafc',
            }}>
              {logoUrl ? <img src={logoUrl} alt={(company?.invoiceDisplayName || company?.name) || 'Logotyp'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 20, fontWeight: 700, color: accent }}>{((company?.invoiceDisplayName || company?.name) || '?')[0]}</span>}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.06em', color: accent, margin: '0 0 10px' }}>{docLabel}</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 14px', textAlign: 'right' }}>
              {meta.map(([l, v]) => (
                <React.Fragment key={l}>
                  <span style={{ color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</span>
                  <span style={{ color: '#111', fontWeight: 600, fontSize: 12 }}>{v}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {isMinimal && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 38, fontWeight: 800, color: accent, margin: '0 0 14px', letterSpacing: '-0.02em' }}>{docLabel}</h1>
            {logoUrl && <img src={logoUrl} alt={(company?.invoiceDisplayName || company?.name) || 'Logotyp'} style={{ maxHeight: 32, maxWidth: 140, marginBottom: 10, display: 'block' }} />}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>{(company?.invoiceDisplayName || company?.name) || 'Ditt företag'}</div>
            <div style={{ fontSize: 11.5, color: '#52525b', lineHeight: 1.7 }}>
              {company?.address || 'Adress saknas'}<br />
              {company?.orgNr ? `Org.nr ${company.orgNr}` : ''}{company?.vatNr ? ` · VAT ${company.vatNr}` : ''}
            </div>
          </div>
          <div style={{ border: '1.5px dashed #cbd5e1', borderRadius: 10, padding: '14px 20px', minWidth: 190, flexShrink: 0 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>{totalLabel}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: accent, marginBottom: 12 }}>{fmt(totals?.total)} {currency}</div>
            {[['Förfallodatum', formatDate(invoice?.dueDate)], ['Referensnr', invoice?.invoiceNumber || '—']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#52525b', marginBottom: 2 }}>
                <span>{l}</span><span style={{ fontWeight: 600, color: '#111' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isGrid && (
        <div style={{ border: '1.5px solid #18181b', padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {logoUrl ? <img src={logoUrl} alt={(company?.invoiceDisplayName || company?.name) || 'Logotyp'} style={{ maxHeight: 34, maxWidth: 150, marginBottom: 8, display: 'block' }} /> : null}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>{(company?.invoiceDisplayName || company?.name) || 'Ditt företag'}</div>
            <div style={{ fontSize: 11, color: '#3f3f46', lineHeight: 1.6 }}>
              {company?.address || 'Adress saknas'}<br />
              {company?.orgNr ? `Org.nr ${company.orgNr}` : ''}{company?.vatNr ? ` · VAT ${company.vatNr}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: accent, color: 'white', fontWeight: 800, fontSize: 20, letterSpacing: '0.08em', padding: '5px 14px', marginBottom: 10 }}>{docLabel}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 14px', textAlign: 'right' }}>
              {meta.map(([l, v]) => (
                <React.Fragment key={l}>
                  <span style={{ color: '#71717a', fontSize: 10, textTransform: 'uppercase' }}>{l}</span>
                  <span style={{ color: '#18181b', fontWeight: 700, fontSize: 12 }}>{v}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Org.nr och kontaktperson visas bara när kundkortet faktiskt har dem
          ifyllda — inget nytt tvingande fält, bara mer av det som redan
          finns sparat på kunden (se Contacts.jsx: orgNr är bara obligatoriskt
          där för företagskunder, aldrig privatpersoner). "Att: NN" är
          branschbruk för att rikta dokumentet till rätt person hos kunden. */}
      <div className="a4-customer-block" style={isGrid ? { border: '1.5px solid #18181b', borderRadius: 0, background: 'white' } : undefined}>
        <div className="a4-customer-label" style={!isGrid ? { color: accent } : undefined}>{customerLabel}</div>
        <div className="a4-customer-name">{customer?.name || 'Kund saknas'}</div>
        <div className="a4-customer-detail">
          {customer?.contactPerson ? <>Att: {customer.contactPerson}<br /></> : null}
          {customer?.address || ''}{customer?.address ? <br /> : null}
          {customer?.orgNr ? <>Org.nr {customer.orgNr}<br /></> : null}
          {customer?.email || ''}
        </div>
      </div>

      {invoiceText && (
        <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 20 }}>{invoiceText}</div>
      )}

      <table className="a4-table" style={isGrid ? { borderCollapse: 'collapse', ...cellBorder } : undefined}>
        <thead>
          <tr>
            {['Beskrivning', 'Antal', 'À-pris', 'Moms', 'Belopp'].map((h, i) => (
              <th key={h} style={{ textAlign: i > 0 ? 'right' : 'left', ...tableHeaderStyle }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: '16px 12px', color: '#9ca3af', textAlign: 'center', ...cellBorder }}>Inga rader tillagda än</td></tr>
          ) : visibleRows.map((r, i) => {
            const net = r.qty * r.unitPrice * (1 - (r.discount || 0) / 100);
            // Avdragsmärkning (Sida 40) trycks som en liten tagg efter
            // beskrivningen — inga nya kolumner i mallarna, och den faktiska
            // skattereduktionsberäkningen (50%-tak, arbets-/materialdelning,
            // personnummer m.m.) görs INTE här, bara markeringen av vilka
            // rader som avser ROT/RUT/Grönt.
            const deductionLabel = { rot: 'ROT', rut: 'RUT', green: 'Grönt avdrag' }[r.deduction];
            return (
              // Bugkritiskt (upptäckt vid Sida 40-verifiering): rad-objekten
              // från Invoices.jsx/Quotes.jsx har aldrig haft ett `id`-fält,
              // så `key={r.id}` var alltid `key={undefined}` för varje rad
              // (React-varning, riskerar felaktig återanvändning av rader vid
              // omordning). `r.id ?? i` faller tillbaka på indexet — rader
              // varken sorteras om eller filtreras här, så index är stabilt.
              <tr key={r.id ?? i}>
                <td style={cellBorder}>
                  {r.description}
                  {deductionLabel && <span style={{ color: '#6b7280', fontStyle: 'italic' }}> · {deductionLabel}</span>}
                </td>
                <td style={{ textAlign: 'right', ...cellBorder }}>{r.qty}{r.unit && r.unit !== 'st' ? ` ${r.unit}` : ''}</td>
                <td style={{ textAlign: 'right', ...cellBorder }}>{fmt(r.unitPrice)}</td>
                <td style={{ textAlign: 'right', ...cellBorder }}>{r.vatRate}%</td>
                <td style={{ textAlign: 'right', ...cellBorder }}>{fmt(net)} {currency}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="a4-totals-container">
        <div className="a4-totals" style={isGrid ? { border: '1.5px solid #18181b', borderRadius: 0, background: 'white' } : undefined}>
          <div className="a4-total-row"><span>Netto</span><span>{fmt(totals?.net)} {currency}</span></div>
          <div className="a4-total-row"><span>Moms</span><span>{fmt(totals?.vat)} {currency}</span></div>
          <div className="a4-grand-total" style={{ borderTop: `2px solid ${accent}` }}>
            <span>{totalLabel}</span><span style={{ color: accent }}>{fmt(totals?.total)} {currency}</span>
          </div>
        </div>
      </div>

      {/* Bugkritiskt: strecket ovanför Bankgiro/IBAN/Betalningsvillkor/Kontakt
          följde bara accentfärgen för 'grid'-mallen — övriga tre mallar föll
          tyst tillbaka på CSS:ens hårdkodade --lime-200 (Bokix grönt), trots
          att raden precis ovanför (a4-grand-total) redan följer accenten. Att
          byta accentfärg i förhandsgranskningen ändrade då totalsumme-linjen
          men inte fotlinjen — två syskonlinjer på samma sida som oväntat
          betedde sig olika. Samma `accent`-variabel överallt nu. */}
      {/* Avslutande hälsningsstycke — bara på offerter, direkt ovanför
          fotraden. Vanlig affärssed på en offert (till skillnad från en
          faktura, som inte behöver en artighetsfras för att kräva betalt). */}
      {docType === 'quote' && (
        <div style={{ margin: '24px 0 8px', fontSize: 11.5, color: '#3f3f46', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 12px' }}>Vi ser fram emot ert svar och hoppas få samarbeta med er.</p>
          <p style={{ margin: 0 }}>
            Med vänliga hälsningar<br />
            {(company?.invoiceDisplayName || company?.name) || 'Ditt företag'}<br />
            {company?.phone || ''}<br />
            {company?.email || ''}
          </p>
        </div>
      )}

      <div className="a4-footer" style={{ borderTopColor: accent }}>
        {footerItems.map(([l, v]) => (
          // OBS-raden (och Övriga villkor-listan) på offerter är hel text/en
          // lista, inte ett kort värde som "Bankgiro"/"IBAN" — pressad in i
          // en fjärdedels kolumnbredd blir det nästan oläsligt, så de får
          // spänna över hela radens bredd.
          <div key={l} className="a4-footer-item" style={(l === 'OBS' || l === 'Övriga villkor') ? { gridColumn: '1 / -1' } : undefined}>
            <strong>{l}</strong>{v}
          </div>
        ))}
      </div>
      {/* Normalt flöde, inte position:absolute mot sidbotten — samma skäl
          som .a4-footer i index.css (en botten-ankrad text hade landat
          ovanpå/tätt inpå fakturaraderna ovan nu när .a4-paper inte
          längre tvingas till en full 297mm-höjd oavsett innehåll). */}
      {footerText && (
        <div style={{ marginTop: '12px', fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>{footerText}</div>
      )}
    </div>
  );
});

export default InvoiceDocument;
