# Work ↔ Chat MCP Coordination

## Purpose
ChatGPT Work and ordinary Chat share project state through already-connected MCP/app tools. No dedicated bridge server is required for the baseline workflow.

## Shared channels
- GitHub: machine-readable state, code, commits, branches.
- Notion: human-readable product state, decisions, blockers, next action.
- Google Drive: durable research/launch artifacts.
- Provider MCPs: actual cloud state is authoritative for deployed resources.

## Machine checkpoint
`control-plane/state.json` is the compact handoff pointer.

It is NOT trusted blindly. Before making changes, every agent must verify the relevant external resource using its provider MCP. Example: if state.json says a Render service exists, inspect Render before modifying it.

## Agent protocol
At the start of a Work or Chat execution:
1. Read `control-plane/state.json`.
2. Read the current product row/page in Notion.
3. Inspect GitHub repository/branch if recorded.
4. Inspect only the provider resources needed for the next action.
5. Prefer newer provider/Git state over stale checkpoint text.
6. Execute a small coherent unit of work.
7. Commit code first.
8. Update Notion.
9. Update `control-plane/state.json` last.

## Concurrency
Do not assume Work and Chat are mutually exclusive.
Before writing:
- refetch state.json;
- refetch the current target file/resource;
- avoid overwriting a newer commit;
- if another agent has advanced the project, resume from that newer state.

## active_agent
Set only while recording a checkpoint, using values such as:
- `work-astra`
- `chat-gpt56-sol`

Do not use it as a hard lock. Provider/Git state remains authoritative.

## Event granularity
Update the checkpoint after:
- product selection;
- repository creation;
- MVP vertical slice;
- schema migration;
- payment flow;
- deployment;
- observability setup;
- external/manual blocker.

Do not create checkpoints for trivial edits.

## External AI
External AI providers are subordinate workers, not sources of truth.
Their outputs must be reviewed by Work/Chat before:
- code merge;
- schema changes;
- security decisions;
- deployment;
- pricing/product decisions.

Preferred no-cost routes when configured:
1. Gemini free tier.
2. Cloudflare Workers AI free allocation.
3. Additional free providers only after verifying current limits, data handling, and API stability.

Never send secrets or restricted customer data to free external AI providers.
