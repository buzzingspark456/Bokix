import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, KeyRound, Database, Lock, FileDown, Users, Server, Bug, FileX, Trash2, UserMinus } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, CARD_SHADOW_SM, ACCENT, ACCENT_CYCLE } from './marketingTokens';
import { AuroraLayer } from './aurora';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── Säkerhet och datahantering (/sakerhet) ──────────────────────────────
// Sidan en företagare (eller deras revisor) letar efter innan de lägger in
// hela sin bokföring hos en leverantör de inte hört talas om förut. Den
// juridiska texten finns redan i /privacy och /pub — den här sidan
// förklarar det TEKNISKA med ord en icke-tekniker kan bedöma.
//
// Absolut regel: varje påstående nedan motsvarar något som faktiskt finns
// i kodbasen eller i konfigurationen (RLS-policyer i supabase-setup.sql,
// säkerhetsrubriker i vercel.json, TOTP via supabase.auth.mfa i
// Settings.jsx, sessionStorage-valet i supabaseClient.js, eSKD/SIE-export
// i utils/). Ett säkerhetslöfte som inte går att peka ut i koden är värre
// än inget löfte alls — det är exakt den sortens sida en granskare
// faktiskt kontrollerar.

const PILLARS = [
  {
    icon: Lock,
    title: 'Krypterad hela vägen',
    body: 'All trafik går över HTTPS, och webbläsaren tvingas komma ihåg det (HSTS) så att en länk aldrig kan öppnas okrypterat. Data i databasen är krypterad i vila hos vår driftleverantör.',
  },
  {
    icon: Database,
    title: 'Din data är avgränsad i databasen',
    body: 'Åtkomsten styrs av regler i själva databasen (Row Level Security), inte bara av kod i webbläsaren. Ett anrop som försöker läsa någon annans rader får inget svar — även om appen skulle ha en bugg.',
  },
  {
    icon: KeyRound,
    title: 'Tvåfaktorsautentisering',
    body: 'Du kan slå på TOTP-baserad tvåfaktorsautentisering med valfri autentiseringsapp. Känsliga ändringar, som byte av lösenord, kräver dessutom en engångskod skickad till din registrerade e-postadress.',
  },
  {
    icon: Server,
    title: 'Sessionen dör när fliken gör det',
    body: 'Inloggningen sparas bara så länge webbläsarfliken är öppen, inte permanent på enheten. Stänger du webbläsaren måste du logga in igen — medvetet valt, eftersom bokföring ofta öppnas på delade eller lånade datorer.',
  },
  {
    icon: Users,
    title: 'Högst tre användare per företag',
    body: 'Inbjudningar sker per företag med en engångslänk, och behörigheten kontrolleras på databasnivå. Ingen kommer in i ditt företag genom att bara känna till en URL.',
  },
  {
    icon: FileDown,
    title: 'Ingen inlåsning',
    body: 'Hela bokföringen kan när som helst exporteras som SIE4-fil, och rapporter som PDF och CSV. Du behöver aldrig fråga oss om lov för att ta med dig din data någon annanstans.',
  },
];

const RETENTION = [
  {
    icon: FileX,
    title: 'Bankfiler lagras aldrig',
    body: 'En importerad CSV- eller Excel-fil läses i din egen webbläsare och kastas när fliken stängs. Det som sparas är de bokförda transaktionsraderna — aldrig själva filen.',
  },
  {
    icon: Trash2,
    title: 'Föräldralösa filer städas efter 7 dagar',
    body: 'Ett nattligt jobb tar bort uppladdade kvitton och underlag som ingen post längre pekar på. Jämförelsen sker inom ditt eget filutrymme, så städningen kan aldrig nå någon annans filer.',
  },
  {
    icon: UserMinus,
    title: 'Påbörjade konton raderas efter 30 dagar',
    body: 'Ett konto som skapades men aldrig aktiverades tas bort automatiskt. Namn, mejladress och företagsuppgifter blir inte liggande utan ändamål.',
  },
];

const PRACTICES = [
  {
    title: 'Säkerhetsrubriker på varje svar',
    body: 'X-Content-Type-Options, Referrer-Policy, Permissions-Policy och HSTS är satta på varje svar, och kamera, mikrofon och platsdata är avstängda för sajten. Appen kan heller inte bäddas in i en främmande sajt, vilket stänger dörren för klickkapning. En innehållssäkerhetspolicy (CSP) körs i granskningsläge inför att den slås på skarpt.',
  },
  {
    title: 'Skydd mot automatiserad registrering',
    body: 'Registrering och kontaktformulär skyddas av botdetektering, och e-postadressen verifieras med en engångskod innan kontot kan användas.',
  },
  {
    title: 'Bokföringsdata sparas i sju år',
    body: 'Bokföringslagen kräver att verifikationer arkiveras i minst sju år efter räkenskapsårets utgång. Det gäller även om du säger upp abonnemanget — vi kan alltså inte radera allt på begäran, och det står också i integritetspolicyn.',
  },
  {
    title: 'Personuppgiftsbiträdesavtal ingår',
    body: 'Bokix behandlar personuppgifter (dina kunder, dina anställda) för din räkning. Ett PUB-avtal enligt GDPR artikel 28 gäller automatiskt för alla konton och finns att läsa i sin helhet.',
  },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Säkerhet och datahantering — Bokix',
  url: `${SITE_URL}/sakerhet`,
  inLanguage: 'sv-SE',
  description: 'Hur Bokix skyddar din bokföring: kryptering, åtkomstkontroll på databasnivå, tvåfaktorsautentisering, automatisk gallring och dataportabilitet.',
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
};

export default function SecurityPage() {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <PageMeta
        title="Säkerhet och datahantering | Bokix"
        description="Hur Bokix skyddar din bokföring: kryptering, åtkomstkontroll på databasnivå, tvåfaktorsautentisering, automatisk gallring av data och hur du får ut allt du lagt in."
        path="/sakerhet"
      />
      <JsonLd data={SCHEMA} />
      <style>{`
        .bx-sec-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .bx-sec-two { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media (max-width: 980px) { .bx-sec-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px) { .bx-sec-grid, .bx-sec-two { grid-template-columns: 1fr; } }
      `}</style>

      <section style={{ padding: '150px 24px 56px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer stops={[['rgba(20,184,166,0.16)', '4% -8%'], ['rgba(14,165,233,0.12)', '97% 105%']]} />
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ width: 56, height: 56, borderRadius: '16px', background: ACCENT.teal.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <ShieldCheck size={26} color={ACCENT.teal.fg} />
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.6vw, 48px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.15 }}>
            Säkerhet och datahantering
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.7, margin: 0 }}>
            Din bokföring är bland det känsligaste ett företag har. Här står vad vi faktiskt gör för att skydda den — utan svepande formuleringar om "bankstandard".
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <div className="bx-sec-grid" style={{ maxWidth: '960px', margin: '0 auto' }}>
          {PILLARS.map((p, i) => {
            const accent = ACCENT_CYCLE[i % 3];
            return (
              <Reveal key={p.title} delay={i * 50} className="lp-card-hover" style={{
                background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px',
                padding: '22px 24px', boxShadow: CARD_SHADOW_SM,
              }}>
                <span style={{ width: 36, height: 36, borderRadius: '10px', background: accent.soft, color: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <p.icon size={17} />
                </span>
                <h2 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: '0 0 7px', letterSpacing: '-0.005em' }}>{p.title}</h2>
                <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{p.body}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Vad som städas bort ── */}
      <section style={{ padding: '70px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: INK, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Data som inte behövs blir inte kvar
          </h2>
          <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.7, margin: '0 0 24px', maxWidth: '640px' }}>
            Din bokföring måste sparas i sju år enligt lag. Allt <em>annat</em> gäller det motsatta för — det ska inte ligga kvar
            längre än det behövs. Därför städar Bokix bort det automatiskt i stället för att vänta på att någon ber om det.
          </p>
          <div className="bx-sec-grid">
            {RETENTION.map((r, i) => {
              const accent = ACCENT_CYCLE[i % 3];
              return (
                <div key={r.title} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '20px 22px' }}>
                  <span style={{ width: 34, height: 34, borderRadius: '10px', background: accent.soft, color: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '13px' }}>
                    <r.icon size={16} />
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: '0 0 7px' }}>{r.title}</h3>
                  <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{r.body}</p>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* ── Rutiner ── */}
      <section style={{ padding: '70px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: INK, margin: '0 0 24px', letterSpacing: '-0.01em' }}>
            Rutiner och regelverk
          </h2>
          <div className="bx-sec-two">
            {PRACTICES.map(p => (
              <div key={p.title} style={{ background: IVORY, border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '20px 22px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: '0 0 7px' }}>{p.title}</h3>
                <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{p.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Rapportera en brist ── */}
      <section style={{ padding: '70px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '960px', margin: '0 auto', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', padding: 'clamp(24px, 4vw, 36px)', boxShadow: CARD_SHADOW, display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span style={{ width: 42, height: 42, borderRadius: '12px', background: ACCENT.red.soft, color: ACCENT.red.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bug size={19} />
          </span>
          <div style={{ flex: '1 1 340px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: INK, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Hittat en säkerhetsbrist?</h2>
            <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.7, margin: '0 0 12px' }}>
              Mejla <a href="mailto:support@bokix.se" style={{ color: BRAND.greenDark, fontWeight: 600 }}>support@bokix.se</a> med beskrivning och stegen för att återskapa problemet.
              Vi svarar på alla rapporter och åtgärdar det som är verifierat. Vi driver ingen bug bounty i dag — det är ingen inbjudan att låta bli att höra av sig, bara ärligt om vad vi kan erbjuda.
            </p>
            <p style={{ fontSize: '13px', color: MUTED, margin: 0 }}>
              Kontaktuppgifterna finns också maskinläsbart i <a href="/security.txt" style={{ color: BRAND.greenDark, fontWeight: 600 }}>security.txt</a> enligt RFC 9116.
            </p>
          </div>
        </Reveal>
      </section>

      <section style={{ padding: '70px 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '960px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3.2vw, 30px)', fontWeight: 700, color: INK, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
            Vill du läsa det juridiska?
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, lineHeight: 1.7, margin: '0 auto 26px', maxWidth: '520px' }}>
            Integritetspolicyn beskriver exakt vilka uppgifter som behandlas, varför, och vilka leverantörer som driftar tjänsten åt oss.
            PUB-avtalet reglerar vårt ansvar när vi behandlar personuppgifter åt dig.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/privacy" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Integritetspolicy <ArrowRight size={15} />
            </Link>
            <Link to="/pub" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              PUB-avtal <ArrowRight size={15} />
            </Link>
            <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis
            </button>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
