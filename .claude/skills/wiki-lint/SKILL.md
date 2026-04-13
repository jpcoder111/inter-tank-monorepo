---
description: Check wiki pages for consistency with actual code
user_invocable: true
---

# wiki-lint — Verify Wiki Matches Code

Run consistency checks between the wiki and the actual codebase. Reports discrepancies without auto-fixing.

## Steps

### 1. Check module pages

For each file in `docs/wiki/modules/`:
1. Read the `app_path` and `key_files` from frontmatter
2. Verify the directory and files exist on disk
3. Check if new files were added to the directory that aren't mentioned in the wiki
4. For modules with controllers: verify the "Public API" section lists all current endpoints
5. Check that `depends_on` modules still exist

### 2. Check entity pages

For each file in `docs/wiki/entities/`:
1. Read `apps/api/prisma/schema.prisma`
2. Verify the entity's Schema table matches the current Prisma model fields
3. Flag any fields that were added, removed, or type-changed

### 3. Check flow pages

For each file in `docs/wiki/flows/`:
1. Verify all `touches_modules` wiki pages still exist
2. Verify all `touches_entities` wiki pages still exist

### 4. Check index

1. Verify every wiki page is referenced in `docs/wiki/index.md`
2. Verify no broken `[[backlinks]]` exist (referenced pages that don't exist)
3. Verify all `app_path` directories in module frontmatter still exist

### 5. Check conventions

1. Read `apps/api/src/main.ts` and verify api-conventions.md matches (validation pipe, CORS, port)
2. Read `apps/web/middleware.ts` and verify web-conventions.md matches (public paths, redirect logic)

### 6. Report

Output a summary:
- **OK pages**: pages that are in sync
- **Stale pages**: pages with outdated information (list what changed)
- **Missing pages**: code modules/entities without wiki pages
- **Orphan pages**: wiki pages for code that no longer exists
- **Broken links**: `[[backlinks]]` pointing to non-existent pages

## Rules

- This is a read-only operation — do not modify any files
- If discrepancies are found, suggest running `/wiki-sync` to fix them
- Report the `last_synced` date for stale pages so the user knows how old the info is
