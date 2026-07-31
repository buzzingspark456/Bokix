import React from 'react';
import { Sparkles } from 'lucide-react';

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, tone = 'default' }) {
  const accent = tone === 'accent' ? '#3a8fc1' : '#5ba85a';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '48px 24px',
      borderRadius: '22px',
      background: 'linear-gradient(135deg, rgba(91,168,90,0.06), rgba(58,143,193,0.06))',
      border: '1px solid rgba(15,23,42,0.06)',
      boxShadow: '0 20px 40px -28px rgba(15,23,42,0.25)',
    }}>
      <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'white', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 12px 24px -16px rgba(15,23,42,0.28)' }}>
        {Icon ? <Icon size={24} /> : <Sparkles size={24} />}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.7, maxWidth: '420px', marginBottom: actionLabel ? '18px' : '0' }}>{description}</div>
      {actionLabel && (
        <button onClick={onAction} style={{ border: 0, borderRadius: '999px', padding: '10px 16px', background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
