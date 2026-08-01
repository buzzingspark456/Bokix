import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://byt-ut-mot-din-project-url.supabase.co';
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;

function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const supabaseUrl = isValidSupabaseUrl(configuredSupabaseUrl)
  ? configuredSupabaseUrl
  : fallbackSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'byt-ut-mot-din-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
