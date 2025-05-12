const openaiService = require('../services/openai.service');
const actionManager = require('../actions');
const { processWithAI, processAIResponse } = require('../services/ai.service');
const { js2xml } = require('xml-js');

/**
 * Hàm trả về response theo định dạng yêu cầu (XML hoặc JSON)
 */
function sendResponse(res, obj, returnType = 'xml') {
  if (returnType.toLowerCase() === 'json') {
    res.set('Content-Type', 'application/json');
    res.json(obj);
  } else {
    let xml;
    if(typeof obj === 'string') {
      xml = obj;
    } else {
      // Mặc định trả về XML
      // Xử lý đặc biệt cho history nếu có
      let xmlObj = { ...obj };
      
    // Nếu có history, chuyển đổi thành định dạng XML phù hợp
    if (xmlObj.history && Array.isArray(xmlObj.history)) {
      const historyXml = {
        message: xmlObj.history.map(msg => ({
          _attributes: { role: msg.role },
          _text: msg.content
        }))
      };
      
      xmlObj.history = historyXml;
    }
      
      xml = js2xml({ response: xmlObj }, { compact: true, spaces: 2 });
    }
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  }
}

/**
 * Xử lý yêu cầu tạo và thực thi script
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function processIssue(req, res) {
  try {
    const { message, system_info, return_type } = req.body;
    const actionInfo = req.actionInfo;
    const returnType = req.headers['return_type'] || return_type || 'xml'; // Lấy định dạng từ header hoặc body

    // Xử lý với AI với loại prompt tiêu chuẩn
    const aiResponseString = await processWithAI(message, system_info, [], 'standard');
    
    // Phân tích phản hồi từ AI
    const aiResponse = processAIResponse(aiResponseString, message, []);

    // Kiểm tra và validate response từ AI
    try {
      actionManager.validateAction(aiResponse.action, aiResponse);
    } catch (error) {
      return sendResponse(res, {
        action: 'error',
        message: `Lỗi từ AI: ${error.message}`
      }, returnType);
    }

    // Trả về response theo định dạng yêu cầu
    sendResponse(res, aiResponse, returnType);
  } catch (error) {
    console.error('Lỗi xử lý yêu cầu:', error);
    sendResponse(res, {
      action: 'error',
      message: 'Lỗi server khi xử lý yêu cầu'
    }, req.headers['return_type'] || req.body.return_type || 'xml');
  }
}

/**
 * Sửa lỗi script
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function fixScriptError(req, res) {
  try {
    const { error, script, return_type } = req.body;
    const actionInfo = req.actionInfo;
    const returnType = req.headers['return_type'] || return_type || 'xml'; // Lấy định dạng từ header hoặc body

    const fixMessage = `Sửa lỗi script: ${error}\nScript gốc:\n${script}`;

    // Xử lý với AI với loại prompt sửa lỗi
    const aiResponseString = await processWithAI(
      fixMessage,
      req.body.system_info,
      [],
      'fix'
    );
    
    // Phân tích phản hồi từ AI
    const aiResponse = processAIResponse(aiResponseString, fixMessage, []);

    // Kiểm tra và validate response từ AI
    try {
      actionManager.validateAction(aiResponse.action, aiResponse);
    } catch (error) {
      return sendResponse(res, {
        action: 'error',
        message: `Lỗi từ AI: ${error.message}`
      }, returnType);
    }

    // Trả về response theo định dạng yêu cầu
    sendResponse(res, aiResponse, returnType);
  } catch (error) {
    console.error('Lỗi sửa script:', error);
    sendResponse(res, {
      action: 'error',
      message: 'Lỗi server khi sửa script'
    }, req.headers['return_type'] || req.body.return_type || 'xml');
  }
}

/**
 * Xử lý yêu cầu chat
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function handleChat(req, res) {
  try {
    const { message, chat_history, return_type } = req.body;
    const returnType = req.headers['return_type'] || return_type || 'xml'; // Lấy định dạng từ header hoặc body

    // Xử lý với AI với loại prompt chat và trả về chuỗi phản hồi gốc
    const aiResponseString = await processWithAI(message, req.body.system_info, chat_history, 'standard');
    if(returnType === 'json') {
      // Phân tích phản hồi từ AI và tích hợp chat history
      const aiResponse = processAIResponse(aiResponseString, message, chat_history);
      sendResponse(res, aiResponse, returnType);
    } else {
      // Phân tích phản hồi từ AI và tích hợp chat history
      sendResponse(res, aiResponseString, returnType);
    }

  } catch (error) {
    console.error('Lỗi xử lý chat:', error);
    sendResponse(res, {
      action: 'error',
      message: 'Lỗi server khi xử lý chat'
    }, req.headers['return_type'] || req.body.return_type || 'xml');
  }
}

/**
 * Phân tích file hoặc lỗi
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function analyzeFileOrError(req, res) {
  try {
    const { file_path, error_message, context, return_type } = req.body;
    const actionInfo = req.actionInfo;
    const returnType = req.headers['return_type'] || return_type || 'xml'; // Lấy định dạng từ header hoặc body

    const analyzeMessage = `Phân tích ${file_path ? 'file' : 'lỗi'}: ${file_path || error_message}\nContext: ${context}`;

    // Xử lý với AI với loại prompt phân tích
    const aiResponseString = await processWithAI(
      analyzeMessage,
      req.body.system_info,
      [],
      'standard'
    );
    
    // Phân tích phản hồi từ AI
    const aiResponse = processAIResponse(aiResponseString, analyzeMessage, []);

    // Kiểm tra và validate response từ AI
    try {
      actionManager.validateAction(aiResponse.action, aiResponse);
    } catch (error) {
      return sendResponse(res, {
        action: 'error',
        message: `Lỗi từ AI: ${error.message}`
      }, returnType);
    }

    // Trả về response theo định dạng yêu cầu
    sendResponse(res, aiResponse, returnType);
  } catch (error) {
    console.error('Lỗi phân tích:', error);
    sendResponse(res, {
      action: 'error',
      message: 'Lỗi server khi phân tích'
    }, req.headers['return_type'] || req.body.return_type || 'xml');
  }
}

// Thêm các hàm phụ trợ phía dưới:
// Hàm lấy nội dung nổi tiếng (giả lập)
async function getFamousTextContent(title, rawContent, fileType) {
  // Ở đây có thể tích hợp API lyrics, truyện, thơ, v.v. hoặc scraping
  // Demo: trả về nội dung gốc bọc HTML nếu là html, ngược lại trả về text
  if (fileType === 'html') {
    return `<html><body><h1>${title}</h1><pre>${rawContent}</pre></body></html>`;
  }
  return rawContent;
}

// Hàm tạo nội dung mẫu cho các loại file
function getSampleContent(ext) {
  switch(ext) {
    case 'html':
      return '<!DOCTYPE html>\n<html><head><title>File HTML mẫu</title></head><body>Xin chào!</body></html>';
    case 'txt':
      return 'Đây là file text mẫu.';
    case 'js':
      return '// File JavaScript mẫu\nconsole.log("Hello world");';
    case 'py':
      return '# File Python mẫu\nprint("Hello world")';
    default:
      return '';
  }
}

module.exports = {
  processIssue,
  fixScriptError,
  handleChat,
  analyzeFileOrError
}; 