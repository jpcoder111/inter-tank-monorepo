---
type: module
scope: web
app_path: apps/web/lib
key_files:
  - apps/web/lib/session.ts
  - apps/web/providers/SessionProvider.tsx
  - apps/web/middleware.ts
depends_on: ["[[auth]]"]
tags: [module, web, auth]
last_synced: 2026-04-11
---

# Session (Frontend)

## Purpose

Manages user authentication state on the frontend via a JWT stored in an httpOnly cookie, with proactive token refresh and event-driven session validation.

## Pages

- `/auth/signin` -- Login form (email/password). Uses `lib/auth.signIn` server action which calls the backend and then `createSession` to set the cookie.
- `/api/session` (GET) -- Returns current session from cookie; used by `SessionProvider` to hydrate/validate client state.
- `/api/auth/update` (POST) -- Receives new access/refresh tokens and calls `updateTokens` to rewrite the session cookie.
- `/api/auth/signout` (GET) -- Calls backend signout, deletes the session cookie, redirects to `/`.

## Data Flow

1. **Login**: `signinForm` calls server action `signIn` -> backend `/auth/signin` -> `createSession` writes a signed JWT cookie (HS256, 30-day expiry) containing `user`, `accessToken`, and `refreshToken`.
2. **Middleware**: Runs on every non-API/non-static route. Reads the cookie via `getSession`; redirects unauthenticated users to `/auth/signin` with a `redirectTo` param.
3. **Client hydration**: Root layout reads the session server-side and passes it as `initialSession` to `SessionProvider`.
4. **Token refresh**: `SessionProvider` runs a 10-minute interval that calls `POST /auth/refresh` on the backend, then persists new tokens via `/api/auth/update`. Also refreshes on visibility-change, focus, and online events.
5. **API integration**: `setAuthProvider` wires `getAccessToken` into the Axios client (`lib/api.ts`) so every request gets the current bearer token.

## Gotchas

- The session cookie JWT is **separate** from the backend access token. The cookie wraps both backend tokens plus user info.
- `updateTokens` re-signs the entire cookie -- it does not patch it in place.
- Middleware only protects page routes; API routes under `/api/*` are excluded via the matcher.
- Network errors during session refresh intentionally keep the existing session alive rather than logging the user out.

## Related

- [[auth]] -- backend auth module (signin, refresh, signout endpoints)
- [[web-confirmations]] -- uses `getSession` for server-action auth
