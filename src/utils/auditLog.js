// Händelselogg (Inställningar > System > Händelselogg). En rad skrivs
// direkt från klienten via supabase-js — precis som company_members redan
// skrivs direkt av ägaren — RLS (supabase-setup.sql, audit_log-tabellen)
// är det som faktiskt skyddar vem som får logga vad, inte den här filen.
//
// Fel vid loggning ska ALDRIG stoppa den handling som loggas (att spara
// företagsuppgifter är viktigare än att händelseloggen lyckas) — därför
// sväljs alla fel tyst här, samma resonemang som t.ex. e-postutskick på
// andra ställen i appen redan gör för icke-kritiska sidoeffekter.
export async function logAuditEvent(supabase, { companyId, ownerUserId, actorUserId, actorEmail, action, description }) {
  try {
    await supabase.from('audit_log').insert({
      company_id: companyId,
      owner_user_id: ownerUserId,
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action,
      description,
    });
  } catch {
    // Se kommentaren ovan — tyst fel med flit.
  }
}
