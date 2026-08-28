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

// Kundönskemål: förbli inloggad så länge fliken/webbläsaren är öppen (byta
// flik, uppdatera sidan, navigera runt i appen — allt oförändrat), men
// kräva ny inloggning nästa gång sajten öppnas efter att den STÄNGTS.
// sessionStorage istället för standardvalet localStorage är hela lösningen
// — webbläsaren rensar sessionStorage automatiskt när fliken/fönstret
// stängs (ingen egen kod, inget `beforeunload`-race mot att en async
// signOut()-anrop hinner klart innan sidan hinner stängas, vilket är den
// vanliga fallgropen med den ansatsen). `typeof window` -kollen är samma
// försiktighetsprincip som fileUpload.js redan har (den här filen laddas
// bara klient-sidan i praktiken, se AppRouter.jsx:s kommentar om varför
// marknadsbunten aldrig importerar supabase-js alls — men kostar inget
// att vara explicit ändå).
//
// AppRouter.jsx:s egen getSupabaseSessionKey()/shouldLoadAppImmediately()
// läser SAMMA nyckel ur sessionStorage nu (var localStorage innan) — måste
// hållas i synk med det här, annars slutar den optimeringen fungera tyst.
export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: typeof window !== 'undefined' ? { storage: window.sessionStorage } : undefined,
    })
  : mockClient;
