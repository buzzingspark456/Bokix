import React, { useState, useEffect } from 'react';
import {
  Plus, X, Check, Send, CreditCard, FileText, Trash2, Download,
  Mail, RefreshCw, AlertCircle, FileSpreadsheet, Copy, Search,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreVertical,
  Printer, Bell
} from 'lucide-react';

// ─── shared helpers ───────────────────────────────────────────────────────────

function fmt(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function calcTotals(rows) {
  let net = 0, vat = 0;
  (rows || []).forEach(r => {
    const n = (r.qty || 0) * (r.unitPrice || 0);
    net += n; vat += n * ((r.vatRate || 0) / 100);
  });
  return { net: Math.round(net), vat: Math.round(vat), gross: Math.round(net + vat) };
}

// Row background by status
function rowBg(status, dueDate) {
  const today = new Date().toISOString().split('T')[0];
  if (status === 'paid')  return '#f0fdf4';
  if (status === 'sent' && dueDate && dueDate < today) return '#fef2f2'; // overdue
  if (status === 'sent')  return '#fffbeb';
  if (status === 'draft') return '#ffffff';
  return '#ffffff';
}

function statusBadge(status, dueDate) {
  const today = new Date().toISOString().split('T')[0];
  if (status === 'paid')  return { dot: '#16a34a', label: 'Slutbetald' };
  if (status === 'sent' && dueDate && dueDate < today) return { dot: '#dc2626', label: 'Obetald förfallen' };
  if (status === 'sent')  return { dot: '#d97706', label: 'Obetald' };
  return { dot: '#6b7280', label: 'Bokförd' };
}

const inputStyle = {
  width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
  fontSize: '13px', color: '#111827', background: 'white', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box'
};

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '0' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '10px 20px', background: active === t.id ? 'white' : '#f9fafb',
          border: '1px solid #e5e7eb', borderBottom: active === t.id ? '2px solid white' : '1px solid #e5e7eb',
          marginBottom: active === t.id ? '-2px' : '-1px',
          fontSize: '13px', fontWeight: active === t.id ? 700 : 500,
          color: active === t.id ? '#111827' : '#6b7280',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
          borderRadius: '6px 6px 0 0'
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── New Invoice Modal ────────────────────────────────────────────────────────

function InvoiceModal({ isOpen, onClose, contacts, invoices, onAdd }) {
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate()+30); return d.toISOString().split('T')[0]; });
  const [rows, setRows] = useState([{ description: '', qty: 1, unitPrice: 0, vatRate: 25 }]);
  const customers = (contacts||[]).filter(c => c.type === 'customer');

  const addRow = () => setRows(r => [...r, { description:'', qty:1, unitPrice:0, vatRate:25 }]);
  const removeRow = i => rows.length > 1 && setRows(r => r.filter((_,idx)=>idx!==i));
  const updateRow = (i,f,v) => setRows(r => { const n=[...r]; n[i]={...n[i],[f]:f==='description'?v:parseFloat(v)||0}; return n; });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerId) return;
    const nums = (invoices||[]).filter(i=>(i.type||'invoice')==='invoice').map(i=>parseInt(i.invoiceNumber,10)).filter(Number.isFinite);
    const nextNum = nums.length > 0 ? String(Math.max(...nums)+1) : '1001';
    onAdd({ type:'invoice', invoiceNumber:nextNum, customerId, date:invoiceDate, dueDate, status:'draft', paidDate:null, rows:rows.filter(r=>r.description&&r.unitPrice>0) });
    setCustomerId(''); setRows([{description:'',qty:1,unitPrice:0,vatRate:25}]); onClose();
  };

  const totals = calcTotals(rows);

  if (!isOpen) return null;
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(3px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'20px' }} onClick={onClose}>
      <div style={{ background:'white',borderRadius:'12px',width:'100%',maxWidth:'820px',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'18px 24px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white',zIndex:1 }}>
          <h2 style={{ fontSize:'17px',fontWeight:700,color:'#111827' }}>Skapa faktura</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#6b7280' }}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding:'24px' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px',marginBottom:'24px' }}>
            <div>
              <label style={{ display:'block',fontSize:'12px',fontWeight:600,color:'#374151',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.04em' }}>Kund *</label>
              <select style={inputStyle} value={customerId} onChange={e=>setCustomerId(e.target.value)} required>
                <option value="">Välj kund...</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block',fontSize:'12px',fontWeight:600,color:'#374151',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.04em' }}>Fakturadatum *</label>
              <input type="date" style={inputStyle} value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} required/>
            </div>
            <div>
              <label style={{ display:'block',fontSize:'12px',fontWeight:600,color:'#374151',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.04em' }}>Förfallodatum</label>
              <input type="date" style={inputStyle} value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
            </div>
          </div>
          <div style={{ border:'1px solid #e5e7eb',borderRadius:'8px',overflow:'hidden',marginBottom:'24px' }}>
            <div style={{ display:'grid',gridTemplateColumns:'3fr 80px 120px 80px 40px',gap:'0',background:'#f9fafb',borderBottom:'1px solid #e5e7eb' }}>
              {['Beskrivning','Antal','Á-pris','Moms',''].map((h,i)=><div key={i} style={{ padding:'8px 12px',fontSize:'11px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em' }}>{h}</div>)}
            </div>
            {rows.map((row,i)=>(
              <div key={i} style={{ display:'grid',gridTemplateColumns:'3fr 80px 120px 80px 40px',borderBottom:i<rows.length-1?'1px solid #f3f4f6':'none' }}>
                <div style={{ padding:'8px 12px' }}><input type="text" placeholder="Beskriv tjänst eller produkt..." style={{...inputStyle,border:'none',padding:'4px 0',background:'transparent'}} value={row.description} onChange={e=>updateRow(i,'description',e.target.value)} required/></div>
                <div style={{ padding:'8px 12px' }}><input type="number" style={{...inputStyle,border:'none',padding:'4px 0',background:'transparent',textAlign:'right'}} value={row.qty} onChange={e=>updateRow(i,'qty',e.target.value)}/></div>
                <div style={{ padding:'8px 12px' }}><input type="number" style={{...inputStyle,border:'none',padding:'4px 0',background:'transparent',textAlign:'right'}} value={row.unitPrice} onChange={e=>updateRow(i,'unitPrice',e.target.value)}/></div>
                <div style={{ padding:'8px 12px' }}><select style={{...inputStyle,border:'none',padding:'4px 0',background:'transparent'}} value={row.vatRate} onChange={e=>updateRow(i,'vatRate',parseInt(e.target.value))}>{[25,12,6,0].map(v=><option key={v} value={v}>{v}%</option>)}</select></div>
                <div style={{ padding:'8px',display:'flex',alignItems:'center',justifyContent:'center' }}>{rows.length>1&&<button type="button" onClick={()=>removeRow(i)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}><X size={14}/></button>}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'24px' }}>
            <button type="button" onClick={addRow} style={{ display:'flex',alignItems:'center',gap:'5px',padding:'6px 12px',background:'white',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'#374151' }}><Plus size={13}/> Lägg till rad</button>
            <div style={{ background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'14px 20px',minWidth:'240px' }}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:'13px',color:'#6b7280',marginBottom:'6px' }}><span>Netto</span><span>{fmt(totals.net)} kr</span></div>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:'13px',color:'#6b7280',marginBottom:'8px' }}><span>Moms</span><span>{fmt(totals.vat)} kr</span></div>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:'15px',fontWeight:700,color:'#111827',paddingTop:'8px',borderTop:'1px solid #d1d5db' }}><span>Totalt</span><span>{fmt(totals.gross)} kr</span></div>
            </div>
          </div>
          <div style={{ display:'flex',justifyContent:'flex-end',gap:'10px',paddingTop:'16px',borderTop:'1px solid #e5e7eb' }}>
            <button type="button" onClick={onClose} style={{ padding:'8px 18px',background:'white',border:'1px solid #d1d5db',borderRadius:'7px',fontSize:'13px',fontWeight:500,cursor:'pointer' }}>Avbryt</button>
            <button type="submit" style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 20px',background:'#166534',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:700,cursor:'pointer',color:'white' }}><Check size={14}/> Spara som utkast</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quotes panel ────────────────────────────────────────────────────────────

function QuotesPanel({ invoices, contacts, onAdd, setInvoices, onConvertQuote }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({ customer: '', date: new Date().toISOString().split('T')[0], rows: [{ description: '', qty: 1, unitPrice: 0, vatRate: 25 }] });

  const quotes = (invoices || []).filter(i => (i.type || 'invoice') === 'quote');
  const contacts_ = contacts || [];

  const getStatusStyle = (s) => {
    switch (s) {
      case 'accepted': return { bg: '#dcfce7', color: '#166534', label: 'Accepterad' };
      case 'sent':     return { bg: '#eff6ff', color: '#1d4ed8', label: 'Skickad' };
      case 'expired':  return { bg: '#fef3c7', color: '#92400e', label: 'Förfallen' };
      case 'declined': return { bg: '#fee2e2', color: '#991b1b', label: 'Avvisad' };
      default:         return { bg: '#f3f4f6', color: '#4b5563', label: 'Utkast' };
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextNum = 'OFF-' + (1001 + quotes.length);
    onAdd({ type: 'quote', invoiceNumber: nextNum, customerId: form.customer, date: form.date, dueDate: form.date, status: 'draft', paidDate: null, rows: form.rows.filter(r => r.description && r.unitPrice > 0) });
    setForm({ customer: '', date: new Date().toISOString().split('T')[0], rows: [{ description: '', qty: 1, unitPrice: 0, vatRate: 25 }] });
    setIsModalOpen(false);
  };

  const filtered = quotes.filter(q => !searchTerm || contacts_.find(c => c.id === q.customerId)?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || q.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()));

  const inp = { width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#111827', background: 'white', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
  const btn = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#166534', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'white' };
  const outBtn = { ...btn, background: 'white', border: '1px solid #d1d5db', color: '#374151' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>Offerter</h2>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '2px' }}>Skapa offerter och konvertera till fakturor</p>
        </div>
        <button style={btn} onClick={() => setIsModalOpen(true)}><Plus size={14} /> Ny offert</button>
      </div>
      <div style={{ position: 'relative', marginBottom: '14px', maxWidth: '320px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input type="text" placeholder="Sök offert eller kund..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inp, paddingLeft: '32px' }} />
      </div>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Offertnr', 'Kund', 'Datum', 'Status', 'Belopp', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 16px', fontWeight: 600, color: '#374151', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((q, idx) => {
              const s = getStatusStyle(q.status);
              const cust = contacts_.find(c => c.id === q.customerId);
              const total = calcTotals(q.rows).gross;
              return (
                <tr key={q.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 600 }}><div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><FileSpreadsheet size={14} color="#9ca3af" />{q.invoiceNumber}</div></td>
                  <td style={{ padding: '11px 16px', color: '#374151' }}>{cust?.name || '—'}</td>
                  <td style={{ padding: '11px 16px', color: '#6b7280' }}>{q.date}</td>
                  <td style={{ padding: '11px 16px' }}><span style={{ padding: '3px 9px', background: s.bg, color: s.color, borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.label}</span></td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 500 }}>{fmt(total)} kr</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button title="Skicka" style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><Mail size={14} /></button>
                      <button title="PDF" style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><Download size={14} /></button>
                      {onConvertQuote && <button title="Konvertera till faktura" onClick={() => onConvertQuote(q.id)} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}><FileText size={14} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                <FileSpreadsheet size={22} style={{ margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontWeight: 600, fontSize: '14px' }}>Inga offerter</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Ny offert</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#9ca3af" /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Kund</label>
                  <select style={inp} value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} required>
                    <option value="">Välj kund...</option>
                    {contacts_.filter(c => c.type === 'customer').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Datum</label>
                  <input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></div>
              </div>
              {form.rows.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 70px 30px', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" placeholder="Beskrivning" style={inp} value={row.description} onChange={e => { const r=[...form.rows]; r[i].description=e.target.value; setForm(f=>({...f,rows:r})); }} required />
                  <input type="number" placeholder="Antal" style={inp} value={row.qty} onChange={e => { const r=[...form.rows]; r[i].qty=parseFloat(e.target.value)||1; setForm(f=>({...f,rows:r})); }} />
                  <input type="number" placeholder="Pris" style={inp} value={row.unitPrice} onChange={e => { const r=[...form.rows]; r[i].unitPrice=parseFloat(e.target.value)||0; setForm(f=>({...f,rows:r})); }} />
                  <select style={inp} value={row.vatRate} onChange={e => { const r=[...form.rows]; r[i].vatRate=parseInt(e.target.value); setForm(f=>({...f,rows:r})); }}>{[25,12,6,0].map(v=><option key={v} value={v}>{v}%</option>)}</select>
                  {form.rows.length > 1 && <button type="button" onClick={() => setForm(f=>({...f,rows:f.rows.filter((_,idx)=>idx!==i)}))} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}><X size={14}/></button>}
                </div>
              ))}
              <button type="button" onClick={() => setForm(f=>({...f,rows:[...f.rows,{description:'',qty:1,unitPrice:0,vatRate:25}]}))} style={{ ...outBtn, padding:'5px 12px', fontSize:'12px', marginBottom:'16px' }}><Plus size={13}/> Lägg till rad</button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={outBtn}>Avbryt</button>
                <button type="submit" style={btn}><Check size={13}/> Spara offert</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Invoices component ──────────────────────────────────────────────────

export default function Invoices({ invoices, contacts, onAdd, onMarkPaid, onCreatePaymentLink, stripeAccountId, setInvoices, company, globalAction, clearGlobalAction, onConvertQuote }) {
  const [pageTab, setPageTab] = useState('invoices');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    if (globalAction?.type === 'new_invoice') { setIsModalOpen(true); clearGlobalAction?.(); }
    if (globalAction?.type === 'new_quote')   { setPageTab('quotes'); }
  }, [globalAction]);

  const today = new Date().toISOString().split('T')[0];
  const allInvoices = (invoices || []).filter(i => (i.type || 'invoice') === 'invoice');

  // Enrich invoices with balance (unpaid amount)
  const enriched = allInvoices.map((inv, idx) => {
    const totals = calcTotals(inv.rows);
    const balance = inv.status === 'paid' ? 0 : totals.gross;
    const ocr = String(inv.invoiceNumber).padStart(4, '0') + '25'; // simple OCR generation
    const custNr = idx + 1; // simple customer nr
    return { ...inv, totalGross: totals.gross, balance, ocr };
  });

  // Filter
  const filtered = enriched.filter(inv => {
    if (filterStatus === 'draft' && inv.status !== 'draft') return false;
    if (filterStatus === 'sent' && (inv.status !== 'sent' || (inv.dueDate && inv.dueDate >= today))) return false;
    if (filterStatus === 'overdue' && !(inv.status === 'sent' && inv.dueDate && inv.dueDate < today)) return false;
    if (filterStatus === 'paid' && inv.status !== 'paid') return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const custName = (contacts || []).find(c => c.id === inv.customerId)?.name?.toLowerCase() || '';
      if (!inv.invoiceNumber.toString().includes(s) && !custName.includes(s) && !inv.ocr.includes(s)) return false;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    all: allInvoices.length,
    draft: allInvoices.filter(i => i.status === 'draft').length,
    sent: allInvoices.filter(i => i.status === 'sent' && (!i.dueDate || i.dueDate >= today)).length,
    overdue: allInvoices.filter(i => i.status === 'sent' && i.dueDate && i.dueDate < today).length,
    paid: allInvoices.filter(i => i.status === 'paid').length,
  };

  const sumTotal = filtered.reduce((s, i) => s + i.totalGross, 0);
  const sumBalance = filtered.reduce((s, i) => s + i.balance, 0);

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === paginated.length ? [] : paginated.map(i => i.id));

  const handleSend = (id) => setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i));
  const handleDelete = (id) => { if (window.confirm('Ta bort fakturan?')) setInvoices(prev => prev.filter(i => i.id !== id)); };

  const statusFilters = [
    { id: 'all',     label: 'Alla',              dot: '#6b7280' },
    { id: 'draft',   label: 'Bokförda',           dot: '#6b7280' },
    { id: 'sent',    label: 'Obetalda',           dot: '#d97706' },
    { id: 'overdue', label: 'Obetalda förfallna', dot: '#dc2626' },
    { id: 'paid',    label: 'Slutbetalda',        dot: '#16a34a' },
  ];

  const inp = { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#111827', background: 'white', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Page title */}
      <div style={{ marginBottom: '2px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: '#111827', marginBottom: '3px' }}>Fakturering</h1>
        <p style={{ color: '#9ca3af', fontSize: '13px' }}>Fakturor, offerter och betalningar</p>
      </div>

      {/* Tab bar */}
      <TabBar
        tabs={[{ id: 'invoices', label: 'Kundfaktura' }, { id: 'quotes', label: 'Offerter' }]}
        active={pageTab}
        onChange={(t) => { setPageTab(t); setPage(1); }}
      />

      {pageTab === 'quotes' && (
        <QuotesPanel invoices={invoices} contacts={contacts} onAdd={onAdd} setInvoices={setInvoices} onConvertQuote={onConvertQuote} />
      )}

      {pageTab === 'invoices' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>KUNDFAKTUROR - LISTA</h2>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input type="text" placeholder="Faktnr, OCR, Kundnr, Namn" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} style={{ ...inp, paddingLeft: '28px', width: '220px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => { alert('Söker efter inbetalningar...'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                <RefreshCw size={13} /> Utökad sökning
              </button>
              <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#166534', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white' }}>
                <Plus size={14} /> Skapa faktura
              </button>
            </div>
          </div>

          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {statusFilters.map(f => (
              <button key={f.id} onClick={() => { setFilterStatus(f.id); setPage(1); }} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: filterStatus === f.id ? 700 : 500,
                background: filterStatus === f.id ? '#e2e8f0' : 'white',
                border: `1px solid ${filterStatus === f.id ? '#94a3b8' : '#e5e7eb'}`,
                cursor: 'pointer', color: '#374151', fontFamily: 'inherit'
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.dot, display: 'inline-block', flexShrink: 0 }} />
                {f.label} {f.id !== 'all' ? `(${counts[f.id] || 0})` : ''}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#6b7280' }}>
              {filtered.length} poster &nbsp;| &nbsp;Sida {page} av {totalPages}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #d1d5db' }}>
                    <th style={{ width: '36px', padding: '10px 10px', textAlign: 'center' }}>
                      <input type="checkbox" checked={paginated.length > 0 && selectedIds.length === paginated.length} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                    </th>
                    {['FAKTURNR', 'OCR', 'TYP', 'KUNDNR', 'NAMN', 'FAKTDATUM', 'LEVDATUM', 'TOTALT', 'SALDO', 'VALUTA', 'FÖRFDATUM', ''].map((h, i) => (
                      <th key={i} style={{ padding: '10px 10px', fontWeight: 700, color: '#374151', fontSize: '11px', textAlign: i >= 7 ? 'right' : 'left', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((inv, idx) => {
                    const custName = (contacts || []).find(c => c.id === inv.customerId)?.name || 'Okänd';
                    const bg = rowBg(inv.status, inv.dueDate);
                    const isSelected = selectedIds.includes(inv.id);
                    return (
                      <tr key={inv.id} style={{ background: isSelected ? '#dbeafe' : bg, borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.filter = 'brightness(0.97)'; }}
                        onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                      >
                        <td style={{ padding: '9px 10px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleSelect(inv.id); }}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(inv.id)} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: '#1d4ed8' }}>{inv.invoiceNumber}</td>
                        <td style={{ padding: '9px 10px', color: '#6b7280', fontSize: '12px', fontFamily: 'ui-monospace,monospace' }}>{inv.ocr}</td>
                        <td style={{ padding: '9px 10px', color: '#374151' }}>F</td>
                        <td style={{ padding: '9px 10px', color: '#374151' }}>{idx + 1}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 500, color: '#111827' }}>{custName}</td>
                        <td style={{ padding: '9px 10px', color: '#374151' }}>{inv.date}</td>
                        <td style={{ padding: '9px 10px', color: '#374151' }}>{inv.paidDate || ''}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt(inv.totalGross)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: inv.balance > 0 ? '#374151' : '#16a34a' }}>{fmt(inv.balance)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: '#6b7280', fontSize: '12px' }}>SEK</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: inv.dueDate && inv.dueDate < today && inv.status !== 'paid' ? '#dc2626' : '#374151' }}>{inv.dueDate || '—'}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
                            {inv.status === 'draft' && <button title="Skicka" onClick={e => { e.stopPropagation(); handleSend(inv.id); }} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}><Send size={13} /></button>}
                            {inv.status === 'sent'  && <button title="Markera betald" onClick={e => { e.stopPropagation(); onMarkPaid(inv.id); }} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}><Check size={13} /></button>}
                            <button title="E-post" onClick={e => e.stopPropagation()} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><Mail size={13} /></button>
                            <button title="Ta bort" onClick={e => { e.stopPropagation(); handleDelete(inv.id); }} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginated.length === 0 && (
                    <tr><td colSpan="13" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                      <FileText size={24} style={{ margin: '0 auto 12px', display: 'block' }} />
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>Inga fakturor</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>Skapa din första faktura ovan</div>
                    </td></tr>
                  )}
                  {/* Summary row */}
                  {paginated.length > 0 && (
                    <tr style={{ background: '#f9fafb', borderTop: '2px solid #d1d5db', fontWeight: 700 }}>
                      <td colSpan="8" style={{ padding: '10px 10px', textAlign: 'right', color: '#374151', fontSize: '13px' }}>Summa SEK</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', color: '#111827' }}>{fmt(sumTotal)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', color: '#111827' }}>{fmt(sumBalance)}</td>
                      <td colSpan="3" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', padding: '10px 14px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '5px 8px', background: 'white', border: '1px solid #d1d5db', borderRadius: '5px', cursor: page===1?'not-allowed':'pointer', color: page===1?'#d1d5db':'#374151' }}><ChevronsLeft size={13}/></button>
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page === 1} style={{ padding: '5px 8px', background: 'white', border: '1px solid #d1d5db', borderRadius: '5px', cursor: page===1?'not-allowed':'pointer', color: page===1?'#d1d5db':'#374151' }}><ChevronLeft size={13}/></button>
              <span style={{ fontSize: '12px', color: '#374151', padding: '0 8px' }}>{page}</span>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page === totalPages} style={{ padding: '5px 8px', background: 'white', border: '1px solid #d1d5db', borderRadius: '5px', cursor: page===totalPages?'not-allowed':'pointer', color: page===totalPages?'#d1d5db':'#374151' }}><ChevronRight size={13}/></button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '5px 8px', background: 'white', border: '1px solid #d1d5db', borderRadius: '5px', cursor: page===totalPages?'not-allowed':'pointer', color: page===totalPages?'#d1d5db':'#374151' }}><ChevronsRight size={13}/></button>
            </div>
          </div>

          {/* Bottom action bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '14px', padding: '12px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>({selectedIds.length} markerade)</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '3px' }}>Fakturajänster</label>
                <select style={{ ...inp, minWidth: '160px' }}><option>Utan Fakturajänster</option></select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '3px' }}>Distributionssätt</label>
                <select style={{ ...inp, minWidth: '130px' }}><option>—</option></select>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => alert('Skickar påminnelser...')} style={{ padding: '8px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                Påminnelser
              </button>
              <button onClick={() => alert('Bokför & Nästa...')} style={{ padding: '8px 18px', background: '#166534', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white' }}>
                Bokför &amp; Nästa
              </button>
            </div>
          </div>
        </div>
      )}

      <InvoiceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} contacts={contacts} invoices={invoices} onAdd={onAdd} />
    </div>
  );
}
