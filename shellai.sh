#!/bin/bash

# shellai.sh - Script chính để tương tác với Shell.AI

# Tải các hàm từ shellai_functions.sh
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/shellai_functions.sh"

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

# Hàm xử lý phản hồi từ API
process_response() {
  local response="$1"
  
  # Kiểm tra phản hồi có dạng JSON hay không
  if ! (echo "$response" | jq '.' > /dev/null 2>&1); then
    error_log "Phản hồi không hợp lệ từ API"
    debug_log "Phản hồi nhận được: $response"
    return 1
  fi
  
  # Kiểm tra xem có lỗi không
  if echo "$response" | jq -e '.success == false' > /dev/null 2>&1; then
    error_message=$(echo "$response" | jq -r '.message // "Lỗi không xác định từ API"')
    error_log "Lỗi API: $error_message"
    debug_log "Phản hồi đầy đủ: $response"
    return 1
  fi
  
  # Trích xuất action, message và script từ phản hồi
  action=$(echo "$response" | jq -r '.action // ""')
  message=$(echo "$response" | jq -r '.message // ""')
  
  # Hiển thị thông báo nếu có
  if [ -n "$message" ]; then
    info_log "$message"
  fi
  
  # Kiểm tra action có tồn tại không
  if [ -z "$action" ]; then
    error_log "Phản hồi không có action"
    debug_log "Phản hồi đầy đủ: $response"
    return 1
  fi
  
  # Xử lý dựa trên action
  case "$action" in
    "run")
      # Trích xuất thông tin script
      filename=$(echo "$response" | jq -r '.script.filename // ""')
      content=$(echo "$response" | jq -r '.script.content // ""')
      type=$(echo "$response" | jq -r '.script.type // ""')
      description=$(echo "$response" | jq -r '.script.description // ""')
      prepare=$(echo "$response" | jq -r '.script.prepare // ""')
      
      # Kiểm tra install dependencies trước
      if [ -n "$prepare" ]; then
        install_dependencies "$prepare"
      fi
      
      # Tạo file script
      script_path="$SHELL_DIR/$filename"
      create_file "$script_path" "$content" "$type"
      
      # Hỏi người dùng có muốn thực thi không
      read -p "Bạn có muốn tạo file này không? (y/n): " answer
      
      if [[ "$answer" == "y" ]]; then
        # Thực thi script
        execute_file "$script_path" "$type" "" "$description"
        
        # Kiểm tra lỗi và hỏi có sửa không
        exit_status=$?
        if [ $exit_status -ne 0 ]; then
          read -p "File $script_path có lỗi. Bạn có muốn gửi thông tin lỗi đến AI để sửa không? (y/n): " fix_answer
          
          if [[ "$fix_answer" == "y" ]]; then
            script_content=$(cat "$script_path")
            error_message="Exit code: $exit_status"
            
            # Gửi yêu cầu sửa lỗi
            fix_response=$(fix_script_error "$MESSAGE" "$error_message" "$script_content")
            process_response "$fix_response"
          fi
        fi
        
        # Hỏi có muốn xóa file hay không
        read -p "Bạn có muốn giữ lại file $script_path? (y/n): " keep_answer
        if [[ "$keep_answer" != "y" ]]; then
          rm "$script_path"
          success_log "Đã xóa file $script_path"
        fi
      fi
      ;;
      
    "create")
      # Trích xuất thông tin script
      filename=$(echo "$response" | jq -r '.script.filename // ""')
      content=$(echo "$response" | jq -r '.script.content // ""')
      type=$(echo "$response" | jq -r '.script.type // ""')
      description=$(echo "$response" | jq -r '.script.description // ""')
      
      # Tạo file
      file_path="$filename"
      
      # Hỏi người dùng có muốn tạo file không
      info_log "Script này tạo file $filename với nội dung là $description"
      read -p "Bạn có muốn tạo file này không? (y/n): " answer
      
      if [[ "$answer" == "y" ]]; then
        create_file "$file_path" "$content" "$type"
      fi
      ;;
      
    "show"|"chat")
      # Trường hợp này đã hiển thị message ở trên
      ;;
      
    *)
      error_log "Action không hợp lệ: $action"
      ;;
  esac
}

# Chế độ chat
chat_mode() {
  info_log "Bắt đầu chế độ chat. Nhập 'exit' để thoát."
  
  # Khởi tạo lịch sử chat dưới dạng mảng JSON
  history='[]'
  
  while true; do
    # Đọc input từ người dùng
    read -p "Bạn: " user_input
    
    # Kiểm tra nếu người dùng muốn thoát
    if [[ "$user_input" == "exit" ]]; then
      break
    fi
    
    # Xử lý ký tự đặc biệt trong input của người dùng
    user_input_escaped=$(echo "$user_input" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g')
    
    # Cập nhật lịch sử chat với tin nhắn của người dùng
    history=$(echo "$history" | jq ". + [{\"role\": \"user\", \"content\": \"$user_input_escaped\"}]")
    
    # Gửi yêu cầu đến API
    response=$(handle_chat "$user_input" "false" "$history")
    
    # Xử lý phản hồi
    process_response "$response"
    
    # Trích xuất tin nhắn từ phản hồi
    message=$(echo "$response" | jq -r '.message // ""')
    
    # Xử lý ký tự đặc biệt trong tin nhắn của AI
    message_escaped=$(echo "$message" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g')
    
    # Cập nhật lịch sử chat với phản hồi của AI
    if [ -n "$message" ]; then
      history=$(echo "$history" | jq ". + [{\"role\": \"assistant\", \"content\": \"$message_escaped\"}]")
    fi
  done
  
  info_log "Đã kết thúc chế độ chat."
}

# Chế độ phát triển
dev_mode() {
  info_log "Bắt đầu chế độ phát triển. Nhập 'exit' để thoát hoặc 'help' để xem hướng dẫn."
  
  # Khởi tạo lịch sử chat dưới dạng mảng JSON
  history='[]'
  
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
    
    # Xử lý lệnh clear
    if [[ "$user_input" == "clear" ]]; then
      history='[]'
      info_log "Đã xóa lịch sử chat."
      continue
    fi
    
    # Kiểm tra các lệnh phân tích file
    if [[ "$user_input" =~ ^(analyze|phân\ tích|đọc)\ +(.+)$ ]]; then
      # Trích xuất đường dẫn file từ lệnh
      file_path="${BASH_REMATCH[2]}"
      file_path=$(echo "$file_path" | xargs) # Loại bỏ khoảng trắng thừa
      
      info_log "Phân tích file: $file_path"
      
      # Gọi hàm phân tích file
      analyze_response=$(analyze_file_or_error "$file_path" "" "Phân tích file theo yêu cầu của người dùng")
      
      # Kiểm tra nếu có lỗi
      if [[ $? -ne 0 ]]; then
        error_log "Không thể phân tích file. Vui lòng kiểm tra đường dẫn."
        continue
      fi
      
      # Xử lý phản hồi từ API
      process_response "$analyze_response"
      
      # Trích xuất tin nhắn từ phản hồi
      message=$(echo "$analyze_response" | jq -r '.message // ""')
      
      # Xử lý ký tự đặc biệt trong tin nhắn của AI
      message_escaped=$(echo "$message" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g')
      
      # Cập nhật lịch sử chat với phản hồi của AI
      if [ -n "$message" ]; then
        history=$(echo "$history" | jq ". + [{\"role\": \"assistant\", \"content\": \"$message_escaped\"}]")
      fi
      
      continue
    fi
    
    # Xử lý ký tự đặc biệt trong input của người dùng
    user_input_escaped=$(echo "$user_input" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g')
    
    # Cập nhật lịch sử chat với tin nhắn của người dùng
    history=$(echo "$history" | jq ". + [{\"role\": \"user\", \"content\": \"$user_input_escaped\"}]")
    
    # Gửi yêu cầu đến API
    response=$(handle_chat "$user_input" "true" "$history")
    
    # Xử lý phản hồi
    process_response "$response"
    
    # Trích xuất tin nhắn từ phản hồi
    message=$(echo "$response" | jq -r '.message // ""')
    
    # Xử lý ký tự đặc biệt trong tin nhắn của AI
    message_escaped=$(echo "$message" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g')
    
    # Cập nhật lịch sử chat với phản hồi của AI
    if [ -n "$message" ]; then
      history=$(echo "$history" | jq ". + [{\"role\": \"assistant\", \"content\": \"$message_escaped\"}]")
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
  echo "7. Lưu thay đổi"
  echo "8. Thoát"
  
  while true; do
    read -p "Chọn mục cần thay đổi (1-8): " choice
    
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
        save_config "$API_URL" "$SHELL_DIR" "$DEBUG" "$OPENAI_API_KEY" "$API_KEY" "$MODEL"
        echo "Cấu hình hiện tại:"
        echo "1. API URL: $API_URL"
        echo "2. Thư mục shell: $SHELL_DIR"
        echo "3. Debug: $DEBUG"
        echo "4. OpenAI API Key: ${OPENAI_API_KEY:0:5}..."
        echo "5. API Key: ${API_KEY:0:5}..."
        echo "6. Model: $MODEL"
        echo "7. Lưu thay đổi"
        echo "8. Thoát"
        ;;
      8)
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
    read -p "Bạn có muốn giữ lại file $script_path? (y/n): " keep_answer
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
      response=$(process_request "$MESSAGE" "run" "install" "")
      if echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*false'; then
        # Nếu có lỗi, chuyển sang chế độ offline
        warning_log "Không thể kết nối đến API server, chuyển sang chế độ offline"
        process_offline_command "$COMMAND ${PARAMS[*]}" "install"
      else
        process_response "$response"
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
      response=$(process_request "$MESSAGE" "create" "$type" "$filename")
      if echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*false'; then
        # Nếu có lỗi, chuyển sang chế độ offline
        warning_log "Không thể kết nối đến API server, chuyển sang chế độ offline"
        process_offline_command "$COMMAND $type $filename" "create"
      else
        process_response "$response"
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
        response=$(process_request "$custom_request" "run" "" "")
        if echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*false'; then
          # Nếu có lỗi, chuyển sang chế độ offline
          warning_log "Không thể kết nối đến API server, chuyển sang chế độ offline"
          process_offline_command "$custom_request" "custom"
        else
          process_response "$response"
        fi
      else
        # Không có message, tự tạo yêu cầu từ lệnh và tham số
        custom_request="$COMMAND ${PARAMS[*]}"
        info_log "Thực hiện lệnh tùy biến: $custom_request"
        response=$(process_request "$custom_request" "run" "" "")
        if echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*false'; then
          # Nếu có lỗi, chuyển sang chế độ offline
          warning_log "Không thể kết nối đến API server, chuyển sang chế độ offline"
          process_offline_command "$custom_request" "custom"
        else
          process_response "$response"
        fi
      fi
      ;;
  esac
}

# Thực thi main với tất cả tham số
main "$@"
