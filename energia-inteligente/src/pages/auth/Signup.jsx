import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, PasswordInput } from '../../components/ui.jsx';
import { authErrorMessage, supabase } from '../../lib/supabase.js';
import AuthShell, { isEmail, validatePassword } from './AuthShell.jsx';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (form.nome.trim().length < 2) errs.nome = 'Informe seu nome.';
    if (!isEmail(form.email)) errs.email = 'E-mail inválido.';
    const pw = validatePassword(form.password);
    if (pw) errs.password = pw;
    if (form.confirm !== form.password) errs.confirm = 'As senhas não coincidem.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setError('');
    const email = form.email.trim().toLowerCase();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: { data: { nome: form.nome.trim() } },
    });
    setLoading(false);
    if (err) return setError(authErrorMessage(err));
    // O Supabase devolve um usuário "vazio" quando o e-mail já existe (para não expor contas)
    if (data.user && data.user.identities?.length === 0) {
      return setError('Este e-mail já está cadastrado. Faça login ou recupere sua senha.');
    }
    navigate(`/verificar?email=${encodeURIComponent(email)}`, { replace: true });
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Você vai receber um código de verificação no seu e-mail."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-semibold text-volt-400 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert type="error">{error}</Alert>}
        <Input label="Nome" autoComplete="name" value={form.nome} onChange={set('nome')} error={errors.nome} maxLength={80} />
        <Input label="E-mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <PasswordInput label="Senha" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="Mínimo de 8 caracteres, com letras e números." />
        <PasswordInput label="Confirmação de senha" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
