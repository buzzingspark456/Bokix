import React, { useMemo, useState } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, Trash2, CheckCircle2, AlertTriangle } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  STOCK_METHODS, STOCK_ACCOUNT_KINDS, valuateInventory, ledgerBalanceAt, buildInventoryVerification, deriveInvoiceMovements,
} from '../utils/inventory';
import { t as tr } from '../i18n';
import { numberFormat } from '../utils/intlCache';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtQty = (v) => numberFormat('sv-SE', { maximumFractionDigits: 2 }).format(v || 0);
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mv_${Date.now()}_${Math.random().toString(36).slice(2)}`);

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

const MOVEMENT_TYPES = [
  { id: 'in', label: tr('ui.inleverans_inkop') },
  { id: 'out', label: tr('ui.uttag_forsaljning') },
  { id: 'count', label: tr('ui.inventering_raknat_antal') },
];

/**
 * Lager — flik under Artiklar. Lagerlogg per vara, värdering (FIFO eller
 * vägt genomsnitt, lägsta värdets princip) och bokslutsverifikation.
 * Räkningen ligger i utils/inventory.js.
 */
export default function Inventory({ articles = [], invoices = [], company, verifications = [], onAddVerification, setCompanyInfo }) {
  const manualMovements = useMemo(() => company?.stockMovements || [], [company?.stockMovements]);
  const settings = { method: 'avg', accountKind: 'handelsvaror', lowestValue: true, stockFromInvoices: false, stockFromInvoicesSince: '', ...(company?.inventorySettings || {}) };
  // Lagerutgångar ur fakturor räknas fram här och sparas aldrig, så en ändrad
  // eller raderad faktura ger rätt saldo direkt (se deriveInvoiceMovements).
  const invoiceMovements = useMemo(
    () => (settings.stockFromInvoices ? deriveInvoiceMovements({ invoices, articles, movements: manualMovements, since: settings.stockFromInvoicesSince || null }) : []),
    [settings.stockFromInvoices, settings.stockFromInvoicesSince, invoices, articles, manualMovements],
  );
  const movements = useMemo(() => [...manualMovements, ...invoiceMovements], [manualMovements, invoiceMovements]);
  // Vilket låst räkenskapsår datumet ligger i (null om inget), se utils/fiscalYear.js.
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const goods = articles.filter(a => a.type === 'vara' && a.id);

  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [closingDate, setClosingDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [message, setMessage] = useState('');

  const setSetting = (patch) => setCompanyInfo(prev => ({ ...prev, inventorySettings: { ...settings, ...(prev.inventorySettings || {}), ...patch } }));
  const saveMovements = (next) => setCompanyInfo(prev => ({ ...prev, stockMovements: next }));
  const toggleFromInvoices = (on) => setSetting({ stockFromInvoices: on, stockFromInvoicesSince: on ? (settings.stockFromInvoicesSince || todayIso()) : settings.stockFromInvoicesSince });

  const valuation = useMemo(
    () => valuateInventory({ articles, movements, method: settings.method, asOf: closingDate, applyLowestValue: settings.lowestValue }),
    [articles, movements, settings.method, settings.lowestValue, closingDate],
  );
  const kind = STOCK_ACCOUNT_KINDS.find(k => k.id === settings.accountKind) || STOCK_ACCOUNT_KINDS[0];
  const ledgerBalance = ledgerBalanceAt(verifications, kind.stockAccount, closingDate);
  const closing = buildInventoryVerification({
    date: closingDate, closingValue: valuation.bookValue, ledgerBalance, stockAccount: kind.stockAccount, changeAccount: kind.changeAccount,
  });
  const alreadyBooked = verifications.some(v => v.sourceId === `inventory_${closingDate}` && (v.status || 'booked') !== 'draft');
  const diff = Math.round((valuation.bookValue - ledgerBalance) * 100) / 100;

  const startMovement = () => setForm({ articleId: goods[0]?.id || '', type: 'in', date: todayIso(), qty: '', unitCost: goods[0]?.purchasePrice ?? '' });

  const saveMovement = (e) => {
    e.preventDefault();
    const qty = Number(form.qty);
    if (!form.articleId) return setError(tr('ui.valj_en_vara'));
    if (!(form.type === 'count' ? qty >= 0 && form.qty !== '' : qty > 0)) return setError(tr('ui.ange_ett_antal'));
    if (form.type === 'in' && !(Number(form.unitCost) >= 0 && form.unitCost !== '')) return setError(tr('ui.ange_inkopspris_per_enhet'));
    saveMovements([...manualMovements, {
      id: newId(), articleId: form.articleId, type: form.type, date: form.date, qty,
      unitCost: form.type === 'in' ? Number(form.unitCost) : undefined,
    }]);
    setForm(null); setError('');
  };

  const removeMovement = async (m) => {
    if (!(await confirmDialog(tr('ui.ta_bort_lagerhandelsen_varderingen_raknas_om')))) return;
    saveMovements(manualMovements.filter(x => x.id !== m.id));
  };

  const bookClosing = async () => {
    if (!closing) return;
    if (lockedFor(closingDate)) return setMessage(tr('ui.rakenskapsaret_ar_last', { v0: lockedFor(closingDate) }));
    if (!(await confirmDialog(tr('ui.bokfor_lagerjustering_kr_pa', { v0: closing.rows[0].debet ? '+' : '−', v1: fmt(Math.abs(diff)), stockAccount: kind.stockAccount })))) return;
    onAddVerification(closing);
    setMessage(tr('ui.lagerjusteringen_ar_bokford'));
  };

  const nameOf = (id) => articles.find(a => a.id === id)?.description || tr('ui.borttagen_artikel');
  const recent = movements.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {goods.length === 0 && (
        <div style={{ ...card, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          {tr('ui.lagret_foljer_artiklar_av_typen')} <b>{tr('ui.vara')}</b>{tr('ui.lagg_till_en_vara_under_fliken_artiklar_for_att')}
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          <div>
            <label style={lbl}>{tr('ui.varderingsmetod')}</label>
            <select style={inp} value={settings.method} onChange={e => setSetting({ method: e.target.value })}>
              {STOCK_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>{tr('ui.lagerkonto')}</label>
            <select style={inp} value={settings.accountKind} onChange={e => setSetting({ accountKind: e.target.value })}>
              {STOCK_ACCOUNT_KINDS.map(k => <option key={k.id} value={k.id}>{k.label} ({k.stockAccount})</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>{tr('ui.vardering_per_datum')}</label>
            <input type="date" style={inp} value={closingDate} onChange={e => e.target.value && setClosingDate(e.target.value)} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '13.5px', cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.lowestValue} onChange={e => setSetting({ lowestValue: e.target.checked })} />
          {tr('ui.lagsta_vardets_princip_lagst_av_inkopspris_och_f')}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '13.5px', cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.stockFromInvoices} onChange={e => toggleFromInvoices(e.target.checked)} />
          {tr('ui.dra_av_lagret_automatiskt_nar_jag_fakturerar')}
        </label>
        {settings.stockFromInvoices && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span>{tr('ui.rakna_fakturor_fran_och_med')}</span>
            <input type="date" style={{ ...inp, width: 'auto' }} value={settings.stockFromInvoicesSince} onChange={e => setSetting({ stockFromInvoicesSince: e.target.value })} />
            <span>
              {invoiceMovements.length === 0
                ? tr('ui.inga_fakturarader_hittades_an_raden_maste_ha_sam')
                : tr('ui.fakturarader_raknas_med_lagg_inte_in_samma_forsa', { length: invoiceMovements.length })}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[
          [tr('ui.anskaffningsvarde'), valuation.costValue],
          [tr('ui.nedskrivning'), valuation.writeDown],
          [tr('ui.lagervarde_att_bokfora'), valuation.bookValue],
          [tr('ui.saldo_pa', { stockAccount: kind.stockAccount }), ledgerBalance],
        ].map(([label, value]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{fmt(value)} {tr('ui.kr')}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderColor: closing && !alreadyBooked ? 'var(--status-amber-text)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {closing && !alreadyBooked ? <AlertTriangle size={18} color="var(--status-amber-text)" /> : <CheckCircle2 size={18} color="var(--status-green-text)" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              {alreadyBooked ? tr('ui.lagerjusteringen_per_ar_bokford', { closingDate })
                : closing ? tr('ui.lagret_behover_justeras_med_kr', { v0: diff > 0 ? '+' : '−', v1: fmt(Math.abs(diff)) })
                : valuation.lines.length === 0 ? tr('ui.ingen_lagerlogg_annu') : tr('ui.bokforingen_stammer_med_lagervardet')}
            </div>
            {closing && !alreadyBooked && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                {diff > 0 ? tr('ui.lagret_pa_okar_och_lagerforandringen_pa_minskar', { stockAccount: kind.stockAccount, changeAccount: kind.changeAccount }) : tr('ui.lagret_pa_minskar_och_lagerforandringen_pa_okar', { stockAccount: kind.stockAccount, changeAccount: kind.changeAccount })}
              </div>
            )}
          </div>
        </div>
        {closing && !alreadyBooked && <button type="button" style={btn(true)} onClick={bookClosing}>{tr('ui.bokfor_lagerjustering')}</button>}
      </div>
      {message && <p style={{ margin: 0, fontSize: '13px', color: 'var(--status-green-text)' }}>{message}</p>}

      {form ? (
        <form onSubmit={saveMovement} style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>{tr('ui.ny_lagerhandelse')}</h3>
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={lbl}>{tr('ui.vara')}</label>
              <select style={inp} value={form.articleId} onChange={e => setForm(f => ({ ...f, articleId: e.target.value, unitCost: goods.find(g => g.id === e.target.value)?.purchasePrice ?? f.unitCost }))}>
                {goods.map(g => <option key={g.id} value={g.id}>{g.description}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{tr('ui.typ')}</label>
              <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {MOVEMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>{tr('ui.datum')}</label><input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label style={lbl}>{tr('ui.antal')}</label><input type="number" step="any" style={inp} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} /></div>
            {form.type === 'in' && (
              <div><label style={lbl}>{tr('ui.inkopspris_per_enhet_kr_exkl_moms')}</label><input type="number" step="0.01" style={inp} value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} /></div>
            )}
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '12px 0 0' }}>
            {tr('ui.inventering_anger_hur_manga_du_faktiskt_raknat_s')}
          </p>
          {error && <p style={{ color: 'var(--status-red-text)', fontSize: '13px', margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" style={btn(false)} onClick={() => { setForm(null); setError(''); }}>{tr('ui.avbryt')}</button>
            <button type="submit" style={btn(true)}>{tr('ui.spara')}</button>
          </div>
        </form>
      ) : goods.length > 0 && (
        <div><button type="button" style={btn(true)} onClick={startMovement}><Plus size={14} /> {tr('ui.ny_lagerhandelse')}</button></div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={l => l.articleId}
          rows={valuation.lines}
          emptyMessage={tr('ui.inget_lager_varderat_annu_registrera_en_inlevera')}
          mobileList={l => ({ primary: l.description, amount: `${fmt(l.bookValue)} kr`, meta: tr('ui.st_kr', { v0: fmtQty(l.qty), v1: fmt(l.unitCost) }) })}
          columns={[
            { key: 'description', label: tr('ui.vara'), fontWeight: 600, color: 'var(--text-main)', render: l => l.description },
            { key: 'qty', label: tr('ui.antal'), align: 'right', render: l => fmtQty(l.qty) },
            { key: 'unitCost', label: tr('ui.pris_2'), align: 'right', render: l => `${fmt(l.unitCost)} kr` },
            { key: 'costValue', label: tr('ui.anskaffningsvarde'), align: 'right', render: l => `${fmt(l.costValue)} kr` },
            { key: 'writeDown', label: tr('ui.nedskrivning'), align: 'right', render: l => (l.writeDown > 0 ? `${fmt(l.writeDown)} kr` : '—') },
            { key: 'bookValue', label: tr('ui.varde'), align: 'right', color: 'var(--text-main)', render: l => `${fmt(l.bookValue)} kr` },
            { key: 'shortfall', label: '', render: l => (l.shortfall > 0 ? <span title={tr('ui.fler_uttag_an_inleveranser_registrerade')} style={{ color: 'var(--status-red-text)', fontSize: '12px' }}>{tr('ui.saknar')} {fmtQty(l.shortfall)} {tr('ui.inleverans')}</span> : null) },
          ]}
        />
      </div>

      {recent.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>{tr('ui.senaste_lagerhandelser')}</div>
          {recent.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: '13.5px' }}>
              <span>
                {m.date} · {m.source === 'invoice' ? (m.type === 'in' ? tr('ui.retur_kreditfaktura') : tr('ui.sald_pa_faktura')) : MOVEMENT_TYPES.find(t => t.id === m.type)?.label} · {nameOf(m.articleId)} · {fmtQty(m.qty)} {tr('ui.st')}{m.type === 'in' && m.source !== 'invoice' ? tr('ui.kr_4', { v0: fmt(m.unitCost) }) : ''}
                {m.source === 'invoice' && m.invoiceNumber ? tr('ui.faktura', { invoiceNumber: m.invoiceNumber }) : ''}
              </span>
              {m.source === 'invoice'
                ? <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tr('ui.automatiskt')}</span>
                : <button type="button" title={tr('ui.ta_bort')} onClick={() => removeMovement(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
