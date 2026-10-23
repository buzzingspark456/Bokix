import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, Check } from './icons';
import { BRAND } from '../utils/brandColors';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { detectOrgType, formatOrgNr } from '../utils/orgType';
import CompanyLookupResults from './shared/CompanyLookupResults';
import FiscalYearVatFields, { companySetupComplete, companySetupToCompany, companySetupFromCompany } from './shared/FiscalYearVatFields';
import { describeFiscalYear } from '../utils/fiscalYearSetup';
import { keyDatesForSetup } from '../utils/setupDates';
import { dateTimeFormat } from '../utils/intlCache';
import { t, dateLocale } from '../i18n';

// Onboardingen för ett nytt konto (2026-10-23): en hel sida, fyra steg, och
// bara de uppgifter som avgör att bokföringen och skatten blir rätt. Inget
// gissas tyst: momsperioden och F-skatten måste väljas (förut förvaldes
// Kvartalsvis och "Innehar F-skattsedel", som hamnade på fakturorna), och
// sista steget visar företagets viktigaste datum räknade på svaren.
// Visas av App.jsx när företaget har `needsSetup` (sätts när kontot skapas),
// så befintliga kunder ser den aldrig.

const STEPS = [
  { id: 'company', title: t('ui.onb_steg_foretaget'), lead: t('ui.onb_foretaget_ingress') },
  { id: 'vat', title: t('ui.onb_steg_moms'), lead: t('ui.onb_moms_ingress') },
  { id: 'tax', title: t('ui.onb_steg_fskatt'), lead: t('ui.onb_fskatt_ingress') },
  { id: 'done', title: t('ui.onb_steg_klart'), lead: t('ui.onb_klart_ingress') },
];

const F_TAX_TEXT = 'Godkänd för F-skatt';

const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' };
const inputStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 12px', fontSize: '14px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit', boxSizing: 'border-box' };
const hintStyle = { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 };
const pill = (active) => ({
  padding: '9px 14px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: `1.5px solid ${active ? BRAND.green : 'var(--border)'}`,
  background: active ? BRAND.greenLight : 'var(--bg-card)',
  color: active ? BRAND.greenDark : 'var(--text-main)',
});

const VAT_PERIODS = [['monthly', t('ui.manadsvis')], ['quarterly', t('ui.kvartalsvis')], ['yearly', t('ui.onb_helar')]];

export default function OnboardingFlow({ onComplete, onSkip, initialCompanyData }) {
  const saved = initialCompanyData?.company || {};
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState(saved.name || '');
  const [orgNr, setOrgNr] = useState(saved.orgNr || '');
  const [address, setAddress] = useState(saved.address || '');
  const [postalCode, setPostalCode] = useState(saved.postalCode || '');
  const [city, setCity] = useState(saved.city || '');
  const [email, setEmail] = useState(saved.email || '');
  const [phone, setPhone] = useState(saved.phone || '');
  const [companySetup, setCompanySetup] = useState(() => companySetupFromCompany(saved));
  // Ingen förvald period och ingen förvald F-skatt: båda avgör skatten och
  // ska komma från användaren, inte från oss.
  const [vatPeriod, setVatPeriod] = useState('');
  const [fTax, setFTax] = useState(null); // true | false | null

  const companyLookup = useCompanyLookup((key, value) => {
    if (key === 'name') setCompanyName(value);
    else if (key === 'orgNr') setOrgNr(formatOrgNr(value));
    else if (key === 'address') setAddress(value);
    else if (key === 'postalCode') setPostalCode(value);
    else if (key === 'city') setCity(value);
  });
  const nameFieldRef = useRef(null);
  const orgType = detectOrgType(orgNr);
  const vatRegistered = companySetup.vatRegistered === true;

  const setup = useMemo(() => companySetupToCompany(companySetup, orgNr), [companySetup, orgNr]);
  const keyDates = useMemo(() => keyDatesForSetup({
    orgNr, fiscalYear: setup.fiscalYear, firstFiscalYear: setup.firstFiscalYear, vatRegistered, vatPeriod,
  }), [orgNr, setup, vatRegistered, vatPeriod]);
  const fmtDate = (d) => dateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(d);

  const stepValid = (i) => {
    if (i === 0) return companyName.trim() && orgNr.replace(/\D/g, '').length >= 10;
    if (i === 1) return companySetupComplete(companySetup) && (!vatRegistered || Boolean(vatPeriod));
    if (i === 2) return fTax !== null;
    return true;
  };

  const finish = () => {
    onComplete({
      companyName: companyName.trim(), orgNr, address, postalCode, city, email, phone,
      fiscalYear: setup.fiscalYear, setup,
      vatPeriod: vatRegistered ? vatPeriod : undefined,
      fSkatt: fTax ? F_TAX_TEXT : '',
    });
  };
  const next = () => (step === STEPS.length - 1 ? finish() : setStep(s => s + 1));

  const content = () => {
    if (step === 0) {
      return (
        <div style={{ display: 'grid', gap: '18px' }}>
          <div>
            <label style={labelStyle} htmlFor="onb-orgnr">{t('ui.organisationsnummer')}</label>
            <input
              id="onb-orgnr" value={orgNr} placeholder="556123-4567" style={inputStyle}
              onChange={(e) => { const v = formatOrgNr(e.target.value); setOrgNr(v); companyLookup.handleOrgNrChange(v); }}
            />
            {companyLookup.orgLookup.status === 'loading' && <div style={hintStyle}>{t('ui.hamtar_foretagsuppgifter')}</div>}
            {companyLookup.orgLookup.status === 'error' && <div style={hintStyle}>{companyLookup.orgLookup.message}</div>}
            {(companyLookup.orgLookup.status === 'done' || companyLookup.orgLookup.status === 'firma') && (
              <div style={{ ...hintStyle, display: 'flex', alignItems: 'flex-start', gap: '6px', color: BRAND.greenDark, fontWeight: 600 }}>
                <Check size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{companyLookup.orgLookup.status === 'firma' ? companyLookup.orgLookup.message : t('ui.hamtat_fran_bolagsregistret_andra_garna_om_nagot')}</span>
              </div>
            )}
            {orgType && <div style={hintStyle}>{t('ui.onb_bolagsform', { orgType })}</div>}
          </div>
          <div ref={nameFieldRef}>
            <label style={labelStyle} htmlFor="onb-name">{t('ui.foretagsnamn')}</label>
            <input
              id="onb-name" value={companyName} style={inputStyle}
              onChange={(e) => { setCompanyName(e.target.value); if (!orgNr.replace(/\D/g, '')) companyLookup.queueNameSearch(e.target.value); }}
            />
            <CompanyLookupResults results={companyLookup.nameResults} onPick={companyLookup.applyCompany} anchorRef={nameFieldRef} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="onb-address">{t('ui.adress_2')}</label>
            <input id="onb-address" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
          </div>
          <div className="form-row-2" style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={labelStyle} htmlFor="onb-postal">{t('ui.onb_postnummer')}</label>
              <input id="onb-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="onb-city">{t('ui.onb_ort')}</label>
              <input id="onb-city" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div className="form-row-2" style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={labelStyle} htmlFor="onb-email">{t('ui.e_post')}</label>
              <input id="onb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="onb-phone">{t('ui.telefon')}</label>
              <input id="onb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ ...hintStyle, marginTop: 0 }}>{t('ui.onb_syns_pa_fakturor')}</div>
        </div>
      );
    }
    if (step === 1) {
      return (
        <div style={{ display: 'grid', gap: '22px' }}>
          <FiscalYearVatFields value={companySetup} onChange={setCompanySetup} orgNr={orgNr} registry={companyLookup.lastCompany} />
          {vatRegistered && (
            <div>
              <span style={labelStyle}>{t('ui.onb_hur_ofta_moms')}</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label={t('ui.momsperiod')}>
                {VAT_PERIODS.map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={vatPeriod === id} onClick={() => setVatPeriod(id)} style={pill(vatPeriod === id)}>{label}</button>
                ))}
              </div>
              <div style={hintStyle}>{t('ui.onb_momsperiod_hjalp')}</div>
            </div>
          )}
        </div>
      );
    }
    if (step === 2) {
      return (
        <div>
          <span style={labelStyle}>{t('ui.onb_har_ni_fskatt')}</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label={t('ui.onb_steg_fskatt')}>
            {[[true, t('ui.onb_fskatt_ja')], [false, t('ui.nej')]].map(([val, label]) => (
              <button key={String(val)} type="button" role="radio" aria-checked={fTax === val} onClick={() => setFTax(val)} style={pill(fTax === val)}>{label}</button>
            ))}
          </div>
          <div style={hintStyle}>{fTax === false ? t('ui.onb_fskatt_nej_hjalp') : t('ui.onb_fskatt_hjalp')}</div>
        </div>
      );
    }
    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>{t('ui.onb_viktiga_datum')}</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {keyDates.map((row, i) => (
              <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '14px 16px', borderTop: i ? '1px solid var(--border)' : 0, background: 'var(--bg-card)' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{row.label}</div>
                  {row.note && <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{row.note}</div>}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</div>
              </div>
            ))}
          </div>
          <div style={hintStyle}>{t('ui.onb_datum_hjalp')}</div>
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>{t('ui.onb_era_uppgifter')}</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {[
              [t('ui.foretagsnamn'), companyName],
              [t('ui.organisationsnummer'), `${orgNr}${orgType ? ` · ${orgType}` : ''}`],
              [t('ui.rakenskapsar'), describeFiscalYear(companySetup)],
              [t('ui.onb_moms'), vatRegistered ? `${setup.vatNr} · ${VAT_PERIODS.find(([id]) => id === vatPeriod)?.[1] || ''}` : t('ui.inte_momsregistrerat')],
              [t('ui.onb_steg_fskatt'), fTax ? F_TAX_TEXT : t('ui.nej')],
            ].map(([label, value], i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 0, background: 'var(--bg-card)', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' }}>{value || t('ui.ej_angivet')}</span>
              </div>
            ))}
          </div>
          <div style={hintStyle}>{t('ui.onb_andra_senare')}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="onb-page" style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Bokix</div>
        <button type="button" onClick={onSkip} style={{ border: 0, background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('ui.onb_gor_senare')}</button>
      </header>

      <div className="onb-body" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) minmax(0, 640px)', justifyContent: 'center', gap: '56px', padding: '48px 24px 64px' }}>
        <nav className="onb-steps" aria-label={t('ui.onb_steg')}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '4px' }}>
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              const reachable = i <= step || STEPS.slice(0, i).every((_, j) => stepValid(j));
              return (
                <li key={s.id}>
                  <button
                    type="button" disabled={!reachable} onClick={() => setStep(i)} aria-current={current ? 'step' : undefined}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', border: 0, textAlign: 'left', fontFamily: 'inherit', cursor: reachable ? 'pointer' : 'default', background: current ? 'var(--bg-card)' : 'transparent', boxShadow: current ? '0 0 0 1px var(--border)' : 'none' }}
                  >
                    <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0, background: done || current ? BRAND.green : 'var(--bg-muted)', color: done || current ? 'white' : 'var(--text-secondary)' }}>
                      {done ? <Check size={13} /> : i + 1}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: current ? 700 : 600, color: current ? 'var(--text-main)' : 'var(--text-secondary)' }}>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main>
          <div className="onb-mobile-progress" style={{ display: 'none', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            {t('ui.onb_steg_av', { n: step + 1, total: STEPS.length })}
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-main)', margin: '0 0 8px' }}>{STEPS[step].title}</h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px', maxWidth: '520px' }}>{STEPS[step].lead}</p>
          {content()}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
              style={{ border: 0, background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: step === 0 ? 'default' : 'pointer', visibility: step === 0 ? 'hidden' : 'visible', fontFamily: 'inherit' }}
            >
              {t('ui.tillbaka_2')}
            </button>
            <button
              type="button" onClick={next} disabled={!stepValid(step)}
              style={{ border: 0, borderRadius: '999px', padding: '12px 20px', background: BRAND.green, color: 'white', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: stepValid(step) ? 'pointer' : 'not-allowed', opacity: stepValid(step) ? 1 : 0.5, fontFamily: 'inherit' }}
            >
              {step === STEPS.length - 1 ? t('ui.onb_borja_bokfora') : t('ui.fortsatt')} <ArrowRight size={15} />
            </button>
          </div>
        </main>
      </div>
      <style>{`
        @media (max-width: 860px) {
          .onb-body { grid-template-columns: minmax(0, 1fr) !important; gap: 0 !important; padding: 28px 16px 48px !important; }
          .onb-steps { display: none; }
          .onb-mobile-progress { display: block !important; }
        }
      `}</style>
    </div>
  );
}
