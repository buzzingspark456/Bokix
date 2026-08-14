import React from 'react';
import { Sparkles } from 'lucide-react';
import { BRAND } from '../utils/brandColors';

/* ── Sida 31: tomma tillstånd delar samma visuella språk i hela appen —
   varm cremeton (aldrig gradient/glasmorfism) och grönt som enda accent.
   `tone="accent"` fanns tidigare för ett blått sekundäraccent, vilket
   bröt mot regeln "grönt är den enda interaktiva/funktionella färgen" —
   borttaget, alla tomma tillstånd är nu samma gröna ton oavsett kontext. ── */
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '48px 24px',
      borderRadius: '18px',
      background: 'var(--bg-cream)',
      border: '1px solid var(--bg-cream-border)',
    }}>
      <div style={{ width: 72, height: 72, borderRadius: '20px', background: 'white', color: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {Icon ? <Icon size={30} /> : <Sparkles size={30} />}
      </div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.7, maxWidth: '420px', marginBottom: actionLabel ? '18px' : '0' }}>{description}</div>
      {actionLabel && (
        <button onClick={onAction} className="btn btn-primary">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
