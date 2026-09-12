const axios = require('axios');
const config = require('./config');

async function sendMessage(text) {
  const url = `https://api.telegram.org/bot${config.telegram.token}/sendMessage`;
  await axios.post(url, {
    chat_id: config.telegram.chatId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
  });
}

module.exports = { sendMessage };