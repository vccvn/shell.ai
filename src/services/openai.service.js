const { OpenAI } = require('openai');
const config = require('../config');

// Khởi tạo OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Gửi prompt đến OpenAI API và nhận phản hồi
 * @param {string} prompt - Nội dung yêu cầu
 * @returns {Promise<object>} - Phản hồi từ OpenAI
 */
async function getCompletion(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Lỗi khi gọi OpenAI API:', error);
    throw new Error(`Lỗi OpenAI: ${error.message}`);
  }
}

/**
 * Phân tích phản hồi từ OpenAI để lấy thông tin về file script
 * @param {string} content - Nội dung phản hồi từ OpenAI
 * @returns {Array<object>} - Mảng các đối tượng file cần tạo
 */
function parseAIResponse(content) {
  try {
    // Chuyển đổi phản hồi text thành đối tượng JSON nếu cần
    // Nếu phản hồi đã là JSON, sử dụng trực tiếp
    if (typeof content === 'string') {
      try {
        return JSON.parse(content);
      } catch (e) {
        // Nếu không thể parse JSON, thử phân tích theo định dạng khác
        // Đây là logic mẫu, bạn có thể điều chỉnh theo format phản hồi thực tế
        const files = [];
        const fileRegex = /```([a-zA-Z0-9_.]+)\n([\s\S]*?)```/g;
        let match;
        
        while ((match = fileRegex.exec(content)) !== null) {
          const fileName = match[1];
          const fileContent = match[2];
          
          files.push({
            filename: fileName,
            content: fileContent,
            type: fileName.split('.').pop() || 'txt',
            args: [] // Cần phân tích tham số từ nội dung nếu có
          });
        }
        
        return files;
      }
    }
    return content;
  } catch (error) {
    console.error('Lỗi khi phân tích phản hồi:', error);
    throw new Error(`Lỗi phân tích: ${error.message}`);
  }
}

module.exports = {
  getCompletion,
  parseAIResponse
}; 