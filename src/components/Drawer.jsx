import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Drawer = ({ isOpen, onClose, title, children, width = '420px' }) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, animation: 'fadeIn 0.2s ease' }}
      />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width, maxWidth: '100vw',
          background: 'white', boxShadow: 'var(--shadow-lg)', zIndex: 1001,
          display: 'flex', flexDirection: 'column', animation: 'slideInFromRight 0.25s var(--ease)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)', margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: 'var(--radius-sm)', display: 'flex', transition: 'all var(--transition)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-100)'; e.currentTarget.style.color = 'var(--text-main)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px', background: 'var(--gray-25)' }}>
          {children}
        </div>
      </div>
    </>
  );
};

export default Drawer;
