# Teacher Coach AI

Nền tảng luyện tập giảng dạy dành cho sinh viên Sư phạm Tiểu học Việt Nam. Ứng dụng mô phỏng một lớp học tiểu học với học sinh AI hư cấu, ghi nhận lời giảng, phân tích giọng nói/tư thế (tùy chọn) và tạo báo cáo dựa trên bằng chứng — **không tạo điểm, lời thoại hay nhận xét giả**.

> Dữ liệu mặc định nằm trên thiết bị (IndexedDB). Không có tài khoản, không có máy chủ lưu dữ liệu người dùng. Gemini là tùy chọn và chỉ đi qua proxy phía server.

## Tính năng chính

| Khu vực | Chức năng |
| --- | --- |
| **Tổng quan** | Thống kê buổi luyện thật, tiến độ năng lực, hoạt động gần đây, lối tắt vào quy trình. |
| **Thư viện KHBD** | Tải PDF/DOCX/TXT hoặc dán văn bản; trích xuất cục bộ; xem, sửa, xác nhận kế hoạch bài dạy. |
| **Lớp học AI** | 20 hồ sơ học sinh hư cấu với trình độ, tính cách, mức tham gia; có thể tạo/sửa/xóa hồ sơ. |
| **Luyện tập** | Ba chế độ: tự nhiên, tình huống, trọng tâm; 14 bài luyện có tiêu chí; camera/micro là tùy chọn. |
| **Bài trình chiếu** | Tải `.pptx` trước buổi luyện; 4 bố cục slide + camera, thumbnail, phím mũi tên, toàn màn hình và cửa sổ trình chiếu riêng. AI chỉ nhận nội dung slide hiện tại. Đính kèm PDF xuất từ PowerPoint để slide hiển thị đúng như bản gốc. |
| **Phòng luyện** | Đồng hồ, lời giảng nhập tay hoặc nhận dạng giọng nói, phản hồi học sinh AI, gợi ý coaching trực tiếp, kết thúc và tạo báo cáo. |
| **Báo cáo** | Chỉ số theo năng lực, bằng chứng trích từ dữ liệu, mức độ tin cậy, phần “chưa đủ dữ liệu”; tách báo cáo DEMO khỏi báo cáo thật; in / xuất PDF kèm bằng chứng. |
| **Trung tâm luyện tập** | 14 bài luyện theo nhóm kỹ năng; kết quả chấm theo tiêu chí từ dữ liệu thật; thống kê không gồm DEMO. |
| **Cài đặt** | Hồ sơ giáo viên, giao diện sáng/tối/màu nhấn, mặc định buổi luyện, kiểm tra thiết bị, AI (quy tắc cục bộ/Gemini, nhập khóa tạm trong tab), sao lưu/khôi phục, xóa dữ liệu, phát lại hướng dẫn. |

## Nguyên tắc dữ liệu và quyền riêng tư

- **Không bịa dữ liệu luyện tập.** Không có buổi luyện, báo cáo, điểm hay bản ghi giọng nói nào được tạo sẵn. Bài học DEMO duy nhất (“Bảng nhân 3”) được dán nhãn rõ và **không bao giờ** được tính vào thống kê thật.
- **Camera/micro chỉ bật sau khi người dùng bấm nút** và cấp quyền trình duyệt. Không tự động bật khi vào phòng.
- **Video không rời thiết bị.** MediaPipe chạy cục bộ trong trình duyệt. Ứng dụng không nhận diện danh tính, khuôn mặt hay cảm xúc; chỉ ước lượng tư thế (vai, hông, độ ổn định, cử chỉ tay).
- **Ghi hình là tùy chọn, mặc định tắt.** Bản ghi (nếu bật) nằm trong IndexedDB và không được đưa vào tệp sao lưu.
- **Bài trình chiếu xử lý cục bộ.** File `.pptx` và PDF (nếu đính kèm) chỉ được đọc trong trình duyệt, không tải lên máy chủ. Hệ thống không lưu file gốc: chỉ lưu văn bản/bố cục/ảnh trích xuất và ảnh từng trang PDF trong IndexedDB; dữ liệu slide không nằm trong bản sao lưu.
- **Khóa Gemini là tùy chọn.** Khuyến nghị đặt `GEMINI_API_KEY` trong biến môi trường server. Nếu nhập trong **Cài đặt → AI**, khóa chỉ nằm trong `sessionStorage` của tab, chỉ gửi tới proxy cùng nguồn `/api/ai`, không vào IndexedDB, không vào file sao lưu và bị xóa khi đóng tab. Server không ghi log khóa và luôn che khóa trong thông báo lỗi.
- **Học sinh AI là nhân vật hư cấu**, không phải trẻ em thật. Hồ sơ có thể sửa/xóa.

## Công nghệ

- Vite 8 · React 19 · TypeScript 7 · Tailwind CSS 4
- Dexie 4 (IndexedDB) · Zustand 5 · React Router 7 · Recharts 3
- MediaPipe Tasks Vision 1.2 (`pose_landmarker_lite`)
- `pdfjs-dist` (PDF) · `mammoth` (DOCX) — trích xuất hoàn toàn trong trình duyệt
- `jszip` + `fast-xml-parser` (PPTX) — đọc slide, văn bản, bố cục và ảnh cục bộ; `pdfjs-dist` chuyển PDF xuất từ PowerPoint thành ảnh slide
- Web Speech API cho nhận dạng giọng nói (Chrome/Edge hỗ trợ tốt nhất)
- Gemini 2.5 Flash/Pro qua proxy server (Vercel Function hoặc Vite dev), khóa đặt ở server hoặc nhập tạm trong tab (tùy chọn)

## Yêu cầu môi trường

- Node.js **20.19+** (khuyến nghị 22 LTS) và npm 10+
- Trình duyệt Chromium hiện đại (Chrome/Edge) để dùng micro, nhận dạng giọng nói và MediaPipe
- Camera/micro chỉ hoạt động trên `localhost` hoặc HTTPS

## Chạy nhanh

```bash
# 1. Cài phụ thuộc
npm install

# 2. Chuẩn bị model + WASM MediaPipe (tự tải vào TAI_PHAN_MEM nếu thiếu)
npm run setup:assets

# 3. Chạy giao diện
npm run dev
```

Mở địa chỉ Vite in ra (mặc định <http://localhost:5173>). Lần đầu, ứng dụng mở
IndexedDB, tạo hồ sơ giáo viên mặc định, 20 học sinh AI hư cấu và một bài DEMO.
Không có buổi luyện hay báo cáo giả nào được tạo.

### Quy trình dùng thử

1. **Bắt đầu** → xem hướng dẫn 4 bước (có thể bỏ qua; mở lại trong Cài đặt).
2. **Thư viện KHBD → Tải kế hoạch** → tải file hoặc dán văn bản.
3. Kiểm tra kết quả trích xuất → **Xác nhận & luyện tập**.
4. **Thiết lập buổi luyện** → (tùy chọn) tải `.pptx` và đính kèm PDF xuất từ chính file đó để slide hiển thị giống bản gốc; chọn bố cục slide/camera.
5. Chọn bài luyện (tùy chọn), số học sinh, chế độ → **Bắt đầu buổi luyện**.
6. Trong phòng: bấm **Bắt đầu**, nhập lời giảng hoặc bật micro; bật camera nếu muốn phân tích tư thế. Dùng slide, thumbnail hoặc phím ← → khi dạy.
7. **Kết thúc & xem báo cáo**. Báo cáo được tạo từ dữ liệu đã lưu trong IndexedDB.
8. Xem lại trong **Báo cáo** và **Trung tâm luyện tập**; bấm **In / Xuất PDF** để lưu báo cáo kèm bằng chứng.

## Bài trình chiếu (tùy chọn)

1. Trong **Luyện tập → 2. Bài trình chiếu (PPTX)**, chọn file `.pptx` (tối đa 60 MB). Slide được đọc ngay trong trình duyệt.
2. Muốn slide giống **chính xác** bản PowerPoint, mở file đó trong PowerPoint → **Save As → PDF**, rồi bấm **Tải PDF xuất từ PowerPoint**. Hệ thống chỉ lưu ảnh từng trang (tối đa 120 trang, 1600 px), không lưu file PDF.
3. Chọn một trong bốn bố cục: slide chính + camera nhỏ, tab Camera/Slide, slide ở cột phải, hoặc cửa sổ trình chiếu riêng.
4. Trong phòng luyện, dùng nút ← →/thumbnail/toàn màn hình hoặc phím mũi tên. Học sinh AI chỉ nhận **văn bản slide hiện tại + dàn ý**, không nhận toàn bộ bài trình chiếu.

Nếu chưa có PDF, slide dùng bản mô phỏng từ PPTX (có thể lệch font/bố cục). Biểu đồ, SmartArt và hiệu ứng chuyển động không được tái tạo; PDF khắc phục phần hiển thị nhưng AI vẫn đọc nội dung từ PPTX.

## Cấu hình AI (tùy chọn)

Mặc định ứng dụng dùng **chế độ cục bộ (quy tắc)** — không cần mạng, không gửi dữ liệu ra ngoài. Gemini chỉ dùng để tạo lời thoại học sinh AI và bản tóm tắt báo cáo (nếu bật). Khi Gemini lỗi hoặc chưa cấu hình, ứng dụng tự quay về quy tắc cục bộ.

### Cách nhanh: nhập khóa trong ứng dụng

1. Mở **Cài đặt → Trí tuệ nhân tạo**.
2. Chọn **Gemini qua server proxy**, chọn model (mặc định **Gemini 2.5 Flash**).
3. Dán khóa lấy từ [Google AI Studio](https://aistudio.google.com/apikey) vào ô **Khóa API Gemini** → **Lưu khóa**.
4. Bấm **Kiểm tra kết nối**.

`npm run dev` đã tích hợp sẵn proxy AI cục bộ (cùng mã với Vercel Function), nên không cần chạy terminal thứ hai. Khóa nhập trong tab chỉ tồn tại đến khi đóng tab và không được ghi vào dữ liệu luyện tập.

### Cách khuyến nghị cho triển khai: đặt khóa ở server

```bash
copy .env.example .env.local
# Mở .env.local và điền GEMINI_API_KEY

npm run dev        # giao diện + proxy AI tích hợp
```

Nếu muốn chạy proxy riêng (ví dụ kiểm tra giống môi trường Vercel), dùng `npm run dev:ai` ở cổng 8787; Vite sẽ chuyển tiếp `/api` tới đó.

Trong **Cài đặt → AI**, chọn `Gemini (qua server)` và kiểm tra kết nối. Endpoint mặc định `/api/ai`; model mặc định `gemini-2.5-flash`.

### Triển khai Vercel

1. Import repository vào Vercel (framework Vite, output `dist`).
2. Thêm biến môi trường **`GEMINI_API_KEY`** (và tùy chọn `GEMINI_MODEL`) trong Project Settings → Environment Variables. Không dùng tiền tố `VITE_`.
3. Deploy. `vercel.json` đã cấu hình rewrite SPA và build command chạy `prebuild` để tải model/WASM nếu thiếu.
4. Function `api/ai.js` xử lý khóa phía server (ưu tiên khóa client gửi qua `x-gemini-key` nếu người dùng nhập trong tab), giới hạn payload 90.000 ký tự và 30 yêu cầu/phút/IP; khóa không bao giờ được trả về client.

Nếu không cấu hình Gemini, bản deploy vẫn chạy đầy đủ ở chế độ cục bộ. Người dùng cũng có thể nhập khóa riêng trong **Cài đặt → AI**; khóa đó chỉ sống trong tab hiện tại.

## Tài nguyên MediaPipe

```
TAI_PHAN_MEM/models/pose_landmarker_lite.task   # bản gốc / kho tải về
public/models/pose_landmarker_lite.task         # bản trình duyệt phục vụ
public/mediapipe/wasm/*                         # WASM Tasks Vision
```

`npm run setup:assets` (và `prebuild`) tự tạo bản trong `public/`. Chi tiết nguồn và
giấy phép: [`TAI_PHAN_MEM/README.md`](TAI_PHAN_MEM/README.md).

## Kiểm thử và kiểm tra

```bash
npm run typecheck   # TypeScript strict, không phát sinh file
npm run test        # Vitest: 13 tệp, 58 test
npm run build       # setup assets + typecheck + Vite build
```

Xem [`TESTING.md`](TESTING.md) để biết ma trận kiểm thử thủ công và những hạng mục
chưa thể xác minh trong môi trường tự động (camera/mic thật, kết nối Gemini thật).

## Cấu trúc thư mục

```
TEACHER/
├─ api/                    # Vercel Function: /api/ai + lõi proxy dùng chung
├─ server/                 # Proxy AI Node tùy chọn cho phát triển cục bộ
├─ public/                 # Tài nguyên tĩnh (model/WASM sinh bởi setup:assets)
├─ scripts/                # setup-assets.mjs
├─ src/
│  ├─ components/          # UI, layout, lớp học, media
│  ├─ data/                # Dexie, repository, seed, backup, bài luyện
│  ├─ hooks/               # camera, micro, pose, phiên luyện, ghi hình
│  ├─ pages/               # 14 trang
│  ├─ providers/           # AI local + Gemini
│  ├─ services/            # parser, NLP, mô phỏng, phân tích, báo cáo, xuất báo cáo, training, presentation
│  ├─ store/               # Zustand: cài đặt, toast; khóa Gemini tạm theo tab
│  └─ types/               # domain + settings
├─ TAI_PHAN_MEM/           # Kho tài nguyên tải về (model, archive)
└─ vercel.json
```

## Tài liệu

- [ARCHITECTURE.md](ARCHITECTURE.md) — kiến trúc, luồng dữ liệu, mô hình IndexedDB, bảo mật.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — lộ trình và trạng thái từng giai đoạn.
- [TESTING.md](TESTING.md) — kiểm thử tự động, kiểm thử trình duyệt, giới hạn đã biết.
- [CHANGELOG.md](CHANGELOG.md) — lịch sử thay đổi.
- [TEACHER_COACH_AI_MASTER_PROMPT.md](TEACHER_COACH_AI_MASTER_PROMPT.md) — đặc tả sản phẩm gốc.

## Giới hạn đã biết

- Chưa kiểm thử trên camera/micro thật trong môi trường phát triển tự động. Cần kiểm tra thủ công trên Chrome/Edge với HTTPS hoặc localhost.
- Nhận dạng giọng nói phụ thuộc Web Speech API; Firefox/Safari có thể không hỗ trợ hoặc hỗ trợ hạn chế.
- Kết nối Gemini thật chưa được kiểm thử bằng khóa hợp lệ trong môi trường phát triển; đã kiểm tra luồng nhập khóa, chuyển khóa tới proxy, che khóa trong lỗi và fallback cục bộ.
- Khóa nhập trong Cài đặt chỉ thuộc tab hiện tại (sessionStorage); mở tab mới hoặc đóng tab phải nhập lại. Với sử dụng lâu dài, nên đặt khóa ở server.
- Ứng dụng không phải công cụ đánh giá giáo viên chính thức; báo cáo chỉ mang tính luyện tập.
- Không có đồng bộ đa thiết bị. Dữ liệu nằm trong IndexedDB của từng trình duyệt/thiết bị.
- **Slide PPTX không có PDF đi kèm** được mô phỏng gần đúng: font, shape phức tạp, SmartArt, biểu đồ và hiệu ứng chuyển động có thể khác PowerPoint. Đính kèm PDF xuất từ chính file PPTX để có bản hiển thị chính xác; PDF chỉ dùng để hiển thị, AI vẫn đọc nội dung từ PPTX.
- PDF/PPTX gốc không được lưu. Ảnh slide/PDF nằm ngoài bản sao lưu nên khi chuyển máy cần tải lại bài trình chiếu.
