// GET /api/health — útil para testar se a API está no ar (inclusive pelo ESP32)
import { applyCors, send } from './_lib/http.js';

export default function handler(req, res) {
  if (applyCors(req, res)) return;
  send(res, 200, {
    ok: true,
    service: 'energia-inteligente',
    configured: Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY),
    serverTime: new Date().toISOString(),
  });
}
