---
type: flow
triggers: ["User submits sign-in form", "Session token expires", "User signs out"]
touches_modules: ["[[web-session]]", "[[auth]]", "[[user]]"]
touches_entities: ["[[user-entity]]"]
tags: [flow, auth]
last_synced: 2026-04-11
---

# Auth Flow

## Trigger
User submits the sign-in form, a session/token expires, or the user signs out.

## Sequence

### Frontend -- Sign In
1. **Form submission** -- `signIn()` server action (`lib/auth.ts`) validates fields with Zod (`SigninFormSchema`).
2. **Backend call** -- `POST /auth/signin` with email + password.
3. **Session creation** -- on success, `createSession()` (`lib/session.ts`) builds a `jose` HS256 JWT containing `{ user, accessToken, refreshToken }`, sets it as an httpOnly `session` cookie (30-day expiry, secure, sameSite lax).
4. **Redirect** -- user is sent to `/confirmations/new`.

### Backend -- Sign In
1. `LocalAuthGuard` triggers `LocalStrategy.validate()`, which calls `AuthService.validateLocalUser()`.
2. Password is verified against the Argon2 hash stored on the User record.
3. `AuthService.login()` generates an access token + refresh token, hashes the refresh token with Argon2, stores it on the user, and returns both tokens plus user info.

### Frontend -- Session Management
- **`SessionProvider`** (React context) holds the session state client-side, initialized from the server-rendered session.
- **Proactive refresh** -- a 10-minute interval calls `POST /auth/refresh` with the current refresh token, then updates the session cookie via `POST /api/auth/update`.
- **Event-driven validation** -- on `visibilitychange`, `focus`, and `online` events, the provider calls `/api/session` to verify the session is still valid; redirects to sign-in on 401.
- **`getAccessToken(forceRefresh?)`** -- used by the API client (`setAuthProvider`) to attach bearer tokens to requests. Supports forced refresh.
- **`useSession()` hook** -- exposes `session`, `isLoading`, `refreshSession`, `getAccessToken`, and `logout`.

### Frontend -- Middleware
- `middleware.ts` runs on every non-API/static request.
- Reads the session cookie via `getSession()`. If no valid session, redirects to `/auth/signin` (preserving `redirectTo` for deep links).
- `/auth/signin` is the only public path.

### Sign Out
1. Frontend `logout()` calls `POST /api/auth/signout` (Next.js API route which deletes the session cookie).
2. Backend `POST /auth/signout` sets `hashedRefreshToken` to `null`, invalidating the refresh token.
3. Client state is cleared and user is redirected to `/auth/signin`.

## Error Handling
- **Invalid credentials** -- backend returns 401 `UnauthorizedException`; frontend shows "Sign in failed".
- **Expired access token** -- `SessionProvider` catches 401 from API calls and triggers `onAuthError` (logout).
- **Expired refresh token** -- refresh call fails, tokens cannot be renewed, user is logged out.
- **Duplicate sign-up** -- backend returns 409 `ConflictException`; frontend shows "The user already exists".
- **Network errors** -- `SessionProvider` keeps the existing session to avoid false logouts on transient failures.
