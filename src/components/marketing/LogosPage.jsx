import React, { useState } from 'react';
import MarketingLayout from './MarketingLayout';
import BokixWordmark from '../shared/BokixWordmark';
import { PageMeta } from '../../utils/seo';

// Logotyper och färger (2026-11-28): en riktig varumärkessida för press,
// partner och redovisningsbyråer. Ordmärket stort överst, logotyperna på ljus
// och mörk bakgrund med nedladdning, färgerna (klick kopierar koden) och hur
// logotypen används. Inte indexerad.

const COLORS = [
  { name: 'Bokix-grön', hex: '#0B6329', use: 'Knappar, menyn och det mesta i appen', ink: '#fff' },
  { name: 'Blå', hex: '#0EA5E9', use: 'Början av logotypens färgövergång', ink: '#fff' },
  { name: 'Turkos', hex: '#14B8A6', use: 'Mitten av färgövergången', ink: '#fff' },
  { name: 'Lime', hex: '#84CC16', use: 'Slutet av färgövergången', ink: '#10231a' },
  { name: 'Skog', hex: '#1B4332', use: 'Mörk bakgrund', ink: '#fff' },
  { name: 'Natt', hex: '#0C1F14', use: 'Mörka plattan bakom symbolen', ink: '#fff' },
];

function Swatch({ c }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(c.hex); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { /* inget urklipp */ }
  };
  return (
    <button type="button" className="bxl-swatch" onClick={copy} aria-label={`Kopiera ${c.name} ${c.hex}`}>
      <span className="bxl-swatch-color" style={{ background: c.hex, color: c.ink }}>{copied ? 'Kopierad' : c.hex}</span>
      <span className="bxl-swatch-text"><b>{c.name}</b><small>{c.use}</small></span>
    </button>
  );
}

export default function LogosPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Bokix logotyper och färger"
        description="Bokix-symbolen, ordmärket och färgerna att ladda ner."
        path="/logotyper"
        noindex
      />
      <main className="bxl">
        <style>{`
          .bxl { max-width: 1120px; margin: 0 auto; padding: 140px 24px 96px; }
          .bxl-head { max-width: 640px; margin: 0 auto 36px; text-align: center; }
          .bxl h1 { margin: 0; color: var(--mkt-ink); font-family: var(--font-serif, Georgia, serif); font-size: clamp(36px, 5vw, 56px); font-weight: 600; letter-spacing: -.035em; line-height: 1.08; }
          .bxl-intro { margin: 16px 0 0; color: var(--mkt-muted); font-size: 16px; line-height: 1.65; }
          .bxl-hero { display: grid; grid-template-columns: 1fr 1fr; border-radius: 24px; overflow: hidden; margin-bottom: 64px; box-shadow: 0 30px 80px rgba(0, 0, 0, .25); }
          .bxl-hero > div { display: grid; place-items: center; min-height: 300px; padding: 40px; }
          .bxl-hero-light { background: #fff; }
          .bxl-hero-dark { background: #1b4332; }
          .bxl-section { margin-top: 56px; }
          .bxl-section > h2 { margin: 0 0 6px; color: var(--mkt-ink); font-size: 24px; font-weight: 650; letter-spacing: -.02em; }
          .bxl-section > p { margin: 0 0 20px; color: var(--mkt-muted); font-size: 14.5px; line-height: 1.55; }
          .bxl-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
          .bxl-card { border: 1px solid var(--mkt-card-border); border-radius: 20px; overflow: hidden; background: var(--mkt-card-bg); box-shadow: var(--mkt-card-shadow-sm, none); }
                    /* Korten ser likadana ut i båda teman (som i mörkt): den vita rutan försvinner annars mot ett vitt kort. */
          .bxl-card, html[data-theme="dark"] .bxl-card { background: #17281c; border-color: #2a3d2c; }
          .bxl-card .bxl-card-body h3 { color: #eef3ea; }
          .bxl-card .bxl-card-body p, .bxl-card .bxl-variant-label { color: #8fa088; }
          .bxl-card .bxl-dl .is-ghost { color: #eef3ea; border-color: #2a3d2c; }
          .bxl-card-preview { display: grid; grid-template-columns: repeat(3, 1fr); }
          .bxl-card-preview > a { display: grid; place-items: center; min-width: 0; min-height: 150px; padding: 18px; }
          .bxl-card-preview .is-light { background: #fff; }
          .bxl-card-preview .is-skog { background: #1b4332; }
          .bxl-card-preview .is-natt { background: #0c1f14; }
          /* Mörka temat: toppens mörka halva på den djupare plattfärgen. */
          html[data-theme="dark"] .bxl-hero-dark { background: #0c1f14; }
          .bxl-card-preview img { width: 64px; height: 64px; object-fit: contain; }
          /* Ordmärket skalar med rutan, så det alltid står i mitten (även på halv skärm). */
          .bxl-card-preview img.bxl-wm { width: 100%; max-width: 150px; height: auto; }
          .bxl-card-body { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 16px 18px; }
          .bxl-card-body h3 { margin: 0; color: var(--mkt-ink); font-size: 16px; font-weight: 650; }
          .bxl-card-body p { margin: 3px 0 0; color: var(--mkt-muted); font-size: 13px; }
          .bxl-dl { display: flex; gap: 6px; flex-wrap: wrap; }
          .bxl-dl a, .bxl-dl button { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border: 1px solid #0b6329; border-radius: 999px; background: #0b6329; color: #fff; font: 650 12.5px/1 var(--font-sans, Inter, Arial, sans-serif); text-decoration: none; cursor: pointer; white-space: nowrap; }
          .bxl-dl a:hover, .bxl-dl button:hover { background: #084d21; }
          .bxl-dl .is-ghost { background: transparent; color: var(--mkt-ink); border-color: var(--mkt-card-border); }
          .bxl-dl .is-ghost:hover { background: rgba(127, 127, 127, .12); }
          .bxl-swatches { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
          .bxl-swatch { display: flex; flex-direction: column; padding: 0; border: 1px solid var(--mkt-card-border); border-radius: 16px; overflow: hidden; background: var(--mkt-card-bg); text-align: left; cursor: pointer; font: inherit; transition: transform .15s ease; }
          .bxl-swatch:hover { transform: translateY(-2px); }
          .bxl-swatch-color { display: flex; align-items: flex-end; height: 96px; padding: 12px; font: 700 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em; }
          .bxl-swatch-text { display: flex; flex-direction: column; gap: 3px; padding: 12px; }
          .bxl-swatch-text b { color: var(--mkt-ink); font-size: 14px; }
          .bxl-swatch-text small { color: var(--mkt-muted); font-size: 12px; line-height: 1.4; }
          .bxl-gradient { margin-top: 12px; height: 14px; border-radius: 999px; background: linear-gradient(90deg, #0ea5e9, #14b8a6 50%, #84cc16); }
          .bxl-rules { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
          .bxl-rule { padding: 18px; border: 1px solid var(--mkt-card-border); border-radius: 16px; background: var(--mkt-card-bg); }
          .bxl-rule b { display: block; margin-bottom: 6px; color: var(--mkt-ink); font-size: 15px; }
          .bxl-rule span { color: var(--mkt-muted); font-size: 13.5px; line-height: 1.55; }
          .bxl-contact { margin-top: 48px; text-align: center; color: var(--mkt-muted); font-size: 14px; }
          .bxl-contact a { color: #14b8a6; font-weight: 600; }
          @media (max-width: 900px) {
            .bxl-cards, .bxl-rules { grid-template-columns: 1fr; }
            .bxl-swatches { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          }
          @media (max-width: 640px) {
            .bxl { padding: 118px 16px 72px; }
            .bxl-hero { grid-template-columns: 1fr; }
            .bxl-hero > div { min-height: 180px; }
          }
        `}</style>

        <header className="bxl-head">
          <h1>Logotyper och färger</h1>
          <p className="bxl-intro">Allt du behöver för att visa Bokix, till exempel i en artikel, på en byrås hemsida eller i en presentation.</p>
        </header>

        <div className="bxl-hero" aria-hidden="true">
          <div className="bxl-hero-light"><BokixWordmark height={72} /></div>
          <div className="bxl-hero-dark"><BokixWordmark height={72} /></div>
        </div>

        <section className="bxl-section" aria-labelledby="bxl-logos">
          <h2 id="bxl-logos">Logotyper</h2>
          <p>Transparenta filer som håller skärpan i alla storlekar.</p>
          <div className="bxl-cards">
            <article className="bxl-card">
              <div className="bxl-card-preview">
                <a className="is-light" href="/bokix-ordmarke.svg" target="_blank" rel="noopener" title="Öppna i ny flik"><img className="bxl-wm" src="/bokix-ordmarke.svg" alt="" /></a>
                <a className="is-skog" href="/bokix-ordmarke.svg" target="_blank" rel="noopener" title="Öppna i ny flik"><img className="bxl-wm" src="/bokix-ordmarke.svg" alt="" /></a>
                <a className="is-natt" href="/bokix-ordmarke-mork.svg" target="_blank" rel="noopener" title="Öppna i ny flik"><img className="bxl-wm" src="/bokix-ordmarke.svg" alt="" /></a>
              </div>
              <div className="bxl-card-body">
                <div><h3>Ordmärke</h3><p>Hela namnet, förstahandsvalet.</p></div>
                <div className="bxl-dl">
                  <a href="/bokix-ordmarke.svg" download="bokix-ordmarke.svg">SVG</a>
                  <a className="is-ghost" href="/bokix-ordmarke-mork.svg" download="bokix-ordmarke-mork.svg">SVG, mörk platta</a>
                  <a className="is-ghost" href="/bokix-ordmarke-mork.png" download="bokix-ordmarke-mork.png">PNG, mörk platta</a>
                </div>
              </div>
            </article>
            <article className="bxl-card">
              <div className="bxl-card-preview">
                <a className="is-light" href="/bokix-symbol.svg" target="_blank" rel="noopener" title="Öppna i ny flik"><img src="/bokix-symbol.svg" alt="" /></a>
                <a className="is-skog" href="/bokix-symbol.svg" target="_blank" rel="noopener" title="Öppna i ny flik"><img src="/bokix-symbol.svg" alt="" /></a>
                <a className="is-natt" href="/bokix-logo.svg" target="_blank" rel="noopener" title="Öppna i ny flik"><img src="/bokix-symbol.svg" alt="" /></a>
              </div>
              <div className="bxl-card-body">
                <div><h3>Symbol</h3><p>B:et för små ytor, som appikon och favicon.</p></div>
                <div className="bxl-dl">
                  <a href="/bokix-symbol.svg" download="bokix-symbol.svg">SVG</a>
                  <a className="is-ghost" href="/bokix-logo.svg" download="bokix-symbol-mork.svg">SVG, mörk platta</a>
                  <a className="is-ghost" href="/bokix-logo.png" download="bokix-symbol-mork.png">PNG, mörk platta</a>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="bxl-section" aria-labelledby="bxl-colors">
          <h2 id="bxl-colors">Färger</h2>
          <p>Klicka på en färg för att kopiera koden.</p>
          <div className="bxl-swatches">
            {COLORS.map(c => <Swatch key={c.hex} c={c} />)}
          </div>
          <div className="bxl-gradient" aria-hidden="true" />
        </section>

        <section className="bxl-section" aria-labelledby="bxl-rules">
          <h2 id="bxl-rules">Använd logotypen rätt</h2>
          <p>Några enkla regler, så att Bokix ser ut som Bokix överallt.</p>
          <div className="bxl-rules">
            <div className="bxl-rule"><b>Ge den luft</b><span>Lämna minst lika mycket fri yta runt logotypen som höjden på B:et.</span></div>
            <div className="bxl-rule"><b>Inte för liten</b><span>Ordmärket minst 80 px brett på skärm, symbolen minst 24 px.</span></div>
            <div className="bxl-rule"><b>Ändra den inte</b><span>Behåll färgövergången och formen. Ingen skugga, ingen kontur, ingen annan färg.</span></div>
          </div>
        </section>

        <p className="bxl-contact">Behöver du något annat? Skriv till <a href="mailto:support@bokix.se">support@bokix.se</a>.</p>
      </main>
    </MarketingLayout>
  );
}
