const base = (process.env.E2E_URL || "https://scopeledger.onrender.com").replace(/\/$/, "");

async function json(path, { method = "GET", cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${text.slice(0, 500)}`);
  }
  return { response, data, text };
}

const suffix = Date.now().toString(36);

const webhookPayload = '{"id":"evt_scopeledger_checkout_fulfill_smoke","object":"event","type":"checkout.session.completed","livemode":false,"data":{"object":{"id":"cs_test_scopeledger_fulfill","object":"checkout.session","payment_link":"plink_1UGrirC05qJ95APieR94dXDJ","payment_status":"paid","client_reference_id":"6634a75b-ec98-4997-af3d-51507a784e61","subscription":"sub_test_scopeledger_fulfill","customer":"cus_test_scopeledger_fulfill"}}}';
const webhookResponse = await fetch(base + "/api/stripe/webhook", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "stripe-signature": "t=1789699812,v1=099acd5299ad272ca819f628d883f370cdf979fdade110c3bac1effa3ca58f33"
  },
  body: webhookPayload,
  signal: AbortSignal.timeout(20_000),
});
const webhookData = await webhookResponse.json().catch(() => ({}));
if (!webhookResponse.ok || webhookData?.received !== true || webhookData?.outcome !== "fulfilled") {
  throw new Error(`checkout fulfillment webhook failed: ${webhookResponse.status} ${JSON.stringify(webhookData)}`);
}

const health = await json("/health");
if (health.data?.ok !== true) throw new Error("health check failed");

const workspace = await json("/api/workspaces", {
  method: "POST",
  body: { name: `E2E Studio ${suffix}` },
});
const setCookie = workspace.response.headers.get("set-cookie") || "";
const sessionCookie = setCookie.split(";")[0];
if (!sessionCookie.startsWith("sl_workspace=")) throw new Error("workspace cookie missing");

const checkout = await json("/api/checkout", {
  method: "POST",
  cookie: sessionCookie,
  body: {},
});
const checkoutUrl = new URL(checkout.data?.url || "");
if (checkoutUrl.hostname !== "buy.stripe.com") throw new Error("Sandbox Checkout host mismatch");
if (checkoutUrl.searchParams.get("client_reference_id") !== checkout.data?.order_id) {
  throw new Error("Checkout client_reference_id mismatch");
}

const project = await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: {
    action: "create_project",
    payload: {
      name: `E2E Project ${suffix}`,
      client: "E2E Client",
      baseline: "トップページ1枚、修正2回まで",
      budget: 120000,
    },
  },
});
if (!project.data?.id) throw new Error("project id missing");

const change = await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: {
    action: "create_change",
    payload: {
      project_id: project.data.id,
      title: "追加ページ",
      description: "会社概要ページを1ページ追加",
      amount: 22000,
      days: 2,
    },
  },
});
if (!change.data?.id || change.data.status !== "draft") throw new Error("change creation failed");

const shared = await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: { action: "share", payload: { id: change.data.id } },
});
if (!shared.data?.review_url) throw new Error("review URL missing");

const reviewUrl = new URL(shared.data.review_url);
const reviewToken = decodeURIComponent(reviewUrl.pathname.split("/").pop() || "");
if (!reviewToken) throw new Error("review token missing");

const review = await fetch(shared.data.review_url, { signal: AbortSignal.timeout(20_000) });
const reviewHtml = await review.text();
if (!review.ok || !reviewHtml.includes("追加ページ")) throw new Error("review page failed");

const decision = await json("/api/decision", {
  method: "POST",
  body: {
    token: reviewToken,
    version: 1,
    decision: "confirmed",
    name: "E2E Reviewer",
    comment: "承認します",
  },
});
if (decision.data?.change?.status !== "confirmed") throw new Error("decision failed");

const state = await json("/api/state", { cookie: sessionCookie });
const confirmed = state.data?.changes?.find((item) => item.id === change.data.id);
if (confirmed?.status !== "confirmed") throw new Error("confirmed state not persisted");

await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: { action: "invoice", payload: { id: change.data.id } },
});

const history = await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: { action: "history", payload: { id: change.data.id } },
});
const kinds = new Set((history.data || []).map((row) => row.kind));
for (const expected of ["create_change", "shared", "confirmed", "invoiced"]) {
  if (!kinds.has(expected)) throw new Error(`history missing ${expected}`);
}

await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: { action: "archive_project", payload: { project_id: project.data.id } },
});

console.log(JSON.stringify({
  ok: true,
  workspace: workspace.data?.id,
  project: project.data.id,
  change: change.data.id,
  checkout_order: checkout.data.order_id,
  history: [...kinds],
}));
