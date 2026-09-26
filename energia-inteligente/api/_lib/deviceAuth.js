// Autenticação do ESP32 por chave secreta.
// O banco guarda apenas o SHA-256 da chave; aqui comparamos os hashes em
// tempo constante para não vazar informação por diferença de tempo.
import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError, bearerToken } from './http.js';

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function extractDeviceKey(req) {
  const header = req.headers['x-device-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return bearerToken(req);
}

export function keyMatches(key, storedHash) {
  if (!key || !storedHash) return false;
  const a = Buffer.from(sha256Hex(key), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Busca o dispositivo e valida a chave. Lança 401 se algo não bater. */
export async function authenticateDevice(db, deviceId, key) {
  if (!key) throw new HttpError(401, 'missing_device_key', 'Envie a chave do dispositivo no header X-Device-Key.');

  const { data, error } = await db
    .from('devices')
    .select('id, api_key_hash')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) throw error;
  // Mesma resposta para "não existe" e "chave errada" (não revela quais IDs existem)
  if (!data || !keyMatches(key, data.api_key_hash)) {
    throw new HttpError(401, 'invalid_device_credentials', 'Dispositivo ou chave inválidos.');
  }
  return data.id;
}
