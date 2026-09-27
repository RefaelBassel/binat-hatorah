import { auth } from "./auth";

// Central route gate (Next 16 "proxy", formerly middleware). Next 16 runs
// the proxy on the Node.js runtime, so it uses the FULL auth (with the
// DB-backed jwt callback): a pending account is re-checked against the DB
// on every request and the refreshed token is written back to the cookie
// here — the moment a teacher approves, the next click lets the student in,
// and a block takes effect within a minute. The decision itself lives in
// authConfig.callbacks.authorized: signed-out users see only the public
// pages; a signed-in account that no teacher approved is sent to /pending
// wherever it goes — pages and API routes alike.
export const proxy = auth;
export default auth;

export const config = {
  matcher: [
    // everything except Next internals and static files
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|audio/|print/|.*\\.(?:png|jpg|jpeg|svg|ico|mp3|json|txt|woff2?)$).*)",
  ],
};
