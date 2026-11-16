import React from 'react';
import { ExternalLink } from '../icons';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED } from './marketingTokens';
import { PageMeta } from '../../utils/seo';
import { RULES, RULE_AREAS } from '../../utils/rulesRegistry';

// /belopp-och-regler (2026-11-16): de belopp och regler Bokix räknar med,
// med källa och datum för senaste kontroll. Samma lista som /internal →
// Regler (src/utils/rulesRegistry.js), så sidan visar alltid det appen
// faktiskt använder.

const fmt = (iso) => new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

export default function RulesPage() {
  const latest = RULES.map(r => r.verifiedAt).sort().at(-1);
  return (
    <MarketingLayout>
      <PageMeta
        title="Belopp och regler som Bokix räknar med"
        description="Momssatser, arbetsgivaravgifter, ROT och RUT, bolagsskatt och filformat som Bokix använder, med källa hos Skatteverket och datum för senaste kontroll."
        path="/belopp-och-regler"
      />
      <style>{`
        .rp-hero { padding: clamp(116px, 18vw, 150px) 20px 0; text-align: center; background: var(--mkt-page-bg); }
        .rp-h1 { font-family: ${SERIF}; font-size: clamp(34px, 5.6vw, 58px); font-weight: 700; letter-spacing: -0.025em; line-height: 1.06; color: ${INK}; margin: 0 auto; max-width: 820px; }
        .rp-lead { font-size: 17px; color: ${MUTED}; margin: 16px auto 0; max-width: 620px; line-height: 1.55; }
        .rp-wrap { max-width: 900px; margin: 0 auto; padding: clamp(40px, 6vw, 64px) 16px clamp(72px, 10vw, 110px); background: var(--mkt-page-bg); }
        .rp-area { margin-top: 36px; }
        .rp-area h2 { font-family: ${SERIF}; font-size: 24px; font-weight: 700; color: ${INK}; margin: 0 0 12px; }
        .rp-list { border: 1px solid var(--mkt-card-border); border-radius: 20px; background: var(--mkt-card-bg); overflow: hidden; }
        .rp-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px 20px; padding: 18px 22px; }
        .rp-row + .rp-row { border-top: 1px solid var(--mkt-border-soft); }
        .rp-title { font-size: 15.5px; font-weight: 700; color: ${INK}; }
        .rp-used { font-size: 13.5px; color: ${MUTED}; margin-top: 3px; }
        .rp-value { font-size: 15.5px; font-weight: 600; color: ${INK_SOFT}; }
        .rp-meta { font-size: 13px; color: ${MUTED}; margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px 12px; }
        .rp-meta a { color: var(--mkt-accent-green-fg); display: inline-flex; align-items: center; gap: 4px; text-decoration: none; font-weight: 600; }
        .rp-note { font-size: 14px; color: ${MUTED}; line-height: 1.6; margin-top: 36px; }
        @media (max-width: 640px) { .rp-row { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      <section className="rp-hero">
        <Reveal>
          <h1 className="rp-h1">Belopp och regler som Bokix räknar med</h1>
          <p className="rp-lead">Här ser du vilka satser och regler Bokix använder, var de kommer ifrån och när vi senast kontrollerade dem. Senast uppdaterad {fmt(latest)}.</p>
        </Reveal>
      </section>
      <div className="rp-wrap">
        {RULE_AREAS.map(area => {
          const rows = RULES.filter(r => r.area === area);
          if (!rows.length) return null;
          return (
            <section key={area} className="rp-area">
              <h2>{area}</h2>
              <div className="rp-list">
                {rows.map(r => (
                  <div key={r.id} className="rp-row">
                    <div>
                      <div className="rp-title">{r.title}</div>
                      <div className="rp-used">Används i: {r.usedIn}</div>
                    </div>
                    <div>
                      <div className="rp-value">{r.value}</div>
                      <div className="rp-meta">
                        {r.validTo && <span>Gäller till {fmt(r.validTo)}</span>}
                        <span>Kontrollerad {fmt(r.verifiedAt)}</span>
                        <a href={r.source.url} target="_blank" rel="noopener noreferrer">Källa <ExternalLink size={12} /></a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <p className="rp-note">Vi går igenom reglerna löpande och alltid när Skatteverket ändrar något, till exempel nya skattetabeller i december. Du ansvarar själv för din bokföring och dina deklarationer, och Bokix skickar aldrig in något utan att du har sett det. Ser du något som inte stämmer, skriv till support@bokix.se.</p>
      </div>
    </MarketingLayout>
  );
}
