import { createClient } from '@supabase/supabase-js';

// Händelser som admin-panelens Systemstatus visar (tabellen system_events,
// supabase-2026-09-27-admin.sql): främst mejl som inte gick iväg. Bäst-
// försök och tyst, precis som logSecurityEvent i admin/index.js: ett fel
// i loggningen får aldrig ändra svaret på det egentliga anropet. Finns inte
// tabellen än (SQL:en inte körd) händer ingenting.
export async function logSystemEvent(kind, detail) {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    await createClient(url, key).from('system_events').insert({ kind, detail: detail ? String(detail).slice(0, 1000) : null });
  } catch {
    // se kommentaren ovan
  }
}
