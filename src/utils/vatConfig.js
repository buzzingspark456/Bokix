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
// redan används i resten av appen (AccountsData.js): 2611/2612/2613 för
// utgående moms, 2641 för ingående, 3001–3004 för försäljning per momssats.
// ─────────────────────────────────────────────────────────────────────────

// Momssats → ruta för momspliktig försäljning (underlag, exkl. moms)
export const SALES_RUTA_BY_RATE = {
  25: '05',
  12: '06',
  6: '07',
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
  12: '2612',
  6: '2613',
};

export const SALES_ACCOUNT_BY_RATE = {
  25: '3001',
  12: '3002',
  6: '3003',
  0: '3004',
};

export const INPUT_VAT_ACCOUNT = '2641';
export const VAT_SETTLEMENT_ACCOUNT = '2650'; // Redovisningskonto för moms

// Rutor i den ordning de ska visas i Steg 2, med etikett och typ (för att
// kunna rendera generiskt oavsett hur många momssatser som är aktiva).
export const VAT_RUTOR = [
  { ruta: '05', label: 'Momspliktig försäljning (underlag, exkl. moms)', rate: 25, kind: 'sales' },
  { ruta: '06', label: 'Momspliktig försäljning, 12 %', rate: 12, kind: 'sales' },
  { ruta: '07', label: 'Momspliktig försäljning, 6 %', rate: 6, kind: 'sales' },
  { ruta: '10', label: 'Utgående moms, 25 %', rate: 25, kind: 'output' },
  { ruta: '11', label: 'Utgående moms, 12 %', rate: 12, kind: 'output' },
  { ruta: '12', label: 'Utgående moms, 6 %', rate: 6, kind: 'output' },
  { ruta: '48', label: 'Ingående moms att dra av', kind: 'input' },
  { ruta: '49', label: 'Moms att betala eller återfå', kind: 'net' },
];
