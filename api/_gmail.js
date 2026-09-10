import crypto from 'node:crypto';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';

// ── Skicka via Gmail utan att kunna läsa något ──────────────────────────
// Kundens önskemål, ordagrant i sak: "de loggar in med sin mejl och kan
// sedan enkelt skicka — vi läser inte deras mejl, de ska bara kunna
// skicka". Det är precis vad den här filen gör.
//
// BEHÖRIGHETEN ÄR HELA POÄNGEN. Vi ber om exakt en scope:
//
//     https://www.googleapis.com/auth/gmail.send
//
// Den ger rätt att skicka, och ingenting annat. Inkorgen, arkivet,
// kontakterna och utkasten är otillgängliga för oss — inte för att vi
// lovar det, utan för att Google inte släpper in oss. Kunden ser det själv
// på samtyckesskärmen: "Skicka e-post för din räkning."
//
// DÄRFÖR GMAIL-API:et OCH INTE SMTP. Att skicka genom smtp.gmail.com med
// OAuth kräver scopen https://mail.google.com/ — full åtkomst till hela
// mejlkontot, alltså raka motsatsen till det kunden bad om (och en
// "restricted scope" som kräver en dyr säkerhetsgranskning hos Google).
// Gmail-API:ets messages.send klarar sig på gmail.send, som bara är
// "sensitive": appen måste granskas innan fler än 100 användare kan koppla
// sitt konto, men ingen granskningsavgift och ingen läsrättighet.
//
// App-lösenordsvägen i api/_smtp.js finns kvar vid sidan av. Den fungerar
// för alla leverantörer och kräver ingen granskning alls, så den är kvar
// som alternativ — särskilt tills Google-granskningen är klar.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Bara sändning. Lägg ALDRIG till en läsande scope här utan att först
// förstå vad det innebär: gmail.readonly och https://mail.google.com/ är
// "restricted" och kräver en årlig, betald säkerhetsgranskning (CASA) —
// utöver att det bryter löftet till kunden.
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
// email-scopen behövs för att veta VILKEN adress som kopplades. Den är
// "sensitive" på pappret men ingår i den vanliga inloggningsprofilen.
const SCOPES = [GMAIL_SCOPE, 'https://www.googleapis.com/auth/userinfo.email'].join(' ');

const getClientId = () => process.env.GOOGLE_OAUTH_CLIENT_ID || null;
const getClientSecret = () => process.env.GOOGLE_OAUTH_CLIENT_SECRET || null;

export function hasGoogleOAuth() {
  return Boolean(getClientId() && getClientSecret());
}

/** Callback-adressen måste vara EXAKT densamma i tre led: här, i Googles
 *  konsol, och i anropet som växlar in koden. Google tillåter ingen
 *  frågesträng i den registrerade adressen — därför en ren sökväg, och all
 *  medskickad information i `state` i stället. Sidan som ligger där är en
 *  vanlig vy i appen (AppRouter: /koppla-mejl), inte en serverlös funktion,
 *  vilket också håller oss kvar under Vercels 12-funktionsgräns. */
export function redirectUri(origin) {
  const base = (origin || process.env.SITE_URL || 'https://www.bokix.se').replace(/\/+$/, '');
  return `${base}/koppla-mejl`;
}

export function buildAuthUrl({ state, origin, loginHint }) {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: SCOPES,
    // offline + consent: vi MÅSTE få en refresh_token, annars tappar vi
    // rätten att skicka så fort access-token går ut om en timme. Google
    // ger bara ut en ny refresh_token när samtycket visas på nytt.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error_description || data?.error || `HTTP ${res.status}`;
    throw new Error(`Google nekade: ${detail}`);
  }
  return data;
}

/** Byter engångskoden mot tokens. Returnerar även adressen kontot har, så
 *  avsändaren blir rätt utan att kunden behöver skriva in den. */
export async function exchangeCode(code, origin) {
  const tokens = await tokenRequest({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: redirectUri(origin),
    grant_type: 'authorization_code',
  });
  if (!tokens.refresh_token) {
    throw new Error('Google skickade ingen refresh-token. Ta bort Bokix under ditt Google-kontos säkerhetsinställningar och försök igen.');
  }

  let email = null;
  try {
    const meRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (meRes.ok) email = (await meRes.json())?.email || null;
  } catch {
    // Adressen går att fylla i för hand om uppslaget fallerar — inte värt
    // att fälla hela kopplingen för.
  }

  return { refreshToken: tokens.refresh_token, email };
}

/** Access-token lever en timme och sparas aldrig — den hämtas färsk vid
 *  varje utskick. En sparad access-token är bara en till hemlighet att
 *  läcka, utan att spara oss mer än ett nätverksanrop. */
export async function accessTokenFrom(refreshToken) {
  const tokens = await tokenRequest({
    refresh_token: refreshToken,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    grant_type: 'refresh_token',
  });
  return tokens.access_token;
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Bygger själva mejlet (MIME) och lämnar över det till Gmail. Vi
 *  återanvänder nodemailers meddelandebyggare men INTE dess sändning —
 *  Gmail vill ha råmeddelandet, inte en SMTP-uppkoppling. */
export async function sendViaGmail({ refreshToken, from, to, subject, html, replyTo, attachmentBase64, attachmentFilename }) {
  const accessToken = await accessTokenFrom(refreshToken);

  const mail = new MailComposer({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(attachmentBase64
      ? { attachments: [{ filename: attachmentFilename || 'faktura.pdf', content: Buffer.from(attachmentBase64, 'base64') }] }
      : {}),
  });
  const raw = await new Promise((resolve, reject) => {
    mail.compile().build((err, message) => (err ? reject(err) : resolve(message)));
  });

  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64url(raw) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(friendlyGoogleError(detail));
  }
  return { id: data.id };
}

/** Google svarar med utvecklartext. Kunden behöver veta vad DE ska göra. */
export function friendlyGoogleError(raw) {
  const text = String(raw || '');
  if (/invalid_grant|Token has been expired or revoked/i.test(text)) {
    return 'Kopplingen till Google har upphört att gälla — troligen har åtkomsten återkallats i Google-kontot. Koppla ditt konto på nytt.';
  }
  if (/insufficient|Insufficient Permission|ACCESS_TOKEN_SCOPE/i.test(text)) {
    return 'Behörigheten att skicka saknas. Koppla kontot på nytt och godkänn steget "Skicka e-post för din räkning".';
  }
  if (/rate|quota|limit/i.test(text)) {
    return 'Google har tillfälligt bromsat utskicken från kontot. Försök igen om en stund.';
  }
  return `Google svarade: ${text.slice(0, 200)}`;
}

/** Slumpad nonce till state-parametern. */
export function randomNonce() {
  return crypto.randomBytes(16).toString('hex');
}

// ── Signerad state ──────────────────────────────────────────────────────
// state följer med till Google och tillbaka. Den bär vem som kopplar och
// för vilket företag, och måste därför gå att lita på när den kommer
// tillbaka — annars kan någon annan länka SITT Google-konto till ett
// annat företags avsändare. Signerad med samma serverhemlighet som
// krypterar tokens (EMAIL_SECRET_KEY), och kortlivad.
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

function stateSecret() {
  const secret = process.env.EMAIL_SECRET_KEY;
  if (!secret) throw new Error('EMAIL_SECRET_KEY saknas.');
  return secret;
}

export function signState(payload) {
  const data = { ...payload, nonce: randomNonce(), ts: Date.now() };
  const json = base64url(Buffer.from(JSON.stringify(data), 'utf8'));
  const sig = base64url(crypto.createHmac('sha256', stateSecret()).update(json).digest());
  return json + '.' + sig;
}

/** Returnerar payloaden om signaturen stämmer och state:n inte är för
 *  gammal, annars null. */
export function verifyState(state) {
  const parts = String(state || '').split('.');
  if (parts.length !== 2) return null;
  const [json, sig] = parts;
  const expected = base64url(crypto.createHmac('sha256', stateSecret()).update(json).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const padded = json.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    if (!data?.ts || Date.now() - data.ts > STATE_MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}
