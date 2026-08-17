import React, { useState, useEffect } from 'react';
import { Plus, Search, CheckCircle2, XCircle, Users, Truck, ChevronDown, AlertTriangle } from 'lucide-react';
import { AccountSearch } from './shared/SearchInputs';
import { getCountryOptions, getDefaultCountry, SWEDEN } from '../utils/countries';
import { validateEmailList, isValidIban } from '../utils/validators';

// ─── Delade formulärstilar ─────────────────────────────────────────────────
const sectionStyle = { background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', padding: '20px', marginBottom: '16px' };
const sectionTitleStyle = { fontSize: '13px', fontWeight: 700, color: '#111', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.03em' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' };
const helpTextStyle = { fontSize: '12px', color: '#6b7280', marginTop: '6px', lineHeight: 1.5 };
const errorTextStyle = { fontSize: '12px', color: '#dc2626', marginTop: '6px' };
const warningBoxStyle = { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '12.5px', color: '#92400e', marginTop: '8px', lineHeight: 1.5 };
const inputBase = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: '8px', fontSize: '14px', color: '#111',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color 0.15s'
};
function inputStyle(hasError) { return { ...inputBase, borderColor: hasError ? '#ef4444' : '#d1d5db' }; }
// gridTemplateColumns lever i CSS-klassen .form-row-2 (index.css) istället
// för här, så den mobila 1-kolumns-överskrivningen (@media max-width 768px)
// faktiskt kan träffa — en inline style-egenskap kan aldrig nås av en
// media query. Se klassnamnet på varje <div className="form-row-2" style={grid2}> nedan.
const grid2 = { display: 'grid', gap: '16px' };

function Section({ title, children }) {
  return (
    <div style={sectionStyle}>
      {title && <h3 style={sectionTitleStyle}>{title}</h3>}
      {children}
    </div>
  );
}

// ─── Kundformulär (Sida 9) ─────────────────────────────────────────────────
const CUSTOMER_TYPES = [
  { id: 'se_company', label: 'Svenskt företag eller organisation' },
  { id: 'se_individual', label: 'Privatperson (Sverige)' },
  { id: 'eu_company', label: 'EU-företag' },
  { id: 'non_eu_company', label: 'Företag utanför EU' },
];

function emptyCustomer() {
  return {
    type: 'customer', customerType: 'se_company', name: '', customerNumber: '',
    contactPerson: '', email: '', phone: '', ccEmails: '', bccEmails: '',
    address: '', postalCode: '', city: '', country: SWEDEN,
    orgNr: '', vatNumber: '', paymentTerms: 30, invoiceLanguage: 'sv',
    notes: '', active: true,
  };
}

function CustomerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...emptyCustomer(), ...initial } : emptyCustomer());
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTypeChange = (customerType) => {
    setForm(f => ({ ...f, customerType, country: getDefaultCountry(customerType) }));
  };

  const isEuNoVat = form.customerType === 'eu_company' && !form.vatNumber.trim();
  const orgNrRequired = form.customerType !== 'se_individual';
  const countryOptions = getCountryOptions(form.customerType);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Namn krävs.';
    if (orgNrRequired && !form.orgNr.trim()) errs.orgNr = 'Organisationsnummer krävs för denna kundtyp.';
    const cc = validateEmailList(form.ccEmails);
    if (!cc.valid) errs.ccEmails = `Ogiltig adress: ${cc.invalid}`;
    const bcc = validateEmailList(form.bccEmails);
    if (!bcc.valid) errs.bccEmails = `Ogiltig adress: ${bcc.invalid}`;
    if (form.email && !validateEmailList(form.email).valid) errs.email = 'Ogiltig e-postadress.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  const vatNote = {
    se_company: 'Normal svensk moms (25/12/6 procent) på alla rader, precis som standard.',
    se_individual: 'Normal svensk moms, identiskt med svenskt företag.',
    eu_company: form.vatNumber.trim()
      ? 'Omvänd skattskyldighet tillämpas: fakturarader får 0 procent svensk moms, med texten "Omvänd skattskyldighet, köparen redovisar moms" i fakturans fotnot.'
      : null,
    non_eu_company: 'Momsfri export — 0 procent moms som förval på fakturarader, med hänvisning till gällande momslagstiftning i fotnoten.',
  }[form.customerType];

  return (
    <form onSubmit={handleSubmit}>
      <Section title="Kundtyp">
        <select value={form.customerType} onChange={e => handleTypeChange(e.target.value)} style={{ ...inputBase, background: 'white' }}>
          {CUSTOMER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <p style={helpTextStyle}>Kundtypen påverkar hur moms hanteras på fakturor.</p>
        {vatNote && <p style={helpTextStyle}>{vatNote}</p>}
        {isEuNoVat && (
          <div style={warningBoxStyle}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Utan VAT-nummer kan omvänd skattskyldighet inte tillämpas, svensk moms läggs på fakturan.</span>
          </div>
        )}
      </Section>

      <Section title="Grunduppgifter">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Namn *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle(errors.name)} placeholder="Exempelföretag AB" />
            {errors.name && <div style={errorTextStyle}>{errors.name}</div>}
          </div>
          <div>
            <label style={labelStyle}>Kundnummer</label>
            <input type="text" value={form.customerNumber} onChange={e => set('customerNumber', e.target.value)} style={inputBase} />
            <p style={helpTextStyle}>Visas på fakturan. Lämna tomt om du inte använder kundnummer.</p>
          </div>
        </div>
      </Section>

      <Section title="Kontakt">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Kontaktperson</label>
            <input type="text" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>E-post</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle(errors.email)} placeholder="epost@foretag.se" />
            {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} style={inputBase} placeholder="070-123 45 67" />
          </div>
        </div>
      </Section>

      <Section title="Extra mottagare av fakturor">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Kopia (CC)</label>
            <input type="text" value={form.ccEmails} onChange={e => set('ccEmails', e.target.value)} style={inputStyle(errors.ccEmails)} placeholder="kalle@företag.se, anna@företag.se" />
            {errors.ccEmails && <div style={errorTextStyle}>{errors.ccEmails}</div>}
          </div>
          <div>
            <label style={labelStyle}>Dold kopia (BCC)</label>
            <input type="text" value={form.bccEmails} onChange={e => set('bccEmails', e.target.value)} style={inputStyle(errors.bccEmails)} placeholder="ekonomi@företag.se" />
            {errors.bccEmails && <div style={errorTextStyle}>{errors.bccEmails}</div>}
          </div>
        </div>
        <p style={helpTextStyle}>Dessa mottagare läggs automatiskt till när en faktura skickas till kunden. Flera adresser separeras med kommatecken.</p>
      </Section>

      <Section title="Adress">
        <div className="form-row-2" style={grid2}>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Gatuadress</label>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Postnummer</label>
            <input type="text" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Ort</label>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} style={inputBase} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Land</label>
            <select value={form.country} onChange={e => set('country', e.target.value)} style={{ ...inputBase, background: 'white' }}>
              {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Företagsuppgifter">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Organisationsnummer{orgNrRequired ? ' *' : ''}</label>
            <input type="text" value={form.orgNr} onChange={e => set('orgNr', e.target.value)} style={inputStyle(errors.orgNr)} required={orgNrRequired} placeholder="XXXXXX-XXXX" />
            {errors.orgNr && <div style={errorTextStyle}>{errors.orgNr}</div>}
          </div>
          <div>
            <label style={labelStyle}>Betalningsvillkor (dagar)</label>
            <input type="number" value={form.paymentTerms} onChange={e => set('paymentTerms', Number(e.target.value))} style={inputBase} min={0} />
          </div>
          {form.customerType === 'eu_company' && (
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={labelStyle}>VAT-nummer</label>
              <input type="text" value={form.vatNumber} onChange={e => set('vatNumber', e.target.value)} style={inputBase} placeholder="SE556677889901" />
            </div>
          )}
        </div>
      </Section>

      <Section title="Fakturaspråk">
        <select value={form.invoiceLanguage} onChange={e => set('invoiceLanguage', e.target.value)} style={{ ...inputBase, background: 'white' }}>
          <option value="sv">Svenska</option>
          <option value="en">Engelska</option>
        </select>
        <p style={helpTextStyle}>Fakturor och e-post till denna kund skickas på det valda språket. Påverkar inte hur fakturan bokförs.</p>
      </Section>

      <Section title="Anteckningar">
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputBase, minHeight: '80px', resize: 'vertical' }} placeholder="Syns endast internt, aldrig på fakturor eller i e-post till kunden." />
      </Section>

      <FormActions onCancel={onCancel} label="kund" />
    </form>
  );
}

// ─── Leverantörsformulär (Sida 10) ─────────────────────────────────────────
const SUPPLIER_TYPES = [
  { id: 'se_company', label: 'Svenskt företag eller organisation' },
  { id: 'eu_company', label: 'EU-företag' },
  { id: 'non_eu_company', label: 'Företag utanför EU' },
];
const CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK'];

function emptySupplier() {
  return {
    type: 'supplier', supplierType: 'se_company', name: '',
    contactPerson: '', email: '', phone: '',
    address: '', postalCode: '', city: '', country: SWEDEN,
    orgNr: '', vatNumber: '',
    bankgiro: '', plusgiro: '', clearingNumber: '', accountNumber: '', iban: '', swift: '',
    showMorePayment: false,
    defaultAccount: '', defaultCurrency: 'SEK',
    notes: '', active: true,
  };
}

function SupplierForm({ initial, onSave, onCancel, accounts }) {
  const [form, setForm] = useState(initial ? { ...emptySupplier(), ...initial } : emptySupplier());
  const [errors, setErrors] = useState({});
  const isNew = !initial;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTypeChange = (supplierType) => {
    setForm(f => ({
      ...f,
      supplierType,
      country: getDefaultCountry(supplierType),
      // Trevlig detalj: föreslå rimlig standardvaluta, men lämna fritt ändringsbar
      defaultCurrency: isNew ? (supplierType === 'se_company' ? 'SEK' : (supplierType === 'eu_company' ? 'EUR' : f.defaultCurrency)) : f.defaultCurrency,
    }));
  };

  const isSwedish = form.supplierType === 'se_company';
  const countryOptions = getCountryOptions(form.supplierType);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Namn krävs.';
    if (!form.orgNr.trim()) errs.orgNr = 'Organisationsnummer krävs.';
    if (!isSwedish && form.iban.trim() && !isValidIban(form.iban)) {
      errs.iban = 'Ogiltigt IBAN-format för valt land.';
    }
    if (form.email && !validateEmailList(form.email).valid) errs.email = 'Ogiltig e-postadress.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Section title="Leverantörstyp">
        <select value={form.supplierType} onChange={e => handleTypeChange(e.target.value)} style={{ ...inputBase, background: 'white' }}>
          {SUPPLIER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <p style={helpTextStyle}>Ingående moms för leverantörsfakturor hanteras separat i flödet för Kvitto och utgifter.</p>
      </Section>

      <Section title="Grunduppgifter">
        <div className="form-row-2" style={grid2}>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Namn *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle(errors.name)} placeholder="Exempelföretag AB" />
            {errors.name && <div style={errorTextStyle}>{errors.name}</div>}
          </div>
        </div>
      </Section>

      <Section title="Kontakt">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Kontaktperson</label>
            <input type="text" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>E-post</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle(errors.email)} />
            {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} style={inputBase} />
          </div>
        </div>
      </Section>

      <Section title="Företagsuppgifter">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Organisationsnummer *</label>
            <input type="text" value={form.orgNr} onChange={e => set('orgNr', e.target.value)} style={inputStyle(errors.orgNr)} required />
            {errors.orgNr && <div style={errorTextStyle}>{errors.orgNr}</div>}
          </div>
          {!isSwedish && (
            <div>
              <label style={labelStyle}>VAT-nummer</label>
              <input type="text" value={form.vatNumber} onChange={e => set('vatNumber', e.target.value)} style={inputBase} />
            </div>
          )}
        </div>
      </Section>

      <Section title="Adress">
        <div className="form-row-2" style={grid2}>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Gatuadress</label>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Postnummer</label>
            <input type="text" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Ort</label>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} style={inputBase} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Land</label>
            <select value={form.country} onChange={e => set('country', e.target.value)} style={{ ...inputBase, background: 'white' }}>
              {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Betalningsuppgifter">
        {isSwedish ? (
          <>
            <div className="form-row-2" style={grid2}>
              <div>
                <label style={labelStyle}>Bankgiro</label>
                <input type="text" value={form.bankgiro} onChange={e => set('bankgiro', e.target.value)} style={inputBase} placeholder="123-4567" />
              </div>
              <div>
                <label style={labelStyle}>Plusgiro</label>
                <input type="text" value={form.plusgiro} onChange={e => set('plusgiro', e.target.value)} style={inputBase} placeholder="12 34 56-7" />
              </div>
            </div>
            <button type="button" onClick={() => set('showMorePayment', !form.showMorePayment)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#1a3028', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '10px 0 0' }}>
              <ChevronDown size={14} style={{ transform: form.showMorePayment ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              Fler betalningsalternativ
            </button>
            {form.showMorePayment && (
              <div className="form-row-2" style={{ ...grid2, marginTop: '12px' }}>
                <div>
                  <label style={labelStyle}>Clearingnummer</label>
                  <input type="text" value={form.clearingNumber} onChange={e => set('clearingNumber', e.target.value)} style={inputBase} />
                </div>
                <div>
                  <label style={labelStyle}>Kontonummer</label>
                  <input type="text" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} style={inputBase} />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-row-2" style={grid2}>
              <div>
                <label style={labelStyle}>IBAN</label>
                <input type="text" value={form.iban} onChange={e => set('iban', e.target.value)} style={inputStyle(errors.iban)} placeholder="DE89 3704 0044 0532 0130 00" />
                {errors.iban && <div style={errorTextStyle}>{errors.iban}</div>}
              </div>
              <div>
                <label style={labelStyle}>SWIFT/BIC</label>
                <input type="text" value={form.swift} onChange={e => set('swift', e.target.value.toUpperCase())} style={inputBase} placeholder="COBADEFFXXX" />
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title="Standardkonto">
        <AccountSearch value={form.defaultAccount} onChange={code => set('defaultAccount', code)} accounts={accounts || []} placeholder="Sök konto, t.ex. 4010..." />
        <p style={helpTextStyle}>Föreslås automatiskt vid kontering av nya leverantörsfakturor från denna leverantör, men är alltid redigerbart per faktura.</p>
      </Section>

      <Section title="Standardvaluta">
        <select value={form.defaultCurrency} onChange={e => set('defaultCurrency', e.target.value)} style={{ ...inputBase, background: 'white' }}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Section>

      <Section title="Anteckningar">
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputBase, minHeight: '80px', resize: 'vertical' }} placeholder="Syns endast internt." />
      </Section>

      <FormActions onCancel={onCancel} label="leverantör" />
    </form>
  );
}

function FormActions({ onCancel, label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '4px' }}>
      <button type="button" onClick={onCancel} style={{ padding: '9px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
        Avbryt
      </button>
      <button type="submit" style={{ padding: '9px 18px', background: '#1a3028', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
        Spara {label}
      </button>
    </div>
  );
}

// ─── Huvudkomponent ─────────────────────────────────────────────────────────
export default function Contacts({ contacts, setContacts, accounts = [], globalAction, clearGlobalAction }) {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'supplier'
  const [searchTerm, setSearchTerm] = useState('');
  const [viewState, setViewState] = useState('list'); // 'list' | 'new' | 'edit'
  const [selectedContact, setSelectedContact] = useState(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('contacts')) {
        const params = new URLSearchParams(hash.split('?')[1]);
        setActiveTab(params.get('tab') === 'supplier' ? 'supplier' : 'customer');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSetTab = (tab) => {
    setActiveTab(tab);
    setViewState('list');
    setSearchTerm('');
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#contacts?tab=${tab}`);
  };

  useEffect(() => {
    if (globalAction?.type === 'new_contact') {
      setSelectedContact(null);
      setActiveTab('customer');
      setViewState('new');
      clearGlobalAction();
    }
  }, [globalAction, clearGlobalAction]);

  const openNewForm = (type = activeTab) => {
    setSelectedContact(null);
    setActiveTab(type);
    setViewState('new');
  };

  const openDetail = (contact) => {
    setSelectedContact(contact);
    setViewState('edit');
  };

  const handleSaveCustomer = (data) => {
    if (viewState === 'new') {
      setContacts(prev => [...prev, { id: `contact_${Date.now()}`, balance: 0, lastInvoiceDate: null, totalInvoicedThisYear: 0, ...data }]);
    } else {
      setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, ...data } : c));
    }
    setActiveTab('customer');
    setViewState('list');
  };

  const handleSaveSupplier = (data) => {
    if (viewState === 'new') {
      setContacts(prev => [...prev, { id: `contact_${Date.now()}`, balance: 0, lastInvoiceDate: null, totalInvoicedThisYear: 0, ...data }]);
    } else {
      setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, ...data } : c));
    }
    setActiveTab('supplier');
    setViewState('list');
  };

  const filtered = contacts.filter(c => c.type === activeTab).filter(c => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.orgNr?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s)
    );
  });

  const title = activeTab === 'customer' ? 'Kunder' : 'Leverantörer';
  const newBtnText = activeTab === 'customer' ? 'Ny kund' : 'Ny leverantör';
  const entityCount = contacts.filter(c => c.type === activeTab).length;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      {/* ── Header & Tabs ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '0 20px', flexShrink: 0 }}>
        {/* Sida 38, punkt 6 */}
        <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{title}</h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>
              {entityCount} {activeTab === 'customer' ? (entityCount === 1 ? 'kund' : 'kunder') : (entityCount === 1 ? 'leverantör' : 'leverantörer')}
            </p>
          </div>
          {viewState === 'list' && (
            <button onClick={() => openNewForm(activeTab)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: '#2e7d32', border: 'none', borderRadius: '5px', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              <Plus size={14} /> {newBtnText}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: '12px' }}>
          {[{ id: 'customer', label: 'Kunder' }, { id: 'supplier', label: 'Leverantörer' }].map(t => (
            <button key={t.id} onClick={() => handleSetTab(t.id)} style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? '#1a3028' : '#666',
              background: 'none',
              borderBottom: activeTab === t.id ? '3px solid #1a3028' : '3px solid transparent',
              marginBottom: '-1px',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Content Area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {viewState === 'list' ? (
          <>
            {filtered.length > 0 || searchTerm ? (
              <>
                {/* .page-header-row (Sida 38, punkt 6) */}
                <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input type="text" placeholder={`Sök ${activeTab === 'customer' ? 'kund' : 'leverantör'}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '9px 12px 9px 36px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '260px', background: 'white' }} />
                  </div>
                </div>

                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
                  {/* .responsive-table (Sida 38, punkt 1, komplettering — se
                      samma kommentar i SupplierInvoices.jsx) */}
                  <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Namn', 'Org.nummer', 'Kontaktperson', activeTab === 'customer' ? 'Senaste faktura' : 'Senaste inköp', activeTab === 'customer' ? 'Fakturerat i år' : 'Inköpt i år', 'Status'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e4e4e7', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                            Ingen matchade sökningen
                          </td>
                        </tr>
                      ) : filtered.map((c, i) => (
                        <tr
                          key={c.id}
                          onClick={() => openDetail(c)}
                          style={{
                            borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                            cursor: 'pointer', transition: 'background 0.1s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <td data-label="Namn" style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: 34, height: 34, borderRadius: '8px',
                                background: '#1a3028',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0
                              }}>
                                {(c.name || 'K').charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 600, color: '#111', fontSize: '14px' }}>{c.name}</span>
                            </div>
                          </td>
                          <td data-label="Org.nummer" style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>{c.orgNr || '—'}</td>
                          <td data-label="Kontaktperson" style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>{c.contactPerson || c.email || '—'}</td>
                          <td data-label={activeTab === 'customer' ? 'Senaste faktura' : 'Senaste inköp'} style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>{c.lastInvoiceDate || '—'}</td>
                          <td data-label={activeTab === 'customer' ? 'Fakturerat i år' : 'Inköpt i år'} style={{ padding: '14px 16px', color: '#111', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {c.totalInvoicedThisYear
                              ? new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(c.totalInvoicedThisYear)
                              : '0 kr'}
                          </td>
                          <td data-label="Status" style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                              background: c.active !== false ? '#dcfce7' : '#f3f4f6',
                              color: c.active !== false ? '#15803d' : '#6b7280'
                            }}>
                              {c.active !== false ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              {c.active !== false ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ padding: '64px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#94a3b8' }}>
                  {activeTab === 'customer' ? <Users size={32} /> : <Truck size={32} />}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#111' }}>
                  {activeTab === 'customer' ? 'Inga kunder ännu' : 'Inga leverantörer ännu'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Lägg till din första {activeTab === 'customer' ? 'kund' : 'leverantör'} för att komma igång
                </p>
                <button onClick={() => openNewForm(activeTab)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={16} /> {newBtnText}
                </button>
              </div>
            )}
          </>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setViewState('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', padding: 0 }}>← Tillbaka</button>
              <span style={{ color: '#d1d5db' }}>|</span>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111' }}>
                {viewState === 'new'
                  ? (activeTab === 'customer' ? 'Ny kund' : 'Ny leverantör')
                  : (activeTab === 'customer' ? 'Redigera kund' : 'Redigera leverantör')}
              </h2>
            </div>

            {activeTab === 'customer' ? (
              <CustomerForm
                initial={viewState === 'edit' ? selectedContact : null}
                onSave={handleSaveCustomer}
                onCancel={() => setViewState('list')}
              />
            ) : (
              <SupplierForm
                initial={viewState === 'edit' ? selectedContact : null}
                onSave={handleSaveSupplier}
                onCancel={() => setViewState('list')}
                accounts={accounts}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
