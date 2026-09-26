// Geração da chave secreta do ESP32 no navegador.
// Só o hash SHA-256 vai para o banco; a chave é mostrada uma única vez.

export function generateDeviceKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'ek_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function suggestDeviceId() {
  const n = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `ESP32-${n}`;
}

export const DEVICE_ID_RE = /^[A-Za-z0-9_-]{3,40}$/;
