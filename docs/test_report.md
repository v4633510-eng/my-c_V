# Báo cáo Kiểm thử (Test Report)

**Dự án:** Portfolio Game Developer & Các Game Mini
**Phiên bản kiểm thử:** v1.1.0
**Người thực hiện:** Nguyễn Văn An
**Ngày báo cáo:** 05/11/2026

---

## 1. Tổng quan (Executive Summary)
Báo cáo này ghi lại kết quả kiểm thử cho phiên bản v1.1.0 của dự án. Mục tiêu là đảm bảo giao diện hiển thị tốt trên nhiều thiết bị, các đường link hoạt động chính xác, và các game (đặc biệt là Snake) vận hành trơn tru không có lỗi logic.

**Kết quả tổng quan:** 
- **Đạt (Pass):** 90% (Giao diện, Liên kết, Game Snake hoạt động tốt).
- **Không đạt (Fail):** 10% (Cần bổ sung tính năng cảm ứng cho game Snake trên Mobile).

---

## 2. Môi trường Kiểm thử (Test Environment)
Các nền tảng và trình duyệt đã được sử dụng để kiểm tra:
- **Hệ điều hành:** Windows 11, macOS, iOS, Android.
- **Trình duyệt:** Google Chrome (phiên bản mới nhất), Microsoft Edge, Safari.
- **Thiết bị:** Desktop (1920x1080), Laptop (1366x768), iPad, Điện thoại thông minh (màn hình 375px).

---

## 3. Phạm vi Kiểm thử & Kết quả (Test Scope & Results)

### 3.1. Kiểm thử Giao diện (UI/UX)
| Mã Test | Chức năng | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| UI-01 | Hiển thị thẻ Kỹ năng | Chữ màu vàng kim, viền vàng | Đúng như thiết kế | ✅ Pass |
| UI-02 | Responsive (Mobile) | Các cột xếp chồng lên nhau trên màn hình nhỏ | Hoạt động tốt, không bị tràn viền | ✅ Pass |
| UI-03 | Ảnh đại diện (Avatar) | Tải nhanh, không bị méo | Ảnh sắc nét, load nhanh | ✅ Pass |
| UI-04 | Hiệu ứng Hover | Nút và thẻ đổi màu khi di chuột | Hiệu ứng mượt mà | ✅ Pass |

### 3.2. Kiểm thử Chức năng (Functionality)
| Mã Test | Chức năng | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| FUNC-01 | Điều hướng (Navbar) | Cuộn mượt đến đúng phần (About, Skills...) | Hoạt động chính xác | ✅ Pass |
| FUNC-02 | Link đến Game | Click vào ảnh mở tab mới chứa game | Mở đúng tab, không lỗi 404 | ✅ Pass |
| FUNC-03 | Link Github | Mở đúng profile Github | Đúng đường dẫn | ✅ Pass |
| FUNC-04 | Link Email | Mở ứng dụng email mặc định | Hoạt động tốt | ✅ Pass |

### 3.3. Kiểm thử Game (Snake Game)
| Mã Test | Chức năng | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| GAME-01 | Khởi động game | Bấm "Chơi" thì rắn bắt đầu di chuyển | Hoạt động | ✅ Pass |
| GAME-02 | Điều khiển (PC) | Dùng phím mũi tên để đổi hướng, không quay đầu 180 độ | Hoạt động chính xác | ✅ Pass |
| GAME-03 | Tính điểm | Ăn mồi tăng 10 điểm, rắn dài ra | Điểm cập nhật đúng | ✅ Pass |
| GAME-04 | Va chạm | Đâm vào tường hoặc tự cắn thì hiện màn hình Game Over | Hiện đúng | ✅ Pass |
| GAME-05 | Điều khiển (Mobile)| Vuốt màn hình để điều khiển rắn | Chưa hỗ trợ | ❌ Fail |

---

## 4. Các lỗi phát hiện (Bugs Found)

| STT | Mô tả lỗi | Mức độ nghiêm trọng | Cách khắc phục / Trạng thái |
| :--- | :--- | :--- | :--- |
| 1 | File `index.html` của game Snake bị cắt ngang, không chạy được. | 🔴 Nghiêm trọng (Critical) | **Đã sửa:** Viết lại toàn bộ file, chuyển logic sang Canvas. |
| 2 | Lỗi chính tả tiếng Việt ở phần giới thiệu ("trải nhiệm" thay vì "trải nghiệm"). | 🟡 Trung bình (Minor) | **Đã sửa:** Cập nhật lại text trong HTML. |
| 3 | Game Snake chưa có chức năng điều khiển bằng cảm ứng trên điện thoại. | 🟠 Cao (Major) | **Chưa sửa:** Sẽ bổ sung sự kiện `touchstart`, `touchmove` trong bản cập nhật tới. |

---

## 5. Kết luận & Đề xuất (Conclusion)
- Phiên bản hiện tại đã sẵn sàng để đưa lên GitHub Pages phục vụ cho mục đích giới thiệu cá nhân (Portfolio).
- **Bước tiếp theo:** Cần bổ sung sự kiện vuốt (Swipe) cho game Snake để tối ưu trải nghiệm người dùng trên Mobile. Đồng thời, cần kiểm thử thêm các game Chess và FlapRush.

---
*Báo cáo được tạo tự động và cập nhật thủ công bởi Nguyễn Văn An.*
