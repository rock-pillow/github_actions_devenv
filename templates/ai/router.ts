export type AIProvider = "gemini" | "groq" | "workers-ai" | "none";

export type AITaskClass =
  | "large-context"
  | "multimodal"
  | "review"
  | "transform"
  | "background"
  | "general";

export interface AIRequest {
  prompt: string;
  system?: string;
  taskClass?: AITaskClass;
  sensitive?: boolean;
}

export interface AIResponse {
  provider: AIProvider;
  model: string;
  text: string;
  latencyMs: number;
}

export function chooseProvider(req: AIRequest): AIProvider {
  if (req.sensitive) return "none";

  const forced = process.env.AI_PROVIDER?.trim();
  if (forced === "gemini" || forced === "groq" || forced === "workers-ai" || forced === "none") {
    return forced;
  }

  switch (req.taskClass) {
    case "large-context":
    case "multimodal":
      return process.env.GEMINI_API_KEY ? "gemini" : "none";
    case "review":
    case "transform":
      if (process.env.GROQ_API_KEY) return "groq";
      if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) return "workers-ai";
      return process.env.GEMINI_API_KEY ? "gemini" : "none";
    case "background":
      if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) return "workers-ai";
      return process.env.GROQ_API_KEY ? "groq" : "none";
    default:
      return "none";
  }
}

export function shouldUseExternalAI(req: AIRequest): boolean {
  return chooseProvider(req) !== "none";
}
