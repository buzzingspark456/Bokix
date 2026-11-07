import React from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PRODUCT_KIT_CSS } from './productKit';
import { StripeIconLogo, ZettleLogo, GmailLogo } from '../shared/BrandLogos';
import { PageMeta, JsonLd } from '../../utils/seo';

// ── Integrationer (/integrationer), 2026-11-07 ──────────────────────────
// Bara de kopplingar som finns, inget utfyllnadsmaterial (användarens
// önskemål: "vi har inte många integrationer, visa inte mer bara för att
// det ska bli mer"). Fyra kopplingar och det vi inte har.

const CONNECTIONS = [
  {
    name: 'Stripe',
    logo: <StripeIconLogo height={40} />,
    body: 'Kunden betalar fakturan med kort. Betalningar, avgifter och utbetalningar till banken hämtas in och bokförs.',
  },
  {
    name: 'Zettle',
    logo: <ZettleLogo height={26} />,
    body: 'Kassaförsäljningen från butiken hämtas in och bokförs i samma bokföring som fakturorna.',
  },
  {
    name: 'Din egen e-post',
    logo: <GmailLogo height={30} />,
    body: 'Fakturor, offerter och påminnelser skickas från din adress, och svaren hamnar i din inkorg.',
    chips: ['Gmail', 'Outlook och Microsoft 365', 'one.com', 'Loopia', 'Annan via SMTP'],
  },
  {
    name: 'Kalender',
    logo: <span className="ig-cal"><i>DEC</i>12</span>,
    body: 'Datum för moms, arbetsgivardeklaration och förfallna fakturor i din kalender, via en prenumerationslänk.',
  },
];


const NOT_YET = [
  { title: 'Bankkoppling', body: 'Transaktionerna hämtas inte direkt från banken.' },
  { title: 'E-faktura via Peppol', body: 'Fakturorna skickas som PDF med e-post.' },
  { title: 'Öppet API', body: 'Det finns inget publikt API i dag.' },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Integrationer i Bokix',
  itemListElement: CONNECTIONS.map((x, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Thing', name: x.name, description: x.body } })),
};

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });

  return (
    <MarketingLayout>
      <PageMeta
        title="Integrationer: Stripe, Zettle, e-post och kalender | Bokix"
        description="Bokix kopplas till Stripe, Zettle, din egen e-post och din kalender. Skatteverket, banken och andra program via filer: SIE4, kontoutdrag och deklarationsfiler."
        path="/integrationer"
      />
      <JsonLd data={SCHEMA} />
      <KitStyles />
      <style>{PRODUCT_KIT_CSS + IG_CSS}</style>

      <section className="pk-hero ig-hero">
        <Reveal className="pk-hero-text">
          <h1 className="pk-h1-wrap">
            <span className="pk-eyebrow">Integrationer</span>
            <span className="kx-h1 pk-h1">Fyra kopplingar som gör jobbet.</span>
          </h1>
          <p className="pk-hero-lead">Betalningar, kassan, din e-post och din kalender. Allt kopplas under Inställningar, Integrationer.</p>
        </Reveal>
      </section>

      <section className="pk-section ig-main">
        <div className="ig-list">
          {CONNECTIONS.map((c, i) => (
            <Reveal key={c.name} delay={i * 60} className="ig-row">
              <span className="ig-logo">{c.logo}</span>
              <div className="ig-row-text">
                <h2 className="ig-name">{c.name}</h2>
                <p className="ig-body">{c.body}</p>
                {c.chips && (
                  <div className="ig-chips">{c.chips.map(ch => <span key={ch}>{ch}</span>)}</div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="pk-section">
        <div className="pk-wrap ig-not-wrap">
          <h2 className="ig-not-title">Det här har vi inte än</h2>
          <ul className="ig-not">
            {NOT_YET.map(n => <li key={n.title}><strong>{n.title}.</strong> {n.body}</li>)}
          </ul>
        </div>
      </section>

      <KitCta title="Koppla det du använder" lead="30 dagar gratis, sedan från 129 kr/mån. Alla kopplingar ingår.">
        <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
        <GhostLink to="/funktioner">Se alla funktioner</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}

const IG_CSS = `
.ig-hero { padding-bottom: 56px; }
.ig-main { border-top: 0; padding-top: 0; }
.ig-list { max-width: 820px; margin: 0 auto; border-top: 1px solid var(--mkt-border-soft); }
.ig-row { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 28px; align-items: start; padding: 32px 0; border-bottom: 1px solid var(--mkt-border-soft); }
.ig-logo { display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 18px; background: #fff; border: 1px solid #eceae4; overflow: hidden; }
.ig-logo > svg, .ig-logo > img { max-width: 52px; max-height: 48px; width: auto; }
html[data-theme="dark"] #lp-root .ig-logo { background: #22382a; border-color: #2f4a35; }
.ig-cal { display: flex; flex-direction: column; align-items: center; font-size: 26px; font-weight: 800; line-height: 1; color: #1c2420; }
.ig-cal i { font-style: normal; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: #d14b3c; margin-bottom: 4px; }
html[data-theme="dark"] #lp-root .ig-cal { color: #eef3ea; }
.ig-name { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--mkt-ink); margin: 4px 0 8px; }
.ig-body { font-size: 16.5px; line-height: 1.6; color: var(--mkt-ink-soft); margin: 0; max-width: 600px; }
.ig-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.ig-chips span { font-size: 13.5px; font-weight: 600; color: var(--mkt-ink-soft); padding: 5px 12px; border-radius: 999px; border: 1px solid var(--mkt-card-border); background: var(--mkt-card-bg); }
.ig-not-wrap { max-width: 820px; }
.ig-not-title { font-size: 20px; font-weight: 700; color: var(--mkt-ink); margin: 0 0 14px; }
.ig-not { margin: 0; padding: 0; list-style: none; }
.ig-not li { padding: 12px 0; border-top: 1px solid var(--mkt-border-soft); font-size: 16px; line-height: 1.55; color: var(--mkt-ink-soft); }
.ig-not strong { color: var(--mkt-ink); }
@media (max-width: 640px) {
  .ig-row { grid-template-columns: 56px minmax(0, 1fr); gap: 18px; padding: 24px 0; }
  .ig-logo { width: 56px; height: 56px; border-radius: 14px; }
  .ig-logo > svg, .ig-logo > img { max-width: 40px; max-height: 36px; }
  .ig-name { font-size: 19px; }
}
`;
