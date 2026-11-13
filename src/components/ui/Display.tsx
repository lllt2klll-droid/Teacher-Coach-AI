import type { HTMLAttributes, ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

/* ------------------------------- cards ------------------------------- */

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'default' | 'accent' | 'lavender';
  hover?: boolean;
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 md:p-7',
};

export function GlassCard({ className, padding = 'md', tone = 'default', hover, children, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass relative rounded-[var(--radius-xl)]',
        PADDING[padding],
        tone === 'accent' && 'bg-[linear-gradient(145deg,var(--accent-soft),var(--surface))]',
        tone === 'lavender' && 'bg-[linear-gradient(145deg,var(--lavender-soft),var(--surface))]',
        hover && 'hover-lift',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: 'accent' | 'violet' | 'green' | 'amber';
  onClick?: () => void;
  loading?: boolean;
}

const STAT_TONES: Record<NonNullable<StatCardProps['tone']>, string> = {
  accent: 'text-[var(--accent-strong)] bg-[var(--accent-soft)]',
  violet: 'text-[var(--lavender)] bg-[var(--lavender-soft)]',
  green: 'text-[var(--success)] bg-[var(--success-soft)]',
  amber: 'text-[var(--warning)] bg-[var(--warning-soft)]',
};

export function StatCard({ label, value, hint, icon, tone = 'accent', onClick, loading }: StatCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'glass group flex w-full items-start gap-3.5 rounded-[var(--radius-xl)] p-4 text-left transition-all duration-200 md:p-5',
        onClick && 'pressable hover:bg-[var(--surface-solid)]',
      )}
    >
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', STAT_TONES[tone])}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-[var(--text-2)]">{label}</span>
        <span className="mt-0.5 block font-display text-[22px] font-bold leading-tight text-[var(--text)] md:text-2xl">
          {loading ? <span className="inline-block h-6 w-14 animate-pulse rounded-md bg-[var(--surface-muted)]" /> : value}
        </span>
        {hint && <span className="mt-1 block truncate text-[11px] text-[var(--muted)]">{hint}</span>}
      </span>
    </Wrapper>
  );
}

/* ------------------------------- headers ------------------------------- */

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, action, icon, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-bold text-[var(--text)]">{title}</h2>
          {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions, icon }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {icon && (
          <span className="hidden h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-[var(--accent-soft)] text-[var(--accent-strong)] sm:grid">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">{eyebrow}</p>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text)] md:text-[28px]">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--text-2)]">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------- badge ------------------------------- */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'lavender' | 'outline' | 'demo';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--surface-muted)] text-[var(--text-2)] border-[var(--border-soft)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)] border-transparent',
  success: 'bg-[var(--success-soft)] text-[var(--success)] border-transparent',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)] border-transparent',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-transparent',
  info: 'bg-[var(--info-soft)] text-[var(--info)] border-transparent',
  lavender: 'bg-[var(--lavender-soft)] text-[var(--lavender)] border-transparent',
  outline: 'bg-transparent text-[var(--text-2)] border-[var(--border-soft)]',
  demo: 'bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function Badge({ children, tone = 'neutral', size = 'sm', dot, className, icon }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------- progress ------------------------------- */

interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  hint?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'lavender';
  size?: 'sm' | 'md';
  showValue?: boolean;
  className?: string;
}

const PROGRESS_TONES = {
  accent: 'bg-[image:linear-gradient(90deg,var(--accent),var(--accent-strong))]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
  lavender: 'bg-[image:linear-gradient(90deg,var(--lavender),var(--accent))]',
};

export function Progress({ value, max = 100, label, hint, tone = 'accent', size = 'md', showValue, className }: ProgressProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-[var(--text-2)]">{label}</span>
          {showValue && <span className="font-semibold text-[var(--text)]">{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Tiến độ'}
        className={cn('w-full overflow-hidden rounded-full bg-[var(--surface-muted)]', size === 'sm' ? 'h-1.5' : 'h-2.5')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', PROGRESS_TONES[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
      {hint && <p className="text-[11px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

interface CircularProgressProps {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: string;
  className?: string;
}

export function CircularProgress({
  value,
  size = 112,
  stroke = 9,
  label,
  sublabel,
  tone = 'var(--accent)',
  className,
}: CircularProgressProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (safeValue / 100) * circumference;
  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-display text-[22px] font-bold leading-none text-[var(--text)]">
          {value === null ? '—' : label ?? Math.round(value)}
        </span>
        {sublabel && <span className="mt-1 text-[10px] font-medium text-[var(--muted)]">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ------------------------------- avatar ------------------------------- */

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  color?: string;
  className?: string;
  ring?: boolean;
}

export function Avatar({ name, src, size = 40, color = 'var(--accent)', className, ring }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full text-white', ring && 'ring-2 ring-white/80 dark:ring-white/20', className)}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #7b6cf0))` }}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="font-display font-bold" style={{ fontSize: Math.max(11, size * 0.36) }}>
          {initials || '?'}
        </span>
      )}
    </span>
  );
}

interface AvatarGroupProps {
  people: Array<{ id: string; name: string; color?: string; avatar?: string }>;
  max?: number;
  size?: number;
}

export function AvatarGroup({ people, max = 5, size = 34 }: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const rest = people.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((person, index) => (
        <span key={person.id} style={{ marginLeft: index === 0 ? 0 : -10 }} className="rounded-full ring-2 ring-[var(--surface-solid)]">
          <Avatar name={person.name} src={person.avatar} color={person.color} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="ml-[-10px] grid place-items-center rounded-full bg-[var(--surface-muted)] text-[11px] font-bold text-[var(--text-2)] ring-2 ring-[var(--surface-solid)]"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/* ------------------------------- states ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-xl bg-[var(--surface-muted)]', className)} />;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, secondaryAction, compact, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-5 text-center', compact ? 'py-8' : 'py-14', className)}>
      <div className="relative mb-4">
        <span className="absolute inset-0 -z-10 scale-150 rounded-full bg-[var(--accent-soft)] blur-xl" />
        <div className="grid h-16 w-16 place-items-center rounded-[22px] border border-[var(--border)] bg-[var(--surface-solid)] text-[var(--accent-strong)] shadow-[var(--shadow-md)]">
          {icon ?? <Inbox className="h-7 w-7" />}
        </div>
      </div>
      <h3 className="font-display text-[16px] font-bold text-[var(--text)]">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-[var(--text-2)]">{description}</p>}
      {(action || secondaryAction) && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}{secondaryAction}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ title = 'Đã có lỗi xảy ra', message, onRetry, compact }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-5 text-center', compact ? 'py-8' : 'py-14')}>
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="font-display text-[16px] font-bold text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-[var(--text-2)]">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-sm text-[var(--text-2)]">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-strong)]" />
      {label}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-[var(--border-soft)]', className)} />;
}

export function IconBubble({
  children,
  tone = 'accent',
  size = 'md',
  className,
}: {
  children: ReactNode;
  tone?: 'accent' | 'lavender' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const tones = {
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
    lavender: 'bg-[var(--lavender-soft)] text-[var(--lavender)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    neutral: 'bg-[var(--surface-muted)] text-[var(--text-2)]',
  };
  const sizes = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-2xl' };
  return <span className={cn('grid shrink-0 place-items-center', tones[tone], sizes[size], className)}>{children}</span>;
}
