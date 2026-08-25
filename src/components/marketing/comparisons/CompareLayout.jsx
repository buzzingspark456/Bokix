import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ExternalLink, ShieldCheck } from 'lucide-react';
import { BRAND } from '../../../utils/brandColors';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT_CYCLE } from '../marketingTokens';
import { ROUTE_META } from '../routeMeta';

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '18px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: '14.5px', fontWeight: 700, color: INK }}>{q}</span>
        <ChevronDown size={17} color={MUTED} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <div style={{ maxHeight: open ? '260px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.65, padding: '0 4px 18px', margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

/** Generisk konkurrentjämförelse-mall — drivs helt av `data` från
 * comparisonData.js. En delad komponent istället för tre nästan-identiska
 * sidfiler, så layout/ton/struktur garanterat hålls lika om en fjärde
 * konkurrent läggs till senare. */
export default function CompareLayout({ data }) {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true } });
  const competitorEdge = data.fortnoxEdge || data.bokioEdge || data.vismaEdge || [];

  const path = `/jamfor/${data.slug}`;
  return (
    <MarketingLayout {...ROUTE_META[path]} path={path}>
      <section style={{ padding: '150px 24px 60px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '20px' }}>
            Bokix vs {data.name}
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.16 }}>
            Bokix eller {data.name}?
          </h1>
          <p style={{ fontSize: '16px', color: MUTED, lineHeight: 1.75, maxWidth: '600px', margin: '0 auto' }}>
            {data.intro}
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 70px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <Reveal scale style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', padding: 'clamp(24px, 5vw, 36px)', boxShadow: CARD_SHADOW }}>
            <h2 style={{ fontFamily: SERIF, fontSize: '20px', fontWeight: 700, color: INK, marginBottom: '10px' }}>
              {data.name}s prisbild
            </h2>
            <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.65, marginBottom: '18px' }}>{data.pricingSummary}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
              {data.pricingRows.map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${CARD_BORDER}`, fontSize: '13.5px' }}>
                  <span style={{ color: INK_SOFT, fontWeight: 600 }}>{row.label}</span>
                  <span style={{ color: MUTED }}>{row.value}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--mkt-muted)', lineHeight: 1.6, margin: 0 }}>
              Priser ändras då och då — senast avstämda {data.checked}.{' '}
              <a href={data.pricingUrl} target="_blank" rel="noopener noreferrer" style={{ color: BRAND.greenDark, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                Se {data.name}s aktuella priser <ExternalLink size={11} />
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      <section style={{ padding: '0 24px 80px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <Reveal style={{ background: 'var(--mkt-card-bg)', border: `2px solid ${BRAND.green}`, borderRadius: '18px', padding: '26px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: BRAND.greenDark, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <ShieldCheck size={16} /> Var Bokix vinner
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.bokixEdge.map((point, i) => {
                const accent = ACCENT_CYCLE[i % 3];
                return (
                  <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <Check size={9} color={accent.fg} strokeWidth={3} />
                    </div>
                    <span style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.55 }}>{point}</span>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={80} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '18px', padding: '26px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: INK, marginBottom: '14px' }}>
              När {data.name} kan passa bättre
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {competitorEdge.map((point) => (
                <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                  <ArrowUpRight size={14} color={MUTED} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.55 }}>{point}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section style={{ padding: '0 24px 90px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', background: BRAND.green, borderRadius: '22px', padding: '40px 32px' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>
            Testa Bokix i 30 dagar, gratis
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: '22px' }}>
            99 kr/mån efteråt, allt inkluderat. Ingen bindningstid.
          </p>
          <button className="lp-btn-primary" onClick={enterApp} style={{ padding: '14px 24px', borderRadius: '11px', border: 'none', background: 'white', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: BRAND.greenDark, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Kom igång gratis <ArrowRight size={15} />
          </button>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 100px', background: IVORY }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>Vanliga frågor om Bokix och {data.name}</h2>
          </Reveal>
          <Reveal delay={100} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '6px 22px', boxShadow: '0 1px 3px rgba(28,36,32,0.05)' }}>
            {data.faq.map(item => <FaqItem key={item.q} {...item} />)}
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
