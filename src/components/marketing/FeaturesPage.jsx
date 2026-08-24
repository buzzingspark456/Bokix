import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { IllBokforing, IllFakturering, IllSkatt, IllPersonal } from './featureIllustrations';
import { ROUTE_META } from './routeMeta';

// Fördjupad version av startsidans fyra kolumner — samma fyra riktiga
// huvudsektioner (se globala sidomenyn i App.jsx), nu med de faktiska
// delfunktionerna under varje, inte bara en rad sammanfattning. Samma
// handritade illustrationer och accentfärger som Startsidans funktionskort
// (se marketingTokens.js/featureIllustrations.jsx) — större här, eftersom
// den här sidan ÄR funktionerna, inte en teaser till dem.
const SECTIONS = [
  {
    art: IllBokforing, accentKey: 'green', title: 'Bokföring',
    desc: 'Löpande bokföring som sköter sig själv när den kan, och flaggar tydligt när den inte kan.',
    points: [
      'Verifikationer bokförs automatiskt utifrån kvitton, fakturor och lönekörningar',
      'Full kontoplan (BAS) med sökbara konton',
      'Granskning samlar allt som saknar kontering på ett ställe, aldrig gömt i en lista',
      'Låsning av räkenskapsår vid bokslut',
    ],
  },
  {
    art: IllFakturering, accentKey: 'blue', title: 'Fakturering',
    desc: 'Kund- och leverantörsfakturor i samma flöde, med ditt eget varumärke på fakturan.',
    points: [
      'Fyra fakturamallar (Klassisk, Kraftfull, Minimal, Rutnät) med egen logotyp och accentfärg',
      'Leverantörsfakturor registreras snabbt och bokförs automatiskt när konto är valt',
      'Kortbetalningar direkt på fakturan via Stripe',
      'PDF-export som alltid matchar exakt det du ser i förhandsvisningen',
    ],
  },
  {
    art: IllSkatt, accentKey: 'red', title: 'Skatt och bokslut',
    desc: 'Det som faktiskt ska in rätt hos Skatteverket, förberett åt dig men aldrig skickat automatiskt utan din signatur.',
    points: [
      'Momsdeklaration som PDF, redo att fylla i på skatteverket.se',
      'AGI-sammanställning per lönekörning',
      'Kontrolluppgifter (KU) sammanställda per anställd och år',
      'Ett bokslutsflöde som stämmer av och låser räkenskapsåret',
    ],
  },
  {
    art: IllPersonal, accentKey: 'green', title: 'Personal',
    desc: 'Lönekörning med rätt skatteavdrag från start, inte en gissning som rättas i efterhand.',
    points: [
      'Automatiskt skatteavdrag enligt Skatteverkets skattetabeller',
      'Lönebesked som PDF per anställd',
      'Semesteravsättning och arbetsgivaravgifter beräknade per körning',
      'Flera anställda i samma lönekörning, en tydlig sammanställning för hela företaget',
    ],
  },
];

export default function FeaturesPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true } });
  return (
    <MarketingLayout {...ROUTE_META['/funktioner']} path="/funktioner">
      <section style={{ padding: '150px 24px 80px', background: IVORY }}>
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '18px', lineHeight: 1.14 }}>
            Allt du behöver, ingenting du inte behöver
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7 }}>
            Bokix är byggt kring fyra saker ett svenskt företag faktiskt gör varje månad, inte trettio funktioner ingen använder.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '20px 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {SECTIONS.map((s, i) => {
            const accent = ACCENT[s.accentKey];
            return (
              <Reveal key={s.title} delay={i * 80} className="lp-card-hover" style={{
                display: 'grid', gridTemplateColumns: '164px 1fr', gap: '28px', alignItems: 'stretch',
                background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', overflow: 'hidden',
                boxShadow: CARD_SHADOW,
              }}>
                <div style={{ background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                  <s.art accent={accent} />
                </div>
                <div style={{ padding: '32px 32px 32px 0' }}>
                  <h2 style={{ fontSize: '21px', fontWeight: 700, color: INK, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{s.title}</h2>
                  <p style={{ fontSize: '14.5px', color: MUTED, margin: '0 0 18px', lineHeight: 1.6 }}>{s.desc}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '9px 24px' }}>
                    {s.points.map(p => (
                      <div key={p} style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.55 }}>{p}</div>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: IVORY, textAlign: 'center' }}>
        <Reveal>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
            Ett pris, allt ovan ingår
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, marginBottom: '28px' }}>Inga tillägg per funktion. Se vad det kostar.</p>
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
