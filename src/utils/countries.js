// EU:s 27 medlemsländer (2026), utan Sverige — Sverige hanteras separat eftersom
// svenska kunder/leverantörer alltid väljer "Svenskt företag" som typ, inte "EU-företag".
export const EU_COUNTRIES = [
  'Belgien', 'Bulgarien', 'Cypern', 'Danmark', 'Estland', 'Finland', 'Frankrike',
  'Grekland', 'Irland', 'Italien', 'Kroatien', 'Lettland', 'Litauen', 'Luxemburg',
  'Malta', 'Nederländerna', 'Polen', 'Portugal', 'Rumänien', 'Slovakien', 'Slovenien',
  'Spanien', 'Tjeckien', 'Tyskland', 'Ungern', 'Österrike',
];

export const SWEDEN = 'Sverige';

// Ett urval av vanliga länder utanför EU. Listan är inte uttömmande men täcker
// de vanligaste handelspartnerna; utökas vid behov utan att ändra filtreringslogiken.
export const NON_EU_COUNTRIES = [
  'Norge', 'Island', 'Schweiz', 'Storbritannien', 'USA', 'Kanada', 'Kina', 'Japan',
  'Sydkorea', 'Indien', 'Australien', 'Nya Zeeland', 'Brasilien', 'Mexiko',
  'Sydafrika', 'Förenade Arabemiraten', 'Turkiet', 'Ryssland', 'Singapore', 'Övrigt',
];

export const ALL_COUNTRIES = [SWEDEN, ...EU_COUNTRIES, ...NON_EU_COUNTRIES];

/**
 * Landlistan filtreras utifrån vald kund-/leverantörstyp så att en felaktig
 * kombination (t.ex. "EU-företag" med Land = Sverige) inte kan sparas och
 * senare orsaka fel momshantering.
 */
export function getCountryOptions(type) {
  switch (type) {
    case 'eu_company':
      return EU_COUNTRIES;
    case 'non_eu_company':
      return NON_EU_COUNTRIES;
    case 'se_company':
    case 'se_individual':
    default:
      return ALL_COUNTRIES;
  }
}

export function getDefaultCountry(type) {
  if (type === 'eu_company') return EU_COUNTRIES[0];
  if (type === 'non_eu_company') return NON_EU_COUNTRIES[0];
  return SWEDEN;
}

// Landskoder för de svenska namnen ovan. Namnet är det som sparas på kunden;
// koden används bara för att visa landet på användarens språk.
const COUNTRY_CODES = {
  Sverige: 'SE', Belgien: 'BE', Bulgarien: 'BG', Cypern: 'CY', Danmark: 'DK', Estland: 'EE', Finland: 'FI',
  Frankrike: 'FR', Grekland: 'GR', Irland: 'IE', Italien: 'IT', Kroatien: 'HR', Lettland: 'LV', Litauen: 'LT',
  Luxemburg: 'LU', Malta: 'MT', Nederländerna: 'NL', Polen: 'PL', Portugal: 'PT', Rumänien: 'RO', Slovakien: 'SK',
  Slovenien: 'SI', Spanien: 'ES', Tjeckien: 'CZ', Tyskland: 'DE', Ungern: 'HU', Österrike: 'AT',
  Norge: 'NO', Island: 'IS', Schweiz: 'CH', Storbritannien: 'GB', USA: 'US', Kanada: 'CA', Kina: 'CN', Japan: 'JP',
  Sydkorea: 'KR', Indien: 'IN', Australien: 'AU', 'Nya Zeeland': 'NZ', Brasilien: 'BR', Mexiko: 'MX',
  Sydafrika: 'ZA', 'Förenade Arabemiraten': 'AE', Turkiet: 'TR', Ryssland: 'RU', Singapore: 'SG',
};

/** Landets namn på `language` ('sv' visar det sparade namnet). */
export function countryLabel(name, language) {
  if (language === 'sv' || !name) return name;
  if (name === 'Övrigt') return 'Other';
  const code = COUNTRY_CODES[name];
  if (!code || typeof Intl === 'undefined' || !Intl.DisplayNames) return name;
  try { return new Intl.DisplayNames([language], { type: 'region' }).of(code) || name; } catch { return name; }
}
