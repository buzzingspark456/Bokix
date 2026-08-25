import React from 'react';
import GuideLayout, { Link, h2, p, ul, li, note } from './GuideLayout';
import { GUIDE_FAQ } from './guidesFaq';

const FAQ = GUIDE_FAQ['valja-bokforingsprogram'];

export default function GuideValjaBokforingsprogram() {
  return (
    <GuideLayout slug="valja-bokforingsprogram" faq={FAQ}>
      <p style={p}>
        Sverige har flera etablerade bokföringsprogram — Fortnox, Bokio och Visma eEkonomi (numera Spiris) är förmodligen de tre du stöter på först i en sökning, vid sidan av nyare alternativ som Bokix. De löser i grunden samma sak (löpande bokföring, fakturering, moms), men skiljer sig påtagligt i hur de prissätter det.
      </p>

      <h2 style={h2}>Fråga 1: Vad ingår faktiskt i grundpriset?</h2>
      <p style={p}>
        Det här är den viktigaste jämförelsepunkten, och den som är lättast att missa. Flera stora program säljer bokföring i nivåer (t.ex. en billig startnivå och dyrare nivåer ju mer du behöver), och lägger lön respektive bokslutshjälp som separata, betalda tillägg ovanpå grundpriset. Ett grundpris som ser lågt ut kan alltså landa betydligt högre när du räknat med det du faktiskt behöver.
      </p>
      <div style={note}>
        Räkna alltid ut totalpriset för EXAKT det du behöver (bokföring + fakturering + ev. lön + ev. bokslutsunderlag) innan du jämför två leverantörers grundpris rakt av mot varandra.
      </div>

      <h2 style={h2}>Fråga 2: Passar prismodellen din bolagsform?</h2>
      <p style={p}>
        Vissa leverantörer prissätter olika beroende på om du driver enskild firma eller aktiebolag, med aktiebolag på en dyrare nivå. Om du planerar att gå från enskild firma till aktiebolag längre fram är det värt att kolla om priset följer med upp automatiskt eller om det innebär ett byte av plan.
      </p>

      <h2 style={h2}>Fråga 3: Vad händer om du växer ur planen?</h2>
      <p style={p}>
        Nivåbaserade program har ofta gränser (antal verifikat, antal fakturor, antal anställda i lönemodulen) där du behöver uppgradera till en dyrare nivå. Ett flatt allt-i-ett-pris slipper den typen av trappsteg, men kolla ändå om det finns en övre gräns där även ett flatt pris slutar räcka till.
      </p>

      <h2 style={h2}>Fråga 4: Bindningstid och uppsägning</h2>
      <p style={p}>
        Vissa program erbjuder ett lägre pris mot årsbindning, med ett högre pris vid månadsvis betalning. Om du fortfarande utvärderar om programmet passar dig är det värt att först betala månadsvis, även om det kostar lite mer per månad, tills du är säker.
      </p>

      <h2 style={h2}>Så jämför Bokix</h2>
      <p style={p}>
        Bokix har medvetet valt bort nivåer och tillägg: ett pris (99 kr/mån exkl. moms) med bokföring, fakturering, lönekörning och deklarationsunderlag inkluderat, oavsett bolagsform, plus 30 dagar gratis att testa allt innan du behöver betala något. Se detaljerade sida-vid-sida-jämförelser:
      </p>
      <ul style={ul}>
        <li style={li}><Link to="/jamfor/fortnox" style={{ color: 'inherit', fontWeight: 600 }}>Bokix vs Fortnox</Link></li>
        <li style={li}><Link to="/jamfor/bokio" style={{ color: 'inherit', fontWeight: 600 }}>Bokix vs Bokio</Link></li>
        <li style={li}><Link to="/jamfor/visma-eekonomi" style={{ color: 'inherit', fontWeight: 600 }}>Bokix vs Visma eEkonomi</Link></li>
      </ul>
      <p style={p}>
        Eller se <Link to="/priser" style={{ color: 'inherit', fontWeight: 600 }}>allt som ingår i Bokix priset</Link> direkt.
      </p>
    </GuideLayout>
  );
}
