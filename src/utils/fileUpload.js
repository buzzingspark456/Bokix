import { supabase } from '../supabaseClient';

/**
 * Laddar upp en fil till samma Supabase Storage-bucket som profilbild/
 * logotyp/kvitton använder (se supabase-setup.sql) och returnerar en publik
 * URL. Delad mellan Expenses.jsx (kvitton) och Verifications.jsx (underlag
 * till en verifikation) — samma bucket, samma felhantering, en plats att
 * underhålla istället för två drivande implementationer.
 */
export async function uploadFileToStorage(userId, file, folder = 'files') {
  // Säkerhetsfix (säkerhetsgranskningen): `file.name` kommer rakt från
  // användarens filväljare, helt fri text. En fil UTAN punkt i namnet
  // (t.ex. "../../evil") gjorde annars hela filnamnet till "ändelsen" och
  // hamnade rakt i lagringsvägen — `${userId}/${folder}/${key}.../../evil`.
  // RLS-policyn begränsar ändå till förstasegmentet (egen userId), men
  // sanerar ändelsen explicit ändå istället för att lita på det.
  const rawExt = (file.name.split('.').pop() || 'bin').toLowerCase();
  const ext = /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : 'bin';
  const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/${folder}/${key}.${ext}`;
  const { error } = await supabase.storage.from('bokix-uploads').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('bokix-uploads').getPublicUrl(path);
  return data.publicUrl;
}
