const openaiService = require('../services/openai.service');

/**
 * Xử lý yêu cầu tạo và thực thi script
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function processIssue(req, res) {
  try {
    const { issue } = req.body;
    
    if (!issue) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu nội dung yêu cầu (issue)' 
      });
    }
    
    // Tạo prompt cho OpenAI
    const prompt = `
    Bạn là một AI chuyên gia về hệ thống và phát triển phần mềm. Hãy tạo script để giải quyết vấn đề sau đây:
    
    ${issue}
    
    Lưu ý: Ưu tiên tạo file JavaScript (Node.js) để thực thi các tác vụ shell. Chỉ sử dụng shell script (.sh) khi thực sự cần thiết.
    
    Hãy phản hồi dưới dạng JSON theo định dạng sau:
    [
      {
        "filename": "tên_file.js",
        "content": "nội dung file",
        "type": "js",
        "args": ["tham số 1", "tham số 2", ...],
        "description": "mô tả ngắn về tác dụng của file"
      },
      ...
    ]
    
    Đảm bảo rằng script có thể thực thi được và xử lý được vấn đề. Bao gồm các xử lý lỗi và thông báo phù hợp.
    `;
    
    // Gửi prompt tới OpenAI và nhận phản hồi
    const aiResponse = await openaiService.getCompletion(prompt);
    
    // Phân tích phản hồi để lấy thông tin file
    const files = openaiService.parseAIResponse(aiResponse);
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(500).json({ 
        success: false, 
        message: 'Không thể tạo script từ phản hồi của AI',
        response: aiResponse
      });
    }
    
    // Trả về thông tin về các file cần tạo để client xử lý
    return res.status(200).json({
      success: true,
      message: 'Đã tạo script thành công',
      files: files
    });
    
  } catch (error) {
    console.error('Lỗi khi xử lý yêu cầu:', error);
    return res.status(500).json({
      success: false,
      message: `Lỗi khi xử lý yêu cầu: ${error.message}`
    });
  }
}

/**
 * Xử lý lỗi từ script và tạo script mới để khắc phục
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function fixScriptError(req, res) {
  try {
    const { error, issue, previousFiles } = req.body;
    
    if (!error || !issue) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin lỗi hoặc yêu cầu ban đầu'
      });
    }
    
    // Tạo prompt để yêu cầu AI sửa lỗi
    const prompt = `
    Bạn là một AI chuyên gia về hệ thống và phát triển phần mềm. Script đã tạo gặp lỗi khi thực thi. 
    Hãy tạo script mới để sửa lỗi và giải quyết vấn đề.
    
    Yêu cầu ban đầu: ${issue}
    
    Lỗi gặp phải: ${error}
    
    ${previousFiles ? `Script trước đó: ${JSON.stringify(previousFiles, null, 2)}` : ''}
    
    Hãy phản hồi dưới dạng JSON theo định dạng sau:
    [
      {
        "filename": "tên_file.đuôi_file",
        "content": "nội dung file",
        "type": "loại file (sh, js, py, ...)",
        "args": ["tham số 1", "tham số 2", ...],
        "description": "mô tả ngắn về tác dụng của file và cách nó khắc phục lỗi"
      },
      ...
    ]
    
    Đảm bảo rằng script mới có thể thực thi được và khắc phục được lỗi. Bao gồm các xử lý lỗi và thông báo phù hợp.
    `;
    
    // Gửi prompt tới OpenAI và nhận phản hồi
    const aiResponse = await openaiService.getCompletion(prompt);
    
    // Phân tích phản hồi để lấy thông tin file
    const files = openaiService.parseAIResponse(aiResponse);
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo script sửa lỗi từ phản hồi của AI',
        response: aiResponse
      });
    }
    
    // Trả về thông tin về các file cần tạo để client xử lý
    return res.status(200).json({
      success: true,
      message: 'Đã tạo script sửa lỗi thành công',
      files: files
    });
    
  } catch (error) {
    console.error('Lỗi khi tạo script sửa lỗi:', error);
    return res.status(500).json({
      success: false,
      message: `Lỗi khi tạo script sửa lỗi: ${error.message}`
    });
  }
}

module.exports = {
  processIssue,
  fixScriptError
}; 