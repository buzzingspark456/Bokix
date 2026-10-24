// Admin-panelens Översikt och kundkort (resource: 'overview' och 'customer',
// api/admin/index.js). Rena funktioner här, så att de går att testa utan
// databas; hämtningen sker i index.js.
import { detectOrgType } from '../../src/utils/orgType.js';
import { planFromId } from '../../src/utils/plans.js';

const count = (v) => (Array.isArray(v) ? v.length : 0);
const latest = (dates) => dates.filter(Boolean).sort().at(-1) || null;

/** Ett företag i kundens sparade data → det admin behöver se. Aldrig belopp eller kunders namn. */
export function summarizeCompany(cd) {
  const c = cd?.company || {};
  const verifications = Array.isArray(cd?.verifications) ? cd.verifications : [];
  const invoices = Array.isArray(cd?.invoices) ? cd.invoices : [];
  const expenses = Array.isArray(cd?.expenses) ? cd.expenses : [];
  const contacts = Array.isArray(cd?.contacts) ? cd.contacts : [];
  return {
    id: c.id || null,
    name: c.name || null,
    orgNr: c.orgNr || null,
    orgType: c.isUf ? 'UF-företag' : (detectOrgType(c.orgNr) || null),
    shared: Boolean(cd?.__shared),
    settings: {
      vatRegistered: typeof c.vatRegistered === 'boolean' ? c.vatRegistered : null,
      vatPeriod: c.vatPeriod || null,
      vatPeriodConfirmed: Boolean(c.vatPeriodConfirmedAt || c.setupConfirmedAt),
      fSkatt: c.fSkatt || '',
      fSkattConfirmed: Boolean(c.fSkattConfirmedAt || c.setupConfirmedAt),
      fiscalYear: c.fiscalYear || null,
      firstFiscalYear: c.firstFiscalYear || null,
      setupDone: Boolean(c.setupConfirmedAt),
      needsSetup: Boolean(c.needsSetup),
    },
    usage: {
      verifications: verifications.length,
      invoices: invoices.length,
      sentInvoices: invoices.filter(i => i.status && i.status !== 'draft').length,
      receipts: expenses.filter(e => (e.type || 'receipt') === 'receipt').length,
      supplierInvoices: expenses.filter(e => e.type === 'supplier_invoice').length,
      customers: contacts.filter(x => x.type === 'customer').length,
      suppliers: contacts.filter(x => x.type === 'supplier').length,
      employees: count(cd?.employees),
      payrollRuns: count(cd?.payrollRuns),
      bankTransactions: count(cd?.bankTransactions),
      lastBookedDate: latest(verifications.map(v => v.date)),
    },
    integrations: {
      stripe: Boolean(c.stripeAccountId),
      zettle: Boolean(c.zettleAccessToken),
      ownEmailDomain: c.emailDomainStatus === 'verified',
    },
  };
}

/** Kontots sparade data (user_data.state) → ett sammandrag per eget företag. */
export function summarizeState(state) {
  return Object.values(state?.companies || {}).filter(cd => cd && !cd.__shared).map(summarizeCompany);
}

/** Har kontot kommit igång, alltså bokfört, fakturerat eller laddat upp något? */
export function hasStarted(companies) {
  return companies.some(c => c.usage.verifications + c.usage.invoices + c.usage.receipts + c.usage.supplierInvoices > 0);
}

const DAY = 86400000;

/**
 * Översiktens siffror och listor. `users` är auth-användare, `subs`
 * prenumerationsrader, `states` { userId: state } för de nya kontona,
 * `messages` kontaktmeddelanden och `events` systemhändelser.
 */
export function buildOverview({ users, subs, states = {}, messages = [], events = [], isAdmin = () => false, now = new Date() }) {
  const t = now.getTime();
  const subByUser = {};
  (subs || []).forEach(s => { if (!subByUser[s.user_id] || s.company_id === '') subByUser[s.user_id] = s; });
  const customers = (users || []).filter(u => !isAdmin(u.email));
  const emailOf = Object.fromEntries((users || []).map(u => [u.id, u.email]));
  // Grundarnas egna prenumerationer räknas inte.
  const own = (subs || []).filter(s => !isAdmin(emailOf[s.user_id] || ''));
  const since = (days) => customers.filter(u => u.created_at && t - new Date(u.created_at).getTime() <= days * DAY).length;

  const byStatus = {};
  own.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });

  const companyOf = (userId) => summarizeState(states[userId])[0]?.name || null;

  const trialsEnding = own
    .filter(s => s.status === 'trialing' && s.trial_ends_at)
    .map(s => ({ s, daysLeft: Math.ceil((new Date(s.trial_ends_at).getTime() - t) / DAY) }))
    .filter(x => x.daysLeft >= 0 && x.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map(({ s, daysLeft }) => ({
      userId: s.user_id, email: emailOf[s.user_id] || null, company: companyOf(s.user_id),
      trialEndsAt: s.trial_ends_at, daysLeft, plan: planFromId(s.plan)?.name || null,
      started: states[s.user_id] ? hasStarted(summarizeState(states[s.user_id])) : null,
    }));

  // Nya konton (2–30 dagar gamla) som inte bokfört, fakturerat eller laddat
  // upp något: de som behöver en hjälpande hand.
  const notStarted = customers
    .filter(u => {
      const age = t - new Date(u.created_at).getTime();
      return age >= 2 * DAY && age <= 30 * DAY && states[u.id] && !hasStarted(summarizeState(states[u.id]));
    })
    .map(u => ({ userId: u.id, email: u.email, company: companyOf(u.id), createdAt: u.created_at, lastSignInAt: u.last_sign_in_at || null, status: subByUser[u.id]?.status || null }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const recentSignups = [...customers]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)
    .map(u => ({ userId: u.id, email: u.email, company: companyOf(u.id), createdAt: u.created_at, status: subByUser[u.id]?.status || null, started: states[u.id] ? hasStarted(summarizeState(states[u.id])) : null }));

  const dayAgo = t - DAY;
  const recentEvents = (events || []).filter(e => new Date(e.created_at).getTime() >= dayAgo);
  const eventCounts = {};
  recentEvents.forEach(e => { eventCounts[e.kind] = (eventCounts[e.kind] || 0) + 1; });

  return {
    accounts: { total: customers.length, today: since(1), week: since(7), month: since(30) },
    subscriptions: {
      trialing: byStatus.trialing || 0,
      active: byStatus.active || 0,
      canceled: byStatus.canceled || 0,
      atRisk: (byStatus.past_due || 0) + (byStatus.unpaid || 0) + (byStatus.incomplete || 0),
      cancelingAtPeriodEnd: own.filter(s => s.cancel_at_period_end && s.status !== 'canceled').length,
    },
    trialsEnding,
    notStarted,
    recentSignups,
    unhandledMessages: (messages || []).filter(m => !m.handled_at).length,
    errorsLastDay: { total: recentEvents.length, byKind: eventCounts },
  };
}
