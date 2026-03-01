/**
 * Run a single migration file. Usage: node scripts/run-migration.js sql/migrations_unique_open_sessions.sql
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

const file = process.argv[2] || "sql/migrations_unique_open_sessions.sql";
const fullPath = path.isAbsolute(file) ? file : path.join(__dirname, "..", file);

if (!fs.existsSync(fullPath)) {
  console.error("File not found:", fullPath);
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(fullPath, "utf8");
    await client.query(sql);
    console.log("Ran:", path.basename(fullPath));
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
