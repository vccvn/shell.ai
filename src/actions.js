const fs = require('fs');
const path = require('path');

class ActionManager {
    constructor() {
        this.actions = new Map();
        this.loadActionMap();
    }

    loadActionMap() {
        try {
            const actionMapPath = path.join(__dirname, 'prompts', 'action_map.txt');
            const content = fs.readFileSync(actionMapPath, 'utf8');
            
            // Parse action map content
            const actionSections = content.split('##').filter(section => section.trim());
            
            actionSections.forEach(section => {
                const lines = section.split('\n');
                const actionName = lines[0].match(/ACTION "([^"]+)"/)?.[1];
                
                if (actionName) {
                    const action = {
                        name: actionName,
                        description: this.extractValue(lines, 'Mô tả'),
                        fields: this.extractFields(lines),
                        processing: this.extractProcessing(lines)
                    };
                    this.actions.set(actionName, action);
                }
            });

            console.log('Đã load thành công action map');
        } catch (error) {
            console.error('Lỗi khi load action map:', error);
            throw error;
        }
    }

    extractValue(lines, key) {
        const line = lines.find(l => l.includes(`**${key}**:`));
        return line ? line.split('**:')[1].trim() : null;
    }

    extractFields(lines) {
        const fields = {};
        let currentField = null;
        let inFields = false;

        lines.forEach(line => {
            if (line.includes('**Trường dữ liệu**:')) {
                inFields = true;
                return;
            }
            if (inFields && line.trim().startsWith('-')) {
                const fieldMatch = line.match(/- ([^:]+):/);
                if (fieldMatch) {
                    currentField = fieldMatch[1].trim();
                    fields[currentField] = {
                        description: line.split(':')[1].trim()
                    };
                }
            }
        });

        return fields;
    }

    extractProcessing(lines) {
        const processing = [];
        let inProcessing = false;

        lines.forEach(line => {
            if (line.includes('**Xử lý**:')) {
                inProcessing = true;
                return;
            }
            if (inProcessing && line.trim().startsWith('-')) {
                processing.push(line.trim().substring(1).trim());
            }
        });

        return processing;
    }

    getAction(actionName) {
        return this.actions.get(actionName);
    }

    getAllActions() {
        return Array.from(this.actions.values());
    }

    validateAction(actionName, data) {
        // Không thực hiện kiểm tra, luôn trả về true
        return true;
        
        /* 
        // Code kiểm tra cũ đã bị vô hiệu hóa
        const action = this.getAction(actionName);
        if (!action) {
            throw new Error(`Action "${actionName}" không tồn tại`);
        }

        // Kiểm tra các trường bắt buộc
        const requiredFields = Object.keys(action.fields);
        for (const field of requiredFields) {
            if (!data[field]) {
                throw new Error(`Thiếu trường bắt buộc "${field}" cho action "${actionName}"`);
            }
        }

        return true;
        */
    }

    getActionDescription(actionName) {
        const action = this.getAction(actionName);
        return action ? action.description : null;
    }

    getActionFields(actionName) {
        const action = this.getAction(actionName);
        return action ? action.fields : null;
    }

    getActionProcessing(actionName) {
        const action = this.getAction(actionName);
        return action ? action.processing : null;
    }
}

// Export singleton instance
const actionManager = new ActionManager();
module.exports = actionManager; 