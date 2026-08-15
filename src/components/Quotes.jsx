import React, { useState, useRef } from 'react';
import { FileSpreadsheet, Plus, Search, FileText, Check, X, Download, Trash2, Send } from 'lucide-react';
import InvoiceDocument, { DEFAULT_INVOICE_TEMPLATE } from './InvoiceDocument';
import { exportInvoicePdf, getInvoicePdfBase64 } from '../utils/exportInvoicePdf';
import { sendInvoiceEmail } from '../emailApi';
import { getNextInvoiceNumber } from '../utils/invoiceNumbering';

const fmtSEK = (val) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);
const fmtDateSv = (d) => { if (!d) return '—'; try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; } };

const emptyRow = () => ({ description: '', price: '', qty: 1, vat: 25 });

const emptyForm = () => ({
  customer: '',
  customerId: '',
  date: new Date().toISOString().split('T')[0],
  dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(),
  rows: [emptyRow()],
});

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

export default function Quotes({ invoices = [], setInvoices, contacts = [], company, globalAction, clearGlobalAction, handleGlobalAction }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = ny offert, annars id på offerten som redigeras
  const [form, setForm] = useState(emptyForm());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  // Förifylld från kundkortet om det finns en sparad adress, men alltid
  // redigerbar — precis som i Invoices.jsx, se kommentaren där.
  const [emailToInput, setEmailToInput] = useState('');
  const previewRef = useRef(null);
  // Egen, alltid monterad kopia utan skalningstransform, gömd off-screen
  // med fast bredd — se motsvarande kommentar i Invoices.jsx. Den synliga
  // förhandsgranskningen här har en `transform: scale(0.88)` på en
  // förälder, vilket html2canvas kan hantera fel (kända buggar med
  // skalade förfäder), plus att modalens faktiska bredd kan skilja sig
  // från .a4-paper:s tänkta 210mm. Fångar alltid DENNA istället.
  const captureRef = useRef(null);

  React.useEffect(() => {
    if (globalAction?.type === 'new_quote') {
      openNew();
      clearGlobalAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalAction, clearGlobalAction]);

  // All quotes = invoices with type 'quote'
  const quotes = (invoices || []).filter(i => i.type === 'quote');

  const filtered = quotes.filter(q => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const customerName = contacts.find(c => c.id === q.customerId)?.name || q.customerName || '';
    return customerName.toLowerCase().includes(s) || (q.invoiceNumber || '').toLowerCase().includes(s);
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'accepted': return { bg: '#dcfce7', color: '#166534', label: 'Accepterad' };
      case 'sent': return { bg: '#eff6ff', color: '#1d4ed8', label: 'Skickad' };
      case 'rejected': return { bg: '#fee2e2', color: '#991b1b', label: 'Avvisad' };
      case 'expired': return { bg: '#fef3c7', color: '#92400e', label: 'Förfallen' };
      default: return { bg: '#f3f4f6', color: '#4b5563', label: 'Utkast' };
    }
  };

  const handleDelete = (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Vill du ta bort denna offert?')) return;
    if (setInvoices) setInvoices(prev => prev.filter(i => i.id !== id));
  };

  // Bugkritiskt: en konverterad offert behöll tidigare sitt offertnummer
  // ("OFF-1042") som fakturanummer — det är inte en siffra, så OCR-fältet
  // på den "fakturan" blev trasigt och den låg utanför den riktiga
  // fakturaserien. En konvertering ska ge ett RIKTIGT nästa fakturanummer
  // ur samma serie som Invoices.jsx använder, med dagens datum som
  // fakturadatum (offerten kan ha legat veckor innan den accepterades).
  const handleConvert = (quote, e) => {
    e?.stopPropagation();
    if (!window.confirm('Konvertera denna offert till en faktura?')) return;
    if (!setInvoices) return;
    const invoiceNumber = getNextInvoiceNumber(invoices, company);
    const today = new Date().toISOString().split('T')[0];
    const dueDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + (Number(company?.paymentTermsDays) || 30));
      return d.toISOString().split('T')[0];
    })();
    setInvoices(prev => prev.map(i =>
      i.id === quote.id
        ? {
            ...i,
            type: 'invoice', status: 'draft',
            invoiceNumber, date: today, dueDate,
            rows: (i.rows || []).map(r => ({ discount: 0, account: '3001', ...r })),
          }
        : i
    ));
    // Om konverteringen triggades inifrån redigeringsmodalen: den offerten
    // finns inte kvar i offert-listan efter konverteringen (type blev
    // 'invoice'), så modalen måste stängas — annars står den kvar och
    // pekar på ett id som inte längre matchar någon offert.
    setIsModalOpen(false);
    setEditingId(null);
    if (handleGlobalAction) handleGlobalAction(null, 'invoices');
  };

  // Statusflödet saknade tidigare varje väg framåt förutom "draft" — det
  // gick aldrig att markera en offert som skickad/accepterad/avvisad någon
  // stans i UI:t, trots att hela statusmodellen (badges, konvertera-villkor)
  // redan förutsatte att det gick. Utan detta var "Skickad"/"Accepterad"/
  // "Avvisad" dött tillstånd som aldrig gick att nå.
  const setQuoteStatus = (id, status) => {
    if (!setInvoices) return;
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setPdfError('');
    setIsModalOpen(true);
  };

  const openEdit = (quote) => {
    setForm({
      customer: quote.customerName || '',
      customerId: quote.customerId || '',
      date: quote.date || new Date().toISOString().split('T')[0],
      dueDate: quote.dueDate || '',
      rows: (quote.rows && quote.rows.length > 0)
        ? quote.rows.map(r => ({ description: r.description || '', price: r.unitPrice ?? '', qty: r.qty ?? 1, vat: r.vatRate ?? 25 }))
        : [emptyRow()],
    });
    setEditingId(quote.id);
    setPdfError('');
    setIsModalOpen(true);
  };

  const handleAddRow = () => setForm(f => ({ ...f, rows: [...f.rows, emptyRow()] }));
  const handleRemoveRow = (i) => setForm(f => ({ ...f, rows: f.rows.filter((_, idx) => idx !== i) }));

  // Mallval/accentfärg/logotyp/fottext fryses vid offertens FÖRSTA sparning —
  // exakt samma regel som för fakturor (se Invoices.jsx) — annars skulle ett
  // senare mallbyte i Inställningar retroaktivt ändra en offert kunden redan
  // fått i sin inkorg.
  const editingQuote = editingId ? quotes.find(q => q.id === editingId) : null;
  const templateSnapshot = editingQuote?.invoiceTemplateSnapshot || {
    templateId: company?.invoiceTemplateId || DEFAULT_INVOICE_TEMPLATE,
    accentColor: company?.invoiceAccentColor || '',
    logoUrl: company?.logoUrl || '',
    footerText: company?.invoiceFooterText || '',
  };

  const previewNumber = editingQuote?.invoiceNumber || getNextQuoteNumber(quotes);
  const previewRows = form.rows.map(r => ({
    description: r.description, qty: Number(r.qty) || 1, unitPrice: Number(r.price) || 0, vatRate: Number(r.vat) || 25,
  }));
  const previewCustomer = contacts.find(c => c.id === form.customerId) || { name: form.customer };
  const previewTotals = previewRows.reduce((acc, r) => {
    const net = r.qty * r.unitPrice;
    return { net: acc.net + net, vat: acc.vat + net * (r.vatRate / 100), total: acc.total + net * (1 + r.vatRate / 100) };
  }, { net: 0, vat: 0, total: 0 });

  // Fyller i mottagarfältet från kundkortet varje gång kunden byts (eller
  // en annan offert öppnas) — men rör det inte igen efter det.
  React.useEffect(() => { setEmailToInput(previewCustomer?.email || ''); }, [form.customerId, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadPdf = async () => {
    setPdfBusy(true); setPdfError('');
    try {
      await exportInvoicePdf(captureRef.current, `offert-${previewNumber}.pdf`);
    } catch (err) {
      console.error(err);
      setPdfError('Kunde inte skapa PDF. Försök igen.');
    } finally {
      setPdfBusy(false);
    }
  };

  // Skickar offerten (PDF-bilaga) till kundens e-post via samma backend-rutt
  // som fakturor (Invoices.jsx) — den bryr sig aldrig om vilket slags
  // dokument den skickar, bara to/subject/html/bilaga/avsändarcompany, så
  // en egen "send-quote"-serverless-funktion vore bara en identisk kopia
  // (och riskerar Vercels 12-funktionsgräns i onödan).
  const handleSendEmail = async () => {
    const to = emailToInput.trim();
    if (!to) { setEmailError('Ange en mottagaradress.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(to)) { setEmailError('Det där ser inte ut som en giltig e-postadress.'); return; }
    setEmailBusy(true); setEmailError(''); setEmailSent(false);
    try {
      const attachmentBase64 = await getInvoicePdfBase64(captureRef.current);

      const html = `
        <p>Hej${previewCustomer?.contactPerson ? ' ' + previewCustomer.contactPerson : ''},</p>
        <p>Bifogat finner du offert <strong>${previewNumber}</strong> på <strong>${fmtSEK(previewTotals.total)} kr</strong>, giltig till ${fmtDateSv(form.dueDate)}.</p>
        <p>Hör av dig om du har några frågor.</p>
        <p>Med vänlig hälsning<br/>${company?.name || ''}</p>
      `;

      await sendInvoiceEmail({
        to,
        subject: `Offert ${previewNumber} från ${company?.name || 'oss'}`,
        html,
        replyTo: company?.email || undefined,
        attachmentBase64,
        attachmentFilename: `offert-${previewNumber}.pdf`,
        company: { name: company?.name, emailDomain: company?.emailDomain, resendDomainId: company?.resendDomainId },
      });

      setEmailSent(true);
      // Ett utkast som faktiskt skickas till kunden är per definition inte
      // längre ett utkast — samma princip som fakturor (Invoices.jsx).
      if (editingId) {
        setInvoices(prev => prev.map(i => i.id === editingId ? { ...i, status: 'sent' } : i));
      }
    } catch (err) {
      console.error(err);
      setEmailError(err.message || 'Kunde inte skicka e-post.');
    } finally {
      setEmailBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!setInvoices) return;
    const rows = form.rows.map(r => ({
      description: r.description,
      qty: Number(r.qty) || 1,
      unitPrice: Number(r.price) || 0,
      vatRate: Number(r.vat) || 25,
    }));
    const contact = contacts.find(c => c.id === form.customerId);

    if (editingId) {
      setInvoices(prev => prev.map(i => i.id === editingId ? {
        ...i,
        customerId: form.customerId,
        customerName: contact?.name || form.customer,
        date: form.date,
        dueDate: form.dueDate || '',
        rows,
        invoiceTemplateSnapshot: templateSnapshot,
      } : i));
    } else {
      const newQuote = {
        id: `q_${Date.now()}`,
        type: 'quote',
        invoiceNumber: previewNumber,
        customerId: form.customerId,
        customerName: contact?.name || form.customer,
        date: form.date,
        dueDate: form.dueDate || '',
        status: 'draft',
        rows,
        invoiceTemplateSnapshot: templateSnapshot,
      };
      setInvoices(prev => [newQuote, ...(prev || [])]);
    }
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const getTotal = (q) => {
    return (q.rows || []).reduce((sum, r) => {
      const net = (r.qty || 1) * (r.unitPrice || 0);
      return sum + net + net * ((r.vatRate || 0) / 100);
    }, 0);
  };

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: '#1a3028', border: 'none', borderRadius: '9px', fontSize: '13px',
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
  };

  const outlineBtnStyle = {
    ...buttonStyle, background: 'white', border: '1px solid #d1d5db', color: '#374151'
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '9px',
    fontSize: '14px', color: '#111827', background: 'white', outline: 'none',
    transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            Offerter
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Skapa offerter med samma mall som dina fakturor och konvertera till faktura när kunden accepterat
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={openNew} style={buttonStyle}>
            <Plus size={14} /> Ny offert
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text" placeholder="Sök offert eller kund..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '34px', paddingRight: '12px', paddingBottom: '7px', paddingTop: '7px' }}
          />
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Offertnr</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Kund</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Datum</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Belopp</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, idx) => {
                const s = getStatusStyle(getDisplayStatus(q));
                const customerName = contacts.find(c => c.id === q.customerId)?.name || q.customerName || '—';
                const total = getTotal(q);
                return (
                  <tr
                    key={q.id} onClick={() => openEdit(q)}
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileSpreadsheet size={16} color="#9ca3af" /> {q.invoiceNumber || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#4b5563', fontWeight: 500 }}>{customerName}</td>
                    <td style={{ padding: '14px 20px', color: '#6b7280' }}>{q.date}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '4px 10px', background: s.bg, color: s.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500 }}>{total.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {(q.status === 'accepted' || q.status === 'draft') && (
                          <button onClick={(e) => handleConvert(q, e)} title="Konvertera till faktura" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3d7a2e' }}>
                            <FileText size={16} />
                          </button>
                        )}
                        <button onClick={(e) => handleDelete(q.id, e)} title="Ta bort" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <FileSpreadsheet size={24} style={{ color: '#9ca3af', margin: '0 auto 16px', display: 'block' }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Inga offerter skapade</div>
                    <div style={{ fontSize: '13px', color: '#9ca3af' }}>Klicka på "Ny offert" för att komma igång</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL — formulär till vänster, samma InvoiceDocument-mall som fakturor
          till höger (docLabel="OFFERT"). Samma komponent fångas av PDF-
          exporten som visas i förhandsgranskningen, så de två kan aldrig
          divergera — precis som för fakturor (se Invoices.jsx). */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '1120px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>{editingId ? `Offert ${previewNumber}` : 'Ny offert'}</h2>
                {editingQuote && (() => {
                  const ds = getDisplayStatus(editingQuote);
                  const s = getStatusStyle(ds);
                  return <span style={{ padding: '4px 10px', background: s.bg, color: s.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.label}</span>;
                })()}
                {editingQuote && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(!editingQuote.status || editingQuote.status === 'draft') && (
                      <button type="button" onClick={() => setQuoteStatus(editingQuote.id, 'sent')} style={{ ...outlineBtnStyle, padding: '5px 10px', fontSize: '12px' }}>Markera som skickad</button>
                    )}
                    {editingQuote.status === 'sent' && (
                      <>
                        <button type="button" onClick={() => setQuoteStatus(editingQuote.id, 'accepted')} style={{ ...outlineBtnStyle, padding: '5px 10px', fontSize: '12px', color: '#166534', borderColor: '#bbf7d0' }}>Markera som accepterad</button>
                        <button type="button" onClick={() => setQuoteStatus(editingQuote.id, 'rejected')} style={{ ...outlineBtnStyle, padding: '5px 10px', fontSize: '12px', color: '#991b1b', borderColor: '#fecaca' }}>Markera som avvisad</button>
                      </>
                    )}
                    {(editingQuote.status === 'accepted' || editingQuote.status === 'rejected') && (
                      <button type="button" onClick={() => setQuoteStatus(editingQuote.id, 'draft')} style={{ padding: '5px 10px', background: 'transparent', border: 'none', color: '#6b7280', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Återställ till utkast</button>
                    )}
                    {editingQuote.status === 'accepted' && (
                      <button type="button" onClick={(e) => handleConvert(editingQuote, e)} style={{ ...outlineBtnStyle, padding: '5px 10px', fontSize: '12px', color: '#3d7a2e', borderColor: '#bbf7d0' }}>Konvertera till faktura</button>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} color="#9ca3af" /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '0' }}>
              <div style={{ flex: '1 1 480px', minWidth: '380px', padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Kund</label>
                    {contacts.length > 0 ? (
                      <select
                        style={inputStyle}
                        value={form.customerId}
                        onChange={e => {
                          const contact = contacts.find(c => c.id === e.target.value);
                          setForm(f => ({ ...f, customerId: e.target.value, customer: contact?.name || '' }));
                        }}
                      >
                        <option value="">Välj kund...</option>
                        {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <input type="text" style={inputStyle} value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder="Kundnamn" required />
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Datum</label>
                    <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Giltig till</label>
                    <input type="date" style={inputStyle} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Offertrader</h3>
                  {form.rows.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                      <input type="text" placeholder="Beskrivning" style={inputStyle} value={row.description}
                        onChange={e => { const r = [...form.rows]; r[i].description = e.target.value; setForm(f => ({ ...f, rows: r })); }} required />
                      <input type="number" placeholder="Á-pris" style={inputStyle} value={row.price}
                        onChange={e => { const r = [...form.rows]; r[i].price = e.target.value; setForm(f => ({ ...f, rows: r })); }} required />
                      <input type="number" placeholder="Antal" style={inputStyle} value={row.qty}
                        onChange={e => { const r = [...form.rows]; r[i].qty = e.target.value; setForm(f => ({ ...f, rows: r })); }} />
                      <input type="number" placeholder="Moms %" style={inputStyle} value={row.vat}
                        onChange={e => { const r = [...form.rows]; r[i].vat = e.target.value; setForm(f => ({ ...f, rows: r })); }} />
                      <button type="button" onClick={() => handleRemoveRow(i)} disabled={form.rows.length === 1} title="Ta bort rad" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: form.rows.length === 1 ? 'not-allowed' : 'pointer', color: form.rows.length === 1 ? '#e5e7eb' : '#ef4444' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddRow} style={{ ...outlineBtnStyle, padding: '6px 12px', fontSize: '12px', marginTop: '8px' }}>+ Lägg till rad</button>
                </div>

                {pdfError && <div style={{ fontSize: '12.5px', color: '#dc2626', marginBottom: '4px' }}>{pdfError}</div>}
                {emailError && <div style={{ fontSize: '12.5px', color: '#dc2626', marginBottom: '4px' }}>{emailError}</div>}
                {emailSent && !emailError && <div style={{ fontSize: '12.5px', color: '#15803d', fontWeight: 600, marginBottom: '4px' }}>Offert skickad ✓</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="email" value={emailToInput} onChange={e => { setEmailToInput(e.target.value); setEmailError(''); }}
                    placeholder="mottagarens@epost.se" title="Mottagarens e-postadress — förifylld från kundkortet om det finns en, men går att ändra eller fylla i här"
                    disabled={!editingId}
                    style={{ ...inputStyle, width: '190px', background: !editingId ? '#f5f5f5' : 'white', color: !editingId ? '#999' : '#111827' }}
                  />
                  <button
                    type="button" onClick={handleSendEmail}
                    disabled={emailBusy || !editingId || !emailToInput.trim()}
                    title={!editingId ? 'Spara offerten först' : (!emailToInput.trim() ? 'Ange en mottagaradress' : `Skicka offert ${previewNumber} till ${emailToInput.trim()}`)}
                    style={{ ...outlineBtnStyle, opacity: (emailBusy || !editingId || !emailToInput.trim()) ? 0.5 : 1, cursor: (emailBusy || !editingId || !emailToInput.trim()) ? 'not-allowed' : 'pointer' }}
                  >
                    <Send size={14} /> {emailBusy ? 'Skickar…' : 'Skicka via e-post'}
                  </button>
                  <button type="button" onClick={handleDownloadPdf} disabled={pdfBusy} style={{ ...outlineBtnStyle, opacity: pdfBusy ? 0.6 : 1, cursor: pdfBusy ? 'not-allowed' : 'pointer' }}>
                    <Download size={14} /> {pdfBusy ? 'Skapar PDF…' : 'Ladda ner PDF'}
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={outlineBtnStyle}>Avbryt</button>
                  <button type="submit" style={buttonStyle}><Check size={14} /> {editingId ? 'Spara ändringar' : 'Spara offert'}</button>
                </div>
              </div>

              {/* Live-förhandsvisning — samma mall/accentfärg/logotyp som är
                  valda under Inställningar → Fakturamall. */}
              <div style={{ flex: '1 1 380px', minWidth: '320px', background: '#f3f4f6', borderLeft: '1px solid #e5e7eb', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '0 0 16px 0' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'flex-start' }}>Förhandsvisning</div>
                <div style={{ width: '100%', maxWidth: '360px', transform: 'scale(0.88)', transformOrigin: 'top center', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                  <InvoiceDocument
                    ref={previewRef}
                    invoice={{ invoiceNumber: previewNumber, date: form.date, dueDate: form.dueDate }}
                    customer={previewCustomer}
                    company={company}
                    rows={previewRows}
                    totals={previewTotals}
                    currency="SEK"
                    docLabel="OFFERT"
                    docType="quote"
                    template={templateSnapshot.templateId}
                    accentColor={templateSnapshot.accentColor}
                    logoUrl={templateSnapshot.logoUrl}
                    footerText={templateSnapshot.footerText}
                  />
                </div>
              </div>

              {/* Osynlig, alltid monterad, oskalad — se kommentaren vid
                  captureRef ovan. PDF/mejl fångar DENNA, aldrig den skalade
                  360px-förhandsvisningen ovan. */}
              <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '794px', pointerEvents: 'none' }} aria-hidden="true">
                <InvoiceDocument
                  ref={captureRef}
                  invoice={{ invoiceNumber: previewNumber, date: form.date, dueDate: form.dueDate }}
                  customer={previewCustomer}
                  company={company}
                  rows={previewRows}
                  totals={previewTotals}
                  currency="SEK"
                  docLabel="OFFERT"
                  docType="quote"
                  template={templateSnapshot.templateId}
                  accentColor={templateSnapshot.accentColor}
                  logoUrl={templateSnapshot.logoUrl}
                  footerText={templateSnapshot.footerText}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
