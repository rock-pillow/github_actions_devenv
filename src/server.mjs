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
  verifyStripeSignature,
  yen
} from "./lib.mjs";

const PORT = Number(process.env.PORT || 3000);
const BACKEND_URL = process.env.BACKEND_URL || "";
const BACKEND_GATEWAY_SECRET = process.env.BACKEND_GATEWAY_SECRET || "";
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${PORT}`;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PAYMENT_LINK_URL = process.env.STRIPE_PAYMENT_LINK_URL || "";
const STRIPE_PAYMENT_LINK_ID = process.env.STRIPE_PAYMENT_LINK_ID || "";
const POSTHOG_PROJECT_KEY = process.env.POSTHOG_PROJECT_KEY || "";
const POSTHOG_HOST = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
const secureCookie = APP_URL.startsWith("https://");
const root = fileURLToPath(new URL("../public/", import.meta.url));
const appOrigin = new URL(APP_URL).origin;

if (!BACKEND_URL || !BACKEND_GATEWAY_SECRET) {
  console.error("BACKEND_URL and BACKEND_GATEWAY_SECRET are required");
  process.exit(1);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

function securityHeaders() {
  return {
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    ...(secureCookie ? { "strict-transport-security": "max-age=31536000; includeSubDomains" } : {})
  };
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (origin && origin !== appOrigin) {
    throw Object.assign(new Error("Cross-origin request rejected"), { status: 403 });
  }
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") {
    throw Object.assign(new Error("Cross-site request rejected"), { status: 403 });
  }
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    ...securityHeaders(),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    ...securityHeaders(),
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(html);
}

async function backend(body) {
  const response = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scopeledger-gateway": BACKEND_GATEWAY_SECRET
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { error: "Backend returned invalid JSON" }; }

  if (!response.ok) {
    const message = data?.error || "Backend request failed";
    throw Object.assign(new Error(message), {
      status: response.status === 401 ? 401 : response.status >= 500 ? 503 : 400
    });
  }
  return data;
}

async function rpc(action, payload, actorHash) {
  return backend({ operation: "api", action, payload, actor_hash: actorHash });
}

async function track(event, distinctId, properties = {}) {
  if (!POSTHOG_PROJECT_KEY || !distinctId) return;
  try {
    await fetch(`${POSTHOG_HOST}/i/v0/e`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_PROJECT_KEY,
        distinct_id: String(distinctId),
        event,
        properties: {
          "$process_person_profile": false,
          "$ip": null,
          environment: "preview",
          ...properties
        }
      }),
      signal: AbortSignal.timeout(1500)
    });
  } catch {
    // Analytics must never affect the product path.
  }
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

function scalarId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") return value.id;
  return null;
}

function invoiceSubscriptionId(invoice) {
  return scalarId(invoice?.parent?.subscription_details?.subscription) || scalarId(invoice?.subscription);
}

function invoicePeriodEnd(invoice) {
  const ends = (invoice?.lines?.data || [])
    .map(line => Number(line?.period?.end))
    .filter(Number.isFinite);
  return ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

function invoiceSubscriptionMetadata(invoice) {
  return invoice?.parent?.subscription_details?.metadata
    || invoice?.subscription_details?.metadata
    || {};
}

async function handleStripeWebhook(req, res) {
  if (!STRIPE_WEBHOOK_SECRET) return sendJson(res, 503, { error: "Webhook not configured" });

  const raw = await readBody(req);
  const signature = String(req.headers["stripe-signature"] || "");
  const payload = raw.toString("utf8");

  if (!verifyStripeSignature(payload, signature, STRIPE_WEBHOOK_SECRET)) {
    return sendJson(res, 400, { error: "Invalid Stripe signature" });
  }

  let event;
  try { event = JSON.parse(payload); }
  catch { return sendJson(res, 400, { error: "Invalid Stripe event" }); }

  if (event?.livemode !== false) {
    return sendJson(res, 400, { error: "Live Stripe events are not accepted" });
  }

  const object = event?.data?.object || {};
  let outcome = "ignored";

  if (event.type === "checkout.session.completed") {
    const paymentLinkId = scalarId(object.payment_link);
    if (STRIPE_PAYMENT_LINK_ID && paymentLinkId !== STRIPE_PAYMENT_LINK_ID) {
      return sendJson(res, 200, { received: true, outcome });
    }
    if (!["paid", "no_payment_required"].includes(String(object.payment_status || ""))) {
      return sendJson(res, 200, { received: true, outcome });
    }

    const orderId = String(object.client_reference_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      return sendJson(res, 200, { received: true, outcome: "missing_reference" });
    }

    outcome = await backend({
      operation: "fulfill_subscription",
      event_id: String(event.id || ""),
      order_id: orderId,
      checkout_id: String(object.id || ""),
      subscription_id: scalarId(object.subscription),
      customer_id: scalarId(object.customer),
      period_end: null
    });
    if (outcome === "fulfilled") {
      void track("sandbox subscription fulfilled", `order:${hashToken(orderId)}`, { source: "webhook" });
    }
  } else if (event.type === "invoice.paid") {
    const metadata = invoiceSubscriptionMetadata(object);
    if (metadata?.app !== "scopeledger") {
      return sendJson(res, 200, { received: true, outcome });
    }

    const subscriptionId = invoiceSubscriptionId(object);
    if (!subscriptionId) return sendJson(res, 200, { received: true, outcome: "missing_subscription_id" });

    outcome = await backend({
      operation: "renew_subscription",
      event_id: String(event.id || ""),
      subscription_id: subscriptionId,
      period_end: invoicePeriodEnd(object)
    });

    if (outcome === "missing") {
      return sendJson(res, 503, { received: false, outcome: "retry_after_checkout_mapping" });
    }
  } else if (event.type === "customer.subscription.deleted") {
    if (object?.metadata?.app !== "scopeledger") {
      return sendJson(res, 200, { received: true, outcome });
    }

    const subscriptionId = scalarId(object);
    if (!subscriptionId) return sendJson(res, 200, { received: true, outcome: "missing_subscription_id" });

    outcome = await backend({
      operation: "cancel_subscription",
      event_id: String(event.id || ""),
      subscription_id: subscriptionId
    });

    if (outcome === "missing") {
      return sendJson(res, 503, { received: false, outcome: "retry_after_checkout_mapping" });
    }
  }

  return sendJson(res, 200, { received: true, outcome });
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
      ...securityHeaders(),
      "content-type": types[extname(full)] || "application/octet-stream",
      "cache-control": extname(full) === ".html" ? "no-store" : "public, max-age=300"
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

    if (req.method === "POST" && pathname === "/api/stripe/webhook") {
      return handleStripeWebhook(req, res);
    }

    if (req.method === "POST" && pathname.startsWith("/api/")) {
      assertSameOrigin(req);
      await rate(req);
    }

    if (req.method === "POST" && pathname === "/api/workspaces") {
      const body = await readJson(req);
      const raw = newToken();
      const actorHash = hashToken(raw);
      const result = await rpc("create_workspace", { name: String(body.name || "") }, actorHash);
      void track("workspace created", `workspace:${actorHash}`);
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

    if (req.method === "POST" && pathname === "/api/checkout") {
      const actor = workspaceHash(req);
      if (!actor) return sendJson(res, 401, { error: "Workspace not selected" });
      if (!STRIPE_PAYMENT_LINK_URL) return sendJson(res, 503, { error: "Sandbox Checkout is not configured" });
      const order = await rpc("order", {}, actor);
      const checkoutUrl = new URL(STRIPE_PAYMENT_LINK_URL);
      checkoutUrl.searchParams.set("client_reference_id", String(order.id));
      void track("sandbox checkout started", `workspace:${actor}`);
      return sendJson(res, 200, { url: checkoutUrl.toString(), order_id: order.id, mode: "sandbox" });
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
        void track("change request shared", `workspace:${actor}`);
        return sendJson(res, 200, { ...result, review_url: `${APP_URL.replace(/\/$/, "")}/review/${raw}` });
      }

      const result = await rpc(action, payload, actor);
      if (action === "create_project") void track("project created", `workspace:${actor}`);
      if (action === "create_change") void track("change request created", `workspace:${actor}`);
      if (action === "revise") void track("change request revised", `workspace:${actor}`);
      if (action === "invoice") void track("change marked invoiced", `workspace:${actor}`);
      if (action === "archive_project") void track("project archived", `workspace:${actor}`);
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
      const reviewHash = hashToken(token);
      const decision = String(body.decision || "");
      const result = await rpc("decision", {
        version: Number(body.version),
        decision,
        name: String(body.name || ""),
        comment: String(body.comment || "")
      }, reviewHash);
      void track("client decision submitted", `review:${reviewHash}`, { decision });
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      const served = await serveStatic(req, res, pathname);
      if (served) return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const status = Number(error.status || 500);
    if (status >= 500) {
      console.error(error);
      void trackException(error, status);
    }
    sendJson(res, status, { error: status >= 500 ? "Internal server error" : error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`ScopeLedger listening on :${PORT}`));
