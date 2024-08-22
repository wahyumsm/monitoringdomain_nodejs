// const express = require("express");
// const bodyParser = require("body-parser");
// const fs = require("fs");
// const path = require("path");

// const app = express();
// const port = 3000; // Port untuk server
// const domainsFilePath = path.join(__dirname, "domains.json");

// app.use(express.static("public")); // Menyajikan file statis dari folder 'public'
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Membaca daftar domain
// function readDomains() {
//   try {
//     const data = fs.readFileSync(domainsFilePath, "utf8");
//     return JSON.parse(data);
//   } catch (err) {
//     console.error("Error reading domains:", err);
//     return [];
//   }
// }

// // Menulis daftar domain
// function writeDomains(domains) {
//   try {
//     fs.writeFileSync(domainsFilePath, JSON.stringify(domains, null, 2), "utf8");
//   } catch (err) {
//     console.error("Error writing domains:", err);
//   }
// }

// // Menambahkan domain baru
// app.post("/add-domain", (req, res) => {
//   const newDomain = req.body.domain;
//   const domains = readDomains();
//   if (!domains.includes(newDomain)) {
//     domains.push(newDomain);
//     writeDomains(domains);
//     res.send("Domain added successfully.");
//   } else {
//     res.send("Domain already exists.");
//   }
// });

// // Menghapus domain
// app.post("/delete-domain", (req, res) => {
//   const domainToDelete = req.body.domain;
//   let domains = readDomains();
//   domains = domains.filter((domain) => domain !== domainToDelete);
//   writeDomains(domains);
//   res.send("Domain deleted successfully.");
// });

// // Endpoint untuk mendapatkan daftar domain
// app.get("/domains", (req, res) => {
//   res.json(readDomains());
// });

// app.listen(port, () => {
//   console.log(`Server listening on port ${port}`);
// });
