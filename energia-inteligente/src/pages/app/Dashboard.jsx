import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bell, CalendarDays, ChartColumn, Coins, Gauge, TrendingUp, Zap } from 'lucide-react';
import { Card, CardTitle, DataKind, EmptyState, cx } from '../../components/ui.jsx';
import { DayLineChart, RoomBarChart } from '../../components/Charts.jsx';
import DeviceStatusCard from '../../components/DeviceStatusCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useHome } from '../../context/HomeContext.jsx';
import { addDays, costOf, monthForecast, startOfDay } from '../../lib/energy.js';
import { fmtDateTime, fmtEnergy, fmtMoney, fmtPower, fmtTariff, fmtTime } from '../../lib/format.js';
import { roomColor, roomIcon } from '../../lib/rooms.js';

function Stat({ icon: Icon, label, value, kind, demo, accent = 'text-ink-100', sub }) {
  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      <div className="flex flex-col-reverse items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-2">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-400">
          <Icon className="h-4 w-4" /> {label}
        </p>
        <DataKind kind={kind} demo={demo} />
      </div>
      <p className={cx('mt-3 font-display text-2xl font-bold tabular sm:text-3xl', accent)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
    </Card>
  );
}

function RoomCard({ room, index, power, today, tariff, maxPower, status, demo }) {
  const Icon = roomIcon(room.nome);
  const pct = maxPower > 0 && power ? Math.min(100, (power / maxPower) * 100) : 0;
  const color = roomColor(index);
  const statusInfo = {
    ok: { text: 'Monitorando', dot: 'bg-leaf-400', cls: 'text-leaf-300' },
    stale: { text: 'Sem dados recentes', dot: 'bg-danger-500', cls: 'text-danger-400' },
    nosensor: { text: 'Sem sensor vinculado', dot: 'bg-ink-500', cls: 'text-ink-400' },
  }[status];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <h3 className="truncate font-display font-semibold uppercase tracking-wide text-ink-100">{room.nome}</h3>
        </div>
        <span className={cx('flex shrink-0 items-center gap-1.5 text-[11px] font-medium', statusInfo.cls)}>
          <span className={cx('h-2 w-2 rounded-full', statusInfo.dot, status === 'ok' && 'animate-pulseDot')} />
          {statusInfo.text}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-500">Potência atual</p>
          <p className="font-display text-2xl font-bold tabular text-ink-100">{power == null ? '—' : fmtPower(power)}</p>
        </div>
        <DataKind kind="medido" demo={demo} />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden="true">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-ink-500">Consumo hoje</dt>
          <dd className="font-semibold tabular text-ink-200">{fmtEnergy(today)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-ink-500">Custo estimado</dt>
          <dd className="font-semibold tabular text-amp-300">{fmtMoney(costOf(today, tariff))}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { residence, rooms, sensors, live, tariff, isDemo, source, alerts, onlineDevices, devices } = useHome();
  const [hourly, setHourly] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      const from = startOfDay();
      source
        .energyBuckets(from, addDays(from, 1), 'hour')
        .then((d) => alive && setHourly(d))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [source]);

  const forecast = monthForecast(live.monthTotal, tariff);
  const maxPower = Math.max(1, ...rooms.map((r) => live.roomPower[r.id] || 0));
  const mappedRooms = useMemo(() => new Set(sensors.map((s) => s.room_id).filter(Boolean)), [sensors]);
  const unmappedCount = sensors.filter((s) => !s.room_id).length;

  const barData = rooms
    .map((r, i) => ({ name: r.nome, kwh: live.todayByRoom[r.id] || 0, color: roomColor(i) }))
    .sort((a, b) => b.kwh - a.kwh);
  const recentAlerts = alerts.slice(0, 4);
  const firstName = (profile?.nome || '').split(' ')[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Olá{firstName ? `, ${firstName}` : ''}!</h1>
          <p className="mt-1 text-sm text-ink-400">
            {residence?.nome} · {rooms.length} cômodo(s) · Tarifa {fmtTariff(tariff)}
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-ink-400">
          <Activity className="h-3.5 w-3.5 text-volt-400" />
          {isDemo ? 'Dados simulados atualizando a cada 2 s' : live.lastUpdate ? `Última leitura às ${fmtTime(live.lastUpdate)}` : 'Aguardando dados do ESP32'}
        </p>
      </div>

      {tariff === 0 && (
        <p className="rounded-xl border border-amp-500/30 bg-amp-500/10 px-4 py-2.5 text-sm text-amp-300">
          A tarifa está em R$ 0,00 — os custos aparecerão zerados.{' '}
          <Link to="/app/configuracoes" className="font-semibold underline">
            Configurar tarifa
          </Link>
        </p>
      )}
      {!isDemo && unmappedCount > 0 && (
        <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-200">
          {unmappedCount} sensor(es) sem cômodo vinculado{live.unmappedPower > 0 ? ` (${fmtPower(live.unmappedPower)} agora)` : ''}.{' '}
          <Link to="/app/dispositivos" className="font-semibold underline">
            Vincular sensores
          </Link>
        </p>
      )}

      {/* Indicadores */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat icon={Zap} label="Consumo atual" value={fmtPower(live.totalPower, { forceKw: true })} kind="medido" demo={isDemo} accent="text-volt-300" sub="Potência instantânea total" />
        <Stat icon={Gauge} label="Consumo hoje" value={fmtEnergy(live.todayTotal)} kind="calculado" demo={isDemo} />
        <Stat icon={Coins} label="Custo estimado hoje" value={fmtMoney(costOf(live.todayTotal, tariff))} kind="calculado" demo={isDemo} accent="text-amp-300" />
        <Stat icon={CalendarDays} label="Consumo do mês" value={fmtEnergy(live.monthTotal)} kind="calculado" demo={isDemo} />
        <Stat icon={Coins} label="Custo estimado do mês" value={fmtMoney(costOf(live.monthTotal, tariff))} kind="calculado" demo={isDemo} accent="text-amp-300" />
        <Stat
          icon={TrendingUp}
          label="Previsão do mês"
          value={forecast ? fmtMoney(forecast.cost) : '—'}
          kind="estimado"
          demo={isDemo}
          accent="text-amp-300"
          sub={forecast ? `≈ ${fmtEnergy(forecast.kwh)} · estimativa, não é a conta oficial` : 'Aguardando dados suficientes'}
        />
      </section>

      {forecast && (
        <p className="rounded-xl border border-ink-700 bg-ink-850/60 px-4 py-3 text-sm text-ink-300">
          📈 Com base no consumo atual, sua conta estimada para este mês é de <strong className="text-amp-300">{fmtMoney(forecast.cost)}</strong>.{' '}
          <span className="text-ink-500">Estimativa — não é o valor oficial da conta de energia (não inclui bandeiras, taxas mínimas e iluminação pública).</span>
        </p>
      )}

      {/* Cômodos */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Monitoramento por cômodo</h2>
          <Link to="/app/comodos" className="text-xs font-semibold text-volt-400 hover:underline">
            Gerenciar cômodos
          </Link>
        </div>
        {rooms.length === 0 ? (
          <EmptyState title="Nenhum cômodo cadastrado" action={<Link to="/app/comodos" className="font-semibold text-volt-400">Adicionar cômodo →</Link>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room, i) => {
              const power = live.roomPower[room.id];
              const status = isDemo ? 'ok' : !mappedRooms.has(room.id) ? 'nosensor' : power == null ? 'stale' : 'ok';
              return (
                <RoomCard
                  key={room.id}
                  room={room}
                  index={i}
                  power={power}
                  today={live.todayByRoom[room.id] || 0}
                  tariff={tariff}
                  maxPower={maxPower}
                  status={status}
                  demo={isDemo}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Gráficos + status */}
      <section className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardTitle icon={ChartColumn} subtitle="Energia de hoje por hora (kWh)" action={<DataKind kind="calculado" demo={isDemo} />}>
            Consumo ao longo do dia
          </CardTitle>
          <DayLineChart data={hourly} tariff={tariff} />
        </Card>
        <DeviceStatusCard />
        <Card className="lg:col-span-2">
          <CardTitle icon={ChartColumn} subtitle="Energia consumida hoje" action={<Link to="/app/graficos" className="text-xs font-semibold text-volt-400 hover:underline">Mais gráficos</Link>}>
            Consumo por cômodo
          </CardTitle>
          {barData.length ? <RoomBarChart data={barData} tariff={tariff} /> : <p className="text-sm text-ink-400">Sem cômodos.</p>}
        </Card>
        <Card>
          <CardTitle icon={Bell} action={<Link to="/app/alertas" className="text-xs font-semibold text-volt-400 hover:underline">Ver todos</Link>}>
            Alertas recentes
          </CardTitle>
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-ink-400">Nenhum alerta. {onlineDevices.length === 0 && devices.length > 0 && !isDemo && 'Os alertas dependem de dados reais do ESP32.'}</p>
          ) : (
            <ul className="space-y-2.5">
              {recentAlerts.map((a) => (
                <li key={a.id} className={cx('rounded-lg border px-3 py-2 text-sm', a.visualizado ? 'border-ink-700 text-ink-300' : 'border-amp-500/40 bg-amp-500/5 text-ink-100')}>
                  <p>{a.tipo === 'dispositivo_offline' ? '🔴' : '⚠️'} {a.mensagem}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">{fmtDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
