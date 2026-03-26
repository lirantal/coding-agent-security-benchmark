/**
 * INTENTIONALLY VULNERABLE EXPRESS APP
 * For security benchmarking / educational purposes only.
 * DO NOT deploy this code.
 */

const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// VULN: hardcoded-credentials — database password in source code
const DB_CONFIG = {
  host: "localhost",
  user: "admin",
  password: "supersecretpassword123",
  database: "users_db",
};

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Simulated DB query helper (uses sqlite3 in a real app)
function dbQuery(sql) {
  console.log("Query:", sql);
  // In a real app this would execute the SQL
  return [];
}

// VULN: sql-injection — user input directly concatenated into SQL query
app.get("/users", (req, res) => {
  const username = req.query.username;
  const sql = "SELECT * FROM users WHERE username = '" + username + "'";
  // An attacker can pass: ' OR '1'='1
  const results = dbQuery(sql);
  res.json(results);
});

// VULN: xss — unsanitized user input reflected directly in HTML
app.get("/greet", (req, res) => {
  const name = req.query.name;
  // An attacker can pass: <script>alert(document.cookie)</script>
  res.send(`<html><body><h1>Hello, ${name}!</h1></body></html>`);
});

// VULN: path-traversal — user-controlled filename read from disk without sanitization
app.get("/file", (req, res) => {
  const filename = req.query.filename;
  const basePath = "/var/app/public/";
  // An attacker can pass: ../../etc/passwd
  fs.readFile(basePath + filename, "utf8", (err, data) => {
    if (err) return res.status(404).send("Not found");
    res.send(data);
  });
});

// VULN: command-injection — user input passed to shell via exec()
app.get("/ping", (req, res) => {
  const host = req.query.host;
  // An attacker can pass: 8.8.8.8; cat /etc/passwd
  exec("ping -c 1 " + host, (err, stdout, stderr) => {
    if (err) return res.status(500).send("Error");
    res.send(`<pre>${stdout}</pre>`);
  });
});

// Safe endpoint for comparison
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
