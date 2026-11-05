# 🎮 Interactive Portfolio & Game Hub

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-181717?style=for-the-badge&logo=github&logoColor=white)

> **Portfolio CV kết hợp Game Hub trực tuyến** - Nơi giới thiệu bản thân và trưng bày các tựa game do chính tác giả phát triển, cho phép người xem trải nghiệm trực tiếp trên trình duyệt.

## 📖 Giới thiệu

Dự án này là một trang web cá nhân (Portfolio) được thiết kế tối giản nhưng đậm tính tương tác. Thay vì chỉ hiển thị một CV tĩnh, trang web được tích hợp thêm một "Cổng Game" (Game Hub). Nhà tuyển dụng hoặc người xem có thể click trực tiếp vào từng thẻ dự án để mở và chơi các tựa game ngay lập tức.

Mục tiêu của dự án:
- Trình diễn kỹ năng Frontend (HTML/CSS/JS) và tư duy tổ chức cấu trúc thư mục.
- Cung cấp trải nghiệm thực tế (Playable Portfolio) thay vì chỉ mô tả bằng lời.
- Tối ưu hóa hiệu năng và khả năng truy cập (Accessibility).

## ✨ Tính năng nổi bật

- **Thiết kế Responsive:** Hiển thị hoàn hảo trên cả thiết bị di động, máy tính bảng và máy tính để bàn.
- **Playable Projects (Dự án có thể chơi):** Mỗi thẻ dự án chứa một liên kết trực tiếp đến game. Click vào ảnh hoặc nút "Chơi ngay" để mở game trong tab mới.
- **Tối ưu hóa hình ảnh:** Sử dụng thuộc tính `loading="lazy"` và `decoding="async"` giúp trang tải nhanh hơn.
- **Cấu trúc thư mục khoa học:** Tách biệt rõ ràng giữa tài nguyên dùng chung (`assets`) và từng dự án game độc lập (`games`).
- **Hỗ trợ SEO & Screen Reader:** Sử dụng các thẻ HTML5 ngữ nghĩa (`<header>`, `<main>`, `<section>`, `<article>`) và thuộc tính `alt` cho hình ảnh.

## 🎮 Danh sách Game (Playable)

| Tên Game | Thể loại | Công nghệ / Công cụ |
| :--- | :--- | :--- |
| **Flap Rush** | Arcade / Đi cảnh | HTML5, Canvas, CSS |
| **Snake (Rắn săn mồi)** | Giải đố / Cổ điển | Godot, C++ |
| **Caro Chess** | Trí tuệ / Board Game | JavaScript, CSS Grid |
| **Ô Ăn Quan** | Dân gian Việt Nam | HTML, CSS, JavaScript |

## 🛠️ Công nghệ sử dụng

- **Ngôn ngữ:** HTML5, CSS3, JavaScript (ES6+).
- **Thiết kế UI/UX:** Figma (Wireframe), CSS Flexbox & CSS Grid.
- **Công cụ phát triển:** VSCodium, Git & GitHub.
- **Triển khai (Deployment):** GitHub Pages.

## 📁 Cấu trúc thư mục

Dự án được tổ chức theo mô hình Module, giúp dễ dàng bảo trì và thêm mới game:

```text
├── assets/                 # Tài nguyên dùng chung cho Portfolio
│   ├── css/                # Chứa file styles.css chính
│   ├── fonts/              # Chứa font chữ (Be Vietnam Pro)
│   ├── img/                # Hình ảnh avatar, thumbnail dự án
│   └── js/                 # Mã JavaScript dùng chung (nếu có)
├── games/                  # Thư mục chứa các game độc lập
│   ├── chess/              # Game Caro (index.html, css, js)
│   ├── flap-rush/          # Game Flap Rush
│   ├── o-an-quan/          # Game Ô ăn quan
│   └── snake/              # Game Rắn săn mồi
├── .nojekyll               # File cấu hình bắt buộc cho GitHub Pages
├── index.html              # Trang chủ (Portfolio CV)
└── README.md               # Tài liệu hướng dẫn dự án

🚀 Hướng dẫn chạy dưới máy (Local Setup)

Để chạy dự án này trên máy tính của bạn, hãy làm theo các bước sau:

    Clone repository này về máy:
    bash

    git clone https://github.com/your-username/your-repo-name.git
    Mở thư mục dự án:
    bash

    cd your-repo-name

    Chạy dự án:

        Cách 1: Mở file index.html trực tiếp bằng trình duyệt.

        Cách 2 (Khuyên dùng): Sử dụng extension Live Server trên VSCode/VSCodium. Click chuột phải vào index.html -> chọn Open with Live Server.

🌐 Hướng dẫn Deploy lên GitHub Pages

Dự án đã được cấu hình sẵn sàng để chạy trên GitHub Pages. Thực hiện theo các bước sau:

    Push toàn bộ code lên repository GitHub của bạn.

    Truy cập vào Settings (Cài đặt) của Repository.

    Ở menu bên trái, chọn Pages.

    Trong mục Build and deployment:

        Source: Chọn Deploy from a branch.

        Branch: Chọn nhánh main (hoặc master) và thư mục / (root).

    Nhấn Save và đợi 1-2 phút. GitHub sẽ cấp cho bạn một đường link (dạng https://username.github.io/repo-name/).

    Lưu ý quan trọng: File .nojekyll đã được thêm vào thư mục gốc. File này giúp GitHub Pages bỏ qua quá trình xử lý Jekyll, đảm bảo các thư mục con (như games/) được tải chính xác, tránh lỗi 404.

🤝 Đóng góp (Contributing)

Mọi ý kiến đóng góp, báo lỗi (issues) hoặc yêu cầu thêm tính năng (pull requests) đều được chào đón.
Nếu bạn phát hiện lỗi, vui lòng tạo một Issue mô tả chi tiết lỗi và cách tái hiện.
📄 Giấy phép (License)

Dự án này được phân phối dưới giấy phép MIT License. Xem file LICENSE để biết thêm chi tiết (nếu có).
📫 Liên hệ

    Tác giả: bai tap (Backend Developer & Data Engineer)

    Email: puppy@example.com

    GitHub: @puppy

    LinkedIn: linkedin.com/in/puppy

Được xây dựng với ❤️ và niềm đam mê lập trình.
text


### 💡 Mẹo nhỏ để tối ưu hóa file README:
1. **Badges (Huy hiệu):** Những dòng `![HTML5]...` ở trên cùng sẽ tự động hiển thị thành các huy hiệu màu sắc cực đẹp trên GitHub.
2. Bạn nhớ thay `your-username` và `your-repo-name` trong phần hướng dẫn Clone thành link GitHub thật của bạn nhé.
3. Nếu bạn có ảnh chụp màn hình giao diện trang web, hãy upload ảnh đó vào thư mục `assets/img/` và thêm dòng `![Giao diện Portfolio](./assets/img/screenshot.png)` ngay dưới dòng giới thiệu để file README sinh động hơn.

