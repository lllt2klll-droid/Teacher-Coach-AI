import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, IconButton } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  closeOnBackdrop?: boolean;
  hideClose?: boolean;
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  icon,
  closeOnBackdrop = true,
  hideClose,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (element) => element.offsetParent !== null,
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Đóng hộp thoại"
        className="absolute inset-0 bg-[rgba(20,30,50,0.38)] backdrop-blur-sm"
        onClick={() => {
          if (closeOnBackdrop) onClose();
        }}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'animate-pop relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-[var(--border)] bg-[var(--surface-solid)] shadow-[var(--shadow-lg)] sm:rounded-[28px]',
          SIZES[size],
        )}
      >
        <div className="flex items-start gap-3.5 border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
          {icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-bold text-[var(--text)]">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                {description}
              </p>
            )}
          </div>
          {!hideClose && (
            <IconButton aria-label="Đóng" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
        <div className="thin-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-3.5 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'danger',
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      icon={<AlertTriangle className="h-5 w-5" />}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-[var(--text-2)]">{message}</p>
    </Modal>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: 'left' | 'right';
  title?: string;
  widthClass?: string;
}

export function Drawer({ open, onClose, children, side = 'left', title, widthClass = 'max-w-[320px]' }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handle);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-[rgba(20,30,50,0.4)] backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Bảng điều hướng'}
        className={cn(
          'absolute top-0 flex h-full w-[86vw] flex-col border-[var(--border)] bg-[var(--surface-solid)] shadow-[var(--shadow-lg)]',
          widthClass,
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
        )}
        style={{ animation: 'pop-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
            <h2 className="font-display text-base font-bold">{title}</h2>
            <IconButton aria-label="Đóng" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        )}
        <div className="thin-scrollbar flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom';
  className?: string;
}

export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  const position =
    side === 'right'
      ? 'left-full top-1/2 ml-2 -translate-y-1/2'
      : side === 'bottom'
        ? 'top-full left-1/2 mt-2 -translate-x-1/2'
        : 'bottom-full left-1/2 mb-2 -translate-x-1/2';
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-[90] hidden whitespace-nowrap rounded-lg border border-[var(--border-soft)] bg-[var(--text)] px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-focus-within/tooltip:block group-focus-within/tooltip:opacity-100 group-hover/tooltip:block group-hover/tooltip:opacity-100 dark:bg-[#0b1120]',
          position,
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function InfoNote({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12px] leading-relaxed',
        tone === 'warning'
          ? 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]'
          : 'border-[var(--info)]/15 bg-[var(--info-soft)] text-[var(--info)]',
      )}
    >
      {tone === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="text-[var(--text-2)]">{children}</span>
    </div>
  );
}
