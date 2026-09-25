import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Check, ArrowRight, FileText, Download, Landmark,
  ShieldCheck, Calculator, Sparkles, CheckCircle2
} from '../icons';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
import { GRAD, grad, AuroraLayer } from './aurora';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── Lön & Arbetsgivare (/lon) ──────────────────────────────────────────
// Sidan som förklarar lönehanteringen i Bokix:
// 1. Skatteverkets tabellskatt (1-38) automatiskt beräknat
// 2. Officiell AGI-fil (Arbetsgivardeklaration på individnivå) att ladda upp
// 3. Åldersanpassad arbetsgivaravgift (31,42% eller 10,21%)
// 4. Lönebesked som PDF till anställda
// 5. Betalfil till banken (ISO 20022 / pain.001)
// 6. Automatisk bokföring på rätt BAS-konton

const FEATURES = [
  {
    icon: Sparkles,
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    title: 'Automatisk tabellskatt',
    body: 'Skatteavdrag beräknas exakt enligt Skatteverkets officiella tabellskatter (tabell 29–40). Du väljer bara tabell och kolumn – Bokix sköter resten.',
  },
  {
    icon: FileText,
    color: '#6366f1',
    bgColor: 'rgba(99, 102, 241, 0.12)',
    title: 'AGI-fil till Skatteverket',
    body: 'Efter varje lönekörning får du en färdig AGI-fil (arbetsgivardeklaration på individnivå) i godkänt XML-format. Ladda upp direkt på skatteverket.se utan att knappa in siffror för hand.',
  },
  {
    icon: Landmark,
    color: '#0ea5e9',
    bgColor: 'rgba(14, 165, 233, 0.12)',
    title: 'Betalfil till banken (ISO 20022)',
    body: 'Ladda ner en ISO 20022 (pain.001) betalfil och läs in i din internetbank. Alla nettolöner betalas ut på samma dag med ett enda klick.',
  },
  {
    icon: Users,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    title: 'Åldersanpassad arbetsgivaravgift',
    body: 'Bokix läser födelseåret ur personnumret och sätter rätt arbetsgivaravgift automatiskt: full avgift (31,42%), pensionär/äldre (10,21%) eller ungdomsrabatt.',
  },
  {
    icon: Download,
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.12)',
    title: 'Lönebesked som PDF',
    body: 'Snygga, tydliga lönebesked med företagets logotyp, bruttolön, skatteavdrag, semesterdagar och nettolön. Redo att mejlas eller laddas ner med ett klick.',
  },
  {
    icon: ShieldCheck,
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.12)',
    title: 'Bokförs automatiskt i BAS',
    body: 'När du godkänner lönekörningen skapas verifikationen direkt: bruttolön (7010/7210), personalskatt (2710), arbetsgivaravgifter (2731/7510) och nettolön (1930/2820). Inga differenser.',
  },
];

const PAYROLL_FAQ = [
  {
    q: 'Ingår lönekörning i Bokix-abonnemanget?',
    a: 'Ja! Lönehantering med obegränsat antal anställda, skatteberäkning, AGI-fil och betalfil ingår i nivån med personal (179 kr/mån). Vi tar aldrig betalt per lönebesked eller per anställd.',
  },
  {
    q: 'Hur lämnas AGI (arbetsgivardeklarationen) in till Skatteverket?',
    a: 'Varje månad när du godkänner lönekörningen skapar Bokix en officiell AGI XML-fil. Du loggar in på skatteverket.se med ditt BankID och laddar upp filen direkt i e-tjänsten Arbetsgivardeklaration.',
  },
  {
    q: 'Fungerar betalfilen med min bank?',
    a: 'Ja. Bokix skapar bankstandarden ISO 20022 (pain.001) som stöds av alla svenska storbanker, inklusive Swedbank, SEB, Handelsbanken, Nordea, Danske Bank och Länsförsäkringar.',
  },
  {
    q: 'Kan jag räkna på vad en anställd kostar innan jag anställer?',
    a: 'Självklart! Du kan använda vår kostnadsfria lönekalkylator för att se exakt bruttolön, nettolön, arbetsgivaravgifter och total lönekostnad för företaget.',
  },
  {
    q: 'Hanteras semester och förmåner?',
    a: 'Ja. Du kan lägga till lönearter för fast månadslön, timlön, traktamente, bilförmån, milersättning och semesterersättning. Allt räknas med på rätt konto i bokföringen och i AGI-underlaget.',
  },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Lön & Arbetsgivare — Smidig lönekörning i Bokix',
  url: `${SITE_URL}/lon`,
  inLanguage: 'sv-SE',
  description: 'Komplett lönehantering för företag: tabellskatt, automatisk AGI-fil till Skatteverket, lönebesked som PDF, bankfil och automatisk bokföring.',
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
};

export default function PayrollPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });

  // Exempel-lön för interaktiv beräkningsdemo
  const [salaryInput, setSalaryInput] = useState(38000);
  const taxRate = 0.245; // ca 24.5% effektiv skatt vid 38k (tabell 31)
  const taxAmount = Math.round(salaryInput * taxRate);
  const netAmount = salaryInput - taxAmount;
  const employerTax = Math.round(salaryInput * 0.3142);
  const totalCost = salaryInput + employerTax;

  return (
    <MarketingLayout>
      <PageMeta
        title="Lön & Arbetsgivare — Smidig lönekörning | Bokix"
        description="Lönekörning med automatisk tabellskatt, AGI-fil till Skatteverket, lönebesked som PDF, ISO 20022 bankfil och automatisk bokföring på rätt BAS-konton."
        path="/lon"
      />
      <JsonLd data={SCHEMA} />

      <style>{`
        .bx-pay-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .bx-pay-split { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
        @media (max-width: 900px) {
          .bx-pay-grid { grid-template-columns: repeat(2, 1fr); }
          .bx-pay-split { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .bx-pay-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Hjälte ── */}
      <section style={{ padding: '140px 24px 64px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(139, 92, 246, 0.15)', '6% -6%'], ['rgba(16, 185, 129, 0.14)', '94% 104%']]}
          blob={{ gradient: grad(GRAD.blueTeal), top: '-140px', right: '-80px', size: '420px', opacity: 0.25 }}
        />
        <Reveal style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            color: '#7c3aed',
            fontSize: '12.5px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '20px',
          }}>
            <Users size={14} />
            Lön & Arbetsgivare
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5.2vw, 54px)', fontWeight: 700, letterSpacing: '-0.02em', color: INK, marginBottom: '18px', lineHeight: 1.12 }}>
            Lönekörning som sköter skatten, filerna och bokföringen
          </h1>
          <p style={{ fontSize: '18px', color: MUTED, lineHeight: 1.65, margin: '0 0 32px', maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto' }}>
            Kör lön med rätt tabellskatt, ladda upp den färdiga AGI-filen till Skatteverket och skicka betalfilen till din bank. Allt bokförs automatiskt på rätt konton.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={enterApp}
              className="lp-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 26px',
                borderRadius: '12px',
                background: BRAND.green,
                color: '#fff',
                fontWeight: 600,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Kom igång gratis
              <ArrowRight size={16} />
            </button>
            <Link
              to="/verktyg/lonekalkylator"
              className="lp-btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 24px',
                borderRadius: '12px',
                background: 'var(--mkt-card-bg)',
                color: INK,
                fontWeight: 600,
                fontSize: '15px',
                textDecoration: 'none',
                border: `1px solid ${CARD_BORDER}`,
              }}
            >
              <Calculator size={16} />
              Öppna lönekalkylatorn
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Interaktiv Löneberäknings-demonstration ── */}
      <section style={{ padding: '60px 24px 80px', background: 'var(--mkt-page-bg)', borderTop: '1px solid var(--mkt-border-soft)' }}>
        <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '44px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, color: INK, margin: '0 0 10px' }}>
              Så enkelt är det i praktiken
            </h2>
            <p style={{ fontSize: '16px', color: MUTED, margin: 0, maxWidth: '580px', marginLeft: 'auto', marginRight: 'auto' }}>
              Dra i reglaget för att se hur en lönekörning ser ut och hur Bokix beräknar skatt, nettolön och arbetsgivaravgifter.
            </p>
          </Reveal>

          <div className="bx-pay-split">
            {/* Vänster: Kontrollpanel */}
            <Reveal
              style={{
                background: 'var(--mkt-card-bg)',
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: '20px',
                padding: '32px',
                boxShadow: CARD_SHADOW,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: MUTED }}>Bruttolön (månad)</span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: INK, fontFamily: 'monospace' }}>
                  {salaryInput.toLocaleString('sv-SE')} kr
                </span>
              </div>

              <input
                type="range"
                min="15000"
                max="80000"
                step="1000"
                value={salaryInput}
                onChange={e => setSalaryInput(Number(e.target.value))}
                style={{ width: '100%', accentColor: BRAND.green, cursor: 'pointer', marginBottom: '28px' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: `1px solid var(--mkt-border-soft)`, paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14.5px' }}>
                  <span style={{ color: MUTED }}>Skatteavdrag (tabell 31)</span>
                  <span style={{ color: '#dc2626', fontWeight: 600, fontFamily: 'monospace' }}>
                    - {taxAmount.toLocaleString('sv-SE')} kr
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: 700 }}>
                  <span style={{ color: INK }}>Nettolön till anställd</span>
                  <span style={{ color: '#16a34a', fontFamily: 'monospace' }}>
                    {netAmount.toLocaleString('sv-SE')} kr
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14.5px', borderTop: `1px dashed var(--mkt-border-soft)`, paddingTop: '12px' }}>
                  <span style={{ color: MUTED }}>Arbetsgivaravgift (31,42%)</span>
                  <span style={{ color: INK, fontWeight: 600, fontFamily: 'monospace' }}>
                    + {employerTax.toLocaleString('sv-SE')} kr
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '16px',
                  fontWeight: 700,
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  marginTop: '4px',
                }}>
                  <span style={{ color: INK }}>Företagets totalkostnad</span>
                  <span style={{ color: BRAND.green, fontSize: '18px', fontFamily: 'monospace' }}>
                    {totalCost.toLocaleString('sv-SE')} kr
                  </span>
                </div>
              </div>
            </Reveal>

            {/* Höger: Vad som skapas automatiskt */}
            <Reveal delay={100} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: 'var(--mkt-card-bg)',
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px',
                padding: '20px',
                boxShadow: CARD_SHADOW,
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: INK, margin: '0 0 4px' }}>AGI-fil (XML) redo för Skatteverket</h3>
                  <p style={{ fontSize: '13.5px', color: MUTED, margin: 0, lineHeight: 1.5 }}>
                    Innehåller personnummer, bruttolön, skatteavdrag och arbetsgivaravgift. Bara ladda upp och signera.
                  </p>
                </div>
              </div>

              <div style={{
                background: 'var(--mkt-card-bg)',
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px',
                padding: '20px',
                boxShadow: CARD_SHADOW,
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: INK, margin: '0 0 4px' }}>ISO 20022 Betalfil till nätbanken</h3>
                  <p style={{ fontSize: '13.5px', color: MUTED, margin: 0, lineHeight: 1.5 }}>
                    Exportera pain.001-fil till banken. Alla nettolöner betalas automatiskt ut på lönedagen.
                  </p>
                </div>
              </div>

              <div style={{
                background: 'var(--mkt-card-bg)',
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px',
                padding: '20px',
                boxShadow: CARD_SHADOW,
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: INK, margin: '0 0 4px' }}>Automatisk BAS-verifikation</h3>
                  <p style={{ fontSize: '13.5px', color: MUTED, margin: 0, lineHeight: 1.5 }}>
                    Konto 1930, 2710, 2731, 7010 och 7510 konteras i samma sekund du klickar godkänn.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Sex huvudfunktioner ── */}
      <section style={{ padding: '80px 24px', background: IVORY }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, color: INK, margin: '0 0 12px' }}>
              Allt en arbetsgivare behöver
            </h2>
            <p style={{ fontSize: '16.5px', color: MUTED, margin: 0, maxWidth: '620px', marginLeft: 'auto', marginRight: 'auto' }}>
              Från första anställda till hela personalstyrkan – med lagstadgade underlag och skatteberäkningar inbyggda.
            </p>
          </Reveal>

          <div className="bx-pay-grid">
            {FEATURES.map((feat, idx) => (
              <Reveal
                key={feat.title}
                delay={idx * 60}
                style={{
                  background: 'var(--mkt-card-bg)',
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: '16px',
                  padding: '28px',
                  boxShadow: CARD_SHADOW,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  background: feat.bgColor,
                  color: feat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <feat.icon size={22} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: INK, margin: 0 }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.6, margin: 0 }}>
                  {feat.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pris-transparens ── */}
      <section style={{ padding: '70px 24px', background: 'var(--mkt-page-bg)', borderTop: '1px solid var(--mkt-border-soft)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <div style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.06), rgba(16, 185, 129, 0.06))',
              border: '1px solid rgba(124, 58, 237, 0.16)',
              borderRadius: '24px',
              padding: '40px 32px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c3aed' }}>
                Fast pris utan överraskningar
              </span>
              <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.4vw, 34px)', fontWeight: 700, color: INK, margin: '12px 0 14px' }}>
                Ingen avgift per lönespecifikation
              </h2>
              <p style={{ fontSize: '16px', color: MUTED, lineHeight: 1.6, margin: '0 auto 24px', maxWidth: '580px' }}>
                Andra program tar 15–30 kr per lönebesked och anställd varje månad. I Bokix ingår lön och personal fullt ut i vårt företagsabonnemang för <strong>179 kr/mån</strong>. Kör hur många löner du vill.
              </p>
              <Link
                to="/priser"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: BRAND.green,
                  fontWeight: 700,
                  fontSize: '15px',
                  textDecoration: 'none',
                }}
              >
                Se alla funktioner och priser
                <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Vanliga frågor ── */}
      <section style={{ padding: '80px 24px 90px', background: IVORY }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 3.8vw, 38px)', fontWeight: 700, color: INK, margin: '0 0 12px' }}>
              Vanliga frågor om lön i Bokix
            </h2>
            <p style={{ fontSize: '16px', color: MUTED, margin: 0 }}>
              Svar på det vanligaste kring skatter, filer och löneutbetalning.
            </p>
          </Reveal>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {PAYROLL_FAQ.map(faq => (
              <Reveal
                key={faq.q}
                style={{
                  background: 'var(--mkt-card-bg)',
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: '16px',
                  padding: '24px 28px',
                  boxShadow: CARD_SHADOW,
                }}
              >
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: INK, margin: '0 0 8px' }}>
                  {faq.q}
                </h3>
                <p style={{ fontSize: '14.5px', color: MUTED, lineHeight: 1.6, margin: 0 }}>
                  {faq.a}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Slutlig CTA ── */}
      <section style={{ padding: '80px 24px 100px', background: 'var(--mkt-page-bg)', textAlign: 'center', borderTop: '1px solid var(--mkt-border-soft)' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: INK, margin: '0 0 16px' }}>
            Kör din första lön idag
          </h2>
          <p style={{ fontSize: '16.5px', color: MUTED, margin: '0 0 32px', lineHeight: 1.6 }}>
            Skapa ett konto gratis på 2 minuter och upptäck hur smidigt lönehantering och bokföring kan fungera tillsammans.
          </p>
          <button
            type="button"
            onClick={enterApp}
            className="lp-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 28px',
              borderRadius: '12px',
              background: BRAND.green,
              color: '#fff',
              fontWeight: 600,
              fontSize: '16px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Skapa gratiskonto
            <ArrowRight size={18} />
          </button>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
