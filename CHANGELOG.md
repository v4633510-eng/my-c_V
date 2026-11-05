# Lịch sử Thay đổi (Changelog)

Tất cả các thay đổi đáng chú ý của dự án này sẽ được ghi lại trong file này.
Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), và dự án này tuân thủ [Semantic Versioning](https://semver.org/lang/vi/).

## [1.1.0] - 2026-11-05

### ✨ Đã thêm (Added)
- **Giao diện (UI/UX):**
  - Thêm hiệu ứng màu "Vàng Kim" (Gold Metallic) cho các thẻ nhãn kỹ năng (`.skill-chip`) và nhãn công nghệ của dự án (`.tag-list li`).
  - Nâng cấp hiệu ứng hover (khi di chuột) cho các nút bấm.
- **Game Snake.io:**
  - Thêm màn hình Game Over hiển thị điểm số trực quan.
  - Thêm hiệu ứng lưới (Grid) mờ ở background tạo cảm giác không gian.
  - Thêm hiệu ứng phát sáng (Glow) và nhấp nháy (Pulse) cho quả mồi.
  - Rắn được bo góc (Border-radius) thay vì hình vuông thô cứng.
  - Thêm hiệu ứng Gradient cho thân rắn (màu nhạt dần về phía đuôi).
  - Thêm mắt cho đầu rắn, tự động xoay theo hướng di chuyển.
- **Dự án:**
  - Thêm file `CHANGELOG.md` để theo dõi lịch sử phát triển.

### 🔄 Đã thay đổi (Changed)
- Cập nhật cấu trúc HTML cho thẻ `<article>` trong phần dự án để hỗ trợ tốt hơn cho việc bọc link (`<a>`) bao quanh ảnh.
- Tối ưu hóa CSS, loại bỏ các mã màu trùng lặp.

### 🐛 Đã sửa (Fixed)
- **Sửa lỗi nghiêm trọng:** Khắc phục lỗi file `games/snake/index.html` bị thiếu hụt mã JavaScript (bị cắt ngang), khiến game không thể khởi chạy khi click từ trang Portfolio.
- Sửa lỗi chính tả tiếng Việt trong phần giới thiệu bản thân và mô tả dự án (ví dụ: "trải nhiệm" -> "trải nghiệm", "ran san moi" -> "rắn săn mồi").
- Sửa lỗi đường link GitHub bị sai lệch giữa `href` và text hiển thị.
- Thêm thuộc tính `rel="noopener noreferrer"` cho các link mở tab mới để tăng cường bảo mật.

## [1.0.0] - 2026-10-30
### Đã thêm
- Ra mắt phiên bản đầu tiên của trang Portfolio (HTML5 & CSS3).
- Cấu trúc cơ bản gồm: Header, Hero, Kỹ năng, Dự án và Liên hệ.