const axios = require("axios");
const { Telegraf } = require("telegraf");
const fs = require("fs");
const path = require("path");
const express = require("express");

const botToken = "7205420800:AAHl49A32cE3cim-QUuVeoZZsqorIGfWDY4";
const channelId = "-1002202234253";
const bot = new Telegraf(botToken);
const app = express();
const port = 3000; // Port for the Express server

app.use(express.json());
app.use(express.static("public"));
const domainsFilePath = path.join(__dirname, "domains.json");
console.log("Path to domains.json:", domainsFilePath);
fs.readFile(domainsFilePath, "utf8", (err, data) => {
  if (err) {
    console.error("Gagal membaca file domains.json:", err);
    return;
  }

  try {
    const domains = JSON.parse(data);
    console.log("Daftar domains:", domains);
  } catch (parseError) {
    console.error("Gagal memparsing JSON:", parseError);
  }
});

// Helper functions
function readDomains() {
  try {
    const data = fs.readFileSync(domainsFilePath, "utf8");
    console.log("Read domains.json data:", data);
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading domains:", err);
    return [];
  }
}

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
app.get("/", (req, res) => {
  res.send("Selamat datang di server Express.js!");
});
// API Routes
app.get("/api/websites", (req, res) => {
  res.json(readDomains());
});

app.post("/api/websites", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const domains = readDomains();
  const existingIndex = domains.findIndex((domain) => domain.url === url);

  // Periksa status domain terbaru
  const updatedStatus = await checkStatus(url);
  const status = updatedStatus === "Online" ? "Safe" : "Banned";

  if (existingIndex >= 0) {
    domains[existingIndex].status = status;
  } else {
    domains.push({ id: Date.now().toString(), url, status });
  }

  fs.writeFileSync(domainsFilePath, JSON.stringify(domains, null, 2));
  res.status(200).json({ message: "Domain added/updated successfully" });

  if (status === "Banned") {
    await sendTelegramMessage(`Status update for ${url}: ${status}`);
  }
});

app.put("/api/websites/:id", async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const domains = readDomains();
  const index = domains.findIndex((domain) => domain.id === id);
  if (index >= 0) {
    const updatedStatus = await checkStatus(url);
    const finalStatus = updatedStatus === "Online" ? "Safe" : "Banned";
    domains[index].url = url;
    domains[index].status = finalStatus;
    fs.writeFileSync(domainsFilePath, JSON.stringify(domains, null, 2));
    res.status(200).json({ message: "Domain updated successfully" });

    if (finalStatus === "Banned") {
      await sendTelegramMessage(`Status update for ${url}: ${finalStatus}`);
    }
  } else {
    res.status(404).json({ error: "Domain not found" });
  }
});

app.put("/api/websites/:id", async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const domains = readDomains();
  const index = domains.findIndex((domain) => domain.id === id);
  if (index >= 0) {
    const updatedStatus = await checkStatus(url);
    const finalStatus = updatedStatus === "Online" ? "Safe" : "Banned";
    domains[index].url = url;
    domains[index].status = finalStatus; // Update status directly
    fs.writeFileSync(domainsFilePath, JSON.stringify(domains, null, 2));
    res.status(200).json({ message: "Domain updated successfully" });
    await sendTelegramMessage(`Status update for ${url}: ${finalStatus}`);
  } else {
    res.status(404).json({ error: "Domain not found" });
  }
});

app.put("/api/websites/:id", async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const domains = readDomains();
  const index = domains.findIndex((domain) => domain.id === id);
  if (index >= 0) {
    domains[index].url = url;
    domains[index].status = "Checking"; // Set status to "Checking"
    fs.writeFileSync(domainsFilePath, JSON.stringify(domains, null, 2));
    res.status(200).json({ message: "Domain updated successfully" });
  } else {
    res.status(404).json({ error: "Domain not found" });
  }
});

app.delete("/api/websites/:id", (req, res) => {
  const { id } = req.params;
  let domains = readDomains();
  domains = domains.filter((domain) => domain.id !== id);
  fs.writeFileSync(domainsFilePath, JSON.stringify(domains, null, 2));
  res.status(200).json({ message: "Domain deleted successfully" });
});

// Serve static files from 'public' directory
app.use(express.static("public"));

// Start the Express server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

async function performCheck() {
  const domains = readDomains();
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
