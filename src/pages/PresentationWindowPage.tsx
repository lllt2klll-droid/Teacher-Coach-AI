import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { MonitorPlay, Radio, ShieldCheck, X } from 'lucide-react';
import { Badge, EmptyState, LoadingState } from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { SlideViewer } from '@/components/presentation/SlideViewer';
import { usePageTitle } from '@/hooks/usePageTitle';
import { lessonRepo, presentationRepo } from '@/data/repositories';
import {
  presentationChannelName,
  type PresentationChannelMessage,
} from '@/services/presentation/channel';
import { currentSlideIndex } from '@/services/presentation/presentation-context';

export function PresentationWindowPage() {
  usePageTitle('Cửa sổ trình chiếu');
  const { lessonPlanId } = useParams<{ lessonPlanId: string }>();
  const [index, setIndex] = useState(0);
  const [synced, setSynced] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const indexRef = useRef(0);
  const totalRef = useRef(0);

  const result = useLiveQuery(async () => {
    if (!lessonPlanId) return null;
    const [presentation, lesson] = await Promise.all([
      presentationRepo.forLesson(lessonPlanId),
      lessonRepo.get(lessonPlanId),
    ]);
    return { presentation: presentation ?? null, lessonTitle: lesson?.title ?? null };
  }, [lessonPlanId]);

  const presentation = result?.presentation ?? null;
  const total = presentation?.slides.length ?? 0;
  indexRef.current = index;
  totalRef.current = total;

  useEffect(() => {
    if (!lessonPlanId || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(presentationChannelName(lessonPlanId));
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<PresentationChannelMessage>) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'slide' && Number.isFinite(message.index)) {
        setSynced(true);
        setIndex(currentSlideIndex(message.total || totalRef.current, message.index));
      } else if (message.type === 'request-state' && totalRef.current > 0) {
        channel.postMessage({ type: 'slide', index: indexRef.current, total: totalRef.current });
      }
    };
    channel.postMessage({ type: 'request-state' });
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [lessonPlanId]);

  const handleChange = (nextIndex: number) => {
    const safeIndex = currentSlideIndex(total, nextIndex);
    setIndex(safeIndex);
    channelRef.current?.postMessage({ type: 'navigate', index: safeIndex });
  };

  if (result === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0b1220] p-5">
        <LoadingState label="Đang mở cửa sổ trình chiếu…" />
      </div>
    );
  }

  if (!lessonPlanId || !presentation) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0b1220] p-5">
        <div className="glass w-full max-w-lg rounded-[24px] p-6 text-center">
          <EmptyState
            icon={<MonitorPlay className="h-6 w-6" />}
            title="Không tìm thấy bài trình chiếu"
            description="Bài dạy này chưa có PPTX hoặc dữ liệu slide đã bị xóa. Hãy tải lại bài trình chiếu trong phòng luyện."
            action={
              <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => window.close()}>
                Đóng cửa sổ
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#0b1220] text-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80">
          <MonitorPlay className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold">{result?.lessonTitle ?? 'Bài trình chiếu'}</p>
          <p className="truncate text-[10px] text-white/50">{presentation.fileName}</p>
        </div>
        {typeof BroadcastChannel === 'undefined' ? (
          <Badge tone="warning">Không đồng bộ</Badge>
        ) : synced ? (
          <Badge tone="success" dot>
            Đồng bộ phòng luyện
          </Badge>
        ) : (
          <Badge tone="neutral">
            <Radio className="h-3 w-3" /> Chờ phòng luyện
          </Badge>
        )}
        <Badge tone="outline">
          <ShieldCheck className="h-3 w-3" /> Cục bộ
        </Badge>
        {presentation.visualMode === 'pdf' && <Badge tone="success">PDF gốc</Badge>}
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Đóng cửa sổ trình chiếu"
          onClick={() => window.close()}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 p-2 sm:p-3">
        <SlideViewer
          presentation={presentation}
          index={index}
          onChange={handleChange}
          className="h-full"
          fitHeight
          enableKeyboard
        />
      </div>

      <footer className="border-t border-white/10 px-3 py-1.5 text-center text-[10px] text-white/40">
        Dùng ← → để chuyển slide · Cùng một bài trình chiếu với phòng luyện, không tải file lên máy chủ
      </footer>
    </div>
  );
}
