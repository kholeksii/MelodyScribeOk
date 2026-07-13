import React, { createContext, useContext, useState, useCallback } from 'react';
import { useT } from '../i18n';

type ToastType = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

const MAX_STACKED = 2;
let nextId = 0;

/** The single async-event channel (SPEC.md §7): success/info auto-dismiss,
 * danger (type "error") persists until closed. At most 2 stacked — a new
 * toast past that drops the oldest. Positioned bottom-center above the
 * playback bar + safe-area on phone, bottom-right on tablet/desktop. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', durationMs?: number) => {
    const id = ++nextId;
    setToasts((prev) => [...prev.slice(-(MAX_STACKED - 1)), { id, message, type }]);

    if (type !== 'error') {
      setTimeout(() => dismiss(id), durationMs ?? 5000);
    }
  }, [dismiss]);

  const colorMap: Record<ToastType, string> = {
    info: 'bg-ink text-paper',
    success: 'bg-valid text-white',
    error: 'bg-danger text-white',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end sm:px-0">
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} colorClass={colorMap[toast.type]} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastRow: React.FC<{ toast: ToastItem; colorClass: string; onDismiss: () => void }> = ({
  toast,
  colorClass,
  onDismiss,
}) => {
  const t = useT();
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`flex max-w-sm animate-fade-in items-start gap-3 rounded px-4 py-3 text-sm font-medium shadow-lg ${colorClass}`}
    >
      <span className="flex-1">{toast.message}</span>
      {toast.type === 'error' && (
        <button onClick={onDismiss} aria-label={t('close')} className="shrink-0 opacity-80 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
};

export const useToast = () => useContext(ToastContext);
