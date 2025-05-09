# Cập nhật Shell.AI - Phiên bản 1.1.0

## Tính năng mới

### 1. Cải thiện kiểm tra dịch vụ
- Thêm hàm `check_service` vào shellai_functions.sh để kiểm tra trạng thái các dịch vụ như nginx, apache, v.v.
- Tự động phát hiện lỗi và phân tích lỗi bằng AI
- Hỗ trợ đề xuất cài đặt nếu dịch vụ chưa được cài đặt

### 2. Phân tích file và lỗi nâng cao
- Thêm hàm `analyze_file_or_error` vào shellai_functions.sh để phân tích file hoặc thông báo lỗi
- API endpoint `/analyze` mới để xử lý yêu cầu phân tích
- Controller `analyzeFileOrError` để xử lý logic phân tích

### 3. Thu thập thông tin hệ thống
- Cải thiện hàm `get_system_info` để thu thập thông tin chi tiết hơn về hệ thống
- Thu thập thông tin về package managers, ngôn ngữ lập trình, web servers, databases

### 4. Client Capabilities
- Tạo file `client_capabilities.json` để mô tả các khả năng của client
- Thêm thông tin về client capabilities trong các API requests
- Endpoint `/client-capabilities` để lấy thông tin về client capabilities

## Sửa lỗi
- Sửa lỗi xử lý JSON với ký tự xuống dòng trong shellai.sh
- Sử dụng `jq` thay vì `grep` để kiểm tra JSON hợp lệ
- Cải thiện xử lý ký tự escape trong nội dung script

## Hướng dẫn sử dụng

### Kiểm tra dịch vụ
```bash
./shellai.sh check nginx
./shellai.sh check mysql
./shellai.sh check apache2
```

### Phân tích file hoặc lỗi
Trong chế độ dev, khi phát hiện lỗi, hệ thống sẽ tự động phân tích lỗi và đề xuất giải pháp.

### Đọc file và gửi đến API
```bash
# Trong chế độ dev
dev> Đọc và phân tích file /path/to/file.conf
```

## Cơ chế hoạt động

1. **Client <-> Server**: Giao tiếp hai chiều với thông tin về các khả năng của client
2. **Phát hiện lỗi và phân tích**: Khi gặp lỗi, client gửi thông tin lỗi và thông tin hệ thống đến API
3. **Đề xuất giải pháp**: API phân tích và đề xuất giải pháp, có thể tạo script để sửa lỗi
4. **Thực thi và kiểm tra**: Client thực thi giải pháp và kiểm tra kết quả

## Cấu trúc dự án
```
shellai.sh             # Script chính
shellai_functions.sh   # Các hàm hỗ trợ
src/
  ├── controllers/     # Các controllers xử lý logic
  ├── data/            # Dữ liệu tĩnh
  │   └── client_capabilities.json  # Mô tả khả năng của client
  ├── routes/          # Các routes API
  ├── services/        # Các services
  │   ├── file.service.js    # Xử lý file
  │   └── openai.service.js  # Tương tác với OpenAI
  └── server.js        # Server chính
``` 