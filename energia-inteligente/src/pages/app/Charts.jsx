import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChartColumn, Clock, DoorOpen } from 'lucide-react';
import { Card, CardTitle, DataKind, Input, PageHeader, Segmented, Spinner } from '../../components/ui.jsx';
import { ColumnChart, DayLineChart, RoomBarChart } from '../../components/Charts.jsx';
import { useHome } from '../../context/HomeContext.jsx';
import { UNMAPPED } from '../../lib/energySource.js';
import { addDays, costOf, periodRange, startOfDay } from '../../lib/energy.js';
import { fmtEnergy, fmtMoney } from '../../lib/format.js';
import { roomColor } from '../../lib/rooms.js';

const ROOM_PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'month', label: 'Este mês' },
];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

const Loading = () => (
  <div className="grid h-60 place-items-center">
    <Spinner />
  </div>
);

export default function Charts() {
  const { rooms, tariff, source, isDemo } = useHome();
  const [roomPeriod, setRoomPeriod] = useState('today');
  const [day, setDay] = useState(isoDate(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());
  const [roomId, setRoomId] = useState('');

  const byRoom = useAsync(() => {
    const { from, to } = periodRange(roomPeriod);
    return source.energyByRoom(from, to);
  }, [source, roomPeriod]);

  const hourly = useAsync(() => {
    const from = startOfDay(new Date(`${day}T00:00:00`));
    return source.energyBuckets(from, addDays(from, 1), 'hour', roomId || null);
  }, [source, day, roomId]);

  const monthly = useAsync(() => source.energyBuckets(new Date(year, 0, 1), new Date(year + 1, 0, 1), 'month', roomId || null), [source, year, roomId]);

  const roomData = useMemo(() => {
    const d = byRoom.data || {};
    const list = rooms.map((r, i) => ({ name: r.nome, kwh: d[r.id] || 0, color: roomColor(i) }));
    if (d[UNMAPPED]) list.push({ name: 'Sem cômodo', kwh: d[UNMAPPED], color: '#4a5d53' });
    return list.sort((a, b) => b.kwh - a.kwh);
  }, [byRoom.data, rooms]);
  const roomTotal = roomData.reduce((s, r) => s + r.kwh, 0);

  const monthData = (monthly.data || []).map((m) => ({ label: MONTHS[m.date.getMonth()].slice(0, 3), full: MONTHS[m.date.getMonth()], kwh: m.kwh }));
  const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);
  const dayTotal = (hourly.data || []).reduce((s, h) => s + h.kwh, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Gráficos" subtitle="Compare cômodos e acompanhe a evolução do consumo." />

      <Card>
        <CardTitle icon={DoorOpen} subtitle="Qual cômodo consome mais energia?" action={<DataKind kind="calculado" demo={isDemo} />}>
          Consumo por cômodo
        </CardTitle>
        <Segmented options={ROOM_PERIODS} value={roomPeriod} onChange={setRoomPeriod} className="mb-4" />
        {byRoom.loading && !byRoom.data ? (
          <Loading />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
            <RoomBarChart data={roomData} tariff={tariff} />
            <ul className="space-y-2.5 self-center">
              {roomData.map((r) => {
                const pct = roomTotal ? (r.kwh / roomTotal) * 100 : 0;
                return (
                  <li key={r.name}>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink-200">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} /> {r.name}
                      </span>
                      <span className="tabular text-ink-300">
                        {fmtEnergy(r.kwh)} · <strong className="text-ink-100">{pct.toFixed(0)}%</strong>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-ink-700">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                    </div>
                  </li>
                );
              })}
              <li className="flex justify-between border-t border-ink-700 pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular">
                  {fmtEnergy(roomTotal)} · <span className="text-amp-300">{fmtMoney(costOf(roomTotal, tariff))}</span>
                </span>
              </li>
            </ul>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="room-filter" className="text-sm text-ink-300">
          Mostrar nos gráficos abaixo:
        </label>
        <select id="room-filter" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="h-10 rounded-lg border border-ink-600 bg-ink-900 px-3 pr-9 text-sm text-ink-100">
          <option value="">Todos os cômodos</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 xl:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardTitle icon={Clock} subtitle={`Total do dia: ${fmtEnergy(dayTotal)} · ${fmtMoney(costOf(dayTotal, tariff))}`} action={<div className="w-40"><Input type="date" value={day} max={isoDate(new Date())} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-9" aria-label="Dia" /></div>}>
            Consumo ao longo do dia
          </CardTitle>
          {hourly.loading && !hourly.data ? <Loading /> : <DayLineChart data={hourly.data || []} tariff={tariff} height={260} />}
        </Card>

        <Card>
          <CardTitle
            icon={CalendarDays}
            subtitle="Energia consumida por mês"
            action={
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-lg border border-ink-600 bg-ink-900 px-3 pr-8 text-sm" aria-label="Ano">
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            }
          >
            Consumo mensal
          </CardTitle>
          {monthly.loading && !monthly.data ? (
            <Loading />
          ) : (
            <ColumnChart data={monthData} tariff={tariff} height={260} tooltipLabel={(label, payload) => payload?.[0]?.payload?.full || label} />
          )}
        </Card>
      </div>
      {(byRoom.error || hourly.error || monthly.error) && (
        <p className="flex items-center gap-2 text-sm text-danger-400">
          <ChartColumn className="h-4 w-4" /> Erro ao carregar dados: {(byRoom.error || hourly.error || monthly.error).message}
        </p>
      )}
    </div>
  );
}
