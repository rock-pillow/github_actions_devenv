import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const MAX_BODY_BYTES = 64 * 1024;

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function parseCookies(header = "") {
  const out = {};
  for (const item of header.split(";")) {
    const i = item.indexOf("=");
    if (i < 0) continue;
    const key = item.slice(0, i).trim();
    const value = item.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function cookie(name, value, { secure = true, maxAge = 60 * 60 * 24 * 365 } = {}) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`
  ].filter(Boolean).join("; ");
}

export function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function constantTimeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export const OWNER_ACTIONS = new Set([
  "list",
  "create_project",
  "create_change",
  "revise",
  "share",
  "invoice",
  "history",
  "archive_project",
  "order"
]);

export function yen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}
