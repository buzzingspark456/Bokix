import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Lock, FileDown, Users, Server, Globe, Check } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import SecurityFlow from './SecurityFlow';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── Säkerhet och datahantering (/sakerhet) ──────────────────────────────
// Sidan en företagare (eller deras revisor) letar efter innan de lägger in
// hela sin bokföring hos en leverantör de inte hört talas om förut.
//
// Absolut regel: varje påstående nedan motsvarar något som faktiskt finns
// i kodbasen eller i konfigurationen (RLS-policyer i supabase-setup.sql,
// säkerhetsrubriker i vercel.json, TOTP via supabase.auth.mfa i
// Settings.jsx, sessionStorage-valet i supabaseClient.js, eSKD/SIE-export
// i utils/). Ett säkerhetslöfte som inte går att peka ut i koden är värre
// än inget löfte alls — det är exakt den sortens sida en granskare
// faktiskt kontrollerar.
//
// OMSKRIVEN EFTER KUNDFEEDBACK, ordagrant i sak: "för mycket förklarande".
// Den gamla versionen var femton kort i rad, vart och ett ett stycke
// brödtext — femton stycken om säkerhet läser ingen, och den som ändå gör
// det minns inget av dem. Sidan är därför byggd om efter samma princip som
// /uf och /koppla-bank: EN sak visas i rörelse (SecurityFlow — hur
// radnivåskyddet faktiskt fungerar), resten är korta rader man kan skumma.
// Ingen faktapunkt är borttagen, de är bara nedkokade från stycke till
// mening. Lägg inte tillbaka brödtexten.

// En rad var. Klarar det inte att sägas på en rad hör det hemma i
// integritetspolicyn, inte här.
const FACTS = [
  { icon: Lock, title: 'Krypterad hela vägen', body: 'HTTPS överallt, och webbläsaren tvingas minnas det. Data i databasen är krypterad i vila.' },
  { icon: KeyRound, title: 'Tvåfaktor med autentiseringsapp', body: 'TOTP när du vill ha det. Lösenordsbyte kräver dessutom en engångskod på mejlen.' },
  { icon: Server, title: 'Sessionen dör med fliken', body: 'Inloggningen ligger inte kvar på enheten. Bokföring öppnas ofta på lånade datorer.' },
  { icon: Users, title: 'Inbjudan, inte gissad URL', body: 'Högst tre användare per företag, via engångslänk. Behörigheten kontrolleras i databasen.' },
  // Se PrivacyPolicy avsnitt 4 och 5: LAGRING, inte behandling. Serverfunktionerna
  // hos Vercel kör utanför EU tills vercel.json får en regions-inställning.
  { icon: Globe, title: 'Lagras inom EU', body: 'Databasen och dina kvitton ligger i ett datacenter i Frankfurt, Tyskland.' },
  { icon: FileDown, title: 'Ingen inlåsning', body: 'Hela bokföringen ut som SIE4 när du vill. Du behöver inte fråga oss om lov.' },
];

// Gallringen som tre tal i stället för tre stycken. Talet är det som
// betyder något; meningen under är bara vad talet gäller.
const CLOCKS = [
  { n: '7', unit: 'dagar', body: 'Uppladdade filer som ingen post längre pekar på städas bort av ett nattligt jobb.' },
  { n: '30', unit: 'dagar', body: 'Ett konto som skapades men aldrig aktiverades raderas, med alla uppgifter som hunnit fyllas i.' },
  { n: '7', unit: 'år', body: 'Bokföringen sparas, för det kräver lagen — även om du säger upp abonnemanget.' },
];

// Rutinerna: korta rader med bock, inte fyra stycken brödtext.
const PRACTICES = [
  'Säkerhetsrubriker på varje svar, och sajten kan inte bäddas in någon annanstans',
  'Kamera, mikrofon och platsdata är avstängda för hela sajten',
  'Botskydd på registrering och kontaktformulär, plus verifierad e-postadress',
  'Bankfiler du importerar läses i webbläsaren och sparas aldrig',
  'PUB-avtal enligt GDPR artikel 28 gäller automatiskt för alla konton',
  'Separata, begränsade nycklar per funktion i stället för en allomfattande',
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Säkerhet och datahantering — Bokix',
  url: `${SITE_URL}/sakerhet`,
  inLanguage: 'sv-SE',
  description: 'Hur Bokix skyddar din bokföring: åtkomstkontroll på databasnivå, kryptering, tvåfaktorsautentisering, automatisk gallring och dataportabilitet.',
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
};

export default function SecurityPage() {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <PageMeta
        title="Säkerhet och datahantering | Bokix"
        description="Hur Bokix skyddar din bokföring: åtkomstkontroll i själva databasen, kryptering, tvåfaktorsautentisering, automatisk gallring och hur du får ut allt du lagt in."
        path="/sakerhet"
      />
      <JsonLd data={SCHEMA} />
      <style>{`
        .bx-sec-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .bx-sec-clocks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .bx-sec-checks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 11px 26px; }
        @media (max-width: 900px) { .bx-sec-facts { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px) {
          .bx-sec-facts, .bx-sec-clocks, .bx-sec-checks { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Hjälte: ett påstående, en mening ── */}
      <section style={{ padding: '140px 24px 46px', background: IVORY }}>
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, marginBottom: '15px', lineHeight: 1.1 }}>
            Ingen annan kommer åt din bokföring
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.65, margin: 0 }}>
            Inte för att vi lovar det. För att databasen är byggd så.
          </p>
        </Reveal>
      </section>

      {/* ── Sidans huvudbild: mekanismen, inte adjektiven ── */}
      <section style={{ padding: '10px 24px 72px', background: IVORY }}>
        <Reveal scale style={{ maxWidth: '900px', margin: '0 auto' }}>
          <SecurityFlow />
        </Reveal>
      </section>

      {/* ── Sex rader, en mening var ── */}
      <section style={{ padding: '64px 24px', background: 'var(--mkt-page-bg)', borderTop: `1px solid var(--mkt-border-soft)` }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: 0 }}>
              Och sex saker till
            </h2>
          </Reveal>
          <div className="bx-sec-facts">
            {FACTS.map((f, i) => (
              <Reveal key={f.title} delay={i * 40} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '19px 20px', boxShadow: CARD_SHADOW }}>
                <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: '9px', background: ACCENT.teal.soft, color: ACCENT.teal.fg, alignItems: 'center', justifyContent: 'center', marginBottom: '11px' }}>
                  <f.icon size={16} />
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: '0 0 5px' }}>{f.title}</h3>
                <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{f.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gallringen som tre tal ── */}
      <section style={{ padding: '64px 24px', background: IVORY, borderTop: `1px solid var(--mkt-border-soft)` }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 9px' }}>
              Vad som ligger kvar, och hur länge
            </h2>
            <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.6, margin: 0 }}>
              Bokföringen måste sparas. Allt annat är motsatsen — det ska bort av sig självt.
            </p>
          </Reveal>
          <div className="bx-sec-clocks">
            {CLOCKS.map((c, i) => (
              <Reveal key={c.body} delay={i * 60} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px 22px', textAlign: 'center', boxShadow: CARD_SHADOW }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '7px', marginBottom: '10px' }}>
                  <span style={{ fontSize: 'clamp(38px, 6vw, 50px)', fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: '-0.03em' }}>{c.n}</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: MUTED }}>{c.unit}</span>
                </div>
                <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{c.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rutiner: en bock per rad ── */}
      <section style={{ padding: '64px 24px', background: 'var(--mkt-page-bg)', borderTop: `1px solid var(--mkt-border-soft)` }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Reveal style={{ marginBottom: '24px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: 0 }}>
              Rutiner
            </h2>
          </Reveal>
          <Reveal delay={60} className="bx-sec-checks">
            {PRACTICES.map(row => (
              <div key={row} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '14px', color: INK_SOFT, lineHeight: 1.6 }}>
                <Check size={16} color={BRAND.green} style={{ flexShrink: 0, marginTop: '3px' }} /> {row}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Avslutning: hittat en brist, och det juridiska — en sektion, inte tre ── */}
      <section style={{ padding: '64px 24px 100px', background: IVORY, borderTop: `1px solid var(--mkt-border-soft)` }}>
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 29px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 11px' }}>
            Hittat något som ser fel ut?
          </h2>
          <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.65, margin: '0 0 26px' }}>
            Mejla <a href="mailto:support@bokix.se" style={{ color: BRAND.greenDark, fontWeight: 600 }}>support@bokix.se</a> med stegen för att återskapa det. Vi svarar på varje rapport. Kontaktvägen finns också i <a href="/security.txt" style={{ color: BRAND.greenDark, fontWeight: 600 }}>security.txt</a>.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/privacy" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '13px 22px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '14.5px', textDecoration: 'none' }}>
              Integritetspolicy <ArrowRight size={15} />
            </Link>
            <Link to="/pub" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '13px 22px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '14.5px', textDecoration: 'none' }}>
              PUB-avtal <ArrowRight size={15} />
            </Link>
            <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ padding: '13px 26px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis
            </button>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
