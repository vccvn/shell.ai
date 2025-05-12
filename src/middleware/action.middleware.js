const actionManager = require('../actions');

/**
 * Middleware xử lý action
 * Kiểm tra và validate action trước khi xử lý
 */
const actionHandler = (req, res, next) => {
    try {
        const { action } = req.body;
        
        // Kiểm tra action có tồn tại không
        if (!action) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu trường action trong request'
            });
        }

        // Lấy thông tin action
        const actionInfo = actionManager.getAction(action);
        if (!actionInfo) {
            return res.status(400).json({
                success: false,
                message: `Action "${action}" không tồn tại`
            });
        }

        // Validate các trường bắt buộc
        try {
            actionManager.validateAction(action, req.body);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // Thêm thông tin action vào request để controller sử dụng
        req.actionInfo = actionInfo;
        next();
    } catch (error) {
        console.error('Lỗi xử lý action:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xử lý action'
        });
    }
};

module.exports = { actionHandler }; 