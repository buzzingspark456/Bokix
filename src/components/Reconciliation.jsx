import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Trash2 } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import { reconcileBank, reconcileCash, latestReconciliations } from '../utils/reconciliation';
import { t as tr } from '../i18n';

const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' };
const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff' };

function Line({ label, value, strong, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: '13.5px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600, color: tone || 'var(--text-main)' }}>{value}</span>
    </div>
  );
}

/**
 * Avstämning av bankkonton och kassa — flik i Bank. Kontoutdragets saldo
 * jämförs mot bokföringen, med ej hanterade transaktioner som förklaring.
 * Räkningen ligger i utils/reconciliation.js.
 */
export default function Reconciliation({ bankAccounts = [], bankTransactions = [], verifications = [], accounts = [], reconciliations = [], onSave, onDelete }) {
  const hasCashAccount = accounts.some(a => a.code === '1910');
  const targets = useMemo(() => [
    ...bankAccounts.map(a => ({ key: a.id, kind: 'bank', name: a.name, ledgerAccount: a.ledgerAccount, accountId: a.id })),
    ...(hasCashAccount ? [{ key: 'cash', kind: 'cash', name: 'Kassa', ledgerAccount: '1910' }] : []),
  ], [bankAccounts, hasCashAccount]);

  const [targetKey, setTargetKey] = useState(targets[0]?.key);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const target = targets.find(t => t.key === targetKey) || targets[0];
  const latest = useMemo(() => latestReconciliations(reconciliations), [reconciliations]);

  const result = useMemo(() => {
    if (!target || amount === '') return null;
    return target.kind === 'cash'
      ? reconcileCash({ verifications, ledgerAccount: target.ledgerAccount, countedAmount: amount, date })
      : reconcileBank({ verifications, bankTransactions, ledgerAccount: target.ledgerAccount, accountId: target.accountId, statementBalance: amount, date });
  }, [target, amount, date, verifications, bankTransactions]);

  const save = () => {
    if (!result) return;
    onSave({
      id: newId(), ledgerAccount: target.ledgerAccount, accountName: target.name, kind: target.kind, date,
      statementBalance: target.kind === 'cash' ? result.countedAmount : result.statementBalance,
      ledgerBalance: result.ledgerBalance, pending: result.pendingNet || 0, difference: result.difference,
      note: note.trim(), createdAt: new Date().toISOString(),
    });
    setAmount(''); setNote(''); setMessage(result.reconciled ? tr('ui.avstamningen_ar_sparad') : tr('ui.avstamningen_ar_sparad_med_differens'));
  };

  const remove = async (r) => {
    if (!(await confirmDialog(tr('ui.ta_bort_avstamningen_ur_historiken')))) return;
    onDelete(r.id);
  };

  const history = [...reconciliations].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const isCash = target?.kind === 'cash';

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '680px' }}>
        {tr('ui.stam_av_att_saldot_pa_kontoutdraget_stammer_med')}
      </p>

      {targets.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {targets.map(t => {
            const last = latest.get(t.ledgerAccount);
            const ok = last && Math.abs(last.difference) < 0.005;
            return (
              <button
                key={t.key} type="button" onClick={() => { setTargetKey(t.key); setAmount(''); setMessage(''); }}
                style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: t.key === target?.key ? 'var(--accent)' : 'var(--border)', fontFamily: 'inherit' }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{t.name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({t.ledgerAccount})</span></div>
                <div style={{ fontSize: '12.5px', marginTop: '4px', color: ok ? 'var(--status-green-text)' : 'var(--text-secondary)' }}>
                  {last ? tr('ui.senast_avstamd', { date: last.date, v1: ok ? '' : `, differens ${fmt(last.difference)} kr` }) : tr('ui.aldrig_avstamd')}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {target && (
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>{tr('ui.stam_av')} {target.name} ({target.ledgerAccount})</h3>
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={lbl}>{tr('ui.datum')}</label>
              <input type="date" style={inp} value={date} onChange={e => e.target.value && setDate(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>{isCash ? tr('ui.raknade_kontanter_kr') : tr('ui.saldo_enligt_kontoutdraget_kr')}</label>
              <input type="number" step="0.01" style={inp} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {result && (
            <div style={{ marginTop: '18px' }}>
              <Line label={isCash ? tr('ui.raknade_kontanter') : tr('ui.saldo_enligt_kontoutdrag')} value={`${fmt(isCash ? result.countedAmount : result.statementBalance)} kr`} />
              <Line label={tr('ui.bokfort_saldo_pa', { ledgerAccount: target.ledgerAccount })} value={`${fmt(result.ledgerBalance)} kr`} />
              {!isCash && <Line label={tr('ui.ej_hanterade_transaktioner_st', { pendingCount: result.pendingCount })} value={`${result.pendingNet > 0 ? '+' : ''}${fmt(result.pendingNet)} kr`} />}
              <Line
                label={result.reconciled ? tr('ui.avstamt') : tr('ui.oforklarad_differens')}
                value={`${fmt(result.difference)} kr`} strong
                tone={result.reconciled ? 'var(--status-green-text)' : 'var(--status-red-text)'}
              />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {result.reconciled ? <CheckCircle2 size={18} color="var(--status-green-text)" style={{ flexShrink: 0 }} /> : <AlertTriangle size={18} color="var(--status-amber-text)" style={{ flexShrink: 0 }} />}
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
              <div style={{ marginTop: '16px' }}>
                <label style={lbl}>{tr('ui.anteckning_valfri')}</label>
                <input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder={tr('ui.t_ex_differensen_ar_en_obokford_bankavgift')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" style={primaryBtn} onClick={save}>{tr('ui.spara_avstamning')}</button>
              </div>
            </div>
          )}
          {message && <p style={{ margin: '12px 0 0', fontSize: '13px', color: 'var(--status-green-text)' }}>{message}</p>}
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={r => r.id}
          rows={history}
          emptyMessage={tr('ui.inga_sparade_avstamningar_annu')}
          mobileList={r => ({ primary: r.accountName, amount: `${fmt(r.difference)} kr`, meta: `${r.date}${r.note ? ` · ${r.note}` : ''}` })}
          columns={[
            { key: 'date', label: tr('ui.datum'), render: r => r.date },
            { key: 'accountName', label: tr('ui.konto_2'), fontWeight: 600, color: 'var(--text-main)', render: r => `${r.accountName} (${r.ledgerAccount})` },
            { key: 'statementBalance', label: tr('ui.kontoutdrag'), align: 'right', render: r => `${fmt(r.statementBalance)} kr` },
            { key: 'ledgerBalance', label: tr('ui.bokfort_2'), align: 'right', render: r => `${fmt(r.ledgerBalance)} kr` },
            {
              key: 'difference', label: tr('ui.differens'), align: 'right',
              render: r => <span style={{ color: Math.abs(r.difference) < 0.005 ? 'var(--status-green-text)' : 'var(--status-red-text)', fontWeight: 600 }}>{Math.abs(r.difference) < 0.005 ? tr('ui.avstamt') : `${fmt(r.difference)} kr`}</span>,
            },
            { key: 'note', label: tr('ui.anteckning'), wrap: true, render: r => r.note || '' },
            {
              key: 'actions', label: '', align: 'right', width: 50,
              render: r => <button type="button" title={tr('ui.ta_bort')} onClick={() => remove(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>,
            },
          ]}
        />
      </div>
    </div>
  );
}
