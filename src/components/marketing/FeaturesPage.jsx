import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { ProductShot, ShotImg, SectionHead, PRODUCT_KIT_CSS } from './productKit';
import { PageMeta, JsonLd } from '../../utils/seo';

// ── Funktioner (/funktioner), tredje versionen 2026-11-07 ────────────────
// Användaren valde "gör om helt": stor rubrik, en bred bild av appen och
// sedan funktionerna som ett rutnät med stora riktiga bilder (som Stripe).
// Bilderna kommer från scripts/capture-product-shots.mjs.

// Rutnätet: wide = dubbel bredd. Bilden visas från överkanten.
const TILES = [
  { title: 'Fakturering', body: 'Fakturor med din logga, från din egen e-post. Kortbetalning via Stripe och påminnelser när de förfaller.', shot: 'kundfakturor-t', wide: true, to: '/faktureringsprogram' },
  { title: 'Kvitton', body: 'Fota kvittot, så fylls datum, belopp och moms i.', shot: 'kvitton-mobil', phone: true },
  { title: 'Att granska', body: 'Det Bokix inte är säker på hamnar här, med förslag i stället för gissningar.', shot: 'granska-mobil', phone: true },
  { title: 'Moms', body: 'Momsdeklarationen fylls i ur bokföringen, ruta för ruta.', shot: 'moms-mobil', phone: true },
  { title: 'Lön', body: 'Skattetabeller, AGI-fil, betalfil och semester.', shot: 'lonekorning-ny-mobil', phone: true, to: '/lon' },
  { title: 'Bokslut och deklaration', body: 'Årsbokslutet steg för steg, och sedan det som gäller din bolagsform: NE-bilaga, INK2 med årsredovisning, INK4 eller INK3.', shot: 'ink2-t', wide: true, to: '/bokforingsprogram-aktiebolag' },
  { title: 'Rapporter', body: 'Resultat, balans, kassaflöde och huvudbok.', shot: 'rapporter-mobil', phone: true },
];

// Telefonbilderna (390 px bred skärm i tre gångers upplösning) är skarpa
// i de smala rutorna; datorbilderna blir för små där.
const PHONE_SIZE = { w: 1170, h: 2373 };
// De breda rutornas bilder (-t) tas i ett 1000 px brett fönster.
const TILE_SIZE = { w: 1576, h: 1084 };

// Resten av appen, kort.
const MORE = [
  { title: 'Kunder', body: 'Uppgifterna hämtas från organisationsnumret.' },
  { title: 'Offerter', body: 'Blir en faktura när kunden säger ja.' },
  { title: 'Leverantörsfakturor', body: 'Det du ska betala, och när.' },
  { title: 'Bank', body: 'Kontoutdraget matchas mot fakturor och kvitton.' },
  { title: 'Bokföring', body: 'Enkelt läge, eller debet och kredit.' },
  { title: 'Artiklar och lager', body: 'Lagervärde och marginal. Slås på vid behov.', to: '/bokforingsprogram-med-lager' },
  { title: 'Projekt och tid', body: 'Tid och resultat per uppdrag. Slås på vid behov.' },
  { title: 'Integrationer', body: 'Stripe, Zettle, din e-post och kalendern.', to: '/integrationer' },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Funktioner i Bokix',
  itemListElement: [...TILES, ...MORE].map((m, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Thing', name: m.title, description: m.body } })),
};

function Tile({ t, i }) {
  const inner = (<>
    <div className="ft-tile-text">
      <h3>{t.title}{t.to && <span className="ft-arrow" aria-hidden="true">→</span>}</h3>
      <p>{t.body}</p>
    </div>
    <div className={'ft-tile-img' + (t.phone ? ' is-phone' : '')}><ShotImg name={t.shot} alt={t.title} size={t.phone ? PHONE_SIZE : TILE_SIZE} /></div>
  </>);
  return (
    <Reveal delay={(i % 3) * 60} className={'ft-tile' + (t.wide ? ' is-wide' : '')}>
      {t.to ? <Link to={t.to} className="ft-tile-link">{inner}</Link> : inner}
    </Reveal>
  );
}

export default function FeaturesPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  return (
    <MarketingLayout>
      <PageMeta
        title="Funktioner: bokföring, fakturering, lön och moms | Bokix"
        description="Allt som ingår i Bokix: kvitton, fakturor och offerter, bank, bokföring med BAS-kontoplanen, lön, moms, bokslut, deklarationer och rapporter."
        path="/funktioner"
      />
      <JsonLd data={SCHEMA} />
      <KitStyles />
      <style>{PRODUCT_KIT_CSS + FT_CSS}</style>

      <section className="pk-hero ft-hero">
        <Reveal className="pk-hero-text">
          <h1 className="pk-h1-wrap">
            <span className="pk-eyebrow">Funktioner</span>
            <span className="kx-h1 pk-h1">Hela företagets ekonomi i ett program.</span>
          </h1>
          <p className="pk-hero-lead">Kvitton, fakturor, bank, lön, moms och bokslut. Det som går att bokföra av sig självt gör det, och det som är osäkert får du titta på.</p>
          <div className="kx-actions pk-hero-actions">
            <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
            <GhostLink to="/priser">Se priser</GhostLink>
          </div>
          <p className="pk-hero-note">Allt ingår, från 129 kr/mån. Bokföringen lagras i Sverige och sparas i sju år.</p>
        </Reveal>
        <Reveal delay={120} className="ft-hero-shot">
          <ProductShot name="start" alt="Startsidan i Bokix" eager />
        </Reveal>
      </section>

      <section className="pk-section is-alt">
        <div className="ft-wrap">
          <SectionHead title="Det här finns i Bokix" lead="Bilderna är tagna ur appen, med ett exempelföretag." />
          <div className="ft-grid">
            {TILES.map((t, i) => <Tile key={t.title} t={t} i={i} />)}
          </div>
        </div>
      </section>

      <section className="pk-section">
        <div className="ft-wrap">
          <SectionHead title="Och resten" />
          <div className="ft-more">
            {MORE.map((m, i) => (
              <Reveal key={m.title} delay={(i % 4) * 50} className="ft-more-item">
                <h3>{m.to ? <Link to={m.to}>{m.title}</Link> : m.title}</h3>
                <p>{m.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <KitCta title="Allt ovan ingår" lead="129 kr/mån utan anställda, 179 kr/mån med anställda. 30 dagar gratis och ingen bindningstid på månadsplanen.">
        <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
        <GhostLink to="/priser">Se priser</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}

const FT_CSS = `
.ft-hero { padding-bottom: 88px; }
.ft-hero-shot { max-width: 1180px; margin: 56px auto 0; }
.ft-wrap { max-width: 1200px; margin: 0 auto; }
.ft-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.ft-tile { display: flex; flex-direction: column; min-height: 440px; border-radius: 22px; overflow: hidden; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); transition: transform 0.25s ease, box-shadow 0.25s ease; }
.ft-tile.is-wide { grid-column: span 2; }
.ft-tile:hover { transform: translateY(-3px); box-shadow: 0 30px 60px -40px rgba(16,24,20,0.35); }
.ft-tile-link { display: flex; flex-direction: column; flex: 1; color: inherit; text-decoration: none; }
.ft-tile-text { padding: 28px 28px 22px; }
.ft-tile-text h3 { display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 700; letter-spacing: -0.015em; color: var(--mkt-ink); margin: 0 0 8px; }
.ft-arrow { color: var(--mkt-accent-green-fg); transition: transform 0.2s ease; }
.ft-tile:hover .ft-arrow { transform: translateX(4px); }
.ft-tile-text p { font-size: 15.5px; line-height: 1.55; color: var(--mkt-ink-soft); margin: 0; max-width: 520px; text-wrap: pretty; }
.ft-tile-img { flex: 1; min-height: 240px; margin: 0 0 0 28px; border-top-left-radius: 14px; border: 1px solid var(--mkt-card-border); border-right: 0; border-bottom: 0; overflow: hidden; position: relative; }
.ft-tile-img .pk-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: left top; }
.ft-tile-img.is-phone { margin: 0 28px; border-radius: 18px 18px 0 0; border-right: 1px solid var(--mkt-card-border); }
.ft-tile-img.is-phone .pk-img { height: auto; top: -10.8%; bottom: auto; }
.ft-more { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px 32px; }
.ft-more-item { border-top: 1px solid var(--mkt-border-soft); padding-top: 18px; }
.ft-more-item h3 { font-size: 17px; font-weight: 700; color: var(--mkt-ink); margin: 0 0 6px; }
.ft-more-item h3 a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--mkt-btn-border); }
.ft-more-item h3 a:hover { color: var(--mkt-accent-green-fg); border-bottom-color: currentColor; }
.ft-more-item p { font-size: 15px; line-height: 1.5; color: var(--mkt-ink-soft); margin: 0; }
@media (max-width: 960px) {
  .ft-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ft-more { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .ft-grid { grid-template-columns: 1fr; }
  .ft-tile.is-wide { grid-column: auto; }
  .ft-tile { min-height: 380px; }
  .ft-tile-text { padding: 22px 22px 18px; }
  .ft-tile-img { margin-left: 22px; }
  .ft-more { grid-template-columns: 1fr; gap: 20px; }
}
`;
