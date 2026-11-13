import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart3,
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  Menu,
  MonitorPlay,
  Moon,
  Search,
  Settings,
  Sun,
  UsersRound,
  X,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Avatar, Badge, Divider } from '@/components/ui/Display';
import { IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Inputs';
import { Drawer, Modal } from '@/components/ui/Overlay';
import { useSettingsStore } from '@/store/settings-store';
import { lessonRepo, profileRepo, reportRepo, sessionRepo, studentRepo } from '@/data/repositories';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/lessons', label: 'Thư viện KHBD', icon: BookOpen },
  { to: '/practice', label: 'Luyện tập giảng dạy', icon: MonitorPlay },
  { to: '/classroom', label: 'Lớp học AI', icon: UsersRound },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { to: '/training', label: 'Trung tâm luyện tập', icon: Dumbbell },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];

const MOBILE_NAV = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[4]];

function sectionTitle(pathname: string): string {
  if (pathname === '/') return 'Tổng quan';
  if (pathname.startsWith('/lessons/upload')) return 'Tải kế hoạch bài dạy';
  if (pathname.startsWith('/lessons/') && pathname.endsWith('/review')) return 'Kiểm tra kế hoạch bài dạy';
  if (pathname.startsWith('/lessons')) return 'Thư viện kế hoạch bài dạy';
  if (pathname.startsWith('/practice')) return 'Luyện tập giảng dạy';
  if (pathname.startsWith('/classroom')) return 'Lớp học AI';
  if (pathname.startsWith('/reports/')) return 'Chi tiết báo cáo';
  if (pathname.startsWith('/reports')) return 'Báo cáo luyện tập';
  if (pathname.startsWith('/training')) return 'Trung tâm luyện tập';
  if (pathname.startsWith('/settings')) return 'Cài đặt';
  return 'Teacher Coach AI';
}

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-1 px-2.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--accent-softer)] hover:text-[var(--text)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--accent)]" />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const lessons = useLiveQuery(() => lessonRepo.list(), [], []);
  const reports = useLiveQuery(() => reportRepo.list(), [], []);
  const students = useLiveQuery(() => studentRepo.list(), [], []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const items = useMemo(() => {
    const needle = normalizeSearch(query);
    const pages = [
      { id: 'page-dashboard', kind: 'Trang', title: 'Tổng quan', to: '/', search: 'tổng quan dashboard' },
      { id: 'page-upload', kind: 'Trang', title: 'Tải kế hoạch bài dạy', to: '/lessons/upload', search: 'tải lên pdf docx' },
      { id: 'page-practice', kind: 'Trang', title: 'Bắt đầu luyện tập', to: '/practice', search: 'luyện tập giảng dạy' },
      { id: 'page-training', kind: 'Trang', title: 'Trung tâm luyện tập', to: '/training', search: 'bài luyện kỹ năng' },
      { id: 'page-settings', kind: 'Trang', title: 'Cài đặt', to: '/settings', search: 'cài đặt dữ liệu sao lưu' },
    ];
    const lessonItems = lessons.map((lesson) => ({
      id: lesson.id,
      kind: lesson.isDemo ? 'KHBD · DEMO' : 'Kế hoạch bài dạy',
      title: lesson.title,
      to: `/lessons/${lesson.id}/review`,
      search: `${lesson.title} ${lesson.subject} ${lesson.topic} lớp ${lesson.grade}`,
    }));
    const reportItems = reports.map((report) => ({
      id: report.id,
      kind: 'Báo cáo',
      title: `${report.lessonTitle} · ${formatRelative(report.createdAt)}`,
      to: `/reports/${report.id}`,
      search: report.lessonTitle,
    }));
    const studentItems = students.map((student) => ({
      id: student.id,
      kind: 'Học sinh AI (hư cấu)',
      title: student.name,
      to: '/classroom',
      search: `${student.name} ${student.learningLevel}`,
    }));
    const all = [...pages, ...lessonItems, ...reportItems, ...studentItems];
    if (!needle) return all.slice(0, 8);
    return all.filter((item) => normalizeSearch(`${item.kind} ${item.title} ${item.search ?? ''}`).includes(needle)).slice(0, 12);
  }, [lessons, query, reports, students]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <Modal open={open} onClose={onClose} title="Tìm kiếm" description="Kế hoạch bài dạy, báo cáo, học sinh AI và trang." size="md">
      <Input
        autoFocus
        placeholder="Ví dụ: bảng nhân 3, báo cáo, Minh Anh…"
        leading={<Search className="h-4 w-4" />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Từ khóa tìm kiếm"
      />
      <div className="mt-3 space-y-1">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-2)]">Không tìm thấy kết quả phù hợp.</p>
        ) : (
          items.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => go(item.to)}
              className="pressable flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--accent-softer)]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent-strong)]">
                {item.kind.startsWith('KHBD') ? 'KH' : item.kind.startsWith('Báo') ? 'BC' : item.kind.startsWith('Học') ? 'HS' : '↗'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{item.title}</span>
                <span className="block text-[11px] text-[var(--muted)]">{item.kind}</span>
              </span>
            </button>
          ))
        )}
      </div>
      <p className="mt-4 text-[11px] text-[var(--muted)]">
        Mẹo: nhấn <kbd className="rounded border border-[var(--border-soft)] px-1.5 py-0.5">Ctrl</kbd> +{' '}
        <kbd className="rounded border border-[var(--border-soft)] px-1.5 py-0.5">K</kbd> để mở tìm kiếm.
      </p>
    </Modal>
  );
}

function NotificationsPanel() {
  const sessions = useLiveQuery(() => sessionRepo.list(), [], []);
  const lessons = useLiveQuery(() => lessonRepo.list(), [], []);
  const interrupted = sessions.filter((session) => session.status === 'active' || session.status === 'paused');
  const needsReview = lessons.filter((lesson) => lesson.parsingStatus === 'needs_review' || lesson.parsingStatus === 'failed');
  const hasNotifications = interrupted.length > 0 || needsReview.length > 0;
  return (
    <div className="w-80 max-w-[calc(100vw-1.5rem)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-[var(--text)]">Thông báo thực tế</h3>
        {hasNotifications && <Badge tone="warning">{interrupted.length + needsReview.length}</Badge>}
      </div>
      {!hasNotifications ? (
        <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-[12px] leading-relaxed text-[var(--text-2)]">
          Không có việc cần xử lý. Thông báo chỉ xuất hiện từ dữ liệu lưu trên thiết bị, không phải thông báo giả.
        </p>
      ) : (
        <div className="space-y-1.5">
          {interrupted.map((session) => (
            <NavLink
              key={session.id}
              to="/reports"
              className="block rounded-xl bg-[var(--warning-soft)] px-3 py-2.5 hover:brightness-[0.98]"
            >
              <p className="text-[12px] font-semibold text-[var(--text)]">Buổi luyện bị gián đoạn</p>
              <p className="text-[11px] text-[var(--text-2)]">
                {session.lessonTitle} · {formatRelative(session.startedAt)}. Vào Báo cáo để khôi phục.
              </p>
            </NavLink>
          ))}
          {needsReview.slice(0, 3).map((lesson) => (
            <NavLink
              key={lesson.id}
              to={`/lessons/${lesson.id}/review`}
              className="block rounded-xl bg-[var(--accent-softer)] px-3 py-2.5"
            >
              <p className="text-[12px] font-semibold text-[var(--text)]">Cần kiểm tra kế hoạch bài dạy</p>
              <p className="truncate text-[11px] text-[var(--text-2)]">{lesson.title}</p>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('teacher-coach-sidebar') === 'collapsed';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useSettingsStore((state) => state.theme);
  const updateSettings = useSettingsStore((state) => state.update);
  const profile = useLiveQuery(() => profileRepo.get(), []);
  const sessions = useLiveQuery(() => sessionRepo.list(), [], []);
  const lessons = useLiveQuery(() => lessonRepo.list(), [], []);
  const interruptedCount = sessions.filter((s) => s.status === 'active' || s.status === 'paused').length;
  const reviewCount = lessons.filter((l) => l.parsingStatus === 'needs_review' || l.parsingStatus === 'failed').length;
  const notificationCount = interruptedCount + reviewCount;

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('teacher-coach-sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: next });
  };

  const sidebarContent = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col py-4">
      <div className={cn('mb-4 flex items-center px-4', isCollapsed ? 'justify-center px-2' : 'justify-between')}>
        <Logo collapsed={isCollapsed} size={isCollapsed ? 40 : 42} />
        {!isCollapsed && (
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Beta
          </span>
        )}
      </div>
      <div className={cn('mx-2.5 mb-3', isCollapsed && 'mx-2')}>
        <button
          type="button"
          onClick={() => navigate('/practice')}
          className={cn(
            'pressable flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-[image:linear-gradient(135deg,var(--accent),var(--accent-strong))] px-3 py-2.5 text-[12.5px] font-bold text-white shadow-[var(--shadow-glow)]',
            isCollapsed && 'px-0',
          )}
          title="Bắt đầu buổi luyện mới"
        >
          <MonitorPlay className="h-4 w-4" />
          {!isCollapsed && 'Bắt đầu luyện'}
        </button>
      </div>
      <SidebarNav collapsed={isCollapsed} onNavigate={() => setMobileOpen(false)} />
      <div className="mt-auto px-2.5 pt-3">
        <Divider className="mb-3" />
        <div className={cn('flex items-center gap-2', isCollapsed && 'flex-col')}>
          <NavLink
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-[var(--accent-softer)]',
              isCollapsed && 'justify-center px-0',
            )}
            title="Hồ sơ và cài đặt"
          >
            <Avatar name={profile?.displayName || 'Giáo viên'} size={32} color="var(--accent)" />
            {!isCollapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-[var(--text)]">
                  {profile?.displayName || 'Giáo viên tập sự'}
                </span>
                <span className="block text-[10px] text-[var(--muted)]">Dữ liệu trên thiết bị</span>
              </span>
            )}
          </NavLink>
          <IconButton
            aria-label={isCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            size="sm"
            onClick={toggleCollapsed}
            className="hidden lg:inline-flex"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-xl focus:bg-[var(--surface-solid)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Bỏ qua điều hướng
      </a>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-dvh border-r border-[var(--border)] bg-[var(--surface)] backdrop-blur-2xl transition-[width] duration-300 lg:block',
          collapsed ? 'w-[84px]' : 'w-[248px]',
        )}
        style={{ boxShadow: 'inset -1px 0 0 var(--highlight)' }}
      >
        {sidebarContent(collapsed)}
      </aside>

      <div className={cn('transition-[padding] duration-300', collapsed ? 'lg:pl-[84px]' : 'lg:pl-[248px]')}>
        <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--surface)] backdrop-blur-2xl">
          <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-7">
            <IconButton aria-label="Mở menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </IconButton>
            <div className="min-w-0 flex-1">
              <p className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)] sm:block">
                Không gian luyện tập
              </p>
              <h2 className="truncate font-display text-[15px] font-bold text-[var(--text)] sm:text-base">
                {sectionTitle(location.pathname)}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="pressable hidden items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--field)] px-3 py-2 text-[12px] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/35 sm:flex md:w-56"
              aria-label="Tìm kiếm"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Tìm kiếm…</span>
              <span className="rounded border border-[var(--border-soft)] px-1 text-[9px]">Ctrl K</span>
            </button>
            <IconButton aria-label="Tìm kiếm" className="sm:hidden" onClick={() => setSearchOpen(true)}>
              <Search className="h-5 w-5" />
            </IconButton>

            <button
              type="button"
              onClick={() => navigate('/practice')}
              className="pressable hidden items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-[12px] font-bold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent)] hover:text-white md:inline-flex"
            >
              <MonitorPlay className="h-4 w-4" />
              Luyện tập
            </button>

            <IconButton
              aria-label={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </IconButton>

            <div className="relative">
              <IconButton
                aria-label="Thông báo"
                onClick={() => setNotificationsOpen((value) => !value)}
                active={notificationsOpen}
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">
                    {notificationCount}
                  </span>
                )}
              </IconButton>
              {notificationsOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Đóng thông báo"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="glass animate-pop absolute right-0 top-12 z-50 rounded-2xl p-3">
                    <NotificationsPanel />
                  </div>
                </>
              )}
            </div>

            <NavLink to="/settings" aria-label="Hồ sơ và cài đặt" className="ml-0.5">
              <Avatar name={profile?.displayName || 'Giáo viên'} size={34} color="var(--accent)" ring />
            </NavLink>
          </div>
        </header>

        <main id="main-content" className="mx-auto max-w-[1480px] px-3 pb-24 pt-5 sm:px-5 sm:pt-6 lg:px-7 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Điều hướng di động"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface-strong)] px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-2xl lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[9.5px] font-semibold',
                    isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label.split(' ')[0]}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[9.5px] font-semibold text-[var(--muted)]"
          >
            <Menu className="h-5 w-5" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Teacher Coach AI">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo size={40} />
            <IconButton aria-label="Đóng menu" size="sm" onClick={() => setMobileOpen(false)}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
          <div className="mt-auto px-3 py-4">
            <Divider className="mb-3" />
            <NavLink
              to="/settings"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-[var(--accent-softer)]"
            >
              <Avatar name={profile?.displayName || 'Giáo viên'} size={34} color="var(--accent)" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-[var(--text)]">
                  {profile?.displayName || 'Giáo viên tập sự'}
                </span>
                <span className="block text-[10.5px] text-[var(--muted)]">Cài đặt hồ sơ và dữ liệu</span>
              </span>
            </NavLink>
          </div>
        </div>
      </Drawer>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
