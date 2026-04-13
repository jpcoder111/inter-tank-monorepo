---
type: module
scope: api
app_path: apps/api/src/file
key_files:
  - apps/api/src/file/file.service.ts
  - apps/api/src/file/file.module.ts
  - apps/api/src/r2/r2.service.ts
  - apps/api/src/local-storage/local-storage.service.ts
depends_on: ["[[prisma]]", "[[r2]]", "[[local-storage]]", "[[ocr]]"]
entities: ["[[File]]"]
tags: [module, api, storage]
last_synced: 2026-04-11
---

# File Storage Module

## Purpose
Provides a unified file upload interface that delegates to either local disk or Cloudflare R2 depending on the environment.

## Public API
- `uploadFile(file, prefix?)` -- Uploads the file, persists a `File` record in the database, and returns `{ fileRecord }`.
- `createFile(file, prefix?)` -- Same as `uploadFile` but returns the Prisma `File` entity directly (no wrapper object).

## Internal Architecture
**Dual-provider pattern** -- At construction time, `FileService` checks `NODE_ENV`:
- `development` -> `LocalStorageService` (writes to `<cwd>/uploads/`, serves via `LOCAL_FILE_BASE_URL` defaulting to `http://localhost:8000/uploads`)
- anything else -> `R2Service` (uploads to Cloudflare R2 via the S3-compatible API)

Both providers implement the same implicit interface: `uploadFile(file, prefix?) -> { key, url }` and `getSignedUrl(key, expiresIn?)`.

**R2Service** uses `@aws-sdk/client-s3` with `PutObjectCommand`, then immediately generates a pre-signed GET URL (1-hour TTL). Keys follow the pattern `uploads/<prefix>-<uuid>.<ext>`.

**LocalStorageService** writes the buffer to disk with `writeFileSync` and returns a static URL. Its `getSignedUrl` simply returns the public URL (no actual signing).

After upload, both paths create a `File` record storing `mimeType`, `size`, `key`, and `publicUrl`.

## Gotchas
- **Provider is set once at construction** -- Changing `NODE_ENV` at runtime has no effect; the provider is locked when the service is instantiated.
- **R2 signed URLs expire in 1 hour** -- The URL stored in `publicUrl` will go stale. Consumers needing long-lived access must call `getSignedUrl` again.
- **No interface enforced** -- The dual-provider pattern relies on duck typing; there is no shared TypeScript interface or abstract class.
- **`uploadFile` vs `createFile`** -- They do nearly the same thing but return different shapes, which can be confusing.
- The `File` model has a `provider` field (enum `FileProvider`, default `LOCAL`) but the service never explicitly sets it during creation.

## Related
- [[ocr]] -- imported by the File module for PDF text extraction
- [[ai]] -- extracted text from files is sent to the AI service
