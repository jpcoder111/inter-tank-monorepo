---
type: module
scope: api
app_path: apps/api/src/ai-config
key_files:
  - apps/api/src/ai-config/ai-config.service.ts
  - apps/api/src/ai-config/ai-config.controller.ts
  - apps/api/src/ai-config/ai-config.module.ts
depends_on: ["[[prisma]]", "[[user]]"]
entities: ["[[PromptVersion]]"]
tags: [module, api, ai]
last_synced: 2026-04-11
---

# AI Config Module

## Purpose
Manages versioned AI prompt configurations, allowing admins to create, list, and retrieve the active prompt/model pair used for document processing.

## Public API (Endpoints)
All endpoints are under `/ai-config` and require the `ADMIN` role (enforced by `RolesGuard` + `@Roles`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai-config/active` | Returns the latest (highest version number) prompt configuration |
| GET | `/ai-config/versions` | Lists all prompt versions, newest first |
| POST | `/ai-config/versions` | Creates a new version; accepts `{ model, prompt }` in the body |

## Internal Architecture
**Active config concept** -- There is no explicit "active" boolean flag. The active configuration is simply the `PromptVersion` row with the highest `version` number, retrieved via `findFirst` with `orderBy: { version: 'desc' }`.

**Version incrementing** -- When creating a new version, the service runs a Prisma transaction that: (1) reads the current highest version number, (2) increments it by 1, (3) inserts the new row. The transaction ensures no two concurrent requests produce the same version number. If no versions exist yet, the first version is `1`.

**Creator tracking** -- The `createdById` is injected from `req.user.id` in the controller, not from the DTO, so it always reflects the authenticated user.

Each `PromptVersion` stores: `version` (unique int), `model` (string), `prompt` (string), `createdById` (FK to User), and `createdAt`.

## Gotchas
- **No soft-delete or rollback endpoint** -- You cannot deactivate a version; the only way to "revert" is to create a new version with the old prompt text.
- **No validation on `model` string** -- Any arbitrary string is accepted; a typo will only surface when the AI service tries to use it.
- **Race condition mitigated but not eliminated** -- The transaction prevents duplicate version numbers, but under extreme concurrency, one request will fail with a unique constraint violation rather than retry.
- **Admin-only** -- The `RolesGuard` and `@Roles(Role.ADMIN)` are applied at the controller level; the service itself has no auth checks, so direct service calls bypass authorization.

## Related
- [[ai]] -- consumes the model ID and prompt stored in PromptVersion
- [[user]] -- imported by the module for user resolution; `createdBy` relation on each version
