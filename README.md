# Shell.AI

Shell.AI là một AI agent chuyên phát triển hệ thống, tự động hóa việc tạo và thực thi script dựa trên yêu cầu của người dùng.

## Tính năng

- Tự động tạo script dựa trên yêu cầu của người dùng
- Tự động thực thi script và hiển thị kết quả
- Tự động phát hiện lỗi và đề xuất sửa lỗi
- Hỗ trợ nhiều loại script (bash, JavaScript, Python, ...)
- Giao diện dòng lệnh đơn giản, dễ sử dụng
- **Hỗ trợ tách biệt Shell client và API server**

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
npm start
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

### Sử dụng Shell.AI

```bash
# Cài đặt các công cụ
sudo ./shellai.sh install nginx php mysql

# Thiết lập và cấu hình dịch vụ
sudo ./shellai.sh setup wordpress

# Sửa lỗi
sudo ./shellai.sh fix "Nginx không khởi động"

# Cấu hình Shell.AI
sudo ./shellai.sh config

# Hiển thị trợ giúp
./shellai.sh help
```

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

## Cấu hình Shell.AI Client

Shell.AI client lưu trữ cấu hình tại `$HOME/.shellai_config`. Bạn có thể chỉnh sửa file này trực tiếp hoặc sử dụng lệnh `sudo ./shellai.sh config` để cấu hình.

Các thông số cấu hình:
- `API_URL`: URL của API server (mặc định: http://localhost:3000/api/agent)
- `SHELL_DIR`: Thư mục lưu trữ các script (mặc định: $HOME/.shellai)

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

## Đóng góp

Mọi đóng góp đều được hoan nghênh! Vui lòng mở issue hoặc pull request để đóng góp cho dự án.

## Giấy phép

ISC 