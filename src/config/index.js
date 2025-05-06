require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.MODEL || 'gpt-4'
  },
  shellDir: process.env.SHELL_DIR || './src/shell'
}; 