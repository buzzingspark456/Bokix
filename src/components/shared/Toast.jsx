import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';

const VARIANTS = {
  success: { bg: BRAND.greenLight, color: BRAND.greenDark, Icon: CheckCircle2 },
  error: { bg: BRAND.redBg, color: BRAND.redText, Icon: AlertCircle },
  info: { bg: BRAND.amberBg, color: BRAND.amberText, Icon: Info },
};

// Liten, självstängande notis uppe till höger — ersätter alert()-popups för
// sånt som bara ska bekräftas, inte aktivt kvitteras (t.ex. "Stripe är nu
// anslutet till Bokix" efter en OAuth-redirect). Native alert() blockerar
// hela sidan tills man klickar OK, vilket bland annat är varför appen ser ut
// att stå still bakom rutan på en långsam nätverksanslutning — en notis som
// bara glider in och försvinner av sig själv stör aldrig på samma sätt.
//
// Monteras en gång i App.jsx (samma "en instans utanför/vid sidan av
// huvudinnehållet"-mönster som CookieBanner/HelpDrawer), styrd av ett enda
// { message, variant } | null-state — se stripe_connect/bank_connect-
// useEffects.
export default function Toast({ message, variant = 'success', onClose, duration = 6000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;
  const { bg, color, Icon } = VARIANTS[variant] || VARIANTS.info;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: '20px', right: '20px', zIndex: 3000,
        maxWidth: '380px', width: 'calc(100% - 40px)',
        background: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
        border: '1px solid var(--border)', overflow: 'hidden',
        animation: 'slideInFromRight 0.25s ease-out',
        display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', boxSizing: 'border-box',
      }}
    >
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5, paddingTop: '5px' }}>{message}</div>
      <button
        onClick={onClose}
        aria-label="Stäng"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', marginTop: '2px', flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
