import { createClient } from '@supabase/supabase-js';
import { sendViaResend, hasResendApiKey } from './_resend.js';

// Samma två adresser som får logga in på /internal (api/admin/index.js
// importerar listan härifrån). Larmmejlen går hit.
export const ADMIN_EMAILS = ['alwakiabdullah1@gmail.com', 'abbealwaki08@gmail.com'];

// Händelser som är värda ett mejl direkt. Övriga (t.ex. email_fallback,
// där kunden ändå fick sitt mejl via systemadressen) syns bara i
// Systemstatus.
const ALERT_KINDS = new Set([
  'email_failed',
  'contact_email_failed',
  'client_error',
  'cron_failed',
  'backup_failed',
  'backup_not_configured',
  'status_down',
  'backup_stale',
  'retention_failed',
]);

const ALERT_LABELS = {
  email_failed: 'Ett mejl till en kund gick inte iväg',
  contact_email_failed: 'Kontaktformuläret kunde inte skicka',
  client_error: 'Appen kraschade hos en användare',
  cron_failed: 'Nattkörningen misslyckades',
  backup_failed: 'Säkerhetskopian utanför Supabase misslyckades',
  backup_not_configured: 'Säkerhetskopian utanför Supabase är inte inställd',
  status_down: 'Statussidan: en del av Bokix är nere',
  backup_stale: 'Ingen lyckad säkerhetskopia det senaste dygnet',
  retention_failed: 'Städningen av obetalda konton misslyckades',
};

// Högst ett larmmejl per sorts händelse och timme, räknat i den delade
// rate limit-tabellen (supabase-2026-10-01-skydd.sql). Går den inte att
// fråga skickas mejlet ändå: hellre ett larm för mycket än inget.
async function alertAllowed(admin, kind) {
  try {
    const { data, error } = await admin.rpc('hit_rate_limit', { p_key: `alert:${kind}`, p_max: 1, p_window_seconds: 3600 });
    if (error || typeof data !== 'boolean') return true;
    return data;
  } catch {
    return true;
  }
}

async function sendAlert(admin, kind, detail) {
  if (!ALERT_KINDS.has(kind) || !hasResendApiKey()) return;
  if (!(await alertAllowed(admin, kind))) return;
  const label = ALERT_LABELS[kind] || kind;
  const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  await sendViaResend({
    from: process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>',
    to: ADMIN_EMAILS,
    subject: `Bokix-larm: ${label}`,
    html: `<p><strong>${esc(label)}</strong></p><pre style="white-space:pre-wrap;font-size:13px">${esc(detail)}</pre>`
      + '<p>Fler händelser av samma sort den närmaste timmen loggas i /internal → Systemstatus utan nytt mejl.</p>',
  });
}

// Händelser som admin-panelens Systemstatus visar (tabellen system_events,
// supabase-2026-09-27-admin.sql). Bäst-försök och tyst, precis som
// logSecurityEvent i admin/index.js: ett fel i loggningen eller larmet får
// aldrig ändra svaret på det egentliga anropet. Finns inte tabellen än
// (SQL:en inte körd) händer ingenting.
export async function logSystemEvent(kind, detail) {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const admin = createClient(url, key);
    const text = detail ? String(detail).slice(0, 1000) : null;
    await admin.from('system_events').insert({ kind, detail: text });
    await sendAlert(admin, kind, text);
  } catch {
    // se kommentaren ovan
  }
}
