import React, { useState, useEffect, useRef } from 'react';
import { Plus, CheckCircle2, XCircle, Users, Truck, ChevronDown, AlertTriangle, Download, Upload, Check, Search, Trash2, Power } from './icons';
import { AccountSearch } from './shared/SearchInputs';
import ListPageHeader, { ListFilterBar, listSearchInputStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { getCountryOptions, getDefaultCountry, SWEDEN, countryLabel } from '../utils/countries';
import { validateEmailList, isValidIban } from '../utils/validators';
import { contactsToCsv, csvToContacts, downloadCsv } from '../utils/csvRegister';
import { BRAND } from '../utils/brandColors';
import { confirmDialog } from './shared/ConfirmDialog';
import { useMobileForm, MobileFormBar } from './shared/MobileForm';
import { t, useTranslation, getLanguage } from '../i18n';

// Texterna finns under contacts.* i src/i18n/sv.json och en.json.
const c = (key, vars) => t(`contacts.${key}`, vars);

// ─── Delade formulärstilar ─────────────────────────────────────────────────
const sectionStyle = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', marginBottom: '16px' };
const sectionTitleStyle = { fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.03em' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const helpTextStyle = { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 };
const errorTextStyle = { fontSize: '12px', color: 'var(--status-red-text)', marginTop: '6px' };
const warningBoxStyle = { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', fontSize: '12.5px', color: 'var(--status-amber-text)', marginTop: '8px', lineHeight: 1.5 };
const inputBase = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: '8px', fontSize: '14px', color: 'var(--text-main)',
  background: 'var(--bg-card)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color 0.15s'
};
function inputStyle(hasError) { return { ...inputBase, borderColor: hasError ? '#ef4444' : 'var(--border)' }; }
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
  { id: 'se_company', labelKey: 'types.seCompany' },
  { id: 'se_individual', labelKey: 'types.seIndividual' },
  { id: 'eu_company', labelKey: 'types.euCompany' },
  { id: 'non_eu_company', labelKey: 'types.nonEuCompany' },
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
  // Privatperson: namn och personnummer i stället för företagsfält.
  // Uppgifterna skrivs in för hand, inget uppslag i bolagsregistret
  // (kundönskemål 2026-09-27).
  const isPerson = form.customerType === 'se_individual';

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = c('errors.nameRequired');
    if (orgNrRequired && !form.orgNr.trim()) errs.orgNr = c('errors.orgNrRequiredForType');
    const cc = validateEmailList(form.ccEmails);
    if (!cc.valid) errs.ccEmails = c('errors.invalidAddress', { address: cc.invalid });
    const bcc = validateEmailList(form.bccEmails);
    if (!bcc.valid) errs.bccEmails = c('errors.invalidAddress', { address: bcc.invalid });
    if (form.email && !validateEmailList(form.email).valid) errs.email = c('errors.invalidEmail');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  const vatNote = {
    se_company: c('vatNote.seCompany'),
    se_individual: c('vatNote.seIndividual'),
    eu_company: form.vatNumber.trim() ? c('vatNote.euCompany') : null,
    non_eu_company: c('vatNote.nonEuCompany'),
  }[form.customerType];

  return (
    <form id="contact-form" onSubmit={handleSubmit}>
      <Section title={c('sections.customerType')}>
        <select value={form.customerType} onChange={e => handleTypeChange(e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
          {CUSTOMER_TYPES.map(o => <option key={o.id} value={o.id}>{c(o.labelKey)}</option>)}
        </select>
        <p style={helpTextStyle}>{c('help.customerType')}</p>
        {vatNote && <p style={helpTextStyle}>{vatNote}</p>}
        {isEuNoVat && (
          <div style={warningBoxStyle}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{c('help.euNoVat')}</span>
          </div>
        )}
      </Section>

      <Section title={c('sections.basics')}>
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{isPerson ? c('fields.personName') : c('fields.name')}</label>
            <input data-tour="page-contacts-field" type="text" value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle(errors.name)} placeholder={isPerson ? c('placeholders.personName') : c('placeholders.companyName')} />
            {errors.name && <div style={errorTextStyle}>{errors.name}</div>}
          </div>
          <div>
            <label style={labelStyle}>{c('fields.customerNumber')}</label>
            <input type="text" value={form.customerNumber} onChange={e => set('customerNumber', e.target.value)} style={inputBase} />
            <p style={helpTextStyle}>{c('help.customerNumber')}</p>
          </div>
        </div>
      </Section>

      <Section title={c('sections.contact')}>
        <div className="form-row-2" style={grid2}>
          {!isPerson && (
            <div>
              <label style={labelStyle}>{c('fields.contactPerson')}</label>
              <input type="text" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} style={inputBase} />
            </div>
          )}
          <div>
            <label style={labelStyle}>{c('fields.email')}</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle(errors.email)} placeholder={isPerson ? c('placeholders.personEmail') : c('placeholders.email')} />
            {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
          </div>
          <div>
            <label style={labelStyle}>{c('fields.phone')}</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} style={inputBase} placeholder="070-123 45 67" />
          </div>
        </div>
      </Section>

      <Section title={c('sections.extraRecipients')}>
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{c('fields.cc')}</label>
            <input type="text" value={form.ccEmails} onChange={e => set('ccEmails', e.target.value)} style={inputStyle(errors.ccEmails)} placeholder={c('placeholders.cc')} />
            {errors.ccEmails && <div style={errorTextStyle}>{errors.ccEmails}</div>}
          </div>
          <div>
            <label style={labelStyle}>{c('fields.bcc')}</label>
            <input type="text" value={form.bccEmails} onChange={e => set('bccEmails', e.target.value)} style={inputStyle(errors.bccEmails)} placeholder={c('placeholders.bcc')} />
            {errors.bccEmails && <div style={errorTextStyle}>{errors.bccEmails}</div>}
          </div>
        </div>
        <p style={helpTextStyle}>{c('help.extraRecipients')}</p>
      </Section>

      <Section title={c('sections.address')}>
        <div className="form-row-2" style={grid2}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{c('fields.street')}</label>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{c('fields.postalCode')}</label>
            <input type="text" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{c('fields.city')}</label>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} style={inputBase} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{c('fields.country')}</label>
            <select value={form.country} onChange={e => set('country', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {countryOptions.map(name => <option key={name} value={name}>{countryLabel(name, getLanguage())}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title={isPerson ? c('sections.personDetails') : c('sections.companyDetails')}>
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{isPerson ? c('fields.personalNumber') : c('fields.orgNr')}{orgNrRequired ? ' *' : ''}</label>
            <input
              type="text" value={form.orgNr}
              onChange={e => set('orgNr', e.target.value)}
              style={inputStyle(errors.orgNr)} required={orgNrRequired} placeholder={isPerson ? 'ÅÅÅÅMMDD-XXXX' : 'XXXXXX-XXXX'}
            />
            {errors.orgNr && <div style={errorTextStyle}>{errors.orgNr}</div>}
          </div>
          <div>
            <label style={labelStyle}>{c('fields.paymentTerms')}</label>
            <input type="number" value={form.paymentTerms} onChange={e => set('paymentTerms', Number(e.target.value))} style={inputBase} min={0} />
          </div>
          {form.customerType === 'eu_company' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>{c('fields.vatNumber')}</label>
              <input type="text" value={form.vatNumber} onChange={e => set('vatNumber', e.target.value)} style={inputBase} placeholder="SE556677889901" />
            </div>
          )}
        </div>
      </Section>

      <Section title={c('sections.invoiceLanguage')}>
        <select value={form.invoiceLanguage} onChange={e => set('invoiceLanguage', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
          <option value="sv">{c('fields.swedish')}</option>
          <option value="en">{c('fields.english')}</option>
        </select>
        <p style={helpTextStyle}>{c('help.invoiceLanguage')}</p>
      </Section>

      <Section title={c('sections.notes')}>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputBase, minHeight: '80px', resize: 'vertical' }} placeholder={c('help.notesCustomer')} />
      </Section>

      <FormActions onCancel={onCancel} saveLabel={c('actions.saveCustomer')} formId="contact-form" />
    </form>
  );
}

// ─── Leverantörsformulär (Sida 10) ─────────────────────────────────────────
const SUPPLIER_TYPES = [
  { id: 'se_company', labelKey: 'types.seCompany' },
  { id: 'eu_company', labelKey: 'types.euCompany' },
  { id: 'non_eu_company', labelKey: 'types.nonEuCompany' },
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
    if (!form.name.trim()) errs.name = c('errors.nameRequired');
    if (!form.orgNr.trim()) errs.orgNr = c('errors.orgNrRequired');
    if (!isSwedish && form.iban.trim() && !isValidIban(form.iban)) {
      errs.iban = c('errors.invalidIban');
    }
    if (form.email && !validateEmailList(form.email).valid) errs.email = c('errors.invalidEmail');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  return (
    <form id="contact-form" onSubmit={handleSubmit}>
      <Section title={c('sections.supplierType')}>
        <select value={form.supplierType} onChange={e => handleTypeChange(e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
          {SUPPLIER_TYPES.map(o => <option key={o.id} value={o.id}>{c(o.labelKey)}</option>)}
        </select>
        <p style={helpTextStyle}>{c('help.supplierVat')}</p>
      </Section>

      <Section title={c('sections.basics')}>
        <div className="form-row-2" style={grid2}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{c('fields.name')}</label>
            <input data-tour="page-contacts-field" type="text" value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle(errors.name)} placeholder={c('placeholders.companyName')} />
            {errors.name && <div style={errorTextStyle}>{errors.name}</div>}
          </div>
        </div>
      </Section>

      <Section title={c('sections.contact')}>
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{c('fields.contactPerson')}</label>
            <input type="text" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{c('fields.email')}</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle(errors.email)} />
            {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
          </div>
          <div>
            <label style={labelStyle}>{c('fields.phone')}</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} style={inputBase} />
          </div>
        </div>
      </Section>

      <Section title={c('sections.companyDetails')}>
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{c('fields.orgNr')} *</label>
            <input
              type="text" value={form.orgNr}
              onChange={e => set('orgNr', e.target.value)}
              style={inputStyle(errors.orgNr)} required placeholder="XXXXXX-XXXX"
            />
            {errors.orgNr && <div style={errorTextStyle}>{errors.orgNr}</div>}
          </div>
          {!isSwedish && (
            <div>
              <label style={labelStyle}>{c('fields.vatNumber')}</label>
              <input type="text" value={form.vatNumber} onChange={e => set('vatNumber', e.target.value)} style={inputBase} />
            </div>
          )}
        </div>
      </Section>

      <Section title={c('sections.address')}>
        <div className="form-row-2" style={grid2}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{c('fields.street')}</label>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{c('fields.postalCode')}</label>
            <input type="text" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{c('fields.city')}</label>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} style={inputBase} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{c('fields.country')}</label>
            <select value={form.country} onChange={e => set('country', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {countryOptions.map(name => <option key={name} value={name}>{countryLabel(name, getLanguage())}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title={c('sections.payment')}>
        {isSwedish ? (
          <>
            <div className="form-row-2" style={grid2}>
              <div>
                <label style={labelStyle}>{t('ui.bankgiro')}</label>
                <input type="text" value={form.bankgiro} onChange={e => set('bankgiro', e.target.value)} style={inputBase} placeholder="123-4567" />
              </div>
              <div>
                <label style={labelStyle}>{t('ui.plusgiro')}</label>
                <input type="text" value={form.plusgiro} onChange={e => set('plusgiro', e.target.value)} style={inputBase} placeholder="12 34 56-7" />
              </div>
            </div>
            <button type="button" onClick={() => set('showMorePayment', !form.showMorePayment)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '10px 0 0' }}>
              <ChevronDown size={14} style={{ transform: form.showMorePayment ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              {c('fields.morePayment')}
            </button>
            {form.showMorePayment && (
              <div className="form-row-2" style={{ ...grid2, marginTop: '12px' }}>
                <div>
                  <label style={labelStyle}>{c('fields.clearing')}</label>
                  <input type="text" value={form.clearingNumber} onChange={e => set('clearingNumber', e.target.value)} style={inputBase} />
                </div>
                <div>
                  <label style={labelStyle}>{c('fields.accountNumber')}</label>
                  <input type="text" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} style={inputBase} />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-row-2" style={grid2}>
              <div>
                <label style={labelStyle}>{t('ui.iban')}</label>
                <input type="text" value={form.iban} onChange={e => set('iban', e.target.value)} style={inputStyle(errors.iban)} placeholder="DE89 3704 0044 0532 0130 00" />
                {errors.iban && <div style={errorTextStyle}>{errors.iban}</div>}
              </div>
              <div>
                <label style={labelStyle}>{t('ui.swift_bic')}</label>
                <input type="text" value={form.swift} onChange={e => set('swift', e.target.value.toUpperCase())} style={inputBase} placeholder="COBADEFFXXX" />
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title={c('sections.defaultAccount')}>
        <AccountSearch value={form.defaultAccount} onChange={code => set('defaultAccount', code)} accounts={accounts || []} placeholder={c('help.searchAccount')} />
        <p style={helpTextStyle}>{c('help.defaultAccount')}</p>
      </Section>

      <Section title={c('sections.defaultCurrency')}>
        <select value={form.defaultCurrency} onChange={e => set('defaultCurrency', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Section>

      <Section title={c('sections.notes')}>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputBase, minHeight: '80px', resize: 'vertical' }} placeholder={c('help.notesSupplier')} />
      </Section>

      <FormActions onCancel={onCancel} saveLabel={c('actions.saveSupplier')} formId="contact-form" />
    </form>
  );
}

// formId: spara-knappen på telefon ligger utanför <form> (MobileFormBar
// renderas i body), så den kopplas till formuläret med form-attributet.
function FormActions({ onCancel, saveLabel, formId }) {
  useMobileForm();
  return (
    <>
    <MobileFormBar>
      <button type="submit" form={formId} className="mform-bar-primary">{saveLabel}</button>
    </MobileFormBar>
    <div className="mform-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '4px' }}>
      <button type="button" data-tour="page-contacts-cancel" onClick={onCancel} style={{ padding: '9px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
        {c('actions.cancel')}
      </button>
      <button type="submit" style={{ padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
        {saveLabel}
      </button>
    </div>
    </>
  );
}

// ─── Huvudkomponent ─────────────────────────────────────────────────────────
export default function Contacts({ contacts, setContacts, accounts = [], invoices = [], quotes = [], expenses = [], globalAction, clearGlobalAction }) {
  // Renderar om när språket byts (Inställningar → Utseende → Språk).
  useTranslation();
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'supplier'
  const [searchTerm, setSearchTerm] = useState('');
  // Kundönskemål: "en knapp där man kan se femton, trettio, femtio" — en
  // visa-N-åt-gången-väljare, inte fullständig sidnumrering. 30 som förval,
  // samma "rimligt mellanläge"-tänk som ListFilterBar:s PAGE_SIZE_OPTIONS.
  const [pageSize, setPageSize] = useState(30);
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

  // Kundönskemål (Fortnox-paritet): en kontakt med kopplade
  // affärshändelser (fakturor/offerter/leverantörsfakturor) kan INTE
  // raderas helt — historiska dokument måste kunna peka på den. Bara en
  // kontakt UTAN någon sådan koppling kan tas bort permanent, precis
  // som Fortnox egen regel ("Kunder utan affärshändelser" vs "Kunder med
  // affärshändelser" i deras support).
  const hasBusinessHistory = (contact) => (
    invoices.some(inv => inv.customerId === contact.id) ||
    quotes.some(q => q.customerId === contact.id) ||
    expenses.some(e => e.type === 'supplier_invoice' && e.supplierId === contact.id)
  );

  const handleToggleActive = (contact) => {
    const nextActive = contact.active === false;
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, active: nextActive } : c));
    // Formuläret läser sitt startvärde ur selectedContact (se CustomerForm/
    // SupplierForm: `{ ...empty(), ...initial }`) — utan den här synkade
    // uppdateringen hade badgen i redigeringsvyn visat det gamla värdet
    // tills man lämnade och gick tillbaka.
    setSelectedContact(prev => (prev && prev.id === contact.id) ? { ...prev, active: nextActive } : prev);
  };

  const handleDeleteContact = async (contact) => {
    const isCustomer = contact.type === 'customer';
    if (hasBusinessHistory(contact)) {
      // Samma väg som Fortnox rekommenderar: förklara VARFÖR det inte går,
      // och erbjud den faktiska lösningen (inaktivera) direkt i samma
      // dialog istället för att bara blockera med ett dödläge.
      const setInactive = await confirmDialog(
        c(isCustomer ? 'dialogs.cannotDeleteCustomer' : 'dialogs.cannotDeleteSupplier', { name: contact.name || c(isCustomer ? 'dialogs.theCustomer' : 'dialogs.theSupplier') }),
        { title: c('dialogs.cannotDeleteTitle'), confirmLabel: c('dialogs.setInactive'), cancelLabel: c('dialogs.close') }
      );
      if (setInactive) {
        setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, active: false } : c));
        setViewState('list');
      }
      return;
    }
    if (!(await confirmDialog(
      c('dialogs.deleteConfirm', { name: contact.name || c(isCustomer ? 'dialogs.theCustomer' : 'dialogs.theSupplier').toLowerCase() }),
      { title: c(isCustomer ? 'dialogs.deleteCustomerTitle' : 'dialogs.deleteSupplierTitle'), confirmLabel: c('actions.delete'), danger: true }
    ))) return;
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    setViewState('list');
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
  // "Visa N åt gången" skär bara av VYN — export/import ovan använder
  // fortfarande hela `filtered`/den obeskurna listan, inte den här.
  const visible = pageSize === 'all' ? filtered : filtered.slice(0, pageSize);

  const isCustomerTab = activeTab === 'customer';
  const title = c(isCustomerTab ? 'list.customers' : 'list.suppliers');
  const newBtnText = c(isCustomerTab ? 'list.newCustomer' : 'list.newSupplier');
  // "1 kund" / "3 kunder" (och motsvarande för leverantörer).
  const countWord = (n) => c(isCustomerTab ? (n === 1 ? 'list.customerOne' : 'list.customerMany') : (n === 1 ? 'list.supplierOne' : 'list.supplierMany'));
  const entityCount = contacts.filter(c => c.type === activeTab).length;

  // ── Export/import av register (CSV) ──
  // Exporterar HELA aktiv flik (inte bara det sökfiltrerade urvalet) — en
  // sökning är en tillfällig vy, inte ett medvetet val av vilka som ska med
  // i en backup/flytt till ett annat system.
  const importFileRef = useRef(null);
  const [importMsg, setImportMsg] = useState(null); // { type: 'success'|'error', text }

  const handleExportCsv = () => {
    const list = contacts.filter(c => c.type === activeTab);
    const csv = contactsToCsv(activeTab, list);
    downloadCsv(`${activeTab === 'customer' ? 'kunder' : 'leverantorer'}_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const handleImportClick = () => importFileRef.current?.click();

  // Uppdaterar (matchar på kundnummer/org-/personnummer, annars namn) om
  // raden redan finns, annars lägger till en ny — samma idé som ett SIE-
  // import brukar göra, så en CSV kan importeras om flera gånger (t.ex. en
  // uppdaterad prislista) utan att skapa dubbletter varje gång.
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = csvToContacts(activeTab, ev.target.result);
        if (imported.length === 0) throw new Error(c('import.noRows'));
        let added = 0, updated = 0;
        setContacts(prev => {
          const next = [...prev];
          imported.forEach((item, i) => {
            // Varje kriterium är ett EGET villkor kombinerat med OR, inte en
            // kedja av tidiga return — annars avslutade ett kundnummer som
            // FANNS men skiljde sig (t.ex. omnumrerad kund sedan senaste
            // export) hela matchningen direkt, utan att ens pröva org-nr
            // eller namn på samma rad, och skapade en dublett istället för
            // att uppdatera.
            const matchIdx = next.findIndex(c => {
              if (c.type !== activeTab) return false;
              const byNumber = activeTab === 'customer' && item.customerNumber && c.customerNumber && item.customerNumber === c.customerNumber;
              const byOrgNr = item.orgNr && c.orgNr && item.orgNr === c.orgNr;
              const byName = c.name?.trim().toLowerCase() === item.name?.trim().toLowerCase();
              return byNumber || byOrgNr || byName;
            });
            const base = activeTab === 'customer' ? emptyCustomer() : emptySupplier();
            const merged = { ...base, ...item, type: activeTab, active: true };
            if (matchIdx === -1) {
              next.push({ id: `contact_${Date.now()}_${i}`, balance: 0, lastInvoiceDate: null, totalInvoicedThisYear: 0, ...merged });
              added++;
            } else {
              next[matchIdx] = { ...next[matchIdx], ...merged, id: next[matchIdx].id };
              updated++;
            }
          });
          return next;
        });
        setImportMsg({ type: 'success', text: c('import.result', { added, updated }) });
      } catch (err) {
        setImportMsg({ type: 'error', text: c('import.failed', { error: err.message }) });
      }
      setTimeout(() => setImportMsg(null), 6000);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      {/* ── Header & Tabs ── */}
      <ListPageHeader
        title={title}
        subtitle={`${entityCount} ${countWord(entityCount)}`}
        actions={viewState === 'list' ? [
          { key: 'export', label: c('actions.export'), icon: Download, onClick: handleExportCsv, title: c('actions.exportTitle', { what: title.toLowerCase() }) },
          { key: 'import', label: c('actions.import'), icon: Upload, onClick: handleImportClick, title: c('actions.importTitle', { what: title.toLowerCase() }) },
          { key: 'new', label: newBtnText, icon: Plus, onClick: () => openNewForm(activeTab), variant: 'primary', dataTour: 'page-contacts-cta' },
        ] : []}
        tabs={{
          items: [{ id: 'customer', label: c('list.customers') }, { id: 'supplier', label: c('list.suppliers') }],
          activeId: activeTab,
          onChange: handleSetTab,
        }}
      >
        <input type="file" ref={importFileRef} accept=".csv" style={{ display: 'none' }} onChange={handleImportFile} />
        {importMsg && (
          <div style={{ margin: '10px 0', padding: '8px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', background: importMsg.type === 'success' ? 'var(--status-green-bg)' : 'var(--status-red-bg)', color: importMsg.type === 'success' ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
            {importMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {importMsg.text}
          </div>
        )}
      </ListPageHeader>
      {/* Sökfältet ligger kvar i samma kort som resten av sidhuvudet
          (ListFilterBar, direkt under flikraden) — precis som Bokförings
          filterrad, istället för att flyta löst på sidbakgrunden. */}
      {viewState === 'list' && (
        <ListFilterBar
          count={filtered.length}
          countLabel={countWord(filtered.length)}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        >
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder={c(isCustomerTab ? 'list.searchCustomer' : 'list.searchSupplier')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={listSearchInputStyle} />
          </div>
        </ListFilterBar>
      )}

      {/* ── Content Area ──
          Ingen padding på YTTRE innehållsraden längre (kundfeedback:
          tabellen ska sitta flush direkt under filterraden, exakt samma
          "facit"-mönster som Bokföring/Verifikationer — se dess
          `<div style={{flex:1, overflowY:'auto'}}>` runt ListTable, ingen
          egen padding/kort-känsla). Tomt-läget och formuläret nedan har
          fortfarande SIN EGEN padding lokalt, eftersom de är fristående
          kort/formulär, inte en full-bredd-tabell. */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {viewState === 'list' ? (
          <>
            {filtered.length > 0 || searchTerm ? (
              /* Kundfeedback: en lista med resultat ska INTE centreras
                 lodrätt (försökte det — kändes bara fel, "sämst") — bara
                 det HELT tomma läget (grenen nedan) ska centreras. En
                 populerad (om än kort) lista ligger kvar uppe vid
                 sök/toppen, som en vanlig tabellsida. */
              <div style={{ width: '100%' }}>
                <ListTable
                  rowKey={ct => ct.id}
                  onRowClick={openDetail}
                  emptyMessage={c('list.noMatch')}
                  rows={visible}
                  mobileList={ct => ({
                    dot: ct.active !== false ? 'var(--status-green-text)' : 'var(--text-muted)',
                    primary: ct.name || c('list.unnamed'),
                    amount: ct.totalInvoicedThisYear
                      ? new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(ct.totalInvoicedThisYear)
                      : undefined,
                    // Kundfeedback (uppföljning): fälten fanns redan här, men
                    // utan etiketter — "556677-8899 · Anna Andersson · senast
                    // 2026-08-15" säger inte VILKET fält som är vad utan att
                    // man redan vet ordningen utantill. Korta etiketter på
                    // varje bit i stället, samma tre fält som desktoptabellens
                    // Org.nummer/Kontaktperson/Senaste faktura-kolumner.
                    meta: [
                      ct.orgNr ? c('list.metaOrgNr', { value: ct.orgNr }) : null,
                      ct.contactPerson ? c('list.metaContact', { value: ct.contactPerson }) : null,
                      ct.lastInvoiceDate ? `${c(isCustomerTab ? 'list.lastInvoice' : 'list.lastPurchase')} ${ct.lastInvoiceDate}` : null,
                    ].filter(Boolean).join(' · ') || undefined,
                    // Kundfeedback: "man ser knappt infon på mobilen". Det man
                    // faktiskt vill åt i en kundlista på telefonen är numret
                    // och adressen — och kunna trycka på dem. Riktiga tel:/
                    // mailto:-länkar, inte bara text, så telefonen ringer upp
                    // eller öppnar mejlet direkt.
                    meta2: (ct.phone || ct.email) ? (
                      <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', gap: '12px', flexWrap: 'wrap' }}>
                        {ct.phone && <a href={`tel:${ct.phone.replace(/\s/g, '')}`}>{ct.phone}</a>}
                        {ct.email && <a href={`mailto:${ct.email}`}>{ct.email}</a>}
                      </span>
                    ) : undefined,
                    pill: (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600,
                        background: ct.active !== false ? 'var(--status-green-bg)' : 'var(--border-light)',
                        color: ct.active !== false ? 'var(--status-green-text)' : 'var(--text-secondary)',
                      }}>{ct.active !== false ? c('list.active') : c('list.inactive')}</span>
                    ),
                  })}
                  columns={[
                    {
                      key: 'name', label: c('list.colName'), wrap: true, render: ct => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '8px',
                            background: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0
                          }}>
                            {(ct.name || 'K').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>{ct.name}</span>
                        </div>
                      ),
                    },
                    { key: 'orgNr', label: c('list.colOrgNr'), render: ct => ct.orgNr || '—' },
                    { key: 'contactPerson', label: c('list.colContact'), render: ct => ct.contactPerson || ct.email || '—' },
                    { key: 'lastInvoiceDate', label: c(isCustomerTab ? 'list.lastInvoice' : 'list.lastPurchase'), render: ct => ct.lastInvoiceDate || '—' },
                    {
                      key: 'totalInvoicedThisYear', label: c(isCustomerTab ? 'list.invoicedThisYear' : 'list.purchasedThisYear'),
                      color: 'var(--text-main)', fontWeight: 500,
                      render: ct => ct.totalInvoicedThisYear
                        ? new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(ct.totalInvoicedThisYear)
                        : '0 kr',
                    },
                    {
                      key: 'status', label: c('list.status'), render: ct => (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                          background: ct.active !== false ? 'var(--status-green-bg)' : 'var(--border-light)',
                          color: ct.active !== false ? 'var(--status-green-text)' : 'var(--text-secondary)'
                        }}>
                          {ct.active !== false ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {ct.active !== false ? c('list.active') : c('list.inactive')}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            ) : (
              // Kundönskemål ("Fakturor är det som ser bra ut"): tomt-läget
              // svävade tidigare som ett eget litet kort (margin: 24px +
              // egen kant/rundning), med synligt mellanrum mot filterraden
              // ovanför och sidorna — till skillnad från Fakturors tomma
              // läge, som fyller ytan flush utan marginal/kant. Samma
              // flush-fyllning här nu, ingen egen kant/rundning kvar.
              <div style={{ flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', background: 'var(--bg-card)' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: BRAND.green }}>
                  {activeTab === 'customer' ? <Users size={32} /> : <Truck size={32} />}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-main)' }}>
                  {c(isCustomerTab ? 'list.emptyCustomers' : 'list.emptySuppliers')}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
                  {c(isCustomerTab ? 'list.emptyCustomersText' : 'list.emptySuppliersText')}
                </p>
                <button onClick={() => openNewForm(activeTab)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={16} /> {newBtnText}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mform-page" style={{ padding: '24px' }}>
            <div className="mform-head" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <button className="mform-back" onClick={() => setViewState('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: 0 }}>
                <span className="mform-back-desk">{c('actions.back')}</span><span className="mform-back-phone">{c('actions.cancel')}</span>
              </button>
              <span className="mform-sep" style={{ color: 'var(--border)' }}>|</span>
              <h2 className="mform-title" style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {viewState === 'new'
                  ? newBtnText
                  : c(isCustomerTab ? 'list.editCustomer' : 'list.editSupplier')}
              </h2>
              {/* Aktivera/inaktivera + Ta bort — bara på en BEFINTLIG kontakt,
                  inte under "Ny kund/leverantör" (inget att aktivera/ta bort
                  ännu). Samma Fortnox-paritet som handleDeleteContact ovan:
                  radering blockeras tyst i den funktionen om kontakten har
                  kopplade affärshändelser, då erbjuds inaktivering istället. */}
              {viewState === 'edit' && selectedContact && (
                <div className="mform-head-extra" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  {/* Samma "tonad pill"-look som Aktiv/Inaktiv-badgen i
                      listan (status-green/status-amber) i stället för en
                      platt grå knapp — färgen speglar VAD klicket gör:
                      grön när den ska bli aktiv igen, gulaktig amber när
                      den ska stängas av. */}
                  <button
                    type="button" onClick={() => handleToggleActive(selectedContact)}
                    title={c(selectedContact.active === false ? 'actions.activateTitle' : 'actions.deactivateTitle')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                      background: selectedContact.active === false ? 'var(--status-green-bg)' : 'var(--status-amber-bg)',
                      border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
                      color: selectedContact.active === false ? 'var(--status-green-text)' : 'var(--status-amber-text)',
                      cursor: 'pointer', transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <Power size={13} /> {c(selectedContact.active === false ? 'actions.activate' : 'actions.deactivate')}
                  </button>
                  <button
                    type="button" onClick={() => handleDeleteContact(selectedContact)}
                    title={c('actions.delete')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                      background: 'var(--status-red-bg)', border: 'none', borderRadius: '8px',
                      fontSize: '12.5px', fontWeight: 600, color: 'var(--status-red-text)',
                      cursor: 'pointer', transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <Trash2 size={13} /> {c('actions.delete')}
                  </button>
                </div>
              )}
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
