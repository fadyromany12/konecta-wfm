/**
 * One-command DB setup: runs schema.sql, seed.sql, migrations_extra.sql in order.
 * Usage: from backend folder: node scripts/setup-db.js
 * Requires: .env with DATABASE_URL
 */
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const files = [
  path.join(__dirname, "..", "schema.sql"),
  path.join(__dirname, "..", "seed.sql"),
  path.join(__dirname, "..", "sql", "migrations_extra.sql"),
  path.join(__dirname, "..", "sql", "migrations_enterprise.sql"),
];

async function run() {
  const client = await pool.connect();
  try {
    for (const file of files) {
      const name = path.basename(file);
      if (!fs.existsSync(file)) {
        console.warn("Skip (not found):", name);
        continue;
      }
      const sql = fs.readFileSync(file, "utf8");
      await client.query(sql);
      console.log("OK:", name);
    }
    console.log("\nDB setup complete. Log in with admin@konecta.com / manager@konecta.com / test.agent@konecta.com — Password1");
  } catch (err) {
    console.error("Setup failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
