// Assistente de configuração (primeiro login): residência → cômodos → tarifa → ESP32
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, Cpu, FlaskConical, Plus, X } from 'lucide-react';
import { Logo } from '../../components/Brand.jsx';
import { Alert, Button, Input, cx } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useHome } from '../../context/HomeContext.jsx';
import { supabase } from '../../lib/supabase.js';
import { ROOM_PRESETS, roomIcon } from '../../lib/rooms.js';
import { fmtMoney, parseDecimal } from '../../lib/format.js';

const STEPS = ['Residência', 'Cômodos', 'Tarifa', 'Dispositivo'];

export default function Onboarding() {
  const { profile } = useAuth();
  const { residence, loading, reload } = useHome();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState('Minha Casa');
  const [rooms, setRooms] = useState(['Sala', 'Quarto 1', 'Cozinha', 'Banheiro']);
  const [custom, setCustom] = useState('');
  const [tarifa, setTarifa] = useState('0,95');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);

  if (!loading && residence && !finished) return <Navigate to="/app" replace />;

  const toggle = (r) => setRooms((list) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]));
  const addCustom = () => {
    const v = custom.trim().slice(0, 40);
    if (!v) return;
    if (rooms.some((r) => r.toLowerCase() === v.toLowerCase())) return setError('Esse cômodo já está na lista.');
    setRooms((l) => [...l, v]);
    setCustom('');
    setError('');
  };
  const tarifaNum = parseDecimal(tarifa);

  function next() {
    setError('');
    if (step === 0 && !nome.trim()) return setError('Dê um nome para a residência.');
    if (step === 1 && rooms.length === 0) return setError('Adicione pelo menos um cômodo.');
    if (step === 2) return save();
    setStep((s) => s + 1);
  }

  async function save() {
    if (!(tarifaNum >= 0) || tarifaNum >= 100) return setError('Informe uma tarifa válida, por exemplo 0,95.');
    setSaving(true);
    const { data: res, error: e1 } = await supabase
      .from('residences')
      .insert({ nome: nome.trim(), tarifa_kwh: tarifaNum })
      .select()
      .single();
    if (e1) {
      setSaving(false);
      return setError(e1.message);
    }
    const { error: e2 } = await supabase
      .from('rooms')
      // created_at escalonado mantém a ordem escolhida (Sensor 01 → 1º cômodo…)
      .insert(rooms.map((r, i) => ({ residence_id: res.id, nome: r, created_at: new Date(Date.now() + i * 1000).toISOString() })));
    setSaving(false);
    if (e2) return setError(e2.message);
    setFinished(true);
    await reload();
    setStep(3);
  }

  const allPresets = [...new Set([...ROOM_PRESETS, ...rooms])];

  return (
    <div className="min-h-screen bg-ink-950 bg-grid px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Logo compact={false} to="/" />
        <div className="mt-8">
          <p className="text-sm text-ink-400">Olá{profile?.nome ? `, ${profile.nome.split(' ')[0]}` : ''}! Vamos deixar tudo pronto.</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Configure sua residência</h1>
        </div>

        <ol className="mt-6 grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="space-y-1.5">
              <div className={cx('h-1.5 rounded-full', i <= step ? 'bg-volt-500' : 'bg-ink-700')} />
              <p className={cx('text-xs font-medium', i === step ? 'text-volt-300' : 'text-ink-500')}>{s}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 animate-fadeUp rounded-2xl border border-ink-700 bg-ink-850/90 p-5 sm:p-7" key={step}>
          {error && <Alert type="error" className="mb-4">{error}</Alert>}

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold">Como quer chamar sua residência?</h2>
              <Input label="Nome da residência" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Quais cômodos serão monitorados?</h2>
                <p className="text-sm text-ink-400">Cada cômodo terá um sensor/circuito correspondente. Você pode editar depois.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {allPresets.map((r) => {
                  const Icon = roomIcon(r);
                  const on = rooms.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggle(r)}
                      className={cx(
                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition',
                        on ? 'border-volt-500/60 bg-volt-500/10 text-volt-300' : 'border-ink-600 text-ink-300 hover:border-ink-500',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {r}
                      {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Outro cômodo (ex.: Varanda)"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                    maxLength={40}
                  />
                </div>
                <Button variant="secondary" type="button" onClick={addCustom} className="h-11">
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
              <p className="text-xs text-ink-400">{rooms.length} cômodo(s) selecionado(s)</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Qual o valor da tarifa de energia?</h2>
                <p className="text-sm text-ink-400">
                  Veja na sua conta de luz o valor por kWh (com impostos). Ele varia por região, concessionária e bandeira — você pode alterar quando quiser.
                </p>
              </div>
              <Input label="Valor da tarifa" prefix="R$" suffix="/ kWh" inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} className="font-mono text-lg" autoFocus />
              {tarifaNum > 0 && (
                <p className="rounded-lg bg-ink-900 px-3 py-2 text-sm text-ink-300">
                  Exemplo: um aparelho de 500 W ligado por 2 h consome 1 kWh → custo de <strong className="text-amp-300">{fmtMoney(tarifaNum)}</strong>.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-lg font-semibold">Tudo pronto! Agora, o ESP32.</h2>
                <p className="text-sm text-ink-400">
                  Cadastre seu ESP32 para receber uma chave de acesso e vincular cada sensor a um cômodo. Se o hardware ainda não estiver pronto, o painel funciona em modo demonstração com dados simulados.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => navigate('/app/dispositivos?novo=1')} className="rounded-xl border border-volt-500/50 bg-volt-500/10 p-4 text-left transition hover:bg-volt-500/15">
                  <Cpu className="h-6 w-6 text-volt-400" />
                  <p className="mt-2 font-semibold text-ink-100">Cadastrar ESP32 agora</p>
                  <p className="text-xs text-ink-400">Gera o ID e a chave para o firmware.</p>
                </button>
                <button onClick={() => navigate('/app')} className="rounded-xl border border-ink-600 p-4 text-left transition hover:bg-ink-800">
                  <FlaskConical className="h-6 w-6 text-amp-400" />
                  <p className="mt-2 font-semibold text-ink-100">Ver o painel em demonstração</p>
                  <p className="text-xs text-ink-400">Dados simulados, claramente sinalizados.</p>
                </button>
              </div>
            </div>
          )}

          {step < 3 && (
            <div className="mt-6 flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                Voltar
              </Button>
              <Button onClick={next} loading={saving}>
                {step === 2 ? 'Concluir configuração' : 'Continuar'}
              </Button>
            </div>
          )}
        </div>
        {step === 1 && rooms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {rooms.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-1 text-xs text-ink-300">
                {r}
                <button onClick={() => toggle(r)} aria-label={`Remover ${r}`} className="hover:text-danger-400">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
