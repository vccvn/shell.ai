const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const config = require('./config');
const agentRoutes = require('./routes/agent.routes');

// Khởi tạo app Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ghi log các thông tin quan trọng
console.log('===== SHELL.AI SERVER =====');
console.log(`App root path: ${config.appRootPath}`);
console.log(`Shell directory: ${config.shellDir}`);
console.log(`Is packaged: ${config.isPackaged}`);

// Đảm bảo thư mục shell tồn tại
try {
  // Thử tạo thư mục theo cấu hình
  fs.ensureDirSync(config.shellDir);
  console.log(`Đã tạo/kiểm tra thư mục shell tại: ${config.shellDir}`);
} catch (error) {
  console.error(`Không thể tạo thư mục tại ${config.shellDir}: ${error.message}`);
  
  // Thử tạo thư mục trong thư mục tạm của hệ thống
  const tempShellDir = path.join(os.tmpdir(), 'shellai', 'shell');
  try {
    fs.ensureDirSync(tempShellDir);
    console.log(`Đã tạo thư mục shell thay thế tại: ${tempShellDir}`);
    
    // Cập nhật lại cấu hình
    config.shellDir = tempShellDir;
  } catch (tempError) {
    console.error(`Không thể tạo thư mục thay thế: ${tempError.message}`);
    // Cố gắng tiếp tục mà không cần thư mục shell
  }
}

// Đảm bảo thư mục public tồn tại
const publicDir = path.join(__dirname, 'public');
try {
  fs.ensureDirSync(publicDir);
  console.log(`Đã tạo/kiểm tra thư mục public tại: ${publicDir}`);
} catch (error) {
  console.error(`Không thể tạo thư mục public: ${error.message}`);
  // Tiếp tục mà không cần thư mục public
}

// Phục vụ tệp tĩnh từ thư mục public
app.use(express.static(publicDir));

// Routes
app.use('/api/agent', agentRoutes);

// Route mặc định - phục vụ trang web
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  
  // Kiểm tra xem file index.html có tồn tại không
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      message: 'Shell.AI API - AI Agent để tự động hóa việc tạo và thực thi script',
      version: '1.0.0',
      shellDir: config.shellDir
    });
  }
});

// Xử lý lỗi 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy API endpoint'
  });
});

// Xử lý lỗi chung
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Lỗi máy chủ'
  });
});

// Khởi động server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`Web interface: http://localhost:${PORT}`);
}); 