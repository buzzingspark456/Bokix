import { createClient } from '@supabase/supabase-js';

function isValidSupabaseUrl(u) {
  try {
    if (!u || typeof u !== 'string') return false;
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseUrl = isValidSupabaseUrl(rawUrl)
  ? rawUrl
  : 'https://byt-ut-mot-din-project-url.supabase.co';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'byt-ut-mot-din-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
