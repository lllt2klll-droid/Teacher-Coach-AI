# Changelog

Tất cả thay đổi đáng chú ý của Teacher Coach AI được ghi tại đây.
Định dạng tham khảo [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/);
dự án dùng phiên bản ứng dụng `0.3.1` và schema IndexedDB `3`.

## [0.3.1] — 2026-11-13

Sửa lỗi học sinh AI trả lời theo tên bài trong kế hoạch dạy thay vì nội dung slide đang trình chiếu.

### Sửa lỗi

- **Ưu tiên văn bản trang PDF:** khi đính kèm PDF, `pdf-visual.ts` đọc text layer của từng trang bằng `getTextContent()` và lưu `visualText`; `buildPresentationContext()` dùng văn bản trang đang chiếu làm ngữ cảnh AI và lấy dòng đầu làm tiêu đề slide. Trang PDF không có text layer quay về văn bản PPTX; ảnh không được OCR.
- **Câu hỏi về tên đề/tiêu đề:** local provider trả lời từ slide hiện tại trước khi tra kế hoạch bài dạy. Trường hợp slide “Kể chuyện Đôi cánh của Ngựa Trắng” không còn bị trả lời “Bài 54: Bảng nhân 3”.
- **Gemini:** prompt nói rõ slide hiện tại là nguồn đúng cho những gì đang hiển thị và không dùng tên kế hoạch bài dạy nếu khác.
- **Giao diện:** thông báo đính kèm/bỏ PDF mô tả đúng việc AI đọc văn bản trang PDF, fallback PPTX.

### Kiểm thử

- `npm run typecheck` sạch.
- `npm run test`: 13 tệp, 62 test.
- Bổ sung test hồi quy cho tiêu đề slide ưu tiên hơn tiêu đề bài học, văn bản PDF ưu tiên hơn PPTX và fallback khi trang PDF không có text layer.
- Kiểm thử tích hợp trong trình duyệt với PDF 3 trang có text layer tiếng Việt: `pageTexts` đúng từng trang, `context.title` là “Kể chuyện Đôi cánh của Ngựa Trắng”, local provider trả lời đúng tiêu đề slide thay vì “Bài 54: Bảng nhân 3”.

### Giới hạn đã biết

- PDF chỉ có ảnh/scan không có text layer sẽ dùng văn bản PPTX; hệ thống không OCR.
- Chưa xác minh Gemini live do chưa có khóa hợp lệ.

## [0.3.0] — 2026-11-13

Thêm bài trình chiếu PowerPoint chạy cục bộ, bốn bố cục sân khấu và lớp PDF tùy chọn để slide hiển thị đúng như bản gốc.

### Thêm mới

- **Bài trình chiếu PPTX:** tải `.pptx` trước buổi luyện hoặc thay trong lúc dạy; file được đọc hoàn toàn trong trình duyệt, không upload và không lưu file gốc.
- **Parser PPTX cục bộ:** đọc thứ tự slide, văn bản/run, theme, nền, placeholder, group, ảnh có crop và bảng đơn giản; cảnh báo cho chart/SmartArt/hiệu ứng; giới hạn 60 MB.
- **Lớp hiển thị PDF (tùy chọn):** đính kèm PDF xuất từ chính PPTX để render từng trang thành JPEG 1600 px (tối đa 120 trang); **Thay PDF** và **Bỏ bản PDF** không làm mất văn bản PPTX. PDF gốc không được lưu.
- **Bốn bố cục trình chiếu:** slide chính + camera nhỏ, tab Camera/Slide, slide ở cột phải, cửa sổ trình chiếu riêng.
- **Điều khiển:** slide trước/sau, thumbnail, phím ← →, toàn màn hình; cửa sổ phụ đồng bộ hai chiều qua `BroadcastChannel`; không có bút chú thích.
- **Gợi ý slide theo hoạt động:** chỉ hiện khi có điểm khớp thật với hoạt động đang dạy.
- **Ngữ cảnh AI:** học sinh AI chỉ nhận văn bản slide hiện tại + dàn ý tiêu đề; local provider ưu tiên ngữ cảnh slide, Gemini nhận trường `baiTrinhChieu`.
- **Schema v3:** bảng `presentations` (IDB version 30, 13 bảng), index theo bài dạy; xóa bài dạy xóa cascade presentation.
- **Bảo vệ dữ liệu:** bảng `presentations` và ảnh slide/PDF không nằm trong sao lưu/khôi phục; xóa toàn bộ dữ liệu xóa cả bảng này.

### Sửa lỗi

- **Kế thừa layout/master:** slide PowerPoint thật thường bỏ `a:xfrm`, cỡ chữ và anchor của placeholder. Parser cũ ghi đè giá trị master bằng `undefined`, khiến slide mất chữ/hình học và báo `empty_slides`. Nay hợp nhất theo từng trường và có test hồi quy.
- **Treo render PDF:** pdfjs chờ `requestAnimationFrame` có thể không bao giờ hoàn tất ở tab bị throttle/không hiển thị. Chuyển sang `intent: 'print'` để render độc lập với rAF.

### Kiểm thử

- `npm run typecheck` sạch.
- `npm run test`: 13 tệp, 58 test.
- `npm run build` thành công.
- Trình duyệt với file PPTX/PDF do Microsoft PowerPoint tạo: 3 slide, tiêu đề/nội dung đúng, 0 cảnh báo; 3 ảnh JPEG 1600×900; badge **PDF gốc**; chuyển slide; bỏ PDF; thay PPTX xóa lớp PDF; lớp PDF còn sau reload; console không lỗi.

### Giới hạn đã biết

- Bản mô phỏng HTML không tái tạo chart, SmartArt, hiệu ứng chuyển động hay mọi font; PDF khắc phục phần hiển thị nhưng cần giáo viên xuất từ PowerPoint.
- Chưa kiểm thử deck phức tạp/nhiều slide với SmartArt, chart hoặc font hiếm.
- PDF/PPTX gốc và ảnh slide không nằm trong sao lưu; khi đổi máy cần tải lại bài trình chiếu.
- Chưa có bút chú thích trên slide (theo yêu cầu).

## [0.2.0] — 2026-11-13

Bổ sung khóa Gemini nhập trong ứng dụng, proxy AI chạy cùng `npm run dev` và xuất báo cáo PDF.

### Thêm mới

- **Ô nhập khóa Gemini:** trường mật khẩu có hiện/ẩn, lưu/xóa, badge che khóa (`AIza…7890`),
  liên kết Google AI Studio và ghi chú quyền riêng tư ngay trong **Cài đặt → AI**.
- **Chọn model Gemini:** Gemini 2.5 Flash (mặc định), 2.5 Flash Lite, 2.5 Pro và model tùy chỉnh.
- **Lưu khóa theo tab:** khóa chỉ nằm trong `sessionStorage` (`teacher-coach-gemini-key`),
  không vào IndexedDB, không vào file sao lưu và bị xóa khi đóng tab. Nút **Xóa toàn bộ dữ liệu**
  cũng xóa khóa tạm.
- **Proxy nhận khóa client:** `api/ai.js`, `server/dev-ai-server.mjs` và plugin Vite đọc header
  `x-gemini-key`; khóa hiệu lực ưu tiên client rồi mới đến `GEMINI_API_KEY`; phản hồi ghi
  `source: client | server | none`.
- **Bảo vệ khóa:** client chỉ gửi khóa tới endpoint tương đối/cùng nguồn; endpoint tuyệt đối
  khác nguồn không nhận khóa; server không ghi log/không trả lại khóa và redact `AIza…` trong lỗi.
- **Một lệnh dev:** `npm run dev` tích hợp sẵn `/api/ai` qua plugin Vite; `npm run dev:ai`
  vẫn là lựa chọn proxy Node độc lập.
- **In / xuất PDF báo cáo:** nút trong trang chi tiết tạo HTML A4 tự chứa gồm điểm, năng lực,
  điểm mạnh/cần cải thiện, khuyến nghị, kết quả training, bằng chứng, tiến trình hoạt động,
  tóm tắt Gemini và nhãn DEMO; có thông báo khi trình duyệt chặn popup.
- **Kiểm thử:** thêm test cho chuẩn hóa/che khóa, chuyển khóa same-origin và xuất báo cáo.

### Sửa lỗi

- Thông báo lỗi Gemini không còn dấu chấm câu lặp (`..`) và nêu rõ nguồn khóa cần kiểm tra.
- Nút **Kiểm tra kết nối** dùng khóa đang nhập trong ô, kể cả trước khi bấm **Lưu khóa**.
- Mô tả Cài đặt không còn nói “không bao giờ nhập khóa trong trình duyệt” trái với tính năng mới.

### Kiểm thử

- `npm run typecheck` sạch.
- `npm run test`: 10 tệp, 39 test.
- `npm run build` thành công.
- Trình duyệt: nhập/lưu/xóa khóa, badge che khóa, giữ sau reload, proxy nhận header,
  lỗi 400 không lộ khóa, in báo cáo tạo 9.175 ký tự HTML và gọi `print()`.

### Giới hạn đã biết

- Chưa kiểm thử Gemini bằng khóa hợp lệ trong môi trường này.
- Chưa in ra máy in thật; mới kiểm tra HTML và hộp thoại in.
- Camera/mic/nhận dạng giọng nói vẫn chưa xác minh trên phần cứng thật.

## [0.1.0] — 2026-11-13

Bản phát hành đầu tiên: lộ trình sản phẩm hoàn chỉnh, chạy local-first.

### Thêm mới

- **Nền tảng:** React 19 + Vite 8 + TypeScript 7 + Tailwind 4, thiết kế Liquid Glass,
  font Quicksand/Be Vietnam Pro, giao diện tiếng Việt, responsive, sáng/tối và 5 màu nhấn.
- **Dữ liệu local-first:** Dexie/IndexedDB schema v2 với 12 bảng; repository, cascade delete,
  thống kê dung lượng; bootstrap một lần tạo hồ sơ, 20 học sinh hư cấu và bài DEMO.
- **Onboarding 4 bước:** giới thiệu, cách hoạt động, quyền riêng tư, bắt đầu; có thể bỏ qua
  và xem lại từ Cài đặt.
- **Kế hoạch bài dạy:** tải PDF/DOCX/TXT (tối đa 20 MB) hoặc dán văn bản; trích xuất cục bộ;
  parser tiếng Việt nhận diện mục tiêu, hoạt động, câu hỏi, đáp án, bài tập; trang kiểm tra
  cho phép sửa và xác nhận trước khi luyện.
- **Lớp học AI:** 20 nhân vật hư cấu với avatar 2D, trình độ, tính cách, mức tham gia;
  tạo/sửa/xóa hồ sơ; mô phỏng giơ tay, trả lời, cần giúp, mất tập trung; 3 chế độ và
  6 tình huống sư phạm.
- **Phòng luyện:** preflight thiết bị, bắt đầu/tạm dừng/kết thúc, đồng hồ, nhập lời giảng,
  nhận dạng giọng nói (Web Speech), camera preview, MediaPipe pose, ghi hình cục bộ tùy chọn,
  gợi ý coaching trực tiếp, autosave và khôi phục phiên dở dang.
- **Báo cáo:** 6 nhóm năng lực, chỉ số từ audio/pose/transcript/sự kiện, bằng chứng,
  timeline, điểm mạnh/cần cải thiện/khuyến nghị, mức tin cậy; điểm `null` và nhãn
  “chưa đủ dữ liệu” thay vì điểm giả; tách báo cáo thật/DEMO.
- **Trung tâm luyện tập:** 14 bài luyện, 8 nhóm kỹ năng, tiêu chí ánh xạ dữ liệu thật,
  kết quả lưu `trainingResults`, thống kê và bộ lọc, liên kết báo cáo, luyện lại.
- **Cài đặt:** hồ sơ, giao diện, mặc định phiên, thiết bị, AI local/Gemini, sao lưu/khôi phục
  (replace/merge), xóa dữ liệu, bật/tắt DEMO, xem lại onboarding.
- **AI tùy chọn:** Gemini 2.5 Flash qua proxy server (Vercel Function hoặc Node dev),
  rate limit 30 yêu cầu/phút/IP, giới hạn payload 90.000 ký tự, timeout 22 giây,
  redact khóa, fallback local.
- **Tài nguyên:** model MediaPipe Pose Landmarker Lite + WASM; script `setup:assets`,
  thư mục `TAI_PHAN_MEM/`, tự chạy trước build.
- **Triển khai:** `vercel.json` rewrite SPA, function `api/ai.js`, hướng dẫn Vercel.
- **Tài liệu:** README, ARCHITECTURE, IMPLEMENTATION_PLAN, TESTING, CHANGELOG,
  `.env.example`, `.gitignore`, `TAI_PHAN_MEM/README.md`.

### Sửa lỗi

- **NLP:** so khớp cụm từ theo ranh giới từ, tránh “ai” trong “bài” và “hay qua” trong
  “hãy quan sát” bị tính là câu hỏi/lời khen.
- **Parser:** không tách câu nội dung đánh số (“1. Kiến thức: …”) thành tiêu đề mục;
  ưu tiên tiêu đề “Bài n: …” thay vì dòng tiêu đề tài liệu; tách đúng hành động
  giáo viên/học sinh; bỏ tiền tố câu hỏi; bỏ qua tiêu đề bài bị nhận nhầm là bài tập;
  nhận diện “chốt lời giải: …”.
- **Báo cáo:** luôn có bằng chứng phủ hoạt động ngay cả khi 0/N hoạt động được phủ;
  không tạo điểm tổng khi thiếu nhóm dữ liệu hoặc confidence thấp.
- **Training:** định dạng mục tiêu luôn kèm đơn vị (ví dụ `≥ 2 lần`).
- **AI local:** hết lặp “ạ ạ” khi đáp án parser đã có “ạ.”; không viết hoa chữ đầu sau
  “Thưa cô,”; sửa nhận diện phép nhân có dấu (“nhân”) khi giải thích.
- **Phiên bị gián đoạn:** dùng `session.durationSec` đã autosave thay vì thời gian tường,
  tránh báo cáo bị phồng thời lượng sau khi đóng tab.
- **DEMO:** cờ `isDemo` được truyền từ bài học → phiên → báo cáo → kết quả training;
  mọi thống kê thật loại DEMO.
- **Build:** cảnh báo dynamic import không hiệu quả được ghi nhận; build vẫn thành công.

### Kiểm thử

- 6 tệp unit test, 28 test: parser, NLP, report builder, feedback engine, training evaluator,
  local provider.
- `npm run typecheck` sạch.
- `npm run build` thành công; `prebuild` xác nhận model/WASM sẵn sàng.
- Kiểm thử trình duyệt: onboarding, upload/parse/confirm, luyện DEMO, luyện thật,
  báo cáo thật/DEMO, training result, settings, backup/restore, reset, schema v2.

### Giới hạn đã biết

- Chưa xác minh camera/micro/nhận dạng giọng nói trên phần cứng thật.
- Chưa xác minh kết nối Gemini thật do chưa có khóa API.
- Chưa deploy Vercel thật; mới kiểm tra cấu hình và build.
- Không đồng bộ đa thiết bị; dữ liệu nằm trong IndexedDB từng trình duyệt.
- Web Speech API phụ thuộc Chrome/Edge; Safari/Firefox có thể không hỗ trợ.

## [Unreleased]

- Kiểm thử e2e Playwright cho luồng chính.
- Đo chất lượng câu hỏi theo rubric chuyên sâu hơn.
- Bổ sung bài luyện theo môn/chương trình GDPT 2018.
