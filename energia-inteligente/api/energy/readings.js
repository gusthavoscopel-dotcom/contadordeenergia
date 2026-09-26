// POST /api/energy/readings
// Recebe as leituras do ESP32, autentica o dispositivo, valida os dados e
// grava no banco (ingest_readings calcula os kWh e gera alertas).
//
// Headers:  Content-Type: application/json
//           X-Device-Key: <chave secreta do dispositivo>
// Corpo:    ver api/_lib/validate.js
import { applyCors, clientIp, HttpError, rateLimit, readJson, send, sendError } from '../_lib/http.js';
import { parseReadingsPayload } from '../_lib/validate.js';
import { authenticateDevice, extractDeviceKey } from '../_lib/deviceAuth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

const DB_ERRORS = {
  rate_limited: [429, 'Envio muito frequente: aguarde pelo menos 1 segundo entre envios.'],
  invalid_items: [422, 'Lista de leituras inválida.'],
  device_not_found: [401, 'Dispositivo ou chave inválidos.'],
};

export default async function handler(req, res) {
  try {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      throw new HttpError(405, 'method_not_allowed', 'Use POST.');
    }

    // Barreira por IP (bem acima do normal: ESP32 envia a cada ~5 s)
    rateLimit(`ip:${clientIp(req)}`, { max: 120, windowMs: 60_000 });

    const body = await readJson(req);
    const payload = parseReadingsPayload(body);

    const db = supabaseAdmin();
    const deviceUuid = await authenticateDevice(db, payload.deviceId, extractDeviceKey(req));

    const { data, error } = await db.rpc('ingest_readings', {
      p_device: deviceUuid,
      p_items: payload.items,
      p_ts: payload.timestamp.toISOString(),
      p_firmware: payload.firmware,
    });

    if (error) {
      const known = DB_ERRORS[error.message];
      if (known) throw new HttpError(known[0], error.message, known[1]);
      throw error;
    }

    return send(res, 201, {
      ok: true,
      deviceId: payload.deviceId,
      inserted: data.inserted,
      alerts: data.alerts,
      unmappedSensors: data.unmappedSensors,
      measuredAt: data.measuredAt,
      clockAdjusted: payload.clockAdjusted,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    return sendError(res, err);
  }
}
