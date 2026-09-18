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
if (!change.data?.id || change.data.status !== "draft" || change.data.version !== 1) {
  throw new Error("change creation failed");
}

const sharedV1 = await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: { action: "share", payload: { id: change.data.id } },
});
if (!sharedV1.data?.review_url) throw new Error("v1 review URL missing");

const reviewUrlV1 = new URL(sharedV1.data.review_url);
const reviewTokenV1 = decodeURIComponent(reviewUrlV1.pathname.split("/").pop() || "");
if (!reviewTokenV1) throw new Error("v1 review token missing");

const reviewV1 = await fetch(sharedV1.data.review_url, { signal: AbortSignal.timeout(20_000) });
const reviewHtmlV1 = await reviewV1.text();
if (!reviewV1.ok || !reviewHtmlV1.includes("追加ページ")) throw new Error("v1 review page failed");

const requested = await json("/api/decision", {
  method: "POST",
  body: {
    token: reviewTokenV1,
    version: 1,
    decision: "changes_requested",
    name: "E2E Reviewer",
    comment: "説明を追加してください",
  },
});
if (requested.data?.change?.status !== "changes_requested") throw new Error("change request decision failed");

const revised = await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: {
    action: "revise",
    payload: {
      id: change.data.id,
      title: "追加ページ（改訂）",
      description: "会社概要ページを1ページ追加。原稿整理を含む。",
      amount: 24000,
      days: 3,
    },
  },
});
if (revised.data?.status !== "draft" || revised.data?.version !== 2) {
  throw new Error("revision did not create v2 draft");
}

const staleReview = await fetch(sharedV1.data.review_url, {
  redirect: "manual",
  signal: AbortSignal.timeout(20_000),
});
if (staleReview.ok) throw new Error("v1 review URL remained valid after revision");

const sharedV2 = await json("/api/action", {
  method: "POST",
  cookie: sessionCookie,
  body: { action: "share", payload: { id: change.data.id } },
});
if (!sharedV2.data?.review_url || sharedV2.data.review_url === sharedV1.data.review_url) {
  throw new Error("v2 review URL was not rotated");
}

const reviewUrlV2 = new URL(sharedV2.data.review_url);
const reviewTokenV2 = decodeURIComponent(reviewUrlV2.pathname.split("/").pop() || "");
const reviewV2 = await fetch(sharedV2.data.review_url, { signal: AbortSignal.timeout(20_000) });
const reviewHtmlV2 = await reviewV2.text();
if (!reviewV2.ok || !reviewHtmlV2.includes("追加ページ（改訂）") || !reviewHtmlV2.includes("v2")) {
  throw new Error("v2 review page failed");
}

const decision = await json("/api/decision", {
  method: "POST",
  body: {
    token: reviewTokenV2,
    version: 2,
    decision: "confirmed",
    name: "E2E Reviewer",
    comment: "改訂内容を承認します",
  },
});
if (decision.data?.change?.status !== "confirmed" || decision.data?.change?.version !== 2) {
  throw new Error("v2 confirmation failed");
}

const state = await json("/api/state", { cookie: sessionCookie });
const confirmed = state.data?.changes?.find((item) => item.id === change.data.id);
if (confirmed?.status !== "confirmed" || confirmed?.version !== 2 || Number(confirmed?.amount) !== 24000) {
  throw new Error("confirmed v2 state not persisted");
}

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
const kinds = (history.data || []).map(row => row.kind);
for (const expected of ["create_change", "changes_requested", "revise", "confirmed", "invoiced"]) {
  if (!kinds.includes(expected)) throw new Error(`history missing ${expected}`);
}
if (kinds.filter(kind => kind === "shared").length < 2) throw new Error("history missing two share events");

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
  final_version: 2,
  history: kinds,
}));
