import type { AIRequest, AIResponse } from "./router";

export async function runGroq(req: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const model = process.env.GROQ_MODEL;
  if (!model) {
    throw new Error("GROQ_MODEL is not configured; choose a current non-deprecated model");
  }

  const started = Date.now();
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: req.prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq request failed: ${response.status} ${detail.slice(0, 500)}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    provider: "groq",
    model,
    text: data.choices?.[0]?.message?.content ?? "",
    latencyMs: Date.now() - started,
  };
}
