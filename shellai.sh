#!/bin/bash

# shellai.sh - Script chính để tương tác với Shell.AI
# Script này giờ đây sẽ gọi shellai.js để thực hiện các tác vụ

# Đường dẫn đến file JavaScript
JS_FILE="$(dirname "$0")/shellai.js"

# Kiểm tra file JavaScript tồn tại
if [ ! -f "$JS_FILE" ]; then
    echo -e "\033[0;31m[LỖI]\033[0m File shellai.js không tồn tại"
    exit 1
fi

# Hàm hiển thị thông báo lỗi
error_log() {
    echo -e "\033[0;31m[LỖI]\033[0m $1" >&2
}

# Hàm hiển thị thông báo thành công
success_log() {
    echo -e "\033[0;32m[THÀNH CÔNG]\033[0m $1" >&2
}

# Hàm hiển thị thông báo thông tin
info_log() {
    echo -e "\033[0;34m[THÔNG TIN]\033[0m $1" >&2
}

# Kiểm tra và cài đặt Node.js nếu cần
check_nodejs() {
    if ! command -v node &> /dev/null; then
        error_log "Node.js chưa được cài đặt. Bạn cần cài đặt Node.js để chạy Shell.AI."
        
        # Xác định hệ điều hành
        os_type="unknown"
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if command -v apt-get &> /dev/null; then
                os_type="debian"
            elif command -v yum &> /dev/null; then
                os_type="redhat"
            elif command -v pacman &> /dev/null; then
                os_type="arch"
            fi
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            os_type="mac"
        fi
        
        # Hiển thị hướng dẫn cài đặt dựa trên hệ điều hành
        case "$os_type" in
            "debian")
                install_cmd="curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
                ;;
            "redhat")
                install_cmd="curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
                ;;
            "arch")
                install_cmd="sudo pacman -S nodejs npm"
                ;;
            "mac")
                install_cmd="brew install node"
                ;;
            *)
                error_log "Không thể xác định cách cài đặt Node.js tự động cho hệ điều hành của bạn."
                error_log "Vui lòng truy cập https://nodejs.org để cài đặt thủ công."
                exit 1
                ;;
        esac
        
        # Hỏi người dùng có muốn cài đặt tự động không
        read -p "Bạn có muốn cài đặt Node.js tự động không? (y/n): " answer
        
        if [[ "$answer" =~ ^[Yy]$ ]]; then
            info_log "Đang cài đặt Node.js..."
            echo "Lệnh sẽ được thực thi: $install_cmd"
            
            # Thực thi lệnh cài đặt
            eval "$install_cmd"
            
            # Kiểm tra lại sau khi cài đặt
            if command -v node &> /dev/null; then
                node_version=$(node -v)
                success_log "Đã cài đặt Node.js thành công (phiên bản $node_version)."
            else
                error_log "Cài đặt Node.js thất bại. Vui lòng cài đặt thủ công từ https://nodejs.org"
                exit 1
            fi
        else
            error_log "Bạn đã từ chối cài đặt Node.js. Vui lòng cài đặt thủ công từ https://nodejs.org"
            exit 1
        fi
    fi
}

# Kiểm tra Node.js
check_nodejs

# Đảm bảo file JavaScript có quyền thực thi
chmod +x "$JS_FILE"

# Chuyển tiếp tất cả tham số cho file JavaScript
node "$JS_FILE" "$@"

exit $? 