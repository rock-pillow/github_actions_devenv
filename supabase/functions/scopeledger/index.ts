const EXPECTED_GATEWAY_SHA256 = "7dbd705832f1c9bcb9d1babfe31b75089dec8a84a32b00c83a4e6b1c684b4333";

const encoder = new TextEncoder();

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function constantTimeHexEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function adminKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (typeof parsed.default === "string" && parsed.default) return parsed.default;
    } catch {}
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Admin key unavailable");
  return legacy;
}

async function callRpc(name: string, body: unknown) {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("Supabase URL unavailable");
  const key = adminKey();

  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: key,
  };
  if (!key.startsWith("sb_secret_")) headers.authorization = `Bearer ${key}`;

  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  const text = await response.text();
  return { status: response.status, ok: response.ok, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return Response.json({ ok: true, service: "scopeledger-backend", version: 2 });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const supplied = req.headers.get("x-scopeledger-gateway") || "";
  if (!supplied || supplied.length > 256) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suppliedHash = await sha256(supplied);
  if (!constantTimeHexEqual(suppliedHash, EXPECTED_GATEWAY_SHA256)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 65536) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }

  try {
    const raw = await req.text();
    if (raw.length > 65536) {
      return Response.json({ error: "Request too large" }, { status: 413 });
    }

    const body = JSON.parse(raw || "{}");
    const action = String(body.action || "");
    const actorHash = String(body.actor_hash || "");
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

    if (!action || !/^[a-f0-9]{64}$/.test(actorHash)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await callRpc("sl_api", {
      action,
      payload,
      actor_hash: actorHash,
    });

    if (!result.ok) {
      return Response.json({ error: "Operation rejected" }, { status: result.status >= 500 ? 503 : 400 });
    }

    return new Response(result.text || "null", {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
});
