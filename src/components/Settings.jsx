import React, { useState, useEffect } from 'react';
import {
  Save, Download, Upload, AlertTriangle, Building2, CreditCard,
  Check, Star, Zap, Shield, Users, FileText, ChevronRight,
  User, Globe, Lock, Bell, Palette, Database, FileSpreadsheet
} from 'lucide-react';
import { generateSIE4 } from '../utils/sieExport';

const NAV_SECTIONS = [
  { id: 'profile', label: 'Min profil', icon: User },
  { id: 'company', label: 'Företag', icon: Building2 },
  { id: 'payment', label: 'Betalning & Faktura', icon: CreditCard },
  { id: 'users', label: 'Användare & Åtkomst', icon: Users },
  { id: 'subscription', label: 'Prenumeration', icon: Star },
  { id: 'data', label: 'Data & Inställningar', icon: Database },
];

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#eef6fb', color: '#3a8fc1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} />
        </div>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>{title}</h2>
      </div>
      {subtitle && <p style={{ fontSize: '13px', color: '#9ca3af', marginLeft: '42px' }}>{subtitle}</p>}
    </div>
  );
}

/* ── Stat Pill ── */
function StatPill({ icon: Icon, label, value, color = '#2563eb', bg = '#eff6ff' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: bg, borderRadius: '10px', border: `1px solid ${color}20` }}>
      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'white', color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Icon size={14} />
      </div>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: '19px', fontWeight: 700, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

/* ── Form Field ── */
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{label}</label>
      {hint && <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px', marginTop: '-2px' }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '9px',
  fontSize: '14px', color: '#111827', background: 'white', outline: 'none',
  transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box',
};

export default function Settings({ activeTab, company, setCompanyInfo, accounts, verifications, invoices, expenses, contacts, onImport, onReset, stripeAccountId, onConnectStripe }) {
  const [activeSection, setActiveSection] = useState('company');

  useEffect(() => {
    if (activeTab === 'profile') setActiveSection('profile');
    else if (activeTab === 'company') setActiveSection('company');
    else if (activeTab === 'users') setActiveSection('users');
    else if (activeTab === 'settings') setActiveSection('data');
  }, [activeTab]);
  const [formData, setFormData] = useState({ ...company });
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  React.useEffect(() => {
    setFormData({ ...company });
  }, [company]);

  const handleSave = (e) => {
    e.preventDefault();
    setCompanyInfo(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleExport = () => {
    const data = { version: '2.0', exportDate: new Date().toISOString(), company, accounts, verifications, invoices, expenses, contacts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alwixo_${company.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleSIE4Export = () => {
    const sieData = generateSIE4(company, accounts, verifications);
    const blob = new Blob([sieData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alwixo_export_${new Date().toISOString().split('T')[0]}.se`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleExportSIE = () => {
    const sieData = generateSIE4(company, accounts, verifications);
    const blob = new Blob([sieData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${company?.name?.replace(/\s+/g, '_') || 'Bokix'}_${new Date().toISOString().split('T')[0]}.se`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleImportSubmit = () => {
    try {
      const data = JSON.parse(importText);
      if (data && (data.verifications || data.accounts)) {
        onImport(data); setImportText(''); setShowImport(false);
      }
    } catch { alert('Ogiltig JSON-data.'); }
  };

  const getInputStyle = (name) => ({
    ...inputStyle,
    borderColor: focusedField === name ? '#3a8fc1' : '#e5e7eb',
    boxShadow: focusedField === name ? '0 0 0 3px rgba(58,143,193,0.1)' : 'none',
  });

  const inputProps = (name) => ({
    name,
    style: getInputStyle(name),
    onFocus: () => setFocusedField(name),
    onBlur: () => setFocusedField(null),
    onChange: handleChange,
  });

  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: '#111827', marginBottom: '4px' }}>Inställningar</h1>
        <p style={{ color: '#9ca3af', fontSize: '13.5px' }}>Hantera ditt företag, prenumeration och datasäkerhet.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── Sidebar Navigation ── */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', position: 'sticky', top: '80px' }}>
          {NAV_SECTIONS.map(sec => (
            <button key={sec.id} onClick={() => setActiveSection(sec.id)} style={{
              display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
              padding: '9px 12px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: activeSection === sec.id ? 600 : 400,
              background: activeSection === sec.id ? '#eef6fb' : 'transparent',
              color: activeSection === sec.id ? '#3a8fc1' : '#6b7280',
              textAlign: 'left', transition: 'all 0.15s', fontFamily: 'inherit',
              marginBottom: '2px',
            }}
            onMouseEnter={e => { if (activeSection !== sec.id) e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={e => { if (activeSection !== sec.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <sec.icon size={14} />
              {sec.label}
            </button>
          ))}
        </div>

        {/* ── Content Panel ── */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

          {/* ── MIN PROFIL ── */}
          {activeSection === 'profile' && (
            <div>
              <SectionHeader icon={User} title="Min profil" subtitle="Dina personliga kontouppgifter och inställningar." />
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #3a8fc1, #5ba85a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '24px' }}>
                  {(company?.name || 'A')[0]}
                </div>
                <div>
                  <button style={{ padding: '6px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Byt profilbild</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="Förnamn">
                  <input type="text" defaultValue="Admin" style={inputStyle} />
                </Field>
                <Field label="Efternamn">
                  <input type="text" defaultValue="Användare" style={inputStyle} />
                </Field>
              </div>
              <Field label="E-postadress">
                <input type="email" defaultValue={company?.email || ''} style={inputStyle} />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #f3f4f6', marginTop: '8px' }}>
                <button onClick={() => alert('Profil sparad!')} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 22px', background: '#3a8fc1', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }}>
                  <Save size={14} /> Spara profil
                </button>
              </div>
            </div>
          )}

          {/* ── FÖRETAG ── */}
          {activeSection === 'company' && (
            <form onSubmit={handleSave}>
              <SectionHeader icon={Building2} title="Företagsuppgifter" subtitle="Grundläggande information om ditt företag." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="Företagsnamn">
                  <input type="text" value={formData.name || ''} required {...inputProps('name')} />
                </Field>
                <Field label="Organisationsnummer">
                  <input type="text" value={formData.orgNr || ''} placeholder="XXXXXX-XXXX" {...inputProps('orgNr')} />
                </Field>
              </div>
              <Field label="Adress">
                <textarea value={formData.address || ''} rows={2} {...inputProps('address')} style={{ ...getInputStyle('address'), resize: 'none' }} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="Logotyp (URL)">
                  <input type="url" value={formData.logoUrl || ''} placeholder="https://.../logo.svg" {...inputProps('logoUrl')} />
                </Field>
                <Field label="E-post">
                  <input type="email" value={formData.email || ''} {...inputProps('email')} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="Telefon">
                  <input type="tel" value={formData.phone || ''} {...inputProps('phone')} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="Momsregistreringsnummer">
                  <input type="text" value={formData.vatNr || ''} placeholder="SE556123456701" {...inputProps('vatNr')} />
                </Field>
                <Field label="F-skatt">
                  <select value={formData.fSkatt || ''} {...inputProps('fSkatt')} style={{ ...getInputStyle('fSkatt'), cursor: 'pointer' }}>
                    <option value="Innehar F-skattsedel">Innehar F-skattsedel</option>
                    <option value="Innehar FA-skattsedel">FA-skattsedel</option>
                    <option value="Ej F-skatt">Ej F-skatt</option>
                  </select>
                </Field>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #f3f4f6', marginTop: '8px' }}>
                <button type="submit" style={{
                  display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 22px',
                  background: saved ? '#5ba85a' : '#3a8fc1', color: 'white', border: 'none',
                  borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s', fontFamily: 'inherit', minWidth: '130px', justifyContent: 'center',
                }}>
                  {saved ? <><Check size={14} /> Sparat!</> : <><Save size={14} /> Spara ändringar</>}
                </button>
              </div>
            </form>
          )}

          {/* ── BETALNING & FAKTURA ── */}
          {activeSection === 'payment' && (
            <form onSubmit={handleSave}>
              <SectionHeader icon={CreditCard} title="Betalning & Faktura" subtitle="Uppgifterna visas automatiskt på alla fakturor du skickar." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="Bankgiro">
                  <input type="text" value={formData.bankgiro || ''} placeholder="1234-5678" {...inputProps('bankgiro')} />
                </Field>
                <Field label="Plusgiro">
                  <input type="text" value={formData.plusgiro || ''} placeholder="12 34 56-7" {...inputProps('plusgiro')} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="IBAN">
                  <input type="text" value={formData.iban || ''} placeholder="SE00 0000 0000 0000 0000" {...inputProps('iban')} />
                </Field>
                <Field label="BIC / SWIFT">
                  <input type="text" value={formData.bic || ''} placeholder="SWEDSESS" {...inputProps('bic')} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'end', marginBottom: '20px' }}>
                <div>
                  <Field label="Stripe Connect" hint="Hantering av kundbetalningar och utbetalningar via Stripe.">
                    <p style={{ margin: 0, color: '#475569', lineHeight: '1.7' }}>
                      {stripeAccountId
                        ? 'Stripe-kontot är anslutet. Du kan skapa betalningslänkar för fakturor och ta emot kortbetalningar direkt till ditt konto.'
                        : 'Anslut Stripe för att aktivera betalningar med Stripe Checkout och plattformsavgifter.'}
                    </p>
                  </Field>
                </div>
                <div>
                  <button type="button" onClick={onConnectStripe} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 18px', border: 'none', borderRadius: '10px', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                    {stripeAccountId ? 'Uppdatera Stripe-onboarding' : 'Anslut Stripe'}
                  </button>
                </div>
              </div>

              <Field label="Fakturafotnot" hint="Valfri text som visas längst ner på fakturan.">
                <textarea value={formData.invoiceFooter || ''} rows={2} {...inputProps('invoiceFooter')} placeholder="T.ex. Betalningsvillkor: 30 dagar netto. Dröjsmålsränta: 8%." style={{ ...getInputStyle('invoiceFooter'), resize: 'none' }} />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
                <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 22px', background: saved ? '#5ba85a' : '#3a8fc1', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', minWidth: '130px', justifyContent: 'center' }}>
                  {saved ? <><Check size={14} /> Sparat!</> : <><Save size={14} /> Spara ändringar</>}
                </button>
              </div>
            </form>
          )}

          {/* ── ANVÄNDARE ── */}
          {activeSection === 'users' && (
            <div>
              <SectionHeader icon={Users} title="Användare & Åtkomst" subtitle="Hantera vem som har tillgång till ditt företag." />

              {/* Current user */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #3a8fc1, #5ba85a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
                  {(company?.name || 'D')[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{company?.name || 'Ägare'}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{company?.email || 'Kontoägare'}</div>
                </div>
                <span style={{ padding: '3px 10px', background: '#eef6fb', color: '#3a8fc1', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700 }}>Administratör</span>
              </div>

              {/* Invite accountant */}
              <div style={{ padding: '20px', background: 'linear-gradient(135deg, #fafafa, #f0fdf4)', border: '1px dashed #bce4bc', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f1f8f1', border: '2px dashed #bce4bc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#5ba85a' }}>
                  <Users size={18} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827', marginBottom: '4px' }}>Bjud in din redovisningskonsult</div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', maxWidth: '320px', margin: '4px auto 16px' }}>
                  Ge din konsult läs- eller redigeringstillgång. De får en egen inloggning.
                </p>
                <button onClick={() => alert('Inbjudan har skickats till din konsult!')} style={{ padding: '9px 20px', background: '#5ba85a', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Bjud in via e-post
                </button>
              </div>
            </div>
          )}

          {/* ── PRENUMERATION ── */}
          {activeSection === 'subscription' && (
            <div>
              <SectionHeader icon={Star} title="Prenumeration" subtitle="Din nuvarande plan och statistik." />

              {/* Plan card */}
              <div style={{ background: 'linear-gradient(135deg, #3a8fc1, #2563eb)', borderRadius: '14px', padding: '24px', color: 'white', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ position: 'absolute', bottom: '-30px', left: '60%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: '8px' }}>Aktiv Plan</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '4px' }}>Nordström Pro</div>
                    <div style={{ fontSize: '13px', opacity: 0.8 }}>Nästa fakturering: 1 Aug 2026</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em' }}>599<span style={{ fontSize: '14px', fontWeight: 400, opacity: 0.75 }}> kr/mån</span></div>
                    <button onClick={() => alert('Funktionen för att uppgradera plan är för närvarande under utveckling.')} style={{ marginTop: '8px', padding: '6px 12px', background: 'white', color: '#3a8fc1', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Hantera prenumeration</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px', position: 'relative' }}>
                  {['Obegränsade fakturor', 'Auto-moms', 'Resultatrapporter', 'Lönehantering', 'Prioriterad support'].map(f => (
                    <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', fontSize: '12px' }}>
                      <Check size={11} /> {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <StatPill icon={Zap} label="Verifikationer" value={verifications.length} color="#d97706" bg="#fffbeb" />
                <StatPill icon={FileText} label="Fakturor" value={invoices.length} color="#3a8fc1" bg="#eef6fb" />
                <StatPill icon={Users} label="Kontakter" value={contacts.length} color="#5ba85a" bg="#f1f8f1" />
              </div>
            </div>
          )}

          {/* ── DATA & SÄKERHET ── */}
          {activeSection === 'data' && (
            <div>
              <SectionHeader icon={Database} title="Data & Säkerhet" subtitle="Exportera, importera eller återställ ditt konto." />

              {/* SIE Export */}
              <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Download size={15} style={{ color: '#5ba85a' }} />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Exportera till revisor (SIE4)</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Ladda ner din bokföring i det standardiserade formatet SIE-4, vilket din revisor kan importera.</p>
                  </div>
                  <button onClick={handleExportSIE} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}>
                    Ladda ner SIE4
                  </button>
                </div>
              </div>

              {/* Export */}
              <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Download size={15} style={{ color: '#3a8fc1' }} />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Exportera backup</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Ladda ner all din data som en JSON-fil. Kan importeras tillbaka om du behöver återställa.</p>
                  </div>
                  <button onClick={handleExport} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}>
                    Ladda ner JSON
                  </button>
                </div>
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <FileSpreadsheet size={15} style={{ color: '#3a8fc1' }} />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Exportera till SIE-4</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Ladda ner din bokföring i svensk standard (SIE-4) för att skicka till din revisor.</p>
                  </div>
                  <button onClick={handleSIE4Export} style={{ padding: '8px 16px', background: '#eef6fb', border: '1px solid #bfdbfe', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#1d4ed8', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}>
                    Ladda ner .se
                  </button>
                </div>
              </div>

              {/* Import */}
              <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Upload size={15} style={{ color: '#3a8fc1' }} />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Importera data</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Återställ från en tidigare exportfil. Befintlig data ersätts.</p>
                  </div>
                  <button onClick={() => setShowImport(!showImport)} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}>
                    {showImport ? 'Avbryt' : 'Importera'}
                  </button>
                </div>
                {showImport && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '8px' }}>Klistra in JSON-innehåll</label>
                    <textarea
                      rows={5} value={importText} onChange={e => setImportText(e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
                      placeholder='{"version":"2.0","verifications":[...]}'
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button onClick={handleImportSubmit} disabled={!importText.trim()} style={{ padding: '8px 16px', background: '#3a8fc1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: importText.trim() ? 'pointer' : 'not-allowed', opacity: importText.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>
                        Importera nu
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div style={{ padding: '20px', background: '#fff5f5', borderRadius: '12px', border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <AlertTriangle size={15} style={{ color: '#dc2626' }} />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#dc2626' }}>Danger Zone</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Återställer all data till demodata. Kan inte ångras.</p>
                  </div>
                  <button onClick={onReset} style={{ padding: '8px 16px', background: 'white', border: '1px solid #fca5a5', borderRadius: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#dc2626', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}>
                    Återställ demo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
