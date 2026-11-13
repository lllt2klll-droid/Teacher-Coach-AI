import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/store/toast-store';
import { cn } from '@/lib/utils';

const ICONS: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const TONES: Record<ToastVariant, string> = {
  info: 'border-[var(--info)]/25 text-[var(--info)]',
  success: 'border-[var(--success)]/25 text-[var(--success)]',
  warning: 'border-[var(--warning)]/25 text-[var(--warning)]',
  error: 'border-[var(--danger)]/25 text-[var(--danger)]',
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-[100] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:bottom-5 sm:right-5">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={cn(
              'animate-pop pointer-events-auto flex items-start gap-3 rounded-2xl border bg-[var(--surface-solid)] p-3.5 shadow-[var(--shadow-lg)]',
              TONES[toast.variant],
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--text)]">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-2)]">{toast.description}</p>}
            </div>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => dismiss(toast.id)}
              className="rounded-lg p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
