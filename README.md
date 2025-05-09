# Shell.AI

Shell.AI là trợ lý AI tự động hóa việc tạo và thực thi script. Ứng dụng cho phép tương tác bằng ngôn ngữ tự nhiên để tạo, chỉnh sửa và thực thi các script shell, giúp đơn giản hóa các tác vụ phức tạp trên hệ thống.

<div align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue.svg" alt="version">
  <img src="https://img.shields.io/badge/license-ISC-green.svg" alt="license">
</div>

## Tính năng chính

- Tự động tạo và thực thi script shell từ mô tả bằng ngôn ngữ tự nhiên
- Hỗ trợ đa nền tảng: Windows, macOS, Linux
- Chế độ Dev, Chat và Script
- Tự động nhận diện thông tin hệ thống để tạo script phù hợp
- Giao diện web và CLI
- Khả năng chạy offline với API key
- Lưu trữ và quản lý các script đã tạo

## Cài đặt và chạy

### Phương pháp 1: Sử dụng mã nguồn (yêu cầu Node.js)

#### Yêu cầu
- Node.js (v14 trở lên)
- npm hoặc yarn

#### Các bước cài đặt
1. Clone repository
   ```bash
   git clone https://github.com/username/shell.ai.git
   cd shell.ai
   ```

2. Cài đặt dependencies
   ```bash
   npm install
   ```

3. Cấu hình .env (tùy chọn)
   ```bash
   cp .env.example .env
   # Chỉnh sửa file .env thêm API keys của bạn
   ```

4. Chạy server API
   ```bash
   npm run start
   ```

5. Chạy Shell.AI CLI
   - Trên macOS/Linux:
     ```bash
     ./shellai.sh
     ```
   - Trên Windows:
     ```bash
     node shellai.js
     ```

### Phương pháp 2: Sử dụng ứng dụng desktop đã đóng gói (không yêu cầu Node.js)

1. Tải file cài đặt từ trang [Releases](https://github.com/username/shell.ai/releases)
2. Cài đặt ứng dụng:
   - Windows: Chạy file .exe hoặc .msi
   - macOS: Mở file .dmg và kéo ứng dụng vào thư mục Applications
   - Linux: Cài đặt file .deb, .rpm hoặc chạy file AppImage

3. Mở ứng dụng Shell.AI từ menu Start hoặc Applications

### Phương pháp 3: Chạy giao diện web

1. Chạy server API
   ```bash
   npm run start
   ```

2. Truy cập giao diện web tại địa chỉ: http://localhost:3000

### Phương pháp 4: Chạy desktop agent và kết nối với giao diện web

1. Chạy desktop agent
   ```bash
   npm run dev-agent
   ```

2. Mở trình duyệt và truy cập http://localhost:3000

## Sử dụng

### Chế độ CLI

- **Chế độ script**: Tạo script từ mô tả
  ```bash
  ./shellai.sh "Tạo script kiểm tra dung lượng ổ đĩa"
  ```

- **Chế độ dev**: Đối thoại tương tác để giải quyết vấn đề
  ```bash
  ./shellai.sh dev
  ```

- **Chế độ chat**: Trò chuyện với Shell.AI
  ```bash
  ./shellai.sh chat
  ```

- **Chế độ cấu hình**: Cấu hình Shell.AI
  ```bash
  ./shellai.sh config
  ```

### Chế độ Web/Desktop

1. Mở giao diện web hoặc ứng dụng desktop
2. Nhập yêu cầu vào ô nhập liệu
3. Nhấn "Gửi" hoặc Enter để gửi yêu cầu
4. Xem kết quả và thực thi script nếu cần

## Cách hoạt động giữa Web và Hệ thống

Shell.AI có nhiều phương pháp để can thiệp vào hệ thống từ giao diện web:

1. **Desktop Agent**: Một ứng dụng Node.js chạy cục bộ và kết nối với giao diện web qua WebSocket. Agent này có quyền thực thi lệnh hệ thống.

2. **Electron App**: Đóng gói giao diện web và desktop agent thành một ứng dụng desktop đầy đủ quyền.

3. **Browser Download**: Trong trường hợp không có desktop agent, giao diện web tạo script và hướng dẫn người dùng tải về để thực thi thủ công.

## Đóng gói ứng dụng desktop

Để đóng gói ứng dụng desktop cho các nền tảng khác nhau:

```bash
# Đóng gói cho tất cả nền tảng
npm run build

# Đóng gói cho Windows
npm run build-win

# Đóng gói cho macOS
npm run build-mac

# Đóng gói cho Linux
npm run build-linux
```

## Cấu hình

Bạn có thể cấu hình Shell.AI qua file .env hoặc chế độ cấu hình:

```bash
./shellai.sh config
```

Các tham số cấu hình:
- `API_URL`: URL của API server
- `SHELL_DIR`: Thư mục lưu trữ các script
- `DEBUG`: Chế độ debug (true/false)
- `OPENAI_API_KEY`: OpenAI API Key
- `API_KEY`: API Key để xác thực với API server
- `MODEL`: Model AI sử dụng (gpt-4, gpt-3.5-turbo, etc.)

## Đóng góp

Đóng góp và báo lỗi luôn được chào đón! Vui lòng tạo issue hoặc pull request trên GitHub.

## Giấy phép

ISC

## Tác giả

Dự án được phát triển bởi [Doanln](https://github.com/vccvn)

---

<div align="center">
  <sub>Made with ❤️ by AI and humans working together</sub>
</div> 