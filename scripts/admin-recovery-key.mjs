// Creates (or rotates) ADMIN_RECOVERY_KEY: the server-only key that lets the
// website ask the database "is this email an administrator?" before sending a
// password-reset email. Only its SHA-256 hash is stored in the database.
//
// Usage (after `npm run db:setup`):
//   npm run admin:recovery-key
//
// The new key is written to .env.local (it is never printed). Copy the same
// value to Vercel → Settings → Environment Variables as ADMIN_RECOVERY_KEY.
// Running it again rotates the key; the old one stops working immediately.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

const ENV_FILE = ".env.local";
config({ path: ENV_FILE, quiet: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(`SUPABASE_DB_URL is not set in ${ENV_FILE}.`);
  process.exit(1);
}

const key = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(key, "utf8").digest();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(
    `insert into private.app_secrets (name, secret_hash, updated_at) values ('admin_recovery', $1, now())
     on conflict (name) do update set secret_hash = excluded.secret_hash, updated_at = now()`,
    [hash],
  );

  const line = `ADMIN_RECOVERY_KEY=${key}`;
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const next = /^ADMIN_RECOVERY_KEY=.*$/m.test(current)
    ? current.replace(/^ADMIN_RECOVERY_KEY=.*$/m, line)
    : `${current}${current && !current.endsWith("\n") ? "\n" : ""}${line}\n`;
  writeFileSync(ENV_FILE, next);

  console.log(`New ADMIN_RECOVERY_KEY saved to ${ENV_FILE} (old key, if any, no longer works).`);
  console.log("Copy the same value to Vercel → Settings → Environment Variables, then redeploy.");
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Failed:", msg.includes("app_secrets") ? `${msg} — run \`npm run db:setup\` first.` : msg);
  process.exitCode = 1;
} finally {
  await client.end();
}
