// Gráficos (Recharts) com o mesmo visual em todo o sistema
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtEnergy, fmtMoney } from '../lib/format.js';

const AXIS = { stroke: '#4a5d53', fontSize: 11, tickLine: false, axisLine: false };
const GRID = <CartesianGrid stroke="#1c2a23" vertical={false} />;

function ChartTooltip({ active, payload, label, tariff, labelFormatter }) {
  if (!active || !payload?.length) return null;
  const kwh = payload[0].value;
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-ink-100">{labelFormatter ? labelFormatter(label, payload) : label}</p>
      <p className="text-volt-300">{fmtEnergy(kwh)}</p>
      {tariff > 0 && <p className="text-amp-300">{fmtMoney(kwh * tariff)}</p>}
    </div>
  );
}

const kwhTick = (v) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)).replace('.', ',');

/** Barras horizontais: consumo por cômodo */
export function RoomBarChart({ data, tariff, height }) {
  const h = height || Math.max(160, data.length * 44 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={10}>
        <CartesianGrid stroke="#1c2a23" horizontal={false} />
        <XAxis type="number" {...AXIS} tickFormatter={kwhTick} unit=" kWh" />
        <YAxis type="category" dataKey="name" {...AXIS} width={92} tick={{ fill: '#a9b9b0', fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'rgba(163,230,53,.06)' }} content={<ChartTooltip tariff={tariff} />} />
        <Bar dataKey="kwh" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Linha/área: consumo ao longo do dia (buckets por hora) */
export function DayLineChart({ data, tariff, height = 240 }) {
  const now = new Date();
  // Horas futuras ficam vazias (null) em vez de aparecerem como consumo zero
  const rows = data.map((d) => ({ label: `${String(d.date.getHours()).padStart(2, '0')}:00`, kwh: d.date > now ? null : d.kwh }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="areaVolt" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#a3e635" stopOpacity=".35" />
            <stop offset="1" stopColor="#a3e635" stopOpacity="0" />
          </linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="label" {...AXIS} interval={3} />
        <YAxis {...AXIS} tickFormatter={kwhTick} width={48} />
        <Tooltip content={<ChartTooltip tariff={tariff} />} cursor={{ stroke: '#a3e635', strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey="kwh" stroke="#a3e635" strokeWidth={2} fill="url(#areaVolt)" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barras verticais: consumo por dia ou por mês */
export function ColumnChart({ data, tariff, height = 240, labelKey = 'label', highlightLast = false, tooltipLabel }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        {GRID}
        <XAxis dataKey={labelKey} {...AXIS} interval="preserveStartEnd" />
        <YAxis {...AXIS} tickFormatter={kwhTick} width={48} />
        <Tooltip cursor={{ fill: 'rgba(163,230,53,.06)' }} content={<ChartTooltip tariff={tariff} labelFormatter={tooltipLabel} />} />
        <Bar dataKey="kwh" radius={[5, 5, 0, 0]} maxBarSize={36}>
          {data.map((d, i) => (
            <Cell key={i} fill={highlightLast && i === data.length - 1 ? '#bef264' : '#34d399'} fillOpacity={highlightLast && i !== data.length - 1 ? 0.7 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
