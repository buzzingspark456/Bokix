// Krymper kvittofoton innan de laddas upp. Ett telefonfoto är 2–5 MB och
// 12 megapixel; ett kvitto behöver inte det för att vara läsbart (det
// bokföringslagen kräver) eller för att avläsningen ska hitta texten.
//
// Gränsen är antal pixlar, inte längsta sidan: ett långt, smalt kvitto
// (4000 × 1000) får då behålla nästan hela bredden, där en sidgräns hade
// gjort texten för liten. Ett vanligt 4:3-foto blir ca 2150 × 1600.

export const MAX_PIXELS = 3_500_000;
export const JPEG_QUALITY = 0.82;
// Mindre filer än så lönar det sig inte att röra.
export const MIN_BYTES_TO_COMPRESS = 600_000;

const COMPRESSIBLE = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i;

/** Målstorleken för en bild, eller null om den redan är liten nog. */
export function targetSize(width, height, maxPixels = MAX_PIXELS) {
  if (!(width > 0) || !(height > 0)) return null;
  const pixels = width * height;
  if (pixels <= maxPixels) return null;
  const scale = Math.sqrt(maxPixels / pixels);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function shouldTryCompress(file) {
  return Boolean(file && COMPRESSIBLE.test(file.type || '') && file.size >= MIN_BYTES_TO_COMPRESS);
}

function jpegName(name) {
  const base = String(name || 'kvitto').replace(/\.[^.]*$/, '');
  return `${base || 'kvitto'}.jpg`;
}

/**
 * Returnerar en mindre JPEG-kopia av bilden, eller originalfilen om den
 * inte går att krympa (PDF, liten fil, webbläsaren kan inte läsa formatet,
 * t.ex. HEIC utanför Safari) eller om kopian inte blev mindre. Kastar aldrig:
 * en uppladdning ska hellre bli stor än misslyckas.
 */
export async function compressImageFile(file) {
  if (!shouldTryCompress(file)) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap;
  try {
    // 'from-image' vänder bilden efter EXIF, så ett stående foto inte hamnar på sidan.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = targetSize(bitmap.width, bitmap.height) || { width: bitmap.width, height: bitmap.height };
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Vit botten: en PNG med genomskinlighet blir annars svart som JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}
