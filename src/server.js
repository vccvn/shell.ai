const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const agentRoutes = require('./routes/agent.routes');

// Khởi tạo app Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Đảm bảo thư mục shell tồn tại
fs.ensureDirSync(config.shellDir);

// Routes
app.use('/api/agent', agentRoutes);

// Route mặc định
app.get('/', (req, res) => {
  res.json({
    message: 'Shell.AI API - AI Agent để tự động hóa việc tạo và thực thi script',
    version: '1.0.0'
  });
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
}); 