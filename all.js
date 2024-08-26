const puppeteer = require("puppeteer");
const axios = require("axios");
const { Telegraf } = require("telegraf");
const readline = require("readline");
const mysql = require("mysql2");
const express = require("express");

// Inisialisasi readline untuk membaca input dari pengguna
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Inisialisasi Express
const app = express();
const port = 3000; // Port for the Express server

app.use(express.json());
app.use(express.static("public"));

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Update with your MySQL username
  password: "", // Update with your MySQL password
  database: "domain_monitor",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL");
});

// Fungsi untuk membaca input dari pengguna secara asinkron
function askQuestion(query) {
  return new Promise((resolve) =>
    rl.question(query, (answer) => resolve(answer))
  );
}

// Fungsi untuk mengambil daftar website dari API
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

// Fungsi untuk memeriksa status website
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

// Fungsi untuk mengirim pesan ke Telegram
async function sendMessage(bot, chatId, message) {
  const MAX_MESSAGE_LENGTH = 4096;

  try {
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
  } catch (error) {
    console.error("Failed to send message:", error);
  }
}

// Fungsi untuk membaca daftar website dari database
function readDomains(callback) {
  db.query("SELECT * FROM domains", (err, results) => {
    if (err) {
      console.error("Error reading domains from database:", err);
      callback([]);
      return;
    }
    callback(results);
  });
}

// Fungsi untuk menambah atau memperbarui domain di database
function addOrUpdateDomain(url, status, callback) {
  db.query("SELECT * FROM domains WHERE url = ?", [url], (err, results) => {
    if (err) {
      console.error("Error querying domain:", err);
      callback();
      return;
    }

    if (results.length > 0) {
      db.query(
        "UPDATE domains SET status = ? WHERE url = ?",
        [status, url],
        (err) => {
          if (err) {
            console.error("Error updating domain:", err);
          }
          callback();
        }
      );
    } else {
      const id = Date.now().toString();
      db.query(
        "INSERT INTO domains (id, url, status) VALUES (?, ?, ?)",
        [id, url, status],
        (err) => {
          if (err) {
            console.error("Error adding domain:", err);
          }
          callback();
        }
      );
    }
  });
}

// Fungsi untuk menghapus domain dari database
function deleteDomain(id, callback) {
  db.query("DELETE FROM domains WHERE id = ?", [id], (err) => {
    if (err) {
      console.error("Error deleting domain:", err);
    }
    callback();
  });
}

// API Routes
app.get("/api/websites", (req, res) => {
  readDomains((domains) => {
    res.json(domains);
  });
});

app.post("/api/websites", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // Menentukan status domain
  const status = (await checkStatus(url)) === "Online" ? "Safe" : "Banned";

  addOrUpdateDomain(url, status, async () => {
    res.status(200).json({ message: "Domain added/updated successfully" });

    if (status === "Banned") {
      await sendMessage(bot, chatId, `Status update for ${url}: ${status}`);
    }
  });
});

app.put("/api/websites/:id", async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const status = (await checkStatus(url)) === "Online" ? "Safe" : "Banned";

  db.query(
    "UPDATE domains SET url = ?, status = ? WHERE id = ?",
    [url, status, id],
    (err) => {
      if (err) {
        console.error("Error updating domain:", err);
        return res.status(500).json({ error: "Error updating domain" });
      }
      res.status(200).json({ message: "Domain updated successfully" });
      if (status === "Banned") {
        sendMessage(bot, chatId, `Status update for ${url}: ${status}`);
      }
    }
  );
});

app.delete("/api/websites/:id", (req, res) => {
  const { id } = req.params;
  deleteDomain(id, () => {
    res.status(200).json({ message: "Domain deleted successfully" });
  });
});

// Fungsi untuk memeriksa status website dan mengirim hasilnya
async function performCheck(bot, baseUrl, chatId) {
  const websites = await fetchWebsitesList(baseUrl);
  const resultMessage = await checkWebsites(websites, "List");
  await sendMessage(bot, chatId, resultMessage);
}

async function main() {
  const botConfigs = [];

  // Mengumpulkan konfigurasi bot dari pengguna
  while (true) {
    const botToken = await askQuestion(
      "Masukkan Token Bot (atau tekan Enter untuk selesai): "
    );
    if (!botToken) break; // Keluar dari loop jika token tidak dimasukkan

    const chatId = await askQuestion("Masukkan Chat ID: ");
    const baseUrl = await askQuestion("Masukkan URL daftar website: ");

    botConfigs.push({ botToken, chatId, baseUrl });
  }

  // Menutup readline interface setelah input selesai
  rl.close();

  // Loop melalui setiap konfigurasi bot dan melakukan pemeriksaan setiap 9 menit
  for (const config of botConfigs) {
    const bot = new Telegraf(config.botToken);

    // Melakukan pemeriksaan pertama kali segera setelah konfigurasi bot dimulai
    await performCheck(bot, config.baseUrl, config.chatId);

    // Menjadwalkan pemeriksaan ulang setiap 9 menit
    setInterval(async () => {
      console.log(
        `Running the 9-minute check for bot with token: ${config.botToken}`
      );
      await performCheck(bot, config.baseUrl, config.chatId);
    }, 540000); // 9 minutes in milliseconds
  }

  // Memulai server Express setelah semua konfigurasi selesai
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
  });
}

// Menjalankan fungsi main
main();
