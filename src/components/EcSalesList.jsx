import React, { useMemo, useState } from 'react';
import { Download, AlertTriangle, CheckCircle2, ExternalLink } from './icons';
import { ecPeriod, ecDeadline, computeEcSalesList, generateEcSalesListFile } from '../utils/ecSalesList';
import ListTable from './shared/ListTable';
import { t } from '../i18n';

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' };
const btn = (primary) => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--accent)' : 'var(--bg-card)', color: primary ? '#fff' : 'var(--text-main)',
});
const kr = (v) => `${Math.round(v || 0).toLocaleString('sv-SE')} kr`;

/** De senaste perioderna, nyast först: sex kvartal eller tolv månader. */
function recentPeriods(kind, now = new Date()) {
  const out = [];
  if (kind === 'quarter') {
    let y = now.getFullYear();
    let q = Math.floor(now.getMonth() / 3) + 1;
    for (let i = 0; i < 6; i++) { out.push(ecPeriod(y, `Q${q}`)); q -= 1; if (q === 0) { q = 4; y -= 1; } }
  } else {
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    for (let i = 0; i < 12; i++) { out.push(ecPeriod(y, m)); m -= 1; if (m === 0) { m = 12; y -= 1; } }
  }
  return out;
}

// Samma omkodning som momsfilen: Skatteverkets filer är ISO-8859-1.
function downloadLatin1(text, filename) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); bytes[i] = c <= 0xFF ? c : 0x3F; }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Periodisk sammanställning — flik under Skatt. Räkningen och filen finns i
 * utils/ecSalesList.js.
 */
export default function EcSalesList({ company, invoices = [], contacts = [], setCompanyInfo }) {
  const [kind, setKind] = useState('quarter');
  const periods = useMemo(() => recentPeriods(kind), [kind]);
  // Förvalt: senast avslutade period (index 1), det är den som ska lämnas.
  const [code, setCode] = useState(() => recentPeriods('quarter')[1].code);
  const period = periods.find(p => p.code === code) || periods[1];
  const list = useMemo(() => computeEcSalesList({ invoices, contacts, period }), [invoices, contacts, period]);
  const contact = company?.ecSalesContact || {};
  const setContact = (field, value) => setCompanyInfo?.(prev => ({ ...prev, ecSalesContact: { ...(prev.ecSalesContact || {}), [field]: value } }));
  const filedKey = `ps:${period.code}`;
  const filedAt = company?.taxFilings?.[filedKey]?.at;
  const toggleFiled = () => setCompanyInfo?.(prev => {
    const next = { ...(prev.taxFilings || {}) };
    if (next[filedKey]) delete next[filedKey]; else next[filedKey] = { at: new Date().toISOString() };
    return { ...prev, taxFilings: next };
  });
  const [error, setError] = useState('');

  const download = () => {
    setError('');
    if (!contact.name || !contact.phone) { setError(t('ui.fyll_i_kontaktperson_och_telefonnummer_de_ska_st')); return; }
    try {
      downloadLatin1(generateEcSalesListFile({ company, period, list, contact }), `periodisk-sammanstallning-${period.code}.txt`);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '980px' }}>
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '720px', lineHeight: 1.55 }}>
        {t('ui.saljer_ni_varor_eller_tjanster_utan_svensk_moms')}
      </p>

      <div style={{ ...card, display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '160px' }}>
          <label style={lbl}>{t('ui.redovisas_per')}</label>
          <select value={kind} onChange={e => { const k = e.target.value; setKind(k); setCode(recentPeriods(k)[1].code); }} style={inp}>
            <option value="quarter">{t('ui.kvartal')}</option>
            <option value="month">{t('ui.manad')}</option>
          </select>
        </div>
        <div style={{ minWidth: '200px' }}>
          <label style={lbl}>{t('ui.period')}</label>
          <select value={period.code} onChange={e => setCode(e.target.value)} style={inp}>
            {periods.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {t('ui.senast_hos_skatteverket')} <strong style={{ color: 'var(--text-main)' }}>{ecDeadline(period)}</strong>
          {filedAt && <><br /><CheckCircle2 size={13} style={{ verticalAlign: '-2px', color: 'var(--status-green-text)' }} /> {t('ui.inlamnad')} {new Date(filedAt).toLocaleDateString('sv-SE')}</>}
        </div>
      </div>

      {list.warnings.length > 0 && (
        <div style={{ ...card, background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', color: 'var(--status-amber-text)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {list.warnings.map(w => (
            <div key={w} style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: 1.5 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <ListTable
        columns={[
          { key: 'name', label: t('ui.kopare'), render: r => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.vatNumber}</div></div> },
          { key: 'goods', label: t('ui.varor'), align: 'right', render: r => kr(r.goods) },
          { key: 'services', label: t('ui.tjanster'), align: 'right', render: r => kr(r.services) },
        ]}
        rows={list.rows}
        rowKey={r => r.vatNumber}
        mobileList={r => ({ primary: r.name, meta: r.vatNumber, amount: kr(r.goods + r.services) })}
        emptyMessage={t('ui.ingen_forsaljning_till_eu_foretag_under_da_behov', { v0: period.label.toLowerCase() })}
      />

      {list.rows.length > 0 && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>
            {t('ui.totalt_varor')} <strong>{kr(list.totalGoods)}</strong> {t('ui.och_tjanster')} <strong>{kr(list.totalServices)}</strong>{t('ui.beloppen_ska_stamma_med_ruta_35_och_39_i_momsdek')}
          </div>
          <div className="form-row-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>{t('ui.kontaktperson')}</label>
              <input value={contact.name || ''} onChange={e => setContact('name', e.target.value)} style={inp} maxLength={35} />
            </div>
            <div>
              <label style={lbl}>{t('ui.telefon')}</label>
              <input value={contact.phone || ''} onChange={e => setContact('phone', e.target.value)} style={inp} inputMode="tel" />
            </div>
            <div>
              <label style={lbl}>{t('ui.e_post_valfritt')}</label>
              <input value={contact.email || ''} onChange={e => setContact('email', e.target.value)} style={inp} inputMode="email" />
            </div>
          </div>
          {error && <div style={{ fontSize: '13px', color: 'var(--status-red-text)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={download} style={btn(true)}><Download size={15} /> {t('ui.ladda_ner_fil')}</button>
            <a href="https://www.skatteverket.se/foretag/etjansterochblanketter/allaetjanster/tjanster/periodisksammanstallningformoms.4.7856a2b411550b99fb7800086478.html" target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: 'none' }}>
              {t('ui.skatteverkets_e_tjanst')} <ExternalLink size={13} />
            </a>
            <button type="button" onClick={toggleFiled} style={btn(false)}>
              {filedAt ? t('ui.angra_inlamnad') : t('ui.markera_som_inlamnad')}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('ui.ladda_upp_filen_i_skatteverkets_e_tjanst_under_l')}
          </div>
        </div>
      )}
    </div>
  );
}
