---
type: module
scope: web
app_path: apps/web/app/ai-config
key_files:
  - apps/web/app/ai-config/page.tsx
  - apps/web/lib/ai-config/api.ts
  - apps/web/lib/ai-config/types.ts
depends_on: ["[[ai-config]]", "[[web-session]]"]
tags: [module, web, ai]
last_synced: 2026-04-11
---

# AI Config (Frontend)

## Purpose

Admin interface for managing the AI system prompt and model selection, with version history and diff comparison.

## Pages

- `/ai-config` -- Single page with two modes:
  - **Edit mode**: Form with a model dropdown (Claude Sonnet 4.5, Haiku 4.5, Opus 4, Sonnet 4) and a textarea for the system prompt. Saving creates a new version via `useCreatePromptVersion`. Dirty-state detection against the active config.
  - **Compare mode**: Side-by-side diff of two selected prompt versions using the `PromptDiff` component.
  - **Sidebar**: `VersionHistory` panel showing all versions. Clicking a version in edit mode loads it into the form; in compare mode it selects versions for diff.

## Data Flow

- **Reads**: `useActiveConfig` fetches `GET /ai-config/active` (current live config). `usePromptVersions` fetches `GET /ai-config/versions` (all versions, newest first).
- **Mutations**: `useCreatePromptVersion` calls `POST /ai-config/versions` with `{ model, prompt }`. On success, switches back to edit mode.
- **Lib structure**: `lib/ai-config/api.ts` (Axios calls), `lib/ai-config/types.ts` (PromptVersion, CreatePromptVersionData), `lib/ai-config/query-keys.ts`, and three React Query hooks.

## Gotchas

- There is no delete or rollback endpoint -- "rolling back" means clicking an old version in edit mode to load it, then saving it as a new version.
- The `PromptVersion` type includes `createdBy` (user who saved it) for audit display in the version history sidebar.
- Model options are hardcoded in the page component, not fetched from the backend.

## Related

- [[ai-config]] -- backend AI config module (versioned prompt storage)
- [[web-session]] -- auth context for API calls
