# Kiểm thử — Teacher Coach AI

## 1. Tóm tắt kết quả

| Hạng mục | Lệnh | Kết quả |
| --- | --- | --- |
| TypeScript strict | `npm run typecheck` | ✅ Không lỗi |
| Unit test | `npm run test` | ✅ 13 tệp, 58 test |
| Build production | `npm run build` | ✅ Thành công (chỉ cảnh báo dynamic import không hiệu quả) |
| Kiểm thử trình duyệt | thủ công | ✅ Các luồng chính + PPTX/PDF thật (xem mục 3) |
| Camera/mic thật | thủ công | ⚠️ Chưa xác minh trong môi trường này |
| Gemini thật | thủ công | ⚠️ Chưa có khóa hợp lệ; đã xác minh nhập khóa, chuyển khóa, redact và fallback |

## 2. Unit test tự động

Chạy:

```bash
npm run test
```

Kết quả hiện tại:

```
Test Files  13 passed (13)
Tests       58 passed (58)
```

| Tệp | Số test | Phạm vi |
| --- | --- | --- |
| `src/services/lesson/lesson-parser.test.ts` | 5 | Tiêu đề, mục tiêu đánh số, hoạt động, câu hỏi/đáp án, chốt lời giải |
| `src/services/nlp/vietnamese.test.ts` | 7 | Câu hỏi mở/đóng/gợi mở, ý định giáo viên, khen/động viên, so khớp ranh giới từ |
| `src/services/analysis/report-builder.test.ts` | 3 | Chỉ số từ audio/transcript/event, bằng chứng, điểm thiếu dữ liệu |
| `src/services/analysis/feedback-engine.test.ts` | 5 | Luật coaching, cooldown, tần suất, ưu tiên |
| `src/services/training/evaluate-training.test.ts` | 6 | Tiêu chí, đơn vị, dữ liệu thiếu, kết quả đạt/chưa đạt |
| `src/services/presentation/pptx-parser.test.ts` | 4 | Đọc slide/ảnh/bảng, từ chối file sai, kế thừa hình học placeholder từ layout/master |
| `src/services/presentation/pdf-visual.test.ts` | 6 | Gắn ảnh PDF theo trang, thiếu trang, thay lớp PDF, cảnh báo, bỏ PDF, no-op |
| `src/services/presentation/presentation-context.test.ts` | 5 | Chỉ gửi slide hiện tại + dàn ý, clamp chỉ số, gợi ý slide theo hoạt động có căn cứ |
| `src/providers/local/local-provider.test.ts` | 5 | Không lặp “ạ ạ”, viết hoa sau “Thưa cô,”, giải thích phép nhân, ưu tiên ngữ cảnh slide |
| `src/test/ai-core.test.ts` | 4 | Không khóa → `none`; khóa server → `server`; khóa client ưu tiên; prompt Gemini có `baiTrinhChieu` |
| `src/lib/gemini-key.test.ts` | 3 | Chuẩn hóa khóa dán, kiểm tra định dạng mềm, che khóa |
| `src/providers/gemini/gemini-provider.test.ts` | 3 | Gửi `x-gemini-key` tới proxy cùng nguồn; không gửi khi trống; không gửi tới endpoint khác nguồn |
| `src/services/report/export-report.test.ts` | 2 | HTML in đủ điểm/bằng chứng/training; escape XSS và nhãn DEMO |

Các test dùng fixture dùng chung tại `src/test/fixtures.ts`, không gọi mạng, không phụ thuộc IndexedDB thật.

### Lệnh kiểm tra đầy đủ

```bash
npm run typecheck
npm run test
npm run build
```

`npm run build` tự chạy `prebuild` → `scripts/setup-assets.mjs` để đảm bảo model/WASM
tồn tại trước khi Vite đóng gói.

## 3. Kiểm thử trình duyệt — ma trận

Môi trường đã dùng: Chrome/Chromium của ứng dụng, Vite dev `http://127.0.0.1:5173`,
IndexedDB `teacher-coach-ai` schema v3 (IDB version 30, 13 bảng).

| # | Luồng | Kỳ vọng | Kết quả |
| --- | --- | --- | --- |
| 1 | Bootstrap lần đầu | Mở DB, tạo hồ sơ + 20 học sinh + 1 bài DEMO; không có session/report giả | ✅ 13 bảng, `lessons: 1` (DEMO), `sessions: 0`, `reports: 0` |
| 2 | Onboarding | Chặn route ứng dụng; “Bỏ qua” vào Tổng quan; mở lại được từ Cài đặt | ✅ |
| 3 | Tải PDF/DOCX/TXT/dán | Trích xuất cục bộ, hiển thị cấu trúc và confidence | ✅ Dán “Bài 56: Bảng nhân 5” → 3 mục tiêu, 5 hoạt động, 2 bài tập, 78% |
| 4 | Kiểm tra & xác nhận | Chỉ bài đã xác nhận mới luyện | ✅ |
| 5 | Luyện tự do | Tạo session `ready`, bấm Bắt đầu mới chạy | ✅ |
| 6 | Luyện DEMO | Gắn nhãn DEMO xuyên suốt session/report | ✅ Report `84/100`, 6 bằng chứng, 4/6 hoạt động |
| 7 | Báo cáo thật | Tạo từ dữ liệu, tách DEMO, hiển thị “chưa đủ dữ liệu” khi thiếu audio/pose | ✅ Report `56/100`, 5 câu hỏi, 3 câu mở, 5 lượt học sinh |
| 8 | Trung tâm luyện tập | Kết quả lưu bảng `trainingResults`, cập nhật thống kê | ✅ `question_five_checks`: đạt, `100/100`; thống kê thật 1 kết quả |
| 9 | DEMO không vào thống kê | Training/Reports loại `isDemo` | ✅ 1 báo cáo thật + 1 DEMO tách riêng; thống kê thật không cộng DEMO |
| 10 | Local AI | Phản hồi tiếng Việt, không lặp “ạ ạ”, không viết hoa sai sau dấu phẩy | ✅ Kiểm tra trực tiếp + unit test |
| 11 | Cài đặt hồ sơ | Lưu tên hiển thị | ✅ |
| 12 | Theme/accent | Lưu localStorage, áp dụng sau reload, không nháy sai | ✅ |
| 13 | AI lỗi/chưa cấu hình | Hiển thị lỗi, quay về local, không mất phiên | ✅ |
| 14 | Sao lưu | Xuất JSON đủ bảng, không có recording | ✅ |
| 15 | Nhập sao lưu | Chấp nhận file hợp lệ; từ chối file sai định dạng | ✅ |
| 16 | Xóa toàn bộ dữ liệu | Xóa bảng, giữ `hasSeenOnboarding`, seed lại personas/DEMO khi reload | ✅ |
| 17 | Schema v3 | `presentations` có index `lessonPlanId`, `updatedAt`; IDB version 30 | ✅ 13 bảng; presentation đọc/ghi được sau reload |
| 18 | Nhập khóa Gemini | Ô mật khẩu, lưu vào `sessionStorage`, hiện badge che khóa, giữ sau reload trong tab | ✅ Lưu `teacher-coach-gemini-key`; badge `Đã nhập AIza…7890`; reload vẫn còn |
| 19 | Chuyển khóa tới proxy | Header `x-gemini-key` chỉ gửi tới `/api/ai` cùng nguồn; lỗi không lộ khóa | ✅ Proxy trả `source: client`, HTTP 400 với khóa giả; `leakedKey: false` |
| 20 | Xóa khóa | Xóa `sessionStorage`, badge về “Chưa nhập khóa”, AI local vẫn chạy | ✅ |
| 21 | In / xuất PDF báo cáo | Cửa sổ in chứa tiêu đề, điểm, bằng chứng, training; chặn popup có thông báo | ✅ 9.175 ký tự HTML, `print()` được gọi, không lỗi console |
| 22 | Proxy AI khi `npm run dev` | `/api/ai` phản hồi `configured` đúng, không cần terminal thứ hai | ✅ Không khóa → `configured: false`; có header khóa → `configured: true` |
| 23 | Tải PPTX thật | Đọc đúng thứ tự slide, tiêu đề, văn bản; không upload file | ✅ PPTX do PowerPoint tạo: 3 slide, tiêu đề/nội dung đúng, 2 element/slide, 0 cảnh báo; Network không có request chứa file |
| 24 | Đính kèm PDF PowerPoint | Render đủ trang, lưu ảnh, hiển thị đúng bản gốc | ✅ 3 ảnh JPEG `pdf/page-1..3.jpg`, `visualMode: pdf`, badge **PDF gốc**, ảnh tự nhiên 1600×900 |
| 25 | Điều hướng & cửa sổ trình chiếu | Chuyển slide, ảnh đổi theo trang, không lỗi | ✅ **Slide tiếp theo** → 2/3, tiêu đề “Hoạt động nhóm”; cửa sổ `/presentation/...` hiện **PDF gốc 1/3**; console 0 lỗi |
| 26 | Bỏ bản PDF | Xóa ảnh PDF, giữ nguyên văn bản PPTX, quay về HTML | ✅ `visualMode: html`, `assets: []`, tiêu đề/text 3 slide không đổi |
| 27 | Thay PPTX | Xác nhận, đọc lại text, xóa lớp PDF cũ | ✅ Hộp thoại “Thay bài trình chiếu hiện tại?”; sau thay: `visualMode: html`, assets rỗng, text đúng |
| 28 | Lưu lớp PDF sau reload | Ảnh và `visualAssetId` còn nguyên | ✅ Reload vẫn `visualMode: pdf`, 3 trang, 3 `visualAssetId` |

### Bằng chứng kiểm thử tiêu biểu

- **Parser:** bài dán “Bài 56: Bảng nhân 5” → 3 mục tiêu, 5 hoạt động, 4 câu hỏi, 2 bài tập, confidence 78%.
- **Phiên luyện thật:** `session_b7f7d25c-afe5-479a-8694-6ddadd20be1a`
  - 6 lượt giáo viên, 5 câu hỏi, 3 câu mở/gợi mở, 5 lượt học sinh.
  - `report_dbb94241-9c07-48b7-9a9d-51add5d17fea` — 56/100, 3 bằng chứng.
  - `training_5b81e9ca-32ad-4731-8807-cd4a212b6be9` — `question_five_checks`, passed, 100/100, `isDemo: false`.
- **Phiên DEMO:** `session_87b0b3c7-2ee5-4c89-950f-b49eae182dab` → `report_7a5e37ea-166a-4705-a4c5-0e4f225c6042`, 84/100, `isDemo: true`, không xuất hiện trong thống kê thật.
- **Khóa Gemini trong tab:** lưu `AIzaSyFakeKeyForUiTest1234567890` vào `sessionStorage`; proxy nhận header, trả `source: client`, HTTP 400 `API key not valid`; phản hồi không chứa khóa; xóa khóa đưa badge về trạng thái trống.
- **In báo cáo:** `report_dbb94241-9c07-48b7-9a9d-51add5d17fea` tạo HTML 9.175 ký tự có “Bài 56: Bảng nhân 5”, điểm 56, mục “Bằng chứng ghi nhận”; `window.print()` được gọi; không có lỗi console.
- **PPTX + PDF thật:** file `bai-giang-powerpoint.pptx` (61.917 byte, 3 slide) tạo bằng Microsoft PowerPoint; PDF đi kèm 30.136 byte, 3 trang. Parser trả tiêu đề “Tổng quan bài học”, “Hoạt động nhóm”, “Tổng kết và dặn dò”, 0 cảnh báo; PDF render thành 3 JPEG 1600×900 (36–38 KB/trang), không lỗi console.
- **Không mạng khi xử lý slide:** các request trong lúc đọc PPTX/PDF chỉ là module Vite và font cục bộ; không có request tải file lên hay gọi dịch vụ ngoài.

> Đây là dữ liệu kiểm thử được tạo trong trình duyệt cá nhân. Người dùng có thể xóa
> trong Cài đặt → Dữ liệu mà không ảnh hưởng mã nguồn.

## 4. Kiểm thử thủ công cần làm trên phần cứng thật

### 4.1 Camera + MediaPipe

1. Mở `/practice`, chọn bài đã xác nhận, bấm **Bắt đầu buổi luyện**.
2. Bấm **Bật camera**, cấp quyền.
3. Đứng cách laptop 50–70 cm, đủ sáng, thấy đầu/vai/hông.
4. Kiểm tra:
   - video hiển thị cục bộ;
   - không có request network chứa video (DevTools → Network);
   - sau ≥ 30 mẫu, báo cáo có điểm “Tư thế và cử chỉ”;
   - khung xương/cử chỉ tay cập nhật, không nhận diện khuôn mặt.
5. Tắt camera giữa phiên; xác nhận chỉ số tư thế dừng và báo cáo ghi “chưa đủ dữ liệu” nếu quá ít mẫu.

### 4.2 Micro + nhận dạng giọng nói

1. Bấm **Bật micro**, cấp quyền.
2. Nói 2–3 câu tiếng Việt; kiểm tra transcript xuất hiện, có thể sửa/xóa.
3. Thử từ chối quyền micro; ứng dụng phải báo lỗi và vẫn cho nhập tay.
4. Kiểm tra báo cáo có “Giọng nói” khi ≥ 20 giây có tiếng nói; nếu chưa đủ, phải ghi “chưa đủ dữ liệu”.

### 4.3 Gemini

**Cách A — khóa nhập trong ứng dụng (nhanh):**

1. Chạy `npm run dev` (đã tích hợp proxy `/api/ai`).
2. Mở **Cài đặt → Trí tuệ nhân tạo**, chọn **Gemini qua server proxy**, chọn **Gemini 2.5 Flash**.
3. Dán khóa từ [Google AI Studio](https://aistudio.google.com/apikey) vào ô **Khóa API Gemini** → **Lưu khóa**.
4. Bấm **Kiểm tra kết nối**; kỳ vọng thông báo thành công và `source` là khóa client.
5. Trong phiên, gửi một câu hỏi; kiểm tra lời thoại học sinh đến từ Gemini.
6. Kết thúc phiên; kiểm tra tóm tắt AI (nếu bật) và fallback khi ngắt mạng.
7. Kiểm tra DevTools: request có header `x-gemini-key`; response không chứa khóa; đóng tab rồi mở lại phải nhập lại khóa.

**Cách B — khóa server (khuyến nghị khi triển khai):**

1. Tạo `.env.local` từ `.env.example`, điền `GEMINI_API_KEY`.
2. Chạy `npm run dev`; chỉ dùng `npm run dev:ai` nếu muốn proxy Node riêng.
3. Cài đặt → AI → chọn Gemini → **Kiểm tra kết nối** (không nhập khóa trong tab).
4. Kiểm tra DevTools không thấy `GEMINI_API_KEY` trong request/response.

### 4.4 Ghi hình cục bộ

1. Bật ghi hình trước khi bắt đầu.
2. Kiểm tra có bản ghi trong IndexedDB (`recordings`).
3. Xuất sao lưu; xác nhận file JSON **không** chứa blob.
4. Xóa phiên; xác nhận recording bị xóa.

### 4.5 Bài trình chiếu PowerPoint

1. Mở `/practice`, tải một `.pptx` thật có ít nhất 3 slide, gồm chữ, ảnh và một bảng.
2. Mở chính file đó trong PowerPoint → **Save As → PDF**, sau đó đính kèm PDF trong mục **2. Bài trình chiếu**.
3. Kiểm tra thumbnail, chuyển slide bằng nút và phím ← →, toàn màn hình.
4. So sánh ảnh slide trên màn hình với PowerPoint/PDF: vị trí, font, màu, ảnh, bảng.
5. Thử cả bốn bố cục; mở **cửa sổ trình chiếu riêng** và kiểm tra đồng bộ hai chiều.
6. Bấm **Bỏ bản PDF**; xác nhận slide quay về bản mô phỏng nhưng văn bản cho AI không đổi.
7. Thay bằng PPTX khác; xác nhận lớp PDF cũ bị xóa và hộp thoại cảnh báo rõ.
8. Kiểm tra Network: không có request chứa `.pptx`/`.pdf`; DevTools → Application → IndexedDB không có file gốc, chỉ có text/layout và ảnh trang.
9. Xuất sao lưu; xác nhận JSON không chứa bảng `presentations` hay ảnh slide.

## 5. Những gì chưa được xác minh

- **Phần cứng camera/micro thật:** môi trường kiểm thử không có thiết bị hoặc quyền truy cập. Đã kiểm tra logic hook, trạng thái UI và fallback nhập tay.
- **Web Speech API:** phụ thuộc trình duyệt/HTTPS; chưa kiểm tra với giọng nói thật.
- **Gemini live:** chưa có khóa hợp lệ. Đã kiểm tra nhập khóa, chuyển `x-gemini-key` tới proxy, che khóa trong lỗi, trạng thái chưa cấu hình và fallback local.
- **Vercel production:** chưa deploy thật; đã kiểm tra build `dist`, function `api/ai.js`, `vercel.json`.
- **In PDF thật:** đã kiểm tra HTML và lệnh `print()`; chưa in ra máy in/khổ A4 thực tế.
- **Độ trung thực slide phức tạp:** đã kiểm tra PPTX/PDF 3 slide đơn giản. Chưa kiểm tra deck nhiều slide với SmartArt, chart, hiệu ứng hoặc font hiếm; PDF là lớp hiển thị nên phần này phụ thuộc PowerPoint xuất PDF đúng.
- **Đa trình duyệt:** chưa kiểm tra Firefox/Safari; Web Speech và một số API media có thể khác. pdfjs dùng `intent: 'print'` đã xử lý tab bị throttle `requestAnimationFrame` trong Chromium.
- **Tải model khi mất mạng:** script có nhánh tải từ Google, nhưng lần chạy đã dùng tệp có sẵn.

## 6. Checklist trước khi phát hành

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] Kiểm tra onboarding → upload → xác nhận → luyện → báo cáo trên Chrome
- [ ] Tải PPTX thật + PDF PowerPoint; kiểm tra 4 bố cục, chuyển slide, cửa sổ riêng, bỏ PDF, thay PPTX
- [ ] Xác nhận Network không có file `.pptx`/`.pdf` và backup không chứa bảng `presentations`
- [ ] Kiểm tra camera/mic thật (mục 4.1, 4.2)
- [ ] Kiểm tra Gemini thật (mục 4.3) nếu bật tính năng
- [ ] Nhập khóa trong Cài đặt → kiểm tra kết nối → đóng tab → xác nhận khóa bị xóa
- [ ] In / xuất PDF một báo cáo thật và một báo cáo DEMO
- [ ] Kiểm tra sao lưu/khôi phục trên trình duyệt sạch
- [ ] Kiểm tra responsive ở 360 px, 768 px, 1440 px
- [ ] Xác nhận không có dữ liệu DEMO trong thống kê thật
