import type { AIRequest, AIResponse } from "./router";

export async function runWorkersAI(req: AIRequest): Promise<AIResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error("Cloudflare Workers AI credentials are not configured");
  }

  const model = process.env.CLOUDFLARE_AI_MODEL ?? "@cf/zai-org/glm-4.7-flash";
  const started = Date.now();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          ...(req.system ? [{ role: "system", content: req.system }] : []),
          { role: "user", content: req.prompt },
        ],
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Workers AI request failed: ${response.status} ${detail.slice(0, 500)}`);
  }

  const data = await response.json() as {
    result?: { response?: string };
  };

  return {
    provider: "workers-ai",
    model,
    text: data.result?.response ?? "",
    latencyMs: Date.now() - started,
  };
}
