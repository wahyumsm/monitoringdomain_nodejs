const axios = require("axios");
const { Telegraf } = require("telegraf");
const mysql = require("mysql2");
const express = require("express");

const botToken = "7205420800:AAHl49A32cE3cim-QUuVeoZZsqorIGfWDY4";
const channelId = "-1002202234253";
const bot = new Telegraf(botToken);
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

async function checkStatus(url) {
  try {
    console.log(`Checking status for URL: ${url}`);
    const response = await axios.get(url);
    console.log(`Received status code ${response.status} for URL: ${url}`);
    return response.status === 200 ? "Online" : "Offline";
  } catch (error) {
    console.error(`Error checking status for URL ${url}:`, error.message);
    return "Offline";
  }
}

async function checkWebsitesFromKominfo(websites) {
  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-certificate-errors",
    ],
  });

  let resultMessage = "Laporan Dari Kominfo\n\n";

  try {
    const page = await browser.newPage();
    console.log("Navigating to Kominfo site...");
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto("https://trustpositif.kominfo.go.id/");
    await page.waitForSelector("#press-to-modal");
    await page.click("#press-to-modal");
    await page.waitForSelector("#input-data");

    const websitesStr = websites.join("\n");
    console.log(`Inputting websites: ${websitesStr}`);
    await page.evaluate((websitesStr) => {
      document.querySelector("#input-data").value = websitesStr;
    }, websitesStr);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Clicking submit button...");
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
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
    console.error(`Error checking websites from Kominfo:`, error);
  } finally {
    await browser.close();
  }

  resultMessage += "\nNawala Checker Via : https://trustpositif.kominfo.go.id/";
  console.log(resultMessage);
  return resultMessage;
}

async function sendTelegramMessage(message) {
  try {
    console.log("Sending message to Telegram...");
    await bot.telegram.sendMessage(channelId, message);
    console.log("Message sent successfully!");
  } catch (error) {
    console.error("Error sending message to Telegram:", error);
  }
}

// Helper functions for database operations
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

  const updatedStatus = await checkStatus(url);
  const status = updatedStatus === "Online" ? "Safe" : "Banned";

  addOrUpdateDomain(url, status, async () => {
    res.status(200).json({ message: "Domain added/updated successfully" });

    if (status === "Banned") {
      await sendTelegramMessage(`Status update for ${url}: ${status}`);
    }
  });
});

app.put("/api/websites/:id", async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const updatedStatus = await checkStatus(url);
  const finalStatus = updatedStatus === "Online" ? "Safe" : "Banned";

  db.query(
    "UPDATE domains SET url = ?, status = ? WHERE id = ?",
    [url, finalStatus, id],
    (err) => {
      if (err) {
        console.error("Error updating domain:", err);
        return res.status(500).json({ error: "Error updating domain" });
      }
      res.status(200).json({ message: "Domain updated successfully" });
      if (finalStatus === "Banned") {
        sendTelegramMessage(`Status update for ${url}: ${finalStatus}`);
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

// Start the Express server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

async function performCheck() {
  console.log("Starting performCheck..."); // Log awal

  readDomains(async (domains) => {
    console.log(`Retrieved ${domains.length} domains from database.`); // Log jumlah domain

    let bannedDomainsMessage = "Status Domain BANNED Terbaru:\n\n";

    // Dapatkan status terbaru untuk semua domain
    const domainsWithStatus = await Promise.all(
      domains.map(async (domain) => {
        const status = await checkStatus(domain.url);
        console.log(`Checked status for ${domain.url}: ${status}`); // Log status per domain
        return {
          ...domain,
          status,
        };
      })
    );

    // Filter hanya domain yang banned
    const bannedDomains = domainsWithStatus.filter(
      (domain) => domain.status === "Offline"
    );

    if (bannedDomains.length > 0) {
      bannedDomains.forEach((domain) => {
        bannedDomainsMessage += `🚫 URL ${domain.url} BANNED\n`;
      });

      console.log("Generated banned domains message:\n", bannedDomainsMessage); // Log pesan
      await sendTelegramMessage(bannedDomainsMessage);
    } else {
      console.log("No banned domains detected.");
    }
  });
}
async function checkWebsitesFromKominfo(websites) {
  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ["--no-sandbox", "--ignore-certificate-errors"],
  });

  let resultMessage = "Laporan Dari Kominfo\n\n";

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto("https://trustpositif.kominfo.go.id/"); // Mengakses halaman Kominfo
    await page.waitForSelector("#press-to-modal");
    await page.click("#press-to-modal");
    await page.waitForSelector("#input-data");

    const websitesStr = websites.join("\n");
    await page.evaluate((websitesStr) => {
      document.querySelector("#input-data").value = websitesStr; // Mengisi daftar website
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
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Tunggu data tambahan

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
    console.error(`Error checking websites from Kominfo:`, error);
  } finally {
    await browser.close();
  }

  resultMessage += "\nNawala Checker Via : https://trustpositif.kominfo.go.id/";
  console.log(resultMessage);
  return resultMessage;
}

async function main() {
  console.log("Starting the website monitor...");
  await performCheck();
  setInterval(async () => {
    console.log("Running the 3-minute check...");
    await performCheck();
  }, 180000); // 3 minutes in milliseconds
}

main();
