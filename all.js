const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");

// Inisialisasi Express
const app = express();
const port = 3000; // Port untuk server Express

app.use(bodyParser.json()); // Middleware untuk parsing JSON

// Koneksi MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Ganti dengan username MySQL Anda
  password: "", // Ganti dengan password MySQL Anda
  database: "domain_monitor", // Ganti dengan nama database Anda
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL");
});

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

app.post("/api/websites", (req, res) => {
  const { url, status } = req.body;
  if (!url || !status) {
    return res.status(400).json({ error: "URL and status are required" });
  }

  addOrUpdateDomain(url, status, () => {
    res.status(200).json({ message: "Domain added/updated successfully" });
  });
});

app.put("/api/websites/:id", (req, res) => {
  const { id } = req.params;
  const { url, status } = req.body;
  if (!url || !status) {
    return res.status(400).json({ error: "URL and status are required" });
  }

  db.query(
    "UPDATE domains SET url = ?, status = ? WHERE id = ?",
    [url, status, id],
    (err) => {
      if (err) {
        console.error("Error updating domain:", err);
        return res.status(500).json({ error: "Error updating domain" });
      }
      res.status(200).json({ message: "Domain updated successfully" });
    }
  );
});

app.delete("/api/websites/:id", (req, res) => {
  const { id } = req.params;
  deleteDomain(id, () => {
    res.status(200).json({ message: "Domain deleted successfully" });
  });
});

// Memulai server Express
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
