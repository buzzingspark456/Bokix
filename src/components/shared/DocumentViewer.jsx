import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Receipt, X, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';

// ── Dokumentvisaren ─────────────────────────────────────────────────────
// EN visare för alla underlag i appen: kvittot i Utgifter (bredvid
// formuläret) och verifikationens bifogade underlag (i fullskärm). Två
// snarlika kopior hade garanterat divergerat — den ena fick zoom och
// inline-PDF, den andra blev kvar som "Visa PDF" i en ny flik, vilket var
// exakt skillnaden mellan de två ytorna innan den här filen fanns.
//
// Vad visaren gör, och varför:
//  - PDF renderas INLINE, inte som en länk. Poängen med att se underlaget
//    är att kunna läsa av belopp och datum medan man fyller i fälten; en
//    länk till en ny flik betyder att man lämnar formuläret för att göra
//    just det.
//  - Bilder går att zooma. Kvitton är fotade med mobilen, ofta sneda och
//    små, och en fit-to-box-bild räcker sällan för att läsa småtexten.
//  - Bakgrunden är en FAST mörk ton i båda teman. Ett dokument läses mot
//    en neutral, mörk platta i varje dokumentvisare som finns, och
//    underlag är nästan alltid vita.
//
// Zoomen sätter en BREDD i procent, inte transform: scale(). En skalad
// bild spiller ut utanför sin egen låda och blir oåtkomlig i en centrerad
// flexbox (det går inte att skrolla till kanterna); en bredare bild gör
// ytan faktiskt skrollbar. Se .dv-* i index.css.
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];
const FIT_ZOOM = 2; // index i ZOOM_STEPS: "passa i rutan"

/** Filnamnet ur en Storage-URL, utan att fälla vyn på en trasig %-sekvens. */
function fileNameFromUrl(url, fallback) {
  if (!url) return fallback;
  const raw = url.split('/').pop().split('?')[0];
  if (!raw) return fallback;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/**
 * Dokumentpanelen: verktygsrad + visningsyta. Fyller sin förälder.
 *
 * `type` är filens MIME-typ när den är känd (receiptType/attachmentType).
 * Saknas den gissar vi på filändelsen i URL:en — ett underlag sparat innan
 * typen började lagras ska inte tappa sin förhandsvisning.
 */
export function DocumentPane({ url, type, name, emptyText, className = '' }) {
  const [zoom, setZoom] = useState(FIT_ZOOM);
  const [imgFailed, setImgFailed] = useState(false);

  // Ny fil i samma panel: börja om från passa-i-rutan och ge en bild som
  // förut misslyckades en ny chans.
  useEffect(() => { setZoom(FIT_ZOOM); setImgFailed(false); }, [url]);

  const kind = useMemo(() => {
    if (!url) return 'none';
    if (type?.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'pdf';
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'unknown';
  }, [url, type]);

  const label = name || fileNameFromUrl(url, 'Underlag');
  const isImage = kind === 'image' && !imgFailed;

  return (
    <div className={`dv-doc ${className}`.trim()}>
      <div className="dv-bar">
        <span className="dv-name" title={label}>
          <FileText size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{url ? label : 'Inget underlag'}</span>
        </span>
        <span className="dv-tools">
          {isImage && (
            <>
              <button type="button" className="dv-btn" onClick={() => setZoom(z => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zooma ut" title="Zooma ut">
                <ZoomOut size={15} />
              </button>
              <span className="dv-zoom">{zoom === FIT_ZOOM ? 'Passa' : `${Math.round(ZOOM_STEPS[zoom] * 100)}%`}</span>
              <button type="button" className="dv-btn" onClick={() => setZoom(z => Math.min(ZOOM_STEPS.length - 1, z + 1))} disabled={zoom === ZOOM_STEPS.length - 1} aria-label="Zooma in" title="Zooma in">
                <ZoomIn size={15} />
              </button>
            </>
          )}
          {url && (
            <a className="dv-btn" href={url} target="_blank" rel="noopener noreferrer" title="Öppna filen i en ny flik">
              <ExternalLink size={14} /> Öppna
            </a>
          )}
        </span>
      </div>

      <div className="dv-body" style={kind === 'pdf' ? { padding: 0 } : undefined}>
        {isImage ? (
          <img
            className={`dv-img${zoom === FIT_ZOOM ? ' dv-img-fit' : ''}`}
            src={url}
            alt={label}
            onError={() => setImgFailed(true)}
            style={zoom === FIT_ZOOM ? undefined : { width: `${ZOOM_STEPS[zoom] * 100}%`, maxWidth: 'none', maxHeight: 'none' }}
          />
        ) : kind === 'pdf' ? (
          <iframe className="dv-frame" src={url} title={label} />
        ) : (
          <div className="dv-empty">
            <Receipt size={38} strokeWidth={1.5} />
            <span>
              {imgFailed
                ? 'Bilden går inte att visa i den här webbläsaren (t.ex. HEIC från iPhone). Filen är sparad — öppna den i en ny flik.'
                : url
                  ? 'Filformatet går inte att förhandsvisa här. Öppna filen i en ny flik.'
                  : emptyText || 'Inget underlag är sparat här ännu.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Samma panel, men som en egen helskärmsvy ovanpå sidan — för ytor där
 * underlaget inte får plats bredvid formuläret (verifikationens
 * "Visa i fullstorlek"). Esc stänger, precis som andra modaler i appen.
 */
export function DocumentLightbox({ url, type, name, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dv-lightbox" role="dialog" aria-modal="true" aria-label={name || 'Underlag'}>
      <DocumentPane url={url} type={type} name={name} />
      <button type="button" className="dv-close" onClick={onClose} aria-label="Stäng">
        <X size={18} />
      </button>
    </div>
  );
}

export default DocumentPane;
