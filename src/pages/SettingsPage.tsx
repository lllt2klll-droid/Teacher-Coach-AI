import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  HardDrive,
  Info,
  KeyRound,
  Laptop,
  Loader2,
  Mic,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Divider,
  GlassCard,
  LoadingState,
  PageHeader,
  SectionHeader,
} from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { Input, Select, Slider, Switch } from '@/components/ui/Inputs';
import { ConfirmDialog, InfoNote, Modal } from '@/components/ui/Overlay';
import { DeviceCheckPanel } from '@/components/media/DeviceCheckPanel';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  createBackup,
  downloadBackup,
  importBackup,
  readBackupFile,
  type BackupValidationResult,
} from '@/data/backup';
import {
  databaseStats,
  deleteAllUserData,
  profileRepo,
} from '@/data/repositories';
import { ensureBuiltInPersonas, restoreDemoData } from '@/data/seed';
import { createAIProvider } from '@/providers';
import { useSettingsStore } from '@/store/settings-store';
import { clearGeminiApiKey, setGeminiApiKey, useGeminiApiKey } from '@/store/gemini-key-store';
import { looksLikeGeminiKey, maskGeminiKey, normalizeGeminiKey } from '@/lib/gemini-key';
import { toast } from '@/store/toast-store';
import type { AccentColor, ThemeMode } from '@/types/settings';
import type { Difficulty, FeedbackFrequency, SessionMode } from '@/types/domain';
import { formatBytes, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const THEMES: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Theo hệ thống', icon: Laptop },
];

const ACCENTS: Array<{ value: AccentColor; label: string; className: string }> = [
  { value: 'blue', label: 'Xanh dương', className: 'bg-[#6d9eff]' },
  { value: 'violet', label: 'Tím', className: 'bg-[#9a8cf0]' },
  { value: 'teal', label: 'Xanh ngọc', className: 'bg-[#3fb3a4]' },
  { value: 'rose', label: 'Hồng', className: 'bg-[#ec8fa8]' },
  { value: 'amber', label: 'Hổ phách', className: 'bg-[#e4a74a]' },
];

const AI_PROVIDERS = [
  { value: 'local', label: 'Quy tắc cục bộ (không cần mạng)' },
  { value: 'gemini', label: 'Gemini qua server proxy' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — khuyến nghị' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite — nhanh, tiết kiệm' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — chất lượng cao' },
];

const MODES: Array<{ value: SessionMode; label: string }> = [
  { value: 'natural', label: 'Lớp học tự nhiên' },
  { value: 'scenario', label: 'Tình huống luyện tập' },
  { value: 'focused', label: 'Luyện tập trọng tâm' },
];

const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];

const FEEDBACK_FREQUENCIES: Array<{ value: FeedbackFrequency; label: string }> = [
  { value: 'low', label: 'Ít' },
  { value: 'normal', label: 'Vừa' },
  { value: 'high', label: 'Nhiều' },
];

type Stats = Awaited<ReturnType<typeof databaseStats>>;

export function SettingsPage() {
  usePageTitle('Cài đặt');
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const update = useSettingsStore((state) => state.update);
  const resetSettings = useSettingsStore((state) => state.reset);
  const profile = useLiveQuery(() => profileRepo.get(), []);
  const [displayName, setDisplayName] = useState('');
  const initializedRef = useRef(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [aiTest, setAiTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({ state: 'idle' });
  const [backupBusy, setBackupBusy] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupValidationResult | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState<'replace' | 'merge' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [restoreDemoBusy, setRestoreDemoBusy] = useState(false);
  const [restorePersonasBusy, setRestorePersonasBusy] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  const geminiKey = useGeminiApiKey();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setKeyDraft(geminiKey);
  }, [geminiKey]);

  useEffect(() => {
    setCustomModel(!GEMINI_MODELS.some((model) => model.value === settings.aiModel));
  }, [settings.aiModel]);

  useEffect(() => {
    if (profile && !initializedRef.current) {
      setDisplayName(profile.displayName || settings.displayName || '');
      initializedRef.current = true;
    }
  }, [profile, settings.displayName]);

  const refreshStats = async () => {
    setStatsLoading(true);
    try {
      setStats(await databaseStats());
    } catch (error) {
      console.error(error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    void refreshStats();
  }, []);

  const handleSaveProfile = async () => {
    const name = displayName.trim();
    if (!name) {
      toast.warning('Chưa nhập tên hiển thị');
      return;
    }
    setSavingProfile(true);
    try {
      const current = profile ?? (await profileRepo.ensure());
      await profileRepo.save({ ...current, displayName: name });
      update({ displayName: name });
      toast.success('Đã lưu hồ sơ', 'Tên này được dùng trong không gian luyện tập trên thiết bị.');
    } catch (error) {
      console.error(error);
      toast.error('Không lưu được hồ sơ');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExport = async () => {
    setBackupBusy(true);
    try {
      const backup = await createBackup();
      downloadBackup(backup);
      toast.success('Đã tạo bản sao lưu', 'Tệp JSON không bao gồm video/ghi âm cục bộ hoặc dữ liệu slide PPTX.');
    } catch (error) {
      console.error(error);
      toast.error('Không tạo được bản sao lưu');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupFile = async (file: File | undefined) => {
    if (!file) return;
    const validation = await readBackupFile(file);
    setPendingBackup(validation);
    setImportOpen(true);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleImport = async (mode: 'replace' | 'merge') => {
    if (!pendingBackup?.valid || !pendingBackup.backup) return;
    setImporting(mode);
    try {
      const counts = await importBackup(pendingBackup.backup, mode);
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      setImportOpen(false);
      setPendingBackup(null);
      await refreshStats();
      toast.success(
        mode === 'replace' ? 'Đã nhập và thay thế dữ liệu' : 'Đã nhập và gộp dữ liệu',
        `${total} bản ghi đã được khôi phục từ bản sao lưu.`,
      );
    } catch (error) {
      console.error(error);
      toast.error('Không nhập được bản sao lưu', error instanceof Error ? error.message : undefined);
    } finally {
      setImporting(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllUserData();
      clearGeminiApiKey();
      setKeyDraft('');
      setAiTest({ state: 'idle' });
      setDeleteOpen(false);
      await refreshStats();
      initializedRef.current = false;
      toast.success(
        'Đã xóa toàn bộ dữ liệu học tập',
        'Bài dạy, buổi luyện, báo cáo, bản ghi, học sinh AI và khóa Gemini tạm trong tab đã bị xóa khỏi thiết bị này.',
      );
    } catch (error) {
      console.error(error);
      toast.error('Không xóa được dữ liệu');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetSettings = () => {
    resetSettings();
    setResetOpen(false);
    setAiTest({ state: 'idle' });
    toast.success('Đã đặt lại cài đặt giao diện và mặc định');
  };

  const handleRestoreDemo = async () => {
    setRestoreDemoBusy(true);
    try {
      await restoreDemoData();
      await refreshStats();
      toast.success('Đã khôi phục bài học DEMO', 'Bài DEMO vẫn được tách khỏi thống kê thật.');
    } catch (error) {
      console.error(error);
      toast.error('Không khôi phục được bài DEMO');
    } finally {
      setRestoreDemoBusy(false);
    }
  };

  const handleRestorePersonas = async () => {
    setRestorePersonasBusy(true);
    try {
      const count = await ensureBuiltInPersonas();
      await refreshStats();
      toast.success(
        count > 0 ? `Đã thêm ${count} hồ sơ học sinh AI` : 'Đã có hồ sơ học sinh AI',
        count > 0
          ? 'Đây là các nhân vật hư cấu dùng cho lớp học mô phỏng, không phải học sinh thật.'
          : 'Không thêm bản ghi trùng vì đã có hồ sơ học sinh AI trên thiết bị.',
      );
    } catch (error) {
      console.error(error);
      toast.error('Không khôi phục được hồ sơ học sinh AI');
    } finally {
      setRestorePersonasBusy(false);
    }
  };

  const handleSaveKey = () => {
    const normalized = setGeminiApiKey(keyDraft);
    setKeyDraft(normalized);
    setAiTest({ state: 'idle' });
    if (!normalized) {
      toast.warning('Chưa nhập khóa Gemini');
      return;
    }
    if (!looksLikeGeminiKey(normalized)) {
      toast.warning(
        'Khóa chưa đúng định dạng thông thường',
        'Khóa vẫn được lưu để thử. Nếu Google báo lỗi, hãy kiểm tra lại khóa tại AI Studio.',
      );
      return;
    }
    toast.success(
      'Đã lưu khóa trong tab này',
      'Khóa chỉ nằm trong sessionStorage, không vào IndexedDB hay file sao lưu. Đóng tab sẽ xóa khóa.',
    );
  };

  const handleClearKey = () => {
    clearGeminiApiKey();
    setKeyDraft('');
    setAiTest({ state: 'idle' });
    toast.success('Đã xóa khóa Gemini khỏi tab này');
  };

  const handleTestAI = async () => {
    setAiTest({ state: 'testing' });
    try {
      const provider = createAIProvider({
        kind: settings.aiProvider,
        endpoint: settings.aiEndpoint,
        model: settings.aiModel,
        apiKey: normalizeGeminiKey(keyDraft) || geminiKey,
      });
      const result = await provider.testConnection();
      setAiTest({ state: result.ok ? 'ok' : 'error', message: result.message });
    } catch (error) {
      setAiTest({
        state: 'error',
        message: error instanceof Error ? error.message : 'Không kiểm tra được kết nối AI.',
      });
    }
  };

  const storagePercent =
    stats?.storageBytes && stats.storageBytes > 0
      ? Math.min(100, Math.round((stats.storageBytes / (5 * 1024 ** 3)) * 100))
      : 0;

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Cài đặt"
        eyebrow="Thiết bị của bạn"
        description="Hồ sơ, giao diện, mặc định buổi luyện, AI và dữ liệu cục bộ. Mọi thay đổi được lưu trong trình duyệt này."
        icon={<Settings2 className="h-6 w-6" />}
        actions={
          <Button variant="secondary" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setDeviceOpen(true)}>
            Kiểm tra thiết bị
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <GlassCard>
            <SectionHeader
              title="Hồ sơ giáo viên"
              description="Chỉ dùng để hiển thị trên thiết bị, không gửi lên máy chủ."
              icon={<UserRound className="h-5 w-5" />}
            />
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar
                name={displayName || profile?.displayName || 'Giáo viên'}
                size={72}
                color="var(--accent)"
                ring
              />
              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  label="Tên hiển thị"
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={60}
                  hint="Không cần dùng tên thật nếu bạn không muốn."
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Save className="h-3.5 w-3.5" />}
                    loading={savingProfile}
                    onClick={() => void handleSaveProfile()}
                  >
                    Lưu hồ sơ
                  </Button>
                  <span className="text-[10.5px] text-[var(--muted)]">
                    {profile ? `Tạo ngày ${formatDate(profile.createdAt)}` : 'Đang tải hồ sơ…'}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="Giao diện"
              description="Áp dụng ngay cho toàn bộ ứng dụng."
              icon={<Palette className="h-5 w-5" />}
            />
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-[var(--text)]">Chế độ màu</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {THEMES.map((theme) => {
                  const Icon = theme.icon;
                  return (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => update({ theme: theme.value })}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[11.5px] font-semibold transition-all',
                        settings.theme === theme.value
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-2)] hover:border-[var(--accent)]/35',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-[var(--text)]">Màu nhấn</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent.value}
                    type="button"
                    aria-label={accent.label}
                    title={accent.label}
                    onClick={() => update({ accent: accent.value })}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px] font-semibold transition-all',
                      settings.accent === accent.value
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                        : 'border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-2)] hover:border-[var(--accent)]/35',
                    )}
                  >
                    <span className={cn('h-4 w-4 rounded-full', accent.className)} />
                    {accent.label}
                    {settings.accent === accent.value && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="Mặc định cho buổi luyện"
              description="Được điền sẵn khi bạn tạo buổi luyện mới; vẫn có thể đổi từng buổi."
              icon={<Settings2 className="h-5 w-5" />}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select
                label="Chế độ mô phỏng"
                value={settings.defaultMode}
                onChange={(event) => update({ defaultMode: event.target.value as SessionMode })}
                options={MODES}
              />
              <Select
                label="Độ khó"
                value={settings.difficulty}
                onChange={(event) => update({ difficulty: event.target.value as Difficulty })}
                options={DIFFICULTIES}
              />
              <Select
                label="Số học sinh AI mặc định"
                value={String(settings.defaultStudentCount)}
                onChange={(event) => update({ defaultStudentCount: Number(event.target.value) })}
                options={[5, 8, 10, 15, 20].map((count) => ({
                  value: String(count),
                  label: `${count} học sinh (tối đa theo hồ sơ hiện có)`,
                }))}
              />
              <Select
                label="Tần suất phản hồi trực tiếp"
                value={settings.feedbackFrequency}
                onChange={(event) => update({ feedbackFrequency: event.target.value as FeedbackFrequency })}
                options={FEEDBACK_FREQUENCIES}
              />
            </div>
            <div className="mt-4">
              <Slider
                label="Mức độ chủ động của học sinh"
                value={settings.studentActivity}
                onChange={(value) => update({ studentActivity: value })}
                min={10}
                max={95}
                step={5}
                suffix="%"
                hint="Ảnh hưởng đến tần suất giơ tay và phản hồi tự phát của học sinh AI."
              />
            </div>
            <div className="mt-4">
              <Switch
                checked={settings.recordingEnabled}
                onChange={(value) => update({ recordingEnabled: value })}
                label="Ghi hình/ghi âm cục bộ mặc định"
                description="Mặc định tắt. Bản ghi chỉ lưu trong IndexedDB trên thiết bị và không được tải lên."
              />
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="Trí tuệ nhân tạo"
              description="Dùng quy tắc cục bộ hoặc Gemini. Khóa Gemini có thể đặt trên server (khuyến nghị) hoặc nhập tạm trong tab này."
              icon={<Bot className="h-5 w-5" />}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select
                label="Nhà cung cấp"
                value={settings.aiProvider}
                onChange={(event) => {
                  update({ aiProvider: event.target.value as typeof settings.aiProvider });
                  setAiTest({ state: 'idle' });
                }}
                options={AI_PROVIDERS}
              />
              <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">Trạng thái</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                  {settings.aiProvider === 'local'
                    ? 'Mọi phản hồi học sinh do quy tắc cục bộ tạo. Không gửi dữ liệu ra ngoài.'
                    : 'Học sinh AI có thể dùng Gemini. Khi chưa có khóa hoặc lỗi, hệ thống tự quay về quy tắc cục bộ.'}
                </p>
              </div>
            </div>
            {settings.aiProvider === 'gemini' && (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Endpoint proxy"
                    value={settings.aiEndpoint}
                    onChange={(event) => update({ aiEndpoint: event.target.value })}
                    placeholder="/api/ai"
                    hint="Mặc định /api/ai. Khóa chỉ được gửi tới endpoint cùng nguồn."
                  />
                  <Select
                    label="Model Gemini"
                    value={customModel ? '__custom__' : settings.aiModel}
                    onChange={(event) => {
                      if (event.target.value === '__custom__') {
                        setCustomModel(true);
                        return;
                      }
                      setCustomModel(false);
                      update({ aiModel: event.target.value });
                    }}
                    options={[
                      ...GEMINI_MODELS,
                      { value: '__custom__', label: 'Tùy chỉnh…' },
                    ]}
                    hint="Khuyến nghị Gemini 2.5 Flash. Server có thể ghi đè bằng GEMINI_MODEL."
                  />
                </div>
                {customModel && (
                  <Input
                    className="mt-3"
                    label="Model tùy chỉnh"
                    value={settings.aiModel}
                    onChange={(event) => update({ aiModel: event.target.value })}
                    placeholder="gemini-2.5-flash"
                    hint="Nhập đúng mã model mà tài khoản của bạn được phép dùng."
                  />
                )}

                <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text)]">
                        <KeyRound className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                        Khóa API Gemini (tùy chọn)
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                        Dán khóa từ Google AI Studio để dùng Gemini ngay. Khóa chỉ lưu trong{' '}
                        <code className="rounded bg-[var(--surface-solid)] px-1">sessionStorage</code> của tab này,
                        không vào IndexedDB, không vào file sao lưu và bị xóa khi đóng tab.
                      </p>
                    </div>
                    <Badge tone={geminiKey ? 'success' : 'neutral'}>
                      {geminiKey ? `Đã nhập ${maskGeminiKey(geminiKey)}` : 'Chưa nhập khóa trong tab'}
                    </Badge>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <Input
                      aria-label="Khóa API Gemini"
                      type={showKey ? 'text' : 'password'}
                      value={keyDraft}
                      onChange={(event) => setKeyDraft(event.target.value)}
                      placeholder="AIza…"
                      autoComplete="new-password"
                      spellCheck={false}
                      trailing={
                        <button
                          type="button"
                          onClick={() => setShowKey((value) => !value)}
                          className="pressable grid h-6 w-6 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--accent-softer)] hover:text-[var(--text)]"
                          aria-label={showKey ? 'Ẩn khóa API' : 'Hiện khóa API'}
                        >
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      }
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="sm:mt-[22px]"
                      icon={<Save className="h-3.5 w-3.5" />}
                      onClick={handleSaveKey}
                    >
                      Lưu khóa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="sm:mt-[22px]"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={handleClearKey}
                      disabled={!geminiKey && !keyDraft}
                    >
                      Xóa
                    </Button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--muted)]">
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[var(--accent-strong)] hover:underline"
                    >
                      Lấy khóa tại Google AI Studio <ExternalLink className="h-3 w-3" />
                    </a>
                    <span aria-hidden>·</span>
                    <span>Proxy kiểm tra khóa và không ghi log khóa.</span>
                  </div>
                </div>
              </>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={
                  aiTest.state === 'testing' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : aiTest.state === 'ok' ? (
                    <Wifi className="h-3.5 w-3.5" />
                  ) : aiTest.state === 'error' ? (
                    <WifiOff className="h-3.5 w-3.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )
                }
                onClick={() => void handleTestAI()}
                disabled={aiTest.state === 'testing'}
              >
                Kiểm tra kết nối
              </Button>
              {aiTest.message && (
                <Badge tone={aiTest.state === 'ok' ? 'success' : aiTest.state === 'error' ? 'danger' : 'neutral'}>
                  {aiTest.message}
                </Badge>
              )}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
              <p className="text-[10.5px] leading-relaxed text-[var(--text-2)]">
                Với bản triển khai thật, nên đặt <code className="rounded bg-[var(--surface-solid)] px-1">GEMINI_API_KEY</code>{' '}
                trong biến môi trường server/Vercel. Khóa nhập trong tab là tiện ích cho máy cá nhân và chỉ được gửi tới
                proxy cùng nguồn <code className="rounded bg-[var(--surface-solid)] px-1">/api/ai</code>. Nếu thiếu khóa,
                ứng dụng vẫn chạy đầy đủ bằng quy tắc cục bộ.
              </p>
            </div>
            {settings.aiProvider === 'gemini' && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => update({ aiProvider: 'local' })}
              >
                Dùng quy tắc cục bộ để đảm bảo không gửi dữ liệu
              </Button>
            )}
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="Quyền riêng tư & thiết bị"
              description="Camera/micro chỉ bật sau khi bạn bấm nút. Không có nhận diện danh tính hay cảm xúc."
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--surface-muted)] p-3">
                <Camera className="h-4 w-4 text-[var(--accent-strong)]" />
                <p className="mt-1.5 text-[11px] font-bold text-[var(--text)]">Video cục bộ</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                  MediaPipe xử lý khung hình trên trình duyệt. Video không được gửi lên máy chủ.
                </p>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted)] p-3">
                <Mic className="h-4 w-4 text-[var(--accent-strong)]" />
                <p className="mt-1.5 text-[11px] font-bold text-[var(--text)]">Micro theo yêu cầu</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                  Mỗi lần luyện, micro chỉ khởi động khi bạn chủ động bật.
                </p>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted)] p-3">
                <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
                <p className="mt-1.5 text-[11px] font-bold text-[var(--text)]">Không nhận diện</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                  Chỉ đo tư thế và âm lượng. Không suy luận cảm xúc, giới tính hay danh tính.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Camera className="h-3.5 w-3.5" />}
                onClick={() => setDeviceOpen(true)}
              >
                Kiểm tra camera & micro
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => navigate('/practice')}
              >
                Mở phòng luyện tập
              </Button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Không cấp quyền? Bạn vẫn có thể luyện bằng lời giảng nhập thủ công. Khi đóng cửa sổ kiểm tra, camera/micro sẽ
              được tắt.
            </p>
          </GlassCard>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <GlassCard tone="accent">
            <SectionHeader title="Dữ liệu trên thiết bị" description="Không có máy chủ lưu dữ liệu học tập." icon={<Database className="h-5 w-5" />} />
            {statsLoading || !stats ? (
              <LoadingState label="Đang đếm dữ liệu…" />
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { label: 'Kế hoạch bài dạy', value: stats.lessons },
                    { label: 'Buổi luyện', value: stats.sessions },
                    { label: 'Báo cáo', value: stats.reports },
                    { label: 'Học sinh AI', value: stats.students },
                    { label: 'Bản ghi', value: stats.recordings },
                    { label: 'Bài trình chiếu', value: stats.presentations },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-[var(--surface-muted)] px-2.5 py-2">
                      <p className="font-display text-[18px] font-bold leading-tight text-[var(--text)]">{item.value}</p>
                      <p className="text-[9.5px] text-[var(--muted)]">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--text)]">
                    <HardDrive className="h-3.5 w-3.5" /> Dung lượng ước tính
                  </p>
                  <p className="mt-0.5 text-[12px] font-bold text-[var(--text)]">
                    {stats.storageBytes === null ? 'Không đọc được' : formatBytes(stats.storageBytes)}
                  </p>
                  {stats.storageBytes !== null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--border-soft)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(2, storagePercent)}%` }} />
                    </div>
                  )}
                  <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">
                    Bản ghi hình/âm chiếm nhiều dung lượng nhất nếu có.
                  </p>
                </div>
              </>
            )}
            <div className="mt-3 flex flex-col gap-1.5">
              <Button fullWidth variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} loading={backupBusy} onClick={() => void handleExport()}>
                Xuất bản sao lưu JSON
              </Button>
              <Button
                fullWidth
                variant="secondary"
                size="sm"
                icon={<Upload className="h-3.5 w-3.5" />}
                onClick={() => importInputRef.current?.click()}
              >
                Nhập bản sao lưu
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void handleBackupFile(event.target.files?.[0])}
              />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Bản sao lưu không gồm video/ghi âm và dữ liệu bài trình chiếu (slide/ảnh PPTX, ảnh PDF đã trích xuất). Nhập bản
              sao lưu sẽ không tự xóa dữ liệu hiện có nếu bạn chọn chế độ gộp.
            </p>
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Dữ liệu mẫu & hồ sơ AI" description="Các nhân vật hư cấu dùng cho lớp mô phỏng." icon={<Sparkles className="h-5 w-5" />} />
            <div className="mt-3 space-y-2">
              <Button
                fullWidth
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                loading={restoreDemoBusy}
                onClick={() => void handleRestoreDemo()}
              >
                Khôi phục bài học DEMO
              </Button>
              <Button
                fullWidth
                variant="ghost"
                size="sm"
                icon={<UserRound className="h-3.5 w-3.5" />}
                loading={restorePersonasBusy}
                onClick={() => void handleRestorePersonas()}
              >
                Thêm hồ sơ học sinh AI mặc định
              </Button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Bài DEMO chỉ có nội dung bài học, không tạo buổi luyện, điểm hay báo cáo giả. Kết quả luyện với bài DEMO được
              gắn nhãn và không tính vào thống kê thật.
            </p>
          </GlassCard>

          <GlassCard className="border-[var(--danger)]/20">
            <SectionHeader title="Vùng nguy hiểm" description="Không thể hoàn tác nếu chưa có bản sao lưu." icon={<AlertTriangle className="h-5 w-5" />} />
            <div className="mt-3 space-y-2">
              <Button
                fullWidth
                variant="danger"
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setDeleteOpen(true)}
              >
                Xóa toàn bộ dữ liệu học tập
              </Button>
              <Button
                fullWidth
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => setResetOpen(true)}
              >
                Đặt lại cài đặt giao diện
              </Button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Xóa dữ liệu học tập gồm bài dạy, buổi luyện, báo cáo, lời giảng, bản ghi và hồ sơ học sinh AI. Cài đặt giao
              diện được giữ nguyên.
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
              <div>
                <p className="text-[11.5px] font-bold text-[var(--text)]">Giới hạn đã biết</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                  Chưa thể kiểm chứng camera, micro và nhận dạng giọng nói trên mọi phần cứng. Nếu trình duyệt không hỗ trợ
                  nhận dạng, hãy dùng ô nhập lời giảng. Gemini chỉ hoạt động khi server proxy có khóa; nếu không, hệ thống
                  dùng quy tắc cục bộ.
                </p>
              </div>
            </div>
          </GlassCard>

          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[10px] text-[var(--muted)]">Teacher Coach AI · Bản cục bộ</p>
            <Button size="xs" variant="ghost" iconRight={<ChevronRight className="h-3 w-3" />} onClick={() => navigate('/onboarding')}>
              Xem lại giới thiệu
            </Button>
          </div>
        </aside>
      </div>

      <Modal
        open={deviceOpen}
        onClose={() => setDeviceOpen(false)}
        title="Kiểm tra camera và micro"
        description="Thiết bị chỉ bật khi bạn bấm nút bên dưới. Đóng cửa sổ này sẽ tắt thiết bị."
        icon={<Camera className="h-5 w-5" />}
        size="xl"
        footer={<Button onClick={() => setDeviceOpen(false)}>Đóng và tắt thiết bị</Button>}
      >
        <DeviceCheckPanel compact />
        <InfoNote tone="warning">
          Video không rời khỏi thiết bị này. Hệ thống không nhận diện danh tính, cảm xúc hay đánh giá ngoại hình. Nếu không
          cấp quyền, bạn vẫn có thể luyện bằng lời giảng nhập thủ công.
        </InfoNote>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => {
          if (importing) return;
          setImportOpen(false);
          setPendingBackup(null);
        }}
        title="Nhập bản sao lưu"
        description="Kiểm tra thông tin trước khi ghi đè hoặc gộp dữ liệu."
        icon={<Upload className="h-5 w-5" />}
        size="lg"
        footer={
          pendingBackup?.valid ? (
            <>
              <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={Boolean(importing)}>
                Hủy
              </Button>
              <Button
                variant="secondary"
                loading={importing === 'merge'}
                disabled={Boolean(importing)}
                onClick={() => void handleImport('merge')}
              >
                Gộp vào dữ liệu hiện có
              </Button>
              <Button
                variant="danger"
                loading={importing === 'replace'}
                disabled={Boolean(importing)}
                onClick={() => void handleImport('replace')}
              >
                Thay thế toàn bộ
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Đóng
            </Button>
          )
        }
      >
        {!pendingBackup ? (
          <LoadingState label="Đang kiểm tra tệp…" />
        ) : pendingBackup.valid && pendingBackup.backup ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Xuất lúc</p>
                <p className="text-[11.5px] font-semibold text-[var(--text)]">
                  {formatDate(pendingBackup.backup.exportedAt, true)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Phiên bản</p>
                <p className="text-[11.5px] font-semibold text-[var(--text)]">
                  Schema {pendingBackup.backup.schemaVersion} · v{pendingBackup.backup.appVersion}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Số bản ghi</p>
                <p className="text-[11.5px] font-semibold text-[var(--text)]">
                  {Object.values(pendingBackup.backup.counts).reduce((sum, count) => sum + count, 0)}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              {Object.entries(pendingBackup.backup.counts).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-[11px]">
                  <span className="text-[var(--text-2)]">{key}</span>
                  <span className="font-semibold text-[var(--text)]">{count}</span>
                </div>
              ))}
            </div>
            {pendingBackup.warnings.length > 0 && (
              <InfoNote tone="warning">{pendingBackup.warnings.join(' ')}</InfoNote>
            )}
            <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
              Chế độ “Gộp” giữ dữ liệu hiện có và ghi đè các bản ghi trùng id. Chế độ “Thay thế” xóa toàn bộ dữ liệu học tập
              trước khi nhập. Bản ghi video không có trong tệp sao lưu.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingBackup.errors.map((error) => (
              <p key={error} className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[11.5px] text-[var(--danger)]">
                {error}
              </p>
            ))}
            {pendingBackup.warnings.map((warning) => (
              <p key={warning} className="rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-[11.5px] text-[var(--warning)]">
                {warning}
              </p>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDeleteAll()}
        loading={deleting}
        title="Xóa toàn bộ dữ liệu học tập?"
        message="Toàn bộ kế hoạch bài dạy, buổi luyện, báo cáo, lời giảng, dữ liệu đo, bản ghi và hồ sơ học sinh AI sẽ bị xóa khỏi thiết bị này. Không thể hoàn tác. Hãy xuất bản sao lưu trước nếu cần."
        confirmLabel="Xóa vĩnh viễn"
      />

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetSettings}
        title="Đặt lại cài đặt?"
        message="Giao diện, màu nhấn, mặc định buổi luyện và tùy chọn AI sẽ trở về mặc định. Dữ liệu học tập và trạng thái onboarding được giữ nguyên."
        confirmLabel="Đặt lại cài đặt"
        tone="primary"
      />
    </div>
  );
}
