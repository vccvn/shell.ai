/**
 * Shell.AI Electron Preload Script
 * Cầu nối giữa renderer process và main process của Electron
 */

const { contextBridge, ipcRenderer } = require('electron');

// Hiển thị API cho renderer process
contextBridge.exposeInMainWorld('shellAI', {
    // Gửi yêu cầu đến Shell.AI
    sendRequest: (request) => ipcRenderer.invoke('sendRequest', request),
    
    // Thực thi script
    executeScript: (script) => ipcRenderer.invoke('executeScript', script),
    
    // Lưu script
    saveScript: (script) => ipcRenderer.invoke('saveScript', script),
    
    // Lấy thông tin hệ thống
    getSystemInfo: () => ipcRenderer.invoke('getSystemInfo'),
    
    // Thực thi lệnh
    executeCommand: (command) => ipcRenderer.invoke('executeCommand', command),
    
    // Quản lý cấu hình
    getConfig: () => ipcRenderer.invoke('getConfig'),
    saveConfig: (config) => ipcRenderer.invoke('saveConfig', config),
    
    // Quản lý file .env
    loadEnvFile: () => ipcRenderer.invoke('loadEnvFile'),
    saveEnvFile: (content) => ipcRenderer.invoke('saveEnvFile', content),
    
    // Chạy lệnh shellai.sh hoặc shellai.js
    runShellAI: (command, params) => ipcRenderer.invoke('runShellAI', command, params),
    
    // Thông tin phiên bản
    version: process.env.npm_package_version || '1.0.0',
    
    // Thông tin hệ điều hành
    platform: process.platform
}); 