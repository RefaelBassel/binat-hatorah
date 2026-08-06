import { createClient, type Client } from "@libsql/client";
import { getTursoConfig } from "./env";

let _client: Client | null = null;

export function db(): Client {
  if (_client) return _client;
  const cfg = getTursoConfig();
  if (!cfg) {
    throw new Error(
      "TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set. See .env.local.example."
    );
  }
  _client = createClient(cfg);
  return _client;
}
