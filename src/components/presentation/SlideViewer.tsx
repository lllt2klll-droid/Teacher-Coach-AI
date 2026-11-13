import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileUp,
  Images,
  Lightbulb,
  Maximize2,
  Minimize2,
  MonitorUp,
} from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import type { PresentationDoc, PresentationDraft } from '@/types/domain';
import { usePresentationAssets } from '@/hooks/usePresentationAssets';
import { currentSlideIndex } from '@/services/presentation/presentation-context';
import { SlideRenderer } from '@/components/presentation/SlideRenderer';
import { cn } from '@/lib/utils';

interface SlideViewerProps {
  presentation: PresentationDoc | PresentationDraft;
  index: number;
  onChange: (index: number) => void;
  className?: string;
  compact?: boolean;
  suggestedIndex?: number | null;
  onOpenWindow?: () => void;
  onReplace?: () => void;
  enableKeyboard?: boolean;
  fitHeight?: boolean;
}

export function SlideViewer({
  presentation,
  index,
  onChange,
  className,
  compact = false,
  suggestedIndex,
  onOpenWindow,
  onReplace,
  enableKeyboard = true,
  fitHeight = false,
}: SlideViewerProps) {
  const assetUrls = usePresentationAssets(presentation.assets);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const total = presentation.slides.length;
  const safeIndex = currentSlideIndex(total, index);
  const slide = presentation.slides[safeIndex];
  const hasSuggestion =
    typeof suggestedIndex === 'number' && suggestedIndex >= 0 && suggestedIndex < total && suggestedIndex !== safeIndex;

  const goTo = useCallback(
    (nextIndex: number) => {
      onChange(currentSlideIndex(total, nextIndex));
    },
    [onChange, total],
  );

  const goPrevious = useCallback(() => goTo(safeIndex - 1), [goTo, safeIndex]);
  const goNext = useCallback(() => goTo(safeIndex + 1), [goTo, safeIndex]);

  useEffect(() => {
    const onChangeFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChangeFullscreen);
    return () => document.removeEventListener('fullscreenchange', onChangeFullscreen);
  }, []);

  useEffect(() => {
    if (!enableKeyboard) return;
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        goTo(safeIndex + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        goTo(safeIndex - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        goTo(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        goTo(total - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enableKeyboard, goTo, safeIndex, total]);

  const toggleFullscreen = async () => {
    const element = containerRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch (error) {
      console.warn('[Teacher Coach AI] Fullscreen is not available:', error);
    }
  };

  if (!slide) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col overflow-hidden bg-[#0b1220]',
        isFullscreen ? 'h-dvh w-dvw rounded-none' : 'rounded-xl',
        className,
      )}
    >
      <div className={cn('relative flex min-h-0 flex-1 items-center justify-center bg-[#0b1220]', isFullscreen && 'p-2')}>
        <SlideRenderer
          slide={slide}
          slideWidthEmu={presentation.slideWidthEmu}
          slideHeightEmu={presentation.slideHeightEmu}
          assetUrls={assetUrls}
          className={isFullscreen || fitHeight ? 'h-full w-auto max-w-full' : 'w-full'}
        />

        <IconButton
          aria-label="Slide trước"
          onClick={goPrevious}
          disabled={safeIndex === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/45 text-white backdrop-blur hover:bg-black/65 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <IconButton
          aria-label="Slide tiếp theo"
          onClick={goNext}
          disabled={safeIndex >= total - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/45 text-white backdrop-blur hover:bg-black/65 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </IconButton>

        {hasSuggestion && (
          <button
            type="button"
            onClick={() => goTo(suggestedIndex)}
            className="absolute left-2 top-2 inline-flex max-w-[78%] items-center gap-1.5 rounded-full bg-[#ffc857] px-2.5 py-1 text-[10.5px] font-bold text-[#3b2a00] shadow-lg transition-transform hover:scale-[1.02]"
            title="Chuyển tới slide được gợi ý cho hoạt động hiện tại"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Gợi ý slide {suggestedIndex + 1}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 bg-[#111a2c] px-2 py-1.5 text-white">
        <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[10.5px] font-bold tabular-nums">
          {safeIndex + 1}/{total}
        </span>
        {!compact && (
          <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-white/80" title={slide.title}>
            {slide.title || `Slide ${safeIndex + 1}`}
          </p>
        )}
        {compact && <span className="flex-1" />}
        <IconButton
          aria-label="Xem trước các slide"
          active={showThumbnails}
          onClick={() => setShowThumbnails((value) => !value)}
          className={cn('text-white/85 hover:bg-white/10', showThumbnails && 'bg-white/15 text-white')}
          size="sm"
        >
          <Images className="h-4 w-4" />
        </IconButton>
        {onOpenWindow && (
          <IconButton
            aria-label="Mở cửa sổ trình chiếu riêng"
            onClick={onOpenWindow}
            className="text-white/85 hover:bg-white/10"
            size="sm"
          >
            <MonitorUp className="h-4 w-4" />
          </IconButton>
        )}
        {onReplace && (
          <IconButton
            aria-label="Thay bài trình chiếu"
            onClick={onReplace}
            className="text-white/85 hover:bg-white/10"
            size="sm"
          >
            <FileUp className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton
          aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          onClick={() => void toggleFullscreen()}
          className="text-white/85 hover:bg-white/10"
          size="sm"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </IconButton>
      </div>

      {showThumbnails && (
        <div className="thin-scrollbar flex gap-2 overflow-x-auto border-t border-white/10 bg-[#0b1220] p-2">
          {presentation.slides.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(item.index)}
              aria-label={`Tới slide ${item.index + 1}`}
              aria-current={item.index === safeIndex}
              className={cn(
                'w-24 shrink-0 overflow-hidden rounded-md border-2 text-left transition-all',
                item.index === safeIndex
                  ? 'border-[#ffc857] opacity-100'
                  : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <SlideRenderer
                slide={item}
                slideWidthEmu={presentation.slideWidthEmu}
                slideHeightEmu={presentation.slideHeightEmu}
                assetUrls={assetUrls}
                className="pointer-events-none w-full"
              />
              <span className="block truncate bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/80">
                {item.index + 1}. {item.title || 'Slide'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
