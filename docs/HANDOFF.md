# Astra Handoff Protocol

## Goal
Any normal Chat session must be able to resume Astra Work without reconstructing state from conversation history.

## Source-of-truth order
1. Product row/page in Notion Astra Products.
2. Product GitHub repository and latest branch/commits.
3. Deployed resources in the connected provider.
4. Google Drive Launch Tracker and product folder.
5. Conversation history only as supplemental context.

## Checkpoint discipline
After every material milestone, persist enough state that another agent can resume:
- selected product and current stage;
- repository URL and active branch;
- latest verified commit;
- deployed service URLs and provider resource names;
- database/migration state;
- Stripe Sandbox state;
- current blocker;
- next concrete action;
- any external/manual step still required.

Do not store secrets in checkpoint text.

## Before creating resources
Always search connected sources first. Never duplicate:
- GitHub repositories;
- Render projects/workspaces/services;
- Supabase projects;
- Stripe Products/Prices/Webhooks;
- Resend domains;
- PostHog/Sentry projects;
- GSC properties;
- product subdomains.

## When Work quota is low
Prioritize durable state over optional polish:
1. commit working code;
2. record current stage and next action in Notion;
3. update Launch Tracker;
4. document any partially-completed provider configuration;
5. leave the repository buildable or clearly mark the failing command.

## Resume
A replacement agent should first inspect the latest durable artifacts and only then modify code or cloud resources.
