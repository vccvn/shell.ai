# Shell.AI - Hệ thống AI Agent hỗ trợ phát triển và sửa chữa hệ thống

Shell.AI là công cụ hỗ trợ người dùng với các tác vụ liên quan đến kiểm tra hệ thống, cài đặt phần mềm, sửa lỗi, tạo file và hiển thị thông tin theo yêu cầu.

## Cài đặt

### Yêu cầu

- Node.js (>= 14.x)
- npm hoặc yarn
- curl

### Các bước cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd shell.ai
```

2. Cài đặt các phụ thuộc:
```bash
npm install
```

3. Tạo file `.env` từ file mẫu:
```bash
cp .env.example .env
```

4. Chỉnh sửa file `.env` và thêm API key của OpenAI:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

5. Cấp quyền thực thi cho các file bash:
```bash
chmod +x shellai.sh shellai_functions.sh
```

6. Tạo symlink ngắn gọn (tùy chọn):
```bash
ln -sf shellai.sh ai
chmod +x ai
```

## Khởi động API Server

### Chế độ phát triển
```bash
npm run dev
```

### Chế độ sản xuất
```bash
npm run pm2:start:prod
```

## Sử dụng Shell.AI

### Cú pháp cơ bản
```bash
./shellai.sh [lệnh] [tham số] [-m "mô tả"] [--debug]
```

Hoặc sử dụng tên lệnh ngắn gọn:
```bash
./ai [lệnh] [tham số] [-m "mô tả"] [--debug]
```

### Các lệnh có sẵn

1. **Cài đặt phần mềm**:
```bash
./ai install apache2 nginx -m "Cài đặt web server"
```

2. **Kiểm tra trạng thái dịch vụ**:
```bash
./ai check mysql
```

3. **Tạo file mới**:
```bash
./ai create file index.html -m "Tạo trang web đơn giản"
```

4. **Chế độ chat**:
```bash
./ai chat
```

5. **Yêu cầu tùy chỉnh**:
```bash
./ai -m "Kiểm tra và hiển thị thông tin hệ thống"
```

### Các tùy chọn

- `-m, --message "nội dung"`: Mô tả chi tiết yêu cầu
- `--debug`: Hiển thị thông tin debug
- `-h, --help`: Hiển thị hướng dẫn sử dụng

## Sử dụng từ bất kỳ đâu trong hệ thống

Để có thể sử dụng lệnh `ai` từ bất kỳ thư mục nào trong hệ thống, bạn có thể di chuyển symlink vào thư mục nằm trong PATH:

```bash
sudo cp ai /usr/local/bin/
```

Sau đó, bạn có thể gọi lệnh từ bất kỳ đâu:

```bash
ai chat
ai create file test.txt -m "Tạo file test"
```

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
├── shellai.sh          # Script chính để tương tác với hệ thống
├── shellai_functions.sh # Các hàm tiện ích cho script chính
├── ai                  # Symlink ngắn gọn đến shellai.sh
├── .env                # Biến môi trường
└── package.json        # Cấu hình npm
```

## Cách hoạt động

1. Người dùng gửi yêu cầu thông qua script `shellai.sh` hoặc `ai`
2. Script gửi yêu cầu đến API server
3. API server gửi yêu cầu đến OpenAI để tạo script hoặc thông tin phản hồi
4. API server trả về kết quả cho script
5. Script xử lý kết quả (tạo file, thực thi, hiển thị thông tin, v.v.)

## Các hành động (Actions)

- **show**: Hiển thị thông tin
- **run**: Tạo và thực thi script
- **create**: Tạo file mới
- **input**: Yêu cầu thêm thông tin từ người dùng
- **chat**: Chế độ chat với AI

## Xử lý lỗi

Khi script gặp lỗi, bạn có thể sử dụng tùy chọn `--debug` để xem thông tin chi tiết:

```bash
./ai install nginx --debug
```

## Đóng góp

Vui lòng tạo issue hoặc pull request để đóng góp vào dự án.

## Giấy phép

ISC 