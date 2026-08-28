import React, { useState, useRef, useCallback } from 'react';
import { Check } from 'lucide-react';

export default function CompanySettings({ company = {}, updateCompany }) {
  const [savedFields, setSavedFields] = useState({});
  const timers = useRef({});

  const autoSave = useCallback((field, value) => {
    if (timers.current[field]) clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(() => {
      if (updateCompany) updateCompany({ ...company, [field]: value });
      setSavedFields(prev => ({ ...prev, [field]: true }));
      setTimeout(() => setSavedFields(prev => ({ ...prev, [field]: false })), 2000);
    }, 500);
  }, [company, updateCompany]);

  const Field = ({ label, name, type = 'text', placeholder, hint, required }) => {
    const [val, setVal] = useState(company[name] || '');
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
            {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
          </label>
          {savedFields[name] && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>
              <Check size={12} /> Sparat
            </span>
          )}
        </div>
        <input
          type={type}
          placeholder={placeholder}
          value={val}
          onChange={e => { setVal(e.target.value); autoSave(name, e.target.value); }}
          style={{
            width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px',
            fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            transition: 'border-color 0.15s'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {hint && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{hint}</p>}
      </div>
    );
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '100%', animation: 'fadeIn 0.25s ease' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>Företag</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
          Uppgifterna sparas automatiskt när du skriver. Informationen används på fakturor och offerter.
        </p>
      </div>

      {/* Section: Basic info */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 20px' }}>Grunduppgifter</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Företagsnamn" name="name" placeholder="T.ex. Acme AB" required />
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <Field label="Organisationsnummer" name="orgNr" placeholder="XXXXXX-XXXX" />
            <Field label="Momsregistreringsnummer" name="vatNr" placeholder="SE556XXXXXXXXXX01" />
          </div>
          <Field label="Adress" name="address" placeholder="Gatuadress, Postnummer Stad" />
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <Field label="E-post" name="email" type="email" placeholder="info@foretag.se" />
            <Field label="Telefon" name="phone" type="tel" placeholder="08-000 00 00" />
          </div>
        </div>
      </div>

      {/* Section: Bank */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 20px' }}>Bankuppgifter</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <Field label="Bankgiro" name="bankgiro" placeholder="XXXX-XXXX" />
            <Field label="Plusgiro" name="plusgiro" placeholder="XXXXXX-X" />
          </div>
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <Field label="IBAN" name="iban" placeholder="SE00 0000 0000 0000 0000 0000" />
            <Field label="BIC/SWIFT" name="bic" placeholder="HANDSESS" />
          </div>
        </div>
      </div>

      {/* Section: Fiscal year */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 20px' }}>Räkenskapsår & moms</h2>
        <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
          <Field label="Räkenskapsår startar" name="fiscalYear" type="date" hint="Startdatum för räkenskapsåret" />
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Momsperiod
            </label>
            <select
              defaultValue={company.vatPeriod || 'quarterly'}
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px',
                fontSize: '14px', background: 'var(--bg-card)', outline: 'none', fontFamily: 'inherit'
              }}
              onChange={e => autoSave('vatPeriod', e.target.value)}
            >
              <option value="monthly">Månadsvis</option>
              <option value="quarterly">Kvartalsvis</option>
              <option value="yearly">Helårlig</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
