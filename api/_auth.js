import { createClient } from '@supabase/supabase-js';

// Säkerhetsfix (se säkerhetsgranskningen): flera endpoints litade tidigare
// blint på user_id/company_id i request-body:n — vem som helst som kände
// till (eller gissade) ett par ID:n kunde t.ex. koppla från en annan
// användares Stripe-konto eller skicka mejl som "från" ett företag de inte
// äger. De två funktionerna här ger endpoints ett sätt att verifiera VEM
// som faktiskt anropar (mot Supabase Auth) och VILKET företag den
// användaren faktiskt äger, istället för att lita på vad body:n påstår.

/** Verifierar Authorization: Bearer <access_token> mot Supabase Auth. Kör
 * `res.status(401)...` och returnerar null själv vid fel — anropande kod
 * ska bara göra `const user = await requireAuthedUser(req, res); if (!user) return;`. */
export async function requireAuthedUser(req, res) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    res.status(401).json({ error: 'Inloggning krävs.' });
    return null;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(503).json({ error: 'Supabase är inte konfigurerat.' });
    return null;
  }

  // Anon-nyckeln räcker här — getUser(token) verifierar bara att token:en
  // är giltig och vem den tillhör, den kringgår aldrig RLS eller kräver
  // förhöjd behörighet (till skillnad från service-role-nyckeln som
  // loadCompanyForUser nedan behöver för att själv slå upp state:n).
  const supabase = createClient(supabaseUrl, anonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Ogiltig eller utgången inloggning.' });
    return null;
  }
  return data.user;
}

/** Slår upp det angivna företaget i DEN VERIFIERADE användarens egen
 * sparade state — bevisar ägarskap utan att lita på ett client-supplied
 * company_id ensamt (id:t måste faktiskt finnas i just den här
 * användarens data). Kör `res.status(...)...` och returnerar null själv
 * vid fel, samma anropsmönster som requireAuthedUser ovan. */
export async function loadOwnedCompany(userId, companyId, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas — kan inte verifiera ägarskap server-side.' });
    return null;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: row, error } = await admin.from('user_data').select('state').eq('user_id', userId).maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  const companyData = row?.state?.companies?.[companyId];
  if (!companyData) {
    res.status(403).json({ error: 'Företaget hittades inte för den inloggade användaren.' });
    return null;
  }
  return companyData;
}
