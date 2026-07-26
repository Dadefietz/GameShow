// Client Supabase navigateur (anon key, PKCE) — pour l'auth animateur et le Studio.
// URL + clé anon sont PUBLIQUES (protégées par RLS) : intégrées ici en repli pour que le
// build fonctionne sans variable d'environnement front. Surcharge possible via VITE_*.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://sajdeadrrchahtuxmqxk.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhamRlYWRycmNoYWh0dXhtcXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNjU3NzYsImV4cCI6MjEwMDY0MTc3Nn0.l315PIN197miV1-3hMZ1cFwYuSEiGt7_fWP5UGTTzuY';

let client;
export function getSupabase() {
  if (client !== undefined) return client;
  client = SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      })
    : null;
  return client;
}
