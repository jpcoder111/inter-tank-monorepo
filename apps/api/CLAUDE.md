# API

See `docs/wiki/index.md` for the full knowledge base. Key pages for API work: [[api-conventions]], [[auth]], [[confirmation]].

## Quick Reference

- Module pattern: module.ts + service.ts + controller.ts + dto/
- Auth: global JwtAuthGuard, use @Public() for public routes
- @Public() import: `auth/decorators/plublic.decorator.ts` (typo, do not rename)
- Prisma client at `generated/prisma` (not default)
- Port: 8000
