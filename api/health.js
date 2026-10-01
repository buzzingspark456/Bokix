// Hälsokoll för en extern upptidsövervakare (t.ex. UptimeRobot eller Better
// Stack): GET /api/health svarar 200 när funktionerna kör och databasen
// svarar, annars 503. Läser bara antalet publicerade blogginlägg (en
// publik tabell), så svaret avslöjar ingenting.
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from './_security.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ ok: false });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    res.status(503).json({ ok: false, database: 'not_configured' });
    return;
  }

  const started = Date.now();
  try {
    const query = createClient(url, anonKey, { auth: { persistSession: false } })
      .from('blog_posts').select('id', { count: 'exact', head: true });
    // Timern rensas efteråt, annars håller den funktionen vid liv i onödan.
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => resolve({ error: new Error('timeout') }), 5000); });
    const { error } = await Promise.race([query, timeout]).finally(() => clearTimeout(timer));
    if (error) {
      res.status(503).json({ ok: false, database: 'down' });
      return;
    }
  } catch {
    res.status(503).json({ ok: false, database: 'down' });
    return;
  }
  res.status(200).json({ ok: true, database: 'up', ms: Date.now() - started });
}
