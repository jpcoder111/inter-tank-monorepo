---
type: entity
prisma_model: User
schema_file: apps/api/prisma/schema.prisma
tags: [entity, prisma]
last_synced: 2026-04-11
---

# User

## Schema
| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| email | String | Unique |
| password | String | Hashed credential |
| hashedRefreshToken | String? | Nullable; stored for JWT refresh rotation |
| role | Role | Enum: ADMIN, USER. Default USER |
| firstName | String? | Nullable |
| lastName | String? | Nullable |
| createdAt | DateTime | Auto-set on creation |
| updatedAt | DateTime | Auto-updated |
| isClient | Boolean | Default false; distinguishes external clients from internal staff |
| phone | String? | Nullable |

## Relations
- Has many [[prompt-version-entity]] via `promptVersions`

## Access Patterns
- Created during registration/onboarding
- Read by auth guard on every request (JWT lookup)
- `hashedRefreshToken` updated on login/refresh, nulled on logout
- Role checked for ADMIN-only endpoints

## Business Rules
- `isClient` defaults to false -- must be explicitly set for external users
- `hashedRefreshToken` is nullable so a null value effectively revokes refresh capability
- Prisma client is generated to a custom path (`../generated/prisma`)
