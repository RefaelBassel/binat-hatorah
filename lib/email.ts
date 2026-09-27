// Email sending via Resend. Until RESEND_API_KEY is configured (accounts are
// set up only after the site is built), emails are logged and skipped —
// in-app bell notifications still work.
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readEnvVar(name: string): string | undefined {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
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

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  // Hard rule (Rafael, 2026-09-27): the site never emails the teachers —
  // the in-site bell is enough. Enforced here so no future call site can
  // slip one through.
  const { roleForEmail } = await import("./roles");
  if (roleForEmail(opts.to.toLowerCase()) === "teacher") {
    console.log(`[email suppressed — teacher recipient] subject=${opts.subject}`);
    return false;
  }
  // Local development never sends real email, even with a real key in
  // .env.local — on 2026-09-27 a dev-server overdue sweep emailed the
  // teacher about local TEST students. Production only.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email skipped — not production] to=${opts.to} subject=${opts.subject}`);
    return false;
  }
  const key = readEnvVar("RESEND_API_KEY");
  const from = readEnvVar("EMAIL_FROM") ?? "בינת התורה <noreply@binat-hatorah.local>";
  if (!key) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${opts.to} subject=${opts.subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}
