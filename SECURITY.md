# Security Policy

## Secrets
Never commit credentials, API keys, private keys, webhook secrets, service-role keys, or production tokens.

Use deployment-provider environment variables or an appropriate secret manager.

## Supported development baseline
Security-sensitive changes should preserve:
- server-side authorization;
- least-privilege credentials;
- input validation;
- output encoding;
- CSRF protection where relevant;
- rate limiting for abuse-prone endpoints;
- webhook signature verification and idempotency;
- RLS for user-owned Supabase data.

## External AI providers
External model APIs are third-party data processors from the application's perspective.
Do not send confidential or restricted data unless the product's data-handling policy permits it.
Never log model API keys or raw sensitive prompts by default.

## Reporting
Do not put sensitive vulnerability details in public issues. Use a private reporting channel appropriate to the deployed product.
