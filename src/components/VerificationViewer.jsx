import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Paperclip, RotateCcw, Trash2, CalendarClock, X } from './icons';
import SpreadFields from './shared/SpreadFields';
import { spreadCandidates } from '../utils/accrualSpread';
import { listHeaderButtonStyle } from './shared/ListPageHeader';
import { DocumentPane } from './shared/DocumentViewer';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { describeVerification } from '../utils/plainBooking';
import { t } from '../i18n';
import { dateTimeFormat } from '../utils/intlCache';

// En verifikation öppnad som egen sida (2026-11-21), som leverantörsfakturan
// och underlagen: Tillbaka, rubrik med status, underlaget och uppgifterna.
// Förut fälldes raden ut i listan. Bokförda verifikationer ändras inte här,
// Rätta skapar en rättelse. Underlag går att lägga till i efterhand.

const label = { color: 'var(--text-muted)' };
const value = { fontWeight: 600, color: 'var(--text-main)' };
const section = { padding: '24px 32px', borderBottom: '1px solid var(--border-light)' };
const h3 = { fontSize: '14px', fontWeight: 600, margin: '0 0 12px' };

export default function VerificationViewer({ ver, accounts = [], contacts = [], fmt, onClose, onCorrect, onContinueDraft, onDeleteDraft, onAttach, onPrev, onNext, spreads = null, onPeriodize = null, lockedFiscalYears }) {
  const isDraft = (ver.status || 'booked') === 'draft';
  const rows = (ver.rows || []).map(r => ({ ...r, debet: getDebet(r), kredit: getKredit(r) }));
  const totalD = rows.reduce((s, r) => s + r.debet, 0);
  const totalK = rows.reduce((s, r) => s + r.kredit, 0);
  const files = [ver.attachmentUrl && { url: ver.attachmentUrl, name: ver.attachmentName, type: ver.attachmentType }, ...(ver.extraAttachments || []), ...(Array.isArray(ver.attachments) ? ver.attachments : [])].filter(f => f && f.url);
  const [fileIdx, setFileIdx] = useState(0);
  const file = files[Math.min(fileIdx, files.length - 1)] || null;
  const counterparty = contacts.find(c => c.id === ver.counterpartyId)?.name;
  const [busy, setBusy] = useState(false);
  // Periodisera (2026-11-22, som Bokio): bara bokförda verifikationer med ett
  // kostnads- eller intäktskonto, och bara när det finns något kvar att fördela.
  const [spreadOpen, setSpreadOpen] = useState(false);
  const canSpread = Boolean(onPeriodize) && !isDraft && ver.source !== 'accrual_spread' && spreadCandidates(ver, getDebet, getKredit).length > 0;
  const spreadsFromVer = (spreads || []).filter(sp => sp.sourceVerificationId === ver.id);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setFileIdx(0); setError(''); }, [ver.id]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const pickFile = async (f) => {
    if (!f || !onAttach) return;
    setBusy(true); setError('');
    try { await onAttach(ver, f); } catch { setError(t('ui.si_underlag_fel')); } finally { setBusy(false); }
  };

  const navBtn = (onClick, Icon, title) => (
    <button type="button" onClick={onClick} disabled={!onClick} title={title} aria-label={title}
      style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: onClick ? 'var(--text-main)' : 'var(--text-muted)', cursor: onClick ? 'pointer' : 'default', opacity: onClick ? 1 : 0.5 }}>
      <Icon size={16} />
    </button>
  );

  return (
    <div className="ver-view" style={{ flex: 1, minHeight: 0, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease' }}>
      <div className="ver-view-head" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, padding: 0 }}>
          {t('ui.tillbaka')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{t('ui.verifikation_2', { number: ver.number })}</h1>
          <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: isDraft ? 'var(--status-amber-bg)' : 'var(--status-green-bg)', color: isDraft ? 'var(--status-amber-text)' : 'var(--status-green-text)' }}>
            {isDraft ? t('ui.utkast') : t('ui.bokford')}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: '8px' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {navBtn(onPrev, ChevronLeft, t('ui.vv_foregaende'))}
          {navBtn(onNext, ChevronRight, t('ui.vv_nasta'))}
        </div>
        {isDraft ? (
          <>
            <button type="button" onClick={() => onDeleteDraft(ver)} style={{ ...listHeaderButtonStyle('secondary'), color: 'var(--status-red-text)' }}>
              <Trash2 size={14} /> {t('ui.ta_bort')}
            </button>
            <button type="button" onClick={() => onContinueDraft(ver)} style={listHeaderButtonStyle('primary')}>{t('ui.fortsatt')}</button>
          </>
        ) : (
          <>
            {canSpread && (
              <button type="button" onClick={() => setSpreadOpen(true)} style={listHeaderButtonStyle('secondary')}>
                <CalendarClock size={14} /> {spreadsFromVer.length ? t('spread.periodized') : t('spread.periodize')}
              </button>
            )}
            <button type="button" onClick={() => onCorrect(ver)} title={t('ui.skapa_rattelseverifikation')} style={listHeaderButtonStyle('secondary')}>
              <RotateCcw size={14} /> {t('ui.ratta')}
            </button>
          </>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className={`ver-view-body${file ? ' has-file' : ''}`}>
          <div className="ver-view-doc" style={section}>
            <h3 style={h3}>{t('ui.vv_underlag')}</h3>
            {file ? (
              <>
                <div className="ver-view-paper">
                  <DocumentPane key={file.url} url={file.url} type={file.type} name={file.name} expandable />
                </div>
                {files.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {files.map((f, i) => (
                      <button key={f.url} type="button" onClick={() => setFileIdx(i)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 220, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', background: i === fileIdx ? 'var(--bg-muted)' : 'var(--bg-card)', color: 'var(--text-main)' }}>
                        <Paperclip size={11} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || t('ui.underlag_3', { v0: i + 1 })}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : onAttach ? (
              <>
                <input ref={inputRef} type="file" style={{ display: 'none' }} accept="image/*,application/pdf" onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="si-att-empty" onClick={() => inputRef.current?.click()} disabled={busy}
                  onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}>
                  <Paperclip size={18} />
                  <span><b>{busy ? t('ui.laddar_upp') : t('ui.vv_lagg_till')}</b><small>{t('ui.vv_underlag_hjalp')}</small></span>
                </button>
                {error && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--status-red-text)' }}>{error}</div>}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>{t('ui.vv_inget_underlag')}</p>
            )}
          </div>

          <div className="ver-view-info">
            <div style={section}>
              <h3 style={h3}>{t('ui.vv_uppgifter')}</h3>
              <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13.5px' }}>
                <div><span style={label}>{t('ui.datum')}</span><div style={value}>{ver.date || '—'}</div></div>
                <div><span style={label}>{t('ui.vv_verifikationsnummer')}</span><div style={value}>{ver.number || '—'}</div></div>
                <div style={{ gridColumn: '1 / -1' }}><span style={label}>{t('ui.beskrivning')}</span><div style={value}>{ver.description || '—'}</div></div>
                {counterparty && <div><span style={label}>{t('ui.motpart').replace(/:\s*$/, '')}</span><div style={value}>{counterparty}</div></div>}
                <div><span style={label}>{t('ui.upprattad').replace(/:\s*$/, '')}</span><div style={value}>{ver.createdAt ? dateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ver.createdAt)) : '—'}</div></div>
                {ver.originalLocation && <div><span style={label}>{t('ui.original_forvaras').replace(/:\s*$/, '')}</span><div style={value}>{ver.originalLocation}</div></div>}
              </div>
            </div>

            {rows.length > 0 && (
              <div style={section}>
                <h3 style={h3}>{t('ui.sa_har_bokfordes_det')}</h3>
                {describeVerification(rows, accounts).map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13.5, padding: '3px 0', color: 'var(--text-main)' }}>
                    <span><span style={{ color: 'var(--text-muted)', marginRight: 8 }}>{p.account}</span>{p.text}</span>
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.amount)} {t('ui.kr')}</span>
                  </div>
                ))}
              </div>
            )}

            {rows.length > 0 && (
              <div style={{ ...section, borderBottom: 'none' }}>
                <h3 style={h3}>{t('ui.kontering')}</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {[t('ui.vv_konto'), t('ui.kontonamn'), t('ui.debet'), t('ui.kredit')].map((hd, i) => (
                          <th key={i} style={{ padding: '0 8px 8px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{hd}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '7px 8px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{r.account}</td>
                          <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>
                            {accounts.find(a => a.code === r.account)?.name || r.accountName || '—'}
                            {r.desc && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.desc}</div>}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.debet > 0 ? fmt(r.debet) : ''}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.kredit > 0 ? fmt(r.kredit) : ''}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={2} style={{ padding: '9px 8px', fontWeight: 700, color: 'var(--text-main)' }}>{t('ui.summa')}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(totalD)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(totalK)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {spreadOpen && (
        <div className="modal-overlay" onClick={() => setSpreadOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{t('spread.title')}</h2>
                <p className="wsp-sub">{t('spread.sub')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setSpreadOpen(false)} aria-label={t('ui.stang')}><X size={18} /></button>
            </div>
            <SpreadFields accounts={accounts} verification={ver} lockedFiscalYears={lockedFiscalYears} existing={spreads || []}
              onSave={(sp) => { onPeriodize(sp); setSpreadOpen(false); }} onCancel={() => setSpreadOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
