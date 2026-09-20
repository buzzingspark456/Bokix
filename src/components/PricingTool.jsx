import React, { useMemo, useState } from 'react';
import ListTable from './shared/ListTable';
import {
  markupPct, marginPct, priceFromMargin, priceFromMarkup, withVat, roundPrice, marginAfterDiscount,
  maxDiscountForMargin, breakEvenUnits, hourlyRate, pricingStatus,
} from '../utils/pricing';

const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtPctVal = (v) => (v == null ? '—' : `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(v)} %`);

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
  ok: { label: 'Når målet', color: 'var(--status-green-text)', bg: 'var(--status-green-bg)' },
  below: { label: 'Under målet', color: 'var(--status-amber-text)', bg: 'var(--status-amber-bg)' },
  loss: { label: 'Säljs med förlust', color: 'var(--status-red-text)', bg: 'var(--status-red-bg)' },
  no_cost: { label: 'Inköpspris saknas', color: 'var(--text-secondary)', bg: 'var(--bg-muted)' },
  no_price: { label: 'Pris saknas', color: 'var(--text-secondary)', bg: 'var(--bg-muted)' },
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
          <Field label="Målmarginal (%)" value={targetMargin} onChange={setTarget} />
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: '240px' }}>
          Marginal är vinsten som andel av priset. 50 % påslag på inköpspriset är bara 33 % marginal. Listan nedan jämför dina priser mot målet.
        </p>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={a => a.id || a.articleNumber || a.description}
          rows={rows}
          emptyMessage="Lägg in inköpspris på dina varor under Artiklar (Fler fält) så jämför Bokix marginalen mot ditt mål."
          mobileList={a => ({ primary: a.description, amount: fmtPctVal(a.info.margin), meta: `${fmt(a.unitPrice)} kr · ${STATUS[a.info.status].label}` })}
          columns={[
            { key: 'description', label: 'Artikel', fontWeight: 600, color: 'var(--text-main)', render: a => a.description },
            { key: 'purchasePrice', label: 'Inköpspris', align: 'right', render: a => (a.purchasePrice ? `${fmt(a.purchasePrice)} kr` : '—') },
            { key: 'unitPrice', label: 'Pris (exkl. moms)', align: 'right', render: a => `${fmt(a.unitPrice)} kr` },
            { key: 'margin', label: 'Marginal', align: 'right', color: 'var(--text-main)', render: a => fmtPctVal(a.info.margin) },
            { key: 'markup', label: 'Påslag', align: 'right', render: a => fmtPctVal(a.info.markup) },
            {
              key: 'status', label: 'Status',
              render: a => { const s = STATUS[a.info.status]; return <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>; },
            },
            {
              key: 'suggested', label: 'Förslag', align: 'right',
              render: a => (['below', 'loss'].includes(a.info.status) && a.info.suggested
                ? <button type="button" style={btn} onClick={() => applySuggestion(a, a.info.suggested)}>Sätt {fmt(a.info.suggested)} kr</button>
                : null),
            },
          ]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>Vilket pris ska jag ta?</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <Field label="Inköpspris / kostnad (kr)" value={cost} onChange={setCost} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Utgå från</label>
                <select style={inp} value={mode} onChange={e => setMode(e.target.value)}>
                  <option value="margin">Marginal</option>
                  <option value="markup">Påslag</option>
                </select>
              </div>
              <Field label="Procent" value={target} onChange={setTargetPct} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Moms</label>
                <select style={inp} value={vat} onChange={e => setVat(Number(e.target.value))}>{[0, 6, 12, 25].map(r => <option key={r} value={r}>{r} %</option>)}</select>
              </div>
              <div>
                <label style={lbl}>Avrunda</label>
                <select style={inp} value={rounding} onChange={e => setRounding(e.target.value)}>
                  <option value="none">Ingen</option><option value="krona">Hel krona</option><option value="nine">Slutar på 9</option>
                </select>
              </div>
            </div>
          </div>
          {price != null && Number(cost) > 0 && (
            <div style={{ marginTop: '14px' }}>
              <Result label="Pris exkl. moms" value={`${fmt(price)} kr`} strong />
              <Result label="Pris inkl. moms" value={`${fmt(withVat(price, vat))} kr`} />
              <Result label="Marginal" value={fmtPctVal(marginPct(price, cost))} />
              <Result label="Påslag" value={fmtPctVal(markupPct(price, cost))} />
              <Result label="Vinst per enhet" value={`${fmt(price - cost)} kr`} />
            </div>
          )}
          {price == null && <p style={{ fontSize: '12.5px', color: 'var(--status-red-text)', margin: '12px 0 0' }}>En marginal på 100 % eller mer går inte att nå.</p>}
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>Vad tål jag för rabatt?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Pris (kr)" value={dPrice} onChange={setDPrice} />
            <Field label="Kostnad (kr)" value={dCost} onChange={setDCost} />
            <Field label="Rabatt (%)" value={dPct} onChange={setDPct} />
            <Field label="Lägsta marginal (%)" value={dMin} onChange={setDMin} />
          </div>
          {Number(dPrice) > 0 && Number(dCost) > 0 && (
            <div style={{ marginTop: '14px' }}>
              <Result label="Marginal utan rabatt" value={fmtPctVal(marginPct(dPrice, dCost))} />
              <Result label={`Marginal efter ${dPct || 0} % rabatt`} value={fmtPctVal(marginAfterDiscount(dPrice, dCost, dPct))} strong />
              <Result label={`Högsta rabatt för ${dMin || 0} % marginal`} value={fmtPctVal(maxDiscountForMargin(dPrice, dCost, dMin))} />
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>Hur många måste jag sälja?</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <Field label="Fasta kostnader (kr)" value={fixed} onChange={setFixed} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Pris per enhet (kr)" value={bePrice} onChange={setBePrice} />
              <Field label="Rörlig kostnad per enhet (kr)" value={beVar} onChange={setBeVar} />
            </div>
          </div>
          {Number(fixed) > 0 && Number(bePrice) > 0 && (
            <div style={{ marginTop: '14px' }}>
              {breakEvenUnits(fixed, bePrice, beVar) == null
                ? <p style={{ margin: 0, fontSize: '13px', color: 'var(--status-red-text)' }}>Varje såld enhet ger förlust, då går det aldrig runt.</p>
                : <>
                  <Result label="Enheter för att gå runt" value={`${breakEvenUnits(fixed, bePrice, beVar)} st`} strong />
                  <Result label="Täckningsbidrag per enhet" value={`${fmt(bePrice - (Number(beVar) || 0))} kr`} />
                </>}
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>Vilket timpris behöver jag?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Kostnader per månad (kr)" value={monthlyCosts} onChange={setMonthlyCosts} />
            <Field label="Önskat uttag per månad (kr)" value={pay} onChange={setPay} />
            <Field label="Debiterbara timmar / månad" value={hours} onChange={setHours} />
            <Field label="Buffert (%)" value={buffer} onChange={setBuffer} />
          </div>
          {rate != null && (Number(monthlyCosts) > 0 || Number(pay) > 0) && (
            <div style={{ marginTop: '14px' }}>
              <Result label="Timpris exkl. moms" value={`${fmt(rate)} kr`} strong />
              <Result label="Timpris inkl. 25 % moms" value={`${fmt(withVat(rate, 25))} kr`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
