// Bildadress med version (2026-11-24): ?v=<8 tecken av filens sha256> ur
// content/marketing/assetVersions.json (scripts/asset-versions.mjs). En bild
// som byts får en ny adress, så Google och delningstjänster hämtar den nya i
// stället för att visa sin gamla kopia. Fungerar för "/product/x.jpg" och
// "https://www.bokix.se/product/x.jpg"; en adress som redan har ?v lämnas.
import VERSIONS from '../content/marketing/assetVersions.json';

const ORIGIN = /^https:\/\/(?:www\.)?bokix\.se(?=\/)/;

export function assetUrl(url) {
  if (!url || typeof url !== 'string' || url.includes('?')) return url;
  const v = VERSIONS[url.replace(ORIGIN, '')];
  return v ? `${url}?v=${v}` : url;
}
