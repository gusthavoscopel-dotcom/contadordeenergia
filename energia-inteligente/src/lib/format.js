// Formatação de números e datas no padrão brasileiro
const nf = (min, max) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtNumber = (v, digits = 0) => nf(digits, digits).format(Number(v) || 0);

/** Potência: 350 W · 1,84 kW */
export function fmtPower(watts, { forceKw = false } = {}) {
  const w = Number(watts) || 0;
  if (forceKw || Math.abs(w) >= 1000) return `${nf(2, 2).format(w / 1000)} kW`;
  return `${nf(0, w < 10 ? 1 : 0).format(w)} W`;
}

/** Energia: 8,42 kWh · 0,035 kWh · 12 Wh */
export function fmtEnergy(kwh) {
  const v = Number(kwh) || 0;
  if (v > 0 && v < 0.01) return `${nf(1, 1).format(v * 1000)} Wh`;
  if (v >= 1000) return `${nf(0, 0).format(v)} kWh`;
  return `${nf(2, 2).format(v)} kWh`;
}

export const fmtMoney = (v) => brl.format(Number(v) || 0);

export const fmtTariff = (v) => `R$ ${nf(2, 4).format(Number(v) || 0)}/kWh`;

export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('pt-BR') : '—');

export const fmtDate = (d, opts = { day: '2-digit', month: '2-digit' }) => (d ? new Date(d).toLocaleDateString('pt-BR', opts) : '—');

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/** "há 2 segundos", "há 5 min", "há 3 h" */
export function timeAgo(date, now = Date.now()) {
  if (!date) return 'nunca';
  const s = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  if (s < 5) return 'agora mesmo';
  if (s < 60) return `há ${s} segundos`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

/** Converte "0,95" ou "0.95" em número */
export function parseDecimal(text) {
  if (typeof text === 'number') return text;
  const n = Number(String(text).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
