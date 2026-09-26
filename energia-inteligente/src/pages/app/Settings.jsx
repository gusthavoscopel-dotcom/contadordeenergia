import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Cpu, FlaskConical, Home, Zap } from 'lucide-react';
import { Button, Card, CardTitle, Input, PageHeader, Select, StatusDot, Toggle } from '../../components/ui.jsx';
import { isDeviceOnline, useHome } from '../../context/HomeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { fmtMoney, fmtTime, parseDecimal, timeAgo } from '../../lib/format.js';

export default function Settings() {
  const { residence, updateResidence, devices, offlineAfter, now } = useHome();
  const { toast } = useToast();
  const [nome, setNome] = useState(residence.nome);
  const [tarifa, setTarifa] = useState(String(residence.tarifa_kwh).replace('.', ','));
  const [limit, setLimit] = useState(String(residence.power_limit_w).replace('.', ','));
  const [offline, setOffline] = useState(String(residence.offline_after_s));
  const [saving, setSaving] = useState(null);

  async function save(section, patch) {
    setSaving(section);
    try {
      await updateResidence(patch);
      toast('Configurações salvas.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(null);
    }
  }

  const tarifaNum = parseDecimal(tarifa);
  const limitNum = parseDecimal(limit);
  const offlineNum = Number(offline);

  return (
    <div className="space-y-5">
      <PageHeader title="Configurações" subtitle="Residência, tarifa de energia, notificações e dispositivo." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle icon={Home}>Configurações da residência</CardTitle>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nome.trim()) return toast('Informe o nome da residência.', 'error');
              save('res', { nome: nome.trim() });
            }}
          >
            <Input label="Nome da residência" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
            <Button type="submit" loading={saving === 'res'}>Salvar</Button>
          </form>
        </Card>

        <Card>
          <CardTitle icon={Zap} subtitle="Usada para calcular o custo estimado: custo = kWh × tarifa">
            Energia
          </CardTitle>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!(tarifaNum >= 0) || tarifaNum >= 100) return toast('Tarifa inválida. Ex.: 0,95', 'error');
              if (!(limitNum > 0)) return toast('Limite de potência inválido.', 'error');
              save('energy', { tarifa_kwh: tarifaNum, power_limit_w: limitNum });
            }}
          >
            <Input label="Tarifa por kWh" prefix="R$" suffix="/ kWh" inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} className="font-mono" hint="Confira na sua conta de luz. Varia por região, concessionária e período." />
            <Input label="Limite de potência padrão" suffix="W" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} hint="Alerta quando um cômodo passar deste valor (cada cômodo pode ter o seu)." />
            {tarifaNum >= 0 && <p className="text-xs text-ink-400">1 kWh custará {fmtMoney(tarifaNum)}.</p>}
            <Button type="submit" loading={saving === 'energy'}>Salvar</Button>
          </form>
        </Card>

        <Card>
          <CardTitle icon={Bell}>Notificações</CardTitle>
          <div className="divide-y divide-ink-700">
            <Toggle label="Alertas de consumo elevado" description="Cômodo consumindo bem acima da média dos últimos 7 dias." checked={residence.notify_high_consumption} onChange={(v) => save('n', { notify_high_consumption: v })} />
            <Toggle label="Alertas de dispositivo offline" description="ESP32 parou de enviar dados." checked={residence.notify_offline} onChange={(v) => save('n', { notify_offline: v })} />
            <Toggle label="Alertas de potência elevada" description="Potência acima do limite configurado." checked={residence.notify_high_power} onChange={(v) => save('n', { notify_high_power: v })} />
          </div>
          <form
            className="mt-4 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!(offlineNum >= 10 && offlineNum <= 3600)) return toast('Use entre 10 e 3600 segundos.', 'error');
              save('off', { offline_after_s: offlineNum });
            }}
          >
            <div className="flex-1">
              <Input label="Considerar offline após" type="number" min={10} max={3600} suffix="seg" value={offline} onChange={(e) => setOffline(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary" className="h-11" loading={saving === 'off'}>Salvar</Button>
          </form>
        </Card>

        <Card>
          <CardTitle icon={Cpu} action={<Link to="/app/dispositivos" className="text-xs font-semibold text-volt-400 hover:underline">Gerenciar</Link>}>
            Dispositivo
          </CardTitle>
          {devices.length === 0 ? (
            <p className="text-sm text-ink-400">Nenhum ESP32 cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => {
                const online = isDeviceOnline(d, offlineAfter, now);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-900/70 px-3 py-2.5 text-sm">
                    <div>
                      <p className="text-xs text-ink-400">ID do ESP32</p>
                      <p className="font-mono text-ink-100">{d.device_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="flex items-center justify-end gap-2 text-xs font-semibold">
                        <StatusDot online={online} /> {online ? 'Conectado' : 'Desconectado'}
                      </p>
                      <p className="text-xs text-ink-500">{d.last_seen ? `${fmtTime(d.last_seen)} · ${timeAgo(d.last_seen, now)}` : 'nunca enviou dados'}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-5 border-t border-ink-700 pt-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-100">
              <FlaskConical className="h-4 w-4 text-amp-400" /> Modo demonstração
            </p>
            <Select value={residence.demo_mode} onChange={(e) => save('demo', { demo_mode: e.target.value })} hint="No automático, os dados simulados só aparecem enquanto nenhum ESP32 enviou dados na última hora.">
              <option value="auto">Automático (recomendado)</option>
              <option value="on">Sempre ligado</option>
              <option value="off">Desligado</option>
            </Select>
          </div>
        </Card>
      </div>
    </div>
  );
}
