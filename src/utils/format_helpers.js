/**
 * Các hàm tiện ích để xử lý định dạng phản hồi XML/JSON
 */

/**
 * Tạo định dạng mẫu và hướng dẫn cho prompts
 * @param {string} promptType - Loại prompt (standard, script, fix, auto_solve)
 * @returns {Object} Định dạng mẫu và hướng dẫn
 */
function getFormatTemplate(promptType = 'standard') {
  const format = {};
  
  // Hướng dẫn cố định cho XML
  format.instructions = 'không sử dụng ký tự xuống dòng trong nội dung các thẻ';

  // Định dạng mẫu phụ thuộc vào loại prompt
  if (promptType === 'script' || promptType === 'standard') {
    format.template = `<response>
  <action>run|create|chat|show|done|analyze</action>
  <message>Giải thích ngắn gọn về kết quả xử lý</message>
  
  <!-- Ví dụ khi action là "run" - tạo và thực thi script -->
  <script>
    <filename>tên_file.js</filename>
    <content>nội dung file đầy đủ, không bị cắt ngắn</content>
    <type>js</type>
    <description>mô tả ngắn về tác dụng của file</description>
    <prepare>các lệnh cài đặt thư viện cần thiết (nếu có)</prepare>
  </script>
  <confirm_message>Câu hỏi xác nhận thân thiện, ví dụ: Bạn có muốn kiểm tra cấu hình hệ thống không?</confirm_message>

  <!-- HOẶC ví dụ khi action là "create" - tạo file nội dung tĩnh trực tiếp -->
  <script>
    <filename>index.html</filename>
    <content>nội dung file HTML đầy đủ, không bị cắt ngắn</content>
    <type>html</type>
    <description>mô tả ngắn về nội dung file</description>
    <!-- KHÔNG có trường prepare cho action create -->
  </script>
</response>`;
  } else if (promptType === 'fix') {
    format.template = `<response>
  <action>run</action>
  <message>Giải thích về lỗi và cách bạn đã sửa nó</message>
  <script>
    <filename>tên_file.sh</filename>
    <content>nội dung file đã sửa đầy đủ, không bị cắt ngắn</content>
    <type>sh</type>
    <description>mô tả ngắn về tác dụng của file</description>
    <prepare>các lệnh cài đặt thư viện cần thiết (nếu có)</prepare>
  </script>
</response>`;
  } else if (promptType === 'auto_solve') {
    format.template = `<response>
  <action>run|analyze|create|done|chat</action>
  <message>Nội dung phản hồi cho người dùng, bao gồm phân tích output và đề xuất</message>
  <script>
    <filename>tên_file.js</filename>
    <content>nội dung file đầy đủ</content>
    <type>js</type>
    <description>mô tả ngắn về tác dụng của file</description>
    <prepare>các lệnh cài đặt thư viện cần thiết (nếu có)</prepare>
  </script>
  <confirm_message>Câu hỏi xác nhận mục đích kiểm tra</confirm_message>
</response>`;
  }

  return format;
}

/**
 * Chuẩn bị nội dung prompt trước khi gửi đến AI
 * @param {string} promptTemplate - Template gốc
 * @param {Object} params - Tham số cần thay thế
 * @param {string} promptType - Loại prompt
 * @returns {string} Prompt đã được chuẩn bị
 */
function preparePrompt(promptTemplate, params = {}, promptType = 'standard') {
  // Lấy định dạng mẫu và hướng dẫn
  const { template, instructions } = getFormatTemplate(promptType);
  
  // Thêm tham số định dạng vào params
  params.return_type = 'xml';
  params.return_type_format = template;
  params.return_type_instructions = instructions;
  
  // Thay thế các tham số trong template
  let preparedPrompt = promptTemplate;
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{${key}}`;
    preparedPrompt = preparedPrompt.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return preparedPrompt;
}

module.exports = {
  getFormatTemplate,
  preparePrompt
}; 