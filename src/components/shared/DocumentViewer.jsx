import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Receipt, X, ZoomIn, ZoomOut, ExternalLink, Maximize2 } from '../icons';
import { useSignedUrl } from '../../utils/signedUrls';
import { t } from '../../i18n';

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
//
// Zoomen går i steg om 10 procentenheter av den passade storleken (1 =
// "Passa"). Tidigare fasta steg (100 → 150 → 200 %) gjorde att det första
// trycket på + hoppade ett halvt varv för långt, särskilt på mobilen.
const FIT_ZOOM = 1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.1;
const stepZoom = (z, dir) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + dir * ZOOM_STEP) * 10) / 10));
// Samma brytpunkt som kvittovyns staplade läge (index.css, max-width: 860px).
const isNarrowScreen = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 860px)').matches;

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
export function DocumentPane({ url, type, name, emptyText, className = '', expandable = false }) {
  const activeUrl = useSignedUrl(url);
  const [zoom, setZoom] = useState(FIT_ZOOM);
  const [imgFailed, setImgFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const imgRef = useRef(null);
  // Bildens SYNLIGA bredd i "Passa"-läget, så att 110 % blir 10 % större än vad
  // man ser just nu. Bildelementet fyller hela ytan och ritar motivet med
  // object-fit: contain, så elementets egen bredd är större än det synliga
  // kvittot (ett stående kvitto får tomt på sidorna). Mäts elementet direkt
  // hoppar första zoomsteget långt förbi det man såg. Därför räknas
  // contain-storleken ut ur bildens egna proportioner.
  const fitWidthRef = useRef(0);
  const measureFitWidth = () => {
    const img = imgRef.current;
    if (!img) return 0;
    const box = img.getBoundingClientRect();
    const { naturalWidth: nw, naturalHeight: nh } = img;
    if (!nw || !nh || !box.width || !box.height) return box.width;
    return Math.min(box.width, (box.height * nw) / nh);
  };
  const changeZoom = (dir) => {
    if (zoom === FIT_ZOOM) fitWidthRef.current = measureFitWidth();
    setZoom(stepZoom(zoom, dir));
  };

  // Ny fil i samma panel: börja om från passa-i-rutan och ge en bild som
  // förut misslyckades en ny chans.
  useEffect(() => { setZoom(FIT_ZOOM); setImgFailed(false); setExpanded(false); }, [url]);
  // Den signerade länken kommer strax efter `url` (se useSignedUrl). Ett
  // fel på en tidigare länk ska inte fastna när den giltiga väl är här.
  useEffect(() => { setImgFailed(false); }, [activeUrl]);
  // Privat fil som fortfarande signeras: visa ingenting som kan misslyckas.
  const pending = Boolean(url) && !activeUrl;

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
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{url ? label : t('ui.inget_underlag')}</span>
        </span>
        <span className="dv-tools">
          {isImage && (
            <>
              <button type="button" className="dv-btn" onClick={() => changeZoom(-1)} disabled={zoom <= ZOOM_MIN} aria-label={t('ui.zooma_ut')} title={t('ui.zooma_ut')}>
                <ZoomOut size={15} />
              </button>
              <span className="dv-zoom">{zoom === FIT_ZOOM ? t('ui.passa') : `${Math.round(zoom * 100)}%`}</span>
              <button type="button" className="dv-btn" onClick={() => changeZoom(1)} disabled={zoom >= ZOOM_MAX} aria-label={t('ui.zooma_in')} title={t('ui.zooma_in')}>
                <ZoomIn size={15} />
              </button>
            </>
          )}
          {expandable && url && (
            <button type="button" className="dv-btn dv-expand" onClick={() => setExpanded(true)} aria-label={t('ui.visa_i_helskarm')} title={t('ui.visa_i_helskarm')}>
              <Maximize2 size={14} /> {t('ui.helskarm')}
            </button>
          )}
          {activeUrl && (
            <a className="dv-btn" href={activeUrl} target="_blank" rel="noopener noreferrer" title={t('ui.oppna_filen_i_en_ny_flik')}>
              <ExternalLink size={14} /> {t('ui.oppna')}
            </a>
          )}
        </span>
      </div>

      <div className="dv-body" style={kind === 'pdf' ? { padding: 0 } : undefined}>
        {pending ? (
          <div className="dv-empty"><span>{t('ui.hamtar_underlaget')}</span></div>
        ) : isImage ? (
          <img
            ref={imgRef}
            className={`dv-img${zoom === FIT_ZOOM ? ' dv-img-fit' : ''}`}
            src={activeUrl}
            alt={label}
            onError={() => setImgFailed(true)}
            // På mobil öppnar ett tryck på kvittot helskärmsvyn, där det går
            // att zooma och panorera utan att formuläret ligger i vägen.
            onClick={expandable && zoom === FIT_ZOOM && isNarrowScreen() ? () => setExpanded(true) : undefined}
            style={zoom === FIT_ZOOM
              ? (expandable ? { cursor: 'zoom-in' } : undefined)
              : { width: fitWidthRef.current ? `${Math.round(fitWidthRef.current * zoom)}px` : `${zoom * 100}%`, maxWidth: 'none', maxHeight: 'none' }}
          />
        ) : kind === 'pdf' ? (
          <iframe className="dv-frame" src={activeUrl} title={label} />
        ) : (
          <div className="dv-empty">
            <Receipt size={38} strokeWidth={1.5} />
            <span>
              {imgFailed
                ? t('ui.bilden_gar_inte_att_visa_i_den_har_webblasaren_t')
                : url
                  ? t('ui.filformatet_gar_inte_att_forhandsvisa_har_oppna')
                  : emptyText || t('ui.inget_underlag_ar_sparat_har_annu')}
            </span>
          </div>
        )}
      </div>
      {expanded && <DocumentLightbox url={url} type={type} name={name} onClose={() => setExpanded(false)} />}
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
    <div className="dv-lightbox" role="dialog" aria-modal="true" aria-label={name || t('ui.underlag')}>
      <DocumentPane url={url} type={type} name={name} />
      <button type="button" className="dv-close" onClick={onClose} aria-label={t('ui.stang')}>
        <X size={18} />
      </button>
    </div>
  );
}

export default DocumentPane;
