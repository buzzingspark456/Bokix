import React, { useState } from 'react';
import PaperFit from './PaperFit';
import { ChevronLeft, ChevronRight, Download, Eye, Printer } from '../icons';
import { t } from '../../i18n';

const CLOSED_KEY = 'bokix_doc_split_closed';

// Dokumentet bredvid formuläret på faktura och offert, från 1280 px bredd
// (index.css). Går att minska så att formuläret får hela bredden; valet kommer
// webbläsaren ihåg till nästa dokument.
export default function DocSplit({ onEnlarge, onPrint, printing, onDownload, downloading, children }) {
  const [closed, setClosed] = useState(() => {
    try { return localStorage.getItem(CLOSED_KEY) === '1'; } catch { return false; }
  });
  const toggle = () => {
    setClosed(v => {
      try { localStorage.setItem(CLOSED_KEY, v ? '0' : '1'); } catch { /* privat läge: gäller bara nu */ }
      return !v;
    });
  };

  if (closed) {
    return (
      <aside className="doc-split is-closed">
        <div className="doc-split-inner">
          <button type="button" className="doc-split-round" onClick={toggle} title={t('ui.visa_dokumentet')} aria-label={t('ui.visa_dokumentet')}>
            <ChevronLeft size={17} />
          </button>
          <button type="button" className="doc-split-round" onClick={onPrint} disabled={printing} title={t('ui.skriv_ut')} aria-label={t('ui.skriv_ut')}>
            <Printer size={15} />
          </button>
          <button type="button" className="doc-split-round" onClick={onDownload} disabled={downloading} title={t('ui.ladda_ner_pdf')} aria-label={t('ui.ladda_ner_pdf')}>
            <Download size={15} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="doc-split" aria-label={t('ui.forhandsvisning')}>
      <div className="doc-split-inner">
        <div className="doc-split-head">
          <span>{t('ui.forhandsvisning')}</span>
          <div className="doc-split-actions">
            <button type="button" onClick={onPrint} disabled={printing}><Printer size={14} /> {t('ui.skriv_ut')}</button>
            <button type="button" onClick={onDownload} disabled={downloading}><Download size={14} /> {downloading ? t('ui.skapar_pdf') : t('ui.ladda_ner_pdf')}</button>
            <button type="button" onClick={onEnlarge}><Eye size={14} /> {t('ui.forstora')}</button>
            <button type="button" className="doc-split-round" onClick={toggle} title={t('ui.minska_dokumentet')} aria-label={t('ui.minska_dokumentet')}>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="doc-split-paper"><PaperFit zoomControls={false}>{children}</PaperFit></div>
      </div>
    </aside>
  );
}
