// Utilitários HTTP compartilhados pelas funções serverless.
// Arquivos/pastas começando com "_" dentro de /api não viram rotas na Vercel.
// Escrito só com a API nativa do Node (req/res), para funcionar igual na
// Vercel e no servidor local de desenvolvimento (scripts/dev-api.js).

const MAX_BODY_BYTES = 16 * 1024;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function sendError(res, err) {
  if (err instanceof HttpError) {
    return send(res, err.status, { ok: false, error: err.code, message: err.message });
  }
  console.error('[api] erro inesperado:', err);
  return send(res, 500, { ok: false, error: 'internal_error', message: 'Erro interno.' });
}

/**
 * CORS: apenas as origens listadas em ALLOWED_ORIGINS (separadas por vírgula)
 * podem chamar a API pelo navegador. O ESP32 não é navegador, então CORS não
 * se aplica a ele. Retorna true se a requisição era um preflight (OPTIONS).
 */
export function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Key');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

/** Lê o corpo JSON com limite de tamanho. */
export async function readJson(req) {
  // Na Vercel o corpo pode já vir interpretado (e o getter lança erro se o JSON for inválido)
  let preParsed;
  try {
    preParsed = req.body;
  } catch {
    throw new HttpError(400, 'invalid_json', 'JSON inválido.');
  }
  if (preParsed !== undefined && preParsed !== null && typeof preParsed === 'object' && !Buffer.isBuffer(preParsed)) {
    return preParsed;
  }
  let raw = '';
  if (typeof preParsed === 'string') raw = preParsed;
  else if (Buffer.isBuffer(preParsed)) raw = preParsed.toString('utf8');
  else {
    raw = await new Promise((resolve, reject) => {
      let data = '';
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new HttpError(413, 'payload_too_large', 'Corpo da requisição muito grande.'));
          req.destroy();
          return;
        }
        data += chunk;
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }
  if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', 'Corpo da requisição muito grande.');
  if (!raw) throw new HttpError(400, 'empty_body', 'Envie um corpo JSON.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'invalid_json', 'JSON inválido.');
  }
}

/**
 * Rate limit em memória (por instância da função). É uma primeira barreira
 * contra abuso; o limite definitivo por dispositivo é feito no banco
 * (ingest_readings recusa mais de 1 envio por segundo do mesmo ESP32).
 */
const buckets = new Map();
export function rateLimit(key, { max = 60, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
  } else if (++entry.count > max) {
    throw new HttpError(429, 'rate_limited', 'Muitas requisições. Tente novamente em instantes.');
  }
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k);
  }
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function bearerToken(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}
