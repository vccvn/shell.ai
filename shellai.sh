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
    echo "  sudo ./shellai.sh -m \"nội dung yêu cầu\" [--no-cleanup]"
    echo ""
    echo "Các lệnh:"
    echo "  check    Kiểm tra và sửa lỗi dịch vụ"
    echo "  install  Cài đặt phần mềm/dịch vụ"
    echo "  setup    Thiết lập và cấu hình"
    echo "  create   Tạo file hoặc thư mục"
    echo "  delete   Xóa file hoặc thư mục"
    echo "  move     Di chuyển file hoặc thư mục"
    echo "  copy     Sao chép file hoặc thư mục"
    echo "  config   Cấu hình Shell.AI"
    echo "  help     Hiển thị trợ giúp"
    echo ""
    echo "Các tùy chọn:"
    echo "  -m, --message    Chỉ định nội dung yêu cầu"
    echo "  --no-cleanup     Không xóa file sau khi hoàn thành"
    echo "  --cleanup        Xóa file sau khi hoàn thành (mặc định)"
    echo "  -h, --help       Hiển thị trợ giúp"
    echo ""
    echo "Ví dụ:"
    echo "  sudo ./shellai.sh check mysql -m \"Kiểm tra lỗi mysql\""
    echo "  sudo ./shellai.sh create file index.html -m \"Tạo file HTML với nội dung bài thơ\""
    echo "  sudo ./shellai.sh install nginx php mysql -m \"Cài đặt LAMP stack\""
    echo "  sudo ./shellai.sh -m \"Tạo file HTML với nội dung bài hát của Sơn Tùng\""
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

# Hàm thu thập thông tin hệ thống
collect_system_info() {
    # Lấy thông tin CPU và Memory cho macOS
    local cpu_info=""
    local memory_info=""
    local disk_info=""
    
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS
        cpu_info=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
        memory_info=$(vm_stat 2>/dev/null | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        disk_info=$(df -h / | tail -n 1)
    else
        # Linux
        cpu_info=$(lscpu | grep 'Model name' | cut -d: -f2 | sed 's/^[ \t]*//' 2>/dev/null || echo "Unknown")
        memory_info=$(free -h | head -n 2 | tail -n 1 2>/dev/null || echo "Unknown")
        disk_info=$(df -h / | tail -n 1 2>/dev/null || echo "Unknown")
    fi
    
    # Tạo JSON với thông tin cơ bản trước
    local info=$(jq -n \
        --arg os "$(uname -s)" \
        --arg version "$(uname -r)" \
        --arg hostname "$(hostname)" \
        --arg user "$(whoami)" \
        --arg home "$HOME" \
        --arg pwd "$PWD" \
        --arg shell "$SHELL" \
        '{
            "os": $os,
            "version": $version,
            "hostname": $hostname,
            "user": $user,
            "home": $home,
            "pwd": $pwd,
            "shell": $shell
        }')
    
    # Thêm thông tin phần mềm
    info=$(echo "$info" | jq \
        --arg node "$(node -v 2>/dev/null || echo 'not installed')" \
        --arg npm "$(npm -v 2>/dev/null || echo 'not installed')" \
        --arg python "$(python3 --version 2>/dev/null || echo 'not installed')" \
        --arg mysql "$(mysql --version 2>/dev/null || echo 'not installed')" \
        --arg nginx "$(nginx -v 2>/dev/null || echo 'not installed')" \
        --arg docker "$(docker --version 2>/dev/null || echo 'not installed')" \
        '. + {
            "node": $node,
            "npm": $npm,
            "python": $python,
            "mysql": $mysql,
            "nginx": $nginx,
            "docker": $docker
        }')
    
    # Thêm thông tin phần cứng
    info=$(echo "$info" | jq \
        --arg cpu "$cpu_info" \
        --arg memory "$memory_info" \
        --arg disk "$disk_info" \
        '. + {
            "cpu": $cpu,
            "memory": $memory,
            "disk": $disk
        }')
    
    # Debug thông tin hệ thống
    echo "Debug - System Info: $info"
    
    if [ $? -ne 0 ]; then
        echo "Lỗi: Không thể tạo thông tin hệ thống"
        return 1
    fi
    
    echo "$info"
}

# Hàm gọi API
call_api() {
    local endpoint="$1"
    local data="$2"
    local system_info="$3"
    
    # Debug thông tin đầu vào
    echo "Debug - Endpoint: $endpoint"
    echo "Debug - Data: $data"
    echo "Debug - System Info: $system_info"
    
    # Thêm thông tin hệ thống vào data nếu có
    if [ ! -z "$system_info" ]; then
        data=$(echo "$data" | jq --argjson sys "$system_info" '. + {"systemInfo": $sys}')
        if [ $? -ne 0 ]; then
            echo "Lỗi: Không thể thêm thông tin hệ thống vào data"
            echo "Data gốc: $data"
            echo "System Info: $system_info"
            return 1
        fi
    fi
    
    printf "Chờ giây lát...\n"
    
    # Debug data trước khi gửi
    echo "Debug - Data gửi đi: $data"
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$API_URL/$endpoint")
    
    # Debug phản hồi
    echo "Debug - Phản hồi API: $response"
    
    printf "Đang xử lý...\n"
    
    # Kiểm tra phản hồi có phải JSON hợp lệ không
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        echo "Lỗi: Phản hồi từ API không phải JSON hợp lệ"
        echo "Phản hồi nhận được:"
        echo "$response"
        return 1
    fi
    
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
    if ! echo "$content" > "$filepath"; then
        echo "Tạo file script không thành công"
        echo "Tên file: $filename"
        echo "Nội dung:"
        echo "$content"
        return 1
    fi
    
    # Đặt quyền thực thi nếu là shell script
    if [ "$type" = "sh" ]; then
        chmod +x "$filepath"
    fi
    
    # Thực thi file
    case "$type" in
        "js"|"javascript")
            node "$filepath" $args
            ;;
        "sh"|"shell"|"bash")
            bash "$filepath" $args
            ;;
        "py"|"python")
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
    
    # Thu thập thông tin hệ thống
    local system_info=$(collect_system_info)
    if [ $? -ne 0 ]; then
        echo "Lỗi: Không thể thu thập thông tin hệ thống"
        return 1
    fi
    
    # Gọi API để lấy script
    local data=$(jq -n \
        --arg issue "Kiểm tra và sửa lỗi $service: $message" \
        '{"issue": $issue}')
    
    if [ $? -ne 0 ]; then
        echo "Lỗi: Không thể tạo data request"
        return 1
    fi
    
    local response=$(call_api "process" "$data" "$system_info")
    if [ $? -ne 0 ]; then
        echo "Không thể kết nối đến API"
        return 1
    fi
    
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        local files=$(echo "$response" | jq -r '.files // []')
        local file_count=$(echo "$files" | jq 'length')
        
        if [ "$file_count" -eq 0 ]; then
            echo "Không có file nào được tạo"
            return 1
        fi
        
        for ((i=0; i<$file_count; i++)); do
            local file_info=$(echo "$files" | jq -r ".[$i]")
            if [ -z "$file_info" ]; then
                echo "Lỗi: Không thể đọc thông tin file thứ $((i+1))"
                continue
            fi
            execute_script "$file_info"
            if [ $? -ne 0 ]; then
                handle_error "$(echo "$response" | jq -r '.error // "Lỗi không xác định"')" "$message" "$files"
            fi
        done
    else
        echo "Không thể tạo script: $(echo "$response" | jq -r '.message // "Lỗi không xác định"')"
        return 1
    fi
}

# Hàm xử lý lệnh create
handle_create() {
    local type="$1"
    local target="$2"
    local message="$3"
    shift 3
    local args=("$@")
    
    # Tạo thư mục nếu chưa tồn tại
    mkdir -p "$SHELL_DIR"
    
    # Gọi API để lấy script
    local data=$(jq -n \
        --arg issue "Tạo $type $target: $message" \
        --arg type "$type" \
        --arg target "$target" \
        --arg args "$(echo "${args[@]}" | jq -R .)" \
        '{
            "issue": $issue,
            "type": $type,
            "target": $target,
            "args": ($args | split(" "))
        }')
    
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

# Hàm xử lý lệnh delete
handle_delete() {
    local target="$1"
    local message="$2"
    shift 2
    local args=("$@")
    
    # Tạo thư mục nếu chưa tồn tại
    mkdir -p "$SHELL_DIR"
    
    # Gọi API để lấy script
    local data=$(jq -n \
        --arg issue "Xóa $target: $message" \
        --arg target "$target" \
        --arg args "$(echo "${args[@]}" | jq -R .)" \
        '{
            "issue": $issue,
            "target": $target,
            "args": ($args | split(" "))
        }')
    
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

# Hàm xử lý lệnh move
handle_move() {
    local source="$1"
    local dest="$2"
    local message="$3"
    shift 3
    local args=("$@")
    
    # Tạo thư mục nếu chưa tồn tại
    mkdir -p "$SHELL_DIR"
    
    # Gọi API để lấy script
    local data=$(jq -n \
        --arg issue "Di chuyển $source đến $dest: $message" \
        --arg source "$source" \
        --arg dest "$dest" \
        --arg args "$(echo "${args[@]}" | jq -R .)" \
        '{
            "issue": $issue,
            "source": $source,
            "dest": $dest,
            "args": ($args | split(" "))
        }')
    
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

# Hàm xử lý lệnh copy
handle_copy() {
    local source="$1"
    local dest="$2"
    local message="$3"
    shift 3
    local args=("$@")
    
    # Tạo thư mục nếu chưa tồn tại
    mkdir -p "$SHELL_DIR"
    
    # Gọi API để lấy script
    local data=$(jq -n \
        --arg issue "Sao chép $source đến $dest: $message" \
        --arg source "$source" \
        --arg dest "$dest" \
        --arg args "$(echo "${args[@]}" | jq -R .)" \
        '{
            "issue": $issue,
            "source": $source,
            "dest": $dest,
            "args": ($args | split(" "))
        }')
    
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

# Hàm xử lý yêu cầu trực tiếp
handle_direct_request() {
    local message="$1"
    
    # Tạo thư mục nếu chưa tồn tại
    mkdir -p "$SHELL_DIR"
    
    # Thu thập thông tin hệ thống
    local system_info=$(collect_system_info)
    
    # Gọi API để lấy script
    local data=$(jq -n \
        --arg issue "$message" \
        '{"issue": $issue}')
    
    local response=$(call_api "process" "$data" "$system_info")
    if [ $? -ne 0 ]; then
        echo "Không thể kết nối đến API"
        return 1
    fi
    
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        local files=$(echo "$response" | jq -r '.files // []')
        local file_count=$(echo "$files" | jq 'length')
        
        if [ "$file_count" -eq 0 ]; then
            echo "Không có file nào được tạo"
            return 1
        fi
        
        for ((i=0; i<$file_count; i++)); do
            local file_info=$(echo "$files" | jq -r ".[$i]")
            if [ -z "$file_info" ]; then
                echo "Lỗi: Không thể đọc thông tin file thứ $((i+1))"
                continue
            fi
            execute_script "$file_info"
            if [ $? -ne 0 ]; then
                handle_error "$(echo "$response" | jq -r '.error // "Lỗi không xác định"')" "$message" "$files"
            fi
        done
    else
        echo "Không thể tạo script: $(echo "$response" | jq -r '.message // "Lỗi không xác định"')"
        return 1
    fi
}

# Đọc cấu hình
load_config

# Xử lý tham số
COMMAND=""
MESSAGE=""
SERVICE=""
CLEANUP=true
ARGS=()

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
        check|install|setup|create|delete|move|copy)
            COMMAND="$1"
            shift
            # Lấy các tham số cho đến khi gặp tùy chọn
            while [[ $# -gt 0 && ! "$1" =~ ^- ]]; do
                ARGS+=("$1")
                shift
            done
            ;;
        *)
            # Nếu không phải tùy chọn và chưa có lệnh, coi như lệnh tùy biến
            if [ -z "$COMMAND" ]; then
                COMMAND="$1"
                shift
                # Lấy các tham số cho đến khi gặp tùy chọn
                while [[ $# -gt 0 && ! "$1" =~ ^- ]]; do
                    ARGS+=("$1")
                    shift
                done
            else
                echo "Tham số không hợp lệ: $1"
                show_help
                exit 1
            fi
            ;;
    esac
done

# Kiểm tra thông điệp
if [ -z "$MESSAGE" ]; then
    echo "Thiếu nội dung yêu cầu (-m)"
    show_help
    exit 1
fi

# Hiển thị thông tin yêu cầu
if [ -z "$COMMAND" ]; then
    printf "Bạn đã yêu cầu: %s\n" "$MESSAGE"
else
    printf "Bạn đã yêu cầu %s %s: %s\n" "$COMMAND" "${ARGS[*]}" "$MESSAGE"
fi

# Xử lý lệnh hoặc yêu cầu trực tiếp
if [ -z "$COMMAND" ]; then
    # Nếu không có lệnh, xử lý yêu cầu trực tiếp
    handle_direct_request "$MESSAGE"
else
    # Xử lý các lệnh cụ thể
    case "$COMMAND" in
        check)
            if [ ${#ARGS[@]} -eq 0 ]; then
                echo "Thiếu tên dịch vụ cần kiểm tra"
                show_help
                exit 1
            fi
            handle_check "${ARGS[0]}" "$MESSAGE"
            ;;
        create)
            if [ ${#ARGS[@]} -lt 2 ]; then
                echo "Thiếu thông tin cần thiết (type và target)"
                show_help
                exit 1
            fi
            handle_create "${ARGS[0]}" "${ARGS[1]}" "$MESSAGE" "${ARGS[@]:2}"
            ;;
        delete)
            if [ ${#ARGS[@]} -eq 0 ]; then
                echo "Thiếu target cần xóa"
                show_help
                exit 1
            fi
            handle_delete "${ARGS[0]}" "$MESSAGE" "${ARGS[@]:1}"
            ;;
        move)
            if [ ${#ARGS[@]} -lt 2 ]; then
                echo "Thiếu source và destination"
                show_help
                exit 1
            fi
            handle_move "${ARGS[0]}" "${ARGS[1]}" "$MESSAGE" "${ARGS[@]:2}"
            ;;
        copy)
            if [ ${#ARGS[@]} -lt 2 ]; then
                echo "Thiếu source và destination"
                show_help
                exit 1
            fi
            handle_copy "${ARGS[0]}" "${ARGS[1]}" "$MESSAGE" "${ARGS[@]:2}"
            ;;
        install|setup)
            # TODO: Implement other commands
            echo "Lệnh $COMMAND chưa được triển khai"
            exit 1
            ;;
        *)
            # Xử lý lệnh tùy biến
            local custom_prompt="$COMMAND"
            if [ ${#ARGS[@]} -gt 0 ]; then
                custom_prompt="$COMMAND ${ARGS[*]}"
            fi
            custom_prompt="$custom_prompt: $MESSAGE"
            handle_direct_request "$custom_prompt"
            ;;
    esac
fi

exit 0 