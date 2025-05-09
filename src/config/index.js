require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Xác định đường dẫn gốc của ứng dụng và đường dẫn thư mục shell
let appRootPath;
let shellDir;

// Kiểm tra xem đang chạy từ ứng dụng Electron đã đóng gói hay không
const isPackaged = process.type === 'browser' && process.resourcesPath && process.resourcesPath.includes('app.asar');

if (isPackaged) {
  // Đang chạy từ ứng dụng đã đóng gói
  console.log('Đang chạy từ ứng dụng đã đóng gói');
  
  // Đường dẫn gốc là thư mục nơi app.asar được giải nén
  appRootPath = path.dirname(process.resourcesPath);
  
  // Tạo thư mục shell trong thư mục dữ liệu ứng dụng của người dùng
  const userDataDir = path.join(os.homedir(), '.shellai');
  shellDir = path.join(userDataDir, 'shell');
  
  // Đảm bảo thư mục tồn tại
  try {
    fs.ensureDirSync(userDataDir);
    fs.ensureDirSync(shellDir);
    console.log(`Đã tạo thư mục shell tại: ${shellDir}`);
  } catch (error) {
    console.error(`Không thể tạo thư mục shell: ${error.message}`);
    // Phương án dự phòng - sử dụng thư mục tạm
    shellDir = path.join(os.tmpdir(), 'shellai', 'shell');
    try {
      fs.ensureDirSync(shellDir);
    } catch (err) {
      console.error(`Không thể tạo thư mục shell dự phòng: ${err.message}`);
    }
  }
} else if (process.type === 'renderer') {
  // Trong renderer process của Electron
  appRootPath = process.cwd();
  shellDir = process.env.SHELL_DIR || path.join(appRootPath, 'src', 'shell');
} else {
  // Đang chạy bình thường từ mã nguồn (phát triển)
  appRootPath = path.resolve(__dirname, '../..');
  shellDir = process.env.SHELL_DIR || path.join(appRootPath, 'src', 'shell');
}

console.log(`App root path: ${appRootPath}`);
console.log(`Shell directory: ${shellDir}`);

module.exports = {
  port: process.env.PORT || 3000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.MODEL || 'gpt-4'
  },
  shellDir: shellDir,
  appRootPath: appRootPath,
  isPackaged: isPackaged
}; 