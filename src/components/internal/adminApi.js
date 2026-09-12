import { supabase } from '../../supabaseClient';

// ── Tunn klient mot api/admin/index.js ──────────────────────────────────
// Hämtar ALLTID en färsk access_token direkt före anropet (inte cachat)
// — samma försiktighet som resten av appens Stripe-/reauth-anrop redan
// har, en session kan hunnit förnyas eller gå ut mellan sidladdning och
// knapptryck.
async function authHeader() {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Ingen aktiv session.');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function handleResponse(response) {
  let payload = {};
  try { payload = await response.json(); } catch { /* tomt svar */ }
  if (!response.ok) throw new Error(payload?.error || `Admin API-fel (${response.status})`);
  return payload;
}

export async function adminGet(params) {
  const headers = await authHeader();
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/api/admin?${query}`, { headers });
  return handleResponse(response);
}

export async function adminPost(body) {
  const headers = await authHeader();
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}
