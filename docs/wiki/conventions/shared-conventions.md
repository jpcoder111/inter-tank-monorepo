---
type: convention
scope: shared
tags: [convention, shared]
last_synced: 2026-04-11
---

# Shared Conventions

## Monorepo Structure

- Turborepo with npm workspaces. Root `package.json` declares `apps/*` and `packages/*`
- Node >= 18, npm 11, TypeScript 5.8.2

## Scripts (from repo root)

- `npm run dev` — starts both API and web in watch mode
- `npm run build` — builds all apps/packages
- `npm run lint` — ESLint across all packages
- `npm run format` — Prettier formatting
- `npm run check-types` — TypeScript type checking

## Shared Packages

- `@repo/eslint-config` — shared ESLint rules (base, next, react-internal)
- `@repo/typescript-config` — shared tsconfig (base, nextjs, react-library)
- `@repo/ui` — shared React component library (minimal, mostly stubs)
- `@repo/validators` — Zod validation schemas shared between frontend and backend

## Database Setup

- PostgreSQL via `docker-compose.yml`: port 5434, user `postgres`, password `123`, database `nest`
- Prisma migrations: `npm run dev` in API runs `prisma generate && prisma migrate deploy`

## Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | API | Postgres connection string |
| `ANTHROPIC_API_KEY` | API | Claude AI for document extraction |
| `SESSION_SECRET_KEY` | Web | JWT signing for session cookie |
| `BACKEND_URL` | Web (server) | API URL for server actions |
| `NEXT_PUBLIC_BACKEND_URL` | Web (client) | API URL for browser requests |
| `CLOUDFLARE_R2_*` | API | R2 storage credentials (prod only) |

## Turbo Configuration

- Tasks: `build`, `dev`, `lint`, `check-types`
- Global deps: `.env` file
- Global env: `BACKEND_URL`, `SESSION_SECRET_KEY`, `DATABASE_URL`
- Dev task: `cache: false`, `persistent: true`
