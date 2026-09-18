# Launch Checklist

## Product
- Problem and target user are stated clearly.
- Critical user flow works end to end.
- Pricing/monetization state is explicit.
- Legal/contact/privacy pages exist where required.

## Code
- Reproducible install.
- Lint passes.
- Typecheck passes.
- Tests pass.
- Production build passes.
- No tracked secret-bearing files.
- Dependencies are reasonably current.

## Security
- Authentication and authorization are server-enforced.
- RLS is enabled where applicable.
- Abuse-prone endpoints are rate-limited.
- Webhook signatures are verified.
- Webhook processing is idempotent.
- Secrets remain server-side.

## Operations
- Sentry connected where runtime errors matter.
- PostHog connected where user behavior matters.
- Health/log path is known.
- Failure modes are tested.

## Domain and email
- Product subdomain under ustg.tech is recorded.
- DNS is applied through get.tech.
- TLS is valid.
- Resend SPF/DKIM records are verified when email is used.

## AI, if used
- Provider/model is recorded.
- Gemini key is server-side only.
- Timeout/rate-limit/fallback policy is defined.
- Model calls have provider/model/latency telemetry.
- Sensitive-data handling is documented.

## Launch record
Update both:
- Astra Products in Notion
- Astra Launch Tracker in Google Sheets
