const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");
const app = express();
const port = 3000;
const botToken = "7205420800:AAHl49A32cE3cim-QUuVeoZZsqorIGfWDY4";
const channelId = "-1002202234253";
const predefinedWebsites = [
  "jackscottmusic.com",
  "vegas138r.lol",
  "goassam.com",
  "jesusadventcalendar.com",
  "sini.pages.dev",
  "vegas138rtp-03.pages.dev",
  "kontol.com",
];

let monitoredDomains = [];

app.use(express.json());
app.use(express.static("public")); // Serve static files from the 'public' directory

app.get("/domains", (req, res) => {
  res.json(monitoredDomains);
});

async function checkWebsites(websites) {
  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ["--no-sandbox", "--ignore-certificate-errors"],
  });

  let result = [];

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

    while (true) {
      previousHeight = await page.evaluate(
        'document.querySelector("#daftar-block tbody").scrollHeight'
      );
      await page.evaluate(
        'window.scrollTo(0, document.querySelector("#daftar-block tbody").scrollHeight)'
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const newHeight = await page.evaluate(
        'document.querySelector("#daftar-block tbody").scrollHeight'
      );

      if (newHeight === previousHeight) break;
    }

    result = await page.evaluate(() => {
      const rows = document.querySelectorAll("#daftar-block tbody tr");
      return Array.from(rows).map((row) => {
        const columns = row.querySelectorAll("td");
        const url = columns[0]?.innerText || "No URL";
        const status = columns[1]?.innerText || "No Status";
        return { url, status };
      });
    });

    await page.close();
  } catch (error) {
    console.error(`Error checking websites:`, error);
  } finally {
    await browser.close();
  }

  return result.filter((entry) => entry.status === "Ada");
}

async function sendMessage(channelId, message) {
  try {
    const TELEGRAM_API_URL = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await axios.post(TELEGRAM_API_URL, {
      chat_id: channelId,
      text: message,
    });

    if (response.data.ok) {
      console.log("Message sent successfully!");
    } else {
      console.error("Error sending message:", response.data.description);
    }
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response ? error.response.data : error.message
    );
  }
}

async function performCheck() {
  const result = await checkWebsites(predefinedWebsites);

  if (result.length > 0) {
    const resultMessage = result
      .map((entry) => `🚫 URL ${entry.url} BANNED`)
      .join("\n");
    await sendMessage(channelId, resultMessage);
    monitoredDomains = result; // Update monitoredDomains with the array
  } else {
    console.log("No banned domains found, no message sent.");
    monitoredDomains = [];
  }
}

async function main() {
  await performCheck();
  setInterval(async () => {
    console.log("Running the 10-minute check...");
    await performCheck();
  }, 180000); // 10 minutes in milliseconds
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

main();
