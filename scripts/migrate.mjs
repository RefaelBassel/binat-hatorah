// Applies migrations/*.sql in filename order, tracking applied files in a
// _migrations table. Reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from
// .env.local (or the environment). Local dev: TURSO_DATABASE_URL=file:local.db
import { createClient } from "@libsql/client";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

function readEnvVar(name) {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`));
    if (match) return match[1].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const url = readEnvVar("TURSO_DATABASE_URL");
if (!url) {
  console.error("TURSO_DATABASE_URL not set (use file:local.db for local dev).");
  process.exit(1);
}
const authToken = readEnvVar("TURSO_AUTH_TOKEN");
const db = createClient(url.startsWith("file:") ? { url } : { url, authToken });

await db.execute(
  "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)"
);
const applied = new Set(
  (await db.execute("SELECT name FROM _migrations")).rows.map((r) => r.name)
);

const dir = join(process.cwd(), "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = readFileSync(join(dir, file), "utf8");
  // Naive split on ";" at end of statement lines — fine for our simple DDL.
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) =>
      s
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
  await db.execute({
    sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
    args: [file, Math.floor(Date.now() / 1000)],
  });
  console.log("applied:", file);
}
console.log("migrations up to date.");
