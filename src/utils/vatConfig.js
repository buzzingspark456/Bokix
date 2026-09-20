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

// Omvänd skattskyldighet: tjänster köpta från utlandet. Köparen redovisar då
// momsen själv. Kostnaden bokförs på ett konto som anger varifrån tjänsten
// kommer (EU eller utanför EU) och momssats, och momsen bokförs både som
// utgående (2614/2624/2634) och som ingående (2645). Det är kontona som
// styr vilka rutor i momsdeklarationen som fylls i:
//   ruta 21 = tjänster från annat EU-land, ruta 22 = tjänster från land utanför EU
//   ruta 30/31/32 = utgående moms 25/12/6 % på inköpen
//   ruta 48 = ingående moms, inklusive den beräknade momsen på 2645
export const REVERSE_PURCHASE_ACCOUNTS = {
  eu: { 25: '4535', 12: '4536', 6: '4537' },
  nonEu: { 25: '4531', 12: '4532', 6: '4533' },
};
export const REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE = { 25: '2614', 12: '2624', 6: '2634' };
export const REVERSE_OUTPUT_VAT_RUTA_BY_RATE = { 25: '30', 12: '31', 6: '32' };
export const REVERSE_INPUT_VAT_ACCOUNT = '2645';
export const VAT_SETTLEMENT_ACCOUNT = '2650'; // Redovisningskonto för moms

// Rutor i den ordning de ska visas i Steg 2, med etikett och typ (för att
// kunna rendera generiskt oavsett hur många momssatser som är aktiva).
// 'salesTotal' summerar underlagByRate över alla tre satserna till EN rad
// (ruta 05) — se kommentaren vid SALES_RUTA_BY_RATE ovan för varför.
export const VAT_RUTOR = [
  { ruta: '05', label: 'Momspliktig försäljning (underlag, exkl. moms)', kind: 'salesTotal' },
  { ruta: '10', label: 'Utgående moms, 25 %', rate: 25, kind: 'output' },
  { ruta: '11', label: 'Utgående moms, 12 %', rate: 12, kind: 'output' },
  { ruta: '12', label: 'Utgående moms, 6 %', rate: 6, kind: 'output' },
  { ruta: '21', label: 'Inköp av tjänster från annat EU-land (underlag)', kind: 'reversePurchaseEu' },
  { ruta: '22', label: 'Inköp av tjänster från land utanför EU (underlag)', kind: 'reversePurchaseNonEu' },
  { ruta: '30', label: 'Utgående moms på inköp, 25 %', rate: 25, kind: 'reverseOutput' },
  { ruta: '31', label: 'Utgående moms på inköp, 12 %', rate: 12, kind: 'reverseOutput' },
  { ruta: '32', label: 'Utgående moms på inköp, 6 %', rate: 6, kind: 'reverseOutput' },
  { ruta: '48', label: 'Ingående moms att dra av', kind: 'input' },
  { ruta: '49', label: 'Moms att betala eller återfå', kind: 'net' },
];
