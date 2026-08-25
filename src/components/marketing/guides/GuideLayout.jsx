import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronDown } from 'lucide-react';
import { BRAND } from '../../../utils/brandColors';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from '../marketingTokens';
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
      <div style={{ maxHeight: open ? '300px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.65, padding: '0 4px 18px', margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

/** Delad artikel-mall för /guider/*. `slug` slår upp titel/beskrivning i
 * routeMeta.js (samma mönster som alla andra marknadssidor); `children` är
 * själva artikeltexten (vanliga <h2>/<p>/<ul>, se en av guide-filerna för
 * stiltokens); `faq` (valfri) renderar en frågor/svar-sektion och matchande
 * FAQPage-JSON-LD via scripts/prerender.mjs. */
export default function GuideLayout({ slug, faq, children }) {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true } });
  const path = `/guider/${slug}`;
  const meta = ROUTE_META[path];

  return (
    <MarketingLayout {...meta} path={path}>
      <article>
        <section style={{ padding: '150px 24px 50px', background: IVORY }}>
          <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '20px' }}>
              <BookOpen size={13} /> Guide
            </div>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px', lineHeight: 1.18 }}>
              {meta?.title?.replace(' | Bokix', '')}
            </h1>
            <p style={{ fontSize: '16px', color: MUTED, lineHeight: 1.7 }}>{meta?.description}</p>
          </Reveal>
        </section>

        <section style={{ padding: '10px 24px 70px', background: 'var(--mkt-page-bg)' }}>
          <Reveal scale style={{
            maxWidth: '700px', margin: '0 auto', background: 'var(--mkt-card-bg)',
            border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', padding: 'clamp(28px, 5vw, 48px)',
            boxShadow: CARD_SHADOW, color: INK_SOFT, fontSize: '15.5px', lineHeight: 1.8,
          }}>
            {children}
          </Reveal>
        </section>

        {faq && faq.length > 0 && (
          <section style={{ padding: '0 24px 90px', background: 'var(--mkt-page-bg)' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <Reveal style={{ textAlign: 'center', marginBottom: '28px' }}>
                <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: INK }}>Vanliga frågor</h2>
              </Reveal>
              <Reveal delay={80} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '6px 22px', boxShadow: '0 1px 3px rgba(28,36,32,0.05)' }}>
                {faq.map(item => <FaqItem key={item.q} {...item} />)}
              </Reveal>
            </div>
          </section>
        )}

        <section style={{ padding: '0 24px 100px', background: IVORY }}>
          <Reveal scale style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', background: BRAND.green, borderRadius: '22px', padding: '38px 32px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: '21px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
              Testa Bokix i 30 dagar, gratis
            </h2>
            <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: '20px' }}>
              99 kr/mån efteråt, allt inkluderat.
            </p>
            <button className="lp-btn-primary" onClick={enterApp} style={{ padding: '13px 22px', borderRadius: '11px', border: 'none', background: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: BRAND.greenDark, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              Kom igång gratis <ArrowRight size={14} />
            </button>
          </Reveal>
        </section>
      </article>
    </MarketingLayout>
  );
}

export const h2 = { fontFamily: SERIF, fontSize: '19px', fontWeight: 700, color: INK, marginTop: '30px', marginBottom: '12px' };
export const h3 = { fontSize: '15.5px', fontWeight: 700, color: INK, marginTop: '20px', marginBottom: '8px' };
export const p = { marginBottom: '14px' };
export const ul = { margin: '0 0 16px', paddingLeft: '22px' };
export const li = { marginBottom: '8px' };
export const note = { margin: '18px 0', padding: '14px 18px', background: 'var(--mkt-page-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '12px', fontSize: '13.5px', color: MUTED, lineHeight: 1.65 };
export { Link };
