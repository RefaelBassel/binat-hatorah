import { readFileSync } from "node:fs";
import { join } from "node:path";

// Some shell environments set env vars to empty strings, which prevents
// Next.js from loading the real value from .env.local. This helper reads
// the file directly as a fallback.
function readEnvVar(name: string): string | undefined {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    const path = join(process.cwd(), ".env.local");
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`));
      if (match) {
        const value = match[1].replace(/^["']|["']$/g, "");
        if (value.length > 0) return value;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function getAnthropicApiKey(): string | undefined {
  return readEnvVar("ANTHROPIC_API_KEY");
}

// Local development can run on a plain file DB (TURSO_DATABASE_URL=file:local.db,
// no auth token needed). Production uses a remote Turso URL + token.
export function getTursoConfig(): { url: string; authToken?: string } | null {
  const url = readEnvVar("TURSO_DATABASE_URL");
  if (!url) return null;
  const authToken = readEnvVar("TURSO_AUTH_TOKEN");
  if (url.startsWith("file:")) return { url };
  if (!authToken) return null;
  return { url, authToken };
}

export function getAuthConfig(): {
  clientId: string;
  clientSecret: string;
  secret: string;
} | null {
  const clientId = readEnvVar("AUTH_GOOGLE_ID");
  const clientSecret = readEnvVar("AUTH_GOOGLE_SECRET");
  const secret = readEnvVar("AUTH_SECRET");
  if (!clientId || !clientSecret || !secret) return null;
  return { clientId, clientSecret, secret };
}
