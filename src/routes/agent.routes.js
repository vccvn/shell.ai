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

/**
 * @route POST /api/agent/chat
 * @desc Xử lý yêu cầu chat
 * @access Public
 */
router.post('/chat', agentController.handleChat);

module.exports = router; 