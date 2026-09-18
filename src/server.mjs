import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_BODY_BYTES,
  OWNER_ACTIONS,
  cookie,
  hashToken,
  newToken,
  parseCookies,
  safeJson,
  yen
} from "./lib.mjs";

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${PORT}`;
const secureCookie = APP_URL.startsWith("https://");
const root = fileURLToPath(new URL("../public/", import.meta.url));

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  });
  res.end(html);
}

async function rpc(action, payload, actorHash) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/sl_api`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ action, payload, actor_hash: actorHash }),
    signal: AbortSignal.timeout(10_000)
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) {
    const message = data?.message || "Database request failed";
    throw Object.assign(new Error(message), { status: /Unauthorized|Not found/.test(message) ? 401 : 400 });
  }
  return data;
}

function workspaceHash(req) {
  const token = parseCookies(req.headers.cookie).sl_workspace;
  return token ? hashToken(token) : null;
}

async function rate(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const address = forwarded || req.socket.remoteAddress || "unknown";
  const ok = await rpc("rate", {}, hashToken(`ip:${address}`));
  if (!ok) throw Object.assign(new Error("Too many requests"), { status: 429 });
}

function reviewHtml(token, data) {
  const c = data.change;
  const p = data.project;
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(c.title)} | ScopeLedger</title><link rel="stylesheet" href="/style.css"></head>
<body><main class="shell narrow">
<a class="brand" href="/">ScopeLedger</a>
<section class="card">
<p class="eyebrow">変更依頼 v${c.version}</p>
<h1>${escapeHtml(c.title)}</h1>
<p class="muted">案件: ${escapeHtml(p.name)} / ${escapeHtml(p.client)}</p>
<div class="review-grid">
<div><span>追加費用</span><strong>${yen(c.amount)}</strong></div>
<div><span>納期影響</span><strong>+${Number(c.days)}日</strong></div>
</div>
<h2>変更内容</h2><p class="pre">${escapeHtml(c.description)}</p>
<details><summary>当初スコープを確認</summary><p class="pre">${escapeHtml(p.baseline)}</p></details>
</section>
<section class="card">
<h2>判断</h2>
<form id="decision">
<input type="hidden" name="token" value="${escapeAttr(token)}">
<input type="hidden" name="version" value="${Number(c.version)}">
<label>お名前<input name="name" maxlength="100" required></label>
<label>コメント<textarea name="comment" maxlength="2000" placeholder="修正依頼の場合は必須です"></textarea></label>
<div class="actions"><button name="decision" value="confirmed">この内容で承認</button><button class="secondary" name="decision" value="changes_requested">修正を依頼</button></div>
</form><p id="result" class="muted"></p>
</section></main>
<script src="/review.js" defer></script></body></html>`;
}

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function escapeAttr(v = "") { return escapeHtml(v); }

async function serveStatic(req, res, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const clean = normalize(file).replace(/^\.\.(\/|\\|$)+/, "");
  const full = join(root, clean);
  if (!full.startsWith(root)) return false;
  try {
    const body = await readFile(full);
    const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8" };
    res.writeHead(200, {
      "content-type": types[extname(full)] || "application/octet-stream",
      "cache-control": extname(full) === ".html" ? "no-store" : "public, max-age=300",
      "x-content-type-options":"nosniff"
    });
    res.end(body);
    return true;
  } catch { return false; }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, APP_URL);
    const pathname = url.pathname;

    if (pathname === "/health") return sendJson(res, 200, { ok: true });

    if (req.method === "POST" && pathname.startsWith("/api/")) await rate(req);

    if (req.method === "POST" && pathname === "/api/workspaces") {
      const body = await readJson(req);
      const raw = newToken();
      const result = await rpc("create_workspace", { name: String(body.name || "") }, hashToken(raw));
      return sendJson(res, 201, result, { "set-cookie": cookie("sl_workspace", raw, { secure: secureCookie }) });
    }

    if (req.method === "POST" && pathname === "/api/logout") {
      return sendJson(res, 200, { ok: true }, { "set-cookie": cookie("sl_workspace", "", { secure: secureCookie, maxAge: 0 }) });
    }

    if (req.method === "GET" && pathname === "/api/state") {
      const actor = workspaceHash(req);
      if (!actor) return sendJson(res, 401, { error: "Workspace not selected" });
      const result = await rpc("list", {}, actor);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/action") {
      const actor = workspaceHash(req);
      if (!actor) return sendJson(res, 401, { error: "Workspace not selected" });
      const body = await readJson(req);
      const action = String(body.action || "");
      if (!OWNER_ACTIONS.has(action)) return sendJson(res, 400, { error: "Unsupported action" });
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

      if (action === "share") {
        const raw = newToken();
        const result = await rpc("share", { ...payload, review_hash: hashToken(raw) }, actor);
        return sendJson(res, 200, { ...result, review_url: `${APP_URL.replace(/\/$/, "")}/review/${raw}` });
      }

      const result = await rpc(action, payload, actor);
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" && pathname.startsWith("/review/")) {
      const token = decodeURIComponent(pathname.slice("/review/".length));
      if (!token || token.length > 256) return sendHtml(res, 404, "<h1>Not found</h1>");
      const data = await rpc("review", {}, hashToken(token));
      return sendHtml(res, 200, reviewHtml(token, data));
    }

    if (req.method === "POST" && pathname === "/api/decision") {
      const body = await readJson(req);
      const token = String(body.token || "");
      if (!token || token.length > 256) return sendJson(res, 400, { error: "Invalid token" });
      const result = await rpc("decision", {
        version: Number(body.version),
        decision: String(body.decision || ""),
        name: String(body.name || ""),
        comment: String(body.comment || "")
      }, hashToken(token));
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      const served = await serveStatic(req, res, pathname);
      if (served) return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const status = Number(error.status || 500);
    if (status >= 500) console.error(error);
    sendJson(res, status, { error: status >= 500 ? "Internal server error" : error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`ScopeLedger listening on :${PORT}`));
