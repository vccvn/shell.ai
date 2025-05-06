#!/bin/bash

# shellai.sh - Script chính để tương tác với Shell.AI Agent
# Sử dụng: sudo ./shellai.sh [lệnh] [tham số...] [-m "Nội dung cụ thể"]

# Biến môi trường mặc định
DEFAULT_API_URL="http://localhost:3000/api/agent"
DEFAULT_SHELL_DIR="$HOME/.shellai"
DEFAULT_CLEANUP="true"  # Xóa file mặc định khi hoàn thành

# Đọc từ file cấu hình nếu có
CONFIG_FILE="$HOME/.shellai_config"
if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
else
  # Tạo file cấu hình mặc định nếu chưa tồn tại
  echo "# Shell.AI configuration" > "$CONFIG_FILE"
  echo "API_URL=$DEFAULT_API_URL" >> "$CONFIG_FILE"
  echo "SHELL_DIR=$DEFAULT_SHELL_DIR" >> "$CONFIG_FILE"
  echo "CLEANUP=$DEFAULT_CLEANUP" >> "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
fi

# Sử dụng giá trị từ config hoặc default
API_URL=${API_URL:-$DEFAULT_API_URL}
SHELL_DIR=${SHELL_DIR:-$DEFAULT_SHELL_DIR}
CLEANUP=${CLEANUP:-$DEFAULT_CLEANUP}

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  echo "Vui lòng chạy script với quyền sudo"
  exit 1
fi

# Đảm bảo thư mục shell tồn tại
mkdir -p "$SHELL_DIR"

# Kiểm tra curl đã được cài đặt chưa
if ! command -v curl &> /dev/null; then
  echo "curl chưa được cài đặt. Đang cài đặt..."
  if command -v apt-get &> /dev/null; then
    apt-get update && apt-get install -y curl
  elif command -v brew &> /dev/null; then
    brew install curl
  else
    echo "Không thể cài đặt curl. Vui lòng cài đặt thủ công."
    exit 1
  fi
fi

# Kiểm tra jq đã được cài đặt chưa
if ! command -v jq &> /dev/null; then
  echo "jq chưa được cài đặt. Đang cài đặt..."
  if command -v apt-get &> /dev/null; then
    apt-get update && apt-get install -y jq
  elif command -v brew &> /dev/null; then
    brew install jq
  else
    echo "Không thể cài đặt jq. Vui lòng cài đặt thủ công."
    exit 1
  fi
fi

# Hàm hiển thị trợ giúp
show_help() {
  echo "Shell.AI - AI Agent để tự động hóa việc tạo và thực thi script"
  echo ""
  echo "Cách sử dụng:"
  echo "  sudo ./shellai.sh [lệnh] [tham số...] [-m|--message \"nội dung yêu cầu\"]"
  echo "  sudo ./shellai.sh [-m|--message] \"nội dung yêu cầu\""
  echo ""
  echo "Lệnh:"
  echo "  install [công cụ...]   Cài đặt các công cụ được chỉ định"
  echo "  setup [service...]     Thiết lập và cấu hình các dịch vụ được chỉ định"
  echo "  fix [service]          Sửa lỗi dịch vụ được chỉ định"
  echo "  config                 Cấu hình Shell.AI"  
  echo "  help                   Hiển thị trợ giúp này"
  echo ""
  echo "Tùy chọn:"
  echo "  -m, --message, -c, --comment  Chỉ định nội dung yêu cầu cụ thể"
  echo "  --no-cleanup                  Không xóa file sau khi hoàn thành tác vụ"
  echo "  --cleanup                     Xóa file sau khi hoàn thành tác vụ"
  echo ""
  echo "Ví dụ:"
  echo "  sudo ./shellai.sh install nginx php mysql"
  echo "  sudo ./shellai.sh fix mysql -m \"MySQL không kết nối được\""
  echo "  sudo ./shellai.sh -m \"Cài đặt LAMP stack và cấu hình virtual host\""
  echo "  sudo ./shellai.sh config"
  echo "  sudo ./shellai.sh fix mysql --no-cleanup"
  echo ""
}

# Hàm cấu hình Shell.AI
configure() {
  echo "Cấu hình Shell.AI"
  echo "=================="
  echo ""
  
  # Hiển thị cấu hình hiện tại
  echo "Cấu hình hiện tại:"
  echo "API URL: $API_URL"
  echo "Thư mục shell: $SHELL_DIR"
  echo "Tự động xóa file: $CLEANUP"
  echo ""
  
  # Hỏi URL API server mới
  echo "Nhập URL mới cho API server (để trống để giữ nguyên [$API_URL]):"
  read -r new_api_url
  if [ -n "$new_api_url" ]; then
    API_URL="$new_api_url"
    sed -i.bak "s|^API_URL=.*|API_URL=$API_URL|g" "$CONFIG_FILE" 2>/dev/null || sed -i "s|^API_URL=.*|API_URL=$API_URL|g" "$CONFIG_FILE"
  fi
  
  # Hỏi thư mục shell mới
  echo "Nhập đường dẫn mới cho thư mục shell (để trống để giữ nguyên [$SHELL_DIR]):"
  read -r new_shell_dir
  if [ -n "$new_shell_dir" ]; then
    SHELL_DIR="$new_shell_dir"
    mkdir -p "$SHELL_DIR"
    sed -i.bak "s|^SHELL_DIR=.*|SHELL_DIR=$SHELL_DIR|g" "$CONFIG_FILE" 2>/dev/null || sed -i "s|^SHELL_DIR=.*|SHELL_DIR=$SHELL_DIR|g" "$CONFIG_FILE"
  fi
  
  # Hỏi về tự động xóa file
  echo "Tự động xóa file sau khi hoàn thành tác vụ? (true/false) (để trống để giữ nguyên [$CLEANUP]):"
  read -r new_cleanup
  if [ -n "$new_cleanup" ]; then
    CLEANUP="$new_cleanup"
    sed -i.bak "s|^CLEANUP=.*|CLEANUP=$CLEANUP|g" "$CONFIG_FILE" 2>/dev/null || sed -i "s|^CLEANUP=.*|CLEANUP=$CLEANUP|g" "$CONFIG_FILE"
  fi
  
  echo ""
  echo "Cấu hình đã được cập nhật."
  echo "API URL: $API_URL"
  echo "Thư mục shell: $SHELL_DIR"
  echo "Tự động xóa file: $CLEANUP"
}

# Hàm kiểm tra server API
check_api_server() {
  echo "Kiểm tra kết nối đến API server tại $API_URL..."
  if ! curl -s --connect-timeout 5 "$API_URL/process" &> /dev/null; then
    echo "Không thể kết nối đến Shell.AI API Server tại $API_URL."
    echo "Vui lòng kiểm tra lại URL hoặc chạy 'sudo ./shellai.sh config' để cập nhật URL API."
    exit 1
  fi
  echo "Kết nối thành công!"
}

# Hàm gửi yêu cầu đến API
send_issue_to_api() {
  local issue="$1"
  local response
  
  echo "Đang xử lý yêu cầu: $issue"
  echo "Vui lòng đợi trong giây lát..."
  
  response=$(curl -s -X POST "$API_URL/process" \
    -H "Content-Type: application/json" \
    -d "{\"issue\": \"$issue\"}")
  
  # Kiểm tra phản hồi từ API
  if [ "$(echo "$response" | jq -r '.success')" != "true" ]; then
    echo "Lỗi: $(echo "$response" | jq -r '.message')"
    exit 1
  fi
  
  echo "Đã tạo script thành công."
  
  # Lưu thông tin về các file đã tạo
  echo "$response" | jq -r '.files' > "$SHELL_DIR/files_info.json"
  
  # Tạo các file script từ phản hồi API thay vì sử dụng file được tạo từ API server
  create_script_files
  
  # Thực thi từng file theo thứ tự
  execute_scripts "$issue"
}

# Hàm tạo các file script từ phản hồi API
create_script_files() {
  local files
  local file_count
  local i=0
  
  files=$(cat "$SHELL_DIR/files_info.json")
  file_count=$(echo "$files" | jq '. | length')
  
  echo "Tạo $file_count file script..."
  
  while [ $i -lt $file_count ]; do
    local filename
    local content
    local file_type
    
    filename=$(echo "$files" | jq -r ".[$i].filename")
    content=$(echo "$files" | jq -r ".[$i].content")
    file_type=$(echo "$files" | jq -r ".[$i].type")
    
    local file_path="$SHELL_DIR/$filename"
    
    # Tạo thư mục cha nếu cần
    mkdir -p "$(dirname "$file_path")"
    
    # Ghi nội dung vào file
    echo "$content" > "$file_path"
    
    # Đặt quyền thực thi cho file nếu cần
    if [ "$file_type" = "sh" ]; then
      chmod +x "$file_path"
    fi
    
    # Cập nhật đường dẫn file trong files_info.json
    local temp_file=$(mktemp)
    jq ".[$i].path = \"$file_path\"" "$SHELL_DIR/files_info.json" > "$temp_file"
    mv "$temp_file" "$SHELL_DIR/files_info.json"
    
    echo "Đã tạo file: $file_path"
    
    i=$((i+1))
  done
}

# Hàm xóa file trong thư mục shell
cleanup_shell_dir() {
  if [ "$CLEANUP" = "true" ]; then
    echo "Đang xóa các file tạm thời..."
    
    # Giữ file .gitkeep nếu có
    find "$SHELL_DIR" -type f -not -name ".gitkeep" -delete
    
    # Xóa các thư mục con rỗng
    find "$SHELL_DIR" -type d -empty -not -path "$SHELL_DIR" -delete
    
    echo "Đã xóa các file tạm thời."
  else
    echo "Các file script được giữ lại tại: $SHELL_DIR"
  fi
}

# Hàm thực thi các script đã tạo
execute_scripts() {
  local issue="$1"
  local files
  local file_count
  local i=0
  local has_error=false
  
  files=$(cat "$SHELL_DIR/files_info.json")
  file_count=$(echo "$files" | jq '. | length')
  
  echo "Tổng số script cần thực thi: $file_count"
  
  while [ $i -lt $file_count ]; do
    local file_path
    local file_type
    local args_json
    local args_str
    local description
    
    file_path=$(echo "$files" | jq -r ".[$i].path")
    file_type=$(echo "$files" | jq -r ".[$i].type")
    description=$(echo "$files" | jq -r ".[$i].description // \"\"")
    args_json=$(echo "$files" | jq -r ".[$i].args")
    args_str=$(echo "$args_json" | jq -r 'join(" ")')
    
    echo ""
    echo "Thực thi script $((i+1))/$file_count: $(basename "$file_path")"
    if [ -n "$description" ]; then
      echo "Mô tả: $description"
    fi
    
    # Đặt quyền thực thi cho file nếu cần
    chmod +x "$file_path"
    
    # Thực thi file với các tham số
    local result
    
    case "$file_type" in
      sh)
        result=$(bash "$file_path" $args_str 2>&1)
        ;;
      js)
        result=$(node "$file_path" $args_str 2>&1)
        ;;
      py)
        result=$(python3 "$file_path" $args_str 2>&1)
        ;;
      *)
        result=$("$file_path" $args_str 2>&1)
        ;;
    esac
    
    local exit_code=$?
    
    echo "$result"
    
    # Nếu gặp lỗi, hỏi người dùng có muốn sửa không
    if [ $exit_code -ne 0 ]; then
      has_error=true
      echo ""
      echo "Script gặp lỗi. Bạn có muốn sửa lỗi không? (y/n)"
      read -r fix_choice
      
      if [ "$fix_choice" == "y" ] || [ "$fix_choice" == "Y" ]; then
        fix_script_error "$result" "$issue" "$files"
        return
      fi
    fi
    
    i=$((i+1))
  done
  
  echo ""
  if [ "$has_error" = false ]; then
    echo "Đã thực thi tất cả các script thành công."
  else
    echo "Một số script gặp lỗi nhưng đã hoàn thành tác vụ."
  fi
  
  # Xóa các file tạm thời sau khi hoàn thành
  cleanup_shell_dir
}

# Hàm sửa lỗi script
fix_script_error() {
  local error="$1"
  local original_issue="$2"
  local previous_files="$3"
  local response
  
  echo "Đang yêu cầu AI sửa lỗi..."
  
  response=$(curl -s -X POST "$API_URL/fix" \
    -H "Content-Type: application/json" \
    -d "{
      \"error\": \"$error\",
      \"issue\": \"$original_issue\",
      \"previousFiles\": $previous_files
    }")
  
  # Kiểm tra phản hồi từ API
  if [ "$(echo "$response" | jq -r '.success')" != "true" ]; then
    echo "Lỗi: $(echo "$response" | jq -r '.message')"
    exit 1
  fi
  
  echo "Đã tạo script sửa lỗi thành công."
  
  # Lưu thông tin về các file đã tạo
  echo "$response" | jq -r '.files' > "$SHELL_DIR/files_info.json"
  
  # Tạo các file script từ phản hồi API
  create_script_files
  
  # Thực thi lại các script
  execute_scripts "$original_issue"
}

# Phân tích tham số dòng lệnh
command=""
message=""
args=()
no_cleanup=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message|-c|--comment)
      if [[ -n "$2" && "$2" != -* ]]; then
        message="$2"
        shift 2
      else
        echo "Lỗi: Tùy chọn -m|--message cần một giá trị."
        exit 1
      fi
      ;;
    --no-cleanup)
      no_cleanup=true
      CLEANUP="false"
      shift
      ;;
    --cleanup)
      no_cleanup=false
      CLEANUP="true"
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    -*)
      echo "Lỗi: Tùy chọn không hợp lệ: $1" >&2
      show_help
      exit 1
      ;;
    *)
      if [ -z "$command" ]; then
        command="$1"
      else
        args+=("$1")
      fi
      shift
      ;;
  esac
done

# Xử lý trường hợp chỉ có message mà không có lệnh
if [ -z "$command" ] && [ -n "$message" ]; then
  # Nếu chỉ có message, coi như lệnh mặc định là "process"
  issue="$message"
  check_api_server
  send_issue_to_api "$issue"
  exit 0
fi

# Xử lý các lệnh
case "$command" in
  install)
    if [ ${#args[@]} -eq 0 ] && [ -z "$message" ]; then
      echo "Vui lòng chỉ định ít nhất một công cụ để cài đặt hoặc cung cấp thông điệp cụ thể"
      exit 1
    fi
    
    if [ -n "$message" ]; then
      issue="Cài đặt với yêu cầu cụ thể: $message"
    else
      issue="Cài đặt và cấu hình các công cụ sau đây: ${args[*]}"
    fi
    
    check_api_server
    send_issue_to_api "$issue"
    ;;
    
  setup)
    if [ ${#args[@]} -eq 0 ] && [ -z "$message" ]; then
      echo "Vui lòng chỉ định ít nhất một dịch vụ để thiết lập hoặc cung cấp thông điệp cụ thể"
      exit 1
    fi
    
    if [ -n "$message" ]; then
      issue="Thiết lập với yêu cầu cụ thể: $message"
    else
      issue="Thiết lập và cấu hình các dịch vụ sau đây: ${args[*]}"
    fi
    
    check_api_server
    send_issue_to_api "$issue"
    ;;
    
  fix)
    if [ ${#args[@]} -eq 0 ] && [ -z "$message" ]; then
      echo "Vui lòng chỉ định dịch vụ cần sửa hoặc cung cấp thông điệp cụ thể"
      exit 1
    fi
    
    if [ -n "$message" ]; then
      if [ ${#args[@]} -eq 0 ]; then
        issue="Sửa lỗi: $message"
      else
        issue="Sửa lỗi ${args[0]} với vấn đề: $message"
      fi
    else
      issue="Kiểm tra và sửa lỗi dịch vụ: ${args[0]}"
    fi
    
    check_api_server
    send_issue_to_api "$issue"
    ;;
  
  config)
    configure
    ;;
    
  help)
    show_help
    ;;
    
  "")
    show_help
    ;;
    
  *)
    # Nếu lệnh không phải là các lệnh đã biết, coi nó như một phần của yêu cầu
    if [ -n "$message" ]; then
      issue="$command ${args[*]} - $message"
    else
      issue="$command ${args[*]}"
    fi
    
    check_api_server
    send_issue_to_api "$issue"
    ;;
esac

exit 0 