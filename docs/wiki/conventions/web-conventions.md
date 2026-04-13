---
type: convention
scope: web
tags: [convention, web]
last_synced: 2026-04-11
---

# Web Conventions

## App Router Structure

- Next.js 15 App Router. Pages at `apps/web/app/<route>/page.tsx`
- No `src/` directory — everything under `apps/web/`
- Layouts in `layout.tsx` at route level. Root layout has providers + navbar
- Public routes: only `/auth/signin`. Everything else requires session (enforced by `middleware.ts`)

## Server Actions

- Mutations use `"use server"` functions in `lib/*.ts` (e.g., `lib/confirmations.ts`, `lib/auth.ts`)
- Server actions read session from cookies, attach Bearer token, call backend API
- Pattern: get session -> build request -> call backend -> handle 401 with refresh -> return result

## API Client (Client Components)

- Axios instance at `lib/api.ts` with `BACKEND_URL` as baseURL
- Request interceptor: gets token from `AuthProvider` and sets `Authorization` header
- Response interceptor: on 401, refreshes token and retries once (`_retry` flag prevents loops)
- `setAuthProvider()` called by `SessionProvider` on mount

## State Management

- **Server state**: React Query v5. Hooks in `lib/<feature>/use*.ts`, query keys in `lib/<feature>/query-keys.ts`
- **Auth state**: `SessionProvider` context at `providers/SessionProvider.tsx`
  - Proactive refresh: checks token expiry, refreshes 10 min before expiry
  - Event-driven: re-checks on visibility change, focus, online events
- **Form state**: react-hook-form + Zod resolvers (`@hookform/resolvers/zod`)

## Session

- JWT stored in httpOnly cookie (30-day expiry), managed by `lib/session.ts` using `jose`
- Session contains: `user` (id, firstName, lastName, role), `accessToken`, `refreshToken`
- API routes for session management: `/api/session` (GET), `/api/auth/update` (POST), `/api/auth/signout` (POST)

## UI Components

- Shadcn/ui-style components in `components/ui/` (Button, Label, DropdownMenu, etc.)
- Radix UI primitives underneath
- Tailwind CSS for styling. Utility: `cn()` from `lib/utils.ts` (clsx + tailwind-merge)
- Icons: Lucide React
- Notifications: react-hot-toast
