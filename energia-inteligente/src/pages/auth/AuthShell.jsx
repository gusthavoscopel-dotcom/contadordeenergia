import { Logo } from '../../components/Brand.jsx';
import { Field } from '../../components/ui.jsx';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950 bg-grid px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md animate-fadeUp rounded-2xl border border-ink-700 bg-ink-850/90 p-6 shadow-2xl sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-100">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
      {footer && <div className="pb-4 text-center text-sm text-ink-400">{footer}</div>}
    </div>
  );
}

/** Campo do código de verificação recebido por e-mail */
export function CodeInput({ value, onChange, label = 'Código de verificação', autoFocus = true }) {
  return (
    <Field label={label} htmlFor="otp" hint="Confira também a caixa de spam.">
      <input
        id="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={10}
        placeholder="000000"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        className="h-14 w-full rounded-lg border border-ink-600 bg-ink-900 text-center font-mono text-2xl tracking-[0.5em] text-volt-300 placeholder:text-ink-600 focus:border-volt-500 focus:outline-none focus:ring-2 focus:ring-volt-500/25"
      />
    </Field>
  );
}

export function validatePassword(pw) {
  if (pw.length < 8) return 'Use pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use letras e números.';
  return null;
}

export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
