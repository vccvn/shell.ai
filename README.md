# Shell.AI

Shell.AI là một AI agent chuyên phát triển hệ thống, tự động hóa việc tạo và thực thi script dựa trên yêu cầu của người dùng.

<div align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="version">
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

## Cài đặt

### Yêu cầu hệ thống

#### API Server
- Node.js >= 14.x
- npm >= 6.x

#### Shell Client
- bash
- curl
- jq (sẽ được tự động cài đặt nếu chưa có)

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

3. Các lệnh PM2 khác:

```bash
# Kiểm tra trạng thái ứng dụng
npm run pm2:status

# Xem log ứng dụng
npm run pm2:logs

# Khởi động lại ứng dụng
npm run pm2:restart

# Dừng ứng dụng
npm run pm2:stop
```

4. Cấu hình tự động khởi động khi hệ thống khởi động:

```bash
pm2 startup
# Thực hiện theo hướng dẫn hiển thị

# Lưu cấu hình hiện tại
pm2 save
```

### Cài đặt Shell Client

1. Tải file shellai.sh:

```bash
wget https://raw.githubusercontent.com/username/shell.ai/main/shellai.sh
chmod +x shellai.sh
```

2. Cấu hình Shell Client:

```bash
sudo ./shellai.sh config
```

Nhập URL của API server và thư mục để lưu trữ shell scripts.

## Sử dụng

### Cú pháp cơ bản

```bash
# Cấu trúc chung
sudo ./shellai.sh [lệnh] [tham số...] [-m "nội dung yêu cầu"] [--no-cleanup]

# Sử dụng trực tiếp với yêu cầu
sudo ./shellai.sh -m "yêu cầu của bạn"
```

### Các lệnh hỗ trợ

```bash
# Cài đặt các công cụ
sudo ./shellai.sh install nginx php mysql

# Cài đặt với yêu cầu cụ thể
sudo ./shellai.sh install -m "Cài đặt LAMP stack với PHP 8.1"

# Thiết lập và cấu hình dịch vụ
sudo ./shellai.sh setup wordpress

# Sửa lỗi dịch vụ
sudo ./shellai.sh fix mysql -m "MySQL không kết nối được"

# Yêu cầu tùy chỉnh
sudo ./shellai.sh -m "Tạo và cấu hình virtual host cho domain example.com"

# Không xóa file sau khi thực thi
sudo ./shellai.sh fix nginx --no-cleanup

# Cấu hình Shell.AI
sudo ./shellai.sh config

# Hiển thị trợ giúp
./shellai.sh help
```

### Các tùy chọn

| Tùy chọn | Mô tả |
|----------|-------|
| `-m`, `--message`, `-c`, `--comment` | Chỉ định nội dung yêu cầu cụ thể |
| `--no-cleanup` | Không xóa file sau khi hoàn thành tác vụ |
| `--cleanup` | Xóa file sau khi hoàn thành tác vụ (mặc định) |
| `-h`, `--help` | Hiển thị trợ giúp |

## Cách hoạt động

1. Người dùng gửi yêu cầu thông qua lệnh shell
2. Shell.AI client gửi yêu cầu đến server API (có thể là từ xa)
3. Server API gửi prompt đến ChatGPT để tạo script
4. ChatGPT trả về thông tin về các file cần tạo
5. Server API phân tích phản hồi và trả về thông tin về các file
6. Shell.AI client tạo các file script cục bộ từ thông tin nhận được
7. Shell.AI client thực thi các file theo thứ tự
8. Nếu gặp lỗi, Shell.AI sẽ hỏi người dùng có muốn sửa lỗi không
9. Nếu đồng ý, Shell.AI sẽ gửi yêu cầu sửa lỗi đến server API
10. Quá trình lặp lại cho đến khi vấn đề được giải quyết
11. Sau khi hoàn thành, file sẽ tự động được dọn dẹp (trừ khi sử dụng `--no-cleanup`)

## Cấu hình Shell.AI Client

Shell.AI client lưu trữ cấu hình tại `$HOME/.shellai_config`. Bạn có thể chỉnh sửa file này trực tiếp hoặc sử dụng lệnh `sudo ./shellai.sh config` để cấu hình.

Các thông số cấu hình:
- `API_URL`: URL của API server (mặc định: http://localhost:3000/api/agent)
- `SHELL_DIR`: Thư mục lưu trữ các script (mặc định: $HOME/.shellai)
- `CLEANUP`: Tự động xóa file sau khi hoàn thành (mặc định: true)

## Triển khai lên môi trường sản xuất

### Triển khai API Server

1. Chuẩn bị server:
   - Cài đặt Node.js, npm và PM2
   - Cài đặt Nginx (hoặc Apache) để làm reverse proxy

2. Cấu hình Nginx làm reverse proxy cho API server:

```nginx
server {
    listen 80;
    server_name api.shellai.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Cấu hình SSL với Let's Encrypt:

```bash
sudo certbot --nginx -d api.shellai.yourdomain.com
```

4. Khởi động API server với PM2:

```bash
npm run pm2:start:prod
pm2 startup
pm2 save
```

### Triển khai Shell Client

Chỉ cần cấu hình Shell Client để trỏ đến API server đã triển khai:

```bash
sudo ./shellai.sh config
# Nhập URL: https://api.shellai.yourdomain.com/api/agent
```

## Ví dụ thực tế

### 1. Cài đặt LAMP stack

```bash
sudo ./shellai.sh -m "Cài đặt LAMP stack (Linux, Apache, MySQL, PHP) với PHP phiên bản mới nhất, cấu hình cơ bản cho bảo mật và hiệu suất"
```

### 2. Sửa lỗi MySQL

```bash
sudo ./shellai.sh fix mysql -m "MySQL không khởi động được, báo lỗi 'Can't connect to local MySQL server through socket'"
```

### 3. Tạo virtual host cho Nginx

```bash
sudo ./shellai.sh -m "Tạo virtual host cho domain example.com, webroot /var/www/example.com, với HTTPS và auto-redirect từ HTTP"
```

### 4. Cấu hình tường lửa

```bash
sudo ./shellai.sh -m "Cấu hình tường lửa UFW để mở cổng 80, 443, 22 và đóng tất cả các cổng còn lại"
```

## Cấu trúc thư mục

### API Server
```
shell.ai/
├── src/
│   ├── config/       # Cấu hình ứng dụng
│   ├── controllers/  # Xử lý logic nghiệp vụ
│   ├── routes/       # Định nghĩa API endpoints
│   ├── services/     # Các dịch vụ (OpenAI, file, ...)
│   ├── shell/        # Thư mục chứa các script được tạo (khi chạy cùng với server)
│   └── server.js     # Điểm vào của ứng dụng
├── ecosystem.config.js # Cấu hình PM2
├── .env              # Biến môi trường
├── package.json      # Quản lý phụ thuộc
├── shellai.sh        # Script chính để người dùng tương tác
└── README.md         # Tài liệu hướng dẫn
```

### Shell Client
```
$HOME/
├── .shellai/         # Thư mục chứa các script được tạo (mặc định)
└── .shellai_config   # File cấu hình
```

## Vấn đề thường gặp

### 1. Không thể kết nối đến API server

Đảm bảo API server đang chạy và URL đã cấu hình đúng trong `$HOME/.shellai_config`.

```bash
sudo ./shellai.sh config
```

### 2. Lỗi quyền truy cập

Shell.AI cần quyền sudo để thực thi nhiều loại tác vụ hệ thống. Đảm bảo chạy với sudo.

### 3. Tùy chỉnh prompt

Nếu bạn muốn tùy chỉnh cách AI tạo script, bạn có thể chỉnh sửa file `src/controllers/agent.controller.js` và thay đổi prompt trong hàm `processIssue`.

### 4. PM2 không giữ ứng dụng chạy sau khi khởi động lại server

Đảm bảo bạn đã chạy các lệnh:

```bash
pm2 startup
pm2 save
```

## Đóng góp

Mọi đóng góp đều được hoan nghênh! Vui lòng mở issue hoặc pull request để đóng góp cho dự án.

1. Fork dự án
2. Tạo nhánh tính năng (`git checkout -b feature/amazing-feature`)
3. Commit thay đổi (`git commit -m 'Add amazing feature'`)
4. Push nhánh (`git push origin feature/amazing-feature`)
5. Mở Pull Request

## Giấy phép

ISC

## Tác giả

Dự án được phát triển bởi [Your Name](https://github.com/username)

---

<div align="center">
  <sub>Made with ❤️ by AI and humans working together</sub>
</div> 