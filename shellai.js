#!/usr/bin/env node

/**
 * shellai.js - Script chính để tương tác với Shell.AI
 * Thay thế cho shellai.sh, xử lý tham số dòng lệnh và gọi các hàm từ các module khác
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { xml2js } = require('xml-js');
const { execSync } = require('child_process');
const readline = require('readline');
const os = require('os');

const { 
  processRequest, 
  handleChat, 
  createFile, 
  executeFile, 
  installDependencies,
  getSystemInfo,
  fixScriptError,
  analyzeFileOrError
} = require('./src/utils/shellai_functions');

const {
  readChatHistory,
  saveChatHistory,
  addMessage,
  clearChatHistory
} = require('./src/utils/chatHistory');

// Biến môi trường
const config = {
  API_URL: process.env.API_URL || 'http://localhost:3000/api/agent',
  SHELL_DIR: process.env.SHELL_DIR || './src/shell',
  DEBUG: process.env.DEBUG === 'true' || false,
  DEBUG_LEVEL: parseInt(process.env.DEBUG_LEVEL || '1', 10),
  FIRST_REQUEST: true,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  API_KEY: process.env.API_KEY || '',
  MODEL: process.env.MODEL || 'gpt-4',
  RETURN_TYPE: process.env.RETURN_TYPE || 'xml' // Mặc định sử dụng XML cho shellai.js
};

// Chia sẻ config với các module khác
global.config = config;

// Tạo thư mục shell nếu chưa tồn tại
if (!fs.existsSync(config.SHELL_DIR)) {
  fs.mkdirSync(config.SHELL_DIR, { recursive: true });
  debugLog(`Đã tạo thư mục ${config.SHELL_DIR}`, 1);
}

// Hàm hiển thị hướng dẫn sử dụng
function showUsage() {
  console.log(`Cách sử dụng: ${path.basename(process.argv[1])} [lệnh] [tham số] [-m "mô tả"] [--debug] [--debug=LEVEL] [-v]

Các lệnh:
  install <pkg1> <pkg2> ...    Cài đặt các gói phần mềm
  check <service>              Kiểm tra trạng thái dịch vụ
  create file <tên file>       Tạo file mới
  chat                         Bắt đầu chế độ chat với AI
  dev                          Bắt đầu chế độ phát triển hệ thống
  config                       Xem và thay đổi cấu hình
  help                         Hiển thị hướng dẫn sử dụng

Các tùy chọn:
  -m, --message "nội dung"     Mô tả chi tiết yêu cầu
  --debug                      Hiển thị thông tin debug (cấp độ 1)
  --debug=LEVEL                Hiển thị thông tin debug với cấp độ chi tiết (1-3)
  -v, --verbose                Tăng cấp độ chi tiết debug
  -h, --help                   Hiển thị hướng dẫn sử dụng

Ví dụ:
  ${path.basename(process.argv[1])} install apache2 nginx -m "Cài đặt web server"
  ${path.basename(process.argv[1])} check mysql
  ${path.basename(process.argv[1])} create file index.html -m "Tạo trang web đơn giản"
  ${path.basename(process.argv[1])} chat
  ${path.basename(process.argv[1])} dev
  ${path.basename(process.argv[1])} config
  ${path.basename(process.argv[1])} -m "Kiểm tra và hiển thị thông tin hệ thống"`);
}

// Xử lý tham số dòng lệnh
function parseArgs() {
  const args = {
    command: '',
    params: [],
    message: '',
    debug: config.DEBUG,
    debugLevel: config.DEBUG_LEVEL
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg === '-m' || arg === '--message') {
      if (i + 1 < process.argv.length) {
        args.message = process.argv[++i];
      }
    } else if (arg === '--debug') {
      args.debug = true;
      config.DEBUG = true;
    } else if (arg.startsWith('--debug=')) {
      // Hỗ trợ cấp độ debug (--debug=2)
      const level = parseInt(arg.split('=')[1], 10);
      if (!isNaN(level) && level > 0) {
        args.debug = true;
        args.debugLevel = level;
        config.DEBUG = true;
        config.DEBUG_LEVEL = level;
      }
    } else if (arg === '-v' || arg === '--verbose') {
      // Tăng cấp độ debug lên 1
      args.debug = true;
      args.debugLevel = Math.min(args.debugLevel + 1, 3);
      config.DEBUG = true;
      config.DEBUG_LEVEL = args.debugLevel;
    } else if (arg === '-h' || arg === '--help') {
      showUsage();
      process.exit(0);
    } else {
      if (!args.command) {
        args.command = arg;
      } else {
        args.params.push(arg);
      }
    }
  }
  
  return args;
}

// Hàm debug log với cấp độ chi tiết
function debugLog(message, level = 1) {
  if (config.DEBUG && level <= config.DEBUG_LEVEL) {
    console.error(`[DEBUG${level > 1 ? '-' + level : ''}] ${message}`);
  }
}

// Hàm error log
function errorLog(message) {
  console.error(`\x1b[31m[LỖI]\x1b[0m ${message}`);
}

// Hàm success log
function successLog(message) {
  console.log(`\x1b[32m[THÀNH CÔNG]\x1b[0m ${message}`);
}

// Hàm info log
function infoLog(message) {
  console.log(`\x1b[34m[THÔNG TIN]\x1b[0m ${message}`);
}

// Hàm processing log
function processingLog(message) {
  console.log(`\x1b[33m[ĐANG XỬ LÝ]\x1b[0m ${message}`);
}

// Hàm trích xuất giá trị từ XML
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
    debugLog(`Lỗi khi trích xuất XML: ${error.message}`);
    return null;
  }
}

// Hàm kiểm tra curl đã được cài đặt chưa
function checkCurl() {
  try {
    execSync('curl --version', { stdio: 'ignore' });
  } catch (error) {
    errorLog('curl chưa được cài đặt. Đang cài đặt...');
    try {
      // Kiểm tra xem đang chạy trên macOS
      if (process.platform === 'darwin') {
        // Kiểm tra xem Homebrew đã được cài đặt chưa
        try {
          execSync('brew --version', { stdio: 'ignore' });
        } catch (brewError) {
          // Homebrew chưa được cài đặt
          errorLog('Homebrew chưa được cài đặt trên macOS. Vui lòng cài đặt Homebrew trước: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
          process.exit(1);
        }
        
        // Cài đặt curl qua Homebrew
        infoLog('Đang cài đặt curl qua Homebrew...');
        execSync('brew install curl', { stdio: 'inherit' });
      } else if (process.platform === 'linux') {
        // Xử lý trên Linux
        try {
          execSync('apt-get update && apt-get install -y curl', { stdio: 'inherit' });
        } catch (e) {
          try {
            execSync('yum install -y curl', { stdio: 'inherit' });
          } catch (e2) {
            errorLog('Không thể cài đặt curl tự động. Vui lòng cài đặt thủ công.');
            process.exit(1);
          }
        }
      } else {
        errorLog(`Không thể cài đặt curl tự động trên hệ điều hành ${process.platform}. Vui lòng cài đặt thủ công.`);
        process.exit(1);
      }
    } catch (installError) {
      errorLog(`Không thể cài đặt curl: ${installError.message}`);
      process.exit(1);
    }
  }
}

// Kiểm tra XML tools đã được cài đặt chưa
function checkXmlTools() {
  try {
    // Kiểm tra xml-js package
    require('xml-js');
  } catch (error) {
    errorLog('Thư viện xml-js chưa được cài đặt. Đang cài đặt...');
    try {
      execSync('npm install xml-js', { stdio: 'inherit' });
      infoLog('Đã cài đặt xml-js thành công.');
    } catch (installError) {
      errorLog(`Không thể cài đặt xml-js: ${installError.message}`);
      process.exit(1);
    }
  }
}

// Hàm đọc nội dung file
async function readFileContent(filePath) {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    errorLog(`Không thể đọc file ${filePath}: ${error.message}`);
    return null;
  }
}

// Hàm hỏi người dùng có muốn sửa lỗi không
async function askUserToFixScript(filePath, errorMessage) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`Script ${filePath} bị lỗi:\n${errorMessage}\n\nBạn có muốn AI sửa lỗi này không? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// Kiểm tra package đã được cài đặt chưa
async function checkPackageInstalled(packageName) {
  // Phát hiện loại package manager từ lệnh cài đặt
  if (packageName.includes('pip')) {
    // Package là Python package
    try {
      const pipResult = await execPromise(`pip list | grep -i "${packageName.replace('pip install ', '')}"`, { shell: true });
      return pipResult.stdout.trim() !== '';
    } catch (e) {
      return false;
    }
  } else if (packageName.includes('npm')) {
    // Package là Node.js package
    try {
      const npmResult = await execPromise(`npm list ${packageName.replace('npm install ', '')} | grep -i "${packageName.replace('npm install ', '')}"`, { shell: true });
      return npmResult.stdout.trim() !== '';
    } catch (e) {
      return false;
    }
  } else if (packageName.includes('gem')) {
    // Package là Ruby gem
    try {
      const gemResult = await execPromise(`gem list | grep -i "${packageName.replace('gem install ', '')}"`, { shell: true });
      return gemResult.stdout.trim() !== '';
    } catch (e) {
      return false;
    }
  } else {
    // Kiểm tra nếu là command cài đặt với Homebrew (trên macOS)
    if (packageName.includes('brew install')) {
      const brewPackage = packageName.replace('brew install ', '');
      try {
        const brewResult = await execPromise(`brew list | grep -i "${brewPackage}"`, { shell: true });
        return brewResult.stdout.trim() !== '';
      } catch (e) {
        return false;
      }
    } else if (packageName.includes('apt-get install') || packageName.includes('apt install')) {
      // Kiểm tra nếu là command cài đặt với apt (trên Ubuntu/Debian)
      const aptPackage = packageName.replace(/apt(-get)? install -y /, '');
      try {
        const aptResult = await execPromise(`dpkg -l | grep -i "${aptPackage}"`, { shell: true });
        return aptResult.stdout.trim() !== '';
      } catch (e) {
        return false;
      }
    } else if (packageName.includes('yum install')) {
      // Kiểm tra nếu là command cài đặt với yum (trên CentOS/RHEL/Fedora)
      const yumPackage = packageName.replace('yum install -y ', '');
      try {
        const yumResult = await execPromise(`rpm -qa | grep -i "${yumPackage}"`, { shell: true });
        return yumResult.stdout.trim() !== '';
      } catch (e) {
        return false;
      }
    }
  }
  
  return false; // Mặc định là chưa cài đặt
}

// Phân tích các package cần cài đặt từ lệnh prepare
function parsePackagesFromPrepare(prepareCommand) {
  const packages = [];
  
  // Tách các lệnh nếu có nhiều lệnh được phân tách bằng dấu chấm phẩy
  const commands = prepareCommand.split(';').map(cmd => cmd.trim()).filter(cmd => cmd);
  
  for (const cmd of commands) {
    // Xử lý lệnh npm
    if (cmd.startsWith('npm install')) {
      // Tách các package từ lệnh npm install
      const npmPkgs = cmd.replace('npm install', '').trim().split(' ');
      packages.push(...npmPkgs.filter(pkg => pkg && !pkg.startsWith('-')));
    }
    
    // Xử lý lệnh pip
    else if (cmd.startsWith('pip install') || cmd.startsWith('pip3 install')) {
      // Tách các package từ lệnh pip install
      const pipPkgs = cmd.replace(/pip3? install/, '').trim().split(' ');
      packages.push(...pipPkgs.filter(pkg => pkg && !pkg.startsWith('-')));
    }
    
    // Xử lý lệnh apt-get hoặc apt
    else if (cmd.startsWith('apt-get install') || cmd.startsWith('apt install')) {
      // Tách các package từ lệnh apt-get install
      const aptPkgs = cmd.replace(/apt(-get)? install( -y)?/, '').trim().split(' ');
      packages.push(...aptPkgs.filter(pkg => pkg && !pkg.startsWith('-')));
    }
    
    // Xử lý lệnh yum
    else if (cmd.startsWith('yum install')) {
      // Tách các package từ lệnh yum install
      const yumPkgs = cmd.replace(/yum install( -y)?/, '').trim().split(' ');
      packages.push(...yumPkgs.filter(pkg => pkg && !pkg.startsWith('-')));
    }
    
    // Xử lý lệnh brew
    else if (cmd.startsWith('brew install')) {
      // Tách các package từ lệnh brew install
      const brewPkgs = cmd.replace('brew install', '').trim().split(' ');
      packages.push(...brewPkgs.filter(pkg => pkg && !pkg.startsWith('-')));
    }
    
    // Xử lý các lệnh khác nếu cần...
  }
  
  // Xử lý các package có thêm version (ví dụ: axios@1.2.3)
  packages.forEach((pkg, index) => {
    if (pkg.includes('@')) {
      const pkgName = pkg.split('@')[0];
      if (pkgName) {
        packages[index] = pkgName;
      }
    }
  });
  
  // Xử lý các package có tên đầy đủ (scoped packages)
  packages.forEach((pkg, index) => {
    if (pkg.startsWith('@')) {
      // Đối với scoped package (ví dụ: @babel/core), cần lấy tên đầy đủ
      const scopedPkg = prepareCommand.match(new RegExp(`(${pkg}[\\w\\/-]+)`, 'i'));
      if (scopedPkg && scopedPkg[1]) {
        packages[index] = scopedPkg[1].split('@')[0]; // Loại bỏ phiên bản nếu có
      }
    }
  });
  
  return packages;
}

// Hàm xử lý phản hồi tự động nhiều bước
async function autoSolve(response, args, originalQuestion = null, isFirstScript = true) {
  try {
    let data;
    
    // Kiểm tra xem response có phải là XML hay không
    if (typeof response === 'string' && response.includes('<response>')) {
      // Parse XML to object
      data = {
        action: extractFromXml(response, 'string(//response/action)'),
        message: extractFromXml(response, 'string(//response/message)'),
        script: null,
        confirm_message: extractFromXml(response, 'string(//response/confirm_message)')
      };
      
      // Extract script info if available
      if (response.includes('<script>')) {
        data.script = {
          filename: extractFromXml(response, 'string(//response/script/filename)'),
          content: extractFromXml(response, 'string(//response/script/content)'),
          type: extractFromXml(response, 'string(//response/script/type)'),
          description: extractFromXml(response, 'string(//response/script/description)'),
          prepare: extractFromXml(response, 'string(//response/script/prepare)')
        };
      }
    } else {
      data = response.hasOwnProperty('data') ? response.data : response;
    }
    
    if (!data.action) {
      errorLog('Phản hồi không có action');
      return;
    }
    
    if (data.message) {
      infoLog(data.message);
    }
    
    if (data.action === 'done' || data.action === 'chat' || data.action === 'show') {
      // Đã có kết quả cuối cùng
      return;
    }
    
    if (data.action === 'run' && data.script) {
      const { filename, content, type, description, prepare } = data.script;
      const filePath = path.join(config.SHELL_DIR, filename);
      let shouldExecute = true;
      let confirmMessage = data.confirm_message || 'Bạn có muốn thực thi script này không? (y/n): ';
      
      if (isFirstScript) {
        // Hỏi xác nhận lần đầu
        const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        shouldExecute = await new Promise(resolve => {
          rl.question(confirmMessage, answer => {
            rl.close();
            resolve(answer.trim().toLowerCase().charAt(0) === 'y');
          });
        });
      }
      
      if (shouldExecute) {
        if (prepare) await installDependencies(prepare);
        await createFile(filePath, content, type);
        // Thực thi script và lấy output
        const { execSync } = require('child_process');
        let output = '';
        try {
          if (type === 'sh' || type === 'bash') {
            output = execSync(`bash "${filePath}"`, { encoding: 'utf8' });
          } else if (type === 'js' || type === 'javascript') {
            output = execSync(`node "${filePath}"`, { encoding: 'utf8' });
          } else if (type === 'py' || type === 'python') {
            output = execSync(`python3 "${filePath}"`, { encoding: 'utf8' });
          } else {
            output = execSync(`${filePath}`, { encoding: 'utf8' });
          }
        } catch (e) {
          output = e.stdout ? e.stdout.toString() : '';
          output += e.stderr ? '\n' + e.stderr.toString() : '';
        }
        // Xóa file script sau khi thực thi
        try { fs.unlinkSync(filePath); } catch (e) {}
        // Gửi lại output cho AI với action analyze
        const analyzePayload = {
          action: 'analyze',
          script_output: output,
          original_question: originalQuestion || args.message || args.command || '',
          issue: originalQuestion || args.message || args.command || ''
        };
        // Gửi yêu cầu analyze
        const analyzeResponse = await processRequest(
          analyzePayload.original_question,
          'analyze',
          '',
          '',
          config,
          { scriptOutput: output }
        );
        // Đệ quy tiếp tục xử lý
        await autoSolve(analyzeResponse, args, analyzePayload.original_question, false);
      } else {
        infoLog('Bạn đã từ chối thực thi script. Dừng lại.');
        return;
      }
    } else if (data.action === 'analyze') {
      // Nếu AI yêu cầu phân tích tiếp, gửi lại output (nếu có)
      // (Trường hợp này đã được xử lý ở trên, nên chỉ cần dừng lại)
      return;
    }
  } catch (error) {
    errorLog(`Lỗi autoSolve: ${error.message}`);
  }
}

// Chế độ chat
async function chatMode() {
  infoLog('Bắt đầu chế độ chat (nhập \'exit\' để thoát)');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Khởi tạo lịch sử trò chuyện từ file
  let chatHistory = await readChatHistory(false);
  
  if (config.DEBUG) {
    debugLog(`Đã tải ${chatHistory.length} tin nhắn từ lịch sử chat`, 2);
  }
  
  const askQuestion = () => {
    rl.question('> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        infoLog('Đã thoát chế độ chat');
        rl.close();
        return;
      }
      
      // Nếu người dùng nhập đúng từ "clear" thì xóa lịch sử chat
      if (input.trim().toLowerCase() === 'clear') {
        await clearChatHistory(false);
        chatHistory = [];
        infoLog('Đã xóa lịch sử chat.');
        askQuestion();
        return;
      }
      
      // Hiển thị thông báo đang xử lý
      processingLog('AI đang phản hồi...');
      
      // Thêm tin nhắn của người dùng vào lịch sử
      chatHistory = addMessage('user', input, chatHistory);
      
      if (config.DEBUG) {
        debugLog(`Đã thêm tin nhắn người dùng vào lịch sử, tổng số tin nhắn: ${chatHistory.length}`, 2);
      }
      
      // Gửi yêu cầu và lấy phản hồi
      const response = await handleChat(input, config, false, chatHistory);
      
      // Xóa dòng "AI đang phản hồi..."
      process.stdout.write('\x1b[1A\x1b[2K');
      
      if (config.DEBUG) {
        debugLog(`Phản hồi đầy đủ: ${JSON.stringify(response)}`, 2);
      }
      
      // Xử lý phản hồi theo định dạng mới
      if (response) {
        // Định dạng mới trả về trực tiếp từ API
        const data = response.hasOwnProperty('data') ? response.data : response;
        
        // Nếu API trả về history, cập nhật lịch sử chat
        if (response.history && Array.isArray(response.history)) {
          chatHistory = response.history;
          if (config.DEBUG) {
            debugLog(`Cập nhật lịch sử chat từ API, tổng số tin nhắn: ${chatHistory.length}`, 2);
          }
          // Lưu lịch sử chat ngay lập tức
          await saveChatHistory(chatHistory, false);
        }
        
        // Hiển thị message nếu có
        if (data.message) {
          console.log(`\n${data.message}\n`);
          
          // Chỉ thêm phản hồi vào lịch sử nếu API không trả về history
          if (!response.history) {
            // Thêm phản hồi của AI vào lịch sử
            chatHistory = addMessage('assistant', data.message, chatHistory);
            
            // Lưu lịch sử chat
            await saveChatHistory(chatHistory, false);
            
            if (config.DEBUG) {
              debugLog(`Đã thêm phản hồi AI vào lịch sử và lưu, tổng số tin nhắn: ${chatHistory.length}`, 2);
            }
          }
        } else if (data.script && !data.message) {
          // Nếu không có message nhưng có script, hiển thị một thông báo chung
          const scriptMessage = 'AI đã tạo một script để giải quyết yêu cầu của bạn.';
          console.log(`\n${scriptMessage}\n`);
          
          // Chỉ thêm phản hồi vào lịch sử nếu API không trả về history
          if (!response.history) {
            // Thêm phản hồi của AI vào lịch sử với thông báo chung
            chatHistory = addMessage('assistant', scriptMessage, chatHistory);
            
            // Lưu lịch sử chat
            await saveChatHistory(chatHistory, false);
            
            if (config.DEBUG) {
              debugLog(`Đã thêm thông báo script vào lịch sử và lưu, tổng số tin nhắn: ${chatHistory.length}`, 2);
            }
          }
        }
        
        // Kiểm tra xem có script để thực thi không
        if (data.script && data.action === 'run') {
          const { filename, content, type, description, prepare } = data.script;
          
          // Tạo đường dẫn file trong thư mục shell
          const filePath = path.join(config.SHELL_DIR, filename);
          
          // Kiểm tra các thư viện cần thiết nếu có lệnh prepare
          if (prepare) {
            // Phân tích tên các package từ lệnh prepare
            const packages = parsePackagesFromPrepare(prepare);
            
            // Kiểm tra từng package
            for (const pkg of packages) {
              const isInstalled = await checkPackageInstalled(pkg);
              
              if (!isInstalled) {
                // Nếu package chưa được cài đặt, hỏi người dùng có muốn cài đặt không
                rl.pause();
                
                console.log(`\nThư viện "${pkg}" chưa được cài đặt.`);
                
                // Sử dụng một phương pháp đơn giản để đọc input
                let shouldInstall = false;
                
                // Sử dụng child_process.spawnSync để tạo một process riêng biệt
                try {
                  const { spawnSync } = require('child_process');
                  process.stdout.write(`Bạn có muốn cài đặt thư viện "${pkg}" không? (y/n): `);
                  
                  // Sử dụng node để tạo một process con đọc một ký tự
                  const result = spawnSync('node', ['-e', `
                    process.stdin.setEncoding('utf8');
                    process.stdin.on('data', (data) => {
                      const char = data.toString().trim().toLowerCase().charAt(0);
                      process.stdout.write(char + '\n');
                      process.exit(char === 'y' ? 0 : 1);
                    });
                  `], { stdio: 'inherit' });
                  
                  // Kiểm tra kết quả
                  shouldInstall = result.status === 0;
                } catch (error) {
                  console.error('Lỗi khi đọc input:', error.message);
                  
                  // Fallback: sử dụng readline thông thường
                  const tempRl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                  });
                  
                  shouldInstall = await new Promise(resolve => {
                    tempRl.question(`Bạn có muốn cài đặt thư viện "${pkg}" không? (y/n): `, answer => {
                      tempRl.close();
                      resolve(answer.trim().toLowerCase().charAt(0) === 'y');
                    });
                  });
                }
                
                // Khôi phục readline chính
                rl.resume();
                
                // Thêm một khoảng trễ nhỏ để đảm bảo readline được khôi phục hoàn toàn
                await new Promise(resolve => setTimeout(resolve, 500));
                
                if (shouldInstall) {
                  // Cài đặt package
                  try {
                    processingLog(`Đang cài đặt thư viện "${pkg}"...`);
                    const { execSync } = require('child_process');
                    debugLog(`Thực thi lệnh: npm install ${pkg}`, 2);
                    execSync(`npm install ${pkg}`, { stdio: 'inherit' });
                    successLog(`Đã cài đặt thư viện "${pkg}" thành công`);
                  } catch (error) {
                    errorLog(`Lỗi khi cài đặt thư viện "${pkg}": ${error.message}`);
                    debugLog(`Chi tiết lỗi: ${error.stack}`, 3);
                    infoLog('Tiếp tục mà không cài đặt thư viện.');
                  }
                } else {
                  infoLog(`Bạn đã từ chối cài đặt thư viện "${pkg}".`);
                  infoLog('Tiếp tục mà không cài đặt thư viện. Script có thể không hoạt động đúng.');
                }
              }
            }
          }
          
          // Tạm dừng readline để hỏi người dùng
          rl.pause();
          
          // Hỏi người dùng có muốn thực thi script không
          console.log(`\nAI đã tạo script ${filename}`);
          console.log(`Mô tả: ${description || 'Script được tạo bởi AI'}`);
          
          // Sử dụng một phương pháp đơn giản hơn để đọc input
          let shouldExecute = false;
          
          // Sử dụng child_process.spawnSync để tạo một process riêng biệt
          // Cách này sẽ không ảnh hưởng đến process chính
          try {
            const { spawnSync } = require('child_process');
            process.stdout.write('Bạn có muốn thực thi script này không? (y/n): ');
            
            // Sử dụng node để tạo một process con đọc một ký tự
            const result = spawnSync('node', ['-e', `
              process.stdin.setEncoding('utf8');
              process.stdin.on('data', (data) => {
                const char = data.toString().trim().toLowerCase().charAt(0);
                process.stdout.write(char + '\n');
                process.exit(char === 'y' ? 0 : 1);
              });
            `], { stdio: 'inherit' });
            
            // Kiểm tra kết quả
            shouldExecute = result.status === 0;
          } catch (error) {
            console.error('Lỗi khi đọc input:', error.message);
            
            // Fallback: sử dụng readline thông thường
            const tempRl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });
            
            shouldExecute = await new Promise(resolve => {
              tempRl.question('Bạn có muốn thực thi script này không? (y/n): ', answer => {
                tempRl.close();
                resolve(answer.trim().toLowerCase().charAt(0) === 'y');
              });
            });
          }
          
          // Khôi phục readline chính
          rl.resume();
          
          // Thêm một khoảng trễ nhỏ để đảm bảo readline được khôi phục hoàn toàn
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (shouldExecute) {
            // Cài đặt các thư viện cần thiết nếu có
            if (prepare) {
              await installDependencies(prepare);
            }
            
            // Tạo file
            await createFile(filePath, content, type);
            
            // Thực thi file
            await executeFile(filePath, type, '', description);
            debugLog(`Đã thực thi file ${filePath}`, 1);
          }
        } else if (data.script && data.action === 'create') {
          // Xử lý action create
          const { filename, content, type, description } = data.script;
          
          // Tạm dừng readline để hỏi người dùng
          rl.pause();
          
          // Hỏi người dùng có muốn tạo file không
          console.log(`\nAI đã tạo nội dung cho file ${filename}`);
          console.log(`Mô tả: ${description || 'File được tạo bởi AI'}`);
          
          // Sử dụng một phương pháp đơn giản hơn để đọc input
          let shouldCreate = false;
          
          // Sử dụng child_process.spawnSync để tạo một process riêng biệt
          try {
            const { spawnSync } = require('child_process');
            process.stdout.write('Bạn có muốn tạo file này không? (y/n): ');
            
            // Sử dụng node để tạo một process con đọc một ký tự
            const result = spawnSync('node', ['-e', `
              process.stdin.setEncoding('utf8');
              process.stdin.on('data', (data) => {
                const char = data.toString().trim().toLowerCase().charAt(0);
                process.stdout.write(char + '\n');
                process.exit(char === 'y' ? 0 : 1);
              });
            `], { stdio: 'inherit' });
            
            // Kiểm tra kết quả
            shouldCreate = result.status === 0;
          } catch (error) {
            console.error('Lỗi khi đọc input:', error.message);
            
            // Fallback: sử dụng readline thông thường
            const tempRl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });
            
            shouldCreate = await new Promise(resolve => {
              tempRl.question('Bạn có muốn tạo file này không? (y/n): ', answer => {
                tempRl.close();
                resolve(answer.trim().toLowerCase().charAt(0) === 'y');
              });
            });
          }
          
          // Khôi phục readline chính
          rl.resume();
          
          // Thêm một khoảng trễ nhỏ để đảm bảo readline được khôi phục hoàn toàn
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (shouldCreate) {
            // Tạo file tại thư mục hiện tại
            try {
              await createFile(filename, content, type);
              successLog(`Đã tạo file ${filename}`);
              debugLog(`Nội dung file: ${content.substring(0, 100)}...`, 3);
              
              if (description) {
                infoLog(description);
              }
            } catch (error) {
              errorLog(`Lỗi khi tạo file: ${error.message}`);
              debugLog(`Chi tiết lỗi: ${error.stack}`, 2);
            }
          } else {
            infoLog('Bạn đã từ chối tạo file');
          }
        }
      } else {
        errorLog(`Lỗi: Không thể nhận phản hồi từ AI`);
      }
      
      askQuestion();
    });
  };
  
  askQuestion();
}

// Chế độ phát triển
async function devMode() {
  infoLog('Bắt đầu chế độ phát triển hệ thống (nhập "help" để xem hướng dẫn, "exit" để thoát)');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Khởi tạo lịch sử trò chuyện từ file
  let chatHistory = []; // await readChatHistory(true);
  
  if (config.DEBUG) {
    debugLog(`Đã tải ${chatHistory.length} tin nhắn từ lịch sử chat`, 2);
  }
  
  const askQuestion = () => {
    rl.question('dev> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        infoLog('Đã thoát chế độ phát triển');
        rl.close();
        return;
      }
      
      // Nếu người dùng chỉ nhập "help" thì hiển thị hướng dẫn sử dụng
      if (input.trim().toLowerCase() === 'help') {
        showUsage();
        askQuestion();
        return;
      }
      
      // Nếu người dùng nhập đúng từ "clear" thì xóa lịch sử chat
      if (input.trim().toLowerCase() === 'clear') {
        await clearChatHistory(true);
        chatHistory = [];
        infoLog('Đã xóa lịch sử chat.');
        askQuestion();
        return;
      }
      
      // Hiển thị thông báo đang xử lý
      processingLog('AI đang phản hồi...');
      
      // Thêm tin nhắn của người dùng vào lịch sử
      chatHistory = addMessage('user', input, chatHistory);
      
      if (config.DEBUG) {
        debugLog(`Đã thêm tin nhắn người dùng vào lịch sử, tổng số tin nhắn: ${chatHistory.length}`, 2);
      }
      
      // Gửi yêu cầu và lấy phản hồi
      const response = await handleChat(input, config, true, chatHistory);
      
      // Xóa dòng "AI đang phản hồi..."
      process.stdout.write('\x1b[1A\x1b[2K');
      
      if (config.DEBUG) {
        debugLog(`Phản hồi đầy đủ: ${JSON.stringify(response)}`, 2);
      }
      
      // Xử lý phản hồi theo định dạng mới
      if (response) {
        // Định dạng mới trả về trực tiếp từ API
        const data = response.hasOwnProperty('data') ? response.data : response;
        
        // Nếu API trả về history, cập nhật lịch sử chat
        if (response.history && Array.isArray(response.history)) {
          chatHistory = response.history;
          if (config.DEBUG) {
            debugLog(`Cập nhật lịch sử chat từ API, tổng số tin nhắn: ${chatHistory.length}`, 2);
          }
          // Lưu lịch sử chat ngay lập tức
          await saveChatHistory(chatHistory, true);
        }
        
        // Hiển thị message nếu có
        if (data.message) {
          console.log(`\n${data.message}\n`);
          
          // Chỉ thêm phản hồi vào lịch sử nếu API không trả về history
          if (!response.history) {
            // Thêm phản hồi của AI vào lịch sử
            chatHistory = addMessage('assistant', data.message, chatHistory);
            
            // Lưu lịch sử chat
            await saveChatHistory(chatHistory, true);
            
            if (config.DEBUG) {
              debugLog(`Đã thêm phản hồi AI vào lịch sử và lưu, tổng số tin nhắn: ${chatHistory.length}`, 2);
            }
          }
        } else if (data.script && !data.message) {
          // Nếu không có message nhưng có script, hiển thị một thông báo chung
          const scriptMessage = 'AI đã tạo một script để giải quyết yêu cầu của bạn.';
          console.log(`\n${scriptMessage}\n`);
          
          // Chỉ thêm phản hồi vào lịch sử nếu API không trả về history
          if (!response.history) {
            // Thêm phản hồi của AI vào lịch sử với thông báo chung
            chatHistory = addMessage('assistant', scriptMessage, chatHistory);
            
            // Lưu lịch sử chat
            await saveChatHistory(chatHistory, true);
            
            if (config.DEBUG) {
              debugLog(`Đã thêm thông báo script vào lịch sử và lưu, tổng số tin nhắn: ${chatHistory.length}`, 2);
            }
          }
        }
        
        // Kiểm tra xem có script để thực thi không
        if (data.script && data.action === 'run') {
          const { filename, content, type, description, prepare } = data.script;
          
          // Tạo đường dẫn file trong thư mục shell
          const filePath = path.join(config.SHELL_DIR, filename);
          
          // Kiểm tra các thư viện cần thiết nếu có lệnh prepare
          if (prepare) {
            // Phân tích tên các package từ lệnh prepare
            const packages = parsePackagesFromPrepare(prepare);
            
            // Kiểm tra từng package
            for (const pkg of packages) {
              const isInstalled = await checkPackageInstalled(pkg);
              
              if (!isInstalled) {
                // Nếu package chưa được cài đặt, hỏi người dùng có muốn cài đặt không
                rl.pause();
                
                console.log(`\nThư viện "${pkg}" chưa được cài đặt.`);
                
                // Sử dụng một phương pháp đơn giản để đọc input
                let shouldInstall = false;
                
                // Sử dụng child_process.spawnSync để tạo một process riêng biệt
                try {
                  const { spawnSync } = require('child_process');
                  process.stdout.write(`Bạn có muốn cài đặt thư viện "${pkg}" không? (y/n): `);
                  
                  // Sử dụng node để tạo một process con đọc một ký tự
                  const result = spawnSync('node', ['-e', `
                    process.stdin.setEncoding('utf8');
                    process.stdin.on('data', (data) => {
                      const char = data.toString().trim().toLowerCase().charAt(0);
                      process.stdout.write(char + '\n');
                      process.exit(char === 'y' ? 0 : 1);
                    });
                  `], { stdio: 'inherit' });
                  
                  // Kiểm tra kết quả
                  shouldInstall = result.status === 0;
                } catch (error) {
                  console.error('Lỗi khi đọc input:', error.message);
                  
                  // Fallback: sử dụng readline thông thường
                  const tempRl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                  });
                  
                  shouldInstall = await new Promise(resolve => {
                    tempRl.question(`Bạn có muốn cài đặt thư viện "${pkg}" không? (y/n): `, answer => {
                      tempRl.close();
                      resolve(answer.trim().toLowerCase().charAt(0) === 'y');
                    });
                  });
                }
                
                // Khôi phục readline chính
                rl.resume();
                
                // Thêm một khoảng trễ nhỏ để đảm bảo readline được khôi phục hoàn toàn
                await new Promise(resolve => setTimeout(resolve, 500));
                
                if (shouldInstall) {
                  // Cài đặt package
                  try {
                    processingLog(`Đang cài đặt thư viện "${pkg}"...`);
                    const { execSync } = require('child_process');
                    debugLog(`Thực thi lệnh: npm install ${pkg}`, 2);
                    execSync(`npm install ${pkg}`, { stdio: 'inherit' });
                    successLog(`Đã cài đặt thư viện "${pkg}" thành công`);
                  } catch (error) {
                    errorLog(`Lỗi khi cài đặt thư viện "${pkg}": ${error.message}`);
                    debugLog(`Chi tiết lỗi: ${error.stack}`, 3);
                    infoLog('Tiếp tục mà không cài đặt thư viện.');
                  }
                } else {
                  infoLog(`Bạn đã từ chối cài đặt thư viện "${pkg}".`);
                  infoLog('Tiếp tục mà không cài đặt thư viện. Script có thể không hoạt động đúng.');
                }
              }
            }
          }
          
          // Tạm dừng readline để hỏi người dùng
          rl.pause();
          
          // Hỏi người dùng có muốn thực thi script không
          console.log(`\nAI đã tạo script ${filename}`);
          console.log(`Mô tả: ${description || 'Script được tạo bởi AI'}`);
          
          // Sử dụng một phương pháp đơn giản hơn để đọc input
          let shouldExecute = false;
          
          // Sử dụng child_process.spawnSync để tạo một process riêng biệt
          // Cách này sẽ không ảnh hưởng đến process chính
          try {
            const { spawnSync } = require('child_process');
            process.stdout.write('Bạn có muốn thực thi script này không? (y/n): ');
            
            // Sử dụng node để tạo một process con đọc một ký tự
            const result = spawnSync('node', ['-e', `
              process.stdin.setEncoding('utf8');
              process.stdin.on('data', (data) => {
                const char = data.toString().trim().toLowerCase().charAt(0);
                process.stdout.write(char + '\n');
                process.exit(char === 'y' ? 0 : 1);
              });
            `], { stdio: 'inherit' });
            
            // Kiểm tra kết quả
            shouldExecute = result.status === 0;
          } catch (error) {
            console.error('Lỗi khi đọc input:', error.message);
            
            // Fallback: sử dụng readline thông thường
            const tempRl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });
            
            shouldExecute = await new Promise(resolve => {
              tempRl.question('Bạn có muốn thực thi script này không? (y/n): ', answer => {
                tempRl.close();
                resolve(answer.trim().toLowerCase().charAt(0) === 'y');
              });
            });
          }
          
          // Khôi phục readline chính
          rl.resume();
          
          // Thêm một khoảng trễ nhỏ để đảm bảo readline được khôi phục hoàn toàn
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (shouldExecute) {
            // Cài đặt các thư viện cần thiết nếu có
            if (prepare) {
              await installDependencies(prepare);
            }
            
            // Tạo file
            await createFile(filePath, content, type);
            
            // Thực thi file
            await executeFile(filePath, type, '', description);
            debugLog(`Đã thực thi file ${filePath}`, 1);
          }
        } else if (data.script && data.action === 'create') {
          // Xử lý action create
          const { filename, content, type, description } = data.script;
          
          // Tạm dừng readline để hỏi người dùng
          rl.pause();
          
          // Hỏi người dùng có muốn tạo file không
          console.log(`\nAI đã tạo nội dung cho file ${filename}`);
          console.log(`Mô tả: ${description || 'File được tạo bởi AI'}`);
          
          // Sử dụng một phương pháp đơn giản hơn để đọc input
          let shouldCreate = false;
          
          // Sử dụng child_process.spawnSync để tạo một process riêng biệt
          try {
            const { spawnSync } = require('child_process');
            process.stdout.write('Bạn có muốn tạo file này không? (y/n): ');
            
            // Sử dụng node để tạo một process con đọc một ký tự
            const result = spawnSync('node', ['-e', `
              process.stdin.setEncoding('utf8');
              process.stdin.on('data', (data) => {
                const char = data.toString().trim().toLowerCase().charAt(0);
                process.stdout.write(char + '\n');
                process.exit(char === 'y' ? 0 : 1);
              });
            `], { stdio: 'inherit' });
            
            // Kiểm tra kết quả
            shouldCreate = result.status === 0;
          } catch (error) {
            console.error('Lỗi khi đọc input:', error.message);
            
            // Fallback: sử dụng readline thông thường
            const tempRl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });
            
            shouldCreate = await new Promise(resolve => {
              tempRl.question('Bạn có muốn tạo file này không? (y/n): ', answer => {
                tempRl.close();
                resolve(answer.trim().toLowerCase().charAt(0) === 'y');
              });
            });
          }
          
          // Khôi phục readline chính
          rl.resume();
          
          // Thêm một khoảng trễ nhỏ để đảm bảo readline được khôi phục hoàn toàn
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (shouldCreate) {
            // Tạo file tại thư mục hiện tại
            try {
              await createFile(filename, content, type);
              successLog(`Đã tạo file ${filename}`);
              debugLog(`Nội dung file: ${content.substring(0, 100)}...`, 3);
              
              if (description) {
                infoLog(description);
              }
            } catch (error) {
              errorLog(`Lỗi khi tạo file: ${error.message}`);
              debugLog(`Chi tiết lỗi: ${error.stack}`, 2);
            }
          } else {
            infoLog('Bạn đã từ chối tạo file');
          }
        }
      } else {
        errorLog(`Lỗi: Không thể nhận phản hồi từ AI`);
      }
      
      askQuestion();
    });
  };
  
  askQuestion();
}

// Hàm lưu cấu hình
async function saveConfig(configData) {
  try {
    const configPath = path.join(os.homedir(), '.shellai_config.json');
    await fs.promises.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf8');
    return true;
  } catch (error) {
    errorLog(`Không thể lưu cấu hình: ${error.message}`);
    return false;
  }
}

// Hàm đọc cấu hình
async function loadConfig() {
  try {
    // Đầu tiên, thử đọc từ file .env nếu có
    let envConfig = {};
    try {
      const envFile = await fs.promises.readFile('.env', 'utf8');
      envFile.split('\n').forEach(line => {
        // Bỏ qua comment và dòng trống
        if (line.trim() && !line.startsWith('#')) {
          const parts = line.split('=');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            // Lấy phần còn lại của dòng (trong trường hợp giá trị chứa dấu =)
            const value = parts.slice(1).join('=').trim();
            // Xử lý giá trị trong dấu ngoặc kép
            const processedValue = value.startsWith('"') && value.endsWith('"')
              ? value.slice(1, -1)
              : value;
            
            envConfig[key] = processedValue;
          }
        }
      });
    } catch (envError) {
      // Không làm gì nếu không đọc được file .env
    }
    
    // Sau đó, đọc từ file cấu hình user
    const configPath = path.join(os.homedir(), '.shellai_config.json');
    let userConfig = {};
    
    try {
      const configData = await fs.promises.readFile(configPath, 'utf8');
      userConfig = JSON.parse(configData);
    } catch (configError) {
      // Không làm gì nếu không đọc được file cấu hình
    }
    
    // Kết hợp cả hai nguồn cấu hình, ưu tiên userConfig
    return {
      API_URL: userConfig.API_URL || envConfig.API_URL || 'http://localhost:3000/api/agent',
      SHELL_DIR: userConfig.SHELL_DIR || envConfig.SHELL_DIR || './src/shell',
      DEBUG: userConfig.DEBUG !== undefined ? userConfig.DEBUG : (envConfig.DEBUG === 'true' || false),
      DEBUG_LEVEL: userConfig.DEBUG_LEVEL !== undefined ? userConfig.DEBUG_LEVEL : (envConfig.DEBUG_LEVEL || 1),
      FIRST_REQUEST: true,
      OPENAI_API_KEY: userConfig.OPENAI_API_KEY || envConfig.OPENAI_API_KEY || '',
      API_KEY: userConfig.API_KEY || envConfig.API_KEY || '',
      MODEL: userConfig.MODEL || envConfig.MODEL || 'gpt-4',
      RETURN_TYPE: userConfig.RETURN_TYPE || envConfig.RETURN_TYPE || 'xml' // Mặc định 'xml' cho shellai.js
    };
  } catch (error) {
    // Nếu có lỗi, trả về cấu hình mặc định
    return {
      API_URL: 'http://localhost:3000/api/agent',
      SHELL_DIR: './src/shell',
      DEBUG: false,
      DEBUG_LEVEL: 1,
      FIRST_REQUEST: true,
      OPENAI_API_KEY: '',
      API_KEY: '',
      MODEL: 'gpt-4',
      RETURN_TYPE: 'xml' // Mặc định 'xml' cho shellai.js
    };
  }
}

// Chế độ cấu hình
async function configMode() {
  infoLog('Chế độ cấu hình (nhập "exit" để thoát)');
  
  // Đọc cấu hình hiện tại
  let currentConfig = await loadConfig();
  
  console.log('\nCấu hình hiện tại:');
  console.log(JSON.stringify(currentConfig, null, 2));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Hàm chỉnh sửa từng mục cấu hình
  const editConfigInteractive = async () => {
    // Danh sách các mục cấu hình
    const configItems = [
      {
        key: 'API_URL',
        description: 'URL của API server',
        default: 'http://localhost:3000/api/agent',
        validate: (value) => value.startsWith('http://') || value.startsWith('https://')
      },
      {
        key: 'SHELL_DIR',
        description: 'Thư mục chứa các script',
        default: './src/shell',
        validate: (value) => true
      },
      {
        key: 'DEBUG',
        description: 'Chế độ debug (true/false)',
        default: false,
        validate: (value) => value === 'true' || value === 'false'
      },
      {
        key: 'DEBUG_LEVEL',
        description: 'Cấp độ chi tiết của debug',
        default: 1,
        validate: (value) => value >= 1 && value <= 3
      },
      {
        key: 'OPENAI_API_KEY',
        description: 'OpenAI API Key',
        default: '',
        validate: (value) => true
      },
      {
        key: 'API_KEY',
        description: 'API Key',
        default: '',
        validate: (value) => true
      },
      {
        key: 'MODEL',
        description: 'Model AI sử dụng (gpt-4, gpt-3.5-turbo, ...)',
        default: 'gpt-4',
        validate: (value) => true
      },
      {
        key: 'RETURN_TYPE',
        description: 'Định dạng phản hồi (json, xml)',
        default: 'xml',
        validate: (value) => value === 'json' || value === 'xml'
      }
    ];
    
    for (const item of configItems) {
      const currentValue = currentConfig[item.key] !== undefined ? currentConfig[item.key] : item.default;
      
      // Hiển thị giá trị ẩn cho API keys
      let displayValue = currentValue;
      if (item.key === 'OPENAI_API_KEY' || item.key === 'API_KEY') {
        displayValue = currentValue ? `${currentValue.substring(0, 5)}...` : '';
      }
      
      const answer = await new Promise((resolve) => {
        rl.question(`${item.description} [${displayValue}]: `, (input) => {
          resolve(input);
        });
      });
      
      // Nếu người dùng không nhập gì, giữ nguyên giá trị hiện tại
      if (answer.trim() === '') {
        continue;
      }
      
      // Kiểm tra giá trị hợp lệ
      if (!item.validate(answer)) {
        errorLog(`Giá trị không hợp lệ cho ${item.key}`);
        continue;
      }
      
      // Xử lý giá trị đặc biệt
      if (item.key === 'DEBUG') {
        currentConfig[item.key] = answer.toLowerCase() === 'true';
      } else if (item.key === 'DEBUG_LEVEL') {
        currentConfig[item.key] = parseInt(answer, 10);
      } else {
        currentConfig[item.key] = answer;
      }
      
      // Cập nhật cấu hình hiện tại
      if (item.key === 'API_URL') config.API_URL = currentConfig[item.key];
      if (item.key === 'SHELL_DIR') config.SHELL_DIR = currentConfig[item.key];
      if (item.key === 'DEBUG') config.DEBUG = currentConfig[item.key];
      if (item.key === 'DEBUG_LEVEL') config.DEBUG_LEVEL = currentConfig[item.key];
      if (item.key === 'OPENAI_API_KEY') config.OPENAI_API_KEY = currentConfig[item.key];
      if (item.key === 'API_KEY') config.API_KEY = currentConfig[item.key];
      if (item.key === 'MODEL') config.MODEL = currentConfig[item.key];
      if (item.key === 'RETURN_TYPE') config.RETURN_TYPE = currentConfig[item.key];
    }
    
    // Lưu cấu hình
    const saved = await saveConfig(currentConfig);
    if (saved) {
      successLog('Đã cập nhật cấu hình thành công');
    }
  };
  
  const askQuestion = () => {
    rl.question('\nNhập lệnh cấu hình (set <key> <value>, edit, show, help, exit): ', async (input) => {
      const command = input.trim().toLowerCase();
      
      if (command === 'exit') {
        infoLog('Đã thoát chế độ cấu hình');
        rl.close();
        return;
      }
      
      if (command === 'help') {
        console.log(`
Các lệnh cấu hình:
  edit               - Chỉnh sửa cấu hình theo kiểu tương tác
  set <key> <value>  - Đặt giá trị cho khóa cấu hình
  show               - Hiển thị cấu hình hiện tại
  help               - Hiển thị trợ giúp
  exit               - Thoát chế độ cấu hình

Các khóa cấu hình:
  API_URL            - URL của API server (mặc định: http://localhost:3000/api/agent)
  SHELL_DIR          - Thư mục chứa các script (mặc định: ./src/shell)
  DEBUG              - Chế độ debug (true/false)
  DEBUG_LEVEL        - Cấp độ chi tiết của debug
  OPENAI_API_KEY     - OpenAI API Key
  API_KEY            - API Key
  MODEL              - Model AI sử dụng (gpt-4, gpt-3.5-turbo, ...)
  RETURN_TYPE        - Định dạng phản hồi (json, xml)
        `);
        askQuestion();
        return;
      }
      
      if (command === 'show') {
        console.log('\nCấu hình hiện tại:');
        console.log(JSON.stringify(currentConfig, null, 2));
        askQuestion();
        return;
      }
      
      if (command === 'edit') {
        await editConfigInteractive();
        askQuestion();
        return;
      }
      
      if (command.startsWith('set ')) {
        const parts = input.trim().split(' ');
        if (parts.length < 3) {
          errorLog('Cú pháp không đúng. Sử dụng: set <key> <value>');
          askQuestion();
          return;
        }
        
        const key = parts[1].toUpperCase();
        const value = parts.slice(2).join(' ');
        
        // Xử lý giá trị đặc biệt
        if (key === 'DEBUG') {
          currentConfig[key] = value.toLowerCase() === 'true';
        } else if (key === 'DEBUG_LEVEL') {
          currentConfig[key] = parseInt(value, 10);
        } else {
          currentConfig[key] = value;
        }
        
        // Lưu cấu hình
        const saved = await saveConfig(currentConfig);
        if (saved) {
          successLog(`Đã cập nhật ${key}=${value}`);
          
          // Cập nhật cấu hình hiện tại
          if (key === 'API_URL') config.API_URL = value;
          if (key === 'SHELL_DIR') config.SHELL_DIR = value;
          if (key === 'DEBUG') config.DEBUG = value.toLowerCase() === 'true';
          if (key === 'DEBUG_LEVEL') config.DEBUG_LEVEL = value;
          if (key === 'OPENAI_API_KEY') config.OPENAI_API_KEY = value;
          if (key === 'API_KEY') config.API_KEY = value;
          if (key === 'MODEL') config.MODEL = value;
          if (key === 'RETURN_TYPE') config.RETURN_TYPE = value;
        }
        
        askQuestion();
        return;
      }
      
      errorLog(`Lệnh không hợp lệ: ${input}`);
      askQuestion();
    });
  };
  
  askQuestion();
}

// Hàm chính
async function main() {
  const args = parseArgs();
  
  // Đọc cấu hình từ file
  const savedConfig = await loadConfig();
  
  // Cập nhật cấu hình từ file
  if (savedConfig.API_URL) config.API_URL = savedConfig.API_URL;
  if (savedConfig.SHELL_DIR) config.SHELL_DIR = savedConfig.SHELL_DIR;
  if (savedConfig.DEBUG !== undefined) config.DEBUG = savedConfig.DEBUG;
  if (savedConfig.DEBUG_LEVEL !== undefined) config.DEBUG_LEVEL = savedConfig.DEBUG_LEVEL;
  if (savedConfig.OPENAI_API_KEY) config.OPENAI_API_KEY = savedConfig.OPENAI_API_KEY;
  if (savedConfig.API_KEY) config.API_KEY = savedConfig.API_KEY;
  if (savedConfig.MODEL) config.MODEL = savedConfig.MODEL;
  
  // Cập nhật cấu hình từ tham số dòng lệnh
  if (args.debug) {
    config.DEBUG = true;
    if (args.debugLevel) {
      config.DEBUG_LEVEL = args.debugLevel;
    }
  }
  
  if (config.DEBUG) {
    debugLog(`Chế độ debug được bật (cấp độ: ${config.DEBUG_LEVEL})`);
  }
  
  // Kiểm tra curl đã được cài đặt chưa
  checkCurl();
  
  // Xử lý các lệnh
  try {
    // Nếu không có lệnh và tham số, không có option -h/--help thì tự động vào dev mode
    if (!args.command && !args.message) {
      infoLog('Không có lệnh được cung cấp. Tự động vào chế độ phát triển.');
      await devMode();
      return 0;
    }
    
    switch (args.command) {
      case 'install':
        if (args.params.length === 0) {
          errorLog('Thiếu tên gói cần cài đặt');
          showUsage();
          process.exit(1);
        }
        
        // Tạo chuỗi các gói cần cài đặt
        const packages = args.params.join(' ');
        
        // Tạo yêu cầu
        const installIssue = args.message 
          ? `Cài đặt các gói: ${packages}. Mô tả: ${args.message}`
          : `Cài đặt các gói: ${packages}`;
        
        // Gửi yêu cầu và xử lý phản hồi
        const installResponse = await processRequest(installIssue, 'run', 'sh', '', config);
        await autoSolve(installResponse, args);
        break;
        
      case 'check':
        if (args.params.length === 0) {
          errorLog('Thiếu tên dịch vụ cần kiểm tra');
          showUsage();
          process.exit(1);
        }
        
        // Tạo chuỗi các dịch vụ cần kiểm tra
        const services = args.params.join(' ');
        
        // Tạo yêu cầu
        const checkIssue = args.message
          ? `Kiểm tra trạng thái các dịch vụ: ${services}. Mô tả: ${args.message}`
          : `Kiểm tra trạng thái các dịch vụ: ${services}`;
        
        // Gửi yêu cầu và xử lý phản hồi
        const checkResponse = await processRequest(checkIssue, 'run', 'sh', '', config);
        await autoSolve(checkResponse, args);
        break;
        
      case 'create':
        if (args.params.length < 2) {
          errorLog('Thiếu tên file và nội dung');
          showUsage();
          process.exit(1);
        }
        
        const filename = args.params[0];
        const content = args.params.slice(1).join(' ');
        
        // Tạo yêu cầu
        const createIssue = args.message
          ? `Tạo file: ${filename}. Nội dung: ${content}. Mô tả: ${args.message}`
          : `Tạo file: ${filename}. Nội dung: ${content}`;
        
        // Gửi yêu cầu và xử lý phản hồi
        const createResponse = await processRequest(createIssue, 'run', 'sh', '', config);
        await autoSolve(createResponse, args);
        break;
        
      case 'chat':
        await chatMode();
        break;
        
      case 'dev':
        await devMode();
        break;
        
      case 'config':
        await configMode();
        break;
        
      default:
        errorLog(`Lệnh không hợp lệ: ${args.command}`);
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    errorLog(`Lỗi khi xử lý lệnh: ${error.message}`);
    process.exit(1);
  }
}

main();