import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, TrendingUp, WifiOff, Zap } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Segmented, cx } from '../../components/ui.jsx';
import { useHome } from '../../context/HomeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { fmtDateTime, fmtPower } from '../../lib/format.js';

const TYPES = {
  potencia_elevada: { icon: Zap, title: '⚠️ Potência elevada', cls: 'text-danger-400 bg-danger-500/10' },
  consumo_elevado: { icon: TrendingUp, title: '⚠️ Consumo elevado', cls: 'text-amp-300 bg-amp-500/10' },
  dispositivo_offline: { icon: WifiOff, title: '🔴 Dispositivo desconectado', cls: 'text-ink-300 bg-ink-700' },
};

export default function Alerts() {
  const { alerts, rooms, residence, markAlerts, deleteAlerts, isDemo } = useHome();
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');

  const list = alerts.filter((a) => filter === 'all' || (filter === 'unread' ? !a.visualizado : a.tipo === filter));
  const unread = alerts.filter((a) => !a.visualizado).map((a) => a.id);
  const roomName = (id) => rooms.find((r) => r.id === id)?.nome;
  const run = (p) => p.catch((e) => toast(e.message, 'error'));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alertas"
        subtitle={`Limite de potência padrão: ${fmtPower(residence.power_limit_w)} (configure por cômodo em Cômodos).`}
        actions={
          <>
            <Button variant="secondary" onClick={() => run(markAlerts(unread))} disabled={!unread.length}>
              <CheckCheck className="h-4 w-4" /> Marcar todos como lidos
            </Button>
            <Link to="/app/configuracoes" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-ink-200 hover:bg-ink-800">
              Configurar alertas
            </Link>
          </>
        }
      />

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: `Todos (${alerts.length})` },
          { key: 'unread', label: `Não lidos (${unread.length})` },
          { key: 'potencia_elevada', label: 'Potência' },
          { key: 'consumo_elevado', label: 'Consumo' },
          { key: 'dispositivo_offline', label: 'Offline' },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState icon={Bell} title="Nenhum alerta por aqui">
          Os alertas são gerados automaticamente a partir dos dados reais do ESP32: potência acima do limite, consumo acima da média e dispositivo sem enviar dados.
          {isDemo && ' No modo demonstração nenhum alerta é criado.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => {
            const t = TYPES[a.tipo] || TYPES.potencia_elevada;
            const Icon = t.icon;
            return (
              <li key={a.id}>
                <Card className={cx('flex items-start gap-4 p-4', !a.visualizado && 'border-amp-500/40')}>
                  <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', t.cls)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-semibold text-ink-100">{t.title}</p>
                      {!a.visualizado && <span className="rounded bg-amp-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amp-300">Novo</span>}
                    </div>
                    <p className="mt-1 text-sm text-ink-300">"{a.mensagem}"</p>
                    <p className="mt-1.5 text-xs text-ink-500">
                      {fmtDateTime(a.created_at)}
                      {roomName(a.room_id) && ` · ${roomName(a.room_id)}`}
                      {a.limite != null && a.tipo === 'potencia_elevada' && ` · limite ${fmtPower(a.limite)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!a.visualizado && (
                      <button onClick={() => run(markAlerts([a.id]))} className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-leaf-300" title="Marcar como lido" aria-label="Marcar como lido">
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => run(deleteAlerts([a.id]))} className="rounded-lg p-2 text-ink-400 hover:bg-danger-500/10 hover:text-danger-400" title="Excluir" aria-label="Excluir alerta">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
