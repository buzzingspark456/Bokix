import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from '../marketingTokens';
import { GRAD, grad, AuroraLayer } from '../aurora';
import { PageMeta, JsonLd, SITE_URL } from '../../../utils/seo';
import { TOOLS, TOOLS_HUB_PATH } from './toolsConfig';

// Navet för de fria verktygen. Egen sida (inte bara sidfotslänkar) av två
// skäl: den är målsidan för "gratis verktyg bokföring"-sökningar, och den
// ger varje enskilt verktyg en intern länk från en sida med tyngd —
// annars hänger verktygssidorna bara i sidfoten.
//
// Kortlistan byggs ur TOOLS (toolsConfig.js), aldrig ur en egen kopia:
// ett nytt verktyg ska dyka upp här, i sidfoten och i "fler verktyg"-raden
// av sig självt.

const ITEM_LIST_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Gratis verktyg för svenska företagare',
  itemListElement: TOOLS.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: t.title,
    description: t.description,
    url: `${SITE_URL}${t.path}`,
  })),
};

export default function ToolsHubPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Gratis verktyg för företagare — moms, lön, ROT/RUT och mer | Bokix"
        description="Sex gratisverktyg för svenska företagare: momskalkylator, lönekalkylator, egenavgifter för enskild firma, ROT- och RUT-avdrag, dröjsmålsränta och gränsbelopp enligt 3:12-reglerna. Inget konto krävs."
        path={TOOLS_HUB_PATH}
      />
      <JsonLd data={ITEM_LIST_SCHEMA} />
      <style>{`
        .bx-hub-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        @media (max-width: 780px) { .bx-hub-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section style={{ padding: '150px 24px 60px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(14,165,233,0.16)', '3% -8%'], ['rgba(132,204,22,0.14)', '98% 106%']]}
          blob={{ gradient: grad(GRAD.blueTeal), top: '-160px', left: '-110px', size: '440px', opacity: 0.18 }}
        />
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '18px', lineHeight: 1.14 }}>
            Verktyg som räknar rätt åt dig
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7 }}>
            De uträkningar svenska företagare gör om och om igen, med formeln utskriven så du ser exakt hur svaret kom fram.
            Ingen registrering, ingen mejladress, inget som sparas.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 30px', background: 'var(--mkt-page-bg)' }}>
        <div className="bx-hub-grid" style={{ maxWidth: '900px', margin: '0 auto' }}>
          {TOOLS.map((t, i) => {
            const accent = ACCENT[t.accentKey] || ACCENT.green;
            const Icon = t.icon;
            return (
              <Reveal key={t.slug} delay={i * 60} as={Link} to={t.path} className="lp-card-hover" style={{
                display: 'block', textDecoration: 'none', background: 'var(--mkt-card-bg)',
                border: `1px solid ${CARD_BORDER}`, borderRadius: '18px', padding: '26px 26px 24px', boxShadow: CARD_SHADOW,
              }}>
                <div style={{ width: 42, height: 42, borderRadius: '12px', background: accent.soft, color: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Icon size={19} />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: INK, margin: '0 0 7px', letterSpacing: '-0.01em' }}>{t.title}</h2>
                <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.65, margin: '0 0 14px' }}>{t.description}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13.5px', fontWeight: 700, color: accent.fg }}>
                  Öppna verktyget <ArrowRight size={14} />
                </span>
              </Reveal>
            );
          })}

          {/* Ordlistan är inte en räknare, men hör hemma i samma "gratis och
              användbart utan konto"-familj — och får därför sista platsen i
              rutnätet i stället för att gömmas i sidfoten. */}
          <Reveal delay={TOOLS.length * 60} as={Link} to="/ordlista" className="lp-card-hover" style={{
            display: 'block', textDecoration: 'none', background: IVORY,
            border: `1px solid ${CARD_BORDER}`, borderRadius: '18px', padding: '26px 26px 24px', boxShadow: CARD_SHADOW,
          }}>
            <div style={{ width: 42, height: 42, borderRadius: '12px', background: ACCENT.blue.soft, color: ACCENT.blue.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <BookOpen size={19} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: INK, margin: '0 0 7px', letterSpacing: '-0.01em' }}>Bokföringsordlista</h2>
            <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.65, margin: '0 0 14px' }}>
              Vad betyder verifikation, periodisering, AGI och K2? Ett uppslagsverk på svenska, utan revisorsprosa.
            </p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13.5px', fontWeight: 700, color: ACCENT.blue.fg }}>
              Slå upp ett ord <ArrowRight size={14} />
            </span>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
