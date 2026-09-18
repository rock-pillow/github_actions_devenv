import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

const ai = new GoogleGenAI({});
const model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

const result = await ai.interactions.create({
  model,
  input: "Return exactly: GEMINI_OK",
});

if ((result.output_text ?? "").trim() !== "GEMINI_OK") {
  throw new Error(`Unexpected Gemini response: ${result.output_text}`);
}

console.log("GEMINI_OK");
