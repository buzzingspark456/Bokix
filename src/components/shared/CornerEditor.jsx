import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prepareCornerEditor } from '../../utils/ocrReceipt';
import { t as tr } from '../../i18n';

// ── Justera kanter ───────────────────────────────────────────────────────
// När den automatiska utklippningen missar kvittot (vitt kvitto på vitt bord,
// ett veck, ett hörn utanför bilden) drar användaren själv de fyra hörnen till
// kvittots hörn. Hörnen skickas sedan till avläsningen, som rätar ut exakt den
// fyrhörningen i stället för att leta själv (ocrFile(…, { quad })).
//
// Bilden som visas är samma bild avläsningen arbetar på (prepareCornerEditor),
// så ett hörn på skärmen och ett hörn i avläsningen är samma punkt, även för
// ett foto som telefonen sparat liggande.

const FULL = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Ordnar hörnen medurs från det övre vänstra, så att ett hörn som dragits
 *  förbi ett annat inte ger en fyrhörning som korsar sig själv. */
function orderQuad(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / 4;
  const cy = points.reduce((s, p) => s + p.y, 0) / 4;
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let start = 0;
  sorted.forEach((p, i) => { if (p.x + p.y < sorted[start].x + sorted[start].y) start = i; });
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

function quadArea(q) {
  let sum = 0;
  for (let i = 0; i < 4; i++) sum += q[i].x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * q[i].y;
  return Math.abs(sum) / 2;
}

export default function CornerEditor({ input, onCancel, onConfirm }) {
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState('loading');
  const [quad, setQuad] = useState(null);
  const [active, setActive] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => {
    let alive = true;
    prepareCornerEditor(input)
      .then((result) => {
        if (!alive) return;
        if (!result) { setStatus('error'); return; }
        setImage(result);
        setQuad(result.quad);
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('[OCR] Kunde inte öppna bilden för Justera kanter:', err);
        if (alive) setStatus('error');
      });
    return () => { alive = false; };
  }, [input]);

  useEffect(() => {
    // Fångas före alla andra Esc-lyssnare och stoppas här, så att Esc bara
    // stänger den här rutan och inte kvittovyn (eller demon) under den.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const moveCorner = (index, x, y) => {
    setQuad((q) => q.map((p, i) => (i === index ? { x: clamp01(x), y: clamp01(y) } : p)));
  };

  const pointFromEvent = (e) => {
    const rect = frameRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const onPointerDown = (index) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setActive(index);
  };
  const onPointerMove = (index) => (e) => {
    if (active !== index) return;
    const p = pointFromEvent(e);
    moveCorner(index, p.x, p.y);
  };
  const onPointerUp = () => setActive(null);

  // Piltangenterna flyttar ett markerat hörn, Skift för större steg.
  const onHandleKey = (index) => (e) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    moveCorner(index, quad[index].x + d[0], quad[index].y + d[1]);
  };

  const ordered = quad ? orderQuad(quad) : null;
  const tooSmall = ordered ? quadArea(ordered) < 0.02 : true;
  const polygon = ordered ? ordered.map((p) => `${p.x},${p.y}`).join(' ') : '';

  // Direkt i body: kvittovyn kan ligga i en skalad panel (demon på startsidan),
  // och där skulle position: fixed annars räknas från panelen, inte fönstret.
  return createPortal(
    <div className="corner-editor-overlay" role="dialog" aria-modal="true" aria-label={tr('ui.justera_kanter_titel')}>
      <div className="corner-editor-box">
        <div className="corner-editor-head">
          <h2>{tr('ui.justera_kanter_titel')}</h2>
          <p>{tr('ui.dra_hornen_till_kvittots_horn')}</p>
        </div>

        <div className="corner-editor-stage">
          {status === 'loading' && <p className="corner-editor-note">{tr('ui.hamtar_bilden')}</p>}
          {status === 'error' && <p className="corner-editor-note">{tr('ui.bilden_gar_inte_att_justera')}</p>}
          {status === 'ready' && image && (
            <div className="corner-editor-frame" ref={frameRef} style={{ aspectRatio: `${image.width} / ${image.height}`, width: `min(100%, calc(var(--ce-max-h) * ${image.width / image.height}))` }}>
              <img src={image.imageUrl} alt="" draggable={false} />
              <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                <path d={`M0,0H1V1H0Z M${polygon.replace(/ /g, ' L')}Z`} fillRule="evenodd" className="corner-editor-shade" />
                <polygon points={polygon} className="corner-editor-edge" />
              </svg>
              {quad.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`corner-editor-handle${active === i ? ' is-active' : ''}`}
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  aria-label={`${tr('ui.justera_kanter')} ${i + 1}`}
                  onPointerDown={onPointerDown(i)}
                  onPointerMove={onPointerMove(i)}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={onHandleKey(i)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="corner-editor-actions">
          {status === 'ready' && (
            <button type="button" className="corner-editor-btn corner-editor-btn-quiet" onClick={() => setQuad(FULL)}>
              {tr('ui.hela_bilden')}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="corner-editor-btn" onClick={onCancel}>{tr('ui.avbryt')}</button>
          <button
            type="button"
            className="corner-editor-btn corner-editor-btn-primary"
            disabled={status !== 'ready' || tooSmall}
            onClick={() => onConfirm(ordered)}
          >
            {tr('ui.las_av_med_de_har_kanterna')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
