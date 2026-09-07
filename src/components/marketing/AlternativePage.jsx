import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Wallet, Layers, ShieldCheck, Clock3, FileDown, ListChecks } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT_CYCLE } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── Konkurrent-jämförelsesida (Sida: "synas vid sökningar på Fortnox/
// Bokio/Spiris") — samma "genuint hjälpsamt, aldrig gissade konkurrent-
// siffror"-princip som ChooseSoftwareGuidePage.jsx redan etablerat och
// motiverar utförligt i sin egen filkommentar: en jämförelsetabell med
// påhittade eller oreviderade priser/funktioner om Fortnox/Bokio/Spiris
// vore både opålitligt (de kan ändra det när som helst, vi kan inte
// verifiera) och juridiskt känsligt (vilseledande jämförande reklam,
// marknadsföringslagen). Nämner konkurrenterna vid namn i rubrik/meta
// (det är precis vad någon som söker "alternativ till fortnox" vill se
// bekräftat), men gör INGA påståenden OM dem — bara Bokix egna,
// verifierbara fakta (samma siffror som redan står på /priser).
const BOKIX_ANSWERS = [
  {
    icon: Wallet, accentKey: 'green', title: 'Två priser, allt ingår',
    body: '129 kr/mån utan anställda, 179 kr/mån med lönemodulen. Bokföring, fakturering, lönekörningar och momsredovisning ingår i priset. Ingen "bas + tillägg per funktion"-modell att räkna ut i efterhand.',
  },
  {
    icon: Clock3, accentKey: 'blue', title: 'Ingen bindningstid',
    body: 'På månadsplanen avslutar du när du vill, utan uppsägningstid. Väljer du årsplanens lägre pris gäller minst tre månader. 30 dagar kostnadsfritt innan något debiteras alls, avslutar du innan dess kostar det aldrig något.',
  },
  {
    icon: Layers, accentKey: 'red', title: 'Alla bolagsformer',
    body: 'Enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening: Bokix känner igen bolagsformen utifrån organisationsnumret och bokför enligt rätt regler för just den.',
  },
  {
    icon: ShieldCheck, accentKey: 'green', title: 'Osäkert bokförs aldrig tyst',
    body: 'Allt som är osäkert i den automatiska bokföringen läggs i en granskningsvy för en snabb bekräftelse först. Aldrig en gissning som bokförs utan att du ser den.',
  },
];

// Ärligt om vad "byta" faktiskt innebär. UPPDATERAD: när den här sidan
// först skrevs fanns bara SIE4-EXPORT i kodbasen, och texten sa därför
// uttryckligen att någon automatisk import inte fanns. Nu finns den
// (utils/sieImport.js + SieImportModal.jsx), och sidan MÅSTE följa med —
// en marknadssida som förnekar en funktion produkten faktiskt har är
// lika skadlig som en som lovar en den inte har. Den fullständiga
// hur-gör-jag-sidan är /byt-bokforingsprogram; de fyra stegen här är
// kortversionen. Fortfarande INGET påstående om ett magiskt "ett klick
// och allt är på plats": importen kräver en SIE4-fil ur det gamla
// programmet, en kontomappning och en uttrycklig bekräftelse.
const SWITCH_STEPS = [
  { title: '1. Exportera en SIE4-fil ur ditt nuvarande program', body: 'Alla svenska bokföringsprogram kan exportera SIE, branschens standardformat. Bokix läser filen oavsett vilket program som skapade den.' },
  { title: '2. Sätt upp företaget i Bokix', body: 'Ange organisationsnummer så känner Bokix igen bolagsformen automatiskt och bokför enligt rätt regler för just den.' },
  { title: '3. Importera bokföringen', body: 'Under Inställningar → Data läser du in SIE4-filen: konton, verifikationer och ingående balanser. Du får granska kontomappningen och en förhandsgranskning, ingenting bokförs innan du bekräftar.' },
  { title: '4. Du är aldrig inlåst igen', body: 'Bokix kan exportera hela din bokföring som en riktig SIE4-fil när du vill, samma öppna standardformat som resten av branschen använder, om du någonsin skulle vilja flytta vidare.' },
];

const FAQ = [
  { q: 'Kan jag flytta min bokföring från Fortnox, Bokio eller Spiris till Bokix?', a: 'Ja. Exportera en SIE4-fil ur programmet du använder idag och läs in den i Bokix under Inställningar → Data. Konton, verifikationer och ingående balanser följer med. Kundregister, öppna fakturor och kvittobilder gör det inte, det ligger inte i SIE-formatet. Spara ändå det gamla systemets underlag: bokföringslagen kräver sju års arkivering oavsett program.' },
  { q: 'Vad kostar Bokix jämfört med andra bokföringsprogram?', a: 'Bokix kostar 129 kr/mån utan anställda och 179 kr/mån med lönemodulen, allt ingår. Vi anger medvetet inga priser för andra program här, de ändras, och vi kan inte verifiera dem. Jämför gärna själv direkt mot leverantörens egen prissida.' },
  { q: 'Har Bokix bindningstid eller uppsägningstid?', a: 'Månadsplanen har varken bindningstid eller uppsägningstid — du avslutar när du vill. Årsplanen, som har ett lägre månadspris, gäller i minst tre månader. De första 30 dagarna kostar ingenting alls om du avslutar innan dess.' },
  { q: 'Stöder Bokix samma bolagsformer som andra bokföringsprogram?', a: 'Bokix stöder enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening, och bokför enligt rätt regler för respektive form utifrån organisationsnumret.' },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '20px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: '15px', fontWeight: 700, color: INK }}>{q}</span>
        <ChevronDown size={18} color={MUTED} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <div style={{ maxHeight: open ? '300px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.65, padding: '0 4px 20px', margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

export default function AlternativePage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });

  // Article-schema, samma mönster/motivering som ChooseSoftwareGuidePage.jsx
  // (Organization som author/publisher, aldrig en påhittad namngiven
  // "expert" — se den filens egen kommentar för hela resonemanget).
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Alternativ till Fortnox, Bokio och Spiris: jämför bokföringsprogram',
    description: 'En ärlig guide för dig som funderar på att byta bokföringsprogram: vad Bokix faktiskt erbjuder, hur bytet går till, och vanliga frågor.',
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
    mainEntityOfPage: `${SITE_URL}/alternativ`,
  };

  return (
    <MarketingLayout>
      <PageMeta
        title="Alternativ till Fortnox, Bokio och Spiris | Bokix"
        description="Funderar du på att byta bokföringsprogram från Fortnox, Bokio eller Spiris? Se vad Bokix erbjuder, hur bytet går till, och vanliga frågor, ärligt, inga påhittade jämförelser."
        path="/alternativ"
        type="article"
      />
      <JsonLd data={articleSchema} />
      <JsonLd data={FAQ_SCHEMA} />

      <section style={{ padding: '150px 24px 70px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '18px', lineHeight: 1.16 }}>
            Alternativ till Fortnox, Bokio och Spiris
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7 }}>
            Funderar du på att byta bokföringsprogram? Här är vad Bokix faktiskt erbjuder, hur bytet går till rent praktiskt, och svar på vanliga frågor. Inga gissade siffror om andra leverantörer, bara verifierbara fakta om Bokix.
          </p>
        </Reveal>
      </section>

      {/* ── Bokix egna, verifierbara svar ── */}
      <section style={{ padding: '10px 24px 30px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>Så svarar Bokix</h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '540px', margin: '0 auto' }}>
              Vill du ha en fullständig checklista för vad som spelar roll oavsett program? Se <Link to="/valja-bokforingsprogram" style={{ color: BRAND.greenDark, fontWeight: 600 }}>Så väljer du bokföringsprogram</Link>.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
            {BOKIX_ANSWERS.map((c, i) => {
              const accent = ACCENT_CYCLE[i % 3];
              return (
                <Reveal key={c.title} delay={i * 60} className="lp-card-hover" style={{
                  background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px',
                  padding: '24px 26px', boxShadow: CARD_SHADOW,
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: '10px', background: accent.soft, color: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                    <c.icon size={18} />
                  </div>
                  <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{c.title}</h3>
                  <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.65, margin: 0 }}>{c.body}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Så byter du ── */}
      <section style={{ padding: '50px 24px', background: IVORY }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '12px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, marginBottom: '16px' }}>
              <FileDown size={20} color={BRAND.greenDark} />
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>Så byter du till Bokix</h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '520px', margin: '0 auto', lineHeight: 1.65 }}>
              Kortversionen. Vill du ha hela guiden, med var SIE-exporten ligger i just ditt program, se <Link to="/byt-bokforingsprogram" style={{ color: BRAND.greenDark, fontWeight: 600 }}>Byt till Bokix</Link>.
            </p>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {SWITCH_STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 60} style={{
                display: 'flex', gap: '16px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`,
                borderRadius: '14px', padding: '18px 22px', boxShadow: CARD_SHADOW,
              }}>
                <div>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: INK, margin: '0 0 6px' }}>{s.title}</h3>
                  <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.6, margin: 0 }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '80px 24px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '12px', background: IVORY, border: `1px solid ${CARD_BORDER}`, marginBottom: '16px' }}>
              <ListChecks size={20} color={BRAND.greenDark} />
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>Vanliga frågor</h2>
          </Reveal>
          <Reveal delay={100} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '8px 24px', boxShadow: '0 1px 3px rgba(28,36,32,0.05)' }}>
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </Reveal>
        </div>
      </section>

      <section style={{ padding: '10px 24px 100px', background: 'var(--mkt-page-bg)', textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
            Redo att testa?
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, marginBottom: '28px', lineHeight: 1.65 }}>
            30 dagar att testa med din egen bokföring innan något kostar något, ingen bindningstid på månadsplanen.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={enterApp} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>Prova gratis</button>
            <Link to="/priser" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Se prissättning <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
