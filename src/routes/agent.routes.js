const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');

/**
 * @route POST /api/agent/process
 * @desc Xử lý yêu cầu và tạo script
 * @access Public
 */
router.post('/process', agentController.processIssue);

/**
 * @route POST /api/agent/fix
 * @desc Sửa lỗi và tạo script mới
 * @access Public
 */
router.post('/fix', agentController.fixScriptError);

module.exports = router; 