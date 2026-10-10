// "Se hur" i sidhuvudet (shared/ListPageHeader.jsx): vilka av filmerna på
// /guider (content/marketing/guides.js) som hör till vilken sida i appen.
// Ny film = rad i guides.js och, om den hör till en sida, här.
import { GUIDE_GROUPS } from '../content/marketing/guides';

const PAGE_GUIDES = {
  contacts: ['lagg-upp-kund'],
  invoices: ['skapa-faktura', 'skicka-faktura', 'registrera-betalning'],
  quotes: ['skapa-offert'],
  articles: ['ny-artikel'],
  expenses: ['ladda-upp-kvitto'],
  verifications: ['ny-verifikation'],
  payroll: ['ny-anstalld'],
  projects: ['nytt-projekt'],
  taxes: ['momsdeklaration'],
  reports: ['rapporter'],
};

const ALL_GUIDES = GUIDE_GROUPS.flatMap(g => g.guides);

/** Filmerna för en sida ({ slug, title, lead }), tom lista om ingen finns. */
export function guidesForPage(tabId) {
  return (PAGE_GUIDES[tabId] || []).map(slug => ALL_GUIDES.find(g => g.slug === slug)).filter(Boolean);
}
