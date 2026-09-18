import { GoogleGenAI } from "@google/genai";
import type { AIRequest, AIResponse } from "./router";

export async function runGemini(req: AIRequest): Promise<AIResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  const ai = new GoogleGenAI({});

  const started = Date.now();
  const interaction = await ai.interactions.create({
    model,
    input: req.system
      ? `System:\n${req.system}\n\nUser:\n${req.prompt}`
      : req.prompt,
  });

  return {
    provider: "gemini",
    model,
    text: interaction.output_text ?? "",
    latencyMs: Date.now() - started,
  };
}
