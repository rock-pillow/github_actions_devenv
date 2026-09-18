# AI Routing Policy

## Principle
Astra/ChatGPT remains the primary planner, reviewer, and tool orchestrator.
External AI APIs are subordinate workers. They never become a source of truth and their output must be reviewed before code, schema, security, deployment, pricing, or product decisions are finalized.

## Provider order

### 1. Gemini Free
Best for:
- very large context;
- multimodal/PDF/image/audio/video understanding;
- independent architecture or code review;
- long document synthesis.

Default integration:
- SDK: @google/genai
- Secret: GEMINI_API_KEY
- Default model: gemini-3.8-flash unless current availability changes.

Important privacy rule:
Google's current Gemini API Free Tier states that submitted content may be used to improve Google products. Do not route secrets, customer-private data, credentials, or confidential source material to the free tier unless the product's explicit data policy permits it.

### 2. Groq Free
Best for:
- low-latency second opinions;
- short code review;
- classification/extraction;
- parallel candidate generation.

Integration:
- OpenAI-compatible API
- Secret: GROQ_API_KEY
- Model must be selected from the currently available Groq production/free-tier catalog; do not hard-code a model that is already deprecated.

Free-tier limits are rate-limited. A 429 means stop/fallback; never try to bypass free-tier limits with multiple accounts or keys.

### 3. Cloudflare Workers AI Free
Best for:
- general-purpose background AI work;
- agentic/reasoning second pass;
- lightweight inference close to Worker workloads;
- tasks where a daily free quota is preferable to a per-account monthly credit.

Integration:
- Account ID + API token for REST, or Workers AI binding inside a Worker.
- Current free allocation is quota-limited and resets daily.
- Prefer models explicitly available on Workers Free at execution time.

Candidate free-access models (verify before use):
- @cf/zai-org/glm-4.7-flash
- @cf/google/gemma-4-26b-a4b-it
- @cf/nvidia/nemotron-3-120b-a12b

Do not assume every Workers AI model is accessible on Free; some high-resource models require Workers Paid.

### 4. Hugging Face
Use primarily for:
- model/dataset discovery;
- experimentation;
- specialized classification/embedding tasks.

The Free user's monthly inference credit is small, so it is not a primary general-purpose free LLM worker.

## Routing policy

Use deterministic/local code first when AI is unnecessary.

Suggested task routing:
- huge context / multimodal -> Gemini
- rapid second opinion / short review -> Groq
- background/general reasoning -> Workers AI
- model/dataset discovery -> Hugging Face
- sensitive/confidential content -> keep inside the primary trusted workflow unless an explicitly approved provider/data policy permits transfer

Never send:
- API keys;
- passwords;
- private keys;
- auth cookies/tokens;
- raw production database dumps;
- regulated/private customer data;
- secrets from deployment environments.

## Parallel review
For high-impact but non-sensitive decisions, Astra/Chat may ask two independent free providers for opinions, then perform the final adjudication itself.

Examples:
- security review: primary model + Groq or Workers AI
- architecture alternatives: primary model + Gemini
- UI copy variants: Groq + Workers AI
- long-document synthesis: Gemini, followed by primary-model verification

Do not use majority vote as truth. Compare reasoning and verify against code/docs/tests.

## Observability
Record when possible:
- provider
- model
- task class
- latency_ms
- success/failure
- fallback reason
- token counts or provider quota metrics

Do not log raw sensitive prompts by default.

## Failure semantics
- Retry transient failures with capped exponential backoff.
- Respect 429/rate-limit responses.
- A free-tier limit is a normal unavailable state, not an error to circumvent.
- Fallback only when privacy and semantics remain equivalent.
- Provider/model changes must be observable.

## Secret handling
All external AI credentials are server-side only.
Never place them in NEXT_PUBLIC_ variables, Git, Notion, Drive, Figma, PostHog, Sentry breadcrumbs, or logs.
