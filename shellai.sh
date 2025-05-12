#!/bin/bash

# shellai.sh - Script chính để tương tác với Shell.AI

# Tải các hàm từ shellai_functions.sh
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/shellai_functions.sh"

# Đảm bảo có gói xmllint để xử lý XML
ensure_xmllint() {
  if ! command -v xmllint &> /dev/null; then
    echo "Cài đặt công cụ xmllint để xử lý XML..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      brew install libxml2
    elif [[ -f /etc/debian_version ]]; then
      # Debian/Ubuntu
      sudo apt-get update && sudo apt-get install -y libxml2-utils
    elif [[ -f /etc/redhat-release ]]; then
      # RHEL/CentOS/Fedora
      sudo yum install -y libxml2
    else
      echo "Không thể tự động cài đặt xmllint. Vui lòng cài đặt thủ công gói libxml2."
    fi
  fi
}

# Gọi hàm đảm bảo có xmllint
ensure_xmllint

# Hàm hiển thị hướng dẫn sử dụng
show_usage() {
  echo "Cách sử dụng: $(basename "$0") [lệnh] [tham số] [-m \"mô tả\"] [--debug]
  
Các lệnh:
  install <pkg1> <pkg2> ...    Cài đặt các gói phần mềm
  check <service>              Kiểm tra trạng thái dịch vụ
  create file <tên file>       Tạo file mới
  chat                         Bắt đầu chế độ chat với AI
  dev                          Bắt đầu chế độ phát triển hệ thống
  config                       Xem và thay đổi cấu hình
  help                         Hiển thị hướng dẫn sử dụng

Các tùy chọn:
  -m, --message \"nội dung\"    Mô tả chi tiết yêu cầu
  --debug                      Hiển thị thông tin debug
  -h, --help                   Hiển thị hướng dẫn sử dụng

Ví dụ:
  $(basename "$0") install apache2 nginx -m \"Cài đặt web server\"
  $(basename "$0") check mysql
  $(basename "$0") create file index.html -m \"Tạo trang web đơn giản\"
  $(basename "$0") chat
  $(basename "$0") dev
  $(basename "$0") config
  $(basename "$0") -m \"Kiểm tra và hiển thị thông tin hệ thống\""
}

# Xử lý tham số dòng lệnh
parse_args() {
  COMMAND=""
  PARAMS=()
  MESSAGE=""
  
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -m|--message)
        MESSAGE="$2"
        shift 2
        ;;
      --debug)
        DEBUG=true
        shift
        ;;
      -h|--help)
        show_usage
        exit 0
        ;;
      *)
        if [ -z "$COMMAND" ]; then
          COMMAND="$1"
        else
          PARAMS+=("$1")
        fi
        shift
        ;;
    esac
  done
}

# Hàm trích xuất giá trị từ XML
xml_extract() {
  local xml="$1"
  local xpath="$2"
  local default="$3"
  
  # Sử dụng xmllint để trích xuất giá trị
  local value
  value=$(echo "$xml" | xmllint --xpath "$xpath" - 2>/dev/null)
  
  # Nếu trích xuất thất bại hoặc giá trị rỗng, trả về giá trị mặc định
  if [ $? -ne 0 ] || [ -z "$value" ]; then
    echo "$default"
  else
    # Loại bỏ thẻ XML và chỉ lấy nội dung
    echo "$value" | sed -e 's/<[^>]*>//g'
  fi
}

# Hàm chuyển đổi XML thành JSON
xml_to_json() {
  local xml="$1"
  
  # Kiểm tra xem có phải XML không
  if [[ "$xml" != *"<response>"* ]]; then
    # Nếu không phải XML, trả về nguyên mẫu
    echo "$xml"
    return
  fi
  
  # Sử dụng xmllint và các công cụ khác để chuyển đổi
  action=$(xml_extract "$xml" "string(//response/action)" "")
  message=$(xml_extract "$xml" "string(//response/message)" "")
  
  # Bắt đầu tạo JSON
  json="{"
  
  # Thêm action
  if [ -n "$action" ]; then
    json+="\"action\":\"$action\""
  fi
  
  # Thêm message nếu có
  if [ -n "$message" ]; then
    # Thêm dấu phẩy nếu đã có trường trước đó
    if [ "$json" != "{" ]; then
      json+=","
    fi
    
    # Escape các ký tự đặc biệt trong message
    message_escaped=$(echo "$message" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    json+="\"message\":\"$message_escaped\""
  fi
  
  # Kiểm tra xem có history không
  history_exists=$(echo "$xml" | grep -c "<history>")
  if [ "$history_exists" -gt 0 ]; then
    # Thêm dấu phẩy nếu đã có trường trước đó
    if [ "$json" != "{" ]; then
      json+=","
    fi
    
    # Bắt đầu trích xuất history
    json+="\"history\":["
    
    # Tìm tất cả các message trong history
    message_tags=$(echo "$xml" | grep -o "<message[^>]*>[^<]*</message>")
    
    first_message=true
    while IFS= read -r message_tag; do
      # Trích xuất role và content
      role=$(echo "$message_tag" | grep -o 'role="[^"]*"' | cut -d'"' -f2)
      content=$(echo "$message_tag" | sed -E 's/<message[^>]*>(.*)<\/message>/\1/')
      
      # Escape các ký tự đặc biệt trong content
      content_escaped=$(echo "$content" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
      
      # Thêm dấu phẩy nếu không phải message đầu tiên
      if [ "$first_message" = true ]; then
        first_message=false
      else
        json+=","
      fi
      
      # Thêm message vào history
      json+="{\"role\":\"$role\",\"content\":\"$content_escaped\"}"
    done <<< "$message_tags"
    
    json+="]"
  fi
  
  # Kiểm tra xem có script không
  script_exists=$(echo "$xml" | grep -c "<script>")
  if [ "$script_exists" -gt 0 ]; then
    # Thêm dấu phẩy nếu đã có trường trước đó
    if [ "$json" != "{" ]; then
      json+=","
    fi
    
    filename=$(xml_extract "$xml" "string(//response/script/filename)" "")
    content=$(xml_extract "$xml" "string(//response/script/content)" "")
    type=$(xml_extract "$xml" "string(//response/script/type)" "")
    description=$(xml_extract "$xml" "string(//response/script/description)" "")
    prepare=$(xml_extract "$xml" "string(//response/script/prepare)" "")
    
    # Escape các ký tự đặc biệt
    filename_escaped=$(echo "$filename" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    content_escaped=$(echo "$content" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    type_escaped=$(echo "$type" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    description_escaped=$(echo "$description" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    prepare_escaped=$(echo "$prepare" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    
    json+="\"script\":{\"filename\":\"$filename_escaped\",\"content\":\"$content_escaped\",\"type\":\"$type_escaped\",\"description\":\"$description_escaped\",\"prepare\":\"$prepare_escaped\"}"
  fi
  
  # Thêm confirm_message nếu có
  confirm_message=$(xml_extract "$xml" "string(//response/confirm_message)" "")
  if [ -n "$confirm_message" ]; then
    # Thêm dấu phẩy nếu đã có trường trước đó
    if [ "$json" != "{" ]; then
      json+=","
    fi
    
    # Escape các ký tự đặc biệt
    confirm_message_escaped=$(echo "$confirm_message" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    json+="\"confirm_message\":\"$confirm_message_escaped\""
  fi
  
  # Thêm script_output và original_question nếu có
  script_output=$(xml_extract "$xml" "string(//response/script_output)" "")
  original_question=$(xml_extract "$xml" "string(//response/original_question)" "")
  
  if [ -n "$script_output" ]; then
    # Thêm dấu phẩy nếu đã có trường trước đó
    if [ "$json" != "{" ]; then
      json+=","
    fi
    
    # Escape các ký tự đặc biệt
    script_output_escaped=$(echo "$script_output" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    json+="\"script_output\":\"$script_output_escaped\""
  fi
  
  if [ -n "$original_question" ]; then
    # Thêm dấu phẩy nếu đã có trường trước đó
    if [ "$json" != "{" ]; then
      json+=","
    fi
    
    # Escape các ký tự đặc biệt
    original_question_escaped=$(echo "$original_question" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
    json+="\"original_question\":\"$original_question_escaped\""
  fi
  
  # Đóng JSON
  json+="}"
  
  # Trả về JSON
  echo "$json"
}

# Hàm xử lý tự động nhiều bước
auto_solve() {
  local response="$1"
  local original_question="$2"
  local is_first_script="$3"

  # Kiểm tra phản hồi có dạng XML hay không
  if [[ "$response" == *"<response>"* ]]; then
    # Xử lý XML bằng cách chuyển đổi thành JSON
    debug_log "Phát hiện phản hồi XML, chuyển đổi sang JSON"
    converted_json=$(xml_to_json "$response")
    debug_log "Đã chuyển đổi XML sang JSON: $converted_json"
    
    # Gọi lại auto_solve với phản hồi JSON đã chuyển đổi
    auto_solve "$converted_json" "$original_question" "$is_first_script"
    return $?
  elif echo "$response" | jq '.' > /dev/null 2>&1; then
    # Xử lý JSON
    
    # Trích xuất action, message, script
    local action message filename content type description prepare
    action=$(echo "$response" | jq -r '.action // ""')
    message=$(echo "$response" | jq -r '.message // ""')

    if [ -n "$message" ]; then
      info_log "$message"
    fi

    if [[ "$action" == "done" || "$action" == "chat" || "$action" == "show" ]]; then
      return 0
    fi

    if [[ "$action" == "run" ]]; then
      filename=$(echo "$response" | jq -r '.script.filename // ""')
      content=$(echo "$response" | jq -r '.script.content // ""')
      type=$(echo "$response" | jq -r '.script.type // ""')
      description=$(echo "$response" | jq -r '.script.description // ""')
      prepare=$(echo "$response" | jq -r '.script.prepare // ""')

      # Tạo đường dẫn file trong thư mục shell
      script_path="$SHELL_DIR/$filename"
      
      # Hiển thị thông tin script và xác nhận
      if [ "$is_first_script" -eq 1 ]; then
        # Nếu đây là script đầu tiên, hỏi người dùng xác nhận trước khi thực thi
        confirm_message=$(echo "$response" | jq -r '.confirm_message // ""')
        if [ -n "$confirm_message" ]; then
          read -p "$confirm_message (y/n): " confirm_answer
        else
          read -p "Bạn có muốn thực thi script này không? (y/n): " confirm_answer
        fi
        
        if [[ "$confirm_answer" != "y" ]]; then
          info_log "Đã hủy thực thi script"
          return 0
        fi
      fi
      
      # Cài đặt các thư viện cần thiết nếu có
      if [ -n "$prepare" ]; then
        install_dependencies "$prepare"
      fi
      
      # Tạo file
      create_file "$script_path" "$content" "$type"
      
      # Thực thi file
      execute_file "$script_path" "$type" "" "$description"
      
      # Kiểm tra kết quả thực thi
      if [ $? -eq 0 ]; then
        success_log "Script thực thi thành công."
        # Nếu yêu cầu gốc có yêu cầu phân tích kết quả, thì đề xuất phân tích
        if [ -z "$original_question" ]; then
          return 0
        fi
        
        read -p "Bạn có muốn AI phân tích kết quả không? (y/n): " analyze_answer
        if [[ "$analyze_answer" != "y" ]]; then
          return 0
        fi
        
        # Phân tích kết quả
        info_log "Đang yêu cầu AI phân tích kết quả..."
        # Auto-solve tiếp tục được thực hiện ở đây nếu cần
      else
        error_log "Script thực thi thất bại."
        read -p "Bạn có muốn AI sửa lỗi script không? (y/n): " fix_answer
        if [[ "$fix_answer" != "y" ]]; then
          return 1
        fi
        
        # Sửa lỗi script
        info_log "Đang yêu cầu AI sửa lỗi script..."
        # Auto-solve tiếp tục được thực hiện ở đây nếu cần
      fi
    elif [[ "$action" == "analyze" ]]; then
      # Xử lý phân tích
      info_log "Đang thực hiện phân tích..."
      # Auto-solve tiếp tục được thực hiện ở đây nếu cần
    elif [[ "$action" == "create" ]]; then
      # Xử lý tạo file
      filename=$(echo "$response" | jq -r '.script.filename // ""')
      content=$(echo "$response" | jq -r '.script.content // ""')
      type=$(echo "$response" | jq -r '.script.type // ""')
      description=$(echo "$response" | jq -r '.script.description // ""')
      
      # Hỏi người dùng có muốn tạo file không
      read -p "Bạn có muốn tạo file $filename không? (y/n): " create_answer
      if [[ "$create_answer" != "y" ]]; then
        info_log "Đã hủy tạo file"
        return 0
      fi
      
      # Tạo file
      create_file "$filename" "$content" "$type"
      success_log "Đã tạo file $filename"
    else
      warning_log "Không xử lý được action: $action"
    fi
  else
    # Xử lý phản hồi không hợp lệ
    error_log "Phản hồi không hợp lệ, không thể tự động xử lý"
    debug_log "Phản hồi nhận được: $response"
    return 1
  fi
}

# Hàm xử lý phản hồi từ API
process_response() {
  local response="$1"
  
  # Kiểm tra phản hồi có dạng XML hay không
  if [[ "$response" == *"<response>"* ]]; then
    # Nếu phản hồi là XML, chuyển đổi sang JSON
    debug_log "Phát hiện phản hồi XML, chuyển đổi sang JSON"
    response=$(xml_to_json "$response")
    debug_log "Đã chuyển đổi phản hồi XML sang JSON: $response"
  fi
  
  # Xử lý phản hồi
  if echo "$response" | jq '.' > /dev/null 2>&1; then
    # Trích xuất action
    local action
    action=$(echo "$response" | jq -r '.action // ""')
    
    # Xử lý nếu action là error
    if [[ "$action" == "error" ]]; then
      # Trích xuất và hiển thị thông báo lỗi
      local error_message
      error_message=$(echo "$response" | jq -r '.message // "Lỗi không xác định"')
      error_log "$error_message"
    else
      # Xử lý phản hồi bình thường nếu không phải là lỗi
      auto_solve "$response" "$user_input" 1
    fi
  else
    # Xử lý phản hồi không hợp lệ
    error_log "Phản hồi không hợp lệ từ API"
    debug_log "Phản hồi nhận được: $response"
  fi
}

# Chế độ chat đơn giản
chat_mode() {
  info_log "Bắt đầu chế độ chat. Nhập 'exit' để thoát."
  
  # Khởi tạo lịch sử chat dưới dạng mảng JSON
  chat_history='[]'
  
  while true; do
    # Đọc input từ người dùng
    read -p "you> " user_input
    
    # Kiểm tra nếu người dùng muốn thoát
    if [[ "$user_input" == "exit" ]]; then
      break
    fi
    
    # Xử lý ký tự đặc biệt trong input của người dùng
    user_input_escaped=$(echo "$user_input" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed 's/\n/\\n/g')
    
    
    # Gửi yêu cầu đến API - Không xử lý phản hồi trong handle_chat
    response=$(handle_chat "$user_input" "false" "$chat_history" "$RETURN_TYPE" "false")
    response_raw="$response"

    # Cập nhật lịch sử chat với tin nhắn của người dùng
    chat_history=$(echo "$chat_history" | jq -c ". + [{\"role\": \"user\", \"content\": \"$user_input_escaped\"}]")


    # Kiểm tra phản hồi có dạng XML không, nếu có thì chuyển đổi sang JSON
    if [[ "$response" == *"<response>"* ]]; then
      debug_log "Phát hiện phản hồi XML trong chat, chuyển đổi sang JSON"
      response=$(xml_to_json "$response")
      debug_log "Đã chuyển đổi phản hồi XML sang JSON: $response"
    fi
    
    # Xử lý phản hồi
    if echo "$response" | jq '.' > /dev/null 2>&1; then
      # Trích xuất từ JSON
      message=$(echo "$response" | jq -r '.message // ""')
      action=$(echo "$response" | jq -r '.action // ""')
      
      # Hiển thị tin nhắn từ AI
      if [ -n "$message" ]; then
        echo -e "\nAI: $message\n"
      fi
      
      # Xử lý action nếu không phải chat hoặc show
      if [[ "$action" != "chat" && "$action" != "show" && "$action" != "error" ]]; then
        auto_solve "$response" "$user_input" 1
      fi
      
      # Kiểm tra nếu phản hồi có history
      if echo "$response" | jq -e '.history' > /dev/null 2>&1; then
        # Cập nhật lịch sử chat từ phản hồi
        chat_history=$(echo "$response" | jq '.history')
        debug_log "Cập nhật lịch sử chat từ phản hồi API"
      else
        # Xử lý ký tự đặc biệt trong tin nhắn của AI và cập nhật lịch sử chat
        if [ -n "$message" ]; then
          message_escaped=$(echo "$message" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed 's/\n/\\n/g')
          # Cập nhật lịch sử chat với phản hồi của AI
          chat_history=$(echo "$chat_history" | jq -c ". + [{\"role\": \"assistant\", \"content\": \"$message_escaped\"}]")
        fi
      fi
    else
      error_log "Phản hồi không hợp lệ từ API"
      debug_log "Phản hồi nhận được: $response"
    fi
  done
  
  info_log "Đã kết thúc chế độ chat."
}

# Chế độ phát triển
dev_mode() {
  info_log "Bắt đầu chế độ phát triển. Nhập 'exit' để thoát hoặc 'help' để xem hướng dẫn."
  
  # Khởi tạo lịch sử chat dưới dạng mảng JSON
  chat_history='[]'
  
  while true; do
    # Đọc input từ người dùng
    read -p "dev> " user_input
    
    # Kiểm tra nếu người dùng muốn thoát
    if [[ "$user_input" == "exit" ]]; then
      break
    fi
    
    # Kiểm tra nếu người dùng cần trợ giúp
    if [[ "$user_input" == "help" ]]; then
      echo "Các lệnh có sẵn trong chế độ phát triển:
  exit          - Thoát khỏi chế độ dev
  help          - Hiển thị trợ giúp này
  clear         - Xóa lịch sử chat
  analyze <file> - Phân tích nội dung file
  phân tích <file> - Phân tích nội dung file
  đọc <file>    - Đọc và phân tích nội dung file
  
Bạn có thể:
- Đặt câu hỏi với AI
- Yêu cầu AI tạo script để thực hiện tác vụ
- Yêu cầu AI phân tích file hoặc thông báo lỗi
- Yêu cầu AI sửa lỗi trong code của bạn"
      continue
    fi
    
    # Kiểm tra nếu người dùng muốn xóa lịch sử chat
    if [[ "$user_input" == "clear" ]]; then
      chat_history='[]'
      info_log "Đã xóa lịch sử chat."
      continue
    fi
    
    # Kiểm tra nếu người dùng muốn phân tích file
    if [[ "$user_input" == analyze\ * || "$user_input" == "phân tích"\ * || "$user_input" == "đọc"\ * ]]; then
      # Lấy tên file từ lệnh
      file_path=$(echo "$user_input" | awk '{print $2}')
      
      # Kiểm tra tên file hợp lệ
      if [ -z "$file_path" ]; then
        error_log "Thiếu tên file. Sử dụng: analyze <file>"
        continue
      fi
      
      # Kiểm tra file tồn tại
      if [ ! -f "$file_path" ]; then
        error_log "File không tồn tại: $file_path"
        continue
      fi
      
      # Đọc nội dung file
      file_content=$(cat "$file_path")
      
      # Xử lý ký tự đặc biệt trong nội dung file
      file_content_escaped=$(echo "$file_content" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed 's/\n/\\n/g')
      
      # Gửi yêu cầu phân tích file
      response=$(analyze_file_or_error "$file_path" "" "Phân tích file này và giải thích nó làm gì" "$RETURN_TYPE")
      response_raw=$response
      # Kiểm tra phản hồi có dạng XML không, nếu có thì chuyển đổi sang JSON
      if [[ "$response" == *"<response>"* ]]; then
        debug_log "Phát hiện phản hồi XML trong phân tích file, chuyển đổi sang JSON"
        response=$(xml_to_json "$response")
        debug_log "Đã chuyển đổi phản hồi XML sang JSON: $response"
      fi
      
      # Xử lý phản hồi
      if echo "$response" | jq '.' > /dev/null 2>&1; then
        # Trích xuất thông tin
        message=$(echo "$response" | jq -r '.message // ""')
        action=$(echo "$response" | jq -r '.action // ""')
        
        # Hiển thị phân tích
        if [ -n "$message" ]; then
          echo -e "\nKết quả phân tích:\n$message\n"
        fi
        
        # Xử lý action nếu cần
        if [[ "$action" != "chat" && "$action" != "show" && "$action" != "error" ]]; then
          auto_solve "$response" "Phân tích file $file_path" 1
        fi
        
        # Cập nhật lịch sử chat
        if [ -n "$message" ]; then
          # Lưu yêu cầu người dùng vào lịch sử
          user_input_escaped=$(echo "Phân tích file $file_path" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed 's/\n/\\n/g')
          chat_history=$(echo "$chat_history" | jq -c ". + [{\"role\": \"user\", \"content\": \"$user_input_escaped\"}]")
          
          # Lưu phản hồi AI vào lịch sử
          message_escaped=$(echo "$response_raw" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed 's/\n/\\n/g')
          chat_history=$(echo "$chat_history" | jq -c ". + [{\"role\": \"assistant\", \"content\": \"$message_escaped\"}]")
        fi
      else
        error_log "Phản hồi không hợp lệ từ API khi phân tích file"
        debug_log "Phản hồi nhận được: $response"
      fi
      
      continue
    fi
    
    # Xử lý ký tự đặc biệt trong input của người dùng
    user_input_escaped=$(echo "$user_input" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed 's/\n/\\n/g')
    
    # Gửi yêu cầu đến API - Không xử lý phản hồi trong handle_chat
    response=$(handle_chat "$user_input" "false" "$chat_history" "$RETURN_TYPE")
    

    # Cập nhật lịch sử chat với tin nhắn của người dùng
    chat_history=$(echo "$chat_history" | jq -c ". + [{\"role\": \"user\", \"content\": \"$user_input_escaped\"}]")

    # Kiểm tra phản hồi có dạng XML không, nếu có thì chuyển đổi sang JSON
    if [[ "$response" == *"<response>"* ]]; then
      debug_log "Phát hiện phản hồi XML trong dev mode, chuyển đổi sang JSON"
      response=$(xml_to_json "$response")
      debug_log "Đã chuyển đổi phản hồi XML sang JSON: $response"
    fi
    
    # Xử lý phản hồi
    if echo "$response" | jq '.' > /dev/null 2>&1; then
      # Trích xuất thông tin
      message=$(echo "$response" | jq -r '.message // ""')
      action=$(echo "$response" | jq -r '.action // ""')
      
      # Hiển thị tin nhắn từ AI
      if [ -n "$message" ]; then
        echo -e "\nAI: $message\n"
      fi

    
      
      # Xử lý action nếu không phải chat hoặc show
      if [[ "$action" != "chat" && "$action" != "show" && "$action" != "error" ]]; then
        auto_solve "$response" "$user_input" 1
      fi
      
      # Kiểm tra nếu phản hồi có history
      if echo "$response" | jq -e '.history' > /dev/null 2>&1; then
        # Cập nhật lịch sử chat từ phản hồi
        chat_history=$(echo "$response" | jq '.history')
        debug_log "Cập nhật lịch sử chat từ phản hồi API"
      else
        # Xử lý ký tự đặc biệt trong tin nhắn của AI và cập nhật lịch sử chat
        if [ -n "$message" ]; then
          message_escaped=$(echo "$message" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed 's/\n/\\n/g')
          # Cập nhật lịch sử chat với phản hồi của AI
          chat_history=$(echo "$chat_history" | jq -c ". + [{\"role\": \"assistant\", \"content\": \"$message_escaped\"}]")
        fi
      fi
    else
      error_log "Phản hồi không hợp lệ từ API"
      debug_log "Phản hồi nhận được: $response"
    fi
  done
  
  info_log "Đã kết thúc chế độ phát triển."
}

# Chế độ cài đặt
config_mode() {
  info_log "Cấu hình Shell.AI"
  
  # Đọc cấu hình hiện tại
  load_config
  
  echo "Cấu hình hiện tại:"
  echo "1. API URL: $API_URL"
  echo "2. Thư mục shell: $SHELL_DIR"
  echo "3. Debug: $DEBUG"
  echo "4. OpenAI API Key: ${OPENAI_API_KEY:0:5}..."
  echo "5. API Key: ${API_KEY:0:5}..."
  echo "6. Model: $MODEL"
  echo "7. Định dạng phản hồi (json/xml): $RETURN_TYPE"
  echo "8. Lưu thay đổi"
  echo "9. Thoát"
  
  while true; do
    read -p "Chọn mục cần thay đổi (1-9): " choice
    
    case $choice in
      1)
        read -p "Nhập API URL mới [$API_URL]: " new_api_url
        if [ -n "$new_api_url" ]; then
          API_URL="$new_api_url"
        fi
        ;;
      2)
        read -p "Nhập thư mục shell mới [$SHELL_DIR]: " new_shell_dir
        if [ -n "$new_shell_dir" ]; then
          SHELL_DIR="$new_shell_dir"
        fi
        ;;
      3)
        read -p "Debug mode (true/false) [$DEBUG]: " new_debug
        if [ -n "$new_debug" ]; then
          DEBUG="$new_debug"
        fi
        ;;
      4)
        read -p "Nhập OpenAI API Key mới [(hidden)]: " new_openai_api_key
        if [ -n "$new_openai_api_key" ]; then
          OPENAI_API_KEY="$new_openai_api_key"
        fi
        ;;
      5)
        read -p "Nhập API Key mới [(hidden)]: " new_api_key
        if [ -n "$new_api_key" ]; then
          API_KEY="$new_api_key"
        fi
        ;;
      6)
        read -p "Nhập Model mới [$MODEL]: " new_model
        if [ -n "$new_model" ]; then
          MODEL="$new_model"
        fi
        ;;
      7)
        read -p "Định dạng phản hồi (json/xml) [$RETURN_TYPE]: " new_return_type
        if [ -n "$new_return_type" ]; then
          if [[ "$new_return_type" == "json" || "$new_return_type" == "xml" ]]; then
            RETURN_TYPE="$new_return_type"
          else
            error_log "Định dạng phản hồi không hợp lệ. Vui lòng chọn 'json' hoặc 'xml'."
          fi
        fi
        ;;
      8)
        save_config "$API_URL" "$SHELL_DIR" "$DEBUG" "$OPENAI_API_KEY" "$API_KEY" "$MODEL" "$RETURN_TYPE"
        echo "Cấu hình hiện tại:"
        echo "1. API URL: $API_URL"
        echo "2. Thư mục shell: $SHELL_DIR"
        echo "3. Debug: $DEBUG"
        echo "4. OpenAI API Key: ${OPENAI_API_KEY:0:5}..."
        echo "5. API Key: ${API_KEY:0:5}..."
        echo "6. Model: $MODEL"
        echo "7. Định dạng phản hồi (json/xml): $RETURN_TYPE"
        echo "8. Lưu thay đổi"
        echo "9. Thoát"
        ;;
      9)
        break
        ;;
      *)
        error_log "Lựa chọn không hợp lệ"
        ;;
    esac
  done
}

# Hàm tạo script đơn giản khi không kết nối được đến API
create_simple_script() {
  local command="$1"
  local filename="simple_script_$(date +%Y%m%d%H%M%S).sh"
  local script_path="$SHELL_DIR/$filename"
  
  # Tạo script đơn giản
  local script_content="#!/bin/bash\n\n"
  script_content+="# Script tạo tự động cho lệnh: $command\n\n"
  script_content+="# Hiển thị thông báo\n"
  script_content+="echo \"Thực thi lệnh: $command\"\n\n"
  
  # Chuyển đổi các thành phần của lệnh thành lệnh thực thi
  IFS=' ' read -ra CMD_PARTS <<< "$command"
  
  if [ ${#CMD_PARTS[@]} -gt 0 ]; then
    script_content+="# Thực thi lệnh\n"
    script_content+="echo \"Lệnh thực thi:\"\n"
    script_content+="echo \"${CMD_PARTS[*]}\"\n\n"
    script_content+="# Đây là nơi thực thi lệnh thực tế\n"
    script_content+="# Bỏ comment dòng dưới đây nếu bạn muốn thực thi lệnh\n"
    script_content+="# ${CMD_PARTS[*]}\n"
  fi
  
  # Tạo file script
  mkdir -p "$(dirname "$script_path")"
  echo -e "$script_content" > "$script_path"
  chmod +x "$script_path"
  
  # Trả về đường dẫn đầy đủ của script
  echo "$script_path"
}

# Hàm xử lý lệnh tùy biến trong chế độ offline
process_offline_command() {
  local command="$1"
  local type="$2"
  
  # Tạo script đơn giản
  local script_path=$(create_simple_script "$command")
  
  # Lấy tên file từ đường dẫn
  local filename=$(basename "$script_path")
  
  # Hiển thị thông tin
  info_log "Đã tạo script đơn giản: $script_path"
  info_log "Lưu ý: Đây là script đơn giản được tạo tự động khi không kết nối được đến API."
  
  # Hiển thị thông tin mô tả
  local description="Script đơn giản cho lệnh: $command"
  
  # Hỏi người dùng có muốn thực thi không
  read -p "Bạn có muốn thực thi file này không? (y/n): " answer
  
  if [[ "$answer" == "y" ]]; then
    # Thực thi script
    execute_file "$script_path" "sh" "" "$description"
    
    # Hỏi có muốn xóa file hay không
    read -p "Bạn có muốn giữ lại file $script_path không? (y/n): " keep_answer
    if [[ "$keep_answer" != "y" ]]; then
      rm "$script_path"
      success_log "Đã xóa file $script_path"
    fi
  fi
}

# Hàm main
main() {
  # Tải cấu hình
  load_config
  
  # Kiểm tra curl
  check_curl
  
  # Kiểm tra jq - cần thiết cho xử lý lịch sử chat
  check_jq
  
  # Phân tích tham số
  parse_args "$@"
  
  # Nếu không có lệnh, hiển thị hướng dẫn và thoát
  if [ -z "$COMMAND" ] && [ -z "$MESSAGE" ]; then
    dev_mode
    exit 0
  fi
  
  # Xử lý lệnh
  case "$COMMAND" in
    "install")
      if [ ${#PARAMS[@]} -eq 0 ]; then
        error_log "Thiếu tên gói cần cài đặt"
        show_usage
        exit 1
      fi
      
      # Tạo nội dung yêu cầu
      if [ -z "$MESSAGE" ]; then
        MESSAGE="Cài đặt các gói phần mềm: ${PARAMS[*]}"
      fi
      
      # Gửi yêu cầu với action = run
      response=$(process_request "$MESSAGE" "run" "install" "" "$RETURN_TYPE")
      if echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*false'; then
        # Nếu có lỗi, chuyển sang chế độ offline
        warning_log "Không thể kết nối đến API server, chuyển sang chế độ offline"
        process_offline_command "$COMMAND ${PARAMS[*]}" "install"
      else
        auto_solve "$response" "$MESSAGE" 1
      fi
      ;;
      
    "check")
      if [ ${#PARAMS[@]} -eq 0 ]; then
        error_log "Thiếu tên dịch vụ cần kiểm tra"
        show_usage
        exit 1
      fi
      
      # Sử dụng hàm check_service mới
      service_name=${PARAMS[0]}
      additional_info=${PARAMS[*]:1}  # Lấy tất cả các tham số còn lại
      
      info_log "Kiểm tra dịch vụ: $service_name"
      check_service "$service_name" "$additional_info"
      ;;
      
    "create")
      if [ ${#PARAMS[@]} -lt 2 ]; then
        error_log "Thiếu thông tin file cần tạo"
        show_usage
        exit 1
      fi
      
      type=${PARAMS[0]}
      filename=${PARAMS[1]}
      
      # Tạo nội dung yêu cầu
      if [ -z "$MESSAGE" ]; then
        MESSAGE="Tạo file $filename"
      fi
      
      # Gửi yêu cầu với action = create
      response=$(process_request "$MESSAGE" "create" "$type" "$filename" "$RETURN_TYPE")
      if echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*false'; then
        # Nếu có lỗi, chuyển sang chế độ offline
        warning_log "Không thể kết nối đến API server, chuyển sang chế độ offline"
        process_offline_command "$COMMAND $type $filename" "create"
      else
        auto_solve "$response" "$MESSAGE" 1
      fi
      ;;
      
    "chat")
      chat_mode
      ;;
      
    "dev")
      dev_mode
      ;;
      
    "config")
      config_mode
      ;;
      
    "help")
      show_usage
      ;;
      
    *)
      if [ -n "$MESSAGE" ]; then
        # Nếu có message, sử dụng message làm yêu cầu
        custom_request="$COMMAND ${PARAMS[*]}: $MESSAGE"
        info_log "Thực hiện lệnh tùy biến: $custom_request"
        response=$(process_request "$custom_request" "run" "" "" "$RETURN_TYPE")
        if echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*false'; then
          # Nếu có lỗi, chuyển sang chế độ offline
          warning_log "Không thể kết nối đến API server, chuyển sang chế độ offline"
          process_offline_command "$custom_request" "custom"
        else
          auto_solve "$response" "$MESSAGE" 1
        fi
      else
        # Không có message, tự tạo yêu cầu từ lệnh và tham số
        custom_request="$COMMAND ${PARAMS[*]}"
        info_log "Thực hiện lệnh tùy biến: $custom_request"
        response=$(process_request "$custom_request" "run" "" "" "$RETURN_TYPE")
        if echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*false'; then
          # Nếu có lỗi, chuyển sang chế độ offline
          warning_log "Không thể kết nối đến API server, chuyển sang chế độ offline"
          process_offline_command "$custom_request" "custom"
        else
          auto_solve "$response" "$MESSAGE" 1
        fi
      fi
      ;;
  esac
}

# Thực thi main với tất cả tham số
main "$@"
