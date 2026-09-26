import { useState } from 'react';
import { DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader } from '../../components/ui.jsx';
import { useHome } from '../../context/HomeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { supabase } from '../../lib/supabase.js';
import { roomColor, roomIcon } from '../../lib/rooms.js';
import { costOf } from '../../lib/energy.js';
import { fmtEnergy, fmtMoney, fmtPower, parseDecimal } from '../../lib/format.js';

function RoomForm({ initial, onSubmit, onCancel, saving, defaultLimit }) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [limit, setLimit] = useState(initial?.power_limit_w ? String(initial.power_limit_w).replace('.', ',') : '');
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    const n = nome.trim();
    if (!n) return setError('Informe o nome do cômodo.');
    let l = null;
    if (limit.trim()) {
      l = parseDecimal(limit);
      if (!(l > 0)) return setError('Limite de potência inválido.');
    }
    onSubmit({ nome: n, power_limit_w: l });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Nome do cômodo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoFocus error={error && !nome.trim() ? error : ''} />
      <Input
        label="Limite de potência (opcional)"
        suffix="W"
        inputMode="decimal"
        placeholder={`Padrão da residência: ${defaultLimit} W`}
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        hint="Acima desse valor é gerado um alerta de potência elevada."
        error={error && nome.trim() ? error : ''}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

export default function Rooms() {
  const { residence, rooms, setRooms, sensors, devices, live, tariff, isDemo } = useHome();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | room
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save(values) {
    setSaving(true);
    const isNew = editing === 'new';
    const query = isNew
      ? supabase.from('rooms').insert({ ...values, residence_id: residence.id }).select().single()
      : supabase.from('rooms').update(values).eq('id', editing.id).select().single();
    const { data, error } = await query;
    setSaving(false);
    if (error) return toast(error.code === '23505' ? 'Já existe um cômodo com esse nome.' : error.message, 'error');
    setRooms((list) => (isNew ? [...list, data] : list.map((r) => (r.id === data.id ? data : r))));
    toast(isNew ? 'Cômodo adicionado.' : 'Cômodo atualizado.', 'success');
    setEditing(null);
  }

  async function remove() {
    setSaving(true);
    const { error } = await supabase.from('rooms').delete().eq('id', deleting.id);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    setRooms((list) => list.filter((r) => r.id !== deleting.id));
    toast('Cômodo excluído.', 'success');
    setDeleting(null);
  }

  const sensorsOf = (roomId) => sensors.filter((s) => s.room_id === roomId);
  const deviceName = (id) => devices.find((d) => d.id === id)?.device_id || '?';

  return (
    <div>
      <PageHeader
        title="Cômodos"
        subtitle="Cadastre os cômodos/circuitos monitorados e vincule um sensor a cada um na página Dispositivos."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Novo cômodo
          </Button>
        }
      />

      {rooms.length === 0 ? (
        <EmptyState icon={DoorOpen} title="Nenhum cômodo ainda" action={<Button onClick={() => setEditing('new')}>Adicionar cômodo</Button>}>
          Adicione Sala, Cozinha, Quartos… cada um poderá ter um sensor do ESP32.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room, i) => {
            const Icon = roomIcon(room.nome);
            const color = roomColor(i);
            const linked = sensorsOf(room.id);
            const power = live.roomPower[room.id];
            const today = live.todayByRoom[room.id] || 0;
            return (
              <Card key={room.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display font-semibold text-ink-100">{room.nome}</h3>
                      <p className="text-xs text-ink-400">
                        Limite: {room.power_limit_w ? `${fmtPower(room.power_limit_w)}` : `${fmtPower(residence.power_limit_w)} (padrão)`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(room)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label={`Editar ${room.nome}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleting(room)} className="rounded-lg p-2 text-ink-400 hover:bg-danger-500/10 hover:text-danger-400" aria-label={`Excluir ${room.nome}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-ink-900/70 p-3 text-xs">
                  <div>
                    <dt className="text-ink-500">Agora</dt>
                    <dd className="font-semibold tabular text-ink-100">{power == null ? '—' : fmtPower(power)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Hoje</dt>
                    <dd className="font-semibold tabular text-ink-100">{fmtEnergy(today)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Custo</dt>
                    <dd className="font-semibold tabular text-amp-300">{fmtMoney(costOf(today, tariff))}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-ink-400">
                  {isDemo && linked.length === 0 ? (
                    <span className="text-amp-300">Valores simulados (modo demonstração)</span>
                  ) : linked.length ? (
                    <>Sensor: {linked.map((s) => `${deviceName(s.device_id)} · canal ${s.canal}`).join(', ')}</>
                  ) : (
                    <span className="text-ink-500">Nenhum sensor vinculado</span>
                  )}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo cômodo' : 'Editar cômodo'} size="sm">
        {editing && (
          <RoomForm
            initial={editing === 'new' ? null : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            saving={saving}
            defaultLimit={residence.power_limit_w}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Excluir cômodo"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} loading={saving}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-300">
          Excluir <strong className="text-ink-100">{deleting?.nome}</strong>? Os sensores vinculados ficarão sem cômodo e o histórico desse cômodo deixará de aparecer separado.
        </p>
      </Modal>
    </div>
  );
}
