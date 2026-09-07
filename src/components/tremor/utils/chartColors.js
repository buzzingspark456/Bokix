// Ported from Tremor Raw (tremorlabs/tremor, MIT license) — chartColors
// [v0.1.0]. TS types stripped, logic unchanged.
export const chartColors = {
  blue: { bg: 'bg-blue-500', stroke: 'stroke-blue-500', fill: 'fill-blue-500', text: 'text-blue-500' },
  emerald: { bg: 'bg-emerald-500', stroke: 'stroke-emerald-500', fill: 'fill-emerald-500', text: 'text-emerald-500' },
  violet: { bg: 'bg-violet-500', stroke: 'stroke-violet-500', fill: 'fill-violet-500', text: 'text-violet-500' },
  amber: { bg: 'bg-amber-500', stroke: 'stroke-amber-500', fill: 'fill-amber-500', text: 'text-amber-500' },
  gray: { bg: 'bg-gray-500', stroke: 'stroke-gray-500', fill: 'fill-gray-500', text: 'text-gray-500' },
  cyan: { bg: 'bg-cyan-500', stroke: 'stroke-cyan-500', fill: 'fill-cyan-500', text: 'text-cyan-500' },
  pink: { bg: 'bg-pink-500', stroke: 'stroke-pink-500', fill: 'fill-pink-500', text: 'text-pink-500' },
  lime: { bg: 'bg-lime-500', stroke: 'stroke-lime-500', fill: 'fill-lime-500', text: 'text-lime-500' },
  fuchsia: { bg: 'bg-fuchsia-500', stroke: 'stroke-fuchsia-500', fill: 'fill-fuchsia-500', text: 'text-fuchsia-500' },
};

export const AvailableChartColors = Object.keys(chartColors);

export const constructCategoryColors = (categories, colors) => {
  const categoryColors = new Map();
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]);
  });
  return categoryColors;
};

export const getColorClassName = (color, type) => {
  // Rå hex hanteras av colorStyle nedan, inte av en Tailwind-klass — returnera
  // tom sträng så cx() inte råkar lägga på en grå fallback ovanpå inline-färgen.
  if (isRawColor(color)) return '';
  const fallbackColor = { bg: 'bg-gray-500', stroke: 'stroke-gray-500', fill: 'fill-gray-500', text: 'text-gray-500' };
  return chartColors[color]?.[type] ?? fallbackColor[type];
};

/* ── Avsteg från upstream Tremor Raw ────────────────────────────────────
 * Upstream målar BARA med sina nio namngivna Tailwind-färger ovan. Det var
 * skälet till att Rapport och analys tvingades till `lime`/`pink` (Tailwinds
 * lime-500 #84cc16 och pink-500 #ec4899) medan Startsidans motsvarande graf,
 * som ritas direkt i recharts, använder appens EGNA lugnare varumärkestoner
 * (KPI_GRADIENTS.revenue/negative, se brandColors.js). Två sidor som visar
 * samma sak i två helt olika färgspråk — och den skrikigare av dem på den
 * sida som ska se mest genomarbetad ut.
 *
 * Lösningen är inte att lägga till fler namngivna tokens (då måste varje ny
 * nyans också finnas som en literal Tailwind-klass för att byggsteget ska
 * generera den), utan att låta `colors`-propen ta emot en rå hex/CSS-färg
 * som sätts inline. Namngivna tokens fungerar exakt som förut. */
export const isRawColor = (color) =>
  typeof color === 'string' && (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('var('));

const RAW_COLOR_PROPERTY = { bg: 'backgroundColor', stroke: 'stroke', fill: 'fill', text: 'color' };

/** Inline-motsvarigheten till getColorClassName för råa färger. Tomt objekt
 * för namngivna tokens, så anropsställena kan skicka BÅDA utan att veta
 * vilken sort de har: `className={cx(getColorClassName(c, 'fill'))}
 * style={colorStyle(c, 'fill')}`. `text` används av gradient-defs där
 * `stopColor="currentColor"` läser av just `color`. */
export const colorStyle = (color, type) =>
  (isRawColor(color) ? { [RAW_COLOR_PROPERTY[type]]: color } : {});
