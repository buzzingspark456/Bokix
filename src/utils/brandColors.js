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
 */
export const BRAND = {
  green: '#3d7a2e',       // Primär accent: knappar, logga, sidopanelens bakgrund
  greenHover: '#336524',
  greenDark: '#27500a',   // Text på ljusgrön bakgrund (aktiv menypunkt, positiv badge)
  greenLight: '#eaf3de',  // Bakgrund: aktiv menypunkt, positiv badge, avatar-cirkel
  amberBg: '#faeeda',     // Neutral "inte aktiverat"-badge, bakgrund (inte röd — inget fel)
  amberText: '#633806',   // Neutral "inte aktiverat"-badge, text
  redBg: '#fcebeb',       // Verkligt fel/varning (t.ex. förfallen faktura), bakgrund
  redText: '#791f1f',     // Verkligt fel/varning, text
  grayBg: '#f1efe8',      // Neutral "inget hänt än"-badge (t.ex. ej bokförd), bakgrund
  grayText: '#6b7280',    // Neutral "inget hänt än"-badge, text
};
