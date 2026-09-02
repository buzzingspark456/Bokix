import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

// Delad "⋮"-radmeny — kebab-knapp som öppnar en dropdown med grupperade
// åtgärder (t.ex. olika åtgärder beroende på en fakturas/offerts status).
// Byggd med generöst mellanrum (padding runt panelen + per rad, rundade
// hover-ytor) istället för de tidigare alltid-synliga, tätt packade
// ikonraderna i tabellcellerna.
//
// Panelen renderas via en portal till <body> med `position: fixed`,
// beräknad från knappens egen boundingClientRect — INTE `position: absolute`
// inuti radens egen wrapper. En tabellrad sitter typiskt inuti en
// `overflow-y: auto`-yta (tabellens scrollcontainer), och en `absolute`-
// panel klipps då bort av den ytan så fort den sträcker sig utanför
// containerns synliga gräns (hände på rader nära toppen/botten av en lång
// lista — menyn öppnade uppåt/nedåt men halva panelen försvann bakom
// scrollkanten). Fixed positionering mot viewport har inte det problemet.
//
// `items`: array av antingen
//   { key?, label, icon?, onClick, variant?: 'danger', disabled?, title? }
// eller en avdelare: { divider: true }
// `triggerProps` — valfria extra attribut på själva kebab-knappen (t.ex.
// `data-inv-tour`, se utils/invoiceTour.js) så en sidas egen produktguide
// kan peka ut/klicka menyn utan att den här delade komponenten behöver
// veta något om vem som frågar.
export default function RowActionMenu({ items, ariaLabel = 'Fler åtgärder', triggerProps = {} }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { left/right, top/bottom }
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const computePosition = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const estimatedMenuHeight = Math.min(items.filter(i => !i.divider).length * 38 + 16, 400);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow;
    setPos({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const toggle = () => {
    if (!open) computePosition();
    setOpen(v => !v);
  };

  // Stäng vid klick utanför (knapp + portalerad panel), Escape, eller om
  // sidan/tabellen skrollar — enklare och mer robust än att räkna om
  // positionen kontinuerligt medan man skrollar.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open) computePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={e => { e.stopPropagation(); toggle(); }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        {...triggerProps}
        style={{
          width: 30, height: 30, borderRadius: '7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: open ? 'var(--bg-muted)' : 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
          transition: 'background-color 0.12s ease',
        }}
      >
        <MoreVertical size={16} />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="menu"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', ...pos, zIndex: 1000, minWidth: '230px', maxHeight: '70vh', overflowY: 'auto',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.03)',
            padding: '6px', display: 'flex', flexDirection: 'column',
          }}
        >
          {items.map((item, i) => item.divider ? (
            <div key={`div-${i}`} style={{ height: '1px', background: 'var(--border-light)', margin: '6px 6px', flexShrink: 0 }} />
          ) : (
            <button
              key={item.key ?? item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.title}
              // Skickar med händelseobjektet — Invoices.jsx (handleMarkSent/
              // handleDeleteInvoice) förväntar sig ett `e` att stoppa
              // propagering på. Ofarligt idag (de anropen skyddar sig med
              // `e?.stopPropagation()`), men en framtida onClick som INTE
              // gör det hade fått ett odefinierat `e` att jobba med.
              onClick={(e) => { setOpen(false); item.onClick?.(e); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px', border: 'none', borderRadius: '7px', flexShrink: 0,
                background: 'none', textAlign: 'left', fontSize: '13.5px', fontWeight: 500, fontFamily: 'inherit',
                color: item.disabled ? 'var(--text-muted)' : item.variant === 'danger' ? 'var(--status-red-text)' : 'var(--text-main)',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.55 : 1,
              }}
              onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = item.variant === 'danger' ? 'var(--status-red-bg)' : 'var(--bg-muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              {item.icon && <item.icon size={15} style={{ flexShrink: 0 }} />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
