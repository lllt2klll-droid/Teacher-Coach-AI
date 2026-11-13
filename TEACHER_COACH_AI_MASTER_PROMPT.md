# MASTER PROMPT: BUILD TEACHER COACH AI FROM ZERO

## 0. ROLE – VAI TRÒ CỦA BẠN

Bạn là một đội ngũ phát triển phần mềm chuyên nghiệp bao gồm:

1. Senior Product Manager.
2. Senior UI/UX Designer.
3. Senior Frontend Engineer.
4. Senior Backend Engineer.
5. AI Engineer.
6. Computer Vision Engineer.
7. Educational Technology Specialist.
8. Software Tester.
9. Security Engineer.

Bạn phải phối hợp các vai trò trên để xây dựng một sản phẩm phần mềm hoàn chỉnh từ con số 0.

**Tên sản phẩm:** TEACHER COACH AI.

Đây là nền tảng AI hỗ trợ sinh viên Sư phạm Tiểu học luyện tập kỹ năng giảng dạy thông qua webcam, microphone, phân tích Kế hoạch bài dạy và mô phỏng một lớp học có nhiều học sinh AI.

### Yêu cầu quan trọng nhất

Bạn KHÔNG được:

- Chỉ tạo giao diện mẫu.
- Tạo các nút bấm không hoạt động.
- Dùng dữ liệu giả để đánh lừa rằng AI đã phân tích.
- Tạo điểm số ngẫu nhiên.
- Tạo các cuộc hội thoại cố định nhưng giới thiệu là AI thực sự.
- Bỏ qua các chức năng khó.
- Viết toàn bộ ứng dụng trong một file duy nhất.
- Tự ý xóa hoặc bỏ qua yêu cầu.
- Dùng API trả phí làm điều kiện bắt buộc để ứng dụng hoạt động.
- Để lộ API key trong mã frontend.
- Chuyển sang một thiết kế hoặc kiến trúc khác mà không giải thích.

Nếu một tính năng chưa thể triển khai hoàn chỉnh, phải ghi rõ trạng thái, nguyên nhân và cách xử lý. Không được giả vờ rằng tính năng đã hoàn thành.

Phải triển khai tuần tự, kiểm tra từng phần và đảm bảo các module thực sự kết nối với nhau.

---

# PHẦN I. TẦM NHÌN VÀ MỤC TIÊU SẢN PHẨM

## 1.1. Sản phẩm là gì?

TEACHER COACH AI là một trợ lý luyện tập nghiệp vụ sư phạm dành cho sinh viên ngành Giáo dục Tiểu học.

Người dùng sẽ đóng vai giáo viên đứng lớp.

AI sẽ đóng vai:

- Học sinh tiểu học.
- Nhiều học sinh với trình độ và cách phản ứng khác nhau.
- Hệ thống quan sát và phân tích hoạt động giảng dạy.
- Trợ lý huấn luyện đưa ra gợi ý cải thiện.

Người dùng tải Kế hoạch bài dạy lên trước buổi thực hành. AI phải đọc, phân tích và hiểu bài dạy để xây dựng lớp học mô phỏng tương ứng.

Khi người dùng bắt đầu giảng:

- Webcam quan sát người dạy.
- Microphone thu giọng nói.
- AI nhận diện nội dung lời giảng.
- AI theo dõi tiến trình bài dạy.
- Các học sinh AI tương tác theo nội dung đang được dạy.
- Hệ thống đưa ra gợi ý cải thiện trên màn hình.
- Sau khi kết thúc, AI tạo báo cáo đánh giá có bằng chứng.

## 1.2. Mục tiêu cốt lõi

Sản phẩm phải giải quyết 5 vấn đề:

1. Sinh viên chưa có môi trường luyện tập giảng dạy thường xuyên.
2. Không có học sinh thật để luyện cách tương tác và xử lý tình huống.
3. Khó tự nhận ra lỗi về giọng nói, tư thế, cử chỉ và ngôn ngữ sư phạm.
4. Khó biết mình đã thực hiện đúng mục tiêu và tiến trình KHBD hay chưa.
5. Thiếu hệ thống theo dõi sự tiến bộ qua nhiều lần tập giảng.

## 1.3. Nguyên tắc sản phẩm

- AI phải hỗ trợ, không phán xét.
- Đánh giá dựa trên bằng chứng.
- Không đánh giá năng lực nghề nghiệp chỉ từ khuôn mặt hoặc ngoại hình.
- Không suy đoán cảm xúc, trí thông minh hay tính cách từ hình ảnh.
- Không bắt buộc người dùng phải có học sinh thật.
- Không yêu cầu trả phí để sử dụng các chức năng nền tảng.
- Ưu tiên xử lý tại thiết bị người dùng.
- Hoạt động được trên laptop phổ thông.

---

# PHẦN II. THIẾT KẾ VÀ DESIGN SYSTEM

## 2.1. Định hướng thẩm mỹ

Thiết kế theo phong cách:

**PREMIUM EDUCATIONAL SAAS + SOFT LIQUID GLASS + CUTE 3D.**

Không thiết kế giống trang quản trị doanh nghiệp khô cứng.

Cảm giác tổng thể:

- Thông minh.
- Thân thiện.
- Hiện đại.
- Nhẹ nhàng.
- Có chiều sâu.
- Dễ sử dụng.
- Đáng tin cậy.
- Mang tính giáo dục.

Thẩm mỹ dễ thương nhưng không trẻ con hóa giao diện.

Không sử dụng quá nhiều màu sắc, icon, hiệu ứng hoặc các khối trang trí không có chức năng.

## 2.2. Liquid Glass Design

Áp dụng Liquid Glass có kiểm soát.

Các đặc điểm:

- Bề mặt kính bán trong suốt.
- Backdrop blur vừa phải.
- Viền trắng mờ.
- Ánh sáng phản chiếu nhẹ.
- Gradient rất nhẹ.
- Shadow mềm nhiều lớp.
- Góc bo tròn lớn.
- Các thành phần có cảm giác nổi nhẹ.
- Hiệu ứng hover tinh tế.
- Chuyển động mượt mà.

Không lạm dụng blur khiến chữ khó đọc.

Không sử dụng glass effect cho mọi thành phần. Nội dung quan trọng phải có độ tương phản tốt.

Ưu tiên các lớp:

- Background.
- Glass surface.
- Elevated glass.
- Solid content surface.
- Interactive surface.

## 2.3. Bảng màu

Sử dụng hệ màu sáng làm mặc định.

**Primary:**

- Soft blue: `#6D9EFF`.
- Deep blue: `#4778D8`.
- Lavender: `#A69AF5`.
- Soft violet: `#C1B5FF`.

**Background:**

- `#F5F7FC`.
- `#EEF2FA`.
- `#FFFFFF`.

**Text:**

- Primary: `#26334A`.
- Secondary: `#69758C`.
- Muted: `#9AA5B7`.

**Semantic:**

- Success: xanh lá dịu.
- Warning: vàng ấm.
- Error: đỏ san hô dịu.
- Info: xanh dương.

Không dùng quá nhiều màu cùng lúc.

Màu sắc phải có hệ thống và nhất quán.

## 2.4. Typography

Ưu tiên font Quicksand cho tiêu đề và giao diện thân thiện.

Có thể kết hợp Be Vietnam Pro hoặc Inter cho nội dung dài nếu Quicksand không đảm bảo khả năng đọc.

Yêu cầu:

- Hiển thị tiếng Việt đầy đủ.
- Không lỗi dấu.
- Không cắt chữ.
- Phân cấp heading rõ ràng.
- Cỡ chữ phù hợp.
- Line-height thoáng.
- Không sử dụng chữ quá nhỏ.

## 2.5. Border Radius

Thiết kế bo góc thống nhất:

- Small controls: 10–12px.
- Inputs: 12–16px.
- Buttons: 12–16px.
- Cards: 18–24px.
- Main panels: 24–28px.
- Dialogs: 24–28px.
- Avatars: hình tròn hoặc bo góc tùy ngữ cảnh.

Không dùng mỗi thành phần một kiểu bo góc ngẫu nhiên.

## 2.6. Shadow và Depth

Tạo chiều sâu bằng:

- Ambient shadow.
- Soft elevation.
- Inner highlight.
- Subtle border.
- Hover elevation.

Không tạo shadow đen đậm.

## 2.7. Animation

Sử dụng Framer Motion hoặc CSS transition hợp lý.

Các animation:

- Sidebar mở rộng.
- Chuyển trang.
- Hover button.
- Card xuất hiện.
- Modal mở và đóng.
- Toast notification.
- Student speaking indicator.
- Student hand-raising indicator.
- Loading skeleton.
- Camera initialization.
- Feedback notification.

Tốc độ chuyển động nên nhẹ và nhanh, thông thường 150–300ms.

Hỗ trợ `prefers-reduced-motion`.

Không dùng animation gây giật hoặc làm giảm FPS của camera.

## 2.8. Responsive

Thiết kế ưu tiên:

- Laptop 1366×768.
- Desktop 1440×900.
- Laptop 1280×720.
- Tablet.
- Mobile.

Trên laptop, phải sử dụng không gian hợp lý, tránh giao diện quá trống.

Trên điện thoại:

- Sidebar chuyển thành navigation phù hợp.
- Các bảng chuyển thành card.
- Không tràn ngang.
- Các nút thao tác có vùng chạm đủ lớn.

## 2.9. Design System Component

Xây dựng component dùng chung:

- Button.
- IconButton.
- Input.
- Textarea.
- Select.
- Dropdown.
- Tooltip.
- Badge.
- GlassCard.
- StatCard.
- Modal.
- Drawer.
- Popover.
- Tabs.
- Accordion.
- Progress.
- CircularProgress.
- Toast.
- Skeleton.
- EmptyState.
- ErrorState.
- LoadingState.
- Avatar.
- AvatarGroup.
- StudentCard.
- FeedbackCard.
- SectionHeader.
- PageHeader.
- ConfirmDialog.

Tất cả phải thống nhất về màu sắc, spacing, radius, typography và trạng thái tương tác.

---

# PHẦN III. CÔNG NGHỆ VÀ KIẾN TRÚC

## 3.1. Technology Stack

Ưu tiên:

**Frontend:**

- React.
- Vite.
- TypeScript.
- Tailwind CSS.
- shadcn/ui hoặc component tự xây dựng.
- Framer Motion.
- Lucide Icons.

**Data:**

- IndexedDB.
- Dexie.js.
- LocalStorage chỉ dùng cho cài đặt nhỏ, không lưu dữ liệu lớn.

**Computer Vision:**

- MediaPipe Tasks Vision.
- Pose Landmarker.
- Face Landmarker chỉ sử dụng nếu thực sự cần và không nhận dạng danh tính.

**Audio:**

- Web Audio API.
- MediaDevices API.
- Speech recognition có khả năng thay thế khi trình duyệt không hỗ trợ.

**AI:**

- Thiết kế lớp AI Provider độc lập.
- Có thể tích hợp mô hình AI bên ngoài thông qua server endpoint.
- Không khóa hệ thống vào một nhà cung cấp duy nhất.

**Backend:**

- Vercel Functions khi triển khai Vercel.
- Không giả định Vite tự động nhận mọi thư mục api theo cách tùy ý.
- Cấu hình chính xác theo kiến trúc được chọn.

**Optional:**

- Supabase nếu sau này cần đồng bộ dữ liệu.
- Recharts để hiển thị báo cáo.

## 3.2. Nguyên tắc Local-first

Ứng dụng phải có thể sử dụng các chức năng nền tảng mà không cần tài khoản hoặc database cloud.

Dữ liệu mặc định được lưu trên thiết bị:

- Hồ sơ người dùng.
- KHBD.
- Cấu hình lớp học.
- Hồ sơ học sinh AI.
- Lịch sử luyện tập.
- Báo cáo.
- Cài đặt.

Sử dụng IndexedDB thông qua Dexie.

Cần có:

- Export backup.
- Import backup.
- Kiểm tra dữ liệu import.
- Xác nhận trước khi ghi đè.
- Xóa dữ liệu.
- Kiểm tra phiên bản schema.
- Migration dữ liệu.

Không lưu video lớn trực tiếp vào LocalStorage.

Không dùng filesystem tạm thời của Vercel để lưu dữ liệu lâu dài.

## 3.3. Kiến trúc module

Tách các module:

1. app-shell.
2. dashboard.
3. lesson-library.
4. lesson-parser.
5. lesson-context-engine.
6. virtual-classroom.
7. student-persona-engine.
8. classroom-simulation-engine.
9. live-practice.
10. camera-analysis.
11. audio-analysis.
12. speech-transcription.
13. teaching-language-analysis.
14. feedback-engine.
15. performance-report.
16. training-center.
17. settings.
18. storage.
19. ai-provider.
20. shared-components.

Không đặt toàn bộ logic trong React component.

Tách UI, business logic, services, types, hooks và data access.

## 3.4. Data Models

Xây dựng TypeScript types rõ ràng.

Các entity tối thiểu:

**UserProfile:**

- id.
- displayName.
- avatar.
- createdAt.

**LessonPlan:**

- id.
- title.
- subject.
- grade.
- topic.
- fileName.
- fileType.
- extractedText.
- objectives.
- knowledge.
- teachingMaterials.
- lessonPhases.
- exercises.
- expectedStudentResponses.
- assessmentCriteria.
- parsingStatus.
- createdAt.
- updatedAt.

**StudentPersona:**

- id.
- name.
- avatar.
- grade.
- learningLevel.
- participationStyle.
- knowledgeState.
- misconceptionProfile.
- responseStyle.
- behaviorRules.

**PracticeSession:**

- id.
- lessonPlanId.
- mode.
- startedAt.
- endedAt.
- duration.
- sessionStatus.
- settings.

**PoseObservation:**

- timestamp.
- keypoints.
- visibility.
- postureMetrics.
- confidence.

**AudioObservation:**

- timestamp.
- volume.
- speechActivity.
- pauseDuration.
- estimatedSpeakingRate.
- confidence.

**TranscriptSegment:**

- id.
- startTime.
- endTime.
- text.
- speaker.
- confidence.

**ClassroomEvent:**

- id.
- timestamp.
- lessonPhaseId.
- studentId.
- eventType.
- inputContext.
- response.
- confidence.

**FeedbackEvent:**

- id.
- timestamp.
- category.
- severity.
- evidence.
- explanation.
- recommendation.
- confidence.

**CompetencyScore:**

- category.
- score.
- confidence.
- evidenceIds.
- insufficientData.

**EvidenceItem:**

- id.
- timestamp.
- source.
- observedFact.
- interpretation.
- confidence.

Không lưu thông tin không cần thiết.

---

# PHẦN IV. CẤU TRÚC ỨNG DỤNG

## 4.1. Main Layout

Ứng dụng có:

**Sidebar bên trái:**

- Logo.
- Dashboard.
- Thư viện KHBD.
- Luyện tập giảng dạy.
- Lớp học AI.
- Báo cáo.
- Trung tâm luyện tập.
- Cài đặt.

**Main Content:**

- Header.
- Breadcrumb.
- Page title.
- Main workspace.
- Contextual actions.

Sidebar:

- Có thể thu gọn.
- Có tooltip.
- Hiển thị mục đang chọn.
- Không chiếm quá nhiều diện tích.
- Lưu trạng thái thu gọn.

Header:

- Search.
- Notification.
- User profile.
- Quick action.

Không tạo menu trang trí không có chức năng.

## 4.2. Dashboard

Mục tiêu: giúp người dùng biết mình đang ở đâu, đã luyện tập thế nào và nên làm gì tiếp theo.

Các khu vực:

**A. Welcome Section**

- Lời chào.
- Tên người dùng.
- Ngày hiện tại.
- Nút bắt đầu luyện tập.

**B. Quick Actions**

- Tải KHBD.
- Bắt đầu buổi luyện tập.
- Mở lớp học AI.
- Xem báo cáo.

**C. Learning Statistics**

- Tổng số buổi luyện tập.
- Tổng thời gian.
- Số KHBD đã luyện tập.
- Số năng lực đang được theo dõi.

**D. Competency Overview**

- Ngôn ngữ sư phạm.
- Giọng nói.
- Tư thế và cử chỉ.
- Tổ chức hoạt động.
- Đặt câu hỏi.
- Xử lý tình huống.

**E. Recent Sessions**

- Bài dạy.
- Thời gian.
- Ngày thực hiện.
- Trạng thái.
- Nút xem báo cáo.

**F. Improvement Suggestions**

- Năng lực nên cải thiện.
- Bài tập phù hợp.
- Lý do đề xuất.

**G. Recent Lesson Plans**

- Các KHBD gần đây.
- Nút tiếp tục luyện tập.

Tất cả dữ liệu phải lấy từ IndexedDB.

Nếu chưa có dữ liệu, hiển thị empty state có hướng dẫn bắt đầu.

Không tạo số liệu thành tích giả.

---

# PHẦN V. LESSON PLAN LIBRARY – THƯ VIỆN KẾ HOẠCH BÀI DẠY

## 5.1. Mục tiêu

Đây là một module cốt lõi.

Người dùng phải tải KHBD lên trước khi tạo buổi luyện tập dựa trên bài dạy.

## 5.2. Upload

Hỗ trợ:

- PDF.
- DOCX.
- TXT nếu cần.

Giao diện:

- Drag and drop.
- Nút chọn file.
- Hiển thị tên file.
- Dung lượng.
- Định dạng.
- Trạng thái upload.
- Nút hủy.
- Xử lý lỗi.

Kiểm tra:

- File hợp lệ.
- File rỗng.
- File lỗi.
- Định dạng không hỗ trợ.
- File quá lớn.
- PDF scan không có text.
- DOCX có bảng hoặc cấu trúc phức tạp.

Không âm thầm bỏ qua nội dung bảng.

Nếu PDF là bản scan, thông báo cần OCR. Không tuyên bố đã đọc nội dung khi chưa trích xuất được.

## 5.3. Parsing KHBD

Trích xuất:

1. Thông tin bài dạy.
2. Môn học.
3. Lớp.
4. Tên bài.
5. Yêu cầu cần đạt.
6. Mục tiêu.
7. Thiết bị dạy học.
8. Tiến trình.
9. Hoạt động giáo viên.
10. Hoạt động học sinh.
11. Câu hỏi.
12. Bài tập.
13. Đáp án dự kiến.
14. Đánh giá.
15. Kiến thức trọng tâm.

Nhận diện cấu trúc linh hoạt vì mỗi giáo án có thể có cách trình bày khác nhau.

Không phụ thuộc vào một mẫu Word duy nhất.

## 5.4. Lesson Review

Sau khi phân tích, mở trang xác nhận:

- Thông tin bài dạy.
- Mục tiêu.
- Các hoạt động.
- Kiến thức.
- Câu hỏi.
- Dự kiến câu trả lời.
- Thời lượng dự kiến.

Người dùng được chỉnh sửa thông tin AI trích xuất.

Mỗi trường cần thể hiện:

- Nội dung trích xuất.
- Độ tin cậy nếu có.
- Trạng thái cần kiểm tra.

Có nút:

- Xác nhận.
- Chỉnh sửa.
- Phân tích lại.
- Lưu KHBD.
- Hủy.

Không cho phép bắt đầu mô phỏng nếu thông tin quan trọng chưa được xác nhận.

## 5.5. Lesson Library

Các KHBD được hiển thị dạng card.

Có:

- Search.
- Filter môn học.
- Filter lớp.
- Sort.
- Preview.
- Edit.
- Duplicate.
- Delete.
- Start Practice.

Không được xóa KHBD khi người dùng chưa xác nhận.

---

# PHẦN VI. LESSON CONTEXT ENGINE

Đây là bộ não giúp AI hiểu giáo án.

## 6.1. Nhiệm vụ

Chuyển KHBD thành một cấu trúc ngữ nghĩa có thể sử dụng trong quá trình mô phỏng.

Không chỉ đưa toàn bộ văn bản giáo án vào một prompt rồi yêu cầu AI tự nhớ.

## 6.2. Lesson Context

Tạo cấu trúc:

**Lesson Context:**

- Subject.
- Grade.
- Topic.
- Objectives.
- PrerequisiteKnowledge.
- CoreKnowledge.
- ExpectedSkills.
- LessonPhases.
- TeacherInstructions.
- StudentTasks.
- Exercises.
- ExpectedAnswers.
- Misconceptions.
- AssessmentCriteria.

## 6.3. Lesson Phase

Mỗi giai đoạn cần có:

- Phase ID.
- Phase name.
- Objective.
- Teacher actions.
- Student actions.
- Materials.
- Questions.
- Expected responses.
- Completion criteria.
- Estimated duration.

## 6.4. Theo dõi tiến trình

Hệ thống phải xác định người dạy đang:

- Khởi động.
- Khám phá.
- Hình thành kiến thức.
- Luyện tập.
- Vận dụng.
- Củng cố.

Không bắt buộc tiến trình phải đúng tuyệt đối với giáo án.

Nếu người dùng chuyển sang hoạt động khác, hệ thống phải thích nghi.

Không tự động chuyển giai đoạn chỉ dựa trên thời gian.

Dùng nội dung lời giảng, câu hỏi, chỉ dẫn và ngữ cảnh để xác định giai đoạn.

Cho phép người dùng tự chọn giai đoạn khi hệ thống không chắc chắn.

## 6.5. Context Window Management

Không gửi toàn bộ KHBD trong mọi lượt gọi AI.

Chỉ gửi:

- Mục tiêu bài học.
- Giai đoạn hiện tại.
- Kiến thức liên quan.
- Hoạt động hiện tại.
- Câu hỏi hiện tại.
- Hồ sơ học sinh liên quan.
- Các lượt hội thoại gần nhất.

Có thể lưu tóm tắt trạng thái lớp học để giữ mạch hội thoại.

---

# PHẦN VII. STUDENT PERSONA ENGINE – TẠO HỌC SINH AI

## 7.1. Mục tiêu

AI không được chỉ có một nhân vật học sinh chung.

Tạo một lớp học gồm nhiều nhân vật có đặc điểm học tập khác nhau.

## 7.2. Các kiểu học sinh mặc định

1. Học sinh tích cực.
2. Học sinh nhút nhát.
3. Học sinh cần hỗ trợ.
4. Học sinh tò mò.
5. Học sinh dễ mất tập trung.
6. Học sinh khá giỏi.

Tên nhân vật phải thân thiện, tự nhiên và phù hợp lứa tuổi.

## 7.3. Hồ sơ nhân vật

Mỗi persona gồm:

- ID.
- Tên.
- Avatar.
- Lớp.
- Năng lực học tập giả lập.
- Mức độ tham gia.
- Kiểu phản hồi.
- Kiến thức đã biết.
- Khó khăn.
- Lỗi sai thường gặp.
- Tốc độ tiếp thu giả lập.
- Cách sử dụng ngôn ngữ.
- Hành vi trong lớp.

## 7.4. Tính nhất quán

Ví dụ:

**Học sinh A:**

- Thường giơ tay.
- Trả lời nhanh.
- Thỉnh thoảng thiếu giải thích.

**Học sinh B:**

- Ngại phát biểu.
- Có thể trả lời khi được gọi.
- Cần khuyến khích.

**Học sinh C:**

- Chưa hiểu một kiến thức nền.
- Có thể nhầm lẫn ở bài tập.
- Cần được giáo viên hướng dẫn.

Không được thay đổi trình độ của học sinh tùy tiện giữa các lượt.

Không được để học sinh chưa được dạy kiến thức mới trả lời hoàn hảo mọi câu hỏi.

## 7.5. Số lượng

Cho phép chọn:

- 5 học sinh.
- 10 học sinh.
- 20 học sinh.

Mặc định 10 học sinh.

Nếu cấu hình máy yếu, đề xuất 5 học sinh.

Không nhất thiết mỗi học sinh đều phải có một mô hình AI độc lập.

Dùng một Student Simulation Controller để quản lý nhiều persona.

## 7.6. Avatar

Thiết kế avatar 3D hoặc 2D minh họa dễ thương.

Không cần sử dụng video hoặc mô hình nhân vật 3D nặng ở phiên bản đầu.

Avatar cần có trạng thái:

- Bình thường.
- Giơ tay.
- Đang nói.
- Đang suy nghĩ.
- Chưa hiểu.
- Đang làm bài.

---

# PHẦN VIII. CLASSROOM SIMULATION ENGINE

## 8.1. Hai chế độ

**MODE A – NATURAL CLASSROOM**

AI tự quyết định:

- Ai giơ tay.
- Ai phát biểu.
- Ai trả lời sai.
- Ai đặt câu hỏi.
- Ai chưa hiểu.
- Khi nào cần tương tác.

Giáo viên không được biết trước toàn bộ tình huống.

**MODE B – SCENARIO TRAINING**

Người dùng chọn một tình huống cụ thể để luyện tập.

Ví dụ:

- Học sinh trả lời sai.
- Học sinh không hiểu.
- Học sinh mất tập trung.
- Học sinh không tham gia.
- Học sinh hỏi ngoài bài.
- Nhiều học sinh phát biểu.
- Học sinh làm bài sai.
- Học sinh tranh luận.

## 8.2. Student Event

Các event:

- RAISE_HAND.
- ANSWER_QUESTION.
- ASK_QUESTION.
- WRONG_ANSWER.
- INCOMPLETE_ANSWER.
- NEED_HELP.
- DISTRACTED.
- REQUEST_EXPLANATION.
- COMPLETE_EXERCISE.
- PARTICIPATE_IN_ACTIVITY.

## 8.3. Turn Controller

Xây dựng bộ điều khiển lượt hội thoại.

Không cho tất cả học sinh cùng nói một lúc.

Quy trình:

1. Nhận diện lời giảng.
2. Xác định ý định giáo viên.
3. Xác định giai đoạn bài học.
4. Xác định các persona phù hợp.
5. Chọn học sinh tương tác.
6. Sinh phản hồi.
7. Kiểm tra tính phù hợp.
8. Hiển thị phản hồi.
9. Cập nhật trạng thái học sinh và lớp học.

## 8.4. Logic tương tác

Ví dụ:

Giáo viên: "Các em hãy tính 3 nhân 4 bằng bao nhiêu?"

AI cần hiểu đây là câu hỏi về phép nhân.

Học sinh tích cực:

"Thưa cô, bằng 12 ạ!"

Học sinh cần hỗ trợ:

"Thưa cô, có phải lấy 3 cộng 4 không ạ?"

Học sinh tò mò:

"Thưa cô, vì sao phép nhân lại có thể thay cho phép cộng nhiều lần ạ?"

Phản hồi phải đúng trình độ và kiến thức của bài học.

Không được để tất cả nhân vật phản hồi cùng lúc.

## 8.5. Xử lý chỉ dẫn của giáo viên

Nếu giáo viên nói:

- "Cả lớp cùng quan sát."
- "Các em thảo luận nhóm đôi."
- "Bạn nào biết hãy giơ tay."
- "Mời bạn Minh Anh."
- "Các em lấy bảng con."
- "Chúng ta chuyển sang bài tập tiếp theo."

AI phải nhận diện ý định tương ứng.

Nếu không thể thực hiện một hành động vật lý, phải mô phỏng trạng thái bằng giao diện.

## 8.6. Điều khiển lớp học

Có các nút:

- Pause simulation.
- Resume simulation.
- End simulation.
- Reset classroom.
- Change scenario.
- Adjust difficulty.

Có tùy chỉnh:

- Mức độ chủ động của học sinh.
- Tần suất phát biểu.
- Độ khó tình huống.
- Mức độ tương tác.
- Thời gian phản hồi.

---

# PHẦN IX. LIVE PRACTICE – LUYỆN TẬP GIẢNG DẠY

## 9.1. Setup

Trước khi bắt đầu:

- Chọn KHBD.
- Chọn chế độ mô phỏng.
- Chọn số lượng học sinh.
- Chọn cấu hình lớp.
- Kiểm tra camera.
- Kiểm tra microphone.
- Kiểm tra trình duyệt.
- Kiểm tra quyền truy cập.

Có nút bắt đầu.

Không tự bật camera hoặc microphone.

## 9.2. Camera

Sử dụng MediaDevices API.

Các chức năng:

- Xin quyền camera.
- Chọn camera.
- Preview.
- Kiểm tra chất lượng.
- Chọn độ phân giải phù hợp.
- Bật/tắt camera.
- Hiển thị lỗi nếu không truy cập được.

Gợi ý vị trí:

- Đặt laptop ở vị trí ổn định.
- Để đủ khoảng cách quan sát.
- Đảm bảo ánh sáng.
- Đảm bảo cơ thể nằm trong khung hình nếu cần phân tích toàn thân.

Không yêu cầu người dùng phải quay toàn thân nếu mục tiêu phân tích chỉ là khuôn mặt hoặc phần thân trên.

## 9.3. Microphone

Các chức năng:

- Xin quyền microphone.
- Chọn microphone.
- Test âm thanh.
- Hiển thị mức âm lượng.
- Phát hiện có tiếng nói.
- Phát hiện khoảng lặng.
- Phát hiện mất tín hiệu.

Không đồng nhất âm lượng lớn với giọng nói tốt.

## 9.4. Live Interface

Layout ưu tiên laptop:

**LEFT:**

- Webcam.
- Camera overlay.
- Timer.
- Session controls.

**RIGHT:**

- AI Classroom.
- Student avatars.
- Student activity.
- Live interaction feed.

**BOTTOM hoặc SIDE PANEL:**

- Live Coach feedback.
- Current lesson phase.
- Transcript.

Các panel có thể thu gọn.

Không làm giao diện quá chật.

## 9.5. Session State

Có trạng thái:

- IDLE.
- INITIALIZING.
- READY.
- RECORDING_OR_ANALYZING.
- PAUSED.
- COMPLETED.
- ERROR.

Không cho bắt đầu nhiều session cùng lúc.

Khi dừng session, phải giải phóng camera và microphone.

Nếu trình duyệt đóng hoặc bị lỗi, dữ liệu đã lưu phải được bảo vệ ở mức có thể.

---

# PHẦN X. COMPUTER VISION – PHÂN TÍCH TƯ THẾ

## 10.1. Công nghệ

Dùng MediaPipe Pose Landmarker chạy tại trình duyệt.

Không gửi toàn bộ video lên server.

## 10.2. Các chỉ số

Phân tích:

1. Khả năng hiển thị cơ thể.
2. Vị trí trong khung hình.
3. Tư thế thân trên.
4. Độ ổn định.
5. Chuyển động.
6. Cử chỉ tay.
7. Hướng đầu tương đối nếu có đủ dữ liệu.
8. Mức độ thay đổi tư thế.

Không đưa ra kết luận tuyệt đối khi landmark không đủ rõ.

## 10.3. Overlay

Có tùy chọn:

- Skeleton.
- Landmark.
- Bounding visualization.
- Movement path.

Có nút bật/tắt overlay.

Overlay không được che khuất hình ảnh người dạy.

## 10.4. Feedback

Ví dụ:

- Bạn đang đứng quá gần camera.
- Hình ảnh chưa đủ sáng.
- Một số cử chỉ tay chưa nằm trong khung hình.
- Bạn di chuyển ra ngoài vùng quan sát.

Không nhận xét ngoại hình hoặc suy đoán cảm xúc.

---

# PHẦN XI. AUDIO ANALYSIS – PHÂN TÍCH GIỌNG NÓI

## 11.1. Phân tích cơ bản

Dùng Web Audio API.

Đánh giá:

- Relative volume.
- Speech activity.
- Pauses.
- Speaking rate estimate.
- Speaking duration.
- Voice consistency.

Có thể phân tích pitch variation nếu dữ liệu đủ tin cậy.

Không đồng nhất pitch variation với biểu cảm tốt.

## 11.2. Speech Transcription

Nhận diện lời giảng tiếng Việt.

Ưu tiên:

- Có timestamp.
- Có transcript segment.
- Có confidence.
- Có khả năng sửa transcript.

Nếu Web Speech API không được hỗ trợ hoặc hoạt động không ổn định, hiển thị thông báo và cho phép người dùng dùng phương án thay thế.

Không giả lập transcript.

## 11.3. Phân tích ngôn ngữ sư phạm

Phân tích:

- Cách chào lớp.
- Giới thiệu bài.
- Chuyển hoạt động.
- Đặt câu hỏi.
- Giải thích.
- Hướng dẫn.
- Khen ngợi.
- Khích lệ.
- Xử lý câu trả lời sai.
- Tổng kết.

Đánh giá độ phù hợp với học sinh tiểu học.

Phân biệt:

- Câu hỏi đóng.
- Câu hỏi mở.
- Câu hỏi gợi mở.
- Câu hỏi kiểm tra kiến thức.
- Câu hỏi vận dụng.

Không tự động coi câu hỏi mở luôn tốt hơn câu hỏi đóng. Đánh giá dựa trên mục tiêu dạy học.

---

# PHẦN XII. LIVE COACH – TRỢ LÝ PHẢN HỒI

## 12.1. Nguyên tắc

Phản hồi hiển thị trên màn hình.

Không phát giọng nói chen ngang lời giảng.

Không hiện quá nhiều thông báo.

Không làm gián đoạn quá trình luyện tập.

## 12.2. Phân loại

**INFO:** Thông tin nhẹ.

**SUGGESTION:** Gợi ý cải thiện.

**WARNING:** Vấn đề cần chú ý.

**CRITICAL:** Lỗi nghiêm trọng có đủ bằng chứng.

Không lạm dụng CRITICAL.

## 12.3. Ví dụ

- Bạn đã đặt câu hỏi nhưng chưa chờ đủ thời gian để học sinh suy nghĩ.
- Câu hỏi có thể được diễn đạt ngắn gọn hơn.
- Hãy khuyến khích học sinh giải thích cách làm.
- Bạn đang chuyển hoạt động hơi nhanh.
- Bạn có thể khai thác câu trả lời chưa chính xác để dẫn dắt học sinh.
- Một số hướng dẫn chưa rõ hành động cần thực hiện.

## 12.4. Feedback Card

Mỗi thông báo có:

- Category.
- Severity.
- Timestamp.
- Evidence.
- Explanation.
- Suggested action.
- Confidence.

Có thể:

- Ẩn.
- Ghim.
- Xem chi tiết.
- Đánh dấu hữu ích.
- Đánh dấu chưa chính xác.

## 12.5. Cooldown

Không lặp lại cùng một cảnh báo liên tục.

Dùng:

- Cooldown.
- Duplicate suppression.
- Confidence threshold.
- Minimum evidence.

Không phát cảnh báo từ một khung hình đơn lẻ thiếu tin cậy.

---

# PHẦN XIII. TEACHING PERFORMANCE REPORT

## 13.1. Báo cáo sau buổi tập

Sau khi kết thúc, tạo báo cáo:

- Tổng quan.
- Thời lượng.
- KHBD sử dụng.
- Tiến trình thực hiện.
- Những điểm mạnh.
- Điểm cần cải thiện.
- Timeline.
- Bằng chứng.
- Gợi ý luyện tập tiếp theo.

## 13.2. Nhóm năng lực

Đánh giá 6 nhóm:

1. Ngôn ngữ sư phạm.
2. Giọng nói.
3. Tư thế và cử chỉ.
4. Tổ chức hoạt động dạy học.
5. Tương tác và xử lý tình huống.
6. Tác phong trình bày.

## 13.3. Trọng số tham khảo

- Ngôn ngữ sư phạm: 25%.
- Tổ chức hoạt động: 15%.
- Tương tác và xử lý tình huống: 15%.
- Giọng nói: 20%.
- Tư thế và cử chỉ: 20%.
- Tác phong trình bày: 5%.

Các trọng số phải có thể cấu hình.

Không tự động tính điểm nếu không đủ dữ liệu.

## 13.4. Evidence-based

Mỗi nhận xét phải có dẫn chứng.

Ví dụ:

**00:02:15**

Người dạy đặt câu hỏi nhưng chưa chờ học sinh suy nghĩ đủ lâu.

**00:05:30**

Người dạy đã khuyến khích học sinh trả lời chưa chính xác bằng lời động viên tích cực.

Không tạo timestamp giả.

Nếu không có transcript hoặc dữ liệu phù hợp, ghi rõ chưa đủ dữ liệu.

## 13.5. Comparison

Cho phép so sánh nhiều buổi tập:

- Lần 1.
- Lần 2.
- Lần 3.

Biểu đồ tiến bộ phải lấy dữ liệu thực tế.

Không tự tạo xu hướng tiến bộ.

---

# PHẦN XIV. TRAINING CENTER – TRUNG TÂM LUYỆN TẬP

Tạo thư viện bài luyện tập riêng.

Các nhóm:

1. Luyện giọng nói.
2. Luyện tư thế.
3. Luyện đặt câu hỏi.
4. Luyện ngôn ngữ sư phạm.
5. Luyện mở đầu bài học.
6. Luyện chuyển hoạt động.
7. Luyện xử lý tình huống.
8. Luyện tương tác với học sinh.

Mỗi bài có:

- Tên.
- Mục tiêu.
- Hướng dẫn.
- Thời lượng.
- Các bước thực hiện.
- Tiêu chí đánh giá.
- Kết quả.

Có thể sử dụng AI học sinh trong các bài luyện tình huống.

---

# PHẦN XV. SETTINGS

Các nhóm:

## General

- Tên người dùng.
- Avatar.
- Ngôn ngữ.
- Giao diện.

## Appearance

- Light.
- Dark.
- System.
- Accent color.

## Practice

- Camera mặc định.
- Microphone mặc định.
- Số học sinh mặc định.
- Chế độ mô phỏng mặc định.
- Độ khó.

## AI

- AI provider.
- API configuration.
- Kiểm tra kết nối.
- Trạng thái API.
- Model đang sử dụng.

Không hiển thị API key dạng đầy đủ sau khi đã lưu.

## Privacy

- Dữ liệu được lưu ở đâu.
- Tùy chọn ghi hình.
- Xóa dữ liệu.
- Export dữ liệu.
- Quyền camera.
- Quyền microphone.

---

# PHẦN XVI. AI PROVIDER ARCHITECTURE

## 16.1. Không phụ thuộc vào một AI Provider

Tạo interface:

**AIProvider:**

- analyzeLessonPlan().
- generateStudentResponse().
- classifyTeacherIntent().
- analyzeTeachingLanguage().
- summarizeSession().
- generateFeedback().

Có thể có:

- LocalRuleProvider.
- GeminiProvider.
- OtherProvider.

Provider phải có khả năng thay thế.

## 16.2. Rule-based Fallback

Nếu không có API:

- Các chức năng camera vẫn hoạt động.
- Audio metrics vẫn hoạt động.
- Lesson parsing cơ bản vẫn hoạt động.
- Classroom simulation ở mức rule-based vẫn hoạt động.
- Báo cáo vẫn có thể tổng hợp các quan sát thực tế.

Không được tuyên bố fallback rule-based là AI hiểu ngôn ngữ tự nhiên hoàn chỉnh.

## 16.3. API Security

Nếu sử dụng Gemini hoặc nhà cung cấp khác:

- Gọi qua server endpoint.
- API key lưu trong environment variables.
- Không hardcode key.
- Validate request.
- Giới hạn kích thước payload.
- Xử lý timeout.
- Xử lý quota.
- Rate limit nếu cần.
- Không gửi video liên tục lên API.

Không để API key xuất hiện trong browser bundle.

---

# PHẦN XVII. PRIVACY & SECURITY

1. Camera chỉ bật sau khi người dùng cho phép.
2. Microphone chỉ bật sau khi người dùng cho phép.
3. Không tự động ghi hình.
4. Ghi hình phải là tùy chọn riêng.
5. Không nhận dạng danh tính khuôn mặt.
6. Không suy luận cảm xúc từ khuôn mặt.
7. Không đánh giá trí thông minh từ hình ảnh.
8. Không tải video lên server mặc định.
9. Dữ liệu cá nhân được lưu cục bộ theo mặc định.
10. Có chức năng xóa dữ liệu.
11. Có chức năng export.
12. Không gửi dữ liệu nhạy cảm tới API bên ngoài nếu chưa có sự đồng ý.
13. Thông báo rõ các dữ liệu được gửi tới nhà cung cấp AI.
14. Có xử lý lỗi quyền camera và microphone.
15. Không ghi lại hình ảnh người khác ngoài ý muốn.

Đặc biệt: AI học sinh là nhân vật hư cấu. Không dùng ảnh hoặc dữ liệu cá nhân của trẻ em thật để tạo persona.

---

# PHẦN XVIII. PERFORMANCE

Ứng dụng cần chạy tốt trên laptop phổ thông.

Ưu tiên:

- Lazy loading.
- Code splitting.
- Memoization.
- Giới hạn FPS.
- Giảm số lần gọi AI.
- Debounce.
- Throttle.
- Web Worker khi phù hợp.
- Cleanup camera stream.
- Cleanup audio context.
- Giải phóng object URL.
- Xử lý memory leak.

Không xử lý AI cho từng frame camera.

Camera pose analysis có thể bắt đầu ở khoảng 5–10 FPS tùy thiết bị và hiệu năng.

Không cố định FPS nếu thiết bị không đáp ứng.

Tách:

- Camera frame processing.
- Audio processing.
- Speech transcription.
- AI reasoning.
- UI rendering.

Không để một tiến trình làm treo toàn bộ ứng dụng.

---

# PHẦN XIX. IMPLEMENTATION ROADMAP

**PHẢI THỰC HIỆN THEO ĐÚNG THỨ TỰ.**

Không làm tất cả cùng lúc.

## PHASE 0 – PROJECT FOUNDATION

1. Khởi tạo dự án.
2. Cấu hình TypeScript.
3. Cấu hình Tailwind.
4. Cấu hình router.
5. Cấu hình thư mục.
6. Tạo design tokens.
7. Tạo component nền tảng.
8. Tạo app shell.
9. Kiểm tra responsive.
10. Kiểm tra build.

**Deliverable:**

- Ứng dụng chạy được.
- Có sidebar.
- Có header.
- Có routing.
- Có design system.

## PHASE 1 – UI & LOCAL DATA

1. Dashboard.
2. Lesson Library.
3. Settings.
4. Dexie database.
5. CRUD KHBD.
6. CRUD settings.
7. Export/import backup.
8. Empty states.
9. Loading states.
10. Error states.

**Deliverable:**

Các màn hình hoạt động thật với dữ liệu local.

## PHASE 2 – LESSON PLAN ENGINE

1. Upload PDF.
2. Upload DOCX.
3. Extract text.
4. Parse headings.
5. Parse tables.
6. Structure lesson phases.
7. Extract objectives.
8. Extract exercises.
9. Build lesson context.
10. Lesson review screen.
11. Edit extracted data.
12. Save lesson.

**Deliverable:**

Người dùng có thể tải KHBD lên, kiểm tra nội dung và lưu lại.

## PHASE 3 – STUDENT PERSONA

1. Tạo persona schema.
2. Tạo 6 persona mặc định.
3. Tạo avatar.
4. Tạo knowledge state.
5. Tạo behavior rules.
6. Tạo persona editor.
7. Tạo lớp 5–20 học sinh.
8. Kiểm tra tính nhất quán.

**Deliverable:**

Lớp học mô phỏng có nhiều nhân vật.

## PHASE 4 – CLASSROOM SIMULATION

1. Event controller.
2. Turn controller.
3. Student selection.
4. Intent detection.
5. Lesson phase tracking.
6. Response generation.
7. Scenario mode.
8. Natural classroom mode.
9. Conversation history.
10. Pause/resume/reset.

**Deliverable:**

AI học sinh có thể tương tác thực sự dựa trên KHBD.

## PHASE 5 – CAMERA & AUDIO

1. Camera permission.
2. Camera preview.
3. Camera selection.
4. MediaPipe integration.
5. Pose analysis.
6. Audio permission.
7. Audio level.
8. Speech activity.
9. Pause detection.
10. Vietnamese transcription.
11. Transcript timeline.

**Deliverable:**

Camera và microphone hoạt động thực tế.

## PHASE 6 – LIVE COACH

1. Feedback engine.
2. Evidence collection.
3. Confidence.
4. Alert levels.
5. Duplicate suppression.
6. Cooldown.
7. Live feedback UI.
8. Teacher-only coaching panel.
9. Session event logging.

**Deliverable:**

Phản hồi có căn cứ trong lúc tập giảng.

## PHASE 7 – PERFORMANCE REPORT

1. Session summary.
2. Competency evaluation.
3. Evidence timeline.
4. Strengths.
5. Improvements.
6. Session comparison.
7. Export report.

**Deliverable:**

Báo cáo sau buổi tập dựa trên dữ liệu thực tế.

## PHASE 8 – FINALIZATION

1. Test toàn bộ chức năng.
2. Kiểm tra responsive.
3. Kiểm tra quyền camera.
4. Kiểm tra quyền microphone.
5. Kiểm tra lỗi dữ liệu.
6. Kiểm tra API failure.
7. Kiểm tra local persistence.
8. Kiểm tra performance.
9. Security review.
10. Accessibility review.
11. Build production.
12. Deploy Vercel.

**Deliverable:**

Một sản phẩm hoàn chỉnh có thể sử dụng.

---

# PHẦN XX. TESTING & ACCEPTANCE CRITERIA

Không được đánh dấu hoàn thành nếu chưa kiểm tra.

## Test 1 – Application

- Mở ứng dụng.
- Chuyển trang.
- Reload.
- Kiểm tra dữ liệu.
- Kiểm tra responsive.

## Test 2 – Lesson Plan

- Upload PDF.
- Upload DOCX.
- Parse.
- Review.
- Edit.
- Save.
- Reload.
- Kiểm tra nội dung còn nguyên.

## Test 3 – Student Personas

- Tạo lớp học.
- Chọn 5 học sinh.
- Chọn 10 học sinh.
- Chọn 20 học sinh.
- Kiểm tra profile.
- Kiểm tra hành vi.

## Test 4 – Simulation

- Đặt câu hỏi.
- Học sinh trả lời.
- Gọi tên một học sinh.
- Đưa ra hướng dẫn.
- Chuyển hoạt động.
- Pause.
- Resume.
- Reset.

## Test 5 – Camera

- Cho phép camera.
- Từ chối camera.
- Chọn camera khác.
- Tắt camera.
- Dừng session.
- Kiểm tra stream được giải phóng.

## Test 6 – Audio

- Cho phép microphone.
- Từ chối microphone.
- Kiểm tra âm thanh.
- Kiểm tra speech activity.
- Kiểm tra transcription.
- Kiểm tra lỗi không hỗ trợ.

## Test 7 – Report

- Kết thúc session.
- Tạo báo cáo.
- Kiểm tra evidence.
- Kiểm tra timestamp.
- Kiểm tra điểm thiếu dữ liệu.
- Reload và mở lại báo cáo.

## Test 8 – Security

- Kiểm tra API key.
- Kiểm tra dữ liệu.
- Kiểm tra quyền truy cập.
- Kiểm tra xóa dữ liệu.
- Kiểm tra API lỗi.

## Test 9 – Build

Phải chạy:

- `npm install`.
- `npm run build`.
- `npm run test` nếu đã cấu hình.
- `npm run lint` nếu đã cấu hình.

Không để lỗi TypeScript hoặc lỗi build chưa được xử lý.

---

# PHẦN XXI. QUY TẮC LÀM VIỆC VỚI AI CODING AGENT

Đây là phần bắt buộc.

## 21.1. Không được làm qua loa

Bạn phải hiểu rằng đây là một ứng dụng có nhiều module phụ thuộc lẫn nhau.

Không được tạo toàn bộ file cùng lúc mà không kiểm tra.

## 21.2. Làm theo từng task nhỏ

Với mỗi task:

1. Đọc yêu cầu.
2. Kiểm tra các file liên quan.
3. Xác định phụ thuộc.
4. Lập kế hoạch.
5. Triển khai.
6. Kiểm tra lỗi.
7. Chạy test.
8. Kiểm tra giao diện.
9. Cập nhật tài liệu.
10. Báo cáo kết quả.

## 21.3. Không tự ý giản lược

Nếu một yêu cầu khó:

- Phân tích vấn đề.
- Đưa ra phương án triển khai.
- Nêu giới hạn kỹ thuật.
- Chọn phương án phù hợp.
- Không âm thầm bỏ tính năng.

## 21.4. Không dùng placeholder

Không sử dụng:

- Nút bấm không có hành động.
- Modal rỗng.
- Chart số liệu ngẫu nhiên.
- AI response cố định nhưng gắn nhãn AI thật.
- Báo cáo giả.
- Dữ liệu giả làm kết quả thật.

Có thể dùng seed data để minh họa giao diện trong demo, nhưng phải ghi rõ DEMO và không được trộn với dữ liệu luyện tập thực tế.

## 21.5. Không phá vỡ kiến trúc

Mỗi module phải có trách nhiệm rõ ràng.

Không để:

- UI gọi API trực tiếp lung tung.
- Database logic nằm trong component.
- AI prompt rải rác trong nhiều file.
- TypeScript type trùng lặp.
- Logic nghiệp vụ bị sao chép.
- Component quá lớn.

## 21.6. Sau mỗi phase

Báo cáo:

- Đã hoàn thành gì.
- File nào đã tạo.
- File nào đã sửa.
- Chức năng nào chạy được.
- Chức năng nào còn thiếu.
- Test nào đã chạy.
- Lỗi còn tồn tại.
- Bước tiếp theo.

Không tuyên bố hoàn thành nếu chưa kiểm chứng.

## 21.7. Khi gặp lỗi

Không sửa bằng cách che lỗi hoặc tắt kiểm tra.

Phải:

1. Xác định nguyên nhân gốc.
2. Tìm vị trí gây lỗi.
3. Giải thích nguyên nhân.
4. Sửa đúng nguồn.
5. Chạy lại test.
6. Kiểm tra các chức năng liên quan.

## 21.8. Tài liệu

Tạo:

- README.md.
- ARCHITECTURE.md.
- IMPLEMENTATION_PLAN.md.
- TESTING.md.
- .env.example.
- CHANGELOG.md.

README phải hướng dẫn:

- Cài đặt.
- Chạy local.
- Build.
- Deploy.
- Cấu hình AI.
- Cấp quyền camera/microphone.
- Khắc phục lỗi phổ biến.

---

# PHẦN XXII. BẮT ĐẦU THỰC HIỆN

Bây giờ hãy bắt đầu xây dựng TEACHER COACH AI từ con số 0.

Không chỉ trả về một bản kế hoạch.

Hãy thực sự tạo mã nguồn và triển khai dự án.

Trình tự bắt buộc:

1. Kiểm tra workspace.
2. Nếu workspace trống, khởi tạo project.
3. Tạo kiến trúc thư mục.
4. Tạo design system.
5. Tạo app shell.
6. Hoàn thành PHASE 0.
7. Chạy build và kiểm tra.
8. Tiếp tục PHASE 1.
9. Sau mỗi phase, kiểm tra trước khi tiếp tục.

Nếu môi trường hỗ trợ thực hiện nhiều task, hãy chủ động tiếp tục theo roadmap, không dừng lại chỉ vì đã tạo xong giao diện.

Nếu có giới hạn thời gian hoặc công cụ, ưu tiên hoàn thành từng module có thể chạy thực tế, lưu lại trạng thái và tiếp tục từ task còn thiếu.

## FINAL PRODUCT STANDARD

TEACHER COACH AI phải là một nền tảng luyện tập giảng dạy thực sự, trong đó:

- Người dùng tải KHBD lên.
- AI hiểu nội dung bài dạy.
- AI tạo một lớp học mô phỏng phù hợp.
- AI đóng vai nhiều học sinh tiểu học.
- Người dùng giảng bài qua webcam và microphone.
- AI học sinh tương tác dựa trên lời giảng và KHBD.
- Hệ thống phân tích ngôn ngữ, giọng nói và tư thế.
- Trợ lý đưa ra phản hồi trên màn hình.
- Sau buổi tập, hệ thống tạo báo cáo có bằng chứng.
- Người dùng theo dõi sự tiến bộ qua nhiều buổi.

Sản phẩm cần có thiết kế Liquid Glass hiện đại, thông minh, bo góc mềm mại, dễ thương vừa phải, responsive, hiệu năng tốt và dễ mở rộng.

Hãy xây dựng như một sản phẩm EdTech thực thụ, không phải một bản demo giao diện.
