// MODO DEMONSTRAÇÃO — gerador de dados SIMULADOS.
// Usado apenas quando nenhum ESP32 está enviando dados (ou quando o usuário
// liga o modo manualmente). Tudo que vem daqui é exibido com o selo
// "MODO DEMONSTRAÇÃO" para nunca ser confundido com medição real.
import { demoBaseWatts } from './rooms.js';

// Perfil diário típico de uma residência (fração da potência base por hora)
const HOUR_PROFILE = [
  0.22, 0.2, 0.2, 0.2, 0.2, 0.25, 0.45, 0.6, 0.45, 0.3, 0.3, 0.35,
  0.55, 0.45, 0.3, 0.28, 0.3, 0.4, 0.65, 0.85, 0.9, 0.75, 0.5, 0.32,
];

// Ajuste para que o total mensal simulado fique próximo de uma residência típica
const DEMO_SCALE = 0.75;

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Número pseudoaleatório determinístico em [0,1) */
function seeded(...parts) {
  let x = hashString(parts.join('|')) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function profileAt(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  const i = Math.floor(h) % 24;
  const frac = h - Math.floor(h);
  return HOUR_PROFILE[i] * (1 - frac) + HOUR_PROFILE[(i + 1) % 24] * frac;
}

/** Variação de ±15% de um dia para outro, estável para o mesmo dia/cômodo */
function dayFactor(room, date) {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return 0.85 + seeded(room.id, key) * 0.3;
}

/** Potência média (W) de um cômodo num instante (sem ruído) */
export function demoPowerAt(room, date) {
  return demoBaseWatts(room.nome) * profileAt(date) * dayFactor(room, date) * DEMO_SCALE;
}

/** Potência "ao vivo" com oscilação para animar o dashboard */
export function demoLivePower(room, now = new Date()) {
  const t = now.getTime() / 1000;
  const phase = seeded(room.id, 'phase') * Math.PI * 2;
  const wave = 1 + 0.08 * Math.sin(t / 9 + phase) + 0.04 * Math.sin(t / 2.3 + phase * 2);
  const noise = 1 + (Math.random() - 0.5) * 0.04;
  return Math.max(0, demoPowerAt(room, now) * wave * noise);
}

/** Energia (kWh) simulada de um cômodo num intervalo [from, to) */
export function demoEnergy(room, from, to) {
  const end = Math.min(to.getTime(), Date.now());
  let t = from.getTime();
  if (t >= end) return 0;
  let kwh = 0;
  while (t < end) {
    const hourStart = new Date(t);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = hourStart.getTime() + 3_600_000;
    const sliceEnd = Math.min(hourEnd, end);
    const hours = (sliceEnd - t) / 3_600_000;
    const mid = new Date(t + (sliceEnd - t) / 2);
    kwh += (demoPowerAt(room, mid) * hours) / 1000;
    t = sliceEnd;
  }
  return kwh;
}
