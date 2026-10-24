import React, { useState } from 'react';
import { X } from './icons';
import { BRAND } from '../utils/brandColors';
import { t } from '../i18n';

// Frågar EN gång efter momsperioden för ett momsregistrerat företag som
// aldrig valt den (se needsVatPeriodAnswer). Förut stod de tyst på
// Kvartalsvis, och då blev deklarationsdatumen fel för den som egentligen
// har års- eller månadsmoms. Inget förval: användaren måste välja själv.

const VAT_PERIODS = [['monthly', 'ui.manadsvis'], ['quarterly', 'ui.kvartalsvis'], ['yearly', 'ui.onb_helar']];

/** Momsregistrerat, eget företag, och perioden aldrig vald (onboardingen eller Inställningar). */
export function needsVatPeriodAnswer(companyData) {
  const c = companyData?.company;
  if (!c || companyData.__shared || c.needsSetup || c.isUf) return false;
  if (c.vatRegistered !== true) return false;
  return !c.vatPeriodConfirmedAt && !c.setupConfirmedAt;
}

const pill = (active) => ({
  padding: '9px 14px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: `1.5px solid ${active ? BRAND.green : 'var(--border)'}`,
  background: active ? BRAND.greenLight : 'var(--bg-card)',
  color: active ? BRAND.greenDark : 'var(--text-main)',
});
const btn = { padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' };

export default function VatPeriodPrompt({ company, onSave, onLater }) {
  const [period, setPeriod] = useState('');
  const current = t(VAT_PERIODS.find(([id]) => id === (company.vatPeriod || 'quarterly'))?.[1] || 'ui.kvartalsvis').toLowerCase();

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }} role="dialog" aria-modal="true" aria-labelledby="vpp-title">
        <div className="modal-header">
          <span className="modal-title" id="vpp-title">{t('ui.vpp_titel', { name: company.name || '' })}</span>
          <button className="modal-close" onClick={onLater} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('ui.vpp_ingress', { period: current })}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label={t('ui.momsperiod')}>
          {VAT_PERIODS.map(([id, key]) => (
            <button key={id} type="button" role="radio" aria-checked={period === id} onClick={() => setPeriod(id)} style={pill(period === id)}>{t(key)}</button>
          ))}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('ui.onb_momsperiod_hjalp')}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" style={btn} onClick={onLater}>{t('ui.vpp_senare')}</button>
          <button
            type="button"
            disabled={!period}
            onClick={() => onSave(period)}
            style={{ ...btn, background: BRAND.green, color: 'white', border: 'none', fontWeight: 700, opacity: period ? 1 : 0.45, cursor: period ? 'pointer' : 'not-allowed' }}
          >
            {t('ui.spara')}
          </button>
        </div>
      </div>
    </div>
  );
}
