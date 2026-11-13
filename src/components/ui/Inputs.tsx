import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function FieldShell({ label, hint, error, required, htmlFor, children, className, action }: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-semibold text-[var(--text)]">
              {label}
              {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-[var(--danger)]">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  fieldClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, fieldClassName, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={className}>
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">{leading}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          className={cn(
            'field',
            leading && 'pl-10',
            trailing && 'pr-10',
            error && 'border-[var(--danger)] focus:border-[var(--danger)]',
            fieldClassName,
          )}
          {...props}
        />
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, required, rows = 4, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={className}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={cn('field resize-y', error && 'border-[var(--danger)]', className)}
        {...props}
      />
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={className}>
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'field appearance-none pr-9',
            error && 'border-[var(--danger)]',
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">▾</span>
      </div>
    </FieldShell>
  );
});

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, description, disabled, id }: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label htmlFor={switchId} className="block text-[13px] font-semibold text-[var(--text)]">
              {label}
            </label>
          )}
          {description && <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{description}</p>}
        </div>
      )}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
          checked
            ? 'border-transparent bg-[var(--accent)]'
            : 'border-[var(--border-soft)] bg-[var(--surface-muted)]',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
          )}
          style={{ height: 18, width: 18 }}
        />
      </button>
    </div>
  );
}

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  hint?: string;
  suffix?: string;
  disabled?: boolean;
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, hint, suffix, disabled }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      {(label || suffix) && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-[var(--text)]">{label}</span>
          <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-strong)]">
            {value}
            {suffix}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ['--range-progress' as string]: `${percent}%` }}
        className="w-full"
      />
      {hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, description, disabled }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border-soft)] accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[var(--text)]">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">{description}</span>}
      </span>
    </label>
  );
}
