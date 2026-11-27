import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, X, Search, MoreHorizontal, ScanLine, Trash2, Eye } from './icons';
import { DocumentLightbox } from './shared/DocumentViewer';
import { confirmDialog } from './shared/ConfirmDialog';
import { unlinkedDocuments, suggestVerifications, staleDocuments } from '../utils/looseDocuments';
import { hasUnderlag } from '../utils/reportLedgers';
import { getDebet } from '../utils/verificationAmounts';
import { t } from '../i18n';

// "Underlag att koppla" (2026-11-14). Filer sparade utan avläsning visas här
// tills de kopplas till en verifikation, görs om till ett kvitto (då läses
// de av) eller tas bort. Utseendet i index.css (.dl-*): en lugn lista med en
// knapp per rad (Koppla) och resten i en meny, så att raderna inte blir en
// vägg av knappar. Se utils/looseDocuments.js.

const fmtKr = (n) => `${Math.round(n).toLocaleString('sv-SE')} kr`;
const dayOf = (iso) => String(iso || '').slice(0, 10);
const isImage = (d) => /^image\//.test(d.type || '') || /\.(jpe?g|png|webp|heic)$/i.test(d.name || '');
const verAmount = (v) => (v.rows || []).reduce((sum, r) => sum + getDebet(r), 0);

export function LinkModal({ doc, verifications, onPick, onClose }) {
  const [q, setQ] = useState('');
  const suggestions = useMemo(() => suggestVerifications(doc, verifications, 6), [doc, verifications]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return suggestions;
    const digits = s.replace(/\s/g, '').replace(',', '.');
    return (verifications || [])
      .filter(v => (v.status || 'booked') !== 'draft')
      .filter(v => String(v.number || '').toLowerCase().includes(s) || String(v.description || '').toLowerCase().includes(s) || String(v.date || '').includes(s) || String(verAmount(v)).includes(digits))
      .slice(0, 30);
  }, [q, suggestions, verifications]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content dl-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('docs.koppla_titel')}>
        <div className="modal-header">
          <h2 className="modal-title">{t('docs.koppla_titel')}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        <div className="dl-modal-file">{isImage(doc) ? <ImageIcon size={15} /> : <FileText size={15} />}<span>{doc.name}</span></div>
        <label className="dl-search">
          <Search size={15} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('docs.sok_verifikation')} />
        </label>
        {!q && <div className="dl-label">{t('docs.forslag')}</div>}
        <div className="dl-results">
          {results.length === 0 && <div className="dl-empty">{q ? t('docs.inga_traffar') : t('docs.inga_forslag')}</div>}
          {results.map(v => (
            <button key={v.id} type="button" className="dl-result" onClick={() => onPick(v.id)}>
              <span className="dl-result-num">{v.number}</span>
              <span className="dl-result-text">
                <span className="dl-result-desc">{v.description || '—'}</span>
                <span className="dl-result-meta">{dayOf(v.date)}{hasUnderlag(v) ? ` · ${t('docs.har_underlag')}` : ''}</span>
              </span>
              <span className="dl-result-amount">{fmtKr(verAmount(v))}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RowMenu({ onView, onRead, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const item = (Icon, label, fn, danger) => (
    <button type="button" role="menuitem" className={`dl-menu-item${danger ? ' is-danger' : ''}`} onClick={() => { setOpen(false); fn(); }}>
      <Icon size={15} /> {label}
    </button>
  );
  return (
    <span className="dl-menu-wrap" ref={ref}>
      <button type="button" className="dl-more" aria-label={t('docs.fler_val')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="dl-menu" role="menu">
          {item(Eye, t('docs.visa'), onView)}
          {item(ScanLine, t('docs.las_av'), onRead)}
          {item(Trash2, t('docs.ta_bort'), onDelete, true)}
        </div>
      )}
    </span>
  );
}

export default function DocumentsToLink({ documents, verifications, onLink, onReadAsReceipt, onDelete }) {
  const list = unlinkedDocuments(documents);
  const stale = new Set(staleDocuments(documents).map(d => d.id));
  const [linking, setLinking] = useState(null);
  const [viewing, setViewing] = useState(null);
  if (list.length === 0) return null;
  const ask = async (d) => {
    if (await confirmDialog(t('docs.ta_bort_fraga', { name: d.name }), { title: t('docs.ta_bort'), danger: true, confirmLabel: t('docs.ta_bort') })) onDelete(d.id);
  };
  return (
    <section className="dl-card" aria-label={t('docs.rubrik_kort')}>
      <header className="dl-head">
        <span className="dl-title">{t('docs.rubrik_kort')}</span>
        <span className="dl-count">{list.length}</span>
        <span className="dl-sub">{t('docs.rubrik_hint')}</span>
      </header>
      <ul className="dl-list">
        {list.map(d => (
          <li key={d.id} className="dl-row">
            <button type="button" className="dl-file" onClick={() => setViewing(d)} title={t('docs.visa')}>
              <span className={`dl-thumb ${isImage(d) ? 'is-image' : 'is-pdf'}`}>
                {isImage(d) ? <ImageIcon size={16} /> : <span className="dl-ext">PDF</span>}
              </span>
              <span className="dl-name-wrap">
                <span className="dl-name">{d.name}</span>
                <span className="dl-meta">
                  {t('docs.sparad', { date: dayOf(d.uploadedAt) })}
                  {stale.has(d.id) && <span className="dl-stale">{t('docs.gammal_kort')}</span>}
                </span>
              </span>
            </button>
            <span className="dl-actions">
              <button type="button" className="dl-link" onClick={() => setLinking(d)}>{t('docs.koppla')}</button>
              <RowMenu onView={() => setViewing(d)} onRead={() => onReadAsReceipt(d)} onDelete={() => ask(d)} />
            </span>
          </li>
        ))}
      </ul>
      {linking && (
        <LinkModal doc={linking} verifications={verifications} onClose={() => setLinking(null)} onPick={(verId) => { onLink(linking.id, verId); setLinking(null); }} />
      )}
      {viewing && <DocumentLightbox url={viewing.url} type={viewing.type} name={viewing.name} onClose={() => setViewing(null)} />}
    </section>
  );
}
