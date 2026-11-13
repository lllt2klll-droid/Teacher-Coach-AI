import type { EvidenceSource, SessionReport, TrainingResult } from '@/types/domain';
import { formatClock, formatDate, formatTimestamp } from '@/lib/format';

const SOURCE_LABELS: Record<EvidenceSource, string> = {
  transcript: 'Lời giảng',
  audio: 'Micro',
  pose: 'Camera / tư thế',
  classroom: 'Sự kiện lớp học',
  lesson: 'Kế hoạch bài dạy',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function scoreLabel(score: number | null): string {
  return score === null ? 'Chưa đủ dữ liệu' : `${score}/100`;
}

function listInsights(
  items: SessionReport['strengths'],
  emptyText: string,
): string {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<ul class="insights">${items
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.title)}</strong><br />${escapeHtml(item.detail)}${
          item.evidenceIds.length
            ? ` <span class="muted">(${item.evidenceIds.length} bằng chứng)</span>`
            : ''
        }</li>`,
    )
    .join('')}</ul>`;
}

function renderTraining(training: TrainingResult | null | undefined): string {
  if (!training) return '';
  const criteria = training.criteriaResults
    .map((criterion) => {
      const result =
        criterion.met === null ? 'Chưa đủ dữ liệu' : criterion.met ? 'Đạt' : 'Chưa đạt';
      return `<tr><td>${escapeHtml(criterion.label)}</td><td>${escapeHtml(criterion.target)}</td><td>${escapeHtml(
        criterion.observed ?? '—',
      )}</td><td>${result}</td></tr>`;
    })
    .join('');
  return `
    <section>
      <h2>Bài luyện trọng tâm</h2>
      <p><strong>${escapeHtml(training.exerciseTitle)}</strong> · Điểm tiêu chí: ${escapeHtml(
        scoreLabel(training.score),
      )} · ${training.passed === null ? 'Chưa đủ dữ liệu' : training.passed ? 'Đạt' : 'Chưa đạt'}</p>
      <table>
        <thead><tr><th>Tiêu chí</th><th>Mục tiêu</th><th>Quan sát</th><th>Kết quả</th></tr></thead>
        <tbody>${criteria}</tbody>
      </table>
    </section>`;
}

/**
 * Builds a standalone printable HTML document. The report content is data
 * already stored in IndexedDB; formatting never invents scores.
 */
export function buildReportHtml(
  report: SessionReport,
  training?: TrainingResult | null,
): string {
  const metrics = report.metrics;
  const competencies = report.competencies
    .map(
      (competency) => `<tr>
        <td>${escapeHtml(competency.label)}</td>
        <td>${escapeHtml(scoreLabel(competency.score))}</td>
        <td>${Math.round(competency.confidence * 100)}%</td>
        <td>${escapeHtml(competency.notes)}</td>
      </tr>`,
    )
    .join('');
  const evidence = report.evidence.length
    ? `<table>
        <thead><tr><th>Thời điểm</th><th>Nguồn</th><th>Quan sát</th><th>Diễn giải</th><th>Tin cậy</th></tr></thead>
        <tbody>${report.evidence
          .map(
            (item) => `<tr>
              <td>${formatTimestamp(item.timestamp)}</td>
              <td>${escapeHtml(SOURCE_LABELS[item.source] ?? item.source)}</td>
              <td>${escapeHtml(item.observedFact)}</td>
              <td>${escapeHtml(item.interpretation)}</td>
              <td>${Math.round(item.confidence * 100)}%</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>`
    : '<p class="muted">Chưa có bằng chứng ghi nhận trong buổi luyện.</p>';
  const phases = report.phaseProgress.length
    ? `<ul class="phases">${report.phaseProgress
        .map(
          (phase) =>
            `<li><span class="${phase.covered ? 'ok' : 'miss'}">${phase.covered ? '✓' : '—'}</span> ${escapeHtml(
              phase.name,
            )} <span class="muted">(${Math.round(phase.coverageConfidence * 100)}% tin cậy)</span></li>`,
        )
        .join('')}</ul>`
    : '<p class="muted">Chưa có tiến trình hoạt động.</p>';
  const aiSummary = report.aiSummary
    ? `<section class="ai">
        <h2>Tóm tắt ngôn ngữ do Gemini tạo</h2>
        <p>${escapeHtml(report.aiSummary.summary)}</p>
        <p class="muted">Phần tóm tắt không thay đổi điểm số hay bằng chứng trong báo cáo.</p>
      </section>`
    : '';
  const recommendations = report.recommendations.length
    ? `<ul class="recommendations">${report.recommendations
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</ul>`
    : '<p class="muted">Chưa có gợi ý bổ sung.</p>';

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Báo cáo luyện tập · ${escapeHtml(report.lessonTitle)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Be Vietnam Pro", "Segoe UI", Arial, sans-serif;
      color: #1f2937;
      font-size: 12px;
      line-height: 1.55;
      background: #fff;
    }
    h1 { margin: 2px 0 4px; font-size: 24px; line-height: 1.2; }
    h2 { margin: 20px 0 8px; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    p { margin: 4px 0; }
    .brand { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #4f6ef7; }
    .meta { color: #6b7280; font-size: 11px; }
    .demo { margin: 10px 0; padding: 8px 10px; border: 1px solid #f0c36d; background: #fff8e6; font-weight: 700; }
    .score-row { display: flex; gap: 16px; align-items: stretch; margin-top: 12px; }
    .score { width: 170px; border: 1px solid #dfe3ea; border-radius: 10px; padding: 14px; text-align: center; }
    .score strong { display: block; font-size: 34px; line-height: 1; color: #243b8f; }
    .score small { color: #6b7280; }
    .summary { flex: 1; border: 1px solid #dfe3ea; border-radius: 10px; padding: 10px 12px; }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 12px; }
    .metric span { display: block; color: #6b7280; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; }
    .metric strong { font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; page-break-inside: auto; }
    th, td { border: 1px solid #e5e7eb; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #f6f7fb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    tr { page-break-inside: avoid; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .insights, .recommendations, .phases { margin: 4px 0; padding-left: 18px; }
    .insights li, .recommendations li, .phases li { margin: 4px 0; }
    .muted { color: #6b7280; font-size: 10.5px; }
    .ai { border: 1px solid #d9d2ff; background: #f7f5ff; border-radius: 8px; padding: 8px 12px; }
    .ok { color: #15803d; font-weight: 700; }
    .miss { color: #9ca3af; font-weight: 700; }
    footer { margin-top: 22px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #6b7280; font-size: 9.5px; }
    @page { size: A4; margin: 14mm; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <header>
    <div class="brand">Teacher Coach AI</div>
    <h1>${escapeHtml(report.lessonTitle)}</h1>
    <p class="meta">Báo cáo luyện tập · ${escapeHtml(formatDate(report.createdAt, true))} · Tổng hợp ${
      report.generatedBy === 'gemini' ? 'có hỗ trợ Gemini' : 'bằng quy tắc cục bộ'
    } · Độ tin cậy ${Math.round(report.overallConfidence * 100)}%</p>
  </header>
  ${report.isDemo ? '<div class="demo">DEMO · Báo cáo này dùng bài học DEMO và không được tính vào thống kê thật.</div>' : ''}
  <section class="score-row">
    <div class="score">
      <span class="muted">Điểm tổng</span>
      <strong>${report.overallScore === null ? '—' : report.overallScore}</strong>
      <small>${report.overallScore === null ? 'Chưa đủ dữ liệu để chấm' : '/100'}</small>
      <p class="muted">Chỉ gồm các nhóm năng lực đủ dữ liệu.</p>
    </div>
    <div class="summary">
      <div class="metrics">
        <div class="metric"><span>Thời lượng</span><strong>${formatClock(metrics.durationSec)}</strong></div>
        <div class="metric"><span>Câu hỏi</span><strong>${metrics.questionCount}</strong></div>
        <div class="metric"><span>Câu hỏi mở</span><strong>${metrics.openQuestionCount}</strong></div>
        <div class="metric"><span>Lượt học sinh</span><strong>${metrics.studentTurns}</strong></div>
        <div class="metric"><span>Giơ tay</span><strong>${metrics.handRaiseCount}</strong></div>
        <div class="metric"><span>Phủ hoạt động</span><strong>${metrics.coveredPhaseCount}/${metrics.phaseCount}</strong></div>
        <div class="metric"><span>Thời gian nói</span><strong>${metrics.teacherSpeakingSec}s</strong></div>
        <div class="metric"><span>Tỷ lệ nói</span><strong>${Math.round(metrics.speechRatio * 100)}%</strong></div>
        <div class="metric"><span>Bằng chứng</span><strong>${report.evidence.length}</strong></div>
      </div>
    </div>
  </section>
  ${aiSummary}
  <section>
    <h2>Điểm năng lực</h2>
    <table>
      <thead><tr><th>Nhóm năng lực</th><th>Điểm</th><th>Tin cậy</th><th>Ghi chú</th></tr></thead>
      <tbody>${competencies}</tbody>
    </table>
  </section>
  <div class="two-col">
    <section><h2>Điểm mạnh</h2>${listInsights(report.strengths, 'Chưa có điểm mạnh đủ dữ liệu.')}</section>
    <section><h2>Cần cải thiện</h2>${listInsights(report.improvements, 'Chưa có mục cải thiện đủ dữ liệu.')}</section>
  </div>
  <section><h2>Gợi ý tiếp theo</h2>${recommendations}</section>
  ${renderTraining(training)}
  <section><h2>Bằng chứng ghi nhận</h2>${evidence}</section>
  <section><h2>Tiến trình hoạt động</h2>${phases}</section>
  <footer>
    Báo cáo được tạo từ dữ liệu lưu cục bộ trên thiết bị của giáo viên. Không phải đánh giá chính thức và không thay thế
    nhận xét của giảng viên hướng dẫn. Chỉ số thiếu dữ liệu không được quy đổi thành điểm 0.
  </footer>
</body>
</html>`;
}

/**
 * Opens a print-ready window. Returns false when the browser blocks pop-ups so
 * the caller can show a clear message instead of failing silently.
 */
export function openReportPrintWindow(
  report: SessionReport,
  training?: TrainingResult | null,
): boolean {
  const win = window.open('', '_blank', 'width=980,height=1200');
  if (!win) return false;
  win.opener = null;
  win.document.open();
  win.document.write(buildReportHtml(report, training));
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    try {
      win.print();
    } catch {
      // The user can still use Ctrl+P from the opened window.
    }
  }, 400);
  return true;
}
