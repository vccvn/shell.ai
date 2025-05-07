#!/bin/bash

# shellai.sh - Script chính để tương tác với Shell.AI Agent
# Sử dụng: sudo ./shellai.sh [lệnh] [tham số...] [-m "Nội dung cụ thể"]

# Cấu hình mặc định
CONFIG_FILE="$HOME/.shellai_config"
API_URL="http://localhost:3000/api/agent"
SHELL_DIR="$HOME/.shellai"
CLEANUP=true

# Hàm hiển thị trợ giúp
show_help() {
    echo "Shell.AI - AI Agent để tự động hóa việc tạo và thực thi script"
    echo ""
    echo "Cú pháp:"
    echo "  sudo ./shellai.sh [lệnh] [tham số...] [-m \"nội dung yêu cầu\"] [--no-cleanup]"
    echo ""
    echo "Các lệnh:"
    echo "  check    Kiểm tra và sửa lỗi dịch vụ"
    echo "  install  Cài đặt phần mềm/dịch vụ"
    echo "  setup    Thiết lập và cấu hình"
    echo "  config   Cấu hình Shell.AI"
    echo "  help     Hiển thị trợ giúp"
    echo ""
    echo "Các tùy chọn:"
    echo "  -m, --message    Chỉ định nội dung yêu cầu"
    echo "  --no-cleanup     Không xóa file sau khi hoàn thành"
    echo "  --cleanup        Xóa file sau khi hoàn thành (mặc định)"
    echo "  -h, --help       Hiển thị trợ giúp"
}

# Hàm đọc cấu hình
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
    fi
}

# Hàm lưu cấu hình
save_config() {
    echo "API_URL=$API_URL" > "$CONFIG_FILE"
    echo "SHELL_DIR=$SHELL_DIR" >> "$CONFIG_FILE"
    echo "CLEANUP=$CLEANUP" >> "$CONFIG_FILE"
}

# Hàm cấu hình
configure() {
    echo "Cấu hình Shell.AI"
    echo "----------------"
    
    read -p "URL của API server [$API_URL]: " new_api_url
    if [ ! -z "$new_api_url" ]; then
        API_URL="$new_api_url"
    fi
    
    read -p "Thư mục lưu trữ script [$SHELL_DIR]: " new_shell_dir
    if [ ! -z "$new_shell_dir" ]; then
        SHELL_DIR="$new_shell_dir"
    fi
    
    read -p "Tự động xóa file sau khi hoàn thành? (y/n) [$([ "$CLEANUP" = true ] && echo "y" || echo "n")]: " cleanup_choice
    if [ ! -z "$cleanup_choice" ]; then
        if [[ "$cleanup_choice" =~ ^[Yy]$ ]]; then
            CLEANUP=true
        else
            CLEANUP=false
        fi
    fi
    
    save_config
    echo "Đã lưu cấu hình!"
}

# Hàm gọi API
call_api() {
    local endpoint="$1"
    local data="$2"
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$API_URL/$endpoint")
    
    echo "$response"
}

# Hàm thực thi file
execute_script() {
    local file_info="$1"
    local filename=$(echo "$file_info" | jq -r '.filename')
    local type=$(echo "$file_info" | jq -r '.type')
    local content=$(echo "$file_info" | jq -r '.content')
    local args=$(echo "$file_info" | jq -r '.args | join(" ")')
    
    # Tạo file
    local filepath="$SHELL_DIR/$filename"
    echo "$content" > "$filepath"
    
    # Đặt quyền thực thi nếu là shell script
    if [ "$type" = "sh" ]; then
        chmod +x "$filepath"
    fi
    
    # Thực thi file
    echo "Đang thực thi file: $filename"
    case "$type" in
        "js")
            node "$filepath" $args
            ;;
        "sh")
            bash "$filepath" $args
            ;;
        "py")
            python3 "$filepath" $args
            ;;
        *)
            echo "Không hỗ trợ loại file: $type"
            return 1
            ;;
    esac
    
    local exit_code=$?
    
    # Xóa file nếu cần
    if [ "$CLEANUP" = true ]; then
        rm -f "$filepath"
    fi
    
    return $exit_code
}

# Hàm xử lý lỗi
handle_error() {
    local error="$1"
    local issue="$2"
    local previous_files="$3"
    
    echo "Đã gặp lỗi: $error"
    read -p "Bạn có muốn thử sửa lỗi không? (y/n): " choice
    if [[ "$choice" =~ ^[Yy]$ ]]; then
        local data=$(jq -n \
            --arg error "$error" \
            --arg issue "$issue" \
            --arg previous_files "$previous_files" \
            '{
                "error": $error,
                "issue": $issue,
                "previousFiles": $previous_files
            }')
        
        local response=$(call_api "fix" "$data")
        local success=$(echo "$response" | jq -r '.success')
        
        if [ "$success" = "true" ]; then
            local files=$(echo "$response" | jq -r '.files')
            local file_count=$(echo "$files" | jq 'length')
            
            for ((i=0; i<$file_count; i++)); do
                local file_info=$(echo "$files" | jq -r ".[$i]")
                execute_script "$file_info"
                if [ $? -ne 0 ]; then
                    handle_error "$(echo "$response" | jq -r '.error')" "$issue" "$files"
                fi
            done
        else
            echo "Không thể tạo script sửa lỗi: $(echo "$response" | jq -r '.message')"
        fi
    fi
}

# Hàm xử lý lệnh check
handle_check() {
    local service="$1"
    local message="$2"
    
    # Tạo thư mục nếu chưa tồn tại
    mkdir -p "$SHELL_DIR"
    
    # Gọi API để lấy script
    local data=$(jq -n \
        --arg issue "Kiểm tra và sửa lỗi $service: $message" \
        '{"issue": $issue}')
    
    local response=$(call_api "process" "$data")
    local success=$(echo "$response" | jq -r '.success')
    
    if [ "$success" = "true" ]; then
        local files=$(echo "$response" | jq -r '.files')
        local file_count=$(echo "$files" | jq 'length')
        
        for ((i=0; i<$file_count; i++)); do
            local file_info=$(echo "$files" | jq -r ".[$i]")
            execute_script "$file_info"
            if [ $? -ne 0 ]; then
                handle_error "$(echo "$response" | jq -r '.error')" "$message" "$files"
            fi
        done
    else
        echo "Không thể tạo script: $(echo "$response" | jq -r '.message')"
    fi
}

# Đọc cấu hình
load_config

# Xử lý tham số
COMMAND=""
MESSAGE=""
CLEANUP=true

while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--message)
            MESSAGE="$2"
            shift 2
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --cleanup)
            CLEANUP=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        config)
            configure
            exit 0
            ;;
        check|install|setup)
            COMMAND="$1"
            shift
            ;;
        *)
            echo "Tham số không hợp lệ: $1"
            show_help
            exit 1
            ;;
    esac
done

# Kiểm tra lệnh và thông điệp
if [ -z "$COMMAND" ]; then
    echo "Thiếu lệnh"
    show_help
    exit 1
fi

if [ -z "$MESSAGE" ]; then
    echo "Thiếu nội dung yêu cầu (-m)"
    show_help
    exit 1
fi

# Xử lý lệnh
case "$COMMAND" in
    check)
        handle_check "$1" "$MESSAGE"
        ;;
    install|setup)
        # TODO: Implement other commands
        echo "Lệnh $COMMAND chưa được triển khai"
        exit 1
        ;;
    *)
        echo "Lệnh không hợp lệ: $COMMAND"
        show_help
        exit 1
        ;;
esac

exit 0 