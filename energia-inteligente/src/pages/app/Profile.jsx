import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail, Trash2, User } from 'lucide-react';
import { Alert, Button, Card, CardTitle, Input, Modal, PageHeader, PasswordInput } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useHome } from '../../context/HomeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { authErrorMessage, supabase } from '../../lib/supabase.js';
import { fmtDate } from '../../lib/format.js';
import { CodeInput, isEmail, validatePassword } from '../auth/AuthShell.jsx';

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink-100">{value}</dd>
    </div>
  );
}

export default function Profile() {
  const { user, profile, reloadProfile, signOut } = useAuth();
  const { residence } = useHome();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // 'name' | 'password' | 'email' | 'delete'
  const close = () => setModal(null);

  return (
    <div className="space-y-5">
      <PageHeader title="Meu perfil" />
      <Card>
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-volt-500/15 font-display text-2xl font-bold text-volt-300">
            {(profile?.nome || user.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-display text-xl font-semibold">{profile?.nome}</p>
            <p className="text-sm text-ink-400">{user.email}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Nome" value={profile?.nome || '—'} />
          <Info label="E-mail" value={user.email} />
          <Info label="Residência" value={residence?.nome} />
          <Info label="Data de cadastro" value={fmtDate(profile?.created_at || user.created_at, { day: '2-digit', month: '2-digit', year: 'numeric' })} />
        </dl>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: 'name', icon: User, label: 'Alterar nome' },
          { key: 'password', icon: KeyRound, label: 'Alterar senha' },
          { key: 'email', icon: Mail, label: 'Alterar e-mail' },
          { key: 'delete', icon: Trash2, label: 'Excluir conta', danger: true },
        ].map(({ key, icon: Icon, label, danger }) => (
          <button
            key={key}
            onClick={() => setModal(key)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold transition ${
              danger ? 'border-danger-500/30 text-danger-400 hover:bg-danger-500/10' : 'border-ink-700 bg-ink-850/80 text-ink-100 hover:border-ink-500'
            }`}
          >
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </div>

      <NameModal open={modal === 'name'} onClose={close} current={profile?.nome} onSaved={() => (reloadProfile(), toast('Nome atualizado.', 'success'), close())} userId={user.id} />
      <PasswordModal open={modal === 'password'} onClose={close} email={user.email} onSaved={() => (toast('Senha alterada.', 'success'), close())} />
      <EmailModal open={modal === 'email'} onClose={close} onSaved={() => (reloadProfile(), toast('E-mail alterado.', 'success'), close())} />
      <DeleteModal
        open={modal === 'delete'}
        onClose={close}
        onDeleted={async () => {
          await signOut();
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
}

function NameModal({ open, onClose, current, onSaved, userId }) {
  const [nome, setNome] = useState(current || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (nome.trim().length < 2) return setError('Informe seu nome.');
    setLoading(true);
    const { error: err } = await supabase.from('profiles').update({ nome: nome.trim() }).eq('id', userId);
    if (!err) await supabase.auth.updateUser({ data: { nome: nome.trim() } });
    setLoading(false);
    if (err) return setError(err.message);
    onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title="Alterar nome" size="sm">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus />
        <Button type="submit" className="w-full" loading={loading}>Salvar</Button>
      </form>
    </Modal>
  );
}

function PasswordModal({ open, onClose, email, onSaved }) {
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    const v = validatePassword(pw);
    if (v) return setError(v);
    if (pw !== confirm) return setError('As senhas não coincidem.');
    setLoading(true);
    setError('');
    // Confirma a senha atual antes de trocar
    const { error: e1 } = await supabase.auth.signInWithPassword({ email, password: current });
    if (e1) {
      setLoading(false);
      return setError('Senha atual incorreta.');
    }
    const { error: e2 } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (e2) return setError(authErrorMessage(e2));
    setCurrent('');
    setPw('');
    setConfirm('');
    onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title="Alterar senha" size="sm">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        <PasswordInput label="Senha atual" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordInput label="Nova senha" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="Mínimo de 8 caracteres, com letras e números." />
        <PasswordInput label="Confirmar nova senha" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" className="w-full" loading={loading}>Alterar senha</Button>
      </form>
    </Modal>
  );
}

function EmailModal({ open, onClose, onSaved }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function request(e) {
    e.preventDefault();
    if (!isEmail(email)) return setError('E-mail inválido.');
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
    setLoading(false);
    if (err) return setError(authErrorMessage(err));
    setStep(2);
  }
  async function confirmCode(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email_change' });
    setLoading(false);
    if (err) return setError(authErrorMessage(err));
    setStep(1);
    setCode('');
    setEmail('');
    onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title="Alterar e-mail" size="sm">
      {step === 1 ? (
        <form onSubmit={request} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <Input label="Novo e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <p className="text-xs text-ink-400">Enviaremos um código de confirmação para o novo endereço.</p>
          <Button type="submit" className="w-full" loading={loading}>Enviar código</Button>
        </form>
      ) : (
        <form onSubmit={confirmCode} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <p className="text-sm text-ink-300">Digite o código enviado para <strong>{email}</strong>.</p>
          <CodeInput value={code} onChange={setCode} />
          <Button type="submit" className="w-full" loading={loading}>Confirmar</Button>
        </form>
      )}
    </Modal>
  );
}

function DeleteModal({ open, onClose, onDeleted }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ confirm: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Não foi possível excluir a conta.');
      await onDeleted();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Excluir conta" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Alert type="error">
          Isso apaga permanentemente sua conta, residência, cômodos, dispositivos, histórico e alertas. Não é possível desfazer.
        </Alert>
        {error && <Alert type="error">{error}</Alert>}
        <Input label='Digite "EXCLUIR" para confirmar' value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        <Button type="submit" variant="danger" className="w-full" disabled={text !== 'EXCLUIR'} loading={loading}>
          Excluir minha conta
        </Button>
      </form>
    </Modal>
  );
}
