const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Middleware xác thực API key
 * Kiểm tra headers để tìm openai_api_key hoặc api_key
 * Nếu tìm thấy openai_api_key hợp lệ, sử dụng nó
 * Nếu không tìm thấy openai_api_key, kiểm tra api_key có trong danh sách không
 * Nếu không có key nào hợp lệ, trả về lỗi
 */
const apiKeyAuth = (req, res, next) => {
  try {
    // Lấy API keys từ headers
    const openaiApiKey = req.headers['openai_api_key'];
    const apiKey = req.headers['api_key'];
    const model = req.headers['model'] || config.openai.model;
    
    // Kiểm tra nếu có openai_api_key
    if (openaiApiKey && openaiApiKey.trim() !== '') {
      // Đặt openaiApiKey vào config
      config.openai.apiKey = openaiApiKey;
      config.openai.model = model;
      return next();
    }
    
    // Nếu không có openai_api_key, kiểm tra api_key
    if (apiKey && apiKey.trim() !== '') {
      // Đọc file api.keys.json
      try {
        const keysPath = path.join(process.cwd(), 'api.keys.json');
        if (!fs.existsSync(keysPath)) {
          return res.status(401).json({
            success: false,
            message: 'File api.keys.json không tồn tại. Không thể xác thực API key.'
          });
        }
        
        const keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
        const validKey = keysData.keys.find(k => k.key === apiKey);
        
        if (validKey) {
          // API key hợp lệ, sử dụng OpenAI API key từ env
          config.openai.model = model;
          return next();
        } else {
          return res.status(401).json({
            success: false,
            message: 'API key không hợp lệ'
          });
        }
      } catch (error) {
        console.error('Lỗi khi đọc file api.keys.json:', error);
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi xác thực API key'
        });
      }
    }
    
    // Không có key nào được cung cấp
    return res.status(401).json({
      success: false,
      message: 'API key không được cung cấp. Vui lòng cấu hình openai_api_key hoặc api_key trong headers.'
    });
  } catch (error) {
    console.error('Lỗi xác thực API key:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực API key'
    });
  }
};

module.exports = { apiKeyAuth }; 