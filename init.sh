#!/bin/bash

# init.sh - Script kiểm tra và cài đặt các thư viện cần thiết cho Shell.AI

# Đặt màu sắc để hiển thị thông báo
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Hiển thị banner
echo -e "${BLUE}┌───────────────────────────────────────┐${NC}"
echo -e "${BLUE}│           Shell.AI - Setup            │${NC}"
echo -e "${BLUE}└───────────────────────────────────────┘${NC}"

# Xác định hệ điều hành
detect_os() {
  case "$OSTYPE" in
    darwin*)
      OS="macos"
      OS_NAME=$(sw_vers -productName)
      OS_VERSION=$(sw_vers -productVersion)
      info_log "Phát hiện hệ điều hành: $OS_NAME $OS_VERSION"
      ;;
    linux*)
      OS="linux"
      if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=$NAME
        OS_VERSION=$VERSION_ID
        info_log "Phát hiện hệ điều hành: $OS_NAME $OS_VERSION"
      elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        OS_NAME=$DISTRIB_ID
        OS_VERSION=$DISTRIB_RELEASE
        info_log "Phát hiện hệ điều hành: $OS_NAME $OS_VERSION"
      elif [ -f /etc/debian_version ]; then
        OS_NAME="Debian"
        OS_VERSION=$(cat /etc/debian_version)
        info_log "Phát hiện hệ điều hành: $OS_NAME $OS_VERSION"
      elif [ -f /etc/redhat-release ]; then
        OS_NAME=$(cat /etc/redhat-release | cut -d ' ' -f 1)
        OS_VERSION=$(cat /etc/redhat-release | grep -oE '[0-9]+\.[0-9]+')
        info_log "Phát hiện hệ điều hành: $OS_NAME $OS_VERSION"
      else
        OS_NAME="Linux"
        OS_VERSION=$(uname -r)
        info_log "Phát hiện hệ điều hành: $OS_NAME $OS_VERSION"
      fi
      ;;
    cygwin*|msys*|mingw*)
      OS="windows"
      OS_NAME="Windows"
      OS_VERSION=$(cmd /c ver | grep -o '[0-9]\.[0-9]\.[0-9]*')
      info_log "Phát hiện hệ điều hành: $OS_NAME $OS_VERSION"
      ;;
    *)
      OS="unknown"
      OS_NAME="Unknown"
      OS_VERSION="Unknown"
      warning_log "Không thể xác định chính xác hệ điều hành: $OSTYPE"
      ;;
  esac
}

# Hàm info log
info_log() {
  echo -e "${BLUE}[THÔNG TIN]${NC} $1"
}

# Hàm success log
success_log() {
  echo -e "${GREEN}[THÀNH CÔNG]${NC} $1"
}

# Hàm error log
error_log() {
  echo -e "${RED}[LỖI]${NC} $1"
}

# Hàm warning log
warning_log() {
  echo -e "${YELLOW}[CẢNH BÁO]${NC} $1"
}

# Kiểm tra xem command có tồn tại không
command_exists() {
  command -v "$1" &> /dev/null
}

# Kiểm tra và cài đặt curl nếu cần
check_curl() {
  info_log "Kiểm tra curl..."
  if command_exists curl; then
    success_log "curl đã được cài đặt."
  else
    warning_log "curl chưa được cài đặt. Đang cài đặt..."
    
    if [[ "$OS" == "macos" ]]; then
      # macOS
      brew install curl
    elif [[ "$OS" == "linux" ]]; then
      if command_exists apt-get; then
        # Debian/Ubuntu
        sudo apt-get update && sudo apt-get install -y curl
      elif command_exists yum; then
        # CentOS/RHEL/Fedora
        sudo yum install -y curl
      elif command_exists dnf; then
        # Newer Fedora
        sudo dnf install -y curl
      elif command_exists pacman; then
        # Arch Linux
        sudo pacman -S --noconfirm curl
      elif command_exists zypper; then
        # OpenSUSE
        sudo zypper install -y curl
      else
        error_log "Không thể cài đặt curl tự động. Vui lòng cài đặt thủ công."
        exit 1
      fi
    else
      error_log "Không thể cài đặt curl tự động trên hệ điều hành này. Vui lòng cài đặt thủ công."
      exit 1
    fi
    
    if command_exists curl; then
      success_log "curl đã được cài đặt thành công."
    else
      error_log "Không thể cài đặt curl. Vui lòng cài đặt thủ công."
      exit 1
    fi
  fi
}

# Kiểm tra và cài đặt jq nếu cần
check_jq() {
  info_log "Kiểm tra jq..."
  if command_exists jq; then
    success_log "jq đã được cài đặt."
  else
    warning_log "jq chưa được cài đặt. Đang cài đặt..."
    
    if [[ "$OS" == "macos" ]]; then
      # macOS
      brew install jq
    elif [[ "$OS" == "linux" ]]; then
      if command_exists apt-get; then
        # Debian/Ubuntu
        sudo apt-get update && sudo apt-get install -y jq
      elif command_exists yum; then
        # CentOS/RHEL/Fedora
        sudo yum install -y jq
      elif command_exists dnf; then
        # Newer Fedora
        sudo dnf install -y jq
      elif command_exists pacman; then
        # Arch Linux
        sudo pacman -S --noconfirm jq
      elif command_exists zypper; then
        # OpenSUSE
        sudo zypper install -y jq
      else
        error_log "Không thể cài đặt jq tự động. Vui lòng cài đặt thủ công."
        exit 1
      fi
    else
      error_log "Không thể cài đặt jq tự động trên hệ điều hành này. Vui lòng cài đặt thủ công."
      exit 1
    fi
    
    if command_exists jq; then
      success_log "jq đã được cài đặt thành công."
    else
      error_log "Không thể cài đặt jq. Vui lòng cài đặt thủ công."
      exit 1
    fi
  fi
}

# Kiểm tra và cài đặt xmllint nếu cần
check_xmllint() {
  info_log "Kiểm tra xmllint..."
  if command_exists xmllint; then
    success_log "xmllint đã được cài đặt."
  else
    warning_log "xmllint chưa được cài đặt. Đang cài đặt..."
    
    if [[ "$OS" == "macos" ]]; then
      # macOS
      brew install libxml2
    elif [[ "$OS" == "linux" ]]; then
      if command_exists apt-get; then
        # Debian/Ubuntu
        sudo apt-get update && sudo apt-get install -y libxml2-utils
      elif command_exists yum; then
        # CentOS/RHEL/Fedora
        sudo yum install -y libxml2
      elif command_exists dnf; then
        # Newer Fedora
        sudo dnf install -y libxml2
      elif command_exists pacman; then
        # Arch Linux
        sudo pacman -S --noconfirm libxml2
      elif command_exists zypper; then
        # OpenSUSE
        sudo zypper install -y libxml2
      else
        error_log "Không thể cài đặt xmllint tự động. Vui lòng cài đặt thủ công."
        exit 1
      fi
    else
      error_log "Không thể cài đặt xmllint tự động trên hệ điều hành này. Vui lòng cài đặt thủ công gói libxml2."
      exit 1
    fi
    
    if command_exists xmllint; then
      success_log "xmllint đã được cài đặt thành công."
    else
      error_log "Không thể cài đặt xmllint. Vui lòng cài đặt thủ công."
      exit 1
    fi
  fi
}

# Kiểm tra Node.js và npm, nhưng không tự động cài đặt
check_nodejs_npm() {
  info_log "Kiểm tra Node.js..."
  if command_exists node; then
    NODE_VERSION=$(node --version)
    success_log "Node.js đã được cài đặt. Phiên bản: $NODE_VERSION"
  else
    warning_log "Node.js chưa được cài đặt. Shell.AI cần Node.js để hoạt động đầy đủ."
    info_log "Vui lòng cài đặt Node.js từ https://nodejs.org/"
    
    if [[ "$OS" == "macos" ]]; then
      info_log "Trên macOS, bạn có thể cài đặt bằng lệnh: brew install node"
    elif [[ "$OS" == "linux" ]]; then
      if command_exists apt-get; then
        info_log "Trên Debian/Ubuntu, bạn có thể cài đặt bằng lệnh: sudo apt-get install nodejs npm"
      elif command_exists yum; then
        info_log "Trên CentOS/RHEL, bạn có thể cài đặt bằng lệnh: sudo yum install nodejs npm"
      elif command_exists dnf; then
        info_log "Trên Fedora, bạn có thể cài đặt bằng lệnh: sudo dnf install nodejs npm"
      elif command_exists pacman; then
        info_log "Trên Arch Linux, bạn có thể cài đặt bằng lệnh: sudo pacman -S nodejs npm"
      fi
    fi
    
    read -p "Bạn có muốn tiếp tục mà không cài đặt Node.js không? (y/n): " answer
    if [[ "$(echo "$answer" | tr '[:upper:]' '[:lower:]')" != "y" ]]; then
      exit 1
    fi
  fi

  # Kiểm tra npm
  if command_exists node; then  # Chỉ kiểm tra npm nếu node đã được cài đặt
    info_log "Kiểm tra npm..."
    if command_exists npm; then
      NPM_VERSION=$(npm --version)
      success_log "npm đã được cài đặt. Phiên bản: $NPM_VERSION"
    else
      warning_log "npm chưa được cài đặt, mặc dù Node.js đã được cài đặt."
      info_log "Vui lòng cài đặt npm, thường đi kèm với Node.js."
      
      read -p "Bạn có muốn tiếp tục mà không cài đặt npm không? (y/n): " answer
      if [[ "$(echo "$answer" | tr '[:upper:]' '[:lower:]')" != "y" ]]; then
        exit 1
      fi
    fi
  fi
}

# Kiểm tra và cài đặt các package Node.js cần thiết
install_node_packages() {
  info_log "Kiểm tra và cài đặt các package Node.js..."
  
  # Danh sách các package cần thiết
  PACKAGES=(
    "xml-js"
    "axios"
  )
  
  # Kiểm tra package.json tồn tại
  if [ -f "package.json" ]; then
    info_log "Đã tìm thấy package.json. Cài đặt dependencies từ file này..."
    npm install
    success_log "Đã cài đặt các dependencies từ package.json."
  else
    # Nếu không có package.json, cài đặt các package cần thiết
    for package in "${PACKAGES[@]}"; do
      info_log "Kiểm tra package $package..."
      
      # Kiểm tra xem package đã được cài đặt chưa
      if npm list "$package" 2>/dev/null | grep -q "$package"; then
        success_log "Package $package đã được cài đặt."
      else
        warning_log "Package $package chưa được cài đặt. Đang cài đặt..."
        npm install "$package"
        success_log "Đã cài đặt package $package."
      fi
    done
  fi
}

# Thiết lập quyền thực thi cho các file script
setup_permissions() {
  info_log "Thiết lập quyền thực thi cho các file script..."
  
  # Danh sách các file script cần thiết lập quyền
  SCRIPTS=(
    "shellai.sh"
    "shellai.js"
    "ai"
  )
  
  for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
      chmod +x "$script"
      success_log "Đã thiết lập quyền thực thi cho $script."
    else
      warning_log "Không tìm thấy file $script."
    fi
  done
}

# Tạo symbolic link để dễ sử dụng
create_symlink() {
  info_log "Tạo symbolic link..."
  
  # Đường dẫn tuyệt đối đến thư mục hiện tại
  CURRENT_DIR=$(pwd)
  
  # Kiểm tra quyền sudo
  if command_exists sudo; then
    if [ -f "shellai.js" ]; then
      sudo ln -sf "$CURRENT_DIR/shellai.js" /usr/local/bin/shellai
      success_log "Đã tạo symbolic link cho shellai.js tại /usr/local/bin/shellai."
    elif [ -f "shellai.sh" ]; then
      sudo ln -sf "$CURRENT_DIR/shellai.sh" /usr/local/bin/shellai
      success_log "Đã tạo symbolic link cho shellai.sh tại /usr/local/bin/shellai."
    elif [ -f "ai" ]; then
      sudo ln -sf "$CURRENT_DIR/ai" /usr/local/bin/ai
      success_log "Đã tạo symbolic link cho ai tại /usr/local/bin/ai."
    else
      warning_log "Không tìm thấy file shellai.js, shellai.sh hoặc ai để tạo symbolic link."
    fi
  else
    warning_log "Không có quyền sudo. Bỏ qua việc tạo symbolic link."
  fi
}

# Hiển thị hướng dẫn sử dụng
show_usage() {
  echo -e "\n${BLUE}┌───────────────────────────────────────┐${NC}"
  echo -e "${BLUE}│           Cài đặt thành công          │${NC}"
  echo -e "${BLUE}└───────────────────────────────────────┘${NC}"
  echo -e "\nCách sử dụng Shell.AI:"
  echo -e "  ${GREEN}./shellai.sh${NC}              - Chạy Shell.AI bằng Bash"
  echo -e "  ${GREEN}node shellai.js${NC}           - Chạy Shell.AI bằng Node.js"
  echo -e "  ${GREEN}shellai${NC}                   - Chạy Shell.AI (nếu đã tạo symbolic link)"
  
  echo -e "\nVí dụ các lệnh:"
  echo -e "  ${GREEN}./shellai.sh chat${NC}         - Bắt đầu chế độ chat với AI"
  echo -e "  ${GREEN}./shellai.sh dev${NC}          - Bắt đầu chế độ phát triển"
  echo -e "  ${GREEN}./shellai.sh -m \"kiểm tra cấu hình hệ thống\"${NC}"
}

# Hàm main
main() {
  # Phát hiện hệ điều hành
  detect_os
  
  # Kiểm tra homebrew trên macOS
  if [[ "$OS" == "macos" ]]; then
    info_log "Kiểm tra Homebrew trên macOS..."
    if command_exists brew; then
      success_log "Homebrew đã được cài đặt."
    else
      warning_log "Homebrew chưa được cài đặt. Đang cài đặt..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      
      if command_exists brew; then
        success_log "Homebrew đã được cài đặt thành công."
      else
        error_log "Không thể cài đặt Homebrew. Vui lòng cài đặt thủ công từ https://brew.sh/"
        exit 1
      fi
    fi
  fi
  
  # Kiểm tra các công cụ cần thiết
  check_curl
  check_jq
  check_xmllint
  check_nodejs_npm  # Thay thế cho check_nodejs và check_npm
  
  # Kiểm tra các package Node.js nếu Node.js đã được cài đặt
  if command_exists node && command_exists npm; then
    install_node_packages
  fi
  
  # Thiết lập quyền thực thi
  setup_permissions
  
  # Hỏi người dùng có muốn tạo symbolic link không
  echo -e "\n"
  read -p "Bạn có muốn tạo symbolic link để dễ sử dụng không? (y/n): " answer
  if [[ "$(echo "$answer" | tr '[:upper:]' '[:lower:]')" == "y" ]]; then
    create_symlink
  fi
  
  # Hiển thị hướng dẫn sử dụng
  show_usage
}

# Chạy hàm main
main 