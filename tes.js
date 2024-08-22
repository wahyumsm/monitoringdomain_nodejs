const axios = require("axios");

const botToken = "7205420800:AAHl49A32cE3cim-QUuVeoZZsqorIGfWDY4"; // Bot token valid
const chatId = "-1002202234253,"; // Ganti dengan Chat ID kamu
const message = "Tes pengiriman pesan dari bot Telegram.";

async function sendTestMessage() {
  try {
    const TELEGRAM_API_URL = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await axios.post(TELEGRAM_API_URL, {
      chat_id: chatId,
      text: message,
    });

    if (response.data.ok) {
      console.log("Pesan berhasil dikirim!");
    } else {
      console.error("Error mengirim pesan:", response.data.description);
    }
  } catch (error) {
    console.error(
      "Error mengirim pesan:",
      error.response ? error.response.data : error.message
    );
  }
}

sendTestMessage();
