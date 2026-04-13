---
type: index
description: Master index for the Inter-Tank codebase wiki. Agents start here.
last_synced: 2026-04-11
---

# Inter-Tank Wiki Index

Compiled knowledge base for the Inter-Tank shipping document confirmation system. Read this first, then pull only the pages you need.

## System Overview

Turborepo monorepo. NestJS API (Prisma + PostgreSQL) + Next.js 15 frontend (App Router, React Query, Tailwind). Core domain: users upload shipping PDFs -> OCR text extraction -> Claude AI structured data extraction -> confirmation PDF generation.

## Repository Map

| Path | What | Wiki Page |
|------|------|-----------|
| `apps/api/src/auth/` | JWT auth, refresh tokens, role guards | [[auth]] |
| `apps/api/src/user/` | User CRUD, password management | [[user]] |
| `apps/api/src/confirmation/` | **Core**: PDF upload -> OCR -> AI -> PDF gen | [[confirmation]] |
| `apps/api/src/ai/` | Anthropic Claude API wrapper | [[ai]] |
| `apps/api/src/ai-config/` | Prompt version management | [[ai-config]] |
| `apps/api/src/ocr/` | PDF-to-text via Tesseract.js | [[ocr]] |
| `apps/api/src/file/` | Dual storage abstraction (Local/R2) | [[file-storage]] |
| `apps/api/src/r2/` | Cloudflare R2 S3-compatible storage | [[file-storage]] |
| `apps/api/src/local-storage/` | Local filesystem storage (dev) | [[file-storage]] |
| `apps/api/src/uploader/` | Generic file upload endpoint | [[uploader]] |
| `apps/api/prisma/schema.prisma` | Database schema | [[user-entity]] [[file-entity]] [[confirmation-entity]] [[prompt-version-entity]] |
| `apps/web/app/auth/` | Sign-in page | [[web-session]] |
| `apps/web/app/confirmations/` | Confirmation form + list | [[web-confirmations]] |
| `apps/web/app/users/` | User management pages | [[web-users]] |
| `apps/web/app/ai-config/` | Prompt editor + version diff viewer | [[web-ai-config]] |
| `apps/web/lib/` | API client, session, server actions, hooks | [[web-conventions]] |
| `packages/` | eslint-config, typescript-config, ui, validators | (trivial, no pages) |

## Task Routing

| If your task involves... | Read these pages |
|--------------------------|-----------------|
| The confirmation pipeline | [[confirmation-flow]], [[confirmation]], [[ocr]], [[ai]] |
| Auth or login issues | [[auth-flow]], [[auth]], [[web-session]] |
| Adding a new API endpoint | [[api-conventions]], [[auth]] |
| Adding a new frontend page | [[web-conventions]], [[web-session]] |
| Changing the database schema | [[shared-conventions]], relevant entity page |
| Prompt engineering / AI config | [[prompt-versioning-flow]], [[ai-config]], [[ai]] |
| File upload or storage | [[file-storage]], [[uploader]] |
| User management | [[user]], [[web-users]], [[user-entity]] |
| Understanding the domain | [[glossary]] |

## Entities

4 Prisma models: [[user-entity]], [[file-entity]], [[confirmation-entity]], [[prompt-version-entity]]

## Conventions

Read before writing code: [[api-conventions]], [[web-conventions]], [[shared-conventions]]

## Architecture Decisions

[[adr-001-dual-file-storage]] | [[adr-002-ocr-tesseract]] | [[adr-003-session-jwt-cookie]] | [[adr-004-prompt-versioning]]
