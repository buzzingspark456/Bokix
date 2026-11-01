// Funktioner de flesta små företag aldrig använder ligger gömda tills man
// slår på dem (Inställningar → Funktioner). Inget tas bort: sidan
// finns kvar, den syns bara inte i menyn.
//
// Valet sparas i company.features ({ articles: true, ... }). Har företaget
// inte valt något visas funktionen om det redan finns data i den, så att
// ingen som använder lager eller projekt plötsligt tappar menyvalet.

export const OPTIONAL_FEATURES = [
  // Artiklar och lager är samma sida (Articles.jsx med fliken Lager).
  { id: 'articles', navIds: ['articles'], hasData: (c) => (c?.articles || []).length > 0 },
  // Projekt och tidrapportering.
  {
    id: 'projects',
    navIds: ['projects', 'time'],
    hasData: (c) => (c?.projects || []).length > 0 || (c?.billableTimeEntries || []).length > 0 || (c?.timeEntries || []).length > 0,
  },
  // Flikar under Bokföring (inte menyval). Periodiseringar sköter också
  // semesterlöneskulden, så ett företag med lön har den kvar.
  { id: 'accruals', navIds: ['accruals'], hasData: (c) => (c?.company?.accruals || []).length > 0 || (c?.payrollRuns || []).length > 0 },
  { id: 'fixed_assets', navIds: ['fixed_assets'], hasData: (c) => (c?.company?.fixedAssets || []).length > 0 },
];

/** Är funktionen påslagen för företaget? `companyData` är hela företagsgrenen. */
export function isFeatureOn(companyData, id) {
  const feature = OPTIONAL_FEATURES.find(f => f.id === id);
  if (!feature) return true;
  const chosen = companyData?.company?.features?.[id];
  if (typeof chosen === 'boolean') return chosen;
  return feature.hasData(companyData);
}

/** Menyval som ska döljas för företaget. */
export function hiddenFeatureNavIds(companyData) {
  return OPTIONAL_FEATURES.filter(f => !isFeatureOn(companyData, f.id)).flatMap(f => f.navIds);
}
