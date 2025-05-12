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
const { xml2js } = require('xml-js');

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
      MODEL: 'gpt-4',
      RETURN_TYPE: 'xml' // Mặc định là xml cho shellai.js
    };
  }
}

/**
 * Hàm trích xuất giá trị từ XML
 * @param {string} xml - Chuỗi XML cần xử lý
 * @param {string} xpath - Đường dẫn XPath để trích xuất giá trị
 * @returns {string|object|null} Giá trị được trích xuất hoặc null nếu không tìm thấy
 */
function extractFromXml(xml, xpath) {
  try {
    // Chuyển đổi XML thành object
    const result = xml2js(xml, { compact: true, spaces: 2 });
    
    // Trích xuất dữ liệu dựa trên xpath
    const paths = xpath.replace(/^string\((.*)\)$/, '$1').split('/').filter(p => p);
    let current = result;
    
    // Bỏ qua phần đầu tiên nếu là "//response"
    if (paths[0] === '' && paths[1] === 'response') {
      paths.splice(0, 2);
      current = result.response;
    } else if (paths[0] === 'response') {
      paths.splice(0, 1);
      current = result.response;
    }
    
    // Duyệt qua các phần tử còn lại của đường dẫn
    for (const p of paths) {
      if (!current) break;
      current = current[p];
    }
    
    if (current && current._text !== undefined) {
      return current._text;
    } else if (typeof current === 'string') {
      return current;
    } else if (current && typeof current === 'object') {
      // Nếu là object phức tạp, xử lý để chuyển các _text thành giá trị trực tiếp
      const convertXmlObject = (obj) => {
        if (!obj) return obj;
        
        const result = {};
        
        Object.keys(obj).forEach(key => {
          if (obj[key] && typeof obj[key] === 'object') {
            if (obj[key]._text !== undefined) {
              result[key] = obj[key]._text;
            } else {
              result[key] = convertXmlObject(obj[key]);
            }
          } else {
            result[key] = obj[key];
          }
        });
        
        return result;
      };
      
      return convertXmlObject(current);
    }
    
    return null;
  } catch (error) {
    console.error(`Lỗi khi trích xuất XML: ${error.message}`);
    return null;
  }
}

/**
 * Kiểm tra xem phản hồi có phải là XML hay không
 * @param {string} response - Chuỗi phản hồi
 * @returns {boolean} true nếu là XML, false nếu không phải
 */
function isXmlResponse(response) {
  return typeof response === 'string' && response.includes('<response>');
}

/**
 * Chuyển đổi phản hồi XML thành object
 * @param {string} xmlResponse - Chuỗi XML
 * @returns {object} Object chứa thông tin từ XML
 */
function parseXmlResponse(xmlResponse) {
  try {
    const data = {
      action: extractFromXml(xmlResponse, 'string(//response/action)'),
      message: extractFromXml(xmlResponse, 'string(//response/message)'),
      confirm_message: extractFromXml(xmlResponse, 'string(//response/confirm_message)'),
      _original_xml: xmlResponse // Lưu trữ XML gốc để xử lý sau này
    };
    
    // Extract script info if available
    if (xmlResponse.includes('<script>')) {
      data.script = {
        filename: extractFromXml(xmlResponse, 'string(//response/script/filename)'),
        content: extractFromXml(xmlResponse, 'string(//response/script/content)'),
        type: extractFromXml(xmlResponse, 'string(//response/script/type)'),
        description: extractFromXml(xmlResponse, 'string(//response/script/description)'),
        prepare: extractFromXml(xmlResponse, 'string(//response/script/prepare)')
      };
    }
    
    // Trích xuất history nếu có
    if (xmlResponse.includes('<history>')) {
      try {
        // Thử trích xuất history từ XML
        const historyXml = extractFromXml(xmlResponse, '//response/history');
        
        // Nếu history là một mảng các đối tượng
        if (historyXml && Array.isArray(historyXml.message)) {
          data.history = historyXml.message.map(msg => ({
            role: msg._attributes ? msg._attributes.role : 'unknown',
            content: msg._text || ''
          }));
        } 
        // Nếu chỉ có một message
        else if (historyXml && historyXml.message && historyXml.message._attributes) {
          data.history = [{
            role: historyXml.message._attributes.role || 'unknown',
            content: historyXml.message._text || ''
          }];
        }
      } catch (historyError) {
        console.error(`Lỗi khi trích xuất history từ XML: ${historyError.message}`);
        // Không làm gì, history sẽ được xử lý sau trong handleChat
      }
    }
    
    return data;
  } catch (error) {
    console.error(`Lỗi khi phân tích XML: ${error.message}`);
    return null;
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
    const apiUrl = config && config.API_URL ? config.API_URL : 'http://localhost:3000/api/agent';
    
    // Tải cấu hình để lấy API keys và model
    const savedConfig = await loadConfig();
    
    // Tạo headers với API keys
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (config && config.OPENAI_API_KEY) {
      headers['openai_api_key'] = config.OPENAI_API_KEY;
    } else if (savedConfig.OPENAI_API_KEY) {
      headers['openai_api_key'] = savedConfig.OPENAI_API_KEY;
    }
    
    if (config && config.API_KEY) {
      headers['api_key'] = config.API_KEY;
    } else if (savedConfig.API_KEY) {
      headers['api_key'] = savedConfig.API_KEY;
    }
    
    if (config && config.MODEL) {
      headers['model'] = config.MODEL;
    } else if (savedConfig.MODEL) {
      headers['model'] = savedConfig.MODEL;
    }
    
    // Thêm header return_type từ config
    if (config && config.RETURN_TYPE) {
      headers['return_type'] = config.RETURN_TYPE;
    } else if (savedConfig.RETURN_TYPE) {
      headers['return_type'] = savedConfig.RETURN_TYPE;
    } else {
      // Mặc định là xml cho shellai.js
      headers['return_type'] = 'xml';
    }
    
    // Log thông tin request nếu ở chế độ debug
    if (config && config.DEBUG) {
      const debugLevel = config.DEBUG_LEVEL || 1;
      if (debugLevel >= 1) {
        console.error(`[DEBUG] Gửi request đến ${apiUrl}/${endpoint}`);
        
      }
      if (debugLevel >= 2) {
        console.error(`[DEBUG-2] Headers: ${JSON.stringify(headers)}`);
      }
      if (debugLevel >= 3) {
        console.error(`[DEBUG-3] Dữ liệu gửi đi: `, data);
      }
    }
    
    // Gửi request
    const response = await axios.post(`${apiUrl}/${endpoint}`, data, { headers });
    
    // Kiểm tra phản hồi
    if (config && config.DEBUG) {
      const debugLevel = config.DEBUG_LEVEL || 1;
      if (debugLevel >= 1) {
        if (typeof response.data === 'string') {
          console.error('[DEBUG] Nhận phản hồi dạng chuỗi từ API');
        } else {
          console.error('[DEBUG] Nhận phản hồi từ API');
        }
      }
      
      if (debugLevel >= 2) {
        if (typeof response.data === 'string') {
          console.error(`[DEBUG-2] Phần đầu phản hồi: ${response.data.substring(0, 200)}...`);
        } else {
          console.error(`[DEBUG-2] Phản hồi: ${JSON.stringify(response.data)}`);
        }
      }
      
      if (debugLevel >= 3) {
        console.error(`[DEBUG-3] Headers phản hồi: ${JSON.stringify(response.headers)}`);
      }
    }
    
    // Xử lý phản hồi: có thể là XML hoặc JSON
    if (typeof response.data === 'string' && response.data.includes('<response>')) {
      // Nếu phản hồi là XML, chuyển đổi thành object
      return parseXmlResponse(response.data);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Lỗi khi gửi yêu cầu API: ${error.message}`);
    
    if (config && config.DEBUG && config.DEBUG_LEVEL >= 2) {
      console.error(`[DEBUG-2] Chi tiết lỗi: ${error.stack}`);
      
      if (error.response) {
        console.error(`[DEBUG-2] Mã lỗi: ${error.response.status}`);
        console.error(`[DEBUG-3] Dữ liệu lỗi: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    // Kiểm tra nếu có phản hồi lỗi từ server
    if (error.response && error.response.data) {
      if (typeof error.response.data === 'string' && error.response.data.includes('<response>')) {
        return parseXmlResponse(error.response.data);
      } else {
        return error.response.data;
      }
    }
    
    // Nếu không có, trả về đối tượng lỗi chung
    return {
      action: 'error',
      message: `Lỗi kết nối: ${error.message}`
    };
  }
}

/**
 * Xử lý yêu cầu từ người dùng
 * @param {string} issue - Nội dung yêu cầu
 * @param {string} action - Hành động (run, show, chat)
 * @param {string} type - Loại file
 * @param {string} filename - Tên file
 * @param {Object} config - Cấu hình
 * @param {Object} extraData - Dữ liệu bổ sung
 * @returns {Object} Phản hồi từ API
 */
async function processRequest(issue, action, type, filename, config, extraData = {}) {
  try {
    // Thu thập thông tin hệ thống
    const systemInfo = await getSystemInfo();
    
    // Tạo dữ liệu gửi đi
    const requestData = {
      issue,
      action,
      suggest_type: 'sh',
      system_info: systemInfo,
      ...extraData
    };
    
    // Thêm type và filename nếu có
    if (type) {
      requestData.type = type;
    }
    
    if (filename) {
      requestData.filename = filename;
    }
    
    // Gửi request và trả về phản hồi
    return await sendApiRequest('process', requestData, config);
  } catch (error) {
    console.error(`Lỗi khi xử lý yêu cầu: ${error.message}`);
    return {
      action: 'error',
      message: `Lỗi hệ thống: ${error.message}`
    };
  }
}

/**
 * Sửa lỗi script
 * @param {string} issue - Nội dung yêu cầu gốc
 * @param {string} errorMessage - Thông báo lỗi
 * @param {string} scriptContent - Nội dung script
 * @param {Object} config - Cấu hình
 * @returns {Object} Phản hồi từ API
 */
async function fixScriptError(issue, errorMessage, scriptContent, config) {
  try {
    // Thu thập thông tin hệ thống
    const systemInfo = await getSystemInfo();
    
    // Tạo dữ liệu gửi đi
    const requestData = {
      issue,
      error: errorMessage,
      script: scriptContent,
      suggest_type: 'sh',
      system_info: systemInfo
    };
    
    // Gửi request và trả về phản hồi
    return await sendApiRequest('fix', requestData, config);
  } catch (error) {
    console.error(`Lỗi khi sửa script: ${error.message}`);
    return {
      action: 'error',
      message: `Lỗi hệ thống: ${error.message}`
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
    // Thu thập thông tin hệ thống
    const systemInfo = await getSystemInfo();
    
    // Tạo dữ liệu gửi đi
    const requestData = {
      message,
      suggest_type: 'sh',
      system_info: systemInfo,
      mode: devMode ? 'dev' : 'chat'
    };
    
    // Thêm lịch sử chat nếu có
    if (chatHistory && chatHistory.length > 0) {
      requestData.chat_history = chatHistory;
      
      if (config && config.DEBUG && config.DEBUG_LEVEL >= 2) {
        console.error(`[DEBUG-2] Gửi lịch sử chat với ${chatHistory.length} tin nhắn`);
      }
    }
    
    // Gửi request và trả về phản hồi
    const response = await sendApiRequest('chat', requestData, config);
    
    // Nếu API trả về chat history mới, cập nhật lại
    if (response && response.history && Array.isArray(response.history)) {
      if (config && config.DEBUG) {
        console.error(`[DEBUG] Nhận được lịch sử chat từ API với ${response.history.length} tin nhắn`);
      }
      // Trả về lịch sử mới từ API để cập nhật trong chatMode và devMode
      return {
        ...response,
        history: response.history
      };
    }
    
    // Trích xuất lịch sử từ phản hồi XML nếu có
    if (response && typeof response._original_xml === 'string' && response._original_xml.includes('<history>')) {
      try {
        // Phân tích XML để lấy history
        const historyMatch = response._original_xml.match(/<history>([\s\S]*?)<\/history>/);
        if (historyMatch && historyMatch[1]) {
          if (config && config.DEBUG) {
            console.error('[DEBUG] Trích xuất lịch sử chat từ phản hồi XML');
          }
          
          // Phân tích các tin nhắn từ XML
          const messageMatches = historyMatch[1].match(/<message[^>]*>([\s\S]*?)<\/message>/g);
          if (messageMatches && messageMatches.length > 0) {
            const parsedHistory = [];
            
            for (const msgXml of messageMatches) {
              const roleMatch = msgXml.match(/role="([^"]+)"/);
              const contentMatch = msgXml.match(/<message[^>]*>([\s\S]*?)<\/message>/);
              
              if (roleMatch && roleMatch[1] && contentMatch && contentMatch[1]) {
                parsedHistory.push({
                  role: roleMatch[1],
                  content: contentMatch[1].trim()
                });
              }
            }
            
            if (parsedHistory.length > 0) {
              if (config && config.DEBUG) {
                console.error(`[DEBUG] Đã trích xuất ${parsedHistory.length} tin nhắn từ XML`);
              }
              
              // Trả về phản hồi với lịch sử được trích xuất
              return {
                ...response,
                history: parsedHistory
              };
            }
          }
        }
      } catch (xmlError) {
        if (config && config.DEBUG) {
          console.error(`[DEBUG-2] Lỗi khi trích xuất lịch sử từ XML: ${xmlError.message}`);
        }
      }
    }
    
    return response;
  } catch (error) {
    console.error(`Lỗi khi xử lý chat: ${error.message}`);
    return {
      action: 'error',
      message: `Lỗi hệ thống: ${error.message}`
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
    
    // Log thông tin debug
    if (global.config && global.config.DEBUG) {
      const debugLevel = global.config.DEBUG_LEVEL || 1;
      if (debugLevel >= 1) {
        console.error(`[DEBUG] Tạo file: ${filePath}`);
      }
      if (debugLevel >= 2) {
        console.error(`[DEBUG-2] Loại file: ${fileType}`);
        console.error(`[DEBUG-2] Kích thước nội dung: ${cleanedContent.length} bytes`);
      }
      if (debugLevel >= 3) {
        console.error(`[DEBUG-3] Phần đầu nội dung: ${cleanedContent.substring(0, 200)}...`);
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
      if (global.config && global.config.DEBUG) {
        console.error(`[DEBUG] Đã cấp quyền thực thi cho file ${filePath}`);
      }
    }
    
    console.log(`\x1b[32m[THÀNH CÔNG]\x1b[0m Đã tạo file ${filePath}`);
  } catch (error) {
    console.error(`\x1b[31m[LỖI]\x1b[0m Không thể tạo file: ${error.message}`);
    if (global.config && global.config.DEBUG && global.config.DEBUG_LEVEL >= 2) {
      console.error(`[DEBUG-2] Chi tiết lỗi: ${error.stack}`);
    }
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
    
    // Log thông tin debug
    if (global.config && global.config.DEBUG) {
      const debugLevel = global.config.DEBUG_LEVEL || 1;
      if (debugLevel >= 1) {
        console.error(`[DEBUG] Thực thi file: ${filePath}`);
      }
      if (debugLevel >= 2) {
        console.error(`[DEBUG-2] Lệnh thực thi: ${command}`);
      }
    }
    
    // Thực thi lệnh và hiển thị output trực tiếp
    const childProcess = exec(command, { stdio: 'inherit' });
    
    childProcess.stdout.pipe(process.stdout);
    childProcess.stderr.pipe(process.stderr);
    
    return new Promise((resolve, reject) => {
      childProcess.on('close', (code) => {
        if (global.config && global.config.DEBUG) {
          console.error(`[DEBUG] File ${filePath} đã thực thi xong với mã thoát: ${code || 0}`);
        }
        resolve(code || 0);
      });
      
      childProcess.on('error', (error) => {
        if (global.config && global.config.DEBUG && global.config.DEBUG_LEVEL >= 2) {
          console.error(`[DEBUG-2] Lỗi khi thực thi ${filePath}: ${error.message}`);
          console.error(`[DEBUG-3] Chi tiết lỗi: ${error.stack}`);
        }
        reject(error);
      });
    });
  } catch (error) {
    console.error(`\x1b[31m[LỖI]\x1b[0m Không thể thực thi file: ${error.message}`);
    if (global.config && global.config.DEBUG && global.config.DEBUG_LEVEL >= 2) {
      console.error(`[DEBUG-2] Chi tiết lỗi: ${error.stack}`);
    }
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
    
    // Log thông tin debug
    if (global.config && global.config.DEBUG) {
      const debugLevel = global.config.DEBUG_LEVEL || 1;
      if (debugLevel >= 1) {
        console.error(`[DEBUG] Cài đặt thư viện`);
      }
      if (debugLevel >= 2) {
        console.error(`[DEBUG-2] Lệnh cài đặt: ${prepareCommands}`);
      }
    }
    
    // Thực thi các lệnh cài đặt
    const { stdout, stderr } = await execPromise(prepareCommands);
    
    if (stderr && !stderr.includes('npm WARN') && !stderr.includes('npm notice')) {
      console.error(`\x1b[31m[LỖI]\x1b[0m ${stderr}`);
    }
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (global.config && global.config.DEBUG && global.config.DEBUG_LEVEL >= 3) {
      console.error(`[DEBUG-3] Output cài đặt: ${stdout}`);
      if (stderr) {
        console.error(`[DEBUG-3] Stderr cài đặt: ${stderr}`);
      }
    }
    
    console.log(`\x1b[32m[THÀNH CÔNG]\x1b[0m Đã cài đặt các thư viện thành công`);
    return true;
  } catch (error) {
    console.error(`\x1b[31m[LỖI]\x1b[0m Cài đặt thư viện thất bại: ${error.message}`);
    
    if (global.config && global.config.DEBUG) {
      const debugLevel = global.config.DEBUG_LEVEL || 1;
      if (debugLevel >= 2) {
        console.error(`[DEBUG-2] Chi tiết lỗi cài đặt: ${error.stack}`);
      }
      if (debugLevel >= 3 && error.stdout) {
        console.error(`[DEBUG-3] Output: ${error.stdout}`);
      }
      if (debugLevel >= 3 && error.stderr) {
        console.error(`[DEBUG-3] Stderr: ${error.stderr}`);
      }
    }
    
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