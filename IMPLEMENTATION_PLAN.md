# Kế hoạch triển khai & trạng thái

Tài liệu này đối chiếu lộ trình sản phẩm với những gì đã có trong mã nguồn. Mọi mục
“Hoàn thành” đều có mã tương ứng và đã được kiểm tra bằng `typecheck`, `test`, `build`
hoặc kiểm thử trình duyệt (xem [TESTING.md](TESTING.md)).

## Tổng quan

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| 0 | Khảo sát, stack, thiết kế dữ liệu | ✅ Hoàn thành |
| 1 | Nền tảng UI, design system, điều hướng, lưu trữ | ✅ Hoàn thành |
| 2 | Tải & phân tích kế hoạch bài dạy | ✅ Hoàn thành |
| 3 | Lớp học AI và hồ sơ học sinh | ✅ Hoàn thành |
| 4 | Phiên luyện, camera/mic, coaching trực tiếp | ✅ Hoàn thành (phần cứng chưa xác minh) |
| 5 | Báo cáo dựa trên bằng chứng | ✅ Hoàn thành |
| 6 | Trung tâm luyện tập & chấm tiêu chí | ✅ Hoàn thành |
| 7 | Cài đặt, sao lưu, DEMO, onboarding | ✅ Hoàn thành |
| 8 | Tài liệu, script tài nguyên, Vercel | ✅ Hoàn thành |

---

## Giai đoạn 0 — Nền móng

- [x] Đọc đặc tả `TEACHER_COACH_AI_MASTER_PROMPT.md`, chốt phạm vi.
- [x] Chọn Vite 8 + React 19 + TypeScript 7 + Tailwind 4.
- [x] Chọn Dexie 4 cho IndexedDB, Zustand 5 cho cài đặt, React Router 7.
- [x] Chọn MediaPipe Tasks Vision, pdfjs-dist, mammoth, Recharts.
- [x] Tạo cấu trúc thư mục `src/{components,data,hooks,pages,providers,services,store,types}`.
- [x] Tạo `TAI_PHAN_MEM/` để lưu model/tài nguyên tải về.

## Giai đoạn 1 — Nền tảng ứng dụng

- [x] Design tokens Liquid Glass: màu, bán kính, đổ bóng, blur, dark mode.
- [x] Font Quicksand (tiêu đề) + Be Vietnam Pro (nội dung), hỗ trợ tiếng Việt.
- [x] Bộ UI: Button, Inputs, Select, Slider, Switch, Textarea, Badge, GlassCard, Tabs, Modal, ConfirmDialog, Toast, EmptyState, LoadingState.
- [x] AppShell responsive: sidebar, mobile nav, command search, theme toggle.
- [x] Router 14 trang + error boundary + 404 + onboarding gate.
- [x] Dexie schema v3 với 13 bảng (khởi đầu v2, thêm `presentations` ở 0.3.0); repository cho từng thực thể.
- [x] Bootstrap một lần: hồ sơ, 20 học sinh hư cấu, bài DEMO.
- [x] Theme/accent lưu localStorage và áp dụng trước khi React render.
- [x] Error boundary và thông báo khi IndexedDB không khả dụng.

## Giai đoạn 2 — Kế hoạch bài dạy

- [x] Kéo-thả/tải PDF, DOCX, TXT; giới hạn 20 MB.
- [x] Trích PDF bằng pdfjs (giữ thứ tự dòng, đếm trang), DOCX bằng mammoth, TXT trực tiếp.
- [x] Dán văn bản trực tiếp, tạo file meta “Nội dung dán trực tiếp.txt”.
- [x] Parser:
  - [x] nhận diện tiêu đề “Bài n: …”, môn, lớp, thời lượng;
  - [x] tách mục tiêu, đồ dùng, hoạt động, bài tập, câu hỏi, đáp án;
  - [x] phân biệt hành động giáo viên/học sinh;
  - [x] không tách nhầm câu nội dung đánh số thành tiêu đề mục;
  - [x] nhận diện “chốt lời giải”;
  - [x] tính confidence và issues.
- [x] Trang kiểm tra: sửa tên/môn/lớp/chủ đề/mục tiêu/hoạt động/bài tập.
- [x] Xác nhận kế hoạch trước khi cho luyện; chưa xác nhận bị khóa.
- [x] Lưu/đọc/xóa kế hoạch trong IndexedDB; xóa kế hoạch không xóa báo cáo cũ.
- [x] DEMO lesson “Bảng nhân 3” dán nhãn rõ.

## Giai đoạn 3 — Lớp học AI

- [x] 20 hồ sơ học sinh hư cấu với tên, màu, trình độ, tính cách, mức tham gia.
- [x] Avatar 2D sinh từ seed (không dùng ảnh người thật).
- [x] Tạo/sửa/xóa hồ sơ học sinh; dữ liệu lưu IndexedDB.
- [x] Mô phỏng lớp học:
  - [x] phản hồi theo ý định giáo viên (chào, khen, giảng, hỏi, giao bài, chuyển hoạt động);
  - [x] giơ tay, trả lời đúng/một phần/sai, cần giúp, mất tập trung;
  - [x] chế độ tự nhiên/tình huống/trọng tâm;
  - [x] 6 tình huống sư phạm;
  - [x] trạng thái avatar và cử chỉ.
- [x] AI provider local (mặc định) + Gemini tùy chọn.
- [x] Chống trùng lặp lời thoại, giới hạn tần suất phát biểu.

## Giai đoạn 4 — Phiên luyện & coaching

- [x] Trang thiết lập: chọn bài, chế độ, số học sinh, độ khó, mức chủ động, tần suất coaching, ghi hình.
- [x] Bài luyện có tiêu chí: khóa chế độ/độ khó theo bài.
- [x] Phòng luyện ngoài AppShell, bố cục tập trung.
- [x] Preflight: camera/mic tắt; chỉ bật khi bấm; hiển thị rõ quyền riêng tư.
- [x] Đồng hồ phiên; bắt đầu/tạm dừng/tiếp tục/kết thúc.
- [x] Nhập lời giảng thủ công; gửi và nhận phản hồi học sinh.
- [x] Web Speech API khi micro bật; trạng thái lỗi/không hỗ trợ.
- [x] Camera preview cục bộ; MediaPipe pose; không gửi video.
- [x] Ghi hình cục bộ tùy chọn vào IndexedDB; không vào backup.
- [x] Gợi ý coaching trực tiếp theo luật + cooldown.
- [x] Autosave; phát hiện phiên dở dang sau reload; kết thúc an toàn.
- [x] Thiết bị là tùy chọn: vẫn luyện được bằng nhập tay.

**Chưa xác minh:** camera/micro/nhận dạng giọng nói thật trên phần cứng. Xem TESTING.md.

## Giai đoạn 5 — Báo cáo

- [x] Dựng báo cáo từ dữ liệu đã lưu trong IndexedDB (an toàn sau crash).
- [x] Sáu nhóm năng lực; điểm `null` khi thiếu dữ liệu.
- [x] Điểm tổng chỉ khi ≥ 2 nhóm đủ dữ liệu và confidence ≥ 0.45.
- [x] Bằng chứng: transcript, sự kiện lớp học, audio, pose, feedback.
- [x] Timeline hoạt động, tiến trình hoạt động, điểm mạnh/cần cải thiện/khuyến nghị.
- [x] Tách báo cáo thật/DEMO; thống kê loại DEMO.
- [x] Trang chi tiết: biểu đồ, bằng chứng, “chưa đủ dữ liệu”, xóa báo cáo/session.
- [x] Nhận xét AI tùy chọn (Gemini) nhưng không dùng để chấm điểm.
- [x] In / xuất PDF từ dữ liệu đã lưu, có bằng chứng, kết quả training và nhãn DEMO.

## Giai đoạn 6 — Trung tâm luyện tập

- [x] 14 bài luyện thuộc 8 nhóm kỹ năng.
- [x] Tiêu chí ánh xạ metric thật: thời lượng, câu hỏi, câu mở, lượt học sinh, khen, động viên, chuyển tiếp, chào, tổng kết, tư thế, giọng nói, xử lý trả lời sai…
- [x] Gắn `trainingExerciseId` vào session; đánh giá khi kết thúc.
- [x] Kết quả lưu bảng `trainingResults` (index `sessionId`, `completedAt`; nay thuộc schema v3).
- [x] Thống kê: số lần luyện, tỉ lệ đạt, điểm trung bình, thời lượng; loại DEMO.
- [x] Lọc kết quả đạt/chưa đạt; liên kết báo cáo; luyện lại.
- [x] Đơn vị tiêu chí hiển thị đúng (`≥ 2 lần`).

## Giai đoạn 7 — Cài đặt & dữ liệu

- [x] Hồ sơ giáo viên, tên hiển thị.
- [x] Theme sáng/tối/hệ thống; 5 màu nhấn.
- [x] Mặc định buổi luyện: số học sinh, chế độ, độ khó, mức chủ động, coaching, ghi hình.
- [x] Chọn thiết bị mặc định; kiểm tra camera/mic.
- [x] AI: local/Gemini, endpoint, model, kiểm tra kết nối, fallback.
- [x] Ô nhập khóa Gemini tùy chọn (sessionStorage), chọn Gemini 2.5 Flash/Flash Lite/Pro hoặc model tùy chỉnh.
- [x] Sao lưu JSON; nhập replace/merge; kiểm tra hợp lệ; không gồm video và không gồm khóa.
- [x] Xóa toàn bộ dữ liệu (giữ tùy chọn onboarding), đồng thời xóa khóa Gemini tạm trong tab.
- [x] Bật/tắt/khôi phục dữ liệu DEMO.
- [x] Xem lại onboarding.
- [x] Reset cài đặt không ép onboarding lại.

## Giai đoạn 8 — Tài liệu & triển khai

- [x] `README.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `TESTING.md`.
- [x] `CHANGELOG.md`, `.env.example`, `.gitignore`.
- [x] `TAI_PHAN_MEM/README.md`.
- [x] `scripts/setup-assets.mjs` + `prebuild`.
- [x] `vercel.json` rewrite SPA.
- [x] Proxy AI dùng chung cho dev và Vercel; rate limit, giới hạn payload, redact key.
- [x] `npm run dev` tích hợp `/api/ai`; `npm run dev:ai` là proxy độc lập tùy chọn.
- [x] Proxy nhận `x-gemini-key`, ưu tiên khóa client, trả `source`, không trả/log khóa.
- [x] Kiểm tra `typecheck`, 39 unit test, build production.

## Bổ sung 0.2.0 — Khóa Gemini trong ứng dụng & in báo cáo

- [x] Ô nhập khóa dạng mật khẩu, hiện/ẩn, lưu/xóa, badge che khóa, liên kết AI Studio.
- [x] Khóa chỉ lưu `sessionStorage`, không vào IndexedDB/backup; xóa khi đóng tab hoặc xóa toàn bộ dữ liệu.
- [x] Chỉ gửi khóa tới endpoint tương đối/cùng nguồn; endpoint khác nguồn không nhận khóa.
- [x] Server phân giải khóa client → `GEMINI_API_KEY`, redact lỗi, thông báo thiếu/sai khóa rõ ràng.
- [x] Nút **In / Xuất PDF** tạo HTML A4 tự chứa, escape nội dung, có bằng chứng và nhãn DEMO.
- [x] Test cho helper khóa, provider forwarding, phân giải khóa server (client ưu tiên, không trả khóa) và export báo cáo.
- [x] Cập nhật README, ARCHITECTURE, TESTING, CHANGELOG, `.env.example`; phiên bản `0.2.0`.

## Bổ sung 0.3.0 — Bài trình chiếu PPTX + lớp hiển thị PDF

- [x] Kiểu dữ liệu `PresentationDoc`, `PresentationSlide`, `PresentationAsset`, `PresentationVisualMode`; bốn bố cục `slide_main`, `tabs`, `side`, `window`.
- [x] Parser PPTX cục bộ bằng JSZip + fast-xml-parser: thứ tự slide, text/run, theme, nền, placeholder, group, ảnh có crop, bảng đơn giản; cảnh báo cho chart/SmartArt/transition; giới hạn 60 MB.
- [x] Sửa kế thừa layout/master: placeholder không có `a:xfrm`/`sz`/`anchor` nhận giá trị từ master theo từng trường, không bị ghi đè `undefined`; có test hồi quy.
- [x] Tải PPTX trước buổi luyện và thay PPTX trong lúc dạy; hộp thoại xác nhận; file gốc không được lưu hay upload.
- [x] Lớp PDF hiển thị trung thực: pdfjs render từng trang thành JPEG 1600 px, tối đa 120 trang/80 MB; lưu `visualAssetId`; thay PPTX xóa lớp PDF cũ; **Bỏ bản PDF** quay về mô phỏng HTML.
- [x] Render PDF dùng `intent: 'print'` để không treo khi tab bị throttle `requestAnimationFrame`.
- [x] Sân khấu 4 bố cục, thumbnail, phím ← →, toàn màn hình, cửa sổ trình chiếu riêng đồng bộ bằng BroadcastChannel; không có bút chú thích.
- [x] Gợi ý slide theo hoạt động đang dạy; AI chỉ nhận văn bản slide hiện tại + dàn ý tiêu đề, local provider ưu tiên ngữ cảnh slide, Gemini nhận `baiTrinhChieu`.
- [x] Schema v3 (IndexedDB version 30) thêm bảng `presentations`; cascade delete theo bài dạy; loại khỏi backup/restore và thống kê.
- [x] Test parser (kể cả kế thừa layout), presentation context/suggestion, PDF attach/clear, provider ưu tiên slide, prompt Gemini.
- [x] Cập nhật README, ARCHITECTURE, TESTING, CHANGELOG; phiên bản `0.3.0`; kiểm tra typecheck, 58 unit test và build production.

---

## Việc còn lại / khuyến nghị

### Cần xác minh thủ công (không chặn phát hành)

1. **Camera + MediaPipe thật:** cấp quyền, kiểm tra khung xương, độ ổn định, cử chỉ tay; xác nhận video không rời thiết bị (Network tab không có request chứa video).
2. **Micro + Web Speech API:** kiểm tra transcript tiếng Việt, độ trễ, lỗi khi từ chối quyền.
3. **Gemini thật:** đặt `GEMINI_API_KEY` hoặc nhập khóa trong **Cài đặt → AI**, chạy `npm run dev`, kiểm tra kết nối và một phản hồi học sinh; sau đó kiểm tra tóm tắt báo cáo.
4. **Slide PowerPoint thật:** thử với bài giảng nhiều slide có ảnh, bảng, chart, SmartArt; đối chiếu bản PDF xuất từ PowerPoint với màn hình trình chiếu; kiểm tra thay PPTX và bỏ PDF khi đang dạy.
5. **In PDF thật:** kiểm tra khổ A4, phân trang bảng bằng chứng và bản in DEMO.
6. **Thiết bị di động:** Safari/iOS có thể không hỗ trợ Web Speech; camera cần HTTPS.

### Hướng phát triển tiếp

- Nhiều giáo viên/đa thiết bị (cần backend + đồng bộ có kiểm soát).
- Bộ lọc/tìm kiếm nâng cao trong thư viện báo cáo.
- Thêm bài luyện và tiêu chí theo môn/chương trình GDPT 2018.
- Đo chất lượng câu hỏi bằng rubric chuyên sâu hơn (vẫn phải giải thích được).
- Kiểm thử e2e tự động (Playwright) cho các luồng chính.
