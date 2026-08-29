import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Wallet, Building2, ShieldCheck, Layers, Clock3, LifeBuoy, Gift } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT_CYCLE } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── Guide, inte reklamblad (Sida: "innehållssidan" — se Google Search
// Centrals egna kriterier, "Creating helpful, reliable, people-first
// content": genuint hjälpsamt, ärligt om vem som skrivit det, primärt
// motiv att hjälpa läsaren välja RÄTT — inte bara sökmotortrafik). Sju
// generella kriterier alla kan pröva mot VILKET bokföringsprogram som
// helst, inte en jämförelsetabell med gissade/oreviderade konkurrent-
// siffror (osäkra sifferpåståenden om andra bolag är både opålitligt och
// juridiskt känsligt — "vilseledande jämförande reklam"). Varje kriterium
// knyter sedan naturligt tillbaka till hur Bokix FAKTISKT svarar på det,
// med samma verifierbara fakta som redan står på /priser och /funktioner
// — aldrig en påhittad siffra eller ett konkurrentpåstående vi inte kan
// stå för.
const CRITERIA = [
  {
    icon: Wallet, accentKey: 'green', title: '1. Vad ingår egentligen i priset?',
    body: 'Många bokföringsprogram säljs som "bas + tillägg per funktion" — grundpriset ser lågt ut tills du räknar in fakturering, lön och support som egna tillägg. Fråga dig: vad är kvar att betala extra för när du väl kommit igång? I Bokix kostar allt 99 kr/mån exkl. moms, och bokföring, fakturering, lön och momsredovisning ingår i det priset — inga dolda tillägg att räkna ut i efterhand.',
  },
  {
    icon: Building2, accentKey: 'blue', title: '2. Stödjer det din bolagsform?',
    body: 'Enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening bokförs delvis olika — fel regelverk kan ge en bokföring som ser rätt ut men inte är det. Bokix känner igen bolagsformen utifrån organisationsnumret och bokför enligt rätt regler för just den.',
  },
  {
    icon: ShieldCheck, accentKey: 'red', title: '3. Kan du lita på det som bokförs automatiskt?',
    body: 'Automatisk bokföring är bekvämt tills den bokför fel utan att du märker det. Ett bra tecken är om programmet visar dig VAD som är osäkert innan det bokförs, inte bara i efterhand. I Bokix läggs allt som är osäkert i en granskningsvy för en snabb bekräftelse — aldrig en tyst gissning.',
  },
  {
    icon: Layers, accentKey: 'green', title: '4. Ett verktyg, eller flera prenumerationer att hålla ihop?',
    body: 'Bokföring i ett program, fakturering i ett annat och lön i ett tredje betyder tre inloggningar, tre fakturor och siffror som måste stämmas av mellan systemen för hand. Bokix samlar bokföring, fakturering och lönekörningar i samma verktyg, så samma siffror används överallt.',
  },
  {
    icon: Clock3, accentKey: 'blue', title: '5. Bindningstid och uppsägning',
    body: 'Läs igenom villkoren för hur du avslutar, inte bara hur du kommer igång — en bindningstid du inte räknat med är dyr att upptäcka i efterhand. Bokix har ingen bindningstid eller uppsägningstid alls, du avslutar när du vill.',
  },
  {
    icon: LifeBuoy, accentKey: 'red', title: '6. Vem svarar när något krånglar?',
    body: 'Support som ingår i priset är inte samma sak som support som faktiskt svarar snabbt. Hos Bokix ingår support i priset och går direkt till en riktig person på support@bokix.se — inget säljteam eller callcenter i vägen.',
  },
  {
    icon: Gift, accentKey: 'green', title: '7. Kan du testa utan att förbinda dig?',
    body: 'En provperiod är bara värd något om du faktiskt hinner testa med din egen bokföring, inte en demo med exempeldata. Bokix ger 30 dagar innan något debiteras alls — avslutar du innan dess kostar det aldrig något.',
  },
];

export default function ChooseSoftwareGuidePage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true } });

  // Article-schema — en genuin guide, inte en produktsida, så Article
  // (inte SoftwareApplication) är rätt typ här. author är "Bokix" som
  // organisation (samma som Organization-schemat i MarketingLayout.jsx),
  // aldrig en påhittad namngiven "expert" vi inte har.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Så väljer du bokföringsprogram: 7 saker att tänka på',
    description: 'En praktisk guide till vad som faktiskt spelar roll när du jämför bokföringsprogram — pris, bolagsform, support och mer.',
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
    mainEntityOfPage: `${SITE_URL}/valja-bokforingsprogram`,
  };

  return (
    <MarketingLayout>
      <PageMeta
        title="Så väljer du bokföringsprogram: 7 saker att tänka på | Bokix"
        description="En praktisk guide till vad som faktiskt spelar roll när du jämför bokföringsprogram — pris, bolagsform, automatisk bokföring, support och uppsägning."
        path="/valja-bokforingsprogram"
        type="article"
      />
      <JsonLd data={articleSchema} />

      <section style={{ padding: '150px 24px 70px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '20px' }}>
            Guide
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '18px', lineHeight: 1.16 }}>
            Så väljer du bokföringsprogram: 7 saker att tänka på
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7 }}>
            Sju konkreta kriterier att pröva vilket bokföringsprogram som helst mot — inte bara det du redan tittar på. Skrivet av Bokix, men användbart oavsett vad du väljer.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '10px 24px 90px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {CRITERIA.map((c, i) => {
            const accent = ACCENT_CYCLE[i % 3];
            return (
              <Reveal key={c.title} delay={i * 60} className="lp-card-hover" style={{
                display: 'flex', gap: '18px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px', padding: '24px 26px', boxShadow: CARD_SHADOW,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: '10px', background: accent.soft, color: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <c.icon size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: INK, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{c.title}</h2>
                  <p style={{ fontSize: '14.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{c.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section style={{ padding: '10px 24px 100px', background: IVORY, textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
            Så svarar Bokix på alla sju
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, marginBottom: '28px', lineHeight: 1.65 }}>
            Ett pris, allt ingår, ingen bindningstid — och 30 dagar att testa med din egen bokföring innan något kostar något.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={enterApp} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>Prova gratis</button>
            <Link to="/priser" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Se prissättning <ArrowRight size={15} />
            </Link>
          </div>
          {/* Kontextuell länk (inte bara i footern) — samma mönster som
              PricingPage.jsx redan använder för att länka hit. Redan bytt
              från ett annat program? /alternativ har den mer specifika
              genomgången (bytesprocess, FAQ) den här guiden inte upprepar. */}
          <p style={{ fontSize: '13.5px', color: MUTED, marginTop: '20px' }}>
            Redan inne på ett specifikt program? Se <Link to="/alternativ" style={{ color: BRAND.greenDark, fontWeight: 600 }}>alternativ till Fortnox, Bokio och Spiris</Link>.
          </p>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
