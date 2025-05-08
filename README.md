# Shell.AI

Shell.AI là một AI agent chuyên phát triển hệ thống, tự động hóa việc tạo và thực thi script dựa trên yêu cầu của người dùng.

<div align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue.svg" alt="version">
  <img src="https://img.shields.io/badge/license-ISC-green.svg" alt="license">
</div>

## Tính năng

- 🤖 Tự động tạo script dựa trên yêu cầu của người dùng
- 🚀 Tự động thực thi script và hiển thị kết quả
- 🔧 Tự động phát hiện lỗi và đề xuất sửa lỗi
- 📄 Hỗ trợ nhiều loại script (bash, JavaScript, Python, ...)
- 🌐 Hỗ trợ tách biệt Shell client và API server
- 🧹 Tự động dọn dẹp file sau khi hoàn thành
- 📝 Giao diện dòng lệnh đơn giản, dễ sử dụng
- 🔄 Hỗ trợ nhiều cú pháp đơn giản và linh hoạt
- 💬 Chế độ dev với lưu trữ lịch sử trò chuyện
- 🔌 Kiểm tra và cài đặt thư viện tự động

## Cài đặt

### Yêu cầu hệ thống

#### API Server
- Node.js >= 14.x
- npm >= 6.x

#### Shell Client
- Node.js >= 14.x
- npm >= 6.x

### Cài đặt API Server

1. Clone repository:

```bash
git clone https://github.com/username/shell.ai.git
cd shell.ai
```

2. Cài đặt các phụ thuộc:

```bash
npm install
```

3. Tạo file .env và cập nhật thông tin:

```bash
echo 'PORT=3000' > .env
echo 'OPENAI_API_KEY=your_openai_api_key_here' >> .env
echo 'MODEL=gpt-4' >> .env
echo 'SHELL_DIR=./src/shell' >> .env
```

4. Khởi động server:

```bash
# Sử dụng Node.js
npm start

# Hoặc sử dụng nodemon cho phát triển
npm run dev
```

### Chạy với PM2 (Đề xuất cho môi trường sản xuất)

PM2 là một process manager cho ứng dụng Node.js, giúp đảm bảo ứng dụng luôn hoạt động, tự động khởi động lại khi gặp lỗi, và nhiều tính năng hữu ích khác.

1. Cài đặt PM2 (đã được bao gồm trong `devDependencies`):

```bash
# Cài đặt toàn cục nếu cần
npm install -g pm2
```

2. Khởi động ứng dụng với PM2:

```bash
# Khởi động trong môi trường phát triển
npm run pm2:start

# Khởi động trong môi trường sản xuất
npm run pm2:start:prod
```

### Cài đặt Shell Client (JavaScript)

1. Cài đặt Node.js và npm nếu chưa có:

```bash
# Trên Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# Trên macOS với Homebrew
brew install node
```

2. Sử dụng một trong hai cách sau để chạy Shell.AI:

#### Cách 1: Sử dụng shellai.sh (Khuyến nghị cho Linux/macOS)

```bash
chmod +x shellai.sh
./shellai.sh config
```

#### Cách 2: Sử dụng Node.js trực tiếp

```bash
node shellai.js config
```

3. Tạo lệnh ngắn gọn (tùy chọn):

```bash
# Nếu sử dụng shellai.sh
ln -sf shellai.sh ai
chmod +x ai

# Nếu sử dụng Node.js trực tiếp
echo '#!/bin/bash\nnode "$(dirname "$0")/shellai.js" "$@"' > ai
chmod +x ai
```

## Sử dụng

### Cú pháp cơ bản

```bash
# Sử dụng shellai.sh
./shellai.sh [lệnh] [tham số...] [-m "nội dung yêu cầu"] [--debug]

# Hoặc sử dụng Node.js trực tiếp
node shellai.js [lệnh] [tham số...] [-m "nội dung yêu cầu"] [--debug]

# Hoặc sử dụng lệnh ngắn gọn
./ai [lệnh] [tham số...] [-m "nội dung yêu cầu"] [--debug]
```

### Các lệnh hỗ trợ

```bash
# Cài đặt các công cụ
./shellai.sh install nginx php mysql
# hoặc
node shellai.js install nginx php mysql

# Cài đặt với yêu cầu cụ thể
./shellai.sh install -m "Cài đặt LAMP stack với PHP 8.1"

# Kiểm tra dịch vụ
./shellai.sh check mysql -m "Kiểm tra trạng thái MySQL"

# Tạo file mới
./shellai.sh create file index.html -m "Tạo trang web đơn giản"

# Chế độ chat
./shellai.sh chat
# hoặc
node shellai.js chat

# Chế độ phát triển (dev)
./shellai.sh dev
# hoặc
node shellai.js dev

# Cấu hình Shell.AI
./shellai.sh config
# hoặc
node shellai.js config

# Hiển thị trợ giúp
./shellai.sh help
```

### Các tùy chọn

| Tùy chọn | Mô tả |
|----------|-------|
| `-m`, `--message` | Chỉ định nội dung yêu cầu cụ thể |
| `--debug` | Hiển thị thông tin debug |
| `-h`, `--help` | Hiển thị trợ giúp |

## Chế độ phát triển (Dev Mode)

Chế độ phát triển là một tính năng mới trong phiên bản JavaScript của Shell.AI. Chế độ này cho phép:

- Chat với AI và lưu trữ lịch sử trò chuyện
- Thực thi script khi cần thiết
- Tạo file mới dựa trên yêu cầu
- Kiểm tra và cài đặt thư viện tự động nếu cần

Để sử dụng chế độ phát triển:

```bash
./shellai.sh dev
# hoặc
node shellai.js dev
```

Trong chế độ dev, bạn có thể:
- Nhập "help" để xem hướng dẫn sử dụng
- Nhập "exit" để thoát chế độ dev

## Cấu hình Shell.AI Client

Shell.AI client lưu trữ cấu hình tại `$HOME/.shellai_config.json`. Bạn có thể chỉnh sửa file này trực tiếp hoặc sử dụng lệnh cấu hình để thiết lập:

```bash
./shellai.sh config
# hoặc
node shellai.js config
```

## Định dạng phản hồi JSON mới

Phiên bản JavaScript của Shell.AI sử dụng định dạng phản hồi JSON mới với cấu trúc:

```json
{
  "action": "run|create|show",
  "message": "Thông điệp từ AI",
  "script": {
    "filename": "tên_file.js",
    "content": "nội dung script",
    "type": "js|sh|py|php",
    "description": "mô tả script",
    "prepare": "lệnh cài đặt thư viện nếu cần"
  }
}
```

## Cách hoạt động

1. Người dùng gửi yêu cầu thông qua lệnh shell (shellai.js hoặc ai)
2. Shell.AI client gửi yêu cầu đến server API
3. Server API gửi prompt đến ChatGPT để tạo script
4. ChatGPT trả về thông tin về các file cần tạo
5. Server API phân tích phản hồi và trả về thông tin về các file
6. Shell.AI client tạo các file script cục bộ từ thông tin nhận được
7. Shell.AI client thực thi các file theo thứ tự
8. Nếu gặp lỗi, Shell.AI sẽ hỏi người dùng có muốn sửa lỗi không
9. Nếu đồng ý, Shell.AI sẽ gửi yêu cầu sửa lỗi đến server API
10. Quá trình lặp lại cho đến khi vấn đề được giải quyết
11. Sau khi hoàn thành, file sẽ tự động được dọn dẹp

## Cấu trúc dự án

```
shell.ai/
├── src/
│   ├── config/         # Cấu hình ứng dụng
│   ├── controllers/    # Xử lý logic nghiệp vụ
│   ├── models/         # Mô hình dữ liệu
│   ├── routes/         # Định nghĩa các route API
│   ├── services/       # Các dịch vụ
│   ├── shell/          # Thư mục chứa các script được tạo
│   └── utils/          # Tiện ích
│       ├── shellai_functions.js  # Các hàm tiện ích cho JavaScript
│       └── chatHistory.js        # Quản lý lịch sử trò chuyện
├── shellai.js          # Script JavaScript chính
├── ai                  # Symlink ngắn gọn đến shellai.js
├── .env                # Biến môi trường
└── package.json        # Cấu hình npm
```

## Giấy phép

ISC

## Tác giả

Dự án được phát triển bởi [Doanln](https://github.com/vccvn)

---

<div align="center">
  <sub>Made with ❤️ by AI and humans working together</sub>
</div> 