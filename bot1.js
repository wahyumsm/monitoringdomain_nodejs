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
  password: "Admin12345!@#", // Update with your MySQL password
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
    const response = await axios.get(url);
    return response.status === 200 ? "Online" : "Offline";
  } catch (error) {
    console.error(`Error checking status for URL ${url}:`, error);
    return "Offline";
  }
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
  readDomains(async (domains) => {
    let bannedDomainsMessage = "Status Domain BANNED Terbaru:\n\n";

    // Dapatkan status terbaru untuk semua domain
    const domainsWithStatus = await Promise.all(
      domains.map(async (domain) => ({
        ...domain,
        status: await checkStatus(domain.url),
      }))
    );

    // Filter hanya domain yang banned
    const bannedDomains = domainsWithStatus.filter(
      (domain) => domain.status === "Offline"
    );

    if (bannedDomains.length > 0) {
      bannedDomains.forEach((domain) => {
        bannedDomainsMessage += `🚫 URL ${domain.url} BANNED\n`;
      });

      console.log("Generated banned domains message:\n", bannedDomainsMessage);
      await sendTelegramMessage(bannedDomainsMessage);
    } else {
      console.log("No banned domains detected.");
    }
  });
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
