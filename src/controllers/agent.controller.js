const openaiService = require('../services/openai.service');

/**
 * Xử lý yêu cầu tạo và thực thi script
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function processIssue(req, res) {
  try {
    const { issue, action = 'run', type, target, filename, system_info, suggest_type } = req.body;
    
    if (!issue) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu nội dung yêu cầu (issue)' 
      });
    }
    
    // Tạo prompt cho OpenAI dựa trên action
    let prompt;
    let systemInfoPrompt = '';
    
    // Thêm thông tin hệ thống vào prompt nếu có
    if (system_info) {
      systemInfoPrompt = "Thông tin hệ thống của người dùng:\\n" +
        "- Hệ điều hành: " + system_info.os_type + " " + system_info.os_version + "\\n" +
        "- Kiến trúc: " + system_info.arch + "\\n" +
        "- Người dùng: " + system_info.user + "\\n" +
        "- Hostname: " + system_info.hostname + "\\n" +
        "- Package managers: " + system_info.package_managers + "\\n" +
        "- Ngôn ngữ lập trình: " + system_info.languages + "\\n" +
        "- Web servers: " + system_info.web_servers + "\\n" +
        "- Databases: " + system_info.databases + "\\n\\n" +
        "Hãy tạo script phù hợp với hệ thống của người dùng. Sử dụng các công cụ và package managers có sẵn trên hệ thống.";
    }
    
    if (action === 'show') {
      // Chỉ hiển thị thông tin, không tạo script để thực thi
      prompt = `
      Bạn là một AI chuyên gia về hệ thống và phát triển phần mềm. Hãy cung cấp thông tin về vấn đề sau đây:
      
      ${issue}
      
      ${systemInfoPrompt}
      
      Hãy phản hồi CHÍNH XÁC theo định dạng JSON sau, KHÔNG thêm bất kỳ văn bản nào trước hoặc sau JSON:
      {
        "action": "show",
        "message": "Nội dung phản hồi của bạn dưới dạng văn bản có định dạng markdown"
      }
      
      QUAN TRỌNG: Trả về JSON hợp lệ, không sử dụng backticks trong phản hồi JSON.
      KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau đối tượng JSON.
      KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi JSON (chỉ sử dụng trong trường message).
      CHỈ trả về đối tượng JSON thuần túy.
      `;
    } else if (action === 'input') {
      // Yêu cầu thêm thông tin đầu vào từ người dùng
      prompt = `
      Bạn là một AI chuyên gia về hệ thống và phát triển phần mềm. Hãy phân tích yêu cầu sau và xác định những thông tin còn thiếu:
      
      ${issue}
      
      ${systemInfoPrompt}
      
      Hãy phản hồi CHÍNH XÁC theo định dạng JSON sau, KHÔNG thêm bất kỳ văn bản nào trước hoặc sau JSON:
      {
        "action": "input",
        "message": "Thông báo chính mô tả thông tin cần thu thập",
        "label": "Nhãn cho trường nhập liệu",
        "description": "Mô tả chi tiết về thông tin cần nhập"
      }
      
      QUAN TRỌNG: Trả về JSON hợp lệ, không sử dụng backticks trong phản hồi JSON.
      KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau đối tượng JSON.
      KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi.
      CHỈ trả về đối tượng JSON thuần túy.
      `;
    } else if (action === 'create') {
      // Tạo file nhưng không thực thi
      let filePrompt = '';
      
      if (type === 'file' && filename) {
        filePrompt = `Tạo file có tên: ${filename}`;
      } else if (type) {
        filePrompt = `Loại: ${type}`;
      }
      
      // Xác định loại nội dung dựa trên tên file
      let contentType = "văn bản";
      if (filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'txt') contentType = "văn bản";
        else if (ext === 'html') contentType = "HTML";
        else if (ext === 'css') contentType = "CSS";
        else if (ext === 'js') contentType = "JavaScript";
        else if (ext === 'py') contentType = "Python";
        else if (ext === 'sh') contentType = "shell script";
        else if (ext === 'md') contentType = "Markdown";
        else if (ext === 'json') contentType = "JSON";
        else if (ext === 'xml') contentType = "XML";
        else if (ext === 'csv') contentType = "CSV";
        else if (ext === 'sql') contentType = "SQL";
      }
      
      prompt = `
      Bạn là một AI chuyên gia về hệ thống và phát triển phần mềm. Hãy tạo nội dung ${contentType} cho file sau đây:
      
      ${issue}
      
      ${systemInfoPrompt}
      
      ${filePrompt}
      ${target ? `Đích: ${target}` : ''}
      ${suggest_type ? `Gợi ý loại file: ${suggest_type}` : ''}
      
      Hãy phản hồi CHÍNH XÁC theo định dạng JSON sau, KHÔNG thêm bất kỳ văn bản nào trước hoặc sau JSON:
      {
        "action": "create",
        "message": "Mô tả ngắn gọn về file đã tạo",
        "script": {
          "filename": "${filename || 'file.txt'}",
          "content": "nội dung file đầy đủ, không bị cắt ngắn",
          "type": "${suggest_type || (contentType === 'JavaScript' ? 'js' : contentType === 'Python' ? 'py' : contentType === 'shell script' ? 'sh' : 'txt')} (có thể phụ thuộc yêu cầu cụ thể của người dùng)",
          "description": "mô tả ngắn về tác dụng của file"
        }
      }
      
      QUAN TRỌNG: Trả về JSON hợp lệ, không sử dụng backticks trong phản hồi JSON.
      KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau đối tượng JSON.
      KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi.
      CHỈ trả về đối tượng JSON thuần túy.
      `;
    } else if (action === 'chat') {
      // Chế độ chat
      prompt = `
      Bạn là một AI trợ lý hữu ích. Hãy trả lời câu hỏi sau một cách ngắn gọn và hữu ích:
      
      ${issue}
      
      ${systemInfoPrompt}
      
      Hãy phản hồi CHÍNH XÁC theo định dạng JSON sau, KHÔNG thêm bất kỳ văn bản nào trước hoặc sau JSON:
      {
        "action": "chat",
        "message": "Nội dung phản hồi của bạn dưới dạng văn bản"
      }
      
      QUAN TRỌNG: Trả về JSON hợp lệ, không sử dụng backticks trong phản hồi JSON.
      KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau đối tượng JSON.
      KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi.
      CHỈ trả về đối tượng JSON thuần túy.
      `;
    } else if (action === 'run') {
      // Mặc định: tạo script để thực thi (action = run)
      prompt = `
      Bạn là một AI chuyên gia về hệ thống và phát triển phần mềm. Hãy tạo script để giải quyết vấn đề sau đây:
      
      ${issue}
      
      ${systemInfoPrompt}
      
      ${type ? `Loại: ${type}` : ''}
      ${target ? `Đích: ${target}` : ''}
      ${suggest_type ? `Gợi ý loại file: ${suggest_type}` : ''}
      
      Lưu ý: 
      1. ${suggest_type ? `Ưu tiên tạo file ${suggest_type}` : 'Ưu tiên tạo file JavaScript (Node.js)'} để thực thi các tác vụ shell. Chỉ sử dụng shell script (.sh) khi thực sự cần thiết hoặc các tác vụ liên quan đến cài đặt hoặc gỡ phần mềm hay thư viện nào đó trên các hệ diều hành hỗ trợ.
      2. Trong mỗi script, trước khi thực thi bất kỳ lệnh shell nào, cần in ra màn hình lệnh đó để người dùng biết.
      3. Đối với JavaScript, sử dụng console.log để hiển thị lệnh trước khi thực thi, 
        ví dụ: muốn thực thi : exec(command) 
          thì console.log(command) trước sau đó mới thực thi exec(command)
        ví dụ: muốn thực thi : exec('ls -la')
        thì console.log('Executing: ls -la') trước sau đó mới thực thi exec('ls -la')

      4. Đối với shell script, sử dụng echo để hiển thị lệnh trước khi thực thi, ví dụ: echo 'Executing: ls -la'
        ví dụ: muốn thực thi : ls -la
        thì echo 'Executing: ls -la' trước sau đó mới thực thi ls -la
      5. Đối với Python, sử dụng print để hiển thị lệnh trước khi thực thi, ví dụ: print('Executing: ls -la')
        ví dụ: muốn thực thi : subprocess.run(["ls", "-la"],...)
        thì print('Executing: ls -la') trước sau đó mới thực thi subprocess.run(["ls", "-la"],...)
      5.5 tương tự với các ngôn ngữ khác, ví dụ: PHP, Ruby, ...
      6. Đảm bảo xử lý lỗi đầy đủ trong script, hiển thị thông báo lỗi phù hợp.
      7. QUAN TRỌNG: Trả về JSON hợp lệ, không sử dụng backticks trong phản hồi JSON.
      
      Hãy phản hồi CHÍNH XÁC theo định dạng JSON sau, KHÔNG thêm bất kỳ văn bản nào trước hoặc sau JSON:
      {
        "action": "run",
        "message": "Giải thích ngắn gọn về script",
        "script": {
          "filename": "tên_file.${suggest_type || 'js'}",
          "content": "nội dung file đầy đủ, không bị cắt ngắn. trước khi thực thi, cần in ra màn hình lệnh đó để người dùng biết",
          "type": "${suggest_type || 'js'}",
          "description": "mô tả ngắn về tác dụng của file",
          "prepare": "các lệnh cài đặt thư viện cần thiết (nếu có)"
        }
      }
      
      KHÔNG bao gồm backticks (\`\`\`) hoặc bất kỳ định dạng markdown nào khác trong phản hồi. Chỉ trả về đối tượng JSON thuần túy.

      `;
    }
    
    // Gửi prompt tới OpenAI và nhận phản hồi
    const aiResponse = await openaiService.getCompletion(prompt);
    
    // Xử lý phản hồi
    try {
      // Phân tích phản hồi JSON
      let responseData;
      
      if (typeof aiResponse === 'string') {
        try {
          responseData = JSON.parse(aiResponse);
        } catch (parseError) {
          console.error('Lỗi khi parse JSON trực tiếp:', parseError.message);
          
          // Thử trích xuất JSON từ text
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              responseData = JSON.parse(jsonMatch[0]);
            } catch (matchParseError) {
              return res.status(500).json({
                success: false,
                message: 'Không thể phân tích phản hồi từ AI',
                error: matchParseError.message,
                response: aiResponse
              });
            }
          } else {
            return res.status(500).json({
              success: false,
              message: 'Phản hồi từ AI không chứa JSON',
              response: aiResponse
            });
          }
        }
      } else {
        responseData = aiResponse;
      }
      
      // Trả về phản hồi theo định dạng mới
      return res.status(200).json(responseData);
    } catch (error) {
      console.error('Lỗi khi xử lý phản hồi:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi xử lý phản hồi từ AI',
        error: error.message,
        response: aiResponse
      });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý yêu cầu:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
}

/**
 * Sửa lỗi script
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function fixScriptError(req, res) {
  try {
    const { issue, error, script, system_info, suggest_type } = req.body;
    
    if (!error || !script) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin lỗi hoặc nội dung script' 
      });
    }
    
    // Tạo thông tin hệ thống nếu có
    let systemInfoPrompt = '';
    if (system_info) {
      systemInfoPrompt = "Thông tin hệ thống của người dùng:\\n" +
        "- Hệ điều hành: " + system_info.os_type + " " + system_info.os_version + "\\n" +
        "- Kiến trúc: " + system_info.arch + "\\n" +
        "- Người dùng: " + system_info.user + "\\n" +
        "- Hostname: " + system_info.hostname + "\\n" +
        "- Package managers: " + system_info.package_managers + "\\n" +
        "- Ngôn ngữ lập trình: " + system_info.languages + "\\n" +
        "- Web servers: " + system_info.web_servers + "\\n" +
        "- Databases: " + system_info.databases + "\\n";
    }
    
    // Tạo prompt cho OpenAI
    const prompt = `
    Bạn là một AI chuyên gia về hệ thống và phát triển phần mềm. Một script đã được tạo nhưng gặp lỗi khi thực thi. Hãy sửa lỗi và trả về script đã sửa.
    
    Yêu cầu ban đầu: ${issue || 'Không có thông tin'}
    
    Thông báo lỗi: ${error}
    
    Script gốc:
    \`\`\`
    ${script}
    \`\`\`
    
    ${systemInfoPrompt}
    ${suggest_type ? `Gợi ý loại file: ${suggest_type}` : ''}
    
    Hãy phân tích lỗi, sửa script và trả về CHÍNH XÁC theo định dạng JSON sau, KHÔNG thêm bất kỳ văn bản nào trước hoặc sau JSON:
    {
      "action": "run",
      "message": "Giải thích về lỗi và cách bạn đã sửa nó",
      "script": {
        "filename": "tên_file.${suggest_type || 'js'}",
        "content": "nội dung file đã sửa đầy đủ, không bị cắt ngắn",
        "type": "${suggest_type || 'js'}",
        "description": "mô tả ngắn về tác dụng của file",
        "prepare": "các lệnh cài đặt thư viện cần thiết (nếu có)"
      }
    }
    
    QUAN TRỌNG: Trả về JSON hợp lệ, không sử dụng backticks trong phản hồi JSON.
    KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau đối tượng JSON.
    KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi.
    CHỈ trả về đối tượng JSON thuần túy.
    `;
    
    // Gửi prompt tới OpenAI và nhận phản hồi
    const aiResponse = await openaiService.getCompletion(prompt);
    
    try {
      // Phân tích phản hồi JSON
      let responseData;
      
      if (typeof aiResponse === 'string') {
        try {
          responseData = JSON.parse(aiResponse);
        } catch (parseError) {
          console.error('Lỗi khi parse JSON trực tiếp:', parseError.message);
          
          // Thử trích xuất JSON từ text
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              responseData = JSON.parse(jsonMatch[0]);
            } catch (matchParseError) {
              return res.status(500).json({
                success: false,
                message: 'Không thể phân tích phản hồi từ AI',
                error: matchParseError.message,
                response: aiResponse
              });
            }
          } else {
            return res.status(500).json({
              success: false,
              message: 'Phản hồi từ AI không chứa JSON',
              response: aiResponse
            });
          }
        }
      } else {
        responseData = aiResponse;
      }
      
      // Trả về phản hồi theo định dạng mới
      return res.status(200).json(responseData);
    } catch (error) {
      console.error('Lỗi khi xử lý phản hồi:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi xử lý phản hồi từ AI',
        error: error.message,
        response: aiResponse
      });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý yêu cầu:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
}

/**
 * Xử lý yêu cầu chat
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function handleChat(req, res) {
  try {
    const { message, system_info, mode, history = [], suggest_type } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu nội dung tin nhắn' 
      });
    }
    
    // Tạo thông tin hệ thống nếu có
    let systemInfoPrompt = '';
    if (system_info) {
      systemInfoPrompt = "Thông tin hệ thống của người dùng:\\n" +
        "- Hệ điều hành: " + system_info.os_type + " " + system_info.os_version + "\\n" +
        "- Kiến trúc: " + system_info.arch + "\\n" +
        "- Người dùng: " + system_info.user + "\\n" +
        "- Hostname: " + system_info.hostname + "\\n" +
        "- Package managers: " + system_info.package_managers + "\\n" +
        "- Ngôn ngữ lập trình: " + system_info.languages + "\\n" +
        "- Web servers: " + system_info.web_servers + "\\n" +
        "- Databases: " + system_info.databases + "\\n";
    }
    
    // Xác định chế độ (chat thông thường hoặc dev)
    const isDev = mode === 'dev';
    
    // Tạo prompt cho OpenAI
    let prompt;
    let historyPrompt = '';
    
    // Xử lý lịch sử trò chuyện
    if (history && history.length > 0) {
      historyPrompt = '\nLịch sử trò chuyện:\n';
      history.forEach(msg => {
        if (msg.role === 'user') {
          historyPrompt += `Người dùng: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
          historyPrompt += `AI: ${msg.content}\n`;
        }
      });
      historyPrompt += '\nTin nhắn hiện tại:\n';
    }
    
    if (isDev) {
      prompt = `
      Bạn là một AI trợ lý hữu ích chuyên về phát triển hệ thống. Hãy trả lời câu hỏi sau và nếu cần thiết, tạo script để giải quyết vấn đề:
      
      ${historyPrompt}
      ${message}
      
      ${systemInfoPrompt}
      ${suggest_type ? `Gợi ý loại file thực thi: ${suggest_type} (chú ý đây là kiểu file thực thi chứ không phải kiểu file người dùng yêu cầu)` : ''}
      
      Hãy phản hồi CHÍNH XÁC theo định dạng JSON sau, KHÔNG thêm bất kỳ văn bản nào trước hoặc sau JSON:
      {
        "action": "Hành động cho biết phía client phải làm gì (chat, run, create)",
        "message": "Nội dung chat hoặc nội dung cần hiển thị với người dùng",
        "script": {
            "filename": "tên_file.${suggest_type || 'js'} (chú ý đây là tên file có thể tuỳ vào yêu cầu cụ thể của người dùng nếu người dùng yêu cầu tạo file)",
            "content": "nội dung file đầy đủ, không bị cắt ngắn. trước khi thực thi, cần in ra màn hình lệnh đó để người dùng biết, thực thi gặp lỗi phải hiển thị lỗi",
            "type": "${suggest_type || 'js'} (chú ý đây là tên file có thể tuỳ vào yêu cầu cụ thể của người dùng nếu người dùng yêu cầu tạo file)",
            "description": "mô tả ngắn về tác dụng của file",
            "prepare": "các lệnh cài đặt thư viện cần thiết (nếu có)"
        }
      }
      
      Nếu không cần tạo script, chỉ cần trả về action là "chat" và message là nội dung phản hồi, không cần trường script.
      Nếu cần tạo script để thực thi, hãy đặt action là "run", message là giải thích, và script là thông tin file cần tạo.
          Lưu ý: 
          1. ${suggest_type ? `Ưu tiên tạo file ${suggest_type}` : 'Ưu tiên tạo file JavaScript (Node.js)'} để thực thi các tác vụ shell. Chỉ sử dụng shell script (.sh) khi thực sự cần thiết hoặc các tác vụ liên quan đến cài đặt hoặc gỡ phần mềm hay thư viện nào đó.
          2. Trong mỗi script, trước khi thực thi bất kỳ lệnh shell nào, cần in ra màn hình lệnh đó để người dùng biết.
          3. Đối với JavaScript, sử dụng console.log để hiển thị lệnh trước khi thực thi, 
            ví dụ: muốn thực thi : exec(command) 
              thì console.log(command) trước sau đó mới thực thi exec(command)
            ví dụ: muốn thực thi : exec('ls -la')
            thì console.log('Executing: ls -la') trước sau đó mới thực thi exec('ls -la')
          4. Đối với shell script, sử dụng echo để hiển thị lệnh trước khi thực thi, ví dụ: echo 'Executing: ls -la'
            ví dụ: muốn thực thi : ls -la
            thì echo 'Executing: ls -la' trước sau đó mới thực thi ls -la
          5. Đối với Python, sử dụng print để hiển thị lệnh trước khi thực thi, ví dụ: print('Executing: ls -la')
            ví dụ: muốn thực thi : subprocess.run(["ls", "-la"],...)
            thì print('Executing: ls -la') trước sau đó mới thực thi subprocess.run(["ls", "-la"],...)
          5.5 tương tự với các ngôn ngữ khác, ví dụ: PHP, Ruby, ...
          6. Đảm bảo xử lý lỗi đầy đủ trong script, hiển thị thông báo lỗi phù hợp.
          
      Nếu cần tạo file nhưng không thực thi, hãy đặt action là "create".
      
      QUAN TRỌNG: Trả về JSON hợp lệ, không sử dụng backticks trong phản hồi JSON.
      KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau đối tượng JSON.
      KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi.
      CHỈ trả về đối tượng JSON thuần túy.
      
      
      `;
    } else {
      prompt = `
      Bạn là một AI trợ lý hữu ích. Hãy trả lời câu hỏi sau một cách ngắn gọn và hữu ích:
      
      ${historyPrompt}
      ${message}
      
      ${systemInfoPrompt}
      
      Hãy phản hồi CHÍNH XÁC theo định dạng JSON sau, KHÔNG thêm bất kỳ văn bản nào trước hoặc sau JSON:
      {
        "action": "chat",
        "message": "Nội dung phản hồi của bạn dưới dạng văn bản"
      }
      
      QUAN TRỌNG: Trả về JSON hợp lệ, không sử dụng backticks trong phản hồi JSON.
      KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau đối tượng JSON.
      KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi.
      CHỈ trả về đối tượng JSON thuần túy.
      `;
    }
    
    // Gửi prompt tới OpenAI và nhận phản hồi
    const aiResponse = await openaiService.getCompletion(prompt);
    
    try {
      // Phân tích phản hồi JSON
      let responseData;
      
      if (typeof aiResponse === 'string') {
        try {
          responseData = JSON.parse(aiResponse);
        } catch (parseError) {
          console.error('Lỗi khi parse JSON trực tiếp:', parseError.message);
          
          // Thử trích xuất JSON từ text
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              responseData = JSON.parse(jsonMatch[0]);
            } catch (matchParseError) {
              return res.status(500).json({
                success: false,
                message: 'Không thể phân tích phản hồi từ AI',
                error: matchParseError.message,
                response: aiResponse
              });
            }
          } else {
            return res.status(500).json({
              success: false,
              message: 'Phản hồi từ AI không chứa JSON',
              response: aiResponse
            });
          }
        }
      } else {
        responseData = aiResponse;
      }
      
      // Kiểm tra và chuẩn hóa dữ liệu phản hồi
      if (!responseData.action) {
        responseData.action = 'chat';
      }
      
      if (!responseData.message && responseData.content) {
        responseData.message = responseData.content;
        delete responseData.content;
      }
      
      // Trả về phản hồi theo định dạng mới
      return res.status(200).json(responseData);
    } catch (error) {
      console.error('Lỗi khi xử lý phản hồi:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi xử lý phản hồi từ AI',
        error: error.message,
        response: aiResponse
      });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý yêu cầu chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
}

module.exports = {
  processIssue,
  fixScriptError,
  handleChat
}; 