/**
 * Shell.AI Desktop Agent
 * Cầu nối giữa giao diện web và hệ thống
 */

const WebSocket = require('ws');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// Cấu hình
const config = {
    PORT: process.env.AGENT_PORT || 9000,
    SHELL_DIR: process.env.SHELL_DIR || path.join(__dirname, '../../src/shell'),
    API_URL: process.env.API_URL || 'http://localhost:3000/api/agent',
    DEBUG: process.env.DEBUG === 'true'
};

// Thực thi lệnh shell và trả về kết quả
function executeCommand(command) {
    try {
        if (config.DEBUG) {
            console.log(`[DEBUG] Thực thi lệnh: ${command}`);
        }
        
        const result = spawnSync(command, {
            shell: true,
            encoding: 'utf8',
            timeout: 60000 // Timeout 60 giây
        });
        
        return {
            output: result.stdout,
            error: result.stderr,
            code: result.status
        };
    } catch (error) {
        console.error('Lỗi khi thực thi lệnh:', error);
        return {
            output: '',
            error: error.message,
            code: 1
        };
    }
}

// Lấy thông tin hệ thống
function getSystemInfo() {
    const systemInfo = {
        os_type: os.type(),
        os_platform: os.platform(),
        os_release: os.release(),
        os_version: os.version(),
        hostname: os.hostname(),
        username: os.userInfo().username,
        home_dir: os.homedir(),
        arch: os.arch(),
        cpu_cores: os.cpus().length,
        total_memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
        free_memory: Math.round(os.freemem() / (1024 * 1024 * 1024)) + ' GB'
    };
    
    // Thêm thông tin package managers
    const packageManagers = [];
    const checkPackageManager = (cmd, name) => {
        try {
            const result = spawnSync('which', [cmd], { encoding: 'utf8' });
            if (result.status === 0) packageManagers.push(name);
        } catch (error) {
            // Bỏ qua lỗi
        }
    };
    
    // Kiểm tra các package manager phổ biến
    checkPackageManager('npm', 'npm');
    checkPackageManager('yarn', 'yarn');
    checkPackageManager('pip', 'pip');
    checkPackageManager('pip3', 'pip3');
    checkPackageManager('brew', 'homebrew');
    checkPackageManager('apt', 'apt');
    checkPackageManager('yum', 'yum');
    checkPackageManager('dnf', 'dnf');
    checkPackageManager('pacman', 'pacman');
    
    systemInfo.package_managers = packageManagers.join(', ');
    
    return systemInfo;
}

// Thực thi script
function executeScript(script) {
    try {
        // Tạo file tạm thời
        const tempDir = os.tmpdir();
        const scriptPath = path.join(tempDir, `shellai_script_${Date.now()}.sh`);
        
        // Ghi nội dung script
        fs.writeFileSync(scriptPath, script.content, { mode: 0o755 });
        
        // Thực thi script
        const result = executeCommand(scriptPath);
        
        // Xóa file tạm thời nếu không lưu
        if (!script.save) {
            fs.unlinkSync(scriptPath);
        }
        
        return {
            output: result.output,
            error: result.error,
            code: result.code,
            path: script.save ? scriptPath : null
        };
    } catch (error) {
        console.error('Lỗi khi thực thi script:', error);
        return {
            output: '',
            error: error.message,
            code: 1
        };
    }
}

// WebSocket server
const startServer = () => {
    const wss = new WebSocket.Server({ port: config.PORT });
    
    console.log(`Shell.AI Desktop Agent đang chạy trên cổng ${config.PORT}`);
    
    wss.on('connection', (ws) => {
        console.log('Client kết nối mới');
        
        ws.on('message', (message) => {
            try {
                const request = JSON.parse(message);
                
                // Xử lý các loại yêu cầu khác nhau
                switch (request.action) {
                    case 'system-info':
                        const systemInfo = getSystemInfo();
                        ws.send(JSON.stringify({
                            action: 'system-info',
                            data: systemInfo
                        }));
                        break;
                        
                    case 'execute':
                        if (request.command) {
                            const result = executeCommand(request.command);
                            ws.send(JSON.stringify({
                                action: 'execute-result',
                                output: result.output,
                                error: result.error,
                                code: result.code
                            }));
                        } else if (request.script) {
                            const result = executeScript(request.script);
                            ws.send(JSON.stringify({
                                action: 'execute-result',
                                output: result.output,
                                error: result.error,
                                code: result.code,
                                path: result.path
                            }));
                        }
                        break;
                        
                    case 'dev':
                    case 'chat':
                        // Gửi yêu cầu đến API
                        const fetch = require('node-fetch');
                        
                        // Thực hiện yêu cầu bất đồng bộ
                        (async () => {
                            try {
                                // Lấy thông tin hệ thống
                                const systemInfo = getSystemInfo();
                                
                                const response = await fetch(config.API_URL + '/dev', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        message: request.message,
                                        system_info: systemInfo
                                    })
                                });
                                
                                if (response.ok) {
                                    const data = await response.json();
                                    
                                    // Gửi kết quả về client
                                    ws.send(JSON.stringify(data));
                                    
                                    // Nếu có script để thực thi, lưu và thực thi nó
                                    if (data.action === 'run' && data.script && data.script.content) {
                                        const result = executeScript(data.script);
                                        
                                        // Gửi kết quả thực thi về client
                                        ws.send(JSON.stringify({
                                            action: 'execute-result',
                                            output: result.output,
                                            error: result.error,
                                            code: result.code
                                        }));
                                    }
                                } else {
                                    throw new Error(`Lỗi API: ${response.status} ${response.statusText}`);
                                }
                            } catch (error) {
                                console.error('Lỗi khi gửi yêu cầu đến API:', error);
                                
                                ws.send(JSON.stringify({
                                    action: 'error',
                                    message: `Lỗi khi xử lý yêu cầu: ${error.message}`
                                }));
                            }
                        })();
                        break;
                        
                    default:
                        console.warn(`Nhận yêu cầu không xác định: ${request.action}`);
                        ws.send(JSON.stringify({
                            action: 'error',
                            message: 'Loại yêu cầu không được hỗ trợ'
                        }));
                }
            } catch (error) {
                console.error('Lỗi khi xử lý tin nhắn:', error);
                
                ws.send(JSON.stringify({
                    action: 'error',
                    message: `Lỗi: ${error.message}`
                }));
            }
        });
        
        ws.on('close', () => {
            console.log('Client ngắt kết nối');
        });
        
        // Gửi thông tin hệ thống khi khởi tạo kết nối
        const systemInfo = getSystemInfo();
        ws.send(JSON.stringify({
            action: 'system-info',
            data: systemInfo
        }));
    });
    
    return wss;
};

// Khởi động server
const server = startServer();

// Xử lý sự kiện đóng ứng dụng
process.on('SIGINT', () => {
    console.log('Đóng Shell.AI Desktop Agent...');
    server.close();
    process.exit(0);
});

module.exports = {
    executeCommand,
    getSystemInfo,
    executeScript
}; 