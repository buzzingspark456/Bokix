import { PolicyLayout, PolicySection, PolicyTable, PolicyCode, PolicyCallout, policyP } from './marketing/PolicyLayout';

// JURIDISKT UTKAST, INTE GRANSKAT. Texten på den här sidan (liksom
// PrivacyPolicy.jsx och TermsPolicy.jsx) är ett första utkast, inte ett
// färdiggranskat juridiskt dokument. Innan den här sidan går live i
// produktion måste: (1) en jurist faktiskt läsa igenom och godkänna
// innehållet, (2) företagets organisationsnummer och adress verifieras
// mot den faktiska, aktuella informationen (ingen platshållartext finns i
// den här filen idag, men kontrollera ändå att inget hunnit bli inaktuellt
// mellan detta utkast och lanseringen).
//
// Kundönskemål ("gör policysidorna organiserade") — samma ombyggnad som
// TermsPolicy.jsx: från en fristående vit box utan sajt-header/footer och
// hårdkodade ljusa hexfärger, till samma delade PolicyLayout-system som
// PrivacyPolicy.jsx. Sakinnehållet (kakornas namn/typ/ändamål/livslängd)
// är verifierat mot faktisk kod vid ombyggnaden — inte bara omflyttat:
// src/utils/consent.js (bokix_cookie_consent, 365 dagar), public/
// consent-init.js (GA-mätid G-9KXP9XW3MW, Clarity), api/stripe/_cookies.js
// (bokix_stripe_oauth_state), App.jsx (bokforing_data/_owner,
// bokix_onboarding_completed/_skipped) — allt stämde redan, inget påhittat.
export default function CookiesPolicy() {
  return (
    <PolicyLayout
      title="Cookiepolicy"
      path="/cookies"
      updated="2026-09-29"
      metaTitle="Cookiepolicy | Bokix"
      metaDescription="Exakt vilka cookies och liknande lagringstekniker Bokix sätter i din webbläsare, och hur du hanterar ditt samtycke."
    >
      <PolicySection n={1} title="Sammanfattning" first>
        <PolicyCallout>
          Bokix använder inga marknadsförings- eller reklamcookies. Vi använder Google Analytics, Microsoft Clarity och PostHog för grundläggande besöksstatistik, men bara om du aktivt godkänt det i cookiebannern — ingen av dem sätts innan du sagt ja.
        </PolicyCallout>
        <p style={policyP}>
          De nödvändiga cookies nedan kräver inget samtycke enligt gällande regler (de behövs för att logga in och för att tjänsten ska fungera), men analyscookies gör det, och sätts bara efter att du klickat "Acceptera alla" i cookiebannern som visas vid ditt första besök.
        </p>
      </PolicySection>

      <PolicySection n={2} title="Strikt nödvändiga — inloggning och session">
        <PolicyTable
          head={['Namn', 'Typ', 'Ändamål', 'Livslängd']}
          rows={[
            [<PolicyCode>sb-*-auth-token</PolicyCode>, 'sessionStorage (localStorage i appen på hemskärmen)', 'Håller dig inloggad (sätts av vår inloggningsleverantör Supabase). I webbläsaren så länge fliken är öppen, i appen på hemskärmen tills du loggar ut.', 'Tills fliken stängs eller du loggar ut'],
            [<PolicyCode>bokforing_data</PolicyCode>, 'localStorage', 'Lokal cachekopia av din bokföringsdata, så appen fungerar även vid tillfälligt avbrott mot servern.', 'Tills du loggar ut (rensas automatiskt), skrivs över, eller rensas manuellt'],
            [<PolicyCode>bokforing_data_owner</PolicyCode>, 'localStorage', 'Kommer ihåg VILKET konto den lokala cachekopian ovan tillhör, så att om flera olika Bokix-konton loggar in i samma webbläsare (t.ex. en delad dator) visas aldrig en annan användares cachade data av misstag.', 'Tills du loggar ut (rensas automatiskt), skrivs över, eller rensas manuellt'],
            [<>
              <PolicyCode>bokix_onboarding_completed</PolicyCode> / <PolicyCode>_skipped</PolicyCode>
            </>, 'localStorage', 'Kommer ihåg om du gått igenom (eller hoppat över) startguiden, så den inte visas igen i onödan.', 'Tills du rensar webbläsardata'],
            [<>
              <PolicyCode>bokix_theme*</PolicyCode>, <PolicyCode>bokix_language</PolicyCode>, <PolicyCode>bokix_nav_collapsed</PolicyCode> m.fl.
            </>, 'localStorage', 'Kommer ihåg dina val för utseende och språk: ljust eller mörkt läge, färg, täthet, språk och vilka menygrupper som är ihopfällda.', 'Tills du ändrar valet eller rensar webbläsardata'],
            [<PolicyCode>bokix_ocr_*</PolicyCode>, 'localStorage', 'Sparar texten som lästs av från dina senaste kvitton, så att samma kvitto inte behöver läsas av igen. Högst 40 kvitton.', 'Tills den byts ut av nyare kvitton eller du rensar webbläsardata'],
          ]}
        />
      </PolicySection>

      <PolicySection n={3} title="Strikt nödvändiga — säkerhet vid anslutning till Stripe och Zettle">
        <PolicyTable
          head={['Namn', 'Typ', 'Ändamål', 'Livslängd']}
          rows={[
            [<PolicyCode>bokix_stripe_oauth_state</PolicyCode>, 'Cookie (httpOnly)', 'Skyddar mot förfalskade anslutningsförsök (CSRF) under de sekunder det tar att ansluta Stripe för kortbetalningar. Sätts bara om du aktivt startar den anslutningen under Inställningar.', 'Max 10 minuter, raderas direkt efter anslutningen'],
            [<PolicyCode>bokix_zettle_oauth_state</PolicyCode>, 'Cookie (httpOnly)', 'Samma skydd när du kopplar din Zettle-kassa. Sätts bara om du aktivt startar den anslutningen under Inställningar.', 'Max 10 minuter, raderas direkt efter anslutningen'],
          ]}
        />
      </PolicySection>

      <PolicySection n={4} title="Strikt nödvändiga — bot-/missbruksskydd">
        <p style={policyP}>
          Vid registrering och inloggning använder vi Vercel BotID för att skilja riktiga användare från automatiserade missbruksförsök. På kontaktformuläret gör Google reCAPTCHA samma sak, och kan då sätta egna cookies (till exempel <PolicyCode>_GRECAPTCHA</PolicyCode>). Ingen av dem används för spårning eller marknadsföring.
        </p>
      </PolicySection>

      <PolicySection n={5} title="Analys — kräver ditt samtycke">
        <p style={policyP}>
          Vi använder Google Analytics, Microsoft Clarity och PostHog för att förstå hur besökare hittar och använder Bokix — Clarity visar oss dessutom var på sidan besökare klickar och scrollar (skärminspelningar och klickkartor), men Microsoft maskerar all text och alla inmatningsfält som kan innehålla personlig eller känslig information innan något sparas. Google Analytics och Clarity körs via samma princip: mätscripten laddas alltid, men sätts uttryckligen till "nekad" (denied) tills du valt "Acceptera alla" i cookiebannern. Väljer du "Endast nödvändiga" stannar analys-cookies nekade, permanent, tills du själv ändrar dig via "Cookieinställningar" i sidfoten. Vi har inte kopplat något annonskonto till Clarity, så de av Clarity/Microsofts cookies som annars används för annonsering (t.ex. <PolicyCode>MUID</PolicyCode>) sätts aldrig av Bokix.
        </p>
        <p style={policyP}>
          PostHog (EU-molnet, Frankfurt) använder vi bara för att räkna sidvisningar, så att vi ser vilka sidor som besöks. Allt annat PostHog kan göra har vi medvetet stängt av: ingen sessionsinspelning, inga klickkartor, ingen automatisk loggning av vad du klickar på eller skriver, och ingen mätning av felmeddelanden eller sidprestanda. Till skillnad från Google Analytics och Clarity sätter PostHog ingenting alls i din webbläsare förrän du klickat "Acceptera alla" — det enda som sparas dessförinnan är en liten notering om att du sagt nej, så att valet respekteras.
        </p>
        <PolicyTable
          head={['Namn', 'Typ', 'Ändamål', 'Livslängd']}
          rows={[
            [<>
              <PolicyCode>_ga</PolicyCode> / <PolicyCode>_gid</PolicyCode>
            </>, 'Cookie (Google Analytics)', 'Skiljer besökare åt för anonymiserad besöksstatistik. Sätts bara efter att du klickat "Acceptera alla".', '_ga: 2 år, _gid: 24 timmar'],
            [<>
              <PolicyCode>_clck</PolicyCode> / <PolicyCode>_clsk</PolicyCode> / <PolicyCode>CLID</PolicyCode>
            </>, 'Cookie (Microsoft Clarity)', 'Håller isär besökare och kopplar ihop sidvisningar till samma besök, för skärminspelningar och klickstatistik. Sätts bara efter att du klickat "Acceptera alla".', '_clck/CLID: 1 år, _clsk: 1 dag'],
            [<PolicyCode>ph_*_posthog</PolicyCode>, 'Cookie och localStorage (PostHog)', 'Ger webbläsaren ett slumpat, anonymt id så att sidvisningar från samma besök hänger ihop. Sätts bara efter att du klickat "Acceptera alla".', 'Cookie: 1 år. localStorage: tills du rensar webbläsardata'],
            [<PolicyCode>__ph_opt_in_out_*</PolicyCode>, 'localStorage (PostHog)', 'Kommer ihåg om du tackat ja eller nej till PostHog, så att valet respekteras vid nästa besök. Innehåller inget id.', 'Tills du rensar webbläsardata'],
            [<PolicyCode>bokix_cookie_consent</PolicyCode>, 'Cookie', 'Kommer ihåg ditt val i cookiebannern (accepterat eller nekat), så bannern inte visas på varje besök.', '12 månader'],
          ]}
        />
        <p style={policyP}>
          Inga marknadsförings- eller reklamcookies används, oavsett vad du väljer i bannern. Vill du ändra ditt tidigare val, klicka "Cookieinställningar" längst ner på vilken sida som helst.
        </p>
      </PolicySection>

      <PolicySection n={6} title="Hur du kan hantera cookies">
        <p style={policyP}>
          Du kan blockera eller radera cookies och localStorage i din webbläsares inställningar när som helst. De nödvändiga cookies ovan krävs för grundfunktionen, så att blockera dem innebär att du blir utloggad och att onboarding-guiden kan visas igen, men ingen data i din faktiska bokföring påverkas (den ligger sparad hos oss, inte bara lokalt).
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
