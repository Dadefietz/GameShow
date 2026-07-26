// Client Supabase côté serveur (service-role) — lecture du contenu durable.
// Le service-role n'est JAMAIS exposé au front. Optionnel : sans config, on tombe sur les
// questions de démo (le jeu fonctionne quand même).
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

let client = null;
export function getServiceClient() {
  if (client) return client;
  if (!config.supabaseUrl || !config.supabaseServiceRole) return null;
  client = createClient(config.supabaseUrl, config.supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

// Charge les questions d'un module pour l'animateur (ses banques). Repli démo si pas de client.
export async function loadQuestions(ownerId, moduleType) {
  const sb = getServiceClient();
  if (!sb) return null; // le caller utilisera le seed démo
  const { data, error } = await sb
    .from('questions')
    .select('id, payload, module_type, question_banks!inner(owner_id)')
    .eq('module_type', moduleType)
    .eq('question_banks.owner_id', ownerId);
  if (error) return null;
  return (data || []).map((r) => ({ id: r.id, ...r.payload }));
}
