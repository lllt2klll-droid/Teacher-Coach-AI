import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Logo } from '@/components/brand/Logo';
import { CoachBot } from '@/components/brand/Mascot';
import { Button } from '@/components/ui/Button';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { useThemeSync } from '@/hooks/useThemeSync';
import { bootstrapOnce } from '@/data/bootstrap';
import { useSettingsStore } from '@/store/settings-store';
import { DashboardPage } from '@/pages/DashboardPage';
import { LessonsPage } from '@/pages/LessonsPage';
import { LessonUploadPage } from '@/pages/LessonUploadPage';
import { LessonReviewPage } from '@/pages/LessonReviewPage';
import { ClassroomPage } from '@/pages/ClassroomPage';
import { PracticeSetupPage } from '@/pages/PracticeSetupPage';
import { LiveSessionPage } from '@/pages/LiveSessionPage';
import { PresentationWindowPage } from '@/pages/PresentationWindowPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { ReportDetailPage } from '@/pages/ReportDetailPage';
import { TrainingPage } from '@/pages/TrainingPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function SplashScreen({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--bg)] p-5">
      <div className="glass w-full max-w-md rounded-[28px] p-6 text-center">
        <div className="flex justify-center">
          <Logo size={52} />
        </div>
        <div className="mt-4 flex justify-center">
          {error ? (
            <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--danger-soft)] text-[var(--danger)]">
              <AlertTriangle className="h-8 w-8" />
            </span>
          ) : (
            <CoachBot size={130} mood="thinking" />
          )}
        </div>
        <h1 className="mt-3 font-display text-lg font-bold text-[var(--text)]">
          {error ? 'Không mở được dữ liệu trên thiết bị' : 'Đang chuẩn bị không gian luyện tập…'}
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-[12px] leading-relaxed text-[var(--text-2)]">
          {error ??
            'Đang mở IndexedDB, hồ sơ học sinh AI hư cấu và bài học DEMO một lần. Không tạo buổi luyện hay điểm giả.'}
        </p>
        {error && (
          <Button className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
            Thử lại
          </Button>
        )}
        {!error && (
          <div className="mx-auto mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
        )}
      </div>
    </div>
  );
}

function BootstrapGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError(null);
    bootstrapOnce()
      .then(() => {
        if (!cancelled) setState('ready');
      })
      .catch((cause: unknown) => {
        console.error('Bootstrap failed', cause);
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? `${cause.message} Hãy kiểm tra chế độ riêng tư của trình duyệt hoặc dung lượng lưu trữ.`
            : 'IndexedDB không khả dụng. Hãy kiểm tra chế độ riêng tư của trình duyệt.',
        );
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state === 'loading') return <SplashScreen />;
  if (state === 'error') {
    return (
      <SplashScreen
        error={error}
        onRetry={() => {
          setAttempt((current) => current + 1);
        }}
      />
    );
  }
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const hasSeenOnboarding = useSettingsStore((state) => state.hasSeenOnboarding);
  const location = useLocation();
  if (!hasSeenOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/"
        element={
          <RequireOnboarding>
            <AppShell />
          </RequireOnboarding>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="lessons" element={<LessonsPage />} />
        <Route path="lessons/upload" element={<LessonUploadPage />} />
        <Route path="lessons/:lessonId/review" element={<LessonReviewPage />} />
        <Route path="classroom" element={<ClassroomPage />} />
        <Route path="practice" element={<PracticeSetupPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:reportId" element={<ReportDetailPage />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        path="/practice/:sessionId/live"
        element={
          <RequireOnboarding>
            <LiveSessionPage />
          </RequireOnboarding>
        }
      />
      <Route
        path="/presentation/:lessonPlanId"
        element={
          <RequireOnboarding>
            <PresentationWindowPage />
          </RequireOnboarding>
        }
      />
      <Route
        path="*"
        element={
          <RequireOnboarding>
            <NotFoundPage />
          </RequireOnboarding>
        }
      />
    </Routes>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled app error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh place-items-center bg-[var(--bg)] p-5">
          <div className="glass w-full max-w-lg rounded-[28px] p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="mt-3 font-display text-xl font-bold text-[var(--text)]">Ứng dụng gặp lỗi không mong muốn</h1>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
              Dữ liệu đã lưu trong IndexedDB vẫn còn trên thiết bị. Hãy tải lại trang. Nếu lỗi lặp lại, bạn có thể xuất bản
              sao lưu hoặc xóa dữ liệu trình duyệt cho trang này.
            </p>
            <Button className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={() => window.location.reload()}>
              Tải lại trang
            </Button>
            <p className="mt-3 break-words rounded-xl bg-[var(--surface-muted)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[var(--muted)]">
              {this.state.error.message}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  useThemeSync();
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <BootstrapGate>
          <AppRoutes />
          <ToastViewport />
        </BootstrapGate>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
