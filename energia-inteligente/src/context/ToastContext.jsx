import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CircleCheck, cls: 'border-leaf-500/40 text-leaf-300' },
  error: { icon: TriangleAlert, cls: 'border-danger-500/40 text-danger-400' },
  warning: { icon: TriangleAlert, cls: 'border-amp-500/40 text-amp-300' },
  info: { icon: Info, cls: 'border-ink-600 text-ink-200' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message, type = 'info', { title, duration = 4500 } = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, message, type, title }]);
      if (duration) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type] || STYLES.info;
          return (
            <div key={t.id} className={`pointer-events-auto flex w-full max-w-sm animate-fadeUp items-start gap-3 rounded-xl border bg-ink-850/95 p-3.5 shadow-2xl backdrop-blur ${cls}`}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1 text-sm">
                {t.title && <p className="font-semibold text-ink-100">{t.title}</p>}
                <p className="text-ink-200">{t.message}</p>
              </div>
              <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-100" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
