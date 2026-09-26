import { useEffect, useMemo, useState } from 'react';
import { Download, History as HistoryIcon } from 'lucide-react';
import { Button, Card, DataKind, Input, PageHeader, Segmented, Select, Spinner } from '../../components/ui.jsx';
import { ColumnChart } from '../../components/Charts.jsx';
import { useHome } from '../../context/HomeContext.jsx';
import { PERIODS, addDays, costOf, periodRange, startOfDay } from '../../lib/energy.js';
import { fmtDate, fmtEnergy, fmtMoney } from '../../lib/format.js';

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function History() {
  const { rooms, tariff, source, isDemo } = useHome();
  const [period, setPeriod] = useState('7d');
  const [custom, setCustom] = useState({ from: isoDate(addDays(new Date(), -13)), to: isoDate(new Date()) });
  const [roomId, setRoomId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = useMemo(() => periodRange(period, custom), [period, custom]);
  const bucket = period === 'today' ? 'hour' : 'day';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    source
      .energyBuckets(range.from, range.to, bucket, roomId || null)
      .then((data) => {
        if (!alive) return;
        // Não mostra horas/dias no futuro
        const now = new Date();
        setRows(data.filter((r) => r.date <= now));
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [source, range, bucket, roomId]);

  const total = rows.reduce((s, r) => s + r.kwh, 0);
  const roomName = roomId ? rooms.find((r) => r.id === roomId)?.nome : 'Todos os cômodos';
  const periodName = PERIODS.find((p) => p.key === period)?.label;
  const label = (d) => (bucket === 'hour' ? `${String(d.getHours()).padStart(2, '0')}:00` : fmtDate(d));

  function exportCsv() {
    const header = bucket === 'hour' ? 'Hora;Consumo (kWh);Custo (R$)' : 'Data;Consumo (kWh);Custo (R$)';
    const lines = rows.map((r) =>
      [bucket === 'hour' ? label(r.date) : fmtDate(r.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), r.kwh.toFixed(4).replace('.', ','), costOf(r.kwh, tariff).toFixed(2).replace('.', ',')].join(';'),
    );
    const blob = new Blob([`﻿${header}\n${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historico-${(roomName || 'todos').toLowerCase().replace(/\s+/g, '-')}-${isoDate(range.from)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Histórico de consumo"
        subtitle="Energia consumida e custo estimado por período e por cômodo."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      <Card className="space-y-4">
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Cômodo" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Todos os cômodos</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
          {period === 'custom' && (
            <>
              <Input label="De" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <Input label="Até" type="date" value={custom.to} min={custom.from} max={isoDate(new Date())} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display font-semibold">
              {roomName} — {periodName?.toLowerCase()}
            </h2>
            <DataKind kind="calculado" demo={isDemo} />
          </div>
          {loading ? (
            <div className="grid h-60 place-items-center"><Spinner /></div>
          ) : (
            <ColumnChart data={rows.map((r) => ({ label: label(r.date), kwh: r.kwh }))} tariff={tariff} height={260} />
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-700 pt-4">
            <div>
              <dt className="text-xs text-ink-400">Consumo total</dt>
              <dd className="font-display text-xl font-bold tabular text-volt-300">{fmtEnergy(total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Custo estimado</dt>
              <dd className="font-display text-xl font-bold tabular text-amp-300">{fmtMoney(costOf(total, tariff))}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-0">
          {error ? (
            <p className="p-5 text-sm text-danger-400">{error}</p>
          ) : loading ? (
            <div className="grid h-60 place-items-center"><Spinner /></div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-ink-400">
              <HistoryIcon className="h-6 w-6" /> Sem dados no período.
            </div>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-850 text-left text-xs uppercase tracking-wide text-ink-400">
                  <tr>
                    <th className="px-3 py-3 sm:px-5 font-medium">{bucket === 'hour' ? 'Hora' : 'Data'}</th>
                    <th className="px-3 py-3 sm:px-5 text-right font-medium">Consumo</th>
                    <th className="px-3 py-3 sm:px-5 text-right font-medium">Custo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/70">
                  {[...rows].reverse().map((r) => (
                    <tr key={r.date.getTime()} className="hover:bg-ink-800/50">
                      <td className="px-3 py-2.5 sm:px-5 tabular text-ink-200">
                        {bucket === 'hour' ? label(r.date) : fmtDate(r.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        {bucket === 'day' && r.date.getTime() === startOfDay().getTime() && <span className="ml-2 text-xs text-volt-400">(parcial)</span>}
                      </td>
                      <td className="px-3 py-2.5 sm:px-5 text-right tabular whitespace-nowrap text-ink-100">{fmtEnergy(r.kwh)}</td>
                      <td className="px-3 py-2.5 sm:px-5 text-right tabular whitespace-nowrap text-amp-300">{fmtMoney(costOf(r.kwh, tariff))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-ink-850 font-semibold">
                  <tr>
                    <td className="px-3 py-3 sm:px-5 text-ink-100">Total</td>
                    <td className="px-3 py-3 sm:px-5 text-right tabular whitespace-nowrap text-volt-300">{fmtEnergy(total)}</td>
                    <td className="px-3 py-3 sm:px-5 text-right tabular whitespace-nowrap text-amp-300">{fmtMoney(costOf(total, tariff))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
      <p className="text-xs text-ink-500">Custos calculados com a tarifa atual ({fmtMoney(tariff)}/kWh). Se a tarifa mudou no período, os valores reais podem ser diferentes.</p>
    </div>
  );
}
