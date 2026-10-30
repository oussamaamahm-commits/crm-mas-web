import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };
const TONE = { success: 'text-ok', error: 'text-danger', info: 'text-brand' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind, message, detail) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, kind, message, detail }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4200);
    },
    [dismiss],
  );
  const api = useMemo(
    () => ({
      success: (m, d) => push('success', m, d),
      info: (m, d) => push('info', m, d),
      error: (err, fallback = 'No se pudo completar la operación') => {
        const problems = err?.data?.problems;
        push('error', err?.message || fallback, problems?.length ? problems.join(' · ') : undefined);
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[90] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3 shadow-float">
              <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${TONE[t.kind]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{t.message}</p>
                {t.detail && <p className="mt-0.5 text-[12px] text-ink-soft">{t.detail}</p>}
              </div>
              <button className="text-ink-faint hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
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
