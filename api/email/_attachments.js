// Egna bilagor på en offert (Quotes.jsx). Filerna laddas upp när man trycker
// Skicka, eftersom Vercel bara tar 4,5 MB per anrop. Servern hämtar dem, skickar
// mejlet och raderar dem direkt, även om utskicket misslyckas. Blir något kvar
// efter ett avbrott tar nattjobbet det (cron/_dataRetention.js).
const BUCKET = 'bokix-uploads';
export const TEMP_FOLDER = 'mail-temp';
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;
const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

/** Bara filer i avsändarens egen tillfälliga mapp. Allt annat ignoreras, så att
 * ingen kan hämta eller radera någon annans filer genom att ange en sökväg. */
export function ownTempFiles(list, userId) {
  if (!Array.isArray(list)) return [];
  const prefix = `${userId}/${TEMP_FOLDER}/`;
  return list
    .slice(0, MAX_FILES)
    .map(item => ({
      path: String(item?.path || ''),
      filename: String(item?.filename || '').replace(/[\\/\r\n]+/g, ' ').trim().slice(0, 150),
    }))
    .filter(f => f.path.startsWith(prefix) && !f.path.includes('..'));
}

/** Hämtar filerna inför utskicket. Kastar vid otillåten filtyp eller storlek. */
export async function loadTempFiles(admin, files) {
  let total = 0;
  const loaded = [];
  for (const { path, filename } of files) {
    if (!ALLOWED_EXTENSIONS.test(filename)) throw new Error('Filformatet stöds inte. Endast bild eller PDF kan skickas.');
    const { data, error } = await admin.storage.from(BUCKET).download(path);
    if (error || !data) throw new Error(`${filename} kunde inte läsas.`);
    const bytes = Buffer.from(await data.arrayBuffer());
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) throw new Error('Bilagorna är för stora för att skickas via e-post.');
    loaded.push({ filename, content: bytes.toString('base64') });
  }
  return loaded;
}

/** Raderar de tillfälliga filerna. Får aldrig fälla ett utskick som gått iväg. */
export async function removeTempFiles(admin, files) {
  if (!files.length) return;
  try {
    await admin.storage.from(BUCKET).remove(files.map(f => f.path));
  } catch (err) {
    console.warn('Kunde inte radera tillfälliga bilagor:', err?.message);
  }
}
