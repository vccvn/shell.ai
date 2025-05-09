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

# Hàm lấy thông tin hệ thống
get_system_info() {
  raw_os_type=$(uname -s)
  os_version=$(uname -r)
  hostname=$(hostname)
  user=$(whoami)
  arch=$(uname -m)
  
  # Xác định đúng tên hệ điều hành
  if [[ "$raw_os_type" == "Darwin" ]]; then
    os_type="macOS"
    # Lấy phiên bản macOS chi tiết hơn
    if command -v sw_vers &> /dev/null; then
      os_version=$(sw_vers -productVersion)
    fi
  else
    os_type="$raw_os_type"
  fi
  
  # Kiểm tra các package manager
  package_managers=""
  
  if command -v apt-get &> /dev/null; then
    package_managers+=" apt"
  fi
  
  if command -v yum &> /dev/null; then
    package_managers+=" yum"
  fi
  
  if command -v dnf &> /dev/null; then
    package_managers+=" dnf"
  fi
  
  if command -v brew &> /dev/null; then
    package_managers+=" brew"
  fi
  
  if command -v pacman &> /dev/null; then
    package_managers+=" pacman"
  fi
  
  # Kiểm tra các ngôn ngữ lập trình
  languages=""
  
  if command -v node &> /dev/null; then
    node_version=$(node --version)
    languages+=" Node.js:$node_version"
  fi
  
  if command -v python3 &> /dev/null; then
    python_version=$(python3 --version | awk '{print $2}')
    languages+=" Python:$python_version"
  fi
  
  if command -v php &> /dev/null; then
    php_version=$(php --version | head -n 1 | awk '{print $2}')
    languages+=" PHP:$php_version"
  fi
  
  if command -v java &> /dev/null; then
    java_version=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}')
    languages+=" Java:$java_version"
  fi
  
  if command -v ruby &> /dev/null; then
    ruby_version=$(ruby --version | awk '{print $2}')
    languages+=" Ruby:$ruby_version"
  fi
  
  # Kiểm tra các web server
  web_servers=""
  
  if command -v nginx &> /dev/null; then
    web_servers+=" nginx"
  fi
  
  if command -v apache2 &> /dev/null || command -v httpd &> /dev/null; then
    web_servers+=" apache"
  fi
  
  # Kiểm tra các database
  databases=""
  
  if command -v mysql &> /dev/null; then
    databases+=" mysql"
  fi
  
  if command -v psql &> /dev/null; then
    databases+=" postgresql"
  fi
  
  if command -v mongo &> /dev/null; then
    databases+=" mongodb"
  fi
  
  if command -v redis-cli &> /dev/null; then
    databases+=" redis"
  fi
  
  # Trả về định dạng JSON
  echo "{
    \"os_type\": \"$os_type\",
    \"os_version\": \"$os_version\",
    \"hostname\": \"$hostname\",
    \"user\": \"$user\",
    \"arch\": \"$arch\",
    \"package_managers\": \"$package_managers\",
    \"languages\": \"$languages\",
    \"web_servers\": \"$web_servers\",
    \"databases\": \"$databases\"
  }"
}

# Hàm gửi yêu cầu đến API server
send_api_request() {
  local endpoint="$1"
  local data="$2"
  
  debug_log "Gửi yêu cầu đến $API_URL/$endpoint với dữ liệu: $data"
  
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
  
  # Thực hiện request với headers
  response=$(eval "curl -s -X POST \"$API_URL/$endpoint\" $headers -d '$data' --max-time 30")
  
  debug_log "Nhận phản hồi: $response"
  
  echo "$response"
}

# Hàm xử lý yêu cầu từ người dùng
process_request() {
  local issue="$1"
  local action="$2"
  local type="$3"
  local filename="$4"
  
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
  
  request_data+="
  }"
  
  # Gửi request
  response=$(send_api_request "process" "$request_data")
  
  # Trả về response
  echo "$response"
}

# Hàm sửa lỗi script
fix_script_error() {
  local issue="$1"
  local error_message="$2"
  local script_content="$3"
  
  # Thu thập thông tin hệ thống
  system_info=$(get_system_info)
  
  # Tạo JSON data gửi đi
  request_data="{
    \"issue\": \"$issue\",
    \"error\": \"$error_message\",
    \"script\": \"$script_content\",
    \"suggest_type\": \"sh\",
    \"system_info\": $system_info
  }"
  
  # Gửi request
  response=$(send_api_request "fix" "$request_data")
  
  # Trả về response
  echo "$response"
}

# Hàm xử lý chat
handle_chat() {
  local message="$1"
  local dev_mode="$2"
  local history="$3"
  
  # Thu thập thông tin hệ thống
  system_info=$(get_system_info)
  
  # Tạo JSON data gửi đi
  request_data="{
    \"message\": \"$message\",
    \"suggest_type\": \"sh\",
    \"system_info\": $system_info"
  
  if [ "$dev_mode" = "true" ]; then
    request_data+=",
    \"mode\": \"dev\""
  else
    request_data+=",
    \"mode\": \"chat\""
  fi
  
  if [ -n "$history" ]; then
    request_data+=",
    \"history\": $history"
  fi
  
  request_data+="
  }"
  
  debug_log "Request data chat: $request_data"
  
  # Gửi request
  response=$(send_api_request "chat" "$request_data")
  
  # Trả về response
  echo "$response"
}

# Hàm tạo file
create_file() {
  local file_path="$1"
  local content="$2"
  local file_type="$3"
  
  # Đảm bảo thư mục cha tồn tại
  mkdir -p "$(dirname "$file_path")"
  
  # Ghi nội dung vào file
  echo "$content" > "$file_path"
  
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
    
    debug_log "Đã tải cấu hình từ $CONFIG_FILE"
    debug_log "API_URL=$API_URL"
    debug_log "SHELL_DIR=$SHELL_DIR"
    debug_log "DEBUG=$DEBUG"
    debug_log "OPENAI_API_KEY=${OPENAI_API_KEY:0:5}..."
    debug_log "API_KEY=${API_KEY:0:5}..."
    debug_log "MODEL=$MODEL"
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
  
  # Tạo JSON và lưu vào file
  echo "{
  \"api_url\": \"$api_url\",
  \"shell_dir\": \"$shell_dir\",
  \"debug\": $debug,
  \"openai_api_key\": \"$openai_api_key\",
  \"api_key\": \"$api_key\",
  \"model\": \"$model\"
}" > "$CONFIG_FILE"
  
  success_log "Đã lưu cấu hình vào $CONFIG_FILE"
  
  # Cập nhật biến môi trường
  API_URL="$api_url"
  SHELL_DIR="$shell_dir"
  DEBUG="$debug"
  OPENAI_API_KEY="$openai_api_key"
  API_KEY="$api_key"
  MODEL="$model"
  
  # Đảm bảo thư mục shell tồn tại
  mkdir -p "$SHELL_DIR"
} 