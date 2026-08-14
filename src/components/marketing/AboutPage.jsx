import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Eye, Layers, ArrowRight, Sparkles } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';

// Genuina, konkreta principer — inte påhittade grundare-citat eller en
// uppdiktad företagshistoria vi inte har.
const PRINCIPLES = [
  {
    icon: Eye, title: 'Aldrig påhittade siffror',
    desc: 'En ny bokföring i Bokix visar 0 kr tills du faktiskt bokfört något — aldrig en snygg exempel-graf som ser ut som riktig data men inte är det.',
  },
  {
    icon: ShieldCheck, title: 'Bokföring du kan lita på',
    desc: 'Det som kan bokföras automatiskt bokförs automatiskt. Det som är osäkert läggs i Granskning för en snabb bekräftelse — aldrig en tyst gissning.',
  },
  {
    icon: Layers, title: 'En funktion i taget, klar hela vägen',
    desc: 'Vi bygger hellre färre funktioner som fungerar fullt ut än många halvfärdiga. Om något inte är klart säger vi det, istället för att låtsas.',
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      <style>{`
        @keyframes aboutOrbDrift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-26px,20px) scale(1.1); } }
        @keyframes aboutOrbDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(22px,-18px) scale(1.06); } }
        .about-orb-1 { animation: aboutOrbDrift1 10s ease-in-out infinite; }
        .about-orb-2 { animation: aboutOrbDrift2 12.5s ease-in-out infinite; }
        .about-principle-card { position: relative; }
        .about-principle-card:hover { border-color: transparent !important; box-shadow: 0 20px 45px -20px rgba(61,122,46,0.35) !important; }
      `}</style>

      <section style={{ padding: '150px 24px 90px', background: `linear-gradient(160deg, #f8fffe 0%, ${BRAND.greenLight}44 60%, white 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div className="about-orb-1" style={{ position: 'absolute', top: '-50px', left: '10%', width: '260px', height: '260px', borderRadius: '50%', background: `radial-gradient(circle, ${BRAND.greenLight}bb 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div className="about-orb-2" style={{ position: 'absolute', top: '15%', right: '8%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '999px', background: 'white', border: `1px solid ${BRAND.green}33`, fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '20px', boxShadow: '0 4px 14px -4px rgba(61,122,46,0.2)' }}>
            <Sparkles size={13} /> Varför Bokix finns
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '18px', lineHeight: 1.1 }}>
            Om oss
          </h1>
          <p style={{ fontSize: '17px', color: '#475569', lineHeight: 1.75 }}>
            Bokix byggs för svenska småföretagare som vill lägga sin tid på verksamheten, inte på pappersarbete. Vi tror att bokföring, fakturering och lön kan vara enkelt utan att bli otydligt.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '20px 24px 100px', background: 'white' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 100} className="lp-card-hover about-principle-card" style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '13px', background: `linear-gradient(155deg, ${BRAND.green} 0%, #142a1f 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -6px rgba(61,122,46,0.45)' }}>
                  <p.icon size={22} color="white" />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#cbd5e1' }}>0{i + 1}</span>
              </div>
              <h2 style={{ fontSize: '16.5px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>{p.title}</h2>
              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.65, margin: 0 }}>{p.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 24px 100px', background: '#f8fafc' }}>
        <Reveal scale style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ background: `linear-gradient(155deg, ${BRAND.green} 0%, #142a1f 100%)`, borderRadius: '24px', padding: '52px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-70px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(150,255,140,0.16) 0%, transparent 70%)' }} />
            <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 900, letterSpacing: '-0.02em', color: 'white', marginBottom: '12px', position: 'relative' }}>
              Frågor om Bokix?
            </h2>
            <p style={{ fontSize: '14.5px', color: 'rgba(255,255,255,0.65)', marginBottom: '24px', position: 'relative' }}>
              Vi svarar själva — inget säljteam, inga formulär du behöver vänta på.
            </p>
            <Link to="/kontakt" className="lp-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 24px', borderRadius: '11px', background: 'white', fontSize: '14.5px', fontWeight: 700, color: BRAND.greenDark, textDecoration: 'none', position: 'relative' }}>
              Hör av dig <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
