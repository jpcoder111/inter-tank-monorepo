---
type: entity
prisma_model: File
schema_file: apps/api/prisma/schema.prisma
tags: [entity, prisma]
last_synced: 2026-04-11
---

# File

## Schema
| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| mimeType | String | e.g. application/pdf |
| size | Int | Bytes |
| publicUrl | String? | Nullable; set after upload for R2, may be null for LOCAL |
| createdAt | DateTime | Auto-set on creation |
| updatedAt | DateTime | Auto-updated |
| key | String | Storage path/key used to locate the file |
| provider | FileProvider | Enum: LOCAL, R2. Default LOCAL |

## Relations
- Has many [[confirmation-entity]] as input file via `inputConfirmations`
- Has many [[confirmation-entity]] as output file via `outputConfirmations`

## Access Patterns
- Created on file upload (local disk or Cloudflare R2)
- Read when serving downloads or linking to confirmations
- `publicUrl` populated after successful remote upload (R2)

## Business Rules
- Dual storage strategy: LOCAL for dev/fallback, R2 for production CDN
- `publicUrl` is nullable -- LOCAL files may not have a public URL
- A single file can serve as input for some confirmations and output for others (two separate relations)
