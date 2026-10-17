import React, { useMemo, useState } from 'react';
import ListTable from './shared/ListTable';
import {
  markupPct, marginPct, priceFromMargin, priceFromMarkup, withVat, roundPrice, marginAfterDiscount,
  maxDiscountForMargin, breakEvenUnits, hourlyRate, pricingStatus,
} from '../utils/pricing';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtPctVal = (v) => (v == null ? '—' : `${numberFormat('sv-SE', { maximumFractionDigits: 1 }).format(v)} %`);
const num = (v) => (v === '' || v == null ? '' : v);

const STATUS = {
  ok: { label: t('ui.nar_malet'), cls: 'ok' },
  below: { label: t('ui.under_malet'), cls: 'warn' },
  loss: { label: t('ui.saljs_med_forlust'), cls: 'late' },
  no_cost: { label: t('ui.inkopspris_saknas'), cls: 'mute' },
  no_price: { label: t('ui.pris_saknas'), cls: 'mute' },
};

function Field({ label, value, onChange, suffix, step = 'any' }) {
  return (
    <div>
      <label className="ws-label">{label}</label>
      <div className="ws-input-suffix">
        <input type="number" step={step} className="ws-input" value={num(value)} onChange={e => onChange(e.target.value)} />
        {suffix && <span>{suffix}</span>}
      </div>
    </div>
  );
}

/** Resultatpanelen till höger i räknaren: ett stort tal och några rader under. */
function Result({ title, value, lines = [], empty, error }) {
  return (
    <div style={{ background: 'var(--bg-muted)', borderRadius: '12px', padding: '18px 20px', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '150px' }}>
      {error ? <p className="ws-hint" style={{ color: 'var(--status-red-text)' }}>{error}</p>
        : value == null ? <p className="ws-hint">{empty}</p>
        : <>
          <div className="ws-stat-label">{title}</div>
          <div style={{ fontSize: '30px', fontWeight: 750, letterSpacing: '-0.02em', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', margin: '2px 0 10px' }}>{value}</div>
          {lines.map(([label, v]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0', borderTop: '1px solid var(--border-light)', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </>}
    </div>
  );
}

/** Marginal som en liten stapel mot målet, så man ser direkt vilka som ligger lågt. */
function MarginBar({ margin, target }) {
  if (margin == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const pct = Math.max(0, Math.min(100, margin));
  const cls = margin < 0 ? 'over' : margin < target ? 'warn' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
      <div className={`ws-bar ${cls}`} style={{ width: '72px' }}><span style={{ width: `${pct}%` }} /></div>
      <span style={{ fontWeight: 600, color: 'var(--text-main)', minWidth: '52px', textAlign: 'right' }}>{fmtPctVal(margin)}</span>
    </div>
  );
}

const TOOLS = [
  { id: 'price', label: t('pris.toolPrice'), title: t('ui.vilket_pris_ska_jag_ta') },
  { id: 'discount', label: t('pris.toolDiscount'), title: t('ui.vad_tal_jag_for_rabatt') },
  { id: 'breakeven', label: t('pris.toolBreakeven'), title: t('ui.hur_manga_maste_jag_salja') },
  { id: 'hourly', label: t('pris.toolHourly'), title: t('ui.vilket_timpris_behover_jag') },
];

/**
 * Prissättning — flik under Artiklar (2026-10-17). Överst dina artiklar med
 * marginalen som en stapel mot målet och ett förslag att klicka på när en
 * ligger under. Under det EN räknare med fyra flikar (pris, rabatt,
 * nollpunkt, timpris) i stället för fyra kort med fält bredvid varandra:
 * fälten till vänster, svaret stort till höger. Räkningen ligger i
 * utils/pricing.js.
 */
export default function PricingTool({ articles = [], setArticles, company, setCompanyInfo }) {
  const targetMargin = company?.pricingSettings?.targetMargin ?? 30;
  const setTarget = (v) => setCompanyInfo(prev => ({ ...prev, pricingSettings: { ...(prev.pricingSettings || {}), targetMargin: v === '' ? '' : Number(v) } }));

  const rows = useMemo(() => articles
    .map(a => ({ ...a, info: pricingStatus(a, targetMargin) }))
    .filter(a => Number(a.purchasePrice) > 0 || a.type === 'vara')
    .sort((a, b) => (a.info.margin ?? 999) - (b.info.margin ?? 999)), [articles, targetMargin]);
  const belowCount = rows.filter(a => ['below', 'loss'].includes(a.info.status)).length;

  const applySuggestion = (article, price) => {
    setArticles(prev => prev.map(a => ((a.id && a.id === article.id) ? { ...a, unitPrice: price } : a)));
  };

  const [tool, setTool] = useState('price');

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
  const units = breakEvenUnits(fixed, bePrice, beVar);

  // ── Timpris ──
  const [monthlyCosts, setMonthlyCosts] = useState('');
  const [pay, setPay] = useState('');
  const [hours, setHours] = useState(100);
  const [buffer, setBuffer] = useState(10);
  const rate = hourlyRate({ monthlyCosts, desiredMonthlyPay: pay, billableHoursPerMonth: hours, bufferPct: buffer });

  const current = TOOLS.find(x => x.id === tool);

  return (
    <div className="ws-page">
      <div className="ws-card">
        <div className="ws-card-head">
          <div>
            <h3 className="ws-card-title">{t('pris.yourPrices')}</h3>
            <p className="ws-card-sub">
              {rows.length === 0 ? t('pris.yourPricesEmpty')
                : belowCount > 0 ? t('pris.belowCount', { n: belowCount })
                : t('pris.allOk')}
            </p>
          </div>
          <div className="ws-card-actions">
            <label className="ws-hint" htmlFor="pz-target" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t('pris.target')}</label>
            <div className="ws-input-suffix" style={{ width: '96px' }}>
              <input id="pz-target" type="number" className="ws-input" style={{ height: '36px' }} value={num(targetMargin)} onChange={e => setTarget(e.target.value)} />
              <span>%</span>
            </div>
          </div>
        </div>
        <ListTable
          bordered={false}
          rowKey={a => a.id || a.articleNumber || a.description}
          rows={rows}
          emptyMessage={t('ui.lagg_in_inkopspris_pa_dina_varor_under_artiklar')}
          mobileList={a => ({ primary: a.description, amount: fmtPctVal(a.info.margin), meta: t('ui.kr_label', { v0: fmt(a.unitPrice), label: STATUS[a.info.status].label }) })}
          columns={[
            { key: 'description', label: t('ui.artikel'), fontWeight: 600, color: 'var(--text-main)', render: a => a.description },
            { key: 'purchasePrice', label: t('ui.inkopspris'), align: 'right', render: a => (a.purchasePrice ? `${fmt(a.purchasePrice)} kr` : '—') },
            { key: 'unitPrice', label: t('ui.pris_exkl_moms_2'), align: 'right', color: 'var(--text-main)', render: a => `${fmt(a.unitPrice)} kr` },
            { key: 'margin', label: t('ui.marginal'), align: 'right', render: a => <MarginBar margin={a.info.margin} target={Number(targetMargin) || 0} /> },
            { key: 'status', label: t('ui.status'), render: a => { const s = STATUS[a.info.status]; return <span className={`agi-pill ${s.cls}`}>{s.label}</span>; } },
            {
              key: 'suggested', label: '', align: 'right',
              render: a => (['below', 'loss'].includes(a.info.status) && a.info.suggested
                ? <button type="button" className="agi-btn" style={{ height: '30px' }} onClick={() => applySuggestion(a, a.info.suggested)}>{t('ui.satt')} {fmt(a.info.suggested)} {t('ui.kr')}</button>
                : null),
            },
          ]}
        />
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <div>
            <h3 className="ws-card-title">{current.title}</h3>
            <p className="ws-card-sub">{t(`pris.${tool}Intro`)}</p>
          </div>
          <div className="ws-seg">
            {TOOLS.map(x => <button key={x.id} type="button" className={tool === x.id ? 'on' : ''} onClick={() => setTool(x.id)}>{x.label}</button>)}
          </div>
        </div>
        <div className="ws-card-body ws-cols" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
          {tool === 'price' && <>
            <div className="ws-form" style={{ gap: '14px' }}>
              <Field label={t('ui.inkopspris_kostnad_kr')} value={cost} onChange={setCost} suffix="kr" />
              <div className="ws-grid2">
                <div>
                  <label className="ws-label">{t('ui.utga_fran')}</label>
                  <select className="ws-input" value={mode} onChange={e => setMode(e.target.value)}>
                    <option value="margin">{t('ui.marginal')}</option>
                    <option value="markup">{t('ui.paslag')}</option>
                  </select>
                </div>
                <Field label={t('ui.procent')} value={target} onChange={setTargetPct} suffix="%" />
              </div>
              <div className="ws-grid2">
                <div>
                  <label className="ws-label">{t('ui.moms')}</label>
                  <select className="ws-input" value={vat} onChange={e => setVat(Number(e.target.value))}>{[0, 6, 12, 25].map(r => <option key={r} value={r}>{r} %</option>)}</select>
                </div>
                <div>
                  <label className="ws-label">{t('ui.avrunda')}</label>
                  <select className="ws-input" value={rounding} onChange={e => setRounding(e.target.value)}>
                    <option value="none">{t('ui.ingen')}</option><option value="krona">{t('ui.hel_krona')}</option><option value="nine">{t('ui.slutar_pa_9')}</option>
                  </select>
                </div>
              </div>
            </div>
            <Result
              title={t('ui.pris_exkl_moms')}
              value={price != null && Number(cost) > 0 ? `${fmt(price)} kr` : null}
              empty={t('pris.priceEmpty')}
              error={price == null ? t('ui.en_marginal_pa_100_eller_mer_gar_inte_att_na') : null}
              lines={price != null ? [
                [t('ui.pris_inkl_moms'), `${fmt(withVat(price, vat))} kr`],
                [t('ui.marginal'), fmtPctVal(marginPct(price, cost))],
                [t('ui.paslag'), fmtPctVal(markupPct(price, cost))],
                [t('ui.vinst_per_enhet'), `${fmt(price - cost)} kr`],
              ] : []}
            />
          </>}

          {tool === 'discount' && <>
            <div className="ws-form" style={{ gap: '14px' }}>
              <div className="ws-grid2">
                <Field label={t('ui.pris_kr')} value={dPrice} onChange={setDPrice} suffix="kr" />
                <Field label={t('ui.kostnad_kr')} value={dCost} onChange={setDCost} suffix="kr" />
              </div>
              <div className="ws-grid2">
                <Field label={t('ui.rabatt_procent')} value={dPct} onChange={setDPct} suffix="%" />
                <Field label={t('ui.lagsta_marginal')} value={dMin} onChange={setDMin} suffix="%" />
              </div>
            </div>
            <Result
              title={t('ui.marginal_efter_rabatt', { v0: dPct || 0 })}
              value={Number(dPrice) > 0 && Number(dCost) > 0 ? fmtPctVal(marginAfterDiscount(dPrice, dCost, dPct)) : null}
              empty={t('pris.discountEmpty')}
              lines={[
                [t('ui.marginal_utan_rabatt'), fmtPctVal(marginPct(dPrice, dCost))],
                [t('ui.hogsta_rabatt_for_marginal', { v0: dMin || 0 }), fmtPctVal(maxDiscountForMargin(dPrice, dCost, dMin))],
              ]}
            />
          </>}

          {tool === 'breakeven' && <>
            <div className="ws-form" style={{ gap: '14px' }}>
              <Field label={t('ui.fasta_kostnader_kr')} value={fixed} onChange={setFixed} suffix="kr" />
              <div className="ws-grid2">
                <Field label={t('ui.pris_per_enhet_kr')} value={bePrice} onChange={setBePrice} suffix="kr" />
                <Field label={t('ui.rorlig_kostnad_per_enhet_kr')} value={beVar} onChange={setBeVar} suffix="kr" />
              </div>
            </div>
            <Result
              title={t('ui.enheter_for_att_ga_runt')}
              value={Number(fixed) > 0 && Number(bePrice) > 0 && units != null ? `${units} st` : null}
              empty={t('pris.breakevenEmpty')}
              error={Number(fixed) > 0 && Number(bePrice) > 0 && units == null ? t('ui.varje_sald_enhet_ger_forlust_da_gar_det_aldrig_r') : null}
              lines={[[t('ui.tackningsbidrag_per_enhet'), `${fmt(bePrice - (Number(beVar) || 0))} kr`]]}
            />
          </>}

          {tool === 'hourly' && <>
            <div className="ws-form" style={{ gap: '14px' }}>
              <div className="ws-grid2">
                <Field label={t('ui.kostnader_per_manad_kr')} value={monthlyCosts} onChange={setMonthlyCosts} suffix="kr" />
                <Field label={t('ui.onskat_uttag_per_manad_kr')} value={pay} onChange={setPay} suffix="kr" />
              </div>
              <div className="ws-grid2">
                <Field label={t('ui.debiterbara_timmar_manad')} value={hours} onChange={setHours} suffix="h" />
                <Field label={t('ui.buffert')} value={buffer} onChange={setBuffer} suffix="%" />
              </div>
            </div>
            <Result
              title={t('ui.timpris_exkl_moms')}
              value={rate != null && (Number(monthlyCosts) > 0 || Number(pay) > 0) ? `${fmt(rate)} kr` : null}
              empty={t('pris.hourlyEmpty')}
              lines={rate != null ? [[t('ui.timpris_inkl_25_moms'), `${fmt(withVat(rate, 25))} kr`]] : []}
            />
          </>}
        </div>
      </div>
    </div>
  );
}
