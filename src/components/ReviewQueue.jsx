import React, { useState, useMemo } from 'react';
import { CheckCircle2, Check, X, ChevronDown, ChevronUp, ShieldCheck, AlertCircle } from 'lucide-react';
import { AccountSearch } from './shared/SearchInputs';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};
const formatDateTime = (iso) => {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch { return iso; }
};

const KIND_LABEL = { receipt: 'kvitto', supplier_invoice: 'leverantörsfaktura' };
const KIND_LABEL_PLURAL = { receipt: 'kvitton', supplier_invoice: 'leverantörsfakturor' };

/**
 * Föreslår ett konto baserat på tidigare, redan konterade poster från samma
 * leverantör/inköpsställe — en riktig, uträknad heuristik (inte en fejkad
 * "AI-matchning"). Säker (confident) bara om ALLA tidigare poster från samma
 * leverantör landat på exakt samma konto.
 */
function suggestAccount(item, allExpenses) {
  const name = (item.supplier || '').trim().toLowerCase();
  if (!name) return { account: null, confident: false };
  const matches = allExpenses.filter(e =>
    e.costAccount && e.type === item.type && (e.supplier || '').trim().toLowerCase() === name
  );
  if (matches.length === 0) return { account: null, confident: false };
  const distinct = [...new Set(matches.map(m => m.costAccount))];
  if (distinct.length === 1) return { account: distinct[0], confident: true };
  // Flera olika konton använda tidigare för samma leverantör — inte säkert
  // nog för automatik, men den senaste kan vara en rimlig utgångspunkt.
  const latest = [...matches].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  return { account: latest.costAccount, confident: false };
}

function ReviewCard({ item, accounts, onApprove, onReject, exiting }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [manualAccount, setManualAccount] = useState('');

  const kindLabel = KIND_LABEL[item.type] || 'post';
  const title = `${item.type === 'supplier_invoice' ? 'Leverantörsfaktura' : 'Kvitto'} utan kontering — ${item.supplier || item.description || 'Okänt inköpsställe'} ${formatSEK(item.amount)}`;
  const suggestedAccountObj = accounts.find(a => a.code === item.account);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)',
      padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      opacity: exiting ? 0 : 1, transform: exiting ? 'translateX(24px)' : 'none',
      transition: 'opacity 0.22s ease, transform 0.22s ease',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)', marginBottom: '4px' }}>{title}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{formatDate(item.date)} · {kindLabel}</div>
      </div>

      {item.account ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 12px', borderRadius: '999px',
          marginBottom: '14px', fontSize: '12.5px', fontWeight: 600,
          background: item.confident ? 'var(--status-green-bg)' : 'var(--status-amber-bg)',
          border: `1px solid ${item.confident ? 'var(--status-green-bg)' : 'var(--status-amber-bg)'}`,
          color: item.confident ? 'var(--status-green-text)' : 'var(--status-amber-text)',
        }}>
          {item.confident ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
          {item.confident ? 'Säkert förslag: ' : 'Osäkert förslag: '}
          Kontera som {item.account} {suggestedAccountObj?.name || ''}
        </div>
      ) : (
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>Ingen tidigare matchning hittades — ange konto manuellt.</div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {item.confident && (
          <button
            onClick={() => onApprove(item)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            <Check size={14} /> Godkänn
          </button>
        )}
        <button
          onClick={() => setRejecting(r => !r)}
          style={{ padding: '8px 16px', background: rejecting ? 'var(--border-light)' : 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          {item.confident ? 'Avvisa' : 'Ange konto'}
        </button>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: 'none', color: 'var(--text-secondary)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}
        >
          Visa detaljer {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {rejecting && (
        <div style={{ marginTop: '14px', padding: '14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
            {item.confident ? 'Fel förslag — ange rätt konto:' : 'Ange konto:'}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <AccountSearch value={manualAccount} onChange={setManualAccount} accounts={accounts} placeholder="Sök konto..." />
            </div>
            <button
              disabled={!manualAccount}
              onClick={() => onReject(item, manualAccount)}
              style={{ padding: '9px 16px', background: manualAccount ? '#1a3028' : 'var(--border)', color: manualAccount ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: manualAccount ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
            >
              Bokför med detta konto
            </button>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
            Posten bokförs direkt med kontot du väljer — den försvinner aldrig obokförd.
          </p>
        </div>
      )}

      {expanded && (
        <div className="form-row-2" style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'grid', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Typ:</span> {kindLabel}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Datum:</span> {formatDate(item.date)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Belopp:</span> {formatSEK(item.amount)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Moms:</span> {item.vatAmount ? formatSEK(item.vatAmount) : '—'}</div>
          <div style={{ gridColumn: '1 / 3' }}><span style={{ color: 'var(--text-muted)' }}>Inköpsställe/leverantör:</span> {item.supplier || '—'}</div>
          <div style={{ gridColumn: '1 / 3' }}><span style={{ color: 'var(--text-muted)' }}>Underlag:</span> Inget bifogat underlag är sparat för denna post.</div>
        </div>
      )}
    </div>
  );
}

export default function ReviewQueue({ expenses = [], accounts = [], reviewHistory = [], onResolve }) {
  const [tab, setTab] = useState('pending'); // 'pending' | 'history'
  const [exitingIds, setExitingIds] = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Härleds alltid live från expenses-propen — ingen separat kopia av listan
  // som kan bli inaktuell. Om en post redan konterats (t.ex. av en annan
  // flik/session vars ändring hunnit sparas) försvinner den härifrån av sig
  // själv vid nästa render, utan att kräva särskild synk-logik.
  const pendingItems = useMemo(() => {
    return expenses
      .filter(e => !e.costAccount)
      .map(e => ({ ...e, ...suggestAccount(e, expenses) }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [expenses]);

  const visiblePending = pendingItems.filter(i => !exitingIds.has(i.id));
  const eligibleForBulk = visiblePending.filter(i => i.confident);

  const finishResolve = (item, account, method) => {
    setExitingIds(prev => new Set(prev).add(item.id));
    setTimeout(() => {
      onResolve?.(item.id, account, { method });
      setExitingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }, 220);
  };

  const handleApprove = (item) => finishResolve(item, item.account, 'suggested');
  const handleReject = (item, account) => finishResolve(item, account, 'manual');

  const bulkSummary = useMemo(() => {
    const groups = {};
    eligibleForBulk.forEach(i => {
      const accName = accounts.find(a => a.code === i.account)?.name || i.account;
      const key = `${i.type}|${accName}`;
      groups[key] = (groups[key] || 0) + 1;
    });
    const parts = Object.entries(groups).map(([key, count]) => {
      const [type, accName] = key.split('|');
      const label = count === 1 ? KIND_LABEL[type] : KIND_LABEL_PLURAL[type];
      return `${count} ${label} kategoriseras som ${accName}`;
    });
    return `Detta godkänner ${eligibleForBulk.length} ${eligibleForBulk.length === 1 ? 'post' : 'poster'}: ${parts.join(', ')}.`;
  }, [eligibleForBulk, accounts]);

  const handleBulkApprove = () => {
    eligibleForBulk.forEach(item => finishResolve(item, item.account, 'bulk'));
    setShowBulkConfirm(false);
  };

  return (
    <div style={{ padding: '32px 40px', minHeight: '100%' }}>
      {/* Sidhuvud */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Granskning</h1>
        {tab === 'pending' && eligibleForBulk.length > 0 && (
          <button
            onClick={() => setShowBulkConfirm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: '#1a3028', color: 'white', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            <CheckCircle2 size={16} /> Godkänn alla
          </button>
        )}
      </div>

      {/* Flikrad */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {[
          { id: 'pending', label: 'Väntar', badge: pendingItems.length },
          { id: 'history', label: 'Historik' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 6px', marginRight: '20px', border: 'none', cursor: 'pointer', background: 'none',
            fontSize: '14px', fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? 'var(--text-main)' : 'var(--text-secondary)',
            borderBottom: tab === t.id ? '2px solid #3d7a2e' : '2px solid transparent',
            marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {t.id === 'pending' ? `Väntar${t.badge > 0 ? ` · ${t.badge}` : ''}` : t.label}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        visiblePending.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle2 size={48} color="var(--status-green-text)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>Allt är genomgånget</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>Det finns inga poster kvar att granska just nu.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {visiblePending.map(item => (
              <ReviewCard key={item.id} item={item} accounts={accounts} onApprove={handleApprove} onReject={handleReject} exiting={exitingIds.has(item.id)} />
            ))}
          </div>
        )
      )}

      {tab === 'history' && (
        reviewHistory.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--text-muted)' }}>
            Inget har hanterats än.
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-muted)' }}>
                  {['Post', 'Konto', 'Hanterad av', 'När', 'Metod'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviewHistory.map((h, i) => (
                  <tr key={h.id} style={{ borderTop: i > 0 ? '1px solid var(--border-light)' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)' }}>{h.title} · {formatSEK(h.amount)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>{h.account} {h.accountName}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>{h.resolvedBy}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{formatDateTime(h.resolvedAt)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600,
                        background: h.method === 'manual' ? 'var(--border-light)' : 'var(--status-green-bg)',
                        color: h.method === 'manual' ? 'var(--text-main)' : 'var(--status-green-text)',
                      }}>
                        {h.method === 'bulk' ? 'Godkänd i klump' : h.method === 'manual' ? 'Manuellt vald' : 'Förslag godkänt'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Bekräftelsedialog för "Godkänn alla" — aldrig en tyst massoperation */}
      {showBulkConfirm && (
        <div className="modal-overlay" onClick={() => setShowBulkConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Godkänn alla?</h2>
              <button className="modal-close" onClick={() => setShowBulkConfirm(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6, margin: '0 0 8px' }}>{bulkSummary}</p>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
                Poster med osäkra förslag ingår inte — de kräver individuell hantering under Väntar.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowBulkConfirm(false)} style={{ padding: '9px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>Avbryt</button>
                <button onClick={handleBulkApprove} style={{ padding: '9px 18px', background: '#1a3028', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'white' }}>Fortsätt</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
