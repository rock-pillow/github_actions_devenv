# AI Routing Policy

## Principle
Astra is the primary planner and tool orchestrator. External model APIs are optional execution resources, selected only when they materially improve the task.

## Gemini default
- SDK: @google/genai
- API: Gemini API / Interactions API for new integrations where appropriate
- Default stable model: gemini-3.8-flash
- Default thinking level: medium
- Secret: GEMINI_API_KEY
- Never expose GEMINI_API_KEY to browser code.

## When Gemini is appropriate
Use Gemini when one or more of these are true:
1. Very large context is required (large repositories, many documents, long logs).
2. Image, audio, video, or PDF understanding materially helps.
3. A second independent model pass would reduce implementation/review risk.
4. A high-throughput transformation or classification workload benefits from a separate provider.
5. Google-native grounding/tooling is specifically useful for the product.

## When not to use Gemini
Do not call Gemini merely because it is available.
Avoid it when:
- deterministic local code is sufficient;
- the task contains data that product policy forbids sending to that provider;
- the task is latency-sensitive and an extra model hop adds no value;
- the output will not be validated and model disagreement would create ambiguity.

## Routing
AI_PROVIDER=auto means the application may select a configured provider by task policy.
Provider choice must be explicit in code and observable.

Recommended metadata for each external model call:
- provider
- model
- operation/task class
- latency_ms
- success/failure
- input/output token counts when available
- cost estimate when available

Do not log prompt bodies, secrets, personal data, or raw customer content by default.

## Failure semantics
- Retry only transient failures with capped exponential backoff.
- Respect provider rate limits.
- Do not silently fall back when provider changes could alter security, privacy, or semantics.
- If a safe equivalent fallback exists, record provider_used and fallback_reason.

## Security
- GEMINI_API_KEY belongs only in server-side deployment secrets.
- Do not use NEXT_PUBLIC_ or any client-exposed environment namespace.
- Never store keys in GitHub issues, Notion, Drive, Figma, PostHog, Sentry breadcrumbs, or logs.
- Rotate a key immediately after suspected exposure.
