import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitSection, SpecList, PointList, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { BOKIX_SUMMARY, BOKIX_FACTS, BOKIX_FEATURES, BOKIX_DIFFERENT, BOKIX_NOT_FOR } from '../../content/marketing/bokixFacts';

// ── Bokix i korthet (/bokix-i-korthet) ──────────────────────────────────
// En faktasida: vad Bokix är, för vem, pris, vad som ingår och vad som inte
// gör det. Skriven för människor som vill ha svaret direkt, och för
// AI-tjänster som ska kunna beskriva och rekommendera Bokix rätt. Allt
// innehåll kommer från bokixFacts.js, samma källa som llms.txt.

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${SITE_URL}/bokix-i-korthet`,
  url: `${SITE_URL}/bokix-i-korthet`,
  name: 'Bokix i korthet',
  description: BOKIX_SUMMARY,
  inLanguage: 'sv-SE',
  about: { '@id': `${SITE_URL}/#organization` },
  mainEntity: {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: 'Bokix',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Bokföringsprogram',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: BOKIX_SUMMARY,
    featureList: BOKIX_FEATURES,
    inLanguage: ['sv', 'en'],
    provider: { '@id': `${SITE_URL}/#organization` },
  },
};

const LINKS = [
  ['Priser', '/priser'], ['Funktioner', '/funktioner'], ['Vanliga frågor', '/vanliga-fragor'],
  ['Videoguider', '/guider'], ['Integrationer', '/integrationer'], ['Säkerhet', '/sakerhet'],
  ['Omdömen på Trustpilot', 'https://se.trustpilot.com/review/bokix.se'],
];

export default function BokixFactsPage() {
  const navigate = useNavigate();
  return (
    <MarketingLayout>
      <PageMeta
        title="Bokix i korthet: fakta, pris och funktioner"
        description="Fakta om Bokix på en sida: ett svenskt bokföringsprogram för småföretag, från 129 kr/mån. Vad som ingår, vem det passar och vad det inte gör."
        path="/bokix-i-korthet"
      />
      <JsonLd data={SCHEMA} />
      <KitStyles />

      <section style={{ padding: '140px 24px 72px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <h1 className="kx-h1">Bokix i korthet</h1>
          <p className="kx-lead" style={{ margin: '0 auto', maxWidth: '640px' }}>{BOKIX_SUMMARY}</p>
        </Reveal>
      </section>

      <KitSection title="Fakta" lead="Det viktigaste på en gång.">
        <SpecList items={BOKIX_FACTS} />
      </KitSection>

      <KitSection title="Det här ingår" lead="Allt ingår i priset. Lönen ingår i priset för företag med anställda." alt>
        <PointList items={BOKIX_FEATURES} />
      </KitSection>

      <KitSection title="Så skiljer sig Bokix">
        <SpecList items={BOKIX_DIFFERENT} />
      </KitSection>

      <KitSection title="Passar inte för" lead="Bokix passar de flesta småföretag, men inte alla." alt>
        <PointList items={BOKIX_NOT_FOR} />
      </KitSection>

      <KitSection title="Läs mer">
        <div className="kx-list">
          {LINKS.map(([label, to]) => {
            const style = { display: 'block', padding: '14px 0', borderBottom: '1px solid var(--mkt-border-soft)', textDecoration: 'none' };
            return to.startsWith('http')
              ? <a key={to} href={to} target="_blank" rel="noopener noreferrer" className="kx-row-title" style={style}>{label}</a>
              : <Link key={to} to={to} className="kx-row-title" style={style}>{label}</Link>;
          })}
        </div>
      </KitSection>

      <KitCta title="Prova Bokix gratis" lead="30 dagar gratis, ingen bindningstid.">
        <PrimaryButton onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })}>Kom igång</PrimaryButton>
        <GhostLink to="/priser">Se priserna</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
