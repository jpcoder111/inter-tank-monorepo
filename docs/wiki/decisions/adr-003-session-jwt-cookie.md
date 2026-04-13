---
type: decision
status: accepted
date: 2026-04-11
tags: [decision, adr, auth]
last_synced: 2026-04-11
---

# ADR-003: Session as JWT in httpOnly Cookie

## Context
The Next.js frontend needs to maintain auth state across server components, client components, and middleware. The backend issues JWT access + refresh tokens.

## Decision
Wrap the backend tokens (access + refresh) and user info into a **session JWT** signed with `jose` and stored in an httpOnly cookie (30-day expiry). The `SessionProvider` React context manages client-side state and proactive token refresh (10 minutes before expiry). The Next.js middleware reads the session cookie to protect routes.

## Consequences
- httpOnly cookie prevents XSS token theft
- Session cookie acts as an envelope — it contains the backend JWTs, not replaces them
- Dual token layer: session JWT (frontend) wraps access JWT + refresh JWT (backend)
- Token refresh updates both the backend tokens and the session cookie
- Middleware can check auth without calling the backend (reads cookie directly)

## Related
- [[web-session]], [[auth-flow]], [[auth]]
