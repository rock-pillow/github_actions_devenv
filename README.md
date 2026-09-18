# Astra Web Starter

Reusable base branch for ChatGPT Work / Astra web-product projects.

## Purpose
This branch contains product-agnostic operating rules and CI defaults. Product-specific code, domains, database projects, payment products, analytics events, and email templates should be created only after a product is selected.

## Connected environment
- GitHub: source control and Actions
- Vercel Hobby: preview/non-commercial development
- Render: runtime/deployment
- Supabase: database/auth/storage when needed
- Stripe: Sandbox only
- Resend: transactional email
- PostHog: analytics/experiments
- Sentry: error monitoring
- Figma: product design
- Google Drive + Notion: control plane and durable records
- Firecrawl: market/competitor research
- GSC Wizard: SEO/Search Console/GA4 after launch
- Gemini API: optional external AI provider through `@google/genai`

## Starting a product
1. Create a new repository or branch from this baseline.
2. Choose the smallest viable stack.
3. Copy .env.example to the local environment and populate only required variables.
4. Replace or extend CI if the project is not Node/Next.js.
5. Apply docs/AI_ROUTING.md if the product or development workflow uses Gemini.
6. Update AGENTS.md only when product-specific constraints require it.
