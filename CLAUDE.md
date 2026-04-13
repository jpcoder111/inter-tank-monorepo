# Inter-Tank

Shipping document confirmation system. Turborepo monorepo: NestJS API + Next.js 15 frontend.

## Knowledge Base

A compiled wiki lives at `docs/wiki/`. **Start with `docs/wiki/index.md`** before exploring source code. It has a task routing table that maps your task to the 2-3 pages you need.

## Critical Rules

### API (`apps/api`)
- NestJS with global JWT auth. Use `@Public()` to bypass auth on a route.
- `@Public()` import: `auth/decorators/plublic.decorator.ts` (typo in filename — do not rename).
- Prisma client generated to `apps/api/generated/prisma` (not default location).
- Global `ValidationPipe` with `transform: true, whitelist: true` (set in `main.ts`).
- Port 8000. CORS enabled for all origins with credentials.

### Web (`apps/web`)
- Next.js 15 App Router. Pages at `apps/web/app/` (no `src/` directory).
- Server actions (`"use server"`) for mutations in `lib/*.ts`.
- React Query for server state. Hooks in `lib/<feature>/use*.ts`, keys in `lib/<feature>/query-keys.ts`.
- Axios client at `lib/api.ts` with automatic 401 → token refresh interceptor.
- Session: JWT in httpOnly cookie, managed by `lib/session.ts` (jose library).
- Port 3000 (Turbopack dev server).

### Monorepo
- npm workspaces. `npm run dev` from root starts both apps.
- PostgreSQL on port 5434 via docker-compose (user: postgres, pass: 123, db: nest).
- Prisma schema at `apps/api/prisma/schema.prisma`.

### Environment Variables
- `DATABASE_URL` — Postgres connection string
- `ANTHROPIC_API_KEY` — Claude AI for document extraction
- `SESSION_SECRET_KEY` — Next.js session JWT signing
- `BACKEND_URL` — API URL used by frontend server actions
- `CLOUDFLARE_R2_*` — R2 credentials (production only)

## Wiki Maintenance
When you change code that invalidates a wiki page, append to `docs/wiki/log.md`:
`- YYYY-MM-DD: Updated [[page-name]] — reason`
