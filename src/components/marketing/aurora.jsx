import { BRAND } from '../../utils/brandColors';

// ── "Ljus genom molnen" — Bokix egen tråd genom HELA marknadssajten, inte
// bara startsidan. Hero (CloudShaderBackground.jsx) visar en tät, levande
// himmel; varje sektion på VARJE marknadssida därunder får en egen mjuk
// färgvåg i loggans EGNA blå→turkos→lime-gradient (+ nyckeltalskortens
// grönt/rosarött) — ett eko av Hero, aldrig en ny stämning ovanpå den.
// Flyttad hit från LandingPage.jsx (där den föddes) så Priser/Funktioner/
// Om oss/Kontakt kan dela EXAKT samma bakgrundsspråk istället för att var
// och en hittar på sin egen tolkning. ──

// Bokix egna gradienter, hämtade rakt från produkten — INTE en importerad
// extern designreferens. Loggans blå→turkos→lime (BokixWordmark i
// MarketingLayout.jsx) och Startsidans KPI-kortgradienter (Dashboard.jsx:
// KPI_GRAD_POSITIVE/KPI_GRAD_NEGATIVE) — samma färger en inloggad användare
// redan ser i appen. Rosarött är medvetet reserverat för kostnads-/
// utgiftsrelaterat innehåll (samma betydelse som i Dashboard).
export const GRAD = {
  green: ['#2f8a3a', '#54b854'],       // Dashboard KPI_GRAD_POSITIVE
  pink: ['#e0527a', '#c8305a'],        // Dashboard KPI_GRAD_NEGATIVE — bara kostnader/utgifter
  blueTeal: ['#0ea5e9', '#14b8a6'],    // Loggans första hälft
  tealLime: ['#14b8a6', '#84cc16'],    // Loggans andra hälft
  limeGreen: ['#84cc16', BRAND.green],
};
export const grad = (c, deg = 135) => `linear-gradient(${deg}deg, ${c[0]}, ${c[1]})`;

/** `stops` bygger vågen som lagrade radial-gradients direkt i sektionens
 * bakgrund (billigare än filter:blur över hela ytan); `blob` lägger till EN
 * sakta drivande, mättad glöd ovanpå — samma .lp-blob-drift och samma
 * styrka som Heros egna klot. Droppas in som FÖRSTA barn i en sektion vars
 * <section> fått position:'relative', overflow:'hidden', och vars
 * innehållswrapper fått position:'relative' (positionerat innehåll målas
 * efter positionerad bakgrund i DOM-ordning — samma mönster Hero/
 * prissektionen redan byggde på). */
export function AuroraLayer({ stops, blob }) {
  return (
    <>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: stops.map(([color, pos, size]) => `radial-gradient(${size || '680px'} circle at ${pos}, ${color}, transparent 62%)`).join(', ') }} />
      {blob && (
        <div aria-hidden className={`lp-blob ${blob.slow ? 'lp-blob-slower' : 'lp-blob-slow'}`} style={{ position: 'absolute', top: blob.top, bottom: blob.bottom, left: blob.left, right: blob.right, width: blob.size || '460px', height: blob.size || '460px', borderRadius: '50%', background: blob.gradient, opacity: blob.opacity ?? 0.22, filter: 'blur(90px)', pointerEvents: 'none' }} />
      )}
    </>
  );
}
