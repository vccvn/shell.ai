/**
 * ConfigPanel.js - Component hiển thị giao diện cấu hình Shell.AI
 */

class ConfigPanel {
    constructor() {
        this.config = {};
        this.container = null;
        this.initialized = false;
    }

    // Khởi tạo component
    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Không tìm thấy container với id:', containerId);
            return false;
        }

        // Tải cấu hình
        await this.loadConfig();
        
        // Tạo giao diện
        this.render();
        
        // Đánh dấu đã khởi tạo
        this.initialized = true;
        return true;
    }

    // Tải cấu hình
    async loadConfig() {
        try {
            if (window.shellAI) {
                // Tải cấu hình qua Electron API
                this.config = await window.shellAI.getConfig();
            } else {
                // Tải cấu hình qua API server
                const response = await fetch('/api/agent/config', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    this.config = await response.json();
                } else {
                    throw new Error('Không thể tải cấu hình từ API server');
                }
            }
            
            return true;
        } catch (error) {
            console.error('Lỗi khi tải cấu hình:', error);
            this.config = {
                API_URL: 'http://localhost:3000/api/agent',
                SHELL_DIR: './src/shell',
                DEBUG: false,
                OPENAI_API_KEY: '',
                API_KEY: '',
                MODEL: 'gpt-4'
            };
            return false;
        }
    }

    // Lưu cấu hình
    async saveConfig() {
        try {
            if (window.shellAI) {
                // Lưu cấu hình qua Electron API
                await window.shellAI.saveConfig(this.config);
            } else {
                // Lưu cấu hình qua API server
                const response = await fetch('/api/agent/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.config)
                });
                
                if (!response.ok) {
                    throw new Error('Không thể lưu cấu hình đến API server');
                }
            }
            
            return true;
        } catch (error) {
            console.error('Lỗi khi lưu cấu hình:', error);
            return false;
        }
    }

    // Cập nhật giá trị cấu hình
    updateConfig(key, value) {
        this.config[key] = value;
    }

    // Render giao diện
    render() {
        if (!this.container) return;
        
        // Xóa nội dung cũ
        this.container.innerHTML = '';
        
        // Tạo các phần tử giao diện
        const title = document.createElement('h3');
        title.textContent = 'Cấu hình Shell.AI';
        title.classList.add('config-title');
        
        const form = document.createElement('form');
        form.classList.add('config-form');
        
        // Thêm các trường cấu hình
        const fields = [
            { key: 'API_URL', label: 'API URL', type: 'text', help: 'URL của API server' },
            { key: 'SHELL_DIR', label: 'Shell Directory', type: 'text', help: 'Thư mục lưu trữ các script' },
            { key: 'DEBUG', label: 'Debug Mode', type: 'checkbox', help: 'Bật/tắt chế độ Debug' },
            { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', type: 'password', help: 'API key của OpenAI' },
            { key: 'API_KEY', label: 'API Key', type: 'password', help: 'API key để xác thực với API server' },
            { key: 'MODEL', label: 'AI Model', type: 'select', help: 'Model AI sử dụng', 
              options: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'] }
        ];
        
        // Thêm từng trường vào form
        fields.forEach(field => {
            const formGroup = document.createElement('div');
            formGroup.classList.add('form-group');
            
            const label = document.createElement('label');
            label.setAttribute('for', `config-${field.key}`);
            label.textContent = field.label;
            
            let input;
            
            if (field.type === 'select') {
                input = document.createElement('select');
                field.options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    optionElement.selected = this.config[field.key] === option;
                    input.appendChild(optionElement);
                });
            } else {
                input = document.createElement('input');
                input.type = field.type;
                input.value = field.type === 'checkbox' ? '' : (this.config[field.key] || '');
                if (field.type === 'checkbox') {
                    input.checked = this.config[field.key] === true;
                }
            }
            
            input.id = `config-${field.key}`;
            input.name = field.key;
            
            // Thêm sự kiện thay đổi
            input.addEventListener('change', () => {
                const value = field.type === 'checkbox' ? input.checked : input.value;
                this.updateConfig(field.key, value);
            });
            
            const helpText = document.createElement('small');
            helpText.classList.add('help-text');
            helpText.textContent = field.help;
            
            formGroup.appendChild(label);
            formGroup.appendChild(input);
            formGroup.appendChild(helpText);
            form.appendChild(formGroup);
        });
        
        // Thêm nút lưu
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.classList.add('btn-save');
        saveButton.textContent = 'Lưu cấu hình';
        saveButton.addEventListener('click', async () => {
            const success = await this.saveConfig();
            if (success) {
                alert('Cấu hình đã được lưu thành công!');
            } else {
                alert('Lỗi khi lưu cấu hình!');
            }
        });
        
        // Thêm nút reset
        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.classList.add('btn-reset');
        resetButton.textContent = 'Khôi phục mặc định';
        resetButton.addEventListener('click', async () => {
            if (confirm('Bạn có chắc muốn khôi phục cấu hình về mặc định?')) {
                this.config = {
                    API_URL: 'http://localhost:3000/api/agent',
                    SHELL_DIR: './src/shell',
                    DEBUG: false,
                    OPENAI_API_KEY: '',
                    API_KEY: '',
                    MODEL: 'gpt-4'
                };
                this.render();
            }
        });
        
        const buttonGroup = document.createElement('div');
        buttonGroup.classList.add('button-group');
        buttonGroup.appendChild(saveButton);
        buttonGroup.appendChild(resetButton);
        
        // Thêm các phần tử vào container
        this.container.appendChild(title);
        this.container.appendChild(form);
        this.container.appendChild(buttonGroup);
        
        // Thêm nút CLI Mode
        if (window.shellAI) {
            const cliModeButton = document.createElement('button');
            cliModeButton.type = 'button';
            cliModeButton.classList.add('btn-cli-mode');
            cliModeButton.textContent = 'Chạy shellai config trong CLI';
            cliModeButton.addEventListener('click', async () => {
                try {
                    const result = await window.shellAI.runShellAI('config');
                    
                    // Hiển thị kết quả trong một cửa sổ dialog
                    const dialog = document.createElement('div');
                    dialog.classList.add('cli-dialog');
                    
                    const dialogHeader = document.createElement('div');
                    dialogHeader.classList.add('dialog-header');
                    dialogHeader.textContent = 'Kết quả chạy shellai config';
                    
                    const dialogClose = document.createElement('button');
                    dialogClose.classList.add('dialog-close');
                    dialogClose.textContent = 'X';
                    dialogClose.addEventListener('click', () => {
                        document.body.removeChild(dialogOverlay);
                    });
                    
                    dialogHeader.appendChild(dialogClose);
                    
                    const dialogContent = document.createElement('pre');
                    dialogContent.classList.add('dialog-content');
                    dialogContent.textContent = result.output || 'Không có kết quả';
                    
                    const dialogOverlay = document.createElement('div');
                    dialogOverlay.classList.add('dialog-overlay');
                    
                    dialog.appendChild(dialogHeader);
                    dialog.appendChild(dialogContent);
                    dialogOverlay.appendChild(dialog);
                    
                    document.body.appendChild(dialogOverlay);
                    
                    // Reload cấu hình sau khi chạy CLI
                    await this.loadConfig();
                    this.render();
                } catch (error) {
                    console.error('Lỗi khi chạy shellai config:', error);
                    alert('Lỗi khi chạy shellai config: ' + error.message);
                }
            });
            
            this.container.appendChild(document.createElement('hr'));
            this.container.appendChild(cliModeButton);
        }
    }
    
    // Hiển thị panel
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }
    
    // Ẩn panel
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
}

// Export để có thể import trong module khác
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigPanel;
} 