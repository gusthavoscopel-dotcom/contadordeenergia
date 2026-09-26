import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Input, PasswordInput } from '../../components/ui.jsx';
import { authErrorMessage, setRememberMe, supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import AuthShell, { isEmail } from './AuthShell.jsx';

export default function Login() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to={location.state?.from || '/app'} replace />;

  async function submit(e) {
    e.preventDefault();
    if (!isEmail(email) || !password) return setError('Informe e-mail e senha.');
    setLoading(true);
    setError('');
    setUnconfirmed(false);
    setRememberMe(remember);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (err) {
      if (err.code === 'email_not_confirmed' || /not confirmed/i.test(err.message)) setUnconfirmed(true);
      return setError(authErrorMessage(err));
    }
    navigate(location.state?.from || '/app', { replace: true });
  }

  async function goVerify() {
    await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    navigate(`/verificar?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse o painel de monitoramento da sua residência."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-volt-400 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <Alert type="error">
            {error}{' '}
            {unconfirmed && (
              <button type="button" onClick={goVerify} className="font-semibold underline">
                Enviar código de verificação
              </button>
            )}
          </Alert>
        )}
        <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordInput label="Senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-ink-300">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-volt-500" />
            Lembrar de mim
          </label>
          <Link to="/recuperar-senha" className="font-semibold text-volt-400 hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
