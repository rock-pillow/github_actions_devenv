# Astra Development Rules

## Mission
Build small, deployable web products quickly, validate demand, instrument usage, and iterate from real behavior.

## Global constraints
- Never commit secrets, API keys, tokens, private keys, service-role credentials, or webhook secrets.
- Stripe is sandbox-only until the user explicitly authorizes live mode after account verification.
- Vercel Hobby is for preview, development, and non-commercial testing only.
- Render is the primary runtime candidate for commercial production.
- Use Supabase only when persistent state, authentication, storage, or server-side data access is required.
- All user-owned Supabase data must use RLS.
- Database schema changes must be represented as migrations.
- Add Sentry and PostHog before launch when the selected product has meaningful runtime/user behavior.
- Configure Resend only after a product domain and sender identity are known.
- Register GSC/GA4 only after a public domain exists.
- Keep infrastructure minimal; do not add services without a concrete product requirement.

## Model routing
- Astra remains the primary planner, implementer, and tool orchestrator.
- Gemini is an optional external model provider, not a hard dependency.
- Default Gemini production model: `gemini-3.8-flash` unless a current product requirement justifies another stable model.
- Prefer Gemini for very large-context analysis, multimodal inputs, independent second-pass review, or high-throughput transformations when it materially improves cost/latency/quality.
- Prefer the direct Google Gen AI SDK (`@google/genai`) for new Gemini integrations.
- Keep `GEMINI_API_KEY` server-side. Never expose it through `NEXT_PUBLIC_*`, client bundles, logs, analytics, issues, or source control.
- Use `AI_PROVIDER=auto` to allow product code to choose a provider by task; provider choice must remain explicit in code and observable in logs/metrics.
- Do not silently send confidential user content to an external model provider. Product-specific data-handling rules override automatic routing.
- If Gemini is unavailable, fail over only when the task semantics remain valid; otherwise surface the failure.

## Delivery gate
Before declaring a build complete:
1. Install dependencies reproducibly.
2. Run lint if configured.
3. Run typecheck if configured.
4. Run tests if configured.
5. Run a production build.
6. Exercise the critical user flow.
7. Verify error handling.
8. Verify no secrets are committed.
9. Verify analytics/error monitoring in the deployed environment.
10. Record the launch in the Astra Control Plane.

## Git
- GitHub is the source of truth.
- Prefer focused commits.
- Direct commits are allowed when appropriate.
- Use feature branches for risky or multi-step work.
- Do not rewrite shared history unless explicitly required.

## Payments
- Use Stripe Checkout or another Stripe-hosted payment surface where suitable.
- Verify webhook signatures.
- Make webhook processing idempotent.
- Keep Product IDs, Price IDs, keys, and webhook secrets in environment variables.
- Do not store raw card data.

## Security
- Validate all untrusted inputs.
- Enforce authorization server-side.
- Avoid IDOR by scoping resource access to the authenticated principal.
- Keep privileged keys server-only.
- Rate-limit abuse-prone endpoints.
- Do not expose stack traces, secrets, or internal configuration to clients.

## Product workflow
Research -> Validate -> Design -> Implement -> Test -> Deploy -> Instrument -> Observe -> Iterate -> Monetize.
