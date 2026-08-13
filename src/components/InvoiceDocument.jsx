import React, { forwardRef } from 'react';

const fmt = (val) =>
  new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};

/**
 * The ONE invoice document renderer. Used both for the on-screen live
 * preview (in InvoiceForm and in Inställningar's template editor) and as
 * the literal DOM node captured for PDF export — so the two can never
 * drift apart. Any visual change belongs here, nowhere else.
 */
const InvoiceDocument = forwardRef(function InvoiceDocument(
  { invoice, customer, company, rows = [], totals, currency = 'SEK', invoiceText, docLabel = 'FAKTURA', themeGradient, logoUrl, footerText },
  ref
) {
  const stripeStyle = themeGradient ? { background: themeGradient } : undefined;
  const visibleRows = rows.filter(r => r.description);

  return (
    <div ref={ref} className="a4-paper">
      <div className="a4-header-stripe" style={stripeStyle}>
        <div className="a4-company-on-stripe">
          {logoUrl ? (
            <img src={logoUrl} alt={company?.name || 'Logotyp'} style={{ maxHeight: 40, maxWidth: 160, marginBottom: 10, display: 'block' }} />
          ) : null}
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
            {[
              ['Fakturanr', invoice?.invoiceNumber || '—'],
              ['OCR', invoice?.invoiceNumber ? String(invoice.invoiceNumber).padStart(7, '0') : '—'],
              ['Fakturadatum', formatDate(invoice?.date)],
              ['Förfallodatum', formatDate(invoice?.dueDate)],
            ].map(([l, v]) => (
              <React.Fragment key={l}>
                <span className="a4-meta-label">{l}</span>
                <span className="a4-meta-value">{v}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="a4-customer-block">
        <div className="a4-customer-label">Faktureras till</div>
        <div className="a4-customer-name">{customer?.name || 'Kund saknas'}</div>
        <div className="a4-customer-detail">
          {customer?.address || ''}{customer?.address ? <br /> : null}
          {customer?.email || ''}
        </div>
      </div>

      {invoiceText && (
        <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 20 }}>{invoiceText}</div>
      )}

      <table className="a4-table">
        <thead>
          <tr>
            {['Beskrivning', 'Antal', 'À-pris', 'Moms', 'Belopp'].map((h, i) => (
              <th key={h} style={{ textAlign: i > 0 ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: '16px 12px', color: '#9ca3af', textAlign: 'center' }}>Inga rader tillagda än</td></tr>
          ) : visibleRows.map((r) => {
            const net = r.qty * r.unitPrice * (1 - (r.discount || 0) / 100);
            return (
              <tr key={r.id}>
                <td>{r.description}</td>
                <td style={{ textAlign: 'right' }}>{r.qty}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.unitPrice)}</td>
                <td style={{ textAlign: 'right' }}>{r.vatRate}%</td>
                <td style={{ textAlign: 'right' }}>{fmt(net)} kr</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="a4-totals-container">
        <div className="a4-totals">
          <div className="a4-total-row"><span>Netto</span><span>{fmt(totals?.net)} kr</span></div>
          <div className="a4-total-row"><span>Moms</span><span>{fmt(totals?.vat)} kr</span></div>
          <div className="a4-grand-total"><span>Att betala</span><span>{fmt(totals?.total)} {currency}</span></div>
        </div>
      </div>

      <div className="a4-footer">
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
