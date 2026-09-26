// Fonte de dados de energia: REAL (banco via RPC) ou DEMONSTRAÇÃO (simulada).
// Dashboard, Gráficos e Histórico usam a mesma interface e não precisam
// saber de onde os números vêm.
import { supabase } from './supabase.js';
import { addDays, addMonths, startOfDay, startOfMonth, TIMEZONE } from './energy.js';
import { demoEnergy } from './demo.js';

export const UNMAPPED = 'sem-comodo';

/** Gera todos os buckets do intervalo (inclusive os vazios) */
export function bucketStarts(from, to, bucket) {
  const out = [];
  let d =
    bucket === 'month' ? startOfMonth(from) : bucket === 'day' ? startOfDay(from) : new Date(new Date(from).setMinutes(0, 0, 0));
  const step = (x) =>
    bucket === 'month' ? addMonths(x, 1) : bucket === 'day' ? addDays(x, 1) : new Date(x.getTime() + 3_600_000);
  let guard = 0;
  while (d < to && guard++ < 2000) {
    out.push(d);
    d = step(d);
  }
  return out;
}

const keyOf = (d) => new Date(d).getTime();

export const realSource = {
  kind: 'real',

  /** { [roomId | UNMAPPED]: kWh } */
  async energyByRoom(from, to) {
    const { data, error } = await supabase.rpc('energy_by_room', { p_from: from.toISOString(), p_to: to.toISOString() });
    if (error) throw error;
    const out = {};
    for (const row of data || []) out[row.room_id || UNMAPPED] = Number(row.kwh) || 0;
    return out;
  },

  /** [{ date, kwh }] com todos os buckets do intervalo */
  async energyBuckets(from, to, bucket, roomId = null) {
    const { data, error } = await supabase.rpc('energy_by_bucket', {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_bucket: bucket,
      p_tz: TIMEZONE,
      p_room: roomId,
    });
    if (error) throw error;
    // O banco devolve o início do bucket no fuso local, sem offset ("2026-09-26T13:00:00")
    const map = new Map((data || []).map((r) => [keyOf(new Date(String(r.bucket).replace(' ', 'T'))), Number(r.kwh) || 0]));
    return bucketStarts(from, to, bucket).map((date) => ({ date, kwh: map.get(keyOf(date)) || 0 }));
  },
};

export function demoSource(rooms) {
  return {
    kind: 'demo',
    async energyByRoom(from, to) {
      const out = {};
      for (const room of rooms) out[room.id] = demoEnergy(room, from, to);
      return out;
    },
    async energyBuckets(from, to, bucket, roomId = null) {
      const selected = roomId ? rooms.filter((r) => r.id === roomId) : rooms;
      const starts = bucketStarts(from, to, bucket);
      return starts.map((date, i) => {
        const end = starts[i + 1] || to;
        return { date, kwh: selected.reduce((sum, r) => sum + demoEnergy(r, date, end), 0) };
      });
    },
  };
}
