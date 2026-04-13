---
type: module
scope: web
app_path: apps/web/app/users
key_files:
  - apps/web/app/users/page.tsx
  - apps/web/lib/users.ts
  - apps/web/lib/users/useUsers.ts
depends_on: ["[[user]]", "[[web-session]]"]
tags: [module, web]
last_synced: 2026-04-11
---

# Users (Frontend)

## Purpose

CRUD interface for managing system users (create, list, edit profile, change password, delete).

## Pages

- `/users` -- Table listing all users (email, name, phone). Actions per row: edit, change password, delete. Uses `useUsers` React Query hook.
- `/users/new` -- Create user form (email, password, firstName, lastName, phone). Uses `useCreateUser` mutation.
- `/users/[id]/edit` -- Edit user form (firstName, lastName, phone). Loads user with `useUser(id)`, submits with `useUpdateUser(id)`.

## Data Flow

- **Reads**: React Query hooks in `lib/users/use*.ts` call functions from `lib/users.ts`, which use the Axios client (`lib/api.ts`). Endpoints: `GET /user`, `GET /user/:id`.
- **Mutations**: `useCreateUser` (`POST /user`), `useUpdateUser` (`PATCH /user/:id`), `useDeleteUser` (`DELETE /user/:id`), `useChangePassword` (`PATCH /user/:id/change-password`). All invalidate the `userKeys.list()` query key on success.
- **Auth**: All API calls go through the Axios client which attaches the bearer token via `SessionProvider.getAccessToken`.

## Gotchas

- `lib/users.ts` exports plain async functions (used by both React Query hooks and the confirmations page directly via `getUsers()`).
- The `User` type has `id: number` (not string) -- the edit page parses the route param with `parseInt`.
- `ChangePasswordModal` is rendered inline on the list page, not on a separate route.

## Related

- [[user]] -- backend user module
- [[web-session]] -- auth context and token management
- [[web-confirmations]] -- imports `getUsers` for the client dropdown
