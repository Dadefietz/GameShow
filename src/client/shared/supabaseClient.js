// Client Supabase navigateur (anon key, PKCE) — pour l'auth animateur et le Studio.
// Retourne null si non configuré : l'app dégrade proprement (mode dev local).
import { createClient } from '@supabase/supabase-js';

let client;
export function getSupabase() {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  client = url && key
    ? createClient(url, key, {
        auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      })
    : null;
  return client;
}
