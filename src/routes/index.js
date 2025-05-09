/**
 * Routes chính cho ứng dụng Shell.AI API
 */
const express = require('express');
const router = express.Router();
const agentRoutes = require('./agent.routes');

// Đăng ký routes cho agent
router.use('/agent', agentRoutes);

// Route mặc định
router.get('/', (req, res) => {
  res.json({
    name: 'Shell.AI API',
    version: '1.0.0',
    description: 'API cho Shell.AI - Trợ lý thông minh cho hệ thống'
  });
});

// Route để lấy thông tin về client capabilities
router.get('/client-capabilities', (req, res) => {
  try {
    // Đọc file client_capabilities.json
    const clientCapabilities = require('../data/client_capabilities.json');
    res.json(clientCapabilities);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Không thể đọc thông tin client capabilities',
      error: error.message
    });
  }
});

module.exports = router; 