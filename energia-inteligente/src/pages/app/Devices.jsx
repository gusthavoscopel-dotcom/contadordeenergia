import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Copy, Cpu, KeyRound, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Input, Modal, PageHeader, StatusDot, cx } from '../../components/ui.jsx';
import { isDeviceOnline, useHome } from '../../context/HomeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { supabase } from '../../lib/supabase.js';
import { DEVICE_ID_RE, generateDeviceKey, sha256Hex, suggestDeviceId } from '../../lib/deviceKey.js';
import { fmtPower, fmtTime, timeAgo } from '../../lib/format.js';

const API_URL = `${window.location.origin}/api/energy/readings`;

function CopyButton({ text, label = 'Copiar' }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* navegador sem permissão de clipboard */
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? 'Copiado' : label}
    </Button>
  );
}

function KeyModal({ info, onClose }) {
  if (!info) return null;
  const snippet = `// Cole em firmware/esp32_monitor_energia/config.h
#define DEVICE_ID   "${info.deviceId}"
#define DEVICE_KEY  "${info.key}"
#define API_URL     "${API_URL}"`;
  return (
    <Modal open onClose={onClose} title="Chave do dispositivo" size="lg" footer={<Button onClick={onClose}>Já guardei a chave</Button>}>
      <div className="space-y-4">
        <Alert type="warning">
          <strong>Guarde esta chave agora.</strong> Por segurança ela não será exibida novamente — o sistema guarda apenas um hash dela. Se perder, gere uma nova.
        </Alert>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-400">ID do dispositivo</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-ink-900 px-3 py-2 font-mono text-sm text-ink-100">{info.deviceId}</code>
            <CopyButton text={info.deviceId} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-400">Chave secreta (X-Device-Key)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-ink-900 px-3 py-2 font-mono text-sm text-volt-300">{info.key}</code>
            <CopyButton text={info.key} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-ink-400">Configuração para o firmware do ESP32</p>
            <CopyButton text={snippet} label="Copiar tudo" />
          </div>
          <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-xs leading-relaxed text-leaf-300">{snippet}</pre>
        </div>
      </div>
    </Modal>
  );
}

function NewDeviceModal({ open, onClose, onCreated }) {
  const { residence, rooms } = useHome();
  const [nome, setNome] = useState('ESP32 — Casa');
  const [deviceId, setDeviceId] = useState(suggestDeviceId);
  const [channels, setChannels] = useState(Math.min(Math.max(rooms.length, 1), 4));
  const [autoMap, setAutoMap] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const id = deviceId.trim();
    if (!nome.trim()) return setError('Informe um nome.');
    if (!DEVICE_ID_RE.test(id)) return setError('ID inválido: use 3–40 caracteres (letras, números, "-" ou "_").');
    const n = Number(channels);
    if (!Number.isInteger(n) || n < 1 || n > 32) return setError('Quantidade de sensores entre 1 e 32.');
    setSaving(true);
    setError('');
    const key = generateDeviceKey();
    const { data: dev, error: e1 } = await supabase
      .from('devices')
      .insert({ residence_id: residence.id, device_id: id, nome: nome.trim(), api_key_hash: await sha256Hex(key) })
      .select('id, residence_id, device_id, nome, status, last_seen, firmware, created_at')
      .single();
    if (e1) {
      setSaving(false);
      return setError(e1.code === '23505' ? 'Esse ID já está em uso. Escolha outro.' : e1.message);
    }
    const sensorRows = Array.from({ length: n }, (_, i) => ({
      device_id: dev.id,
      canal: i + 1,
      nome: `Sensor ${String(i + 1).padStart(2, '0')}`,
      room_id: autoMap && rooms[i] ? rooms[i].id : null,
    }));
    const { data: sens, error: e2 } = await supabase.from('sensors').insert(sensorRows).select();
    setSaving(false);
    if (e2) return setError(e2.message);
    onCreated(dev, sens, key);
    setDeviceId(suggestDeviceId());
  }

  return (
    <Modal open={open} onClose={onClose} title="Cadastrar ESP32">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
        <Input label="ID do dispositivo" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="font-mono" hint="Identificador único. Será usado no firmware (DEVICE_ID)." />
        <Input label="Quantidade de sensores (canais)" type="number" min={1} max={32} value={channels} onChange={(e) => setChannels(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-ink-300">
          <input type="checkbox" checked={autoMap} onChange={(e) => setAutoMap(e.target.checked)} className="h-4 w-4 accent-volt-500" />
          Vincular automaticamente: Sensor 01 → {rooms[0]?.nome || '—'}, Sensor 02 → {rooms[1]?.nome || '—'}…
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Cadastrar e gerar chave
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeviceCard({ device, onKey, onDeleted }) {
  const { rooms, sensors, setSensors, setDevices, offlineAfter, now } = useHome();
  const { toast } = useToast();
  const [renaming, setRenaming] = useState(false);
  const [nome, setNome] = useState(device.nome);
  const [confirm, setConfirm] = useState(null); // 'delete' | 'key'
  const [busy, setBusy] = useState(false);
  const online = isDeviceOnline(device, offlineAfter, now);
  const mySensors = sensors.filter((s) => s.device_id === device.id).sort((a, b) => a.canal - b.canal);

  async function mapSensor(sensor, roomId) {
    const { data, error } = await supabase.from('sensors').update({ room_id: roomId || null }).eq('id', sensor.id).select().single();
    if (error) return toast(error.message, 'error');
    setSensors((list) => list.map((s) => (s.id === data.id ? data : s)));
    toast(`Sensor ${String(sensor.canal).padStart(2, '0')} → ${rooms.find((r) => r.id === roomId)?.nome || 'sem cômodo'}`, 'success');
  }

  async function addSensor() {
    const next = (mySensors.at(-1)?.canal || 0) + 1;
    if (next > 32) return;
    const { data, error } = await supabase
      .from('sensors')
      .insert({ device_id: device.id, canal: next, nome: `Sensor ${String(next).padStart(2, '0')}` })
      .select()
      .single();
    if (error) return toast(error.message, 'error');
    setSensors((list) => [...list, data]);
  }

  async function removeSensor(sensor) {
    const { error } = await supabase.from('sensors').delete().eq('id', sensor.id);
    if (error) return toast(error.message, 'error');
    setSensors((list) => list.filter((s) => s.id !== sensor.id));
  }

  async function rename() {
    const n = nome.trim();
    if (!n) return;
    const { error } = await supabase.from('devices').update({ nome: n }).eq('id', device.id);
    if (error) return toast(error.message, 'error');
    setDevices((list) => list.map((d) => (d.id === device.id ? { ...d, nome: n } : d)));
    setRenaming(false);
  }

  async function regenerate() {
    setBusy(true);
    const key = generateDeviceKey();
    const { error } = await supabase.from('devices').update({ api_key_hash: await sha256Hex(key) }).eq('id', device.id);
    setBusy(false);
    setConfirm(null);
    if (error) return toast(error.message, 'error');
    onKey({ deviceId: device.device_id, key });
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from('devices').delete().eq('id', device.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    setConfirm(null);
    onDeleted(device.id);
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', online ? 'bg-leaf-500/15 text-leaf-400' : 'bg-ink-800 text-ink-400')}>
            <Cpu className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            {renaming ? (
              <form onSubmit={(e) => (e.preventDefault(), rename())} className="flex gap-2">
                <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoFocus className="h-8 rounded-md border border-ink-600 bg-ink-900 px-2 text-sm" />
                <Button size="sm" type="submit">Salvar</Button>
              </form>
            ) : (
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-100">
                {device.nome}
                <button onClick={() => setRenaming(true)} className="text-ink-500 hover:text-ink-100" aria-label="Renomear">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </h3>
            )}
            <p className="font-mono text-xs text-ink-400">ID: {device.device_id}</p>
          </div>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2 text-xs">
          <p className="flex items-center gap-2 font-semibold">
            <StatusDot online={online} /> {online ? <span className="text-leaf-300">🟢 Online</span> : <span className="text-danger-400">🔴 Offline</span>}
          </p>
          <p className="mt-1 text-ink-400">
            Última atualização: <span className="tabular text-ink-200">{fmtTime(device.last_seen)}</span> ({timeAgo(device.last_seen, now)})
          </p>
          {device.firmware && <p className="text-ink-500">Firmware: {device.firmware}</p>}
        </div>
      </div>

      {!online && (
        <p className="mt-3 text-xs text-ink-400">
          {device.last_seen ? 'Não recebemos dados do dispositivo recentemente. Verifique a alimentação e o Wi-Fi do ESP32.' : 'Aguardando o primeiro envio do ESP32. Confira DEVICE_ID, DEVICE_KEY e API_URL no firmware.'}
        </p>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-200">Sensores → Cômodos</p>
          <Button size="sm" variant="ghost" onClick={addSensor}>
            <Plus className="h-3.5 w-3.5" /> Canal
          </Button>
        </div>
        {mySensors.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhum sensor. Eles também são criados automaticamente quando o ESP32 envia um canal novo.</p>
        ) : (
          <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">
            {mySensors.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span className="w-24 font-mono text-sm text-ink-200">Sensor {String(s.canal).padStart(2, '0')}</span>
                <span className="text-ink-500">→</span>
                <select
                  value={s.room_id || ''}
                  onChange={(e) => mapSensor(s, e.target.value)}
                  className={cx('h-9 min-w-[10rem] flex-1 rounded-lg border bg-ink-900 px-3 pr-8 text-sm', s.room_id ? 'border-ink-600 text-ink-100' : 'border-amp-500/50 text-amp-300')}
                  aria-label={`Cômodo do sensor ${s.canal}`}
                >
                  <option value="">— Sem cômodo —</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
                <button onClick={() => removeSensor(s)} className="rounded-lg p-1.5 text-ink-500 hover:bg-danger-500/10 hover:text-danger-400" aria-label={`Remover sensor ${s.canal}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-700 pt-4">
        <Button size="sm" variant="secondary" onClick={() => setConfirm('key')}>
          <KeyRound className="h-3.5 w-3.5" /> Gerar nova chave
        </Button>
        <Button size="sm" variant="danger" onClick={() => setConfirm('delete')}>
          <Trash2 className="h-3.5 w-3.5" /> Excluir dispositivo
        </Button>
      </div>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm === 'key' ? 'Gerar nova chave' : 'Excluir dispositivo'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button variant={confirm === 'key' ? 'primary' : 'danger'} loading={busy} onClick={confirm === 'key' ? regenerate : remove}>
              {confirm === 'key' ? 'Gerar' : 'Excluir'}
            </Button>
          </>
        }
      >
        <p className="flex gap-2 text-sm text-ink-300">
          <TriangleAlert className="h-5 w-5 shrink-0 text-amp-400" />
          {confirm === 'key'
            ? 'A chave atual deixará de funcionar imediatamente. Você precisará atualizar o firmware do ESP32 com a nova chave.'
            : 'O dispositivo, seus sensores e TODO o histórico de leituras dele serão apagados. Esta ação não pode ser desfeita.'}
        </p>
      </Modal>
    </Card>
  );
}

export default function Devices() {
  const { devices, setDevices, setSensors, live, isDemo } = useHome();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.get('novo') === '1');
  const [keyInfo, setKeyInfo] = useState(null);

  useEffect(() => {
    if (params.get('novo')) setParams({}, { replace: true });
  }, [params, setParams]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispositivos"
        subtitle="Cadastre o ESP32, vincule cada sensor a um cômodo e acompanhe a conexão."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo dispositivo
          </Button>
        }
      />

      {devices.length === 0 ? (
        <EmptyState icon={Cpu} title="Nenhum ESP32 cadastrado" action={<Button onClick={() => setCreating(true)}>Cadastrar ESP32</Button>}>
          Ao cadastrar você recebe o ID e a chave secreta para colocar no firmware. Enquanto isso, o painel usa o modo demonstração.
        </EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              onKey={setKeyInfo}
              onDeleted={(id) => {
                setDevices((l) => l.filter((x) => x.id !== id));
                setSensors((l) => l.filter((s) => s.device_id !== id));
              }}
            />
          ))}
        </div>
      )}

      <Card>
        <h2 className="font-display font-semibold text-ink-100">Como o ESP32 envia os dados</h2>
        <p className="mt-1 text-sm text-ink-400">
          A cada poucos segundos o firmware faz um <code className="text-volt-300">POST</code> para a API com a chave no header <code className="text-volt-300">X-Device-Key</code>.
          O servidor valida o dispositivo, calcula os kWh e o painel atualiza sozinho.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium text-ink-400">Endpoint</p>
              <CopyButton text={API_URL} />
            </div>
            <code className="block break-all rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-ink-100">POST {API_URL}</code>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-leaf-300">{`{
  "deviceId": "ESP32-001",
  "timestamp": "2026-09-26T14:00:00Z",
  "readings": [
    { "sensor": 1, "power": 350.5, "voltage": 127, "current": 2.76 },
    { "sensor": 2, "power": 780.0, "voltage": 127, "current": 6.14 }
  ]
}`}</pre>
        </div>
        {!isDemo && live.unmappedPower > 0 && (
          <Alert type="info" className="mt-3">
            Há {fmtPower(live.unmappedPower)} chegando de sensores sem cômodo. Vincule-os acima para aparecerem no dashboard.
          </Alert>
        )}
      </Card>

      <NewDeviceModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(dev, sens, key) => {
          setDevices((l) => [...l, dev]);
          setSensors((l) => [...l, ...sens]);
          setCreating(false);
          setKeyInfo({ deviceId: dev.device_id, key });
        }}
      />
      <KeyModal info={keyInfo} onClose={() => setKeyInfo(null)} />
    </div>
  );
}
