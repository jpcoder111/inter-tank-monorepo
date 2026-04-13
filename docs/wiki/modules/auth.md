---
type: module
scope: api
app_path: apps/api/src/auth
key_files:
  - apps/api/src/auth/auth.service.ts
  - apps/api/src/auth/auth.controller.ts
depends_on: ["[[user]]"]
entities: ["[[user-entity]]"]
tags: [module, api, auth]
last_synced: 2026-04-11
---

# Auth

## Purpose
Handles user authentication via email/password credentials, issuing JWT access and refresh token pairs, and enforcing role-based access control across the API.

## Public API
- `POST /auth/signup` -- creates a new user account (public).
- `POST /auth/signin` -- validates credentials via `LocalAuthGuard`, returns access + refresh tokens (public).
- `POST /auth/refresh` -- issues a new token pair given a valid refresh token body (`RefreshAuthGuard`).
- `POST /auth/signout` -- clears the user's stored hashed refresh token (public).
- `GET /auth/protected` -- test endpoint; requires a valid JWT.

## Internal Architecture
### Strategies (Passport)
| Strategy | Name | Extracts from | Validates |
|---|---|---|---|
| `LocalStrategy` | `local` | Body fields `email` + `password` | Argon2 password hash |
| `JwtStrategy` | `jwt` | `Authorization: Bearer` header | Token signature + user existence |
| `RefreshStrategy` | `refresh-jwt` | Body field `refresh` | Token signature + Argon2 hash match against stored `hashedRefreshToken` |

### Guards
- **`JwtAuthGuard`** -- registered as a global `APP_GUARD`. Skips routes decorated with `@Public()`.
- **`LocalAuthGuard`** -- applied explicitly on the sign-in route.
- **`RefreshAuthGuard`** -- applied explicitly on the refresh route.
- **`RolesGuard`** -- checks the user's `role` (fetched from DB) against roles specified by the `@Roles()` decorator.

### Decorators
- `@Public()` -- sets `IS_PUBLIC` metadata so `JwtAuthGuard` lets the request through without a token.
- `@Roles(...roles)` -- sets required roles metadata consumed by `RolesGuard`.

### Token Flow
1. On sign-in, `AuthService.login()` generates an access token (default JWT config) and a refresh token (separate secret/expiry from `refreshConfig`).
2. The refresh token is hashed with Argon2 and persisted on the User record (`hashedRefreshToken`).
3. On refresh, the raw refresh token from the request body is verified against the stored hash before new tokens are issued.
4. On sign-out, `hashedRefreshToken` is set to `null`, invalidating all outstanding refresh tokens.

## Gotchas
- The `@Public()` decorator file is named `plublic.decorator.ts` (typo). All imports reference this filename.
- `JwtAuthGuard` is a **global guard** -- every route requires a JWT unless explicitly marked `@Public()`.
- `RolesGuard` is **not** global; it must be applied per-controller or per-route with `@UseGuards(RolesGuard)`.
- The sign-out endpoint is marked `@Public()`, so `req.user` may be `undefined`; the controller checks for this.

## Related
- [[user]] -- `UserService` is used for credential lookup, refresh token storage, and role checks.
- [[auth-flow]] -- end-to-end sign-in/refresh/sign-out flow including the frontend session layer.
