// Estado central da residência do usuário logado:
//   • residência, cômodos, dispositivos e sensores
//   • dados ao vivo (potência por cômodo, kWh de hoje e do mês)
//   • assinatura do Supabase Realtime (leituras, dispositivos, alertas)
//   • escolha automática entre dados REAIS e MODO DEMONSTRAÇÃO
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import { demoEnergy, demoLivePower } from '../lib/demo.js';
import { demoSource, realSource, UNMAPPED } from '../lib/energySource.js';
import { startOfDay, startOfMonth } from '../lib/energy.js';

const HomeContext = createContext(null);

// Sem nenhum dado real há mais de 1 h → modo automático usa demonstração
const REAL_DATA_WINDOW_MS = 60 * 60 * 1000;

export function isDeviceOnline(device, offlineAfterS = 30, now = Date.now()) {
  if (!device?.last_seen) return false;
  return now - new Date(device.last_seen).getTime() <= offlineAfterS * 1000;
}

const sum = (obj) => Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);

export function HomeProvider({ children }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const [residence, setResidence] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [devices, setDevices] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [now, setNow] = useState(() => Date.now());
  const [latest, setLatest] = useState({}); // sensorId → leitura
  const [todayByRoom, setTodayByRoom] = useState({});
  const [monthByRoom, setMonthByRoom] = useState({});
  const [demoTick, setDemoTick] = useState(null);

  // ---------------------------------------------------------------------------
  // Carregamento da estrutura
  // ---------------------------------------------------------------------------
  const reload = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const [res, rms, devs, sens, alts] = await Promise.all([
      supabase.from('residences').select('*').maybeSingle(),
      supabase.from('rooms').select('*').order('created_at').order('nome'),
      supabase.from('devices').select('id, residence_id, device_id, nome, status, last_seen, firmware, created_at').order('created_at'),
      supabase.from('sensors').select('*').order('canal'),
      supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    const firstError = [res, rms, devs, sens, alts].find((r) => r.error)?.error;
    if (firstError) setError(firstError.message);
    setResidence(res.data || null);
    setRooms(rms.data || []);
    setDevices(devs.data || []);
    setSensors(sens.data || []);
    setAlerts(alts.data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  // Relógio da interface (status online/offline, "há X segundos")
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  // ---------------------------------------------------------------------------
  // Modo: real × demonstração
  // ---------------------------------------------------------------------------
  const offlineAfter = residence?.offline_after_s ?? 30;
  const onlineDevices = devices.filter((d) => isDeviceOnline(d, offlineAfter, now));
  const hasRecentRealData = devices.some((d) => d.last_seen && now - new Date(d.last_seen).getTime() < REAL_DATA_WINDOW_MS);
  const demoMode = residence?.demo_mode ?? 'auto';
  const isDemo = demoMode === 'on' || (demoMode === 'auto' && onlineDevices.length === 0 && !hasRecentRealData);

  const source = useMemo(() => (isDemo ? demoSource(rooms) : realSource), [isDemo, rooms]);

  // ---------------------------------------------------------------------------
  // Dados reais: carga inicial + atualização periódica dos agregados
  // ---------------------------------------------------------------------------
  const refreshAggregates = useCallback(async () => {
    if (!userId) return;
    const n = new Date();
    const end = new Date(n.getTime() + 60_000);
    try {
      const [latestRes, today, month] = await Promise.all([
        supabase.rpc('latest_readings', { p_window_s: Math.max(offlineAfter * 2, 60) }),
        realSource.energyByRoom(startOfDay(n), end),
        realSource.energyByRoom(startOfMonth(n), end),
      ]);
      if (latestRes.error) throw latestRes.error;
      setLatest(Object.fromEntries((latestRes.data || []).map((r) => [r.sensor_id, r])));
      setTodayByRoom(today);
      setMonthByRoom(month);
    } catch (e) {
      console.warn('Falha ao atualizar agregados', e);
    }
  }, [userId, offlineAfter]);

  useEffect(() => {
    if (isDemo || !residence) return;
    refreshAggregates();
    const id = setInterval(refreshAggregates, 60_000);
    return () => clearInterval(id);
  }, [isDemo, residence, refreshAggregates]);

  // ---------------------------------------------------------------------------
  // Supabase Realtime: novas leituras, status dos dispositivos, alertas
  // ---------------------------------------------------------------------------
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const residenceRef = useRef(residence);
  residenceRef.current = residence;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`energia-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings', filter: `user_id=eq.${userId}` }, ({ new: r }) => {
        setLatest((prev) => ({ ...prev, [r.sensor_id]: r }));
        const t = new Date(r.measured_at);
        const key = r.room_id || UNMAPPED;
        const kwh = Number(r.energy_kwh) || 0;
        if (kwh > 0) {
          if (t >= startOfDay()) setTodayByRoom((p) => ({ ...p, [key]: (p[key] || 0) + kwh }));
          if (t >= startOfMonth()) setMonthByRoom((p) => ({ ...p, [key]: (p[key] || 0) + kwh }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices', filter: `user_id=eq.${userId}` }, ({ eventType, new: d, old }) => {
        if (eventType === 'DELETE') return setDevices((p) => p.filter((x) => x.id !== old.id));
        setDevices((prev) => {
          const safeRow = { ...d };
          delete safeRow.api_key_hash;
          const exists = prev.some((x) => x.id === d.id);
          return exists ? prev.map((x) => (x.id === d.id ? { ...x, ...safeRow } : x)) : [...prev, safeRow];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter: `user_id=eq.${userId}` }, ({ new: a }) => {
        setAlerts((prev) => [a, ...prev].slice(0, 100));
        toastRef.current(a.mensagem, 'warning', {
          title: a.tipo === 'dispositivo_offline' ? '🔴 Dispositivo desconectado' : a.tipo === 'potencia_elevada' ? '⚠️ Potência elevada' : '⚠️ Consumo elevado',
          duration: 8000,
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') console.warn('Realtime indisponível — usando atualização periódica.');
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Sensores novos (criados automaticamente pela API) aparecem sem recarregar
  const knownSensors = useMemo(() => new Set(sensors.map((s) => s.id)), [sensors]);
  useEffect(() => {
    if (Object.keys(latest).some((id) => !knownSensors.has(id))) {
      supabase.from('sensors').select('*').order('canal').then(({ data }) => data && setSensors(data));
    }
  }, [latest, knownSensors]);

  // ---------------------------------------------------------------------------
  // Modo demonstração: dados simulados que variam a cada 2 s
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isDemo) {
      setDemoTick(null);
      return;
    }
    const compute = () => {
      const n = new Date();
      const power = {};
      const today = {};
      const month = {};
      for (const room of rooms) {
        power[room.id] = demoLivePower(room, n);
        today[room.id] = demoEnergy(room, startOfDay(n), n);
        month[room.id] = demoEnergy(room, startOfMonth(n), n);
      }
      setDemoTick({ power, today, month, at: n });
    };
    compute();
    const id = setInterval(compute, 2000);
    return () => clearInterval(id);
  }, [isDemo, rooms]);

  // ---------------------------------------------------------------------------
  // Visão consolidada "ao vivo"
  // ---------------------------------------------------------------------------
  const live = useMemo(() => {
    if (isDemo) {
      const t = demoTick || { power: {}, today: {}, month: {}, at: new Date() };
      return {
        roomPower: t.power,
        unmappedPower: 0,
        totalPower: sum(t.power),
        todayByRoom: t.today,
        monthByRoom: t.month,
        todayTotal: sum(t.today),
        monthTotal: sum(t.month),
        lastUpdate: t.at,
      };
    }
    // Potência por cômodo = soma da última leitura (recente) de cada sensor do cômodo
    const roomPower = Object.fromEntries(rooms.map((r) => [r.id, null]));
    let unmappedPower = 0;
    let lastUpdate = null;
    for (const r of Object.values(latest)) {
      const t = new Date(r.measured_at).getTime();
      if (!lastUpdate || t > lastUpdate) lastUpdate = t;
      if (now - t > offlineAfter * 1000) continue; // leitura velha não conta como "agora"
      const sensor = sensors.find((s) => s.id === r.sensor_id);
      const roomId = sensor?.room_id ?? r.room_id;
      if (roomId && roomId in roomPower) roomPower[roomId] = (roomPower[roomId] || 0) + Number(r.power_w);
      else unmappedPower += Number(r.power_w);
    }
    return {
      roomPower,
      unmappedPower,
      totalPower: sum(roomPower) + unmappedPower,
      todayByRoom,
      monthByRoom,
      todayTotal: sum(todayByRoom),
      monthTotal: sum(monthByRoom),
      lastUpdate: lastUpdate ? new Date(lastUpdate) : null,
    };
  }, [isDemo, demoTick, latest, rooms, sensors, now, offlineAfter, todayByRoom, monthByRoom]);

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------
  const updateResidence = useCallback(
    async (patch) => {
      const { data, error: e } = await supabase.from('residences').update(patch).eq('id', residence.id).select().single();
      if (e) throw e;
      setResidence(data);
      return data;
    },
    [residence],
  );

  const markAlerts = useCallback(async (ids, visualizado = true) => {
    if (!ids.length) return;
    const { error: e } = await supabase.from('alerts').update({ visualizado }).in('id', ids);
    if (e) throw e;
    setAlerts((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, visualizado } : a)));
  }, []);

  const deleteAlerts = useCallback(async (ids) => {
    if (!ids.length) return;
    const { error: e } = await supabase.from('alerts').delete().in('id', ids);
    if (e) throw e;
    setAlerts((prev) => prev.filter((a) => !ids.includes(a.id)));
  }, []);

  const value = {
    loading,
    error,
    reload,
    residence,
    rooms,
    devices,
    sensors,
    alerts,
    unreadAlerts: alerts.filter((a) => !a.visualizado).length,
    tariff: Number(residence?.tarifa_kwh) || 0,
    offlineAfter,
    onlineDevices,
    now,
    isDemo,
    demoMode,
    source,
    live,
    setRooms,
    setDevices,
    setSensors,
    updateResidence,
    markAlerts,
    deleteAlerts,
    refreshAggregates,
  };

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}

export const useHome = () => useContext(HomeContext);
