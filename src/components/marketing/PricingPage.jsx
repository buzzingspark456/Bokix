import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Check, X } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal, BokixWordmark } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { GRAD, grad, AuroraLayer } from './aurora';
import { PRICING_TIERS } from './pricingTiers';
import { resolvePlan, YEARLY_MINIMUM_MONTHS } from '../../utils/plans';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// Ärliga, konkreta frågor — inga påhittade "99% nöjda kunder"-svar.
const FAQ = [
  { q: 'Vilken nivå ska jag välja?', a: 'Har du ingen anställd väljer du Utan personal. Så fort du har eller planerar att ha någon anställd, även deltid, behöver du löne­modulen som ingår i Med personal.' },
  { q: 'Kan jag byta nivå senare?', a: 'Ja. Anställer du någon senare uppgraderar du till Med personal när du behöver det, direkt i kontot.' },
  { q: 'Behöver jag ange kortuppgifter för att prova?', a: 'Ja, du lägger in dina betaluppgifter hos Stripe redan vid registreringen, men du debiteras ingenting under de första 30 dagarna. Avslutar du innan dess kostar det dig aldrig något.' },
  { q: 'Kan jag avsluta när som helst?', a: 'På månadsplanen ja — det finns varken uppsägningstid eller bindningstid, du avslutar när du vill. Årsplanen ger ett lägre månadspris mot att den gäller i minst tre månader, därefter avslutar du den lika fritt.' },
  { q: 'Tillkommer moms på priset?', a: 'Nej. Bokix är inte momsregistrerat, så priset du ser är hela beloppet som dras — ingen moms läggs på. Det betyder samtidigt att det inte finns någon ingående moms att dra av på abonnemanget i din egen bokföring.' },
  { q: 'Vilka bolagsformer stöds?', a: 'Bokix känner igen enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening utifrån organisationsnumret, och bokför enligt rätt regler för respektive form.' },
  { q: 'Ingår support i priset?', a: 'Ja, support ingår i båda nivåerna. Du når oss på support@bokix.se.' },
];

// FAQPage-schema byggt direkt av FAQ ovan — samma fyra frågor/svar som
// faktiskt visas på sidan, aldrig en egen dubblett-lista som kan glida
// isär från vad besökaren ser. Google kan visa dessa som en utfällbar
// FAQ-rich-snippet direkt i sökresultatet, och det är precis den sortens
// strukturerade fråga/svar-data AI-svarsmotorer (Perplexity/ChatGPT/Claude
// när de faktiskt läser sidan) helst citerar rakt av.
const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

// SoftwareApplication-schema — kundönskemål ("två priser nu, inte ett"):
// bygger priserna direkt från PRICING_TIERS (pricingTiers.js), samma
// princip som FAQ_SCHEMA ovan, så schemat aldrig kan glida isär från vad
// besökaren faktiskt ser. AggregateOffer (låg/högpris) istället för en
// enda Offer, eftersom det nu verkligen ÄR ett intervall.
const SOFTWARE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Bokix',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: `${SITE_URL}/priser`,
  description: 'Bokföring, fakturering, lönehantering och momsredovisning för svenska företag i alla bolagsformer.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: String(Math.min(...PRICING_TIERS.map((t) => t.price))),
    highPrice: String(Math.max(...PRICING_TIERS.map((t) => t.price))),
    priceCurrency: 'SEK',
    offerCount: String(PRICING_TIERS.length),
    offers: PRICING_TIERS.map((t) => ({
      '@type': 'Offer',
      name: t.name,
      price: String(t.price),
      priceCurrency: 'SEK',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(t.price),
        priceCurrency: 'SEK',
        unitText: 'MON',
        // Se motsvarande kommentar i LandingPage.jsx: ingen moms läggs på i
        // checkouten, så priset är slutbeloppet.
        valueAddedTaxIncluded: true,
      },
    })),
  },
};

// Samma FAQ-stil som startsidan (LandingPage.jsx) — numrerad cirkel, en
// enda genomgående accentfärg, större text.
const FAQ_ACCENT = ACCENT.green;

function FaqItem({ q, a, index, open, onToggle }) {
  return (
    <div
      style={{
        borderRadius: '16px',
        background: open ? `color-mix(in srgb, ${FAQ_ACCENT.fg} 7%, transparent)` : 'transparent',
        borderLeft: `3px solid ${open ? FAQ_ACCENT.fg : 'transparent'}`,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '22px 16px 22px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: FAQ_ACCENT.fg, color: 'white', fontSize: '13.5px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>
          <span style={{ fontSize: '17px', fontWeight: 700, color: INK }}>{q}</span>
        </span>
        <ChevronDown size={20} color={open ? FAQ_ACCENT.fg : MUTED} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <div style={{ maxHeight: open ? '200px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.7, margin: '0 16px 24px 66px' }}>{a}</p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  // Månadsvis eller årsvis. Valet följer med hela vägen till Stripe
  // (state → App → Auth → checkout), så kunden debiteras exakt det pris
  // som stod på kortet hen klickade på.
  const [interval, setInterval] = useState('monthly');
  const enterApp = (planId = 'employer_monthly') => navigate('/', { state: { enterApp: true, authMode: 'signup', plan: planId } });
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <MarketingLayout>
      <PageMeta
        title="Priser: från 129 kr/mån | Bokix"
        description="Två tydliga priser beroende på om du har personal: 129 kr/mån utan anställda, 179 kr/mån med. Ingen moms tillkommer, inga dolda avgifter, inga funktioner att köpa till."
        path="/priser"
      />
      <JsonLd data={SOFTWARE_SCHEMA} />
      <JsonLd data={FAQ_SCHEMA} />

      <section style={{ padding: '150px 24px 70px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(14,165,233,0.20)', '4% -8%'], ['rgba(47,138,58,0.16)', '98% 106%']]}
          blob={{ gradient: grad(GRAD.blueTeal), top: '-160px', left: '-110px', size: '460px', opacity: 0.22 }}
        />
        <Reveal style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.14 }}>
            Ett pris för din situation
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7 }}>
            Samma bokföring och fakturering i båda, skillnaden är om du har personal på lönelistan. Inga tillägg att köpa till, ingen bindningstid på månadsplanen.
          </p>
        </Reveal>
      </section>

      {/* Två prisnivåer, samma kort-mönster som prissektionen på
          startsidan (LandingPage.jsx) — delad data från PRICING_TIERS
          (pricingTiers.js) så de två sidorna aldrig kan glida isär.
          Kundönskemål ("vårt riktiga logo, andra färger, mindre space,
          större") — headern var en helfärgad gradient med loggan tvingad
          vit via CSS-filter. Nu en ljus, svagt tonad header (tier.accent
          vid låg opacitet + en tunn 5px gradient-rand överst) så det
          RIKTIGA flerfärgade ordmärket syns i sina egna färger, större.
          Sektionen/korten breddade så det inte blir onödig tom yta i
          sidorna. Båda korten samma höjd (flex stretch) oavsett olika
          listlängd, och den dyrare nivån ("featured") får mer luft/större
          typsnitt. */}
      <section style={{ padding: '0 24px 60px', background: 'var(--mkt-page-bg)', position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(47,138,58,0.14)', '96% -6%'], ['rgba(20,184,166,0.16)', '2% 108%']]}
          blob={{ gradient: grad(GRAD.tealLime), bottom: '-150px', top: 'auto', right: '-110px', left: 'auto', size: '420px', opacity: 0.18, slow: true }}
        />
        <Reveal scale style={{ maxWidth: 'min(92vw, 1220px)', margin: '0 auto', padding: '0 4px', width: '100%', position: 'relative' }}>
          {/* Betalningsintervall. Årsvis är förvalt AV — den som inte
              aktivt väljer det ska aldrig råka binda upp ett år i förskott. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '34px' }}>
            <div role="group" aria-label="Betalningsintervall" style={{ display: 'inline-flex', gap: '4px', padding: '5px', borderRadius: '999px', background: 'var(--mkt-ivory)', border: `1px solid ${CARD_BORDER}` }}>
              {[
                { id: 'monthly', label: 'Månadsvis' },
                { id: 'yearly', label: 'Årsplan', badge: 'spara upp till 360 kr/år' },
              ].map(opt => {
                const active = interval === opt.id;
                return (
                  <button
                    key={opt.id} type="button" onClick={() => setInterval(opt.id)} aria-pressed={active}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '11px 22px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '14.5px', fontWeight: 700, border: 'none',
                      background: active ? 'var(--mkt-card-bg)' : 'transparent',
                      color: active ? INK : MUTED,
                      boxShadow: active ? '0 2px 8px rgba(28,36,32,0.10)' : 'none',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {opt.label}
                    {opt.badge && (
                      <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: ACCENT.green.soft, color: ACCENT.green.fg }}>
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '32px', alignItems: 'stretch' }}>
            {PRICING_TIERS.map((tier) => {
              const plan = resolvePlan(tier.key, interval);
              return (
              <div
                key={tier.key}
                className="lp-lux-card"
                style={{
                  background: 'var(--mkt-card-bg)',
                  border: tier.featured ? `2px solid ${tier.accent.fg}` : '1px solid var(--mkt-card-border)',
                  borderRadius: '26px',
                  boxShadow: tier.featured ? '0 44px 76px -28px rgba(20,140,90,0.38), 0 4px 14px rgba(28,36,32,0.08)' : '0 32px 60px -30px rgba(28,36,32,0.32), 0 2px 8px rgba(28,36,32,0.05)',
                  width: '100%', height: '100%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Ingen translateY-lyft — gjorde att korten inte låg i
                    linje längst upp, syntes som "avskuret".
                    borderRadius matchar kortets EGNA 26px — annars möts
                    headerns egen overflow:hidden-klippning och kortets
                    rundade mask inte exakt, och gradient-randen fick ett
                    hackigt hörn. */}
                <div style={{ background: `color-mix(in srgb, ${tier.accent.fg} 7%, var(--mkt-card-bg))`, padding: tier.featured ? '46px 28px 34px' : '38px 28px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden', borderRadius: '26px 26px 0 0', flexShrink: 0 }}>
                  <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', backgroundImage: grad(tier.gradient) }} />
                  <div style={{ marginBottom: tier.featured ? '20px' : '16px', position: 'relative' }}>
                    <BokixWordmark height={tier.featured ? 48 : 38} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'inline-flex', padding: '5px 14px', borderRadius: '100px', background: tier.accent.soft, fontSize: tier.featured ? '13.5px' : '12.5px', fontWeight: 700, color: tier.accent.fg, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px' }}>{tier.name}</div>
                    {/* Priset räknas ur den delade katalogen (plans.js),
                        samma fil som checkouten debiterar efter — kortet kan
                        alltså inte visa ett annat belopp än det som dras. */}
                    <div>
                      <span style={{ fontFamily: SERIF, fontSize: tier.featured ? '58px' : '50px', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>
                        {plan.price} kr
                      </span>
                      <span style={{ fontSize: '15px', color: MUTED }}> /mån</span>
                    </div>
                    {interval === 'yearly' ? (
                      <div style={{ fontSize: '13px', color: MUTED, marginTop: '6px', fontWeight: 600 }}>
                        Dras varje månad · du sparar {plan.savingPerYear} kr per år
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: MUTED, marginTop: '6px', fontWeight: 600 }}>{tier.subtitle} · gratis i 30 dagar</div>
                    )}
                  </div>
                </div>

                <div style={{ padding: '28px 24px 26px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {tier.recommend && (
                    <div style={{ fontSize: '13.5px', color: tier.accent.fg, fontWeight: 600, lineHeight: 1.5, marginBottom: '18px', paddingBottom: '18px', borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {tier.recommend}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '22px', flex: 1 }}>
                    {tier.features.map((f) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 12px', background: 'var(--mkt-ivory)', border: `1px solid ${CARD_BORDER}`, borderRadius: '11px' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: tier.accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={11} color={tier.accent.fg} strokeWidth={3} />
                        </div>
                        <span style={{ fontSize: '14px', color: INK_SOFT, fontWeight: 500, lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                    {tier.missing?.map((f) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 12px', opacity: 0.55 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${MUTED}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X size={11} color={MUTED} strokeWidth={3} />
                        </div>
                        <span style={{ fontSize: '14px', color: MUTED, fontWeight: 500, lineHeight: 1.4, textDecoration: 'line-through' }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <button className="lp-btn-primary lp-pulse" onClick={() => enterApp(plan.id)} style={{ width: '100%', padding: '16px', borderRadius: '13px', border: 'none', background: BRAND.green, fontSize: '15.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 10px 24px -8px rgba(11,99,41,0.35)', minHeight: '48px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    Kom igång gratis <ArrowRight size={16} />
                  </button>
                  <div style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--mkt-muted)', marginTop: '14px' }}>
                    {interval === 'yearly'
                      ? `Gratis i 30 dagar · samma månadsbetalning som vanligt, bara lägre · minst ${YEARLY_MINIMUM_MONTHS} månader`
                      : 'Gratis i 30 dagar · avsluta när som helst'}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          {/* Momsraden står här, direkt under beloppen, och inte bara i
              FAQ:n längre ner: "tillkommer det moms?" är frågan en
              företagare ställer i samma sekund som hen ser priset, och ett
              svar som kräver att man skrollar är ett svar för sent.
              Bokix är inte momsregistrerat — priset är därmed hela
              beloppet, och det finns ingen ingående moms att dra av. */}
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--mkt-muted)', margin: '28px auto 0', maxWidth: '520px', lineHeight: 1.65 }}>
            Priserna är i svenska kronor och ingen moms tillkommer — Bokix är inte momsregistrerat, så beloppet du ser är det som dras.
          </p>
        </Reveal>
      </section>

      {/* Kundönskemål: ingen demo på prissidan längre — startsidans "Se
          demo" i Hero (DemoOverlay, se LandingPage.jsx) är nu den ENDA
          platsen för den riktiga, klickbara produktvisningen. */}

      <section style={{ padding: '90px 24px 100px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(132,204,22,0.14)', '2% 106%'], ['rgba(14,165,233,0.14)', '98% -8%']]}
          blob={{ gradient: grad(GRAD.green), top: '-140px', bottom: 'auto', right: '-100px', left: 'auto', size: '380px', opacity: 0.18 }}
        />
        <div style={{ maxWidth: 'min(88vw, 900px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '44px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>Vanliga frågor</h2>
          </Reveal>
          <Reveal delay={100} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: '8px 30px', boxShadow: CARD_SHADOW }}>
            {FAQ.map((item, i) => (
              <FaqItem key={item.q} {...item} index={i} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </Reveal>
          {/* Kontextuell länk (inte bara i footern) — hjälper både besökare
              som vill jämföra bredare och Google att hitta guiden via en
              redan indexerad sida, med beskrivande länktext istället för
              "läs mer". */}
          <Reveal delay={140} style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link to="/valja-bokforingsprogram" style={{ fontSize: '13.5px', fontWeight: 600, color: BRAND.greenDark, textDecoration: 'none' }}>
              Fler frågor att ställa? Läs vår guide: Så väljer du bokföringsprogram →
            </Link>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
