---
type: module
scope: web
app_path: apps/web/app/confirmations
key_files:
  - apps/web/app/confirmations/new/page.tsx
  - apps/web/lib/confirmations.ts
depends_on: ["[[confirmation]]", "[[web-session]]"]
tags: [module, web, core-feature]
last_synced: 2026-04-11
---

# Confirmations (Frontend)

## Purpose

Lets users create shipping confirmations by filling a form, uploading a PDF, and receiving a generated confirmation document back as a download.

## Pages

- `/confirmations` -- Placeholder list page with a link to create a new confirmation. Displays "SOON" message for historical confirmations.
- `/confirmations/new` -- The main form. Client-side page using `react-hook-form`. Fields: client (dropdown from users list), shipper, importer, ref, incoterm, isInsulated, isFlexitank, isTermografos, and a required PDF file upload.

## Data Flow

1. **User list**: On mount, `new/page.tsx` calls `getUsers()` (from `lib/users.ts`) via the Axios client to populate the client dropdown.
2. **Submission**: `submitConfirmation` is a **server action** in `lib/confirmations.ts`. It builds a `FormData`, attaches the bearer token from the session cookie, and POSTs to `POST /confirmation` on the backend.
3. **Token retry**: If the backend returns 401, the server action calls `refreshAccessToken` inline (hitting `POST /auth/refresh`) then retries the original request once.
4. **Response**: The backend returns a PDF blob. The server action converts it to base64 and returns it to the client, which triggers a browser download via a temporary object URL.

## Gotchas

- The server action handles token refresh **independently** from the `SessionProvider` refresh cycle -- it has its own `refreshAccessToken` helper that also calls `updateTokens` to persist new tokens.
- The file is sent as `FormData` (multipart), not JSON. The server action receives `FormData` (not the typed `ConfirmationFormData`) because file uploads cannot be serialized.
- Session refresh on redirect: if the user arrives at `/confirmations/new` after login redirect, a `?refresh` query param triggers `refreshSession()` to hydrate the client session.

## Related

- [[confirmation]] -- backend confirmation module (PDF generation)
- [[web-session]] -- session cookie and token management
- [[web-users]] -- shares the user list for the client dropdown
