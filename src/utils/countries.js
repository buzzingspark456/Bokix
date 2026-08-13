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
