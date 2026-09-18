# Astra Development Rules

## Mission
Build small, deployable web products quickly, validate demand, instrument usage, and iterate from real behavior.

## Global constraints
- Never commit secrets, API keys, tokens, private keys, service-role credentials, or webhook secrets.
- Stripe is sandbox-only until the user explicitly authorizes live mode after account verification.
- Vercel Hobby is for preview, development, and non-commercial testing only.
- Render is the primary runtime candidate for commercial production.
- Keep Render to a single project/workspace deployment context for Astra work. Do not create additional Render projects/workspaces; reuse the existing context and add only the minimum services required by the selected product.
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

## Artifact discipline
- Do not create CSV files as planning artifacts, research outputs, status reports, backlogs, product specifications, or substitutes for implementation.
- Do not export structured findings to CSV merely because tabular data exists.
- Use Notion or Markdown for research/specifications/decisions.
- Update the existing Google Sheets Launch Tracker directly when tabular launch/status data must be recorded.
- Create CSV only when CSV itself is an explicit product requirement, an import/export feature under test, or the user explicitly asks for a CSV.
- Never let spreadsheet/CSV generation become the primary deliverable when the task is to build a working web product.


## Business selection exclusions
Do not select a generic file-format or data-conversion utility as the product.

Unless there is a genuinely differentiated vertical workflow with clear proprietary value, exclude:
- CSV viewers, editors, cleaners, converters, validators, mergers, splitters, deduplicators, formatters, analyzers, and CSV-to-X utilities;
- generic Excel/CSV/JSON/XML/YAML converters or transformers;
- generic PDF/image/text conversion, merge, split, compress, OCR, or formatter utilities;
- generic "upload a file, transform it, download a file" products;
- generic developer utilities whose primary value is format conversion rather than solving a business workflow.

Do not choose these merely because they are easy to build, SEO-friendly, or cheap to host.

Prefer products where the core value is a concrete recurring workflow, operational pain, decision support, domain-specific automation, or a monetizable niche process. File import/export may exist as a feature, but must not be the product thesis.

## Handoff discipline
- Persist durable checkpoints after material milestones so normal Chat can resume without relying on Work conversation context.
- When Work quota is low, prioritize committing verified code and recording current stage, blockers, provider state, and next action.
- Before creating any cloud resource, search connected sources to avoid duplicates.
- Follow `docs/HANDOFF.md` for the full resume/checkpoint protocol.

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
