import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
  className?: string;
}

export function Tabs({ tabs, active, onChange, variant = 'pill', className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Chuyển mục"
      className={cn(
        'no-scrollbar flex max-w-full gap-1 overflow-x-auto',
        variant === 'pill'
          ? 'rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-1'
          : 'border-b border-[var(--border-soft)]',
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200',
              variant === 'pill'
                ? cn(
                    'rounded-xl',
                    selected
                      ? 'bg-[var(--surface-solid)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                      : 'text-[var(--text-2)] hover:text-[var(--text)]',
                  )
                : cn(
                    '-mb-px border-b-2 px-2.5 py-2',
                    selected
                      ? 'border-[var(--accent)] text-[var(--accent-strong)]'
                      : 'border-transparent text-[var(--text-2)] hover:text-[var(--text)]',
                  ),
            )}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  selected ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'bg-[var(--surface-muted)] text-[var(--muted)]',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface AccordionItem {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpen?: string[];
  allowMultiple?: boolean;
}

export function Accordion({ items, defaultOpen = [], allowMultiple = true }: AccordionProps) {
  const [open, setOpen] = useState<string[]>(defaultOpen);
  const toggle = (id: string) => {
    setOpen((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      return allowMultiple ? [...current, id] : [id];
    });
  };
  return (
    <div className="divide-y divide-[var(--border-soft)] overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-solid)]">
      {items.map((item) => {
        const expanded = open.includes(item.id);
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(item.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-muted)]"
            >
              {item.icon && <span className="shrink-0 text-[var(--accent-strong)]">{item.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--text)]">{item.title}</span>
                  {item.badge}
                </span>
                {item.description && <span className="mt-0.5 block text-[11.5px] text-[var(--muted)]">{item.description}</span>}
              </span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--muted)] transition-transform', expanded && 'rotate-180')} />
            </button>
            {expanded && <div className="animate-pop border-t border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
