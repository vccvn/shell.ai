/**
 * Shell.AI Web Interface
 * Kết nối giao diện web với Shell.AI agent
 */

// Kiểm tra nếu đang chạy trong môi trường Electron
const isElectron = () => {
    return window && window.shellAI;
};

// Agent API - Cầu nối giữa Web UI và desktop agent
class ShellAIAgent {
    constructor() {
        this.isConnected = false;
        this.socket = null;
        this.chatHistory = [];
        
        // Khởi tạo kết nối
        if (isElectron()) {
            // Kết nối qua Electron IPC
            this.isConnected = true;
            console.log('Khởi tạo Shell.AI Agent qua Electron IPC');
        } else {
            // Kết nối qua WebSocket
            this.connectWebSocket();
        }
    }
    
    // Kết nối WebSocket đến desktop agent
    connectWebSocket() {
        try {
            this.socket = new WebSocket('ws://localhost:9000');
            
            this.socket.onopen = () => {
                console.log('Kết nối WebSocket thành công');
                this.isConnected = true;
                document.getElementById('system-info-content').textContent = 'Đã kết nối đến Shell.AI Agent';
                this.getSystemInfo();
            };
            
            this.socket.onclose = () => {
                console.log('Kết nối WebSocket đã đóng');
                this.isConnected = false;
                document.getElementById('system-info-content').textContent = 'Mất kết nối đến Shell.AI Agent. Đang thử kết nối lại...';
                
                // Thử kết nối lại sau 5 giây
                setTimeout(() => this.connectWebSocket(), 5000);
            };
            
            this.socket.onerror = (error) => {
                console.error('Lỗi WebSocket:', error);
                document.getElementById('system-info-content').innerHTML = 
                    'Không thể kết nối đến Shell.AI Agent.<br>' +
                    '<span class="error">Bạn cần chạy Shell.AI Desktop Agent để sử dụng đầy đủ tính năng.</span><br>' +
                    '<div class="offline-mode"><button id="download-agent">Tải Agent</button></div>';
                
                document.getElementById('download-agent').addEventListener('click', () => {
                    window.open('https://github.com/username/shellai/releases/latest', '_blank');
                });
            };
            
            this.socket.onmessage = (event) => {
                const response = JSON.parse(event.data);
                this.handleResponse(response);
            };
        } catch (error) {
            console.error('Lỗi khi khởi tạo WebSocket:', error);
            document.getElementById('system-info-content').textContent = 'Không thể kết nối đến Shell.AI Agent';
        }
    }
    
    // Gửi yêu cầu đến agent
    async sendRequest(message) {
        try {
            const request = {
                action: 'dev',
                message: message
            };
            
            if (isElectron()) {
                // Gửi thông qua Electron IPC
                const response = await window.shellAI.sendRequest(request);
                this.handleResponse(response);
                return true;
            } else if (this.isConnected && this.socket) {
                // Gửi thông qua WebSocket
                this.socket.send(JSON.stringify(request));
                return true;
            } else {
                // Gửi thông qua API server
                const response = await fetch('/api/agent/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        mode: 'dev'
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.handleResponse(data);
                    return true;
                } else {
                    console.error('Lỗi khi gửi yêu cầu đến API:', response.statusText);
                    return false;
                }
            }
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu:', error);
            this.addMessage('Không thể gửi yêu cầu đến Shell.AI. Vui lòng kiểm tra kết nối.', 'assistant');
            return false;
        }
    }
    
    // Thực thi script
    async executeScript(script) {
        try {
            const request = {
                action: 'execute',
                script: script
            };
            
            if (isElectron()) {
                // Thực thi script thông qua Electron
                const result = await window.shellAI.executeScript(script);
                return result;
            } else if (this.isConnected && this.socket) {
                // Thực thi script thông qua WebSocket
                this.socket.send(JSON.stringify(request));
                return true;
            } else {
                this.addMessage('Bạn cần chạy Shell.AI Desktop Agent để thực thi script.', 'assistant');
                return false;
            }
        } catch (error) {
            console.error('Lỗi khi thực thi script:', error);
            return false;
        }
    }
    
    // Lấy thông tin hệ thống
    async getSystemInfo() {
        try {
            const request = {
                action: 'system-info'
            };
            
            if (isElectron()) {
                // Lấy thông tin hệ thống qua Electron
                const systemInfo = await window.shellAI.getSystemInfo();
                this.updateSystemInfo(systemInfo);
            } else if (this.isConnected && this.socket) {
                // Lấy thông tin hệ thống qua WebSocket
                this.socket.send(JSON.stringify(request));
            } else {
                // Lấy thông tin hệ thống giới hạn từ browser
                const systemInfo = {
                    os_type: navigator.platform,
                    browser: navigator.userAgent,
                    language: navigator.language,
                    cookies_enabled: navigator.cookieEnabled
                };
                this.updateSystemInfo(systemInfo);
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin hệ thống:', error);
        }
    }
    
    // Cập nhật thông tin hệ thống trên giao diện
    updateSystemInfo(info) {
        const container = document.getElementById('system-info-content');
        let html = '';
        
        for (const [key, value] of Object.entries(info)) {
            html += `<div><strong>${key}:</strong> ${value}</div>`;
        }
        
        container.innerHTML = html;
    }
    
    // Xử lý phản hồi từ agent
    handleResponse(response) {
        console.log('Nhận phản hồi:', response);
        
        if (response.action === 'system-info') {
            this.updateSystemInfo(response.data);
            return;
        }
        
        if (response.message) {
            this.addMessage(response.message, 'assistant');
        }
        
        if (response.action === 'run' && response.script) {
            this.showScript(response.script);
        }
    }
    
    // Hiển thị script trên giao diện
    showScript(script) {
        const scriptContainer = document.getElementById('script-container');
        const scriptContent = document.getElementById('script-content');
        const scriptDescription = document.getElementById('script-description');
        
        scriptContainer.classList.remove('hidden');
        scriptContent.textContent = script.content;
        scriptDescription.textContent = script.description || 'Script được tạo bởi Shell.AI';
        
        // Lưu script hiện tại
        this.currentScript = script;
    }
    
    // Thêm tin nhắn vào giao diện chat
    addMessage(content, sender) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        
        messageElement.classList.add('message');
        messageElement.classList.add(sender === 'user' ? 'user-message' : 'assistant-message');
        
        // Xử lý tin nhắn có định dạng markdown đơn giản
        content = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        
        messageElement.innerHTML = content;
        messagesContainer.appendChild(messageElement);
        
        // Cuộn xuống tin nhắn mới nhất
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Lưu vào lịch sử chat
        this.chatHistory.push({
            role: sender,
            content: content
        });
    }
}

// Khởi tạo ứng dụng khi trang đã tải xong
document.addEventListener('DOMContentLoaded', () => {
    const agent = new ShellAIAgent();
    let configPanel = null;
    
    // Xử lý sự kiện khi người dùng gửi tin nhắn
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    // Thêm nút cấu hình
    const configContainer = document.createElement('div');
    configContainer.id = 'config-panel';
    configContainer.classList.add('config-panel', 'hidden');
    document.querySelector('.container').appendChild(configContainer);
    
    const configButton = document.createElement('button');
    configButton.textContent = 'Cấu hình';
    configButton.classList.add('config-button');
    document.querySelector('header').appendChild(configButton);
    
    // Thêm CSS cho nút và panel
    const style = document.createElement('style');
    style.textContent = `
        .config-button {
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 8px 15px;
            background-color: var(--secondary-color);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .config-panel {
            background-color: var(--light-color);
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            margin-top: 20px;
        }
        
        .config-form {
            display: grid;
            gap: 15px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .form-group label {
            font-weight: bold;
            color: var(--secondary-color);
        }
        
        .form-group input, .form-group select {
            padding: 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
        }
        
        .form-group input[type="checkbox"] {
            width: auto;
            align-self: flex-start;
        }
        
        .help-text {
            color: #666;
            font-size: 0.8em;
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        
        .btn-save, .btn-reset, .btn-cli-mode {
            padding: 8px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }
        
        .btn-save {
            background-color: var(--success-color);
            color: white;
        }
        
        .btn-reset {
            background-color: var(--warning-color);
            color: white;
        }
        
        .btn-cli-mode {
            background-color: var(--primary-color);
            color: white;
            margin-top: 15px;
        }
        
        .dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .cli-dialog {
            background-color: var(--light-color);
            border-radius: 8px;
            width: 80%;
            max-width: 800px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .dialog-header {
            background-color: var(--primary-color);
            color: white;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .dialog-close {
            background: none;
            border: none;
            color: white;
            font-size: 1.2em;
            cursor: pointer;
        }
        
        .dialog-content {
            padding: 15px;
            overflow-y: auto;
            max-height: calc(80vh - 50px);
            background-color: #2d2d2d;
            color: #e6e6e6;
            margin: 0;
            white-space: pre-wrap;
            font-family: 'Courier New', Courier, monospace;
        }
        
        .command-box {
            display: flex;
            margin-top: 10px;
            padding: 15px;
            background-color: var(--background-color);
            border-radius: 8px;
            align-items: center;
            gap: 10px;
        }
        
        .command-box input {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
        }
        
        .command-box button {
            padding: 8px 15px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
    
    // Xử lý sự kiện toggle config panel
    configButton.addEventListener('click', async () => {
        if (configContainer.classList.contains('hidden')) {
            // Hiển thị panel
            configContainer.classList.remove('hidden');
            
            // Khởi tạo config panel nếu chưa
            if (!configPanel) {
                // Tải script ConfigPanel.js nếu cần
                if (!window.ConfigPanel) {
                    await loadScript('/components/ConfigPanel.js');
                }
                configPanel = new ConfigPanel();
                await configPanel.init('config-panel');
            }
            
            // Thêm input box để chạy lệnh shellai.sh trực tiếp
            if (window.shellAI && !document.getElementById('command-box')) {
                const commandBox = document.createElement('div');
                commandBox.id = 'command-box';
                commandBox.classList.add('command-box');
                
                const commandInput = document.createElement('input');
                commandInput.type = 'text';
                commandInput.placeholder = 'Nhập lệnh shellai (VD: check mysql)';
                
                const runButton = document.createElement('button');
                runButton.textContent = 'Chạy';
                runButton.addEventListener('click', async () => {
                    const command = commandInput.value.trim();
                    if (command) {
                        try {
                            // Tách lệnh thành các phần
                            const parts = command.split(' ');
                            const mainCommand = parts[0];
                            const params = parts.slice(1);
                            
                            const result = await window.shellAI.runShellAI(mainCommand, params);
                            
                            // Hiển thị kết quả
                            const dialog = document.createElement('div');
                            dialog.classList.add('cli-dialog');
                            
                            const dialogHeader = document.createElement('div');
                            dialogHeader.classList.add('dialog-header');
                            dialogHeader.textContent = `Kết quả chạy: shellai ${command}`;
                            
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
                        } catch (error) {
                            console.error('Lỗi khi chạy lệnh shellai:', error);
                            alert('Lỗi khi chạy lệnh: ' + error.message);
                        }
                    }
                });
                
                commandBox.appendChild(commandInput);
                commandBox.appendChild(runButton);
                configContainer.appendChild(commandBox);
            }
        } else {
            // Ẩn panel
            configContainer.classList.add('hidden');
        }
    });
    
    // Hàm tải script động
    async function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    const sendMessage = async () => {
        const message = userInput.value.trim();
        
        if (message) {
            // Hiển thị tin nhắn của người dùng
            agent.addMessage(message, 'user');
            
            // Xóa input
            userInput.value = '';
            
            // Gửi tin nhắn đến agent
            await agent.sendRequest(message);
        }
    };
    
    // Xử lý sự kiện khi click nút gửi
    sendButton.addEventListener('click', sendMessage);
    
    // Xử lý sự kiện khi nhấn Enter
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    
    // Xử lý sự kiện khi thực thi script
    document.getElementById('run-script').addEventListener('click', async () => {
        if (agent.currentScript) {
            const result = await agent.executeScript(agent.currentScript);
            if (result && result.output) {
                // Hiển thị kết quả
                const outputContainer = document.createElement('div');
                outputContainer.classList.add('output-container');
                outputContainer.textContent = result.output;
                
                document.getElementById('script-container').appendChild(outputContainer);
            }
        }
    });
    
    // Xử lý sự kiện khi lưu script
    document.getElementById('save-script').addEventListener('click', () => {
        if (agent.currentScript) {
            if (isElectron()) {
                // Lưu file qua Electron
                window.shellAI.saveScript(agent.currentScript);
            } else {
                // Tạo blob và download
                const blob = new Blob([agent.currentScript.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = agent.currentScript.filename || 'shellai-script.sh';
                a.click();
                
                URL.revokeObjectURL(url);
            }
        }
    });
    
    // Xử lý sự kiện khi hủy script
    document.getElementById('cancel-script').addEventListener('click', () => {
        document.getElementById('script-container').classList.add('hidden');
        agent.currentScript = null;
    });
}); 