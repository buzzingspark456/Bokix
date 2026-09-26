import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { parseStorageUrl } from './storageUrls';

// In-memory cache for signed URLs: map of "bucket/path" -> { signedUrl, expiresAt }
const signedUrlCache = new Map();

/**
 * Returns a time-limited signed URL for private storage files (such as receipts and verifications in 'bokix-uploads').
 * If the input is already a signed URL with active token, a local blob, or belongs to a public bucket (e.g. companylogo),
 * it returns it as-is without overhead.
 * Caches signed URLs for 50 minutes (Supabase signed URLs are valid for 1 hour).
 */
export async function getSignedStorageUrl(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return urlOrPath;

  // Blob URLs (local uploads before saving) or data: URLs
  if (urlOrPath.startsWith('blob:') || urlOrPath.startsWith('data:')) {
    return urlOrPath;
  }

  // Already a signed URL with a token?
  if (urlOrPath.includes('/object/sign/') && urlOrPath.includes('token=')) {
    return urlOrPath;
  }

  const parsed = parseStorageUrl(urlOrPath);
  if (!parsed) {
    return urlOrPath;
  }

  const { bucket, path } = parsed;

  // Public buckets (companylogo, profile) remain public
  if (bucket !== 'bokix-uploads') {
    return urlOrPath;
  }

  const cacheKey = `${bucket}/${path}`;
  const now = Date.now();
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 60000) {
    return cached.signedUrl;
  }

  try {
    // 1. Try Supabase client-side signing directly (fastest, uses current auth JWT and storage RLS)
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) {
      signedUrlCache.set(cacheKey, {
        signedUrl: data.signedUrl,
        expiresAt: now + 50 * 60 * 1000,
      });
      return data.signedUrl;
    }
  } catch {
    // Fall through to server-side endpoint
  }

  // 2. Fallback to backend /api/company-access action 'signed_url'
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (token) {
      const res = await fetch('/api/company-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'signed_url', bucket, path }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.signedUrl) {
          signedUrlCache.set(cacheKey, {
            signedUrl: json.signedUrl,
            expiresAt: now + 50 * 60 * 1000,
          });
          return json.signedUrl;
        }
      }
    }
  } catch {
    // Return original URL if all resolution attempts fail
  }

  return urlOrPath;
}

/**
 * Synkront: vad en komponent ska visa INNAN signeringen är klar. För en
 * privat fil (bokix-uploads) är svaret null — den gamla publika länken
 * fungerar inte längre sedan bucketen blev privat, och att rendera den gav
 * en misslyckad bildladdning som markerade bilden som trasig (onError) innan
 * den giltiga länken hann komma. Finns en giltig länk i cachen används den
 * direkt. Allt annat (blob:, data:, publika buckets) visas som det är.
 */
export function initialSignedUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.includes('/object/sign/') && url.includes('token=')) return url;
  const parsed = parseStorageUrl(url);
  if (!parsed || parsed.bucket !== 'bokix-uploads') return url;
  const cached = signedUrlCache.get(`${parsed.bucket}/${parsed.path}`);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.signedUrl;
  return null;
}

/**
 * React-hook som ger en visningsbar länk. Returnerar null medan en privat
 * fil signeras (se initialSignedUrl) — komponenten ska då vänta, inte
 * rendera något som kan misslyckas.
 */
export function useSignedUrl(url) {
  const [resolvedUrl, setResolvedUrl] = useState(() => initialSignedUrl(url));

  useEffect(() => {
    let active = true;
    setResolvedUrl(initialSignedUrl(url));
    if (!url) return undefined;

    getSignedStorageUrl(url).then(signed => {
      if (active) setResolvedUrl(signed);
    });

    return () => {
      active = false;
    };
  }, [url]);

  return resolvedUrl;
}
