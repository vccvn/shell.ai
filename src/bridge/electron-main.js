/**
 * Shell.AI Electron App
 * File chính khởi tạo ứng dụng desktop với Electron
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { executeCommand, getSystemInfo, executeScript } = require('./desktop-agent');
const os = require('os');

// Kiểm tra xem ứng dụng đã đóng gói hay chưa
const isPackaged = app.isPackaged;
console.log(`Đang chạy ứng dụng ${isPackaged ? 'đã đóng gói' : 'từ mã nguồn'}`);

// Xác định đường dẫn gốc
let appRootPath;
if (isPackaged) {
    // Trong ứng dụng đã đóng gói, đường dẫn gốc là thư mục resource
    appRootPath = path.dirname(app.getAppPath());
    console.log(`Đường dẫn ứng dụng đã đóng gói: ${appRootPath}`);
} else {
    // Trong quá trình phát triển, đường dẫn gốc là thư mục dự án
    appRootPath = path.resolve(__dirname, '../..');
    console.log(`Đường dẫn ứng dụng phát triển: ${appRootPath}`);
}

// Thư mục dữ liệu người dùng
const userDataDir = path.join(os.homedir(), '.shellai');
try {
    fs.ensureDirSync(userDataDir);
    console.log(`Thư mục dữ liệu người dùng: ${userDataDir}`);
} catch (error) {
    console.error(`Không thể tạo thư mục dữ liệu người dùng: ${error.message}`);
}

// Đường dẫn lưu cấu hình
const CONFIG_PATH = path.join(userDataDir, 'config.json');
console.log(`File cấu hình: ${CONFIG_PATH}`);

// Cấu hình thư mục shell mặc định
let defaultShellDir;
if (isPackaged) {
    defaultShellDir = path.join(userDataDir, 'shell');
} else {
    defaultShellDir = path.join(appRootPath, 'src', 'shell');
}

// Cấu hình mặc định
const DEFAULT_CONFIG = {
    API_URL: 'http://localhost:3000/api/agent',
    SHELL_DIR: defaultShellDir,
    DEBUG: false,
    OPENAI_API_KEY: '',
    API_KEY: '',
    MODEL: 'gpt-4'
};

// Hàm đọc cấu hình
async function loadConfig() {
    try {
        // Đầu tiên, thử đọc từ file .env nếu có
        let envConfig = {};
        try {
            const envPath = isPackaged ? 
                path.join(appRootPath, '.env') : 
                path.join(appRootPath, '.env');
                
            if (fs.existsSync(envPath)) {
                const envFile = fs.readFileSync(envPath, 'utf8');
                envFile.split('\n').forEach(line => {
                    // Bỏ qua comment và dòng trống
                    if (line.trim() && !line.startsWith('#')) {
                        const parts = line.split('=');
                        if (parts.length >= 2) {
                            const key = parts[0].trim();
                            const value = parts.slice(1).join('=').trim();
                            const processedValue = value.startsWith('"') && value.endsWith('"')
                                ? value.slice(1, -1)
                                : value;
                            envConfig[key] = processedValue;
                        }
                    }
                });
            }
        } catch (err) {
            console.log('Không tìm thấy file .env, bỏ qua');
        }

        // Sau đó đọc từ file cấu hình người dùng
        let userConfig = {};
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const data = fs.readFileSync(CONFIG_PATH, 'utf8');
                userConfig = JSON.parse(data);
            } else {
                console.log('Không tìm thấy file cấu hình người dùng, sử dụng mặc định');
            }
        } catch (err) {
            console.error('Lỗi khi đọc file cấu hình:', err);
        }

        // Kết hợp các nguồn cấu hình theo thứ tự ưu tiên
        const config = { ...DEFAULT_CONFIG, ...envConfig, ...userConfig };
        
        // Đảm bảo thư mục shell tồn tại
        try {
            fs.ensureDirSync(config.SHELL_DIR);
            console.log(`Đã tạo/kiểm tra thư mục shell tại: ${config.SHELL_DIR}`);
        } catch (error) {
            console.error(`Không thể tạo thư mục shell tại ${config.SHELL_DIR}, thử dùng thư mục tạm`);
            // Thử dùng thư mục tạm
            config.SHELL_DIR = path.join(os.tmpdir(), 'shellai', 'shell');
            try {
                fs.ensureDirSync(config.SHELL_DIR);
                console.log(`Đã tạo thư mục shell thay thế tại: ${config.SHELL_DIR}`);
            } catch (tempError) {
                console.error(`Không thể tạo thư mục shell thay thế: ${tempError.message}`);
            }
        }

        return config;
    } catch (error) {
        console.error('Lỗi khi tải cấu hình:', error);
        return DEFAULT_CONFIG;
    }
}

// Hàm lưu cấu hình
async function saveConfig(config) {
    try {
        // Đảm bảo thư mục tồn tại
        fs.ensureDirSync(path.dirname(CONFIG_PATH));
        
        const configData = JSON.stringify(config, null, 2);
        fs.writeFileSync(CONFIG_PATH, configData, 'utf8');
        console.log('Đã lưu cấu hình thành công');
        return true;
    } catch (error) {
        console.error('Lỗi khi lưu cấu hình:', error);
        return false;
    }
}

// Biến lưu cửa sổ chính
let mainWindow;

// Hàm tạo cửa sổ chính
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, '../public/icons/icon.svg')
    });

    // Tải file HTML
    const indexPath = path.join(__dirname, '../public/index.html');
    console.log(`Tải file HTML từ: ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
    } else {
        console.error(`Không tìm thấy file index.html tại: ${indexPath}`);
        mainWindow.loadURL('about:blank');
        mainWindow.webContents.executeJavaScript(`
            document.body.innerHTML = '<h1>Lỗi khi tải ứng dụng</h1><p>Không tìm thấy file giao diện người dùng.</p>';
        `);
    }

    // Mở DevTools trong môi trường development
    if (!isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    // Xử lý sự kiện đóng cửa sổ
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Khởi tạo ứng dụng khi Electron sẵn sàng
app.whenReady().then(async () => {
    // Tải cấu hình trước khi tạo cửa sổ
    const config = await loadConfig();
    console.log('Đã tải cấu hình:', config);
    
    createWindow();

    app.on('activate', () => {
        // Tạo lại cửa sổ trên macOS khi click vào biểu tượng dock
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Đóng ứng dụng khi tất cả cửa sổ đã đóng (trừ macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Thiết lập các kênh giao tiếp IPC

// Gửi yêu cầu đến Shell.AI
ipcMain.handle('sendRequest', async (event, request) => {
    try {
        const systemInfo = getSystemInfo();
        
        // Gửi yêu cầu đến API server (sử dụng node-fetch hoặc axios)
        const fetch = require('node-fetch');
        const API_URL = process.env.API_URL || 'http://localhost:3000/api/agent';
        
        const response = await fetch(`${API_URL}/${request.action || 'dev'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: request.message,
                system_info: systemInfo
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error sending request:', error);
        return {
            action: 'error',
            message: `Lỗi: ${error.message}`
        };
    }
});

// Thực thi script
ipcMain.handle('executeScript', async (event, script) => {
    try {
        return executeScript(script);
    } catch (error) {
        console.error('Error executing script:', error);
        return {
            output: '',
            error: error.message,
            code: 1
        };
    }
});

// Lưu script
ipcMain.handle('saveScript', async (event, script) => {
    try {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Lưu Script',
            defaultPath: script.filename || 'shellai-script.sh',
            filters: [
                { name: 'Shell Script', extensions: ['sh'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (filePath) {
            fs.writeFileSync(filePath, script.content, { mode: 0o755 });
            return { success: true, path: filePath };
        } else {
            return { success: false, error: 'Hủy lưu file' };
        }
    } catch (error) {
        console.error('Error saving script:', error);
        return { success: false, error: error.message };
    }
});

// Lấy thông tin hệ thống
ipcMain.handle('getSystemInfo', async () => {
    return getSystemInfo();
});

// Thực thi lệnh
ipcMain.handle('executeCommand', async (event, command) => {
    return executeCommand(command);
});

// Cấu hình
ipcMain.handle('getConfig', async () => {
    return await loadConfig();
});

ipcMain.handle('saveConfig', async (event, config) => {
    return await saveConfig(config);
});

// Đọc file .env
ipcMain.handle('loadEnvFile', async () => {
    try {
        const envPath = path.join(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            return { success: true, content };
        } else {
            return { success: false, error: 'File .env không tồn tại' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Lưu file .env
ipcMain.handle('saveEnvFile', async (event, content) => {
    try {
        const envPath = path.join(__dirname, '../../.env');
        fs.writeFileSync(envPath, content, 'utf8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Xử lý chạy lệnh shellai.sh hoặc shellai.js
ipcMain.handle('runShellAI', async (event, command, params = []) => {
    try {
        const isWindows = process.platform === 'win32';
        let shellaiPath;
        
        if (isWindows) {
            // Trên Windows sử dụng node shellai.js
            shellaiPath = 'node';
            params.unshift(path.join(__dirname, '../../shellai.js'));
        } else {
            // Trên macOS/Linux sử dụng shellai.sh
            shellaiPath = path.join(__dirname, '../../shellai.sh');
        }
        
        // Thêm lệnh nếu có
        if (command && command !== '') {
            params.unshift(command);
        }
        
        // Tạo lệnh
        const cmdResult = isWindows ? 
            executeCommand(`${shellaiPath} ${params.join(' ')}`) :
            executeCommand(`${shellaiPath} ${params.join(' ')}`);
            
        return {
            success: cmdResult.code === 0,
            output: cmdResult.output,
            error: cmdResult.error,
            code: cmdResult.code
        };
    } catch (error) {
        return {
            success: false,
            output: '',
            error: error.message,
            code: 1
        };
    }
}); 