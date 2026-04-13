---
type: convention
scope: api
tags:
  - convention
  - api
last_synced: 2026-04-11
---

# API Conventions

## Module Structure

Every feature is a NestJS module at `apps/api/src/<feature>/`:
- `<feature>.module.ts` — NestJS module definition
- `<feature>.service.ts` — business logic
- `<feature>.controller.ts` — HTTP endpoints (not all modules have one)
- `dto/` — request/response DTOs with class-validator decorators

## Authentication

- Global `JwtAuthGuard` applied to all routes by default (registered via `APP_GUARD` in AuthModule)
- `@Public()` decorator bypasses auth — import from `auth/decorators/plublic.decorator.ts` (typo in filename, do not rename)
- `@Roles(Role.ADMIN)` + `@UseGuards(RolesGuard)` for admin-only endpoints
- Roles enum: `ADMIN`, `USER` (defined in Prisma schema)

## Validation

- Global `ValidationPipe` with `transform: true` and `whitelist: true` (in `main.ts`)
- DTOs use class-validator: `@IsString()`, `@IsNotEmpty()`, `@IsOptional()`, etc.
- Boolean fields from multipart forms need `@Transform(({ value }) => value === 'true')`

## Database

- Prisma + PostgreSQL. Schema at `apps/api/prisma/schema.prisma`
- Generated client at `apps/api/generated/prisma` (not default location)
- `PrismaService` is a global module — inject directly, no need to import PrismaModule
- Table names are PascalCase (Prisma convention), quote in raw SQL: `"User"`

## File Storage

- `FileService` abstracts storage with dual backend: `LocalStorageService` (dev) or `R2Service` (prod)
- Selection based on environment — see [[file-storage]]
- Both implement: `uploadFile(file, prefix)` returning `{ key, url }`

## API Port & CORS

- Default port 8000, configurable via `PORT` env var
- CORS enabled for all origins with credentials
