/**
 * Bokix varumärkesfärger — den enda källan för accentfärg i appen.
 *
 * Projektet använder inte Tailwind (inline style-objekt + CSS-variabler i
 * index.css är konventionen), så det här är motsvarigheten till en
 * `accent: '#3d7a2e'`-post i en tailwind.config: en enda plats att ändra en
 * nyans på, istället för att hex-koder hårdkodas separat i varje komponent.
 *
 * index.css `--accent`-familjen pekar på samma toner (se :root), för de få
 * ställen som styr färg via CSS-variabel istället för inline style.
 *
 * Status-fälten (greenLight/amberBg/redBg/grayBg + deras *Text-motsvarigheter)
 * pekar på CSS-variabler (--status-*, index.css), INTE längre literal hex —
 * så mörkt läge (säkerhetsgranskningen/mörkgrön-önskemålet) kan skriva om
 * dem till en mörk, läsbar variant utan att de hundratals ställen som
 * konsumerar BRAND.greenLight/BRAND.redText osv. behöver ändras. `green`/
 * `greenHover` (knappar, logga, sidopanelens fasta gröna bakgrund) förblir
 * literal hex med flit — sidopanelen är samma gröna yta oavsett tema, inte
 * en "surface" som ska mörkna.
 */
export const BRAND = {
  green: '#0b6329',       // Primär accent: knappar, logga — samma nyans som sidopanelen (--bg-sidebar)
  greenHover: '#094f21',
  greenDark: 'var(--status-green-text)',  // Text på ljusgrön bakgrund (aktiv menypunkt, positiv badge)
  greenLight: 'var(--status-green-bg)',   // Bakgrund: aktiv menypunkt, positiv badge, avatar-cirkel
  amberBg: 'var(--status-amber-bg)',      // Neutral "inte aktiverat"-badge, bakgrund (inte röd — inget fel)
  amberText: 'var(--status-amber-text)',  // Neutral "inte aktiverat"-badge, text
  redBg: 'var(--status-red-bg)',          // Verkligt fel/varning (t.ex. förfallen faktura), bakgrund
  redText: 'var(--status-red-text)',      // Verkligt fel/varning, text
  grayBg: 'var(--status-gray-bg)',        // Neutral "inget hänt än"-badge (t.ex. ej bokförd), bakgrund
  grayText: 'var(--status-gray-text)',    // Neutral "inget hänt än"-badge, text
  blueBg: 'var(--status-blue-bg)',        // Informativ badge, t.ex. "Skickad"/"Kundtid", bakgrund
  blueText: 'var(--status-blue-text)',    // Informativ badge, text
  pinkBg: 'var(--status-pink-bg)',        // Femte accentkulören (t.ex. "Ny kontakt"-genvägen), bakgrund
  pinkText: 'var(--status-pink-text)',    // Femte accentkulören, text
};

/**
 * Djärva, mättade ikon-kulörer — literal hex med flit, samma resonemang som
 * BRAND.green: dessa ÄR den starka accentfärgen (solid bakgrund + vit ikon),
 * inte en pastell "status-badge"-yta som ska vara diskret. Kundfeedback:
 * Snabbåtgärderna och "Att göra idag"-ikonerna återanvände BRAND.*Bg/*Text
 * (--status-*, index.css) — tänkta för diskreta statusmärken, inte för
 * knappar man vill klicka på — och blev därför blek/urvattnad ("AI-mall"-
 * känsla). Samma nyanser oavsett tema (vit ikon på en mättad platta läses
 * lika bra i båda), så ingen ljust/mörkt-uppdelning behövs här.
 */
export const VIVID = {
  green: '#16a34a',  // Ny faktura, "Allt klart"/success-ikoner
  blue:  '#2563eb',  // Ladda upp kvitto, informativa ikoner
  pink:  '#db2777',  // Ny kontakt
  amber: '#d97706',  // Rapportera tid, varning/väntar-ikoner
  red:   '#dc2626',  // Förfallet/kritiskt
};

/**
 * Djärva gradient-par för "hero"-siffror (Startsidans Resultat/Intäkter/
 * Kostnader-kort m.fl.) — literal hex med flit, precis som BRAND.green:
 * dessa ÄR den starka accentfärgen själv (ett `linear-gradient`-bakgrund),
 * inte en yta som ska mörkna med resten av temat. Låg som tre separata
 * konstanter direkt i Dashboard.jsx tidigare — flyttade hit så andra sidors
 * egna sammanfattningskort (t.ex. Rapport och analys) kan återanvända
 * SAMMA gradienter istället för att uppfinna en ny, nästan-men-inte-riktigt
 * matchande nyans (kundönskemål: "samma [stil] på alla sidor").
 */
export const KPI_GRADIENTS = {
  positive: ['#2f8a3a', '#54b854'], // Resultat: vinst, Omsättning/Intäkter
  negative: ['#c8305a', '#e0527a'], // Resultat: förlust, Kostnader
  revenue:  ['#1d6fa5', '#3b93d1'], // Intäkter (blå variant, skild från "vinst"-grönt)
  neutral:  ['#4a5568', '#6b7684'], // Neutrala mått utan tydlig +/- (t.ex. Marginal, Moms-rutor)
};
