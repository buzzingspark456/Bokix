import React from 'react';

// Kundönskemål ("se till att de inte kan ta loggorna") — ett rimligt
// försök, INTE ett hårt skydd: högerklick-menyn och drag-ut-till-skrivbord
// stängs av på varenda <img> i den här filen, men bilderna laddas
// fortfarande ner till besökarens webbläsare för att kunna visas alls (det
// finns ingen väg runt det på en publik sida), så någon som verkligen vill
// åt filen kan alltid hämta den via devtools nätverksflik. Detta höjer bara
// tröskeln för ett vanligt högerklick/drag, gör det inte omöjligt.
const NO_SAVE_PROPS = {
  draggable: false,
  onContextMenu: (e) => e.preventDefault(),
  onDragStart: (e) => e.preventDefault(),
};
const noSaveStyle = (style) => ({ ...style, WebkitUserDrag: 'none', userSelect: 'none' });

// ── BILDSTORLEK ──
// Rasterfilerna i public/ är nedskalade till ungefär dubbla den storlek de
// FAKTISKT visas i (2× för skärmar med hög pixeltäthet), inte originalens
// fulla mått. Skälet är mätt, inte principiellt: startsidan laddade 639 kB
// bilder, varav Zettles logotyp ensam stod för 233 kB (två varianter à
// 3626×1612 pixlar, visade i 44 pixlars höjd). Efter nedskalningen är hela
// bildmängden ~91 kB.
//
// Byter någon ut en av filerna: skala ner den först. En 4000 pixlar bred
// PNG i en 40 pixlar hög bricka syns inte som skarpare — bara som en
// långsammare sida. `aspectRatio` nedan är ett FÖRHÅLLANDE och påverkas
// inte av nedskalningen, men måste stämma med den nya filens proportion.
//
// Alla loggor här ligger under första skärmen (trovärdighetsraden och
// "Kopplat till"-diagrammet) — därav loading="lazy" genomgående: de ska
// inte konkurrera med hjälten om bandbredden vid första målningen.

// ── Riktiga tredjeparts-varumärken Bokix faktiskt integrerar med — samma
// princip som BokixWordmark.jsx (delad, en enda källa) men för LOGGOR VI
// INTE ÄGER. Kopior av de redan granskade komponenterna i Settings.jsx
// (där de sitter bredvid de riktiga "Anslut X"-knapparna) — se respektive
// kommentar där för proveniens. Delade hit så LandingPage.jsx kan visa
// samma, riktiga loggor i sin "kopplat till"-sektion utan att duplicera
// paths/rasterbild-referenser på ett tredje ställe.
//
// Bolagsverket/Skatteverket/BAS — kundbeslut (kunden själv skickade
// loggobilderna och stod fast vid det efter att avvägningen lagts fram):
// riktiga logotyper för entiteter Bokix FAKTISKT integrerar mot
// (Bolagsverkets FöretagsAPI, useCompanyLookup.js; Skatteverkets eSKD-
// filformat; BAS-kontoplanen bokföringsmotorn bygger på), inte en
// hittepå-partnerlista. Rasterbilder (samma mönster som ZettleLogo), inte
// handritade SVG-approximationer av deras emblem — filerna måste sparas i
// public/ (bolagsverket-logo.png / skatteverket-logo.png / bas-logo.png)
// innan de faktiskt syns; tills dess visar <img> en trasig bild-ikon.
//
// GDPR-badgen (tolv EU-stjärnor i en ring med ordet "GDPR" i mitten) —
// KUNDBESLUT, taget om flera gånger; både att den ska visas och hur den
// ska se ut. Skiljer sig från de övriga märkena här på två sätt: den är
// RITAD, inte en inlånad bildfil (se GdprLogo nedan för varför), och den
// är ingen utfärdares
// logotyp — det finns ingen officiell "GDPR-certifiering" som någon delar
// ut. Etiketten bredvid är därför medvetet bara "GDPR" (se TRUST_POINTS i
// LandingPage.jsx) — inget påstående om revision eller certifikat, bara
// samma sak som resten av sajten redan säger: förordningen gäller oss och
// vi följer den (se /sakerhet och integritetspolicyn).

// Stripes eget ordmärke ("stripe"-texten) — riktig bildfil, public/
// stripe-wordmark.png, hämtad direkt från Stripes officiella Wikimedia
// Commons-fil ("Stripe Logo, revised 2016"), inte handritade vektorpaths
// längre. Kollat pixel för pixel: genuint transparent utanför bokstäverna,
// text-lila = #635bff (exakt samma "blurple" som den gamla handritade
// SVG:n raporterade). Ett eget, självständigt märke — funkar likadant i
// båda teman utan någon ljus/mörk-variant, samma anledning Zettle/
// Bolagsverket/Skatteverket INTE gör det (se ThemedLogo-kommentaren nedan).
export function StripeLogo({ height = 16 }) {
  const numeric = typeof height === 'number';
  return (
    <img
      src="/stripe-wordmark.png" alt="Stripe" loading="lazy"
      {...(numeric ? { height, width: height * (3840 / 1599) } : {})}
      style={noSaveStyle({ height, width: 'auto', objectFit: 'contain' })}
      {...NO_SAVE_PROPS}
    />
  );
}

// Stripes ikonmärke (den rundade lila fyrkanten med det vita "S"-märket) —
// EN ANNAN bildkälla än StripeLogo ovan, medvetet: kundönskemål specifikt
// för trovärdighetsraden ("Byggt efter svensk bokföringslag / GDPR /
// Kortbetalningar via Stripe / BAS-kontoplan") — "Kopplat till"-diagrammets
// egen Stripe-badge (StripeLogo, ordmärket) ska uttryckligen INTE ändras.
// public/stripe-icon-brandfetch.webp, hämtad från Brandfetchs CDN (kräver
// en webbläsarlik User-Agent/Referer — en bar curl utan dem blockeras som
// "automated_traffic" och omdirigeras till deras dokumentationssida, se
// .tmp-imgproc-historiken i den commit där filen lades till). Riktig WebP,
// inte konverterad till PNG (Playwright-miljöns medföljande ffmpeg saknar
// en webp-avkodare, och webbläsare hanterar .webp precis lika bra som
// .png i en <img>). Fyllt hela vägen ut till bildkanten (ingen inbyggd
// rundning eller transparens som det tidigare logo.dev-ikonmärket hade) —
// en egen border-radius mjukar upp hörnen istället.
export function StripeIconLogo({ height = 16 }) {
  return (
    <img
      src="/stripe-icon-brandfetch.webp" alt="Stripe" loading="lazy"
      height={typeof height === 'number' ? height : undefined}
      style={noSaveStyle({ height, width: 'auto', objectFit: 'contain', borderRadius: '22%' })}
      {...NO_SAVE_PROPS}
    />
  );
}

// Delad av loggorna nedan som behöver OLIKA bläckfärg per tema. Två
// färdigrenderade varianter renderas båda, och CSS (.lp-logo-light/
// .lp-logo-dark i MarketingLayout.jsx) visar bara den som matchar
// #lp-root[data-theme] — enda stället temat behöver läsas, ingen extra
// prop-tråd genom hela komponentträdet.
//
// Kundfeedback (tredje passet, efter att ha sett det live): mörkt bläck→
// ren vit (Zettle, Bolagsverket) respektive en ljusare (INTE ren vit)
// marinblå (Skatteverket, "lighter marin" — fortfarande tydligt marinblå,
// bara ljus nog att synas mot den mörkgröna cirkeln) i mörkt tema. Klart
// färgade detaljer (Zettles lila stripe, Skatteverket/Bolagsverkets gult)
// lämnas orörda i alla varianter.
function ThemedLogo({ lightSrc, darkSrc, alt, height, aspectRatio }) {
  const numeric = typeof height === 'number';
  const commonProps = numeric ? { height, width: height * aspectRatio } : { height: undefined };
  const style = noSaveStyle({ height, width: 'auto', objectFit: 'contain' });
  return (
    <>
      <img src={lightSrc} alt={alt} className="lp-logo-light" loading="lazy" {...commonProps} style={style} {...NO_SAVE_PROPS} />
      <img src={darkSrc} alt={alt} className="lp-logo-dark" loading="lazy" {...commonProps} style={style} {...NO_SAVE_PROPS} />
    </>
  );
}

// Zettles eget kombinerade ordmärke ("Zettle" + "by PayPal") — en riktig
// rasterbild (public/zettle-logo.png, hämtad rakt av från Zettles egen
// Wikimedia Commons-fil — public domain, "consists only of simple
// geometric shapes or text"), INTE ett handritat SVG-försök. Redan
// transparent — -dark.png återanvänder samma alfakanal, bara det marinblå
// bläcket ("Zettle"/"by PayPal"-texten) omfärgat till ren vit; lila
// diagonal-stripen i "Z":et är oförändrad i båda varianter.
// Kundönskemål ("by PayPal syns inte bra på mobil") — samma grundfel som
// Bolagsverket/Skatteverket hade: en FAST height/width höll inte den
// krympande badgen med sig, så den lilla "by PayPal"-raden hamnade nära
// den runda klippningen på smala skärmar. `height` tar nu även en
// CSS-sträng (clamp()) — width:'auto' låter <img> sköta bildens egen
// bredd/höjd-ratio precis som webbläsaren redan gör för vanliga bilder.
export function ZettleLogo({ height = 18 }) {
  return <ThemedLogo lightSrc="/zettle-logo.png" darkSrc="/zettle-logo-dark.png" alt="Zettle by PayPal" height={height} aspectRatio={3626 / 1612} />;
}

// Bolagsverkets eget ordmärke (blomma-ikonen + "Bolagsverket"-texten) —
// ursprungligen public/bolagsverket-logo.jpg (vit bakgrund inbakad, JPEG
// har ingen alfakanal), hämtad från en nyhetsartikel som återgett den
// (usercontent.one/orebronyheter.com), inte Bolagsverkets egen sajt direkt
// — samma logga, men värd att byta mot en förstahandskälla om en bättre
// dyker upp. -light.png/-dark.png (se ThemedLogo-kommentaren ovan) är de
// faktiska bildkällorna nu, den ursprungliga .jpg:en ligger kvar orörd som
// råmaterial ifall bilderna någonsin behöver köras om. Texten i -dark.png
// är ren vit (255,255,255) — kundönskemål efter första passets något
// gråaktiga ton (235/236/232), ville ha den "vitare" för mer kontrast/pop.
export function BolagsverketLogo({ height = 18 }) {
  return <ThemedLogo lightSrc="/bolagsverket-logo-light.png" darkSrc="/bolagsverket-logo-dark.png" alt="Bolagsverket" height={height} aspectRatio={420 / 470} />;
}

// Skatteverkets eget ordmärke (virvel-ikonen + "Skatteverket"-texten) —
// ursprungligen public/skatteverket-logo.jpg, en kvadratisk profilbilds-
// version (Twitter/X), inte deras officiella pressbild, men rätt logga.
// -light.png/-dark.png: båda utgår från samma nyckning (vit bakgrund→
// riktig transparens, JPG:en hade ingen alfakanal), och båda omfärgar
// virveln (raderna ovanför tomrummet mellan ikon och text, y<245 i
// originalbilden) till en äkta blå (#0060A8, samma ton som Bolagsverkets
// blå prickar — "blue like bolagsverket", kundönskemål: blå i BÅDA teman,
// inte bara mörkt). Skillnaden mellan de två filerna är bara TEXTEN
// ("Skatteverket", y≥245): oförändrad mörk marin i -light.png (läsbar mot
// en ljus cirkel), ren vit i -dark.png (läsbar mot den mörkgröna). Gult i
// virveln orört i båda.
export function SkatteverketLogo({ height = 18 }) {
  return <ThemedLogo lightSrc="/skatteverket-logo-light.png" darkSrc="/skatteverket-logo-dark.png" alt="Skatteverket" height={height} aspectRatio={400 / 400} />;
}

// GDPR-badgen — tolv gula EU-stjärnor i en ring med ordet GDPR mörkblått i
// mitten. Se kommentaren högst upp i filen för vad märket är och inte är.
//
// FORMEN ÄR KUNDENS VAL, andra gången. Först var det EU-flaggan med ett
// hänglås; nu stjärnringen utan platta, efter att kunden pekat ut ett
// exempel på en annan sajt. Båda gångerna har förlagan varit någon annans
// bildfil (först en licensierad stockbild, sedan en ikon från ett
// kommersiellt bolags webbplats), och båda gångerna är märket RITAT här i
// stället för nedladdat.
//
// Det är inte krångel för krånglets skull: motivet i sig är fritt — EU:s
// stjärnkrans är en officiell symbol som får återges (gult #FFCC00, tolv
// stjärnor på en cirkel), och fyra versaler är ingens upphovsrätt — medan
// någon annans FIL är deras. Att rita det ger dessutom två saker en
// rasterbild inte kan: knivskarpt i varje storlek (märket sitter i en ~50px
// hög bricka) och ett läsbart "GDPR" även nedskalat, där förlagans ord blir
// en fläck.
//
// Blå platta med vit text (kundens val, tredje vändan): märket bär sin egen
// bakgrund och fungerar därför likadant i ljust och mörkt läge, till
// skillnad från versionen med mörkblå text som krävde en ljus yta under.
export function GdprLogo({ height = 18 }) {
  const numeric = typeof height === 'number';
  // Kvadratiskt märke: stjärnringen med ordet i mitten, ingen flaggplatta.
  const width = numeric ? height : undefined;
  return (
    <svg
      viewBox="180 30 540 540" role="img" aria-label="GDPR"
      {...(numeric ? { width, height } : {})}
      style={noSaveStyle({ height, width: numeric ? width : 'auto', display: 'block' })}
      {...NO_SAVE_PROPS}
    >
      {/* EU-blå platta bakom hela märket. Rundade hörn, inte en cirkel:
          märket står bredvid andra fyrkantiga logotyper i samma rad, och en
          disc hade legat och skavt mot dem. */}
      <rect x="180" y="30" width="540" height="540" rx="66" fill="#003399" />
      {/* EU-stjärnorna: tolv stycken på en cirkel med radie 210 kring
          (450,300) — samma koordinater som märket haft hela tiden. */}
      <g fill="#FFCC00">
        <polygon points="450.0,42.0 456.7,62.7 478.5,62.7 460.9,75.5 467.6,96.3 450.0,83.5 432.4,96.3 439.1,75.5 421.5,62.7 443.3,62.7" />
        <polygon points="564.0,72.5 570.7,93.3 592.5,93.3 574.9,106.1 581.6,126.8 564.0,114.0 546.4,126.8 553.1,106.1 535.5,93.3 557.3,93.3" />
        <polygon points="647.5,156.0 654.2,176.7 676.0,176.7 658.4,189.5 665.1,210.3 647.5,197.5 629.8,210.3 636.6,189.5 618.9,176.7 640.7,176.7" />
        <polygon points="678.0,270.0 684.7,290.7 706.5,290.7 688.9,303.5 695.6,324.3 678.0,311.5 660.4,324.3 667.1,303.5 649.5,290.7 671.3,290.7" />
        <polygon points="647.5,384.0 654.2,404.7 676.0,404.7 658.4,417.5 665.1,438.3 647.5,425.5 629.8,438.3 636.6,417.5 618.9,404.7 640.7,404.7" />
        <polygon points="564.0,467.5 570.7,488.2 592.5,488.2 574.9,501.0 581.6,521.7 564.0,508.9 546.4,521.7 553.1,501.0 535.5,488.2 557.3,488.2" />
        <polygon points="450.0,498.0 456.7,518.7 478.5,518.7 460.9,531.5 467.6,552.3 450.0,539.5 432.4,552.3 439.1,531.5 421.5,518.7 443.3,518.7" />
        <polygon points="336.0,467.5 342.7,488.2 364.5,488.2 346.9,501.0 353.6,521.7 336.0,508.9 318.4,521.7 325.1,501.0 307.5,488.2 329.3,488.2" />
        <polygon points="252.5,384.0 259.3,404.7 281.1,404.7 263.4,417.5 270.2,438.3 252.5,425.5 234.9,438.3 241.6,417.5 224.0,404.7 245.8,404.7" />
        <polygon points="222.0,270.0 228.7,290.7 250.5,290.7 232.9,303.5 239.6,324.3 222.0,311.5 204.4,324.3 211.1,303.5 193.5,290.7 215.3,290.7" />
        <polygon points="252.5,156.0 259.3,176.7 281.1,176.7 263.4,189.5 270.2,210.3 252.5,197.5 234.9,210.3 241.6,189.5 224.0,176.7 245.8,176.7" />
        <polygon points="336.0,72.5 342.7,93.3 364.5,93.3 346.9,106.1 353.6,126.8 336.0,114.0 318.4,126.8 325.1,106.1 307.5,93.3 329.3,93.3" />
      </g>
      {/* Ordet i ringens mitt. text-anchor="middle" + dominant-baseline
          gör centreringen själv; den gamla versionen hade uppmätta
          x-värden eftersom låset låg bredvid texten och gruppen skulle
          centreras som helhet. Nu finns inget lås, så texten centrerar
          sig kring 450 utan handpåläggning. */}
      <text
        x="450" y="300" fill="#ffffff"
        fontSize="118" fontWeight="800" letterSpacing="1"
        textAnchor="middle" dominantBaseline="central"
        fontFamily="Inter, 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"
      >GDPR</text>
    </svg>
  );
}

// Märket för "Byggt efter svensk bokföringslag" — svenska flaggan.
// RITAT här, som GDPR-brickan ovanför, och
// av ett viktigare skäl än där: det FINNS ingen logotyp för bokföringslagen
// att låna. Bokföringsnämnden har en egen logotyp, men den är deras — att
// sätta en myndighets märke bredvid ett påstående om vår produkt läser som
// ett godkännande vi inte har, och det vore fel oavsett hur väl vi följer
// deras regler.
//
// Flaggan är däremot en nationell symbol som fritt får återges, och den
// säger exakt vad etiketten bredvid säger: svensk lag. Inget certifikat,
// ingen utfärdare, ingen revision — samma linje som GDPR-brickan (se
// kommentaren där). Här satt först ett paragraftecken i korsets mitt; det
// togs bort på kundens begäran, flaggan ska vara flaggan.
//
// Flaggans EGNA proportioner (16:10) och korsbandens officiella lägen —
// inte en kvadratisk bricka med ett kors i. En flagga som är fel formad
// läser som en ungefärlig flagga, och det är värre än ingen alls.
// Bandbredd 2 av 16, lodrätt band från x=5, vågrätt från y=4.
export function BokforingslagLogo({ height = 18 }) {
  const numeric = typeof height === 'number';
  const width = numeric ? Math.round(height * 1.6) : undefined;
  return (
    <svg
      viewBox="0 0 16 10" role="img" aria-label="Sverige"
      {...(numeric ? { width, height } : {})}
      style={noSaveStyle({ height, width: numeric ? width : 'auto', display: 'block', borderRadius: '7%' })}
      {...NO_SAVE_PROPS}
    >
      <rect width="16" height="10" fill="#006AA7" />
      <g fill="#FECC00">
        <rect x="5" y="0" width="2" height="10" />
        <rect x="0" y="4" width="16" height="2" />
      </g>
    </svg>
  );
}

// BAS-kontogruppens egen logotyp — public/bas-logo.jpg, hämtad direkt
// från bas.se/om-bas/logotyp/ (deras egen sida för nedladdning av
// logotypen), den enda av de fyra som kommer rakt från förstahandskällan.
// Liten originalfil (140×80) med deras egen tagline "inte bara en
// kontoplan" inbakad i bilden — äkta, bara lågupplöst.
export function BasLogo({ height = 18 }) {
  return (
    <img
      src="/bas-logo.jpg" alt="BAS-kontoplan" height={height} loading="lazy"
      style={noSaveStyle({ height, width: 'auto', objectFit: 'contain' })}
      {...NO_SAVE_PROPS}
    />
  );
}

// ── Logotyp för ett ANNAT bokföringsprogram (det man byter FRÅN) ──
// Egen, medvetet enklare komponent än de namngivna integrationsloggorna
// ovan: de är en handfull fasta partners med var sin proveniens-
// kommentar, det här är en datadriven lista (src/utils/migrationSources.js)
// som ska kunna växa med en rad. Filerna ligger i public/logos/.
//
// Alla sju filerna är symbolmärken (ingen ordbild) i ungefär kvadratiskt
// format, men INTE exakt samma proportion — därför en fast kvadratisk
// ruta med objectFit: contain, så en aning bredare märke (Wint, 256×205)
// inte blir högre eller bredare än de andra i samma rad. Vit platta
// bakom (sätts av anropsstället, inte här): flera av bilderna har egen
// vit bakgrund inbakad och skulle se ut som klistermärken mot en mörk yta.
//
// Samma NO_SAVE_PROPS som resten av filen — se kommentaren högst upp för
// vad det gör (och inte gör).
export function ProgramLogo({ src, alt, size = 26 }) {
  return (
    <img
      src={src} alt={alt} width={size} height={size} loading="lazy"
      style={noSaveStyle({ width: size, height: size, objectFit: 'contain', display: 'block' })}
      {...NO_SAVE_PROPS}
    />
  );
}

// ── Logotyp för en BANK man exporterar sitt kontoutdrag ur ──
// Egen komponent, inte ProgramLogo ovan, av EN konkret anledning: de sju
// bokföringsprogrammens filer är alla ungefär kvadratiska symbolmärken
// och kan därför bo i en fast kvadratisk ruta. Banklogotyperna är tvärtom
// nästan alla ordbilder i vitt skilda proportioner — 9,7:1 (Handelsbanken)
// till 0,97:1 (Northmill) — och en fast kvadrat hade antingen krympt
// ordbilderna till oläsliga streck eller låtit den kvadratiska svälla ut
// ur raden.
//
// Måtten är därför PROCENT av den omgivande brickan (som alltid har en
// bestämd storlek på anropsstället), inte pixlar: `objectFit: contain` mot
// ett tak i BÅDA riktningar låter varje märke växa tills det slår i det
// mått som begränsar just det — bredden för en ordbild, höjden för en
// staplad lockup — utan en enda uppmätning i JS. `scale` (per bank, se
// bankSources.js) är den optiska finjusteringen ovanpå det: en kvadratisk
// lockup med samma höjdtak som en ordbild SER hälften så stor ut, och
// `radius` rundar de banker vars märke är en solid färgplatta (SEB,
// Lunar) i stället för en fristående ordbild.
//
// Vit platta bakom sätts av anropsstället, inte här — flera av filerna har
// egen vit bakgrund inbakad och skulle se ut som klistermärken mot en mörk
// yta. Samma NO_SAVE_PROPS som resten av filen (se kommentaren högst upp
// för vad det gör och inte gör).
export function BankLogo({ bank, maxW = 76, maxH = 56 }) {
  const scale = bank.scale || 1;
  return (
    <img
      src={bank.logo} alt={bank.name} loading="lazy"
      style={noSaveStyle({
        maxWidth: `${maxW * scale}%`, maxHeight: `${maxH * scale}%`,
        width: 'auto', height: 'auto', objectFit: 'contain', display: 'block',
        ...(bank.radius ? { borderRadius: bank.radius } : null),
      })}
      {...NO_SAVE_PROPS}
    />
  );
}
