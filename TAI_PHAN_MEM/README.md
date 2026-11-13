# TAI_PHAN_MEM — kho tài nguyên cục bộ

Thư mục này chứa các tệp tải về / mô hình / tài nguyên nặng, **tách khỏi mã nguồn**
để dễ sao lưu, kiểm tra nguồn gốc và không đưa nhầm vào gói triển khai.

## Cấu trúc

```
TAI_PHAN_MEM/
├─ archives/                      # Gói cài đặt hoặc tệp nén gốc (nếu có)
├─ mediapipe/wasm/                # (tùy chọn) bản lưu WASM; public/ được sinh tự động
└─ models/
   └─ pose_landmarker_lite.task   # MediaPipe Pose Landmarker Lite, ~5,8 MB
```

`public/models/pose_landmarker_lite.task` và `public/mediapipe/wasm/*` là **bản sao
phục vụ trình duyệt**. Không sửa trực tiếp các bản sao này; hãy chạy:

```bash
npm run setup:assets
```

Script sẽ:

1. Dùng model trong `TAI_PHAN_MEM/models` nếu đã có.
2. Nếu chưa có, tải model từ kho MediaPipe chính thức vào `TAI_PHAN_MEM/models`,
   sau đó sao chép sang `public/models/`.
3. Sao chép 4 tệp WASM từ `node_modules/@mediapipe/tasks-vision/wasm` (hoặc bản lưu
   trong `TAI_PHAN_MEM/mediapipe/wasm`) sang `public/mediapipe/wasm/`.

## Nguồn và giấy phép

- **Pose Landmarker Lite** — Google MediaPipe:
  <https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task>
  Giấy phép thuộc bộ MediaPipe Models của Google (xem model card/giấy phép đi kèm
  của Google; dự án không đổi giấy phép của bên thứ ba).
- **MediaPipe Tasks Vision WASM** — gói npm `@mediapipe/tasks-vision` (Apache-2.0).
- Phông chữ Quicksand và Be Vietnam Pro được cài qua npm (`@fontsource...`), không
  nằm trong thư mục này.

## Lưu ý

- Không đặt `GEMINI_API_KEY` hay bất kỳ khóa bí mật nào trong thư mục này.
- Các tệp nhị phân lớn được `.gitignore` bỏ qua. Khi clone dự án, chạy
  `npm install` rồi `npm run setup:assets` để tạo lại `public/`.
- Ứng dụng chỉ dùng model để ước lượng tư thế (vai, hông, độ ổn định). Không nhận
  diện danh tính, khuôn mặt hay cảm xúc.
