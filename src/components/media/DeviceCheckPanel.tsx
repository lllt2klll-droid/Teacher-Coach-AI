import { Camera, CameraOff, Mic, MicOff, ShieldCheck } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useMicrophone } from '@/hooks/useMicrophone';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Display';
import { InfoNote } from '@/components/ui/Overlay';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface DeviceCheckPanelProps {
  compact?: boolean;
}

const STATE_LABELS: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' }> = {
  idle: { label: 'Chưa bật', tone: 'neutral' },
  requesting: { label: 'Đang xin quyền…', tone: 'warning' },
  ready: { label: 'Sẵn sàng', tone: 'success' },
  denied: { label: 'Bị từ chối quyền', tone: 'danger' },
  unavailable: { label: 'Không tìm thấy thiết bị', tone: 'warning' },
  error: { label: 'Có lỗi', tone: 'danger' },
};

export function DeviceCheckPanel({ compact }: DeviceCheckPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camera = useCamera(videoRef);
  const mic = useMicrophone();

  const cameraState = STATE_LABELS[camera.state] ?? STATE_LABELS.idle;
  const micState = STATE_LABELS[mic.state] ?? STATE_LABELS.idle;
  const level = Math.round(mic.level * 100);

  return (
    <div className={cn('grid gap-4', compact ? 'md:grid-cols-2' : 'lg:grid-cols-2')}>
      <section className="surface-muted rounded-2xl p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
            <Camera className="h-4 w-4 text-[var(--accent-strong)]" /> Camera
          </h3>
          <Badge tone={cameraState.tone} dot>
            {cameraState.label}
          </Badge>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-[#101827]">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full scale-x-[-1] object-cover"
            aria-label="Xem trước camera"
          />
          {camera.state !== 'ready' && (
            <div className="absolute inset-0 grid place-items-center gap-1 p-4 text-center">
              <CameraOff className="mx-auto h-7 w-7 text-white/45" />
              <p className="text-[11px] text-white/60">Chưa có hình ảnh camera</p>
            </div>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {camera.state === 'ready' ? (
            <Button variant="secondary" size="sm" icon={<CameraOff className="h-3.5 w-3.5" />} onClick={camera.stop}>
              Tắt camera
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={camera.state === 'requesting'}
              icon={<Camera className="h-3.5 w-3.5" />}
              onClick={() => void camera.start()}
            >
              Bật camera
            </Button>
          )}
          {camera.devices.length > 1 && camera.state === 'ready' && (
            <select
              aria-label="Chọn camera"
              className="field max-w-[190px] py-1.5 text-xs"
              value={camera.activeDeviceId ?? ''}
              onChange={(event) => void camera.switchDevice(event.target.value)}
            >
              {camera.devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          )}
          {camera.dimensions && camera.state === 'ready' && (
            <span className="text-[11px] text-[var(--muted)]">
              {camera.dimensions.width}×{camera.dimensions.height}
            </span>
          )}
        </div>
        {camera.message && <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--danger)]">{camera.message}</p>}
      </section>

      <section className="surface-muted rounded-2xl p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
            <Mic className="h-4 w-4 text-[var(--accent-strong)]" /> Micro
          </h3>
          <Badge tone={micState.tone} dot>
            {micState.label}
          </Badge>
        </div>
        <div className="grid min-h-[132px] place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-solid)] p-4">
          <div className="w-full max-w-[230px]">
            <div className="flex h-16 items-end justify-center gap-1" aria-hidden>
              {Array.from({ length: 22 }).map((_, index) => {
                const active = level > (index / 22) * 100;
                return (
                  <span
                    key={index}
                    className={cn(
                      'w-1.5 rounded-full transition-colors duration-100',
                      active ? 'bg-[var(--accent)]' : 'bg-[var(--surface-muted)]',
                    )}
                    style={{ height: `${20 + ((index * 13) % 38)}%` }}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
              {mic.state === 'ready'
                ? mic.speaking
                  ? `Đang nghe thấy giọng nói · ${mic.volumeDb} dB`
                  : `Chưa nghe thấy giọng nói · ${mic.volumeDb} dB`
                : 'Bật micro để kiểm tra tín hiệu âm thanh'}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {mic.state === 'ready' ? (
            <Button variant="secondary" size="sm" icon={<MicOff className="h-3.5 w-3.5" />} onClick={mic.stop}>
              Tắt micro
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={mic.state === 'requesting'}
              icon={<Mic className="h-3.5 w-3.5" />}
              onClick={() => void mic.start()}
            >
              Bật micro
            </Button>
          )}
          {mic.devices.length > 1 && mic.state === 'ready' && (
            <select
              aria-label="Chọn micro"
              className="field max-w-[190px] py-1.5 text-xs"
              value={mic.activeDeviceId ?? ''}
              onChange={(event) => void mic.start(event.target.value)}
            >
              {mic.devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {mic.message && <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--danger)]">{mic.message}</p>}
      </section>

      <div className="md:col-span-2">
        <InfoNote>
          <span className="inline-flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Camera và micro chỉ bật khi bạn bấm nút. Video không rời khỏi thiết bị; phân tích tư thế chạy cục bộ bằng
              MediaPipe. Ứng dụng không nhận diện danh tính hay cảm xúc.
            </span>
          </span>
        </InfoNote>
      </div>
    </div>
  );
}
