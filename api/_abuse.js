// Skydd mot missbruk som delas av flera endpoints (2026-10-04): engångsadresser
// vid registrering och en IP-spärrlista.
//
// IP-spärren: sätt BLOCKED_IPS i Vercel (kommaseparerad, enskilda adresser
// eller IPv4-nät som 203.0.113.0/24). Den kontrolleras i checkRateLimit, som
// alla publika endpoints redan anropar, så en spärrad adress stoppas överallt
// utan att varje fil behöver ändras. För att stoppa en angripare redan innan
// sajten svarar (även de statiska sidorna) läggs samma adress in i Vercels
// brandvägg (Firewall → Custom rules → IP Blocking).

// Vanliga tjänster för slit-och-släng-adresser. Inte heltäckande, men de flesta
// massregistreringar använder någon av dem.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', 'grr.la',
  '10minutemail.com', '10minutemail.net', 'temp-mail.org', 'tempmail.com', 'tempmail.net', 'tempmailo.com',
  'temp-mail.io', 'tmpmail.org', 'tmpmail.net', 'yopmail.com', 'yopmail.net', 'yopmail.fr', 'getnada.com',
  'nada.email', 'trashmail.com', 'trashmail.de', 'dispostable.com', 'maildrop.cc', 'mailnesia.com', 'mintemail.com',
  'throwawaymail.com', 'fakeinbox.com', 'emailondeck.com', 'moakt.com', 'mohmal.com', 'mailcatch.com',
  'spamgourmet.com', 'tempinbox.com', 'discard.email', 'burnermail.io', 'mail.tm', 'mail.gw', 'tempr.email',
  'emltmp.com', 'dropmail.me', '1secmail.com', '1secmail.net', '1secmail.org', 'inboxkitten.com', 'mytemp.email',
  'tempail.com', 'luxusmail.org', 'minuteinbox.com', 'spambox.us', 'trash-mail.com', 'wegwerfmail.de',
]);

// Engångstjänster som använder slumpade domäner (10minutemail gav
// jbsze.net, 2026-11-06) syns på domänens e-postserver (MX) i stället.
const DISPOSABLE_MX = ['10minutemail.com', 'mailinator.com', 'guerrillamail.com', 'temp-mail.org', 'tempmail.com', 'yopmail.com', 'mail.tm', 'dropmail.me', 'emailondeck.com', 'moakt.com', 'maildrop.cc', 'mailnesia.com', 'trashmail.com', 'dispostable.com', 'getnada.com', '1secmail.com', 'tempmail.plus', 'tempm.com', 'emailfake.com', 'generator.email'];

/**
 * Som isDisposableEmail, men tittar också på domänens e-postserver. Går
 * uppslaget inte att göra (nät, tidsgräns) släpps adressen igenom som förut.
 * `resolveMx` kan bytas ut i testerna.
 */
export async function isDisposableEmailDeep(email, { resolveMx, timeoutMs = 1500 } = {}) {
  if (isDisposableEmail(email)) return true;
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  if (!domain) return false;
  try {
    const lookup = resolveMx || (await import('node:dns/promises')).resolveMx;
    const records = await Promise.race([lookup(domain), new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
    return Boolean(records?.some(r => DISPOSABLE_MX.some(d => String(r.exchange || '').toLowerCase().replace(/\.$/, '').endsWith(d))));
  } catch {
    return false;
  }
}

/** Är adressen från en tjänst för engångsadresser (även en underdomän)? */
export function isDisposableEmail(email) {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  if (!domain) return false;
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

function ipv4ToInt(ip) {
  const m = String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some(p => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/** Står adressen på spärrlistan? `list` = BLOCKED_IPS (kommaseparerad). Exporterad för testerna. */
export function isIpBlocked(ip, list = process.env.BLOCKED_IPS || '') {
  if (!ip || !list) return false;
  const target = String(ip).trim();
  for (const raw of String(list).split(',').map(s => s.trim()).filter(Boolean)) {
    if (raw === target) return true;
    const [base, bits] = raw.split('/');
    if (bits === undefined) continue;
    const a = ipv4ToInt(base); const b = ipv4ToInt(target); const n = Number(bits);
    if (a === null || b === null || !(n >= 0 && n <= 32)) continue;
    const mask = n === 0 ? 0 : ((~0 << (32 - n)) >>> 0);
    if (((a & mask) >>> 0) === ((b & mask) >>> 0)) return true;
  }
  return false;
}
