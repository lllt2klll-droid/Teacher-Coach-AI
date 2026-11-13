import { Check, ChevronDown, Eye, Lightbulb, Pin, PinOff, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useState } from 'react';
import type { FeedbackEvent, FeedbackSeverity } from '@/types/domain';
import { CATEGORY_SHORT, SEVERITY_LABELS, formatTimestamp } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge, IconBubble } from '@/components/ui/Display';
import { IconButton } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Overlay';

const SEVERITY_STYLES: Record<FeedbackSeverity, { bubble: 'accent' | 'lavender' | 'warning' | 'danger'; tone: string; bar: string }> = {
  info: { bubble: 'accent', tone: 'text-[var(--info)]', bar: 'bg-[var(--info)]' },
  suggestion: { bubble: 'lavender', tone: 'text-[var(--lavender)]', bar: 'bg-[var(--lavender)]' },
  warning: { bubble: 'warning', tone: 'text-[var(--warning)]', bar: 'bg-[var(--warning)]' },
  critical: { bubble: 'danger', tone: 'text-[var(--danger)]', bar: 'bg-[var(--danger)]' },
};

interface FeedbackCardProps {
  event: FeedbackEvent;
  onPin?: (event: FeedbackEvent) => void;
  onDismiss?: (event: FeedbackEvent) => void;
  onRate?: (event: FeedbackEvent, helpful: boolean) => void;
  compact?: boolean;
  showEvidence?: boolean;
}

export function FeedbackCard({ event, onPin, onDismiss, onRate, compact, showEvidence = true }: FeedbackCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const styles = SEVERITY_STYLES[event.severity];
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-solid)]',
        expanded ? 'p-3.5' : 'p-3',
        event.pinned && 'border-[var(--accent)]/30',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', styles.bar)} />
      <div className="flex items-start gap-3">
        <IconBubble tone={styles.bubble} size="sm">
          <Lightbulb className="h-4 w-4" />
        </IconBubble>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={styles.bubble === 'danger' ? 'danger' : styles.bubble === 'warning' ? 'warning' : styles.bubble === 'lavender' ? 'lavender' : 'info'}>
              {SEVERITY_LABELS[event.severity]}
            </Badge>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{CATEGORY_SHORT[event.category]}</span>
            <span className="text-[10px] font-medium text-[var(--muted)]">· {formatTimestamp(event.timestamp)}</span>
            {event.pinned && <Pin className="h-3 w-3 text-[var(--accent-strong)]" />}
          </div>
          <p className="mt-1.5 text-[12.5px] font-semibold leading-snug text-[var(--text)]">{event.explanation}</p>
          {expanded && (
            <>
              <div className="mt-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-2">
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                  <Eye className="mt-0.5 h-3 w-3 shrink-0 text-[var(--muted)]" />
                  <span>
                    <span className="font-semibold text-[var(--text)]">Bằng chứng: </span>
                    {event.evidence.observedFact}
                  </span>
                </p>
                {showEvidence && (
                  <p className="mt-1 pl-4.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                    {event.evidence.interpretation}
                  </p>
                )}
              </div>
              <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                <span>
                  <span className="font-semibold text-[var(--text)]">Gợi ý: </span>
                  {event.recommendation}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[9.5px] font-medium text-[var(--muted)]">
                  Độ tin cậy {Math.round(event.confidence * 100)}%
                </span>
                <div className="flex items-center gap-0.5">
                  {onRate && (
                    <>
                      <Tooltip label="Hữu ích">
                        <IconButton
                          aria-label="Đánh dấu hữu ích"
                          size="sm"
                          onClick={() => onRate(event, true)}
                          className={event.helpful === true ? 'text-[var(--success)]' : ''}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip label="Chưa chính xác">
                        <IconButton
                          aria-label="Đánh dấu chưa chính xác"
                          size="sm"
                          onClick={() => onRate(event, false)}
                          className={event.helpful === false ? 'text-[var(--danger)]' : ''}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {onPin && (
                    <Tooltip label={event.pinned ? 'Bỏ ghim' : 'Ghim phản hồi'}>
                      <IconButton aria-label={event.pinned ? 'Bỏ ghim' : 'Ghim'} size="sm" onClick={() => onPin(event)}>
                        {event.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </IconButton>
                    </Tooltip>
                  )}
                  {onDismiss && (
                    <Tooltip label="Ẩn phản hồi">
                      <IconButton aria-label="Ẩn phản hồi" size="sm" onClick={() => onDismiss(event)}>
                        <X className="h-4 w-4" />
                      </IconButton>
                    </Tooltip>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {compact && (
          <button
            type="button"
            aria-label={expanded ? 'Thu gọn' : 'Xem chi tiết'}
            onClick={() => setExpanded((value) => !value)}
            className="mt-0.5 rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>
    </article>
  );
}
