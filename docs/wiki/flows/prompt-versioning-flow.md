---
type: flow
triggers: ["Admin creates new prompt version", "Confirmation uses active prompt"]
touches_modules: ["[[web-ai-config]]", "[[ai-config]]", "[[ai]]", "[[confirmation]]"]
touches_entities: ["[[prompt-version-entity]]"]
tags: [flow, ai]
last_synced: 2026-04-11
---

# Prompt Versioning Flow

## Trigger
An admin creates or edits a prompt version from the AI Config page, or the confirmation module fetches the active prompt for AI processing.

## Sequence

### Frontend -- Editing a Prompt
1. **AI Config page** (`/ai-config`) loads the active config (`useActiveConfig`) and full version list (`usePromptVersions`).
2. The form pre-fills with the active version's `model` and `prompt` fields.
3. Admin selects a model from a dropdown (Claude Sonnet 4.5, Haiku 4.5, Opus 4, Sonnet 4) and edits the system prompt in a textarea.
4. A dirty-check compares the form state against the active config; the "Guardar Nueva Version" button enables only when changes exist.
5. On submit, `useCreatePromptVersion` sends `POST /ai-config/versions` with `{ model, prompt }`.

### Frontend -- Comparing Versions
1. Admin switches to "Comparar" mode via a tab toggle.
2. Clicking two versions in the `VersionHistory` sidebar selects them as "nueva" (newer) and "base" (older).
3. `PromptDiff` renders a line-by-line diff (using the `diff` library's `diffLines`) with green/red highlighting.

### Backend -- Creating a Version
1. `AiConfigController.createVersion()` is protected by `RolesGuard` + `@Roles(ADMIN)`.
2. `AiConfigService.createVersion()` runs inside a Prisma `$transaction`:
   - Fetches the latest `PromptVersion` ordered by `version DESC`.
   - Increments the version number by 1.
   - Creates a new `PromptVersion` record with `{ version, model, prompt, createdById }`.
3. Returns the created record with the `createdBy` user relation.

### Backend -- Serving the Active Prompt
1. `GET /ai-config/active` returns the `PromptVersion` with the highest version number (i.e., the most recently created).
2. The [[ai]] and [[confirmation]] modules consume this to get the current system prompt and model for AI processing.

## Error Handling
- **Concurrent creation** -- the `$transaction` ensures the version counter is consistent even under concurrent writes.
- **Unauthorized access** -- non-admin users receive a 403 from `RolesGuard`.
- **Validation** -- `CreatePromptVersionDto` requires both `model` and `prompt` to be non-empty strings (`@IsString()`).
