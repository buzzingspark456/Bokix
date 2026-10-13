import React, { useMemo, useState } from 'react';
import ListTable from './shared/ListTable';
import {
  markupPct, marginPct, priceFromMargin, priceFromMarkup, withVat, roundPrice, marginAfterDiscount,
  maxDiscountForMargin, breakEvenUnits, hourlyRate, pricingStatus,
} from '../utils/pricing';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtPctVal = (v) => (v == null ? '—' : `${numberFormat('sv-SE', { maximumFractionDigits: 1 }).format(v)} %`);

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' };
const btn = { padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)' };
const num = (v) => (v === '' || v == null ? '' : v);

const STATUS = {
  ok: { label: t('ui.nar_malet'), color: 'var(--status-green-text)', bg: 'var(--status-green-bg)' },
  below: { label: t('ui.under_malet'), color: 'var(--status-amber-text)', bg: 'var(--status-amber-bg)' },
  loss: { label: t('ui.saljs_med_forlust'), color: 'var(--status-red-text)', bg: 'var(--status-red-bg)' },
  no_cost: { label: t('ui.inkopspris_saknas'), color: 'var(--text-secondary)', bg: 'var(--bg-muted)' },
  no_price: { label: t('ui.pris_saknas'), color: 'var(--text-secondary)', bg: 'var(--bg-muted)' },
};

function Result({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: '13.5px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600 }}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, step = 'any' }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type="number" step={step} style={inp} value={num(value)} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

/**
 * Prissättning — flik under Artiklar. Räknar påslag/marginal, föreslår pris
 * mot en målmarginal och visar vad en rabatt gör med marginalen.
 * Räkningen ligger i utils/pricing.js.
 */
export default function PricingTool({ articles = [], setArticles, company, setCompanyInfo }) {
  const targetMargin = company?.pricingSettings?.targetMargin ?? 30;
  const setTarget = (v) => setCompanyInfo(prev => ({ ...prev, pricingSettings: { ...(prev.pricingSettings || {}), targetMargin: v === '' ? '' : Number(v) } }));

  const rows = useMemo(() => articles
    .map(a => ({ ...a, info: pricingStatus(a, targetMargin) }))
    .filter(a => Number(a.purchasePrice) > 0 || a.type === 'vara')
    .sort((a, b) => (a.info.margin ?? 999) - (b.info.margin ?? 999)), [articles, targetMargin]);

  const applySuggestion = (article, price) => {
    setArticles(prev => prev.map(a => ((a.id && a.id === article.id) ? { ...a, unitPrice: price } : a)));
  };

  // ── Prisräknare ──
  const [cost, setCost] = useState('');
  const [mode, setMode] = useState('margin');
  const [target, setTargetPct] = useState(40);
  const [vat, setVat] = useState(25);
  const [rounding, setRounding] = useState('none');
  const raw = mode === 'margin' ? priceFromMargin(cost, target) : priceFromMarkup(cost, target);
  const price = raw == null ? null : roundPrice(raw, rounding);

  // ── Rabatt ──
  const [dPrice, setDPrice] = useState('');
  const [dCost, setDCost] = useState('');
  const [dPct, setDPct] = useState(10);
  const [dMin, setDMin] = useState(20);

  // ── Nollpunkt ──
  const [fixed, setFixed] = useState('');
  const [bePrice, setBePrice] = useState('');
  const [beVar, setBeVar] = useState('');

  // ── Timpris ──
  const [monthlyCosts, setMonthlyCosts] = useState('');
  const [pay, setPay] = useState('');
  const [hours, setHours] = useState(100);
  const [buffer, setBuffer] = useState(10);
  const rate = hourlyRate({ monthlyCosts, desiredMonthlyPay: pay, billableHoursPerMonth: hours, bufferPct: buffer });

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ width: '200px' }}>
          <Field label={t('ui.malmarginal')} value={targetMargin} onChange={setTarget} />
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: '240px' }}>
          {t('ui.marginal_ar_vinsten_som_andel_av_priset_50_pasla')}
        </p>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={a => a.id || a.articleNumber || a.description}
          rows={rows}
          emptyMessage={t('ui.lagg_in_inkopspris_pa_dina_varor_under_artiklar')}
          mobileList={a => ({ primary: a.description, amount: fmtPctVal(a.info.margin), meta: t('ui.kr_label', { v0: fmt(a.unitPrice), label: STATUS[a.info.status].label }) })}
          columns={[
            { key: 'description', label: t('ui.artikel'), fontWeight: 600, color: 'var(--text-main)', render: a => a.description },
            { key: 'purchasePrice', label: t('ui.inkopspris'), align: 'right', render: a => (a.purchasePrice ? `${fmt(a.purchasePrice)} kr` : '—') },
            { key: 'unitPrice', label: t('ui.pris_exkl_moms_2'), align: 'right', render: a => `${fmt(a.unitPrice)} kr` },
            { key: 'margin', label: t('ui.marginal'), align: 'right', color: 'var(--text-main)', render: a => fmtPctVal(a.info.margin) },
            { key: 'markup', label: t('ui.paslag'), align: 'right', render: a => fmtPctVal(a.info.markup) },
            {
              key: 'status', label: t('ui.status'),
              render: a => { const s = STATUS[a.info.status]; return <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>; },
            },
            {
              key: 'suggested', label: t('ui.forslag'), align: 'right',
              render: a => (['below', 'loss'].includes(a.info.status) && a.info.suggested
                ? <button type="button" style={btn} onClick={() => applySuggestion(a, a.info.suggested)}>{t('ui.satt')} {fmt(a.info.suggested)} {t('ui.kr')}</button>
                : null),
            },
          ]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>{t('ui.vilket_pris_ska_jag_ta')}</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <Field label={t('ui.inkopspris_kostnad_kr')} value={cost} onChange={setCost} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>{t('ui.utga_fran')}</label>
                <select style={inp} value={mode} onChange={e => setMode(e.target.value)}>
                  <option value="margin">{t('ui.marginal')}</option>
                  <option value="markup">{t('ui.paslag')}</option>
                </select>
              </div>
              <Field label={t('ui.procent')} value={target} onChange={setTargetPct} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>{t('ui.moms')}</label>
                <select style={inp} value={vat} onChange={e => setVat(Number(e.target.value))}>{[0, 6, 12, 25].map(r => <option key={r} value={r}>{r} %</option>)}</select>
              </div>
              <div>
                <label style={lbl}>{t('ui.avrunda')}</label>
                <select style={inp} value={rounding} onChange={e => setRounding(e.target.value)}>
                  <option value="none">{t('ui.ingen')}</option><option value="krona">{t('ui.hel_krona')}</option><option value="nine">{t('ui.slutar_pa_9')}</option>
                </select>
              </div>
            </div>
          </div>
          {price != null && Number(cost) > 0 && (
            <div style={{ marginTop: '14px' }}>
              <Result label={t('ui.pris_exkl_moms')} value={`${fmt(price)} kr`} strong />
              <Result label={t('ui.pris_inkl_moms')} value={`${fmt(withVat(price, vat))} kr`} />
              <Result label={t('ui.marginal')} value={fmtPctVal(marginPct(price, cost))} />
              <Result label={t('ui.paslag')} value={fmtPctVal(markupPct(price, cost))} />
              <Result label={t('ui.vinst_per_enhet')} value={`${fmt(price - cost)} kr`} />
            </div>
          )}
          {price == null && <p style={{ fontSize: '12.5px', color: 'var(--status-red-text)', margin: '12px 0 0' }}>{t('ui.en_marginal_pa_100_eller_mer_gar_inte_att_na')}</p>}
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>{t('ui.vad_tal_jag_for_rabatt')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label={t('ui.pris_kr')} value={dPrice} onChange={setDPrice} />
            <Field label={t('ui.kostnad_kr')} value={dCost} onChange={setDCost} />
            <Field label={t('ui.rabatt_procent')} value={dPct} onChange={setDPct} />
            <Field label={t('ui.lagsta_marginal')} value={dMin} onChange={setDMin} />
          </div>
          {Number(dPrice) > 0 && Number(dCost) > 0 && (
            <div style={{ marginTop: '14px' }}>
              <Result label={t('ui.marginal_utan_rabatt')} value={fmtPctVal(marginPct(dPrice, dCost))} />
              <Result label={t('ui.marginal_efter_rabatt', { v0: dPct || 0 })} value={fmtPctVal(marginAfterDiscount(dPrice, dCost, dPct))} strong />
              <Result label={t('ui.hogsta_rabatt_for_marginal', { v0: dMin || 0 })} value={fmtPctVal(maxDiscountForMargin(dPrice, dCost, dMin))} />
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>{t('ui.hur_manga_maste_jag_salja')}</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <Field label={t('ui.fasta_kostnader_kr')} value={fixed} onChange={setFixed} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label={t('ui.pris_per_enhet_kr')} value={bePrice} onChange={setBePrice} />
              <Field label={t('ui.rorlig_kostnad_per_enhet_kr')} value={beVar} onChange={setBeVar} />
            </div>
          </div>
          {Number(fixed) > 0 && Number(bePrice) > 0 && (
            <div style={{ marginTop: '14px' }}>
              {breakEvenUnits(fixed, bePrice, beVar) == null
                ? <p style={{ margin: 0, fontSize: '13px', color: 'var(--status-red-text)' }}>{t('ui.varje_sald_enhet_ger_forlust_da_gar_det_aldrig_r')}</p>
                : <>
                  <Result label={t('ui.enheter_for_att_ga_runt')} value={`${breakEvenUnits(fixed, bePrice, beVar)} st`} strong />
                  <Result label={t('ui.tackningsbidrag_per_enhet')} value={`${fmt(bePrice - (Number(beVar) || 0))} kr`} />
                </>}
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>{t('ui.vilket_timpris_behover_jag')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label={t('ui.kostnader_per_manad_kr')} value={monthlyCosts} onChange={setMonthlyCosts} />
            <Field label={t('ui.onskat_uttag_per_manad_kr')} value={pay} onChange={setPay} />
            <Field label={t('ui.debiterbara_timmar_manad')} value={hours} onChange={setHours} />
            <Field label={t('ui.buffert')} value={buffer} onChange={setBuffer} />
          </div>
          {rate != null && (Number(monthlyCosts) > 0 || Number(pay) > 0) && (
            <div style={{ marginTop: '14px' }}>
              <Result label={t('ui.timpris_exkl_moms')} value={`${fmt(rate)} kr`} strong />
              <Result label={t('ui.timpris_inkl_25_moms')} value={`${fmt(withVat(rate, 25))} kr`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
