// Delat datumformat (Inställningar > System > Datumformat). Innan den här
// filen fanns anropade sju olika komponenter `toLocaleDateString('sv-SE')`
// var för sig, hårdkodat — så det fanns ingen enda plats att koppla en
// användarinställning till. `formatDate` är den enda platsen som ska
// användas för att visa ett datum i gränssnittet härefter.
//
// Byggd med manuell utskrift (inte bara toLocaleDateString med olika
// locale-strängar) så resultatet är EXAKT förutsägbart oavsett webbläsarens
// egna locale-data, istället för att t.ex. 'en-GB' råkar ge samma format
// som 'iso' i en webbläsare och något annat i en annan.
export const DATE_FORMATS = [
  { id: 'iso', label: 'ÅÅÅÅ-MM-DD', example: '2026-09-15' },
  { id: 'eu', label: 'DD/MM/ÅÅÅÅ', example: '15/09/2026' },
  { id: 'us', label: 'MM/DD/ÅÅÅÅ', example: '09/15/2026' },
];
export const DEFAULT_DATE_FORMAT = 'iso';

const STORAGE_KEY = 'bokix_date_format';

// Ren localStorage-preferens (inte React-state) — samma mönster som
// App.jsx redan använder för tema/sidopanel/scrollbar, men UTAN att behöva
// trä prop:en genom hela komponentträdet: varje ställe som visar ett datum
// (App.jsx, Dashboard.jsx, Taxes.jsx, m.fl.) kan läsa preferensen direkt
// här, oavsett hur långt bort det ligger från Inställningar-sidan.
export function getDateFormatPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (DATE_FORMATS.some(f => f.id === stored)) return stored;
  } catch { /* privat läge/blockerad storage — kör vidare med förvalet */ }
  return DEFAULT_DATE_FORMAT;
}

export function setDateFormatPreference(format) {
  try { localStorage.setItem(STORAGE_KEY, format); } catch { /* samma reservläge som ovan */ }
}

export function formatDate(value, format = DEFAULT_DATE_FORMAT) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  switch (format) {
    case 'eu': return `${dd}/${mm}/${yyyy}`;
    case 'us': return `${mm}/${dd}/${yyyy}`;
    case 'iso':
    default: return `${yyyy}-${mm}-${dd}`;
  }
}
