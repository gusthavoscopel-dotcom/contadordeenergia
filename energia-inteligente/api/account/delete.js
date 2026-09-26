// POST /api/account/delete
// Exclui a conta do usuário logado (e, em cascata, residência, cômodos,
// dispositivos, leituras e alertas). Precisa da service role, por isso fica
// no backend.
//
// Headers: Authorization: Bearer <access_token do usuário>
// Corpo:   { "confirm": "EXCLUIR" }
import { applyCors, bearerToken, clientIp, HttpError, rateLimit, readJson, send, sendError } from '../_lib/http.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      throw new HttpError(405, 'method_not_allowed', 'Use POST.');
    }
    rateLimit(`del:${clientIp(req)}`, { max: 5, windowMs: 60_000 });

    const token = bearerToken(req);
    if (!token) throw new HttpError(401, 'unauthorized', 'Faça login novamente.');

    const body = await readJson(req);
    if (body?.confirm !== 'EXCLUIR') {
      throw new HttpError(422, 'confirmation_required', 'Digite EXCLUIR para confirmar.');
    }

    const db = supabaseAdmin();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) throw new HttpError(401, 'unauthorized', 'Sessão inválida. Faça login novamente.');

    const { error: delError } = await db.auth.admin.deleteUser(data.user.id);
    if (delError) throw delError;

    return send(res, 200, { ok: true });
  } catch (err) {
    return sendError(res, err);
  }
}
