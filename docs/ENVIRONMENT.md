# Environment Map

The Astra Control Plane is the durable registry for shared infrastructure and product launches.

## Hosting
- Vercel Hobby: preview/development/non-commercial.
- Render: general runtime and commercial-production candidate with appropriate compute.

## Data
- Supabase projects are created per product only when required.
- Use migrations and RLS.

## Payments
- Stripe remains sandbox-only until explicit live-mode authorization.

## Email
- Resend domain and templates are created only after a product/domain is selected.

## Observability
- PostHog: product behavior and experimentation.
- Sentry: application errors and traces.

## Domain
- Shared root domain: ustg.tech.
- Registrar / DNS management: get.tech.
- Prefer product-specific subdomains rather than binding the apex to a single product.
- DNS changes remain an external/manual step unless a compatible DNS-management connector is added.

## SEO
- GSC/GA4 configuration starts after a public domain is live.

## Secrets
Store secrets in deployment-provider environment variables or a dedicated secret store. Never put them in Git, Notion, Drive, Figma, issues, logs, or analytics.
