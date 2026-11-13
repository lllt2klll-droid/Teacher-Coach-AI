import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'glass' | 'success';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[image:linear-gradient(135deg,var(--accent),var(--accent-strong))] text-white shadow-[var(--shadow-glow)] hover:brightness-[1.05] border border-white/20',
  secondary:
    'bg-[var(--surface-solid)] text-[var(--text)] border border-[var(--border-soft)] shadow-[var(--shadow-sm)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent-softer)]',
  ghost:
    'bg-transparent text-[var(--text-2)] hover:bg-[var(--accent-softer)] hover:text-[var(--text)] border border-transparent',
  soft:
    'bg-[var(--accent-soft)] text-[var(--accent-strong)] border border-transparent hover:bg-[var(--accent)] hover:text-white',
  danger:
    'bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20 hover:bg-[var(--danger)] hover:text-white',
  success:
    'bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/20 hover:bg-[var(--success)] hover:text-white',
  glass:
    'glass text-[var(--text)] hover:bg-[var(--surface-solid)] border border-[var(--border)]',
};

const SIZES: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-lg gap-1.5',
  sm: 'h-9 px-3.5 text-[13px] rounded-xl gap-1.5',
  md: 'h-11 px-5 text-sm rounded-2xl gap-2',
  lg: 'h-13 px-6 text-[15px] rounded-2xl gap-2.5',
  icon: 'h-11 w-11 rounded-2xl',
  'icon-sm': 'h-9 w-9 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'pressable inline-flex items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-200',
        'disabled:pointer-events-none disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: Variant;
  size?: 'sm' | 'md';
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant = 'ghost', size = 'md', active, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'pressable inline-flex shrink-0 items-center justify-center rounded-xl transition-all duration-200',
        size === 'md' ? 'h-10 w-10' : 'h-8 w-8 rounded-lg',
        VARIANTS[variant],
        active && 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
