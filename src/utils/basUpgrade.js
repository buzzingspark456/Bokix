// Uppgraderar ett företags egen kontoplan till BAS 2026.
//
// Varje företag sparar en egen kopia av kontoplanen när det skapas
// (createEmptyCompanyData i App.jsx), så ändringar i DEFAULT_ACCOUNTS når
// inte befintliga företag av sig själva. Det här körs en gång per företag
// (markeras med basVersion) och
//  - lägger till de BAS-konton som saknas,
//  - byter namn till BAS 2026:s benämning, men BARA om kontot fortfarande
//    heter exakt som appens gamla standardnamn (ett namn användaren själv
//    har ändrat rörs aldrig),
//  - sorterar listan på kontonummer.
// Inget konto tas bort: ett konto kan ha bokföring, och egna konton ska vara kvar.

import { compareNumeric } from './intlCache';

export const BAS_VERSION = 2026;

// Appens standardnamn före BAS 2026-uppdateringen (2026-10-12), för de
// konton vars namn ändrades. Används bara för att känna igen orörda namn.
export const PREVIOUS_DEFAULT_NAMES = {
  2135: "Periodiseringsfond 2025 – nr 2",
  2137: "Periodiseringsfond 2027 – nr 2",
  2611: "Utgående moms, 25%",
  2614: "Utgående moms omvänd skattskyldighet, 25%",
  2615: "Utgående moms import av varor, 25%",
  2621: "Utgående moms, 12%",
  2624: "Utgående moms omvänd skattskyldighet, 12%",
  2625: "Utgående moms import av varor, 12%",
  2631: "Utgående moms, 6%",
  2634: "Utgående moms omvänd skattskyldighet, 6%",
  2635: "Utgående moms import av varor, 6%",
  2641: "Ingående moms",
  2647: "Ingående moms omvänd skattskyldighet varor och tjänster i Sverige",
  2731: "Avräkning socialavgifter",
  2898: "Outtagen utdelning",
  2940: "Upplupna lagstadgade sociala avgifter",
  3001: "Försäljning inom Sverige, 25% moms",
  3002: "Försäljning inom Sverige, 12% moms",
  3003: "Försäljning inom Sverige, 6% moms",
  3211: "Försäljning positiv VMB 25%",
  3212: "Försäljning negativ VMB 25%",
  3401: "Egna uttag momspliktiga, 25%",
  3402: "Egna uttag momspliktiga, 12%",
  3403: "Egna uttag momspliktiga, 6%",
  4065: "Inköp av handelsvaror i Sverige, omvänd betalningsskyldighet, 25% moms",
  4066: "Inköp av handelsvaror i Sverige, omvänd betalningsskyldighet, 12% moms",
  4067: "Inköp av handelsvaror i Sverige, omvänd betalningsskyldighet, 6% moms",
  4075: "Inköp av handelsvaror från annat EU-land, 25% moms",
  4076: "Inköp av handelsvaror från annat EU-land, 12% moms",
  4077: "Inköp av handelsvaror från annat EU-land, 6% moms",
  4085: "Import av handelsvaror, 25% moms",
  4086: "Import av handelsvaror, 12% moms",
  4087: "Import av handelsvaror, 6% moms",
  4211: "Sålda handelsvaror positiv VMB 25%",
  4212: "Sålda handelsvaror negativ VMB 25%",
  4415: "Inköp av råvaror och material i Sverige, omvänd betalningsskyldighet, 25% moms",
  4416: "Inköp av råvaror och material i Sverige, omvänd betalningsskyldighet, 12% moms",
  4417: "Inköp av råvaror och material i Sverige, omvänd betalningsskyldighet, 6% moms",
  4425: "Inköp av tjänster i Sverige, omvänd betalningsskyldighet, 25% moms",
  4426: "Inköp av tjänster i Sverige, omvänd betalningsskyldighet, 12% moms",
  4427: "Inköp av tjänster i Sverige, omvänd betalningsskyldighet, 6% moms",
  4515: "Inköp av råvaror och material från annat EU-land, 25%",
  4516: "Inköp av råvaror och material från annat EU-land, 12%",
  4517: "Inköp av råvaror och material från annat EU-land, 6%",
  4531: "Inköp av tjänster från ett land utanför EU, 25% moms",
  4532: "Inköp av tjänster från ett land utanför EU, 12% moms",
  4533: "Inköp av tjänster från ett land utanför EU, 6% moms",
  4535: "Inköp av tjänster från annat EU-land, 25%",
  4536: "Inköp av tjänster från annat EU-land, 12%",
  4537: "Inköp av tjänster från annat EU-land, 6%",
  4545: "Import av råvaror och material, 25% moms",
  4546: "Import av råvaror och material, 12% moms",
  4547: "Import av råvaror och material, 6% moms",
  7013: "Lön växa-stöd kollektivanställda 10,21%",
  7213: "Lön växa-stöd tjänstemän 10,21%",
  7510: "Arbetsgivaravgifter 31,42%",
  7551: "Avkastningsskatt 15% försäkringsföretag m.fl. samt avsatt till pensioner",
  7552: "Avkastningsskatt 15% utländska pensionsförsäkringar",
  7553: "Avkastningsskatt 30% utländska försäkringsföretag m.fl.",
  7554: "Avkastningsskatt 30% utländska kapitalförsäkringar",
};

const byCode = (a, b) => compareNumeric(String(a.code), String(b.code));

export function upgradeAccountsToBas(accounts, defaults) {
  if (!Array.isArray(accounts)) return accounts;
  const defaultsByCode = new Map(defaults.map(d => [d.code, d]));
  const renamed = accounts.map(a => {
    const def = defaultsByCode.get(a.code);
    if (!def || a.name === def.name || PREVIOUS_DEFAULT_NAMES[a.code] !== a.name) return a;
    return { ...a, name: def.name };
  });
  const existing = new Set(renamed.map(a => a.code));
  const added = defaults.filter(d => !existing.has(d.code)).map(d => ({ ...d }));
  return [...renamed, ...added].sort(byCode);
}
