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
            {logoUrl ? <img src={logoUrl} alt={company?.name || 'Logotyp'} style={{ maxHeight: 40, maxWidth: 160, marginBottom: 10, display: 'block' }} /> : null}
            <div className="a4-company-name">{company?.name || 'Ditt företag'}</div>
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
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 6 }}>{company?.name || 'Ditt företag'}</div>
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
              {logoUrl ? <img src={logoUrl} alt={company?.name || 'Logotyp'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 20, fontWeight: 700, color: accent }}>{(company?.name || '?')[0]}</span>}
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
            {logoUrl && <img src={logoUrl} alt={company?.name || 'Logotyp'} style={{ maxHeight: 32, maxWidth: 140, marginBottom: 10, display: 'block' }} />}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>{company?.name || 'Ditt företag'}</div>
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
            {logoUrl ? <img src={logoUrl} alt={company?.name || 'Logotyp'} style={{ maxHeight: 34, maxWidth: 150, marginBottom: 8, display: 'block' }} /> : null}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>{company?.name || 'Ditt företag'}</div>
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

      <div className="a4-customer-block" style={isGrid ? { border: '1.5px solid #18181b', borderRadius: 0, background: 'white' } : undefined}>
        <div className="a4-customer-label" style={!isGrid ? { color: accent } : undefined}>Faktureras till</div>
        <div className="a4-customer-name">{customer?.name || 'Kund saknas'}</div>
        <div className="a4-customer-detail">
          {customer?.address || ''}{customer?.address ? <br /> : null}
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
          ) : visibleRows.map((r) => {
            const net = r.qty * r.unitPrice * (1 - (r.discount || 0) / 100);
            return (
              <tr key={r.id}>
                <td style={cellBorder}>{r.description}</td>
                <td style={{ textAlign: 'right', ...cellBorder }}>{r.qty}</td>
                <td style={{ textAlign: 'right', ...cellBorder }}>{fmt(r.unitPrice)}</td>
                <td style={{ textAlign: 'right', ...cellBorder }}>{r.vatRate}%</td>
                <td style={{ textAlign: 'right', ...cellBorder }}>{fmt(net)} kr</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="a4-totals-container">
        <div className="a4-totals" style={isGrid ? { border: '1.5px solid #18181b', borderRadius: 0, background: 'white' } : undefined}>
          <div className="a4-total-row"><span>Netto</span><span>{fmt(totals?.net)} kr</span></div>
          <div className="a4-total-row"><span>Moms</span><span>{fmt(totals?.vat)} kr</span></div>
          <div className="a4-grand-total" style={{ borderTop: `2px solid ${accent}` }}>
            <span>{totalLabel}</span><span style={{ color: accent }}>{fmt(totals?.total)} {currency}</span>
          </div>
        </div>
      </div>

      <div className="a4-footer" style={isGrid ? { borderTop: `2px solid ${accent}` } : undefined}>
        {[
          ['Bankgiro', company?.bankgiro || '—'],
          ['IBAN', company?.iban || '—'],
          ['Betalningsvillkor', invoice?.terms || '30 dagar netto'],
          ['Kontakt', company?.email || company?.phone || '—'],
        ].map(([l, v]) => (
          <div key={l} className="a4-footer-item"><strong>{l}</strong>{v}</div>
        ))}
      </div>
      {footerText && (
        <div style={{ position: 'absolute', bottom: '4mm', left: '18mm', right: '18mm', fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>{footerText}</div>
      )}
    </div>
  );
});

export default InvoiceDocument;
