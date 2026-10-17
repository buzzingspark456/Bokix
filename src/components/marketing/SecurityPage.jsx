import React from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, MUTED } from './marketingTokens';
import SecurityFlow from './SecurityFlow';
import SecurityCheck from './SecurityCheck';
import DemoPlayer, { DemoStyles, PlayOnView } from './DemoPlayer';
import { makeSecurityDemo } from './demoScenesOther';
import { KitStyles, SubHero, KitSection, CenterSection, PointList, KitCta, PrimaryButton, GhostLink, ProductShots } from './subpageKit';
import { shotsFor } from '../../content/marketing/screenshots';
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
  { title: 'Krypterad hela vägen', body: 'HTTPS överallt, och webbläsaren tvingas minnas det. Data i databasen är krypterad i vila.' },
  { title: 'Tvåfaktor med autentiseringsapp', body: 'TOTP när du vill ha det. Lösenordsbyte kräver dessutom en engångskod på mejlen.' },
  { title: 'Sessionen dör med fliken', body: 'Inloggningen ligger inte kvar på enheten. Bokföring öppnas ofta på lånade datorer.' },
  { title: 'Inbjudan, inte gissad URL', body: 'Högst tre användare per företag, via engångslänk. Behörigheten kontrolleras i databasen.' },
  // Se PrivacyPolicy avsnitt 4 och 5: LAGRING, inte behandling. Serverfunktionerna
  // hos Vercel kör utanför EU tills vercel.json får en regions-inställning.
  { title: 'Lagras inom EU', body: 'Databasen och dina kvitton ligger i ett datacenter i Frankfurt, Tyskland.' },
  { title: 'Ingen inlåsning', body: 'Hela bokföringen ut som SIE4 när du vill. Du behöver inte fråga oss om lov.' },
];

// Gallringen som tre tal i stället för tre stycken. Talet är det som
// betyder något; meningen under är bara vad talet gäller.
const SECURITY_DEMO = makeSecurityDemo(FACTS);

const CLOCKS = [
  { n: '7', unit: 'dagar', body: 'Uppladdade filer som ingen post längre pekar på städas bort av ett nattligt jobb.' },
  { n: '30', unit: 'dagar', body: 'Ett konto som skapades men aldrig aktiverades raderas, med alla uppgifter som hunnit fyllas i.' },
  { n: '7', unit: 'år', body: 'Bokföringen sparas, för det kräver lagen, även om du säger upp abonnemanget.' },
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
  name: 'Säkerhet: så skyddar vi din bokföring | Bokix',
  url: `${SITE_URL}/sakerhet`,
  inLanguage: 'sv-SE',
  description: 'Hur Bokix skyddar din bokföring: åtkomstkontroll på databasnivå, kryptering, tvåfaktorsautentisering, automatisk gallring och dataportabilitet.',
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
};

export default function SecurityPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });

  return (
    <MarketingLayout>
      <PageMeta
        title="Säkerhet: så skyddar vi din bokföring | Bokix"
        description="Hur Bokix skyddar din bokföring: åtkomstkontroll i själva databasen, kryptering, tvåfaktorsautentisering, automatisk gallring och hur du får ut allt du lagt in."
        path="/sakerhet"
      />
      <JsonLd data={SCHEMA} />
      <KitStyles />
      <DemoStyles />
      <style>{`
        .bx-sec-clocks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--mkt-border-soft); }
        .bx-sec-clock { padding: 26px 22px 26px 0; }
        .bx-sec-clock + .bx-sec-clock { border-left: 1px solid var(--mkt-border-soft); padding-left: 22px; }
        @media (max-width: 620px) {
          .bx-sec-clocks { grid-template-columns: 1fr; }
          .bx-sec-clock { padding: 20px 0; border-bottom: 1px solid var(--mkt-border-soft); }
          .bx-sec-clock + .bx-sec-clock { border-left: none; padding-left: 0; }
        }
      `}</style>

      <SubHero
        eyebrow="Säkerhet"
        title="Ingen annan kommer åt din bokföring"
        lead="Inte för att vi lovar det. För att databasen är byggd så: varje fråga bär din identitet, och databasen släpper bara igenom ditt eget företags rader."
        actions={<>
          <PrimaryButton onClick={enterApp}>Prova gratis</PrimaryButton>
          <GhostLink to="/privacy">Integritetspolicy</GhostLink>
        </>}
        visual={<SecurityCheck />}
      />

      <ProductShots shots={shotsFor('/sakerhet')} title="Säkerhetsinställningarna i Bokix" />

      {/* ── Mekanismen, inte adjektiven ── */}
      <section className="kx-section" style={{ background: 'var(--mkt-ivory)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '34px' }}>
            <h2 className="kx-h2">Så fungerar skyddet</h2>
            <p className="kx-sub">Klicka dig igenom vad som händer när du öppnar dina fakturor.</p>
          </Reveal>
          <Reveal scale delay={60}>
            <SecurityFlow />
          </Reveal>
        </div>
      </section>

      <CenterSection title="Och sex saker till" lead="En i taget. Det som inte går att visa här står i integritetspolicyn.">
        <DemoPlayer steps={SECURITY_DEMO} stepMs={4800} label="Demo: sex säkerhetsfunktioner i Bokix" />
      </CenterSection>

      <KitSection title="Vad som ligger kvar, och hur länge" lead="Bokföringen måste sparas. Allt annat ska bort av sig självt." alt>
        <PlayOnView minHeight={160}>
          <div className="bx-sec-clocks">
            {CLOCKS.map((c, i) => (
              <div key={c.body} className="bx-sec-clock">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: '12px' }}>
                  <span className="dp-pop" style={{ '--d': `${0.2 + i * 0.35}s`, fontFamily: SERIF, fontSize: 'clamp(40px, 5vw, 52px)', fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: '-0.02em' }}>{c.n}</span>
                  <span className="dp-in" style={{ '--d': `${0.4 + i * 0.35}s`, fontSize: '15px', fontWeight: 700, color: MUTED }}>{c.unit}</span>
                </div>
                <div style={{ height: 3, borderRadius: 3, background: 'var(--mkt-border-soft)', overflow: 'hidden', marginBottom: '12px' }}>
                  <div className="dp-grow" style={{ '--d': `${0.5 + i * 0.35}s`, '--t': '1.6s', height: '100%', background: 'var(--mkt-accent-green-fg)' }} />
                </div>
                <p className="kx-row-body" style={{ fontSize: '14px' }}>{c.body}</p>
              </div>
            ))}
          </div>
        </PlayOnView>
      </KitSection>

      <KitSection title="Rutiner" lead="Det som skyddar sajten och dina filer, utan att du behöver göra något.">
        <PointList items={PRACTICES} />
      </KitSection>

      <KitCta title="Hittat något som ser fel ut?" lead={<>Mejla <a href="mailto:support@bokix.se" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>support@bokix.se</a> med stegen för att återskapa det. Vi svarar på varje rapport. Kontaktvägen finns också i <a href="/security.txt" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>security.txt</a>.</>}>
        <PrimaryButton onClick={enterApp}>Prova gratis</PrimaryButton>
        <GhostLink to="/pub">PUB-avtal</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
