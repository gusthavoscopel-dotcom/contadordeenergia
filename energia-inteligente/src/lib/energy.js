// Cálculos e períodos de energia.
//
// Tipos de dado (exibidos na interface):
//   MEDIDO    → potência, tensão e corrente enviadas pelo sensor
//   CALCULADO → energia (kWh) e custo calculados pelo sistema
//   ESTIMADO  → projeções (ex.: previsão da conta do mês)

/** energia (kWh) = potência (W) × tempo (h) / 1000 */
export const energyKwh = (watts, hours) => (watts * hours) / 1000;

/** custo (R$) = energia (kWh) × tarifa (R$/kWh) */
export const costOf = (kwh, tariff) => (Number(kwh) || 0) * (Number(tariff) || 0);

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const daysInMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

export const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

/** Períodos do filtro de histórico → { from, to } (to exclusivo) */
export function periodRange(key, custom = {}) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  switch (key) {
    case 'today':
      return { from: today, to: tomorrow };
    case '7d':
      return { from: addDays(today, -6), to: tomorrow };
    case '30d':
      return { from: addDays(today, -29), to: tomorrow };
    case 'month':
      return { from: startOfMonth(now), to: tomorrow };
    case 'prev-month':
      return { from: addMonths(startOfMonth(now), -1), to: startOfMonth(now) };
    case 'custom': {
      const from = custom.from ? startOfDay(new Date(`${custom.from}T00:00:00`)) : addDays(today, -6);
      const to = custom.to ? addDays(startOfDay(new Date(`${custom.to}T00:00:00`)), 1) : tomorrow;
      return from < to ? { from, to } : { from: to, to: from };
    }
    default:
      return { from: today, to: tomorrow };
  }
}

export const PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: 'Últimos 7 dias' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: 'month', label: 'Este mês' },
  { key: 'prev-month', label: 'Mês anterior' },
  { key: 'custom', label: 'Personalizado' },
];

/**
 * Previsão (ESTIMATIVA) do consumo do mês: extrapola o consumo acumulado
 * até agora para o mês inteiro. Retorna null se ainda não há dados
 * suficientes (menos de 6 h de mês decorrido ou consumo zero).
 */
export function monthForecast(monthKwh, tariff, now = new Date()) {
  const start = startOfMonth(now);
  const elapsedDays = (now - start) / 86_400_000;
  if (elapsedDays < 0.25 || !(monthKwh > 0)) return null;
  const kwh = (monthKwh / elapsedDays) * daysInMonth(now);
  return { kwh, cost: costOf(kwh, tariff) };
}

/** Nome do mês abreviado: "jan", "fev"… */
export const monthLabel = (d) => new Date(d).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
