const puppeteer = require("puppeteer");
const { Telegraf } = require("telegraf");

// Token bot Telegram
const botToken = "7205420800:AAHl49A32cE3cim-QUuVeoZZsqorIGfWDY4";
const bot = new Telegraf(botToken);

// Daftar domain yang ditentukan
const predefinedWebsites = [
  "jackscottmusic.com",
  "vegas138r.lol",
  "goassam.com",
  "jesusadventcalendar.com",
  "sini.pages.dev",
  "vegas138rtp-03.pages.dev",
];

// ID chat Telegram
const chatId = "6387879632";

// Fungsi untuk memeriksa status website menggunakan Puppeteer
async function checkWebsites(websites, listName) {
  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ["--no-sandbox", "--ignore-certificate-errors"],
  });

  let resultMessage = `Laporan Dari ${listName}\n\n`;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto("https://trustpositif.kominfo.go.id/");
    await page.waitForSelector("#press-to-modal");
    await page.click("#press-to-modal");
    await page.waitForSelector("#input-data");

    const websitesStr = websites.join("\n");
    await page.evaluate((websitesStr) => {
      document.querySelector("#input-data").value = websitesStr;
    }, websitesStr);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.click("#text-footer");
    await page.waitForSelector("#daftar-block", { visible: true });

    let previousHeight;
    let result = [];

    while (true) {
      previousHeight = await page.evaluate(
        'document.querySelector("#daftar-block tbody").scrollHeight'
      );
      await page.evaluate(
        'window.scrollTo(0, document.querySelector("#daftar-block tbody").scrollHeight)'
      );
      await new Promise((resolve) => setTimeout(resolve, 2000)); // wait for more data to load
      const newHeight = await page.evaluate(
        'document.querySelector("#daftar-block tbody").scrollHeight'
      );

      if (newHeight === previousHeight) break;
    }

    result = await page.evaluate(() => {
      const rows = document.querySelectorAll("#daftar-block tbody tr");
      const data = Array.from(rows).map((row) => {
        const columns = row.querySelectorAll("td");
        const url = columns[0].innerText;
        const status = columns[1].innerText;
        return { url, status };
      });
      return data;
    });

    console.log("Result data:", result); // Debugging line

    result.forEach((entry) => {
      console.log(entry);
      if (entry.status === "Ada") {
        resultMessage += `🚫 URL ${entry.url} BANNED\n`;
      } else {
        resultMessage += `✅ URL ${entry.url} AMAN\n`;
      }
    });

    await page.close();
  } catch (error) {
    console.error(`Error checking websites:`, error);
  } finally {
    await browser.close();
  }

  resultMessage += "\nNawala Checker Via : https://trustpositif.kominfo.go.id/";
  console.log(resultMessage);
  return resultMessage;
}

// Fungsi untuk mengirim pesan ke Telegram
async function sendMessage(chatId, message) {
  const MAX_MESSAGE_LENGTH = 4096;

  if (message.length <= MAX_MESSAGE_LENGTH) {
    console.log("Sending message:", message); // Debugging line
    await bot.telegram.sendMessage(chatId, message);
  } else {
    let parts = [];
    for (let i = 0; i < message.length; i += MAX_MESSAGE_LENGTH) {
      parts.push(message.substring(i, i + MAX_MESSAGE_LENGTH));
    }

    for (const part of parts) {
      console.log("Sending message part:", part); // Debugging line
      await bot.telegram.sendMessage(chatId, part);
    }
  }
}

// Fungsi utama untuk melakukan pemeriksaan
async function performCheck() {
  const resultMessage = await checkWebsites(
    predefinedWebsites,
    "Predefined List"
  );
  await sendMessage(chatId, resultMessage);
}

// Fungsi utama
async function main() {
  // Perform the initial check immediately
  await performCheck();

  // Set up the interval to check every 10 minutes (600000 milliseconds)
  setInterval(async () => {
    console.log("Running the 10-minute check...");
    await performCheck();
  }, 600000);
}

// Jalankan fungsi utama
main();
