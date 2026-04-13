---
type: entity
prisma_model: PromptVersion
schema_file: apps/api/prisma/schema.prisma
tags: [entity, prisma]
last_synced: 2026-04-11
---

# PromptVersion

## Schema
| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| version | Int | Unique; sequential version number |
| model | String | AI model identifier (e.g. gpt-4, claude-3) |
| prompt | String | Full prompt text |
| createdById | Int | FK to User |
| createdAt | DateTime | Auto-set on creation |

## Relations
- Belongs to [[user-entity]] via `createdBy`

## Access Patterns
- Created by admins when authoring or revising AI prompts
- Read at processing time to fetch the active prompt for a given model
- Immutable once created -- new versions are appended, never edited

## Business Rules
- `version` is unique -- enforces exactly one prompt per version number, preventing duplicates
- No `updatedAt` field -- prompt versions are append-only by design
- `createdById` tracks accountability for who authored each prompt revision
