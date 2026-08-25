import React from 'react';
import GuideLayout, { Link, h2, p, ul, li, note } from './GuideLayout';
import { GUIDE_FAQ } from './guidesFaq';

const FAQ = GUIDE_FAQ['enskild-firma-bokforing'];

export default function GuideEnskildFirma() {
  return (
    <GuideLayout slug="enskild-firma-bokforing" faq={FAQ}>
      <p style={p}>
        Som enskild firma är du personligen bokföringsskyldig från den dag du startar verksamheten — det finns ingen nedre omsättningsgräns där bokföringsplikten börjar gälla. Den här guiden går igenom vad du faktiskt behöver hålla koll på löpande, i vanligt språk, utan att ersätta rådgivning från Skatteverket eller en redovisningskonsult för din specifika situation.
      </p>

      <h2 style={h2}>1. Vad räknas som bokföring?</h2>
      <p style={p}>
        Varje affärshändelse — en försäljning, ett inköp, en kortbetalning, en insättning från ditt privata konto till firman — ska bokföras som en verifikation med underlag (kvitto, faktura). Bokföringen ska normalt ske löpande, inte samlas ihop en gång om året. Praktiskt innebär det att du sparar varje kvitto och varje faktura, och att varje sådan händelse går att koppla till ett underlag i efterhand.
      </p>

      <h2 style={h2}>2. F-skatt och preliminärskatt</h2>
      <p style={p}>
        När du registrerar din enskilda firma hos Skatteverket ansöker du samtidigt om F-skatt (eller FA-skatt om du även har en anställning vid sidan av). F-skattsedeln innebär att du själv ansvarar för att betala in preliminär skatt och egenavgifter löpande under året, baserat på en uppskattning av din vinst — Skatteverket drar inte skatten åt dig som en arbetsgivare gör för en anställd.
      </p>
      <div style={note}>
        Uppskatta hellre din vinst lite väl högt än för lågt när du sätter din preliminärskatt — annars riskerar du kvarskatt med kostnadsränta året efter.
      </div>

      <h2 style={h2}>3. Moms — registrering och gränser</h2>
      <p style={p}>
        Sedan 1 januari 2025 behöver du inte momsregistrera dig om din årsomsättning (exklusive moms) är 120 000 kr eller lägre — tidigare låg gränsen på 80 000 kr. Väntas omsättningen överstiga gränsen ska du registrera dig för moms redan innan du säljer för mer. Din redovisningsperiod (hur ofta du deklarerar moms) beror sedan på din beräknade årsomsättning:
      </p>
      <ul style={ul}>
        <li style={li}>Omsättning under ca 1 miljon kr/år — kan välja årsmoms.</li>
        <li style={li}>Omsättning under 40 miljoner kr/år — kvartalsvis momsredovisning.</li>
        <li style={li}>Högre omsättning — månadsvis momsredovisning.</li>
      </ul>
      <p style={{ ...p, fontSize: '13px', color: 'var(--mkt-muted)' }}>
        Gränser och belopp ändras då och då i budgetpropositioner — kontrollera alltid aktuella siffror på <a href="https://www.skatteverket.se" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>skatteverket.se</a> innan du fattar beslut baserat på dem.
      </p>

      <h2 style={h2}>4. Löpande bokföring i praktiken</h2>
      <p style={p}>
        I praktiken handlar löpande bokföring om tre saker som upprepas hela tiden: (1) registrera varje intäkt och kostnad som en verifikation kopplad till rätt konto i kontoplanen (BAS-kontoplanen är standard i Sverige), (2) spara underlaget (kvitto/faktura) så det går att styrka i efterhand, och (3) stämma av att bokföringen och det faktiska banksaldot går ihop. Ett bokföringsprogram som bokför det mesta automatiskt utifrån dina banktransaktioner, och lägger det osäkra i en granskningskö istället för att gissa, gör det här avsevärt mindre tidskrävande än att sköta det i ett kalkylark.
      </p>

      <h2 style={h2}>5. Vid årets slut</h2>
      <p style={p}>
        En enskild firma gör inte ett formellt bokslut på samma sätt som ett aktiebolag, men du behöver ett förenklat årsbokslut eller ett årsbokslut (beroende på omsättning) samt underlag till din NE-bilaga i inkomstdeklarationen. Ju bättre den löpande bokföringen skötts under året, desto mindre arbete återstår vid årsskiftet.
      </p>

      <p style={p}>
        Läs vidare: <Link to="/guider/momsdeklaration" style={{ color: 'inherit', fontWeight: 600 }}>momsdeklaration steg för steg</Link>, eller se hur <Link to="/priser" style={{ color: 'inherit', fontWeight: 600 }}>Bokix hanterar det här automatiskt</Link>.
      </p>
    </GuideLayout>
  );
}
