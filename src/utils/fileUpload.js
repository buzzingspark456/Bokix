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

// Matchar den publika URL:en Storage själv genererar (getPublicUrl ovan,
// och samma mönster ImageUploadField i Settings.jsx använder för andra
// buckets): `.../storage/v1/object/public/<bucket>/<path>`, ev. med en
// `?v=...`-cachebuster på slutet (Settings.jsx) som inte hör till sökvägen.
const PUBLIC_URL_RE = /\/storage\/v1\/object\/public\/([^/]+)\/([^?]+)/;

/**
 * Tar bort en tidigare uppladdad fil (varsomhelst i Storage — inte bara
 * 'bokix-uploads', se PUBLIC_URL_RE ovan) utifrån dess publika URL, för att
 * den inte ska bli kvar och betala hyra i bucketen efter att den slutat
 * användas (kostnadsgranskning: ett kvitto som raderas eller ett underlag
 * som byts ut skapade tidigare bara en NY fil, aldrig städade bort den
 * gamla — se uploadFileToStorage ovan, varje uppladdning får en egen
 * tidsstämplad nyckel istället för att skriva över en fast sökväg).
 *
 * "Best effort" med avsikt: körs alltid EFTER att själva användarhandlingen
 * (radera kvitto, spara nytt underlag) redan lyckats, och får aldrig
 * blockera eller visa ett fel för den om städningen misslyckas — det vore
 * en kvarbliven fil i Storage, exakt samma (redan existerande) läge som
 * innan den här funktionen fanns, inte en regression.
 */
export async function deleteFileFromStorage(fileUrl) {
  if (!fileUrl) return;
  const match = PUBLIC_URL_RE.exec(fileUrl);
  if (!match) return;
  const [, bucket, encodedPath] = match;
  try {
    await supabase.storage.from(bucket).remove([decodeURIComponent(encodedPath)]);
  } catch {
    // Se filkommentaren ovan — medvetet tyst.
  }
}
