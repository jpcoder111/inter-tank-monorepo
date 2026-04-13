---
type: module
scope: api
app_path: apps/api/src/uploader
key_files:
  - apps/api/src/uploader/uploader.controller.ts
depends_on: ["[[file-storage]]"]
entities: ["[[file-entity]]"]
tags: [module, api]
last_synced: 2026-04-11
---

# Uploader

## Purpose
Provides a single HTTP endpoint for uploading PDF files, delegating storage to the [[file-storage]] module's `FileService`.

## Public API
| Method | Route | Access | Description |
|---|---|---|---|
| `POST /uploader` | Public (no JWT required) | Upload a single PDF file |

### Request
- Content-Type: `multipart/form-data`
- Field name: `file`
- Validated with `ParseFilePipe`:
  - **Max size**: 1 MB (`1000000` bytes)
  - **File type**: `application/pdf` only

### Response
Returns whatever `FileService.uploadFile()` returns (typically the created file record).

## Internal Architecture
- **`UploaderModule`** imports `FileModule` and registers `UploaderController`.
- **`UploaderController`** uses `@UseInterceptors(FileInterceptor('file'))` from `@nestjs/platform-express` (Multer) to parse the multipart upload.
- The controller itself contains no business logic -- it validates the file constraints via NestJS pipes and forwards the `Express.Multer.File` object to `FileService.uploadFile()`.

## Gotchas
- The endpoint is marked `@Public()` -- no authentication is required to upload files. This is likely intentional for client-facing upload forms but should be reviewed for abuse vectors.
- Only PDF files are accepted; other MIME types will receive a 422 validation error.
- The 1 MB limit is relatively small; large PDFs will be rejected.

## Related
- [[file-storage]] -- `FileService` handles the actual storage (S3, local, etc.) and database record creation.
- [[file-entity]] -- the Prisma model that tracks uploaded files.
