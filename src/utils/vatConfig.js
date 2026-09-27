// ─────────────────────────────────────────────────────────────────────────
// Momsdeklaration — rutmappning (Skatteverkets officiella rutnummer)
//
// Bugkritiskt (enligt spec): denna mappning mellan (momssats/kontotyp) och
// rutnummer ligger som ren konfiguration, separat från beräkningslogiken i
// vatCalculation.js. Skatteverket justerar ibland rutnummer/beteckningar
// mellan år — då räcker det att uppdatera tabellen nedan, utan att röra
// summeringskoden.
//
// Kontokopplingen (VAT_ACCOUNTS / REVENUE_ACCOUNTS) matchar de konton som
// redan används i resten av appen (AccountsData.js): 2611/2621/2631 för
// utgående moms, 2641 för ingående, 3001–3004 för försäljning per momssats.
//
// Bugfix (kundens egen kontoplansdata avslöjade det): stod tidigare
// 2611/2612/2613 — 2612/2613 är INTE BAS-kontona för 12/6 % utgående moms,
// de riktiga är 2621/2631 (BAS hoppar över x2-serien för 25 % eftersom
// 2611 redan är den, och fortsätter sedan på x21/x31 för 12/6 %, inte på
// x12/x13). Alla momsbokningar på 12 eller 6 % hamnade alltså på fel
// konto sedan den här filen skapades — se App.jsx: handleBookVatPeriod,
// enda stället som faktiskt BOKFÖR mot den här mappningen.
// ─────────────────────────────────────────────────────────────────────────

// Momssats → ruta för momspliktig försäljning (underlag, exkl. moms).
// Bugfix: alla momssatser går i SAMMA ruta (05) — ruta 05 är en enda
// sammanslagen box för all momspliktig försäljning oavsett momssats
// (bekräftat mot Skatteverkets egen sida "Fylla i momsdeklarationen").
// Ruta 06 är uttag (självbetjäning) och ruta 07 vinstmarginalbeskattning
// — helt andra typer av underlag, inte "12%-" respektive "6%-försäljning"
// som det stod här tidigare. Själva rutuppdelningen per momssats sker
// först i utgående moms (ruta 10/11/12), se VAT_RUTOR nedan.
export const SALES_RUTA_BY_RATE = {
  25: '05',
  12: '05',
  6: '05',
};

// Momssats → ruta för utgående moms
export const OUTPUT_VAT_RUTA_BY_RATE = {
  25: '10',
  12: '11',
  6: '12',
};

// Momssats → bokföringskonto (samma konton som Invoices/Verifications bokför mot)
export const OUTPUT_VAT_ACCOUNT_BY_RATE = {
  25: '2611',
  12: '2621',
  6: '2631',
};

export const SALES_ACCOUNT_BY_RATE = {
  25: '3001',
  12: '3002',
  6: '3003',
  0: '3004',
};

export const INPUT_VAT_ACCOUNT = '2641';

// Omvänd skattskyldighet: köparen redovisar momsen själv. Kostnaden bokförs
// på ett konto som anger vad som köpts och varifrån, med momssats, och
// momsen bokförs både som utgående och som ingående moms (samma belopp, så
// den tar ut sig när den är avdragsgill). Det är kontona som styr rutorna:
//   ruta 20 varor från annat EU-land      4515-4517
//   ruta 21 tjänster från annat EU-land   4535-4537
//   ruta 22 tjänster från land utanför EU 4531-4533
//   ruta 23 varor i Sverige               4415-4417 (t.ex. mobiltelefoner, metallskrot)
//   ruta 24 övriga tjänster i Sverige     4425-4427 (t.ex. byggtjänster)
//   ruta 50 beskattningsunderlag import   4545-4547 (motkonto 4549)
// Utgående moms: 2614/2624/2634 (utlandet) och 2617/2627/2637 (Sverige) går
// till ruta 30-32, 2615/2625/2635 (import) till ruta 60-62. Ingående moms:
// 2645 (utlandet och import) och 2647 (Sverige), båda till ruta 48.
// Kontona är BAS; rutorna och eSKD-taggarna är kontrollerade mot
// Skatteverkets beskrivning av filformatet (2026-09-27).
export const REVERSE_VAT_KINDS = {
  foreign: { output: { 25: '2614', 12: '2624', 6: '2634' }, input: '2645', outputRuta: { 25: '30', 12: '31', 6: '32' } },
  domestic: { output: { 25: '2617', 12: '2627', 6: '2637' }, input: '2647', outputRuta: { 25: '30', 12: '31', 6: '32' } },
  import: { output: { 25: '2615', 12: '2625', 6: '2635' }, input: '2645', outputRuta: { 25: '60', 12: '61', 6: '62' } },
};
export const REVERSE_PURCHASE_KINDS = {
  euGoods: { ruta: '20', vat: 'foreign', accounts: { 25: '4515', 12: '4516', 6: '4517' }, label: 'Varor från annat EU-land' },
  eu: { ruta: '21', vat: 'foreign', accounts: { 25: '4535', 12: '4536', 6: '4537' }, label: 'Tjänster från annat EU-land' },
  nonEu: { ruta: '22', vat: 'foreign', accounts: { 25: '4531', 12: '4532', 6: '4533' }, label: 'Tjänster från land utanför EU' },
  seGoods: { ruta: '23', vat: 'domestic', accounts: { 25: '4415', 12: '4416', 6: '4417' }, label: 'Varor i Sverige (omvänd skattskyldighet)' },
  seServices: { ruta: '24', vat: 'domestic', accounts: { 25: '4425', 12: '4426', 6: '4427' }, label: 'Tjänster i Sverige (omvänd skattskyldighet)' },
  import: { ruta: '50', vat: 'import', accounts: { 25: '4545', 12: '4546', 6: '4547' }, label: 'Import av varor' },
};
// Äldre namn som resten av appen (kvittoavläsningen m.fl.) redan använder.
export const REVERSE_PURCHASE_ACCOUNTS = Object.fromEntries(Object.entries(REVERSE_PURCHASE_KINDS).map(([k, v]) => [k, v.accounts]));
export const REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE = REVERSE_VAT_KINDS.foreign.output;
export const REVERSE_OUTPUT_VAT_RUTA_BY_RATE = { 25: '30', 12: '31', 6: '32' };
export const REVERSE_INPUT_VAT_ACCOUNT = '2645';
export const VAT_SETTLEMENT_ACCOUNT = '2650'; // Redovisningskonto för moms

// Försäljning utan svensk moms, per konto och ruta:
//   35 varor till annat EU-land, 36 varor utanför EU (export),
//   39 tjänster till näringsidkare i annat EU-land (huvudregeln),
//   40 övrig försäljning av tjänster utanför Sverige,
//   41 försäljning där köparen är skattskyldig i Sverige (t.ex. byggtjänster),
//   42 övrig försäljning m.m. (momsfri försäljning i Sverige, 3004).
export const EXEMPT_SALES_RUTA_BY_ACCOUNT = {
  '3108': '35',
  '3105': '36',
  '3308': '39',
  '3305': '40',
  '3231': '41',
  '3004': '42',
};

// Rutor i den ordning de ska visas i Steg 2, med etikett och typ. Rutor med
// värdet 0 visas inte (VatDeclaration.jsx), bara ruta 49 alltid.
// 'salesTotal' summerar underlagByRate över alla tre satserna till EN rad
// (ruta 05) — se kommentaren vid SALES_RUTA_BY_RATE ovan för varför.
export const VAT_RUTOR = [
  { ruta: '05', label: 'Momspliktig försäljning (underlag, exkl. moms)', kind: 'salesTotal' },
  { ruta: '10', label: 'Utgående moms, 25 %', rate: 25, kind: 'output' },
  { ruta: '11', label: 'Utgående moms, 12 %', rate: 12, kind: 'output' },
  { ruta: '12', label: 'Utgående moms, 6 %', rate: 6, kind: 'output' },
  { ruta: '20', label: 'Inköp av varor från annat EU-land (underlag)', kind: 'purchase' },
  { ruta: '21', label: 'Inköp av tjänster från annat EU-land (underlag)', kind: 'purchase' },
  { ruta: '22', label: 'Inköp av tjänster från land utanför EU (underlag)', kind: 'purchase' },
  { ruta: '23', label: 'Inköp av varor i Sverige, omvänd skattskyldighet (underlag)', kind: 'purchase' },
  { ruta: '24', label: 'Övriga inköp av tjänster, omvänd skattskyldighet (underlag)', kind: 'purchase' },
  { ruta: '30', label: 'Utgående moms på inköp, 25 %', rate: 25, kind: 'reverseOutput' },
  { ruta: '31', label: 'Utgående moms på inköp, 12 %', rate: 12, kind: 'reverseOutput' },
  { ruta: '32', label: 'Utgående moms på inköp, 6 %', rate: 6, kind: 'reverseOutput' },
  { ruta: '50', label: 'Beskattningsunderlag vid import', kind: 'purchase' },
  { ruta: '60', label: 'Utgående moms på import, 25 %', rate: 25, kind: 'importOutput' },
  { ruta: '61', label: 'Utgående moms på import, 12 %', rate: 12, kind: 'importOutput' },
  { ruta: '62', label: 'Utgående moms på import, 6 %', rate: 6, kind: 'importOutput' },
  { ruta: '35', label: 'Försäljning av varor till annat EU-land', kind: 'exemptSales' },
  { ruta: '36', label: 'Försäljning av varor utanför EU (export)', kind: 'exemptSales' },
  { ruta: '39', label: 'Försäljning av tjänster till näringsidkare i annat EU-land', kind: 'exemptSales' },
  { ruta: '40', label: 'Övrig försäljning av tjänster utanför Sverige', kind: 'exemptSales' },
  { ruta: '41', label: 'Försäljning där köparen är skattskyldig i Sverige', kind: 'exemptSales' },
  { ruta: '42', label: 'Övrig försäljning m.m.', kind: 'exemptSales' },
  { ruta: '48', label: 'Ingående moms att dra av', kind: 'input' },
  { ruta: '49', label: 'Moms att betala eller återfå', kind: 'net' },
];
