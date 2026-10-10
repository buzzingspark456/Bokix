import React, { useState } from 'react';
import { X } from './icons';
import { t } from '../i18n';

// "Se hur": filmen från /guider som hör till sidan man står på, i en ruta
// i appen i stället för att skicka iväg en till webbplatsen. Samma filer
// som GuidesPage.jsx (public/videos/<slug>[-dark].mp4), i appens tema.
export default function GuideModal({ guides, onClose }) {
  const [slug, setSlug] = useState(guides[0]?.slug);
  const current = guides.find(g => g.slug === slug) || guides[0];
  if (!current) return null;
  const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const file = dark ? `${current.slug}-dark` : current.slug;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '860px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{current.title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        {guides.length > 1 && (
          <div className="filter-pills" role="tablist" style={{ marginBottom: '12px', flexWrap: 'wrap' }}>
            {guides.map(g => (
              <button
                key={g.slug}
                type="button"
                role="tab"
                aria-selected={g.slug === current.slug}
                className={`filter-pill${g.slug === current.slug ? ' active' : ''}`}
                onClick={() => setSlug(g.slug)}
              >
                {g.title}
              </button>
            ))}
          </div>
        )}
        <video
          key={file}
          src={`/videos/${file}.mp4`}
          poster={`/videos/${file}.jpg`}
          controls
          autoPlay
          playsInline
          style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '1600 / 880', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-muted)' }}
        />
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '10px 0 0' }}>{current.lead}</p>
      </div>
    </div>
  );
}
