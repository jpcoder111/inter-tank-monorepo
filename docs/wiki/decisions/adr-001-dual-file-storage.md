---
type: decision
status: accepted
date: 2026-04-11
tags: [decision, adr, storage]
last_synced: 2026-04-11
---

# ADR-001: Dual File Storage (Local + R2)

## Context
The app needs to store uploaded PDFs and generated confirmation documents. Development requires fast local iteration without cloud dependencies, but production needs durable cloud storage.

## Decision
Use a dual-provider pattern: `LocalStorageService` in development (`NODE_ENV === 'development'`), `R2Service` (Cloudflare R2, S3-compatible) in all other environments. `FileService` selects the provider at runtime. Both providers expose the same `uploadFile(file, prefix)` interface (duck-typed, no shared interface/abstract class).

## Consequences
- Local dev requires no cloud credentials
- File records store a `provider` enum (`LOCAL` | `R2`) so the system knows where to find each file
- No shared abstract class means the providers can drift — changes to one must be manually mirrored
- R2 URLs are signed with 1-hour TTL; local files are served directly

## Related
- [[file-storage]]
