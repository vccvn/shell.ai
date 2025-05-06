const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const config = require('../config');

const execPromise = util.promisify(exec);

/**
 * Tạo file từ thông tin và nội dung
 * @param {object} fileInfo - Thông tin file cần tạo
 * @returns {Promise<string>} - Đường dẫn đến file đã tạo
 */
async function createFile(fileInfo) {
  try {
    const { filename, content, type } = fileInfo;
    const filePath = path.join(config.shellDir, filename);
    
    // Đảm bảo thư mục tồn tại
    await fs.ensureDir(path.dirname(filePath));
    
    // Ghi nội dung vào file
    await fs.writeFile(filePath, content);
    
    // Nếu là shell script, đặt quyền thực thi
    if (type === 'sh') {
      await fs.chmod(filePath, '755');
    }
    
    console.log(`Đã tạo file: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Lỗi khi tạo file:', error);
    throw new Error(`Lỗi tạo file: ${error.message}`);
  }
}

/**
 * Thực thi file script với các tham số
 * @param {string} filePath - Đường dẫn đến file cần thực thi
 * @param {Array<string>} args - Các tham số truyền vào script
 * @returns {Promise<object>} - Kết quả thực thi
 */
async function executeFile(filePath, args = []) {
  try {
    const fileType = path.extname(filePath).replace('.', '');
    let command;
    
    switch (fileType) {
      case 'sh':
        command = `bash "${filePath}" ${args.join(' ')}`;
        break;
      case 'js':
        command = `node "${filePath}" ${args.join(' ')}`;
        break;
      case 'py':
        command = `python3 "${filePath}" ${args.join(' ')}`;
        break;
      default:
        command = `"${filePath}" ${args.join(' ')}`;
    }
    
    console.log(`Thực thi lệnh: ${command}`);
    const { stdout, stderr } = await execPromise(command);
    
    return {
      success: !stderr,
      output: stdout,
      error: stderr
    };
  } catch (error) {
    console.error('Lỗi khi thực thi file:', error);
    return {
      success: false,
      output: '',
      error: error.message
    };
  }
}

/**
 * Xóa file tạm thời sau khi thực thi xong
 * @param {string} filePath - Đường dẫn đến file cần xóa
 */
async function cleanupFile(filePath) {
  try {
    await fs.remove(filePath);
    console.log(`Đã xóa file: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Lỗi khi xóa file:', error);
    return false;
  }
}

module.exports = {
  createFile,
  executeFile,
  cleanupFile
}; 