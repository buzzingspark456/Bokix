import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://byt-ut-mot-din-project-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'byt-ut-mot-din-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
