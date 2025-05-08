#!/usr/bin/env node

/**
 * shellai.js - Script chính để tương tác với Shell.AI
 * Thay thế cho shellai.sh, xử lý tham số dòng lệnh và gọi các hàm từ các module khác
 */

const { 
  processRequest, 
  handleChat, 
  createFile, 
  executeFile, 
  installDependencies,
  getSystemInfo,
  fixScriptError
} = require('./src/utils/shellai_functions');

const {
  readChatHistory,
  saveChatHistory,
  addMessage,
  clearChatHistory
} = require('./src/utils/chatHistory');

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');
const os = require('os');

// Biến môi trường
const config = {
  API_URL: process.env.API_URL || 'http://localhost:3000/api/agent',
  SHELL_DIR: process.env.SHELL_DIR || './src/shell',
  DEBUG: process.env.DEBUG === 'true' || false,
  FIRST_REQUEST: true
};

// Tạo thư mục shell nếu chưa tồn tại
if (!fs.existsSync(config.SHELL_DIR)) {
  fs.mkdirSync(config.SHELL_DIR, { recursive: true });
}

// Hàm hiển thị hướng dẫn sử dụng
function showUsage() {
  console.log(`Cách sử dụng: ${path.basename(process.argv[1])} [lệnh] [tham số] [-m "mô tả"] [--debug]

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
  --debug                      Hiển thị thông tin debug
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
    debug: config.DEBUG
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

// Hàm debug log
function debugLog(message) {
  if (config.DEBUG) {
    console.error(`[DEBUG] ${message}`);
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

// Kiểm tra curl đã được cài đặt chưa
function checkCurl() {
  try {
    execSync('curl --version', { stdio: 'ignore' });
  } catch (error) {
    errorLog('curl chưa được cài đặt. Đang cài đặt...');
    try {
      if (process.platform === 'darwin') {
        execSync('brew install curl', { stdio: 'inherit' });
      } else if (process.platform === 'linux') {
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
        errorLog('Không thể cài đặt curl tự động trên hệ điều hành này. Vui lòng cài đặt thủ công.');
        process.exit(1);
      }
    } catch (installError) {
      errorLog(`Không thể cài đặt curl: ${installError.message}`);
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
    rl.question(`File ${filePath} có lỗi: ${errorMessage}\nBạn có muốn gửi thông tin lỗi đến AI để sửa không? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// Hàm kiểm tra xem thư viện đã được cài đặt chưa
async function checkPackageInstalled(packageName) {
  // Danh sách các thư viện có sẵn trong Node.js
  const builtInModules = [
    'child_process', 'fs', 'path', 'http', 'https', 'url', 'net', 'util', 
    'os', 'crypto', 'events', 'stream', 'readline', 'buffer', 'querystring',
    'zlib', 'cluster', 'dgram', 'dns', 'module', 'process', 'timers',
    'tls', 'console', 'assert', 'tty', 'v8', 'vm'
  ];
  
  // Nếu là thư viện có sẵn, coi như đã cài đặt
  if (builtInModules.includes(packageName)) {
    debugLog(`"${packageName}" là thư viện có sẵn trong Node.js, không cần cài đặt.`);
    return true;
  }
  
  try {
    // Kiểm tra xem có thể require module không
    require.resolve(packageName);
    return true;
  } catch (e) {
    // Nếu không thể require, thử kiểm tra bằng npm list
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(`npm list ${packageName} --depth=0`, (error, stdout, stderr) => {
          if (error) {
            // Lỗi khi chạy npm list, có thể là thư viện chưa được cài đặt
            resolve(false);
          } else if (stdout.includes('(empty)') || stdout.includes('UNMET DEPENDENCY')) {
            // npm list trả về empty hoặc UNMET DEPENDENCY
            resolve(false);
          } else {
            // Thư viện đã được cài đặt
            resolve(true);
          }
        });
      });
    } catch (error) {
      return false;
    }
  }
}

// Hàm phân tích câu lệnh prepare để lấy tên các package
function parsePackagesFromPrepare(prepareCommand) {
  const packages = [];
  
  // Phân tích lệnh npm install/i
  const npmInstallRegex = /npm\s+(?:i|install|add)\s+((?:@[\w-]+\/)?[\w-]+(?:@[\w.-]+)?(?:\s+(?:@[\w-]+\/)?[\w-]+(?:@[\w.-]+)?)*)/g;
  
  // Phân tích lệnh yarn add
  const yarnAddRegex = /yarn\s+(?:add)\s+((?:@[\w-]+\/)?[\w-]+(?:@[\w.-]+)?(?:\s+(?:@[\w-]+\/)?[\w-]+(?:@[\w.-]+)?)*)/g;
  
  // Phân tích lệnh pnpm add/install
  const pnpmInstallRegex = /pnpm\s+(?:add|install|i)\s+((?:@[\w-]+\/)?[\w-]+(?:@[\w.-]+)?(?:\s+(?:@[\w-]+\/)?[\w-]+(?:@[\w.-]+)?)*)/g;
  
  // Tìm trong lệnh npm
  let match;
  while ((match = npmInstallRegex.exec(prepareCommand)) !== null) {
    const packageList = match[1].split(/\s+/);
    packageList.forEach(pkg => {
      // Loại bỏ phiên bản nếu có
      const pkgName = pkg.split('@')[0] || pkg;
      if (pkgName && !packages.includes(pkgName)) {
        packages.push(pkgName);
      }
    });
  }
  
  // Tìm trong lệnh yarn
  while ((match = yarnAddRegex.exec(prepareCommand)) !== null) {
    const packageList = match[1].split(/\s+/);
    packageList.forEach(pkg => {
      // Loại bỏ phiên bản nếu có
      const pkgName = pkg.split('@')[0] || pkg;
      if (pkgName && !packages.includes(pkgName)) {
        packages.push(pkgName);
      }
    });
  }
  
  // Tìm trong lệnh pnpm
  while ((match = pnpmInstallRegex.exec(prepareCommand)) !== null) {
    const packageList = match[1].split(/\s+/);
    packageList.forEach(pkg => {
      // Loại bỏ phiên bản nếu có
      const pkgName = pkg.split('@')[0] || pkg;
      if (pkgName && !packages.includes(pkgName)) {
        packages.push(pkgName);
      }
    });
  }
  
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

// Xử lý phản hồi từ API
async function processResponse(response, args) {
  try {
    // Kiểm tra xem phản hồi có phải là JSON hợp lệ không
    if (typeof response !== 'object') {
      errorLog('Phản hồi không phải là JSON hợp lệ');
      debugLog(`Phản hồi: ${response}`);
      return 1;
    }
    
    // Kiểm tra success nếu có
    if (response.hasOwnProperty('success') && !response.success) {
      errorLog(`API trả về lỗi: ${response.message || 'Lỗi không xác định'}`);
      return 1;
    }
    
    // Định dạng mới trả về trực tiếp từ API
    const data = response.hasOwnProperty('data') ? response.data : response;
    
    if (config.DEBUG) {
      debugLog(`Phản hồi đã xử lý: ${JSON.stringify(data)}`);
    }
    
    // Kiểm tra cấu trúc phản hồi
    if (data.action) {
      // Xử lý theo định dạng mới
      const { action, message, script } = data;
      
      // Hiển thị message nếu có
      if (message) {
        console.log(`\n${message}\n`);
      }
      
      // Xử lý script nếu có và action là 'run'
      if (script && action === 'run') {
        const { filename, content, type, description, prepare } = script;
        
        if (!filename || !content || !type) {
          errorLog('Thiếu thông tin để tạo và thực thi file');
          return 1;
        }
        
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
                    process.stdout.write(char + '\\n');
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
                  execSync(`npm install ${pkg}`, { stdio: 'inherit' });
                  successLog(`Đã cài đặt thư viện "${pkg}" thành công`);
                } catch (error) {
                  errorLog(`Lỗi khi cài đặt thư viện "${pkg}": ${error.message}`);
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
              process.stdout.write(char + '\\n');
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
          try {
            processingLog(`Đang thực thi script ${filename}...`);
            // Gọi executeFile với tham số description là null để không hiển thị mô tả
            const exitCode = await executeFile(filePath, type, '', null);
            
            // Xóa file script sau khi thực thi xong
            try {
              await fs.promises.unlink(filePath);
              debugLog(`Đã xóa file script ${filePath}`);
            } catch (unlinkError) {
              errorLog(`Không thể xóa file script: ${unlinkError.message}`);
            }
            
            if (exitCode !== 0) {
              errorLog(`Thực thi file thất bại với mã lỗi ${exitCode}`);
            } else {
              successLog(`Thực thi script ${filename} thành công`);
            }
          } catch (error) {
            errorLog(`Lỗi khi thực thi file: ${error.message}`);
            
            // Xóa file script lỗi
            try {
              await fs.promises.unlink(filePath);
              debugLog(`Đã xóa file script lỗi ${filePath}`);
            } catch (unlinkError) {
              errorLog(`Không thể xóa file script lỗi: ${unlinkError.message}`);
            }
          }
        } else {
          infoLog('Bạn đã từ chối thực thi script');
        }
      } else if (script && action === 'create') {
        // Xử lý tạo file
        const { filename, content, type, description } = script;
        
        if (!filename || !content) {
          errorLog('Thiếu thông tin để tạo file');
          return 1;
        }
        
        // Tạo file tại vị trí hiện tại
        await createFile(filename, content, type);
        
        if (description) {
          infoLog(description);
        }
      } else if (action === 'input') {
        // Xử lý yêu cầu nhập liệu
        const { label = 'Nhập thông tin' } = data;
        
        console.log(`\n${message}\n`);
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const userInput = await new Promise((resolve) => {
          rl.question(`${label}: `, (answer) => {
            resolve(answer);
            rl.close();
          });
        });
        
        // Hiển thị thông báo đang xử lý
        processingLog('AI đang phản hồi...');
        
        // Gửi lại yêu cầu với thông tin bổ sung
        const newResponse = await processRequest(userInput, 'run', '', '', config);
        
        // Xóa dòng "AI đang phản hồi..."
        process.stdout.write('\x1b[1A\x1b[2K');
        
        await processResponse(newResponse, args);
      }
      
      return 0;
    } else {
      errorLog('Định dạng phản hồi không hợp lệ');
      debugLog(`Phản hồi: ${JSON.stringify(data)}`);
      return 1;
    }
  } catch (error) {
    errorLog(`Lỗi khi xử lý phản hồi: ${error.message}`);
    return 1;
  }
}

// Chế độ chat
async function chatMode() {
  infoLog('Bắt đầu chế độ chat (nhập \'exit\' để thoát)');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Khởi tạo lịch sử trò chuyện
  const chatHistory = [];
  
  const askQuestion = () => {
    rl.question('> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        infoLog('Đã thoát chế độ chat');
        rl.close();
        return;
      }
      
      // Hiển thị thông báo đang xử lý
      processingLog('AI đang phản hồi...');
      
      // Gửi yêu cầu và lấy phản hồi
      const response = await handleChat(input, config, false, chatHistory);
      
      // Xóa dòng "AI đang phản hồi..."
      process.stdout.write('\x1b[1A\x1b[2K');
      
      if (config.DEBUG) {
        debugLog(`Phản hồi đầy đủ: ${JSON.stringify(response)}`);
      }
      
      // Xử lý phản hồi theo định dạng mới
      if (response) {
        // Định dạng mới trả về trực tiếp từ API
        const data = response.hasOwnProperty('data') ? response.data : response;
        
        // Hiển thị message nếu có
        if (data.message) {
          console.log(`\n${data.message}\n`);
        } else if (data.script && !data.message) {
          // Nếu không có message nhưng có script, hiển thị một thông báo chung
          console.log('\nAI đã tạo một script để giải quyết yêu cầu của bạn.\n');
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
                      process.stdout.write(char + '\\n');
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
                    execSync(`npm install ${pkg}`, { stdio: 'inherit' });
                    successLog(`Đã cài đặt thư viện "${pkg}" thành công`);
                  } catch (error) {
                    errorLog(`Lỗi khi cài đặt thư viện "${pkg}": ${error.message}`);
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
                process.stdout.write(char + '\\n');
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
            try {
              const exitCode = await executeFile(filePath, type, '', description);
              
              // Xóa file script sau khi thực thi xong
              try {
                await fs.promises.unlink(filePath);
                debugLog(`Đã xóa file script ${filePath}`);
              } catch (unlinkError) {
                errorLog(`Không thể xóa file script: ${unlinkError.message}`);
              }
              
              if (exitCode !== 0) {
                errorLog(`Thực thi file thất bại với mã lỗi ${exitCode}`);
              }
            } catch (error) {
              errorLog(`Lỗi khi thực thi file: ${error.message}`);
              
              // Xóa file script lỗi
              try {
                await fs.promises.unlink(filePath);
                debugLog(`Đã xóa file script lỗi ${filePath}`);
              } catch (unlinkError) {
                errorLog(`Không thể xóa file script lỗi: ${unlinkError.message}`);
              }
            }
          } else {
            infoLog('Bạn đã từ chối thực thi script');
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
                process.stdout.write(char + '\\n');
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
              
              if (description) {
                infoLog(description);
              }
            } catch (error) {
              errorLog(`Lỗi khi tạo file: ${error.message}`);
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

// Chế độ dev
async function devMode() {
  infoLog('Bắt đầu chế độ phát triển hệ thống (nhập "help" để xem hướng dẫn, "exit" để thoát)');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Khởi tạo lịch sử trò chuyện
  const chatHistory = [];
  
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
      
      // Hiển thị thông báo đang xử lý
      processingLog('AI đang phản hồi...');
      
      // Gửi yêu cầu và lấy phản hồi
      const response = await handleChat(input, config, true, chatHistory);
      
      // Xóa dòng "AI đang phản hồi..."
      process.stdout.write('\x1b[1A\x1b[2K');
      
      if (config.DEBUG) {
        debugLog(`Phản hồi đầy đủ: ${JSON.stringify(response)}`);
      }
      
      // Xử lý phản hồi theo định dạng mới
      if (response) {
        // Định dạng mới trả về trực tiếp từ API
        const data = response.hasOwnProperty('data') ? response.data : response;
        
        // Hiển thị message nếu có
        if (data.message) {
          console.log(`\n${data.message}\n`);
        } else if (data.script && !data.message) {
          // Nếu không có message nhưng có script, hiển thị một thông báo chung
          console.log('\nAI đã tạo một script để giải quyết yêu cầu của bạn.\n');
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
                      process.stdout.write(char + '\\n');
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
                    execSync(`npm install ${pkg}`, { stdio: 'inherit' });
                    successLog(`Đã cài đặt thư viện "${pkg}" thành công`);
                  } catch (error) {
                    errorLog(`Lỗi khi cài đặt thư viện "${pkg}": ${error.message}`);
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
                process.stdout.write(char + '\\n');
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
            try {
              const exitCode = await executeFile(filePath, type, '', description);
              
              // Xóa file script sau khi thực thi xong
              try {
                await fs.promises.unlink(filePath);
                debugLog(`Đã xóa file script ${filePath}`);
              } catch (unlinkError) {
                errorLog(`Không thể xóa file script: ${unlinkError.message}`);
              }
              
              if (exitCode !== 0) {
                errorLog(`Thực thi file thất bại với mã lỗi ${exitCode}`);
              }
            } catch (error) {
              errorLog(`Lỗi khi thực thi file: ${error.message}`);
              
              // Xóa file script lỗi
              try {
                await fs.promises.unlink(filePath);
                debugLog(`Đã xóa file script lỗi ${filePath}`);
              } catch (unlinkError) {
                errorLog(`Không thể xóa file script lỗi: ${unlinkError.message}`);
              }
            }
          } else {
            infoLog('Bạn đã từ chối thực thi script');
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
                process.stdout.write(char + '\\n');
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
              
              if (description) {
                infoLog(description);
              }
            } catch (error) {
              errorLog(`Lỗi khi tạo file: ${error.message}`);
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
    const configPath = path.join(os.homedir(), '.shellai_config.json');
    const configData = await fs.promises.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // Nếu file không tồn tại hoặc có lỗi, trả về cấu hình mặc định
    return {
      API_URL: 'http://localhost:3000/api/agent',
      SHELL_DIR: './src/shell',
      DEBUG: false
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
      }
    ];
    
    for (const item of configItems) {
      const currentValue = currentConfig[item.key] !== undefined ? currentConfig[item.key] : item.default;
      
      const answer = await new Promise((resolve) => {
        rl.question(`${item.description} [${currentValue}]: `, (input) => {
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
      } else {
        currentConfig[item.key] = answer;
      }
      
      // Cập nhật cấu hình hiện tại
      if (item.key === 'API_URL') config.API_URL = currentConfig[item.key];
      if (item.key === 'SHELL_DIR') config.SHELL_DIR = currentConfig[item.key];
      if (item.key === 'DEBUG') config.DEBUG = currentConfig[item.key];
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
  
  // Cập nhật cấu hình từ tham số dòng lệnh
  if (args.debug) {
    config.DEBUG = true;
  }
  
  if (config.DEBUG) {
    debugLog('Chế độ debug được bật');
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
        await processResponse(installResponse, args);
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
        const checkResponse = await processRequest(checkIssue, 'run', 'js', '', config);
        await processResponse(checkResponse, args);
        break;
        
      case 'create':
        if (args.params.length < 2 || args.params[0] !== 'file') {
          errorLog('Cú pháp không đúng cho lệnh create');
          showUsage();
          process.exit(1);
        }
        
        const filename = args.params[1];
        
        // Tạo yêu cầu
        const createIssue = args.message
          ? `Tạo file ${filename}. Mô tả: ${args.message}`
          : `Tạo file ${filename}`;
        
        // Gửi yêu cầu và xử lý phản hồi
        const createResponse = await processRequest(createIssue, 'create', 'file', filename, config);
        await processResponse(createResponse, args);
        break;
        
      case 'chat':
        // Khởi tạo lịch sử trò chuyện
        const chatHistory = [];
        
        // Nếu có message, gửi ngay và hiển thị phản hồi
        if (args.message) {
          processingLog('AI đang phản hồi...');
          const chatResponse = await handleChat(args.message, config, false, chatHistory);
          process.stdout.write('\x1b[1A\x1b[2K'); // Xóa dòng "AI đang phản hồi..."
          
          if (config.DEBUG) {
            debugLog(`Phản hồi đầy đủ: ${JSON.stringify(chatResponse)}`);
          }
          
          if (chatResponse) {
            // Định dạng mới trả về trực tiếp từ API
            const data = chatResponse.hasOwnProperty('data') ? chatResponse.data : chatResponse;
            
            if (data.message) {
              console.log(`\n${data.message}\n`);
            } else {
              console.log(`\n${JSON.stringify(data)}\n`);
            }
          } else {
            errorLog(`Lỗi: Không thể nhận phản hồi từ AI`);
          }
        }
        
        // Bắt đầu chế độ chat
        await chatMode();
        break;
        
      case 'dev':
        // Bắt đầu chế độ dev
        await devMode();
        break;
        
      case 'config':
        // Bắt đầu chế độ cấu hình
        await configMode();
        break;
        
      case 'help':
        showUsage();
        process.exit(0);
        break;
        
      case '':
        if (!args.message) {
          errorLog('Thiếu lệnh hoặc thông điệp');
          showUsage();
          process.exit(1);
        }
        
        // Gửi yêu cầu và xử lý phản hồi
        const directResponse = await processRequest(args.message, 'run', '', '', config);
        await processResponse(directResponse, args);
        break;
        
      default:
        // Xử lý các lệnh tùy chỉnh
        const customCommand = `${args.command} ${args.params.join(' ')}`;
        
        const customIssue = args.message
          ? `${customCommand} : ${args.message}`
          : customCommand;
        
        // Gửi yêu cầu và xử lý phản hồi
        const customResponse = await processRequest(customIssue, 'run', '', '', config);
        await processResponse(customResponse, args);
        break;
    }
  } catch (error) {
    errorLog(`Lỗi: ${error.message}`);
    process.exit(1);
  }
}

// Chạy hàm chính
main().catch(error => {
  errorLog(`Lỗi không xử lý được: ${error.message}`);
  process.exit(1);
}); 