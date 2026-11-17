// Creates (or rotates) SUBMISSION_KEY: the server-only key the database requires
// on every public form submission (migration 0005). Only its SHA-256 hash is
// stored in the database.
//
// Usage:
//   npm run submission-key
//
// The key is written to .env.local (never printed). Copy the same value to
// Vercel → Settings → Environment Variables as SUBMISSION_KEY (Production) and
// redeploy. With SUPABASE_DB_URL set, the hash is saved to the database
// directly; otherwise the script prints the SQL to run in Supabase → SQL Editor
// (it contains only the hash, not the key).
//
// Rotating: run again, update Vercel, redeploy, then save the new hash. Forms
// are refused between saving the new hash and the redeploy finishing.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

const ENV_FILE = ".env.local";
config({ path: ENV_FILE, quiet: true });

const key = randomBytes(32).toString("base64url");
const hex = createHash("sha256").update(key, "utf8").digest("hex");
const sql = `insert into private.app_secrets (name, secret_hash, updated_at)
values ('submissions', decode('${hex}', 'hex'), now())
on conflict (name) do update set secret_hash = excluded.secret_hash, updated_at = now();`;

const line = `SUBMISSION_KEY=${key}`;
const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const next = /^SUBMISSION_KEY=.*$/m.test(current)
  ? current.replace(/^SUBMISSION_KEY=.*$/m, line)
  : `${current}${current && !current.endsWith("\n") ? "\n" : ""}${line}\n`;
writeFileSync(ENV_FILE, next);
console.log(`New SUBMISSION_KEY saved to ${ENV_FILE}. Copy the same value to Vercel (Production) and redeploy.`);

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.log("\nSUPABASE_DB_URL is not set. Run this in Supabase → SQL Editor (hash only, safe to share):\n");
  console.log(sql);
} else {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    console.log("Hash saved to the database (the old key, if any, no longer works).");
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
