---
type: module
scope: api
app_path: apps/api/src/user
key_files:
  - apps/api/src/user/user.service.ts
  - apps/api/src/user/user.controller.ts
depends_on: ["[[auth]]"]
entities: ["[[user-entity]]"]
tags: [module, api]
last_synced: 2026-04-11
---

# User

## Purpose
CRUD operations for user accounts, including password management, consumed by both the Auth module and admin-facing endpoints.

## Public API
All routes are JWT-protected (global `JwtAuthGuard`). Admin-only routes additionally require `RolesGuard` + `@Roles(ADMIN)`.

| Method | Route | Access | Description |
|---|---|---|---|
| `POST /user` | Any authenticated | Create a user (hashes password with Argon2) |
| `GET /user` | Any authenticated | List all non-ADMIN users |
| `GET /user/:id` | ADMIN | Get a single user by ID |
| `PATCH /user/:id` | ADMIN | Partial update of user fields |
| `PATCH /user/:id/change-password` | ADMIN | Set a new password (Argon2 hash) |
| `DELETE /user/:id` | ADMIN | Delete a user |

## Internal Architecture
- **`UserService`** wraps Prisma calls against the `User` model.
- `findAll()` selects a safe subset of fields (excludes `password` and `hashedRefreshToken`).
- `changePassword()` returns the same safe subset after updating.
- `updateHashRefreshToken()` is the internal hook used by [[auth]] to persist or clear refresh token hashes.
- Passwords are always hashed with **Argon2** before storage (`hash()` from the `argon2` package).

## Gotchas
- `findAll()` in the controller filters out ADMIN users from the response (`user.role !== Role.ADMIN`), so admins are invisible in user listings.
- `POST /user` is **not** marked `@Public()` nor admin-restricted -- any authenticated user can create another user. This may be intentional for invitation flows, but worth noting.
- The `changePassword` endpoint does **not** verify the old password; it's an admin-only force-reset.

## Related
- [[auth]] -- depends on `UserService` for credential validation and refresh token storage.
- [[user-entity]] -- Prisma `User` model with `role`, `hashedRefreshToken`, `isClient` fields.
