import React, { useState } from 'react';
import {
  Plus, X, Check, Search, Building2, User, Phone, Mail, Trash2
} from 'lucide-react';

export default function Contacts({ contacts, setContacts }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  // Form
  const [type, setType] = useState('customer');
  const [name, setName] = useState('');
  const [orgNr, setOrgNr] = useState('');
  const [vatNr, setVatNr] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const filtered = contacts.filter(c => {
    if (filter !== 'all' && c.type !== filter) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(s) || (c.orgNr && c.orgNr.toLowerCase().includes(s)) || (c.email && c.email.toLowerCase().includes(s));
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newContact = {
      id: `contact_${Date.now()}`,
      type, name, orgNr, vatNr, address, email, phone,
    };
    setContacts(prev => [...prev, newContact]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setType('customer'); setName(''); setOrgNr(''); setVatNr(''); setAddress(''); setEmail(''); setPhone('');
  };

  const handleDelete = (id) => {
    if (window.confirm('Är du säker på att du vill ta bort denna kontakt?')) {
      setContacts(prev => prev.filter(c => c.id !== id));
    }
  };

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
    background: '#2563eb', border: 'none', borderRadius: '9px', fontSize: '13px', 
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '9px',
    fontSize: '14px', color: '#111827', background: 'white', outline: 'none',
    transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            Kunder & Leverantörer
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Hantera ditt företagsregister
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
        >
          <Plus size={14} /> Ny kontakt
        </button>
      </div>

      {/* ── FILTERS & SEARCH ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Alla' },
            { id: 'customer', label: 'Kunder' },
            { id: 'supplier', label: 'Leverantörer' }
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: filter === f.id ? 600 : 500, cursor: 'pointer',
              background: filter === f.id ? '#111827' : 'white',
              color: filter === f.id ? 'white' : '#6b7280',
              border: `1px solid ${filter === f.id ? '#111827' : '#e5e7eb'}`,
              transition: 'all 0.15s', fontFamily: 'inherit'
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Sök namn, org.nr eller e-post..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '34px', paddingRight: '12px', paddingBottom: '7px', paddingTop: '7px' }}
          />
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Namn</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Typ</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Org.nr / Momsnr</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151' }}>Kontaktinfo</th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '8px', background: c.type === 'customer' ? '#eff6ff' : '#f3f4f6', color: c.type === 'customer' ? '#2563eb' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {c.type === 'customer' ? <User size={14} /> : <Building2 size={14} />}
                      </div>
                      {c.name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '4px 10px', background: c.type === 'customer' ? '#eff6ff' : '#f3f4f6', color: c.type === 'customer' ? '#1d4ed8' : '#4b5563', border: `1px solid ${c.type === 'customer' ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: '20px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em' }}>
                      {c.type === 'customer' ? 'Kund' : 'Leverantör'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px' }}>
                    {c.orgNr && <div style={{ color: '#374151' }}>Org: {c.orgNr}</div>}
                    {c.vatNr && <div style={{ color: '#6b7280' }}>VAT: {c.vatNr}</div>}
                    {!c.orgNr && !c.vatNr && <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {c.email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563' }}><Mail size={12} style={{ color: '#9ca3af' }} /> {c.email}</div>}
                    {c.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563' }}><Phone size={12} style={{ color: '#9ca3af' }} /> {c.phone}</div>}
                    {!c.email && !c.phone && <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(c.id)} title="Ta bort" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <User size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                      Inga kontakter funna
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      Lägg till en kund eller leverantör för att komma igång
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL ── */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Ny kontakt</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                  <input type="radio" checked={type === 'customer'} onChange={() => setType('customer')} style={{ accentColor: '#2563eb', width: '16px', height: '16px' }} />
                  Kund
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                  <input type="radio" checked={type === 'supplier'} onChange={() => setType('supplier')} style={{ accentColor: '#2563eb', width: '16px', height: '16px' }} />
                  Leverantör
                </label>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Namn / Företag *</label>
                <input type="text" style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Organisationsnummer</label>
                  <input type="text" style={inputStyle} value={orgNr} onChange={e => setOrgNr(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>VAT / Momsnummer</label>
                  <input type="text" style={inputStyle} value={vatNr} onChange={e => setVatNr(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>E-post</label>
                <input type="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Telefon</label>
                <input type="tel" style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Postadress</label>
                <textarea rows="2" style={{ ...inputStyle, resize: 'none' }} value={address} onChange={e => setAddress(e.target.value)}></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Avbryt</button>
                <button type="submit" disabled={!name.trim()} style={{ ...buttonStyle, opacity: !name.trim() ? 0.5 : 1 }}>
                  <Check size={14} /> Spara kontakt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
