import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fonction pour obtenir le client Supabase (lazy initialization)
function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Client Supabase initialisé de manière lazy pour éviter les erreurs au build time
let _supabase: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = getSupabase();
    }
    return (_supabase as any)[prop];
  },
});

