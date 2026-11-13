import type { RefObject } from 'react';
import { AlertTriangle, Camera, CameraOff, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface TeacherCameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  cameraState: string;
  cameraMessage?: string | null;
  poseStatus: 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';
  poseMessage?: string | null;
  phaseName?: string | null;
  onEnable: () => void;
  compact?: boolean;
  className?: string;
}

export function TeacherCameraView({
  videoRef,
  overlayRef,
  cameraState,
  cameraMessage,
  poseStatus,
  poseMessage,
  phaseName,
  onEnable,
  compact = false,
  className,
}: TeacherCameraViewProps) {
  const ready = cameraState === 'ready';
  return (
    <div className={cn('relative aspect-video w-full overflow-hidden bg-[#0d1424]', className)}>
      <video
        ref={videoRef}
        muted
        playsInline
        className={cn(
          'h-full w-full scale-x-[-1] object-cover transition-opacity duration-300',
          ready ? 'opacity-100' : 'opacity-0',
        )}
        aria-label="Camera của giáo viên"
      />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        aria-hidden
      />

      {!ready && (
        <div className={cn('absolute inset-0 grid place-items-center text-center', compact ? 'p-2' : 'p-6')}>
          <div>
            <span
              className={cn(
                'mx-auto grid place-items-center rounded-[22px] bg-white/8 text-white/60',
                compact ? 'h-9 w-9 rounded-xl' : 'h-16 w-16',
              )}
            >
              <CameraOff className={compact ? 'h-5 w-5' : 'h-8 w-8'} />
            </span>
            {!compact ? (
              <>
                <p className="mt-3 font-display text-[15px] font-bold text-white/90">Camera đang tắt</p>
                <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-white/55">
                  Bạn có thể luyện chỉ với micro và nhập lời giảng thủ công. Video luôn được xử lý trên thiết bị này.
                </p>
              </>
            ) : null}
            <Button
              size={compact ? 'xs' : 'sm'}
              className={compact ? 'mt-1.5' : 'mt-3'}
              variant="secondary"
              icon={<Camera className={compact ? 'h-3 w-3' : 'h-4 w-4'} />}
              loading={cameraState === 'requesting'}
              onClick={onEnable}
            >
              Bật camera
            </Button>
          </div>
        </div>
      )}

      {ready && (
        <>
          <div className={cn('absolute flex flex-wrap gap-1', compact ? 'left-1.5 top-1.5' : 'left-2.5 top-2.5')}>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full bg-black/45 font-semibold text-white backdrop-blur',
                compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2.5 py-1 text-[10px]',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#5ce0b8]" /> Camera cục bộ
            </span>
            {!compact && poseStatus === 'loading' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin" /> Đang tải MediaPipe…
              </span>
            )}
            {!compact && poseStatus === 'ready' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                <Sparkles className="h-3 w-3 text-[#8fb2ff]" /> Phân tích tư thế cục bộ
              </span>
            )}
            {!compact && poseStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-[#ffd28a] backdrop-blur">
                <AlertTriangle className="h-3 w-3" /> Không chạy được phân tích tư thế
              </span>
            )}
          </div>
          {!compact && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-end justify-between gap-2">
              <div className="rounded-xl bg-black/45 px-3 py-1.5 backdrop-blur">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-white/50">Hoạt động hiện tại</p>
                <p className="text-[11.5px] font-semibold text-white">{phaseName ?? 'Chưa xác định'}</p>
              </div>
              {poseMessage && poseStatus === 'error' && (
                <span className="max-w-[280px] rounded-lg bg-black/45 px-2 py-1 text-[10px] text-white/70 backdrop-blur">
                  {poseMessage}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {cameraMessage && !ready && compact ? (
        <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/50 px-1 py-0.5 text-[8px] text-white/70">
          {cameraMessage}
        </span>
      ) : null}
    </div>
  );
}
