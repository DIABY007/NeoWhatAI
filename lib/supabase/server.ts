import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fonction pour obtenir le client Supabase admin (lazy initialization)
function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase service role environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Client avec service role pour les opérations backend (webhooks, etc.)
// Initialisé de manière lazy pour éviter les erreurs au build time
let _supabaseAdmin: SupabaseClient | null = null;

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = getSupabaseAdmin();
    }
    return (_supabaseAdmin as any)[prop];
  },
});

