import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { sendViaGmail, friendlyGoogleError } from './_gmail.js';

// ── Skicka från kundens EGEN e-postadress ───────────────────────────────
// Problemet: Bokix skickar fakturor via Resend, och en egen avsändardomän
// kräver att man äger en domän och kan sätta DNS-poster. Den som har
// firman på en gmail.com-adress kan alltså bara skicka som
// "Företaget via Bokix <faktura@bokix.se>". Kunden vill kunna skicka från
// sin faktiska adress, och det får inte kosta Bokix något.
//
// Lösningen är SMTP mot kundens eget mejlkonto. Vi äger ingen leverans,
// vi lånar deras: mejlet går ut genom Gmail/Outlook/one.com precis som om
// de tryckt skicka i sin egen inkorg.
//
//   · Gratis för oss. Utskicken går på kundens egen kvot, inte på vår
//     Resend-plan. Ingen kostnad per mejl, oavsett hur många kunder vi får.
//   · Kommer verkligen fram. Gmail DKIM-signerar och SPF-godkänner sitt
//     eget utgående mejl. Att i stället skicka "från" en gmail-adress via
//     en tredjepartstjänst är precis det DMARC finns för att stoppa.
//   · Hamnar i deras Skickat-mapp, eftersom det är deras server som
//     skickar. Kunden ser vad som gått iväg utan att fråga oss.
//
// VARFÖR INTE OAUTH (ännu): "Logga in med Google" hade varit finare än ett
// app-lösenord, men gmail.send är en känslig behörighet. Appen måste
// granskas av Google innan den släpps på fler än 100 användare, och tills
// dess möts varje ny kund av en varningsskärm om en overifierad app. Ett
// app-lösenord fungerar i dag, för alla leverantörer, utan att någon
// tredje part behöver godkänna oss. OAuth kan läggas till senare vid sidan
// av — den här filens gränssnitt (loadSender/sendViaSmtp) är samma oavsett.
//
// SÄKERHET: lösenordet krypteras med AES-256-GCM innan det sparas och
// tabellen har RLS PÅ helt utan policyer — bara service_role-nyckeln
// (server-sidan) kommer åt raden. Klienten får aldrig se hemligheten, bara
// om en avsändare finns och vilken adress den gäller.

const TABLE = 'email_senders';

const getUrl = () => process.env.VITE_SUPABASE_URL || null;
const getServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || null;
const getSecretKey = () => process.env.EMAIL_SECRET_KEY || null;

export function hasEmailSecretKey() {
  return Boolean(getSecretKey());
}

function adminClient() {
  const url = getUrl();
  const key = getServiceKey();
  if (!url || !key) return null;
  return createClient(url, key);
}

/** 32 byte nyckel ur valfri hemlighetssträng — SHA-256 av env-värdet, så
 *  EMAIL_SECRET_KEY kan vara vilken slumpsträng som helst. */
function keyBytes() {
  const secret = getSecretKey();
  if (!secret) throw new Error('EMAIL_SECRET_KEY saknas.');
  return crypto.createHash('sha256').update(secret).digest();
}

/** Format: v1.<iv>.<authTag>.<ciphertext>, allt base64. Versionsprefixet
 *  finns för att kunna byta algoritm senare utan att gamla rader blir
 *  oläsbara gissningar. */
export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(payload) {
  const parts = String(payload || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Okänt format på sparad hemlighet.');
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

// Färdiga inställningar för de leverantörer svenska småföretag faktiskt
// använder. Poängen är att kunden bara ska behöva sin adress och ett
// app-lösenord — värdnamn och portnummer är inget en företagare ska
// behöva leta reda på. `appPasswordUrl` pekar rakt på sidan där man
// skapar lösenordet, `help` är det som visas i gränssnittet.
export const GOOGLE_PROVIDER = 'google';

export const PROVIDERS = {
  gmail: {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    matches: [/@gmail\.com$/i, /@googlemail\.com$/i],
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
    help: 'Kräver tvåstegsverifiering på Google-kontot. Skapa ett app-lösenord (16 tecken) och klistra in det här — inte ditt vanliga lösenord.',
  },
  outlook: {
    id: 'outlook',
    label: 'Outlook / Hotmail / Microsoft 365',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    matches: [/@outlook\.[a-z.]+$/i, /@hotmail\.[a-z.]+$/i, /@live\.[a-z.]+$/i, /@msn\.com$/i],
    appPasswordUrl: 'https://account.microsoft.com/security',
    help: 'Kräver tvåstegsverifiering. Skapa ett app-lösenord under Säkerhet och klistra in det här.',
  },
  onecom: {
    id: 'onecom',
    label: 'one.com',
    host: 'send.one.com',
    port: 465,
    secure: true,
    matches: [],
    help: 'Använd samma lösenord som till webbmejlen hos one.com.',
  },
  loopia: {
    id: 'loopia',
    label: 'Loopia',
    host: 'mailcluster.loopia.se',
    port: 465,
    secure: true,
    matches: [],
    help: 'Använd samma lösenord som till webbmejlen hos Loopia.',
  },
  custom: {
    id: 'custom',
    label: 'Annan leverantör',
    host: '',
    port: 465,
    secure: true,
    matches: [],
    help: 'Fyll i serveradress och port från din leverantörs hjälpsidor. Söker du på "SMTP" plus leverantörens namn hittar du dem.',
  },
};

/** Gissar leverantör ur adressen, så gränssnittet kan förifylla rätt
 *  server utan att fråga. Faller tillbaka på 'custom'. */
export function guessProvider(email) {
  const addr = String(email || '').trim();
  for (const p of Object.values(PROVIDERS)) {
    if (p.matches.some(re => re.test(addr))) return p.id;
  }
  return 'custom';
}

/** Publik vy av en sparad avsändare — ALDRIG hemligheten. Det här är allt
 *  klienten någonsin får se. */
export function publicView(row) {
  if (!row) return null;
  return {
    fromEmail: row.from_email,
    fromName: row.from_name || null,
    provider: row.provider,
    host: row.host,
    port: row.port,
    verifiedAt: row.verified_at || null,
    lastError: row.last_error || null,
  };
}

export async function loadSenderRow(userId, companyId) {
  const admin = adminClient();
  if (!admin) return { error: 'Serverns databasnyckel saknas.' };
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle();
  // Tabellen kan saknas i en databas där supabase-setup.sql inte körts om.
  // Det ska INTE se ut som ett fel för användaren — det betyder bara att
  // ingen egen avsändare är kopplad.
  if (error && /relation .* does not exist/i.test(error.message || '')) return { row: null, missingTable: true };
  if (error) return { error: error.message };
  return { row: data || null };
}

export async function saveSenderRow(userId, companyId, values) {
  const admin = adminClient();
  if (!admin) return { error: 'Serverns databasnyckel saknas.' };
  const { error } = await admin
    .from(TABLE)
    .upsert({
      user_id: userId,
      company_id: companyId,
      ...values,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,company_id' });
  if (error) return { error: error.message };
  return {};
}

/** Delvis uppdatering av en BEFINTLIG rad. Kan inte gå via upsert: den
 *  bygger en hel INSERT-rad först, och en halv rad faller på NOT NULL
 *  innan Postgres ens hinner till ON CONFLICT. */
export async function updateSenderRow(userId, companyId, values) {
  const admin = adminClient();
  if (!admin) return { error: 'Serverns databasnyckel saknas.' };
  const { error } = await admin
    .from(TABLE)
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('company_id', companyId);
  if (error) return { error: error.message };
  return {};
}

export async function deleteSenderRow(userId, companyId) {
  const admin = adminClient();
  if (!admin) return { error: 'Serverns databasnyckel saknas.' };
  const { error } = await admin.from(TABLE).delete().eq('user_id', userId).eq('company_id', companyId);
  if (error) return { error: error.message };
  return {};
}

function transportFor({ host, port, secure, username, password }) {
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Boolean(secure),
    auth: { user: username, pass: password },
    // Korta tider: en felkonfigurerad server får inte hålla en
    // serverlös funktion öppen tills plattformen dödar den.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/** Loggar in mot servern utan att skicka något. Används när kunden sparar
 *  sina uppgifter — ett fel ska visas DÅ, inte första gången en riktig
 *  faktura ska iväg. */
export async function verifySmtp(config) {
  try {
    await transportFor(config).verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlySmtpError(error) };
  }
}

/** Översätter de fel som faktiskt inträffar till något en företagare kan
 *  göra något åt. Rå SMTP-text ("535 5.7.8 Username and Password not
 *  accepted") hjälper ingen. */
export function friendlySmtpError(error) {
  const raw = String(error?.response || error?.message || error || '');
  if (/535|Username and Password not accepted|authentication failed|AUTH/i.test(raw)) {
    return 'Servern nekade inloggningen. Med Gmail och Outlook måste du använda ett app-lösenord, inte ditt vanliga lösenord.';
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(raw)) {
    return 'Hittade ingen server på den adressen. Kontrollera serveradressen (SMTP-värden).';
  }
  if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|timeout/i.test(raw)) {
    return 'Fick ingen kontakt med servern. Kontrollera port och om den kräver SSL.';
  }
  if (/certificate|self.signed/i.test(raw)) {
    return 'Serverns certifikat gick inte att verifiera.';
  }
  return raw ? `Servern svarade: ${raw.slice(0, 200)}` : 'Okänt fel mot e-postservern.';
}

/**
 * Skickar ett mejl genom kundens egen server.
 *
 * `attachmentBase64` är samma format som Resend-vägen använder, så
 * anropande kod slipper veta vilken väg mejlet tar.
 */
export async function sendViaSmtp(row, { to, subject, html, replyTo, attachmentBase64, attachmentFilename }) {
  const password = decryptSecret(row.secret);
  const transporter = transportFor({
    host: row.host,
    port: row.port,
    secure: row.secure,
    username: row.username,
    password,
  });

  // Avsändaradressen MÅSTE vara den verifierade adressen. Gmail vägrar
  // annars, och det är dessutom hela poängen: mejlet ska komma från dem.
  const from = row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email;

  // Bilagan kommer in som base64 (samma format som Resend-vägen tar), och
  // nodemailer vill ha en Buffer. Ett enda ställe att bygga den på.
  const attachments = attachmentBase64
    ? [{ filename: attachmentFilename || 'faktura.pdf', content: Buffer.from(attachmentBase64, 'base64') }]
    : undefined;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(attachments ? { attachments } : {}),
  });
  return { id: info.messageId };
}

/**
 * Hela vägen: finns en verifierad egen avsändare för företaget, skicka
 * genom den. Annars säg det, så låter anroparen Resend ta över.
 *
 * Kastar ALDRIG — ett trasigt SMTP-konto får inte betyda att fakturan inte
 * går iväg alls, bara att den går iväg via systemadressen i stället.
 */
export async function trySendFromOwnAddress(userId, companyId, payload) {
  if (!hasEmailSecretKey()) return { used: false };
  const { row, error } = await loadSenderRow(userId, companyId);
  if (error || !row || !row.verified_at) return { used: false };
  try {
    // Två vägar, samma rad i databasen: Google-inloggning (refresh-token,
    // skickar via Gmail-API:et med enbart sändbehörighet) eller
    // app-lösenord (SMTP). Se _gmail.js för varför de skiljer sig åt.
    const result = row.provider === GOOGLE_PROVIDER
      ? await sendViaGmail({
        refreshToken: decryptSecret(row.secret),
        from: row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email,
        ...payload,
      })
      : await sendViaSmtp(row, payload);
    return { used: true, ok: true, id: result.id };
  } catch (err) {
    console.error('Utskick från egen adress misslyckades, faller tillbaka på systemavsändaren:', err?.message || err);
    // Spara felet så kunden ser i Inställningar VARFÖR deras adress inte
    // användes, i stället för att undra varför avsändaren plötsligt är en
    // annan.
    const message = row.provider === GOOGLE_PROVIDER
      ? friendlyGoogleError(err?.message || err)
      : friendlySmtpError(err);
    await updateSenderRow(userId, companyId, { last_error: message });
    return { used: true, ok: false, error: message };
  }
}
