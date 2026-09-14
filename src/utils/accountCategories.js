// ─────────────────────────────────────────────────────────────────────────
// Delad kontogissning — EN sanning för "vilket konto passar den här texten?",
// använd av kvitto-OCR:n (ocrReceipt.js), bankimporten (Bank.jsx) och
// kvittolistans kategorisortering (Expenses.jsx). Låg tidigare som en egen
// kopia inne i ocrReceipt.js; flyttad hit så bankimporten kan föreslå
// samma sorts konto som kvittona redan gör, utan en andra, garanterat
// framtida-omatchad kopia av samma regler.
//
// Kundönskemål, ordagrant i sak: "gissa inte om det inte är rimligt, men
// om det ÄR rimligt, ge ett riktigt bra förslag" — reglerna här är därför
// hellre FÅ och rätt än många och lösa. Varje kod är verifierad mot den
// faktiska kontoplanen i AccountsData.js, inte gissad ur minnet:
// felaktiga tidigare kopplingar (parkering → "Försäkring och skatt för
// personbilar", frakt/DHL/PostNord → "Datakommunikation", hotell →
// "Förbrukningsinventarier", reklam → "Kontorsmateriel", facklitteratur
// → "Föreningsavgifter") rättades i samma omgång som den här filen
// skapades. Rör du en kod här, slå upp den i AccountsData.js FÖRST.

/** Kända leverantörer → namn, konto och (om känt) momssats. Matchas mot
 *  HELA den avlästa/importerade texten (kvittots OCR-text, eller en
 *  bankrads beskrivning), i listad ordning — första träff vinner. */
export const KNOWN_SUPPLIERS = [
  // Molntjänster & SaaS (utländska = 0% svensk moms, omvänd skattskyldighet)
  { re: /supabase/i, name: 'Supabase', account: '6540', vat: 0 },
  { re: /vercel/i, name: 'Vercel', account: '6540', vat: 0 },
  { re: /github/i, name: 'GitHub', account: '6540', vat: 0 },
  { re: /openai/i, name: 'OpenAI', account: '6540', vat: 0 },
  { re: /aws|amazon web services/i, name: 'AWS', account: '6540', vat: 0 },
  { re: /google(?:\s*cloud|\s*workspace)?/i, name: 'Google', account: '6540', vat: 0 },
  { re: /adobe/i, name: 'Adobe', account: '5420', vat: 0 },
  { re: /microsoft/i, name: 'Microsoft', account: '5420', vat: 0 },
  { re: /apple\b/i, name: 'Apple', account: '5420', vat: 25 },
  { re: /slack/i, name: 'Slack', account: '6540', vat: 0 },
  { re: /zoom\b/i, name: 'Zoom', account: '6540', vat: 0 },
  { re: /figma/i, name: 'Figma', account: '6540', vat: 0 },
  { re: /notion/i, name: 'Notion', account: '6540', vat: 0 },
  { re: /spotify/i, name: 'Spotify', account: '6990', vat: 25 },

  // Matvaror & representation (12% moms). Konto 6071 "Representation,
  // avdragsgill".
  { re: /coop/i, name: 'Coop', account: '6071', vat: 12 },
  { re: /ica\b/i, name: 'ICA', account: '6071', vat: 12 },
  { re: /willys/i, name: 'Willys', account: '6071', vat: 12 },
  { re: /lidl/i, name: 'Lidl', account: '6071', vat: 12 },
  { re: /hemk[öo]p/i, name: 'Hemköp', account: '6071', vat: 12 },
  { re: /espresso house/i, name: 'Espresso House', account: '6071', vat: 12 },
  { re: /pressbyr[åa]n/i, name: 'Pressbyrån', account: '6071', vat: 12 },
  { re: /7-eleven|seven eleven/i, name: '7-Eleven', account: '6071', vat: 12 },
  { re: /mcdonald'?s/i, name: "McDonald's", account: '6071', vat: 12 },
  { re: /burger king/i, name: 'Burger King', account: '6071', vat: 12 },
  { re: /max burger|max restauranger/i, name: 'MAX', account: '6071', vat: 12 },

  // Drivmedel & fordon (25% moms)
  { re: /circle k/i, name: 'Circle K', account: '5611', vat: 25 },
  { re: /okq8|ok q8/i, name: 'OKQ8', account: '5611', vat: 25 },
  { re: /preem/i, name: 'Preem', account: '5611', vat: 25 },
  { re: /st1\b/i, name: 'St1', account: '5611', vat: 25 },
  { re: /shell/i, name: 'Shell', account: '5611', vat: 25 },
  { re: /qstar/i, name: 'Qstar', account: '5611', vat: 25 },
  { re: /ingo\b/i, name: 'INGO', account: '5611', vat: 25 },

  // Kontor, elektronik & verktyg (25% moms)
  { re: /biltema/i, name: 'Biltema', account: '6110', vat: 25 },
  { re: /clas ohlson/i, name: 'Clas Ohlson', account: '6110', vat: 25 },
  { re: /bauhaus/i, name: 'Bauhaus', account: '5400', vat: 25 },
  { re: /hornbach/i, name: 'Hornbach', account: '5400', vat: 25 },
  { re: /jula\b/i, name: 'Jula', account: '5400', vat: 25 },
  { re: /webhallen/i, name: 'Webhallen', account: '5400', vat: 25 },
  { re: /dustin/i, name: 'Dustin', account: '5400', vat: 25 },
  { re: /elgiganten/i, name: 'Elgiganten', account: '5400', vat: 25 },
  { re: /kjell\s*(?:&|och)\s*company/i, name: 'Kjell & Company', account: '5400', vat: 25 },
  { re: /ikea/i, name: 'IKEA', account: '5410', vat: 25 },

  // Frakt & logistik (25% moms). RÄTTAT: låg tidigare på 6230
  // ("Datakommunikation") — fel konto, en frakträkning har inget med
  // bredband/mobildata att göra. 5711 "Fraktkostnader" är den faktiska
  // kontoplansraden.
  { re: /postnord/i, name: 'PostNord', account: '5711', vat: 25 },
  { re: /dhl/i, name: 'DHL', account: '5711', vat: 25 },
  { re: /ups\b/i, name: 'UPS', account: '5711', vat: 25 },
  { re: /fedex/i, name: 'FedEx', account: '5711', vat: 25 },

  // Resor & taxi (6% moms)
  { re: /sj\b/i, name: 'SJ', account: '5810', vat: 6 },
  { re: /sl\b|storstockholms lokaltrafik/i, name: 'SL', account: '5810', vat: 6 },
  { re: /v[äa]sttrafik/i, name: 'Västtrafik', account: '5810', vat: 6 },
  { re: /sk[åa]netrafiken/i, name: 'Skånetrafiken', account: '5810', vat: 6 },
  { re: /uber/i, name: 'Uber', account: '5810', vat: 6 },
  { re: /bolt/i, name: 'Bolt', account: '5810', vat: 6 },
  { re: /taxi kurir|taxi stockholm|taxi g[öo]teborg/i, name: 'Taxi', account: '5810', vat: 6 },
];

/** Nyckelordsregler för konto, när ingen känd leverantör matchade. Samma
 *  "första träff vinner"-princip. Varje `code` verifierad mot
 *  AccountsData.js (se filkommentaren ovan för vilka som rättades). */
export const ACCOUNT_KEYWORD_RULES = [
  { re: /bensin|diesel|drivmedel|tankst|fuel/, code: '5611' },
  // RÄTTAT: låg på 5612 ("Försäkring och skatt för personbilar") — en
  // parkeringsavgift är varken en försäkring eller en skatt. 5619
  // ("Övriga kostnader för personbilar och mc, m.m.") är rätt hylla.
  { re: /parkering|parking|p-hus|p-avgift/, code: '5619' },
  { re: /tåg|flyg|resa|biljett|sas\b|norwegian/, code: '5810' },
  // RÄTTAT: låg på 5410 ("Förbrukningsinventarier") — samma kod som IKEA
  // ovan, alltså en ren krock. 5830 "Kost och logi" är hotellkontot.
  { re: /hotell|hotel|logi|airbnb|booking\.com/, code: '5830' },
  { re: /restaurang|lunch|middag|fika|café|cafe|mat|livsmedel|grocery/, code: '6071' },
  { re: /kontors|papper|penna|bläck|toner|staples/, code: '6110' },
  // RÄTTAT: låg på 6230 ("Datakommunikation") — se KNOWN_SUPPLIERS ovan.
  { re: /porto|frakt|paket|post|fedex|ups/, code: '5711' },
  // OBS: "\b3\b" (fristående siffran 3, operatören "3"/tre.se) — INTE
  // "3\b", som matchade sista siffran i vilket belopp eller referens-
  // nummer som helst så fort det råkade sluta på 3 (t.ex. "88213" i ett
  // ordernummer), och kategoriserade då kvittot fel som telefonkostnad.
  { re: /telefon|mobil|abonnemang|tele2|telia|\b3\b|comviq|telenor/, code: '6212' },
  { re: /internet|bredband|fiber|itux|bahnhof/, code: '6212' },
  { re: /server|hosting|cloud|saas|domän|domain|software|licens/, code: '6540' },
  // RÄTTAT: låg på 6980 ("Föreningsavgifter", dvs. medlemsavgifter) —
  // 6970 "Tidningar, facklitteratur, m.m." är den faktiska raden.
  { re: /facklitteratur|böcker|tidskrift|bok\b/, code: '6970' },
  { re: /representation|gåva|present/, code: '6072' },
  // RÄTTAT: låg på 6100 ("Kontorsmateriel och trycksaker") — 5910
  // "Annonsering" är rätt hylla för reklam/annonser.
  { re: /reklam|annons|marknadsföring|facebook ads|google ads/, code: '5910' },
  // UPPGRADERAT: 5000 är gruppkontot "Lokalkostnader", 5020 "El" är
  // exakt raden för en elräkning.
  { re: /elräkning|elnät|vattenfall|e\.on|fortum/, code: '5020' },
  { re: /verktyg|maskin|utrustning/, code: '5400' },
];

/**
 * Gissar leverantör, konto och (om känt) momssats ur en text — kvittots
 * OCR-text eller en bankrads beskrivning. Returnerar ALDRIG en gissning
 * som inte träffade någon regel: `accountCode` är då `null`, inte en
 * ihopfantiserad standard. `supplierMatched` skiljer en IGENKÄND
 * leverantör från ingen träff alls (ingen "bästa gissning" här, till
 * skillnad från ocrReceipt.js:s egen textrads-fallback för kvitton —
 * en bankrads beskrivning är sällan en läsbar första textrad att falla
 * tillbaka på).
 */
export function guessAccountFromText(text) {
  const fullText = String(text || '').toLowerCase();
  if (!fullText) return { supplier: null, supplierMatched: false, accountCode: null, vatRate: null };

  for (const s of KNOWN_SUPPLIERS) {
    if (s.re.test(fullText)) {
      return { supplier: s.name, supplierMatched: true, accountCode: s.account, vatRate: s.vat ?? null };
    }
  }
  for (const { re, code } of ACCOUNT_KEYWORD_RULES) {
    if (re.test(fullText)) {
      return { supplier: null, supplierMatched: false, accountCode: code, vatRate: null };
    }
  }
  return { supplier: null, supplierMatched: false, accountCode: null, vatRate: null };
}

/** Kategorietiketter för kvittolistans "sortera sig själv"-gruppering
 *  (Expenses.jsx) — en handfull vardagliga hinkar, inte en 1:1-karta mot
 *  varje enskild BAS-kod. Koderna som INTE finns med här hamnar i
 *  "Övrigt", aldrig i en påhittad kategori. */
export const RECEIPT_CATEGORIES = [
  { id: 'resor', label: 'Resor', accounts: ['5611', '5619', '5612', '5613', '5615', '5616', '5810', '5820', '5830', '5831', '5832', '5890'] },
  { id: 'mat', label: 'Mat & representation', accounts: ['6071', '6072'] },
  { id: 'kontor', label: 'Kontor & material', accounts: ['5400', '5410', '6100', '6110'] },
  { id: 'it', label: 'IT & molntjänster', accounts: ['5420', '6540', '6212', '6230'] },
  { id: 'frakt', label: 'Frakt & post', accounts: ['5700', '5710', '5711', '5712'] },
  { id: 'marknad', label: 'Reklam & marknadsföring', accounts: ['5900', '5910', '5920', '5930', '5950', '5960', '5970', '5990'] },
  { id: 'lokal', label: 'Lokal & el', accounts: ['5000', '5010', '5020', '5030'] },
];

const CATEGORY_BY_ACCOUNT = new Map(
  RECEIPT_CATEGORIES.flatMap(cat => cat.accounts.map(code => [code, cat]))
);

/** Kategorin ett kontokod hör till, eller `null` om koden inte finns i
 *  någon av hinkarna ovan (kvittot syns då under "Övrigt" i listan, inte
 *  under en kategori som låtsas veta bättre). */
export function categoryForAccountCode(code) {
  return CATEGORY_BY_ACCOUNT.get(code) || null;
}
