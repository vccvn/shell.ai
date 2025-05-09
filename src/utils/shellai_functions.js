/**
 * shellai_functions.js - Các hàm tiện ích cho Shell.AI
 * Thay thế cho shellai_functions.sh
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec, execSync } = require('child_process');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Thu thập thông tin hệ thống
 * @returns {Object} Thông tin hệ thống
 */
async function getSystemInfo() {
  try {
    const rawOsType = os.type();
    let osType = rawOsType;
    let osVersion = os.release();
    const hostname = os.hostname();
    const user = os.userInfo().username;
    const arch = os.arch();
    
    // Xác định đúng tên hệ điều hành
    if (rawOsType === 'Darwin') {
      osType = 'macOS';
      
      // Lấy phiên bản macOS chi tiết hơn
      try {
        const { stdout } = await execPromise('sw_vers -productVersion');
        if (stdout && stdout.trim()) {
          osVersion = stdout.trim();
        }
      } catch (e) {
        // Giữ nguyên osVersion nếu không lấy được từ sw_vers
      }
    }
    
    // Kiểm tra các package manager
    let packageManagers = '';
    
    try {
      await execPromise('apt-get --version');
      packageManagers += ' apt';
    } catch (e) {}
    
    try {
      await execPromise('yum --version');
      packageManagers += ' yum';
    } catch (e) {}
    
    try {
      await execPromise('dnf --version');
      packageManagers += ' dnf';
    } catch (e) {}
    
    try {
      await execPromise('brew --version');
      packageManagers += ' brew';
    } catch (e) {}
    
    try {
      await execPromise('pacman --version');
      packageManagers += ' pacman';
    } catch (e) {}
    
    // Kiểm tra các ngôn ngữ lập trình
    let languages = '';
    
    try {
      const { stdout: nodeVersion } = await execPromise('node --version');
      languages += ` Node.js:${nodeVersion.trim()}`;
    } catch (e) {}
    
    try {
      const { stdout: pythonVersion } = await execPromise('python3 --version');
      languages += ` Python:${pythonVersion.split(' ')[1].trim()}`;
    } catch (e) {}
    
    try {
      const { stdout: phpVersion } = await execPromise('php --version');
      languages += ` PHP:${phpVersion.split(' ')[1].trim()}`;
    } catch (e) {}
    
    try {
      const { stdout: javaVersion } = await execPromise('java -version 2>&1');
      const versionMatch = javaVersion.match(/"([^"]+)"/);
      if (versionMatch) {
        languages += ` Java:${versionMatch[1]}`;
      }
    } catch (e) {}
    
    try {
      const { stdout: rubyVersion } = await execPromise('ruby --version');
      languages += ` Ruby:${rubyVersion.split(' ')[1].trim()}`;
    } catch (e) {}
    
    // Kiểm tra các web server
    let webServers = '';
    
    try {
      await execPromise('nginx -v');
      webServers += ' nginx';
    } catch (e) {}
    
    try {
      await execPromise('apache2 -v');
      webServers += ' apache';
    } catch (e) {}
    
    try {
      await execPromise('httpd -v');
      if (!webServers.includes('apache')) {
        webServers += ' apache';
      }
    } catch (e) {}
    
    // Kiểm tra các database
    let databases = '';
    
    try {
      await execPromise('mysql --version');
      databases += ' mysql';
    } catch (e) {}
    
    try {
      await execPromise('psql --version');
      databases += ' postgresql';
    } catch (e) {}
    
    try {
      await execPromise('mongo --version');
      databases += ' mongodb';
    } catch (e) {}
    
    try {
      await execPromise('redis-cli --version');
      databases += ' redis';
    } catch (e) {}
    
    return {
      os_type: osType,
      os_version: osVersion,
      hostname,
      user,
      arch,
      package_managers: packageManagers.trim(),
      languages: languages.trim(),
      web_servers: webServers.trim(),
      databases: databases.trim()
    };
  } catch (error) {
    console.error(`Lỗi khi thu thập thông tin hệ thống: ${error.message}`);
    return {};
  }
}

// Tải cấu hình
async function loadConfig() {
  try {
    const configPath = path.join(os.homedir(), '.shellai_config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // Nếu file không tồn tại hoặc có lỗi, trả về cấu hình mặc định
    return {
      API_URL: 'http://localhost:3000/api/agent',
      SHELL_DIR: './src/shell',
      DEBUG: false,
      OPENAI_API_KEY: '',
      API_KEY: '',
      MODEL: 'gpt-4'
    };
  }
}

/**
 * Gửi yêu cầu đến API server
 * @param {string} endpoint - Endpoint API
 * @param {Object} data - Dữ liệu gửi đi
 * @param {Object} config - Cấu hình
 * @returns {Object} Phản hồi từ API
 */
async function sendApiRequest(endpoint, data, config) {
  try {
    if (config && config.DEBUG) {
      console.error(`[DEBUG] Gửi yêu cầu đến ${config.API_URL}/${endpoint} với dữ liệu:`, JSON.stringify(data));
    }
    
    const apiUrl = config && config.API_URL ? config.API_URL : 'http://localhost:3000/api/agent';
    
    // Tải cấu hình để lấy API keys và model
    const savedConfig = await loadConfig();
    
    // Tạo headers với API keys
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Thêm OpenAI API key nếu có
    if (savedConfig.OPENAI_API_KEY) {
      headers['openai_api_key'] = savedConfig.OPENAI_API_KEY;
    }
    
    // Thêm API key nếu có
    if (savedConfig.API_KEY) {
      headers['api_key'] = savedConfig.API_KEY;
    }
    
    // Thêm Model nếu có
    if (savedConfig.MODEL) {
      headers['model'] = savedConfig.MODEL;
    }
    
    if (config && config.DEBUG) {
      console.error(`[DEBUG] Headers:`, JSON.stringify(headers));
    }
    
    const response = await axios.post(`${apiUrl}/${endpoint}`, data, {
      headers: headers,
      timeout: 30000 // 30 giây timeout
    });
    
    if (config && config.DEBUG) {
      console.error(`[DEBUG] Nhận phản hồi:`, JSON.stringify(response.data));
    }
    
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`Lỗi API (${error.response.status}):`, error.response.data);
      return {
        success: false,
        message: `Lỗi API: ${error.response.status} - ${error.response.statusText}`,
        error: error.response.data
      };
    } else if (error.request) {
      console.error('Không nhận được phản hồi từ server:', error.request);
      return {
        success: false,
        message: 'Không nhận được phản hồi từ server',
        error: error.message
      };
    } else {
      console.error('Lỗi khi gửi yêu cầu:', error.message);
      return {
        success: false,
        message: `Lỗi khi gửi yêu cầu: ${error.message}`,
        error: error.message
      };
    }
  }
}

/**
 * Xử lý yêu cầu từ người dùng
 * @param {string} issue - Nội dung yêu cầu
 * @param {string} action - Hành động (run, create, show, input)
 * @param {string} type - Loại file (js, sh, py, ...)
 * @param {string} filename - Tên file
 * @param {Object} config - Cấu hình
 * @returns {Object} Phản hồi từ API
 */
async function processRequest(issue, action, type, filename, config) {
  try {
    let data = {
      issue,
      action
    };
    
    if (type) {
      data.type = type;
    }
    
    if (filename) {
      data.filename = filename;
    }
    
    // Thêm thông tin hệ thống vào request đầu tiên
    if (config && config.FIRST_REQUEST) {
      const systemInfo = await getSystemInfo();
      data.system_info = systemInfo;
      if (config) config.FIRST_REQUEST = false;
      
      if (config && config.DEBUG) {
        console.error('[DEBUG] Đã thêm thông tin hệ thống vào request đầu tiên');
      }
    }
    
    const response = await sendApiRequest('process', data, config);
    
    // Chuyển đổi định dạng phản hồi cũ sang định dạng mới nếu cần
    if (response.success && response.data) {
      if (!response.data.action && !response.data.message && !response.data.script) {
        // Định dạng cũ, chuyển đổi sang định dạng mới
        const oldData = response.data;
        response.data = {
          action: oldData.action || 'show',
          message: oldData.content || '',
        };
        
        if (oldData.filename && oldData.content) {
          response.data.script = {
            filename: oldData.filename,
            content: oldData.content,
            type: oldData.type || 'js',
            description: oldData.description || '',
            prepare: oldData.prepare || ''
          };
        }
      }
    }
    
    return response;
  } catch (error) {
    console.error(`Lỗi khi xử lý yêu cầu: ${error.message}`);
    return {
      success: false,
      message: `Lỗi khi xử lý yêu cầu: ${error.message}`
    };
  }
}

/**
 * Xử lý lỗi từ script
 * @param {string} issue - Nội dung yêu cầu ban đầu
 * @param {string} errorMessage - Thông báo lỗi
 * @param {string} scriptContent - Nội dung script
 * @param {Object} config - Cấu hình
 * @returns {Object} Phản hồi từ API
 */
async function fixScriptError(issue, errorMessage, scriptContent, config) {
  try {
    let data = {
      issue,
      error: errorMessage,
      script: scriptContent
    };
    
    // Thêm thông tin hệ thống vào request nếu là request đầu tiên
    if (config && config.FIRST_REQUEST) {
      const systemInfo = await getSystemInfo();
      data.system_info = systemInfo;
      if (config) config.FIRST_REQUEST = false;
      
      if (config && config.DEBUG) {
        console.error('[DEBUG] Đã thêm thông tin hệ thống vào request đầu tiên');
      }
    }
    
    const response = await sendApiRequest('fix', data, config);
    
    // Chuyển đổi định dạng phản hồi cũ sang định dạng mới nếu cần
    if (response.success && response.data) {
      if (!response.data.action && !response.data.message && !response.data.script) {
        // Định dạng cũ, chuyển đổi sang định dạng mới
        const oldData = response.data;
        response.data = {
          action: oldData.action || 'show',
          message: oldData.content || '',
        };
        
        if (oldData.filename && oldData.content) {
          response.data.script = {
            filename: oldData.filename,
            content: oldData.content,
            type: oldData.type || 'js',
            description: oldData.description || '',
            prepare: oldData.prepare || ''
          };
        }
      }
    }
    
    return response;
  } catch (error) {
    console.error(`Lỗi khi sửa script: ${error.message}`);
    return {
      success: false,
      message: `Lỗi khi sửa script: ${error.message}`
    };
  }
}

/**
 * Xử lý chat
 * @param {string} message - Nội dung tin nhắn
 * @param {Object} config - Cấu hình
 * @param {boolean} devMode - Chế độ phát triển
 * @param {Array} chatHistory - Lịch sử chat
 * @returns {Object} Phản hồi từ API
 */
async function handleChat(message, config, devMode = false, chatHistory = []) {
  try {
    // Thêm tin nhắn mới vào lịch sử
    chatHistory.push({ role: 'user', content: message });
    
    let data = {
      message,
      mode: devMode ? 'dev' : 'chat',
      history: chatHistory
    };
    
    // Thêm thông tin hệ thống vào request nếu là request đầu tiên
    if (config && config.FIRST_REQUEST) {
      const systemInfo = await getSystemInfo();
      data.system_info = systemInfo;
      if (config) config.FIRST_REQUEST = false;
      
      if (config && config.DEBUG) {
        console.error('[DEBUG] Đã thêm thông tin hệ thống vào request đầu tiên');
      }
    }
    
    const response = await sendApiRequest('chat', data, config);
    
    // Chuyển đổi định dạng phản hồi cũ sang định dạng mới nếu cần
    if (response.success && response.data) {
      if (!response.data.action && !response.data.message && !response.data.script) {
        // Định dạng cũ, chuyển đổi sang định dạng mới
        const oldData = response.data;
        response.data = {
          action: oldData.action || 'show',
          message: oldData.content || '',
        };
        
        if (oldData.filename && oldData.content) {
          response.data.script = {
            filename: oldData.filename,
            content: oldData.content,
            type: oldData.type || 'js',
            description: oldData.description || '',
            prepare: oldData.prepare || ''
          };
        }
      }
    }
    
    // Lưu phản hồi của AI vào lịch sử
    const responseData = response.hasOwnProperty('data') ? response.data : response;
    if (responseData.message) {
      chatHistory.push({ role: 'assistant', content: responseData.message });
    }
    
    return response;
  } catch (error) {
    console.error(`Lỗi khi xử lý chat: ${error.message}`);
    return {
      success: false,
      message: `Lỗi khi xử lý chat: ${error.message}`
    };
  }
}

/**
 * Tạo file từ nội dung
 * @param {string} filePath - Đường dẫn file
 * @param {string} content - Nội dung file
 * @param {string} fileType - Loại file (js, sh, py, ...)
 * @returns {Promise<void>}
 */
async function createFile(filePath, content, fileType) {
  try {
    // Kiểm tra và loại bỏ các dòng mã tạo file nếu phát hiện
    let cleanedContent = content;
    
    // Kiểm tra các dấu hiệu của mã tạo file
    const hasImportOs = content.includes('import os');
    const hasFilePath = content.includes('file_path');
    const hasOpenFile = content.includes('open(') || content.includes('with open');
    const hasPrint = content.includes('print(');
    
    if (hasImportOs || hasFilePath || hasOpenFile || hasPrint) {
      // Tìm nội dung thực sự trong các biến chuỗi
      const tripleQuoteMatch = content.match(/"""([\s\S]*)"""|'''([\s\S]*)'''/);
      const doubleQuoteMatch = content.match(/"([^"]*)"/);
      const singleQuoteMatch = content.match(/'([^']*)'/);
      
      if (tripleQuoteMatch) {
        cleanedContent = tripleQuoteMatch[1] || tripleQuoteMatch[2];
        console.error('[DEBUG] Đã trích xuất nội dung thực từ mã tạo file (triple quotes)');
      } else if (doubleQuoteMatch) {
        cleanedContent = doubleQuoteMatch[1];
        console.error('[DEBUG] Đã trích xuất nội dung thực từ mã tạo file (double quotes)');
      } else if (singleQuoteMatch) {
        cleanedContent = singleQuoteMatch[1];
        console.error('[DEBUG] Đã trích xuất nội dung thực từ mã tạo file (single quotes)');
      }
    }
    
    // Tạo thư mục nếu chưa tồn tại
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });
    
    // Tạo file với nội dung đã làm sạch
    await fs.writeFile(filePath, cleanedContent);
    
    // Nếu là file thực thi, cấp quyền thực thi
    if (fileType === 'sh' || fileType === 'py' || fileType === 'js') {
      await fs.chmod(filePath, 0o755);
    }
    
    console.log(`\x1b[32m[THÀNH CÔNG]\x1b[0m Đã tạo file ${filePath}`);
  } catch (error) {
    console.error(`\x1b[31m[LỖI]\x1b[0m Không thể tạo file: ${error.message}`);
    throw error;
  }
}

/**
 * Thực thi file dựa trên loại file
 * @param {string} filePath - Đường dẫn file
 * @param {string} fileType - Loại file (js, sh, py, ...)
 * @param {string} args - Tham số dòng lệnh
 * @param {string} description - Mô tả
 * @returns {Promise<number>} Mã thoát
 */
async function executeFile(filePath, fileType, args, description) {
  try {
    // Hiển thị mô tả nếu có và không phải là null
    if (description && description !== null) {
      console.log(`\x1b[34m[THÔNG TIN]\x1b[0m ${description}`);
    }
    
    // Thực thi file dựa trên loại
    let command;
    switch (fileType) {
      case 'sh':
        command = `bash "${filePath}" ${args}`;
        break;
      case 'js':
        command = `node "${filePath}" ${args}`;
        break;
      case 'py':
        command = `python3 "${filePath}" ${args}`;
        break;
      case 'php':
        command = `php "${filePath}" ${args}`;
        break;
      default:
        throw new Error(`Không hỗ trợ thực thi loại file ${fileType}`);
    }
    
    console.error(`[DEBUG] Thực thi lệnh: ${command}`);
    
    // Thực thi lệnh và hiển thị output trực tiếp
    const childProcess = exec(command, { stdio: 'inherit' });
    
    childProcess.stdout.pipe(process.stdout);
    childProcess.stderr.pipe(process.stderr);
    
    return new Promise((resolve, reject) => {
      childProcess.on('close', (code) => {
        resolve(code || 0);
      });
      
      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error(`\x1b[31m[LỖI]\x1b[0m Không thể thực thi file: ${error.message}`);
    return 1;
  }
}

/**
 * Cài đặt các thư viện cần thiết
 * @param {string} prepareCommands - Lệnh cài đặt
 * @returns {Promise<boolean>} Kết quả cài đặt
 */
async function installDependencies(prepareCommands) {
  if (!prepareCommands) {
    return true;
  }
  
  try {
    console.log(`\x1b[34m[THÔNG TIN]\x1b[0m Đang cài đặt các thư viện cần thiết...`);
    console.error(`[DEBUG] Lệnh cài đặt: ${prepareCommands}`);
    
    // Thực thi các lệnh cài đặt
    const { stdout, stderr } = await execPromise(prepareCommands);
    
    if (stderr && !stderr.includes('npm WARN') && !stderr.includes('npm notice')) {
      console.error(`\x1b[31m[LỖI]\x1b[0m ${stderr}`);
    }
    
    if (stdout) {
      console.log(stdout);
    }
    
    console.log(`\x1b[32m[THÀNH CÔNG]\x1b[0m Đã cài đặt các thư viện thành công`);
    return true;
  } catch (error) {
    console.error(`\x1b[31m[LỖI]\x1b[0m Cài đặt thư viện thất bại: ${error.message}`);
    return false;
  }
}

/**
 * Phân tích file hoặc thông báo lỗi và đưa ra giải pháp
 * @param {string} filePath - Đường dẫn đến file cần phân tích
 * @param {string} errorMessage - Thông báo lỗi cần phân tích
 * @param {string} context - Thông tin bổ sung cho việc phân tích
 * @param {Object} config - Cấu hình
 * @returns {Object} Phản hồi từ API
 */
async function analyzeFileOrError(filePath, errorMessage, context, config) {
  try {
    // Thu thập thông tin hệ thống
    const systemInfo = await getSystemInfo();
    
    // Đọc nội dung file nếu có
    let fileContent = '';
    if (filePath) {
      try {
        fileContent = await fs.readFile(filePath, 'utf8');
        if (config && config.DEBUG) {
          console.error(`[DEBUG] Đã đọc nội dung file: ${filePath}`);
        }
      } catch (error) {
        console.error(`Lỗi khi đọc file ${filePath}: ${error.message}`);
        return {
          success: false,
          message: `Không thể đọc file: ${error.message}`
        };
      }
    }
    
    // Tạo dữ liệu gửi đi
    const requestData = {
      file_path: filePath,
      file_content: fileContent,
      suggest_type: 'sh',
      system_info: systemInfo
    };
    
    // Thêm thông báo lỗi nếu có
    if (errorMessage) {
      requestData.error_message = errorMessage;
    }
    
    // Thêm bối cảnh nếu có
    if (context) {
      requestData.context = context;
    }
    
    // Gửi yêu cầu phân tích tới API
    return await sendApiRequest('analyze', requestData, config);
  } catch (error) {
    console.error(`Lỗi khi phân tích file/lỗi: ${error.message}`);
    return {
      success: false,
      message: `Lỗi: ${error.message}`
    };
  }
}

module.exports = {
  getSystemInfo,
  sendApiRequest,
  processRequest,
  fixScriptError,
  handleChat,
  createFile,
  executeFile,
  installDependencies,
  analyzeFileOrError
}; 