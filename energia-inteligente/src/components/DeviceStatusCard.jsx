import { Link } from 'react-router-dom';
import { Cpu } from 'lucide-react';
import { Card, CardTitle, StatusDot } from './ui.jsx';
import { isDeviceOnline, useHome } from '../context/HomeContext.jsx';
import { fmtTime, timeAgo } from '../lib/format.js';

export default function DeviceStatusCard() {
  const { devices, offlineAfter, now, isDemo } = useHome();
  return (
    <Card>
      <CardTitle icon={Cpu} action={<Link to="/app/dispositivos" className="text-xs font-semibold text-volt-400 hover:underline">Gerenciar</Link>}>
        Status do dispositivo
      </CardTitle>
      {devices.length === 0 ? (
        <div className="text-sm text-ink-400">
          <p>Nenhum ESP32 cadastrado.</p>
          <Link to="/app/dispositivos?novo=1" className="mt-2 inline-block font-semibold text-volt-400 hover:underline">
            Cadastrar dispositivo →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {devices.map((d) => {
            const online = isDeviceOnline(d, offlineAfter, now);
            return (
              <li key={d.id} className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
                <div className="flex items-center gap-2">
                  <StatusDot online={online} />
                  <p className="font-semibold text-ink-100">{online ? `${d.nome} conectado` : `${d.nome} desconectado`}</p>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-ink-400">ID</dt>
                  <dd className="text-right font-mono text-ink-200">{d.device_id}</dd>
                  <dt className="text-ink-400">Última atualização</dt>
                  <dd className="text-right tabular text-ink-200">{fmtTime(d.last_seen)}</dd>
                  <dt className="text-ink-400">Dados recebidos</dt>
                  <dd className="text-right text-ink-200">{timeAgo(d.last_seen, now)}</dd>
                </dl>
                {!online && d.last_seen && !isDemo && <p className="mt-2 text-xs text-danger-400">Não recebemos dados do dispositivo recentemente.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
