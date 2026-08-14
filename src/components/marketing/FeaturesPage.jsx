import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, BarChart3, Users, Shield, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';

// Fördjupad version av startsidans fyra kolumner — samma fyra riktiga
// huvudsektioner (se globala sidomenyn i App.jsx), nu med de faktiska
// delfunktionerna under varje, inte bara en rad sammanfattning.
const SECTIONS = [
  {
    icon: BarChart3, title: 'Bokföring',
    desc: 'Löpande bokföring som sköter sig själv när den kan, och flaggar tydligt när den inte kan.',
    points: [
      'Verifikationer bokförs automatiskt utifrån kvitton, fakturor och lönekörningar',
      'Full kontoplan (BAS) med sökbara konton',
      'Granskning samlar allt som saknar kontering på ett ställe — aldrig gömt i en lista',
      'Låsning av räkenskapsår vid bokslut',
    ],
  },
  {
    icon: FileText, title: 'Fakturering',
    desc: 'Kund- och leverantörsfakturor i samma flöde, med ditt eget varumärke på fakturan.',
    points: [
      'Fyra fakturamallar (Klassisk, Kraftfull, Minimal, Rutnät) med egen logotyp och accentfärg',
      'Leverantörsfakturor registreras snabbt och bokförs automatiskt när konto är valt',
      'Kortbetalningar direkt på fakturan via Stripe',
      'PDF-export som alltid matchar exakt det du ser i förhandsvisningen',
    ],
  },
  {
    icon: Shield, title: 'Skatt och bokslut',
    desc: 'Det som faktiskt ska in rätt hos Skatteverket, förberett åt dig — aldrig skickat automatiskt utan din signatur.',
    points: [
      'Momsdeklaration som PDF, redo att fylla i på skatteverket.se',
      'AGI-sammanställning per lönekörning',
      'Kontrolluppgifter (KU) sammanställda per anställd och år',
      'Ett bokslutsflöde som stämmer av och låser räkenskapsåret',
    ],
  },
  {
    icon: Users, title: 'Personal',
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
    <MarketingLayout>
      <section style={{ padding: '150px 24px 80px', background: `linear-gradient(160deg, #f8fffe 0%, ${BRAND.greenLight}44 60%, white 100%)` }}>
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '18px', lineHeight: 1.1 }}>
            Allt du behöver, ingenting du inte behöver
          </h1>
          <p style={{ fontSize: '17px', color: '#475569', lineHeight: 1.7 }}>
            Bokix är byggt kring fyra saker ett svenskt företag faktiskt gör varje månad — inte trettio funktioner ingen använder.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '20px 24px 100px', background: 'white' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {SECTIONS.map((s, i) => (
            <Reveal key={s.title} delay={i * 80} className="lp-card-hover" style={{
              display: 'grid', gridTemplateColumns: '64px 1fr', gap: '24px',
              background: 'white', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '32px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <div style={{ width: 56, height: 56, borderRadius: '16px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={26} color={BRAND.greenDark} />
              </div>
              <div>
                <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.01em' }}>{s.title}</h2>
                <p style={{ fontSize: '14.5px', color: '#64748b', margin: '0 0 18px', lineHeight: 1.6 }}>{s.desc}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                  {s.points.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                      <CheckCircle2 size={15} color={BRAND.green} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontSize: '13.5px', color: '#374151', lineHeight: 1.55 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: '#f8fafc', textAlign: 'center' }}>
        <Reveal>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '14px' }}>
            Ett pris, allt ovan ingår
          </h2>
          <p style={{ fontSize: '15.5px', color: '#64748b', marginBottom: '28px' }}>Inga tillägg per funktion — se vad det kostar.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={enterApp} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>Prova gratis</button>
            <Link to="/priser" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', color: '#374151', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Se prissättning <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
