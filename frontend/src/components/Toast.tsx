import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id:       number;
  type:     ToastType;
  message:  string;
  duration: number;
}

export interface ToastContextValue {
  /**
   * Display a toast notification.
   * @param type     Visual variant.
   * @param message  Text content.
   * @param duration Auto-dismiss delay in ms. Defaults to 5000.
   */
  showToast: (type: ToastType, message: string, duration?: number) => void;
  /** Immediately remove a toast by its id. */
  dismiss: (id: number) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Style maps ───────────────────────────────────────────────────────────────

const toastStyle: Record<ToastType, string> = {
  success: 'bg-success-600 text-white',
  error:   'bg-error-600   text-white',
  info:    'bg-primary-600 text-white',
};

const ToastIcon: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
};

// ─── Individual toast item ────────────────────────────────────────────────────

function ToastCard({
  toast,
  onDismiss,
}: {
  toast:     ToastItem;
  onDismiss: (id: number) => void;
}) {
  const Icon = ToastIcon[toast.type];
  return (
    <div
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={[
        'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg',
        'text-sm font-medium min-w-[280px] max-w-sm',
        toastStyle[toast.type],
      ].join(' ')}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="p-0.5 rounded opacity-75 hover:opacity-100 transition-opacity shrink-0"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Wraps the application to provide global toast notifications.
 * Place this near the root of your component tree, inside any context
 * providers it may depend on but outside page-level components.
 *
 * @example
 * // App.tsx
 * <ToastProvider>
 *   <BrowserRouter>…</BrowserRouter>
 * </ToastProvider>
 *
 * // Anywhere inside the tree
 * const { showToast } = useToast();
 * showToast('success', 'File processed!');
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts,  setToasts]  = useState<ToastItem[]>([]);
  const counter  = useRef(0);
  // Map of toast id → timeout handle so we can clear on early dismiss.
  const timers   = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration = 5000) => {
      const id = ++counter.current;
      setToasts(prev => [...prev, { id, type, message, duration }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}

      {/* Toast container — fixed top-right, pointer-events disabled on the
          wrapper so it doesn't block underlying content. */}
      <div
        aria-label="Notifications"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns `showToast` and `dismiss` from the nearest `<ToastProvider>`.
 * Throws if called outside a provider.
 *
 * @example
 * const { showToast } = useToast();
 * showToast('error', 'Upload failed.');
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
