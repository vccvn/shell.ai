const { OpenAI } = require('openai');
const config = require('../config');

/**
 * Tạo instance OpenAI với API key hiện tại
 * Lưu ý: API key có thể thay đổi trong quá trình xử lý request
 * @returns {OpenAI} instance OpenAI API
 */
function createOpenAIClient() {
  return new OpenAI({
    apiKey: config.openai.apiKey
  });
}

/**
 * Gửi prompt đến OpenAI API và nhận phản hồi
 * @param {string} prompt - Nội dung yêu cầu
 * @returns {Promise<object>} - Phản hồi từ OpenAI
 */
async function getCompletion(prompt) {
  try {
    // Tạo mới OpenAI client với API key hiện tại
    const openai = createOpenAIClient();
    
    // Kiểm tra nếu không có API key
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key không được cung cấp');
    }
    
    // Kiểm tra nếu prompt yêu cầu phản hồi JSON
    if (prompt.includes('dạng JSON') || prompt.includes('định dạng JSON')) {
      // Thêm hướng dẫn cụ thể về JSON vào cuối prompt
      prompt += `\n\nQUAN TRỌNG: Trả về JSON hợp lệ. KHÔNG sử dụng backticks (\`) trong phản hồi JSON. 
      Sử dụng dấu ngoặc kép (") cho các trường và giá trị chuỗi. 
      Nếu cần đặt dấu ngoặc kép trong chuỗi, hãy escape chúng bằng dấu gạch chéo ngược: \\".
      Đảm bảo nội dung script được đặt trong chuỗi JSON hợp lệ và không bị cắt ngắn.
      KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau đối tượng JSON.
      KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi.
      CHỈ trả về đối tượng JSON thuần túy.`;
    }

    console.log(`Sử dụng model: ${config.openai.model}`);
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    let content = response.choices[0].message.content;
    
    // Xử lý các ký tự escape trong phản hồi nếu có
    if (content.includes('\\n') || content.includes('\\t') || content.includes('\\r')) {
      console.log('Phát hiện ký tự escape trong phản hồi OpenAI, đang xử lý...');
      // Thực hiện thay thế một cách an toàn, không làm ảnh hưởng đến cấu trúc JSON
      try {
        // Phân tích chuỗi JSON (nếu có)
        if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
          const jsonObj = JSON.parse(content);
          
          // Nếu có trường content trong script, xử lý
          if (jsonObj.script && jsonObj.script.content) {
            // Xử lý nội dung script để thay thế ký tự escape
            jsonObj.script.content = jsonObj.script.content
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\r/g, '\r')
              .replace(/\\\\/g, '\\');
            
            // Chuyển đổi lại thành chuỗi JSON
            content = JSON.stringify(jsonObj);
          }
        }
      } catch (jsonError) {
        console.warn('Không thể xử lý ký tự escape qua JSON:', jsonError.message);
        // Vẫn giữ nguyên nội dung, sẽ được xử lý ở file.service.js
      }
    }

    // Nếu phản hồi có thể là JSON nhưng sử dụng backticks, thử chuyển đổi
    if ((prompt.includes('dạng JSON') || prompt.includes('định dạng JSON')) && content.includes('`')) {
      try {
        // Tìm và thay thế backticks trong phản hồi
        const contentRegex = /"content":\s*`([\s\S]*?)`/g;
        content = content.replace(contentRegex, function(match, p1) {
          // Escape các ký tự đặc biệt trong nội dung
          const escaped = p1.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
          return '"content": "' + escaped + '"';
        });
        
        // Tìm các trường khác có backticks
        const otherFieldsRegex = /"([^"]+)":\s*`([^`]*)`/g;
        content = content.replace(otherFieldsRegex, function(match, field, value) {
          // Escape các ký tự đặc biệt trong giá trị
          const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
          return '"' + field + '": "' + escaped + '"';
        });
        
        // Kiểm tra xem kết quả có phải JSON hợp lệ không
        JSON.parse(content);
      } catch (error) {
        console.warn('Không thể chuyển đổi backticks trong phản hồi JSON:', error.message);
      }
    }

    return content;
  } catch (error) {
    console.error('Lỗi khi gọi OpenAI API:', error);
    throw new Error(`Lỗi OpenAI: ${error.message}`);
  }
}

/**
 * Phân tích phản hồi từ OpenAI để lấy thông tin về file script
 * @param {string} content - Nội dung phản hồi từ OpenAI
 * @returns {Array<object>|object} - Mảng các đối tượng file cần tạo hoặc một đối tượng file duy nhất
 */
function parseAIResponse(content) {
  try {
    // Chuyển đổi phản hồi text thành đối tượng JSON nếu cần
    if (typeof content === 'string') {
      try {
        // Thử parse nội dung thành JSON
        const parsed = JSON.parse(content);
        
        // Kiểm tra xem kết quả là object hay array
        if (Array.isArray(parsed)) {
          return parsed; // Trả về mảng nếu là array
        } else if (typeof parsed === 'object') {
          return [parsed]; // Đóng gói object vào array để tương thích với code cũ
        } else {
          // Không phải object hay array, thử phương pháp khác
          throw new Error('Kết quả parse không phải object hoặc array');
        }
      } catch (e) {
        // Nếu không thể parse JSON, thử phân tích theo định dạng khác
        const files = [];
        
        // Thử tìm cú pháp code block
        const fileRegex = /```([a-zA-Z0-9_.]+)\n([\s\S]*?)```/g;
        let match;
        let foundMatch = false;
        
        while ((match = fileRegex.exec(content)) !== null) {
          foundMatch = true;
          const fileName = match[1];
          const fileContent = match[2];
          
          files.push({
            filename: fileName,
            content: fileContent,
            type: fileName.split('.').pop() || 'txt',
            args: [] // Cần phân tích tham số từ nội dung nếu có
          });
        }
        
        if (foundMatch) {
          return files;
        }
        
        // Thử tìm JSON object ở trong nội dung
        const jsonRegex = /({[\s\S]*?})/g;
        while ((match = jsonRegex.exec(content)) !== null) {
          try {
            const parsedJson = JSON.parse(match[1]);
            if (parsedJson.filename && parsedJson.content) {
              files.push(parsedJson);
              foundMatch = true;
            }
          } catch (err) {
            // Bỏ qua nếu không parse được
          }
        }
        
        if (foundMatch) {
          return files;
        }
        
        // Nếu không tìm thấy định dạng nào, tạo file text với nội dung gốc
        return [{
          filename: 'output.txt',
          content: content,
          type: 'txt',
          args: [],
          description: 'Kết quả từ AI không được phân tích thành file'
        }];
      }
    } else if (typeof content === 'object') {
      // Nếu content đã là object, kiểm tra xem có phải array không
      if (Array.isArray(content)) {
        return content;
      }
      // Nếu là object đơn, bọc trong array để tương thích với code cũ
      return [content];
    }
    
    // Trường hợp không xác định, trả về array rỗng
    return [];
  } catch (error) {
    console.error('Lỗi khi phân tích phản hồi:', error);
    throw new Error(`Lỗi phân tích: ${error.message}`);
  }
}

module.exports = {
  getCompletion,
  parseAIResponse
}; 