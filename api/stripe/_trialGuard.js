// Spärr mot upprepade provperioder (2026-10-04). Samma person skapade nya
// konton för att få nya gratisperioder. En enda signal räcker inte:
//   - IP-adress: fyra personer i samma hem eller på samma kontor delar en, så
//     den väger bara lätt och först vid flera provperioder på kort tid.
//   - Webbläsarens fingeravtryck: byts lätt (annan webbläsare, tidszon).
// Bokix har två signaler som är mycket starkare än båda:
//   - Organisationsnumret: ett företag har ett, och det slås upp vid
//     registreringen. Ett företag får en provperiod.
//   - Kortet: Stripe ger varje kort ett fingeravtryck som är detsamma oavsett
//     namn och e-post. Ett kort får en provperiod.
// Till det e-postadressen, normaliserad så att gmail-tricken (punkter och
// +tillägg) räknas som samma adress.
//
// Historiken ligger i Stripe (metadata på prenumerationen, sökbar med Stripe
// Search), så ingen egen tabell behövs. IP-adressen sparas bara som en
// saltad hash, aldrig i klartext. Går Stripe inte att fråga släpps kunden
// igenom (fail open): en riktig kund ska aldrig nekas på grund av ett nätfel.
import { createHash } from 'node:crypto';

// Provperioder från samma IP-adress inom 30 dagar innan IP:n räknas.
export const IP_TRIAL_LIMIT = 3;
const IP_WINDOW_SECONDS = 30 * 24 * 3600;

/** E-post som en person: gmail.com/googlemail.com utan punkter, alla utan +tillägg. */
export function normalizeEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1) return raw;
  let local = raw.slice(0, at).split('+')[0];
  let domain = raw.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

/** Organisationsnummer som tio siffror ("16" före tas bort), eller ''. */
export function normalizeOrgNr(orgNr) {
  let digits = String(orgNr || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('16')) digits = digits.slice(2);
  return digits.length === 10 ? digits : '';
}

/** Saltad hash av IP-adressen, så att den går att jämföra men inte läsa. */
export function hashIp(ip) {
  if (!ip || ip === 'unknown') return '';
  const salt = process.env.SIGNED_TOKEN_SECRET || 'bokix';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 24);
}

/** Metadata som sätts på varje ny prenumeration så att nästa försök kan jämföras. */
export function trialMetadata({ email, orgNr, ip }) {
  const out = {};
  const e = normalizeEmail(email);
  const o = normalizeOrgNr(orgNr);
  const i = hashIp(ip);
  if (e) out.bokix_email_norm = e;
  if (o) out.bokix_orgnr = o;
  if (i) out.bokix_ip = i;
  return out;
}

// Stripe Search tillåter bara vissa tecken i ett värde.
const q = (v) => String(v).replace(/['\\]/g, '');

async function priorTrials(stripe, key, value) {
  const res = await stripe.subscriptions.search({ query: `metadata['${key}']:'${q(value)}'`, limit: 20 });
  return res.data.filter(s => s.trial_start);
}

/**
 * Ska den här registreringen få en provperiod? Returnerar
 * { allowTrial, reasons } där reasons är 'orgnr' | 'email' | 'ip'.
 * `excludeUserId`: kontots egna tidigare försök (en avbruten checkout) räknas inte.
 * För org.numret gäller det bara samma företagspost (`companyId`): ett företag
 * som tas bort och läggs till igen på kontot är samma företag och ska inte få
 * en ny provperiod.
 */
export async function trialDecision(stripe, { email, orgNr, ip, excludeUserId = null, companyId = null }) {
  const reasons = [];
  const notMine = (s) => !excludeUserId || s.metadata?.user_id !== excludeUserId;
  try {
    const o = normalizeOrgNr(orgNr);
    const otherCheckout = (s) => notMine(s) || (s.metadata?.company_id || null) !== companyId;
    if (o && (await priorTrials(stripe, 'bokix_orgnr', o)).some(otherCheckout)) reasons.push('orgnr');
    const e = normalizeEmail(email);
    if (e && (await priorTrials(stripe, 'bokix_email_norm', e)).some(notMine)) reasons.push('email');
    const i = hashIp(ip);
    if (i) {
      const since = Math.floor(Date.now() / 1000) - IP_WINDOW_SECONDS;
      const recent = (await priorTrials(stripe, 'bokix_ip', i)).filter(s => s.created >= since && notMine(s));
      if (recent.length >= IP_TRIAL_LIMIT) reasons.push('ip');
    }
  } catch (err) {
    console.warn('[provperiod] kunde inte kontrollera tidigare provperioder, släpper igenom:', err.message);
    return { allowTrial: true, reasons: [], error: true };
  }
  return { allowTrial: reasons.length === 0, reasons };
}

/**
 * Efter att kortet lagts in (customer.subscription.created): har samma kort
 * redan använts för en provperiod på ett annat konto avslutas provperioden
 * direkt och kortet debiteras. Kortets fingeravtryck sparas på
 * prenumerationen så att nästa försök med kortet känns igen.
 * Returnerar 'ended' | 'recorded' | 'skipped'.
 */
export async function enforceCardTrialLimit(stripe, subscription) {
  if (!subscription || subscription.status !== 'trialing' || subscription.metadata?.bokix_card_fp) return 'skipped';
  try {
    const full = await stripe.subscriptions.retrieve(subscription.id, { expand: ['default_payment_method'] });
    const fp = full.default_payment_method?.card?.fingerprint;
    if (!fp) return 'skipped';
    const earlier = (await priorTrials(stripe, 'bokix_card_fp', fp)).filter(s => s.id !== full.id);
    if (earlier.length > 0) {
      await stripe.subscriptions.update(full.id, {
        trial_end: 'now',
        metadata: { bokix_card_fp: fp, bokix_trial_denied: 'card' },
      });
      console.warn('[provperiod] kortet har redan haft en provperiod, provperioden avslutad:', full.id);
      return 'ended';
    }
    await stripe.subscriptions.update(full.id, { metadata: { bokix_card_fp: fp } });
    return 'recorded';
  } catch (err) {
    console.warn('[provperiod] kunde inte kontrollera kortet:', err.message);
    return 'skipped';
  }
}
