// ── Lokaliserad text ovanpå den delade, STRUKTURELLA priskatalogen
// (components/marketing/pricingTiers.js: key/price/gradient/accent/
// featured — aldrig översatt, priset i kronor och layouten är samma
// oavsett språk). Bara namnen/beskrivningarna/funktionslistorna byts ut
// per språk, kopplat ihop via `key` så en featured-flagga eller ett pris
// aldrig kan glida isär mellan språken. sv behöver ingen post här — den
// STRUKTURELLA katalogen ÄR redan den svenska texten.
import { PRICING_TIERS } from '../../components/marketing/pricingTiers';

const TEXT = {
};

/** sv (eller ett språk utan text ovan) → den ostörda strukturella
 * katalogen rakt av. Annars samma tiers, bara med name/subtitle/recommend/
 * features/missing utbytta mot TEXT[locale][tier.key]. */
export function localizedPricingTiers(locale) {
  const overlay = TEXT[locale];
  if (!overlay) return PRICING_TIERS;
  return PRICING_TIERS.map((tier) => ({ ...tier, ...overlay[tier.key] }));
}
