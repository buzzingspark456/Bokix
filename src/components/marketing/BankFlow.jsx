import React, { useEffect, useState } from 'react';
import { Check, Landmark } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import { INK, INK_SOFT, MUTED, CARD_BORDER } from './marketingTokens';
import BokixWordmark from '../shared/BokixWordmark';
import { BankLogo } from '../shared/BrandLogos';
import { BANK_LOGOS } from '../../utils/bankSources';

// ── "Banken → Bokix"-animationen: kontoutdraget lämnar internetbanken,
// åker in i Bokix och landar som färdiga rader i kontoutdraget ──────────
// Delad av startsidan (egen sektion) och /koppla-bank (hjälten). EN
// komponent, inte två snarlika kopior — exakt samma skäl som
// MigrationFlow.jsx anger för sig själv: animationen ÄR poängen med båda
// ytorna och skulle garanterat divergera annars.
//
// Släkt med MigrationFlow, medvetet: samma rörelsevokabulär (en bricka
// som byts ut i vänsteränden, .lp-flow-connector-ledningen, ett paket som
// färdas, navets ring som kvitterar ankomsten) så de två sektionerna på
// startsidan läser som samma sajt och inte som två olika idéer. Det som
// är NYTT här är tredje akten: ett litet kontoutdrag under scenen där en
// rad stämplas klar för varje paket som kommer fram. Migrationen är en
// engångshändelse ("filen kom in") — bankimporten är ett löpande arbete,
// och det är RESULTATET (matchad faktura, bokförd rad) som är värdet.
// Utan den akten hade animationen bara sagt "en fil flyttar sig".
//
// ÄRLIGHETSKRAV, samma som bankSources.js slår fast: det här är en
// FILIMPORT, inte en direktkoppling mot banken. Ingen bild eller text
// här får antyda BankID-inloggning, "hämtar automatiskt" eller en levande
// tvåvägslina — ledningen går ÅT ETT HÅLL, paketet är en CSV/XLSX-fil med
// filtypen utskriven, och etiketten under bankbrickan säger "Ditt
// kontoutdrag", inte "Din bank".
//
// Layouten är AVSIKTLIGT vågrät i alla bredder (samma resonemang som
// MigrationFlow): clamp():ade mått ger en 390px-skärm samma läsordning
// som en 1440px — därifrån → filen → hit.
const CYCLE_MS = 3200;

// Tre rader ur ett riktigt kontoutdrag, med de statusar appen FAKTISKT
// har (se Bank.jsx: unmatched/matched/booked). Ingen av dem påstår något
// som importen inte gör: en inbetalning som matchas mot en obetald
// kundfaktura, ett kortköp som bokförs på ett konto, en utbetalning som
// matchas mot en leverantörsfaktura — allt tre är exakt de tre vägarna
// BankRowDetail erbjuder. Belopp med svenska tusental/decimaler.
const LEDGER_ROWS = [
  { text: 'Swish inbetalning', date: '4 mar', amount: '+12 500,00', done: 'Matchad mot faktura 2026-014' },
  { text: 'Kortköp drivmedel', date: '5 mar', amount: '−842,50', done: 'Bokförd 5611' },
  { text: 'Betalning leverantör', date: '6 mar', amount: '−4 375,00', done: 'Matchad mot lev.faktura' },
];

// Loggväggens innehåll: bankerna PLUS en "Annan bank"-bricka sist.
// Brickan är inte dekoration — den är hela skillnaden mellan att raden
// läses som "de här nio bankerna stöds" och "vilken bank som helst",
// vilket är det som faktiskt är sant (se bankSources.js: importen är en
// generell fil-läsare, inte en integration per bank). Samma svar som
// väljaren på /koppla-bank och importguiden i appen ger.
const WALL_ITEMS = [...BANK_LOGOS, { id: 'other', name: 'Annan bank', other: true }];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function BankFlow({ note = true, ledger = true }) {
  // EN räknare driver allt: vilken bank som visas, vilken filtyp paketet
  // bär och hur många rader i kontoutdraget som hunnit bli klara. Två
  // separata timers hade glidit ur fas inom ett par varv, och hela
  // poängen är att raden stämplas i samma ögonblick som paketet landar.
  const [tick, setTick] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) { setStill(true); return undefined; }
    const t = setInterval(() => setTick(prev => prev + 1), CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  const active = BANK_LOGOS[tick % BANK_LOGOS.length];
  const fileType = tick % 2 === 0 ? 'CSV' : 'XLSX';
  // 0 → inga rader klara, sedan en till per varv, och så börjar det om.
  // Vid prefers-reduced-motion står klockan still: visa då det FÄRDIGA
  // läget (alla rader klara), inte det tomma — en stillbild ska visa vad
  // man får, inte utgångsläget.
  const doneRows = still ? LEDGER_ROWS.length : tick % (LEDGER_ROWS.length + 1);

  return (
    <div className="bx-bf">
      <style>{`
        .bx-bf { display: flex; flex-direction: column; align-items: center; gap: clamp(18px, 3.6vw, 28px); width: 100%; }

        /* Akt 1–2: banken → ledningen → navet. Vågrät i ALLA bredder. */
        .bx-bf-stage { display: flex; align-items: center; justify-content: center; gap: clamp(8px, 2.4vw, 20px); width: 100%; max-width: 660px; }
        .bx-bf-side { display: flex; flex-direction: column; align-items: center; gap: 9px; flex-shrink: 0; }
        .bx-bf-label { font-size: clamp(11px, 2.5vw, 13.5px); font-weight: 700; letter-spacing: -0.005em; white-space: nowrap; }

        /* Bankbrickan är BREDARE än hög, till skillnad från MigrationFlows
           kvadrat: här är märkena ordbilder (se BankLogo). */
        .bx-bf-tile {
          display: flex; align-items: center; justify-content: center; background: #fff;
          border-radius: 15px; border: 1.5px solid var(--mkt-card-border); box-shadow: var(--mkt-card-shadow);
          width: clamp(104px, 27vw, 168px); height: clamp(62px, 16vw, 88px); padding: 0 10px;
        }

        /* Bankbytet i vänsteränden — samma svep som MigrationFlow, startas
           om av React:s key vid varje byte. */
        @keyframes bxBfSwap {
          from { opacity: 0; transform: translateY(6px) scale(0.94); }
          to   { opacity: 1; transform: none; }
        }
        .bx-bf-swap { animation: bxBfSwap 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }

        .bx-bf-pipe { position: relative; flex: 1 1 auto; min-width: clamp(48px, 15vw, 150px); height: 36px; }
        .bx-bf-wire { position: absolute; left: 0; right: 0; top: 50%; height: 3px; margin-top: -1.5px; border-radius: 3px; }

        /* Filen som färdas. Spåret är lika brett som ledningen, så
           translateX(100%) landar exakt på navets kant oavsett skärmbredd
           — ingen uppmätning i JS. Tonar ut strax INNAN navet (samma
           lärdom som MigrationFlow: annars ligger pillret ovanpå
           Bokix-kortets kant i sista bildrutan på en smal skärm). */
        @keyframes bxBfPacket { 0% { transform: translateX(0); } 100% { transform: translateX(100%); } }
        @keyframes bxBfPacketFade {
          0% { opacity: 0; } 12% { opacity: 1; } 70% { opacity: 1; } 82% { opacity: 0; } 100% { opacity: 0; }
        }
        .bx-bf-track { position: absolute; inset: 0; animation: bxBfPacket ${CYCLE_MS}ms cubic-bezier(0.45, 0, 0.55, 1) infinite; }
        .bx-bf-packet {
          position: absolute; left: 0; top: 50%; transform: translate(-50%, -50%);
          display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap;
          animation: bxBfPacketFade ${CYCLE_MS}ms linear infinite;
        }

        .bx-bf-hub { position: relative; display: flex; align-items: center; justify-content: center; padding: clamp(12px, 3vw, 19px) clamp(13px, 3.6vw, 22px); border-radius: 16px; background: var(--mkt-card-bg); border: 1.5px solid ${BRAND.green}; box-shadow: var(--mkt-card-shadow); }
        /* Ringen kvitterar ANKOMSTEN och måste därför dela cykellängd med
           paketet — inte den delade .lp-hub-pulse, som har en egen längd
           och hade glidit ur fas. */
        @keyframes bxBfArrive {
          0%, 70% { transform: scale(1); opacity: 0.28; }
          86%     { transform: scale(1.09); opacity: 0.85; }
          100%    { transform: scale(1); opacity: 0.28; }
        }
        .bx-bf-halo { position: absolute; inset: -6px; border-radius: 21px; border: 1.5px solid ${BRAND.green}; opacity: 0.28; pointer-events: none; animation: bxBfArrive ${CYCLE_MS}ms ease-in-out infinite; }

        /* Akt 3: kontoutdraget som fylls på. */
        .bx-bf-ledger { width: 100%; max-width: 440px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 16px; box-shadow: var(--mkt-card-shadow); overflow: hidden; }
        .bx-bf-ledger-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 15px; border-bottom: 1px solid var(--mkt-card-border); background: var(--mkt-ivory); }
        .bx-bf-ledger-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; padding: 11px 15px; border-top: 1px solid var(--mkt-border-soft); transition: background 0.45s ease; }
        .bx-bf-ledger-row:first-of-type { border-top: none; }
        .bx-bf-ledger-row-on { background: var(--mkt-accent-green-soft); }
        .bx-bf-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
        /* Stämpeln: statusbrickan monteras om (React-key) i det ögonblick
           raden blir klar, så den här spelas exakt en gång per rad. */
        @keyframes bxBfStamp {
          0%   { opacity: 0; transform: scale(0.82); }
          60%  { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        .bx-bf-stamp { animation: bxBfStamp 0.42s cubic-bezier(0.22, 1, 0.36, 1) both; }

        /* Loggväggen: en oändligt rullande rad i stället för ett statiskt
           rutnät (kundönskemål, med startsidans egen bricka-med-namn-
           layout som förlaga). Rullningen är den DELADE .lp-marquee/
           .lp-marquee-track i MarketingLayout.jsx — samma fyra kopior,
           samma -25%-translateX, samma 28s och samma paus vid
           tangentbordsfokus som bolagsformsraden högre upp på startsidan
           redan kör. Bara formen på brickorna är egen.

           Ingen hovringsinteraktion här (till skillnad från MigrationFlow):
           brickorna rör sig under muspekaren, så ett "frys på den bank jag
           pekar på" hade blinkat fram och tillbaka så fort raden gled
           vidare. Auto-cykeln visar ändå alla banker.

           Lodrätt luft i .lp-marquee:s overflow: hidden — den aktiva
           brickans lyft (translateY) hade annars klippts av vid ovankanten. */
        .bx-bf-wall { width: 100%; padding: 10px 0 4px; }
        .bx-bf-wall-track { align-items: flex-start; }
        .bx-bf-wall-tile { display: flex; flex-direction: column; align-items: center; gap: 9px; flex-shrink: 0; }
        .bx-bf-wall-box {
          display: flex; align-items: center; justify-content: center; background: #fff;
          width: clamp(126px, 25vw, 178px); height: clamp(58px, 11.5vw, 80px); padding: 0 12px;
          border: 1.5px solid var(--mkt-card-border); border-radius: 15px; box-shadow: var(--mkt-card-shadow);
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.4s, box-shadow 0.4s;
        }
        .bx-bf-wall-box-other { background: var(--mkt-ivory); color: var(--mkt-muted); }
        .bx-bf-wall-on { transform: translateY(-5px); border-color: ${BRAND.green}; box-shadow: 0 12px 24px -12px rgba(28,36,32,0.45); }
        .bx-bf-wall-name { font-size: clamp(12px, 2.4vw, 14px); font-weight: 700; letter-spacing: -0.005em; transition: color 0.4s; }

        /* Under 480px räcker clamp():arna precis men inte mer — navets ring
           låg annars klistrad mot sektionens innerkant. Brickan/navet
           krymper ett snäpp till och ledningen suger upp överskottet
           (flex: 1), vilket dessutom ger paketet en tydligare resa. */
        @media (max-width: 480px) {
          .bx-bf-stage { gap: 9px; padding: 0 2px; }
          .bx-bf-tile { width: 96px; height: 58px; border-radius: 13px; }
          .bx-bf-hub { padding: 12px 12px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bx-bf-swap, .bx-bf-track, .bx-bf-packet, .bx-bf-halo, .bx-bf-stamp { animation: none !important; }
          .bx-bf-packet { opacity: 1; }
          .bx-bf-wall-box, .bx-bf-wall-name, .bx-bf-ledger-row { transition: none; }
        }
      `}</style>

      <div className="bx-bf-stage">
        {/* Akt 1 — banken man exporterar UR. key:en är hela poängen:
            React monterar om noden vid varje byte, vilket startar om
            svepet. */}
        <div className="bx-bf-side">
          <span key={active.id} className="bx-bf-tile bx-bf-swap">
            <BankLogo bank={active} maxW={86} maxH={68} />
          </span>
          <span key={`${active.id}-label`} className="bx-bf-label bx-bf-swap" style={{ color: MUTED }}>Ditt kontoutdrag</span>
        </div>

        {/* Akt 2 — filen på väg in. Ledningen är enkelriktad med flit, se
            ärlighetskravet i filkommentaren. */}
        <div className="bx-bf-pipe" aria-hidden>
          <div className="bx-bf-wire lp-flow-connector" style={{ backgroundImage: `linear-gradient(90deg, var(--mkt-card-border), ${BRAND.green}, var(--mkt-card-border))` }} />
          <div className="bx-bf-track">
            <span className="bx-bf-packet" style={{ background: BRAND.greenLight, color: BRAND.greenDark, border: `1px solid ${BRAND.green}` }}>{fileType}</span>
          </div>
        </div>

        <div className="bx-bf-side">
          <span className="bx-bf-hub">
            <span className="bx-bf-halo" aria-hidden />
            <BokixWordmark height="clamp(23px, 5.8vw, 30px)" />
          </span>
          <span className="bx-bf-label" style={{ color: INK }}>Bokfört i Bokix</span>
        </div>
      </div>

      {/* Akt 3 — raderna som stämplas klara, en per anlänt paket. */}
      {ledger && (
        <div className="bx-bf-ledger" aria-hidden>
          <div className="bx-bf-ledger-head">
            <span style={{ fontSize: '12px', fontWeight: 800, color: INK, letterSpacing: '-0.005em' }}>Kontoutdrag</span>
            <span key={active.id} className="bx-bf-swap" style={{ fontSize: '11px', fontWeight: 700, color: MUTED }}>{active.name}</span>
          </div>
          {LEDGER_ROWS.map((row, idx) => {
            const on = idx < doneRows;
            return (
              <div key={row.text} className={`bx-bf-ledger-row${on ? ' bx-bf-ledger-row-on' : ''}`}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.text}</div>
                  <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>{row.date}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: row.amount.startsWith('+') ? BRAND.greenDark : INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{row.amount}</span>
                  {on ? (
                    <span key="on" className="bx-bf-chip bx-bf-stamp" style={{ background: BRAND.greenLight, color: BRAND.greenDark }}>
                      <Check size={11} strokeWidth={3} /> {row.done}
                    </span>
                  ) : (
                    <span className="bx-bf-chip" style={{ background: 'var(--mkt-ivory)', color: MUTED, border: `1px solid ${CARD_BORDER}` }}>
                      Ej hanterad
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alla banker rullande förbi, med namn under precis som väljaren på
          /koppla-bank — plus "Annan bank" sist i varje varv, så raden
          aldrig kan läsas som "de här nio och inga andra". Den bank som
          just nu ligger i flödet ovanför lyfts, i alla kopior samtidigt.

          Fyra kopior (inte två): .lp-marquee-track:s -25%-translateX
          landar exakt på kopia 2 = sömlös loop. Bara den första kopian
          är läsbar för skärmläsare; resten är dekor. */}
      <div className="bx-bf-wall lp-marquee" tabIndex={0} aria-label="Banker vars kontoutdrag Bokix läser">
        <div className="bx-bf-wall-track lp-marquee-track">
          {[0, 1, 2, 3].map(copy => (
            WALL_ITEMS.map(item => {
              const on = item.id === active.id;
              return (
                <span
                  key={`${item.id}-${copy}`} aria-hidden={copy > 0}
                  className="bx-bf-wall-tile"
                >
                  <span className={`bx-bf-wall-box${item.other ? ' bx-bf-wall-box-other' : ''}${on ? ' bx-bf-wall-on' : ''}`}>
                    {item.other
                      ? <Landmark size={30} strokeWidth={1.6} />
                      : <BankLogo bank={item} maxW={86} maxH={68} />}
                  </span>
                  <span className="bx-bf-wall-name" style={{ color: on ? INK : MUTED }}>{item.name}</span>
                </span>
              );
            })
          ))}
        </div>
      </div>

      {note && (
        <p style={{ fontSize: '13.5px', color: MUTED, textAlign: 'center', margin: 0, maxWidth: '470px', lineHeight: 1.6 }}>
          Har du en annan bank? Bokix läser filen ändå — importen är en generell CSV/Excel-läsare där du kopplar kolumnerna själv, inte en integration mot varje enskild bank.
        </p>
      )}
    </div>
  );
}
