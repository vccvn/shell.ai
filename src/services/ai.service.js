const openaiService = require('./openai.service');
const actionManager = require('../actions');
const { js2xml, xml2js } = require('xml-js');
const fs = require('fs').promises;
const path = require('path');
const { preparePrompt } = require('../utils/format_helpers');

/**
 * Xử lý yêu cầu với AI và trả về response dạng chuỗi gốc
 * @param {string} message - Nội dung yêu cầu
 * @param {object} systemInfo - Thông tin hệ thống
 * @param {array} chatHistory - Lịch sử chat (tùy chọn)
 * @param {string} promptType - Loại prompt (standard, script, fix, auto_solve)
 * @returns {string} Response chuỗi gốc từ API
 */
async function processWithAI(message, systemInfo, chatHistory = [], promptType = 'standard') {
    try {
        // Tạo prompt cho AI (luôn sử dụng XML làm định dạng chuẩn)
        const prompt = await createPrompt(message, systemInfo, promptType);
        
        // Gọi OpenAI với history
        const aiResponse = await openaiService.getCompletion(prompt, chatHistory);
        
        // Lưu prompt user vào file để debug
        const promptPath = path.join(process.cwd(), 'src/prompts/user_prompt.txt');
        await fs.writeFile(promptPath, prompt, 'utf8');
        
        // Trả về phản hồi gốc
        return aiResponse;
    } catch (error) {
        console.error('Lỗi chung khi xử lý AI:', error);
        return `<response>
  <action>error</action>
  <message>Lỗi khi xử lý yêu cầu: ${error.message}</message>
</response>`;
    }
}

/**
 * Tạo prompt cho AI
 * @param {string} message - Nội dung yêu cầu
 * @param {object} systemInfo - Thông tin hệ thống
 * @param {string} promptType - Loại prompt (standard, script, fix, auto_solve)
 * @returns {string} Prompt cho AI
 */
async function createPrompt(message, systemInfo, promptType = 'standard') {
    // Tạo thông tin hệ thống
    let systemInfoPrompt = '';
    if (systemInfo) {
        systemInfoPrompt = "Thông tin hệ thống của người dùng:\n" +
            "- Hệ điều hành: " + systemInfo.os_type + " " + systemInfo.os_version + "\n" +
            "- Kiến trúc: " + systemInfo.arch + "\n" +
            "- Người dùng: " + systemInfo.user + "\n" +
            "- Hostname: " + systemInfo.hostname + "\n" +
            "- Package managers: " + systemInfo.package_managers + "\n" +
            "- Ngôn ngữ lập trình: " + systemInfo.languages + "\n" +
            "- Web servers: " + systemInfo.web_servers + "\n" +
            "- Databases: " + systemInfo.databases + "\n";
    }

    
    // Đọc template prompts từ file
    try {
        // Xác định file prompt dựa trên loại prompt
        let promptFileName = 'standard_prompt.txt';

        switch (promptType) {
            case 'script':
                promptFileName = 'script_generation_prompt.txt';
                break;
            case 'fix':
                promptFileName = 'fix_script_error_prompt.txt';
                break;
            case 'auto_solve':
                promptFileName = 'auto_solve_prompt.txt';
                break;
            default:
                promptFileName = 'standard_prompt.txt';
        }

        // Đọc prompt template từ file
        const promptPath = path.join(process.cwd(), 'src/prompts/' + promptFileName);
        let promptTemplate = '';

        try {
            promptTemplate = await fs.readFile(promptPath, 'utf8');
        } catch (err) {
            console.error(`Không thể đọc file prompt ${promptFileName}:`, err);
            // Sử dụng template mặc định nếu không thể đọc file
            promptTemplate = `
Bạn là một AI trợ lý hữu ích chuyên về phát triển hệ thống. Hãy trả lời câu hỏi sau và nếu cần thiết, tạo script để giải quyết vấn đề:

{message}

{system_info_prompt}

{return_type_format}

Lưu ý:
1. Nếu không cần tạo script, chỉ cần trả về action là "chat" và message là nội dung phản hồi, không cần phần script.
2. Nếu cần tạo script để thực thi, hãy đặt action là "run", message là giải thích, và thêm phần script là thông tin file cần tạo.
3. Nếu cần tạo file nhưng không thực thi, hãy đặt action là "create". ĐẶC BIỆT QUAN TRỌNG: Đối với các file HTML, văn bản (txt), JSON và các file nội dung tĩnh, LUÔN sử dụng action "create" thay vì "run".
4. Nếu đã hoàn thành và không cần thêm hành động nào, hãy đặt action là "done".
5. Nếu cần phân tích thêm, hãy đặt action là "analyze".
6. Nếu cần hiển thị thông tin mà không cần xử lý, hãy đặt action là "show".
7. Nếu có lỗi phát sinh, hãy đặt action là "error".

QUAN TRỌNG: 
- Trả về {return_type} hợp lệ, {return_type_instructions}
- KHÔNG bao gồm bất kỳ văn bản nào trước hoặc sau {return_type}
- KHÔNG sử dụng định dạng markdown hoặc code block (\`\`\`) trong phản hồi
- CHỈ trả về cấu trúc {return_type} thuần túy
`;
        }

        // Chuẩn bị các tham số đặc biệt tùy theo loại prompt
        const promptParams = {
            message: message,
            system_info_prompt: systemInfoPrompt,
            return_type: 'xml'  // Luôn yêu cầu XML từ API
        };

        // Thêm các tham số đặc biệt tùy theo loại prompt
        if (promptType === 'fix') {
            // Parse nội dung để lấy thông tin lỗi và script
            const errorMatch = message.match(/Sửa lỗi script: (.*)\nScript gốc:/s);
            const scriptMatch = message.match(/Script gốc:\n([\s\S]*)/);

            if (errorMatch && scriptMatch) {
                promptParams.error = errorMatch[1];
                promptParams.script = scriptMatch[1];
                promptParams.issue = "Sửa lỗi script";
                promptParams.suggest_type_prompt = ""; // Có thể thêm logic để đề xuất loại file
            }
        } else if (promptType === 'auto_solve') {
            // Thêm các tham số cần thiết cho auto_solve
            promptParams.original_question = "Yêu cầu phân tích output từ script";
            promptParams.issue = "Phân tích và đề xuất giải pháp";
            promptParams.script_output = message;
        }

        // Sử dụng XML làm định dạng chuẩn
        return preparePrompt(promptTemplate, promptParams, promptType);
    } catch (error) {
        console.error('Lỗi tạo prompt:', error);
        // Fallback simple prompt nếu có lỗi
        return `Bạn là một AI trợ lý hữu ích. Hãy trả lời câu hỏi sau: ${message}`;
    }
}

/**
 * Xử lý phân tích phản hồi từ AI để chuyển thành đối tượng
 * @param {string} aiResponse - Phản hồi gốc từ AI
 * @param {string} message - Tin nhắn ban đầu
 * @param {array} chatHistory - Lịch sử chat
 * @returns {object} Đối tượng đã phân tích
 */
function processAIResponse(aiResponse, message, chatHistory = []) {
    try {
        let responseData;
        
        // Kiểm tra nếu phản hồi có dấu hiệu của XML
        if (aiResponse.includes('<response>')) {
            // Parse XML thành object
            const result = xml2js(aiResponse, { compact: true, spaces: 2 });
            responseData = result.response;

            // Chuyển đổi _text thành giá trị thực
            const convertXmlObject = (obj) => {
                if (!obj) return obj;

                // Xử lý từng thuộc tính
                Object.keys(obj).forEach(key => {
                    if (obj[key] && typeof obj[key] === 'object') {
                        if (obj[key]._text !== undefined) {
                            obj[key] = obj[key]._text;
                        } else if (key === 'history' && Array.isArray(obj[key].message)) {
                            // Xử lý đặc biệt cho mảng history
                            const historyArray = [];
                            obj[key].message.forEach(msg => {
                                historyArray.push({
                                    role: msg._attributes?.role || 'unknown',
                                    content: msg._text || ''
                                });
                            });
                            obj[key] = historyArray;
                        } else {
                            convertXmlObject(obj[key]);
                        }
                    }
                });

                return obj;
            };

            responseData = convertXmlObject(responseData);
        } else {
            // Nếu không phải XML, tạo response dạng chat đơn giản
            responseData = {
                action: 'chat',
                message: aiResponse.trim()
            };
        }

        // Thêm history vào response nếu chưa có
        if (!responseData.history) {
            // Tạo bản sao của chatHistory để tránh thay đổi tham số đầu vào
            const updatedHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
            
            // Thêm tin nhắn người dùng nếu chưa có trong history
            const lastUserMessage = updatedHistory.find(msg => 
                msg.role === 'user' && msg.content === message
            );
            
            if (!lastUserMessage) {
                updatedHistory.push({ role: 'user', content: message });
            }
            
            // Thêm phản hồi của AI nếu có
            if (responseData.message) {
                updatedHistory.push({ role: 'assistant', content: responseData.message });
            }
            
            responseData.history = updatedHistory;
        }

        return responseData;
    } catch (error) {
        console.error('Lỗi khi xử lý phản hồi của AI:', error);
        return {
            action: 'error',
            message: 'Lỗi khi xử lý phản hồi: ' + error.message
        };
    }
}

module.exports = {
    processWithAI,
    processAIResponse
}; 