// Cliente do Supabase usado no navegador.
// Usa apenas a ANON KEY (pública). Toda proteção de dados é feita pelo RLS
// no banco — sem login, ou com o login de outra pessoa, nada é retornado.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// "Lembrar de mim": com a opção marcada a sessão fica no localStorage
// (sobrevive ao fechar o navegador); desmarcada, fica no sessionStorage
// (some ao fechar a aba).
const REMEMBER_KEY = 'ei:remember';

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function setRememberMe(value) {
  safe(() => localStorage.setItem(REMEMBER_KEY, value ? '1' : '0'));
}

function remember() {
  return safe(() => localStorage.getItem(REMEMBER_KEY), '1') !== '0';
}

const memory = new Map();
const authStorage = {
  getItem: (key) =>
    safe(() => localStorage.getItem(key)) ?? safe(() => sessionStorage.getItem(key)) ?? memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
    if (remember()) {
      safe(() => localStorage.setItem(key, value));
      safe(() => sessionStorage.removeItem(key));
    } else {
      safe(() => sessionStorage.setItem(key, value));
      safe(() => localStorage.removeItem(key));
    }
  },
  removeItem: (key) => {
    memory.delete(key);
    safe(() => localStorage.removeItem(key));
    safe(() => sessionStorage.removeItem(key));
  },
};

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'public-anon-key', {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 20 } },
});

/** Traduz as mensagens de erro mais comuns do Supabase Auth. */
export function authErrorMessage(error) {
  const msg = (error?.message || '').toLowerCase();
  const code = error?.code || '';
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'Seu e-mail ainda não foi confirmado.';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'Este e-mail já está cadastrado.';
  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('invalid otp') || msg.includes('token has expired'))
    return 'Código inválido ou expirado. Solicite um novo código.';
  if (code === 'weak_password' || msg.includes('password should')) return 'Senha fraca: use pelo menos 8 caracteres, com letras e números.';
  if (code === 'same_password' || msg.includes('different from the old')) return 'A nova senha deve ser diferente da atual.';
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit') || msg.includes('security purposes'))
    return 'Muitas tentativas. Aguarde um minuto e tente novamente.';
  if (code === 'email_address_invalid' || msg.includes('invalid format') || msg.includes('is invalid')) return 'E-mail inválido.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet.';
  return error?.message || 'Ocorreu um erro. Tente novamente.';
}
