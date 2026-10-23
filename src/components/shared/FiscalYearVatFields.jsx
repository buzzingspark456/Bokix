import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from '../icons';
import { BRAND } from '../../utils/brandColors';
import { checkVatRegistration } from '../../utils/companyLookup';
import { MONTHS, firstYearEndOptions, defaultFirstYearEnd, formatSvDate, todayIso, fiscalYearFields, suggestFiscalYear, isSoleTraderNumber } from '../../utils/fiscalYearSetup';
import { t } from '../../i18n';

// Två frågor som ställs där ett företag läggs upp (registreringen, Lägg
// till företag och onboardingen): vilket räkenskapsår, och om företaget är
// momsregistrerat. Momsfrågan förvals ur EU:s momsregister (VIES) så fort
// org.nr är ifyllt, men svaret går alltid att ändra. Går registret inte att
// nå förvals ingenting och användaren svarar själv.
//
// Räkenskapsåret förvals på samma sätt ur företagsregistret (`registry`,
// träffen från useCompanyLookup): senaste årsredovisningen, eller
// registreringsdatumet för ett nytt företag. Vet registret inget väljer
// användaren själv, och ett eget val skrivs aldrig över.
//
// value: { mode, startMonth, firstStart, firstEnd, fySource, fyNote, vatRegistered, vatNr, vatSource }

export const EMPTY_COMPANY_SETUP = { mode: '', startMonth: 7, firstStart: '', firstEnd: '', fySource: '', fyNote: '', vatRegistered: null, vatNr: '', vatSource: '' };

/** Är båda frågorna besvarade (och räkenskapsåret giltigt)? */
export function companySetupComplete(value) {
  return !fiscalYearFields(value).error && (value?.vatRegistered === true || value?.vatRegistered === false);
}

/** Svaren → fälten som sparas på företaget. */
export function companySetupToCompany(value, orgNr) {
  // En enskild firma har alltid kalenderår, även om ett annat val hann sparas
  // i formuläret innan numret var ifyllt.
  const choice = isSoleTraderNumber(orgNr) && value?.mode === 'other' ? { ...value, mode: 'calendar' } : value;
  const { fiscalYear, firstFiscalYear } = fiscalYearFields(choice);
  const digits = String(orgNr || '').replace(/\D/g, '');
  return {
    fiscalYear,
    firstFiscalYear: firstFiscalYear || null,
    vatRegistered: value.vatRegistered,
    vatNr: value.vatRegistered ? (value.vatNr || (digits.length === 10 ? `SE${digits}01` : '')) : '',
  };
}

const pill = (active) => ({
  padding: '9px 14px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: `1.5px solid ${active ? BRAND.green : 'var(--border)'}`,
  background: active ? BRAND.greenLight : 'var(--bg-card)',
  color: active ? BRAND.greenDark : 'var(--text-main)',
});
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' };
const hintStyle = { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 };
const selectStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' };

export default function FiscalYearVatFields({ value, onChange, orgNr, registry }) {
  const v = { ...EMPTY_COMPANY_SETUP, ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const [vatCheck, setVatCheck] = useState('idle'); // idle | checking | done | error
  const lastChecked = useRef('');

  const digits = String(orgNr || '').replace(/\D/g, '');
  // Enskild firma (personnummer): bara kalenderår, och ett första år slutar
  // 31 december. Kundönskemål 2026-10-23: skatten ska alltid bli rätt.
  const soleTrader = isSoleTraderNumber(digits);
  useEffect(() => {
    if (soleTrader && v.mode === 'other') onChange(cur => ({ ...EMPTY_COMPANY_SETUP, ...cur, mode: 'calendar' }));
  }, [soleTrader, v.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (digits.length !== 10 || lastChecked.current === digits) return;
    lastChecked.current = digits;
    let cancelled = false;
    setVatCheck('checking');
    checkVatRegistration(digits)
      .then(res => {
        if (cancelled || !res) return;
        setVatCheck('done');
        // Skriv inte över ett svar användaren själv gett.
        onChange(cur => (cur?.vatSource === 'user' ? cur : { ...EMPTY_COMPANY_SETUP, ...cur, vatRegistered: res.registered, vatNr: res.registered ? res.vatNr : '', vatSource: 'vies' }));
      })
      .catch(() => { if (!cancelled) setVatCheck('error'); });
    return () => { cancelled = true; };
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Förslag ur registret när en träff valts, så länge användaren inte själv valt.
  const registryKey = registry?.orgNumber || '';
  useEffect(() => {
    if (!registryKey) return;
    const suggestion = suggestFiscalYear(registry);
    onChange(cur => {
      if (cur?.fySource === 'user') return cur;
      if (!suggestion) return { ...EMPTY_COMPANY_SETUP, ...cur, fySource: '', fyNote: '' };
      return { ...EMPTY_COMPANY_SETUP, ...cur, ...suggestion.choice, fySource: 'registry', fyNote: suggestion.note };
    });
  }, [registryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseMode = (mode) => {
    if (mode === 'first' && !v.firstStart) {
      const start = todayIso();
      set({ mode, firstStart: start, firstEnd: defaultFirstYearEnd(start), fySource: 'user' });
    } else set({ mode, fySource: 'user' });
  };
  const endOptions = firstYearEndOptions(v.firstStart).filter(d => !soleTrader || d.endsWith('-12-31'));

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div>
        <span style={labelStyle}>{t('ui.vilket_rakenskapsar_har_ni')}</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label={t('ui.rakenskapsar')}>
          {[['calendar', t('ui.kalenderar')], ...(soleTrader ? [] : [['other', t('ui.annat_rakenskapsar')]]), ['first', t('ui.vart_forsta_ar')]].map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={v.mode === id} onClick={() => chooseMode(id)} style={pill(v.mode === id)}>{label}</button>
          ))}
        </div>

        {v.fySource === 'registry' && v.fyNote && (
          <div style={{ ...hintStyle, display: 'flex', alignItems: 'flex-start', gap: '6px', color: BRAND.greenDark, fontWeight: 600 }}>
            <Check size={13} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{v.fyNote} {t('ui.andra_om_det_inte_stammer')}</span>
          </div>
        )}
        {soleTrader
          ? <div style={hintStyle}>{t('ui.enskild_firma_har_alltid_kalenderar')}</div>
          : v.mode === 'calendar' && v.fySource !== 'registry' && <div style={hintStyle}>{t('ui.n1_januari_31_december_det_vanligaste')}</div>}

        {v.mode === 'other' && (
          <div style={{ marginTop: '12px' }}>
            <label style={{ ...labelStyle, fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '6px' }} htmlFor="fy-start-month">{t('ui.rakenskapsaret_borjar')}</label>
            <select id="fy-start-month" value={v.startMonth} onChange={e => set({ startMonth: Number(e.target.value), fySource: 'user' })} style={{ ...selectStyle, maxWidth: '260px' }}>
              {MONTHS.map((name, i) => i > 0 && <option key={name} value={i + 1}>1 {name}</option>)}
            </select>
            <div style={hintStyle}>{t('ui.star_i_bolagsordningen_eller_pa_bolagsverket_och')}</div>
          </div>
        )}

        {v.mode === 'first' && (
          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ ...labelStyle, fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '6px' }} htmlFor="fy-first-start">{t('ui.forsta_aret_borjar')}</label>
              <input
                id="fy-first-start" type="date" value={v.firstStart}
                onChange={e => { const start = e.target.value; set({ firstStart: start, firstEnd: firstYearEndOptions(start).includes(v.firstEnd) ? v.firstEnd : defaultFirstYearEnd(start), fySource: 'user' }); }}
                style={selectStyle}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '6px' }} htmlFor="fy-first-end">{t('ui.och_slutar')}</label>
              <select id="fy-first-end" value={v.firstEnd} onChange={e => set({ firstEnd: e.target.value, fySource: 'user' })} style={selectStyle} disabled={endOptions.length === 0}>
                {endOptions.map(d => <option key={d} value={d}>{formatSvDate(d)}</option>)}
              </select>
            </div>
            <div style={{ ...hintStyle, marginTop: 0, gridColumn: '1 / -1' }}>
              {t('ui.forsta_aret_far_vara_kortare_eller_upp_till_18_m')}
            </div>
          </div>
        )}
      </div>

      <div>
        <span style={labelStyle}>{t('ui.ar_foretaget_momsregistrerat')}</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label={t('ui.momsregistrerat_2')}>
          {[[true, 'Ja'], [false, 'Nej']].map(([val, label]) => (
            <button
              key={label} type="button" role="radio" aria-checked={v.vatRegistered === val}
              onClick={() => set({ vatRegistered: val, vatNr: val ? (v.vatNr || (digits.length === 10 ? `SE${digits}01` : '')) : '', vatSource: 'user' })}
              style={pill(v.vatRegistered === val)}
            >
              {label}
            </button>
          ))}
        </div>
        {vatCheck === 'checking' && (
          <div style={{ ...hintStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> {t('ui.kollar_i_eu_s_momsregister')}
          </div>
        )}
        {vatCheck === 'done' && v.vatSource === 'vies' && (
          <div style={{ ...hintStyle, display: 'flex', alignItems: 'flex-start', gap: '6px', color: BRAND.greenDark, fontWeight: 600 }}>
            <Check size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{v.vatRegistered ? t('ui.momsregistrerat_med_enligt_eu_s_momsregister', { vatNr: v.vatNr }) : t('ui.hittades_inte_i_eu_s_momsregister_ar_ni_nyregist')}</span>
          </div>
        )}
        {vatCheck === 'error' && <div style={hintStyle}>{t('ui.momsregistret_gick_inte_att_na_svara_sjalv_det_g')}</div>}
        {vatCheck === 'idle' && digits.length !== 10 && <div style={hintStyle}>{t('ui.vi_kollar_automatiskt_nar_organisationsnumret_ar')}</div>}
      </div>
    </div>
  );
}
