import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Trash2 } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import { reconcileBank, reconcileCash, latestReconciliations } from '../utils/reconciliation';
import { t as tr } from '../i18n';
import { numberFormat } from '../utils/intlCache';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}_${Math.random().toString(36).slice(2)}`);
const isZero = (n) => Math.abs(n || 0) < 0.005;

/**
 * Kontroll mot banken (avstämning av bankkonton och kassa), flik i Bank.
 * Samma platta stil som Skatt och bokslut: statusrad överst, sedan saldot
 * att fylla i med siffrorna på en rad, sist historiken. Bokfört saldo och ej
 * hanterade transaktioner syns direkt, innan något är ifyllt. Räkningen
 * ligger i utils/reconciliation.js.
 */
export default function Reconciliation({ bankAccounts = [], bankTransactions = [], verifications = [], accounts = [], reconciliations = [], onSave, onDelete }) {
  const hasCashAccount = accounts.some(a => a.code === '1910');
  const targets = useMemo(() => [
    ...bankAccounts.map(a => ({ key: a.id, kind: 'bank', name: a.name, ledgerAccount: a.ledgerAccount, accountId: a.id })),
    ...(hasCashAccount ? [{ key: 'cash', kind: 'cash', name: tr('reconcileUi.cash'), ledgerAccount: '1910' }] : []),
  ], [bankAccounts, hasCashAccount]);

  const [targetKey, setTargetKey] = useState(targets[0]?.key);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const target = targets.find(t => t.key === targetKey) || targets[0];
  const isCash = target?.kind === 'cash';
  const latest = useMemo(() => latestReconciliations(reconciliations), [reconciliations]);
  const last = target ? latest.get(target.ledgerAccount) : null;

  // Räknas även utan ifyllt belopp, så bokfört saldo och ej hanterade syns direkt.
  const result = useMemo(() => {
    if (!target) return null;
    const value = amount === '' ? 0 : amount;
    return isCash
      ? reconcileCash({ verifications, ledgerAccount: target.ledgerAccount, countedAmount: value, date })
      : reconcileBank({ verifications, bankTransactions, ledgerAccount: target.ledgerAccount, accountId: target.accountId, statementBalance: value, date });
  }, [target, isCash, amount, date, verifications, bankTransactions]);
  const filled = amount !== '';

  const save = () => {
    if (!result || !filled) return;
    onSave({
      id: newId(), ledgerAccount: target.ledgerAccount, accountName: target.name, kind: target.kind, date,
      statementBalance: isCash ? result.countedAmount : result.statementBalance,
      ledgerBalance: result.ledgerBalance, pending: result.pendingNet || 0, difference: result.difference,
      note: note.trim(), createdAt: new Date().toISOString(),
    });
    setAmount(''); setNote('');
    setMessage(result.reconciled ? tr('ui.avstamningen_ar_sparad') : tr('ui.avstamningen_ar_sparad_med_differens'));
  };

  const remove = async (r) => {
    if (!(await confirmDialog(tr('ui.ta_bort_avstamningen_ur_historiken')))) return;
    onDelete(r.id);
  };

  const history = [...reconciliations].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const lastOk = last && isZero(last.difference);
  const tone = !last ? '' : lastOk ? 'done' : 'warn';

  if (!target) {
    return <div className="fp-page"><div className="fp-section">{tr('reconcileUi.noAccounts')}</div></div>;
  }

  return (
    <div className="fp-page">
      <section className={`fp-strip ${tone}`}>
        <div>
          <div className="fp-strip-title">{lastOk && <CheckCircle2 size={18} />}{target.name} <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>({target.ledgerAccount})</span></div>
          <div className="fp-strip-sub">
            {!last ? tr('ui.aldrig_avstamd')
              : lastOk ? tr('reconcileUi.lastOk', { date: last.date })
              : <>{tr('reconcileUi.lastDiff', { date: last.date })} <strong>{fmt(last.difference)} kr</strong></>}
          </div>
          <div className="fp-hint" style={{ marginTop: '6px' }}>{isCash ? tr('reconcileUi.leadCash') : tr('reconcileUi.lead')}</div>
        </div>
      </section>

      {targets.length > 1 && (
        <div className="filter-pills fp-pills" role="tablist" aria-label={tr('ui.konto_2')}>
          {targets.map(t => {
            const l = latest.get(t.ledgerAccount);
            const ok = l && isZero(l.difference);
            return (
              <button key={t.key} type="button" role="tab" aria-selected={t.key === target.key}
                className={`filter-pill${t.key === target.key ? ' active' : ''}`}
                onClick={() => { setTargetKey(t.key); setAmount(''); setMessage(''); }}>
                {t.name}{ok ? ' ✓' : ''}
              </button>
            );
          })}
        </div>
      )}

      <section className="fp-section">
        <div className="fp-fields">
          <div className="fp-grid-2">
            <div>
              <label className="fp-label">{tr('ui.datum')}</label>
              <input type="date" className="fp-input" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
            </div>
            <div>
              <label className="fp-label">{isCash ? tr('ui.raknade_kontanter_kr') : tr('ui.saldo_enligt_kontoutdraget_kr')}</label>
              <input type="number" inputMode="decimal" step="0.01" className="fp-input" value={amount} onChange={e => { setAmount(e.target.value); setMessage(''); }} placeholder="0,00" />
            </div>
          </div>
        </div>
      </section>

      {result && (
        <div className="fp-stats">
          <div className="fp-stat">
            <div className="fp-stat-label">{isCash ? tr('ui.raknade_kontanter') : tr('ui.saldo_enligt_kontoutdrag')}</div>
            <div className="fp-stat-value">{filled ? `${fmt(isCash ? result.countedAmount : result.statementBalance)} kr` : '–'}</div>
          </div>
          <div className="fp-stat">
            <div className="fp-stat-label">{tr('ui.bokfort_saldo_pa', { ledgerAccount: target.ledgerAccount })}</div>
            <div className="fp-stat-value">{fmt(result.ledgerBalance)} kr</div>
          </div>
          {!isCash && (
            <div className="fp-stat">
              <div className="fp-stat-label">{tr('ui.ej_hanterade_transaktioner_st', { pendingCount: result.pendingCount })}</div>
              <div className="fp-stat-value">{result.pendingNet > 0 ? '+' : ''}{fmt(result.pendingNet)} kr</div>
            </div>
          )}
          <div className="fp-stat">
            <div className="fp-stat-label">{filled && result.reconciled ? tr('ui.avstamt') : tr('ui.differens')}</div>
            <div className="fp-stat-value" style={{ color: !filled ? 'var(--text-muted)' : result.reconciled ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
              {filled ? `${fmt(result.difference)} kr` : '–'}
            </div>
          </div>
        </div>
      )}

      {result && filled && (
        <section className="fp-section">
          <div className="fp-fields">
            <div className={`fp-hint ${result.reconciled ? 'good' : 'bad'}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px', marginTop: 0 }}>
              {result.reconciled ? <CheckCircle2 size={17} style={{ flexShrink: 0 }} /> : <AlertTriangle size={17} style={{ flexShrink: 0 }} />}
              <span>
                {result.reconciled
                  ? tr('ui.kontot_stammer_spara_avstamningen_som_underlag_i')
                  : isCash
                    ? tr('ui.kassan_stammer_inte_mot_bokforingen_kontrollera')
                    : result.difference > 0
                      ? tr('ui.banken_har_mer_pengar_an_bokforingen_forvantar_s')
                      : tr('ui.banken_har_mindre_pengar_an_bokforingen_forvanta')}
              </span>
            </div>
            <div>
              <label className="fp-label">{tr('ui.anteckning_valfri')}</label>
              <input className="fp-input" value={note} onChange={e => setNote(e.target.value)} placeholder={tr('ui.t_ex_differensen_ar_en_obokford_bankavgift')} />
            </div>
          </div>
          <div className="fp-foot">
            <button type="button" className="agi-btn primary" onClick={save}><CheckCircle2 size={15} /> {tr('ui.spara_avstamning')}</button>
          </div>
        </section>
      )}

      {message && <div className="fp-section"><div className="fp-hint good" style={{ marginTop: 0 }}>{message}</div></div>}

      <section className="fp-section" style={{ paddingBottom: 0, borderBottom: 'none' }}>
        <h3 className="fp-title">{tr('reconcileUi.history')}</h3>
      </section>
      <ListTable
        rowKey={r => r.id}
        rows={history}
        emptyMessage={tr('ui.inga_sparade_avstamningar_annu')}
        mobileList={r => ({
          dot: isZero(r.difference) ? 'var(--status-green-text)' : 'var(--status-red-text)',
          primary: `${r.accountName} (${r.ledgerAccount})`,
          amount: isZero(r.difference) ? tr('ui.avstamt') : `${fmt(r.difference)} kr`,
          meta: `${r.date}${r.note ? ` · ${r.note}` : ''}`,
        })}
        columns={[
          { key: 'date', label: tr('ui.datum'), render: r => r.date },
          { key: 'accountName', label: tr('ui.konto_2'), fontWeight: 600, color: 'var(--text-main)', render: r => `${r.accountName} (${r.ledgerAccount})` },
          { key: 'statementBalance', label: tr('ui.kontoutdrag'), align: 'right', render: r => `${fmt(r.statementBalance)} kr` },
          { key: 'ledgerBalance', label: tr('ui.bokfort_2'), align: 'right', render: r => `${fmt(r.ledgerBalance)} kr` },
          {
            key: 'difference', label: tr('ui.differens'), align: 'right',
            render: r => isZero(r.difference)
              ? <span className="agi-pill ok">{tr('ui.avstamt')}</span>
              : <span style={{ color: 'var(--status-red-text)', fontWeight: 600 }}>{fmt(r.difference)} kr</span>,
          },
          { key: 'note', label: tr('ui.anteckning'), wrap: true, render: r => r.note || '' },
          {
            key: 'actions', label: '', align: 'right', width: 50,
            render: r => <button type="button" title={tr('ui.ta_bort')} onClick={() => remove(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-red-text)', padding: '2px' }}><Trash2 size={14} /></button>,
          },
        ]}
      />
    </div>
  );
}
