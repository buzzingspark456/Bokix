import React, { useMemo, useState } from 'react';
import { Plus, Trash2, CheckCircle2, AlertTriangle } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  STOCK_METHODS, STOCK_ACCOUNT_KINDS, valuateInventory, ledgerBalanceAt, buildInventoryVerification, deriveInvoiceMovements,
} from '../utils/inventory';

const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtQty = (v) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(v || 0);
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
  { id: 'in', label: 'Inleverans (inköp)' },
  { id: 'out', label: 'Uttag / försäljning' },
  { id: 'count', label: 'Inventering (räknat antal)' },
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
  const lockedYears = Object.keys(company?.lockedFiscalYears || {});
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
    if (!form.articleId) return setError('Välj en vara.');
    if (!(form.type === 'count' ? qty >= 0 && form.qty !== '' : qty > 0)) return setError('Ange ett antal.');
    if (form.type === 'in' && !(Number(form.unitCost) >= 0 && form.unitCost !== '')) return setError('Ange inköpspris per enhet.');
    saveMovements([...manualMovements, {
      id: newId(), articleId: form.articleId, type: form.type, date: form.date, qty,
      unitCost: form.type === 'in' ? Number(form.unitCost) : undefined,
    }]);
    setForm(null); setError('');
  };

  const removeMovement = async (m) => {
    if (!(await confirmDialog('Ta bort lagerhändelsen? Värderingen räknas om.'))) return;
    saveMovements(manualMovements.filter(x => x.id !== m.id));
  };

  const bookClosing = async () => {
    if (!closing) return;
    if (lockedYears.includes(closingDate.slice(0, 4))) return setMessage(`Räkenskapsåret ${closingDate.slice(0, 4)} är låst.`);
    if (!(await confirmDialog(`Bokför lagerjustering ${closing.rows[0].debet ? '+' : '−'}${fmt(Math.abs(diff))} kr på ${kind.stockAccount}?`))) return;
    onAddVerification(closing);
    setMessage('Lagerjusteringen är bokförd.');
  };

  const nameOf = (id) => articles.find(a => a.id === id)?.description || 'Borttagen artikel';
  const recent = movements.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {goods.length === 0 && (
        <div style={{ ...card, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          Lagret följer artiklar av typen <b>Vara</b>. Lägg till en vara under fliken Artiklar för att börja registrera lagerhändelser.
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          <div>
            <label style={lbl}>Värderingsmetod</label>
            <select style={inp} value={settings.method} onChange={e => setSetting({ method: e.target.value })}>
              {STOCK_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Lagerkonto</label>
            <select style={inp} value={settings.accountKind} onChange={e => setSetting({ accountKind: e.target.value })}>
              {STOCK_ACCOUNT_KINDS.map(k => <option key={k.id} value={k.id}>{k.label} ({k.stockAccount})</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Värdering per datum</label>
            <input type="date" style={inp} value={closingDate} onChange={e => e.target.value && setClosingDate(e.target.value)} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '13.5px', cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.lowestValue} onChange={e => setSetting({ lowestValue: e.target.checked })} />
          Lägsta värdets princip (lägst av inköpspris och försäljningspris)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '13.5px', cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.stockFromInvoices} onChange={e => toggleFromInvoices(e.target.checked)} />
          Dra av lagret automatiskt när jag fakturerar
        </label>
        {settings.stockFromInvoices && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span>Räkna fakturor från och med</span>
            <input type="date" style={{ ...inp, width: 'auto' }} value={settings.stockFromInvoicesSince} onChange={e => setSetting({ stockFromInvoicesSince: e.target.value })} />
            <span>
              {invoiceMovements.length === 0
                ? 'Inga fakturarader hittades än. Raden måste ha samma artikelnummer eller benämning som varan, och varan måste ha en inleverans eller inventering.'
                : `${invoiceMovements.length} fakturarader räknas med. Lägg inte in samma försäljning som uttag för hand.`}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[
          ['Anskaffningsvärde', valuation.costValue],
          ['Nedskrivning', valuation.writeDown],
          ['Lagervärde att bokföra', valuation.bookValue],
          [`Saldo på ${kind.stockAccount}`, ledgerBalance],
        ].map(([label, value]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{fmt(value)} kr</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderColor: closing && !alreadyBooked ? 'var(--status-amber-text)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {closing && !alreadyBooked ? <AlertTriangle size={18} color="var(--status-amber-text)" /> : <CheckCircle2 size={18} color="var(--status-green-text)" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              {alreadyBooked ? `Lagerjusteringen per ${closingDate} är bokförd`
                : closing ? `Lagret behöver justeras med ${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))} kr`
                : valuation.lines.length === 0 ? 'Ingen lagerlogg ännu' : 'Bokföringen stämmer med lagervärdet'}
            </div>
            {closing && !alreadyBooked && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                {diff > 0 ? `Lagret på ${kind.stockAccount} ökar och lagerförändringen på ${kind.changeAccount} minskar kostnaden` : `Lagret på ${kind.stockAccount} minskar och lagerförändringen på ${kind.changeAccount} ökar kostnaden`}
              </div>
            )}
          </div>
        </div>
        {closing && !alreadyBooked && <button type="button" style={btn(true)} onClick={bookClosing}>Bokför lagerjustering</button>}
      </div>
      {message && <p style={{ margin: 0, fontSize: '13px', color: 'var(--status-green-text)' }}>{message}</p>}

      {form ? (
        <form onSubmit={saveMovement} style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>Ny lagerhändelse</h3>
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={lbl}>Vara</label>
              <select style={inp} value={form.articleId} onChange={e => setForm(f => ({ ...f, articleId: e.target.value, unitCost: goods.find(g => g.id === e.target.value)?.purchasePrice ?? f.unitCost }))}>
                {goods.map(g => <option key={g.id} value={g.id}>{g.description}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Typ</label>
              <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {MOVEMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Datum</label><input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label style={lbl}>Antal</label><input type="number" step="any" style={inp} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} /></div>
            {form.type === 'in' && (
              <div><label style={lbl}>Inköpspris per enhet (kr, exkl. moms)</label><input type="number" step="0.01" style={inp} value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} /></div>
            )}
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '12px 0 0' }}>
            Inventering anger hur många du faktiskt räknat. Skillnaden mot bokfört saldo blir svinn eller överskott.
          </p>
          {error && <p style={{ color: 'var(--status-red-text)', fontSize: '13px', margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" style={btn(false)} onClick={() => { setForm(null); setError(''); }}>Avbryt</button>
            <button type="submit" style={btn(true)}>Spara</button>
          </div>
        </form>
      ) : goods.length > 0 && (
        <div><button type="button" style={btn(true)} onClick={startMovement}><Plus size={14} /> Ny lagerhändelse</button></div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={l => l.articleId}
          rows={valuation.lines}
          emptyMessage="Inget lager värderat ännu. Registrera en inleverans så räknar Bokix ut lagervärdet."
          mobileList={l => ({ primary: l.description, amount: `${fmt(l.bookValue)} kr`, meta: `${fmtQty(l.qty)} st à ${fmt(l.unitCost)} kr` })}
          columns={[
            { key: 'description', label: 'Vara', fontWeight: 600, color: 'var(--text-main)', render: l => l.description },
            { key: 'qty', label: 'Antal', align: 'right', render: l => fmtQty(l.qty) },
            { key: 'unitCost', label: 'À-pris', align: 'right', render: l => `${fmt(l.unitCost)} kr` },
            { key: 'costValue', label: 'Anskaffningsvärde', align: 'right', render: l => `${fmt(l.costValue)} kr` },
            { key: 'writeDown', label: 'Nedskrivning', align: 'right', render: l => (l.writeDown > 0 ? `${fmt(l.writeDown)} kr` : '—') },
            { key: 'bookValue', label: 'Värde', align: 'right', color: 'var(--text-main)', render: l => `${fmt(l.bookValue)} kr` },
            { key: 'shortfall', label: '', render: l => (l.shortfall > 0 ? <span title="Fler uttag än inleveranser registrerade" style={{ color: 'var(--status-red-text)', fontSize: '12px' }}>Saknar {fmtQty(l.shortfall)} inleverans</span> : null) },
          ]}
        />
      </div>

      {recent.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Senaste lagerhändelser</div>
          {recent.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: '13.5px' }}>
              <span>
                {m.date} · {m.source === 'invoice' ? (m.type === 'in' ? 'Retur (kreditfaktura)' : 'Såld på faktura') : MOVEMENT_TYPES.find(t => t.id === m.type)?.label} · {nameOf(m.articleId)} · {fmtQty(m.qty)} st{m.type === 'in' && m.source !== 'invoice' ? ` à ${fmt(m.unitCost)} kr` : ''}
                {m.source === 'invoice' && m.invoiceNumber ? ` · faktura ${m.invoiceNumber}` : ''}
              </span>
              {m.source === 'invoice'
                ? <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automatiskt</span>
                : <button type="button" title="Ta bort" onClick={() => removeMovement(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
