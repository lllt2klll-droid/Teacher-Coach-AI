# Kiến trúc — Teacher Coach AI

## 1. Mục tiêu kiến trúc

- **Local-first:** mọi dữ liệu luyện tập và bài trình chiếu nằm trong IndexedDB của trình duyệt; không cần tài khoản hay backend lưu trữ.
- **Slide local-first:** `.pptx` và PDF (nếu có) chỉ được đọc trong trình duyệt, không tải lên máy chủ. Không lưu file gốc; chỉ lưu văn bản/bố cục/ảnh trích xuất, văn bản từng trang PDF và ảnh từng trang PDF.
- **Bằng chứng trước, điểm sau:** mỗi chỉ số/báo cáo phải truy vết được về một mẫu dữ liệu (lời giảng, sự kiện lớp học, mẫu âm thanh, mẫu tư thế).
- **AI có thể thay thế:** lớp học hoạt động đầy đủ bằng quy tắc cục bộ; Gemini chỉ là lớp tăng cường qua proxy.
- **Quyền riêng tư mặc định:** camera/micro tắt, ghi hình tắt, video không rời thiết bị; khóa Gemini ưu tiên ở server, khóa nhập trong tab chỉ tồn tại trong `sessionStorage` và chỉ đi tới proxy cùng nguồn.
- **DEMO tách biệt:** dữ liệu DEMO có cờ `isDemo`, được hiển thị riêng và loại khỏi thống kê thật.

## 2. Sơ đồ tổng thể

```
┌────────────────────────────────────────────────────────────────────┐
│ Trình duyệt (React 19 + Vite)                                      │
│                                                                    │
│  Pages ──► Hooks ──► Services ──► Repositories ──► Dexie/IndexedDB │
│    │        │            │                                        │
│    │        │            ├─ lesson parser / NLP                    │
│    │        │            ├─ classroom simulation                   │
│    │        │            ├─ presentation parser / PDF renderer      │
│    │        │            ├─ report builder / feedback engine       │
│    │        │            └─ training evaluator                     │
│    │        │                                                      │
│    │        ├─ useCamera / useMicrophone / usePoseAnalysis         │
│    │        └─ useLiveSession / useSessionRecording                │
│    │                                                               │
│    └─ AI provider (local rules | Gemini client)                    │
│                                                                    │
│  MediaPipe WASM + model (public/)          Web Speech API          │
└───────────────────────────┬────────────────────────────────────────┘
                            │ chỉ khi người dùng chọn Gemini
                            │ (tùy chọn) x-gemini-key: khóa nhập trong tab
                            ▼
        POST /api/ai   (Vercel Function hoặc Vite dev proxy)
                            │ khóa hiệu lực: client key → GEMINI_API_KEY
                            ▼
                    Google Gemini API
```

## 3. Phân lớp

| Lớp | Vị trí | Trách nhiệm |
| --- | --- | --- |
| Trang | `src/pages` | Bố cục, luồng người dùng, gọi hook/service |
| Thành phần | `src/components` | UI nguyên tử, AppShell, lớp học, media, biểu đồ |
| Hook | `src/hooks` | Vòng đời phiên, thiết bị, nhận dạng giọng nói, ghi hình, theme |
| Dịch vụ | `src/services` | Parser, NLP, mô phỏng, bài trình chiếu (PPTX/PDF), phân tích, báo cáo, xuất báo cáo, training |
| Provider | `src/providers` | Hợp đồng AI; triển khai local rules và Gemini |
| Dữ liệu | `src/data` | Dexie schema, repository, seed, backup, bài luyện |
| Store | `src/store` | Cài đặt (Zustand persist), toast |
| Kiểu | `src/types` | Domain model và settings |
| Server | `api`, `server` | Proxy Gemini dùng chung, phân giải khóa client/server, rate limit, prompt/schema, redact khóa |

## 4. Tuyến đường

| Route | Trang | Ghi chú |
| --- | --- | --- |
| `/onboarding` | Onboarding 4 bước | Luôn truy cập được để xem lại |
| `/` | Tổng quan | |
| `/lessons` | Thư viện KHBD | |
| `/lessons/upload` | Tải kế hoạch | PDF/DOCX/TXT/dán |
| `/lessons/:id/review` | Kiểm tra & xác nhận | Sửa cấu trúc trước khi dùng |
| `/classroom` | Lớp học AI | Quản lý hồ sơ học sinh hư cấu |
| `/practice` | Thiết lập buổi luyện | Hỗ trợ `?lesson=` và `?training=` |
| `/practice/:sessionId/live` | Phòng luyện | Ngoài AppShell để tập trung |
| `/presentation/:lessonPlanId` | Cửa sổ trình chiếu | Route riêng, đồng bộ slide với phòng luyện qua BroadcastChannel |
| `/reports` | Danh sách báo cáo | Tách thật/DEMO |
| `/reports/:reportId` | Chi tiết báo cáo | Bằng chứng, năng lực, timeline |
| `/training` | Trung tâm luyện tập | 14 bài luyện + kết quả |
| `/settings` | Cài đặt | Hồ sơ, giao diện, AI, dữ liệu, thiết bị |

`RequireOnboarding` chặn các tuyến ứng dụng cho đến khi `hasSeenOnboarding = true`. Đặt lại cài đặt **không** đặt lại cờ này.

## 5. Mô hình dữ liệu (IndexedDB `teacher-coach-ai`, schema v3)

Bảng `presentations` được thêm ở schema v3 (IndexedDB version 30). File PPTX/PDF gốc **không** được lưu; chỉ dữ liệu đã trích xuất, văn bản trang PDF và ảnh trang PDF.

| Bảng | Khóa / index chính | Nội dung |
| --- | --- | --- |
| `profile` | `id` | Hồ sơ giáo viên |
| `lessons` | `id, updatedAt, parsingStatus, subject, grade, isDemo` | Kế hoạch bài dạy đã trích xuất/xác nhận |
| `students` | `id, isDemo, name` | Học sinh AI hư cấu |
| `sessions` | `id, startedAt, status, lessonPlanId, isDemo` | Buổi luyện; có `trainingExerciseId?`, `reportId?` |
| `observations` | `id, sessionId, kind, timestamp, [sessionId+kind], [sessionId+timestamp]` | Mẫu audio/pose |
| `transcripts` | `id, sessionId, startTime, [sessionId+startTime]` | Lời giáo viên/học sinh, nguồn `manual`/`speech`/`ai` |
| `classroomEvents` | `id, sessionId, timestamp, [sessionId+timestamp]` | Giơ tay, trả lời, mất tập trung… |
| `feedback` | `id, sessionId, timestamp, [sessionId+timestamp]` | Gợi ý coaching trực tiếp + bằng chứng |
| `reports` | `id, sessionId, createdAt, lessonPlanId, isDemo` | Báo cáo tổng hợp |
| `trainingResults` | v2: `id, exerciseId, sessionId, completedAt` | Kết quả bài luyện có tiêu chí |
| `recordings` | `sessionId` | Blob ghi hình/ghi âm cục bộ (tùy chọn) |
| `presentations` | v3: `id, &lessonPlanId, updatedAt` | Văn bản/bố cục/ảnh PPTX + văn bản và ảnh trang PDF (nếu đính kèm) của một bài dạy |
| `meta` | `key` | Cờ seed DEMO, opt-out… |

Quan hệ chính: `lesson 1—n session`, `lesson 1—0..1 presentation`, `session 1—n observation/transcript/event/feedback`, `session 1—1 report`, `session 1—0..1 trainingResult`.

### Quy ước DEMO

- `lesson.isDemo` → `createPracticeSession` sao chép thành `session.isDemo` → `report.isDemo` → `trainingResult.isDemo`.
- Dashboard, báo cáo, training và biểu đồ chỉ tính bản ghi `isDemo !== true`.
- Xóa một buổi luyện sẽ xóa cascade observation/transcript/event/feedback/report/trainingResult/recording tương ứng (repository).
- Seed chỉ tạo **một bài học DEMO** và hồ sơ học sinh; không tạo session/report.

## 6. Vòng đời phiên luyện

```
createPracticeSession()
        │ status = ready
        ▼
[Phòng luyện: preflight]
        │ người dùng bấm "Bắt đầu"
        ▼
      active ──► paused ──► active
        │
        │ autosave durationSec, transcript, events, observations
        │ (IndexedDB)
        ▼
"Kết thúc" ──► finalizePracticeSession()
        │ status = completed, endedAt
        │ dựng báo cáo + training result từ dữ liệu đã lưu
        ▼
   report + trainingResult + session.reportId
```

- Nếu tab bị đóng/tải lại khi phiên đang `active`/`paused`, lần mở sau phát hiện phiên dở dang và cho phép kết thúc/khôi phục.
- Thời lượng phiên bị gián đoạn dùng `session.durationSec` đã autosave, **không** dùng chênh lệch đồng hồ tường (tránh cộng thời gian tab đóng).
- `finalizePracticeSession` idempotent: báo cáo cũ được giữ `id`/`createdAt`, training result cũ được giữ `id`.

## 7. Luồng phân tích & báo cáo

### 7.1 Lời giảng → chỉ số

- Nhập tay hoặc Web Speech API → `TranscriptSegment` (`speaker: teacher`).
- NLP tiếng Việt (`services/nlp/vietnamese.ts`):
  - chuẩn hóa dấu, so khớp **theo ranh giới từ** (tránh “ai” trong “bài”);
  - phân loại câu hỏi đóng/mở/gợi mở/kiểm tra/vận dụng;
  - nhận diện khen, động viên, chào, chuyển hoạt động, tổng kết;
  - trích phép tính đơn giản.
- `PhaseTracker` ánh xạ lời giảng/sự kiện sang hoạt động của kế hoạch.

### 7.2 Âm thanh

- `useMicrophone` lấy `MediaStream` sau khi người dùng bấm; Web Audio API tính RMS → dB, phát hiện speech activity, khoảng lặng.
- `useLiveSession` lưu `AudioObservation` theo cửa sổ thời gian.
- Báo cáo tính thời gian nói, âm lượng trung bình/độ biến thiên, số khoảng lặng, tốc độ nói ước tính.
- Học sinh AI trả lời bằng **văn bản**, nên `studentSpeakingSec = 0`; giao diện ghi chú rõ thay vì suy diễn.

### 7.3 Tư thế

- `useCamera` lấy video sau khi bấm; video gắn vào thẻ `<video>` cục bộ.
- `usePoseAnalysis` chạy MediaPipe Tasks Vision với WASM/model trong `public/`.
- `pose-analyzer` tính độ hiển thị, lệch tâm, nghiêng vai, độ ổn định, cường độ chuyển động, tỷ lệ cử chỉ tay.
- Không lưu ảnh/video vào observation; chỉ lưu **số đo** và keypoint cần thiết.

### 7.4 Chấm điểm

Sáu nhóm năng lực (`CATEGORY_WEIGHTS`):

| Nhóm | Trọng số | Nguồn dữ liệu tối thiểu |
| --- | --- | --- |
| Ngôn ngữ sư phạm | 0.25 | ≥ 5 lượt lời giảng và ≥ 40 từ |
| Tổ chức hoạt động | 0.15 | Tiến trình hoạt động + chuyển tiếp |
| Tương tác và xử lý | 0.15 | Sự kiện lớp học/trả lời |
| Giọng nói | 0.20 | ≥ 20 giây có tiếng nói |
| Tư thế và cử chỉ | 0.20 | ≥ 30 mẫu, độ hiển thị ≥ 0.45 |
| Tác phong trình bày | 0.05 | Kết hợp speech/pose |

- Mỗi nhóm có `score: number | null`; nhóm thiếu dữ liệu có `insufficientData = true` và **không** bị tính là 0.
- Điểm tổng chỉ xuất hiện khi có **≥ 2 nhóm đủ dữ liệu** và độ tin cậy tổng hợp **≥ 0.45**.
- Điểm tổng = trung bình có trọng số `CATEGORY_WEIGHTS × confidence` trên các nhóm đủ dữ liệu.
- Bằng chứng (`EvidenceItem`) lấy từ feedback event và các sự kiện lớn (câu hỏi, khen, chuyển tiếp, phủ hoạt động, tương tác, tư thế…). Không có bằng chứng nghĩa là không có kết luận.

### 7.5 Coaching trực tiếp

- `FeedbackEngine` chạy theo cửa sổ trượt (transcript, audio, pose, tiến trình).
- Mỗi luật có `cooldownSec`, `minElapsed`, tần suất; tránh lặp cùng một gợi ý.
- Mỗi gợi ý có: quan sát thực tế, diễn giải, giải thích, khuyến nghị, độ tin cậy.
- Tần suất người dùng chọn (ít/vừa/nhiều) điều chỉnh ngưỡng hiển thị.

## 8. Mô phỏng lớp học

`ClassroomSimulation` nhận lời giảng + ý định giáo viên, sau đó:

1. Cập nhật trạng thái học sinh (chú ý, giơ tay, làm việc…).
2. Chọn học sinh phù hợp theo tính cách, mức tham gia, lịch sử.
3. Gọi `AIProvider.generateStudentResponse()` để sinh lời thoại.
4. Phát sự kiện `ClassroomEvent` + transcript học sinh.
5. Kích hoạt tình huống (nếu chế độ tình huống): giơ tay nhiều, im lặng, chưa hiểu, câu hỏi lạc đề, trả lời sai, tranh luận…

- Chế độ `natural`: phản hồi tự nhiên.
- Chế độ `scenario`: sự kiện kịch bản do luật cục bộ điều khiển; có thể ép chất lượng câu trả lời.
- Chế độ `focused`: giới hạn theo hoạt động/bài tập trọng tâm và bài luyện.

Học sinh AI dùng RNG có seed theo phiên/nhân vật để hành vi ổn định trong cùng một phiên, nhưng không tạo “điểm” ngẫu nhiên.

## 9. Trừu tượng AI

```ts
interface AIProvider {
  id: 'local' | 'gemini';
  testConnection(): Promise<...>;
  generateStudentResponse(input): Promise<StudentResponseOutput>;
  classifyTeacherIntent(text, names): Promise<TeacherIntentResult>;
  analyzeTeachingLanguage(segments): Promise<LanguageAnalysisResult>;
  summarizeSession(session, report, transcript): Promise<... | null>;
}
```

- `local` (mặc định): luật tiếng Việt, không mạng, không gửi dữ liệu.
- `gemini`: gọi `/api/ai` với `action: 'student.respond'` hoặc `'session.summarize'`.
- Lỗi mạng/429/503 → `useLiveSession`/finalizer bắt lỗi và fallback local; UI hiển thị trạng thái.
- **Phân giải khóa phía server:** khóa gửi qua header `x-gemini-key` được ưu tiên; nếu không có, dùng `GEMINI_API_KEY` của môi trường. Phản hồi ghi `source: 'client' | 'server' | 'none'`.
- **Khóa nhập trong tab:** chỉ lưu `sessionStorage` (`teacher-coach-gemini-key`), không vào IndexedDB/backup. Client chỉ gửi khóa khi endpoint là tương đối hoặc cùng origin; endpoint tuyệt đối khác nguồn không bao giờ nhận khóa.
- **Một lệnh dev:** plugin Vite (`localAiProxy`) chạy cùng `handleAiRequest` tại `/api/ai`, nên `npm run dev` hỗ trợ cả khóa server và khóa nhập trong tab. `npm run dev:ai` là proxy Node độc lập tùy chọn.
- Payload bị giới hạn 90.000 ký tự, rate limit 30 yêu cầu/phút/IP, timeout 22 giây; mọi lỗi được redact chuỗi dạng `AIza…` trước khi trả về.

## 10. Parser kế hoạch bài dạy

1. Trích văn bản: PDF (pdfjs, giữ thứ tự dòng), DOCX (mammoth), TXT, dán trực tiếp.
2. Chuẩn hóa xuống dòng/khoảng trắng; loại tiêu đề trang, số trang.
3. Nhận diện tiêu đề bài (“Bài n: …”), môn, lớp, thời lượng.
4. Tách mục lớn (Mục tiêu, Đồ dùng, Hoạt động…), tránh tách nhầm câu nội dung đánh số.
5. Trong mỗi hoạt động: tách hành động giáo viên/học sinh, câu hỏi, câu trả lời dự kiến, vật liệu, thời lượng.
6. Sinh `confidence`, `parsingIssues`; người dùng kiểm tra/sửa/xác nhận trước khi luyện.

Parser **không** gọi AI cloud. Kết quả có thể sai; UI luôn yêu cầu xác nhận.

## 11. Bài trình chiếu (PPTX + PDF hiển thị)

### 11.1 Đọc PPTX cục bộ

- `services/presentation/pptx-parser.ts` mở package bằng JSZip, đọc `presentation.xml`, relationships, slide, layout và master. Không có network request.
- Trích thứ tự slide, văn bản/run (đậm/nghiêng/màu/cỡ chữ), theme, nền, placeholder, group, ảnh có crop, bảng đơn giản; bỏ qua chart/SmartArt/transition kèm cảnh báo.
- **Kế thừa layout/master:** shape trên slide thường không có `a:xfrm` mà lấy hình học từ layout/master. Parser hợp nhất placeholder theo từng trường (rect, font size, anchor) thay vì ghi đè bằng `undefined`.
- File gốc bị bỏ sau khi đọc. `PresentationDoc` chỉ chứa metadata, text/layout và blob ảnh trích xuất; giới hạn 60 MB, 12 MB/ảnh, 45 MB tổng ảnh.

### 11.2 Lớp hiển thị PDF (tùy chọn)

- Trình duyệt không thể tái tạo chính xác 100% PPTX. Giáo viên có thể xuất PDF từ chính file PPTX bằng PowerPoint rồi đính kèm.
- `pdf-visual.ts` dùng pdfjs đọc PDF cục bộ, render từng trang lên canvas rồi lưu JPEG (rộng 1600 px, chất lượng 0.9, tối đa 120 trang/80 MB ảnh, PDF tối đa 80 MB).
- Render dùng `intent: 'print'` để không phụ thuộc `requestAnimationFrame` — tab bị ẩn/throttle không làm treo chuyển đổi.
- Mỗi trang cũng được đọc text layer bằng `getTextContent()`; `textFromPdfItems()` gom text item thành dòng và lưu vào `pageTexts` (tối đa 8.000 ký tự/trang). Trang chỉ có ảnh để trống, không OCR.
- Mỗi ảnh là `PresentationAsset` với `partPath: pdf/page-N.jpg`; slide nhận `visualAssetId` và `visualText` (văn bản trang PDF tương ứng). `visualMode = 'pdf'` khi có ít nhất một trang.
- `SlideRenderer` ưu tiên ảnh PDF; slide không có ảnh (PDF thiếu trang/lỗi trang) quay về bản mô phỏng HTML. Thay PPTX sẽ xóa lớp PDF cũ; **Bỏ bản PDF** trả về HTML và xóa `visualText`.
- PDF gốc không được lưu hay upload; chỉ ảnh JPEG và văn bản trích từ trang được giữ.

### 11.3 Ngữ cảnh cho AI

- `buildPresentationContext()` gửi **slide hiện tại**: số trang, tổng slide, tiêu đề, văn bản và dàn ý tiêu đề. Không gửi toàn bộ deck.
- Khi có lớp PDF, `visualText` của trang đang chiếu được ưu tiên làm `text` và dòng đầu tiên được dùng làm `title`; `text` PPTX chỉ là fallback cho trang PDF không có text layer.
- Local provider trả lời câu hỏi về tên đề/tiêu đề/nội dung đang chiếu từ slide hiện tại trước khi tra kế hoạch bài dạy; câu trả lời bám slide cũng ưu tiên khi giáo viên nhắc “trên slide”, “trang này”, “quan sát”…
- Gemini nhận trường `baiTrinhChieu` trong payload. Prompt nói rõ slide hiện tại là nguồn đúng cho những gì đang hiển thị; không dùng tên kế hoạch bài dạy nếu khác.

### 11.4 Sân khấu & đồng bộ

- Bốn bố cục trong `settings.presentationLayout`: `slide_main`, `tabs`, `side`, `window`.
- `SlideViewer` có chuyển slide, thumbnail, phím ← →, toàn màn hình; không có bút chú thích.
- Cửa sổ `/presentation/:lessonPlanId` đồng bộ qua `BroadcastChannel` tên `teacher-coach-presentation:<lessonPlanId>`: cửa sổ chính gửi `slide`, cửa sổ phụ gửi `request-state`/`navigate`.
- Gợi ý slide theo hoạt động đang dạy (`suggestSlideForPhase`) chỉ hiện khi có điểm khớp thật.

### 11.5 Lưu trữ, sao lưu, xóa

- Bảng `presentations` không nằm trong bản sao lưu (file JSON) để tránh phình dung lượng; ảnh PPTX/PDF cũng không.
- Xóa kế hoạch bài dạy sẽ xóa cascade presentation tương ứng. Xóa toàn bộ dữ liệu xóa cả bảng này.
- Object URL cho ảnh do `usePresentationAssets` tạo và thu hồi khi đổi bài/unmount.

## 12. Sao lưu / khôi phục

- `createBackup()` xuất JSON gồm profile, lessons, students, sessions, observations, transcripts, events, feedback, reports, trainingResults.
- **Không** xuất `recordings` (video/audio), `presentations` (văn bản/bố cục/ảnh slide và ảnh PDF) và không xuất cài đặt localStorage.
- `validateBackup()` kiểm tra định dạng, schema, bảng bắt buộc, khóa chính tối thiểu. Schema hiện tại là v3 (IndexedDB version 30); bản sao lưu vẫn đọc được schema v2 cũ.
- `importBackup(mode)`:
  - `replace`: xóa các bảng dữ liệu (trừ recordings và presentations) rồi ghi đè.
  - `merge`: `bulkPut` theo khóa, giữ dữ liệu hiện có không trùng.
- File quá lớn (> 80 MB) bị từ chối trước khi đọc.

## 13. Bảo mật & quyền riêng tư

| Rủi ro | Biện pháp |
| --- | --- |
| Lộ khóa Gemini | Ưu tiên `GEMINI_API_KEY` ở server; khóa nhập trong tab chỉ nằm `sessionStorage`, chỉ gửi tới proxy cùng nguồn qua `x-gemini-key`; server không ghi log/không trả lại khóa; lỗi được redact chuỗi `AIza…` |
| Khóa còn lại sau khi dùng | Khóa trong tab bị xóa khi đóng tab; nút **Xóa** xóa ngay; khóa không nằm trong IndexedDB, file sao lưu hay bản ghi |
| Gửi nhầm dữ liệu | Mặc định local; Gemini chỉ khi người dùng chọn; payload rút gọn |
| Lưu video ngoài ý muốn | Ghi hình mặc định tắt; chỉ lưu local; không vào backup |
| Nhận diện khuôn mặt/cảm xúc | Không dùng model nhận diện; chỉ pose keypoints; UI nói rõ |
| Dữ liệu tồn tại sau khi xóa | `deleteAllUserData()` xóa toàn bộ bảng, gồm cả recording; **Xóa toàn bộ dữ liệu** cũng xóa khóa Gemini trong `sessionStorage`; bootstrap lại hồ sơ/personas/DEMO |
| Rò rỉ file bài giảng | PPTX/PDF chỉ đọc cục bộ bằng JSZip/pdfjs, không gọi mạng; file gốc không được lưu, chỉ lưu văn bản/bố cục/ảnh trích xuất, văn bản trang PDF trong IndexedDB; lớp PDF nằm ngoài bản sao lưu |
| Leo thang chi phí API | Rate limit/IP, giới hạn payload, timeout 22 giây, fallback local |

## 14. Triển khai

- **Local:** `npm run dev` (Vite + proxy `/api/ai` tích hợp). `npm run dev:ai` chỉ cần khi muốn chạy proxy Node riêng ở cổng 8787.
- **Vercel:** build Vite → `dist`; function `api/ai.js`; `vercel.json` rewrite SPA; env `GEMINI_API_KEY`, `GEMINI_MODEL`. Người dùng vẫn có thể nhập khóa riêng trong tab nếu server không đặt env.
- **Assets:** `prebuild` chạy `scripts/setup-assets.mjs` để đảm bảo model/WASM trong `public/`.
- Không có cơ sở dữ liệu server, không có upload file người dùng.

## 15. Quyết định thiết kế quan trọng

1. **Local-first thay vì cloud sync** — giảm rủi ro dữ liệu trẻ em/giáo viên, chạy offline.
2. **Báo cáo từ dữ liệu đã lưu** — cho phép khôi phục sau crash và kiểm toán bằng chứng.
3. **Điểm `null` thay vì 0** — không trừng phạt khi thiếu camera/micro.
4. **DEMO có cờ xuyên suốt** — không thể vô tình trộn vào thống kê thật.
5. **AI local là mặc định** — Gemini là tùy chọn, có thể tắt hoàn toàn.
6. **Không dùng LLM để chấm điểm** — điểm đến từ phép đo/luật; LLM chỉ tạo lời thoại/tóm tắt.
7. **BYOK có kiểm soát** — khóa nhập trong tab là tiện ích cho máy cá nhân; chỉ lưu `sessionStorage`, chỉ gửi proxy cùng nguồn. Khóa server vẫn là lựa chọn khuyến nghị cho triển khai thật.
8. **In báo cáo từ dữ liệu đã lưu** — HTML tự chứa, escape nội dung, không gọi mạng; người dùng dùng hộp thoại in của trình duyệt để lưu PDF.
9. **Nội dung đang chiếu là nguồn ưu tiên** — PowerPoint không thể được tái tạo chính xác trong trình duyệt, nên PDF xuất từ chính PPTX được render thành ảnh để hiển thị đúng bản gốc. Text layer của đúng trang PDF được dùng làm ngữ cảnh AI (fallback PPTX khi trang không có text), để học sinh AI trả lời theo slide đang chiếu thay vì tên bài trong kế hoạch. Nhờ vậy không cần viết lại layout engine của PowerPoint và không đánh đổi chất lượng sư phạm.
10. **Không lưu file gốc bài giảng** — chỉ giữ dữ liệu trích xuất và ảnh trang; giảm dung lượng, tránh vô tình phân phối lại file của giáo viên, và giữ đúng cam kết local-first. **Bỏ bản PDF** luôn khôi phục được bản mô phỏng từ PPTX.
