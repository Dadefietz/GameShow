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

// Traduit une question du format Studio ({prompt, answer, correct, target, options})
// vers le format attendu par le moteur de jeu (modules.js : {text, correctIndex, correct, target}).
function mapQuestion(type, q, durationSec) {
  const text = (q.prompt ?? q.text ?? '').toString().trim();
  const base = { id: q.id, text, durationSec };
  if (type === 'quiz') {
    return { ...base, options: Array.isArray(q.options) ? q.options : [], correctIndex: Number(q.correct ?? q.correctIndex ?? 0) };
  }
  if (type === 'true_false') {
    return { ...base, correct: (q.answer ?? q.correct) === true };
  }
  if (type === 'estimation') {
    return { ...base, target: Number(q.target) || 0 };
  }
  // vote
  return { ...base, options: Array.isArray(q.options) ? q.options : [] };
}

// Question exploitable ? (énoncé non vide + données minimales selon le type)
function isUsable(type, q) {
  if (!q.text) return false;
  if (type === 'quiz' || type === 'vote') return Array.isArray(q.options) && q.options.filter((o) => String(o).trim()).length >= 2;
  return true;
}

// Charge les questions d'un module pour l'animateur (ses modules). Repli démo si pas de client.
// Lit la table `modules` (questions imbriquées en jsonb) filtrée par owner + type.
export async function loadQuestions(ownerId, moduleType) {
  const sb = getServiceClient();
  if (!sb || !ownerId) return null; // le caller utilisera le seed démo
  const { data, error } = await sb
    .from('modules')
    .select('type, duration, questions')
    .eq('owner_id', ownerId)
    .eq('type', moduleType);
  if (error || !Array.isArray(data)) return null;
  const pool = [];
  for (const mod of data) {
    const durationSec = Number(mod.duration) || undefined;
    const qs = Array.isArray(mod.questions) ? mod.questions : [];
    for (const q of qs) {
      const mapped = mapQuestion(moduleType, q, durationSec);
      if (isUsable(moduleType, mapped)) pool.push(mapped);
    }
  }
  return pool.length ? pool : null; // null => le caller garde le seed démo
}
