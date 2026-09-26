import React from 'react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal, BokixWordmark } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── Om oss (/om-oss) ────────────────────────────────────────────────────
// Tredje versionen, och den kortaste med flit. Sidan ska vara SNYGG och
// säga vilka vi är. Inget annat.
//
// Borttaget på uttrycklig begäran — lägg inte tillbaka något av det:
//   - Nyckeltalskortet som räknade till noll ("betyder inte något").
//   - Löftesraderna om bindningstid, avgifter, annonser, inlåsning
//     ("nämner inte något"). De hör hemma på /priser, där de betyder
//     något för ett köpbeslut.
//   - "Prova själv"-avslutningen. Om oss ska inte sälja; sidfoten och
//     varje annan sida har redan sina knappar.
//   - Funktionskort, principkort, kontaktuppgifter.
//
// Kvar: Bokix eget varumärke, en rubrik, två stycken. Sidan är byggd som
// ett brev, inte som en landningssida — därför den smala spalten och den
// större brödtexten.
//
// UPPDATERAT KUNDÖNSKEMÅL (ersätter det tidigare beslutet nedan): ingen
// signatur med grundarnas namn längre, ingen mening om det egna priset
// (129/179 kr — hörde inte hemma i brevet, det står redan på /priser),
// ingen Ung Företagsamhet-logotyp i hjältesektionen, och ingen mening om
// varför UF-läget finns i Bokix — bara Bokix eget ordmärke och ETT stycke
// kvar av brevet. Sätt inte tillbaka något av detta utan att fråga igen.
//
// FAKTA (fortfarande sant, bara inte längre uppradat i brevet): Bokix ÄR
// ett UF-företag, presens. Grundarna heter Abdullah Alwaki och Siem
// Embaye — namnen finns kvar i git-historiken om de behövs igen, bara
// inte publicerade på sidan längre.

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'Om Bokix',
  url: `${SITE_URL}/om-oss`,
  inLanguage: 'sv-SE',
  description: 'Bokix drivs av två personer. Vi bygger ett bokföringsprogram som ska vara billigt och gå att förstå.',
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
};

export default function AboutPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Om oss | Bokix"
        description="Bokix drivs av två personer. Vi bygger ett bokföringsprogram för svenska småföretag som ska vara billigt och gå att förstå."
        path="/om-oss"
      />
      <JsonLd data={SCHEMA} />
      <style>{`
        .bx-ab-pair { display: flex; align-items: center; justify-content: center; gap: clamp(14px, 3vw, 26px); flex-wrap: wrap; }
        @media (max-width: 480px) { .bx-ab-pair { flex-direction: column; gap: 12px; } }

        /* Brödtexten är större än sajtens vanliga — sidan är ett brev på
           tre stycken, och då ska de styckena bära sidan. */
        .bx-ab-letter p { font-size: clamp(16.5px, 2.1vw, 19px); line-height: 1.85; margin: 0 0 20px; }

        /* Ett tunt grönt streck som avslutning på brevet.
           Växer fram när det kommer i bild — sidans enda rörelse utöver
           prickarna, och den räcker. */
        .bx-ab-rule {
          height: 3px; width: 0; border-radius: 3px; margin: 8px 0 22px;
          background: ${BRAND.green};
          transition: width 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.2s;
        }
        .lp-in .bx-ab-rule { width: 120px; }

        .bx-ab-dots { display: inline-flex; align-items: center; gap: 7px; }
        .bx-ab-dot { width: 9px; height: 9px; border-radius: 50%; background: ${BRAND.green}; animation: bx-ab-pulse 2.8s ease-in-out infinite; }
        .bx-ab-dot:nth-child(2) { background: ${BRAND.green}; opacity: 0.55; animation-delay: 1.4s; }
        @keyframes bx-ab-pulse { 0%, 100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.35); opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .bx-ab-dot { animation: none; }
          .bx-ab-rule { transition: none; width: 120px; }
        }
      `}</style>

      {/* ── Hjälte: vilka vi är ── */}
      <section style={{ padding: '140px 24px 20px', background: IVORY }}>
        <Reveal style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
          <div className="bx-ab-pair" style={{ marginBottom: '30px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 20px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', boxShadow: CARD_SHADOW }}>
              <BokixWordmark height={32} />
            </span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '11px', padding: '8px 17px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, marginBottom: '24px' }}>
            <span className="bx-ab-dots" aria-hidden><span className="bx-ab-dot" /><span className="bx-ab-dot" /></span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: INK_SOFT }}>Två personer bakom produkten</span>
          </div>

          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(31px, 5.2vw, 52px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, margin: '0 0 16px', lineHeight: 1.1 }}>
            Vi byggde det vi själva ville ha
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.65, margin: '0 auto', maxWidth: '520px' }}>
            Bokföring ska vara billig och gå att förstå. Det var hela idén, och det är fortfarande hela idén.
          </p>
        </Reveal>
      </section>

      {/* ── Brevet ── */}
      <section style={{ padding: '54px 24px 110px', background: IVORY }}>
        <Reveal className="bx-ab-letter" style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div className="bx-ab-rule" aria-hidden />
          <p style={{ color: INK_SOFT }}>
            Vi är två personer som tyckte att bokföringsprogram var dyra för det man fick, och skrivna som om alla som använder dem redan kan bokföring.
          </p>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
