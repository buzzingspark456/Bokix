// Enda källan för listan över user_data.state.companies.<id>-fält som får
// skrivas via set_company_field (api/company-access.js, server.js,
// api/cron/reminders.js). Tidigare kopierad verbatim i tre separata JS-
// filer utan delad import ("för att App.jsx är klientkod") — men den här
// filen exporterar bara ren data utan Node-specifika sidoeffekter
// (inget process.env, ingen createClient), så den är säker att bunta in
// i webbläsarkoden också. Lägg till ett nytt fält HÄR, inte i flera kopior.
//
// Ligger i src/utils, INTE api/ (dit den ursprungligen lades) — samma skäl
// som declarationDeadlines.js redan ligger här: vite.config.js proxyar ALLT
// under /api/* till Express-backend (server.js) i dev-läge, så App.jsx:s
// import av en fil under /api/ blev en riktig HTTP-förfrågan som proxyn
// kapade och skickade till Express, som svarade 404-HTML istället för JS —
// "Failed to fetch dynamically imported module" i webbläsaren, fast `vite
// build` (ingen runtime-hämtning, allt buntas in) aldrig visade felet.
//
// SQL-funktionen set_company_field (supabase-setup.sql) har sin EGEN
// vitlista i PL/pgSQL — den kan inte importera JS, så den måste fortfarande
// hållas i synk manuellt mot listan här.
export const COMPANY_WRITABLE_FIELDS = [
  'accounts', 'verifications', 'invoices', 'quotes', 'expenses', 'contacts',
  'articles', 'projects', 'timeEntries', 'timeReportStatuses',
  'billableTimeEntries', 'recurringTemplates', 'verificationTemplates',
  'vatPeriods', 'reviewHistory', 'employees', 'payrollRuns', 'company',
];
