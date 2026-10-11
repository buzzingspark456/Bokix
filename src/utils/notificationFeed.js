// Notisklockan i toppen: saker som HÄNT, inte saker att göra (det är
// Startsidans Att göra, utils/todoItems.js). Byggs ur det Bokix redan har
// i webbläsaren, så klockan fylls när appen är öppen.
//
// Varje notis har en eller flera nycklar. En notis är ny tills alla dess
// nycklar setts, och de sedda nycklarna sparas per företag i webbläsaren.
// Siffran på klockan är antalet nya notiser; den nollas när klockan öppnas.

const DAY = 86400000;
const KEEP_DAYS = 30;
const MAX_ITEMS = 25;
const MAX_SEEN = 400;

export function seenStorageKey(companyId) { return `bokix_notif_seen_${companyId || 'default'}`; }

export function readSeenKeys(companyId) {
  try {
    const v = JSON.parse(localStorage.getItem(seenStorageKey(companyId)) || '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch { return new Set(); }
}

/** Lägger till nycklarna som sedda. De äldsta faller bort efter MAX_SEEN. */
export function writeSeenKeys(companyId, seen, keys) {
  const all = [...seen, ...keys.filter(k => !seen.has(k))].slice(-MAX_SEEN);
  try { localStorage.setItem(seenStorageKey(companyId), JSON.stringify(all)); } catch { /* privat läge */ }
  return new Set(all);
}

const isoDay = (at) => String(at || '').slice(0, 10);
const sek = (n) => `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(n || 0))} kr`;

/**
 * @param invoices        kundfakturor; en betalning via Betala nu har paidVia 'stripe'
 * @param expenses        kvitton; mejlade har inbox.receivedAt
 * @param integrationEvents ogranskade Stripe/Zettle-rader: { id, source, at, amount }
 * @param vat             { key, label, quarter, dueDate, daysLeft } när momsen snart ska in, annars null
 * @param agi             { periodKey, dueDate, daysLeft } när AGI snart ska in, annars null
 */
export function buildNotificationFeed({ t, invoices = [], expenses = [], integrationEvents = [], vat = null, agi = null, now = new Date() }) {
  const since = new Date(now.getTime() - KEEP_DAYS * DAY).toISOString();
  const items = [];

  // Kunden betalade via Betala nu.
  for (const inv of invoices) {
    if (inv.status !== 'paid' || inv.paidVia !== 'stripe' || !inv.paidDate || inv.paidDate < isoDay(since)) continue;
    items.push({
      keys: [`paid:${inv.id}`], at: `${inv.paidDate}T12:00:00`, kind: 'paid', tone: 'green',
      text: t('notifFeed.invoicePaid', { number: inv.invoiceNumber || '', amount: sek(inv.paidAmount) }),
      target: { tab: 'invoices', action: { type: 'open_invoice', payload: { id: inv.id } } },
    });
  }

  // Kvitton som mejlats till e-postinkorgen, en notis per dag.
  const inboxByDay = new Map();
  for (const e of expenses) {
    const at = e.inbox?.receivedAt;
    if (!at || at < since) continue;
    const day = isoDay(at);
    if (!inboxByDay.has(day)) inboxByDay.set(day, []);
    inboxByDay.get(day).push(e);
  }
  for (const [day, list] of inboxByDay) {
    // Bara domänen ("telia.se"): kort, och säger vem det kommer från.
    const senders = [...new Set(list.map(e => String(e.inbox.from || '').split('@').pop().replace(/>$/, '').trim()).filter(Boolean))];
    const latest = list.map(e => e.inbox.receivedAt).sort().at(-1);
    items.push({
      keys: list.map(e => `inbox:${e.id}`), at: latest, kind: 'inbox', tone: 'blue',
      text: list.length === 1
        ? t('notifFeed.inboxOne', { from: senders[0] || t('notifFeed.unknownSender') })
        : t(senders.length > 1 ? 'notifFeed.inboxManySenders' : 'notifFeed.inboxMany', { count: list.length, from: senders[0] || t('notifFeed.unknownSender') }),
      target: { tab: 'expenses' },
    });
  }

  // Nya Stripe- och Zettle-händelser att bokföra, en notis per källa och dag.
  const integrationGroups = new Map();
  for (const ev of integrationEvents) {
    if (!ev.at || ev.at < since) continue;
    const key = `${ev.source}|${isoDay(ev.at)}`;
    if (!integrationGroups.has(key)) integrationGroups.set(key, []);
    integrationGroups.get(key).push(ev);
  }
  for (const [key, list] of integrationGroups) {
    const source = key.split('|')[0];
    const name = source === 'zettle' ? 'Zettle' : 'Stripe';
    items.push({
      keys: list.map(ev => `${source}:${ev.id}`), at: list.map(ev => ev.at).sort().at(-1), kind: 'integration', tone: 'green',
      text: list.length === 1 ? t('notifFeed.integrationOne', { name }) : t('notifFeed.integrationMany', { name, count: list.length }),
      target: { tab: 'review' },
    });
  }

  // Deklarationer som snart ska in: en gång per period, från sju dagar innan.
  const deadlineAt = (dueDate) => new Date(new Date(dueDate).getTime() - 7 * DAY).toISOString();
  if (vat && vat.daysLeft <= 7) {
    items.push({
      keys: [`vat:${vat.key}`], at: vat.daysLeft < 0 ? new Date(vat.dueDate).toISOString() : deadlineAt(vat.dueDate), kind: 'deadline', tone: vat.daysLeft < 0 ? 'red' : 'amber',
      text: vat.daysLeft < 0 ? t('notifFeed.vatLate', { label: vat.label }) : t('notifFeed.vatSoon', { label: vat.label, days: vat.daysLeft }),
      target: { tab: 'taxes_vat' },
    });
  }
  if (agi && agi.daysLeft <= 7) {
    items.push({
      keys: [`agi:${agi.periodKey}`], at: deadlineAt(agi.dueDate), kind: 'deadline', tone: 'amber',
      text: t('notifFeed.agiSoon', { period: agi.periodKey, days: agi.daysLeft }),
      target: { tab: 'taxes' },
    });
  }

  return items.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, MAX_ITEMS);
}

/** Ny = någon av notisens nycklar är inte sedd. */
export function isUnread(item, seen) {
  return item.keys.some(k => !seen.has(k));
}

/** "I dag", "I går" eller datumet, för raden i listan. */
export function notificationWhen(t, at, now = new Date()) {
  const day = isoDay(new Date(at).toISOString());
  const today = isoDay(now.toISOString());
  const yesterday = isoDay(new Date(now.getTime() - DAY).toISOString());
  if (day === today) return t('notifFeed.today');
  if (day === yesterday) return t('notifFeed.yesterday');
  return new Date(at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}
