import { Hand, Mic, Sparkles } from 'lucide-react';
import type { StudentAvatarState, StudentPersona } from '@/types/domain';
import { LEARNING_LEVEL_LABELS, PARTICIPATION_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Display';
import { StudentAvatar } from './StudentAvatar';

interface StudentCardProps {
  persona: StudentPersona;
  state?: StudentAvatarState;
  line?: string;
  mastery?: number;
  onCall?: (persona: StudentPersona) => void;
  compact?: boolean;
  className?: string;
}

const STATE_LABEL: Record<StudentAvatarState, string> = {
  idle: 'Sẵn sàng',
  hand: 'Đang giơ tay',
  speaking: 'Đang nói',
  thinking: 'Đang suy nghĩ',
  confused: 'Chưa hiểu',
  working: 'Đang làm bài',
};

const STATE_TONE: Record<StudentAvatarState, string> = {
  idle: 'text-[var(--muted)]',
  hand: 'text-[var(--accent-strong)]',
  speaking: 'text-[var(--success)]',
  thinking: 'text-[var(--lavender)]',
  confused: 'text-[var(--warning)]',
  working: 'text-[var(--info)]',
};

export function StudentCard({ persona, state = 'idle', line, mastery, onCall, compact, className }: StudentCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col items-center rounded-[18px] border bg-[var(--surface-solid)] p-3 text-center transition-all duration-200',
        state === 'speaking'
          ? 'border-[var(--success)]/30 shadow-[0_8px_22px_rgba(47,159,131,0.14)]'
          : state === 'hand'
            ? 'border-[var(--accent)]/30 shadow-[var(--shadow-sm)]'
            : 'border-[var(--border-soft)] hover:border-[var(--accent)]/25 hover:shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      <div className="relative">
        <StudentAvatar
          name={persona.name}
          color={persona.color}
          seed={persona.avatarSeed}
          state={state}
          size={compact ? 58 : 74}
          className={cn(state === 'speaking' && 'ring-2 ring-[var(--success)]/30 rounded-full')}
        />
        {state === 'hand' && (
          <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-white shadow-md">
            <Hand className="h-3.5 w-3.5" />
          </span>
        )}
        {state === 'speaking' && (
          <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--success)] text-white shadow-md">
            <Mic className="h-3.5 w-3.5" />
          </span>
        )}
        {state === 'thinking' && (
          <span className="absolute -right-1 -top-1 flex h-6 items-center gap-0.5 rounded-full bg-[var(--lavender)] px-1.5 text-white shadow-md">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-1 w-1 rounded-full bg-white animate-soft-pulse"
                style={{ animationDelay: `${index * 200}ms` }}
              />
            ))}
          </span>
        )}
      </div>

      <p className="mt-2 w-full truncate font-display text-[12.5px] font-bold leading-tight text-[var(--text)]">{persona.name}</p>
      {!compact && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
          <Badge tone={persona.learningLevel === 'needs_support' ? 'warning' : persona.learningLevel === 'advanced' ? 'success' : 'neutral'}>
            {LEARNING_LEVEL_LABELS[persona.learningLevel]}
          </Badge>
        </div>
      )}
      <p className={cn('mt-1 text-[10px] font-medium', STATE_TONE[state])}>{STATE_LABEL[state]}</p>
      {typeof mastery === 'number' && (
        <div className="mt-1.5 flex w-full items-center gap-1.5" title={`Mức nắm kiến thức ước tính: ${Math.round(mastery * 100)}%`}>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <span className="block h-full rounded-full bg-[var(--accent)]/70" style={{ width: `${Math.round(mastery * 100)}%` }} />
          </span>
          <span className="text-[9px] font-semibold text-[var(--muted)]">{Math.round(mastery * 100)}</span>
        </div>
      )}
      {line && (
        <div className="mt-2 w-full animate-pop rounded-xl rounded-tl-sm border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-1.5 text-left">
          <p className="line-clamp-3 text-[10.5px] leading-snug text-[var(--text-2)]">“{line}”</p>
        </div>
      )}
      {onCall && (
        <button
          type="button"
          onClick={() => onCall(persona)}
          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-solid)] px-2 py-1 text-[10px] font-semibold text-[var(--text-2)] opacity-0 transition-all hover:border-[var(--accent)]/40 hover:text-[var(--accent-strong)] group-hover:opacity-100 focus:opacity-100"
        >
          <Sparkles className="h-3 w-3" />
          Mời trả lời
        </button>
      )}
      <span className="sr-only">
        {persona.name}, {PARTICIPATION_LABELS[persona.participationStyle]}, {STATE_LABEL[state]}
      </span>
    </div>
  );
}
