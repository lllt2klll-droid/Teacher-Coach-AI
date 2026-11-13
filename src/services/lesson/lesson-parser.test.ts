import { describe, expect, it } from 'vitest';
import { parseLessonText } from './lesson-parser';

const SAMPLE = `KẾ HOẠCH BÀI DẠY - TOÁN LỚP 2
Bài 55: Bảng nhân 4
Thời lượng: 35 phút

I. MỤC TIÊU
1. Kiến thức: Học sinh lập được bảng nhân 4 và ghi nhớ bảng nhân 4.
2. Kỹ năng: Vận dụng bảng nhân 4 để giải bài toán có lời văn.
3. Thái độ: Tích cực tham gia hoạt động nhóm, tự tin trình bày.

II. ĐỒ DÙNG DẠY HỌC
- Bộ đồ dùng toán lớp 2, các tấm bìa có 4 chấm tròn.
- Phiếu học tập nhóm.

III. CÁC HOẠT ĐỘNG DẠY HỌC

Hoạt động 1: Khởi động
- GV tổ chức trò chơi "Truyền điện" ôn bảng nhân 3.
- GV nêu câu hỏi: "3 x 4 bằng bao nhiêu?"
- Học sinh trả lời miệng, nhận xét.
- GV dẫn dắt vào bài mới: Bảng nhân 4.

Hoạt động 2: Khám phá và hình thành kiến thức
- GV cho học sinh quan sát 1 tấm bìa có 4 chấm tròn.
- GV hỏi: "Mỗi tấm bìa có mấy chấm tròn?"
- Học sinh tiếp tục lập các phép nhân còn lại theo nhóm đôi.
- GV ghi bảng bảng nhân 4.

Hoạt động 3: Luyện tập
Bài 1: Tính nhẩm
4 x 3 = ...   4 x 5 = ...   4 x 8 = ...
- Học sinh làm bài cá nhân vào vở.
Bài 2: Mỗi ô tô có 4 bánh xe. Hỏi 6 ô tô như vậy có bao nhiêu bánh xe?
- GV gọi học sinh đọc đề bài, tóm tắt.
- Học sinh giải bài vào vở, một học sinh lên bảng.
- GV nhận xét, chốt lời giải: 4 x 6 = 24 (bánh xe).

Hoạt động 4: Vận dụng
- GV đưa tình huống: Lớp em có 8 bàn, mỗi bàn xếp 4 quyển sách.
- Học sinh thảo luận nhóm 4, trình bày cách làm.

Hoạt động 5: Củng cố, dặn dò
- GV hỏi: "Hôm nay chúng ta học bài gì?"
- Học sinh nhắc lại nội dung bài học.
- GV dặn dò học sinh học thuộc bảng nhân 4.
`;

describe('parseLessonText', () => {
  const lesson = parseLessonText(SAMPLE, {
    fileName: 'bai-day.txt',
    fileType: 'txt',
    fileSize: SAMPLE.length,
  });

  it('extracts the lesson title instead of the document header', () => {
    expect(lesson.title).toBe('Bài 55: Bảng nhân 4');
    expect(lesson.topic).toBe('Bảng nhân 4');
    expect(lesson.subject).toBe('Toán');
    expect(lesson.grade).toBe(2);
  });

  it('keeps numbered objective bullets inside the objectives section', () => {
    expect(lesson.objectives).toHaveLength(3);
    expect(lesson.objectives[0].text).toContain('Kiến thức');
    expect(lesson.objectives[1].text).toContain('Kỹ năng');
    expect(lesson.objectives[2].text).toContain('Thái độ');
  });

  it('extracts activities, questions and role-separated actions', () => {
    expect(lesson.lessonPhases).toHaveLength(5);
    const warmup = lesson.lessonPhases[0];
    expect(warmup.name).toBe('Khởi động');
    expect(warmup.type).toBe('warmup');
    expect(warmup.teacherActions).toHaveLength(3);
    expect(warmup.teacherActions.join(' ')).not.toContain('Học sinh trả lời');
    expect(warmup.studentActions.join(' ')).toContain('trả lời miệng');
    expect(warmup.questions).toEqual(['3 x 4 bằng bao nhiêu?']);
  });

  it('does not turn the lesson title into an exercise', () => {
    expect(lesson.exercises.map((exercise) => exercise.prompt)).toEqual([
      'Bài 1: Tính nhẩm',
      'Bài 2: Mỗi ô tô có 4 bánh xe. Hỏi 6 ô tô như vậy có bao nhiêu bánh xe?',
    ]);
    expect(lesson.exercises[1].expectedAnswer).toContain('4 x 6 = 24');
  });

  it('extracts materials and flags missing assessment data honestly', () => {
    expect(lesson.teachingMaterials).toHaveLength(2);
    expect(lesson.parsingIssues.some((issue) => issue.code === 'assessment_missing')).toBe(true);
    expect(lesson.parsingStatus).toBe('needs_review');
  });
});
