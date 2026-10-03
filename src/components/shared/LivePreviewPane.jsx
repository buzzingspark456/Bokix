import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PaperFit from './PaperFit';
import { layoutRect, layoutViewport } from '../../utils/dropdownPlacement';
import { t } from '../../i18n';

// ── Förhandsvisning medan man skriver (faktura och offert) ──────────────
// Valfri: man slår på den i formulärets verktygsrad, och valet sparas i
// webbläsaren så den som gillar det slipper slå på det varje gång. Dokumentet
// är samma InvoiceDocument som PDF:en fångar, så det man ser medan man
// skriver är det kunden får.
//
// Tre lägen beroende på skärmen:
//  - Bred yta (innehållet minst 1300 px brett, i appens egna pixlar): en
//    kolumn till höger om formuläret. Formuläret får alltid minst 860 px
//    (annars kläms kundväljaren och radernas summakolumn), kolumnen resten upp till
//    760 px. Förut avgjordes det av fönstrets bredd, och på en 1366-laptop
//    blev formuläret för smalt. Formuläret och dokumentet skrollar var för
//    sig. En tidigare smal sidopanel (460 px, skalad till 92 %) byttes en gång
//    mot rutan eftersom fakturan blev en hopklämd miniatyr.
//  - Smalare (halv skärm, mindre laptop): två kolumner ryms inte, så formuläret får
//    flikarna Redigera | Förhandsvisning överst. Dokumentet visas då i full
//    bredd och är alltid uppdaterat med det man nyss skrev.
//  - Telefon: ingen förhandsvisning medan man skriver (användarens val); där
//    finns den vanliga Förhandsgranska-rutan.

const STORAGE_KEY = 'bokix_doc_live_preview';
const FORM_MIN = 860;
const PANE_MIN = 440;
const PANE_MAX = 760;
const PHONE_QUERY = '(max-width: 768px)';

function useMatchMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

/**
 * `available`: knappen ska visas (inte på telefon). `on`: förhandsvisningen är påslagen. `wide`: den visas som kolumn bredvid,
 * annars som flik. `view` ('form' | 'preview') gäller bara flikläget.
 * `bodyClass`: klassen formulärets kropp ska ha.
 */
/** Innehållsytans bredd (fönstret minus sidomenyn) i appens egna pixlar. */
function useContentWidth() {
  const read = () => {
    if (typeof window === 'undefined') return 0;
    const side = document.querySelector('.sidebar');
    const sideW = side ? layoutRect(side).width : 0;
    return Math.round(layoutViewport().width - sideW);
  };
  const [w, setW] = useState(read);
  useEffect(() => {
    const onResize = () => setW(read());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

export function useLivePreview() {
  const contentW = useContentWidth();
  const wide = contentW >= FORM_MIN + PANE_MIN;
  const paneWidth = Math.max(PANE_MIN, Math.min(PANE_MAX, contentW - FORM_MIN));
  const phone = useMatchMedia(PHONE_QUERY);
  const [wanted, setOn] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [view, setView] = useState('form');
  const toggle = () => {
    setView('form');
    setOn(v => {
      try { localStorage.setItem(STORAGE_KEY, v ? '0' : '1'); } catch { /* privat läge */ }
      return !v;
    });
  };
  const on = wanted && !phone;
  const bodyClass = !on ? undefined : wide ? 'doc-split' : `doc-split doc-split--tabs doc-split--view-${view}`;
  return {
    available: !phone, on, wide, paneWidth, view, setView, toggle, bodyClass,
    // Bara bred skärm låser höjden så kolumnerna skrollar var för sig.
    splitScrolls: on && wide,
    toggleLabel: t(wide ? 'ui.forhandsvisning_bredvid' : 'ui.forhandsvisning_live'),
  };
}

/** Flikarna Redigera | Förhandsvisning, bara i flikläget (halv skärm). */
export function LivePreviewTabs({ preview }) {
  if (!preview.on || preview.wide) return null;
  const tab = (id, label) => (
    <button
      type="button" role="tab" aria-selected={preview.view === id}
      className={`doc-preview-tab${preview.view === id ? ' active' : ''}`}
      onClick={() => preview.setView(id)}
    >{label}</button>
  );
  return (
    <div className="doc-preview-tabs">
      <div className="doc-preview-tabs-seg" role="tablist" aria-label={t('ui.forhandsvisning_rubrik')}>
        {tab('form', t('ui.forhandsvisning_redigera'))}
        {tab('preview', t('ui.forhandsvisning_rubrik'))}
      </div>
    </div>
  );
}

export default function LivePreviewPane({ preview, children }) {
  // Bred skärm: formuläret och dokumentet ska skrolla var för sig, så ytan de
  // delar (föräldern, .doc-split) låses till fönstrets höjd under sidhuvudet.
  // Höjden mäts från var ytan faktiskt börjar, samma sätt som startsidans
  // diagram, så det blir rätt oavsett zoom och hur högt sidhuvudet är.
  const ref = useRef(null);
  const lock = preview.splitScrolls;
  useLayoutEffect(() => {
    if (!lock) return undefined;
    const split = ref.current?.parentElement;
    const scroller = split?.closest('.main-wrapper');
    if (!split || !scroller) return undefined;
    const measure = () => {
      const top = layoutRect(split).top - layoutRect(scroller).top + scroller.scrollTop;
      split.style.height = `${Math.max(320, Math.round(scroller.clientHeight - top))}px`;
      split.style.flex = '0 0 auto';
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      split.style.height = '';
      split.style.flex = '';
    };
  }, [lock]);
  return (
    <aside ref={ref} className="doc-live-preview" style={preview.wide ? { width: `${preview.paneWidth}px` } : undefined} aria-label={t('ui.forhandsvisning_rubrik')}>
      <div className="doc-live-preview-head">
        <span className="doc-live-preview-title">{t('ui.forhandsvisning_rubrik')}</span>
        <span className="doc-live-preview-hint">{t('ui.forhandsvisning_uppdateras')}</span>
      </div>
      <div className="doc-live-preview-paper">
        {/* Zoomknapparna bara i flikläget: bredvid formuläret hamnade de
            fasta knapparna annars ovanpå formuläret. */}
        <PaperFit zoomControls={!preview.wide}>{children}</PaperFit>
      </div>
    </aside>
  );
}
