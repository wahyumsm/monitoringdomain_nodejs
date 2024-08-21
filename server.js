const puppeteer = require("puppeteer");
const axios = require("axios");
const { Telegraf } = require("telegraf");
const readline = require("readline");

// Inisialisasi readline untuk membaca input dari pengguna
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Fungsi untuk membaca input dari pengguna secara asinkron
function askQuestion(query) {
  return new Promise((resolve) =>
    rl.question(query, (answer) => resolve(answer))
  );
}

const botToken = "7283088350:AAGJees2na_4J3l64pnjJBuAEjYdgANAXB8";
const bot = new Telegraf(botToken);

// Inisialisasi bot token
//const botToken = '7487117878:AAHByF9oatHZzNIHHUPr_sKIn3M4urJ5AeE';
//const bot = new Telegraf(botToken);

async function fetchWebsitesList(url) {
  try {
    const response = await axios.get(url);
    const websites = response.data
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    console.log("Fetched websites list:", websites);
    return websites;
  } catch (error) {
    console.error("Error fetching websites list:", error);
    return [];
  }
}

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

async function sendMessage(chatId, message) {
  const MAX_MESSAGE_LENGTH = 4096;

  if (message.length <= MAX_MESSAGE_LENGTH) {
    await bot.telegram.sendMessage(chatId, message);
  } else {
    let parts = [];
    for (let i = 0; i < message.length; i += MAX_MESSAGE_LENGTH) {
      parts.push(message.substring(i, i + MAX_MESSAGE_LENGTH));
    }

    for (const part of parts) {
      await bot.telegram.sendMessage(chatId, part);
    }
  }
}

async function performCheck(baseUrl, chatId) {
  const websites = await fetchWebsitesList(baseUrl);
  const resultMessage = await checkWebsites(websites, "List");
  await sendMessage(chatId, resultMessage);
}

async function main() {
  // Membaca input dari pengguna
  const baseUrl = await askQuestion("Masukkan URL daftar website: ");
  const chatId = await askQuestion("Masukkan chat ID: ");
  //const botToken = await askQuestion('Masukan Token Bot: ');
  //const bot = new Telegraf(botToken);
  // Perform the initial check immediately
  await performCheck(baseUrl, chatId);

  // Set up the interval to check every hour (3600000 milliseconds)
  setInterval(async () => {
    console.log("Running the hourly check...");
    await performCheck(baseUrl, chatId);
  }, 1800000);

  // Menutup readline interface
  rl.close();
}

// Run the main function
main();
