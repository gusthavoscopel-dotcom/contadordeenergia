// Componentes básicos de interface
import { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const BTN = {
  primary: 'bg-volt-500 text-ink-950 hover:bg-volt-400 shadow-glow',
  secondary: 'bg-ink-800 text-ink-100 hover:bg-ink-700 border border-ink-600',
  ghost: 'text-ink-200 hover:bg-ink-800 hover:text-ink-100',
  danger: 'bg-danger-500/10 text-danger-400 border border-danger-500/40 hover:bg-danger-500/20',
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }) {
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/70 disabled:cursor-not-allowed disabled:opacity-50',
        BTN[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-200">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger-400">{error}</p> : hint ? <p className="text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

const INPUT =
  'h-11 w-full rounded-lg border border-ink-600 bg-ink-900 px-3.5 text-sm text-ink-100 placeholder:text-ink-500 transition focus:border-volt-500 focus:outline-none focus:ring-2 focus:ring-volt-500/25 disabled:opacity-60';

export function Input({ label, hint, error, className, id, prefix, suffix, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  const input = (
    <input
      id={inputId}
      className={cx(INPUT, prefix && 'pl-10', suffix && 'pr-16', error && 'border-danger-500', className)}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      {prefix || suffix ? (
        <div className="relative">
          {prefix && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-ink-400">{prefix}</span>}
          {input}
          {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-400">{suffix}</span>}
        </div>
      ) : (
        input
      )}
    </Field>
  );
}

export function PasswordInput({ label = 'Senha', ...props }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <Field label={label} hint={props.hint} error={props.error} htmlFor={id}>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} className={cx(INPUT, 'pr-11', props.error && 'border-danger-500')} {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 hover:text-ink-100"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

export function Select({ label, hint, children, className, id, ...props }) {
  const autoId = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id || autoId}>
      <select id={id || autoId} className={cx(INPUT, 'appearance-none bg-[length:16px] pr-9', className)} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cx('flex cursor-pointer items-start justify-between gap-4 py-2', disabled && 'opacity-60')}>
      <span>
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {description && <span className="block text-xs text-ink-400">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-ink-700 transition peer-checked:bg-volt-500 peer-focus-visible:ring-2 peer-focus-visible:ring-volt-400/60" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-ink-100 transition peer-checked:translate-x-5 peer-checked:bg-ink-950" />
      </span>
    </label>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-2xl border border-ink-700 bg-ink-850/80 p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ icon: Icon, children, action, subtitle }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink-100">
          {Icon && <Icon className="h-4 w-4 text-volt-400" />}
          {children}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-100 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Selo que diferencia dado MEDIDO, CALCULADO e ESTIMADO */
const KIND = {
  medido: { label: 'Medido', cls: 'bg-leaf-500/10 text-leaf-300 ring-leaf-500/30', title: 'Valor recebido diretamente do sensor' },
  calculado: { label: 'Calculado', cls: 'bg-sky-500/10 text-sky-300 ring-sky-500/30', title: 'Calculado pelo sistema a partir das medições' },
  estimado: { label: 'Estimado', cls: 'bg-amp-500/10 text-amp-300 ring-amp-500/30', title: 'Projeção — não é o valor oficial da conta' },
  simulado: { label: 'Simulado', cls: 'bg-amp-500/15 text-amp-300 ring-amp-500/40', title: 'Dado do modo demonstração' },
};

export function DataKind({ kind, demo }) {
  const k = KIND[demo ? 'simulado' : kind];
  return (
    <span title={k.title} className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset', k.cls)}>
      {k.label}
    </span>
  );
}

export function StatusDot({ online, className }) {
  return (
    <span className={cx('relative inline-flex h-2.5 w-2.5', className)}>
      {online && <span className="absolute inset-0 animate-ping rounded-full bg-leaf-400 opacity-60" />}
      <span className={cx('relative inline-flex h-2.5 w-2.5 rounded-full', online ? 'bg-leaf-400' : 'bg-danger-500')} />
    </span>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-volt-400', className)} />;
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 rounded-xl bg-ink-800 p-3">
          <Icon className="h-6 w-6 text-volt-400" />
        </div>
      )}
      <p className="font-display font-semibold text-ink-100">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-ink-400">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('flex max-h-[92vh] w-full animate-fadeUp flex-col rounded-t-2xl border border-ink-700 bg-ink-850 shadow-2xl sm:rounded-2xl', widths[size])}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-100">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-700 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Alert({ type = 'info', children, className }) {
  const cls = {
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    success: 'border-leaf-500/30 bg-leaf-500/10 text-leaf-300',
    warning: 'border-amp-500/30 bg-amp-500/10 text-amp-300',
    error: 'border-danger-500/30 bg-danger-500/10 text-danger-400',
  }[type];
  return <div className={cx('rounded-lg border px-3.5 py-2.5 text-sm', cls, className)} role={type === 'error' ? 'alert' : undefined}>{children}</div>;
}

export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cx('inline-flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-900 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === o.key ? 'bg-ink-700 text-volt-300' : 'text-ink-400 hover:text-ink-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
