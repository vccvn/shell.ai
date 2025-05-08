/**
 * chatHistory.js - Module quản lý lịch sử trò chuyện
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Đường dẫn file lưu lịch sử chat
const CHAT_HISTORY_FILE = path.join(os.homedir(), '.shellai_chat_history.json');
const DEV_HISTORY_FILE = path.join(os.homedir(), '.shellai_dev_history.json');

// Số lượng tin nhắn tối đa để lưu trữ
const MAX_HISTORY_LENGTH = 20;

/**
 * Đọc lịch sử trò chuyện từ file
 * @param {boolean} isDev - Chế độ phát triển hay không
 * @returns {Array} Lịch sử trò chuyện
 */
async function readChatHistory(isDev = false) {
  try {
    const filePath = isDev ? DEV_HISTORY_FILE : CHAT_HISTORY_FILE;
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Nếu file không tồn tại hoặc có lỗi, trả về mảng rỗng
    return [];
  }
}

/**
 * Lưu lịch sử trò chuyện vào file
 * @param {Array} history - Lịch sử trò chuyện
 * @param {boolean} isDev - Chế độ phát triển hay không
 */
async function saveChatHistory(history, isDev = false) {
  try {
    const filePath = isDev ? DEV_HISTORY_FILE : CHAT_HISTORY_FILE;
    
    // Giới hạn số lượng tin nhắn
    const limitedHistory = history.slice(-MAX_HISTORY_LENGTH);
    
    await fs.writeFile(filePath, JSON.stringify(limitedHistory, null, 2), 'utf8');
  } catch (error) {
    console.error(`Lỗi khi lưu lịch sử chat: ${error.message}`);
  }
}

/**
 * Thêm tin nhắn vào lịch sử
 * @param {string} role - Vai trò (user hoặc assistant)
 * @param {string} content - Nội dung tin nhắn
 * @param {Array} history - Lịch sử trò chuyện
 * @returns {Array} Lịch sử trò chuyện đã cập nhật
 */
function addMessage(role, content, history = []) {
  history.push({ role, content });
  return history;
}

/**
 * Xóa lịch sử trò chuyện
 * @param {boolean} isDev - Chế độ phát triển hay không
 */
async function clearChatHistory(isDev = false) {
  try {
    const filePath = isDev ? DEV_HISTORY_FILE : CHAT_HISTORY_FILE;
    await fs.writeFile(filePath, '[]', 'utf8');
  } catch (error) {
    console.error(`Lỗi khi xóa lịch sử chat: ${error.message}`);
  }
}

module.exports = {
  readChatHistory,
  saveChatHistory,
  addMessage,
  clearChatHistory
}; 