// Cliente do Supabase com a SERVICE ROLE KEY.
// ⚠️ Esta chave ignora o RLS e só pode existir no servidor (variáveis de
// ambiente da Vercel). Nunca coloque-a no frontend nem no ESP32.
import { createClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';

let client = null;

export function supabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new HttpError(500, 'server_not_configured', 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados.');
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
