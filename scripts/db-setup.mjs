// Applies supabase/migrations/*.sql to the database in SUPABASE_DB_URL.
// Usage: npm run db:setup
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set in .env.local (Supabase → Connect → Session pooler URI).");
  process.exit(1);
}

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  for (const file of files) {
    process.stdout.write(`Applying ${file} … `);
    await client.query(readFileSync(join(dir, file), "utf8"));
    console.log("done");
  }
  console.log("Database is ready.");
} catch (err) {
  console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}
