import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { Alert, Button, Input } from '../../components/ui.jsx';
import { authErrorMessage, supabase } from '../../lib/supabase.js';
import AuthShell, { CodeInput, isEmail } from './AuthShell.jsx';

const RESEND_SECONDS = 60;

export default function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(params.get('email') ? RESEND_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function verify(e) {
    e.preventDefault();
    if (!isEmail(email)) return setError('Informe o e-mail cadastrado.');
    if (code.length < 6) return setError('Digite o código de 6 dígitos.');
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
    if (err) {
      setLoading(false);
      return setError(authErrorMessage(err));
    }
    // Conta verificada → encerra a sessão automática e leva para o login
    await supabase.auth.signOut();
    setLoading(false);
    setVerified(true);
  }

  async function resend() {
    if (!isEmail(email)) return setError('Informe o e-mail cadastrado.');
    setError('');
    setInfo('');
    const { error: err } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    if (err) return setError(authErrorMessage(err));
    setInfo('Enviamos um novo código para o seu e-mail.');
    setCooldown(RESEND_SECONDS);
  }

  if (verified) {
    return (
      <AuthShell title="Conta verificada com sucesso!">
        <div className="space-y-5 text-center">
          <CircleCheck className="mx-auto h-16 w-16 text-leaf-400" />
          <p className="text-sm text-ink-300">Seu e-mail foi confirmado. Agora é só fazer login para configurar sua residência.</p>
          <Button className="w-full" size="lg" onClick={() => navigate(`/entrar?email=${encodeURIComponent(email)}`)}>
            Fazer login
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Confirme seu e-mail"
      subtitle={email ? `Enviamos um código de verificação para ${email}.` : 'Digite o código que enviamos para o seu e-mail.'}
      footer={
        <Link to="/entrar" className="font-semibold text-volt-400 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <form onSubmit={verify} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        {info && <Alert type="success">{info}</Alert>}
        {!params.get('email') && <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
        <CodeInput value={code} onChange={setCode} autoFocus={Boolean(params.get('email'))} />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Confirmar código
        </Button>
        <p className="text-center text-sm text-ink-400">
          Não recebeu?{' '}
          {cooldown > 0 ? (
            <span>Reenviar em {cooldown}s</span>
          ) : (
            <button type="button" onClick={resend} className="font-semibold text-volt-400 hover:underline">
              Reenviar código
            </button>
          )}
        </p>
      </form>
    </AuthShell>
  );
}
