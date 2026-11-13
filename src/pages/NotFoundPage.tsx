import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, Home, MonitorPlay } from 'lucide-react';
import { GlassCard } from '@/components/ui/Display';
import { CoachBot } from '@/components/brand/Mascot';
import { usePageTitle } from '@/hooks/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Không tìm thấy trang');
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <GlassCard className="w-full max-w-lg text-center" padding="lg">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Compass className="h-8 w-8" />
        </div>
        <p className="mt-3 font-display text-[42px] font-bold leading-none text-[var(--text)]">404</p>
        <h1 className="mt-1 font-display text-xl font-bold text-[var(--text)]">Trang này không tồn tại</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-[var(--text-2)]">
          Đường dẫn có thể đã thay đổi hoặc dữ liệu liên quan đã bị xóa khỏi thiết bị này. Bạn có thể quay về tổng quan
          hoặc bắt đầu một buổi luyện mới.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            to="/"
            className="pressable inline-flex h-11 items-center gap-2 rounded-2xl border border-white/20 bg-[image:linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 text-sm font-semibold text-white shadow-[var(--shadow-glow)]"
          >
            <Home className="h-4 w-4" /> Về tổng quan
          </Link>
          <Link
            to="/practice"
            className="pressable inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-solid)] px-5 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)]"
          >
            <MonitorPlay className="h-4 w-4" /> Luyện tập
          </Link>
          <Link
            to="/lessons"
            className="pressable inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-[var(--text-2)] hover:bg-[var(--accent-softer)]"
          >
            <ArrowLeft className="h-4 w-4" /> Thư viện
          </Link>
        </div>
        <div className="mt-4 flex justify-center">
          <CoachBot size={100} mood="thinking" />
        </div>
      </GlassCard>
    </div>
  );
}
