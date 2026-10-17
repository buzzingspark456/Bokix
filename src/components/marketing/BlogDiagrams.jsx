import React from 'react';
import { SERIF, INK, INK_SOFT, MUTED, CARD_BORDER } from './marketingTokens';

// ── Diagram i bloggartiklar ─────────────────────────────────────────────
// Byggda i HTML/CSS (inte bilder) så de följer sajtens ljusa/mörka tema,
// är skarpa på alla skärmar och har text som sökmotorer kan läsa. En
// artikel refererar dem med { t: 'diagram', id } i content/marketing/blog.js.

const CSS = `
  .bxd { margin: 30px 0 34px; }
  .bxd-card { background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 18px; padding: 22px; box-shadow: var(--mkt-card-shadow-sm); }
  .bxd-cap { font-size: 13.5px; color: ${MUTED}; line-height: 1.55; margin: 12px 4px 0; }

  .bxd-eq { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 14px; align-items: stretch; }
  .bxd-eq-box { border-radius: 14px; padding: 16px 16px 15px; border: 1px solid ${CARD_BORDER}; background: var(--mkt-ivory); }
  .bxd-eq-box.res { background: var(--mkt-accent-green-soft); border-color: transparent; }
  .bxd-eq-k { font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; }
  .bxd-eq-box.res .bxd-eq-k { color: var(--mkt-accent-green-fg); }
  .bxd-eq-v { font-family: ${SERIF}; font-size: 30px; font-weight: 700; color: ${INK}; letter-spacing: -0.01em; margin: 6px 0 4px; white-space: nowrap; }
  .bxd-eq-s { font-size: 13px; color: ${INK_SOFT}; line-height: 1.45; }
  .bxd-op { display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 300; color: ${MUTED}; }
  @media (max-width: 720px) {
    .bxd-eq { grid-template-columns: 1fr; gap: 8px; }
    .bxd-op { height: 22px; }
  }

  .bxd-year { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; position: relative; }
  .bxd-year::before { content: ''; position: absolute; left: 8%; right: 8%; top: 19px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16); opacity: 0.8; }
  .bxd-ph { position: relative; text-align: left; }
  .bxd-ph-n { position: relative; width: 40px; height: 40px; border-radius: 50%; background: var(--mkt-card-bg); border: 3px solid #14b8a6; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; color: ${INK}; box-shadow: 0 4px 10px rgba(20,40,30,0.14); }
  .bxd-ph h4 { font-size: 16.5px; font-weight: 800; color: ${INK}; margin: 14px 0 3px; }
  .bxd-ph-w { font-size: 12.5px; font-weight: 700; color: ${MUTED}; margin-bottom: 8px; }
  .bxd-ph ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .bxd-ph li { font-size: 13.5px; line-height: 1.5; color: ${INK_SOFT}; padding-left: 16px; position: relative; }
  .bxd-ph li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 6px; height: 6px; border-radius: 50%; background: #14b8a6; }
  .bxd-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1.15fr; gap: 12px; align-items: center; }
  .bxd-fb { border-radius: 14px; padding: 15px 16px; border: 1px solid ${CARD_BORDER}; background: var(--mkt-ivory); }
  .bxd-fb-k { font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; margin-bottom: 6px; }
  .bxd-fb-t { font-size: 15.5px; font-weight: 700; color: ${INK}; line-height: 1.35; }
  .bxd-fb-s { font-size: 13px; color: ${INK_SOFT}; margin-top: 5px; line-height: 1.45; }
  .bxd-fb.ok { background: var(--mkt-accent-green-soft); border-color: transparent; }
  .bxd-fb.ok .bxd-fb-k { color: var(--mkt-accent-green-fg); }
  .bxd-fb.warn { background: #fff8dc; border-color: #ecdca0; }
  html[data-theme="dark"] .bxd-fb.warn { background: #2f2a12; border-color: #5b5020; }
  .bxd-fb.warn .bxd-fb-k { color: #8a6a00; }
  html[data-theme="dark"] .bxd-fb.warn .bxd-fb-k { color: #e6c34d; }
  .bxd-fcol { display: grid; gap: 10px; }
  .bxd-arrow { font-size: 22px; color: ${MUTED}; text-align: center; }
  @media (max-width: 860px) {
    .bxd-flow { grid-template-columns: 1fr; }
    .bxd-arrow { transform: rotate(90deg); height: 22px; }
  }

  .bxd-rq { border: 1px solid ${CARD_BORDER}; border-radius: 14px; overflow: hidden; background: var(--mkt-ivory); }
  .bxd-rq-h { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid ${CARD_BORDER}; background: var(--mkt-card-bg); }
  .bxd-rq-h b { font-size: 15.5px; color: ${INK}; }
  .bxd-rq-tag { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6b5a10; background: #fbeeb8; padding: 4px 9px; border-radius: 999px; }
  .bxd-rq-r { display: grid; grid-template-columns: 12px 1fr auto; gap: 14px; align-items: center; padding: 14px 16px; border-bottom: 1px solid ${CARD_BORDER}; background: var(--mkt-card-bg); }
  .bxd-rq-r:last-child { border-bottom: 0; }
  .bxd-rq-d { width: 10px; height: 10px; border-radius: 50%; background: #e0a800; }
  .bxd-rq-t { font-size: 15.5px; font-weight: 700; color: ${INK}; }
  .bxd-rq-w { font-size: 13.5px; color: ${MUTED}; margin-top: 2px; }
  .bxd-rq-b { font-size: 13px; font-weight: 700; color: ${INK}; border: 1px solid ${CARD_BORDER}; border-radius: 9px; padding: 7px 12px; background: var(--mkt-ivory); white-space: nowrap; }
  @media (max-width: 520px) { .bxd-rq-r { grid-template-columns: 12px 1fr; } .bxd-rq-b { display: none; } }

  @media (max-width: 860px) {
    .bxd-year { grid-template-columns: 1fr 1fr; row-gap: 26px; }
    .bxd-year::before { display: none; }
  }
  @media (max-width: 520px) {
    .bxd-year { grid-template-columns: 1fr; }
  }

  .bxd-chain { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 12px; align-items: center; }
  @media (max-width: 720px) { .bxd-chain { grid-template-columns: 1fr; } .bxd-chain .bxd-arrow { transform: rotate(90deg); height: 20px; } }

  .bxd-split { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .bxd-split-col { display: grid; gap: 10px; }
  .bxd-split-h { display: flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 800; color: ${INK}; padding-bottom: 8px; border-bottom: 2px solid ${CARD_BORDER}; margin-bottom: 2px; }
  .bxd-split-h i { width: 9px; height: 9px; border-radius: 50%; display: block; flex-shrink: 0; }
  @media (max-width: 640px) { .bxd-split { grid-template-columns: 1fr; } }
`;

function BalanceEquation() {
  return (
    <div className="bxd-card">
      <div className="bxd-eq">
        <div className="bxd-eq-box">
          <div className="bxd-eq-k">Ingående balans</div>
          <div className="bxd-eq-v">25 000 kr</div>
          <div className="bxd-eq-s">Konto 1930 Företagskonto, från #IB</div>
        </div>
        <div className="bxd-op" aria-hidden="true">+</div>
        <div className="bxd-eq-box">
          <div className="bxd-eq-k">Årets verifikationer</div>
          <div className="bxd-eq-v">12 500 kr</div>
          <div className="bxd-eq-s">Verifikation A2, inbetalning av faktura 1001</div>
        </div>
        <div className="bxd-op" aria-hidden="true">=</div>
        <div className="bxd-eq-box res">
          <div className="bxd-eq-k">Utgående balans</div>
          <div className="bxd-eq-v">37 500 kr</div>
          <div className="bxd-eq-s">Konto 1930, från #UB</div>
        </div>
      </div>
    </div>
  );
}

const UF_PHASES = [
  { n: 1, h: 'Starta', when: 'Hösten', items: ['Öppna ett bankkonto för företaget', 'Bokför pengarna ni startar med'] },
  { n: 2, h: 'Sälja', when: 'Under året', items: ['Skriv fakturan när affären är klar', 'Fota kvittona direkt'] },
  { n: 3, h: 'Bokföra löpande', when: 'Varje vecka', items: ['Bokför nya händelser', 'Stäm av mot kontoutdraget'] },
  { n: 4, h: 'Avsluta', when: 'Våren', items: ['Gå igenom och rätta', 'Gör bokslutet enligt UF:s anvisningar'] },
];

function UfYear() {
  return (
    <div className="bxd-card">
      <div className="bxd-year">
        {UF_PHASES.map(p => (
          <div className="bxd-ph" key={p.n}>
            <div className="bxd-ph-n">{p.n}</div>
            <h4>{p.h}</h4>
            <div className="bxd-ph-w">{p.when}</div>
            <ul>{p.items.map(i => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnkelFlow() {
  return (
    <div className="bxd-card">
      <div className="bxd-flow">
        <div className="bxd-fb">
          <div className="bxd-fb-k">Underlag</div>
          <div className="bxd-fb-t">Kvitto, faktura eller kontoutdrag</div>
          <div className="bxd-fb-s">Det du fotar, skickar eller läser in.</div>
        </div>
        <div className="bxd-arrow" aria-hidden="true">→</div>
        <div className="bxd-fb">
          <div className="bxd-fb-k">Bokix läser av</div>
          <div className="bxd-fb-t">Datum, belopp, moms och konto</div>
          <div className="bxd-fb-s">Föreslås, aldrig gissat i tysthet.</div>
        </div>
        <div className="bxd-arrow" aria-hidden="true">→</div>
        <div className="bxd-fcol">
          <div className="bxd-fb ok">
            <div className="bxd-fb-k">Säkert</div>
            <div className="bxd-fb-t">Bokförs som verifikation</div>
            <div className="bxd-fb-s">Vidare till moms och rapporter.</div>
          </div>
          <div className="bxd-fb warn">
            <div className="bxd-fb-k">Osäkert</div>
            <div className="bxd-fb-t">Stannar i Granskning</div>
            <div className="bxd-fb-s">Med anledningen utskriven. Du avgör.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const REVIEW_ROWS = [
  { t: 'Swish, 500,00 kr', w: 'Saknar tydlig avsändare' },
  { t: 'Kvitto, 11 september', w: 'Kunde inte läsas fullt ut' },
  { t: 'Leverantörsfaktura 1042', w: 'Summan stämmer inte' },
];

function ReviewQueue() {
  return (
    <div className="bxd-card">
      <div className="bxd-rq">
        <div className="bxd-rq-h"><b>Granskning</b><span className="bxd-rq-tag">Exempel</span></div>
        {REVIEW_ROWS.map(r => (
          <div className="bxd-rq-r" key={r.t}>
            <span className="bxd-rq-d" aria-hidden="true" />
            <div>
              <div className="bxd-rq-t">{r.t}</div>
              <div className="bxd-rq-w">{r.w}</div>
            </div>
            <span className="bxd-rq-b" aria-hidden="true">Bokför</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOMS_STEPS = [
  { n: 1, h: 'Kontrollera', when: 'Innan du lämnar in', items: ['Alla kvitton och fakturor för perioden är bokförda', 'Inget ligger kvar i Granskning'] },
  { n: 2, h: 'Granska', when: 'Rutorna', items: ['Utgående och ingående moms stämmer mot verifikationerna', 'Ovanliga rader (omvänd moms, EU-inköp) ser rimliga ut'] },
  { n: 3, h: 'Bokför', when: 'Momsen själv', items: ['Bokix bokför momsskulden eller -fordran automatiskt', 'Kontot stäms av mot ruta 49'] },
  { n: 4, h: 'Lämna in', when: 'Hos Skatteverket', items: ['Ladda upp eSKD-filen eller fyll i e-tjänsten för hand', 'Signera med BankID, betalningen ska vara framme samma dag'] },
];

function MomsSteps() {
  return (
    <div className="bxd-card">
      <div className="bxd-year">
        {MOMS_STEPS.map(p => (
          <div className="bxd-ph" key={p.n}>
            <div className="bxd-ph-n">{p.n}</div>
            <h4>{p.h}</h4>
            <div className="bxd-ph-w">{p.when}</div>
            <ul>{p.items.map(i => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceiptArchive() {
  return (
    <div className="bxd-card">
      <div className="bxd-chain">
        <div className="bxd-fb">
          <div className="bxd-fb-k">Kvittot eller fakturan</div>
          <div className="bxd-fb-t">Fotas eller skannas</div>
          <div className="bxd-fb-s">Hela, läsbar och oförändrad, det är kravet, inte vilken app du använder.</div>
        </div>
        <div className="bxd-arrow" aria-hidden="true">→</div>
        <div className="bxd-fb ok">
          <div className="bxd-fb-k">Originalet i papper</div>
          <div className="bxd-fb-t">Kan slängas direkt</div>
          <div className="bxd-fb-s">Sedan lagändringen 1 juli 2024, så fort överföringen är gjord.</div>
        </div>
        <div className="bxd-arrow" aria-hidden="true">→</div>
        <div className="bxd-fb">
          <div className="bxd-fb-k">Den digitala kopian</div>
          <div className="bxd-fb-t">Sparas i sju år</div>
          <div className="bxd-fb-s">Räknat från utgången av det kalenderår räkenskapsåret slutade.</div>
        </div>
      </div>
    </div>
  );
}

const PAY_PATH = { title: 'Lön', dot: '#0ea5e9', rows: [
  { k: 'Bokförs som', t: 'Lönekostnad, varje månad' },
  { k: 'Kostar företaget', t: 'Bruttolön plus arbetsgivaravgifter' },
  { k: 'Beskattas hos dig', t: 'Direkt, som inkomst av tjänst' },
  { k: 'Ger', t: 'Pensionsgrundande och sjukpenninggrundande inkomst' },
] };
const DIV_PATH = { title: 'Utdelning', dot: '#84cc16', rows: [
  { k: 'Bokförs som', t: 'Beslut på bolagsstämman, en gång per år' },
  { k: 'Kräver', t: 'Utdelningsbara medel i bolaget' },
  { k: 'Beskattas hos dig', t: 'Olika skattesats inom och utanför gränsbeloppet' },
  { k: 'Ger', t: 'Ingen pensions- eller sjukpenninggrundande inkomst' },
] };

function PayOrDividend() {
  return (
    <div className="bxd-card">
      <div className="bxd-split">
        {[PAY_PATH, DIV_PATH].map(col => (
          <div className="bxd-split-col" key={col.title}>
            <div className="bxd-split-h"><i style={{ background: col.dot }} />{col.title}</div>
            {col.rows.map(r => (
              <div className="bxd-fb" key={r.k}>
                <div className="bxd-fb-k">{r.k}</div>
                <div className="bxd-fb-t">{r.t}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function EnskildFirmaFlow() {
  return (
    <div className="bxd-card">
      <div className="bxd-chain">
        <div className="bxd-fb">
          <div className="bxd-fb-k">Kunden betalar</div>
          <div className="bxd-fb-t">In på företagets konto</div>
          <div className="bxd-fb-s">Bokförs som intäkt i firman.</div>
        </div>
        <div className="bxd-arrow" aria-hidden="true">→</div>
        <div className="bxd-fb">
          <div className="bxd-fb-k">Eget uttag</div>
          <div className="bxd-fb-t">Konto 2013, inget lönebesked</div>
          <div className="bxd-fb-s">Ingen skatt just då, firman och du är samma person.</div>
        </div>
        <div className="bxd-arrow" aria-hidden="true">→</div>
        <div className="bxd-fb ok">
          <div className="bxd-fb-k">Din deklaration</div>
          <div className="bxd-fb-t">NE-bilagan och egenavgifter</div>
          <div className="bxd-fb-s">Överskottet beskattas här, en gång om året.</div>
        </div>
      </div>
    </div>
  );
}

const DIAGRAMS = {
  'sie-balance': BalanceEquation, 'uf-year': UfYear, 'enkel-flow': EnkelFlow, 'review-queue': ReviewQueue,
  'moms-steps': MomsSteps, 'receipt-archive': ReceiptArchive, 'pay-or-dividend': PayOrDividend, 'enskild-firma-flow': EnskildFirmaFlow,
};

export default function BlogDiagram({ id, caption }) {
  const D = DIAGRAMS[id];
  if (!D) return null;
  return (
    <figure className="bxd" style={{ margin: '30px 0 34px' }}>
      <style>{CSS}</style>
      <D />
      {caption ? <figcaption className="bxd-cap">{caption}</figcaption> : null}
    </figure>
  );
}
