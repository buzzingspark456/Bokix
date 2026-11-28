import React, { useState } from 'react';
import { Check } from '../icons';
import MarketingLayout from './MarketingLayout';

// FÖRHANDSVISNING (2026-11-25, bara lokalt, inte länkad): de tre planerna
// efter AB:t. Varje plan står för en sorts företag, och varje nivå har allt
// från nivån under. Priserna är slutbelopp tills Bokix är momsregistrerat.
const PLANS = [
  {
    id: 'bas', name: 'Bas', who: 'För dig som driver själv', price: 129, yearly: 109,
    pitch: 'Allt för att sköta bokföringen utan att vara ekonom.',
    lead: null,
    features: [
      'Bokföring på vanlig svenska, utan debet och kredit',
      'Kundfakturor och offerter, obegränsat antal',
      'Kvitton och fakturor läses av automatiskt',
      'Leverantörsfakturor med påminnelse om förfallodag',
      'Momsdeklaration och bokslut steg för steg',
      'Årsredovisning att skriva under',
      'Bjud in en person, till exempel din redovisningskonsult',
    ],
  },
  {
    id: 'personal', name: 'Personal', who: 'För dig med anställda', price: 179, yearly: 149,
    pitch: 'Lön, skatt och arbetsgivardeklaration på samma ställe som bokföringen.',
    lead: 'Allt i Bas, och',
    features: [
      'Lönekörning med skatteavdrag och lönebesked',
      'Arbetsgivardeklaration (AGI) klar att skicka',
      'Semester och utlägg betalas tillbaka i lönen',
      'Betalfil till banken',
      'Bjud in två personer',
    ],
  },
  {
    id: 'handel', name: 'Handel', who: 'För dig som säljer varor', price: 349, yearly: 299, popular: true,
    pitch: 'Från offert till order, leverans och faktura, med lagret som räknar själv.',
    lead: 'Allt i Personal, och',
    features: [
      'Order med reserverade varor, delleverans och restorder',
      'Artikelregister och lager som dras när du levererar',
      'Inköpsorder till leverantörer, kopplade till fakturan',
      'Prissättning med marginalmål och prisförslag',
      'Orderbekräftelse och följesedel',
    ],
  },
];

const PROMISES = [
  'Prova alla planer gratis i 30 dagar, även Handel',
  'Allt ingår i planen, inga avgifter per faktura eller kvitto',
  'Prisändringar meddelas två månader i förväg',
  'Byt plan när du vill',
];

const COMPARE = [
  ['Bokföring, fakturor och offerter', true, true, true],
  ['Kvitton och leverantörsfakturor', true, true, true],
  ['Moms, bokslut och årsredovisning', true, true, true],
  ['Lön och arbetsgivardeklaration', false, true, true],
  ['Order och leverans', false, false, true],
  ['Artiklar och lager', false, false, true],
  ['Inköpsorder', false, false, true],
  ['Prissättning', false, false, true],
  ['Inbjudna personer', '1', '2', '2'],
];

export default function PlansPreviewPage() {
  const [yearly, setYearly] = useState(false);
  return (
    <MarketingLayout>
      <style>{CSS}</style>
      <div className="pv-wrap"><section className="pv">
        <span className="pv-tag">Förhandsvisning, bara lokalt</span>
        <h1>En plan för hur ditt företag ser ut</h1>
        <p className="pv-lead">Börja med Bas. När du anställer eller börjar sälja varor byter du plan, och allt du redan gjort följer med.</p>
        <div className="pv-toggle" role="tablist">
          <button type="button" className={!yearly ? 'on' : ''} onClick={() => setYearly(false)}>Månadsvis</button>
          <button type="button" className={yearly ? 'on' : ''} onClick={() => setYearly(true)}>Årsplan <em>billigare</em></button>
        </div>
        <div className="pv-grid">
          {PLANS.map(p => (
            <article key={p.id} className={`pv-card${p.popular ? ' is-pop' : ''}`}>
              {p.popular && <span className="pv-pop">Nytt</span>}
              <h2>{p.name}</h2>
              <p className="pv-who">{p.who}</p>
              <p className="pv-price"><b>{yearly ? p.yearly : p.price} kr</b><span>/mån</span></p>
              <p className="pv-sub">{yearly ? `Med årsplan, ${(p.price - p.yearly) * 12} kr billigare per år` : 'Ingen bindningstid'}</p>
              <p className="pv-pitch">{p.pitch}</p>
              <button type="button" className="pv-cta">Prova {p.name} gratis</button>
              {p.lead && <p className="pv-flead">{p.lead}</p>}
              <ul>
                {p.features.map(f => <li key={f}><span className="pv-chk"><Check size={12} /></span>{f}</li>)}
              </ul>
            </article>
          ))}
        </div>
        <ul className="pv-promises">
          {PROMISES.map(t => <li key={t}><Check size={14} /> {t}</li>)}
        </ul>
        <h2 className="pv-h2">Jämför planerna</h2>
        <div className="pv-table">
          <table>
            <thead><tr><th /><th>Bas</th><th>Personal</th><th>Handel</th></tr></thead>
            <tbody>
              {COMPARE.map(([label, ...vals]) => (
                <tr key={label}><td>{label}</td>{vals.map((v, i) => <td key={i}>{v === true ? <span className="pv-chk on"><Check size={12} /></span> : v === false ? <span className="pv-dash">–</span> : v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section></div>
    </MarketingLayout>
  );
}

const CSS = `
.pv-wrap { background: #f6f7f6; color: #111827; }
.pv { max-width: 1120px; margin: 0 auto; padding: 56px 20px 80px; text-align: center; }
.pv-tag { display: inline-block; padding: 4px 12px; border-radius: 99px; background: #fff3cd; color: #7a5a00; font-size: 12.5px; font-weight: 600; margin-bottom: 18px; }
.pv h1 { font-size: clamp(30px, 4vw, 44px); letter-spacing: -.02em; margin: 0 0 12px; color: #111827; }
.pv-lead { max-width: 620px; margin: 0 auto 26px; font-size: 17px; line-height: 1.55; color: #4b5563; }
.pv-toggle { display: inline-flex; padding: 4px; border-radius: 99px; background: #f1f3f2; border: 1px solid #e5e7eb; margin-bottom: 34px; }
.pv-toggle button { border: none; background: none; padding: 9px 20px; border-radius: 99px; font: inherit; font-size: 14px; font-weight: 600; color: #4b5563; cursor: pointer; }
.pv-toggle button.on { background: #1f2329; color: #fff; }
.pv-toggle em { font-style: normal; font-size: 12px; margin-left: 6px; color: #0b6329; }
.pv-toggle button.on em { color: #86efac; }
.pv-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; text-align: left; }
.pv-card { position: relative; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px 26px; display: flex; flex-direction: column; }
.pv-card.is-pop { border: 2px solid #0b6329; box-shadow: 0 18px 40px rgba(11,99,41,.10); }
.pv-pop { position: absolute; top: -12px; left: 26px; background: #0b6329; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 99px; }
.pv-card h2 { margin: 0; font-size: 22px; color: #111827; }
.pv-who { margin: 4px 0 18px; color: #4b5563; font-size: 14.5px; }
.pv-price { margin: 0; display: flex; align-items: baseline; gap: 4px; }
.pv-price b { font-size: 40px; letter-spacing: -.02em; color: #111827; }
.pv-price span { color: #6b7280; font-size: 15px; }
.pv-sub { margin: 4px 0 16px; font-size: 13px; color: #6b7280; min-height: 18px; }
.pv-pitch { margin: 0 0 18px; font-size: 15px; line-height: 1.5; color: #1f2937; min-height: 46px; }
.pv-cta { height: 44px; border: none; border-radius: 99px; background: #0b6329; color: #fff; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 22px; }
.pv-card:not(.is-pop) .pv-cta { background: #fff; color: #0b6329; border: 1.5px solid #0b6329; }
.pv-flead { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #111827; }
.pv-card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.pv-card li { display: flex; gap: 10px; font-size: 14.5px; line-height: 1.45; color: #374151; }
.pv-chk { flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #e7f3ec; color: #0b6329; margin-top: 1px; }
.pv-chk.on { background: #0b6329; color: #fff; }
.pv-promises { list-style: none; padding: 0; margin: 34px auto 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 26px; font-size: 14px; color: #374151; }
.pv-promises li { display: inline-flex; align-items: center; gap: 6px; }
.pv-promises svg { color: #0b6329; }
.pv-h2 { margin: 64px 0 18px; font-size: 26px; color: #111827; }
.pv-table { overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; }
.pv-table table { width: 100%; border-collapse: collapse; font-size: 14.5px; }
.pv-table th, .pv-table td { padding: 14px 18px; border-bottom: 1px solid #f0f1f2; text-align: center; color: #374151; }
.pv-table th { font-size: 15px; color: #111827; background: #fafbfa; }
.pv-table td:first-child, .pv-table th:first-child { text-align: left; }
.pv-table tr:last-child td { border-bottom: none; }
.pv-dash { color: #c4c8cc; }
@media (max-width: 900px) { .pv-grid { grid-template-columns: 1fr; } .pv-pitch { min-height: 0; } }
`;
