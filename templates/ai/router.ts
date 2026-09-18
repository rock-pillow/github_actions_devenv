export type AIProvider = "gemini" | "none";

export interface AIRequest {
  prompt: string;
  system?: string;
  taskClass?: "large-context" | "multimodal" | "review" | "transform" | "general";
  sensitive?: boolean;
}

export interface AIResponse {
  provider: AIProvider;
  model: string;
  text: string;
  latencyMs: number;
}

export function shouldUseGemini(req: AIRequest): boolean {
  if (req.sensitive) return false;

  const configured = process.env.AI_PROVIDER ?? "auto";
  if (configured === "gemini") return true;
  if (configured === "none") return false;

  return (
    req.taskClass === "large-context" ||
    req.taskClass === "multimodal" ||
    req.taskClass === "review" ||
    req.taskClass === "transform"
  );
}
