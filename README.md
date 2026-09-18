# ScopeLedger

A change-request ledger for Japanese freelance web designers and small agencies working on fixed-fee projects. Record baseline scope, additional fees, schedule impact, version-specific client decisions, immutable application history, and approved-but-unbilled work.

Preview: https://scopeledger.onrender.com
Source of truth: `scopeledger` branch in this repository.

## Current MVP

Free: 1 active project. Pro: 10 active projects, JPY 1,980/month in Stripe Sandbox only.
Workspace creation, project baseline, change request, share, approval, revision/reapproval, history, unbilled totals, invoicing and archive flows are implemented.

## Architecture

Browser → Node 24 on Render → protected Supabase Edge Function → server-side RPC → PostgreSQL.

The browser uses an HttpOnly workspace cookie. Supabase admin credentials remain inside Supabase; do not configure them on Render. Existing Supabase project: `pusiejhxpnfnddvunmyg`; existing Edge Function: `scopeledger`.

## Local development

Use `.env.example` for configuration names. Supply `BACKEND_URL`, `BACKEND_GATEWAY_SECRET`, and `APP_URL` securely in the process environment. The gateway credential must match the existing Edge Function configuration. Never commit credentials.

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

The typecheck script currently performs JavaScript syntax checks, not static TypeScript analysis.
Public workflow test: `node scripts/e2e.mjs`. In proxy-based environments, use `NODE_USE_ENV_PROXY=1`. This creates test data requiring explicit cleanup.

## Verification — 2026-09-18

Runtime commit `81c0de9dc8fc526f668df71f7595023db4e65907` passed GitHub CI, deployed to the existing Render service, and passed public revision/reapproval/invoicing E2E.

A real Stripe-hosted Sandbox Checkout completed with `payment_status=paid`. Provider-generated webhooks populated order/customer/subscription state and Pro entitlement. Sandbox subscription cancellation also reached the DB. Test subscription is canceled and this run's workspace/project/order records are removed. Event IDs remain as idempotency records.

PostHog product ingestion and sanitized server exception ingestion are verified. The existing error insight/alert is reused. No session replay, raw request body, credential, project content or Stripe payload is sent to error tracking. Sentry is deferred because its callable connection and runtime credentials were unavailable.

Stripe dashboard delivery-attempt HTTP status remains uninspected: this connector does not expose it and the browser requires account sign-in. DB webhook receipt and entitlement effects are verified; these are separate evidence.

## Deployment and handoff

Reuse Render service `srv-dama0srm8hqs73d2clc0` in the existing workspace. Auto-deploy stays OFF; deploy only a CI-passed commit and verify the deployed SHA. Refetch latest HEAD and affected files before every write.

Read `control-plane/state.json`, `docs/WORK_CHAT_BRIDGE.md`, and Notion before resuming.
Domain `scopeledger.ustg.tech` remains planned; DNS is unchanged. No live payments or paid resources were enabled. Revenue is unvalidated.

No CSV/file-conversion business, unnecessary AI functionality, or additional cloud projects.
