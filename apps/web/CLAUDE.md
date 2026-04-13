# Web

See `docs/wiki/index.md` for the full knowledge base. Key pages for frontend work: [[web-conventions]], [[web-session]], [[web-confirmations]].

## Quick Reference
- App Router, no src/ directory. Pages at `app/<route>/page.tsx`
- Server actions for mutations in `lib/*.ts`
- React Query for reads. Hooks in `lib/<feature>/use*.ts`
- Axios client with token refresh at `lib/api.ts`
- Session: JWT in httpOnly cookie (`lib/session.ts`)
- Port: 3000
