import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that both env vars look like real values before calling createClient.
// This prevents the "Invalid supabaseUrl" error when running without a .env file.
function isValidHttpUrl(str) {
  try {
    if (!str || typeof str !== 'string') return false;
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const hasValidConfig = isValidHttpUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey.length > 10;

// Create a no-op mock client when Supabase is not configured, so the app
// still renders without crashing in demo / dev environments.
const mockClient = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: (_event, _cb) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: () => Promise.resolve({ error: null }),
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase ej konfigurerad. Lägg till VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY i din .env-fil.' } }),
    signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase ej konfigurerad.' } }),
  },
  from: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    upsert: () => Promise.resolve({ error: null }),
    insert: () => Promise.resolve({ error: null }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }),
};

export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : mockClient;
