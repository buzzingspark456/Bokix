import { BRAND } from '../../utils/brandColors';

// Statusfärgerna för kund- och leverantörsfakturor. EN källa: Kundfakturor
// (Invoices.jsx) och Leverantörsfakturor (SupplierInvoices.jsx) ska se ut som
// samma produkt, så märkena, radernas bakgrund och statuspillren kommer härifrån.
// Motiveringarna till varje ton (mättad, gul för obetald, dämpad röd för
// förfallen, tema-medvetna CSS-variabler) står vid respektive konstant.

export const STRONG_PAID = { bg: '#15803d', text: '#ffffff' };
// Kundfeedback (uppföljning): gult "ännu mer gulish" — bytt till en ljusare,
// renare gul ton (mindre orange i sig) och rött "lite mer" — bytt till en
// mer mättad, mindre orange-tonad röd.
//
// Kundfeedback (uppföljning igen): den ljusa gula (#facc15, literal hex,
// samma i båda temana) stack ut för mycket mot en VIT sida men lästes helt
// rätt mot en mörk — `var(--invoice-unpaid-bg)` (index.css) håller mörkt
// läge oförändrat och dämpar bara ljust lägets ton ett steg.
export const STRONG_UNPAID = { bg: 'var(--invoice-unpaid-bg)', text: '#422006' };
// Kundfeedback ("lite mer chill, inte så stark"): #e11d1d var en ren,
// mättad varningsröd — dämpad ett steg (mindre mättnad, samma kulör) i
// stället för att byta hue helt, så "förfallen" fortfarande entydigt läses
// som röd/allvarligt, bara inte lika högljutt.
//
// Kundfeedback ("måste se bra ut i dark theme också"): var en literal hex,
// samma i båda temana, till skillnad från STRONG_UNPAID — `var(--invoice-
// overdue-bg)` (index.css) ger den nu en egen, kontrollerad mörk-läge-ton
// precis som gult redan hade, i stället för att bara råka funka.
export const STRONG_OVERDUE = { bg: 'var(--invoice-overdue-bg)', text: '#ffffff' };

export function getRowBg(status) {
  // Kundfeedback ("bakgrunden är inte så gul/röd"): en HEL RADS bakgrund är
  // mycket mer yta än en liten badge — appens vanliga, medvetet bleka
  // --status-amber-bg/--status-red-bg (delade av alla andra sidors diskreta
  // märken) lästes knappt som färgade alls i den skalan. Egna --row-*-bg-
  // tokens (index.css, tema-medvetna) används bara här, en nivå starkare.
  // Uppföljning ("för gröna ska vara mer grön"): "Betald" var det enda
  // statuset som fortfarande återanvände BRAND.greenLight — appens
  // blekaste generella badge-ton — i stället för en egen, lika mättad
  // radton som de andra två redan fick. Samma --row-paid-bg-mönster nu.
  if (status === 'paid') return 'var(--row-paid-bg)'; // betald
  if (status === 'overdue') return 'var(--row-overdue-bg)'; // förfallen
  if (status === 'sent') return 'var(--row-unpaid-bg)';     // obetald, inte förfallen än
  if (status === 'draft') return BRAND.grayBg;      // ej bokförd/skickad än
  return '#ffffff';
}
