// Grants (or revokes) admin rights to an EXISTING Supabase Auth user.
// The user is created — with their own password — in Supabase → Authentication → Users → Add user.
//
// Usage:
//   npm run admin:grant -- someone@example.com
//   npm run admin:grant -- someone@example.com --revoke
//   npm run admin:grant -- --list
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set in .env.local.");
  process.exit(1);
}

const args = process.argv.slice(2);
const list = args.includes("--list");
const revoke = args.includes("--revoke");
const email = args.find((a) => !a.startsWith("--"))?.toLowerCase();

if (!list && !email) {
  console.error("Usage: npm run admin:grant -- <email> [--revoke] | --list");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  if (list) {
    const { rows } = await client.query(
      "select u.email, a.created_at from public.admin_users a join auth.users u on u.id = a.user_id order by a.created_at",
    );
    console.table(rows);
  } else {
    const { rows } = await client.query("select id from auth.users where lower(email) = $1", [email]);
    if (!rows.length) {
      console.error(`No user with email ${email}. Create it first in Supabase → Authentication → Users → Add user.`);
      process.exitCode = 1;
    } else if (revoke) {
      await client.query("delete from public.admin_users where user_id = $1", [rows[0].id]);
      console.log(`Admin rights removed from ${email}.`);
    } else {
      await client.query(
        "insert into public.admin_users (user_id) values ($1) on conflict (user_id) do nothing",
        [rows[0].id],
      );
      console.log(`${email} is now an administrator.`);
    }
  }
} catch (err) {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}
