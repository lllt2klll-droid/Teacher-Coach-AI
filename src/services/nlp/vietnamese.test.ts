import { describe, expect, it } from 'vitest';
import {
  classifyQuestion,
  detectEncouragement,
  detectGreeting,
  detectPraise,
  detectSummary,
  detectTeacherIntent,
  detectTransition,
  extractNumbers,
  foldVietnamese,
  jaccardSimilarity,
  tokenize,
  tryArithmeticAnswer,
} from './vietnamese';

describe('Vietnamese text helpers', () => {
  it('folds diacritics without losing readability for matching', () => {
    expect(foldVietnamese('Bảng nhân 4 – Đúng rồi!')).toBe('bang nhan 4 – dung roi!');
  });

  it('tokenizes and removes common stopwords', () => {
    const tokens = tokenize('Học sinh lập bảng nhân bốn');
    expect(tokens).toContain('nhan');
    expect(tokens).toContain('lap');
    expect(tokens).not.toContain('la');
    expect(jaccardSimilarity('bảng nhân bốn', 'bảng nhân 4')).toBeGreaterThan(0);
  });

  it('classifies open, probing and checking questions', () => {
    expect(classifyQuestion('Em hãy giải thích vì sao con chọn cách này?')).toMatchObject({
      isQuestion: true,
      kind: 'probe',
      openEnded: true,
    });
    expect(classifyQuestion('4 x 6 bằng bao nhiêu?')).toMatchObject({
      isQuestion: true,
      kind: 'check',
      openEnded: false,
    });
    expect(classifyQuestion('Hôm nay chúng ta học bài mới.')).toMatchObject({ isQuestion: false });
  });

  it('detects praise, encouragement and lesson transitions', () => {
    expect(detectPraise('Đúng rồi, các em giỏi lắm!')).toBe(true);
    expect(detectEncouragement('Không sao, em thử lại nhé.')).toBe(true);
    expect(detectGreeting('Xin chào các em, chúng ta bắt đầu bài học.')).toBe(true);
    expect(detectTransition('Bây giờ chúng ta chuyển sang hoạt động 2.')).toBe(true);
    expect(detectSummary('Cô tổng kết lại bài học hôm nay.')).toBe(true);
  });

  it('extracts arithmetic expressions for deterministic student answers', () => {
    expect(tryArithmeticAnswer('4 x 6 = ?')).toEqual({ value: 24, expression: '4 x 6' });
    expect(tryArithmeticAnswer('12 chia 3')).toEqual({ value: 4, expression: '12 chia 3' });
    expect(tryArithmeticAnswer('không có phép tính')).toBeNull();
    expect(extractNumbers('Có 4 tấm bìa, mỗi tấm 6 chấm tròn.')).toEqual([4, 6]);
  });
});

describe('detectTeacherIntent', () => {
  it('recognizes a greeting and a named student invitation', () => {
    expect(detectTeacherIntent('Xin chào các em!')).toMatchObject({ intent: 'greeting' });
    expect(detectTeacherIntent('Cô mời Minh Anh trả lời câu hỏi.', ['Minh Anh'])).toMatchObject({
      intent: 'call_student',
      calledStudentName: 'Minh Anh',
    });
  });

  it('recognizes transitions, group work and exercises', () => {
    expect(detectTeacherIntent('Chúng ta chuyển sang hoạt động tiếp theo nhé.')).toMatchObject({
      intent: 'transition',
    });
    expect(detectTeacherIntent('Các em thảo luận nhóm đôi trong 2 phút.')).toMatchObject({
      intent: 'group_work',
    });
    expect(detectTeacherIntent('Các em làm bài tập số 1 vào vở.')).toMatchObject({ intent: 'exercise' });
  });
});
