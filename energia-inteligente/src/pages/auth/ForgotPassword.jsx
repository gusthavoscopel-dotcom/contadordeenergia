import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, PasswordInput } from '../../components/ui.jsx';
import { authErrorMessage, supabase } from '../../lib/supabase.js';
import AuthShell, { CodeInput, isEmail, validatePassword } from './AuthShell.jsx';

// Recuperação em 2 passos: (1) e-mail → código; (2) código + nova senha
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function sendCode(e) {
    e.preventDefault();
    if (!isEmail(email)) return setError('Informe um e-mail válido.');
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setLoading(false);
    if (err) return setError(authErrorMessage(err));
    setStep(2);
  }

  async function reset(e) {
    e.preventDefault();
    if (code.length < 6) return setError('Digite o código recebido.');
    const pw = validatePassword(password);
    if (pw) return setError(pw);
    if (password !== confirm) return setError('As senhas não coincidem.');
    setLoading(true);
    setError('');
    const { error: otpErr } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'recovery' });
    if (otpErr) {
      setLoading(false);
      return setError(authErrorMessage(otpErr));
    }
    const { error: upErr } = await supabase.auth.updateUser({ password });
    await supabase.auth.signOut();
    setLoading(false);
    if (upErr) return setError(authErrorMessage(upErr));
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell title="Senha alterada!" subtitle="Use a nova senha para entrar.">
        <Button className="w-full" size="lg" onClick={() => navigate(`/entrar?email=${encodeURIComponent(email)}`)}>
          Ir para o login
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle={step === 1 ? 'Enviaremos um código para o seu e-mail.' : `Digite o código enviado para ${email} e escolha uma nova senha.`}
      footer={
        <Link to="/entrar" className="font-semibold text-volt-400 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {step === 1 ? (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          {error && <Alert type="error">{error}</Alert>}
          <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Enviar código
          </Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4" noValidate>
          {error && <Alert type="error">{error}</Alert>}
          <CodeInput value={code} onChange={setCode} />
          <PasswordInput label="Nova senha" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo de 8 caracteres, com letras e números." />
          <PasswordInput label="Confirmar nova senha" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Salvar nova senha
          </Button>
          <button type="button" onClick={() => setStep(1)} className="w-full text-center text-sm text-ink-400 hover:text-ink-100">
            Usar outro e-mail / reenviar código
          </button>
        </form>
      )}
    </AuthShell>
  );
}
