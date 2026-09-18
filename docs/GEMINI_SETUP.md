# Gemini Setup

## One-time prerequisite
Create a current Gemini API authorization key in Google AI Studio.

As of September 2026, do not build new infrastructure around legacy unrestricted/standard keys. Use a current authorization key.

## Server environment
Set:
- GEMINI_API_KEY
- GEMINI_MODEL=gemini-3.8-flash
- GEMINI_THINKING_LEVEL=medium

Optional Vertex AI path:
- GOOGLE_CLOUD_PROJECT
- GOOGLE_CLOUD_LOCATION=global
- GOOGLE_GENAI_USE_VERTEXAI=true

Use Vertex AI only when the product deliberately needs Google Cloud IAM, project-level governance, or Vertex-specific capabilities.

## JavaScript / TypeScript
Install:

npm install @google/genai

Minimal smoke test:

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});
const result = await ai.interactions.create({
  model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
  input: "Return exactly: GEMINI_OK",
});

console.log(result.output_text);

## Deployment
Store GEMINI_API_KEY in the selected runtime's secret/environment-variable system.
Never commit it to Git.

## Validation
Before enabling a product feature:
1. Make one server-side smoke request.
2. Verify the key is absent from client bundles and network responses.
3. Add rate limiting and request timeouts.
4. Add provider/model telemetry without prompt-body logging.
5. Define failure/fallback behavior.
