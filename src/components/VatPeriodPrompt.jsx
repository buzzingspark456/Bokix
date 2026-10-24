import React, { useState } from 'react';
import { X } from './icons';
import { BRAND } from '../utils/brandColors';
import { t } from '../i18n';

// Frågar EN gång det som nya konton svarar på i onboardingen, för företag
// som lades upp innan den fanns:
//   - momsperioden, för ett momsregistrerat företag som aldrig valt den
//     (förut stod de tyst på Kvartalsvis, och då blev deklarationsdatumen
//     fel för den som har års- eller månadsmoms)
//   - F-skatten (2026-10-24): äldre företag fick "Innehar F-skattsedel"
//     sparat automatiskt, och den texten står på deras fakturor även när
//     den inte stämmer.
// Båda frågorna i samma ruta när båda behövs. Inget förval: användaren
// måste välja själv.

const VAT_PERIODS = [['monthly', 'ui.manadsvis'], ['quarterly', 'ui.kvartalsvis'], ['yearly', 'ui.onb_helar']];
export const F_TAX_TEXT = 'Godkänd för F-skatt';

const ownCompany = (companyData) => {
  const c = companyData?.company;
  if (!c || companyData.__shared || c.needsSetup || c.isUf || c.setupConfirmedAt) return null;
  return c;
};

/** Momsregistrerat, eget företag, och perioden aldrig vald (onboardingen eller Inställningar). */
export function needsVatPeriodAnswer(companyData) {
  const c = ownCompany(companyData);
  return Boolean(c && c.vatRegistered === true && !c.vatPeriodConfirmedAt);
}

/** Eget företag där F-skatten aldrig bekräftats (onboardingen eller Inställningar). */
export function needsFSkattAnswer(companyData) {
  const c = ownCompany(companyData);
  return Boolean(c && !c.fSkattConfirmedAt);
}

export function needsCompanyFactsAnswer(companyData) {
  return needsVatPeriodAnswer(companyData) || needsFSkattAnswer(companyData);
}

const pill = (active) => ({
  padding: '9px 14px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: `1.5px solid ${active ? BRAND.green : 'var(--border)'}`,
  background: active ? BRAND.greenLight : 'var(--bg-card)',
  color: active ? BRAND.greenDark : 'var(--text-main)',
});
const btn = { padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' };
const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' };
const hintStyle = { margin: '10px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 };

export default function VatPeriodPrompt({ companyData, onSave, onLater }) {
  const company = companyData.company;
  const askVat = needsVatPeriodAnswer(companyData);
  const askFTax = needsFSkattAnswer(companyData);
  const [period, setPeriod] = useState('');
  const [fTax, setFTax] = useState(null); // true | false | null
  const ready = (!askVat || period) && (!askFTax || fTax !== null);
  const current = t(VAT_PERIODS.find(([id]) => id === (company.vatPeriod || 'quarterly'))?.[1] || 'ui.kvartalsvis').toLowerCase();
  const title = askVat && askFTax ? 'ui.vpp_titel_bada' : askVat ? 'ui.vpp_titel' : 'ui.vpp_titel_fskatt';

  const save = () => onSave({
    ...(askVat ? { vatPeriod: period } : {}),
    ...(askFTax ? { fSkatt: fTax ? F_TAX_TEXT : '' } : {}),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }} role="dialog" aria-modal="true" aria-labelledby="vpp-title">
        <div className="modal-header">
          <span className="modal-title" id="vpp-title">{t(title, { name: company.name || '' })}</span>
          <button className="modal-close" onClick={onLater} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>

        {askVat && (
          <div style={{ marginBottom: askFTax ? '22px' : 0 }}>
            {askFTax && <span style={labelStyle}>{t('ui.onb_hur_ofta_moms')}</span>}
            <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('ui.vpp_ingress', { period: current })}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label={t('ui.momsperiod')}>
              {VAT_PERIODS.map(([id, key]) => (
                <button key={id} type="button" role="radio" aria-checked={period === id} onClick={() => setPeriod(id)} style={pill(period === id)}>{t(key)}</button>
              ))}
            </div>
            <p style={hintStyle}>{t('ui.onb_momsperiod_hjalp')}</p>
          </div>
        )}

        {askFTax && (
          <div>
            {askVat && <span style={labelStyle}>{t('ui.onb_har_ni_fskatt')}</span>}
            <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {company.fSkatt ? t('ui.vpp_fskatt_nu', { text: company.fSkatt }) : t('ui.vpp_fskatt_ingen')}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label={t('ui.onb_steg_fskatt')}>
              {[[true, t('ui.onb_fskatt_ja')], [false, t('ui.nej')]].map(([val, label]) => (
                <button key={String(val)} type="button" role="radio" aria-checked={fTax === val} onClick={() => setFTax(val)} style={pill(fTax === val)}>{label}</button>
              ))}
            </div>
            <p style={hintStyle}>{fTax === false ? t('ui.onb_fskatt_nej_hjalp') : t('ui.onb_fskatt_hjalp')}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" style={btn} onClick={onLater}>{t('ui.vpp_senare')}</button>
          <button
            type="button"
            disabled={!ready}
            onClick={save}
            style={{ ...btn, background: BRAND.green, color: 'white', border: 'none', fontWeight: 700, opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'not-allowed' }}
          >
            {t('ui.spara')}
          </button>
        </div>
      </div>
    </div>
  );
}
