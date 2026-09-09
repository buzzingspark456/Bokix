// Sidbehörigheter för inbjudna användare.
//
// Kundönskemål: "man ska kunna välja vilka sidor hen kan se och redigera."
// Tidigare fanns bara två nivåer för hela företaget — redigerare eller
// läsare — vilket gör att en revisor som bara ska titta på bokföringen
// ändå ser löner, och att en kollega som ska fakturera antingen får skriva
// överallt eller ingenstans.
//
// Modellen är avsiktligt liten och begriplig:
//   'none'  sidan visas inte alls i menyn
//   'view'  sidan visas, men inget går att spara därifrån
//   'edit'  full åtkomst till sidan
//
// Saknas en behörighetslista helt (page_access = null, alla inbjudningar
// som gjordes innan det här fanns) gäller den gamla regeln rakt av: rollen
// bestämmer, alla sidor visas. Ingen befintlig inbjudan ändrar beteende av
// att koden uppdateras.
//
// `fields` är det som gör behörigheten VERKLIG och inte bara en gömd
// meny: api/company-access.js släpper bara igenom en skrivning om fältet
// hör till en sida användaren har 'edit' på. Fälten är samma namn som
// COMPANY_WRITABLE_FIELDS (companyFields.js) — håll dem i synk.
export const ACCESS_LEVELS = [
  { id: 'none', label: 'Ingen åtkomst' },
  { id: 'view', label: 'Kan se' },
  { id: 'edit', label: 'Kan redigera' },
];

export const ACCESS_PAGES = [
  { id: 'dashboard', label: 'Startsida', fields: [] },
  { id: 'contacts', label: 'Kunder och leverantörer', fields: ['contacts'] },
  { id: 'quotes', label: 'Offerter', fields: ['quotes'] },
  { id: 'invoices', label: 'Fakturering', fields: ['invoices', 'articles', 'verifications'] },
  { id: 'expenses', label: 'Utgifter och kvitton', fields: ['expenses', 'verifications'] },
  { id: 'projects', label: 'Projekt och tid', fields: ['projects', 'timeEntries', 'timeReportStatuses', 'billableTimeEntries'] },
  { id: 'review', label: 'Granskning', fields: ['expenses', 'verifications', 'reviewHistory'] },
  { id: 'verifications', label: 'Bokföring', fields: ['verifications', 'accounts', 'verificationTemplates'] },
  { id: 'bank', label: 'Bank', fields: ['bankTransactions', 'verifications'] },
  { id: 'payroll', label: 'Anställda och lön', fields: ['employees', 'payrollRuns', 'verifications'] },
  { id: 'reports', label: 'Rapport och analys', fields: [] },
  { id: 'taxes', label: 'Skatt och bokslut', fields: ['vatPeriods', 'verifications', 'company'] },
];

/** Förvalet för en ny inbjudan: allt utom lönerna, som är den vanligaste
 * saken man INTE vill dela. Ägaren ändrar fritt i formuläret. */
export function defaultPageAccess(role = 'editor') {
  const level = role === 'editor' ? 'edit' : 'view';
  return Object.fromEntries(ACCESS_PAGES.map(p => [p.id, p.id === 'payroll' ? 'none' : level]));
}

/**
 * Vad gäller för en viss sida?
 *
 * `pageAccess` saknas → gamla beteendet: rollen bestämmer och alla sidor
 * syns. En sida som inte finns i listan behandlas likadant, så en ny sida
 * i appen aldrig blir osynlig för befintliga medlemmar förrän ägaren
 * faktiskt tagit ställning till den.
 */
export function accessForPage(pageAccess, pageId, role = 'editor') {
  if (!pageAccess || typeof pageAccess !== 'object') return role === 'editor' ? 'edit' : 'view';
  const level = pageAccess[pageId];
  if (level === 'none' || level === 'view' || level === 'edit') {
    // Rollen är fortfarande ett tak: en läsare kan aldrig få redigera
    // genom sidbehörigheten, oavsett vad som står i listan.
    if (role !== 'editor' && level === 'edit') return 'view';
    return level;
  }
  return role === 'editor' ? 'edit' : 'view';
}

/** Får den här användaren skriva till fältet? Används server-side. */
export function canWriteField(pageAccess, field, role = 'editor') {
  if (role !== 'editor') return false;
  if (!pageAccess || typeof pageAccess !== 'object') return true;
  return ACCESS_PAGES.some(p => p.fields.includes(field) && accessForPage(pageAccess, p.id, role) === 'edit');
}

/** Sid-id:n som ska synas i menyn. */
export function visiblePages(pageAccess, role = 'editor') {
  return ACCESS_PAGES.filter(p => accessForPage(pageAccess, p.id, role) !== 'none').map(p => p.id);
}
