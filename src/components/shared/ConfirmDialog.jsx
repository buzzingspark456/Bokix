import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';

// Ersätter native window.confirm()/window.prompt() — kundfeedback: den
// bruna/blåa webbläsarrutan ("www.bokix.se says…") ser inte ut som resten
// av appen och går inte att style:a alls, bryter varumärket varje gång den
// dyker upp. Samma modal-utseende som redan finns överallt annars
// (.modal-overlay/.modal-content, se t.ex. "Logga ut"-dialogen i App.jsx)
// istället, men anropad IMPERATIVT — `await confirmDialog('Text?')` — så
// alla ~20 anropsställen i Quotes/Invoices/Expenses/SupplierInvoices/
// Verifications/Taxes/Settings/App.jsx kan bytas ett-till-ett utan att
// dra en ny prop genom varje mellanliggande komponent. Modul-nivå
// "brevlåda" (_dispatch) sätts av <ConfirmDialogHost/>, som monteras EN
// gång i App.jsx (samma plats som Toast/HelpDrawer).
let _dispatch = null;

function openDialog(config) {
  return new Promise((resolve) => {
    if (!_dispatch) {
      // Host inte monterad än (t.ex. anrop innan första render hunnit klart)
      // — hellre en fungerande native dialog än en tyst no-op som blockerar
      // flödet för gott.
      resolve(config.kind === 'prompt' ? window.prompt(config.message, config.defaultValue) : window.confirm(config.message));
      return;
    }
    _dispatch({ ...config, resolve });
  });
}

/** Ersätter window.confirm(message). Resolvear till true/false. */
export function confirmDialog(message, options = {}) {
  return openDialog({ kind: 'confirm', message, ...options });
}

/** Ersätter window.prompt(message, defaultValue). Resolvear till text eller null (Avbryt). */
export function promptDialog(message, options = {}) {
  return openDialog({ kind: 'prompt', message, ...options });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    _dispatch = (config) => {
      setState(config);
      setInputValue(config.defaultValue || '');
    };
    return () => { _dispatch = null; };
  }, []);

  useEffect(() => {
    if (state?.kind !== 'prompt') return undefined;
    // Samma beteende som window.prompt: fältet är fokuserat och texten
    // markerad direkt, redo att skrivas över.
    const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 20);
    return () => clearTimeout(t);
  }, [state]);

  if (!state) return null;

  const isPrompt = state.kind === 'prompt';
  const cancelValue = isPrompt ? null : false;

  const close = (result) => {
    state.resolve(result);
    setState(null);
  };

  return (
    <div className="modal-overlay" onClick={() => close(cancelValue)}>
      <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {state.danger && <AlertTriangle size={17} style={{ color: 'var(--red-500)', flexShrink: 0 }} />}
            {state.title || (isPrompt ? 'Ange text' : 'Bekräfta')}
          </h2>
          <button className="modal-close" onClick={() => close(cancelValue)}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {state.message}
        </p>

        {isPrompt && (
          <input
            ref={inputRef}
            className="form-control"
            style={{ marginTop: '14px' }}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={state.placeholder}
            onKeyDown={e => {
              if (e.key === 'Enter') close(inputValue);
              if (e.key === 'Escape') close(null);
            }}
          />
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => close(cancelValue)}>
            {state.cancelLabel || 'Avbryt'}
          </button>
          <button
            className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
            style={state.danger ? { background: '#ef4444', color: 'white', borderColor: '#ef4444' } : undefined}
            onClick={() => close(isPrompt ? inputValue : true)}
            autoFocus={!isPrompt}
          >
            {state.confirmLabel || (isPrompt ? 'OK' : 'Bekräfta')}
          </button>
        </div>
      </div>
    </div>
  );
}
