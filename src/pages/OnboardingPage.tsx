import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CameraOff,
  CheckCircle2,
  Dumbbell,
  Eye,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Mic,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { CoachBot } from '@/components/brand/Mascot';
import { Badge, GlassCard } from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Inputs';
import { InfoNote } from '@/components/ui/Overlay';
import { usePageTitle } from '@/hooks/usePageTitle';
import { profileRepo } from '@/data/repositories';
import { useSettingsStore } from '@/store/settings-store';
import { toast } from '@/store/toast-store';
import { cn } from '@/lib/utils';

const STEPS = ['Chào mừng', 'Cách hoạt động', 'Quyền riêng tư', 'Bắt đầu'] as const;

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Tải kế hoạch bài dạy',
    description: 'PDF, DOCX hoặc văn bản. Hệ thống trích xuất mục tiêu, hoạt động và câu hỏi để bạn kiểm tra lại.',
    tone: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  },
  {
    icon: UsersRound,
    title: 'Lớp học AI hư cấu',
    description: 'Học sinh AI phản hồi theo bài dạy và hồ sơ nhân vật. Không phải học sinh thật, không dùng dữ liệu người thật.',
    tone: 'bg-[var(--lavender-soft)] text-[var(--lavender)]',
  },
  {
    icon: CameraOff,
    title: 'Phân tích ngay trên máy',
    description: 'Camera và micro chỉ bật khi bạn cho phép. Video không rời thiết bị; MediaPipe chạy cục bộ.',
    tone: 'bg-[var(--success-soft)] text-[var(--success)]',
  },
  {
    icon: Sparkles,
    title: 'Báo cáo có bằng chứng',
    description: 'Chỉ số lấy từ dữ liệu thật đã ghi. Thiếu dữ liệu thì ghi “chưa đủ dữ liệu”, không tạo điểm giả.',
    tone: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  },
];

export function OnboardingPage() {
  usePageTitle('Bắt đầu');
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const update = useSettingsStore((state) => state.update);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.displayName);
  const [finishing, setFinishing] = useState(false);

  const finish = async (skipped = false) => {
    setFinishing(true);
    try {
      const trimmed = skipped ? settings.displayName : name.trim();
      if (!skipped && trimmed) {
        const profile = await profileRepo.ensure();
        await profileRepo.save({ ...profile, displayName: trimmed });
      }
      update({
        displayName: skipped ? settings.displayName : trimmed,
        hasSeenOnboarding: true,
      });
      navigate('/', { replace: true });
    } catch (error) {
      console.error(error);
      toast.error('Không lưu được hồ sơ', 'Bạn vẫn có thể tiếp tục và cập nhật tên trong Cài đặt.');
      update({ hasSeenOnboarding: true });
      navigate('/', { replace: true });
    } finally {
      setFinishing(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    void finish();
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--bg)] px-3 py-5 sm:px-5">
      <div className="pointer-events-none absolute -left-24 top-[-6rem] h-80 w-80 rounded-full bg-[var(--accent-soft)] blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-[-7rem] h-96 w-96 rounded-full bg-[var(--lavender-soft)] blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-6xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Logo size={44} />
          <div className="flex items-center gap-2">
            <Badge tone="success" dot>
              Dữ liệu lưu trên thiết bị
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => void finish(true)} disabled={finishing}>
              Bỏ qua
            </Button>
          </div>
        </header>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === step
                  ? 'w-9 bg-[var(--accent)]'
                  : index < step
                    ? 'w-5 bg-[var(--accent)]/55'
                    : 'w-5 bg-[var(--border-soft)]',
              )}
              aria-label={`Bước ${index + 1}: ${label}`}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Bước {step + 1}/{STEPS.length} · {STEPS[step]}
        </p>

        <main className="flex flex-1 items-center justify-center py-5">
          {step === 0 && (
            <div className="grid w-full items-center gap-5 lg:grid-cols-[1.15fr_1fr]">
              <div className="text-center lg:text-left">
                <Badge tone="accent" icon={<Sparkles className="h-3 w-3" />}>
                  Teacher Coach AI
                </Badge>
                <h1 className="mt-3 font-display text-[32px] font-bold leading-[1.1] tracking-tight text-[var(--text)] sm:text-[42px]">
                  Luyện dạy tốt hơn,
                  <br />
                  <span className="text-[var(--accent-strong)]">bằng bằng chứng thật.</span>
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-[13.5px] leading-relaxed text-[var(--text-2)] lg:mx-0">
                  Không gian thực hành dành cho sinh viên Sư phạm Tiểu học: tải kế hoạch bài dạy, tương tác với lớp học
                  AI hư cấu, luyện nói trước camera và xem báo cáo dựa trên dữ liệu đã ghi.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5 lg:justify-start">
                  <Badge tone="neutral" icon={<BookOpen className="h-3 w-3" />}>
                    KHBD của bạn
                  </Badge>
                  <Badge tone="neutral" icon={<UsersRound className="h-3 w-3" />}>
                    Học sinh AI hư cấu
                  </Badge>
                  <Badge tone="neutral" icon={<Dumbbell className="h-3 w-3" />}>
                    Bài luyện có tiêu chí
                  </Badge>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="relative grid place-items-center">
                  <div className="absolute h-52 w-52 rounded-full bg-[var(--accent-soft)] blur-2xl sm:h-64 sm:w-64" />
                  <CoachBot size={220} mood="waving" />
                  <div className="glass absolute -left-8 bottom-8 hidden max-w-[170px] rounded-2xl p-3 sm:block">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--text)]">
                      <HeartHandshake className="h-3.5 w-3.5 text-[var(--success)]" /> Tập trung vào kỹ năng
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-2)]">
                      Không chấm ngoại hình hay cảm xúc.
                    </p>
                  </div>
                  <div className="glass absolute -right-7 top-7 hidden rounded-2xl px-3 py-2 sm:block">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--text)]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-strong)]" /> Bạn kiểm soát thiết bị
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="w-full">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="font-display text-[24px] font-bold text-[var(--text)] sm:text-[30px]">
                  Một buổi luyện gồm những gì?
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
                  Quy trình rõ ràng, không có bước nào tự tạo dữ liệu thay bạn.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <GlassCard key={feature.title} className="flex items-start gap-3">
                      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', feature.tone)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-[13px] font-bold text-[var(--text)]">{feature.title}</p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-2)]">{feature.description}</p>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5">
                  <p className="text-[10.5px] font-bold text-[var(--text)]">1 · Chuẩn bị</p>
                  <p className="mt-0.5 text-[10.5px] text-[var(--text-2)]">Chọn bài đã xác nhận và cấu hình lớp học.</p>
                </div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5">
                  <p className="text-[10.5px] font-bold text-[var(--text)]">2 · Luyện tập</p>
                  <p className="mt-0.5 text-[10.5px] text-[var(--text-2)]">Giảng, tương tác; bật thiết bị nếu muốn.</p>
                </div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5">
                  <p className="text-[10.5px] font-bold text-[var(--text)]">3 · Xem báo cáo</p>
                  <p className="mt-0.5 text-[10.5px] text-[var(--text-2)]">Đọc chỉ số và bằng chứng, chọn bài luyện tiếp.</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-dashed border-[var(--warning)]/35 bg-[var(--warning-soft)] px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--warning)]">
                  <Eye className="h-3.5 w-3.5" /> Có một bài học DEMO
                </p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                  Bài DEMO chỉ để thử quy trình, được gắn nhãn rõ và không được tính vào thống kê hay điểm thật.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid w-full gap-4 lg:grid-cols-[1.3fr_1fr]">
              <GlassCard>
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-[21px] font-bold text-[var(--text)]">Quyền riêng tư là mặc định</h2>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-2)]">
                      Ứng dụng không nhận diện danh tính, cảm xúc hay đánh giá ngoại hình. Bạn có thể luyện chỉ với bàn phím.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    { icon: CameraOff, title: 'Video không rời thiết bị', text: 'Khung hình camera được xử lý cục bộ bằng MediaPipe; không gửi lên máy chủ.' },
                    { icon: Mic, title: 'Micro chỉ bật khi bạn bấm', text: 'Mỗi buổi luyện bắt đầu với camera và micro tắt. Bạn có thể bật hoặc tắt bất cứ lúc nào.' },
                    { icon: Eye, title: 'Chỉ đo điều có thể quan sát', text: 'Tư thế được mô tả bằng vị trí khung xương và chuyển động, không suy luận cảm xúc.' },
                    { icon: LayoutDashboard, title: 'Dữ liệu nằm trên máy', text: 'Bài dạy, báo cáo và bản ghi nằm trong IndexedDB. Bạn có thể xuất hoặc xóa bất cứ lúc nào.' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex items-start gap-2.5 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
                        <div>
                          <p className="text-[11.5px] font-bold text-[var(--text)]">{item.title}</p>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-2)]">{item.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

              <GlassCard tone="lavender" className="flex flex-col justify-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--surface-solid)] text-[var(--lavender)] shadow-[var(--shadow-md)]">
                  <GraduationCap className="h-8 w-8" />
                </div>
                <h3 className="mt-3 text-center font-display text-[17px] font-bold text-[var(--text)]">
                  Nguyên tắc cốt lõi
                </h3>
                <p className="mt-1.5 text-center text-[12px] leading-relaxed text-[var(--text-2)]">
                  Không có dữ liệu thì không có điểm. Mọi nhận xét đều phải chỉ ra quan sát cụ thể làm bằng chứng.
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    'Không tạo điểm, lời nhận xét hay bản ghi giả.',
                    'Học sinh AI là nhân vật hư cấu, không phải người thật.',
                    'Gemini chỉ tạo phản hồi qua proxy; khóa API ở server.',
                    'Không có dữ liệu thiết bị thì dùng lời giảng nhập tay.',
                  ].map((line) => (
                    <p key={line} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                      {line}
                    </p>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}

          {step === 3 && (
            <div className="w-full max-w-xl">
              <GlassCard padding="lg" className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <h2 className="mt-3 font-display text-[24px] font-bold text-[var(--text)]">Sẵn sàng cho buổi đầu tiên?</h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                  Bạn có thể đổi tên bất cứ lúc nào trong Cài đặt. Tên chỉ hiển thị trên thiết bị này.
                </p>
                <div className="mt-4 text-left">
                  <Input
                    label="Tên hiển thị"
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={60}
                    hint="Không bắt buộc dùng tên thật."
                  />
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    size="lg"
                    fullWidth
                    icon={<ArrowRight className="h-4 w-4" />}
                    loading={finishing}
                    onClick={() => void finish()}
                  >
                    Vào không gian luyện tập
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void finish(true)} disabled={finishing}>
                    Để sau, bắt đầu với tên mặc định
                  </Button>
                </div>
                <InfoNote tone="warning">
                  Bài học DEMO đã có sẵn trong Thư viện KHBD để bạn thử quy trình. Nó không tạo dữ liệu luyện tập giả.
                </InfoNote>
              </GlassCard>
            </div>
          )}
        </main>

        <footer className="flex items-center justify-between gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <Button
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0 || finishing}
          >
            Quay lại
          </Button>
          {step < STEPS.length - 1 && (
            <Button iconRight={<ArrowRight className="h-4 w-4" />} onClick={next} disabled={finishing}>
              Tiếp tục
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
