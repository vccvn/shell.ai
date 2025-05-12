#!/bin/bash

# shellai_functions.sh - Các hàm tiện ích cho Shell.AI

# Biến môi trường
CONFIG_FILE="$HOME/.shellai_config.json"
API_URL="http://localhost:3000/api/agent"
SHELL_DIR="./src/shell"
DEBUG=false
OPENAI_API_KEY=""
API_KEY=""
MODEL="gpt-4"
RETURN_TYPE="json" # Thêm mặc định cho kiểu dữ liệu trả về

# Hàm debug log
debug_log() {
  if [ "$DEBUG" = true ]; then
    printf "[DEBUG] %s\n" "$1" >&2
  fi
}

# Hàm error log
error_log() {
  printf "\033[31m[LỖI]\033[0m %s\n" "$1" >&2
}

# Hàm success log
success_log() {
  printf "\033[32m[THÀNH CÔNG]\033[0m %s\n" "$1"
}

# Hàm info log
info_log() {
  printf "\033[34m[THÔNG TIN]\033[0m %s\n" "$1"
}

# Hàm warning log
warning_log() {
  printf "\033[33m[CẢNH BÁO]\033[0m %s\n" "$1"
}

# Hàm processing log
processing_log() {
  printf "\033[33m[ĐANG XỬ LÝ]\033[0m %s\n" "$1"
}

# Hàm kiểm tra cài đặt curl
check_curl() {
  if ! command -v curl &> /dev/null; then
    error_log "curl chưa được cài đặt. Đang cài đặt..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # MacOS
      brew install curl
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      # Linux
      if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y curl
      elif command -v yum &> /dev/null; then
        sudo yum install -y curl
      else
        error_log "Không thể cài đặt curl tự động. Vui lòng cài đặt thủ công."
        exit 1
      fi
    else
      error_log "Không thể cài đặt curl tự động trên hệ điều hành này. Vui lòng cài đặt thủ công."
      exit 1
    fi
  fi
}

# Hàm kiểm tra cài đặt jq
check_jq() {
  if ! command -v jq &> /dev/null; then
    warning_log "jq chưa được cài đặt. Đang cài đặt..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # MacOS
      brew install jq
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      # Linux
      if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y jq
      elif command -v yum &> /dev/null; then
        sudo yum install -y jq
      else
        error_log "Không thể cài đặt jq tự động. Vui lòng cài đặt thủ công."
        exit 1
      fi
    else
      error_log "Không thể cài đặt jq tự động trên hệ điều hành này. Vui lòng cài đặt thủ công."
      exit 1
    fi
    success_log "Đã cài đặt jq thành công."
  fi
}

# Hàm thu thập thông tin hệ thống
get_system_info() {
  # Lấy thông tin hệ điều hành
  os_type=$(uname -s)
  os_version=$(uname -r)
  
  # Nếu là macOS, lấy tên và version chuẩn
  if [[ "$os_type" == "Darwin" ]]; then
    if command -v sw_vers &> /dev/null; then
      os_type="macOS"
      os_version=$(sw_vers -productVersion)
    fi
  fi
  
  # Lấy thông tin kiến trúc
  arch=$(uname -m)
  
  # Lấy hostname và username
  hostname=$(hostname)
  username=$(whoami)
  
  # Kiểm tra các package manager
  package_managers=""
  
  if command -v apt &> /dev/null; then
    package_managers+="apt "
  fi
  
  if command -v yum &> /dev/null; then
    package_managers+="yum "
  fi
  
  if command -v brew &> /dev/null; then
    package_managers+="brew "
  fi
  
  if command -v pacman &> /dev/null; then
    package_managers+="pacman "
  fi
  
  if command -v dnf &> /dev/null; then
    package_managers+="dnf "
  fi
  
  # Kiểm tra ngôn ngữ lập trình
  languages=""
  
  if command -v node &> /dev/null; then
    languages+="nodejs "
  fi
  
  if command -v python3 &> /dev/null; then
    languages+="python "
  fi
  
  if command -v php &> /dev/null; then
    languages+="php "
  fi
  
  if command -v ruby &> /dev/null; then
    languages+="ruby "
  fi
  
  if command -v go &> /dev/null; then
    languages+="go "
  fi
  
  # Kiểm tra web server
  web_servers=""
  
  if command -v nginx &> /dev/null; then
    web_servers+="nginx "
  fi
  
  if command -v apache2 &> /dev/null || command -v httpd &> /dev/null; then
    web_servers+="apache "
  fi
  
  # Kiểm tra database
  databases=""
  
  if command -v mysql &> /dev/null; then
    databases+="mysql "
  fi
  
  if command -v psql &> /dev/null; then
    databases+="postgresql "
  fi
  
  if command -v mongod &> /dev/null; then
    databases+="mongodb "
  fi
  
  if command -v redis-cli &> /dev/null; then
    databases+="redis "
  fi
  
  # Trả về dưới dạng JSON
  echo "{ \"os_type\": \"$os_type\", \"os_version\": \"$os_version\", \"arch\": \"$arch\", \"user\": \"$username\", \"hostname\": \"$hostname\", \"package_managers\": \"$package_managers\", \"languages\": \"$languages\", \"web_servers\": \"$web_servers\", \"databases\": \"$databases\" }"
}

# Hàm gửi yêu cầu đến API server
send_api_request() {
  local endpoint="$1"
  local data="$2"
  local return_type="${3:-json}" # Thêm tham số return_type, mặc định là "json"
  
  # Tạo headers với API keys
  local headers="-H \"Content-Type: application/json\""
  
  if [ -n "$OPENAI_API_KEY" ]; then
    headers+=" -H \"openai_api_key: $OPENAI_API_KEY\""
  fi
  
  if [ -n "$API_KEY" ]; then
    headers+=" -H \"api_key: $API_KEY\""
  fi
  
  if [ -n "$MODEL" ]; then
    headers+=" -H \"model: $MODEL\""
  fi
  
  # Thêm header return_type để API trả về định dạng chỉ định
  headers+=" -H \"return_type: $return_type\""
  
  debug_log "Gửi yêu cầu đến API server"
  debug_log "POST $API_URL/$endpoint"
  debug_log "Headers: $headers"
  debug_log "Body: $data"
  debug_log "Return Type: $return_type"
  
  # Thực hiện request với headers
  response=$(eval "curl -s -X POST \"$API_URL/$endpoint\" $headers -d '$data' --max-time 30")
  
  debug_log "Nhận phản hồi: $response"
  
  # Kiểm tra nếu phản hồi là XML
  if [[ "$response" == *"<response>"* && "$response" == *"<script>"* && "$response" == *"<content>"* ]]; then
    debug_log "Phát hiện nội dung script trong phản hồi XML, xử lý các ký tự escape"
    
    # Nếu có xmllint, sử dụng để trích xuất content
    if command -v xmllint &> /dev/null; then
      # Trích xuất nội dung script
      local script_content=$(echo "$response" | xmllint --xpath "string(//response/script/content)" - 2>/dev/null)
      
      if [[ -n "$script_content" ]]; then
        # Xử lý script content
        local processed_content=$(process_script_content "$script_content")
        
        # Thay thế nội dung trong XML
        # Sử dụng sed để thay thế, đảm bảo xử lý đúng với các ký tự đặc biệt
        local escaped_content=$(echo "$processed_content" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g; s/'"'"'/\&apos;/g')
        response=$(echo "$response" | sed -e "s|<content>.*</content>|<content>$escaped_content</content>|")
        
        debug_log "Đã xử lý nội dung script trong phản hồi XML"
      fi
    else
      debug_log "Không có xmllint để xử lý XML. Nội dung script sẽ được xử lý khi tạo file."
    fi
  # Kiểm tra nếu phản hồi là JSON (tương thích ngược)
  elif command -v jq &> /dev/null && [[ "$response" == *"\"script\""* && "$response" == *"\"content\""* ]]; then
    debug_log "Phát hiện nội dung script trong phản hồi JSON, xử lý các ký tự escape"
    
    # Trích xuất và xử lý nội dung script
    local script_content=$(echo "$response" | jq -r '.script.content // empty')
    
    if [[ -n "$script_content" ]]; then
      # Xử lý script content
      local processed_content=$(process_script_content "$script_content")
      
      # Tạo phản hồi mới với nội dung đã xử lý
      response=$(echo "$response" | jq --arg content "$processed_content" '.script.content = $content')
      
      debug_log "Đã xử lý nội dung script trong phản hồi JSON"
    fi
  elif [[ "$response" == *"\"script\""* && "$response" == *"\"content\""* ]]; then
    # Nếu không có jq, giữ nguyên phản hồi nhưng thông báo để xử lý ở bước tạo file
    debug_log "Không có công cụ để xử lý phản hồi. Nội dung script sẽ được xử lý khi tạo file."
  fi
  
  echo "$response"
}

# Hàm xử lý các ký tự escape trong nội dung script
process_script_content() {
  local content="$1"
  
  # Thay thế các chuỗi \n thành ký tự xuống dòng thực tế
  # Sử dụng printf để xử lý escape sequences
  # Nếu nội dung chứa nhiều dấu escape, sử dụng printf
  if [[ "$content" == *\\n* || "$content" == *\\t* || "$content" == *\\r* ]]; then
    debug_log "Phát hiện ký tự escape trong nội dung, đang xử lý..."
    # Đảm bảo dấu \ được bảo vệ
    # Lưu ý: phải thay thế dấu gạch chéo trước để tránh xung đột
    content="${content//\\/\\\\}"  # Thay thế \ thành \\
    content="${content//\\\\\\\\/\\\\}"  # Sửa lại các trường hợp \\ đã bị thay thành \\\\
    
    # Sau đó thay thế các chuỗi escape để printf xử lý
    content="${content//\\\\n/\\n}"  # Thay thế \\n thành \n
    content="${content//\\\\t/\\t}"  # Thay thế \\t thành \t
    content="${content//\\\\r/\\r}"  # Thay thế \\r thành \r
    
    # Sử dụng printf để xử lý các escape sequences
    content=$(printf "%b" "$content")
  fi
  
  echo "$content"
}

# Hàm xử lý yêu cầu từ người dùng
process_request() {
  local issue="$1"
  local action="$2"
  local type="$3"
  local filename="$4"
  local return_type="${5:-json}" # Thêm tham số return_type, mặc định là "json"
  
  # Thu thập thông tin hệ thống
  system_info=$(get_system_info)
  
  # Tạo JSON data gửi đi
  request_data="{
    \"issue\": \"$issue\",
    \"action\": \"$action\",
    \"suggest_type\": \"sh\",
    \"system_info\": $system_info"
  
  if [ -n "$type" ]; then
    request_data+=",
    \"type\": \"$type\""
  fi
  
  if [ -n "$filename" ]; then
    request_data+=",
    \"filename\": \"$filename\""
  fi
  
  # Thêm return_type vào request data
  request_data+=",
    \"return_type\": \"$return_type\""
  
  request_data+="
  }"
  
  # Gửi request
  response=$(send_api_request "process" "$request_data" "$return_type")
  
  # Trả về response
  echo "$response"
}

# Hàm sửa lỗi script
fix_script_error() {
  local issue="$1"
  local error_message="$2"
  local script_content="$3"
  local return_type="${4:-json}" # Thêm tham số return_type, mặc định là "json"
  
  # Thu thập thông tin hệ thống
  system_info=$(get_system_info)
  
  # Tạo JSON data gửi đi
  request_data="{
    \"issue\": \"$issue\",
    \"error\": \"$error_message\",
    \"script\": \"$script_content\",
    \"suggest_type\": \"sh\",
    \"system_info\": $system_info,
    \"return_type\": \"$return_type\"
  }"
  
  # Gửi request
  response=$(send_api_request "fix" "$request_data" "$return_type")
  
  # Trả về response
  echo "$response"
}

# Hàm xử lý phản hồi cho chế độ dev
handle_dev_response() {
  local response="$1"
  local user_input="$2"
  local should_display="${3:-true}"
  
  # Kiểm tra xem phản hồi có phải XML không
  if [[ "$response" == *"<response>"* ]]; then
    # Xử lý XML
    local message action
    message=$(xml_extract "$response" "string(//response/message)" "")
    action=$(xml_extract "$response" "string(//response/action)" "")
    
    # Hiển thị thông báo nếu cần
    if [ "$should_display" = "true" ] && [ -n "$message" ]; then
      info_log "$message"
    fi
    
    # Nếu action là error, dừng xử lý
    if [[ "$action" == "error" ]]; then
      return 0
    fi
    
    # Xử lý auto_solve nếu cần
    if [ "$should_display" = "true" ]; then
      auto_solve "$response" "$user_input" 1
    fi
    return 0
  elif echo "$response" | jq '.' > /dev/null 2>&1; then
    # Phản hồi là JSON hợp lệ, xử lý
    local message action
    
    message=$(echo "$response" | jq -r '.message // ""')
    action=$(echo "$response" | jq -r '.action // ""')
    
    # Hiển thị thông báo nếu cần
    if [ "$should_display" = "true" ] && [ -n "$message" ]; then
      info_log "$message"
    fi
    
    # Auto solve nếu cần
    if [ "$should_display" = "true" ]; then
      auto_solve "$response" "$user_input" 1
    fi
    return 0
  else
    # Phản hồi không phải XML hợp lệ hoặc JSON hợp lệ
    error_log "Phản hồi không hợp lệ từ API"
    debug_log "Phản hồi nhận được: $response"
    return 1
  fi
}

# Hàm xử lý cho chế độ dev
handle_chat() {
  local message="$1"
  local suggest_type="$2"
  local chat_history="$3"
  local return_type="${4:-json}" # Thêm tham số return_type, mặc định là "json"
  local should_display="${5:-false}" # Thêm tham số should_display, mặc định là "false"
  
  # Kiểm tra xem có phải chế độ dev không
  local mode="chat"
  if [[ "${suggest_type}" == "true" ]]; then
    mode="dev"
  fi
  
  # Thu thập thông tin hệ thống
  local system_info
  system_info=$(get_system_info)
  
  # Chuẩn bị dữ liệu request
  request_data="{
    \"message\": \"$message\",
    \"suggest_type\": \"sh\",
    \"system_info\": $system_info,
    \"mode\": \"$mode\",
    \"chat_history\": $chat_history,
    \"return_type\": \"$return_type\"
  }"
  
  debug_log "Request data chat: $request_data"
  
  # Gửi request và nhận phản hồi
  response=$(send_api_request "chat" "$request_data" "$return_type")
  
  # Xử lý lỗi kết nối
  if [ -z "$response" ]; then
    error_log "Không thể kết nối đến API server. Vui lòng kiểm tra kết nối mạng hoặc địa chỉ API server."
    return 1
  fi
  
  # Xử lý phản hồi
  if [[ "${suggest_type}" == "true" && "$should_display" == "true" ]]; then
    # Chế độ dev, xử lý phản hồi và hiển thị thông báo
    handle_dev_response "$response" "$message" "true"
  fi
  
  echo "$response"
}

# Hàm tạo file
create_file() {
  local file_path="$1"
  local content="$2"
  local file_type="$3"
  
  # Đảm bảo thư mục cha tồn tại
  mkdir -p "$(dirname "$file_path")"
  
  # Xử lý nội dung script để thay thế các ký tự escape
  local processed_content=$(process_script_content "$content")
  
  # Ghi nội dung đã xử lý vào file
  echo "$processed_content" > "$file_path"
  
  # Nếu là script, đặt quyền thực thi
  if [ "$file_type" = "sh" ] || [ "$file_type" = "py" ]; then
    chmod +x "$file_path"
  fi
  
  success_log "Đã tạo file $file_path"
}

# Hàm thực thi file
execute_file() {
  local file_path="$1"
  local file_type="$2"
  local args="$3"
  local description="$4"
  
  # Hiển thị mô tả nếu có
  if [ -n "$description" ]; then
    info_log "$description"
  fi
  
  # Thực thi file dựa trên loại
  case "$file_type" in
    "sh"|"bash")
      processing_log "Thực thi script bash $file_path"
      if [ -n "$args" ]; then
        bash "$file_path" $args
      else
        bash "$file_path"
      fi
      ;;
    "js"|"javascript")
      processing_log "Thực thi script Node.js $file_path"
      if [ -n "$args" ]; then
        node "$file_path" $args
      else
        node "$file_path"
      fi
      ;;
    "py"|"python")
      processing_log "Thực thi script Python $file_path"
      if [ -n "$args" ]; then
        python3 "$file_path" $args
      else
        python3 "$file_path"
      fi
      ;;
    *)
      error_log "Không hỗ trợ thực thi file loại $file_type"
      return 1
      ;;
  esac
  
  # Kiểm tra trạng thái kết thúc
  local exit_status=$?
  if [ $exit_status -eq 0 ]; then
    success_log "Thực thi thành công file $file_path"
    return 0
  else
    error_log "Thực thi file $file_path thất bại với mã lỗi $exit_status"
    return $exit_status
  fi
}

# Hàm cài đặt các phụ thuộc
install_dependencies() {
  local prepare_commands="$1"
  
  if [ -z "$prepare_commands" ]; then
    return 0
  fi
  
  processing_log "Cài đặt các phụ thuộc..."
  
  # Thực thi từng lệnh
  IFS=';' read -ra COMMANDS <<< "$prepare_commands"
  for cmd in "${COMMANDS[@]}"; do
    cmd=$(echo "$cmd" | xargs) # Loại bỏ khoảng trắng thừa
    if [ -n "$cmd" ]; then
      processing_log "Thực thi: $cmd"
      eval "$cmd"
      
      # Kiểm tra trạng thái kết thúc
      local exit_status=$?
      if [ $exit_status -ne 0 ]; then
        error_log "Lệnh '$cmd' thất bại với mã lỗi $exit_status"
        return $exit_status
      fi
    fi
  done
  
  success_log "Đã cài đặt các thư viện thành công"
  return 0
}

# Hàm phân tích file hoặc lỗi chi tiết
analyze_file_or_error() {
  local file_path="$1"
  local error_message="$2"
  local context="$3"
  local return_type="${4:-json}" # Thêm tham số return_type, mặc định là "json"
  
  # Thu thập thông tin hệ thống
  system_info=$(get_system_info)
  
  # Đọc nội dung file nếu có
  local file_content=""
  if [ -n "$file_path" ] && [ -f "$file_path" ]; then
    file_content=$(cat "$file_path")
    debug_log "Đã đọc nội dung file: $file_path"
  elif [ -n "$file_path" ]; then
    error_log "File không tồn tại: $file_path"
    return 1
  fi
  
  # Escape nội dung file để đưa vào JSON
  if [ -n "$file_content" ]; then
    file_content_escaped=$(echo "$file_content" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed ':a;N;$!ba;s/\n/\\n/g')
  fi
  
  # Escape thông báo lỗi
  if [ -n "$error_message" ]; then
    error_message_escaped=$(echo "$error_message" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed ':a;N;$!ba;s/\n/\\n/g')
  fi
  
  # Escape bối cảnh
  if [ -n "$context" ]; then
    context_escaped=$(echo "$context" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | sed ':a;N;$!ba;s/\n/\\n/g')
  fi
  
  # Tạo JSON data gửi đi
  request_data="{
    \"file_path\": \"$file_path\",
    \"suggest_type\": \"sh\",
    \"system_info\": $system_info,
    \"return_type\": \"$return_type\""
  
  if [ -n "$file_content_escaped" ]; then
    request_data+=",
    \"file_content\": \"$file_content_escaped\""
  fi
  
  if [ -n "$error_message_escaped" ]; then
    request_data+=",
    \"error_message\": \"$error_message_escaped\""
  fi
  
  if [ -n "$context_escaped" ]; then
    request_data+=",
    \"context\": \"$context_escaped\""
  fi
  
  request_data+="
  }"
  
  debug_log "Gửi yêu cầu phân tích file/lỗi"
  
  # Gửi request
  response=$(send_api_request "analyze" "$request_data" "$return_type")
  
  # Trả về response
  echo "$response"
}

# Hàm kiểm tra dịch vụ hoặc phần mềm
check_service() {
  local service_name="$1"
  local additional_info="$2"
  
  # Thực hiện các lệnh kiểm tra phụ thuộc vào loại dịch vụ
  if command -v "$service_name" &> /dev/null; then
    info_log "Đã tìm thấy lệnh $service_name trên hệ thống"
    service_exists=true
  else
    warning_log "Không tìm thấy lệnh $service_name trên hệ thống"
    service_exists=false
  fi
  
  # Kiểm tra cụ thể hơn cho từng loại dịch vụ
  case "$service_name" in
    nginx)
      # Kiểm tra cấu hình nginx
      if $service_exists; then
        info_log "Kiểm tra cấu hình nginx..."
        nginx_output=$(nginx -t 2>&1)
        nginx_status=$?
        
        if [ $nginx_status -eq 0 ]; then
          success_log "Cấu hình nginx đúng"
        else
          error_log "Lỗi cấu hình nginx"
        fi
        
        # Phân tích lỗi (nếu có) bằng AI
        if [ $nginx_status -ne 0 ]; then
          info_log "Phân tích lỗi nginx bằng AI..."
          analyze_response=$(analyze_file_or_error "" "$nginx_output" "Kiểm tra cấu hình nginx bằng lệnh 'nginx -t'")
          process_response "$analyze_response"
        fi
      else
        # Hỏi xem có muốn cài đặt nginx không
        read -p "Bạn có muốn cài đặt nginx không? (y/n): " install_answer
        if [[ "$install_answer" == "y" ]]; then
          # Gửi yêu cầu tạo script cài đặt
          info_log "Tạo script cài đặt nginx..."
          install_response=$(process_request "Cài đặt và cấu hình nginx" "run" "install" "")
          process_response "$install_response"
        fi
      fi
      ;;
      
    apache|apache2|httpd)
      # Kiểm tra Apache
      service_name_check="apache2"
      if ! command -v "$service_name_check" &> /dev/null; then
        service_name_check="httpd"
      fi
      
      if command -v "$service_name_check" &> /dev/null; then
        info_log "Kiểm tra cấu hình $service_name_check..."
        apache_output=$($service_name_check -t 2>&1)
        apache_status=$?
        
        if [ $apache_status -eq 0 ]; then
          success_log "Cấu hình $service_name_check đúng"
        else
          error_log "Lỗi cấu hình $service_name_check"
          # Phân tích lỗi bằng AI
          info_log "Phân tích lỗi $service_name_check bằng AI..."
          analyze_response=$(analyze_file_or_error "" "$apache_output" "Kiểm tra cấu hình $service_name_check")
          process_response "$analyze_response"
        fi
      else
        warning_log "$service_name_check không được cài đặt trên hệ thống"
        # Hỏi xem có muốn cài đặt không
        read -p "Bạn có muốn cài đặt $service_name_check không? (y/n): " install_answer
        if [[ "$install_answer" == "y" ]]; then
          # Gửi yêu cầu tạo script cài đặt
          info_log "Tạo script cài đặt $service_name_check..."
          install_response=$(process_request "Cài đặt và cấu hình $service_name_check" "run" "install" "")
          process_response "$install_response"
        fi
      fi
      ;;
      
    *)
      # Kiểm tra chung cho các dịch vụ khác
      if $service_exists; then
        info_log "Kiểm tra chi tiết $service_name..."
        # Gửi yêu cầu kiểm tra chi tiết dịch vụ
        check_response=$(process_request "Kiểm tra chi tiết dịch vụ $service_name $additional_info" "run" "check" "")
        process_response "$check_response"
      else
        warning_log "$service_name chưa được cài đặt"
        # Hỏi xem có muốn cài đặt không
        read -p "Bạn có muốn cài đặt $service_name không? (y/n): " install_answer
        if [[ "$install_answer" == "y" ]]; then
          # Gửi yêu cầu tạo script cài đặt
          info_log "Tạo script cài đặt $service_name..."
          install_response=$(process_request "Cài đặt và cấu hình $service_name" "run" "install" "")
          process_response "$install_response"
        fi
      fi
      ;;
  esac
}

# Tải cấu hình
load_config() {
  # Đầu tiên, kiểm tra biến môi trường từ .env nếu có
  if [ -f ".env" ]; then
    debug_log "Tải cấu hình từ file .env"
    source .env
  fi
  
  # Sau đó, đọc từ file cấu hình người dùng, ghi đè lên các giá trị từ .env nếu có
  if [ -f "$CONFIG_FILE" ]; then
    # Đọc các giá trị từ file cấu hình
    config_api_url=$(grep -o '"api_url"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    config_shell_dir=$(grep -o '"shell_dir"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    config_debug=$(grep -o '"debug"[[:space:]]*:[[:space:]]*\(true\|false\)' "$CONFIG_FILE" | awk '{print $2}')
    config_openai_api_key=$(grep -o '"openai_api_key"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    config_api_key=$(grep -o '"api_key"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    config_model=$(grep -o '"model"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    config_return_type=$(grep -o '"return_type"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    
    # Cập nhật biến môi trường nếu có giá trị
    if [ -n "$config_api_url" ]; then
      API_URL="$config_api_url"
    fi
    
    if [ -n "$config_shell_dir" ]; then
      SHELL_DIR="$config_shell_dir"
    fi
    
    if [ -n "$config_debug" ]; then
      DEBUG="$config_debug"
    fi
    
    if [ -n "$config_openai_api_key" ]; then
      OPENAI_API_KEY="$config_openai_api_key"
    fi
    
    if [ -n "$config_api_key" ]; then
      API_KEY="$config_api_key"
    fi
    
    if [ -n "$config_model" ]; then
      MODEL="$config_model"
    fi
    
    if [ -n "$config_return_type" ]; then
      RETURN_TYPE="$config_return_type"
    fi
    
    debug_log "Đã tải cấu hình từ $CONFIG_FILE"
    debug_log "API_URL=$API_URL"
    debug_log "SHELL_DIR=$SHELL_DIR"
    debug_log "DEBUG=$DEBUG"
    debug_log "OPENAI_API_KEY=${OPENAI_API_KEY:0:5}..."
    debug_log "API_KEY=${API_KEY:0:5}..."
    debug_log "MODEL=$MODEL"
    debug_log "RETURN_TYPE=$RETURN_TYPE"
  else
    debug_log "Không tìm thấy file cấu hình $CONFIG_FILE, sử dụng giá trị mặc định"
  fi
  
  # Đảm bảo thư mục shell tồn tại
  mkdir -p "$SHELL_DIR"
}

# Lưu cấu hình
save_config() {
  local api_url="$1"
  local shell_dir="$2"
  local debug="$3"
  local openai_api_key="$4"
  local api_key="$5"
  local model="$6"
  local return_type="$7"
  
  # Sử dụng giá trị hiện tại nếu không có giá trị mới
  if [ -z "$api_url" ]; then
    api_url="$API_URL"
  fi
  
  if [ -z "$shell_dir" ]; then
    shell_dir="$SHELL_DIR"
  fi
  
  if [ -z "$debug" ]; then
    debug="$DEBUG"
  fi
  
  if [ -z "$openai_api_key" ]; then
    openai_api_key="$OPENAI_API_KEY"
  fi
  
  if [ -z "$api_key" ]; then
    api_key="$API_KEY"
  fi
  
  if [ -z "$model" ]; then
    model="$MODEL"
  fi
  
  if [ -z "$return_type" ]; then
    return_type="$RETURN_TYPE"
  fi
  
  # Tạo JSON và lưu vào file
  echo "{
  \"api_url\": \"$api_url\",
  \"shell_dir\": \"$shell_dir\",
  \"debug\": $debug,
  \"openai_api_key\": \"$openai_api_key\",
  \"api_key\": \"$api_key\",
  \"model\": \"$model\",
  \"return_type\": \"$return_type\"
}" > "$CONFIG_FILE"
  
  success_log "Đã lưu cấu hình vào $CONFIG_FILE"
  
  # Cập nhật biến môi trường
  API_URL="$api_url"
  SHELL_DIR="$shell_dir"
  DEBUG="$debug"
  OPENAI_API_KEY="$openai_api_key"
  API_KEY="$api_key"
  MODEL="$model"
  RETURN_TYPE="$return_type"
  
  # Đảm bảo thư mục shell tồn tại
  mkdir -p "$SHELL_DIR"
} 