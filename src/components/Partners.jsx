import React, { useMemo, useState } from 'react';
import { Plus, Trash2, CheckCircle2, AlertTriangle } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  MAX_PARTNERS, validatePartners, buildAllocationVerification, isAllocationBooked, computePartnerStatement,
} from '../utils/partners';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `partner_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' };
const btn = (primary) => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--accent)' : 'var(--bg-card)', color: primary ? '#fff' : 'var(--text-main)',
});

/**
 * Delägare och resultatfördelning för handels- och kommanditbolag — flik i
 * Skatt och bokslut. Räkningen ligger i utils/partners.js.
 */
export default function Partners({ company, verifications = [], year, period, yearResult, onAddVerification, setCompanyInfo }) {
  const saved = useMemo(() => company?.partners || [], [company?.partners]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const list = draft || saved;
  const errors = validatePartners(list);
  const locked = company?.lockedFiscalYears?.[year];
  const lockedResult = locked?.result;
  // Bokslutet fördelar resultatet direkt på delägarna när delägarna är inlagda
  // innan året låses. Ett år som låstes utan delägare ligger kvar på 2099 och
  // fördelas här i efterhand.
  const allocatedAtClose = locked?.resultAccount === 'partners';
  const allocationBooked = allocatedAtClose || isAllocationBooked(verifications, year);

  // Räkenskapsårets datum när Taxes skickar dem, annars kalenderåret.
  const start = period?.start || `${year}-01-01`;
  const end = period?.end || `${year}-12-31`;
  const statement = useMemo(
    () => (validatePartners(saved).length === 0 ? computePartnerStatement(verifications, saved, start, end, lockedResult ?? yearResult) : []),
    [saved, verifications, start, end, lockedResult, yearResult],
  );

  const edit = (updater) => setDraft(updater(draft || saved.map(p => ({ ...p }))));
  const addPartner = () => edit(l => (l.length >= MAX_PARTNERS ? l : [...l, { id: newId(), name: '', personnummer: '', sharePct: l.length === 0 ? 100 : 0 }]));
  const patch = (id, fields) => edit(l => l.map(p => (p.id === id ? { ...p, ...fields } : p)));
  const removePartner = (id) => edit(l => l.filter(p => p.id !== id));

  const savePartners = () => {
    if (errors.length) return setError(errors[0]);
    setCompanyInfo(prev => ({ ...prev, partners: draft.map(p => ({ ...p, name: p.name.trim(), sharePct: Number(p.sharePct) || 0 })) }));
    setDraft(null); setError('');
  };

  const bookAllocation = async () => {
    if (!(await confirmDialog(t('ui.bokfor_resultatfordelning_for_resultatet_kr_ford', { year, v1: fmt(lockedResult) })))) return;
    onAddVerification(buildAllocationVerification(year, lockedResult, saved, end));
  };

  const valid = validatePartners(saved).length === 0;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '700px' }}>
        {t('ui.ett_handelsbolag_betalar_ingen_egen_bolagsskatt')}
      </p>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>{t('ui.delagare')}</div>
        {list.length === 0 && <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t('ui.inga_delagare_inlagda_annu')}</p>}
        {list.map((p, i) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 2fr) minmax(120px, 1.4fr) 90px 36px', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <input style={inp} value={p.name} placeholder={t('ui.delagare_2', { v0: i + 1 })} onChange={e => patch(p.id, { name: e.target.value })} />
            <input style={inp} value={p.personnummer || ''} placeholder={t('ui.person_org_nr')} onChange={e => patch(p.id, { personnummer: e.target.value })} />
            <input style={inp} type="number" step="0.01" value={p.sharePct} onChange={e => patch(p.id, { sharePct: e.target.value })} aria-label={t('ui.andel_i_procent')} />
            <button type="button" title={t('ui.ta_bort')} onClick={() => removePartner(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={15} /></button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
          {list.length < MAX_PARTNERS && <button type="button" style={btn(false)} onClick={addPartner}><Plus size={14} /> {t('ui.lagg_till_delagare')}</button>}
          {draft && <button type="button" style={btn(true)} onClick={savePartners}>{t('ui.spara_delagare')}</button>}
          {draft && <button type="button" style={btn(false)} onClick={() => { setDraft(null); setError(''); }}>{t('ui.avbryt')}</button>}
        </div>
        {(error || (draft && errors.length > 0)) && <p style={{ margin: '12px 0 0', fontSize: '13px', color: 'var(--status-red-text)' }}>{error || errors[0]}</p>}
      </div>

      {valid && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderColor: locked && !allocationBooked ? 'var(--status-amber-text)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {allocationBooked ? <CheckCircle2 size={18} color="var(--status-green-text)" /> : <AlertTriangle size={18} color={locked ? 'var(--status-amber-text)' : 'var(--text-muted)'} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>
                {allocationBooked ? t('ui.resultatfordelningen_for_ar_bokford', { year }) : locked ? t('ui.resultatet_for_kr_ar_inte_fordelat', { year, v1: fmt(lockedResult) }) : t('ui.resultatet_for_kan_fordelas_nar_aret_ar_last', { year })}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                {allocatedAtClose
                  ? t('ui.fordelades_pa_varje_delagares_resultatkonto_nar')
                  : locked
                    ? t('ui.bokfors_fran_2099_arets_resultat_till_varje_dela')
                    : t('ui.bokslutet_bokar_resultatet_direkt_pa_varje_delag')}
              </div>
            </div>
          </div>
          {locked && !allocationBooked && <button type="button" style={btn(true)} onClick={bookAllocation}>{t('ui.bokfor_resultatfordelning')}</button>}
        </div>
      )}

      {statement.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
          <div style={{ padding: '16px 20px', fontWeight: 700, fontSize: '14px' }}>{t('ui.underlag_for_n3a')} {year}</div>
          <ListTable
            rowKey={s => s.partner.id}
            rows={statement}
            mobileList={s => ({ primary: s.partner.name, amount: `${fmt(s.share)} kr`, meta: t('ui.uttag_kr', { sharePct: s.partner.sharePct, v1: fmt(s.uttag) }) })}
            columns={[
              { key: 'name', label: t('ui.delagare'), fontWeight: 600, color: 'var(--text-main)', render: s => s.partner.name },
              { key: 'sharePct', label: t('ui.andel'), align: 'right', render: s => `${s.partner.sharePct} %` },
              { key: 'share', label: locked ? t('ui.andel_av_resultatet') : t('ui.andel_av_resultatet_hittills'), align: 'right', color: 'var(--text-main)', render: s => `${fmt(s.share)} kr` },
              { key: 'insattningar', label: t('ui.insattningar'), align: 'right', render: s => `${fmt(s.insattningar)} kr` },
              { key: 'uttag', label: t('ui.uttag'), align: 'right', render: s => `${fmt(s.uttag)} kr` },
            ]}
          />
        </div>
      )}
    </div>
  );
}
