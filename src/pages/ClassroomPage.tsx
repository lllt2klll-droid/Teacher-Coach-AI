import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Info,
  MonitorPlay,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
  Wand2,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
  GlassCard,
  LoadingState,
  PageHeader,
  SectionHeader,
  StatCard,
} from '@/components/ui/Display';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Inputs';
import { ConfirmDialog, InfoNote, Modal } from '@/components/ui/Overlay';
import { Tabs } from '@/components/ui/Tabs';
import { StudentCard } from '@/components/classroom/StudentCard';
import { StudentAvatar } from '@/components/classroom/StudentAvatar';
import { usePageTitle } from '@/hooks/usePageTitle';
import { studentRepo } from '@/data/repositories';
import { createPersonaFromSpec } from '@/data/default-personas';
import type { LearningLevel, ParticipationStyle, StudentPersona } from '@/types/domain';
import { GRADE_OPTIONS, LEARNING_LEVEL_LABELS, PARTICIPATION_LABELS } from '@/lib/format';
import { uid } from '@/lib/utils';
import { toast } from '@/store/toast-store';
import { cn } from '@/lib/utils';

const COLORS = ['#7FA8FF', '#9B8CF6', '#63C6B4', '#F3A86B', '#E7829A', '#5FB6E8', '#B795E8', '#75C98E', '#F2B84B', '#E08D7C'];

const LEVELS: LearningLevel[] = ['needs_support', 'developing', 'proficient', 'advanced'];
const STYLES: ParticipationStyle[] = ['active', 'shy', 'support', 'curious', 'distracted', 'high_achiever'];

interface PersonaForm {
  name: string;
  grade: number;
  learningLevel: LearningLevel;
  participationStyle: ParticipationStyle;
  color: string;
  notes: string;
  seed: number;
}

function emptyForm(): PersonaForm {
  return {
    name: '',
    grade: 2,
    learningLevel: 'developing',
    participationStyle: 'active',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    notes: '',
    seed: Math.floor(Math.random() * 900) + 3,
  };
}

export function ClassroomPage() {
  usePageTitle('Lớp học AI');
  const navigate = useNavigate();
  const students = useLiveQuery(() => studentRepo.list(), []);
  const [tab, setTab] = useState('roster');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentPersona | null>(null);
  const [form, setForm] = useState<PersonaForm>(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<StudentPersona | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const list = students ?? [];
  const levelCounts = useMemo(() => {
    return LEVELS.reduce<Record<LearningLevel, number>>(
      (acc, level) => ({ ...acc, [level]: list.filter((student) => student.learningLevel === level).length }),
      { needs_support: 0, developing: 0, proficient: 0, advanced: 0 },
    );
  }, [list]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (student: StudentPersona) => {
    setEditing(student);
    setForm({
      name: student.name,
      grade: student.grade,
      learningLevel: student.learningLevel,
      participationStyle: student.participationStyle,
      color: student.color,
      notes: student.notes ?? '',
      seed: student.avatarSeed,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Thiếu tên học sinh', 'Hãy nhập tên cho hồ sơ học sinh AI.');
      return;
    }
    setSaving(true);
    try {
      const base = createPersonaFromSpec(
        {
          name: form.name.trim(),
          level: form.learningLevel,
          style: form.participationStyle,
          seed: form.seed,
          color: form.color,
          note: form.notes.trim() || undefined,
        },
        form.grade,
        false,
      );
      const persona: StudentPersona = {
        ...base,
        id: editing?.id ?? uid('student'),
        avatarSeed: form.seed,
        knowledgeState: editing?.knowledgeState ?? base.knowledgeState,
        notes: form.notes.trim() || undefined,
        isDemo: false,
      };
      await studentRepo.save(persona);
      toast.success(editing ? 'Đã cập nhật hồ sơ học sinh AI' : 'Đã thêm học sinh AI', persona.name);
      setModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Không lưu được hồ sơ học sinh');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await studentRepo.remove(pendingDelete.id);
      toast.success('Đã xóa hồ sơ học sinh AI', pendingDelete.name);
      setPendingDelete(null);
    } catch (error) {
      console.error(error);
      toast.error('Không xóa được hồ sơ');
    } finally {
      setDeleting(false);
    }
  };

  if (!students) {
    return (
      <div className="space-y-5">
        <PageHeader title="Lớp học AI" description="Đang tải đội hình lớp…" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Lớp học AI"
        eyebrow="Học sinh hư cấu"
        description="Quản lý hồ sơ học sinh AI dùng trong lớp học mô phỏng. Đây là nhân vật hư cấu, không phải người thật và không đại diện cho học sinh ngoài đời."
        icon={<UsersRound className="h-6 w-6" />}
        actions={
          <>
            <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Thêm học sinh AI
            </Button>
            <Button variant="primary" icon={<MonitorPlay className="h-4 w-4" />} onClick={() => navigate('/practice')}>
              Mở lớp học
            </Button>
          </>
        }
      />

      <InfoNote>
        Học sinh AI chỉ phản hồi trong lớp mô phỏng để bạn luyện tập. Ứng dụng không nhận diện danh tính, cảm xúc hay
        đánh giá người thật. Các nhân vật mặc định được tạo sẵn với tính cách và mức độ học tập khác nhau.
      </InfoNote>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Học sinh AI" value={`${list.length}`} hint="Có thể chỉnh sửa hoặc xóa" icon={<UsersRound className="h-5 w-5" />} tone="accent" />
        <StatCard label="Cần hỗ trợ" value={`${levelCounts.needs_support + levelCounts.developing}`} hint="Mức độ học tập thấp hơn" icon={<Info className="h-5 w-5" />} tone="amber" />
        <StatCard label="Khá / nổi bật" value={`${levelCounts.proficient + levelCounts.advanced}`} hint="Mức độ học tập cao hơn" icon={<Wand2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Kiểu tham gia" value={`${new Set(list.map((student) => student.participationStyle)).size}`} hint="Đa dạng tính cách lớp học" icon={<UsersRound className="h-5 w-5" />} tone="violet" />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'roster', label: 'Đội hình lớp', icon: <UsersRound className="h-3.5 w-3.5" /> },
          { id: 'profiles', label: `Hồ sơ (${list.length})` },
        ]}
      />

      {tab === 'roster' &&
        (list.length === 0 ? (
          <GlassCard>
            <EmptyState
              icon={<UsersRound className="h-6 w-6" />}
              title="Lớp học chưa có học sinh AI"
              description="Thêm ít nhất một hồ sơ để lớp học mô phỏng có người tương tác."
              action={<Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>Thêm học sinh AI</Button>}
            />
          </GlassCard>
        ) : (
          <GlassCard>
            <SectionHeader
              title="Sơ đồ lớp học"
              description="Đây là đội hình tĩnh để bạn xem hồ sơ. Trạng thái tương tác chỉ xuất hiện khi buổi luyện đang chạy."
              icon={<UsersRound className="h-5 w-5" />}
              action={<Badge tone="neutral">{list.length} học sinh</Badge>}
            />
            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-10">
              {list.map((student) => (
                <StudentCard key={student.id} persona={student} compact />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--accent-softer)] px-3 py-2.5">
              <p className="text-[11.5px] text-[var(--text-2)]">
                Khi vào lớp, bạn có thể gọi từng học sinh, đặt câu hỏi và nhận phản hồi dựa trên kế hoạch bài dạy.
              </p>
              <Button variant="soft" size="sm" icon={<MonitorPlay className="h-3.5 w-3.5" />} onClick={() => navigate('/practice')}>
                Bắt đầu buổi luyện
              </Button>
            </div>
          </GlassCard>
        ))}

      {tab === 'profiles' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((student) => (
            <GlassCard key={student.id} hover className="flex flex-col">
              <div className="flex items-start gap-3">
                <StudentAvatar name={student.name} color={student.color} seed={student.avatarSeed} size={58} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="font-display text-[14px] font-bold text-[var(--text)]">{student.name}</h3>
                    <Badge tone="outline">Lớp {student.grade}</Badge>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                    {LEARNING_LEVEL_LABELS[student.learningLevel]} · {PARTICIPATION_LABELS[student.participationStyle]}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone={student.learningLevel === 'needs_support' ? 'warning' : student.learningLevel === 'advanced' ? 'success' : 'neutral'}>
                      {LEARNING_LEVEL_LABELS[student.learningLevel]}
                    </Badge>
                  </div>
                </div>
              </div>
              {student.notes && (
                <p className="mt-2.5 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                  {student.notes}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {student.misconceptionProfile.slice(0, 2).map((item) => (
                  <span key={item} className="rounded-md bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] text-[var(--warning)]">
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex justify-end gap-1 pt-3">
                <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(student)}>
                  Chỉnh sửa
                </Button>
                <IconButton
                  aria-label={`Xóa ${student.name}`}
                  size="sm"
                  onClick={() => setPendingDelete(student)}
                  className="hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </GlassCard>
          ))}
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[190px] rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-center transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--accent-softer)]"
          >
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Plus className="h-5 w-5" />
            </span>
            <span className="mt-2 block text-[12.5px] font-semibold text-[var(--text)]">Thêm học sinh AI</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted)]">
              Tự tạo tính cách, mức độ học tập và phong cách phản hồi.
            </span>
          </button>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Chỉnh sửa học sinh AI' : 'Thêm học sinh AI'}
        description="Nhân vật hư cấu, chỉ dùng trong lớp học mô phỏng. Không nhập thông tin của người thật."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={() => void handleSave()} loading={saving} icon={<Plus className="h-4 w-4" />}>
              {editing ? 'Lưu thay đổi' : 'Thêm vào lớp'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <div className="flex flex-col items-center rounded-2xl bg-[var(--surface-muted)] p-4">
            <StudentAvatar
              name={form.name || 'Học sinh'}
              color={form.color}
              seed={form.seed}
              size={92}
            />
            <p className="mt-2 text-center text-[11px] text-[var(--muted)]">Xem trước avatar 2D</p>
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, seed: Math.floor(Math.random() * 900) + 3 }))}
              className="mt-2 text-[11px] font-semibold text-[var(--accent-strong)] hover:underline"
            >
              Đổi kiểu avatar
            </button>
          </div>
          <div className="space-y-3">
            <Input
              label="Tên học sinh"
              required
              value={form.name}
              placeholder="Ví dụ: Minh Anh"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Khối lớp"
                value={String(form.grade)}
                onChange={(event) => setForm((current) => ({ ...current, grade: Number(event.target.value) }))}
                options={GRADE_OPTIONS.map((grade) => ({ value: String(grade), label: `Lớp ${grade}` }))}
              />
              <Select
                label="Mức học tập"
                value={form.learningLevel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, learningLevel: event.target.value as LearningLevel }))
                }
                options={LEVELS.map((level) => ({ value: level, label: LEARNING_LEVEL_LABELS[level] }))}
              />
            </div>
            <Select
              label="Phong cách tham gia"
              value={form.participationStyle}
              onChange={(event) =>
                setForm((current) => ({ ...current, participationStyle: event.target.value as ParticipationStyle }))
              }
              options={STYLES.map((style) => ({ value: style, label: PARTICIPATION_LABELS[style] }))}
            />
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-[var(--text)]">Màu nhận diện</p>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Chọn màu ${color}`}
                    onClick={() => setForm((current) => ({ ...current, color }))}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                      form.color === color ? 'border-[var(--text)] ring-2 ring-[var(--accent-soft)]' : 'border-white/70',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <Textarea
              label="Ghi chú tính cách"
              rows={3}
              value={form.notes}
              placeholder="Ví dụ: Hay giơ tay nhưng cần thêm thời gian suy nghĩ trước khi trả lời."
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              hint="Không nhập tên, thông tin hay đặc điểm của người thật."
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Xóa hồ sơ học sinh AI?"
        message={
          pendingDelete
            ? `“${pendingDelete.name}” sẽ bị xóa khỏi lớp học mô phỏng. Các buổi luyện và báo cáo cũ vẫn giữ nguyên.`
            : ''
        }
        confirmLabel="Xóa hồ sơ"
      />
    </div>
  );
}
