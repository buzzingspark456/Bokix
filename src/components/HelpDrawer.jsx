import React, { useState } from 'react';
import { Search, Book, PlayCircle, FileText, MessageSquare, AlertCircle } from 'lucide-react';
import Drawer from './Drawer';

const SHORTCUTS = [
  { icon: PlayCircle, color: '#3a8fc1', bg: '#eef5fb', label: 'Kom igång-guide' },
  { icon: Book, color: '#5ba85a', bg: '#f2f9f2', label: 'Bokföringsskola' },
  { icon: FileText, color: '#9333ea', bg: '#fdf4ff', label: 'Ordlista' },
];

const shortcutBtnStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
  background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  cursor: 'pointer', textAlign: 'left', transition: 'all var(--transition)', fontFamily: 'var(--font-sans)',
};

const HelpDrawer = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Hjälp och support">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input
            type="text"
            placeholder="Vad behöver du hjälp med?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control"
            style={{ paddingLeft: '38px' }}
          />
        </div>

        <div>
          <h3 style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Genvägar</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SHORTCUTS.map(({ icon: Icon, color, bg, label }) => (
              <button
                key={label}
                style={shortcutBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} />
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a
            href="mailto:support@bokix.se?subject=Support%20-%20Bokix"
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <MessageSquare size={16} /> Kontakta support
          </a>
          <a
            href="mailto:support@bokix.se?subject=Felrapport%20-%20Bokix"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', transition: 'color var(--transition)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <AlertCircle size={15} /> Rapportera ett fel
          </a>
        </div>
      </div>
    </Drawer>
  );
};

export default HelpDrawer;
