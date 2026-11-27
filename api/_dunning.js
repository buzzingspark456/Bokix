// Påminnelser när Bokix-abonnemanget inte går att dra (2026-11-27).
// Webhooken skickar det första mejlet direkt när dragningen misslyckas,
// nattjobbet (api/cron/reminders.js) resten. payment_reminder_stage på
// raden i public.subscriptions ser till att varje mejl skickas en gång.
// Bara det senast förfallna steget skickas: en kund som missat flera pass
// får inte tre mejl samma morgon.
import { brandedEmail, emailButton } from '../src/utils/brandedEmail.js';
import { subscriptionAccess, daysSinceFailure, READ_ONLY_AFTER_DAYS, LOCK_AFTER_DAYS } from '../src/utils/paymentAccess.js';
import { planFromId } from '../src/utils/plans.js';
import { sendWithFallback } from './_resend.js';

export const SITE_URL = 'https://www.bokix.se';

// Dagar efter första misslyckade dragningen.
export const DUNNING_STAGES = [
  { stage: 1, day: 0, key: 'failed' },
  { stage: 2, day: 3, key: 'reminder' },
  { stage: 3, day: 7, key: 'reminder' },
  { stage: 4, day: READ_ONLY_AFTER_DAYS - 2, key: 'readOnlySoon' },
  { stage: 5, day: READ_ONLY_AFTER_DAYS, key: 'readOnly' },
  { stage: 6, day: LOCK_AFTER_DAYS - 2, key: 'lockSoon' },
  { stage: 7, day: LOCK_AFTER_DAYS, key: 'locked' },
];

/** Steget som ska skickas nu, eller null. */
export function dueStage(row, now = Date.now()) {
  const days = daysSinceFailure(row, now);
  if (days == null) return null;
  // Betalt igen (eller uppsagd utan misslyckad dragning): inga påminnelser.
  if (!subscriptionAccess(row, now).failing) return null;
  let due = null;
  for (const s of DUNNING_STAGES) if (days >= s.day) due = s;
  if (!due || due.stage <= (Number(row.payment_reminder_stage) || 0)) return null;
  return due;
}

const fmtDate = (ms) => (ms ? new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' }).format(new Date(ms)) : '');

/** Mejlets ämne och innehåll för ett steg. */
export function buildDunningEmail({ key, amount, readOnlyAt, lockAt, siteUrl = SITE_URL }) {
  const kr = amount ? `${amount} kr` : 'abonnemanget';
  const button = emailButton(`${siteUrl}/?app=1&betalning=1`, key === 'locked' ? 'Återaktivera Bokix' : 'Öppna Bokix och betala');
  const how = '<p>I Bokix kan du försöka dra kortet igen med ett klick, eller byta till ett annat kort.</p>';
  const texts = {
    failed: {
      subject: 'Betalningen för Bokix gick inte igenom',
      body: `<p>Hej,</p><p>Vi kunde inte dra ${kr} för ditt Bokix-abonnemang. Det beror oftast på att kortet gått ut, saknar täckning eller att banken vill att du bekräftar köpet.</p>${how}<p>Allt fungerar som vanligt under tiden, och vi försöker själva igen de närmaste dagarna.</p>`,
    },
    reminder: {
      subject: 'Påminnelse: betalningen för Bokix saknas',
      body: `<p>Hej,</p><p>Betalningen på ${kr} för ditt Bokix-abonnemang har fortfarande inte gått igenom.</p>${how}<p>Löser det sig inte blir Bokix skrivskyddat ${fmtDate(readOnlyAt)}. Din bokföring finns kvar.</p>`,
    },
    readOnlySoon: {
      subject: 'Bokix blir skrivskyddat om två dagar',
      body: `<p>Hej,</p><p>Betalningen på ${kr} saknas fortfarande. ${fmtDate(readOnlyAt)} blir Bokix skrivskyddat: du kan se och ladda ner allt, men inte bokföra nytt förrän betalningen gått igenom.</p>${how}`,
    },
    readOnly: {
      subject: 'Bokix är nu skrivskyddat',
      body: `<p>Hej,</p><p>Eftersom betalningen på ${kr} inte gått igenom är Bokix nu skrivskyddat. Du kan fortfarande se, skriva ut och ladda ner din bokföring och dina rapporter.</p><p>Så fort betalningen går igenom fungerar allt igen, direkt. ${fmtDate(lockAt)} stängs kontot om betalningen fortfarande saknas.</p>${how}`,
    },
    lockSoon: {
      subject: 'Ditt Bokix-konto stängs om två dagar',
      body: `<p>Hej,</p><p>Betalningen saknas fortfarande, och ${fmtDate(lockAt)} stängs ditt Bokix-konto. Bokföringen sparas i sju år som lagen kräver, och du kan alltid ladda ner den eller återaktivera kontot.</p>${how}`,
    },
    locked: {
      subject: 'Ditt Bokix-konto är stängt',
      body: `<p>Hej,</p><p>Eftersom betalningen inte gått igenom är ditt Bokix-konto nu stängt. Din bokföring finns kvar och sparas i sju år. Logga in för att ladda ner den eller för att återaktivera kontot, så är allt som vanligt igen.</p>`,
    },
    cardExpiring: {
      subject: 'Kortet för Bokix går snart ut',
      body: '<p>Hej,</p><p>Kortet som Bokix-abonnemanget dras från går ut i slutet av månaden. Byt kort i Bokix i god tid, så fortsätter allt utan avbrott.</p>',
    },
  };
  const t = texts[key];
  return { subject: t.subject, html: brandedEmail({ title: t.subject, body: `${t.body}${button}` }) };
}

/** Beloppet som dras per månad för raden (plankatalogen), annars 179 kr. */
export function amountForRow(row) {
  const plan = planFromId(row?.plan);
  return plan ? plan.price : 179;
}

/**
 * Skickar steget till kontots e-post och markerar det som skickat.
 * Returnerar true om något skickades.
 */
export async function sendDunningStage(admin, row, due, { now = Date.now(), dryRun = false } = {}) {
  if (!due) return false;
  const { data, error } = await admin.auth.admin.getUserById(row.user_id);
  const to = data?.user?.email;
  if (error || !to) throw new Error('kunde inte slå upp kontots e-post');
  if (dryRun) return true;
  const access = subscriptionAccess(row, now);
  const mail = buildDunningEmail({ key: due.key, amount: amountForRow(row), readOnlyAt: access.readOnlyAt, lockAt: access.lockAt });
  const result = await sendWithFallback({ to: [to], subject: mail.subject, html: mail.html });
  if (!result.ok) throw new Error(result.data?.message || 'Resend-fel');
  const { error: markError } = await admin.from('subscriptions').update({ payment_reminder_stage: due.stage }).eq('id', row.id);
  if (markError) throw markError;
  return true;
}
