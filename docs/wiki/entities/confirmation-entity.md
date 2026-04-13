---
type: entity
prisma_model: Confirmation
schema_file: apps/api/prisma/schema.prisma
tags: [entity, prisma]
last_synced: 2026-04-11
---

# Confirmation

## Schema
| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| inputFileId | Int | FK to File (required) |
| outputFileId | Int? | FK to File (nullable -- output may not exist yet) |
| shipper | String | Shipper company name |
| importer | String | Importer company name |
| createdAt | DateTime | Auto-set on creation |
| updatedAt | DateTime | Auto-updated |

## Relations
- Belongs to [[file-entity]] via `inputFile` (required, "InputFileConfirmation")
- Belongs to [[file-entity]] via `outputFile` (optional, "OutputFileConfirmation")

## Access Patterns
- Created when a user uploads an input document for confirmation processing
- `outputFileId` is set later once the processed/confirmed output is generated
- Read to display confirmation history with shipper/importer metadata

## Business Rules
- `outputFileId` is nullable -- confirmations start without an output and gain one after processing completes
- `shipper` and `importer` are free-text; no FK to a separate parties table
- The two named relations prevent ambiguity since a File can appear on either side
