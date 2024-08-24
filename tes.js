// const express = require("express");
// const puppeteer = require("puppeteer");
// const axios = require("axios");
// const mysql = require("mysql2");
// const app = express();
// const port = 3000;
// const bodyParser = require("body-parser");

// const botToken = "720542A32cE3cim-QUuVeoZZsqorIGfWDY4";
// const channelId = "-1002202234253";

// // Koneksi ke Database
// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root", // Ubah sesuai pengguna MySQL Anda
//   password: "", // Ubah sesuai kata sandi MySQL Anda
//   database: "domain_monitor",
// });

// db.connect((err) => {
//   if (err) {
//     console.error("Kesalahan koneksi ke database:", err);
//   } else {
//     console.log("Terhubung ke database MySQL");
//   }
// });

// // Middleware
// app.use(express.static("public"));
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// async function checkGoogle(page, websites) {
//   let results = [];

//   for (const website of websites) {
//     const response = await page.goto(
//       `https://www.google.com/search?q=${encodeURIComponent(website)}`,
//       {
//         waitUntil: "networkidle2",
//       }
//     );

//     if (response.status() === 200) {
//       results.push({ url: website, status: "Google Found" });
//     } else {
//       results.push({ url: website, status: "Google Not Found" });
//     }
//   }

//   return results;
// }
// async function checkKominfo(page, websites) {
//   await page.goto("https://trustpositif.kominfo.go.id/");
//   await page.waitForSelector("#press-to-modal");
//   await page.click("#press-to-modal");
//   await page.waitForSelector("#input-data");

//   const websitesStr = websites.join("\n");
//   await page.evaluate((websitesStr) => {
//     document.querySelector("#input-data").value = websitesStr;
//   }, websitesStr);

//   await page.click("#text-footer");
//   await page.waitForSelector("#daftar-block", { visible: true });

//   let previousHeight;
//   while (true) {
//     previousHeight = await page.evaluate(
//       'document.querySelector("#daftar-block tbody").scrollHeight'
//     );
//     await page.evaluate(
//       'window.scrollTo(0, document.querySelector("#daftar-block tbody").scrollHeight)'
//     );
//     await new Promise((resolve) => setTimeout(resolve, 2000));
//     const newHeight = await page.evaluate(
//       'document.querySelector("#daftar-block tbody").scrollHeight'
//     );

//     if (newHeight === previousHeight) break;
//   }

//   return await page.evaluate(() => {
//     const rows = document.querySelectorAll("#daftar-block tbody tr");
//     return Array.from(rows).map((row) => {
//       const columns = row.querySelectorAll("td");
//       const url = columns[0]?.innerText || "No URL";
//       const status = columns[1]?.innerText || "No Status";
//       return { url, status };
//     });
//   });
// }

// async function checkWebsites(websites) {
//   const browser = await puppeteer.launch({
//     headless: true,
//     ignoreHTTPSErrors: true,
//     args: ["--no-sandbox", "--ignore-certificate-errors"],
//   });

//   try {
//     const page = await browser.newPage();
//     await page.setViewport({ width: 1920, height: 1080 });

//     // Check Kominfo
//     const kominfoResults = await checkKominfo(page, websites);

//     // Gabungkan hasil
//     return kominfoResults;
//   } catch (error) {
//     console.error("Error checking websites:", error);
//     return []; // Pastikan mengembalikan array kosong jika terjadi error
//   } finally {
//     await browser.close();
//   }
// }

// // Fungsi untuk mengirim pesan ke Telegram
// async function sendMessage(channelId, message) {
//   try {
//     const TELEGRAM_API_URL = `https://api.telegram.org/bot${botToken}/sendMessage`;
//     const response = await axios.post(TELEGRAM_API_URL, {
//       chat_id: channelId,
//       text: message,
//     });

//     if (response.data.ok) {
//       console.log("Pesan berhasil dikirim!");
//     } else {
//       console.error(
//         "Kesalahan saat mengirim pesan:",
//         response.data.description
//       );
//     }
//   } catch (error) {
//     console.error(
//       "Kesalahan saat mengirim pesan:",
//       error.response ? error.response.data : error.message
//     );
//   }
// }

// async function saveOrUpdateDomain(url, status) {
//   return new Promise((resolve, reject) => {
//     db.query(
//       "SELECT * FROM domains WHERE url = ?",
//       [url],
//       async (err, results) => {
//         if (err) {
//           return reject(err);
//         }

//         if (results.length > 0) {
//           // Jika domain sudah ada, hanya perbarui status
//           db.query(
//             "UPDATE domains SET status = ?, checked_at = NOW() WHERE url = ?",
//             [status, url],
//             (err, result) => {
//               if (err) {
//                 return reject(err);
//               }
//               console.log(`Domain ${url} diperbarui dengan status: ${status}`);
//               resolve(result);
//             }
//           );
//         } else {
//           // Jika domain belum ada, tambahkan
//           db.query(
//             "INSERT INTO domains (url, status, created_at) VALUES (?, ?, NOW())",
//             [url, status],
//             (err, result) => {
//               if (err) {
//                 return reject(err);
//               }
//               console.log(`Domain ${url} ditambahkan dengan status: ${status}`);
//               resolve(result);
//             }
//           );
//         }
//       }
//     );
//   });
// }

// async function performCheck() {
//   try {
//     // Ambil semua domain baru dari database
//     const [results] = await db
//       .promise()
//       .query("SELECT url FROM domains WHERE checked_at IS NULL");
//     const urls = results.map((row) => row.url);

//     if (urls.length === 0) {
//       console.log("Tidak ada domain baru untuk diperiksa.");
//       return;
//     }

//     // Periksa status semua domain baru
//     const checkedDomains = await checkWebsites(urls);

//     // Perbarui status domain di database
//     for (const domain of checkedDomains) {
//       await saveOrUpdateDomain(domain.url, domain.status); // Pastikan status diambil dari hasil pemeriksaan
//     }

//     // Tambah URL yang tidak ditemukan dalam hasil pemeriksaan
//     const checkedUrls = checkedDomains.map((d) => d.url);
//     for (const url of urls) {
//       if (!checkedUrls.includes(url)) {
//         await saveOrUpdateDomain(url, "SAFE");
//       }
//     }

//     // Kirim pesan jika ada domain yang dibanned
//     if (checkedDomains.length > 0) {
//       const resultMessage = checkedDomains
//         .map((entry) => `🚫 URL ${entry.url} DIBANNED`)
//         .join("\n");
//       await sendMessage(channelId, resultMessage);
//     } else {
//       console.log("Tidak ada domain yang dibanned, pesan tidak dikirim.");
//     }
//   } catch (error) {
//     console.error("Kesalahan saat melakukan pemeriksaan:", error);
//   }
// }

// // Endpoint API
// app.get("/domains", (req, res) => {
//   db.query("SELECT * FROM domains", (err, results) => {
//     if (err) {
//       return res.status(500).json({ error: "Kueri database gagal" });
//     }
//     res.json(results);
//   });
// });

// app.post("/domains", async (req, res) => {
//   const { url } = req.body;
//   if (!url) {
//     return res.status(400).json({ error: "URL diperlukan" });
//   }

//   try {
//     // Periksa status URL sebelum menambahkannya ke database
//     const checkedDomains = await checkWebsites([url]);
//     const status = checkedDomains.length > 0 ? "BANNED" : "SAFE";

//     await saveOrUpdateDomain(url, status);

//     res.status(201).json({ message: "Domain berhasil ditambahkan" });
//   } catch (error) {
//     console.error("Kesalahan saat menambahkan domain:", error);
//     res.status(500).json({
//       error: "Kesalahan saat memeriksa status URL atau menambahkan domain",
//     });
//   }
// });

// app.put("/domains/:id", async (req, res) => {
//   const { id } = req.params;
//   const { url } = req.body;

//   if (!url) {
//     return res.status(400).json({ error: "URL diperlukan" });
//   }

//   try {
//     // Periksa status URL sebelum memperbaruinya di database
//     const checkedDomains = await checkWebsites([url]);
//     const status = checkedDomains.length > 0 ? "BANNED" : "SAFE";

//     db.query(
//       "UPDATE domains SET url = ?, status = ?, checked_at = NOW() WHERE id = ?",
//       [url, status, id],
//       (err, result) => {
//         if (err) {
//           return res.status(500).json({ error: "Kueri database gagal" });
//         }
//         if (result.affectedRows === 0) {
//           return res.status(404).json({ error: "Domain tidak ditemukan" });
//         }
//         res.json({ message: "Domain berhasil diperbarui" });
//       }
//     );
//   } catch (error) {
//     res.status(500).json({ error: "Kesalahan saat memeriksa status URL" });
//   }
// });

// app.delete("/domains/:id", (req, res) => {
//   const { id } = req.params;

//   db.query("DELETE FROM domains WHERE id = ?", [id], (err, result) => {
//     if (err) {
//       return res.status(500).json({ error: "Kueri database gagal" });
//     }
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: "Domain tidak ditemukan" });
//     }
//     res.json({ message: "Domain berhasil dihapus" });
//   });
// });

// // Fungsi utama
// async function main() {
//   // Jalankan pemeriksaan awal
//   await performCheck();
//   setInterval(performCheck, 10 * 60 * 1000); // 10 menit
// }

// main();

// app.listen(port, () => {
//   console.log(`Server mendengarkan di port ${port}`);
// });
// <!DOCTYPE html>
// <html lang="id">
//   <head>
//     <meta charset="UTF-8" />
//     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//     <title>Domain Monitor</title>

//     <style>
//       body {
//         font-family: Arial, sans-serif;
//         margin: 0;
//         padding: 0;
//         background-color: #f4f4f4;
//       }

//       header {
//         background-color: #333;
//         color: #fff;
//         padding: 1rem;
//         text-align: center;
//       }

//       main {
//         padding: 2rem;
//       }

//       section {
//         margin-bottom: 2rem;
//       }

//       h2 {
//         margin-top: 0;
//       }

//       form {
//         display: flex;
//         flex-direction: column;
//         max-width: 600px;
//         margin: auto;
//       }

//       label {
//         margin-bottom: 0.5rem;
//       }

//       input[type="text"] {
//         padding: 0.5rem;
//         margin-bottom: 1rem;
//         border: 1px solid #ccc;
//         border-radius: 4px;
//       }

//       button {
//         padding: 0.5rem;
//         border: none;
//         border-radius: 4px;
//         background-color: #5cb85c;
//         color: #fff;
//         cursor: pointer;
//       }

//       button:hover {
//         background-color: #4cae4c;
//       }

//       table {
//         width: 100%;
//         border-collapse: collapse;
//         margin-top: 1rem;
//         overflow-x: auto;
//       }

//       th,
//       td {
//         border: 1px solid #ddd;
//         padding: 0.5rem;
//         text-align: left;
//       }

//       th {
//         background-color: #f4f4f4;
//       }

//       .pagination {
//         display: flex;
//         justify-content: center;
//         margin-top: 1rem;
//       }

//       .pagination button {
//         margin: 0 0.5rem;
//         padding: 0.5rem 1rem;
//         border: 1px solid #ddd;
//         border-radius: 4px;
//         background-color: #f4f4f4;
//         cursor: pointer;
//       }

//       .pagination button:hover {
//         background-color: #ddd;
//       }

//       footer {
//         background-color: #333;
//         color: #fff;
//         text-align: center;
//         padding: 1rem;
//         position: fixed;
//         width: 100%;
//         bottom: 0;
//       }
//     </style>
//   </head>
//   <body>
//     <header>
//       <h1>Monitor Domain</h1>
//     </header>

//     <main>
//       <section id="form-section">
//         <h2>Tambah atau Perbarui Domain</h2>
//         <form id="domain-form">
//           <label for="url">URL:</label>
//           <input type="text" id="url" name="url" required />
//           <button type="submit">Tambah / Perbarui</button>
//         </form>
//       </section>

//       <section id="domain-list-section">
//         <h2>Daftar Domain</h2>
//         <table id="domain-table">
//           <thead>
//             <tr>
//               <th>ID</th>
//               <th>URL</th>
//               <th>Status</th>
//               <th>Terakhir Diperiksa</th>
//               <th>Aksi</th>
//             </tr>
//           </thead>
//           <tbody>
//             <!-- Baris domain akan ditambahkan di sini -->
//           </tbody>
//         </table>
//       </section>
//     </main>
//   </body>
//   <script>
//     document.addEventListener("DOMContentLoaded", () => {
//       const form = document.getElementById("domain-form");
//       const urlInput = document.getElementById("url");
//       const tableBody = document
//         .getElementById("domain-table")
//         .getElementsByTagName("tbody")[0];

//       form.addEventListener("submit", async (event) => {
//         event.preventDefault();
//         const url = urlInput.value.trim();

//         if (url) {
//           try {
//             const response = await fetch("/domains", {
//               method: "POST",
//               headers: {
//                 "Content-Type": "application/json",
//               },
//               body: JSON.stringify({ url }),
//             });

//             if (response.ok) {
//               alert("Domain berhasil ditambahkan atau diperbarui");
//               urlInput.value = "";
//               loadDomains();
//             } else {
//               alert("Gagal menambahkan atau memperbarui domain");
//             }
//           } catch (error) {
//             console.error("Kesalahan saat mengirim data:", error);
//             alert("Terjadi kesalahan saat mengirim data");
//           }
//         }
//       });

//       async function loadDomains() {
//         try {
//           const response = await fetch("/domains");
//           const domains = await response.json();

//           tableBody.innerHTML = "";

//           domains.forEach((domain) => {
//             const row = tableBody.insertRow();
//             row.insertCell().textContent = domain.id;
//             row.insertCell().textContent = domain.url;
//             row.insertCell().textContent = domain.status;
//             row.insertCell().textContent = domain.checked_at;
//             const actionsCell = row.insertCell();
//             actionsCell.innerHTML = `
//           <button onclick="deleteDomain(${domain.id})">Hapus</button>
//         `;
//           });
//         } catch (error) {
//           console.error("Kesalahan saat memuat domain:", error);
//         }
//       }

//       window.deleteDomain = async (id) => {
//         try {
//           const response = await fetch(`/domains/${id}`, {
//             method: "DELETE",
//           });

//           if (response.ok) {
//             alert("Domain berhasil dihapus");
//             loadDomains();
//           } else {
//             alert("Gagal menghapus domain");
//           }
//         } catch (error) {
//           console.error("Kesalahan saat menghapus domain:", error);
//           alert("Terjadi kesalahan saat menghapus domain");
//         }
//       };

//       loadDomains();
//     });
//   </script>
// </html>
