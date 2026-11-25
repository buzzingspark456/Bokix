import React from 'react';
import MarketingLayout from './MarketingLayout';
import BokixWordmark, { BOKIX_LOGO_PATH } from '../shared/BokixWordmark';
import { PageMeta } from '../../utils/seo';

function downloadableWordmarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1250" height="400" viewBox="0 0 125 40">
  <defs>
    <linearGradient id="bokix-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="50%" stop-color="#14b8a6"/>
      <stop offset="100%" stop-color="#84cc16"/>
    </linearGradient>
  </defs>
  <path d="${BOKIX_LOGO_PATH}" fill="url(#bokix-gradient)"/>
</svg>`;
}

function downloadWordmark() {
  const file = new Blob([downloadableWordmarkSvg()], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bokix-logotyp.svg';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const LOGO_BACKGROUNDS = [
  { id: 'light', title: 'Ljus bakgrund', className: 'bx-logo-preview--light' },
  { id: 'dark', title: 'Mörk bakgrund', className: 'bx-logo-preview--dark' },
];

const LOGO_TYPES = [
  { id: 'symbol', title: 'Bokix-symbolen', description: 'Samma B-form som faviconen, fristående på vitt och med grön platta på mörkt', height: 48 },
  { id: 'wordmark', title: 'Bokix ordmärke', description: 'Hela namnet Bokix. Transparent SVG som förblir skarp i alla storlekar', height: 48 },
];

export default function LogosPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Bokix logotyper"
        description="Bokix-symbolen och ordmärket på ljus och mörk bakgrund."
        path="/logotyper"
        noindex
      />
      <main className="bx-logo-page">
        <style>{`
          .bx-logo-page {
            max-width: 1120px;
            margin: 0 auto;
            padding: 150px 24px 96px;
          }
          .bx-logo-page-header {
            max-width: 660px;
            margin: 0 auto 42px;
            text-align: center;
          }
          .bx-logo-page-kicker {
            margin: 0 0 12px;
            color: #0b7a56;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .bx-logo-page h1 {
            margin: 0;
            color: var(--mkt-heading, #10231a);
            font-family: ${'var(--font-serif, Georgia, serif)'};
            font-size: clamp(36px, 5vw, 56px);
            font-weight: 600;
            letter-spacing: -0.035em;
            line-height: 1.08;
          }
          .bx-logo-page-intro {
            margin: 16px 0 0;
            color: var(--mkt-text-muted, #617168);
            font-size: 16px;
            line-height: 1.65;
          }
          .bx-logo-group + .bx-logo-group { margin-top: 40px; }
          .bx-logo-group-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 18px;
          }
          .bx-logo-group-header h2 {
            margin: 0;
            color: var(--mkt-heading, #10231a);
            font-size: 22px;
            font-weight: 650;
            letter-spacing: -0.02em;
          }
          .bx-logo-group-header p {
            margin: 5px 0 0;
            color: var(--mkt-text-muted, #617168);
            font-size: 14px;
            line-height: 1.5;
          }
          .bx-logo-preview-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }
          .bx-logo-preview {
            min-width: 0;
            min-height: 220px;
            margin: 0;
            padding: 22px;
            border: 1px solid transparent;
            border-radius: 18px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
          }
          .bx-logo-preview--light {
            color: #10231a;
            background: #ffffff;
            border-color: #e4e9e5;
          }
          .bx-logo-preview--dark {
            color: #ffffff;
            background: #0c1f14;
          }
          .bx-logo-preview-visual {
            display: grid;
            place-items: center;
            width: 100%;
            min-height: 130px;
          }
          .bx-logo-preview-visual svg { max-width: 100%; height: auto; }
          .bx-logo-preview-visual img { width: 112px; height: 112px; object-fit: contain; }
          .bx-logo-preview figcaption {
            color: currentColor;
            font: 500 12px/1.4 var(--font-sans, Arial, sans-serif);
            opacity: 0.66;
          }
          .bx-logo-download-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            padding: 0 18px;
            border: 1px solid #0b6329;
            border-radius: 999px;
            color: #ffffff;
            background: #0b6329;
            font: 600 13px/1 var(--font-sans, Arial, sans-serif);
            cursor: pointer;
            transition: background-color 0.15s ease, transform 0.15s ease;
            white-space: nowrap;
            text-decoration: none;
          }
          .bx-logo-download-button:hover { background: #084d21; transform: translateY(-1px); }
          .bx-logo-download-button--secondary {
            color: #0b6329;
            background: transparent;
          }
          .bx-logo-download-button--secondary:hover { color: #ffffff; }
          .bx-logo-download-button:focus-visible { outline: 3px solid #14b8a6; outline-offset: 3px; }
          .bx-logo-download-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
          @media (max-width: 760px) {
            .bx-logo-page { padding: 126px 18px 72px; }
            .bx-logo-group-header { align-items: flex-start; flex-direction: column; gap: 14px; }
            .bx-logo-preview { min-height: 190px; padding: 16px; }
          }
          @media (max-width: 420px) {
            .bx-logo-group-header h2 { font-size: 20px; }
            .bx-logo-preview { min-height: 160px; gap: 12px; }
            .bx-logo-preview-visual { min-height: 100px; }
          }
        `}</style>
        <header className="bx-logo-page-header">
          <p className="bx-logo-page-kicker">Bokix varumärke</p>
          <h1>Våra logotyper</h1>
          <p className="bx-logo-page-intro">
            Bokix-symbolen och hela ordmärket, visade på ljus och mörk bakgrund.
          </p>
        </header>
        {LOGO_TYPES.map(({ id, title, description, height }) => (
          <section className="bx-logo-group" key={id} aria-labelledby={`bx-logo-${id}-title`}>
            <div className="bx-logo-group-header">
              <div>
                <h2 id={`bx-logo-${id}-title`}>{title}</h2>
                <p>{description}.</p>
              </div>
              <div className="bx-logo-download-actions">
                {id === 'symbol' ? (
                  <>
                    <a className="bx-logo-download-button" href="/bokix-symbol.svg" download="bokix-symbol.svg">Hämta symbol · SVG</a>
                    <a className="bx-logo-download-button bx-logo-download-button--secondary" href="/bokix-logo.png" download="bokix-symbol.png">Hämta symbol · PNG</a>
                  </>
                ) : (
                  <button type="button" className="bx-logo-download-button" onClick={downloadWordmark}>
                    Hämta ordmärke · SVG
                  </button>
                )}
              </div>
            </div>
            <div className="bx-logo-preview-grid">
              {LOGO_BACKGROUNDS.map((background) => (
                <figure className={`bx-logo-preview ${background.className}`} key={background.id}>
                  <div className="bx-logo-preview-visual">
                    {id === 'symbol'
                      ? <img src={background.id === 'light' ? '/bokix-symbol.svg' : '/bokix-logo.svg'} alt="Bokix B-symbol från faviconen" />
                      : <BokixWordmark height={height} />}
                  </div>
                  <figcaption>{background.title}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </main>
    </MarketingLayout>
  );
}
