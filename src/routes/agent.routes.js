/**
 * Routes cho các API endpoints của Agent
 */
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const { apiKeyAuth } = require('../middleware/auth.middleware');

/**
 * @route POST /api/agent/process
 * @desc Xử lý yêu cầu và tạo script
 * @access Private - Yêu cầu API key
 */
router.post('/process', apiKeyAuth, agentController.processIssue);

/**
 * @route POST /api/agent/fix
 * @desc Sửa lỗi và tạo script mới
 * @access Private - Yêu cầu API key
 */
router.post('/fix', apiKeyAuth, agentController.fixScriptError);

/**
 * @route POST /api/agent/chat
 * @desc Xử lý yêu cầu chat
 * @access Private - Yêu cầu API key
 */
router.post('/chat', apiKeyAuth, agentController.handleChat);

/**
 * @route POST /api/agent/analyze
 * @desc Xử lý file hoặc lỗi nâng cao
 * @access Private - Yêu cầu API key
 */
router.post('/analyze', apiKeyAuth, agentController.analyzeFileOrError);

module.exports = router; 