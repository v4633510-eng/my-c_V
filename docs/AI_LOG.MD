# Nhật ký làm việc với AI (AI Log)

> **Mục đích:** File này lưu lại lịch sử các thay đổi do AI tạo ra, các lỗi đã gặp phải và cách khắc phục. 
> **Cách dùng:** Mỗi khi bắt đầu một phiên làm việc mới với AI, hãy yêu cầu AI đọc file này trước để nắm bối cảnh: *"Hãy đọc file AI_LOG.md để hiểu những gì chúng ta đã làm trước đó"*.

---

## 📅 Ngày: 05/11/2026 - Cập nhật giao diện và Game Snake

### 🎯 Mục tiêu phiên làm việc:
- Sửa lỗi game Snake không chạy được.
- Đổi màu các thẻ kỹ năng (tag) sang màu Vàng Kim.
- Tạo file `CHANGELOG.md` và cài đặt tự động hóa Release trên GitHub.

### 🛠️ Các thay đổi đã thực hiện:
1.  **Game Snake (`games/snake/index.html`):**
    -   *Vấn đề:* File code cũ bị cắt ngang, thiếu toàn bộ JavaScript nên không thể khởi chạy.
    -   *Giải pháp:* Viết lại toàn bộ file từ đầu (tất cả trong 1 file HTML).
    -   *Nâng cấp thêm:* Thêm hiệu ứng lưới nền, quả mồi phát sáng nhấp nháy, rắn bo góc, thân rắn mờ dần về đuôi, và mắt rắn xoay theo hướng đi. Đã dùng `requestAnimationFrame` và `Canvas`.

2.  **Giao diện (`assets/css/styles.css`):**
    -   *Vấn đề:* Các thẻ `.skill-chip` và `.tag-list li` đang có màu xanh lá.
    -   *Giải pháp:* Thay đổi mã màu thành `#D4AF37` (Vàng kim) và thêm viền (`border: 1px solid`) để nổi bật trên nền trắng.

3.  **Cấu hình Git & GitHub:**
    -   Đã tạo file `CHANGELOG.md` chuẩn theo định dạng *Keep a Changelog*.
    -   Đã thiết lập file `.github/workflows/release.yml` để tự động tạo Release mỗi khi push tag (ví dụ: `git tag v1.1.0`).
    -   Đã tạo file `AI_LOG.md` (file này).

### ⚠️ Lưu ý / Cảnh báo cho lần sau (Context):
-   Game Snake hiện tại **chưa có tính năng tăng tốc (Boost)** và **chưa có chế độ mobile (vuốt)**. Nếu làm tiếp, cần thêm sự kiện `touchstart` và `touchend`.
-   Các file nhãn kỹ năng (`.skill-chip`) đã được đổi màu bằng `!important` để ghi đè, nên cẩn thận khi thêm CSS mới.

### ⏭️ Các bước tiếp theo (Dự kiến):
-   Viết code cho game Chess (Cờ vua) và O Ăn Quan.
-   Thêm hiệu ứng chuyển động (Animation) khi cuộn trang ở phần Portfolio.

---

## 📅 Ngày: 30/10/2026 - Khởi tạo dự án
### 🎯 Mục tiêu phiên làm việc:
-   Xây dựng trang Portfolio cá nhân cơ bản (HTML/CSS).
-   Tạo cấu trúc thư mục chuẩn.

### 🛠️ Các thay đổi đã thực hiện:
-   Tạo file `index.html` với các section: Header, Hero, Skills, Projects, Contact.
-   Tạo file `assets/css/styles.css` sử dụng Flexbox và Grid để responsive.
-   Chèn ảnh placeholder `avt.png`, `snake.png`, `Qchess.png`, v.v.

### ⚠️ Lưu ý / Cảnh báo cho lần sau (Context):
-   Đường dẫn ảnh cần kiểm tra kỹ, đảm bảo đặt đúng trong thư mục `assets/img/`.