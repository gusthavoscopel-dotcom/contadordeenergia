// Validação do JSON enviado pelo ESP32.
import { HttpError } from './http.js';

export const LIMITS = {
  maxReadings: 32,
  maxPowerW: 100_000,
  maxVoltage: 500,
  maxCurrent: 200,
  maxClockSkewMs: 10 * 60 * 1000, // 10 min
};

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{3,40}$/;
// Exige fuso explícito (Z ou ±hh:mm) para não haver ambiguidade de horário
const ISO_WITH_TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function num(value, field, { min = 0, max, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new HttpError(422, 'invalid_payload', `Campo "${field}" é obrigatório.`);
  }
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new HttpError(422, 'invalid_payload', `Campo "${field}" deve ser numérico.`);
  }
  if (n < min || (max !== undefined && n > max)) {
    throw new HttpError(422, 'invalid_payload', `Campo "${field}" fora do intervalo permitido (${min}–${max}).`);
  }
  return n;
}

/**
 * Aceita dois formatos:
 *
 *  1) Lote (recomendado — um POST com todos os sensores):
 *     { "deviceId": "ESP32-001", "timestamp": "2026-09-26T14:00:00Z",
 *       "readings": [ { "sensor": 1, "power": 350.5, "voltage": 127, "current": 2.76 }, ... ] }
 *
 *  2) Leitura única:
 *     { "deviceId": "ESP32-001", "sensor": 1, "power": 350.5, "voltage": 127, "current": 2.76 }
 *
 * Retorna { deviceId, items, timestamp: Date, clockAdjusted, firmware }.
 */
export function parseReadingsPayload(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_payload', 'O corpo deve ser um objeto JSON.');
  }

  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  if (!DEVICE_ID_RE.test(deviceId)) {
    throw new HttpError(422, 'invalid_payload', 'deviceId inválido (use 3–40 caracteres: letras, números, "-" ou "_").');
  }

  const raw = Array.isArray(body.readings) ? body.readings : [body];
  if (raw.length === 0) throw new HttpError(422, 'invalid_payload', 'Nenhuma leitura enviada.');
  if (raw.length > LIMITS.maxReadings) {
    throw new HttpError(422, 'invalid_payload', `Máximo de ${LIMITS.maxReadings} leituras por envio.`);
  }

  const seen = new Set();
  const items = raw.map((r, i) => {
    if (!r || typeof r !== 'object') throw new HttpError(422, 'invalid_payload', `Leitura #${i + 1} inválida.`);
    const sensor = num(r.sensor, `readings[${i}].sensor`, { min: 1, max: 32 });
    if (!Number.isInteger(sensor)) throw new HttpError(422, 'invalid_payload', `readings[${i}].sensor deve ser inteiro.`);
    if (seen.has(sensor)) throw new HttpError(422, 'invalid_payload', `Sensor ${sensor} repetido no mesmo envio.`);
    seen.add(sensor);
    return {
      sensor,
      power: num(r.power, `readings[${i}].power`, { max: LIMITS.maxPowerW }),
      voltage: num(r.voltage, `readings[${i}].voltage`, { max: LIMITS.maxVoltage, optional: true }),
      current: num(r.current, `readings[${i}].current`, { max: LIMITS.maxCurrent, optional: true }),
    };
  });

  // Horário: usa o do ESP32 (sincronizado por NTP) se for válido e próximo
  // do horário do servidor; caso contrário usa o horário do servidor.
  let timestamp = now;
  let clockAdjusted = false;
  if (body.timestamp !== undefined) {
    const ok = typeof body.timestamp === 'string' && ISO_WITH_TZ_RE.test(body.timestamp);
    const t = ok ? new Date(body.timestamp) : null;
    if (t && !Number.isNaN(t.getTime()) && Math.abs(t.getTime() - now.getTime()) <= LIMITS.maxClockSkewMs) {
      timestamp = t;
    } else {
      clockAdjusted = true;
    }
  }

  const firmware = typeof body.firmware === 'string' ? body.firmware.slice(0, 40) : null;
  return { deviceId, items, timestamp, clockAdjusted, firmware };
}
