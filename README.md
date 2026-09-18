# ScopeLedger

ScopeLedger is a focused change-request ledger for Japanese freelance web designers and small agencies working on fixed-fee projects.

It records the baseline scope, priced change requests, deadline impact, client decisions, immutable history, and approved-but-unbilled work.

## Current MVP

- workspace creation without email signup;
- one free active project;
- project baseline + original budget;
- priced/scheduled change requests;
- client review URL with explicit approve / request-changes decision;
- version-specific decision enforcement;
- history ledger;
- approved-but-unbilled total;
- mark confirmed changes as invoiced;
- server-only Supabase RPC access.

## Architecture

Browser -> Node 24 web service -> Supabase REST RPC -> PostgreSQL

The browser never receives the Supabase service-role key and has no direct table/RPC access.

## Local development

Required environment variables:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=http://localhost:3000
```

Then:

```
npm test
npm run lint
npm run build
npm start
```

## Deployment constraints

- Reuse the existing Render workspace; do not create another workspace/project.
- Stripe remains Sandbox-only.
- Planned domain: `scopeledger.ustg.tech`; DNS is managed externally at get.tech and remains unchanged until deployment is ready.
- Vercel Hobby is not a commercial production target.

## Product constraints

This is not a generic project manager, invoicing suite, legal automation tool, or file/CSV conversion service.
